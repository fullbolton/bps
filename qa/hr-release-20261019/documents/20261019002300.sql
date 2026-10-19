BEGIN; SET LOCAL statement_timeout='60s'; SET LOCAL lock_timeout='5s';
LOCK TABLE supabase_migrations.schema_migrations IN EXCLUSIVE MODE;
DO $guard$ BEGIN
IF (SELECT array_agg(version ORDER BY version) FROM supabase_migrations.schema_migrations) IS DISTINCT FROM ARRAY['20260407000000','20260407000100','20260407000200','20260407000300','20260407000400','20260407000500','20260407000600','20260407000700','20260407000800','20260407000900','20260407001000','20260407001100','20260407001600','20260407001700','20260407001800','20260413000100','20260414000100','20260414000200','20260415000100','20260415000200','20260415000300','20260415000400','20260415000500','20260423000100','20260425000100','20260425000200','20260713000100','20260713000200','20260722000100','20260810000100','20260810000200','20260827000100','20260827000200','20260827000300','20260827000400','20260904000100','20260904000200','20260909000100','20260909000200','20260909000300','20260909000400','20260909000500','20260909000600','20260909000700','20260909000800','20260909000900','20260909001000','20260909001100','20260909001200','20260909001300','20260909001400','20260909001500','20260909001600','20260909001700','20260909001800','20260909001900','20260909002000','20260909002100','20260909002200','20260909002300','20260909002400','20260909002500','20260909002600','20260909002700','20260909002800','20260909002900','20260910000100','20260910000200','20260910000300','20260910000400','20260911000100','20260913000100','20260914000100','20260914000200','20260914000300','20260914000400','20260914000500','20260914000600','20260914000700','20260915000100','20260915000200','20260915000300','20260915000400','20260915000500','20260915000600','20260915000700','20260915000800','20260915000900','20260915001000','20260923000100','20260923000200','20260923000300','20260923000400','20260924000100','20260924000200','20260924000300','20260924000400','20260924000500','20260925000100','20260925000200','20260925000300','20260925000400','20260925000500','20260925000600','20260925000700','20260926000100','20260926000200','20260927000100','20260927000200','20260927000300','20260927000400','20260927000500','20260927000600','20260927000700','20260927000800','20260927000900','20260928000100','20260928000200','20260928000300','20260928000400','20260928000500','20260928000600','20260928000700','20260928000800','20261004001000','20261004001100','20261004001200','20261004001300','20261004001400','20261005000100','20261005000200','20261005000300','20261005000400','20261005000500','20261005000600','20261005000700','20261005000800','20261005000900','20261005001000','20261005001100','20261005001200','20261005001300','20261005001400','20261005001500','20261005001600','20261005001700','20261005001800','20261005001900','20261005002000','20261005002100','20261005002200','20261005002300','20261005002400','20261005002500','20261005002600','20261005002700','20261005002800','20261005002900','20261005003000','20261005003100','20261013000100','20261013000200','20261013000300','20261015000100','20261015000200','20261015000300','20261015000400','20261015000500','20261015000600','20261015000700','20261015000800','20261016000100','20261016000200','20261016000300','20261016000400','20261016000500','20261016000600','20261016000700','20261016000800','20261016000900','20261016001000','20261016001100','20261017000100','20261017000200','20261018000100','20261018000200','20261018000300','20261018000400','20261018000500','20261018000600','20261019000100','20261019000200','20261019000300','20261019000400','20261019000500','20261019000600','20261019000700','20261019000800','20261019000900','20261019001000','20261019001100','20261019001200','20261019001300','20261019001400','20261019001500','20261019001600','20261019001700','20261019001800','20261019001900','20261019002000','20261019002100','20261019002200']::text[] THEN RAISE EXCEPTION 'LIVE_LEDGER_CHANGED'; END IF;
IF to_regnamespace('bps_release_guard') IS NOT NULL THEN RAISE EXCEPTION 'RELEASE_BARRIER_PRESENT'; END IF;
END $guard$;
-- Reservations remain private; no Storage policy is opened until content verification is wired.

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

INSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES('20261019002300','hr_document_upload_ledger',ARRAY[$bps_source$-- Reservations remain private; no Storage policy is opened until content verification is wired.
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
$bps_source$]);
COMMIT;
