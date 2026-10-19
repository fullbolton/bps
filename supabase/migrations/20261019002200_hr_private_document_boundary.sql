-- Private HR document registry. No Storage upload/download policy is enabled here.
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
