-- Company-manager lifecycle commands. No employee self-service or HR activation.
BEGIN;
CREATE FUNCTION public.hr_employment_review_v1(p_actor uuid,p_tenant uuid,p_employee uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE period public.hr_employment_periods;body jsonb;
BEGIN
 PERFORM public.hr_assert_access(p_actor,p_tenant);
 IF public.current_user_role() IS DISTINCT FROM 'yonetici' THEN RAISE EXCEPTION 'HR_MANAGER_REQUIRED';END IF;
 IF NOT EXISTS(SELECT FROM public.hr_employees WHERE tenant_id=p_tenant AND id=p_employee) THEN RAISE EXCEPTION 'HR_FORBIDDEN';END IF;
 SELECT * INTO period FROM public.hr_employment_periods WHERE tenant_id=p_tenant AND employee_id=p_employee ORDER BY starts_on DESC,id DESC LIMIT 1;
 IF NOT FOUND THEN RAISE EXCEPTION 'HR_PERIOD_MISSING';END IF;
 body:=jsonb_build_object('schemaVersion',1,'actorId',p_actor,'tenantId',p_tenant,'employeeId',p_employee,'periodId',period.id,'startsOn',period.starts_on,'endsOn',period.ends_on,'revision',period.revision::text,
 'assignments',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'startsOn',starts_on,'endsOn',ends_on,'revision',revision::text) ORDER BY id) FROM public.hr_assignments WHERE tenant_id=p_tenant AND employment_id=period.id),'[]'::jsonb),
 'locations',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'startsOn',starts_on,'endsOn',ends_on,'revision',revision::text) ORDER BY id) FROM public.hr_location_assignments WHERE tenant_id=p_tenant AND employment_id=period.id),'[]'::jsonb),
 'reports',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'endsOn',ends_on,'revision',revision::text) ORDER BY id) FROM public.hr_assignments WHERE tenant_id=p_tenant AND manager_employment_id=period.id),'[]'::jsonb),
 'linkedAccount',EXISTS(SELECT FROM public.hr_account_links WHERE tenant_id=p_tenant AND employee_id=p_employee AND unlinked_at IS NULL));
 RETURN body||jsonb_build_object('token',md5(body::text));
END $$;
CREATE FUNCTION public.hr_employment_change_v1(p_actor uuid,p_tenant uuid,p_command uuid,p_employee uuid,p_token text,p_kind text,p_date date) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='5s' AS $$
DECLARE review jsonb;previous public.hr_commands;envelope jsonb;receipt jsonb;period_id uuid;new_id uuid:=gen_random_uuid();today date:=(statement_timestamp() AT TIME ZONE 'Europe/Istanbul')::date;
BEGIN
 IF current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION 'ACCESS_ISOLATION';END IF;
 PERFORM public.hr_access_mode_v1(p_actor,p_tenant);
 PERFORM 1 FROM public.tenant_module_config WHERE tenant_id=p_tenant FOR UPDATE;
 PERFORM 1 FROM public.profiles WHERE id=p_actor FOR SHARE;
 PERFORM 1 FROM public.tenants WHERE id=p_tenant FOR UPDATE;
 PERFORM 1 FROM public.tenant_memberships WHERE tenant_id=p_tenant AND user_id=p_actor FOR SHARE;
 review:=public.hr_employment_review_v1(p_actor,p_tenant,p_employee);
 IF p_command IS NULL OR p_token IS NULL OR p_token!~'^[a-f0-9]{32}$' OR p_kind IS NULL OR p_kind NOT IN('end','rehire') OR p_date IS NULL OR p_date NOT BETWEEN DATE '1900-01-01' AND DATE '2199-12-31' THEN RAISE EXCEPTION 'HR_INPUT';END IF;
 envelope:=jsonb_build_object('operation','employment_change','employeeId',p_employee,'token',p_token,'kind',p_kind,'date',p_date);
 SELECT * INTO previous FROM public.hr_commands WHERE tenant_id=p_tenant AND actor_id=p_actor AND command_id=p_command;
 IF FOUND THEN
  IF previous.payload IS DISTINCT FROM envelope THEN RAISE EXCEPTION 'HR_COMMAND_REUSED';END IF;
  RETURN previous.result;
 END IF;
 IF review->>'token' IS DISTINCT FROM p_token THEN RAISE EXCEPTION 'HR_EMPLOYMENT_STALE';END IF;
 period_id:=(review->>'periodId')::uuid;
 IF p_kind='end' THEN
  IF review->>'endsOn' IS NOT NULL OR p_date<(review->>'startsOn')::date OR p_date>today THEN RAISE EXCEPTION 'HR_EMPLOYMENT_DATE';END IF;
  -- Access removal is an explicit separate action, never implied by a date edit.
  IF (review->>'linkedAccount')::boolean THEN RAISE EXCEPTION 'HR_ACCOUNT_LINK_ACTIVE';END IF;
  IF EXISTS(SELECT FROM public.hr_assignments WHERE tenant_id=p_tenant AND manager_employment_id=period_id AND (ends_on IS NULL OR ends_on>p_date)) THEN RAISE EXCEPTION 'HR_MANAGER_HAS_REPORTS';END IF;
  IF EXISTS(SELECT FROM public.hr_assignments WHERE tenant_id=p_tenant AND employment_id=period_id AND starts_on>p_date)
  OR EXISTS(SELECT FROM public.hr_location_assignments WHERE tenant_id=p_tenant AND employment_id=period_id AND starts_on>p_date) THEN RAISE EXCEPTION 'HR_FUTURE_ASSIGNMENTS';END IF;
  UPDATE public.hr_assignments SET ends_on=p_date,revision=revision+1 WHERE tenant_id=p_tenant AND employment_id=period_id AND (ends_on IS NULL OR ends_on>p_date);
  UPDATE public.hr_location_assignments SET ends_on=p_date,revision=revision+1 WHERE tenant_id=p_tenant AND employment_id=period_id AND (ends_on IS NULL OR ends_on>p_date);
  UPDATE public.hr_employment_periods SET ends_on=p_date,revision=revision+1 WHERE tenant_id=p_tenant AND id=period_id;
  new_id:=period_id;
 ELSE
  IF review->>'endsOn' IS NULL OR p_date<=(review->>'endsOn')::date THEN RAISE EXCEPTION 'HR_EMPLOYMENT_DATE';END IF;
  INSERT INTO public.hr_employment_periods(id,tenant_id,employee_id,starts_on) VALUES(new_id,p_tenant,p_employee,p_date);
 END IF;
 receipt:=jsonb_build_object('schemaVersion',1,'actorId',p_actor,'tenantId',p_tenant,'commandId',p_command,'employeeId',p_employee,'kind',p_kind,'date',p_date,'periodId',new_id,'before',review);
 INSERT INTO public.hr_commands(tenant_id,actor_id,command_id,payload,result) VALUES(p_tenant,p_actor,p_command,envelope,receipt);
 RETURN receipt;
END $$;
REVOKE ALL ON FUNCTION public.hr_employment_review_v1(uuid,uuid,uuid),public.hr_employment_change_v1(uuid,uuid,uuid,uuid,text,text,date) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.hr_employment_review_v1(uuid,uuid,uuid),public.hr_employment_change_v1(uuid,uuid,uuid,uuid,text,text,date) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
