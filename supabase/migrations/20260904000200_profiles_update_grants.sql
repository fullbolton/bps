-- ==========================================================================
-- BPS — profiles UPDATE grant'lerinin normalize edilmesi
-- ==========================================================================
-- ✅ APPLIED 2026-09-05 (Furkan, SQL Editor) + VERIFIED + ledger repaired.
--    Applied content sha256 27c086f68c59df3e22e9f93c931785de932f3abf9e9a0750bc68bc7322a674c9
--    (this header note was added AFTER apply; the body below is unchanged).
--    ÖNCE ölçüldü:  tablo_update=true  role_yazabilir=true  anon_yazabilir=true
--                   → açık CANLIYDI (Faz 0'dan beri).
--    SONRA ölçüldü: tablo_update=false role_yazabilir=false anon_yazabilir=false
--                   display_name_yazabilir=true (korundu).
--    Grantor ölçümü: sahip=postgres, her grant grantor=postgres → REVOKE tuttu.
-- ⚠ UYGULAMA SIRASI: bu dosya ÖNCE (yapıldı). Sonra 20260904000100 (tenant
--   kapsamı), sonra 20260827000400 (admin paneli — ön kontrolü bunu şart koşar).
--
-- ==========================================================================
-- NEDEN — Codex bulgusu (2026-09-04, P1) ve ardındaki daha büyük ihtimal
-- ==========================================================================
-- `profiles_update_own` policy'si şu:
--     using (auth.uid() = id)  with check (auth.uid() = id)
-- WITH CHECK'in üstündeki yorum "Disallow self-promotion: a user cannot change
-- their own role or unit" diyor — ama bu bir YORUM, uygulanmış bir kontrol
-- değil. Rolü kullanıcının kendisinden koruyan TEK şey Faz 0'ın kolon grant'i:
--     grant update (display_name) on public.profiles to authenticated;
--
-- Faz 0, tablo seviyesindeki UPDATE'i REVOKE ETMEDİ. Supabase ise `public`
-- şemada yaratılan her tabloya varsayılan olarak tablo seviyesinde ALL verir
-- (ALTER DEFAULT PRIVILEGES ... GRANT ALL ON TABLES TO anon, authenticated).
-- İkisi birlikteyse kolon grant'i hiçbir şeyi daraltmaz — tablo seviyesi
-- zaten her kolonu kapsıyor — ve sonuç:
--
--     PATCH /rest/v1/profiles?id=eq.<kendi-id>  { "role": "yonetici" }
--
-- her authenticated kullanıcı için ÇALIŞIR. Policy geçer (kendi satırı),
-- grant geçer (tablo seviyesi), CHECK geçer ('yonetici' geçerli değer).
-- Bu, `is_platform_admin` bayrağından bağımsız ve ondan ağır bir açık:
-- rol modelinin tamamı kendi kendine terfiye açık olur.
--
-- Prod'da tablo seviyesi grant'in VAR OLUP OLMADIĞI ÖLÇÜLMEDİ — bu dosya iki
-- durumda da aynı sonucu üretir: yoksa hiçbir şey değişmez ve son kontrol
-- geçer; varsa kaldırılır ve son kontrol yine geçer. Ölçüm önce yapılmalı
-- (aşağıdaki NOTICE bloğu öncesini raporlar), ama düzeltme ölçüme bağlı değil.
--
-- ==========================================================================
-- KARAR — grant normalize et + fail-closed doğrula; policy'ye dokunma
-- ==========================================================================
-- Alternatif, WITH CHECK'e "role/unit eski değeriyle aynı olmalı" alt sorgusu
-- eklemekti. Doğru ama daha akıllı bir policy; 30 policy'lik migration'da beş
-- desen çıkmasının sebebi tam olarak akıllı policy'lerdi. Grant, tek satırda
-- söylediği şeyi yapar: authenticated yalnız display_name yazar. Policy-düzeyi
-- ikinci kat Step 3 kalemi olarak kaydedildi, burada YOK.
--
-- INSERT / DELETE'e DOKUNULMUYOR: profiles'ta o iki komut için policy yok ve
-- RLS açık → grant olsa da reddedilir. SELECT'e dokunulmuyor: okuma kapsamı
-- 20260904000100'ün işi.
-- ==========================================================================

BEGIN;

-- 0) ÖNCESİNİ RAPORLA — bu NOTICE'lar SQL editor çıktısında görünür.
--    `true` görülürse açık BUGÜN canlıydı; kaydet.
DO $$
BEGIN
  RAISE NOTICE 'ÖNCE  authenticated tablo-UPDATE : %',
    has_table_privilege('authenticated', 'public.profiles', 'UPDATE');
  RAISE NOTICE 'ÖNCE  authenticated role-UPDATE  : %',
    has_column_privilege('authenticated', 'public.profiles', 'role', 'UPDATE');
  RAISE NOTICE 'ÖNCE  anon tablo-UPDATE          : %',
    has_table_privilege('anon', 'public.profiles', 'UPDATE');
END $$;

-- 1) NORMALİZE — tablo seviyesini kaldır, tek kolonu geri ver
REVOKE UPDATE ON public.profiles FROM PUBLIC, anon, authenticated;
GRANT  UPDATE (display_name) ON public.profiles TO authenticated;

-- 2) SON KONTROL — biri tutmazsa COMMIT olmaz
DO $$
DECLARE
  c text;
BEGIN
  IF has_table_privilege('authenticated', 'public.profiles', 'UPDATE') THEN
    RAISE EXCEPTION 'son kontrol: authenticated hâlâ tablo seviyesinde UPDATE taşıyor';
  END IF;
  IF has_table_privilege('anon', 'public.profiles', 'UPDATE')
     OR has_any_column_privilege('anon', 'public.profiles', 'UPDATE') THEN
    RAISE EXCEPTION 'son kontrol: anon profiles üzerinde UPDATE taşıyor';
  END IF;

  -- display_name DIŞINDA hiçbir kolon authenticated tarafından yazılamaz.
  -- Kolon listesi katalogdan okunur — ileride eklenen kolon (is_platform_admin
  -- dahil) da otomatik kapsanır.
  FOR c IN
    SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'profiles'
       AND column_name <> 'display_name'
  LOOP
    IF has_column_privilege('authenticated', 'public.profiles', c, 'UPDATE') THEN
      RAISE EXCEPTION 'son kontrol: authenticated % kolonunu yazabiliyor', c;
    END IF;
  END LOOP;

  IF NOT has_column_privilege('authenticated', 'public.profiles', 'display_name', 'UPDATE') THEN
    RAISE EXCEPTION 'son kontrol: display_name grant''i kayboldu — Ayarlar > ad değiştirme kırılır';
  END IF;

  RAISE NOTICE 'SONRA authenticated yalnız display_name yazabilir — doğrulandı';
END $$;

COMMIT;
