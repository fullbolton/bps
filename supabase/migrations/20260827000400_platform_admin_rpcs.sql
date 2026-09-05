-- ==========================================================================
-- BPS — Platform Admin (/admin) veri katmanı
-- ==========================================================================
-- Karar: platform admin paneli açılıyor (2026-08-27, Furkan onayı).
-- FAZ 1: yalnız platform admin, /admin ağacında, tenant + kullanıcı yönetimi.
-- FAZ 2 (tenant admin, /ayarlar) bu dosyanın kapsamında DEĞİL.
--
-- ⚠ WRITTEN, NOT APPLIED.
-- ⚠ UYGULAMA SIRASI: 20260904000200 (grant) → 20260904000100 (tenant kapsamı)
--   → BU DOSYA. Bölüm 1'deki ön kontrol grant migration'ını ŞART koşar.
--
-- Codex turu 1 (2026-09-04) — üç bulgu, üçü de bu dosyada/kodda kapatıldı:
--   P1 bayrağın yazma yetkisi yorumla varsayılıyordu → bölüm 1, fail-closed
--   P1 tenant değişince eski JWT claim'i yaşıyordu → bölüm 5, oturum iptali
--   P2 page.tsx ham Error.message gösteriyordu   → src/app/admin/page.tsx
--
-- ==========================================================================
-- NEDEN — ölçülmüş bir hata sınıfı
-- ==========================================================================
-- Mek Group tenant'ı kurulurken aynı iş ÜÇ KEZ elle yapıldı, üçünde de bir
-- parçası atlandı:
--   1. Kullanıcılar açıldı, rol atanmadı → `profiles` varsayılan 'goruntuleyici'
--   2. Hesap silinip yeniden açılınca rol VE üyelik birden gitti
--   3. Rol düzeltildi ama üyelik insert'i koşmadı → üyelik = 0
--
-- HİÇBİRİ HATA VERMEDİ. Kullanıcı giriş yaptı, boş ekran gördü, sebep ancak
-- DB'den anlaşıldı. Panelin değeri kolaylık değil: **rol ve üyelik ATOMİK
-- olursa bu sınıf hata imkânsızlaşır.** `updated_at` kolonu + trigger dersinin
-- aynısı — yarısını yapmak, yapmış görünüp yapmamaktır.
--
-- ==========================================================================
-- KARAR 1 — `is_platform_admin` BİR BAYRAK, ROL DEĞİL
-- ==========================================================================
-- Platform admin'i yeni bir ROL olarak eklemedik. Üç gerekçe:
--
--   (a) Roller GÖREVE göre tasarlanır, yetkiye göre değil. "Kullanıcı
--       yönetmek" ≠ "tüm kullanıcı verisini görmek"; platform admin'i
--       `yonetici`'nin klonu yapıp izin çıkarmak, tam da kaçınılması gereken
--       desen.
--   (b) Step 3 rol modelini 6 → 4'e indiriyor. Yeni bir rol o işi büyütürdü;
--       bir bayrak büyütmez.
--   (c) `profiles.role` CHECK'i ve 60 policy rol değerine bağlı. Bayrak
--       hiçbirine dokunmuyor.
--
-- ⚠ Bugün prod'da DÖRT tenant ve BİRDEN FAZLA `yonetici` var (Mek Group'ta 3).
--   Yani `role = 'yonetici'` platform admin'i AYIRT ETMEZ. Bayrak bu yüzden
--   zorunlu — env değişkeniyle yapılsaydı DB tarafı kapısız kalırdı.
--
-- ==========================================================================
-- KARAR 2 — HER ŞEY RPC, `service_role` YOK
-- ==========================================================================
-- `tenants` ve `tenant_memberships` PostgREST'e KAPALI (RLS açık, policy 0,
-- anon/authenticated grant yok). Bu KASITLI ve güvenli; bozulmuyor —
-- policy EKLENMİYOR.
--
-- Erişim `SECURITY DEFINER` RPC'ler üzerinden. Bunun iki sonucu:
--   - `service_role` gerekmiyor. `qa:static`'in `service_role-confined` kuralı
--     onu dört dosyaya kilitliyor (cron/healthz/demo-request/access-request);
--     server action'da kullanmak o sınırı delerdi.
--   - Yetki kapısı RPC'nin İÇİNDE. UI'daki kapı ikinci katman, tek katman değil.
--
-- ⚠ `SECURITY DEFINER` + `search_path` sabitleniyor: fonksiyon RLS'i aşıyor,
--   arama yolu ele geçirilirse yetki de ele geçer.
--
-- ==========================================================================
-- KARAR 3 — ÜYELİK "EKLENMEZ", DEĞİŞTİRİLİR
-- ==========================================================================
-- `custom_access_token_hook` claim'i YALNIZ tek üyelikte yazıyor
-- (`v_count = 1`). İkinci üyelik eklenen kullanıcı için claim HİÇ yazılmaz →
-- kullanıcı SESSİZCE tüm erişimini kaybeder: hata yok, her şey boş gelir.
--
-- Bu yüzden RPC'nin semantiği "üyelik ekle" DEĞİL, "üyeliği DEĞİŞTİR":
-- kullanıcının varsa mevcut üyeliği silinir, yenisi yazılır. Çift üyelik
-- panel üzerinden YAPISAL OLARAK imkânsız — UI'da uyarı vermeye gerek kalmaz.
--
-- Tenant switcher geldiğinde bu kısıt yeniden değerlendirilir.
-- ==========================================================================


-- ==========================================================================
-- 1) BAYRAK
-- ==========================================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_platform_admin boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.is_platform_admin IS
  'Platform-level administrator flag. NOT a role: roles describe a job inside '
  'a tenant, this describes access to the cross-tenant /admin tree. Deliberately '
  'separate from profiles.role so that neither the role CHECK nor any of the 60 '
  'RLS policies has to know about it.';

-- ⚠ Bu kolon `profiles_update_own` policy'siyle kullanıcı tarafından
--   DEĞİŞTİRİLEBİLİR olmamalı. Policy yalnız `auth.uid() = id` denetliyor;
--   kolonu koruyan tek şey grant. İlk sürüm bunu YORUMLA VARSAYIYORDU (Codex
--   P1): prod'da tablo seviyesinde UPDATE grant'i varsa — Supabase'in
--   varsayılanı tam olarak bu — kullanıcı kendi satırında bayrağı açar, layout
--   ve dört RPC kapısının hepsini geçer. Grant'ler 20260904000200'de normalize
--   ediliyor; burada FAIL-CLOSED doğrulanıyor: tutmazsa bu migration uygulanmaz.
DO $$
BEGIN
  IF has_table_privilege('authenticated', 'public.profiles', 'UPDATE') THEN
    RAISE EXCEPTION 'ön kontrol: authenticated tablo seviyesinde UPDATE taşıyor — önce 20260904000200 uygula';
  END IF;
  IF has_column_privilege('authenticated', 'public.profiles', 'is_platform_admin', 'UPDATE')
     OR has_column_privilege('anon', 'public.profiles', 'is_platform_admin', 'UPDATE') THEN
    RAISE EXCEPTION 'ön kontrol: is_platform_admin kullanıcı tarafından yazılabilir — önce 20260904000200 uygula';
  END IF;
  IF has_column_privilege('authenticated', 'public.profiles', 'role', 'UPDATE') THEN
    RAISE EXCEPTION 'ön kontrol: role kullanıcı tarafından yazılabilir (kendi kendine terfi) — önce 20260904000200 uygula';
  END IF;
END $$;


-- ==========================================================================
-- 2) YETKİ KAPISI — tek yerde
-- ==========================================================================
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(
    (SELECT p.is_platform_admin FROM public.profiles p WHERE p.id = auth.uid()),
    false
  );
$$;

COMMENT ON FUNCTION public.is_platform_admin() IS
  'Single gate for every admin_* RPC. Returns false for anonymous callers and '
  'for profiles that do not exist, so the failure mode is closed.';


-- ==========================================================================
-- 3) OKUMA — tenant listesi + sayaçlar
-- ==========================================================================
CREATE OR REPLACE FUNCTION public.admin_list_tenants()
RETURNS TABLE (
  tenant_id   uuid,
  slug        text,
  name        text,
  uye_sayisi  bigint,
  firma       bigint,
  sozlesme    bigint,
  gorev       bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT t.id, t.slug, t.name,
         (SELECT count(*) FROM public.tenant_memberships m WHERE m.tenant_id = t.id),
         (SELECT count(*) FROM public.companies  c WHERE c.tenant_id = t.id),
         (SELECT count(*) FROM public.contracts  k WHERE k.tenant_id = t.id),
         (SELECT count(*) FROM public.tasks      g WHERE g.tenant_id = t.id)
    FROM public.tenants t
   ORDER BY t.slug;
END;
$$;


-- ==========================================================================
-- 4) OKUMA — kullanıcı listesi
-- ==========================================================================
-- ⚠ `uyelik_sayisi` sütunu süs değil: 1'den farklı olan her satır, o
--   kullanıcının hook'tan claim ALAMADIĞI anlamına gelir. 0 ise hiç üyelik
--   yok, 2+ ise hook `v_count = 1` koşulunda takılır. İkisinde de kullanıcı
--   giriş yapar ve boş ekran görür — panelin görünür kılması gereken tam bu.
CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE (
  user_id           uuid,
  email             text,
  display_name      text,
  role              text,
  is_platform_admin boolean,
  tenant_slug       text,
  uyelik_sayisi     bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT p.id, p.email, p.display_name, p.role, p.is_platform_admin,
         (SELECT t.slug
            FROM public.tenant_memberships m
            JOIN public.tenants t ON t.id = m.tenant_id
           WHERE m.user_id = p.id
           ORDER BY t.slug
           LIMIT 1),
         (SELECT count(*) FROM public.tenant_memberships m WHERE m.user_id = p.id)
    FROM public.profiles p
   ORDER BY p.email;
END;
$$;


-- ==========================================================================
-- 5) YAZMA — rol + üyelik, TEK TRANSACTION (bugünkü hatanın panzehiri)
-- ==========================================================================
-- Bir fonksiyon gövdesi tek transaction'da çalışır: `RAISE` ya da herhangi bir
-- hata, o ana kadarki DEĞİŞİKLİKLERİN TAMAMINI geri alır. Rol yazılıp üyelik
-- yazılmadan çıkmak MÜMKÜN DEĞİL.
--
-- ⚠ Üyelik EKLENMİYOR, DEĞİŞTİRİLİYOR (bkz. KARAR 3): önce kullanıcının bütün
--   üyelikleri silinir, sonra tek üyelik yazılır. Çift üyelik yapısal olarak
--   imkânsız.
-- Oturum iptali auth.sessions'a DELETE ister. Fonksiyon sahibinin (bu
-- migration'ı koşturan rol) yetkisi ŞİMDİ doğrulanır — ilk kullanımda değil.
DO $$
BEGIN
  IF to_regclass('auth.sessions') IS NULL THEN
    RAISE EXCEPTION 'ön kontrol: auth.sessions yok — oturum iptali yazılamaz';
  END IF;
  IF NOT has_table_privilege('auth.sessions', 'DELETE') THEN
    RAISE EXCEPTION 'ön kontrol: % rolünün auth.sessions üzerinde DELETE yetkisi yok', current_user;
  END IF;
END $$;

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

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'user not found' USING ERRCODE = '23503';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.tenants WHERE id = p_tenant_id) THEN
    RAISE EXCEPTION 'tenant not found' USING ERRCODE = '23503';
  END IF;

  -- Üyelik kümesi DEĞİŞİYOR MU — oturum iptali kararı için, yazmadan önce.
  -- "Tam olarak {p_tenant_id}" ise değişmiyor (yalnız rol düzeltmesi).
  v_membership_changes :=
       (SELECT count(*) FROM public.tenant_memberships WHERE user_id = p_user_id) <> 1
    OR NOT EXISTS (SELECT 1 FROM public.tenant_memberships
                    WHERE user_id = p_user_id AND tenant_id = p_tenant_id);

  -- Rol CHECK'i tabloda zaten var; burada tekrar edilmiyor ki iki yerde
  -- ayrışmasın. Geçersiz rol, UPDATE sırasında CHECK ihlaliyle döner ve
  -- transaction'ın tamamını geri alır.
  UPDATE public.profiles SET role = p_role WHERE id = p_user_id;

  DELETE FROM public.tenant_memberships WHERE user_id = p_user_id;
  INSERT INTO public.tenant_memberships (user_id, tenant_id)
  VALUES (p_user_id, p_tenant_id);

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
  -- KALAN PENCERE: mevcut access token süresi (proje ayarı, varsayılan 3600 s).
  -- Bu pencerede eski token, claim'e güvenen 43 tenant policy'sinde eski
  -- tenant'ı okur. profiles okuması ve görev atanan guard'ı (20260904000100,
  -- KARAR 6) claim'i canlı üyelikle doğruluyor — orada pencere yok. Kalanını
  -- kapatmak `current_user_active_tenant()`'ın aynı doğrulamayı yapmasını
  -- ister; o fonksiyon repo dışında ve gövdesi elimizde yok — ayrı karar.
  IF v_membership_changes THEN
    DELETE FROM auth.sessions WHERE user_id = p_user_id;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.admin_assign_role_and_tenant(uuid, text, uuid) IS
  'Assigns role and tenant membership atomically. Written because doing the two '
  'separately failed three times in a row while setting up the Mek Group tenant, '
  'each time silently: the user could log in and simply saw nothing. Membership '
  'is REPLACED rather than added, because custom_access_token_hook only issues a '
  'claim for a single membership and a second one would silently remove all access. '
  'When the membership set changes, the user''s auth.sessions are deleted so the '
  'stale active_tenant_id claim cannot be refreshed; the user re-logs in.';


-- ==========================================================================
-- 6) YAZMA — tenant oluştur
-- ==========================================================================
CREATE OR REPLACE FUNCTION public.admin_create_tenant(
  p_slug text,
  p_name text
)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  IF btrim(coalesce(p_slug, '')) = '' OR btrim(coalesce(p_name, '')) = '' THEN
    RAISE EXCEPTION 'slug and name are required' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.tenants (slug, name)
  VALUES (lower(btrim(p_slug)), btrim(p_name))
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;


-- ==========================================================================
-- 7) GRANT — yalnız authenticated, anon YOK
-- ==========================================================================
-- Supabase public şema fonksiyonlarına varsayılan GRANT verir; burada
-- açıkça daraltılıyor. Yetki asıl olarak fonksiyon İÇİNDEKİ kapıdan geliyor,
-- ama `anon`'a EXECUTE bırakmak gereksiz bir yüzeydir.
REVOKE ALL ON FUNCTION public.is_platform_admin()                          FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_list_tenants()                         FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_list_users()                           FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_assign_role_and_tenant(uuid, text, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_create_tenant(text, text)              FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.is_platform_admin()                          TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_tenants()                         TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_users()                           TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_assign_role_and_tenant(uuid, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_tenant(text, text)              TO authenticated;


-- ==========================================================================
-- 8) İLK PLATFORM ADMIN — elle, bu dosyada DEĞİL
-- ==========================================================================
-- Bayrak hiçbir hesapta açık değil. Uygulamadan sonra elle:
--
--   update public.profiles set is_platform_admin = true
--    where email = '<furkan-eposta>';
--
--   select email, is_platform_admin from public.profiles
--    where is_platform_admin;          -- tam olarak 1 satır dönmeli
--
-- Dosyaya yazılmadı çünkü e-posta bir ortam gerçeği, şema değil — ve bir
-- migration'a gömülen hesap, başka bir ortamda yanlış kişiye yetki verir.
-- ==========================================================================
