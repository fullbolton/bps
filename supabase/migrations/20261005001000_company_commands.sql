-- M2h expand: application company creation/status commands.
-- Direct DML cutover is separate: write_company_contact still needs invoker UPDATE for FOR UPDATE.
BEGIN;
SET LOCAL lock_timeout='15s';
CREATE FUNCTION public.company_execute_v1(p_action text,p_company_id uuid,p_tenant_id uuid,p_actor_id uuid,p_input jsonb)
RETURNS SETOF public.companies LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='5s' AS $$
DECLARE actor uuid:=auth.uid(); values_row public.companies; result_row public.companies;
 trim_chars CONSTANT text:=U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF';
BEGIN
 IF actor IS NULL OR p_actor_id IS DISTINCT FROM actor OR p_tenant_id IS NULL
  OR p_tenant_id IS DISTINCT FROM public.current_user_verified_tenant() THEN
  RAISE EXCEPTION 'COMPANY_SCOPE' USING ERRCODE='42501';
 END IF;
 IF p_action IS NULL OR p_action NOT IN('create','status') OR jsonb_typeof(p_input) IS DISTINCT FROM 'object'
  OR octet_length(p_input::text)>16384 THEN RAISE EXCEPTION 'COMPANY_INPUT' USING ERRCODE='BC400';END IF;
 IF EXISTS(SELECT FROM jsonb_each(p_input) WHERE jsonb_typeof(value) NOT IN('string','null')) THEN
  RAISE EXCEPTION 'COMPANY_INPUT' USING ERRCODE='BC400';END IF;
 IF p_action='create' THEN
  IF p_company_id IS NOT NULL OR (p_input-ARRAY['name','sector','city','status','risk'])<>'{}'
   OR length(btrim(coalesce(p_input->>'name',''),trim_chars)) NOT BETWEEN 1 AND 500
   OR length(coalesce(p_input->>'sector',''))>200 OR length(coalesce(p_input->>'city',''))>200
   OR coalesce(p_input->>'status','aday') NOT IN('aday','aktif','pasif')
   OR coalesce(p_input->>'risk','dusuk') NOT IN('dusuk','orta','yuksek') THEN
   RAISE EXCEPTION 'COMPANY_INPUT' USING ERRCODE='BC400';END IF;
 ELSE
  IF p_company_id IS NULL OR (p_input-ARRAY['status'])<>'{}'
   OR p_input->>'status' IS NULL OR p_input->>'status' NOT IN('aktif','pasif') THEN
   RAISE EXCEPTION 'COMPANY_INPUT' USING ERRCODE='BC400';END IF;
 END IF;
 PERFORM public.workspace_require_module_write_v1(p_tenant_id,ARRAY['customers']);
 -- Same order as the task gateway: config, profile, business row.
 PERFORM 1 FROM public.profiles WHERE id=actor FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'COMPANY_SCOPE' USING ERRCODE='42501';END IF;
 PERFORM public.workspace_require_module_write_v1(p_tenant_id,ARRAY['customers']);
 IF public.current_user_role() IS DISTINCT FROM 'yonetici' THEN RAISE EXCEPTION 'COMPANY_ROLE' USING ERRCODE='42501';END IF;
 IF p_action='create' THEN
  SELECT * INTO values_row FROM jsonb_populate_record(NULL::public.companies,jsonb_build_object(
   'name',btrim(p_input->>'name',trim_chars),'sector',nullif(btrim(p_input->>'sector',trim_chars),''),'city',nullif(btrim(p_input->>'city',trim_chars),''),
   'status',coalesce(p_input->>'status','aday'),'risk',coalesce(p_input->>'risk','dusuk')));
  INSERT INTO public.companies(tenant_id,name,sector,city,status,risk,created_by)
   VALUES(p_tenant_id,values_row.name,values_row.sector,values_row.city,values_row.status,values_row.risk,actor)
   RETURNING * INTO result_row;
 ELSE
  SELECT * INTO result_row FROM public.companies WHERE id=p_company_id AND tenant_id=p_tenant_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'COMPANY_SCOPE' USING ERRCODE='42501';END IF;
  SELECT * INTO values_row FROM jsonb_populate_record(NULL::public.companies,p_input);
  -- Repeating the same desired status does not fire update triggers again.
  IF result_row.status IS DISTINCT FROM values_row.status THEN
   UPDATE public.companies SET status=values_row.status WHERE id=p_company_id AND tenant_id=p_tenant_id RETURNING * INTO result_row;
  END IF;
 END IF;
 RETURN NEXT result_row;
END $$;
REVOKE ALL ON FUNCTION public.company_execute_v1(text,uuid,uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.company_execute_v1(text,uuid,uuid,uuid,jsonb) TO authenticated;
DO $$ BEGIN
 IF NOT has_function_privilege('authenticated','public.company_execute_v1(text,uuid,uuid,uuid,jsonb)','EXECUTE')
  OR has_function_privilege('anon','public.company_execute_v1(text,uuid,uuid,uuid,jsonb)','EXECUTE')
  OR has_function_privilege('service_role','public.company_execute_v1(text,uuid,uuid,uuid,jsonb)','EXECUTE') THEN
  RAISE EXCEPTION 'COMPANY_COMMAND_PRIVILEGE_DRIFT';
 END IF;
END $$;
NOTIFY pgrst,'reload schema';
COMMIT;
