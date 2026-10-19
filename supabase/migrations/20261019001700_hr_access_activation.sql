-- Activation remains release-gated; this migration does not approve any company.
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
