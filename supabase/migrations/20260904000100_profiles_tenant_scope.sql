-- ==========================================================================
-- BPS — profiles'a tenant kapsamı + görev atananının tenant guard'ı
-- ==========================================================================
-- ⚠ WRITTEN, NOT APPLIED.
--
-- Bulgu (2026-09-04, canlı, iki yönlü): Mek Group kullanıcısı görev atama
-- seçicisinde Partner Staff kullanıcılarını görüyor (OKUMA sızıntısı) ve
-- Mek Group yöneticisi kendi görevine Partner Staff kullanıcısını atayabiliyor
-- (YAZMA sızıntısı — hiçbir katman engellemiyor).
--
-- Ölçülen sebepler:
--   profiles.tenant_id             YOK
--   profiles_select_authenticated  USING (true) — rol koşulu yok, tenant koşulu yok
--   tasks_insert / tasks_update    WITH CHECK yalnız GÖREVİN tenant'ını kontrol
--                                  ediyor, ATANANIN tenant'ını değil
--   tasks.assigned_to_user_id      FK → profiles(id), tenant kısıtı yok
--
-- Bu sızıntı sürpriz DEĞİL: `20260722000100` riski iki insan gate'iyle
-- (G1 tenant_count=1 · G3 "her profil kendi personelimiz" beyanı) kaydetmişti.
-- İkinci tenant geldiğinde G1'in değeri 1'den 4'e çıktı ve kimse yeniden
-- koşmadı. Bir beyan bir sorgu değildir; gate o gün doğruydu, bugün değil.
--
-- ==========================================================================
-- KARAR 1 — profiles'a tenant_id EKLENMİYOR
-- ==========================================================================
-- Kolon tekil; kullanıcı ileride iki tenant'a üye olabilir. Üyelik zaten
-- `tenant_memberships`'te ve `custom_access_token_hook` oradan okuyor. Aynı
-- gerçeği iki yerde tutmak, ikisinin ayrışmasını davet eder — updated_at
-- dersinin bir başka biçimi. Kapsam üyelik tablosu üzerinden türetilir.
--
-- ==========================================================================
-- KARAR 2 — policy'de DOĞRUDAN EXISTS DEĞİL, SECURITY DEFINER yardımcı
-- ==========================================================================
-- İlk öneri şuydu:
--     EXISTS (SELECT 1 FROM tenant_memberships m WHERE m.user_id = profiles.id
--              AND m.tenant_id = current_user_active_tenant())
-- Bu policy'ye doğrudan yazılırsa UYGULAMA AÇILMAZ. Postgres, policy ifadesini
-- sorguyu çalıştıran kullanıcının yetkisiyle değerlendirir (CREATE POLICY
-- Notes: "policy expressions ... run with the rights of the user running the
-- overall query"). `tenant_memberships`'te `authenticated`'a SELECT grant'i
-- YOK (kasıtlı, PROD_SCHEMA_DRIFT.md). Her profiles okuması ve her görev
-- insert'i `permission denied for table tenant_memberships` ile düşerdi.
--
-- Grant vermek de çözüm değil: tablo RLS açık ve policy'siz, alt sorgu sıfır
-- satır görür, EXISTS hep false olur — kimse kimseyi göremez.
--
-- Doğru desen kod tabanında zaten var: `current_user_has_company_scope()`
-- (20260407000200) kapsam tablosunu policy'lerin içinden okumak için tam bu
-- yüzden SECURITY DEFINER yazılmıştı. `contacts`'ın EXISTS'i (Desen D)
-- çalışıyor, çünkü `companies`'in kendi SELECT policy'si ve grant'i var —
-- `tenant_memberships`'in yok. Emsal contacts değil, has_company_scope.
--
-- ==========================================================================
-- KARAR 3 — kullanıcı KENDİ profilini her zaman okur
-- ==========================================================================
-- `id = auth.uid()` dalı ayrı ve koşulsuz. Sıfır üyelikli bir kullanıcı
-- (admin panelinin var olma sebebi olan arıza) için current_user_active_tenant()
-- NULL döner ve üyelik dalı false olur. Kendi profilini de okuyamasaydı,
-- "boş ekran" olan arıza "giriş yapamıyor"a dönüşürdü ve panelin teşhis
-- edeceği durum panelden önce kilitlenirdi.
--
-- ==========================================================================
-- KARAR 4 — yazma guard'ı tasks_insert VE tasks_update'te
-- ==========================================================================
-- Yalnız insert'e koymak açığı kapatmaz: atanansız insert + atanan update ile
-- aynı yol açık kalır. UPDATE'in WITH CHECK'i yeni satırı denetler, guard
-- oraya da yazılır. USING değişmiyor — o, hangi satırın hedeflenebileceğini
-- söyler; sorun içerikte.
--
-- Bilinen sonuç: mevcut bir görevin atananı ileride başka tenant'a taşınırsa
-- (admin paneli üyeliği DEĞİŞTİRİYOR), o görevin HER güncellemesi yeniden
-- atanana kadar reddedilir — atanan değişmese bile, çünkü WITH CHECK yeni
-- satırın tamamına bakar. Bu sessiz değil (RLS hatası görünür) ve doğru
-- davranış: görev, başka bir kiracının çalışanına atalı kalamaz.
-- Tespit sorgusu: profiles_tenant_scope_post_apply_verify.sql §6.
--
-- ==========================================================================
-- KARAR 5 — uygulama katmanı için ayrı RPC: active_tenant_profiles()
-- ==========================================================================
-- "Doğrulanmış tenant'ı veri erişim çağrısına taşı; geliştiricinin filtreyi
-- hatırlamasına güvenme." profiles'ta tenant_id olmadığı ve üyelik tablosu
-- tarayıcıya kapalı olduğu için, tarayıcıdan "bu tenant'ın üyeleri" sorgusu
-- PostgREST ile YAZILAMAZ. Tek yol tenant'ı fonksiyonun içinde çözmek.
-- Parametre almaz: tenant `current_user_active_tenant()`'tan gelir, istemci
-- payload'ından değil (createCompany'deki kuralın aynısı).
--
-- Bu, policy'den BAĞIMSIZ bir katman: policy ileride yanlışlıkla genişlese
-- bile seçici kapsamlı kalır. Kod tarafında kapsamsız okuyucu
-- (`selectAllProfiles`) SİLİNİYOR — unutulabilecek filtre yerine çağrılamayacak
-- fonksiyon. qa:static R14 geri gelmesini FAIL yapar.
--
-- ==========================================================================
-- KARAR 6 — CLAIM BİR İPUCU, ÜYELİK TABLOSU GERÇEK (Codex P1, 2026-09-05)
-- ==========================================================================
-- `current_user_active_tenant()` JWT'deki claim'i döner. Claim token
-- ÜRETİLİRKEN yazılır; üyelik sonradan değişse de token süresi dolana kadar
-- yaşar. İlk sürüm bu değere güveniyordu: A'dan B'ye taşınmış bir kullanıcı,
-- elindeki eski A token'ıyla `active_tenant_profiles()`'tan A'nın profillerini
-- almaya, `is_active_tenant_member()` ile A üyeliklerini sorgulamaya devam
-- ederdi.
--
-- Düzeltme `current_user_active_tenant()`'a DOKUNMUYOR (gövdesi repo dışında,
-- elimizde yok): yeni yardımcı `current_user_verified_tenant()` claim'i yalnız
-- çağıranın o tenant'ta HÂLÂ üyeliği varsa döner, yoksa NULL. İki fonksiyon da
-- tenant'ı ondan alır. Eski claim ne eski tenant'a ne yenisine erişim verir —
-- yalnız fail-closed olur. 43 tenant policy'si claim'e güvenmeye devam ediyor;
-- o pencere admin RPC'sinin oturum iptaliyle JWT süresine sınırlı (000400).
--
-- ==========================================================================
-- KARAR 7 — ÖN KONTROL İLE DDL ARASI KİLİT (Codex P1, 2026-09-05)
-- ==========================================================================
-- Ön kontrol (e) "çapraz-tenant atama yok" der; policy DDL'i tablo kilidini
-- daha sonra alır. Arada, eski policy altında, tam öyle bir görev yazılabilir;
-- migration başarıyla commit eder ve o satır güncellenemez kalır. Kontrol ile
-- DDL aynı kilit altında olmalı.
--
-- İLK SÜRÜM (Codex turu 2 düzeltti): SHARE ROW EXCLUSIVE alıp "okuyucuları
-- engellemez" demişti. İki hata: (1) DROP/CREATE POLICY zaten ACCESS EXCLUSIVE
-- alır ve transaction sonuna kadar tutar — okuyucular DDL boyunca ZATEN
-- bekler; (2) zayıftan güçlüye YÜKSELTME döngü yaratabilir: bir transaction
-- tasks'ı okumuş (ACCESS SHARE tutuyor), sonra yazmak isteyip bizim SHARE ROW
-- EXCLUSIVE'imizin arkasında bekliyor; biz DDL için ACCESS EXCLUSIVE isteyip
-- ONUN ACCESS SHARE'inin bitmesini bekliyoruz → deadlock.
--
-- DOĞRUSU: gereken en güçlü kilit BAŞTAN, iki tabloya birden, tek cümlede
-- (profiles, tasks). Yükseltme yok → kendi yarattığımız döngü yok. Bedeli
-- açıkça yazılı: transaction boyunca profiles ve tasks OKUNAMAZ da.
--
-- SÜRE (Codex turu 3): "saniyeler" GARANTİ DEĞİL. İki bileşen var —
-- (1) kilidin alınması: uzun bir okuma tasks'ta ACCESS SHARE tutuyorsa
--     bekleriz, ve LOCK iki tabloyu SIRAYLA alır: profiles alınmış,
--     tasks beklenirken profiles ZATEN kilitli. Bu yüzden `lock_timeout`
--     var — sınır aşılırsa migration temiz düşer, elle tekrar denenir;
--     süresiz asılı kalmaz.
-- (2) transaction'ın kendisi: ön kontrol (e) tasks'ı tarar. Bugün küçük
--     bir tablo; büyüdükçe bu pencere büyür. Ölçülmemiş bir "saniyeler"
--     yerine sınırlı-ve-düşer davranışı yazılı.
-- Tablolar-arası deadlock genel olarak dışlanamaz; olursa PostgreSQL'in
-- dedektörü bir tarafı düşürür — bizim tarafımız düşerse migration temiz
-- geri alınır (hiçbir şey yarım kalmaz).
--
-- ==========================================================================
-- DOĞRULAMA MİGRATION'IN İÇİNDE — sessiz yarım durum imkânsız
-- ==========================================================================
-- `contracts` dersi (20260827000300): policy adı yanlışsa DROP no-op olur,
-- CREATE ikinci bir permissive policy ekler, eskisi yerinde kalır ve ikisi
-- OR ile birleşir — sızıntı sürer, migration "başarılı" der. Burada aynı hata
-- MÜMKÜN DEĞİL: ön kontrol adı doğrular, son kontrol toplam policy sayısının
-- değişmediğini ve profiles'ta `true` kalmadığını doğrular. Biri tutmazsa
-- transaction geri alınır. Post-apply verify dosyası ek kanıt, tek kanıt değil.
--
-- GERİ DÖNÜŞ: 20260407000000 (profiles_select_authenticated, `using (true)`)
-- ve 20260827000300 satır 299–328 (tasks_insert / tasks_update). Fonksiyonlar
-- DROP FUNCTION ile düşer; sıra: önce policy'ler, sonra is_active_tenant_member
-- + active_tenant_profiles, en son current_user_verified_tenant (bağımlılık).
-- ==========================================================================

BEGIN;

-- KARAR 7: en güçlü kilit BAŞTAN, yükseltme yok. profiles ve tasks bu
-- transaction boyunca yazılamaz VE okunamaz. Kilit 15 s içinde alınamazsa
-- transaction düşer (SET LOCAL — yalnız bu transaction'a etki eder).
SET LOCAL lock_timeout = '15s';
LOCK TABLE public.profiles, public.tasks IN ACCESS EXCLUSIVE MODE;

-- --------------------------------------------------------------------------
-- 0) ÖN KONTROLLER — biri tutmazsa hiçbir şey değişmez
-- --------------------------------------------------------------------------
CREATE TEMP TABLE _bps_pre ON COMMIT DROP AS
  SELECT count(*) AS toplam_policy
    FROM pg_policies WHERE schemaname = 'public';

DO $$
DECLARE
  v_n integer;
BEGIN
  -- a) Kök nesneler var mı (repo dışı yaratıldılar, PROD_SCHEMA_DRIFT.md)
  IF to_regclass('public.tenant_memberships') IS NULL THEN
    RAISE EXCEPTION 'ön kontrol: public.tenant_memberships yok';
  END IF;
  IF to_regprocedure('public.current_user_active_tenant()') IS NULL THEN
    RAISE EXCEPTION 'ön kontrol: current_user_active_tenant() yok';
  END IF;
  SELECT count(*) INTO v_n FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'tenant_memberships'
     AND column_name IN ('user_id', 'tenant_id');
  IF v_n <> 2 THEN
    RAISE EXCEPTION 'ön kontrol: tenant_memberships(user_id, tenant_id) bekleniyordu, % kolon bulundu', v_n;
  END IF;

  -- UNIQUE(user_id, tenant_id) — repo'da tanımı YOK, yalnız ölçüm notu vardı
  -- (Codex turu 2: "yorumda var, kanıtı yok"). Burada ölçülüyor: tam bu iki
  -- kolon üzerinde, kısmi olmayan bir unique index. Hook'un `v_count = 1`
  -- mantığı ve admin RPC'sinin küme hesabı buna dayanır — mükerrer satır
  -- aynı tenant'ı iki üyelik gibi gösterip claim'i düşürürdü.
  -- Codex turu 3: ilk sürüm geçersiz (indisvalid=false) bir index'i, ifade
  -- sütunlu bir index'i (indkey'de 0 → pg_attribute'ta satır yok, ad
  -- karşılaştırmasından KAYBOLUR) ve INCLUDE sütunlarını ayırt etmiyordu —
  -- (tenant_id, user_id, (x+0)) gibi bir index çift ikiliye izin verirken
  -- kontrolü geçerdi. Şimdi: geçerli + hazır + canlı, kısmi değil, ifade yok,
  -- TAM İKİ ANAHTAR sütun (indnkeyatts), ve yalnız anahtar sütunlar
  -- karşılaştırılır (indkey'in ilk indnkeyatts girdisi). PK de geçer.
  SELECT count(*) INTO v_n
    FROM pg_index i
    JOIN pg_class t     ON t.oid = i.indrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
   WHERE n.nspname = 'public' AND t.relname = 'tenant_memberships'
     AND i.indisunique AND i.indisvalid AND i.indisready AND i.indislive
     AND i.indpred IS NULL AND i.indexprs IS NULL
     AND i.indnkeyatts = 2
     AND (SELECT array_agg(a.attname::text ORDER BY a.attname)
            FROM generate_series(0, i.indnkeyatts - 1) AS k
            JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = i.indkey[k])
         = ARRAY['tenant_id', 'user_id'];
  IF v_n = 0 THEN
    RAISE EXCEPTION 'ön kontrol: tenant_memberships(user_id, tenant_id) üzerinde UNIQUE yok — KARAR 6 ve hook buna dayanır';
  END IF;

  -- b) Policy ADLARI — contracts dersi. Ad yanlışsa DROP no-op olur.
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
                  AND tablename='profiles' AND policyname='profiles_select_authenticated') THEN
    RAISE EXCEPTION 'ön kontrol: profiles_select_authenticated bulunamadı — ad prod ile eşleşmiyor';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
                  AND tablename='tasks' AND policyname='tasks_insert' AND cmd='INSERT') THEN
    RAISE EXCEPTION 'ön kontrol: tasks_insert bulunamadı';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
                  AND tablename='tasks' AND policyname='tasks_update' AND cmd='UPDATE') THEN
    RAISE EXCEPTION 'ön kontrol: tasks_update bulunamadı';
  END IF;

  -- c) profiles'ta SELECT policy'si TAM BİR tane olmalı. İkincisi varsa
  --    bilinmeyen bir OR dalı var demektir; önce o okunur.
  SELECT count(*) INTO v_n FROM pg_policies
   WHERE schemaname='public' AND tablename='profiles' AND cmd='SELECT';
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'ön kontrol: profiles üzerinde % SELECT policy var, 1 bekleniyordu', v_n;
  END IF;

  -- d) İki kez uygulanmaya karşı
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='tasks'
              AND policyname='tasks_insert' AND with_check ILIKE '%is_active_tenant_member%') THEN
    RAISE EXCEPTION 'ön kontrol: tasks_insert zaten guard taşıyor — migration daha önce uygulanmış';
  END IF;

  -- e) MEVCUT çapraz-tenant atama var mı. Varsa bu migration UYGULANMAZ:
  --    yeni WITH CHECK o görevlerin her güncellemesini reddederdi. Karar
  --    (yeniden ata / boşalt) elle verilir — verify dosyası §6.
  SELECT count(*) INTO v_n
    FROM public.tasks t
   WHERE t.assigned_to_user_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.tenant_memberships m
                      WHERE m.user_id = t.assigned_to_user_id
                        AND m.tenant_id = t.tenant_id);
  IF v_n > 0 THEN
    RAISE EXCEPTION 'ön kontrol: % görevde atanan başka tenant''ın üyesi — önce temizle (verify §6), sonra uygula', v_n;
  END IF;
END $$;


-- --------------------------------------------------------------------------
-- 1a) Yardımcı: current_user_verified_tenant() — KARAR 6
-- --------------------------------------------------------------------------
-- Claim'deki tenant'ı, yalnız çağıranın orada HÂLÂ üyeliği varsa döner.
-- UNIQUE(user_id, tenant_id) olduğu için en fazla bir satır; satır yoksa
-- NULL (SQL fonksiyonu, boş sonuç → NULL). Tenant claim'i yoksa da NULL.
CREATE OR REPLACE FUNCTION public.current_user_verified_tenant()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.tenant_id
    FROM public.tenant_memberships m
   WHERE m.user_id   = auth.uid()
     AND m.tenant_id = public.current_user_active_tenant();
$$;

COMMENT ON FUNCTION public.current_user_verified_tenant() IS
  'The caller''s active-tenant claim, returned ONLY while the caller still holds '
  'a membership in that tenant; NULL otherwise. The claim is minted at token time '
  'and outlives membership changes, so it is a hint — tenant_memberships is the truth.';

REVOKE ALL ON FUNCTION public.current_user_verified_tenant() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_verified_tenant() TO authenticated;


-- --------------------------------------------------------------------------
-- 1) Yardımcı: is_active_tenant_member(uuid)
-- --------------------------------------------------------------------------
-- "Bu profil, çağıranın DOĞRULANMIŞ tenant'ının üyesi mi?" Policy'lerin
-- içinden çağrılır; SECURITY DEFINER olduğu için kapalı üyelik tablosunu
-- okuyabilir. Tenant NULL ise (üyelik yok ya da eski claim) EXISTS false
-- döner — fail-closed. STABLE: aynı sorguda aynı girdi için tekrar hesaplanmaz.
CREATE OR REPLACE FUNCTION public.is_active_tenant_member(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.tenant_memberships m
     WHERE m.user_id   = p_user_id
       AND m.tenant_id = public.current_user_verified_tenant()
  );
$$;

COMMENT ON FUNCTION public.is_active_tenant_member(uuid) IS
  'True when the given profile id is a member of the caller''s VERIFIED active '
  'tenant (claim + live membership). SECURITY DEFINER so RLS policies can consult '
  'the closed tenant_memberships table. False when the caller has no verified '
  'tenant (fail-closed).';

REVOKE ALL ON FUNCTION public.is_active_tenant_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_active_tenant_member(uuid) TO authenticated;


-- --------------------------------------------------------------------------
-- 2) RPC: active_tenant_profiles() — uygulama katmanının kapsamlı okuyucusu
-- --------------------------------------------------------------------------
-- Parametre YOK: tenant çağıranın DOĞRULANMIŞ claim'inden çözülür (KARAR 6).
-- Sıralama seçicinin beklediği gibi (display_name), eski selectAllProfiles ile aynı.
CREATE OR REPLACE FUNCTION public.active_tenant_profiles()
RETURNS SETOF public.profiles
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.*
    FROM public.profiles p
   WHERE EXISTS (
     SELECT 1
       FROM public.tenant_memberships m
      WHERE m.user_id   = p.id
        AND m.tenant_id = public.current_user_verified_tenant()
   )
   ORDER BY p.display_name;
$$;

COMMENT ON FUNCTION public.active_tenant_profiles() IS
  'Profiles that are members of the caller''s active tenant, ordered by '
  'display_name. The application-layer scoped reader for user pickers. '
  'Takes no tenant argument on purpose: the tenant is resolved server-side.';

REVOKE ALL ON FUNCTION public.active_tenant_profiles() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.active_tenant_profiles() TO authenticated;


-- --------------------------------------------------------------------------
-- 3) profiles — SELECT policy daraltılıyor
-- --------------------------------------------------------------------------
-- Eski: using (true). Gerekçesi "yazar adlarını göstermek"ti; aynı tenant'ın
-- yazarları görünmeye devam eder. Başka tenant'ın yazarı zaten o tenant'ın
-- kaydında görünmez — kayıtlar tenant-kapsamlı.
DROP POLICY IF EXISTS profiles_select_authenticated ON public.profiles;
CREATE POLICY profiles_select_authenticated
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    id = auth.uid()
    OR public.is_active_tenant_member(id)
  );


-- --------------------------------------------------------------------------
-- 4) tasks — atananın tenant guard'ı (INSERT + UPDATE WITH CHECK)
-- --------------------------------------------------------------------------
-- CASE bloğu 20260827000300'den BİREBİR; yalnız AND dalı ekleniyor.
-- Sadeleştirilmedi — bu migration'ın işi değil.
DROP POLICY IF EXISTS tasks_insert ON public.tasks;
CREATE POLICY tasks_insert ON public.tasks
  FOR INSERT WITH CHECK (
    (CASE current_user_role()
      WHEN 'yonetici'::text  THEN tenant_id = current_user_active_tenant()
      WHEN 'operasyon'::text THEN tenant_id = current_user_active_tenant()
      WHEN 'ik'::text        THEN tenant_id = current_user_active_tenant()
      ELSE false
    END)
    AND (
      assigned_to_user_id IS NULL
      OR public.is_active_tenant_member(assigned_to_user_id)
    )
  );

DROP POLICY IF EXISTS tasks_update ON public.tasks;
CREATE POLICY tasks_update ON public.tasks
  FOR UPDATE
  USING (
    CASE current_user_role()
      WHEN 'yonetici'::text  THEN tenant_id = current_user_active_tenant()
      WHEN 'operasyon'::text THEN tenant_id = current_user_active_tenant()
      WHEN 'ik'::text        THEN tenant_id = current_user_active_tenant()
      ELSE false
    END
  )
  WITH CHECK (
    (CASE current_user_role()
      WHEN 'yonetici'::text  THEN tenant_id = current_user_active_tenant()
      WHEN 'operasyon'::text THEN tenant_id = current_user_active_tenant()
      WHEN 'ik'::text        THEN tenant_id = current_user_active_tenant()
      ELSE false
    END)
    AND (
      assigned_to_user_id IS NULL
      OR public.is_active_tenant_member(assigned_to_user_id)
    )
  );


-- --------------------------------------------------------------------------
-- 5) SON KONTROLLER — tutmazsa COMMIT olmaz
-- --------------------------------------------------------------------------
DO $$
DECLARE
  v_pre  integer;
  v_post integer;
  v_n    integer;
BEGIN
  -- a) Toplam policy sayısı DEĞİŞMEMELİ: 3 DROP + 3 CREATE = net sıfır.
  --    Değiştiyse bir DROP no-op olmuş ve çift policy doğmuştur (contracts dersi).
  SELECT toplam_policy INTO v_pre FROM _bps_pre;
  SELECT count(*) INTO v_post FROM pg_policies WHERE schemaname = 'public';
  IF v_pre <> v_post THEN
    RAISE EXCEPTION 'son kontrol: policy sayısı % → % değişti — bir DROP no-op oldu, çift policy var', v_pre, v_post;
  END IF;

  -- b) profiles'ta tek SELECT policy, ve `true` değil
  SELECT count(*) INTO v_n FROM pg_policies
   WHERE schemaname='public' AND tablename='profiles' AND cmd='SELECT';
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'son kontrol: profiles SELECT policy sayısı % (1 bekleniyordu)', v_n;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles'
              AND cmd='SELECT' AND (qual = 'true' OR qual NOT ILIKE '%is_active_tenant_member%')) THEN
    RAISE EXCEPTION 'son kontrol: profiles SELECT policy hâlâ açık';
  END IF;

  -- c) tasks guard'ları yerinde
  SELECT count(*) INTO v_n FROM pg_policies
   WHERE schemaname='public' AND tablename='tasks'
     AND policyname IN ('tasks_insert','tasks_update')
     AND with_check ILIKE '%is_active_tenant_member(assigned_to_user_id)%';
  IF v_n <> 2 THEN
    RAISE EXCEPTION 'son kontrol: tasks guard''ı % policy''de (2 bekleniyordu)', v_n;
  END IF;

  -- d) Fonksiyonlar SECURITY DEFINER + STABLE
  SELECT count(*) INTO v_n
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname='public'
     AND p.proname IN ('current_user_verified_tenant','is_active_tenant_member','active_tenant_profiles')
     AND p.prosecdef AND p.provolatile = 's';
  IF v_n <> 3 THEN
    RAISE EXCEPTION 'son kontrol: % fonksiyon SECURITY DEFINER+STABLE (3 bekleniyordu)', v_n;
  END IF;
END $$;

COMMIT;
