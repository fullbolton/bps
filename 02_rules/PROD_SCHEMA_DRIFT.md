# PROD_SCHEMA_DRIFT.md — Repo'nun bilmediği prod objeleri

> **Bu dosya bir FOTOĞRAFTIR.** Kaynak ölçüm: **2026-08-10** (Faz 1 envanteri).
> **2026-08-27'de kısmen tazelendi** ve o tazeleme dosyanın kendi tezini
> kanıtladı: 17 günde üç sayı değişmişti. Tazeleme kuralı en altta.

## Tek cümle

**Bu repo'dan sıfırdan kurulan bir veritabanında tenant izolasyonu hiç olmaz.**
Tablolar `tenant_id` kolonsuz doğar, policy'ler tenant koşulsuz kurulur, claim'i
yazacak hook hiç kurulmaz.

## Neden repo'da duruyor

Repo-kısıtlı bir denetleyici (Codex) prod'u göremez. `supabase/migrations/`'ı
okur ve gördüğünü canlı gerçek sanar. Üç somut örnek — üçü de bu dosya olmadan
yanlış sonuca götürür:

1. **`companies_insert_yonetici`** — repo yorumu "policy henüz gelmedi" diyor.
   Prod'da policy VAR. Yorumu okuyan, olmayan bir boşluğu rapor eder.
2. **`tenant_id NOT NULL`, DEFAULT yok** — bilinmezse "`IF NOT EXISTS` yeterli"
   denir. Bu hata 2026-08-27'de bir kez yapıldı ve yakalandı.
3. **`financial_summaries` NOT NULL kısıtları** — bilinmezse "RLS zaten baypas
   ediyor, sorun yok" denir.

---

## Karşılaştırma (2026-08-10 ölçümü)

| Kategori | Prod | Repo | Eksik |
|---|---:|---:|---:|
| Tablo | 21 | 17 | **4** |
| Tenant fonksiyonu | 3 | 1 | **2** |
| Tenant koşullu policy | **43 / 57 (%75)** | **0** | **43** |
| `tenant_id` kolonu | 12 tabloda `NOT NULL`, DEFAULT yok | **0 migration ekliyor** | **12** |
| Trigger | 14 | ölçülmemişti | — |

### 2026-08-27 tazelemesi — üç sayı değişti

| Kategori | 10 Ağustos | 27 Ağustos | Sebep |
|---|---:|---:|---|
| Prod tablo | 21 | **23** | `announcements` (repo'dan) + `notification_log` (repo'dan, **uygulandı 2026-08-27**) |
| Repo tablo | 17 | **19** | aynı ikisi |
| Trigger | 14 | **16** | `documents_set_updated_at` + `critical_dates_set_updated_at` (repo'dan, `20260810000200`) |

Bu üç satır dosyanın tezidir: **fotoğraf çekildiği anda eskimeye başlar.**

---

## Repo dışı objeler (2026-08-10)

```
TABLO (4)      tenants · tenant_memberships · financial_summaries · access_requests
FONKSİYON (2)  current_user_active_tenant · custom_access_token_hook
KOLON (12)     appointments · companies · contracts · critical_dates · documents
               financial_summaries · notes · partner_company_assignments
               staffing_demands · tasks · tenant_memberships · workforce_summary
POLICY (43)    prod'daki tenant koşullu policy'lerin TAMAMI
INDEX          financial_summaries'ın 3 index'i
TRIGGER        tasks_validate_linked_fks (repo'da YOK — doğrulandı)
```

`current_user_active_tenant()` → `uuid`, `SECURITY DEFINER`, `STABLE`, argümansız.
`current_user_role()` → `text`, `SECURITY DEFINER`, `STABLE`, argümansız. *(2026-08-27 ölçümü)*

### `tenants` / `tenant_memberships` — RLS açık, policy SIFIR

İkisi de RLS açık, policy yok, `anon`/`authenticated`'a SELECT/INSERT/UPDATE/DELETE
grant'i yok → **PostgREST üzerinden tamamen erişilemez**, erişim yalnız
`SECURITY DEFINER` fonksiyonlar üzerinden.

**Bu KASITLI ve GÜVENLİDİR.** Bir migration yazarken "policy eksik" sanılıp
doldurulmamalıdır. Aynı desen `notification_log` için de bilinçli seçildi.

### ⚠ GRANT'ler de drift alanı — `profiles` üzerinde olası canlı açık (2026-09-04)

Repo'daki tek grant `grant update (display_name)`. Ama Supabase `public`
şemadaki her tabloya **varsayılan olarak tablo seviyesinde ALL** verir ve Faz 0
bunu REVOKE etmedi. Tablo seviyesi UPDATE duruyorsa kolon grant'i hiçbir şeyi
daraltmaz ve `profiles_update_own` yalnız `auth.uid() = id` denetlediği için
**her kullanıcı kendi `role`'ünü `yonetici` yapabilir.** "Disallow
self-promotion" policy'de yorum, kontrol değil.

Ölçüm (prod, tek satır — `true` görülürse açık BUGÜN canlı):

```sql
select has_table_privilege ('authenticated','public.profiles','UPDATE')        as tablo_update,
       has_column_privilege('authenticated','public.profiles','role','UPDATE') as role_yazabilir,
       has_column_privilege('anon','public.profiles','display_name','UPDATE')  as anon_yazabilir;
```

**ÖLÇÜLDÜ 2026-09-05 (prod, Furkan):** `tablo_update=true · role_yazabilir=true ·
anon_yazabilir=true`. **Açık CANLIYDI.** Faz 0'dan bu yana her authenticated
kullanıcı `PATCH /rest/v1/profiles?id=eq.<kendi-id> {"role":"yonetici"}` ile
kendini yönetici yapabilirdi. `anon`'un grant'i RLS tarafından bloklanıyordu
(anon için policy yok) ama grant duruyordu. Kullanılıp kullanılmadığı ayrı
soru — `select email, role, updated_at from profiles order by updated_at desc`
ile beklenen rol dağılımıyla karşılaştır.

Düzeltme ölçümden bağımsız ve yazıldı: `20260904000200_profiles_update_grants.sql`
— tablo seviyesini kaldırır, `display_name`'i geri verir, katalogdaki her
kolonu fail-closed doğrular. **Diğer 18 tablo için aynı soru açık:** onlarda
policy'ler kolon bazında güvenmiyor (rol/tenant koşulu satır bazında), ama
"grant ne diyor" ölçülmedi. Faz 2 kaydına girer.

---

## ⚠️ `db push` yasağı — iki gerekçe, ikisi de ölçülmüş

**1. Tenant izolasyonu (2026-08-10).** Repo'daki 56 policy tanımı, prod'daki 43
tenant koşullu policy için eskimiş. `db push` çalıştırılırsa policy'ler
"başarıyla" uygulanır ve **tenant izolasyonu sessizce kalkar.**

**2. Rol izolasyonu (2026-08-27).** Aynı mekanizma rol kapılarını da genişletir:
repo'nun `tasks_select`'i `goruntuleyici`'yi içeriyor, prod'unki içermiyor;
`documents_select` için de `muhasebe` + `goruntuleyici` aynı durumda. `db push`
sonrası bu roller görev ve evrak okumaya başlar — `ROLE_MATRIX` §4'ü ihlal ederek.
Ayrıntı: `RLS_ACCESS_MATRIX.md` §2.

İkisinde de arıza **sessizdir**: komut başarılı döner, hiçbir hata çıkmaz,
yalnız erişim sınırları genişler.

### `migration repair` — ne yapar, ne yapmaz

`migration repair --status applied <version>` **SQL ÇALIŞTIRMAZ**; yalnız deftere
version/name/statements UPSERT eder. Şema zaten tam mevcutsa doğru araçtır.

- Yanlış repair = `db push` o migration'ı atlar, eksik nesne kalıcı olur, defter
  sahte senkron gösterir.
- ⚠️ **VERSION'SIZ `migration repair --status applied` KULLANMA** — tüm history
  tablosunu TRUNCATE edip bütün yerel migration'ları yeniden yazar.
- Repair'den önce **şema kanıtı** aranır. "SQL Editor success döndü" bir rapordur,
  hangi nesnelerin oluştuğunun kanıtı değildir.

---

## Drift guard — md5 yöntemi

Gövdesi repo'da olmayan fonksiyonlar için, tam metni taşımadan değişimi yakalamanın
yolu içerik özetidir:

```sql
select proname,
       substr(md5(prosrc), 1, 12) as md5_ilk12,
       length(prosrc)             as char,
       provolatile, prosecdef
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and proname in ('custom_access_token_hook',
                   'current_user_active_tenant',
                   'current_user_role')
 order by proname;
```

Bilinen değer: `custom_access_token_hook` → md5 ilk12 **`758af650dcaa`**, 1224
karakter, `VOLATILE`, `SECURITY DEFINER` *(2026-08-10)*.

Bu değer değişirse fonksiyon gövdesi değişmiş demektir ve repo'daki hiçbir
migration bunu açıklamıyorsa **repo dışı bir müdahale olmuştur.**

`md5` bir eşitlik kontrolüdür, bir açıklama değildir: değişimi söyler, neyin
değiştiğini söylemez. Değişim görülürse gövde yeniden okunmalıdır.

---

## Faz 2 sırası — "ekleme" değil, "prod'u kaydetme"

```
1. Fonksiyonlar (2) + kök tablolar (tenants, tenant_memberships)
2. tenant_id kolonları (12)
3. Trigger'lar (repo karşılaştırması sonrası)
4. Policy'ler (43)
```

**Faz 2 tasarım işi değildir.** İşi prod'u *olduğu gibi* repo'ya yazmaktır. Bir
feature batch'i sırasında policy yazılırsa kaydedilen şey prod'un gerçeği değil
yeni bir tasarım olur ve doğrulanmış baseline hiç oluşmaz.

---

## Bu dosya prompt bağımlılığını AZALTIR, SIFIRLAMAZ

Faz 2 tamamlandığında repo prod'u tarif ediyor olacak ve bir denetleyicinin
oturum başında prod ölçümü ile beslenmesi gereği büyük ölçüde kalkacak.

**Ama sıfırlanmaz.** Repo'ya alınan şey, alındığı günkü ölçümün fotoğrafıdır.
Prod repo'dan bağımsız değişebilir — 2026-08-27'de bunun üç örneği aynı gün
görüldü. `db push` yasağı ve md5 guard bu yüzden Faz 2'den sonra da kalır.

**Denetleyiciye verilen prod ölçümü kullanılmadan önce sorulacak soru:**
*"Bu ölçüm ne zaman alındı ve o tarihten sonra prod'a DDL gitti mi?"* Gittiyse
ölçüm tazelenmeden karar kurulmaz.
