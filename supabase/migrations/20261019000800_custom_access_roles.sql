-- Staged custom access management. Does not replace legacy endpoint authorization.
BEGIN;
SET LOCAL lock_timeout='5s';
CREATE TABLE public.company_access_state(tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id),revision bigint NOT NULL DEFAULT 1 CHECK(revision>0));
CREATE TABLE public.company_access_roles(id uuid PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES public.tenants(id),name text NOT NULL CHECK(length(btrim(name)) BETWEEN 1 AND 100),rules jsonb NOT NULL CHECK(jsonb_typeof(rules)='array'),archived boolean NOT NULL DEFAULT false,UNIQUE(tenant_id,id));
CREATE UNIQUE INDEX company_access_role_name ON public.company_access_roles(tenant_id,lower(btrim(name))) WHERE NOT archived;
CREATE TABLE public.company_access_assignments(tenant_id uuid NOT NULL,account_id uuid NOT NULL REFERENCES public.profiles(id),membership_id uuid NOT NULL,role_id uuid NOT NULL,PRIMARY KEY(tenant_id,account_id),FOREIGN KEY(tenant_id,role_id) REFERENCES public.company_access_roles(tenant_id,id));
CREATE TABLE public.company_access_exceptions(id uuid PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES public.tenants(id),account_id uuid NOT NULL REFERENCES public.profiles(id),membership_id uuid NOT NULL,rule jsonb NOT NULL CHECK(jsonb_typeof(rule)='object'),revoked boolean NOT NULL DEFAULT false);
CREATE INDEX company_access_exception_account ON public.company_access_exceptions(tenant_id,account_id) WHERE NOT revoked;
CREATE TABLE public.company_access_commands(tenant_id uuid NOT NULL REFERENCES public.tenants(id),actor_id uuid NOT NULL REFERENCES public.profiles(id),command_id uuid NOT NULL,payload jsonb NOT NULL,result jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT statement_timestamp(),PRIMARY KEY(tenant_id,actor_id,command_id));
CREATE TABLE public.company_access_history(tenant_id uuid NOT NULL REFERENCES public.tenants(id),revision bigint NOT NULL,actor_id uuid NOT NULL REFERENCES public.profiles(id),command_id uuid NOT NULL,before_value jsonb,after_value jsonb,created_at timestamptz NOT NULL DEFAULT statement_timestamp(),PRIMARY KEY(tenant_id,revision));
ALTER TABLE public.company_access_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_access_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_access_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_access_exceptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_access_commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_access_history ENABLE ROW LEVEL SECURITY;

DO $$ DECLARE t text;BEGIN
 FOREACH t IN ARRAY ARRAY['company_access_state','company_access_roles','company_access_assignments','company_access_exceptions','company_access_commands','company_access_history'] LOOP
 -- RLS is enabled explicitly above for static auditability.
 EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated,service_role',t);
 END LOOP;
END $$;
CREATE FUNCTION public.company_access_assert_manager(p_actor uuid,p_tenant uuid) RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF p_actor IS NULL OR p_actor IS DISTINCT FROM auth.uid() OR p_tenant IS NULL OR p_tenant IS DISTINCT FROM public.current_user_verified_tenant() THEN RAISE EXCEPTION 'ACCESS_SCOPE';END IF;
 IF coalesce(public.current_user_role(),'')<>'yonetici' THEN RAISE EXCEPTION 'ACCESS_MANAGER_REQUIRED';END IF;
END $$;
CREATE FUNCTION public.company_access_validate_rule(p_tenant uuid,r jsonb,p_exception boolean DEFAULT false) RETURNS void LANGUAGE plpgsql STABLE SET search_path='' AS $$
DECLARE s jsonb;k text;v jsonb;starts timestamptz;ends timestamptz;
BEGIN
 IF r IS NULL OR jsonb_typeof(r)<>'object' OR NOT r ?& ARRAY['capability','effect','scope'] OR r-ARRAY['capability','effect','scope']-(CASE WHEN p_exception THEN ARRAY['startsAt','expiresAt','reason'] ELSE ARRAY[]::text[] END)<>'{}' THEN RAISE EXCEPTION 'ACCESS_RULE_INVALID';END IF;
 IF coalesce(r->>'capability','') NOT IN ('hr.employees.read','hr.employees.create','hr.employees.update','hr.employees.export','hr.compensation.read','hr.documents.download','finance.summary.read','finance.summary.update','finance.summary.export') OR coalesce(r->>'effect','') NOT IN ('allow','deny') THEN RAISE EXCEPTION 'ACCESS_RULE_INVALID';END IF;
 s:=r->'scope';
 IF jsonb_typeof(s) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'ACCESS_SCOPE_INVALID';END IF;
 IF s->>'kind' IN ('company','self') THEN
  IF s-ARRAY['kind']<>'{}' THEN RAISE EXCEPTION 'ACCESS_SCOPE_INVALID';END IF;
 ELSIF s->>'kind'='selected' THEN
  IF s-ARRAY['kind','departmentIds','locationIds']<>'{}' OR jsonb_typeof(s->'departmentIds') IS DISTINCT FROM 'array' OR jsonb_typeof(s->'locationIds') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'ACCESS_SCOPE_INVALID';END IF;
  IF jsonb_array_length(s->'departmentIds')+jsonb_array_length(s->'locationIds')=0 THEN RAISE EXCEPTION 'ACCESS_SCOPE_INVALID';END IF;
  FOREACH k IN ARRAY ARRAY['departmentIds','locationIds'] LOOP
   IF jsonb_array_length(s->k)>1000 OR (SELECT count(*)<>count(DISTINCT value) FROM jsonb_array_elements(s->k)) THEN RAISE EXCEPTION 'ACCESS_SCOPE_INVALID';END IF;
   FOR v IN SELECT value FROM jsonb_array_elements(s->k) LOOP
    IF jsonb_typeof(v)<>'string' THEN RAISE EXCEPTION 'ACCESS_SCOPE_INVALID';END IF;
    IF k='departmentIds' THEN
     IF NOT EXISTS(SELECT FROM public.hr_departments WHERE tenant_id=p_tenant AND id=(v#>>'{}')::uuid) THEN RAISE EXCEPTION 'ACCESS_SCOPE_INVALID';END IF;
    ELSE
     IF NOT EXISTS(SELECT FROM public.hr_work_locations WHERE tenant_id=p_tenant AND id=(v#>>'{}')::uuid) THEN RAISE EXCEPTION 'ACCESS_SCOPE_INVALID';END IF;
    END IF;
   END LOOP;
  END LOOP;
 ELSE RAISE EXCEPTION 'ACCESS_SCOPE_INVALID';END IF;
 IF p_exception THEN
  IF NOT r ?& ARRAY['startsAt','expiresAt','reason'] OR jsonb_typeof(r->'reason') IS DISTINCT FROM 'string' OR length(btrim(r->>'reason')) NOT BETWEEN 1 AND 500
   OR coalesce(r->>'startsAt','') !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$' OR coalesce(r->>'expiresAt','') !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$' THEN RAISE EXCEPTION 'ACCESS_EXCEPTION_INVALID';END IF;
  starts:=(r->>'startsAt')::timestamptz;ends:=(r->>'expiresAt')::timestamptz;
  IF to_char(starts AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')<>r->>'startsAt' OR to_char(ends AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')<>r->>'expiresAt' OR starts>=ends THEN RAISE EXCEPTION 'ACCESS_EXCEPTION_INVALID';END IF;
 END IF;
END $$;
CREATE FUNCTION public.company_access_command_v1(p_actor uuid,p_tenant uuid,p_command uuid,p_revision bigint,p_payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='5s' AS $$
DECLARE old_command public.company_access_commands;rev bigint;kind text;record_id uuid;target uuid;member uuid;old_value jsonb;new_value jsonb;receipt jsonb;r jsonb;
BEGIN
 IF current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION 'ACCESS_ISOLATION';END IF;
 PERFORM public.company_access_assert_manager(p_actor,p_tenant);
 PERFORM 1 FROM public.tenant_module_config WHERE tenant_id=p_tenant FOR UPDATE;
 PERFORM 1 FROM public.profiles WHERE id=p_actor FOR SHARE;
 PERFORM 1 FROM public.tenants WHERE id=p_tenant FOR UPDATE;
 PERFORM 1 FROM public.tenant_memberships WHERE tenant_id=p_tenant AND user_id=p_actor FOR SHARE;
 PERFORM public.company_access_assert_manager(p_actor,p_tenant);
 IF p_command IS NULL OR p_revision IS NULL OR p_revision<1 OR p_payload IS NULL OR jsonb_typeof(p_payload)<>'object' THEN RAISE EXCEPTION 'ACCESS_INPUT';END IF;
 SELECT * INTO old_command FROM public.company_access_commands WHERE tenant_id=p_tenant AND actor_id=p_actor AND command_id=p_command;
 IF FOUND THEN
  IF old_command.payload IS DISTINCT FROM jsonb_build_object('revision',p_revision,'body',p_payload) THEN RAISE EXCEPTION 'ACCESS_COMMAND_REUSED';END IF;
  RETURN old_command.result;
 END IF;
 INSERT INTO public.company_access_state(tenant_id) VALUES(p_tenant) ON CONFLICT DO NOTHING;
 SELECT revision INTO rev FROM public.company_access_state WHERE tenant_id=p_tenant FOR UPDATE;
 IF rev<>p_revision THEN RAISE EXCEPTION 'ACCESS_STALE';END IF;
 kind:=p_payload->>'kind';record_id:=coalesce((p_payload->>'id')::uuid,gen_random_uuid());
 IF kind='save_role' THEN
  IF p_payload-ARRAY['kind','id','name','rules']<>'{}' OR jsonb_typeof(p_payload->'name') IS DISTINCT FROM 'string' OR length(btrim(p_payload->>'name')) NOT BETWEEN 1 AND 100 OR jsonb_typeof(p_payload->'rules') IS DISTINCT FROM 'array' OR jsonb_array_length(p_payload->'rules')>200 THEN RAISE EXCEPTION 'ACCESS_INPUT';END IF;
  FOR r IN SELECT value FROM jsonb_array_elements(p_payload->'rules') LOOP PERFORM public.company_access_validate_rule(p_tenant,r);END LOOP;
  SELECT to_jsonb(x) INTO old_value FROM public.company_access_roles x WHERE tenant_id=p_tenant AND id=record_id AND NOT archived;
  IF p_payload ? 'id' AND old_value IS NULL THEN RAISE EXCEPTION 'ACCESS_MISSING';END IF;
  IF EXISTS(SELECT FROM public.company_access_assignments a JOIN public.tenant_memberships m ON m.id=a.membership_id AND m.user_id=a.account_id AND m.tenant_id=a.tenant_id WHERE a.tenant_id=p_tenant AND a.role_id=record_id AND (a.account_id=p_actor OR m.role='yonetici')) THEN RAISE EXCEPTION 'ACCESS_PROTECTED_ACCOUNT';END IF;
  INSERT INTO public.company_access_roles(id,tenant_id,name,rules) VALUES(record_id,p_tenant,btrim(p_payload->>'name'),p_payload->'rules') ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,rules=EXCLUDED.rules;
  SELECT to_jsonb(x) INTO new_value FROM public.company_access_roles x WHERE tenant_id=p_tenant AND id=record_id;
 ELSIF kind='archive_role' THEN
  IF p_payload-ARRAY['kind','id']<>'{}' OR NOT p_payload ? 'id' THEN RAISE EXCEPTION 'ACCESS_INPUT';END IF;
  SELECT to_jsonb(x) INTO old_value FROM public.company_access_roles x WHERE tenant_id=p_tenant AND id=record_id AND NOT archived;
  IF old_value IS NULL THEN RAISE EXCEPTION 'ACCESS_MISSING';END IF;
  IF EXISTS(SELECT FROM public.company_access_assignments WHERE tenant_id=p_tenant AND role_id=record_id) THEN RAISE EXCEPTION 'ACCESS_ROLE_ASSIGNED';END IF;
  UPDATE public.company_access_roles SET archived=true WHERE tenant_id=p_tenant AND id=record_id;
  new_value:=old_value||'{"archived":true}';
 ELSIF kind IN ('assign_role','unassign_role','add_exception','revoke_exception') THEN
  IF kind='revoke_exception' THEN
   IF p_payload-ARRAY['kind','id']<>'{}' OR NOT p_payload ? 'id' THEN RAISE EXCEPTION 'ACCESS_INPUT';END IF;
   SELECT account_id,to_jsonb(x) INTO target,old_value FROM public.company_access_exceptions x WHERE tenant_id=p_tenant AND id=record_id AND NOT revoked;
   IF NOT FOUND THEN RAISE EXCEPTION 'ACCESS_MISSING';END IF;
  ELSE target:=(p_payload->>'accountId')::uuid;END IF;
  SELECT id INTO member FROM public.tenant_memberships WHERE tenant_id=p_tenant AND user_id=target AND role<>'yonetici' FOR SHARE;
  IF target IS NULL OR target=p_actor OR EXISTS(SELECT FROM public.tenant_memberships WHERE tenant_id=p_tenant AND user_id=target AND role='yonetici') OR (kind IN ('assign_role','add_exception') AND member IS NULL) THEN RAISE EXCEPTION 'ACCESS_PROTECTED_ACCOUNT';END IF;
  IF kind='assign_role' THEN
   IF p_payload-ARRAY['kind','accountId','roleId']<>'{}' THEN RAISE EXCEPTION 'ACCESS_INPUT';END IF;
   record_id:=(p_payload->>'roleId')::uuid;
   IF NOT EXISTS(SELECT FROM public.company_access_roles WHERE tenant_id=p_tenant AND id=record_id AND NOT archived) THEN RAISE EXCEPTION 'ACCESS_MISSING';END IF;
   SELECT to_jsonb(x) INTO old_value FROM public.company_access_assignments x WHERE tenant_id=p_tenant AND account_id=target;
   INSERT INTO public.company_access_assignments(tenant_id,account_id,membership_id,role_id) VALUES(p_tenant,target,member,record_id) ON CONFLICT(tenant_id,account_id) DO UPDATE SET membership_id=EXCLUDED.membership_id,role_id=EXCLUDED.role_id;
   SELECT to_jsonb(x) INTO new_value FROM public.company_access_assignments x WHERE tenant_id=p_tenant AND account_id=target;
  ELSIF kind='unassign_role' THEN
   IF p_payload-ARRAY['kind','accountId']<>'{}' THEN RAISE EXCEPTION 'ACCESS_INPUT';END IF;
   DELETE FROM public.company_access_assignments x WHERE tenant_id=p_tenant AND account_id=target RETURNING to_jsonb(x) INTO old_value;
   IF NOT FOUND THEN RAISE EXCEPTION 'ACCESS_MISSING';END IF;
   record_id:=target;
  ELSIF kind='add_exception' THEN
   IF p_payload-ARRAY['kind','accountId','rule']<>'{}' THEN RAISE EXCEPTION 'ACCESS_INPUT';END IF;
   PERFORM public.company_access_validate_rule(p_tenant,p_payload->'rule',true);
   IF (SELECT count(*) FROM public.company_access_exceptions WHERE tenant_id=p_tenant AND account_id=target AND NOT revoked)>=100 THEN RAISE EXCEPTION 'ACCESS_EXCEPTION_LIMIT';END IF;
   INSERT INTO public.company_access_exceptions(id,tenant_id,account_id,membership_id,rule) VALUES(record_id,p_tenant,target,member,p_payload->'rule');
   SELECT to_jsonb(x) INTO new_value FROM public.company_access_exceptions x WHERE tenant_id=p_tenant AND id=record_id;
  ELSE
   UPDATE public.company_access_exceptions SET revoked=true WHERE tenant_id=p_tenant AND id=record_id;
   new_value:=old_value||'{"revoked":true}';
  END IF;
 ELSE RAISE EXCEPTION 'ACCESS_INPUT';END IF;
 rev:=rev+1;
 UPDATE public.company_access_state SET revision=rev WHERE tenant_id=p_tenant;
 receipt:=jsonb_build_object('schemaVersion',1,'actorId',p_actor,'tenantId',p_tenant,'commandId',p_command,'kind',kind,'id',record_id,'revision',rev);
 INSERT INTO public.company_access_commands VALUES(p_tenant,p_actor,p_command,jsonb_build_object('revision',p_revision,'body',p_payload),receipt,statement_timestamp());
 INSERT INTO public.company_access_history(tenant_id,revision,actor_id,command_id,before_value,after_value) VALUES(p_tenant,rev,p_actor,p_command,old_value,new_value);
 RETURN receipt;
END $$;
-- Policy materialization is private. It neither grants access nor returns employee data.
CREATE FUNCTION public.company_access_policy_v1(p_tenant uuid,p_account uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('version',1,'tenantId',a.tenant_id,'actorId',a.account_id,'revision',s.revision,'roleId',r.id,'rules',r.rules,'exceptions',coalesce((SELECT jsonb_agg(e.rule ORDER BY e.id) FROM public.company_access_exceptions e WHERE e.tenant_id=a.tenant_id AND e.account_id=a.account_id AND e.membership_id=m.id AND NOT e.revoked),'[]'::jsonb))
 FROM public.company_access_assignments a JOIN public.tenant_memberships m ON m.tenant_id=a.tenant_id AND m.user_id=a.account_id AND m.id=a.membership_id
 JOIN public.company_access_roles r ON r.tenant_id=a.tenant_id AND r.id=a.role_id AND NOT r.archived JOIN public.company_access_state s ON s.tenant_id=a.tenant_id
 WHERE a.tenant_id=p_tenant AND a.account_id=p_account
$$;
REVOKE ALL ON FUNCTION public.company_access_assert_manager(uuid,uuid),public.company_access_validate_rule(uuid,jsonb,boolean),public.company_access_policy_v1(uuid,uuid),public.company_access_command_v1(uuid,uuid,uuid,bigint,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.company_access_command_v1(uuid,uuid,uuid,bigint,jsonb) TO authenticated;
CREATE FUNCTION public.company_access_scope_matches(s jsonb,p_actor uuid,p_account uuid,p_department uuid,p_location uuid) RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT coalesce(CASE s->>'kind' WHEN 'company' THEN true WHEN 'self' THEN p_actor=p_account WHEN 'selected' THEN
 (jsonb_array_length(s->'departmentIds')=0 OR (s->'departmentIds') ? p_department::text)
 AND (jsonb_array_length(s->'locationIds')=0 OR (s->'locationIds') ? p_location::text) ELSE false END,false)
$$;
CREATE FUNCTION public.company_access_decision_v1(p_tenant uuid,p_actor uuid,p_capability text,p_account uuid,p_department uuid,p_location uuid,p_now timestamptz) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE policy jsonb;module text;prerequisite text;rules jsonb;granted boolean;denied boolean;
BEGIN
 IF p_capability IS NULL OR p_capability NOT IN ('hr.employees.read','hr.employees.create','hr.employees.update','hr.employees.export','hr.compensation.read','hr.documents.download','finance.summary.read','finance.summary.update','finance.summary.export') OR p_now IS NULL THEN RETURN '{"allowed":false,"reason":"invalid"}';END IF;
 policy:=public.company_access_policy_v1(p_tenant,p_actor);
 IF policy IS NULL THEN RETURN '{"allowed":false,"reason":"not_granted"}';END IF;
 module:=split_part(p_capability,'.',1);
 IF NOT EXISTS(SELECT FROM public.tenant_module_settings s JOIN public.tenant_module_entitlements e USING(tenant_id,module_key) WHERE s.tenant_id=p_tenant AND s.module_key=module AND s.enabled AND e.granted) THEN RETURN '{"allowed":false,"reason":"module_closed"}';END IF;
 SELECT (policy->'rules')||coalesce(jsonb_agg(value),'[]') INTO rules FROM jsonb_array_elements(policy->'exceptions') WHERE (value->>'startsAt')::timestamptz<=p_now AND p_now<(value->>'expiresAt')::timestamptz;
 SELECT coalesce(bool_or(value->>'effect'='allow'),false),coalesce(bool_or(value->>'effect'='deny'),false) INTO granted,denied FROM jsonb_array_elements(rules) WHERE value->>'capability'=p_capability AND public.company_access_scope_matches(value->'scope',p_actor,p_account,p_department,p_location);
 IF denied THEN RETURN '{"allowed":false,"reason":"explicit_deny"}';END IF;
 IF NOT granted THEN RETURN '{"allowed":false,"reason":"not_granted"}';END IF;
 prerequisite:=CASE WHEN module='hr' AND p_capability<>'hr.employees.read' THEN 'hr.employees.read' WHEN module='finance' AND p_capability<>'finance.summary.read' THEN 'finance.summary.read' END;
 IF prerequisite IS NOT NULL AND NOT (public.company_access_decision_v1(p_tenant,p_actor,prerequisite,p_account,p_department,p_location,p_now)->>'allowed')::boolean THEN RETURN '{"allowed":false,"reason":"prerequisite_denied"}';END IF;
 RETURN '{"allowed":true,"reason":"allowed"}';
END $$;
-- Manager-only diagnostic: receives an employee id, never trusts caller-supplied ownership/scope/time.
-- Preview does not replace authorization in any existing HR/finance endpoint.
CREATE FUNCTION public.company_access_employee_preview_v1(p_actor uuid,p_tenant uuid,p_subject uuid,p_employee uuid,p_capability text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE department uuid;location uuid;linked_account uuid;today date:=(statement_timestamp() AT TIME ZONE 'Europe/Istanbul')::date;
BEGIN
 PERFORM public.company_access_assert_manager(p_actor,p_tenant);
 IF p_capability IS NULL OR p_capability NOT LIKE 'hr.%' THEN RAISE EXCEPTION 'ACCESS_PREVIEW_CAPABILITY';END IF;
 IF NOT EXISTS(SELECT FROM public.tenant_memberships WHERE tenant_id=p_tenant AND user_id=p_subject) OR NOT EXISTS(SELECT FROM public.hr_employees WHERE tenant_id=p_tenant AND id=p_employee) THEN RAISE EXCEPTION 'ACCESS_PREVIEW_SCOPE';END IF;
 SELECT department_id INTO department FROM public.hr_assignments WHERE tenant_id=p_tenant AND employee_id=p_employee AND daterange(starts_on,ends_on,'[]') @> today;
 SELECT location_id INTO location FROM public.hr_location_assignments WHERE tenant_id=p_tenant AND employee_id=p_employee AND daterange(starts_on,ends_on,'[]') @> today;
 linked_account:=public.hr_employee_account_v1(p_tenant,p_employee);
 RETURN jsonb_build_object('schemaVersion',1,'actorId',p_actor,'tenantId',p_tenant,'subjectId',p_subject,'employeeId',p_employee,'capability',p_capability,'revision',coalesce((SELECT revision FROM public.company_access_state WHERE tenant_id=p_tenant),1),'decision',public.company_access_decision_v1(p_tenant,p_subject,p_capability,linked_account,department,location,statement_timestamp()));
END $$;
REVOKE ALL ON FUNCTION public.company_access_scope_matches(jsonb,uuid,uuid,uuid,uuid),public.company_access_decision_v1(uuid,uuid,text,uuid,uuid,uuid,timestamptz),public.company_access_employee_preview_v1(uuid,uuid,uuid,uuid,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.company_access_employee_preview_v1(uuid,uuid,uuid,uuid,text) TO authenticated;
CREATE FUNCTION public.company_access_settings_v1(p_actor uuid,p_tenant uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM public.company_access_assert_manager(p_actor,p_tenant);
 -- Explicit bounded first release; never return a silently truncated permission inventory.
 IF (SELECT count(*) FROM (SELECT id FROM public.company_access_roles WHERE tenant_id=p_tenant LIMIT 251) x)>250
 OR (SELECT count(*) FROM (SELECT account_id FROM public.company_access_assignments WHERE tenant_id=p_tenant LIMIT 1001) x)>1000
 OR (SELECT count(*) FROM (SELECT id FROM public.company_access_exceptions WHERE tenant_id=p_tenant AND NOT revoked LIMIT 1001) x)>1000 THEN RAISE EXCEPTION 'ACCESS_SETTINGS_LIMIT';END IF;
 RETURN jsonb_build_object('schemaVersion',1,'actorId',p_actor,'tenantId',p_tenant,'revision',coalesce((SELECT revision FROM public.company_access_state WHERE tenant_id=p_tenant),1),
 'enforcement','preview_only',
 'roles',coalesce((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.name,x.id) FROM public.company_access_roles x WHERE tenant_id=p_tenant),'[]'),
 'assignments',coalesce((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.account_id) FROM public.company_access_assignments x WHERE tenant_id=p_tenant),'[]'),
 'exceptions',coalesce((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.id) FROM public.company_access_exceptions x WHERE tenant_id=p_tenant AND NOT revoked),'[]'),
 'recentHistory',coalesce((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.revision DESC) FROM (SELECT * FROM public.company_access_history WHERE tenant_id=p_tenant ORDER BY revision DESC LIMIT 20) x),'[]'));
END $$;
REVOKE ALL ON FUNCTION public.company_access_settings_v1(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.company_access_settings_v1(uuid,uuid) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
