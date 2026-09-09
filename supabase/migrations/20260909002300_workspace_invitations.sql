-- Existing verified accounts only. Does not provision Auth users or send email.
BEGIN;
SET LOCAL lock_timeout='15s';
CREATE TABLE public.workspace_invitations(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES public.tenants(id),created_by uuid NOT NULL REFERENCES public.profiles(id),
 email text NOT NULL CHECK(length(email) BETWEEN 3 AND 254 AND email=lower(btrim(email))),
 role text NOT NULL CHECK(role IN ('operasyon','ik','muhasebe','goruntuleyici')),
 token_hash text NOT NULL UNIQUE CHECK(token_hash ~ '^[0-9a-f]{64}$'),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),expires_at timestamptz NOT NULL DEFAULT clock_timestamp()+interval '7 days',
 cancelled_at timestamptz,accepted_at timestamptz,accepted_by uuid REFERENCES public.profiles(id),
 CHECK((accepted_at IS NULL)=(accepted_by IS NULL)),CHECK(cancelled_at IS NULL OR accepted_at IS NULL)
);
ALTER TABLE public.workspace_invitations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.workspace_invitations FROM PUBLIC,anon,authenticated;
CREATE INDEX workspace_invitations_tenant_idx ON public.workspace_invitations(tenant_id,created_at DESC,id);
CREATE FUNCTION public.manage_workspace_invitation(p_actor_id uuid,p_tenant_id uuid,p_id uuid,p_action text,p_email text DEFAULT NULL,p_role text DEFAULT NULL,p_token text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='5s' AS $$
DECLARE v public.workspace_invitations%ROWTYPE;v_email text:=lower(btrim(p_email));
BEGIN
 IF current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION 'INVITE_ISOLATION'; END IF;
 IF auth.uid() IS NULL OR p_actor_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'INVITE_SCOPE'; END IF;
 PERFORM id FROM public.profiles WHERE id=p_actor_id FOR UPDATE;
 IF p_tenant_id IS NULL OR p_tenant_id IS DISTINCT FROM public.current_user_verified_tenant() OR public.current_user_role() IS DISTINCT FROM 'yonetici' THEN RAISE EXCEPTION 'INVITE_SCOPE'; END IF;
 IF p_id IS NULL OR p_action IS NULL OR p_action NOT IN ('create','cancel') THEN RAISE EXCEPTION 'INVITE_INPUT'; END IF;
 IF p_action='create' THEN
  IF v_email IS NULL OR length(v_email) NOT BETWEEN 3 AND 254 OR v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' OR p_role IS NULL OR p_role NOT IN ('operasyon','ik','muhasebe','goruntuleyici') OR p_token IS NULL OR p_token !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'INVITE_INPUT'; END IF;
  INSERT INTO public.workspace_invitations(id,tenant_id,created_by,email,role,token_hash)
  VALUES(p_id,p_tenant_id,p_actor_id,v_email,p_role,encode(sha256(convert_to(p_token,'UTF8')),'hex')) ON CONFLICT(id) DO NOTHING;
 END IF;
 SELECT * INTO v FROM public.workspace_invitations WHERE id=p_id AND tenant_id=p_tenant_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'INVITE_NOT_FOUND'; END IF;
 IF p_action='create' AND (v.created_by<>p_actor_id OR v.email<>v_email OR v.role<>p_role OR v.token_hash<>encode(sha256(convert_to(p_token,'UTF8')),'hex')) THEN RAISE EXCEPTION 'INVITE_COMMAND'; END IF;
 IF p_action='cancel' THEN
  IF v.accepted_at IS NOT NULL THEN RAISE EXCEPTION 'INVITE_ACCEPTED'; END IF;
  UPDATE public.workspace_invitations SET cancelled_at=coalesce(cancelled_at,clock_timestamp()) WHERE id=v.id RETURNING * INTO v;
 END IF;
 RETURN jsonb_build_object('id',v.id,'email',v.email,'role',v.role,'expiresAt',v.expires_at,'state',CASE WHEN v.accepted_at IS NOT NULL THEN 'accepted' WHEN v.cancelled_at IS NOT NULL THEN 'cancelled' WHEN v.expires_at<=clock_timestamp() THEN 'expired' ELSE 'pending' END);
END $$;
CREATE FUNCTION public.list_workspace_invitations(p_actor_id uuid,p_tenant_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v jsonb;
BEGIN
 IF auth.uid() IS NULL OR p_actor_id IS DISTINCT FROM auth.uid() OR p_tenant_id IS NULL OR p_tenant_id IS DISTINCT FROM public.current_user_verified_tenant() OR public.current_user_role() IS DISTINCT FROM 'yonetici' THEN RAISE EXCEPTION 'INVITE_SCOPE'; END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'email',email,'role',role,'expiresAt',expires_at,'state',CASE WHEN accepted_at IS NOT NULL THEN 'accepted' WHEN cancelled_at IS NOT NULL THEN 'cancelled' WHEN expires_at<=statement_timestamp() THEN 'expired' ELSE 'pending' END) ORDER BY created_at DESC,id DESC),'[]'::jsonb) INTO v FROM (SELECT * FROM public.workspace_invitations WHERE tenant_id=p_tenant_id ORDER BY created_at DESC,id DESC LIMIT 50) recent;
 RETURN v;
END $$;
CREATE FUNCTION public.accept_workspace_invitation(p_actor_id uuid,p_id uuid,p_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='5s' AS $$
DECLARE v public.workspace_invitations%ROWTYPE;v_email text;v_role text;
BEGIN
 IF current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION 'INVITE_ISOLATION'; END IF;
 IF auth.uid() IS NULL OR p_actor_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'INVITE_SCOPE'; END IF;
 IF p_token IS NULL OR p_token !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'INVITE_INVALID'; END IF;
 SELECT * INTO v FROM public.workspace_invitations WHERE id=p_id AND token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex');
 IF NOT FOUND THEN RAISE EXCEPTION 'INVITE_INVALID'; END IF;
 -- Lock profiles in one order before invitation. All membership decisions follow locks.
 PERFORM id FROM public.profiles WHERE id IN (p_actor_id,v.created_by) ORDER BY id FOR UPDATE;
 SELECT * INTO v FROM public.workspace_invitations WHERE id=p_id FOR UPDATE;
 SELECT lower(email) INTO v_email FROM auth.users WHERE id=p_actor_id AND email_confirmed_at IS NOT NULL AND (banned_until IS NULL OR banned_until<=clock_timestamp());
 IF v_email IS NULL OR v_email<>v.email THEN RAISE EXCEPTION 'INVITE_IDENTITY'; END IF;
 IF v.accepted_at IS NOT NULL THEN
  IF v.accepted_by<>p_actor_id THEN RAISE EXCEPTION 'INVITE_INVALID'; END IF;
  RETURN jsonb_build_object('tenantId',v.tenant_id,'accepted',true);
 END IF;
 IF v.cancelled_at IS NOT NULL OR v.expires_at<=clock_timestamp() THEN RAISE EXCEPTION 'INVITE_INVALID'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.profiles p JOIN public.tenant_memberships m ON m.user_id=p.id WHERE p.id=v.created_by AND p.role='yonetici' AND m.tenant_id=v.tenant_id) THEN RAISE EXCEPTION 'INVITE_REVOKED'; END IF;
 IF EXISTS(SELECT 1 FROM public.tenant_memberships WHERE user_id=p_actor_id) THEN RAISE EXCEPTION 'INVITE_EXISTING_MEMBER'; END IF;
 -- A zero-member account may still carry an old tenant claim. Never promote that session.
 IF public.current_user_active_tenant() IS NOT NULL THEN RAISE EXCEPTION 'INVITE_STALE_SESSION'; END IF;
 SELECT role INTO v_role FROM public.profiles WHERE id=p_actor_id AND NOT is_platform_admin;
 IF v_role IS DISTINCT FROM 'goruntuleyici' THEN RAISE EXCEPTION 'INVITE_ACCOUNT_REVIEW'; END IF;
 UPDATE public.profiles SET role=v.role WHERE id=p_actor_id;
 INSERT INTO public.tenant_memberships(user_id,tenant_id) VALUES(p_actor_id,v.tenant_id);
 -- Same session invalidation boundary as admin membership assignment; new login gets the hook claim.
 DELETE FROM auth.sessions WHERE user_id=p_actor_id;
 UPDATE public.workspace_invitations SET accepted_at=clock_timestamp(),accepted_by=p_actor_id WHERE id=v.id;
 RETURN jsonb_build_object('tenantId',v.tenant_id,'accepted',true);
END $$;
REVOKE ALL ON FUNCTION public.manage_workspace_invitation(uuid,uuid,uuid,text,text,text,text),public.list_workspace_invitations(uuid,uuid),public.accept_workspace_invitation(uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.manage_workspace_invitation(uuid,uuid,uuid,text,text,text,text),public.list_workspace_invitations(uuid,uuid),public.accept_workspace_invitation(uuid,uuid,text) TO authenticated;
COMMIT;
