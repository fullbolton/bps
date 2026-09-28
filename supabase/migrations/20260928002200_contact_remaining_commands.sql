-- Expand before the new frontend. Preserve partial-field updates under the row lock.
BEGIN;
SET LOCAL lock_timeout='15s';
CREATE FUNCTION public.contact_execute_v1(p_action text,p_contact_id uuid,p_company_id uuid,p_tenant_id uuid,p_actor_id uuid,p_input jsonb)
RETURNS SETOF public.contacts LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='5s' AS $$
DECLARE actor uuid:=auth.uid(); role text; row public.contacts; v_phone text; v_email text;
BEGIN
 IF actor IS NULL OR p_actor_id IS DISTINCT FROM actor OR p_tenant_id IS NULL OR p_company_id IS NULL
  OR p_tenant_id IS DISTINCT FROM public.current_user_verified_tenant() THEN RAISE EXCEPTION 'CONTACT_SCOPE' USING ERRCODE='42501'; END IF;
 IF p_action IS NULL OR p_action NOT IN ('communication','delete','import') OR jsonb_typeof(p_input) IS DISTINCT FROM 'object'
  OR octet_length(p_input::text)>65536 OR (p_action='import') IS DISTINCT FROM (p_contact_id IS NULL) THEN RAISE EXCEPTION 'CONTACT_INPUT' USING ERRCODE='BC400'; END IF;
 IF p_action='communication' THEN
  IF p_input='{}' OR p_input-ARRAY['phone','email']<>'{}'
   OR EXISTS(SELECT 1 FROM jsonb_each(p_input) e WHERE jsonb_typeof(e.value) NOT IN ('string','null')) THEN RAISE EXCEPTION 'CONTACT_INPUT' USING ERRCODE='BC400'; END IF;
 ELSIF p_action='delete' THEN
  IF p_input<>'{}' THEN RAISE EXCEPTION 'CONTACT_INPUT' USING ERRCODE='BC400'; END IF;
 ELSE
  IF p_input-ARRAY['full_name','title','phone','email','is_primary','context_note']<>'{}'
   OR jsonb_typeof(p_input->'full_name') IS DISTINCT FROM 'string'
   OR jsonb_typeof(p_input->'is_primary') IS DISTINCT FROM 'boolean'
   OR EXISTS(SELECT 1 FROM jsonb_each(p_input-ARRAY['full_name','is_primary']) e WHERE jsonb_typeof(e.value) NOT IN ('string','null')) THEN RAISE EXCEPTION 'CONTACT_INPUT' USING ERRCODE='BC400'; END IF;
 END IF;
 PERFORM public.workspace_require_module_write_v1(p_tenant_id,ARRAY['customers']);
 PERFORM 1 FROM public.profiles WHERE id=actor FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'CONTACT_SCOPE' USING ERRCODE='42501'; END IF;
 PERFORM public.workspace_require_module_write_v1(p_tenant_id,ARRAY['customers']);
 role:=public.current_user_role();
 IF role IS NULL OR role NOT IN ('yonetici','operasyon') OR (p_action<>'communication' AND role<>'yonetici') THEN RAISE EXCEPTION 'CONTACT_ROLE' USING ERRCODE='42501'; END IF;
 -- Same order as the full edit/create command, including primary demotion.
 PERFORM 1 FROM public.companies WHERE id=p_company_id AND tenant_id=p_tenant_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'CONTACT_SCOPE' USING ERRCODE='42501'; END IF;
 IF p_action='import' THEN
  -- CSV insert never silently replaces an existing primary contact.
  IF (p_input->>'is_primary')::boolean AND EXISTS(SELECT 1 FROM public.contacts WHERE company_id=p_company_id AND is_primary) THEN
   RAISE EXCEPTION 'CONTACT_PRIMARY_EXISTS' USING ERRCODE='BC409'; END IF;
  SELECT * INTO row FROM public.write_company_contact(p_company_id,NULL,p_input->>'full_name',p_input->>'title',p_input->>'phone',p_input->>'email',(p_input->>'is_primary')::boolean,p_input->>'context_note');
 ELSE
  SELECT * INTO row FROM public.contacts WHERE id=p_contact_id AND company_id=p_company_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'CONTACT_SCOPE' USING ERRCODE='42501'; END IF;
  IF p_action='delete' THEN
   DELETE FROM public.contacts WHERE id=row.id RETURNING * INTO row;
  ELSE
   v_phone:=CASE WHEN p_input ? 'phone' THEN nullif(btrim(p_input->>'phone'),'') ELSE row.phone END;
   v_email:=CASE WHEN p_input ? 'email' THEN nullif(btrim(p_input->>'email'),'') ELSE row.email END;
   IF coalesce(btrim(v_phone),'')='' AND coalesce(btrim(v_email),'')='' THEN RAISE EXCEPTION 'CONTACT_CHANNEL_REQUIRED' USING ERRCODE='BC400'; END IF;
   UPDATE public.contacts SET phone=v_phone,email=v_email WHERE id=row.id RETURNING * INTO row;
  END IF;
 END IF;
 RETURN NEXT row;
END $$;
REVOKE ALL ON FUNCTION public.contact_execute_v1(text,uuid,uuid,uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.contact_execute_v1(text,uuid,uuid,uuid,uuid,jsonb) TO authenticated;
DO $$ BEGIN
 IF has_function_privilege('anon','public.contact_execute_v1(text,uuid,uuid,uuid,uuid,jsonb)','EXECUTE') OR has_function_privilege('service_role','public.contact_execute_v1(text,uuid,uuid,uuid,uuid,jsonb)','EXECUTE') THEN RAISE EXCEPTION 'CONTACT_COMMAND_PRIVILEGE_DRIFT'; END IF;
END $$;
NOTIFY pgrst,'reload schema';
COMMIT;
