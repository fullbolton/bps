BEGIN; SET LOCAL statement_timeout='60s'; SET LOCAL lock_timeout='5s';
LOCK TABLE supabase_migrations.schema_migrations IN EXCLUSIVE MODE;
DO $guard$ BEGIN
IF (SELECT array_agg(version ORDER BY version) FROM supabase_migrations.schema_migrations) IS DISTINCT FROM ARRAY['20260407000000','20260407000100','20260407000200','20260407000300','20260407000400','20260407000500','20260407000600','20260407000700','20260407000800','20260407000900','20260407001000','20260407001100','20260407001600','20260407001700','20260407001800','20260413000100','20260414000100','20260414000200','20260415000100','20260415000200','20260415000300','20260415000400','20260415000500','20260423000100','20260425000100','20260425000200','20260713000100','20260713000200','20260722000100','20260810000100','20260810000200','20260827000100','20260827000200','20260827000300','20260827000400','20260904000100','20260904000200','20260909000100','20260909000200','20260909000300','20260909000400','20260909000500','20260909000600','20260909000700','20260909000800','20260909000900','20260909001000','20260909001100','20260909001200','20260909001300','20260909001400','20260909001500','20260909001600','20260909001700','20260909001800','20260909001900','20260909002000','20260909002100','20260909002200','20260909002300','20260909002400','20260909002500','20260909002600','20260909002700','20260909002800','20260909002900','20260910000100','20260910000200','20260910000300','20260910000400','20260911000100','20260913000100','20260914000100','20260914000200','20260914000300','20260914000400','20260914000500','20260914000600','20260914000700','20260915000100','20260915000200','20260915000300','20260915000400','20260915000500','20260915000600','20260915000700','20260915000800','20260915000900','20260915001000','20260923000100','20260923000200','20260923000300','20260923000400','20260924000100','20260924000200','20260924000300','20260924000400','20260924000500','20260925000100','20260925000200','20260925000300','20260925000400','20260925000500','20260925000600','20260925000700','20260926000100','20260926000200','20260927000100','20260927000200','20260927000300','20260927000400','20260927000500','20260927000600','20260927000700','20260927000800','20260927000900','20260928000100','20260928000200','20260928000300','20260928000400','20260928000500','20260928000600','20260928000700','20260928000800','20261004001000','20261004001100','20261004001200','20261004001300','20261004001400','20261005000100','20261005000200','20261005000300','20261005000400','20261005000500','20261005000600','20261005000700','20261005000800','20261005000900','20261005001000','20261005001100','20261005001200','20261005001300','20261005001400','20261005001500','20261005001600','20261005001700','20261005001800','20261005001900','20261005002000','20261005002100','20261005002200','20261005002300','20261005002400','20261005002500','20261005002600','20261005002700','20261005002800','20261005002900','20261005003000','20261005003100','20261013000100','20261013000200','20261013000300','20261015000100','20261015000200','20261015000300','20261015000400','20261015000500','20261015000600','20261015000700','20261015000800','20261016000100','20261016000200','20261016000300','20261016000400','20261016000500','20261016000600','20261016000700','20261016000800','20261016000900','20261016001000','20261016001100','20261017000100','20261017000200','20261018000100','20261018000200','20261018000300','20261018000400','20261018000500','20261018000600','20261019000100','20261019000200','20261019000300','20261019000400','20261019000500','20261019000600','20261019000700','20261019000800','20261019000900','20261019001000','20261019001100','20261019001200']::text[] THEN RAISE EXCEPTION 'LIVE_LEDGER_CHANGED'; END IF;
IF to_regnamespace('bps_release_guard') IS NOT NULL THEN RAISE EXCEPTION 'RELEASE_BARRIER_PRESENT'; END IF;
END $guard$;
-- Atomic current-office transfer candidate; not exposed before coordinated HR cutover.

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

INSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES('20261019001300','hr_scoped_location_transfer',ARRAY[$bps_source$-- Atomic current-office transfer candidate; not exposed before coordinated HR cutover.
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
$bps_source$]);
COMMIT;
