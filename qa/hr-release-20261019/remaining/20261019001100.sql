BEGIN; SET LOCAL statement_timeout='60s'; SET LOCAL lock_timeout='5s';
LOCK TABLE supabase_migrations.schema_migrations IN EXCLUSIVE MODE;
DO $guard$ BEGIN
IF (SELECT array_agg(version ORDER BY version) FROM supabase_migrations.schema_migrations) IS DISTINCT FROM ARRAY['20260407000000','20260407000100','20260407000200','20260407000300','20260407000400','20260407000500','20260407000600','20260407000700','20260407000800','20260407000900','20260407001000','20260407001100','20260407001600','20260407001700','20260407001800','20260413000100','20260414000100','20260414000200','20260415000100','20260415000200','20260415000300','20260415000400','20260415000500','20260423000100','20260425000100','20260425000200','20260713000100','20260713000200','20260722000100','20260810000100','20260810000200','20260827000100','20260827000200','20260827000300','20260827000400','20260904000100','20260904000200','20260909000100','20260909000200','20260909000300','20260909000400','20260909000500','20260909000600','20260909000700','20260909000800','20260909000900','20260909001000','20260909001100','20260909001200','20260909001300','20260909001400','20260909001500','20260909001600','20260909001700','20260909001800','20260909001900','20260909002000','20260909002100','20260909002200','20260909002300','20260909002400','20260909002500','20260909002600','20260909002700','20260909002800','20260909002900','20260910000100','20260910000200','20260910000300','20260910000400','20260911000100','20260913000100','20260914000100','20260914000200','20260914000300','20260914000400','20260914000500','20260914000600','20260914000700','20260915000100','20260915000200','20260915000300','20260915000400','20260915000500','20260915000600','20260915000700','20260915000800','20260915000900','20260915001000','20260923000100','20260923000200','20260923000300','20260923000400','20260924000100','20260924000200','20260924000300','20260924000400','20260924000500','20260925000100','20260925000200','20260925000300','20260925000400','20260925000500','20260925000600','20260925000700','20260926000100','20260926000200','20260927000100','20260927000200','20260927000300','20260927000400','20260927000500','20260927000600','20260927000700','20260927000800','20260927000900','20260928000100','20260928000200','20260928000300','20260928000400','20260928000500','20260928000600','20260928000700','20260928000800','20261004001000','20261004001100','20261004001200','20261004001300','20261004001400','20261005000100','20261005000200','20261005000300','20261005000400','20261005000500','20261005000600','20261005000700','20261005000800','20261005000900','20261005001000','20261005001100','20261005001200','20261005001300','20261005001400','20261005001500','20261005001600','20261005001700','20261005001800','20261005001900','20261005002000','20261005002100','20261005002200','20261005002300','20261005002400','20261005002500','20261005002600','20261005002700','20261005002800','20261005002900','20261005003000','20261005003100','20261013000100','20261013000200','20261013000300','20261015000100','20261015000200','20261015000300','20261015000400','20261015000500','20261015000600','20261015000700','20261015000800','20261016000100','20261016000200','20261016000300','20261016000400','20261016000500','20261016000600','20261016000700','20261016000800','20261016000900','20261016001000','20261016001100','20261017000100','20261017000200','20261018000100','20261018000200','20261018000300','20261018000400','20261018000500','20261018000600','20261019000100','20261019000200','20261019000300','20261019000400','20261019000500','20261019000600','20261019000700','20261019000800','20261019000900','20261019001000']::text[] THEN RAISE EXCEPTION 'LIVE_LEDGER_CHANGED'; END IF;
IF to_regnamespace('bps_release_guard') IS NOT NULL THEN RAISE EXCEPTION 'RELEASE_BARRIER_PRESENT'; END IF;
END $guard$;
-- Internal candidate: do not grant until legacy HR endpoints are switched together.

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

INSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES('20261019001100','hr_scoped_employee_create',ARRAY[$bps_source$-- Internal candidate: do not grant until legacy HR endpoints are switched together.
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
$bps_source$]);
COMMIT;
