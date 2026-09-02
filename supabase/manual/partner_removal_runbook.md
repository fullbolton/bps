# Partner Rolünü Kaldırma — Runbook

**Karar:** partner rolü kalkıyor (2026-08-27, Furkan). Kesin.
**Durum:** ⚠ HAZIRLIK — **policy bölümü prod dökümü olmadan yazılamaz, boş.**
**Sıra:** bu iş → izolasyon testi → Faz 2 → Step 3'ün kalanı.

---

## Neden bu sıra

Faz 2'nin işi prod'u repo'ya kaydetmek. **Partner'dan ÖNCE yapılsaydı**, prod'un
partner'lı hâli kaydedilir, sonra silinir ve baseline iki kez yazılırdı.
Kaydetmek onaylamak değildir — ama yanlış anı kaydetmek de boşa iştir.

İzolasyon testi de partner çıktıktan **sonra**: partner policy'leri RLS'i
değiştiriyor, önce test edilirse iki kez test edilir.

---

## Kapsam — ölçüldü (2026-08-27)

| Katman | Büyüklük | Not |
|---|---|---|
| Repo migration | **18 dosya** partner içeriyor | En yoğunu `20260407000200_create_companies_anchor.sql` (56 geçiş): tablo + fonksiyon + policy'ler orada |
| Uygulama kodu | **43 dosya** | 15 ekran · 12 servis · 7 supabase katmanı · 3 bildirim · tipler · AuthContext |
| `partner_company_assignments` | **0 satır** | Veri kaybı yok |
| Hesap | `satis@bps.local`, rol `partner` | **SİLİNECEK** — rol değiştirilmeyecek |

**Migration'lar DÜZENLENMEYECEK.** Geçmiş kayıttır; partner kaldırma yeni bir
migration olur. Eski dosyalar partner içermeye devam eder ve sıfırdan kurulan
bir DB'de partner policy'leri yine doğar — bunu Faz 2 çözer, bu runbook değil.

---

## ⚠ ÖN KOŞUL — prod policy dökümü

Bu iş prod'daki policy'lerin **tam metni olmadan yazılamaz.** Repo'daki tanımlar
prod'un kanıtı değil (`PROD_SCHEMA_DRIFT.md`): prod 43 tenant koşullu policy
taşıyor, repo sıfır. Partner dallarını repo'ya bakarak kaldırmak, prod'da
olmayanı silmeye ya da olanı kaçırmaya çalışmaktır.

```sql
-- KAPSAM + GERİ DÖNÜŞ. Çıktı bu dosyanın "Policy değişiklikleri" bölümünü
-- doldurur VE değiştirilen her policy'nin ÖNCESİNİ saklar.
select tablename, policyname, cmd, roles, qual, with_check
  from pg_policies
 where schemaname = 'public'
 order by tablename, cmd, policyname;
```

⚠ Bu çıktı **alınmadan hiçbir DDL yazılmaz.** Geri dönüş planı bu dökümün
kendisidir; onsuz bir hata geri alınamaz hâle gelir.

**Durum: ALINMADI** — Supabase SQL Editor 2026-08-27 oturumunda açılmadı
(4 deneme, tab grubu sıfırlandıktan sonra tekrarlayan bilinen sorun).

---

## ADIM 0 — Hesap silme ön kontrolü

`satis@bps.local` silinecek. **Ama silme reddedilebilir:** üç tabloda
`created_by`/`uploaded_by` kolonlarının `ON DELETE` davranışı TANIMSIZ, yani
varsayılan `NO ACTION` — o profilin yarattığı bir kayıt varsa FK ihlali döner.

| Tablo · kolon | ON DELETE | Silmede |
|---|---|---|
| `documents.created_by` | **yok** → `NO ACTION` | ⚠ kayıt varsa **REDDEDER** |
| `critical_dates.created_by` | **yok** → `NO ACTION` | ⚠ kayıt varsa **REDDEDER** |
| `mizan_uploads.uploaded_by` | **yok** → `NO ACTION` | ⚠ kayıt varsa **REDDEDER** |
| `companies` · `contacts` · `notes` · `contracts` · `staffing_demands` · `appointments` · `tasks` · `announcements` | `SET NULL` | Kayıt kalır, yazar boşalır |
| `partner_company_assignments.partner_user_id` | `CASCADE` | 0 satır — konusuz |
| `contract_expiry_emails_sent` · `notification_log` | `CASCADE` | 0 satır — konusuz |

**Silmeden önce çalıştır** (repo ölçümüdür; prod'da farklı olabilir — çıktı
boş değilse silme planı değişir):

```sql
with p as (select id from public.profiles where email = 'satis@bps.local')
select 'documents'      as tablo, count(*) from public.documents      where created_by  in (select id from p)
union all
select 'critical_dates', count(*)          from public.critical_dates where created_by  in (select id from p)
union all
select 'mizan_uploads',  count(*)          from public.mizan_uploads  where uploaded_by in (select id from p);
```

**Üçü de 0 ise** silme temiz geçer. Biri 0'dan büyükse iki seçenek: o kayıtların
`created_by`'ını başka bir profile taşımak, ya da hesabı silmeyip auth'ta devre
dışı bırakmak. **Karar o anda verilir, tahminle ilerlenmez.**

---

## ADIM 1 — Hesabı sil

```sql
-- profiles.id → auth.users(id) ON DELETE CASCADE olduğu için auth tarafından
-- silmek profili de düşürür. Ters yön çalışmaz.
delete from auth.users where email = 'satis@bps.local';
```

Doğrulama:

```sql
select count(*) as kalan from auth.users where email = 'satis@bps.local';   -- 0
select count(*) as profil from public.profiles where email = 'satis@bps.local'; -- 0
select count(*) as partner_kalan from public.profiles where role = 'partner';   -- 0
```

**Son sorgu kritik:** `partner` rolünde başka hesap kalırsa ADIM 3'teki CHECK
değişikliği onları kırar.

---

## ADIM 2 — Policy'lerden partner dallarını kaldır

> **⛔ BU BÖLÜM BOŞ — prod dökümü bekliyor.**
>
> Döküm geldiğinde buraya şunlar yazılacak:
> - Değişecek policy'lerin tam listesi (tablo · policyname · cmd)
> - Her biri için ÖNCEKİ `qual` / `with_check` metni — **geri dönüş budur**
> - Partner dalı çıkarılmış YENİ metin
> - `DROP POLICY` + `CREATE POLICY` sırası, tek transaction'da
>
> Kör yazılmayacak. Repo'daki 18 dosya kapsamı **tahmin etmek** için bile
> kullanılmayacak: prod ile ayrıştığı üç kez ölçüldü.

---

## ADIM 3 — İzolasyon testi (partner çıktıktan SONRA)

Ayrıntı: `01_product/TASK_ROADMAP.md` — yol haritası 3. madde.
Özet: ikinci tenant'a kullanıcı + veri, her ekran tek tek, sızıntı tam sayımla.

**Bu adım ADIM 4'ten önce:** CHECK değişikliği ve tablo/fonksiyon DROP'ları
geri alınması zor işler; izolasyon önce kanıtlanmalı.

---

## ADIM 4 — CHECK'ten partner'ı çıkar

```sql
-- profiles.role CHECK'i. asistan BU İŞE BAĞLANMAZ (20260722000200 ayrı kalır) —
-- partner çıkarma ve asistan ekleme zıt yönlerde iki değişiklik, birleştirmek
-- geri dönüşü zorlaştırır.
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('yonetici','operasyon','ik','muhasebe','goruntuleyici'));
```

⚠ ADIM 1'in son doğrulaması (`partner` rolünde 0 hesap) geçmeden çalıştırılmaz.

---

## ADIM 5 — Tablo ve fonksiyonu düşür

```sql
drop table if exists public.partner_company_assignments;   -- 0 satır
drop function if exists public.current_user_has_company_scope(uuid);
```

⚠ Fonksiyon, ADIM 2'deki policy'ler temizlenmeden düşürülemez — bağımlı policy
varsa Postgres reddeder. Bu doğal bir güvenlik ağı: reddedilirse ADIM 2 eksik
kalmış demektir.

---

## ADIM 6 — Kod temizliği (43 dosya)

Prod'a bağlı değil, ayrı bir batch. Sıra önemli: **DB temizliğinden sonra**,
yoksa kod partner'sız çalışırken DB hâlâ partner bekler.

Bilinen dokunuş noktaları:
- `src/context/AuthContext.tsx` — `UserRole` union'ından `partner`
- `src/types/database.types.ts` — `partner_company_assignments` tipi
- `src/lib/email/notification-recipients.ts` + `contract-expiry-email.ts` —
  `includePartners` bayrağı ve partner sorguları **tümüyle kalkar**
- `src/lib/notification-kinds.ts` — `includePartners` alanı stratejiden çıkar
- 15 ekranda rol koşulları
- `02_rules/ROLE_MATRIX.md` — partner sütunu ve `HOLD` hücreleri

---

## Kayıt

Bu iş bitince güncellenecek: `ROLE_MATRIX` (partner sütunu) ·
`RLS_ACCESS_MATRIX` (rol kapsamları) · `PROD_SCHEMA_DRIFT` (kalkan objeler) ·
`CHANGELOG` · `TASK_ROADMAP` (s) maddesi.
