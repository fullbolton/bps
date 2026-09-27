-- Multi-workspace cutover: atomic assembly of the six reviewed SQL parts.
BEGIN;

-- 01_membership_roles.sql
-- LOCAL ACCEPTANCE CANDIDATE ONLY. Not a deployable migration yet.
-- Admin/invitation/token/recipient cutover must ship together; see README.md.

SET LOCAL lock_timeout='5s';
LOCK TABLE public.profiles,public.tenant_memberships,public.tasks IN ACCESS EXCLUSIVE MODE;
ALTER TABLE public.tenant_memberships ADD COLUMN role text, ADD COLUMN version uuid NOT NULL DEFAULT gen_random_uuid();
UPDATE public.tenant_memberships m SET role=p.role FROM public.profiles p WHERE p.id=m.user_id;
ALTER TABLE public.tenant_memberships ALTER COLUMN role SET NOT NULL;
ALTER TABLE public.tenant_memberships ADD CONSTRAINT tenant_memberships_role_check
 CHECK(role IN ('yonetici','partner','operasyon','ik','muhasebe','goruntuleyici'));
-- No default and no permanent profile-role fallback. New writers must specify a role.
CREATE OR REPLACE FUNCTION public.current_user_role() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT m.role FROM public.tenant_memberships m
 WHERE m.user_id=auth.uid() AND m.tenant_id=public.current_user_verified_tenant()
$$;
CREATE OR REPLACE FUNCTION public.active_tenant_profiles() RETURNS SETOF public.profiles
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT (jsonb_populate_record(p,jsonb_build_object('role',m.role,'version',m.version))).*
 FROM public.profiles p JOIN public.tenant_memberships m ON m.user_id=p.id
 WHERE m.tenant_id=public.current_user_verified_tenant() ORDER BY p.display_name,p.id
$$;

CREATE OR REPLACE FUNCTION public.tasks_guard_active_assignee() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_role text;
BEGIN
 IF NEW.assigned_to_user_id IS NULL OR NEW.status NOT IN ('acik','devam_ediyor','gecikti') THEN RETURN NEW;END IF;
 IF current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION 'TASK_GUARD_REQUIRES_READ_COMMITTED' USING ERRCODE='BP004';END IF;
 -- Shared serialization point. Membership writers lock the same profile first.
 PERFORM 1 FROM public.profiles WHERE id=NEW.assigned_to_user_id FOR SHARE;
 SELECT role INTO v_role FROM public.tenant_memberships WHERE user_id=NEW.assigned_to_user_id AND tenant_id=NEW.tenant_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'TASK_ASSIGNEE_MEMBERSHIP' USING ERRCODE='BP002';END IF;
 IF v_role NOT IN ('yonetici','operasyon','ik') THEN RAISE EXCEPTION 'TASK_ASSIGNEE_ROLE' USING ERRCODE='BP003';END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.membership_guard_active_tasks() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF TG_OP='UPDATE' THEN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id THEN
   RAISE EXCEPTION 'MEMBERSHIP_IDENTITY_IMMUTABLE' USING ERRCODE='22023';
  END IF;
  IF NEW.role IS NOT DISTINCT FROM OLD.role THEN NEW.version:=OLD.version;RETURN NEW;END IF;
  NEW.version:=gen_random_uuid();
 END IF;
 IF current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION 'TASK_GUARD_REQUIRES_READ_COMMITTED' USING ERRCODE='BP004';END IF;
 PERFORM 1 FROM public.profiles WHERE id=OLD.user_id FOR UPDATE;
 IF TG_OP='UPDATE' THEN
  IF NEW.role IN ('yonetici','operasyon','ik') THEN RETURN NEW;END IF;
 END IF;
 IF EXISTS(SELECT 1 FROM public.tasks WHERE tenant_id=OLD.tenant_id AND assigned_to_user_id=OLD.user_id AND status IN ('acik','devam_ediyor','gecikti')) THEN
  RAISE EXCEPTION 'ACTIVE_TASKS_REQUIRE_TRANSFER' USING ERRCODE='BP001';
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD;END IF;RETURN NEW;
END $$;
-- Profile role becomes legacy metadata. Do not block unrelated company changes.
CREATE OR REPLACE FUNCTION public.profile_guard_active_tasks() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN RETURN NEW;END $$;

CREATE FUNCTION public.admin_manage_membership(p_user_id uuid,p_tenant_id uuid,p_action text,p_role text DEFAULT NULL,p_expected_role text DEFAULT NULL,p_expected_version uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='5s' AS $$
DECLARE existing_role text;existing_version uuid;present boolean;
BEGIN
 IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'not authorized' USING ERRCODE='42501';END IF;
 IF current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION 'TASK_GUARD_REQUIRES_READ_COMMITTED' USING ERRCODE='BP004';END IF;
 IF p_action IS NULL OR p_action NOT IN ('add','change_role','remove') OR p_user_id IS NULL OR p_tenant_id IS NULL THEN RAISE EXCEPTION 'MEMBERSHIP_INPUT' USING ERRCODE='22023';END IF;
 IF p_action IN ('add','change_role') AND (p_role IS NULL OR p_role NOT IN ('yonetici','partner','operasyon','ik','muhasebe','goruntuleyici')) THEN RAISE EXCEPTION 'MEMBERSHIP_ROLE' USING ERRCODE='23514';END IF;
 IF (p_action='remove' AND p_role IS NOT NULL) OR (p_action='add' AND (p_expected_role IS NOT NULL OR p_expected_version IS NOT NULL)) THEN RAISE EXCEPTION 'MEMBERSHIP_INPUT' USING ERRCODE='22023';END IF;
 PERFORM 1 FROM public.profiles WHERE id=p_user_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'user not found' USING ERRCODE='23503';END IF;
 PERFORM 1 FROM public.tenants WHERE id=p_tenant_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'tenant not found' USING ERRCODE='23503';END IF;
 SELECT role,version INTO existing_role,existing_version FROM public.tenant_memberships WHERE user_id=p_user_id AND tenant_id=p_tenant_id;
 present:=FOUND;
 IF p_action='add' THEN
  IF present THEN RAISE EXCEPTION 'MEMBERSHIP_CONFLICT' USING ERRCODE='40001';END IF;
  -- Orphaned active ownership must not gain an ineligible role via an insert.
  IF p_role NOT IN ('yonetici','operasyon','ik') AND EXISTS(SELECT 1 FROM public.tasks WHERE tenant_id=p_tenant_id AND assigned_to_user_id=p_user_id AND status IN ('acik','devam_ediyor','gecikti')) THEN RAISE EXCEPTION 'ACTIVE_TASKS_REQUIRE_TRANSFER' USING ERRCODE='BP001';END IF;
  INSERT INTO public.tenant_memberships(user_id,tenant_id,role)VALUES(p_user_id,p_tenant_id,p_role);
 ELSE
  IF NOT present OR p_expected_role IS NULL OR p_expected_role IS DISTINCT FROM existing_role OR p_expected_version IS DISTINCT FROM existing_version THEN RAISE EXCEPTION 'MEMBERSHIP_CONFLICT' USING ERRCODE='40001';END IF;
  IF p_action='change_role' THEN UPDATE public.tenant_memberships SET role=p_role WHERE user_id=p_user_id AND tenant_id=p_tenant_id;
  ELSE DELETE FROM public.tenant_memberships WHERE user_id=p_user_id AND tenant_id=p_tenant_id;END IF;
 END IF;
 RETURN jsonb_build_object('userId',p_user_id,'tenantId',p_tenant_id,'action',p_action,'role',CASE WHEN p_action='remove' THEN NULL ELSE p_role END);
END $$;
REVOKE ALL ON FUNCTION public.admin_manage_membership(uuid,uuid,text,text,text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_manage_membership(uuid,uuid,text,text,text,uuid) TO authenticated;

CREATE FUNCTION public.admin_user_memberships(p_user_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'not authorized' USING ERRCODE='42501';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_user_id) THEN RAISE EXCEPTION 'user not found' USING ERRCODE='23503';END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('tenantId',t.id,'name',t.name,'role',m.role,'version',m.version) ORDER BY t.name,t.id),'[]') INTO result
 FROM public.tenant_memberships m JOIN public.tenants t ON t.id=m.tenant_id WHERE m.user_id=p_user_id;
 RETURN jsonb_build_object('userId',p_user_id,'memberships',result);
END $$;
REVOKE ALL ON FUNCTION public.admin_user_memberships(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_user_memberships(uuid) TO authenticated;
-- A legacy single-company client must never delete all other memberships.
CREATE OR REPLACE FUNCTION public.admin_assign_role_and_tenant(p_user_id uuid,p_role text,p_tenant_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'not authorized' USING ERRCODE='42501';END IF;
 RAISE EXCEPTION 'MEMBERSHIP_CLIENT_UPGRADE_REQUIRED' USING ERRCODE='0A000';
END $$;


-- 02_invitation_roles.sql
-- LOCAL ACCEPTANCE CANDIDATE ONLY; apply together with the complete cutover.

SET LOCAL lock_timeout='5s';
CREATE OR REPLACE FUNCTION public.invitation_registration_allowed(p_id uuid,p_token text,p_email text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce(p_token ~ '^[0-9a-f]{64}$' AND EXISTS(
 SELECT 1 FROM public.workspace_invitations i JOIN public.tenant_memberships m ON m.user_id=i.created_by AND m.tenant_id=i.tenant_id
 WHERE i.id=p_id AND i.email=lower(btrim(p_email))
 AND i.token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex')
 AND i.accepted_at IS NULL AND i.cancelled_at IS NULL AND i.expires_at>statement_timestamp() AND m.role='yonetici'),false)
$$;
CREATE OR REPLACE FUNCTION public.accept_workspace_invitation(p_actor_id uuid,p_id uuid,p_token text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='5s' AS $$
DECLARE v public.workspace_invitations%ROWTYPE;v_email text;
BEGIN
 IF current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION 'INVITE_ISOLATION';END IF;
 IF auth.uid() IS NULL OR p_actor_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'INVITE_SCOPE';END IF;
 IF p_token IS NULL OR p_token !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'INVITE_INVALID';END IF;
 SELECT * INTO v FROM public.workspace_invitations WHERE id=p_id AND token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex');
 IF NOT FOUND THEN RAISE EXCEPTION 'INVITE_INVALID';END IF;
 PERFORM id FROM public.profiles WHERE id IN(p_actor_id,v.created_by) ORDER BY id FOR UPDATE;
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_actor_id) THEN RAISE EXCEPTION 'INVITE_ACCOUNT_REVIEW';END IF;
 SELECT * INTO v FROM public.workspace_invitations WHERE id=p_id AND token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex') FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'INVITE_INVALID';END IF;
 SELECT lower(email) INTO v_email FROM auth.users WHERE id=p_actor_id AND email_confirmed_at IS NOT NULL AND (banned_until IS NULL OR banned_until<=clock_timestamp());
 IF v_email IS NULL OR v_email<>v.email THEN RAISE EXCEPTION 'INVITE_IDENTITY';END IF;
 IF v.accepted_at IS NOT NULL THEN
  IF v.accepted_by IS DISTINCT FROM p_actor_id THEN RAISE EXCEPTION 'INVITE_INVALID';END IF;
  -- Historical receipt only. A removed membership must never be recreated on retry.
  RETURN jsonb_build_object('tenantId',v.tenant_id,'accepted',true);
 END IF;
 IF v.cancelled_at IS NOT NULL OR v.expires_at<=clock_timestamp() THEN RAISE EXCEPTION 'INVITE_INVALID';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.tenant_memberships WHERE user_id=v.created_by AND tenant_id=v.tenant_id AND role='yonetici') THEN RAISE EXCEPTION 'INVITE_REVOKED';END IF;
 IF EXISTS(SELECT 1 FROM public.tenant_memberships WHERE user_id=p_actor_id AND tenant_id=v.tenant_id) THEN RAISE EXCEPTION 'INVITE_EXISTING_MEMBER';END IF;
 IF v.role NOT IN('operasyon','ik','muhasebe','goruntuleyici') THEN RAISE EXCEPTION 'INVITE_INVALID';END IF;
 IF v.role NOT IN('operasyon','ik') AND EXISTS(SELECT 1 FROM public.tasks WHERE tenant_id=v.tenant_id AND assigned_to_user_id=p_actor_id AND status IN('acik','devam_ediyor','gecikti')) THEN RAISE EXCEPTION 'ACTIVE_TASKS_REQUIRE_TRANSFER' USING ERRCODE='BP001';END IF;
 INSERT INTO public.tenant_memberships(user_id,tenant_id,role) VALUES(p_actor_id,v.tenant_id,v.role);
 UPDATE public.workspace_invitations SET accepted_at=clock_timestamp(),accepted_by=p_actor_id WHERE id=v.id;
 -- Other memberships, global profile and sessions are unchanged. The selector/
 -- refresh flow must be shipped with this function; this file alone is not live-ready.
 RETURN jsonb_build_object('tenantId',v.tenant_id,'accepted',true);
END $$;


-- 03_workspace_selection.sql
-- LOCAL ACCEPTANCE CANDIDATE. Ship only with the complete multi-workspace cutover.

SET LOCAL lock_timeout='5s';
CREATE TABLE public.workspace_selections (
 user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
 tenant_id uuid NOT NULL REFERENCES public.tenants(id),
 version uuid NOT NULL DEFAULT gen_random_uuid(),
 command_id uuid NOT NULL,
 changed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.workspace_selections ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.workspace_selections FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.current_user_active_tenant() RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=auth.uid();tenant uuid;chosen public.workspace_selections;member_version uuid;claims jsonb:=auth.jwt();
BEGIN
 IF actor IS NULL THEN RETURN NULL;END IF;
 BEGIN tenant:=(claims->>'active_tenant_id')::uuid;EXCEPTION WHEN invalid_text_representation THEN RETURN NULL;END;
 SELECT version INTO member_version FROM public.tenant_memberships WHERE user_id=actor AND tenant_id=tenant;
 IF NOT FOUND THEN RETURN NULL;END IF;
 SELECT * INTO chosen FROM public.workspace_selections WHERE user_id=actor;
 IF FOUND THEN
  IF chosen.tenant_id IS DISTINCT FROM tenant OR claims->>'workspace_selection_version' IS DISTINCT FROM chosen.version::text
   OR claims->>'workspace_membership_version' IS DISTINCT FROM member_version::text THEN RETURN NULL;END IF;
 ELSE
  -- Single-company sessions keep working until the first explicit selection.
  -- Multiple memberships without a selection never pick an arbitrary company.
  IF (SELECT count(*) FROM public.tenant_memberships WHERE user_id=actor)<>1 THEN RETURN NULL;END IF;
  IF claims ? 'workspace_membership_version' AND claims->>'workspace_membership_version' IS DISTINCT FROM member_version::text THEN RETURN NULL;END IF;
 END IF;
 RETURN tenant;
END $$;


CREATE OR REPLACE FUNCTION public.current_workspace_context() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=auth.uid();tenant uuid:=public.current_user_verified_tenant();result jsonb;
BEGIN
 IF actor IS NULL OR tenant IS NULL THEN RAISE EXCEPTION 'WORKSPACE_SCOPE' USING ERRCODE='42501';END IF;
 SELECT jsonb_build_object('actorId',actor,'tenantId',tenant,'name',btrim(t.name),'role',m.role,
 'selectionVersion',s.version,'membershipVersion',m.version) INTO result
 FROM public.tenants t JOIN public.tenant_memberships m ON m.tenant_id=t.id AND m.user_id=actor
 LEFT JOIN public.workspace_selections s ON s.user_id=actor
 WHERE t.id=tenant AND btrim(t.name)<>'';
 IF result IS NULL THEN RAISE EXCEPTION 'WORKSPACE_SCOPE' USING ERRCODE='42501';END IF;
 RETURN result;
END $$;

CREATE FUNCTION public.my_workspace_choices() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=auth.uid();result jsonb;
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'WORKSPACE_AUTH' USING ERRCODE='42501';END IF;
 SELECT jsonb_build_object('userId',actor,'selectionVersion',(SELECT version FROM public.workspace_selections WHERE user_id=actor),
  'activeTenantId',public.current_user_active_tenant(),'memberships',coalesce(jsonb_agg(jsonb_build_object('tenantId',t.id,'name',t.name,'role',m.role,'version',m.version) ORDER BY t.name,t.id),'[]'::jsonb))
 INTO result FROM public.tenant_memberships m JOIN public.tenants t ON t.id=m.tenant_id WHERE m.user_id=actor;
 RETURN result;
END $$;

CREATE FUNCTION public.select_workspace(p_tenant_id uuid,p_membership_version uuid,p_command_id uuid,p_expected_version uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='5s' AS $$
DECLARE actor uuid:=auth.uid();chosen public.workspace_selections;member_version uuid;has_selection boolean;
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'WORKSPACE_AUTH' USING ERRCODE='42501';END IF;
 IF current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION 'WORKSPACE_ISOLATION' USING ERRCODE='25000';END IF;
 IF p_tenant_id IS NULL OR p_membership_version IS NULL OR p_command_id IS NULL THEN RAISE EXCEPTION 'WORKSPACE_INPUT' USING ERRCODE='22023';END IF;
 -- Serialize with membership edits before computing current membership or preference.
 PERFORM 1 FROM public.profiles WHERE id=actor FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'WORKSPACE_AUTH' USING ERRCODE='42501';END IF;
 SELECT version INTO member_version FROM public.tenant_memberships WHERE user_id=actor AND tenant_id=p_tenant_id;
 IF NOT FOUND OR member_version IS DISTINCT FROM p_membership_version THEN RAISE EXCEPTION 'WORKSPACE_MEMBERSHIP_CHANGED' USING ERRCODE='40001';END IF;
 SELECT * INTO chosen FROM public.workspace_selections WHERE user_id=actor;has_selection:=FOUND;
 IF has_selection AND chosen.command_id=p_command_id THEN
  IF chosen.tenant_id<>p_tenant_id THEN RAISE EXCEPTION 'WORKSPACE_COMMAND_REUSED' USING ERRCODE='40001';END IF;
 ELSE
  IF chosen.version IS DISTINCT FROM p_expected_version THEN RAISE EXCEPTION 'WORKSPACE_SELECTION_CHANGED' USING ERRCODE='40001';END IF;
  -- A fresh command for the current company is a no-op after both CAS checks.
  -- Keep the generation so other tabs do not lose unchanged forms.
  IF NOT has_selection OR chosen.tenant_id IS DISTINCT FROM p_tenant_id THEN
  INSERT INTO public.workspace_selections(user_id,tenant_id,command_id) VALUES(actor,p_tenant_id,p_command_id)
  ON CONFLICT(user_id) DO UPDATE SET tenant_id=excluded.tenant_id,command_id=excluded.command_id,version=gen_random_uuid(),changed_at=now()
  RETURNING * INTO chosen;
  END IF;
 END IF;
 RETURN jsonb_build_object('userId',actor,'tenantId',p_tenant_id,'selectionVersion',chosen.version,'membershipVersion',member_version);
END $$;

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=(event->>'user_id')::uuid;claims jsonb:=event->'claims';chosen public.workspace_selections;tenant uuid;member_version uuid;metadata jsonb;
BEGIN
 SELECT * INTO chosen FROM public.workspace_selections WHERE user_id=actor;
 IF FOUND THEN
  SELECT tenant_id,version INTO tenant,member_version FROM public.tenant_memberships WHERE user_id=actor AND tenant_id=chosen.tenant_id;
 ELSIF (SELECT count(*) FROM public.tenant_memberships WHERE user_id=actor)=1 THEN
  SELECT tenant_id,version INTO tenant,member_version FROM public.tenant_memberships WHERE user_id=actor;
 END IF;
 -- Always strip old workspace claims, including nested metadata. No stale fallback.
 claims:=claims-'active_tenant_id'-'workspace_selection_version'-'workspace_membership_version';
 metadata:=CASE WHEN jsonb_typeof(claims->'app_metadata')='object' THEN claims->'app_metadata' ELSE '{}'::jsonb END;
 metadata:=metadata-'active_tenant';
 IF tenant IS NOT NULL THEN
  claims:=claims||jsonb_build_object('active_tenant_id',tenant,'workspace_membership_version',member_version);
  metadata:=metadata||jsonb_build_object('active_tenant',tenant);
  IF chosen.version IS NOT NULL THEN claims:=claims||jsonb_build_object('workspace_selection_version',chosen.version);END IF;
 END IF;
 claims:=jsonb_set(claims,'{app_metadata}',metadata);
 RETURN jsonb_set(event,'{claims}',claims);
END $$;
REVOKE ALL ON FUNCTION public.my_workspace_choices(),public.select_workspace(uuid,uuid,uuid,uuid),public.custom_access_token_hook(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.my_workspace_choices(),public.select_workspace(uuid,uuid,uuid,uuid) TO authenticated;
-- Auth invokes this hook as supabase_auth_admin; EXECUTE alone is insufficient.
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) TO supabase_auth_admin;


-- 04_admin_directory.sql
-- LOCAL CANDIDATE. Deploy with membership roles and the new admin UI.

SET LOCAL lock_timeout='5s';
CREATE FUNCTION public.admin_workspace_users(p_offset integer DEFAULT 0,p_query text DEFAULT '') RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE total integer;rows jsonb;q text:=btrim(coalesce(p_query,''));
BEGIN
 IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'not authorized' USING ERRCODE='42501';END IF;
 IF p_offset IS NULL OR p_offset<0 OR p_offset>1000000 OR length(q)>160 THEN RAISE EXCEPTION 'ADMIN_INPUT' USING ERRCODE='22023';END IF;
 SELECT count(*) INTO total FROM public.profiles p JOIN auth.users u ON u.id=p.id
 WHERE q='' OR strpos(lower(coalesce(p.display_name,'')),lower(q))>0 OR strpos(lower(coalesce(u.email,'')),lower(q))>0;
 SELECT coalesce(jsonb_agg(x ORDER BY x.name,x.id),'[]'::jsonb) INTO rows FROM (
 SELECT p.id,coalesce(p.display_name,'') AS name,coalesce(u.email,'') AS email,(p.is_platform_admin IS TRUE) AS "platformAdmin",
 (SELECT count(*) FROM public.tenant_memberships m WHERE m.user_id=p.id) AS "membershipCount"
 FROM public.profiles p JOIN auth.users u ON u.id=p.id
 WHERE q='' OR strpos(lower(coalesce(p.display_name,'')),lower(q))>0 OR strpos(lower(coalesce(u.email,'')),lower(q))>0
 ORDER BY coalesce(p.display_name,''),p.id LIMIT 50 OFFSET p_offset) x;
 RETURN jsonb_build_object('offset',p_offset,'query',q,'total',total,'users',rows);
END $$;
REVOKE ALL ON FUNCTION public.admin_workspace_users(integer,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_workspace_users(integer,text) TO authenticated;


-- 05_operation_roles.sql
-- LOCAL CANDIDATE. Change only verified role expressions; preserve latest function bodies and grants.
-- Abort the whole transaction if a signature or expected expression changed.

SET LOCAL lock_timeout='5s';
DO $patch$
DECLARE patch record;definition text;function_id regprocedure;
BEGIN
 FOR patch IN SELECT * FROM (VALUES
('public.task_transfer_directory(uuid,uuid)',$old$WHERE p.role IN ('yonetici','operasyon','ik') AND EXISTS(SELECT 1 FROM public.tenant_memberships m WHERE m.user_id=p.id AND m.tenant_id=v_tenant)$old$,$new$WHERE EXISTS(SELECT 1 FROM public.tenant_memberships m WHERE m.user_id=p.id AND m.tenant_id=v_tenant AND m.role IN ('yonetici','operasyon','ik'))$new$,1),
('public.transfer_tasks_scoped(uuid,uuid,uuid,uuid,uuid,jsonb)',$old$SELECT p.display_name,p.role INTO v_name,v_target_role FROM public.profiles p WHERE p.id=p_target_id
    AND EXISTS(SELECT 1 FROM public.tenant_memberships m WHERE m.user_id=p.id AND m.tenant_id=v_tenant);$old$,$new$SELECT p.display_name,m.role INTO v_name,v_target_role FROM public.profiles p JOIN public.tenant_memberships m ON m.user_id=p.id AND m.tenant_id=v_tenant WHERE p.id=p_target_id;$new$,1),
('public.create_contract_renewal_task(uuid,uuid,uuid,uuid,bigint,uuid,date,text)',$old$AND p.role IN ('yonetici','operasyon','ik')
    AND EXISTS(SELECT 1 FROM public.tenant_memberships m WHERE m.user_id=p.id AND m.tenant_id=p_tenant_id)$old$,$new$AND EXISTS(SELECT 1 FROM public.tenant_memberships m WHERE m.user_id=p.id AND m.tenant_id=p_tenant_id AND m.role IN ('yonetici','operasyon','ik'))$new$,1),
('public.ops_start_execute(uuid,uuid,uuid,uuid,integer,text,jsonb)',$old$pr.role IN ('yonetici','operasyon')$old$,$new$m.role IN ('yonetici','operasyon')$new$,1),
('public.ops_start_board(uuid,uuid,date,integer)',$old$pr.role IN ('yonetici','operasyon')$old$,$new$m.role IN ('yonetici','operasyon')$new$,2),
('public.ops_start_board_filtered(uuid,uuid,date,integer,text,boolean,boolean)',$old$pr.role IN ('yonetici','operasyon')$old$,$new$m.role IN ('yonetici','operasyon')$new$,2),
('public.ops_comment_send(uuid,uuid,uuid,uuid,text,uuid,uuid[])',$old$p.role IN ('yonetici','operasyon')$old$,$new$t.role IN ('yonetici','operasyon')$new$,2),
('public.ops_comment_people(uuid,uuid,uuid)',$old$p.role IN ('yonetici','operasyon')$old$,$new$t.role IN ('yonetici','operasyon')$new$,1)
 ) AS changes(signature,old_expression,new_expression,expected_count) LOOP
  function_id:=to_regprocedure(patch.signature);
  IF function_id IS NULL THEN RAISE EXCEPTION 'Missing required function: %',patch.signature;END IF;
  definition:=pg_get_functiondef(function_id);
  IF (length(definition)-length(replace(definition,patch.old_expression,'')))/length(patch.old_expression)<>patch.expected_count THEN
   RAISE EXCEPTION 'Role expression changed: %',patch.signature;
  END IF;
  EXECUTE replace(definition,patch.old_expression,patch.new_expression);
 END LOOP;
END $patch$;


-- 06_document_storage_scope.sql
-- Candidate only: baseline permissive document policies must never widen tenant access.

SET LOCAL lock_timeout='5s';
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM storage.buckets WHERE id='documents' AND NOT public)
 THEN RAISE EXCEPTION 'Private documents bucket required';END IF;
END $$;
CREATE FUNCTION public.document_object_in_workspace(p_name text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT p_name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[^/]+$'
 AND EXISTS(SELECT 1 FROM public.companies c
 WHERE c.id::text=lower(split_part(p_name,'/',1)) AND c.tenant_id=public.current_user_verified_tenant())
$$;
REVOKE ALL ON FUNCTION public.document_object_in_workspace(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.document_object_in_workspace(text) TO authenticated;
CREATE POLICY documents_workspace_fence ON storage.objects AS RESTRICTIVE FOR ALL TO authenticated
USING(bucket_id<>'documents' OR public.document_object_in_workspace(name))
WITH CHECK(bucket_id<>'documents' OR public.document_object_in_workspace(name));
CREATE POLICY documents_no_anonymous ON storage.objects AS RESTRICTIVE FOR ALL TO anon
USING(bucket_id<>'documents') WITH CHECK(bucket_id<>'documents');

COMMIT;
