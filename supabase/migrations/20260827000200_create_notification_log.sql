-- ==========================================================================
-- BPS — notification_log (e-posta bildirim idempotency defteri)
-- ==========================================================================
-- Batch 10'un "notification/push/badge introduced değil" kararı KISMEN geri
-- alındı (2026-08-27, Furkan onayı): **yalnız e-posta açıldı.** Push ve badge
-- AÇILMADI — onlar A aşamasında (uygulama içi bildirim merkezi) ayrıca karara
-- bağlanacak. Bu dosya yalnız e-posta gönderiminin "bir daha gönderme"
-- defteridir; hiçbir uygulama içi yüzey, rozet ya da okundu durumu üretmez.
--
-- ⚠ WRITTEN, NOT APPLIED.
--
-- ==========================================================================
-- KARAR 1 — TİP BAŞINA TABLO DEĞİL, TEK GENEL DEFTER
-- ==========================================================================
-- Mevcut `contract_expiry_emails_sent` tek bir tipe özel: `contract_id` kolonu
-- doğrudan `contracts`'a FK. Aynı deseni tekrarlamak, modül planı 5.3'ün
-- saydığı her tip için ayrı tablo demekti — görev gecikmesi, evrak süresi,
-- sözleşme yenileme, talep yaşlanması, kritik tarih, yönlendirme = altı tablo,
-- altı migration, altı RLS bloğu, altı servis dosyası. Ölçülen tip sayısı bu
-- kararı tercihe değil sayıya bağlıyor: bugün 4 tip açılıyor, plan 6+ diyor.
--
-- Bunun karşılığında ÖDENEN BEDEL, ve neden ödenebilir olduğu:
--   `entity_id` polimorfik olduğu için FK YOK. Yani `ON DELETE CASCADE`
--   kaybediliyor; bir kayıt silinirse defterde yetim satır kalır.
--
--   ⚠ DÜZELTME (Codex, 2026-08-27): bu dosyanın ilk hâli "contracts ve tasks'ta
--   DELETE policy hiç yok" diyordu. YANLIŞTI — ölçüm `grep "FOR DELETE"` ile
--   yapılmış, oysa migration'ların çoğu küçük harf `for delete` yazıyor.
--   Case-insensitive tam sayım: **12 tabloda DELETE policy var**, `tasks`
--   (20260407000800:96, yonetici-only) ve `contracts` (20260407000500:295)
--   dahil. Yani yetim satır DÖRT tipte de mümkün, iki tipte değil.
--
--   Karar değişmiyor, çünkü zararsızlık gerekçesi silinebilirlikten değil
--   defterin doğasından geliyor: append-only, satır yalnız idempotency
--   anahtarı taşıyor, ve silinen bir kayıt yeniden yaratılırsa YENİ `id`
--   alacağı için yeni anahtar üretir — eski satır yanlış bir "zaten
--   gönderildi" kararı ÜRETEMEZ. Tek maliyeti ölü satır birikmesi; defter
--   tenant+tarih index'i taşıdığı için ileride budanabilir.
--
-- İDEMPOTENCY: PK `(kind, entity_id, recipient_profile_id, threshold_key)`.
--   Mevcut tablonun `(contract_id, recipient_profile_id, threshold_days)`
--   üçlüsünün birebir genellemesi. `threshold_days integer` yerine
--   `threshold_key text`: yeni tiplerin eşikleri gün cinsinden değil
--   ("overdue" bir gün sayısı değil, bir durum). Sayıya zorlamak
--   `threshold_days = 0` gibi anlamsız değerler üretirdi.
--
-- ==========================================================================
-- KARAR 2 — tenant_id AÇIK, dolaylı türetme DEĞİL
-- ==========================================================================
-- Mevcut tabloda `tenant_id` yok; tenant `contract_id` üzerinden dolaylı
-- türetilebiliyordu. Yeni tabloda AÇIK ve NOT NULL. Üç gerekçe:
--   (1) `entity_id` polimorfik — dolaylı türetme "hangi tabloya join?"
--       sorusunu her sorguda yeniden sordurur, tek bir join yolu yok.
--   (2) Bir RLS politikası ileride yazılırsa (bkz. KARAR 3), dolaylı tenant
--       o politikayı hedef tabloya bağımlı kılar; polimorfik hedefte bu
--       yazılamaz.
--   (3) 2026-08-27'de tenant arıza sınıfı kapatıldı. Tenant'sız doğan her
--       yeni tablo o borcu geri açar — `financial_summaries`'in unique
--       index'lerinde ölçülen sessiz cross-tenant ezme sınıfı buradan çıktı.
--
-- Değer OTURUMDAN DEĞİL VERİDEN gelir: yazıcı, bildirimi tetikleyen kaydın
-- (`contracts`/`tasks`/`documents`/`appointments`) kendi `tenant_id`'sini
-- okur ve onu yazar. `derive_*_from_mizan` ile aynı ilke — sahte bir JWT
-- claim'i yazının nereye gittiğini yönlendiremez.
--
-- ==========================================================================
-- KARAR 3 — RLS AÇIK, POLICY SIFIR (PostgREST'e kapalı)
-- ==========================================================================
-- Mevcut `contract_expiry_emails_sent` deseninin aynısı: RLS enabled, kullanıcı
-- policy'si yok. Sonuç: tabloya yalnız `service_role` (cron) erişir, PostgREST
-- üzerinden hiçbir rol okuyamaz/yazamaz.
--
-- Bu YAGNI değil, kasıt: defter bir SİSTEM kaydı, kullanıcı yüzeyi değil.
-- "Gönderilen bildirimler" ekranı ileride istenirse o zaman bir SELECT
-- policy'si eklenir (rol kapısı + tenant kapısı, `announcements_select`
-- deseni). Bugün eklemek, hiçbir ekranın okumadığı bir yüzeyi açık bırakmak
-- olurdu.
--
-- ⚠ RLS enabled + policy 0 kombinasyonu SESSİZ BOŞ SONUÇ üretir, hata değil.
--   Bir gün bir ekran bu tabloyu okumaya kalkarsa "veri yok" görür ve bu
--   yanıltıcıdır. Yeni okuyucu eklenirse policy de eklenmelidir.
--
-- ==========================================================================
-- KARAR 4 — EŞİKLER KODDA SABİT, KONFİGÜRE DEĞİL
-- ==========================================================================
-- Ölçüldü: `Ayarlar > Bildirim Kuralları` sekmesi MEVCUT ama BOŞ —
-- `ayarlar/page.tsx:617` "Bildirim kuralları yapılandırması henüz kapsam
-- dışıdır." Bağlı bir konfigürasyon yok.
--
-- Konfigüre edilebilir eşik demek: kural tablosu + RLS + Ayarlar UI +
-- doğrulama + "kural değişince geçmiş stamp'ler ne olacak" sorusu. Bunların
-- hiçbiri B'nin kapsamında değil ve hiçbiri bugün istenmedi.
--
-- Bu yüzden `threshold_key` üzerinde CHECK YOK: eşik değerleri kodda tek
-- yerde (`src/lib/notification-kinds.ts`) sabit, ve orayı değiştirmek
-- migration gerektirmemeli. Buna karşılık `kind` üzerinde CHECK VAR — tip
-- eklemek bilinçli bir karardır ve STATUS_DICTIONARY disiplinine tabidir:
-- yeni tip = yeni migration = açık onay.
-- ==========================================================================


CREATE TABLE IF NOT EXISTS public.notification_log (
  -- Bildirim tipi. CHECK bilinçli: yeni tip açmak migration ister.
  kind                 text NOT NULL
                         CHECK (kind IN (
                           'contract_expiry',
                           'task_overdue',
                           'document_expiry',
                           'appointment_reminder'
                         )),

  -- Tetikleyen kaydın id'si. FK YOK — polimorfik (bkz. KARAR 1).
  entity_id            uuid NOT NULL,

  -- Alıcı. Burada FK VAR: profil silinirse defter satırı da gitmeli, yoksa
  -- silinmiş bir kullanıcı adına "gönderildi" kaydı asılı kalır.
  recipient_profile_id uuid NOT NULL
                         REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- Eşik anahtarı: '30d', 'overdue', '1d' … CHECK yok (bkz. KARAR 4).
  threshold_key        text NOT NULL CHECK (char_length(btrim(threshold_key)) > 0),

  -- Tenant, VERİDEN yazılır (bkz. KARAR 2).
  tenant_id            uuid NOT NULL,

  sent_at              timestamptz NOT NULL DEFAULT now(),

  -- Idempotency: mevcut tablonun üçlüsünün genellemesi + kind.
  PRIMARY KEY (kind, entity_id, recipient_profile_id, threshold_key)
);

-- Tenant bazlı denetim/temizlik okuması için. PK zaten (kind, entity_id, …)
-- önekiyle idempotency lookup'ını karşılıyor, bu index onu tekrarlamıyor.
CREATE INDEX IF NOT EXISTS notification_log_tenant_sent_idx
  ON public.notification_log(tenant_id, sent_at DESC);

COMMENT ON TABLE public.notification_log IS
  'E-mail notification idempotency ledger. System-owned: written only by the '
  'cron service_role client, unreadable through PostgREST by design (RLS on, '
  'zero policies). NOT an in-app notification centre: no read-state, no badge, '
  'no push — those remain closed and belong to a separate decision.';

COMMENT ON COLUMN public.notification_log.entity_id IS
  'Id of the record that triggered the notification. Deliberately NOT a foreign '
  'key: the column is polymorphic across contracts/tasks/documents/appointments. '
  'Orphan rows are harmless — the ledger is append-only and a recreated record '
  'gets a fresh id, so a stale row can never produce a false "already sent".';


-- ==========================================================================
-- RLS — açık, policy yok (bkz. KARAR 3)
-- ==========================================================================

ALTER TABLE public.notification_log ENABLE ROW LEVEL SECURITY;

-- Bilerek hiçbir policy tanımlanmadı. Erişim yalnız service_role üzerinden.
-- Bir okuma yüzeyi açılırsa buraya rol + tenant kapılı bir SELECT policy'si
-- eklenmelidir (`announcements_select` deseni).


-- ==========================================================================
-- contract_expiry_emails_sent — EMEKLİ, ama DROP EDİLMEDİ
-- ==========================================================================
-- Contract expiry akışı bu tablodan `notification_log`'a taşındı. Damgalar
-- yukarıdaki backfill ile taşınır — kaç satır olduğundan bağımsız olarak.
--
-- Tablo yine de DROP EDİLMİYOR. Gerekçe: drop geri alınamaz ve tablonun kaç
-- satır taşıdığı hâlâ KESİN DEĞİL — iki kaynak çelişiyor (bir prod raporu
-- "0 satır" dedi, `CHANGELOG.md:38` "2 satır" diyor). Backfill bu belirsizliği
-- zararsız kılıyor ama bir DROP kılmaz: yanlış tarafta olursak veri gider.
-- Emekliliği burada işaretlenir, düşürülmesi ayrı bir karar (TASK_ROADMAP).
-- ==========================================================================
-- BACKFILL — eski damgalar taşınır (idempotency SÜREKLİLİĞİ)
-- ==========================================================================
-- ⚠ Bu blok Codex bulgusu üzerine eklendi (2026-08-27). Dosyanın ilk hâli
--   "tabloda 0 satır var, taşınacak geçmiş yok" diyordu. Bu bir ÖLÇÜME değil
--   tek bir rapora dayanıyordu ve repo'daki kayıt bunun tersini söylüyor:
--   `CHANGELOG.md:38` — "contract_expiry_emails_sent tablosu değişmedi
--   (2 satır, idempotency 23505 doğru skip etti)".
--
--   İki kaynak çelişiyor ve hangisinin güncel olduğu buradan bilinemez. Bu
--   yüzden karar ölçüme BAĞIMLI OLMAYACAK şekilde değiştirildi: backfill
--   koşulsuz çalışır ve idempotenttir.
--     - Tabloda satır varsa → taşınır, o hatırlatmalar bir daha gönderilmez.
--     - Tablo boşsa       → hiçbir şey yapmaz.
--   Her iki dünyada da doğru sonuç verir, sayımın ne olduğundan bağımsız.
--
-- `threshold_days = 30` sabit (CHECK ile zorlanmış) → `threshold_key = '30d'`.
-- `tenant_id` sözleşmenin KENDİ tenant'ından okunur, oturumdan değil.
-- JOIN, sözleşmesi silinmiş damgaları eler — onlar zaten cascade ile gitmişti.
INSERT INTO public.notification_log
  (kind, entity_id, recipient_profile_id, threshold_key, tenant_id, sent_at)
SELECT
  'contract_expiry',
  s.contract_id,
  s.recipient_profile_id,
  '30d',
  c.tenant_id,
  s.sent_at
FROM public.contract_expiry_emails_sent s
JOIN public.contracts c ON c.id = s.contract_id
ON CONFLICT DO NOTHING;


COMMENT ON TABLE public.contract_expiry_emails_sent IS
  'RETIRED 2026-08-27 — superseded by public.notification_log '
  '(kind = ''contract_expiry''). No code path writes here any more. Kept, not '
  'dropped: its stamps were backfilled above, and dropping a table is a '
  'separate, deliberate decision.';
