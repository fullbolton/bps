-- Enforce field capabilities for every writer, including direct REST requests.
BEGIN;
SET LOCAL lock_timeout='15s';
LOCK TABLE public.contacts,public.notes IN ACCESS EXCLUSIVE MODE;

CREATE FUNCTION public.guard_contact_write_fields() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_actor uuid:=auth.uid(); v_tenant uuid; v_role text; v_status text;
BEGIN
 -- FK maintenance and trusted system work have no end-user identity.
 IF v_actor IS NULL AND (auth.role()='service_role' OR current_setting('role',true) IN ('none','postgres','supabase_admin')) THEN RETURN NEW; END IF;
 v_tenant:=public.current_user_verified_tenant(); v_role:=public.current_user_role();
 IF v_actor IS NULL OR v_tenant IS NULL OR v_role NOT IN ('yonetici','operasyon') OR v_role IS NULL THEN
  RAISE EXCEPTION 'Contact write denied' USING ERRCODE='42501';
 END IF;
 IF TG_OP='INSERT' THEN
  IF v_role<>'yonetici' THEN RAISE EXCEPTION 'Contact create denied' USING ERRCODE='42501'; END IF;
  -- Same parent lock as write_company_contact: concurrent raw imports also
  -- serialize before counting. Updates cannot move a contact between parents.
  SELECT status INTO v_status FROM public.companies WHERE id=NEW.company_id AND tenant_id=v_tenant FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Company unavailable' USING ERRCODE='42501'; END IF;
  IF v_status='pasif' THEN RAISE EXCEPTION 'Inactive company' USING ERRCODE='23514'; END IF;
  IF (SELECT count(*) FROM public.contacts WHERE company_id=NEW.company_id)>=5 THEN
   RAISE EXCEPTION 'Contact limit reached' USING ERRCODE='23514';
  END IF;
  NEW.created_by:=v_actor; NEW.created_at:=clock_timestamp(); NEW.updated_at:=NEW.created_at;
 ELSE
  IF ROW(NEW.id,NEW.company_id,NEW.created_by,NEW.created_at) IS DISTINCT FROM ROW(OLD.id,OLD.company_id,OLD.created_by,OLD.created_at) THEN
   RAISE EXCEPTION 'Contact identity is immutable' USING ERRCODE='42501';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.companies WHERE id=OLD.company_id AND tenant_id=v_tenant) THEN
   RAISE EXCEPTION 'Company unavailable' USING ERRCODE='42501';
  END IF;
  IF v_role='operasyon' AND (to_jsonb(NEW)-ARRAY['phone','email','updated_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['phone','email','updated_at']) THEN
   RAISE EXCEPTION 'Only phone and email may be changed' USING ERRCODE='42501';
  END IF;
  NEW.updated_at:=clock_timestamp();
 END IF;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_contact_write_fields() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER contacts_guard_write_fields BEFORE INSERT OR UPDATE ON public.contacts
 FOR EACH ROW EXECUTE FUNCTION public.guard_contact_write_fields();

CREATE FUNCTION public.guard_note_write_fields() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_actor uuid:=auth.uid(); v_tenant uuid; v_role text; v_author text;
BEGIN
 IF v_actor IS NULL AND (auth.role()='service_role' OR current_setting('role',true) IN ('none','postgres','supabase_admin')) THEN RETURN NEW; END IF;
 v_tenant:=public.current_user_verified_tenant(); v_role:=public.current_user_role();
 IF v_actor IS NULL OR v_tenant IS NULL OR v_role IS NULL OR v_role NOT IN ('yonetici','operasyon','ik') THEN
  RAISE EXCEPTION 'Note write denied' USING ERRCODE='42501';
 END IF;
 IF NEW.tenant_id IS DISTINCT FROM v_tenant OR NOT EXISTS(SELECT 1 FROM public.companies WHERE id=NEW.company_id AND tenant_id=v_tenant) THEN
  RAISE EXCEPTION 'Company unavailable' USING ERRCODE='42501';
 END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.author_id IS DISTINCT FROM v_actor OR (coalesce(NEW.is_pinned,false) AND v_role<>'yonetici') THEN
   RAISE EXCEPTION 'Note author or pin denied' USING ERRCODE='42501';
  END IF;
  SELECT coalesce(nullif(btrim(display_name),''),nullif(btrim(email),''),'Kullanıcı') INTO v_author FROM public.profiles WHERE id=v_actor;
  IF NOT FOUND THEN RAISE EXCEPTION 'Author unavailable' USING ERRCODE='42501'; END IF;
  NEW.author_name:=v_author; NEW.created_at:=clock_timestamp(); NEW.updated_at:=NEW.created_at;
 ELSE
  IF ROW(NEW.id,NEW.company_id,NEW.tenant_id,NEW.author_id,NEW.author_name,NEW.created_at) IS DISTINCT FROM ROW(OLD.id,OLD.company_id,OLD.tenant_id,OLD.author_id,OLD.author_name,OLD.created_at) THEN
   RAISE EXCEPTION 'Note identity is immutable' USING ERRCODE='42501';
  END IF;
  IF v_role<>'yonetici' AND (OLD.author_id IS DISTINCT FROM v_actor OR (to_jsonb(NEW)-ARRAY['content','tag','updated_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['content','tag','updated_at'])) THEN
   RAISE EXCEPTION 'Only own note content and tag may be changed' USING ERRCODE='42501';
  END IF;
  NEW.updated_at:=clock_timestamp();
 END IF;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_note_write_fields() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER notes_guard_write_fields BEFORE INSERT OR UPDATE ON public.notes
 FOR EACH ROW EXECUTE FUNCTION public.guard_note_write_fields();
NOTIFY pgrst,'reload schema';
COMMIT;
