-- ==========================================================================
-- BPS Batch 10 Phase 2 — announcements (Dashboard "Duyurular")
-- ==========================================================================
-- Batch 10 Phase 2 kararı (TASK_ROADMAP.md:391, CHANGELOG.md:96) Duyurular'ın
-- ŞEKLİNİ zaten kilitledi: Dashboard-only, yönetici-authored, tek yönlü kompakt
-- şerit, local demo state. Bu dosya yeni bir kapsam açmıyor — o kararın gerçek
-- truth'a bağlanması. Dashboard'daki kart bugün EmptyState olarak duruyor
-- (dashboard/page.tsx:850, "Duyuru akışı henüz bağlı değil.").
--
-- Emsal `critical_dates` (20260407001100): kurumsal seviye, firma-scoped DEĞİL,
-- broad-read, yönetici-only write. Duyurular birebir aynı topoloji. Yeni
-- mekanizma icat edilmedi.
--
-- BPS SINIRLARI — bu tablo bilerek YAPMADIKLARI ile tanımlı:
--   - reply / reaction / thread YOK  → chat değil
--   - recipient / read-state YOK     → inbox değil
--   - notification / push / badge YOK → o Bildirimler (C), ayrı karar
--   - firma bağlamı (company_id) YOK → Firma Detay merkeziliğini taşımaz
--
-- ⚠ WRITTEN, NOT APPLIED.
--
-- ==========================================================================
-- BAĞIMLILIKLAR — PROD'DA DOĞRULANDI 2026-08-27
-- ==========================================================================
-- Aşağıdaki policy'ler iki repo-DIŞI fonksiyona dayanıyor. İkisi de bu repo'nun
-- hiçbir migration'ında tanımlı DEĞİL — tenantization repo migration'larında
-- yok (bilinen durum, Faz 2 migration 1 bunları kaydedecek). Bu yüzden kör
-- yazılmadılar; prod'dan tek tek okundular:
--
--   current_user_active_tenant() → uuid · SECURITY DEFINER · STABLE · argümansız
--   current_user_role()          → text · SECURITY DEFINER · STABLE · argümansız
--
-- Policy'ler prod `critical_dates` policy'lerinin BİREBİR deseni (2026-08-27
-- `pg_policies` okuması): rol kapısı + tenant kapısı, `TO` belirtilmemiş
-- (yani `{public}` — companies/tasks `{authenticated}` taşıyor ama bu tablo
-- onların değil critical_dates'in kardeşi: kurumsal seviye, company_id yok).
--
-- Bilinçli TEK sapma: UPDATE policy'si yok — karar notu (3).
--
-- ⚠ Bu dosya uygulandığında yukarıdaki iki fonksiyon prod'da MEVCUT olmalı.
--   Sıfırdan kurulan bir ortamda (Faz 2 öncesi) bu migration policy yaratma
--   aşamasında patlar. Aynı kısıt zaten `critical_dates` için de geçerli.
--
-- ==========================================================================
-- KARAR NOTLARI — dördü de bilinçli, hepsi geri alınabilir
-- ==========================================================================
-- (1) TEK METİN ALANI (`body`), başlık/gövde ayrımı YOK.
--     Batch 10 "kompakt tek yönlü şerit" diyor. Şerit tek satır render
--     ediyorsa title+body iki katman fazladan yapı olur. Başlık gerçekten
--     gerekirse sonra additive kolon olarak eklenir; şimdi eklemek
--     speküle etmek olur.
--
-- (2) `updated_at` KOLONU YOK — dolayısıyla trigger'ı da yok.
--     Batch 10 "editing yok" diyor; edit yolu olmayan bir kayıtta güncelleme
--     damgası hiç değişmez. 13 tablodaki `set_updated_at` konvansiyonundan
--     bilinçli sapma: olmayan yazma yolunun garantisi de olmaz. Edit ileride
--     açılırsa kolon + trigger birlikte gelir (2026-08-27'de kapatılan
--     boşluğun aynısını yeniden açmamak için: ikisi ASLA ayrı gelmez).
--
-- (3) DELETE VAR, UPDATE YOK.
--     Batch 10 metni "editing/deletion/archive yok" diyor. Delete burada
--     bilinçli sapma ve gerekçesi operasyonel: yazma yönetici-only olduğu
--     için yanlış yazılmış bir duyuruyu Dashboard'dan kaldırmanın BAŞKA
--     hiçbir yolu kalmıyor — kayıt kalıcı asılı kalır. Bu "edit" değil,
--     geri alma. UPDATE policy'si bilerek YAZILMADI: RLS varsayılanı deny,
--     yani edit yolu DB sınırında kapalı, yalnız UI'da değil.
--
-- (4) SELECT POLICY'Sİ PROD `critical_dates` DESENİNİN BİREBİR AYNISI:
--     6 rol listesi + tenant filtresi, `TO` belirtilmeden (yani PUBLIC).
--
--     İlk taslak yalnız tenant filtresi taşıyordu; gerekçe Step 3'ün
--     tek-RLS-yeniden-yazımına bir tablo daha eklememekti. O gerekçe
--     GEÇERSİZ ÇIKTI: rol modeli 6 → 4'e inerken bu tablonun görünürlüğü
--     zaten rol-ilgili bir karar (ROLE_MATRIX.md:351), yani Step 3 buraya
--     nasılsa dokunacak. Erteleme değil, yer değiştirmeydi.
--
--     Daha ağır basan ikinci gerekçe: rol listesi İKİNCİ SAVUNMA KATMANI.
--     Yalnız tenant filtresiyle, okuma izni tek bir fonksiyonun
--     (`current_user_active_tenant()`) döndürdüğü değere bağlı kalırdı. Prod
--     emsali iki kapı taşıyor; tek kapıya inmek sessiz bir zayıflama olurdu.
--
--     `TO` bilinçli olarak yazılmadı: prod `critical_dates` policy'lerinin
--     rolü `{public}` (companies/tasks'ta `{authenticated}`, ama bu tablo
--     onların değil critical_dates'in kardeşi — kurumsal seviye, company_id
--     yok). `TO` yazmamak PUBLIC demek, yani birebir hizalı.
--
--     ⚠ Görünürlük kararı UI'da, RLS'te DEĞİL: Dashboard kartı bugün
--     `role !== "muhasebe"` ile gizli (dashboard/page.tsx:851), oysa Batch 10
--     closeout "visible to all roles" diyor (CHANGELOG.md:96) ve
--     ROLE_MATRIX.md:351 "yönetim geneli görünürlük otomatik açılmamalıdır"
--     diyor. Üçü aynı anda doğru olamaz; bu dosya çelişkiyi ÇÖZMÜYOR, yalnız
--     RLS'i geniş bırakıp kararı UI katmanına bırakıyor. Çelişkinin
--     çözülmesi ayrı bir docs kararı.
-- ==========================================================================


CREATE TABLE IF NOT EXISTS public.announcements (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Tenant sahipliği. NOT NULL + DEFAULT YOK: değer sunucuda
  -- `current_user_active_tenant()` ile çözülür, asla client payload'ından
  -- gelmez (critical_dates create yolunun aynısı).
  tenant_id   uuid NOT NULL,

  -- Tek metin alanı — karar notu (1).
  body        text NOT NULL CHECK (char_length(btrim(body)) > 0),

  -- Yazarı. ON DELETE SET NULL emsali `tasks.assigned_to_user_id`: bir profil
  -- silindiğinde duyuru kaybolmaz, yalnız yazarsız kalır.
  created_by  uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Okuma yolunun tamamı: "bu tenant'ın son N duyurusu, yeniden eskiye".
CREATE INDEX IF NOT EXISTS announcements_tenant_created_idx
  ON public.announcements(tenant_id, created_at DESC);

COMMENT ON TABLE public.announcements IS
  'Batch 10 Phase 2 Dashboard "Duyurular" — one-directional, yonetici-authored '
  'management announcements. NOT chat, NOT inbox, NOT notifications: no reply, '
  'no reaction, no recipient, no read-state, no company scope. Read path is '
  'the Dashboard strip only.';


-- ==========================================================================
-- RLS — tenant-scoped read, yonetici-only write, NO update path
-- ==========================================================================

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- SELECT: prod `critical_dates_select` deseninin birebir aynısı — 6 rol +
-- tenant, karar notu (4). Rol bazlı ek görünürlük kararı (muhasebe) UI
-- katmanında kalıyor; bu policy onu DB'ye taşımıyor.
CREATE POLICY announcements_select ON public.announcements
  FOR SELECT USING (
    current_user_role() IN (
      'yonetici', 'operasyon', 'ik', 'muhasebe', 'goruntuleyici', 'partner'
    )
    AND tenant_id = current_user_active_tenant()
  );

-- INSERT: yalnız yönetici, yalnız kendi tenant'ına.
CREATE POLICY announcements_insert ON public.announcements
  FOR INSERT WITH CHECK (
    current_user_role() = 'yonetici'
    AND tenant_id = current_user_active_tenant()
  );

-- DELETE: yalnız yönetici, yalnız kendi tenant'ında — karar notu (3).
CREATE POLICY announcements_delete ON public.announcements
  FOR DELETE USING (
    current_user_role() = 'yonetici'
    AND tenant_id = current_user_active_tenant()
  );

-- UPDATE policy'si BİLEREK YOK — karar notu (3). RLS varsayılanı deny, yani
-- edit yolu DB sınırında kapalı.
