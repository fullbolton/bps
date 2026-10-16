-- EXPAND: durable tracking for general uploads. Not a raw-DML cutover.
BEGIN;
SET LOCAL lock_timeout='15s';
CREATE TABLE public.document_upload_attempts (
 document_id uuid PRIMARY KEY,tenant_id uuid NOT NULL,company_id uuid NOT NULL,
 actor_id uuid NOT NULL,storage_path text NOT NULL UNIQUE,
 name text NOT NULL,category text NOT NULL,validity_date date,file_size bigint NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),published_at timestamptz
);
ALTER TABLE public.document_upload_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.document_upload_attempts FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.document_upload_attempts TO authenticated;
CREATE POLICY document_upload_attempt_read ON public.document_upload_attempts FOR SELECT TO authenticated
 USING(tenant_id=public.current_user_verified_tenant() AND (actor_id=auth.uid() OR public.current_user_role()='yonetici'));
CREATE INDEX document_upload_attempt_pending ON public.document_upload_attempts(tenant_id,created_at) WHERE published_at IS NULL;
CREATE FUNCTION public.document_prepare_upload_v1(p_id uuid,p_tenant uuid,p_company uuid,p_name text,p_category text,p_validity date,p_size bigint)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=auth.uid();tenant uuid:=public.current_user_verified_tenant();attempt public.document_upload_attempts;path text;
BEGIN
 IF actor IS NULL OR tenant IS NULL OR tenant IS DISTINCT FROM p_tenant THEN RAISE EXCEPTION 'UPLOAD_SCOPE' USING ERRCODE='42501';END IF;
 IF p_id IS NULL OR p_company IS NULL OR p_name IS NULL OR btrim(p_name)='' OR p_size IS NULL OR p_size NOT BETWEEN 1 AND 10485760
 OR p_category IS NULL OR p_category NOT IN ('cerceve_sozlesme','ek_protokol','yetki_belgesi','operasyon_evraki','teklif_dosyasi','ziyaret_tutanagi','diger') THEN
  RAISE EXCEPTION 'UPLOAD_INPUT' USING ERRCODE='22023';END IF;
 PERFORM public.workspace_require_module_write_v1(tenant,ARRAY['documents']);
 PERFORM 1 FROM public.profiles WHERE id=actor FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'UPLOAD_SCOPE' USING ERRCODE='42501';END IF;
 PERFORM public.workspace_require_module_write_v1(tenant,ARRAY['documents']);
 IF public.current_user_verified_tenant() IS DISTINCT FROM tenant OR public.current_user_role() NOT IN ('yonetici','operasyon','ik') OR public.current_user_role() IS NULL THEN
  RAISE EXCEPTION 'UPLOAD_ROLE' USING ERRCODE='42501';END IF;
 PERFORM 1 FROM public.companies WHERE id=p_company AND tenant_id=tenant AND status IS DISTINCT FROM 'pasif' FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'UPLOAD_COMPANY' USING ERRCODE='42501';END IF;
 path:=p_company::text||'/'||p_id::text||'.pdf';
 IF EXISTS(SELECT FROM public.documents WHERE id=p_id OR storage_path=path)
 OR EXISTS(SELECT FROM public.document_cleanup_jobs WHERE storage_path=path) THEN RAISE EXCEPTION 'UPLOAD_PATH_USED' USING ERRCODE='23505';END IF;
 INSERT INTO public.document_upload_attempts(document_id,tenant_id,company_id,actor_id,storage_path,name,category,validity_date,file_size)
 VALUES(p_id,tenant,p_company,actor,path,p_name,p_category,p_validity,p_size) ON CONFLICT(document_id) DO NOTHING;
 SELECT * INTO attempt FROM public.document_upload_attempts WHERE document_id=p_id FOR UPDATE;
 IF attempt.tenant_id IS DISTINCT FROM tenant OR attempt.actor_id IS DISTINCT FROM actor
 OR attempt.company_id IS DISTINCT FROM p_company OR attempt.name IS DISTINCT FROM p_name OR attempt.category IS DISTINCT FROM p_category
 OR attempt.validity_date IS DISTINCT FROM p_validity OR attempt.file_size IS DISTINCT FROM p_size OR attempt.published_at IS NOT NULL THEN
  RAISE EXCEPTION 'UPLOAD_ATTEMPT_CONFLICT' USING ERRCODE='22023';END IF;
 RETURN attempt.storage_path;
END $$;
CREATE FUNCTION public.document_mark_upload_published_v1() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE attempt public.document_upload_attempts;
BEGIN
 SELECT * INTO attempt FROM public.document_upload_attempts WHERE document_id=NEW.id OR storage_path=NEW.storage_path FOR UPDATE;
 IF NOT FOUND THEN RETURN NEW;END IF;
 IF attempt.document_id IS DISTINCT FROM NEW.id OR attempt.tenant_id IS DISTINCT FROM NEW.tenant_id
 OR attempt.company_id IS DISTINCT FROM NEW.company_id OR attempt.actor_id IS DISTINCT FROM NEW.created_by
 OR attempt.actor_id IS DISTINCT FROM auth.uid() OR attempt.storage_path IS DISTINCT FROM NEW.storage_path
 OR attempt.name IS DISTINCT FROM NEW.name OR attempt.category IS DISTINCT FROM NEW.category
 OR attempt.validity_date IS DISTINCT FROM NEW.validity_date OR NEW.contract_id IS NOT NULL OR attempt.published_at IS NOT NULL THEN
  RAISE EXCEPTION 'UPLOAD_RECEIPT_MISMATCH' USING ERRCODE='23514';END IF;
 UPDATE public.document_upload_attempts SET published_at=clock_timestamp() WHERE document_id=attempt.document_id;
 RETURN NEW;
END $$;
CREATE TRIGGER documents_mark_upload_published AFTER INSERT ON public.documents
 FOR EACH ROW EXECUTE FUNCTION public.document_mark_upload_published_v1();
REVOKE ALL ON FUNCTION public.document_prepare_upload_v1(uuid,uuid,uuid,text,text,date,bigint),public.document_mark_upload_published_v1() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.document_prepare_upload_v1(uuid,uuid,uuid,text,text,date,bigint) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
