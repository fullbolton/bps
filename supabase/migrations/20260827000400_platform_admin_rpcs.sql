-- ==========================================================================
-- BPS — Platform Admin (/admin) veri katmanı
-- ==========================================================================
-- Karar: platform admin paneli açılıyor (2026-08-27, Furkan onayı).
-- FAZ 1: yalnız platform admin, /admin ağacında, tenant + kullanıcı yönetimi.
-- FAZ 2 (tenant admin, /ayarlar) bu dosyanın kapsamında DEĞİL.
--
-- ⚠ WRITTEN, NOT APPLIED.
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
--   DEĞİŞTİRİLEBİLİR olmamalı. Mevcut policy `with check (auth.uid() = id)`
--   taşıyor ve kolon bazlı kısıt YOK — ama `grant update (display_name)` ile
--   yalnız o kolona yetki verilmiş durumda, yani PostgREST üzerinden bu kolon
--   yazılamaz. Grant listesi değişirse bu koruma kalkar.
--   Doğrulama: `select column_name from information_schema.column_privileges
--               where table_name='profiles' and grantee='authenticated'
--                 and privilege_type='UPDATE';`  → yalnız display_name


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

  -- Rol CHECK'i tabloda zaten var; burada tekrar edilmiyor ki iki yerde
  -- ayrışmasın. Geçersiz rol, UPDATE sırasında CHECK ihlaliyle döner ve
  -- transaction'ın tamamını geri alır.
  UPDATE public.profiles SET role = p_role WHERE id = p_user_id;

  DELETE FROM public.tenant_memberships WHERE user_id = p_user_id;
  INSERT INTO public.tenant_memberships (user_id, tenant_id)
  VALUES (p_user_id, p_tenant_id);
END;
$$;

COMMENT ON FUNCTION public.admin_assign_role_and_tenant(uuid, text, uuid) IS
  'Assigns role and tenant membership atomically. Written because doing the two '
  'separately failed three times in a row while setting up the Mek Group tenant, '
  'each time silently: the user could log in and simply saw nothing. Membership '
  'is REPLACED rather than added, because custom_access_token_hook only issues a '
  'claim for a single membership and a second one would silently remove all access.';


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
