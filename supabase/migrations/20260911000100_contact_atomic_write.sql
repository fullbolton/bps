-- Contact create/full-edit and primary reassignment are one transaction.
-- Local acceptance only so far. Apply before deploying the corresponding client.
BEGIN;
SET LOCAL lock_timeout='15s';
CREATE OR REPLACE FUNCTION public.write_company_contact(
 p_company_id uuid, p_contact_id uuid, p_full_name text, p_title text,
 p_phone text, p_email text, p_is_primary boolean, p_context_note text
) RETURNS public.contacts
LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path='' AS $$
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
$$;
REVOKE ALL ON FUNCTION public.write_company_contact(uuid,uuid,text,text,text,text,boolean,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.write_company_contact(uuid,uuid,text,text,text,text,boolean,text) TO authenticated;
COMMENT ON FUNCTION public.write_company_contact(uuid,uuid,text,text,text,text,boolean,text)
 IS 'Manager contact command: verified tenant, invoker RLS, company lock, atomic primary change. Does not enforce writes outside this command.';
NOTIFY pgrst,'reload schema';
COMMIT;
