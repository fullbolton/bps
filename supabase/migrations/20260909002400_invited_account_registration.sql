-- Safe profile defaults and invitation-backed first login. Auth signup/SMTP settings unchanged.
BEGIN;
SET LOCAL lock_timeout='15s';
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 INSERT INTO public.profiles(id,email,display_name,role,unit,is_platform_admin)
 VALUES(NEW.id,coalesce(NEW.email,''),left(coalesce(nullif(btrim(NEW.raw_user_meta_data->>'display_name'),''),nullif(split_part(NEW.email,'@',1),''),'Kullanıcı'),160),'goruntuleyici',NULL,false)
 ON CONFLICT(id) DO NOTHING;
 RETURN NEW;
END $$;
COMMENT ON FUNCTION public.handle_new_user() IS 'New Auth accounts always start as non-admin viewers without membership; user metadata never supplies authorization.';
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.invitation_registration_allowed(p_id uuid,p_token text,p_email text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce(p_token ~ '^[0-9a-f]{64}$' AND EXISTS(
 SELECT 1 FROM public.workspace_invitations i JOIN public.profiles p ON p.id=i.created_by
 JOIN public.tenant_memberships m ON m.user_id=p.id AND m.tenant_id=i.tenant_id
 WHERE i.id=p_id AND i.email=lower(btrim(p_email))
 AND i.token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex')
 AND i.accepted_at IS NULL AND i.cancelled_at IS NULL AND i.expires_at>statement_timestamp() AND p.role='yonetici'),false)
$$;
-- Also repairs a missing profile on legacy/imported Auth accounts; never changes an existing role.
CREATE FUNCTION public.prepare_invited_profile(p_id uuid,p_token text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u auth.users%ROWTYPE;
BEGIN
 SELECT * INTO u FROM auth.users WHERE id=auth.uid() AND email_confirmed_at IS NOT NULL AND (banned_until IS NULL OR banned_until<=clock_timestamp());
 IF NOT FOUND THEN RAISE EXCEPTION 'INVITE_IDENTITY'; END IF;
 IF NOT public.invitation_registration_allowed(p_id,p_token,u.email) THEN
  -- A lost accept response can be replayed even after registration eligibility ends.
  IF EXISTS(SELECT 1 FROM public.workspace_invitations WHERE id=p_id AND accepted_by=auth.uid() AND token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex')) THEN RETURN; END IF;
  RAISE EXCEPTION 'INVITE_INVALID';
 END IF;
 INSERT INTO public.profiles(id,email,display_name,role,unit,is_platform_admin)
 VALUES(u.id,u.email,left(coalesce(nullif(split_part(u.email,'@',1),''),'Kullanıcı'),160),'goruntuleyici',NULL,false)
 ON CONFLICT(id) DO NOTHING;
END $$;
REVOKE ALL ON FUNCTION public.invitation_registration_allowed(uuid,text,text),public.prepare_invited_profile(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.invitation_registration_allowed(uuid,text,text) TO anon,authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_invited_profile(uuid,text) TO authenticated;
COMMIT;
