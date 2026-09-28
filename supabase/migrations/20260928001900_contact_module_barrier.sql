-- Expand: retain the existing contact API, remove its invoker company UPDATE dependency.
-- Direct contact writes are a separate cutover; this secdef entry enforces explicit scope.
BEGIN;
SET LOCAL lock_timeout='15s';
DO $$
DECLARE target regprocedure; definition text;
 expected_body constant text:=$original$
DECLARE
 v_tenant uuid := public.current_user_verified_tenant();
 v_status text;
 v_row public.contacts;
 v_name text := btrim(coalesce(p_full_name,''));
 v_phone text := nullif(btrim(p_phone),'');
 v_email text := nullif(btrim(p_email),'');
BEGIN
 IF auth.uid() IS NULL OR v_tenant IS NULL OR public.current_user_role() IS DISTINCT FROM 'yonetici' THEN
  RAISE EXCEPTION 'Yetkili kişi ekleme/düzenleme yetkiniz yok.' USING ERRCODE='42501';
 END IF;
 -- Serialize these commands per company before counting or touching contacts.
 -- SECURITY INVOKER preserves the caller's table privileges and RLS.
 SELECT c.status INTO v_status FROM public.companies c
 WHERE c.id=p_company_id AND c.tenant_id=v_tenant FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Firma bulunamadı veya erişiminiz yok.' USING ERRCODE='42501'; END IF;
 IF v_name='' OR (v_phone IS NULL AND v_email IS NULL) THEN
  RAISE EXCEPTION 'Ad soyad ve telefon veya e-posta gereklidir.' USING ERRCODE='23514';
 END IF;
 IF p_contact_id IS NULL THEN
  IF v_status='pasif' THEN RAISE EXCEPTION 'Pasif firmaya yeni yetkili eklenemez.' USING ERRCODE='23514'; END IF;
  IF (SELECT count(*) FROM public.contacts WHERE company_id=p_company_id)>=5 THEN
   RAISE EXCEPTION 'Bir firmaya en fazla 5 yetkili kişi eklenebilir.' USING ERRCODE='23514';
  END IF;
 ELSE
  SELECT * INTO v_row FROM public.contacts WHERE id=p_contact_id AND company_id=p_company_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Yetkili bulunamadı veya bu firmaya ait değil.' USING ERRCODE='42501'; END IF;
 END IF;
 IF coalesce(p_is_primary,false) THEN
  UPDATE public.contacts SET is_primary=false
  WHERE company_id=p_company_id AND is_primary AND id IS DISTINCT FROM p_contact_id;
 END IF;
 IF p_contact_id IS NULL THEN
  INSERT INTO public.contacts(company_id,full_name,title,phone,email,is_primary,context_note,created_by)
  VALUES(p_company_id,v_name,nullif(btrim(p_title),''),v_phone,v_email,coalesce(p_is_primary,false),nullif(btrim(p_context_note),''),auth.uid())
  RETURNING * INTO v_row;
 ELSE
  UPDATE public.contacts SET full_name=v_name,title=nullif(btrim(p_title),''),phone=v_phone,email=v_email,
   is_primary=coalesce(p_is_primary,false),context_note=nullif(btrim(p_context_note),'')
  WHERE id=p_contact_id AND company_id=p_company_id RETURNING * INTO v_row;
  IF NOT FOUND THEN RAISE EXCEPTION 'Yetkili güncellenemedi.' USING ERRCODE='42501'; END IF;
 END IF;
 RETURN v_row;
END;
$original$;
 anchor constant text:=' -- Serialize these commands per company before counting or touching contacts.';
BEGIN
 target:=to_regprocedure('public.write_company_contact(uuid,uuid,text,text,text,text,boolean,text)');
 IF target IS NULL OR EXISTS(SELECT FROM pg_proc WHERE oid=target AND prosecdef) THEN RAISE EXCEPTION 'CONTACT_COMMAND_DRIFT';END IF;
 IF (SELECT prosrc FROM pg_proc WHERE oid=target) IS DISTINCT FROM expected_body THEN RAISE EXCEPTION 'CONTACT_COMMAND_BODY_DRIFT';END IF;
 definition:=pg_get_functiondef(target);
 IF (length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1 THEN RAISE EXCEPTION 'CONTACT_COMMAND_DRIFT';END IF;
 EXECUTE replace(replace(definition,anchor,$guard$
 PERFORM public.workspace_require_module_write_v1(v_tenant,ARRAY['customers']);
 PERFORM 1 FROM public.profiles WHERE id=auth.uid() FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'CONTACT_SCOPE' USING ERRCODE='42501';END IF;
 PERFORM public.workspace_require_module_write_v1(v_tenant,ARRAY['customers']);
 IF public.current_user_role() IS DISTINCT FROM 'yonetici' THEN RAISE EXCEPTION 'CONTACT_ROLE' USING ERRCODE='42501';END IF;
 -- Serialize these commands per company before counting or touching contacts.
$guard$),' -- SECURITY INVOKER preserves the caller''s table privileges and RLS.',
 ' -- Definer scope: verified tenant company; target contact must belong to that company.');
END $$;
ALTER FUNCTION public.write_company_contact(uuid,uuid,text,text,text,text,boolean,text) SECURITY DEFINER;
ALTER FUNCTION public.write_company_contact(uuid,uuid,text,text,text,text,boolean,text) SET lock_timeout='5s';
REVOKE ALL ON FUNCTION public.write_company_contact(uuid,uuid,text,text,text,text,boolean,text) FROM PUBLIC,anon,service_role;
DO $$ BEGIN
 IF NOT has_function_privilege('authenticated','public.write_company_contact(uuid,uuid,text,text,text,text,boolean,text)','EXECUTE')
  OR has_function_privilege('anon','public.write_company_contact(uuid,uuid,text,text,text,text,boolean,text)','EXECUTE')
  OR has_function_privilege('service_role','public.write_company_contact(uuid,uuid,text,text,text,text,boolean,text)','EXECUTE') THEN RAISE EXCEPTION 'CONTACT_COMMAND_PRIVILEGE_DRIFT';END IF;
END $$;
COMMENT ON FUNCTION public.write_company_contact(uuid,uuid,text,text,text,text,boolean,text)
 IS 'Manager contact command: config/profile/company lock order, explicit verified tenant and contact-company scope, atomic primary change. Direct contact DML cutover remains separate.';
COMMIT;
