-- Atomic current-office transfer candidate; not exposed before coordinated HR cutover.
BEGIN;
CREATE FUNCTION public.hr_scoped_location_transfer_v1(p_actor uuid,p_tenant uuid,p_command uuid,p_revision bigint,p_payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='5s' AS $$
DECLARE source public.hr_location_assignments;previous public.hr_commands;department uuid;current_location uuid;account uuid;target uuid;
 envelope jsonb;receipt jsonb;new_id uuid:=gen_random_uuid();today date:=(statement_timestamp() AT TIME ZONE 'Europe/Istanbul')::date;
BEGIN
 IF current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION 'ACCESS_ISOLATION';END IF;
 IF p_actor IS NULL OR p_actor IS DISTINCT FROM auth.uid() OR p_tenant IS NULL OR p_tenant IS DISTINCT FROM public.current_user_verified_tenant() THEN RAISE EXCEPTION 'HR_SCOPE';END IF;
 PERFORM 1 FROM public.tenant_module_config WHERE tenant_id=p_tenant FOR UPDATE;
 PERFORM 1 FROM public.profiles WHERE id=p_actor FOR SHARE;
 PERFORM 1 FROM public.tenants WHERE id=p_tenant FOR UPDATE;
 PERFORM 1 FROM public.tenant_memberships WHERE tenant_id=p_tenant AND user_id=p_actor FOR SHARE;
 IF p_tenant IS DISTINCT FROM public.current_user_verified_tenant() THEN RAISE EXCEPTION 'HR_SCOPE';END IF;
 IF p_command IS NULL OR p_revision IS NULL OR p_revision<1 OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object'
 OR p_payload-ARRAY['assignmentId','expectedRevision','locationId']<>'{}'
 OR jsonb_typeof(p_payload->'assignmentId') IS DISTINCT FROM 'string' OR jsonb_typeof(p_payload->'locationId') IS DISTINCT FROM 'string'
 OR jsonb_typeof(p_payload->'expectedRevision') IS DISTINCT FROM 'number' OR (p_payload->>'expectedRevision') !~ '^[1-9][0-9]*$' THEN RAISE EXCEPTION 'HR_INPUT';END IF;
 target:=(p_payload->>'locationId')::uuid;
 SELECT * INTO source FROM public.hr_location_assignments WHERE tenant_id=p_tenant AND id=(p_payload->>'assignmentId')::uuid;
 IF NOT FOUND THEN RAISE EXCEPTION 'HR_FORBIDDEN';END IF;
 SELECT department_id INTO department FROM public.hr_assignments WHERE tenant_id=p_tenant AND employee_id=source.employee_id AND daterange(starts_on,ends_on,'[]') @> today;
 SELECT location_id INTO current_location FROM public.hr_location_assignments WHERE tenant_id=p_tenant AND employee_id=source.employee_id AND daterange(starts_on,ends_on,'[]') @> today;
 account:=public.hr_employee_account_v1(p_tenant,source.employee_id);
 -- Both existing visibility and destination authority are mandatory, including receipt replay.
 IF NOT (public.company_access_decision_v1(p_tenant,p_actor,'hr.employees.update',account,department,current_location,statement_timestamp())->>'allowed')::boolean
 OR NOT (public.company_access_decision_v1(p_tenant,p_actor,'hr.employees.update',account,department,source.location_id,statement_timestamp())->>'allowed')::boolean
 OR NOT (public.company_access_decision_v1(p_tenant,p_actor,'hr.employees.update',account,department,target,statement_timestamp())->>'allowed')::boolean THEN RAISE EXCEPTION 'HR_FORBIDDEN';END IF;
 envelope:=jsonb_build_object('operation','scoped_location_transfer','revision',p_revision,'body',p_payload);
 SELECT * INTO previous FROM public.hr_commands WHERE tenant_id=p_tenant AND actor_id=p_actor AND command_id=p_command;
 IF FOUND THEN
  IF previous.payload IS DISTINCT FROM envelope THEN RAISE EXCEPTION 'HR_COMMAND_REUSED';END IF;
  RETURN previous.result;
 END IF;
 IF coalesce((SELECT revision FROM public.company_access_state WHERE tenant_id=p_tenant),1)<>p_revision THEN RAISE EXCEPTION 'ACCESS_STALE';END IF;
 IF source.revision<>(p_payload->>'expectedRevision')::bigint OR source.ends_on IS NOT NULL OR source.starts_on>=today OR current_location IS DISTINCT FROM source.location_id THEN RAISE EXCEPTION 'HR_STALE_OR_NOT_TRANSFERABLE';END IF;
 IF target=source.location_id OR NOT EXISTS(SELECT FROM public.hr_work_locations WHERE tenant_id=p_tenant AND id=target AND closed_on IS NULL) THEN RAISE EXCEPTION 'HR_INPUT';END IF;
 UPDATE public.hr_location_assignments SET ends_on=today-1,revision=revision+1 WHERE tenant_id=p_tenant AND id=source.id;
 INSERT INTO public.hr_location_assignments(id,tenant_id,employee_id,employment_id,location_id,starts_on)
 VALUES(new_id,p_tenant,source.employee_id,source.employment_id,target,today);
 receipt:=jsonb_build_object('schemaVersion',1,'actorId',p_actor,'tenantId',p_tenant,'commandId',p_command,'kind','transfer_location','id',new_id,'previousId',source.id,'employeeId',source.employee_id,'startsOn',today,'revision',1);
 INSERT INTO public.hr_commands(tenant_id,actor_id,command_id,payload,result) VALUES(p_tenant,p_actor,p_command,envelope,receipt);
 RETURN receipt;
END $$;
REVOKE ALL ON FUNCTION public.hr_scoped_location_transfer_v1(uuid,uuid,uuid,bigint,jsonb) FROM PUBLIC,anon,authenticated,service_role;
COMMIT;
