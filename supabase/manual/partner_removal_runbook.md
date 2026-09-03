# Partner Rolünü Kaldırma — Runbook

**Karar:** partner rolü kalkıyor (2026-08-27, Furkan). Kesin.
**Durum:** ✅ HAZIR — 30/30 policy okundu, migration yazıldı, parmak izi doğrulandı. **Uygulama Furkan'ın onayında.**
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
-- 1) ÖNCE SAYIM — kaç policy'nin kapsam dışında kaldığı görülsün.
select
  count(*) filter (where (coalesce(qual,'')||coalesce(with_check,'')) ilike '%partner%')       as partner_gecen,
  count(*) filter (where (coalesce(qual,'')||coalesce(with_check,'')) ilike '%company_scope%') as scope_gecen,
  count(*)                                                                                     as toplam_policy
  from pg_policies where schemaname = 'public';

-- 2) TAM LİSTE — İKİ desen birden.
select tablename, policyname, cmd, roles, qual, with_check
  from pg_policies
 where schemaname = 'public'
   and (coalesce(qual,'')||coalesce(with_check,'')) ~* '(partner|company_scope)'
 order by tablename, cmd, policyname;
```

⚠ **Neden iki desen:** `current_user_has_company_scope()` partner'a özel bir
fonksiyondur, ama onu çağıran bir policy'nin `qual` metninde "partner" kelimesi
GEÇMEYEBİLİR. Yalnız `%partner%` aramak o policy'leri sessizce kaçırır — bugün
`grep "FOR DELETE"` ile yapılan hatanın aynı ailesi (`REVIEW_STANDARD` §9).

⚠ **Filtre bir sayım değildir.** 1. sorgu, kapsanan policy sayısını toplamla
birlikte verir; ikisi arasındaki fark "dışarıda kalan" demektir ve o farkın
partner'la ilgisi olmadığı **gözle doğrulanmalıdır**, varsayılmaz.

⚠ Bu çıktı **alınmadan hiçbir DDL yazılmaz.** Geri dönüş planı bu dökümün
kendisidir; onsuz bir hata geri alınamaz hâle gelir.

**Durum: TAM ALINDI** (2026-08-27) — 30/30 policy, ham metin + md5 parmak izi.
Geri dönüş planı ADIM 2'de.

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

**ÇALIŞTIRILDI 2026-08-27 — SONUÇ TEMİZ:** `hesap_var=1` · `doc=0` · `crit=0` ·
`mizan=0` → silme reddedilmez. Sorgu, tekrar doğrulama için duruyor:

```sql
with p as (select id from public.profiles where email = 'satis@bps.local')
select
  (select count(*) from p)                                                             as hesap_var,
  (select count(*) from public.documents      where created_by  in (select id from p)) as doc,
  (select count(*) from public.critical_dates where created_by  in (select id from p)) as crit,
  (select count(*) from public.mizan_uploads   where uploaded_by in (select id from p)) as mizan;
```

⚠ **`hesap_var` sütunu zorunlu, süs değil.** Hesap yoksa alt sorgu boş küme
döner ve üç sayaç da `0` çıkar — yani "silme temiz geçer" görüntüsü, hesabın
hiç var olmadığı durumda da oluşur. Bu, `notification_log` doğrulamasında
öğrenilenin aynısı: **boş sonuç iki farklı şey anlamına gelebilir.**
`hesap_var = 0` ise diğer üç sıfır hiçbir şey kanıtlamaz.

**`hesap_var = 1` VE üçü de 0 ise** silme temiz geçer. Biri 0'dan büyükse iki
seçenek: o kayıtların `created_by`'ını başka bir profile taşımak, ya da hesabı
silmeyip auth'ta devre dışı bırakmak. **Karar o anda verilir, tahminle
ilerlenmez.**

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

### Kapsam — ÖLÇÜLDÜ (2026-08-27, prod `pg_policies`)

**60 policy'nin 31'i** partner'a dokunuyor. Bir tanesi tabloyla birlikte
düşeceği için **düzeltilecek gerçek sayı 30.**

| Tablo | Adet | scope dallı | Not |
|---|---:|---:|---|
| `announcements` | 1 | 0 | ⚠ bugün yazıldı, zaten kaldırılacak listede |
| `appointments` | 3 | 3 | |
| `companies` | 1 | 1 | |
| `contacts` | 4 | 4 | |
| `contracts` | 3 | 3 | |
| `critical_dates` | 1 | 0 | |
| `documents` | 3 | 3 | |
| `financial_summaries` | 1 | 1 | |
| `notes` | 4 | 4 | |
| `partner_company_assignments` | 1 | 0 | **DÜZELTİLMEYECEK** — ADIM 5'te tabloyla düşer |
| `staffing_demands` | 3 | 3 | |
| `tasks` | 3 | 3 | |
| `workforce_summary` | 3 | 3 | |
| **TOPLAM** | **31** | **28** | aritmetik tam, sayımla eşleşti |

**`company_scope` tamamen partner'ın içinde:** `partner=31 · scope=28 · birleşim=31`.
Yani `current_user_has_company_scope()` çağıran ama metninde "partner" geçmeyen
policy YOK. Ölçülmeden bilinemezdi; tersi çıksaydı üç policy sessizce kapsam
dışında kalırdı.

### İki kategori — yazma sırasını böler, uygulamayı BÖLMEZ

- **2 basit** (`announcements_select`, `critical_dates_select`) — `scope` dalı
  yok, yalnız rol listesinden bir eleman çıkarılacak.
- **28 karmaşık** — `current_user_has_company_scope()` dalı da sökülecek.

⚠ **Migration BÖLÜNMEZ, tek transaction.** Yarısı partner'sız yarısı partner'lı
bir ara durum, izolasyon testini anlamsız kılar. Ayrım yalnız yazarken işi
kolaylaştırmak için.

### Desenler — 30/30 OKUNDU, TAMAMLANDI (2026-08-27)

| Desen | Adet | Nerede |
|---|---:|---|
| A rol listesi (`ANY ARRAY`) | 2 | `announcements_select` · `critical_dates_select` |
| B `CASE`(rol) | 20 | `companies`1 · `notes`4 · `appointments`3 · `contracts`3 · `staffing_demands`3 · `tasks`3 · `workforce_summary`3 |
| C `OR` bloğu | 2 | `financial_summaries_select` · `documents_select` |
| D `CASE`+`EXISTS` | 4 | `contacts`×4 |
| E `CASE`(veri)+`OR` | 2 | `documents_insert` · `documents_update` |
| **TOPLAM** | **30** | ✓ okunan sayıyla eşleşti |

**Altıncı desen ÇIKMADI.** Beş desenin 30 policy'yi kapsadığı artık ölçülmüş
durumda — dördüncü desen 12., beşinci 21. policy'de çıkmıştı, yani hiçbir
noktada "yeter" demek savunulabilir değildi.

**Sadeleşme: 6** — `financial_summaries_select` · `notes_delete_broad` ·
`contacts_delete` · `contacts_insert` · `contracts_insert` · `contracts_update`

**Scope argümanı:** `companies` → `(id)` · diğer 29 → `(company_id)`

**Sadeleşme: 6** (`financial_summaries` · `notes_delete` · `contacts_delete` ·
`contacts_insert` · `contracts_insert` · `contracts_update`)
**ALTI İNCELİK — migration kontrol listesi:**
1. **Dal sayısı** — 2 dallı `CASE`'ler partner çıkınca düz ifadeye sadeleşmeli
2. **`CASE` sarmalı** — `notes_insert`'te dış `AND` guard var, `contacts_insert`'te yok
3. **`QUAL` vs `WITH_CHECK`** — 7 `UPDATE` policy'sinin hepsinde ikisi de var, ikisi de yazılmalı
4. **`EXISTS` vs düz** — `contacts`'ta `tenant_id` kolonu YOK, tenant `companies` üzerinden türetiliyor
5. **`CASE` koşulu veri olabilir** — `documents`'ta `contract_id IS NULL`; partner İKİ daldan silinmeli, tek yerden silmek SESSİZ hata
6. **Aynı tabloda farklı dal listeleri** — `workforce_summary`'de `ik` select'te var, insert/update'te yok


**Tek tip `DROP`/`CREATE` yetmiyor: her desen kendi yeniden yazımını istiyor.**

**DESEN A — rol listesi** (`announcements_select`, `critical_dates_select`)
İkisi **birebir aynı metin**, `roles = {public}`:
```sql
USING (current_user_role() = ANY (ARRAY['yonetici','operasyon','ik','muhasebe','goruntuleyici','partner'])
       AND tenant_id = current_user_active_tenant())
```
→ Düzeltme: `ARRAY`'den `'partner'` çıkar, gerisi aynı. En basit hâl.

**DESEN B — `CASE` dalı** (`companies_select_role_or_scope`)
```sql
CASE current_user_role()
  WHEN 'yonetici'      THEN tenant_id = current_user_active_tenant()
  ... (operasyon · ik · muhasebe · goruntuleyici aynı)
  WHEN 'partner'       THEN current_user_has_company_scope(id)
  ELSE false
END
```
→ Düzeltme: `partner` WHEN dalı komple silinir.
⚠ **Scope fonksiyonu burada `id` ile çağrılıyor**, diğer tablolarda `company_id`
bekleniyor ama **ölçülmedi**. Bu fark tek başına "desenler benzer, gerisi tahmin
edilir" fikrini çürütüyor.

**DESEN C — `OR` bloğu** (`financial_summaries_select`)
```sql
((current_user_role() = ANY (ARRAY['yonetici','muhasebe']))
 OR ((current_user_role() = 'partner') AND (company_id IS NOT NULL)
     AND current_user_has_company_scope(company_id)))
AND tenant_id = current_user_active_tenant()
```
→ Düzeltme: `OR`'un ikinci bacağı komple silinir ve ifade **sadeleşir**:
```sql
current_user_role() = ANY (ARRAY['yonetici','muhasebe'])
AND tenant_id = current_user_active_tenant()
```
`company_id IS NOT NULL` kontrolü de partner'la birlikte gider — kaldırmanın
RLS'i sadeleştirdiğinin somut örneği.

**`notes` — 4 policy, hepsi DESEN B, ama üç incelik var (2026-08-27)**

Dördüncü desen çıkmadı; **incelikler çıktı** ve üçü de migration'ı etkiliyor.

1. **`notes_delete_broad` yalnız İKİ dal taşıyor** (`yonetici`, `partner`).
   Partner çıkınca geriye tek dal kalır ve `CASE` anlamsızlaşır — düz ifadeye
   sadeleşmeli:
   ```sql
   USING (current_user_role() = 'yonetici' AND tenant_id = current_user_active_tenant())
   ```
   `financial_summaries`'ten sonra **sadeleşmenin ikinci kanıtı.**

2. **`notes_insert_role_or_scope`: `CASE` bir `AND`'in İÇİNDE.**
   ```sql
   (author_id = auth.uid()) AND CASE ... END
   ```
   ⚠ Naif "partner WHEN'ini sil" yaklaşımı **dış guard'ı da düşürebilir**.
   `author_id` koşulu korunmalı. Tek tip şablonun neden yetmediğinin en net
   örneği.

3. **`notes_update_own_or_broad`: `QUAL` ve `WITH_CHECK` BİREBİR AYNI.**
   Migration **ikisini de** yazmalı. Birini atlamak, okunabilen ama
   yazılamayan (ya da tersi) bir asimetri üretir ve arıza **sessiz** olur.

   ⚠ **Genel uyarı:** kalan altı `UPDATE` policy'sinde (`appointments`,
   `contacts`, `contracts`, `documents`, `tasks`, `workforce_summary`) `QUAL`
   ve `WITH_CHECK` **ayrı ayrı** okunmalı. Aynı olduklarını varsaymak da,
   farklı olduklarını varsaymak da ölçüm değildir.

**Scope argümanı tablodan tabloya DEĞİŞİYOR — doğrulandı:**
`companies` → `current_user_has_company_scope(id)` ·
`notes` → `current_user_has_company_scope(company_id)`.
Her policy'de argüman **okunacak**, kopyalanmayacak.

**DESEN D — `CASE` + `EXISTS` alt sorgusu** (`contacts` ×4, 2026-08-27)

**Dördüncü desen 12. policy'de çıktı.** Sekizde durup genelleme yapılsaydı
kaçırılacaktı.

```sql
WHEN 'yonetici' THEN EXISTS (
  SELECT 1 FROM companies c
   WHERE c.id = contacts.company_id
     AND c.tenant_id = current_user_active_tenant())
```

**Sebebi yapısal:** `contacts` tablosunda `tenant_id` kolonu **YOK**. Tenant'ı
`companies` üzerinden `EXISTS` ile türetiyor. Diğer tablolarda düz
`tenant_id = current_user_active_tenant()` karşılaştırması var.

⚠ **Migration bu `EXISTS`'i KOPYALAMALI, düz karşılaştırmaya ÇEVİRMEMELİ.**
Çevirirse `contacts`'ta var olmayan bir kolona referans verir ve policy hata
verir. Bu, kaçırılsaydı sessiz değil gürültülü bir arıza olurdu — ama yine de
kaçırılmamalıydı.

**`contacts` dört policy — iki yeni incelik:**

- `contacts_delete` ve `contacts_insert` **iki dallı** → partner çıkınca
  `CASE` sadeleşmeli. **Üçüncü ve dördüncü sadeleşme kanıtı.**
- `contacts_insert`'te **dış `AND` guard'ı YOK** — `CASE` doğrudan
  `WITH_CHECK`'in kendisi. `notes_insert`'te vardı. Yani **sarmalama tablodan
  tabloya değişiyor, iki yönde de**: kimi yerde dış guard var, kimi yerde yok.
  Her policy kendi sarmalıyla okunacak.
- `contacts_update`: `QUAL` = `WITH_CHECK`, `notes_update` gibi. İkisi de
  yazılacak.

**Scope argümanı:** `contacts` → `(company_id)`, `companies` → `(id)`.
İki farklı argüman doğrulandı.

**DESEN E — `CASE` koşulu ROL DEĞİL, VERİ** (`documents_insert`, `documents_update`)

**Beşinci desen 21. policy'de çıktı** — ve şimdiye kadarki en tehlikelisi.

```sql
CASE
  WHEN contract_id IS NULL THEN (role = ANY['yonetici','operasyon','ik']
                                 OR (role='partner' AND scope(company_id)))
  ELSE                          (role='yonetici'
                                 OR (role='partner' AND scope(company_id)))
END
AND tenant_id = current_user_active_tenant()
```

`CASE current_user_role()` değil, `CASE WHEN contract_id IS NULL`. Dallanma
**role göre değil veriye göre**, ve **her dalın içinde ayrı bir partner
bacağı** var.

⚠⚠ **Partner İKİ AYRI YERDEN silinmeli.** Tek yerden silmek yarısını bırakır —
ve bu **SESSİZ** olur. Diğer dört desende kaçırma gürültülüydü (policy patlar,
kolon bulunamaz); burada policy çalışmaya devam eder ve partner bir veri
koşulunda hâlâ erişebilir.

`documents_select` ise DESEN C (OR bloğu), `financial_summaries` gibi. Yani
**tek tablo iki farklı desen taşıyabiliyor** — tablo bazında genelleme de
yapılamaz.

**`appointments` (3) ve `contracts` (3):** yeni desen yok, hepsi DESEN B.
`contracts_insert` ve `contracts_update` iki dallı → **beşinci ve altıncı
sadeleşme.**

**ALTINCI İNCELİK — aynı tabloda dal listesi DEĞİŞİYOR** (`workforce_summary`)

```
insert (WC)      : CASE [yonetici, operasyon, partner]        ← ik YOK
select (QUAL)    : CASE [yonetici, operasyon, ik, partner]    ← ik VAR
update (QUAL=WC) : CASE [yonetici, operasyon, partner]        ← ik YOK
```

`ik` okuyabiliyor ama yazamıyor. Bilinçli bir tasarım olabilir — ama migration
yazarken **"tablonun üç policy'si aynı" varsayımı yanlış olurdu.**

Ve `tasks`'ta `ik` **üçünde de** var. Yani iki benzer tablo farklı davranıyor:
**tablo bazında da, tablolar arası benzerlikle de genelleme yapılamaz.**

`staffing_demands` (3): yeni desen yok, `appointments` ile birebir aynı yapı.
`tasks` (3): yeni desen yok, 4 dallı.
**Okunmayı bekleyen 26 policy:** `appointments`(3) · `contacts`(4) ·
`contracts`(3) · `documents`(3) · `notes`(4) · `staffing_demands`(3) ·
`tasks`(3) · `workforce_summary`(3).
`notes` en karmaşığı — `delete_broad` / `update_own_or_broad` gibi başka hiçbir
tabloda olmayan adlar taşıyor, kendi mantığı var.

### Yazılan bloklar — tablo tablo

Her blok iki parça taşır: **ÖNCESİ** (geri dönüş) ve **SONRASI** (uygulanacak).
Öncesi ham `pg_policies` çıktısıdır, özet değil.

---

#### `documents` — 3 policy ✅ YAZILDI

⚠ **Bu tabloda sadeleşme kuralı UYGULANMAZ.** "2 dallı `CASE` → düz ifade"
kuralı rol dallanması içindir. Burada `CASE` **veri** üzerinden dallanıyor
(`contract_id IS NULL`), partner çıksa da iki dal kalır ve `CASE` **korunur**.
Kuralı körü körüne uygulamak policy'yi bozardı.

**ÖNCESİ — geri dönüş:**

```sql
-- documents_select :: SELECT · QUAL
(((current_user_role() = ANY (ARRAY['yonetici'::text, 'operasyon'::text, 'ik'::text])) OR ((current_user_role() = 'partner'::text) AND current_user_has_company_scope(company_id))) AND (tenant_id = current_user_active_tenant()))

-- documents_update :: UPDATE · QUAL ve WITH CHECK BİREBİR AYNI
(
CASE
    WHEN (contract_id IS NULL) THEN ((current_user_role() = ANY (ARRAY['yonetici'::text, 'operasyon'::text, 'ik'::text])) OR ((current_user_role() = 'partner'::text) AND current_user_has_company_scope(company_id)))
    ELSE ((current_user_role() = 'yonetici'::text) OR ((current_user_role() = 'partner'::text) AND current_user_has_company_scope(company_id)))
END AND (tenant_id = current_user_active_tenant()))

-- documents_insert :: INSERT · WITH CHECK (qual yok)
-- update ile BİREBİR AYNI metin
```

**SONRASI — uygulanacak:**

```sql
DROP POLICY IF EXISTS documents_select ON public.documents;
CREATE POLICY documents_select ON public.documents
  FOR SELECT USING (
    current_user_role() = ANY (ARRAY['yonetici'::text, 'operasyon'::text, 'ik'::text])
    AND tenant_id = current_user_active_tenant()
  );

DROP POLICY IF EXISTS documents_insert ON public.documents;
CREATE POLICY documents_insert ON public.documents
  FOR INSERT WITH CHECK (
    CASE
      WHEN contract_id IS NULL
        THEN current_user_role() = ANY (ARRAY['yonetici'::text, 'operasyon'::text, 'ik'::text])
      ELSE current_user_role() = 'yonetici'::text
    END
    AND tenant_id = current_user_active_tenant()
  );

DROP POLICY IF EXISTS documents_update ON public.documents;
CREATE POLICY documents_update ON public.documents
  FOR UPDATE
  USING (
    CASE
      WHEN contract_id IS NULL
        THEN current_user_role() = ANY (ARRAY['yonetici'::text, 'operasyon'::text, 'ik'::text])
      ELSE current_user_role() = 'yonetici'::text
    END
    AND tenant_id = current_user_active_tenant()
  )
  WITH CHECK (
    CASE
      WHEN contract_id IS NULL
        THEN current_user_role() = ANY (ARRAY['yonetici'::text, 'operasyon'::text, 'ik'::text])
      ELSE current_user_role() = 'yonetici'::text
    END
    AND tenant_id = current_user_active_tenant()
  );
```

**Kontrol listesi — bu blokta hangi incelikler geçerliydi:**
- ✅ (3) `QUAL` ve `WITH_CHECK` ayrı ayrı yazıldı (`update`)
- ✅ (5) partner **iki daldan da** silindi — tek yerden silmek sessiz hata olurdu
- ⛔ (1) sadeleşme kuralı **uygulanmadı** — dallanma veri üzerinden, `CASE` korundu
- `documents_select` DESEN C olduğu için `OR` bacağı düştü ve dış parantez sadeleşti

---

#### `contacts` — 4 policy ✅ YAZILDI

Dördü de DESEN D (`CASE` + `EXISTS`). `contacts`'ta `tenant_id` kolonu YOK;
tenant `companies` üzerinden türetiliyor ve **bu `EXISTS` aynen korunuyor** —
düz karşılaştırmaya çevirmek olmayan bir kolona referans verirdi.

Sadeleşme kuralı burada **GEÇERLİ** (`documents`'ın tersine), çünkü dallanma
rol üzerinden:
- `select` · `update` → partner çıkınca **2 rol dalı** kalır (`yonetici`,
  `operasyon`) → `CASE` **korunur**, yalnız `WHEN` silinir
- `insert` · `delete` → partner çıkınca **tek dal** kalır → `CASE` anlamsızlaşır,
  düz ifadeye iner

⚠ `select`/`update`'te kalan iki dal **aynı `EXISTS`'i** döndürüyor, yani
teknik olarak `ANY(ARRAY[...])` ile birleştirilebilirdi. **Birleştirilmedi:**
minimum değişiklik ilkesi (yalnız partner dalı çıkar) ve `workforce_summary`
örneği — aynı tabloda rol dalları farklılaşabiliyor, birleştirmek o esnekliği
kapatır.

**ÖNCESİ — geri dönüş:**

```sql
-- contacts_select_role_or_scope :: SELECT · QUAL   (WITH CHECK: null)
CASE current_user_role()
    WHEN 'yonetici'::text THEN (EXISTS ( SELECT 1
       FROM companies c
      WHERE ((c.id = contacts.company_id) AND (c.tenant_id = current_user_active_tenant()))))
    WHEN 'operasyon'::text THEN (EXISTS ( SELECT 1
       FROM companies c
      WHERE ((c.id = contacts.company_id) AND (c.tenant_id = current_user_active_tenant()))))
    WHEN 'partner'::text THEN current_user_has_company_scope(company_id)
    ELSE false
END

-- contacts_insert_role_or_scope :: INSERT · WITH CHECK   (QUAL: null)
CASE current_user_role()
    WHEN 'yonetici'::text THEN (EXISTS ( SELECT 1
       FROM companies c
      WHERE ((c.id = contacts.company_id) AND (c.tenant_id = current_user_active_tenant()))))
    WHEN 'partner'::text THEN current_user_has_company_scope(company_id)
    ELSE false
END

-- contacts_update_role_or_scope :: UPDATE · QUAL ve WITH CHECK BİREBİR AYNI
--   (select ile aynı metin: yonetici + operasyon + partner)

-- contacts_delete_role_or_scope :: DELETE · QUAL   (WITH CHECK: null)
--   (insert ile aynı metin: yonetici + partner)
```

**SONRASI — uygulanacak:**

```sql
DROP POLICY IF EXISTS contacts_select_role_or_scope ON public.contacts;
CREATE POLICY contacts_select_role_or_scope ON public.contacts
  FOR SELECT USING (
    CASE current_user_role()
      WHEN 'yonetici'::text THEN (EXISTS ( SELECT 1
         FROM companies c
        WHERE ((c.id = contacts.company_id) AND (c.tenant_id = current_user_active_tenant()))))
      WHEN 'operasyon'::text THEN (EXISTS ( SELECT 1
         FROM companies c
        WHERE ((c.id = contacts.company_id) AND (c.tenant_id = current_user_active_tenant()))))
      ELSE false
    END
  );

-- İKİ DALLIYDI → tek dal kaldı → CASE düştü
DROP POLICY IF EXISTS contacts_insert_role_or_scope ON public.contacts;
CREATE POLICY contacts_insert_role_or_scope ON public.contacts
  FOR INSERT WITH CHECK (
    current_user_role() = 'yonetici'::text
    AND EXISTS ( SELECT 1
       FROM companies c
      WHERE ((c.id = contacts.company_id) AND (c.tenant_id = current_user_active_tenant())))
  );

DROP POLICY IF EXISTS contacts_update_role_or_scope ON public.contacts;
CREATE POLICY contacts_update_role_or_scope ON public.contacts
  FOR UPDATE
  USING (
    CASE current_user_role()
      WHEN 'yonetici'::text THEN (EXISTS ( SELECT 1
         FROM companies c
        WHERE ((c.id = contacts.company_id) AND (c.tenant_id = current_user_active_tenant()))))
      WHEN 'operasyon'::text THEN (EXISTS ( SELECT 1
         FROM companies c
        WHERE ((c.id = contacts.company_id) AND (c.tenant_id = current_user_active_tenant()))))
      ELSE false
    END
  )
  WITH CHECK (
    CASE current_user_role()
      WHEN 'yonetici'::text THEN (EXISTS ( SELECT 1
         FROM companies c
        WHERE ((c.id = contacts.company_id) AND (c.tenant_id = current_user_active_tenant()))))
      WHEN 'operasyon'::text THEN (EXISTS ( SELECT 1
         FROM companies c
        WHERE ((c.id = contacts.company_id) AND (c.tenant_id = current_user_active_tenant()))))
      ELSE false
    END
  );

-- İKİ DALLIYDI → tek dal kaldı → CASE düştü
DROP POLICY IF EXISTS contacts_delete_role_or_scope ON public.contacts;
CREATE POLICY contacts_delete_role_or_scope ON public.contacts
  FOR DELETE USING (
    current_user_role() = 'yonetici'::text
    AND EXISTS ( SELECT 1
       FROM companies c
      WHERE ((c.id = contacts.company_id) AND (c.tenant_id = current_user_active_tenant())))
  );
```

**Kontrol listesi:**
- ✅ (1) sadeleşme — `insert` ve `delete` tek dala indi, `CASE` düştü
- ✅ (3) `QUAL` + `WITH_CHECK` — `update`'te ikisi de yazıldı
- ✅ (4) `EXISTS` **aynen korundu**, düz karşılaştırmaya çevrilmedi
- ✅ (2) dış sarmal yok — `CASE` doğrudan ifadenin kendisi (`notes`'un tersine)
- `contacts.company_id` niteleyicisi `EXISTS` içinde korundu

---

### Migration doğrulaması — parmak izi, göz kararı değil

Prod'da **aynı md5'e sahip policy'ler birebir aynı metni taşıyor.** Migration'da
da aynı kalmalılar: biri farklıysa o blokta elle bir sapma var demektir.

Migration dosyasındaki gövdeleri aynı yöntemle grupla:

```bash
python3 - <<'EOF'
import io, re, hashlib
from collections import defaultdict
src = io.open("supabase/migrations/20260827000300_remove_partner_role.sql", encoding="utf-8").read()
body = "\n".join(l for l in src.split("\n") if not l.strip().startswith("--"))
blocks = re.findall(r"CREATE POLICY (\w+) ON public\.(\w+)(.*?);\s*(?=DROP POLICY|COMMIT|$)", body, re.S)
def exprs(txt):
    out = []
    for kw in ("USING", "WITH CHECK"):
        for m in re.finditer(kw + r"\s*\(", txt):
            i = m.end() - 1; depth = 0; j = i
            while j < len(txt):
                if txt[j] == "(": depth += 1
                elif txt[j] == ")":
                    depth -= 1
                    if depth == 0: break
                j += 1
            out.append((kw, txt[i+1:j]))
    return out
g = defaultdict(list)
for name, table, rest in blocks:
    for kw, e in exprs(rest):
        h = hashlib.md5(re.sub(r"\s+", " ", e).strip().encode()).hexdigest()[:10]
        g[h].append(f"{name}({kw.split()[0].lower()})")
for h, n in sorted(g.items(), key=lambda x: -len(x[1])):
    print(h, len(n), ", ".join(sorted(n)))
EOF
```

**2026-08-27 sonucu — grup yapısı KORUNDU, sapma yok:**

| Prod (partner'lı) | Migration | |
|---|---|---|
| `8a11e3eb06` ×3 | `b97fbd9a14` 4 ifade | ✅ |
| `4121015f09` documents | `2207635b80` 3 ifade | ✅ |
| `6f9fc31ea1` contacts 3-dallı | `1a7b43ac5d` 3 ifade | ✅ |
| `4ff155da95` Desen A | `09c9681560` 2 ifade | ✅ |
| `256748a24e` contacts 2-dallı | `c3e199b0b8` 2 ifade | ✅ |
| `b61d0ef6b4` notes_update | `16553442f0` q=wc | ✅ |
| 4 tekil | 4 tekil | ✅ aynı dördü |

30 blok tek tek yazıldı ve aynı gövde 12 kez tutarlı üretildi — bunu göz değil
parmak izi doğruladı.

✅ **İKİ GRUP BÜYÜDÜ — DOĞRULANDI (2026-08-27).** `workforce_summary` insert/update
`appointments` grubuna, `tasks_update` + `workforce_summary_select` de `tasks`
grubuna katıldı. Beklenen: prod'da zaten aynı metni taşıyorlardı
(`[yonetici, operasyon, partner]` ve `[yonetici, operasyon, ik, partner]`),
partner çıkınca aynı kalıyorlar.

Eksik 4'ün prod md5'i alındı ve **dördü de beklenen gruba düştü**:

```
tasks_update             md5q = md5wc = 2b56216693   ✅ beklenen
workforce_summary_select md5q         = 2b56216693   ✅ beklenen
workforce_summary_insert md5wc        = fdc2140a23   ✅ beklenen
workforce_summary_update md5q = md5wc = fdc2140a23   ✅ beklenen
```

Yani `workforce_summary` insert/update prod'da `appointments` ile **zaten aynı
metni taşıyordu**; partner çıkınca aynı kalıyorlar. Grup büyümesi beklenen
davranış, sapma değil. **Hipotez sonuç oldu.**

**7 `UPDATE` policy'sinin hepsinde `md5q = md5wc`** ayrıca doğrulandı —
`QUAL` ve `WITH_CHECK` birebir aynı, ve migration ikisini de yazıyor.

### PARMAK İZİ TARAFI KAPANDI

Prod 30/30 ölçüldü, migration 30/30 yazıldı, grup yapısı birebir korundu.
Uygulama öncesi diff için başka ölçüm gerekmiyor.

---

### ⛔ Kalan tablolar — tam metin bekliyor

Yukarıdaki tablo **kapsamı** verir, **geri dönüşü vermez.** Her policy'nin
ÖNCEKİ metni alınmadan hiçbir `DROP POLICY` yazılmaz — geri dönüş planı o
metinlerin kendisidir.

Tablo başına tek sorgu (çıktı kısa kalsın diye; uzun çıktılar bu araçta
bloklandı):

```sql
select policyname, cmd, roles, qual, with_check
  from pg_policies
 where schemaname='public' and tablename='<TABLO>'
   and (coalesce(qual,'')||coalesce(with_check,'')) ~* '(partner|company_scope)'
 order by cmd, policyname;
```

`<TABLO>` sırası: `announcements` · `appointments` · `companies` · `contacts` ·
`contracts` · `critical_dates` · `documents` · `financial_summaries` · `notes` ·
`staffing_demands` · `tasks` · `workforce_summary`
(`partner_company_assignments` atlanır — düzeltilmeyecek.)

Çıktı bloklanırsa satır satır oku:

```sql
select policyname, cmd,
       (regexp_split_to_table(qual, E'\n'))[1] as qual_satir
  from pg_policies
 where schemaname='public' and tablename='<TABLO>';
```

### Yazıldığında buraya girecek

- Her policy için ÖNCEKİ metin — **geri dönüş bloğu**
- Partner dalı çıkarılmış YENİ metin
- `DROP POLICY` + `CREATE POLICY`, **tek transaction'da**

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
