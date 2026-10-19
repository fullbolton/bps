-- Reservations remain private; no Storage policy is opened until content verification is wired.
BEGIN;
CREATE TABLE public.hr_document_uploads (
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,employee_id uuid NOT NULL,employment_id uuid NOT NULL,
 actor_id uuid NOT NULL REFERENCES public.profiles(id),title text NOT NULL,
 file_size bigint NOT NULL CHECK(file_size BETWEEN 5 AND 10485760),content_sha256 text NOT NULL CHECK(content_sha256~'^[a-f0-9]{64}$'),
 validity_date date,state text NOT NULL DEFAULT 'pending' CHECK(state IN('pending','published','cancelled')),
 created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
 UNIQUE(tenant_id,id),FOREIGN KEY(tenant_id,employment_id,employee_id) REFERENCES public.hr_employment_periods(tenant_id,id,employee_id)
);
ALTER TABLE public.hr_document_uploads ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.hr_document_uploads FROM PUBLIC,anon,authenticated,service_role;
CREATE INDEX hr_document_uploads_pending ON public.hr_document_uploads(tenant_id,actor_id,employee_id,id) WHERE state='pending';
CREATE FUNCTION public.hr_document_prepare_v1(p_actor uuid,p_tenant uuid,p_id uuid,p_employee uuid,p_employment uuid,p_title text,p_size bigint,p_sha256 text,p_validity date DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='5s' AS $$
DECLARE previous public.hr_document_uploads;body jsonb;
BEGIN
 IF current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION 'ACCESS_ISOLATION';END IF;
 PERFORM public.hr_access_mode_v1(p_actor,p_tenant);
 PERFORM 1 FROM public.tenant_module_config WHERE tenant_id=p_tenant FOR UPDATE;
 PERFORM 1 FROM public.profiles WHERE id=p_actor FOR SHARE;
 PERFORM 1 FROM public.tenants WHERE id=p_tenant FOR UPDATE;
 PERFORM 1 FROM public.tenant_memberships WHERE tenant_id=p_tenant AND user_id=p_actor FOR SHARE;
 PERFORM public.hr_private_document_access_v1(p_actor,p_tenant,p_employee,true);
 IF p_id IS NULL OR p_title IS NULL OR length(btrim(p_title)) NOT BETWEEN 1 AND 160 OR p_title~'[0-9]{11}' OR p_title~'[[:cntrl:]]'
 OR p_size IS NULL OR p_size NOT BETWEEN 5 AND 10485760 OR p_sha256 IS NULL OR p_sha256!~'^[a-f0-9]{64}$'
 OR (p_validity IS NOT NULL AND p_validity NOT BETWEEN DATE '1900-01-01' AND DATE '2199-12-31') THEN RAISE EXCEPTION 'HR_INPUT';END IF;
 IF NOT EXISTS(SELECT FROM public.hr_employment_periods WHERE tenant_id=p_tenant AND employee_id=p_employee AND id=p_employment) THEN RAISE EXCEPTION 'HR_FORBIDDEN';END IF;
 SELECT * INTO previous FROM public.hr_document_uploads WHERE id=p_id;
 IF FOUND THEN
  IF previous.tenant_id IS DISTINCT FROM p_tenant OR previous.actor_id IS DISTINCT FROM p_actor OR previous.employee_id IS DISTINCT FROM p_employee OR previous.employment_id IS DISTINCT FROM p_employment
  OR previous.title IS DISTINCT FROM btrim(p_title) OR previous.file_size IS DISTINCT FROM p_size OR previous.content_sha256 IS DISTINCT FROM p_sha256 OR previous.validity_date IS DISTINCT FROM p_validity THEN RAISE EXCEPTION 'HR_COMMAND_REUSED';END IF;
 ELSE
  IF (SELECT count(*) FROM public.hr_document_uploads WHERE tenant_id=p_tenant AND actor_id=p_actor AND state='pending')>=100 THEN RAISE EXCEPTION 'HR_UPLOAD_LIMIT';END IF;
  INSERT INTO public.hr_document_uploads(id,tenant_id,employee_id,employment_id,actor_id,title,file_size,content_sha256,validity_date) VALUES(p_id,p_tenant,p_employee,p_employment,p_actor,btrim(p_title),p_size,p_sha256,p_validity) RETURNING * INTO previous;
 END IF;
 body:=jsonb_build_object('schemaVersion',1,'actorId',p_actor,'tenantId',p_tenant,'employeeId',p_employee,'employmentId',p_employment,'id',p_id,'title',previous.title,'size',previous.file_size,'sha256',previous.content_sha256,'validityDate',previous.validity_date,'state',previous.state);
 RETURN body;
END $$;
CREATE FUNCTION public.hr_document_pending_v1(p_actor uuid,p_tenant uuid,p_employee uuid,p_after uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE rows jsonb;more boolean;
BEGIN
 PERFORM public.hr_private_document_access_v1(p_actor,p_tenant,p_employee,true);
 WITH page AS MATERIALIZED(SELECT * FROM public.hr_document_uploads WHERE tenant_id=p_tenant AND employee_id=p_employee AND actor_id=p_actor AND state='pending' AND (p_after IS NULL OR id>p_after) ORDER BY id LIMIT 51),visible AS(SELECT * FROM page ORDER BY id LIMIT 50)
 SELECT coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'employmentId',employment_id,'title',title,'size',file_size,'sha256',content_sha256,'validityDate',validity_date,'createdAt',created_at) ORDER BY id) FROM visible),'[]'),(SELECT count(*)>50 FROM page) INTO rows,more;
 RETURN jsonb_build_object('schemaVersion',1,'actorId',p_actor,'tenantId',p_tenant,'employeeId',p_employee,'uploads',rows,'hasMore',more);
END $$;
-- Before Storage is enabled an empty reservation can safely be cancelled. Once
-- an object exists this command refuses; the cleanup handshake must take over.
CREATE FUNCTION public.hr_document_cancel_empty_v1(p_actor uuid,p_tenant uuid,p_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='5s' AS $$
DECLARE attempt public.hr_document_uploads;
BEGIN
 IF current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION 'ACCESS_ISOLATION';END IF;
 PERFORM public.hr_access_mode_v1(p_actor,p_tenant);
 PERFORM 1 FROM public.tenant_module_config WHERE tenant_id=p_tenant FOR UPDATE;
 PERFORM 1 FROM public.profiles WHERE id=p_actor FOR SHARE;
 PERFORM 1 FROM public.tenants WHERE id=p_tenant FOR UPDATE;
 PERFORM 1 FROM public.tenant_memberships WHERE tenant_id=p_tenant AND user_id=p_actor FOR SHARE;
 SELECT * INTO attempt FROM public.hr_document_uploads WHERE tenant_id=p_tenant AND id=p_id AND actor_id=p_actor FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'HR_FORBIDDEN';END IF;
 PERFORM public.hr_private_document_access_v1(p_actor,p_tenant,attempt.employee_id,true);
 IF attempt.state='published' THEN RAISE EXCEPTION 'HR_UPLOAD_PUBLISHED';END IF;
 IF EXISTS(SELECT FROM storage.objects WHERE bucket_id='hr-private' AND name=p_tenant::text||'/'||p_id::text||'.pdf') THEN RAISE EXCEPTION 'HR_UPLOAD_CLEANUP_REQUIRED';END IF;
 UPDATE public.hr_document_uploads SET state='cancelled' WHERE id=p_id;
 RETURN jsonb_build_object('schemaVersion',1,'actorId',p_actor,'tenantId',p_tenant,'id',p_id,'state','cancelled');
END $$;
REVOKE ALL ON FUNCTION public.hr_document_prepare_v1(uuid,uuid,uuid,uuid,uuid,text,bigint,text,date),public.hr_document_pending_v1(uuid,uuid,uuid,uuid),public.hr_document_cancel_empty_v1(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.hr_document_prepare_v1(uuid,uuid,uuid,uuid,uuid,text,bigint,text,date),public.hr_document_pending_v1(uuid,uuid,uuid,uuid),public.hr_document_cancel_empty_v1(uuid,uuid,uuid) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
