-- Internal candidate: do not grant until legacy HR endpoints are switched together.
BEGIN;
CREATE FUNCTION public.hr_scoped_employee_create_v1(p_actor uuid,p_tenant uuid,p_command uuid,p_revision bigint,p_payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='5s' AS $$
DECLARE old_command public.hr_commands;envelope jsonb;receipt jsonb;department uuid;location uuid;starts date;
 employee uuid:=gen_random_uuid();person uuid:=gen_random_uuid();period uuid:=gen_random_uuid();
 today date:=(statement_timestamp() AT TIME ZONE 'Europe/Istanbul')::date;
BEGIN
 IF current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION 'ACCESS_ISOLATION';END IF;
 IF p_actor IS NULL OR p_actor IS DISTINCT FROM auth.uid() OR p_tenant IS NULL OR p_tenant IS DISTINCT FROM public.current_user_verified_tenant() THEN RAISE EXCEPTION 'HR_SCOPE';END IF;
 PERFORM 1 FROM public.tenant_module_config WHERE tenant_id=p_tenant FOR UPDATE;
 PERFORM 1 FROM public.profiles WHERE id=p_actor FOR SHARE;
 PERFORM 1 FROM public.tenants WHERE id=p_tenant FOR UPDATE;
 PERFORM 1 FROM public.tenant_memberships WHERE tenant_id=p_tenant AND user_id=p_actor FOR SHARE;
 IF p_tenant IS DISTINCT FROM public.current_user_verified_tenant() THEN RAISE EXCEPTION 'HR_SCOPE';END IF;
 IF p_command IS NULL OR p_revision IS NULL OR p_revision<1 OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object'
 OR p_payload-ARRAY['name','code','startsOn','departmentId','position','locationId']<>'{}'
 OR jsonb_typeof(p_payload->'name') IS DISTINCT FROM 'string' OR length(btrim(p_payload->>'name')) NOT BETWEEN 1 AND 160
 OR jsonb_typeof(p_payload->'code') IS DISTINCT FROM 'string' OR length(btrim(p_payload->>'code')) NOT BETWEEN 1 AND 40
 OR jsonb_typeof(p_payload->'startsOn') IS DISTINCT FROM 'string' OR (p_payload->>'startsOn') !~ '^\d{4}-\d{2}-\d{2}$'
 THEN RAISE EXCEPTION 'HR_INPUT';END IF;
 starts:=(p_payload->>'startsOn')::date;
 IF starts NOT BETWEEN DATE '1900-01-01' AND DATE '2199-12-31' THEN RAISE EXCEPTION 'HR_INPUT';END IF;
 IF p_payload ? 'departmentId' THEN
  IF jsonb_typeof(p_payload->'departmentId') IS DISTINCT FROM 'string' OR jsonb_typeof(p_payload->'position') IS DISTINCT FROM 'string' OR length(btrim(p_payload->>'position')) NOT BETWEEN 1 AND 120 THEN RAISE EXCEPTION 'HR_INPUT';END IF;
  department:=(p_payload->>'departmentId')::uuid;
 ELSIF p_payload ? 'position' THEN RAISE EXCEPTION 'HR_INPUT';END IF;
 IF p_payload ? 'locationId' THEN
  IF jsonb_typeof(p_payload->'locationId') IS DISTINCT FROM 'string' THEN RAISE EXCEPTION 'HR_INPUT';END IF;
  location:=(p_payload->>'locationId')::uuid;
 END IF;
 -- Never trust a client-supplied account identity. A newly created person has no account link.
 IF NOT (public.company_access_decision_v1(p_tenant,p_actor,'hr.employees.create',NULL,department,location,statement_timestamp())->>'allowed')::boolean THEN RAISE EXCEPTION 'HR_FORBIDDEN';END IF;
 -- Future assignments are not current directory scope. Require read access to the actual current (unassigned) record too.
 IF starts>today AND NOT (public.company_access_decision_v1(p_tenant,p_actor,'hr.employees.read',NULL,NULL,NULL,statement_timestamp())->>'allowed')::boolean THEN RAISE EXCEPTION 'HR_FUTURE_SCOPE';END IF;
 envelope:=jsonb_build_object('operation','scoped_employee_create','revision',p_revision,'body',p_payload);
 SELECT * INTO old_command FROM public.hr_commands WHERE tenant_id=p_tenant AND actor_id=p_actor AND command_id=p_command;
 IF FOUND THEN
  IF old_command.payload IS DISTINCT FROM envelope THEN RAISE EXCEPTION 'HR_COMMAND_REUSED';END IF;
  RETURN old_command.result;
 END IF;
 IF coalesce((SELECT revision FROM public.company_access_state WHERE tenant_id=p_tenant),1)<>p_revision THEN RAISE EXCEPTION 'ACCESS_STALE';END IF;
 -- Validate after authorization so unknown organizational ids do not become an existence oracle.
 IF department IS NOT NULL AND NOT EXISTS(SELECT FROM public.hr_departments WHERE tenant_id=p_tenant AND id=department AND closed_on IS NULL) THEN RAISE EXCEPTION 'HR_INPUT';END IF;
 IF location IS NOT NULL AND NOT EXISTS(SELECT FROM public.hr_work_locations WHERE tenant_id=p_tenant AND id=location AND closed_on IS NULL) THEN RAISE EXCEPTION 'HR_INPUT';END IF;
 INSERT INTO public.hr_people(id,tenant_id,name) VALUES(person,p_tenant,btrim(p_payload->>'name'));
 INSERT INTO public.hr_employees(id,tenant_id,person_id,code) VALUES(employee,p_tenant,person,btrim(p_payload->>'code'));
 INSERT INTO public.hr_employment_periods(id,tenant_id,employee_id,starts_on) VALUES(period,p_tenant,employee,starts);
 IF department IS NOT NULL THEN INSERT INTO public.hr_assignments(id,tenant_id,employment_id,employee_id,department_id,position,starts_on) VALUES(gen_random_uuid(),p_tenant,period,employee,department,btrim(p_payload->>'position'),starts);END IF;
 IF location IS NOT NULL THEN INSERT INTO public.hr_location_assignments(id,tenant_id,employment_id,employee_id,location_id,starts_on) VALUES(gen_random_uuid(),p_tenant,period,employee,location,starts);END IF;
 receipt:=jsonb_build_object('schemaVersion',1,'actorId',p_actor,'tenantId',p_tenant,'commandId',p_command,'kind','employee','id',employee);
 INSERT INTO public.hr_commands(tenant_id,actor_id,command_id,payload,result) VALUES(p_tenant,p_actor,p_command,envelope,receipt);
 RETURN receipt;
END $$;
REVOKE ALL ON FUNCTION public.hr_scoped_employee_create_v1(uuid,uuid,uuid,bigint,jsonb) FROM PUBLIC,anon,authenticated,service_role;
COMMIT;
