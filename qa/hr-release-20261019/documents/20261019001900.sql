BEGIN; SET LOCAL statement_timeout='60s'; SET LOCAL lock_timeout='5s';
LOCK TABLE supabase_migrations.schema_migrations IN EXCLUSIVE MODE;
DO $guard$ BEGIN
IF (SELECT array_agg(version ORDER BY version) FROM supabase_migrations.schema_migrations) IS DISTINCT FROM ARRAY['20260407000000','20260407000100','20260407000200','20260407000300','20260407000400','20260407000500','20260407000600','20260407000700','20260407000800','20260407000900','20260407001000','20260407001100','20260407001600','20260407001700','20260407001800','20260413000100','20260414000100','20260414000200','20260415000100','20260415000200','20260415000300','20260415000400','20260415000500','20260423000100','20260425000100','20260425000200','20260713000100','20260713000200','20260722000100','20260810000100','20260810000200','20260827000100','20260827000200','20260827000300','20260827000400','20260904000100','20260904000200','20260909000100','20260909000200','20260909000300','20260909000400','20260909000500','20260909000600','20260909000700','20260909000800','20260909000900','20260909001000','20260909001100','20260909001200','20260909001300','20260909001400','20260909001500','20260909001600','20260909001700','20260909001800','20260909001900','20260909002000','20260909002100','20260909002200','20260909002300','20260909002400','20260909002500','20260909002600','20260909002700','20260909002800','20260909002900','20260910000100','20260910000200','20260910000300','20260910000400','20260911000100','20260913000100','20260914000100','20260914000200','20260914000300','20260914000400','20260914000500','20260914000600','20260914000700','20260915000100','20260915000200','20260915000300','20260915000400','20260915000500','20260915000600','20260915000700','20260915000800','20260915000900','20260915001000','20260923000100','20260923000200','20260923000300','20260923000400','20260924000100','20260924000200','20260924000300','20260924000400','20260924000500','20260925000100','20260925000200','20260925000300','20260925000400','20260925000500','20260925000600','20260925000700','20260926000100','20260926000200','20260927000100','20260927000200','20260927000300','20260927000400','20260927000500','20260927000600','20260927000700','20260927000800','20260927000900','20260928000100','20260928000200','20260928000300','20260928000400','20260928000500','20260928000600','20260928000700','20260928000800','20261004001000','20261004001100','20261004001200','20261004001300','20261004001400','20261005000100','20261005000200','20261005000300','20261005000400','20261005000500','20261005000600','20261005000700','20261005000800','20261005000900','20261005001000','20261005001100','20261005001200','20261005001300','20261005001400','20261005001500','20261005001600','20261005001700','20261005001800','20261005001900','20261005002000','20261005002100','20261005002200','20261005002300','20261005002400','20261005002500','20261005002600','20261005002700','20261005002800','20261005002900','20261005003000','20261005003100','20261013000100','20261013000200','20261013000300','20261015000100','20261015000200','20261015000300','20261015000400','20261015000500','20261015000600','20261015000700','20261015000800','20261016000100','20261016000200','20261016000300','20261016000400','20261016000500','20261016000600','20261016000700','20261016000800','20261016000900','20261016001000','20261016001100','20261017000100','20261017000200','20261018000100','20261018000200','20261018000300','20261018000400','20261018000500','20261018000600','20261019000100','20261019000200','20261019000300','20261019000400','20261019000500','20261019000600','20261019000700','20261019000800','20261019000900','20261019001000','20261019001100','20261019001200','20261019001300','20261019001400','20261019001500','20261019001600','20261019001700','20261019001800']::text[] THEN RAISE EXCEPTION 'LIVE_LEDGER_CHANGED'; END IF;
IF to_regnamespace('bps_release_guard') IS NOT NULL THEN RAISE EXCEPTION 'RELEASE_BARRIER_PRESENT'; END IF;
END $guard$;
-- Company-manager lifecycle commands. No employee self-service or HR activation.

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

INSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES('20261019001900','hr_employment_lifecycle',ARRAY[$bps_source$-- Company-manager lifecycle commands. No employee self-service or HR activation.
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
$bps_source$]);
COMMIT;
