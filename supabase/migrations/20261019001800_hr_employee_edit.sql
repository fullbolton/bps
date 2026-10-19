-- Basic employee editing; employment dates and candidate identities remain separate commands.
BEGIN;
CREATE FUNCTION public.hr_employee_edit_context_v1(p_actor uuid,p_tenant uuid,p_employee uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE context jsonb:=public.hr_screen_context_v1(p_actor,p_tenant);employee public.hr_employees;person public.hr_people;
 department uuid;location uuid;account uuid;today date:=(statement_timestamp() AT TIME ZONE 'Europe/Istanbul')::date;
BEGIN
 SELECT * INTO employee FROM public.hr_employees WHERE tenant_id=p_tenant AND id=p_employee;
 IF NOT FOUND THEN RAISE EXCEPTION 'HR_FORBIDDEN';END IF;
 SELECT * INTO person FROM public.hr_people WHERE tenant_id=p_tenant AND id=employee.person_id;
 IF context->>'writeMode'='scoped' THEN
  SELECT department_id INTO department FROM public.hr_assignments WHERE tenant_id=p_tenant AND employee_id=p_employee AND daterange(starts_on,ends_on,'[]') @> today;
  SELECT location_id INTO location FROM public.hr_location_assignments WHERE tenant_id=p_tenant AND employee_id=p_employee AND daterange(starts_on,ends_on,'[]') @> today;
  account:=public.hr_employee_account_v1(p_tenant,p_employee);
  IF NOT (public.company_access_decision_v1(p_tenant,p_actor,'hr.employees.read',account,department,location,statement_timestamp())->>'allowed')::boolean
  OR NOT (public.company_access_decision_v1(p_tenant,p_actor,'hr.employees.update',account,department,location,statement_timestamp())->>'allowed')::boolean THEN RAISE EXCEPTION 'HR_FORBIDDEN';END IF;
 END IF;
 RETURN jsonb_build_object('schemaVersion',1,'actorId',p_actor,'tenantId',p_tenant,'employeeId',p_employee,'code',employee.code,
 'name',coalesce(person.name,(SELECT name FROM public.talent_people WHERE tenant_id=p_tenant AND id=person.talent_person_id)),
 'nameEditable',person.talent_person_id IS NULL,'employeeRevision',employee.revision::text,'personRevision',person.revision::text,
 'policyRevision',coalesce((SELECT revision FROM public.company_access_state WHERE tenant_id=p_tenant),1)::text,'mode',context->>'mode');
END $$;
CREATE FUNCTION public.hr_employee_edit_v1(p_actor uuid,p_tenant uuid,p_command uuid,p_payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='5s' AS $$
DECLARE context jsonb;previous public.hr_commands;envelope jsonb;receipt jsonb;employee_id uuid;v_code text;v_name text;
BEGIN
 IF current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION 'ACCESS_ISOLATION';END IF;
 PERFORM public.hr_access_mode_v1(p_actor,p_tenant);
 PERFORM 1 FROM public.tenant_module_config WHERE tenant_id=p_tenant FOR UPDATE;
 PERFORM 1 FROM public.profiles WHERE id=p_actor FOR SHARE;
 PERFORM 1 FROM public.tenants WHERE id=p_tenant FOR UPDATE;
 PERFORM 1 FROM public.tenant_memberships WHERE tenant_id=p_tenant AND user_id=p_actor FOR SHARE;
 IF p_command IS NULL OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object'
 OR p_payload-ARRAY['employeeId','employeeRevision','personRevision','policyRevision','mode','code','name']<>'{}'
 OR NOT (p_payload ?& ARRAY['employeeId','employeeRevision','personRevision','policyRevision','mode','code','name'])
 OR jsonb_typeof(p_payload->'employeeId') IS DISTINCT FROM 'string'
 OR jsonb_typeof(p_payload->'code') IS DISTINCT FROM 'string' OR jsonb_typeof(p_payload->'name') IS DISTINCT FROM 'string'
 OR jsonb_typeof(p_payload->'employeeRevision') IS DISTINCT FROM 'string' OR (p_payload->>'employeeRevision')!~'^[1-9][0-9]*$'
 OR jsonb_typeof(p_payload->'personRevision') IS DISTINCT FROM 'string' OR (p_payload->>'personRevision')!~'^[1-9][0-9]*$'
 OR jsonb_typeof(p_payload->'policyRevision') IS DISTINCT FROM 'string' OR (p_payload->>'policyRevision')!~'^[1-9][0-9]*$'
 OR p_payload->>'mode' NOT IN('legacy','scoped') THEN RAISE EXCEPTION 'HR_INPUT';END IF;
 employee_id:=(p_payload->>'employeeId')::uuid;v_code:=btrim(p_payload->>'code');v_name:=btrim(p_payload->>'name');
 IF length(v_code) NOT BETWEEN 1 AND 40 OR length(v_name) NOT BETWEEN 1 AND 160 OR v_code~'[0-9]{11}' OR v_name~'[0-9]{11}' THEN RAISE EXCEPTION 'HR_INPUT';END IF;
 context:=public.hr_employee_edit_context_v1(p_actor,p_tenant,employee_id);
 envelope:=jsonb_build_object('operation','employee_edit','body',p_payload);
 SELECT * INTO previous FROM public.hr_commands WHERE tenant_id=p_tenant AND actor_id=p_actor AND command_id=p_command;
 IF FOUND THEN
  IF previous.payload IS DISTINCT FROM envelope THEN RAISE EXCEPTION 'HR_COMMAND_REUSED';END IF;
  RETURN previous.result;
 END IF;
 IF context->>'employeeRevision' IS DISTINCT FROM p_payload->>'employeeRevision' OR context->>'personRevision' IS DISTINCT FROM p_payload->>'personRevision'
 OR context->>'policyRevision' IS DISTINCT FROM p_payload->>'policyRevision' OR context->>'mode' IS DISTINCT FROM p_payload->>'mode' THEN RAISE EXCEPTION 'HR_EDIT_STALE';END IF;
 IF NOT (context->>'nameEditable')::boolean AND v_name IS DISTINCT FROM context->>'name' THEN RAISE EXCEPTION 'HR_LINKED_NAME';END IF;
 IF EXISTS(SELECT FROM public.hr_employees WHERE tenant_id=p_tenant AND id<>employee_id AND lower(v_code)=lower(hr_employees.code)) THEN RAISE EXCEPTION 'HR_CODE_EXISTS';END IF;
 UPDATE public.hr_employees SET code=v_code,revision=revision+1 WHERE tenant_id=p_tenant AND id=employee_id;
 IF (context->>'nameEditable')::boolean THEN
  UPDATE public.hr_people SET name=v_name,revision=revision+1 WHERE tenant_id=p_tenant AND id=(SELECT person_id FROM public.hr_employees WHERE tenant_id=p_tenant AND id=employee_id);
 END IF;
 receipt:=jsonb_build_object('schemaVersion',1,'actorId',p_actor,'tenantId',p_tenant,'commandId',p_command,'employeeId',employee_id,'code',v_code,'name',v_name);
 INSERT INTO public.hr_commands(tenant_id,actor_id,command_id,payload,result) VALUES(p_tenant,p_actor,p_command,envelope,receipt||jsonb_build_object('before',context));
 RETURN receipt||jsonb_build_object('before',context);
END $$;
REVOKE ALL ON FUNCTION public.hr_employee_edit_context_v1(uuid,uuid,uuid),public.hr_employee_edit_v1(uuid,uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.hr_employee_edit_context_v1(uuid,uuid,uuid),public.hr_employee_edit_v1(uuid,uuid,uuid,jsonb) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
