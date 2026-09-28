-- Expand before workers. Source rows are filtered in SQL, not after service raw reads.
BEGIN;
SET LOCAL lock_timeout='15s';
CREATE FUNCTION public.appointment_notification_candidates_v1(p_target date)
RETURNS TABLE(id uuid,meeting_type text,attendee text,meeting_date date,company_id uuid,tenant_id uuid,status text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 WITH source AS MATERIALIZED (SELECT a.id,a.meeting_type,a.attendee,a.meeting_date,a.company_id,a.tenant_id,a.status FROM public.appointments a WHERE a.status='planlandi' AND a.meeting_date=p_target),
 settings AS MATERIALIZED (SELECT t.tenant_id,public.workspace_module_snapshot_v1(t.tenant_id)->'modules' AS modules FROM (SELECT DISTINCT s.tenant_id FROM source s) t)
 SELECT a.id,a.meeting_type,a.attendee,a.meeting_date,a.company_id,a.tenant_id,a.status
 FROM source a JOIN settings s ON s.tenant_id=a.tenant_id WHERE (s.modules->>'calendar')::boolean
$$;
CREATE FUNCTION public.contract_notification_candidates_v1()
RETURNS TABLE(id uuid,tenant_id uuid,company_id uuid,name text,end_date date,responsible text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 WITH source AS MATERIALIZED (SELECT c.id,c.tenant_id,c.company_id,c.name,c.end_date,c.responsible FROM public.contracts c WHERE c.status='aktif' AND c.end_date IS NOT NULL),
 settings AS MATERIALIZED (SELECT t.tenant_id,public.workspace_module_snapshot_v1(t.tenant_id)->'modules' AS modules FROM (SELECT DISTINCT s.tenant_id FROM source s) t)
 SELECT c.id,c.tenant_id,c.company_id,c.name,c.end_date,c.responsible FROM source c JOIN settings s ON s.tenant_id=c.tenant_id WHERE (s.modules->>'contracts')::boolean
$$;
CREATE FUNCTION public.document_notification_candidates_v1(p_upper date)
RETURNS TABLE(id uuid,name text,validity_date date,tenant_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 WITH source AS MATERIALIZED (SELECT d.id,d.name,d.validity_date,d.tenant_id,d.company_id,d.contract_id FROM public.documents d WHERE d.validity_date<=p_upper),
 settings AS MATERIALIZED (SELECT t.tenant_id,public.workspace_module_snapshot_v1(t.tenant_id)->'modules' AS modules FROM (SELECT DISTINCT s.tenant_id FROM source s) t)
 SELECT d.id,d.name,d.validity_date,d.tenant_id FROM source d JOIN settings s ON s.tenant_id=d.tenant_id
 WHERE (s.modules->>'documents')::boolean AND (d.contract_id IS NULL OR ((s.modules->>'contracts')::boolean AND EXISTS(SELECT 1 FROM public.contracts c WHERE c.id=d.contract_id AND c.tenant_id=d.tenant_id AND c.company_id=d.company_id)))
$$;
CREATE FUNCTION public.document_notification_state_v1(p_ids uuid[],p_tenant_ids uuid[])
RETURNS TABLE(id uuid,tenant_id uuid,enabled boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF p_ids IS NULL OR p_tenant_ids IS NULL OR cardinality(p_ids) NOT BETWEEN 1 AND 500 OR cardinality(p_ids)<>cardinality(p_tenant_ids)
  OR array_position(p_ids,NULL) IS NOT NULL OR array_position(p_tenant_ids,NULL) IS NOT NULL
  OR (SELECT count(DISTINCT value) FROM unnest(p_ids) value)<>cardinality(p_ids) THEN RAISE EXCEPTION 'DOCUMENT_NOTIFICATION_INPUT' USING ERRCODE='22023';END IF;
 RETURN QUERY WITH requested AS MATERIALIZED (SELECT * FROM unnest(p_ids,p_tenant_ids) AS r(document_id,expected_tenant)),
 settings AS MATERIALIZED (SELECT t.expected_tenant,public.workspace_module_snapshot_v1(t.expected_tenant)->'modules' AS modules FROM (SELECT DISTINCT r.expected_tenant FROM requested r) t)
 SELECT r.document_id,r.expected_tenant,
  d.id IS NOT NULL AND (s.modules->>'documents')::boolean AND (d.contract_id IS NULL OR ((s.modules->>'contracts')::boolean AND EXISTS(SELECT 1 FROM public.contracts c WHERE c.id=d.contract_id AND c.tenant_id=d.tenant_id AND c.company_id=d.company_id)))
 FROM requested r JOIN settings s ON s.expected_tenant=r.expected_tenant LEFT JOIN public.documents d ON d.id=r.document_id AND d.tenant_id=r.expected_tenant;
END $$;
REVOKE ALL ON FUNCTION public.appointment_notification_candidates_v1(date),public.contract_notification_candidates_v1(),public.document_notification_candidates_v1(date),public.document_notification_state_v1(uuid[],uuid[]) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.appointment_notification_candidates_v1(date),public.contract_notification_candidates_v1(),public.document_notification_candidates_v1(date),public.document_notification_state_v1(uuid[],uuid[]) TO service_role;
DO $$ DECLARE signature text; role_name text; BEGIN
 FOREACH signature IN ARRAY ARRAY['public.appointment_notification_candidates_v1(date)','public.contract_notification_candidates_v1()','public.document_notification_candidates_v1(date)','public.document_notification_state_v1(uuid[],uuid[])'] LOOP
  FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
   IF has_function_privilege(role_name,signature,'EXECUTE') THEN RAISE EXCEPTION 'NOTIFICATION_PRIVILEGE_DRIFT';END IF;
  END LOOP;
 END LOOP;
END $$;
NOTIFY pgrst,'reload schema';
COMMIT;
