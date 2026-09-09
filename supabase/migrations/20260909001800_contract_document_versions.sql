-- First document slice: immutable version references, scoped reads and CAS revision.
-- Storage bytes and metadata are separate systems; this is not an upload receipt.
BEGIN;
SET LOCAL lock_timeout='15s';
LOCK TABLE public.documents IN ACCESS EXCLUSIVE MODE;
ALTER TABLE public.documents ADD COLUMN revision bigint NOT NULL DEFAULT 0
  CHECK(revision BETWEEN 0 AND 9007199254740991);
CREATE TABLE public.contract_document_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE RESTRICT,
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE RESTRICT,
  tenant_id uuid NOT NULL,
  company_id uuid NOT NULL,
  revision bigint NOT NULL,
  name text NOT NULL,
  storage_path text NOT NULL,
  object_id uuid REFERENCES storage.objects(id) ON DELETE RESTRICT,
  actor_id uuid,
  actor_name text,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  origin text NOT NULL CHECK(origin IN ('baseline','upload')),
  UNIQUE(document_id,revision)
);
CREATE INDEX contract_document_versions_contract_idx ON public.contract_document_versions(contract_id,revision DESC);
CREATE UNIQUE INDEX contract_document_versions_path_idx ON public.contract_document_versions(storage_path);
ALTER TABLE public.contract_document_versions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.contract_document_versions FROM PUBLIC,anon,authenticated;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.documents d LEFT JOIN public.contracts c ON c.id=d.contract_id
   LEFT JOIN public.companies co ON co.id=d.company_id
   WHERE d.contract_id IS NOT NULL AND (c.id IS NULL OR c.tenant_id IS DISTINCT FROM d.tenant_id
     OR c.company_id IS DISTINCT FROM d.company_id OR co.tenant_id IS DISTINCT FROM d.tenant_id
     OR (d.storage_path IS NOT NULL AND split_part(d.storage_path,'/',1)<>d.company_id::text)))
 THEN RAISE EXCEPTION 'PDF_BASELINE_CONTEXT_INVALID'; END IF;
END $$;
-- Metadata baseline only. Missing object stays NULL; no bytes/hash verification claimed.
INSERT INTO public.contract_document_versions(document_id,contract_id,tenant_id,company_id,revision,name,storage_path,object_id,actor_name,recorded_at,origin)
SELECT d.id,d.contract_id,d.tenant_id,d.company_id,d.revision,d.name,d.storage_path,o.id,d.uploaded_by,d.updated_at,'baseline'
FROM public.documents d LEFT JOIN storage.objects o ON o.bucket_id='documents' AND o.name=d.storage_path
WHERE d.contract_id IS NOT NULL AND d.storage_path IS NOT NULL;

CREATE FUNCTION public.documents_guard_version() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_company uuid; v_status text; v_actor uuid:=auth.uid(); v_name text;
BEGIN
  IF TG_OP='INSERT' THEN NEW.revision:=0; ELSE NEW.revision:=OLD.revision+1; END IF;
  IF TG_OP='UPDATE' AND (OLD.contract_id IS NOT NULL OR NEW.contract_id IS NOT NULL) AND
    (OLD.contract_id IS DISTINCT FROM NEW.contract_id OR OLD.tenant_id IS DISTINCT FROM NEW.tenant_id
     OR OLD.company_id IS DISTINCT FROM NEW.company_id OR OLD.id IS DISTINCT FROM NEW.id)
  THEN RAISE EXCEPTION 'PDF_CONTEXT_IMMUTABLE'; END IF;
  IF NEW.contract_id IS NULL THEN RETURN NEW; END IF;
  IF current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION 'PDF_ISOLATION'; END IF;
  PERFORM id FROM public.profiles WHERE id=v_actor FOR SHARE;
  IF v_actor IS NULL OR public.current_user_verified_tenant() IS DISTINCT FROM NEW.tenant_id
     OR public.current_user_role() IS DISTINCT FROM 'yonetici' THEN RAISE EXCEPTION 'PDF_SCOPE'; END IF;
  SELECT status INTO v_status FROM public.companies WHERE id=NEW.company_id AND tenant_id=NEW.tenant_id FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PDF_SCOPE'; END IF;
  SELECT company_id INTO v_company FROM public.contracts WHERE id=NEW.contract_id AND tenant_id=NEW.tenant_id FOR SHARE;
  IF NOT FOUND OR v_company IS DISTINCT FROM NEW.company_id THEN RAISE EXCEPTION 'PDF_SCOPE'; END IF;
  IF TG_OP='UPDATE' AND NEW.storage_path IS NOT DISTINCT FROM OLD.storage_path THEN RETURN NEW; END IF;
  IF v_status IS NULL OR v_status NOT IN ('aktif','aday') THEN RAISE EXCEPTION 'PDF_PASSIVE'; END IF;
  IF NEW.storage_path IS NULL OR split_part(NEW.storage_path,'/',1)<>NEW.company_id::text
    OR NEW.storage_path !~ '^[0-9a-f-]{36}/[^/]+\.pdf$' THEN RAISE EXCEPTION 'PDF_OBJECT'; END IF;
  PERFORM id FROM storage.objects WHERE bucket_id='documents' AND name=NEW.storage_path
    AND owner_id=v_actor::text FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PDF_OBJECT'; END IF;
  -- Do not reattach an older version or another contract's file as a new upload.
  IF EXISTS(SELECT 1 FROM public.contract_document_versions WHERE storage_path=NEW.storage_path)
  THEN RAISE EXCEPTION 'PDF_OBJECT_REUSED'; END IF;
  SELECT display_name INTO v_name FROM public.profiles WHERE id=v_actor;
  NEW.uploaded_by:=v_name;
  RETURN NEW;
END $$;
CREATE TRIGGER documents_guard_version BEFORE INSERT OR UPDATE ON public.documents
FOR EACH ROW EXECUTE FUNCTION public.documents_guard_version();

CREATE FUNCTION public.documents_record_version() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF NEW.contract_id IS NOT NULL AND NEW.storage_path IS NOT NULL
    AND (TG_OP='INSERT' OR NEW.storage_path IS DISTINCT FROM OLD.storage_path) THEN
    INSERT INTO public.contract_document_versions(document_id,contract_id,tenant_id,company_id,revision,name,storage_path,object_id,actor_id,actor_name,origin)
    SELECT NEW.id,NEW.contract_id,NEW.tenant_id,NEW.company_id,NEW.revision,NEW.name,NEW.storage_path,o.id,auth.uid(),NEW.uploaded_by,'upload'
    FROM storage.objects o WHERE o.bucket_id='documents' AND o.name=NEW.storage_path;
    IF NOT FOUND THEN RAISE EXCEPTION 'PDF_OBJECT'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER documents_record_version AFTER INSERT OR UPDATE ON public.documents
FOR EACH ROW EXECUTE FUNCTION public.documents_record_version();

CREATE FUNCTION public.contracts_guard_pdf_context() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF (NEW.id IS DISTINCT FROM OLD.id OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
   OR NEW.company_id IS DISTINCT FROM OLD.company_id)
   AND EXISTS(SELECT 1 FROM public.contract_document_versions WHERE contract_id=OLD.id)
 THEN RAISE EXCEPTION 'PDF_CONTEXT_IMMUTABLE'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER contracts_guard_pdf_context BEFORE UPDATE ON public.contracts
FOR EACH ROW EXECUTE FUNCTION public.contracts_guard_pdf_context();

-- A restrictive policy complements existing bucket policies; it grants no access.
CREATE FUNCTION public.is_retained_contract_object(p_bucket text,p_path text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT p_bucket='documents' AND EXISTS(SELECT 1 FROM public.contract_document_versions WHERE storage_path=p_path)
$$;
CREATE POLICY contract_versions_prevent_object_delete ON storage.objects AS RESTRICTIVE
FOR DELETE TO authenticated USING(NOT public.is_retained_contract_object(bucket_id,name));
CREATE POLICY contract_versions_prevent_object_update ON storage.objects AS RESTRICTIVE
FOR UPDATE TO authenticated USING(NOT public.is_retained_contract_object(bucket_id,name))
WITH CHECK(NOT public.is_retained_contract_object(bucket_id,name));

CREATE FUNCTION public.can_read_retained_contract_object(p_bucket text,p_path text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT NOT public.is_retained_contract_object(p_bucket,p_path) OR (
   public.current_user_role() IN ('yonetici','operasyon','ik') AND EXISTS(
     SELECT 1 FROM public.contract_document_versions v WHERE v.storage_path=p_path
       AND v.tenant_id=public.current_user_verified_tenant()))
$$;
CREATE POLICY contract_versions_verify_object_read ON storage.objects AS RESTRICTIVE
FOR SELECT TO authenticated USING(public.can_read_retained_contract_object(bucket_id,name));

CREATE FUNCTION public.contract_pdf_versions(p_actor_id uuid,p_tenant_id uuid,p_contract_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
SELECT jsonb_build_object('contractId',c.id,'versions',coalesce((
 SELECT jsonb_agg(x.item ORDER BY x.revision DESC) FROM (
  SELECT v.revision,jsonb_build_object('id',v.id,'documentId',v.document_id,'revision',v.revision,
    'name',v.name,'actorName',v.actor_name,'recordedAt',v.recorded_at,'origin',v.origin,
    'current',d.storage_path=v.storage_path) item
  FROM public.contract_document_versions v JOIN public.documents d ON d.id=v.document_id
  WHERE v.contract_id=c.id AND v.tenant_id=c.tenant_id ORDER BY v.revision DESC LIMIT 51
 ) x),'[]'::jsonb))
FROM public.contracts c WHERE c.id=p_contract_id AND c.tenant_id=p_tenant_id
 AND p_actor_id=auth.uid() AND p_tenant_id=public.current_user_verified_tenant()
 AND public.current_user_role() IN ('yonetici','operasyon')
$$;
CREATE FUNCTION public.contract_pdf_version_path(p_actor_id uuid,p_tenant_id uuid,p_version_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
SELECT v.storage_path FROM public.contract_document_versions v
 JOIN public.contracts c ON c.id=v.contract_id AND c.tenant_id=v.tenant_id AND c.company_id=v.company_id
 WHERE v.id=p_version_id AND v.tenant_id=p_tenant_id AND p_actor_id=auth.uid()
 AND p_tenant_id=public.current_user_verified_tenant() AND public.current_user_role() IN ('yonetici','operasyon')
$$;
REVOKE ALL ON FUNCTION public.documents_guard_version(),public.documents_record_version(),public.contracts_guard_pdf_context(),public.is_retained_contract_object(text,text),public.can_read_retained_contract_object(text,text),public.contract_pdf_versions(uuid,uuid,uuid),public.contract_pdf_version_path(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.is_retained_contract_object(text,text),public.can_read_retained_contract_object(text,text),public.contract_pdf_versions(uuid,uuid,uuid),public.contract_pdf_version_path(uuid,uuid,uuid) TO authenticated;
COMMIT;
