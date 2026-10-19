BEGIN; SET LOCAL statement_timeout='60s'; SET LOCAL lock_timeout='5s';
LOCK TABLE supabase_migrations.schema_migrations IN EXCLUSIVE MODE;
DO $guard$ BEGIN
IF (SELECT array_agg(version ORDER BY version) FROM supabase_migrations.schema_migrations) IS DISTINCT FROM ARRAY['20260407000000','20260407000100','20260407000200','20260407000300','20260407000400','20260407000500','20260407000600','20260407000700','20260407000800','20260407000900','20260407001000','20260407001100','20260407001600','20260407001700','20260407001800','20260413000100','20260414000100','20260414000200','20260415000100','20260415000200','20260415000300','20260415000400','20260415000500','20260423000100','20260425000100','20260425000200','20260713000100','20260713000200','20260722000100','20260810000100','20260810000200','20260827000100','20260827000200','20260827000300','20260827000400','20260904000100','20260904000200','20260909000100','20260909000200','20260909000300','20260909000400','20260909000500','20260909000600','20260909000700','20260909000800','20260909000900','20260909001000','20260909001100','20260909001200','20260909001300','20260909001400','20260909001500','20260909001600','20260909001700','20260909001800','20260909001900','20260909002000','20260909002100','20260909002200','20260909002300','20260909002400','20260909002500','20260909002600','20260909002700','20260909002800','20260909002900','20260910000100','20260910000200','20260910000300','20260910000400','20260911000100','20260913000100','20260914000100','20260914000200','20260914000300','20260914000400','20260914000500','20260914000600','20260914000700','20260915000100','20260915000200','20260915000300','20260915000400','20260915000500','20260915000600','20260915000700','20260915000800','20260915000900','20260915001000','20260923000100','20260923000200','20260923000300','20260923000400','20260924000100','20260924000200','20260924000300','20260924000400','20260924000500','20260925000100','20260925000200','20260925000300','20260925000400','20260925000500','20260925000600','20260925000700','20260926000100','20260926000200','20260927000100','20260927000200','20260927000300','20260927000400','20260927000500','20260927000600','20260927000700','20260927000800','20260927000900','20260928000100','20260928000200','20260928000300','20260928000400','20260928000500','20260928000600','20260928000700','20260928000800','20261004001000','20261004001100','20261004001200','20261004001300','20261004001400','20261005000100','20261005000200','20261005000300','20261005000400','20261005000500','20261005000600','20261005000700','20261005000800','20261005000900','20261005001000','20261005001100','20261005001200','20261005001300','20261005001400','20261005001500','20261005001600','20261005001700','20261005001800','20261005001900','20261005002000','20261005002100','20261005002200','20261005002300','20261005002400','20261005002500','20261005002600','20261005002700','20261005002800','20261005002900','20261005003000','20261005003100','20261013000100','20261013000200','20261013000300','20261015000100','20261015000200','20261015000300','20261015000400','20261015000500','20261015000600','20261015000700','20261015000800','20261016000100','20261016000200','20261016000300','20261016000400','20261016000500','20261016000600','20261016000700','20261016000800','20261016000900','20261016001000','20261016001100','20261017000100','20261017000200','20261018000100','20261018000200','20261018000300','20261018000400','20261018000500','20261018000600','20261019000100','20261019000200','20261019000300','20261019000400','20261019000500','20261019000600','20261019000700','20261019000800','20261019000900','20261019001000','20261019001100','20261019001200','20261019001300','20261019001400','20261019001500','20261019001600','20261019001700','20261019001800','20261019001900','20261019002000','20261019002100']::text[] THEN RAISE EXCEPTION 'LIVE_LEDGER_CHANGED'; END IF;
IF to_regnamespace('bps_release_guard') IS NOT NULL THEN RAISE EXCEPTION 'RELEASE_BARRIER_PRESENT'; END IF;
END $guard$;
-- Private HR document registry. No Storage upload/download policy is enabled here.

CREATE TABLE public.hr_private_documents (
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,employee_id uuid NOT NULL,employment_id uuid NOT NULL,
 title text NOT NULL CHECK(length(btrim(title)) BETWEEN 1 AND 160 AND title !~ '[0-9]{11}'),
 storage_path text NOT NULL UNIQUE CHECK(storage_path<>''),
 file_size bigint NOT NULL CHECK(file_size BETWEEN 1 AND 10485760),
 content_sha256 text NOT NULL CHECK(content_sha256~'^[a-f0-9]{64}$'),
 validity_date date CHECK(validity_date BETWEEN DATE '1900-01-01' AND DATE '2199-12-31'),
 created_by uuid NOT NULL REFERENCES public.profiles(id),created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
 UNIQUE(tenant_id,id),
 FOREIGN KEY(tenant_id,employment_id,employee_id) REFERENCES public.hr_employment_periods(tenant_id,id,employee_id)
);
CREATE INDEX hr_private_documents_employee_page ON public.hr_private_documents(tenant_id,employee_id,id);
ALTER TABLE public.hr_private_documents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.hr_private_documents FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.hr_private_document_access_v1(p_actor uuid,p_tenant uuid,p_employee uuid,p_write boolean DEFAULT false) RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE mode text:=public.hr_access_mode_v1(p_actor,p_tenant);department uuid;location uuid;account uuid;today date:=(statement_timestamp() AT TIME ZONE 'Europe/Istanbul')::date;
BEGIN
 IF p_write IS NULL THEN RAISE EXCEPTION 'HR_INPUT';END IF;
 IF NOT EXISTS(SELECT FROM public.tenant_module_settings s JOIN public.tenant_module_entitlements e USING(tenant_id,module_key) WHERE s.tenant_id=p_tenant AND s.module_key='hr' AND s.enabled AND e.granted) THEN RAISE EXCEPTION 'HR_MODULE_CLOSED';END IF;
 IF NOT EXISTS(SELECT FROM public.hr_employees WHERE tenant_id=p_tenant AND id=p_employee) THEN RAISE EXCEPTION 'HR_FORBIDDEN';END IF;
 IF public.current_user_role()='yonetici' THEN RETURN;END IF;
 -- No upload capability exists yet: do not infer it from general employee editing.
 IF p_write THEN RAISE EXCEPTION 'HR_MANAGER_REQUIRED';END IF;
 IF mode='legacy' THEN
  IF public.current_user_role() IS DISTINCT FROM 'ik' THEN RAISE EXCEPTION 'HR_FORBIDDEN';END IF;
  RETURN;
 END IF;
 SELECT department_id INTO department FROM public.hr_assignments WHERE tenant_id=p_tenant AND employee_id=p_employee AND daterange(starts_on,ends_on,'[]') @> today;
 SELECT location_id INTO location FROM public.hr_location_assignments WHERE tenant_id=p_tenant AND employee_id=p_employee AND daterange(starts_on,ends_on,'[]') @> today;
 account:=public.hr_employee_account_v1(p_tenant,p_employee);
 IF NOT (public.company_access_decision_v1(p_tenant,p_actor,'hr.employees.read',account,department,location,statement_timestamp())->>'allowed')::boolean
 OR NOT (public.company_access_decision_v1(p_tenant,p_actor,'hr.documents.download',account,department,location,statement_timestamp())->>'allowed')::boolean THEN RAISE EXCEPTION 'HR_FORBIDDEN';END IF;
END $$;
CREATE FUNCTION public.hr_private_documents_v1(p_actor uuid,p_tenant uuid,p_employee uuid,p_after uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE rows jsonb;more boolean;today date:=(statement_timestamp() AT TIME ZONE 'Europe/Istanbul')::date;
BEGIN
 PERFORM public.hr_private_document_access_v1(p_actor,p_tenant,p_employee,false);
 WITH page AS MATERIALIZED(SELECT id,title,employment_id,validity_date,created_at FROM public.hr_private_documents WHERE tenant_id=p_tenant AND employee_id=p_employee AND (p_after IS NULL OR id>p_after) ORDER BY id LIMIT 51),
 visible AS (SELECT * FROM page ORDER BY id LIMIT 50)
 SELECT coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'title',title,'employmentId',employment_id,'validityDate',validity_date,'expired',coalesce(validity_date<today,false),'createdAt',created_at) ORDER BY id) FROM visible),'[]'),(SELECT count(*)>50 FROM page) INTO rows,more;
 RETURN jsonb_build_object('schemaVersion',1,'actorId',p_actor,'tenantId',p_tenant,'employeeId',p_employee,'documents',rows,'hasMore',more);
END $$;
REVOKE ALL ON FUNCTION public.hr_private_document_access_v1(uuid,uuid,uuid,boolean),public.hr_private_documents_v1(uuid,uuid,uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.hr_private_documents_v1(uuid,uuid,uuid,uuid) TO authenticated;
NOTIFY pgrst,'reload schema';

INSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES('20261019002200','hr_private_document_boundary',ARRAY[$bps_source$-- Private HR document registry. No Storage upload/download policy is enabled here.
BEGIN;
CREATE TABLE public.hr_private_documents (
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,employee_id uuid NOT NULL,employment_id uuid NOT NULL,
 title text NOT NULL CHECK(length(btrim(title)) BETWEEN 1 AND 160 AND title !~ '[0-9]{11}'),
 storage_path text NOT NULL UNIQUE CHECK(storage_path<>''),
 file_size bigint NOT NULL CHECK(file_size BETWEEN 1 AND 10485760),
 content_sha256 text NOT NULL CHECK(content_sha256~'^[a-f0-9]{64}$'),
 validity_date date CHECK(validity_date BETWEEN DATE '1900-01-01' AND DATE '2199-12-31'),
 created_by uuid NOT NULL REFERENCES public.profiles(id),created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
 UNIQUE(tenant_id,id),
 FOREIGN KEY(tenant_id,employment_id,employee_id) REFERENCES public.hr_employment_periods(tenant_id,id,employee_id)
);
CREATE INDEX hr_private_documents_employee_page ON public.hr_private_documents(tenant_id,employee_id,id);
ALTER TABLE public.hr_private_documents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.hr_private_documents FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.hr_private_document_access_v1(p_actor uuid,p_tenant uuid,p_employee uuid,p_write boolean DEFAULT false) RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE mode text:=public.hr_access_mode_v1(p_actor,p_tenant);department uuid;location uuid;account uuid;today date:=(statement_timestamp() AT TIME ZONE 'Europe/Istanbul')::date;
BEGIN
 IF p_write IS NULL THEN RAISE EXCEPTION 'HR_INPUT';END IF;
 IF NOT EXISTS(SELECT FROM public.tenant_module_settings s JOIN public.tenant_module_entitlements e USING(tenant_id,module_key) WHERE s.tenant_id=p_tenant AND s.module_key='hr' AND s.enabled AND e.granted) THEN RAISE EXCEPTION 'HR_MODULE_CLOSED';END IF;
 IF NOT EXISTS(SELECT FROM public.hr_employees WHERE tenant_id=p_tenant AND id=p_employee) THEN RAISE EXCEPTION 'HR_FORBIDDEN';END IF;
 IF public.current_user_role()='yonetici' THEN RETURN;END IF;
 -- No upload capability exists yet: do not infer it from general employee editing.
 IF p_write THEN RAISE EXCEPTION 'HR_MANAGER_REQUIRED';END IF;
 IF mode='legacy' THEN
  IF public.current_user_role() IS DISTINCT FROM 'ik' THEN RAISE EXCEPTION 'HR_FORBIDDEN';END IF;
  RETURN;
 END IF;
 SELECT department_id INTO department FROM public.hr_assignments WHERE tenant_id=p_tenant AND employee_id=p_employee AND daterange(starts_on,ends_on,'[]') @> today;
 SELECT location_id INTO location FROM public.hr_location_assignments WHERE tenant_id=p_tenant AND employee_id=p_employee AND daterange(starts_on,ends_on,'[]') @> today;
 account:=public.hr_employee_account_v1(p_tenant,p_employee);
 IF NOT (public.company_access_decision_v1(p_tenant,p_actor,'hr.employees.read',account,department,location,statement_timestamp())->>'allowed')::boolean
 OR NOT (public.company_access_decision_v1(p_tenant,p_actor,'hr.documents.download',account,department,location,statement_timestamp())->>'allowed')::boolean THEN RAISE EXCEPTION 'HR_FORBIDDEN';END IF;
END $$;
CREATE FUNCTION public.hr_private_documents_v1(p_actor uuid,p_tenant uuid,p_employee uuid,p_after uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE rows jsonb;more boolean;today date:=(statement_timestamp() AT TIME ZONE 'Europe/Istanbul')::date;
BEGIN
 PERFORM public.hr_private_document_access_v1(p_actor,p_tenant,p_employee,false);
 WITH page AS MATERIALIZED(SELECT id,title,employment_id,validity_date,created_at FROM public.hr_private_documents WHERE tenant_id=p_tenant AND employee_id=p_employee AND (p_after IS NULL OR id>p_after) ORDER BY id LIMIT 51),
 visible AS (SELECT * FROM page ORDER BY id LIMIT 50)
 SELECT coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'title',title,'employmentId',employment_id,'validityDate',validity_date,'expired',coalesce(validity_date<today,false),'createdAt',created_at) ORDER BY id) FROM visible),'[]'),(SELECT count(*)>50 FROM page) INTO rows,more;
 RETURN jsonb_build_object('schemaVersion',1,'actorId',p_actor,'tenantId',p_tenant,'employeeId',p_employee,'documents',rows,'hasMore',more);
END $$;
REVOKE ALL ON FUNCTION public.hr_private_document_access_v1(uuid,uuid,uuid,boolean),public.hr_private_documents_v1(uuid,uuid,uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.hr_private_documents_v1(uuid,uuid,uuid,uuid) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
$bps_source$]);
COMMIT;
