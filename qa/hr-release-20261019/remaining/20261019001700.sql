BEGIN; SET LOCAL statement_timeout='60s'; SET LOCAL lock_timeout='5s';
LOCK TABLE supabase_migrations.schema_migrations IN EXCLUSIVE MODE;
DO $guard$ BEGIN
IF (SELECT array_agg(version ORDER BY version) FROM supabase_migrations.schema_migrations) IS DISTINCT FROM ARRAY['20260407000000','20260407000100','20260407000200','20260407000300','20260407000400','20260407000500','20260407000600','20260407000700','20260407000800','20260407000900','20260407001000','20260407001100','20260407001600','20260407001700','20260407001800','20260413000100','20260414000100','20260414000200','20260415000100','20260415000200','20260415000300','20260415000400','20260415000500','20260423000100','20260425000100','20260425000200','20260713000100','20260713000200','20260722000100','20260810000100','20260810000200','20260827000100','20260827000200','20260827000300','20260827000400','20260904000100','20260904000200','20260909000100','20260909000200','20260909000300','20260909000400','20260909000500','20260909000600','20260909000700','20260909000800','20260909000900','20260909001000','20260909001100','20260909001200','20260909001300','20260909001400','20260909001500','20260909001600','20260909001700','20260909001800','20260909001900','20260909002000','20260909002100','20260909002200','20260909002300','20260909002400','20260909002500','20260909002600','20260909002700','20260909002800','20260909002900','20260910000100','20260910000200','20260910000300','20260910000400','20260911000100','20260913000100','20260914000100','20260914000200','20260914000300','20260914000400','20260914000500','20260914000600','20260914000700','20260915000100','20260915000200','20260915000300','20260915000400','20260915000500','20260915000600','20260915000700','20260915000800','20260915000900','20260915001000','20260923000100','20260923000200','20260923000300','20260923000400','20260924000100','20260924000200','20260924000300','20260924000400','20260924000500','20260925000100','20260925000200','20260925000300','20260925000400','20260925000500','20260925000600','20260925000700','20260926000100','20260926000200','20260927000100','20260927000200','20260927000300','20260927000400','20260927000500','20260927000600','20260927000700','20260927000800','20260927000900','20260928000100','20260928000200','20260928000300','20260928000400','20260928000500','20260928000600','20260928000700','20260928000800','20261004001000','20261004001100','20261004001200','20261004001300','20261004001400','20261005000100','20261005000200','20261005000300','20261005000400','20261005000500','20261005000600','20261005000700','20261005000800','20261005000900','20261005001000','20261005001100','20261005001200','20261005001300','20261005001400','20261005001500','20261005001600','20261005001700','20261005001800','20261005001900','20261005002000','20261005002100','20261005002200','20261005002300','20261005002400','20261005002500','20261005002600','20261005002700','20261005002800','20261005002900','20261005003000','20261005003100','20261013000100','20261013000200','20261013000300','20261015000100','20261015000200','20261015000300','20261015000400','20261015000500','20261015000600','20261015000700','20261015000800','20261016000100','20261016000200','20261016000300','20261016000400','20261016000500','20261016000600','20261016000700','20261016000800','20261016000900','20261016001000','20261016001100','20261017000100','20261017000200','20261018000100','20261018000200','20261018000300','20261018000400','20261018000500','20261018000600','20261019000100','20261019000200','20261019000300','20261019000400','20261019000500','20261019000600','20261019000700','20261019000800','20261019000900','20261019001000','20261019001100','20261019001200','20261019001300','20261019001400','20261019001500','20261019001600']::text[] THEN RAISE EXCEPTION 'LIVE_LEDGER_CHANGED'; END IF;
IF to_regnamespace('bps_release_guard') IS NOT NULL THEN RAISE EXCEPTION 'RELEASE_BARRIER_PRESENT'; END IF;
END $guard$;
-- Activation remains release-gated; this migration does not approve any company.

ALTER TABLE public.company_hr_access_modes ADD COLUMN revision bigint NOT NULL DEFAULT 1 CHECK(revision>0);
CREATE TABLE public.hr_access_release_gates(tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id),approved boolean NOT NULL DEFAULT false);
CREATE TABLE public.hr_access_activation_commands(tenant_id uuid NOT NULL REFERENCES public.tenants(id),actor_id uuid NOT NULL REFERENCES public.profiles(id),command_id uuid NOT NULL,expected_token text NOT NULL,result jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT statement_timestamp(),PRIMARY KEY(tenant_id,actor_id,command_id));
ALTER TABLE public.hr_access_release_gates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_access_activation_commands ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.hr_access_release_gates,public.hr_access_activation_commands FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.hr_access_activation_preflight_v1(p_actor uuid,p_tenant uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE members jsonb;mode text;mode_rev bigint;policy_rev bigint;approved boolean;module_open boolean;missing integer;result jsonb;fingerprint text;
BEGIN
 PERFORM public.company_access_assert_manager(p_actor,p_tenant);
 IF (SELECT count(*) FROM (SELECT id FROM public.tenant_memberships WHERE tenant_id=p_tenant LIMIT 1001) x)>1000 THEN RAISE EXCEPTION 'HR_ACTIVATION_LIMIT';END IF;
 SELECT m.mode,m.revision INTO mode,mode_rev FROM public.company_hr_access_modes m WHERE m.tenant_id=p_tenant;
 mode:=coalesce(mode,'legacy');mode_rev:=coalesce(mode_rev,0);
 policy_rev:=coalesce((SELECT revision FROM public.company_access_state WHERE tenant_id=p_tenant),1);
 approved:=coalesce((SELECT g.approved FROM public.hr_access_release_gates g WHERE g.tenant_id=p_tenant),false);
 module_open:=EXISTS(SELECT FROM public.tenant_module_settings s JOIN public.tenant_module_entitlements e USING(tenant_id,module_key) WHERE s.tenant_id=p_tenant AND s.module_key='hr' AND s.enabled AND e.granted);
 SELECT coalesce(jsonb_agg(jsonb_build_object('accountId',m.user_id,'membershipId',m.id,'membershipVersion',m.version,'name',coalesce(nullif(btrim(p.display_name),''),'İsimsiz hesap'),'role',m.role,
 'policyAssigned',public.company_access_policy_v1(p_tenant,m.user_id) IS NOT NULL,
 'permanentReadRule',EXISTS(SELECT FROM jsonb_array_elements(coalesce(public.company_access_policy_v1(p_tenant,m.user_id)->'rules','[]')) r WHERE r->>'capability'='hr.employees.read' AND r->>'effect'='allow')) ORDER BY m.user_id),'[]') INTO members
 FROM public.tenant_memberships m JOIN public.profiles p ON p.id=m.user_id WHERE m.tenant_id=p_tenant;
 SELECT count(*) INTO missing FROM jsonb_array_elements(members) m WHERE m->>'role'='ik' AND (NOT (m->>'policyAssigned')::boolean OR NOT (m->>'permanentReadRule')::boolean);
 result:=jsonb_build_object('schemaVersion',1,'actorId',p_actor,'tenantId',p_tenant,'mode',mode,'modeRevision',mode_rev,'policyRevision',policy_rev,'releaseApproved',approved,'moduleOpen',module_open,'missingHrPolicies',missing,'members',members);
 -- The token detects membership churn as well as policy and mode revisions. It is not an authorization credential.
 fingerprint:=md5(result::text);
 RETURN result||jsonb_build_object('token',fingerprint,'canActivate',mode='legacy' AND approved AND module_open AND missing=0);
END $$;
CREATE FUNCTION public.hr_access_activate_v1(p_actor uuid,p_tenant uuid,p_command uuid,p_token text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='5s' AS $$
DECLARE previous public.hr_access_activation_commands;preflight jsonb;receipt jsonb;next_rev bigint;
BEGIN
 IF current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION 'ACCESS_ISOLATION';END IF;
 PERFORM public.company_access_assert_manager(p_actor,p_tenant);
 IF p_command IS NULL OR p_token IS NULL OR p_token !~ '^[0-9a-f]{32}$' THEN RAISE EXCEPTION 'HR_ACTIVATION_INPUT';END IF;
 PERFORM 1 FROM public.tenant_module_config WHERE tenant_id=p_tenant FOR UPDATE;
 PERFORM 1 FROM public.profiles WHERE id=p_actor FOR SHARE;
 PERFORM 1 FROM public.tenants WHERE id=p_tenant FOR UPDATE;
 PERFORM 1 FROM public.tenant_memberships WHERE tenant_id=p_tenant ORDER BY id FOR SHARE;
 PERFORM 1 FROM public.hr_access_release_gates WHERE tenant_id=p_tenant FOR SHARE;
 PERFORM public.company_access_assert_manager(p_actor,p_tenant);
 SELECT * INTO previous FROM public.hr_access_activation_commands WHERE tenant_id=p_tenant AND actor_id=p_actor AND command_id=p_command;
 IF FOUND THEN
  IF previous.expected_token<>p_token THEN RAISE EXCEPTION 'HR_ACTIVATION_COMMAND_REUSED';END IF;
  RETURN previous.result;
 END IF;
 preflight:=public.hr_access_activation_preflight_v1(p_actor,p_tenant);
 IF preflight->>'token'<>p_token THEN RAISE EXCEPTION 'HR_ACTIVATION_STALE';END IF;
 IF NOT (preflight->>'canActivate')::boolean THEN RAISE EXCEPTION 'HR_ACTIVATION_BLOCKED';END IF;
 next_rev:=(preflight->>'modeRevision')::bigint+1;
 INSERT INTO public.company_hr_access_modes(tenant_id,mode,revision) VALUES(p_tenant,'scoped',next_rev)
 ON CONFLICT(tenant_id) DO UPDATE SET mode='scoped',revision=excluded.revision;
 receipt:=jsonb_build_object('schemaVersion',1,'actorId',p_actor,'tenantId',p_tenant,'commandId',p_command,'mode','scoped','modeRevision',next_rev,'policyRevision',(preflight->>'policyRevision')::bigint);
 INSERT INTO public.hr_access_activation_commands(tenant_id,actor_id,command_id,expected_token,result) VALUES(p_tenant,p_actor,p_command,p_token,receipt||jsonb_build_object('preflight',preflight));
 RETURN receipt||jsonb_build_object('preflight',preflight);
END $$;
REVOKE ALL ON FUNCTION public.hr_access_activation_preflight_v1(uuid,uuid),public.hr_access_activate_v1(uuid,uuid,uuid,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.hr_access_activation_preflight_v1(uuid,uuid),public.hr_access_activate_v1(uuid,uuid,uuid,text) TO authenticated;
NOTIFY pgrst,'reload schema';

INSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES('20261019001700','hr_access_activation',ARRAY[$bps_source$-- Activation remains release-gated; this migration does not approve any company.
BEGIN;
ALTER TABLE public.company_hr_access_modes ADD COLUMN revision bigint NOT NULL DEFAULT 1 CHECK(revision>0);
CREATE TABLE public.hr_access_release_gates(tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id),approved boolean NOT NULL DEFAULT false);
CREATE TABLE public.hr_access_activation_commands(tenant_id uuid NOT NULL REFERENCES public.tenants(id),actor_id uuid NOT NULL REFERENCES public.profiles(id),command_id uuid NOT NULL,expected_token text NOT NULL,result jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT statement_timestamp(),PRIMARY KEY(tenant_id,actor_id,command_id));
ALTER TABLE public.hr_access_release_gates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_access_activation_commands ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.hr_access_release_gates,public.hr_access_activation_commands FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.hr_access_activation_preflight_v1(p_actor uuid,p_tenant uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE members jsonb;mode text;mode_rev bigint;policy_rev bigint;approved boolean;module_open boolean;missing integer;result jsonb;fingerprint text;
BEGIN
 PERFORM public.company_access_assert_manager(p_actor,p_tenant);
 IF (SELECT count(*) FROM (SELECT id FROM public.tenant_memberships WHERE tenant_id=p_tenant LIMIT 1001) x)>1000 THEN RAISE EXCEPTION 'HR_ACTIVATION_LIMIT';END IF;
 SELECT m.mode,m.revision INTO mode,mode_rev FROM public.company_hr_access_modes m WHERE m.tenant_id=p_tenant;
 mode:=coalesce(mode,'legacy');mode_rev:=coalesce(mode_rev,0);
 policy_rev:=coalesce((SELECT revision FROM public.company_access_state WHERE tenant_id=p_tenant),1);
 approved:=coalesce((SELECT g.approved FROM public.hr_access_release_gates g WHERE g.tenant_id=p_tenant),false);
 module_open:=EXISTS(SELECT FROM public.tenant_module_settings s JOIN public.tenant_module_entitlements e USING(tenant_id,module_key) WHERE s.tenant_id=p_tenant AND s.module_key='hr' AND s.enabled AND e.granted);
 SELECT coalesce(jsonb_agg(jsonb_build_object('accountId',m.user_id,'membershipId',m.id,'membershipVersion',m.version,'name',coalesce(nullif(btrim(p.display_name),''),'İsimsiz hesap'),'role',m.role,
 'policyAssigned',public.company_access_policy_v1(p_tenant,m.user_id) IS NOT NULL,
 'permanentReadRule',EXISTS(SELECT FROM jsonb_array_elements(coalesce(public.company_access_policy_v1(p_tenant,m.user_id)->'rules','[]')) r WHERE r->>'capability'='hr.employees.read' AND r->>'effect'='allow')) ORDER BY m.user_id),'[]') INTO members
 FROM public.tenant_memberships m JOIN public.profiles p ON p.id=m.user_id WHERE m.tenant_id=p_tenant;
 SELECT count(*) INTO missing FROM jsonb_array_elements(members) m WHERE m->>'role'='ik' AND (NOT (m->>'policyAssigned')::boolean OR NOT (m->>'permanentReadRule')::boolean);
 result:=jsonb_build_object('schemaVersion',1,'actorId',p_actor,'tenantId',p_tenant,'mode',mode,'modeRevision',mode_rev,'policyRevision',policy_rev,'releaseApproved',approved,'moduleOpen',module_open,'missingHrPolicies',missing,'members',members);
 -- The token detects membership churn as well as policy and mode revisions. It is not an authorization credential.
 fingerprint:=md5(result::text);
 RETURN result||jsonb_build_object('token',fingerprint,'canActivate',mode='legacy' AND approved AND module_open AND missing=0);
END $$;
CREATE FUNCTION public.hr_access_activate_v1(p_actor uuid,p_tenant uuid,p_command uuid,p_token text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='5s' AS $$
DECLARE previous public.hr_access_activation_commands;preflight jsonb;receipt jsonb;next_rev bigint;
BEGIN
 IF current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION 'ACCESS_ISOLATION';END IF;
 PERFORM public.company_access_assert_manager(p_actor,p_tenant);
 IF p_command IS NULL OR p_token IS NULL OR p_token !~ '^[0-9a-f]{32}$' THEN RAISE EXCEPTION 'HR_ACTIVATION_INPUT';END IF;
 PERFORM 1 FROM public.tenant_module_config WHERE tenant_id=p_tenant FOR UPDATE;
 PERFORM 1 FROM public.profiles WHERE id=p_actor FOR SHARE;
 PERFORM 1 FROM public.tenants WHERE id=p_tenant FOR UPDATE;
 PERFORM 1 FROM public.tenant_memberships WHERE tenant_id=p_tenant ORDER BY id FOR SHARE;
 PERFORM 1 FROM public.hr_access_release_gates WHERE tenant_id=p_tenant FOR SHARE;
 PERFORM public.company_access_assert_manager(p_actor,p_tenant);
 SELECT * INTO previous FROM public.hr_access_activation_commands WHERE tenant_id=p_tenant AND actor_id=p_actor AND command_id=p_command;
 IF FOUND THEN
  IF previous.expected_token<>p_token THEN RAISE EXCEPTION 'HR_ACTIVATION_COMMAND_REUSED';END IF;
  RETURN previous.result;
 END IF;
 preflight:=public.hr_access_activation_preflight_v1(p_actor,p_tenant);
 IF preflight->>'token'<>p_token THEN RAISE EXCEPTION 'HR_ACTIVATION_STALE';END IF;
 IF NOT (preflight->>'canActivate')::boolean THEN RAISE EXCEPTION 'HR_ACTIVATION_BLOCKED';END IF;
 next_rev:=(preflight->>'modeRevision')::bigint+1;
 INSERT INTO public.company_hr_access_modes(tenant_id,mode,revision) VALUES(p_tenant,'scoped',next_rev)
 ON CONFLICT(tenant_id) DO UPDATE SET mode='scoped',revision=excluded.revision;
 receipt:=jsonb_build_object('schemaVersion',1,'actorId',p_actor,'tenantId',p_tenant,'commandId',p_command,'mode','scoped','modeRevision',next_rev,'policyRevision',(preflight->>'policyRevision')::bigint);
 INSERT INTO public.hr_access_activation_commands(tenant_id,actor_id,command_id,expected_token,result) VALUES(p_tenant,p_actor,p_command,p_token,receipt||jsonb_build_object('preflight',preflight));
 RETURN receipt||jsonb_build_object('preflight',preflight);
END $$;
REVOKE ALL ON FUNCTION public.hr_access_activation_preflight_v1(uuid,uuid),public.hr_access_activate_v1(uuid,uuid,uuid,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.hr_access_activation_preflight_v1(uuid,uuid),public.hr_access_activate_v1(uuid,uuid,uuid,text) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
$bps_source$]);
COMMIT;
