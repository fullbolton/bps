-- Apply only after local acceptance. Old 000400 file and function ACL/owner are preserved.
BEGIN;
SET LOCAL lock_timeout='15s';
LOCK TABLE public.tasks IN SHARE ROW EXCLUSIVE MODE;
DO $$ BEGIN
 IF to_regprocedure('public.admin_assign_role_and_tenant(uuid,text,uuid)') IS NULL THEN RAISE EXCEPTION 'Requires existing platform admin RPC'; END IF;
END $$;

CREATE FUNCTION public.tasks_guard_active_assignee() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_role text;
BEGIN
  IF NEW.assigned_to_user_id IS NULL OR NEW.status NOT IN ('acik','devam_ediyor','gecikti') THEN RETURN NEW; END IF;
  IF current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION 'TASK_GUARD_REQUIRES_READ_COMMITTED' USING ERRCODE='BP004'; END IF;
  -- Task writes can already hold task row locks. Admin guards below only READ
  -- task rows, never wait on them, preventing a task-row/profile-row lock cycle.
  PERFORM 1 FROM public.profiles WHERE id=NEW.assigned_to_user_id FOR SHARE;
  SELECT role INTO v_role FROM public.profiles WHERE id=NEW.assigned_to_user_id;
  IF NOT EXISTS(SELECT 1 FROM public.tenant_memberships WHERE user_id=NEW.assigned_to_user_id AND tenant_id=NEW.tenant_id) THEN
    RAISE EXCEPTION 'TASK_ASSIGNEE_MEMBERSHIP' USING ERRCODE='BP002';
  END IF;
  IF v_role IS NULL OR v_role NOT IN ('yonetici','operasyon','ik') THEN RAISE EXCEPTION 'TASK_ASSIGNEE_ROLE' USING ERRCODE='BP003'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER tasks_guard_active_assignee BEFORE INSERT OR UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.tasks_guard_active_assignee();

CREATE FUNCTION public.membership_guard_active_tasks() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF TG_OP='UPDATE' THEN
    IF NEW.user_id IS NOT DISTINCT FROM OLD.user_id AND NEW.tenant_id IS NOT DISTINCT FROM OLD.tenant_id THEN RETURN NEW; END IF;
  END IF;
  IF current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION 'TASK_GUARD_REQUIRES_READ_COMMITTED' USING ERRCODE='BP004'; END IF;
  -- Existing admin RPC already holds this lock; direct membership DML also
  -- serializes against new task assignee writes. Fresh count AFTER any wait.
  PERFORM 1 FROM public.profiles WHERE id=OLD.user_id FOR UPDATE;
  IF EXISTS(SELECT 1 FROM public.tasks WHERE tenant_id=OLD.tenant_id AND assigned_to_user_id=OLD.user_id AND status IN ('acik','devam_ediyor','gecikti')) THEN
    RAISE EXCEPTION 'ACTIVE_TASKS_REQUIRE_TRANSFER' USING ERRCODE='BP001';
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $$;
CREATE TRIGGER membership_guard_active_tasks BEFORE DELETE OR UPDATE ON public.tenant_memberships
FOR EACH ROW EXECUTE FUNCTION public.membership_guard_active_tasks();

CREATE FUNCTION public.profile_guard_active_tasks() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  -- UPDATE already locked this profile tuple, conflicting with writer SHARE.
  IF NEW.role IS DISTINCT FROM OLD.role AND NEW.role NOT IN ('yonetici','operasyon','ik') THEN
    IF current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION 'TASK_GUARD_REQUIRES_READ_COMMITTED' USING ERRCODE='BP004'; END IF;
    IF EXISTS(SELECT 1 FROM public.tasks WHERE assigned_to_user_id=OLD.id AND status IN ('acik','devam_ediyor','gecikti')) THEN
      RAISE EXCEPTION 'ACTIVE_TASKS_REQUIRE_TRANSFER' USING ERRCODE='BP001';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER profile_guard_active_tasks BEFORE UPDATE OF role ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.profile_guard_active_tasks();
REVOKE ALL ON FUNCTION public.tasks_guard_active_assignee(),public.membership_guard_active_tasks(),public.profile_guard_active_tasks() FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.admin_assign_role_and_tenant(
  p_user_id   uuid,
  p_role      text,
  p_tenant_id uuid
)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_membership_changes boolean;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;
  IF current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION 'TASK_GUARD_REQUIRES_READ_COMMITTED' USING ERRCODE='BP004'; END IF;

  -- KULLANICI SATIRI ÖNCE KİLİTLENİR (Codex turu 2, P1). Aynı kullanıcı için
  -- iki eşzamanlı çağrı, kilit sonraya kalsaydı, üyelik kümesini AYNI
  -- başlangıç durumundan okurdu: A→B çağrısı "değişiyor", A→A çağrısı
  -- "değişmiyor" hesaplar; ilki commit eder, ikincisi profile UPDATE kilidini
  -- bekleyip B→A yazar ama önceden hesapladığı `false` yüzünden oturumları
  -- SİLMEZ — B için açılmış oturum yaşamaya devam ederdi. FOR UPDATE ile ikinci
  -- çağrı buradan geçemez; geçtiğinde (READ COMMITTED) taze snapshot'la
  -- committed {B}'yi görür ve doğru hesaplar. Varlık kontrolü de aynı satır.
  -- SÖZLEŞME: tenant_memberships'e yazan HER yol aynı satırı aynı şekilde
  -- kilitlemeli (bugün tek yazar bu RPC + elle SQL). Kilitlemeyen bir yazar
  -- bu serileştirmenin dışında kalır.
  PERFORM 1 FROM public.profiles WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'user not found' USING ERRCODE = '23503';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.tenants WHERE id = p_tenant_id) THEN
    RAISE EXCEPTION 'tenant not found' USING ERRCODE = '23503';
  END IF;

  -- Also catch old orphaned ownership with zero memberships: no DELETE trigger
  -- would run for it. Profile lock prevents concurrent active assignment passing.
  IF EXISTS(SELECT 1 FROM public.tasks WHERE assigned_to_user_id=p_user_id
    AND status IN ('acik','devam_ediyor','gecikti')
    AND (tenant_id IS DISTINCT FROM p_tenant_id OR p_role NOT IN ('yonetici','operasyon','ik'))) THEN
    RAISE EXCEPTION 'ACTIVE_TASKS_REQUIRE_TRANSFER' USING ERRCODE='BP001';
  END IF;

  -- Üyelik kümesi DEĞİŞİYOR MU — oturum iptali kararı için. Yukarıdaki kilit
  -- altında; "tam olarak {p_tenant_id}" ise değişmiyor (yalnız rol düzeltmesi).
  v_membership_changes :=
       (SELECT count(*) FROM public.tenant_memberships WHERE user_id = p_user_id) <> 1
    OR NOT EXISTS (SELECT 1 FROM public.tenant_memberships
                    WHERE user_id = p_user_id AND tenant_id = p_tenant_id);

  -- Rol CHECK'i tabloda zaten var; burada tekrar edilmiyor ki iki yerde
  -- ayrışmasın. Geçersiz rol, UPDATE sırasında CHECK ihlaliyle döner ve
  -- transaction'ın tamamını geri alır.
  UPDATE public.profiles SET role = p_role WHERE id = p_user_id;

  -- Keep the membership that remains valid. Deleting/reinserting it would
  -- incorrectly trip the active-task guard even on same-tenant role changes.
  DELETE FROM public.tenant_memberships
    WHERE user_id = p_user_id AND tenant_id IS DISTINCT FROM p_tenant_id;
  INSERT INTO public.tenant_memberships (user_id, tenant_id)
  VALUES (p_user_id, p_tenant_id) ON CONFLICT (user_id,tenant_id) DO NOTHING;

  -- ÜÇÜNCÜ PARÇA: OTURUM (Codex P1). Rol canlı okunur (`current_user_role()`
  -- → profiles.role), ama tenant bir JWT CLAIM'idir: `custom_access_token_hook`
  -- üyelikten `active_tenant_id`'yi token ÜRETİLİRKEN yazar. Üyelik burada
  -- değişse de kullanıcının elindeki token eski tenant'ı taşımaya devam eder
  -- ve refresh oldukça YENİLENİR. Yani rol+üyelik atomik ama oturum eski —
  -- bir başka yarım durum.
  --
  -- Oturumlar silinince refresh ARTIK MÜMKÜN DEĞİL: kullanıcı en geç JWT
  -- süresi dolunca yeniden giriş yapar ve hook doğru claim'i yazar. Sıfır
  -- üyelikten bire geçen Mek Group kullanıcısı için de bu gerekli — aksi
  -- halde düzeltme yapılmış görünür ama token yenilenene kadar ekran boş kalır.
  --
  -- KALAN PENCERE: mevcut access token'ın KALAN geçerlilik süresi (en fazla
  -- proje ayarı, varsayılan 3600 s). Bu pencerede eski token, claim'e güvenen 43 tenant policy'sinde eski
  -- tenant'ı okur. profiles okuması ve görev atanan guard'ı (20260904000100,
  -- KARAR 6) claim'i canlı üyelikle doğruluyor — orada pencere yok. Kalanını
  -- kapatmak `current_user_active_tenant()`'ın aynı doğrulamayı yapmasını
  -- ister; o fonksiyon repo dışında ve gövdesi elimizde yok — ayrı karar.
  -- Sıfır satır silinmesi HATA DEĞİL: kullanıcının açık oturumu olmayabilir
  -- (Codex turu 4). Aşağıdaki son kontrol RLS'in sessizce filtrelemeyeceğini
  -- kanıtlar; oturumun var olduğunu değil.
  IF v_membership_changes THEN
    DELETE FROM auth.sessions WHERE user_id = p_user_id;
  END IF;
END;
$$;


-- Check REAL stored-function owners, including preserved admin owner. A guard
-- must not silently miss rows because of its own RLS/table privileges.
DO $$
DECLARE v_owner oid; v_table regclass;
BEGIN
  FOR v_owner IN SELECT DISTINCT proowner FROM pg_proc WHERE oid IN (
    'public.admin_assign_role_and_tenant(uuid,text,uuid)'::regprocedure,
    'public.tasks_guard_active_assignee()'::regprocedure,
    'public.membership_guard_active_tasks()'::regprocedure,
    'public.profile_guard_active_tasks()'::regprocedure)
  LOOP
    IF NOT has_schema_privilege(v_owner,'public','USAGE') OR NOT has_table_privilege(v_owner,'public.profiles','UPDATE') THEN RAISE EXCEPTION 'Task guard owner lacks profile lock privileges'; END IF;
    FOREACH v_table IN ARRAY ARRAY['public.tasks'::regclass,'public.profiles'::regclass,'public.tenant_memberships'::regclass]
    LOOP
      IF NOT has_table_privilege(v_owner,v_table,'SELECT') OR NOT EXISTS(
        SELECT 1 FROM pg_roles r CROSS JOIN pg_class c WHERE r.oid=v_owner AND c.oid=v_table
        AND (r.rolsuper OR r.rolbypassrls OR NOT c.relrowsecurity OR (pg_has_role(v_owner,c.relowner,'USAGE') AND NOT c.relforcerowsecurity))
      ) THEN RAISE EXCEPTION 'Task guard owner must read all rows of %',v_table; END IF;
    END LOOP;
  END LOOP;
END $$;
COMMIT;
