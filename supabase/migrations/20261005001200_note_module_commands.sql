-- Expand: company-bound note commands. Preserve the existing role matrix.
BEGIN;
SET LOCAL lock_timeout='15s';
CREATE FUNCTION public.note_execute_v1(p_action text,p_note_id uuid,p_company_id uuid,p_tenant_id uuid,p_actor_id uuid,p_input jsonb)
RETURNS SETOF public.notes LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='5s' AS $$
DECLARE actor uuid:=auth.uid(); role text; author text; row public.notes; body text;
 trim_chars CONSTANT text:=U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF';
BEGIN
 IF actor IS NULL OR p_actor_id IS DISTINCT FROM actor OR p_tenant_id IS NULL OR p_company_id IS NULL
  OR p_tenant_id IS DISTINCT FROM public.current_user_verified_tenant() THEN RAISE EXCEPTION 'NOTE_SCOPE' USING ERRCODE='42501';END IF;
 IF p_action IS NULL OR p_action NOT IN('create','edit','pin','delete') OR jsonb_typeof(p_input) IS DISTINCT FROM 'object'
  OR octet_length(p_input::text)>65536 OR (p_action='create') IS DISTINCT FROM (p_note_id IS NULL) THEN RAISE EXCEPTION 'NOTE_INPUT' USING ERRCODE='BN400';END IF;
 IF p_action IN('create','edit') THEN
  IF (p_input-ARRAY['content','tag'])<>'{}' OR jsonb_typeof(p_input->'content') IS DISTINCT FROM 'string'
   OR (p_input ? 'tag' AND jsonb_typeof(p_input->'tag') NOT IN('null','string'))
   OR (p_input->>'tag' IS NOT NULL AND p_input->>'tag' NOT IN('genel','odeme','sozlesme','operasyon','evrak','gorusme')) THEN
   RAISE EXCEPTION 'NOTE_INPUT' USING ERRCODE='BN400';END IF;
  body:=btrim(p_input->>'content',trim_chars);
  IF length(body) NOT BETWEEN 1 AND 10000 THEN RAISE EXCEPTION 'NOTE_INPUT' USING ERRCODE='BN400';END IF;
 ELSIF p_action='pin' THEN
  IF (p_input-ARRAY['is_pinned'])<>'{}' OR jsonb_typeof(p_input->'is_pinned') IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'NOTE_INPUT' USING ERRCODE='BN400';END IF;
 ELSE
  IF p_input<>'{}' THEN RAISE EXCEPTION 'NOTE_INPUT' USING ERRCODE='BN400';END IF;
 END IF;
 PERFORM public.workspace_require_module_write_v1(p_tenant_id,ARRAY['customers']);
 SELECT display_name INTO author FROM public.profiles WHERE id=actor FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'NOTE_SCOPE' USING ERRCODE='42501';END IF;
 PERFORM public.workspace_require_module_write_v1(p_tenant_id,ARRAY['customers']);
 role:=public.current_user_role();
 IF role IS NULL OR role NOT IN('yonetici','operasyon','ik') OR (p_action IN('pin','delete') AND role<>'yonetici') THEN RAISE EXCEPTION 'NOTE_ROLE' USING ERRCODE='42501';END IF;
 -- Passive companies retain institutional notes, matching the existing product behavior.
 PERFORM 1 FROM public.companies WHERE id=p_company_id AND tenant_id=p_tenant_id FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'NOTE_SCOPE' USING ERRCODE='42501';END IF;
 IF p_action='create' THEN
  IF author IS NULL OR btrim(author,trim_chars)='' THEN RAISE EXCEPTION 'NOTE_AUTHOR_MISSING' USING ERRCODE='42501';END IF;
  INSERT INTO public.notes(tenant_id,company_id,author_id,author_name,content,tag,is_pinned)
   VALUES(p_tenant_id,p_company_id,actor,author,body,p_input->>'tag',false) RETURNING * INTO row;
 ELSE
  SELECT * INTO row FROM public.notes WHERE id=p_note_id AND company_id=p_company_id AND tenant_id=p_tenant_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOTE_SCOPE' USING ERRCODE='42501';END IF;
  IF p_action='edit' THEN
   IF role<>'yonetici' AND row.author_id IS DISTINCT FROM actor THEN RAISE EXCEPTION 'NOTE_OWNERSHIP' USING ERRCODE='42501';END IF;
   UPDATE public.notes SET content=body,tag=p_input->>'tag' WHERE id=row.id RETURNING * INTO row;
  ELSIF p_action='pin' THEN
   IF row.is_pinned IS DISTINCT FROM (p_input->>'is_pinned')::boolean THEN
    UPDATE public.notes SET is_pinned=(p_input->>'is_pinned')::boolean WHERE id=row.id RETURNING * INTO row;
   END IF;
  ELSE
   DELETE FROM public.notes WHERE id=row.id RETURNING * INTO row;
  END IF;
 END IF;
 RETURN NEXT row;
END $$;
REVOKE ALL ON FUNCTION public.note_execute_v1(text,uuid,uuid,uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.note_execute_v1(text,uuid,uuid,uuid,uuid,jsonb) TO authenticated;
DO $$ BEGIN
 IF has_function_privilege('anon','public.note_execute_v1(text,uuid,uuid,uuid,uuid,jsonb)','EXECUTE')
  OR has_function_privilege('service_role','public.note_execute_v1(text,uuid,uuid,uuid,uuid,jsonb)','EXECUTE') THEN RAISE EXCEPTION 'NOTE_COMMAND_PRIVILEGE_DRIFT';END IF;
END $$;
NOTIFY pgrst,'reload schema';
COMMIT;
