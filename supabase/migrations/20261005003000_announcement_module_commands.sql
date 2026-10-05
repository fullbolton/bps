-- EXPAND: deploy the RPC adapter before applying the separate direct-write cutover.
BEGIN;
SET LOCAL lock_timeout='15s';
LOCK TABLE public.announcements IN ACCESS EXCLUSIVE MODE;
CREATE POLICY announcements_module_read ON public.announcements AS RESTRICTIVE FOR SELECT TO authenticated
 USING(tenant_id=public.current_user_verified_tenant() AND (SELECT public.workspace_module_enabled_v1('announcements')));
CREATE FUNCTION public.announcement_execute_v1(p_action text,p_id uuid,p_tenant uuid,p_body text)
RETURNS SETOF public.announcements LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='5s' AS $$
DECLARE actor uuid:=auth.uid(); tenant uuid:=public.current_user_verified_tenant(); result public.announcements; body text;
 trim_chars CONSTANT text:=U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF';
BEGIN
 IF actor IS NULL OR tenant IS NULL OR (p_tenant IS NOT NULL AND p_tenant IS DISTINCT FROM tenant) THEN
  RAISE EXCEPTION 'ANNOUNCEMENT_SCOPE' USING ERRCODE='42501';END IF;
 IF p_action IS NULL OR p_action NOT IN('create','delete')
  OR (p_action='create' AND (p_id IS NOT NULL OR p_tenant IS NULL))
  OR (p_action='delete' AND (p_id IS NULL OR p_body IS NOT NULL)) THEN
  RAISE EXCEPTION 'ANNOUNCEMENT_INPUT' USING ERRCODE='22023';END IF;
 body:=btrim(p_body,trim_chars);
 IF p_action='create' AND (body IS NULL OR length(body) NOT BETWEEN 1 AND 500) THEN
  RAISE EXCEPTION 'ANNOUNCEMENT_INPUT' USING ERRCODE='22023';END IF;
 -- Config precedes profile and business locks. Recheck scope/role after waiting.
 PERFORM public.workspace_require_module_write_v1(tenant,ARRAY['announcements']);
 PERFORM 1 FROM public.profiles WHERE id=actor FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'ANNOUNCEMENT_SCOPE' USING ERRCODE='42501';END IF;
 PERFORM public.workspace_require_module_write_v1(tenant,ARRAY['announcements']);
 IF public.current_user_role() IS DISTINCT FROM 'yonetici' THEN
  RAISE EXCEPTION 'ANNOUNCEMENT_ROLE' USING ERRCODE='42501';END IF;
 IF p_action='create' THEN
  INSERT INTO public.announcements(tenant_id,body,created_by) VALUES(tenant,body,actor) RETURNING * INTO result;
 ELSE
  DELETE FROM public.announcements WHERE id=p_id AND tenant_id=tenant RETURNING * INTO result;
  IF NOT FOUND THEN RAISE EXCEPTION 'ANNOUNCEMENT_NOT_FOUND' USING ERRCODE='42501';END IF;
 END IF;
 RETURN NEXT result;
END $$;
REVOKE ALL ON FUNCTION public.announcement_execute_v1(text,uuid,uuid,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.announcement_execute_v1(text,uuid,uuid,text) TO authenticated;
DO $$ BEGIN
 IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.announcements'::regclass)
  OR has_function_privilege('anon','public.announcement_execute_v1(text,uuid,uuid,text)','EXECUTE')
  OR has_function_privilege('service_role','public.announcement_execute_v1(text,uuid,uuid,text)','EXECUTE') THEN
  RAISE EXCEPTION 'ANNOUNCEMENT_SECURITY_DRIFT';END IF;
END $$;
NOTIFY pgrst,'reload schema';
COMMIT;
