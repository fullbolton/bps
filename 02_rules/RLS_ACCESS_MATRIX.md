# RLS_ACCESS_MATRIX.md — Hangi rol, hangi tabloyu, hangi katmanda

> **Bu dosya bir FOTOĞRAFTIR, canlı gerçek değildir.**
> Prod ölçümü: **2026-08-27**. Prod, repo'dan bağımsız olarak değişebilir ve
> bugüne kadar üç kez değişti. Tazeleme kuralı en altta.

## Neden var

`ROLE_MATRIX.md` **ürün seviyesinde** ne olması gerektiğini söyler. Bu dosya
**veritabanında ne olduğunu** söyler. İkisi aynı şey değil ve ayrıldıkları yer
tam olarak hataların çıktığı yerdir.

Codex gibi repo-kısıtlı bir denetleyici prod'u göremez. Onun gördüğü tek şey
`supabase/migrations/`'daki policy tanımlarıdır — ve aşağıda gösterildiği gibi
**o tanımlar prod'la aynı değil.** Bu dosya olmadan repo-kısıtlı bir okuyucu
migration'daki policy'yi canlı gerçek sanır.

---

## 1. SELECT rol kapsamı — prod ölçümü (2026-08-27, 19 tablo, tam sayım)

| Kapsam | Tablolar |
|---|---|
| **Altı rol de okur** | `announcements` · `companies` · `critical_dates` |
| **`muhasebe` ve `goruntuleyici` hariç** | `documents` · `notes` · `tasks` · `workforce_summary` |
| **`yonetici` + `operasyon` + `partner`** | `appointments` · `contacts` · `contracts` · `staffing_demands` |
| **`muhasebe` + `partner`** | `financial_summaries` |
| **Yalnız `yonetici`** | `access_requests` · `demo_requests` · `mizan_uploads` · `mizan_upload_rows` |
| **`yonetici` + `partner`** | `partner_company_assignments` |
| **Rol koşulu YOK** (tüm authenticated) | `profiles` · `sector_templates` |

`partner` geçen her satırda erişim ayrıca **portföyle sınırlıdır**
(`current_user_has_company_scope(company_id)`), rol yeterli değildir.

> ⚠️ **İkinci satırda bir ölçüm belirsizliği var, kapatılmadı.** Kaynak ölçüm
> bu grubu "5 rol, muhasebe/görüntüleyici hariç" diye kaydetti; ama altı rolden
> ikisi çıkarılınca dört kalır. İki okuma mümkün:
> **(a)** dört rol — `yonetici`, `operasyon`, `ik`, `partner`;
> **(b)** beş rol — üstüne `goruntuleyici`.
> Fark önemsiz değil: (b) doğruysa `goruntuleyici` görev ve evrak okuyor demektir
> ve bu `ROLE_MATRIX` §4'ün "Görev görüntüleme → Hayır / Evrak görüntüleme →
> Hayır" satırlarını ihlal eder. **Tahmin edilmedi, açık bırakıldı.** Kapatan
> sorgu §4'te.

### `profiles` — rol koşulu yokluğu bilinçli, asıl boşluk başka

`profiles_select_authenticated` `using (true)` ile tanımlı ve gerekçesi migration
yorumunda yazılı: not/görev/randevu kayıtlarının **yazar adını** gösterebilmesi
için her authenticated kullanıcı profilleri okuyabilmeli.

Asıl boşluk rol değil **tenant**: `profiles`'ta `tenant_id` yok, dolayısıyla
okuma tenant-kapsamlı değil. Kullanıcı seçici (picker) bu yüzden kapsamsız ve
`G3` gate'i bu yüzden bir sorgu değil insan beyanıdır. Kayıt: Step 3 (b).

**2026-09-04 — boşluk artık teorik değil, CANLI ve İKİ YÖNLÜ ölçüldü.** Mek Group
kullanıcısı görev seçicisinde Partner Staff kullanıcılarını görüyor (okuma) ve
yöneticisi onlara görev atayabiliyor (yazma: `tasks_insert/update` WITH CHECK
yalnız görevin tenant'ını denetliyor, atananın değil).

Düzeltme yazıldı, **UYGULANMADI**: `20260904000100_profiles_tenant_scope.sql`.
Uygulanınca bu tablodaki satır şuna döner:

| Kapsam | Tablolar |
|---|---|
| **Kendi satırı + aktif tenant'ın üyeleri** (rol koşulu yok) | `profiles` |

`tenant_id` kolonu EKLENMEDİ — üyelik `tenant_memberships`'te ve tekil kolon
ileride çok-tenant üyeliği yanlışlar. Kapsam `is_active_tenant_member(uuid)`
(`SECURITY DEFINER`) üzerinden; doğrudan `EXISTS` yazılamazdı, çünkü policy
ifadesi çağıranın yetkisiyle koşar ve `tenant_memberships`'te `authenticated`
grant'i yok. Aynı fonksiyon `tasks_insert/update` WITH CHECK'ine atanan guard'ı
olarak girdi. Uygulama katmanı bağımsız ikinci kat: `active_tenant_profiles()`
RPC'si; kapsamsız okuyucu silindi, `qa:static` R14 geri gelmesini FAIL yapar.

---

## 2. ⚠️ REPO ↔ PROD AYRIŞMASI — `db push` yasağının ikinci gerekçesi

Bilinen gerekçe tenant izolasyonuydu: repo'nun policy'leri tenant koşulu
taşımıyor, `db push` onları ezerse izolasyon sessizce kalkar.

**Ölçüldü (2026-08-27): rol izolasyonu da aynı yoldan bozuluyor.** Repo, prod'dan
DAHA GENİŞ erişim tanımlıyor:

| Policy | Repo migration'ı ne diyor | Prod ölçümü | Sonuç |
|---|---|---|---|
| `tasks_select` | `yonetici` · `operasyon` · `ik` · **`goruntuleyici`** · `partner` (20260407000800:55) | `goruntuleyici` **yok** | `db push` → `goruntuleyici` görev okumaya başlar |
| `documents_select` | + **`muhasebe`** + **`goruntuleyici`** (20260407001000:58) | ikisi de **yok** | `db push` → ikisi evrak okumaya başlar |

Her iki genişleme de `ROLE_MATRIX` §4'e aykırıdır ("Görev görüntüleme" ve
"Evrak görüntüleme" satırlarında ikisi de `Hayır`). Yani **prod doğru, repo
eski.** Faz 2'nin işi repo'yu prod'a hizalamaktır — tersi değil.

**Bunun denetleyici için anlamı:** `supabase/migrations/` içindeki bir policy
tanımını okuyup "bu rol şunu görebiliyor" demek GEÇERSİZDİR. Repo tanımı
prod'un kanıtı değildir.

---

## 3. Katman ayrımı — RLS ≠ UI

`ROLE_MATRIX` §5'teki kural burada da geçerli: **erişim ifadeleri katman
belirtmek zorundadır.** Bir yüzeyin UI'da gizli olması, RLS'in onu reddettiği
anlamına gelmez.

Bugün bilinen tek ayrışan yüzey:

| Yüzey | RLS | UI |
|---|---|---|
| Dashboard `Duyurular` şeridi | altı rol de okur (`muhasebe` dahil) | `muhasebe`'ye kart gösterilmez — **ürün kararı** |

Ayrışma zarar üretmez ama **belgelenmeden bırakılırsa** üretir: iki farklı doğru
ifade ortaya çıkar ve ikisi de metne dayanabilir. Yeni bir yüzey UI'ı RLS'ten
daraltırsa bu tabloya satır eklenmelidir.

---

## 4. Tazeleme — bu dosya ne zaman yeniden ölçülür

Bu dosyanın içeriği **2026-08-27 tarihli bir ölçümün fotoğrafıdır.** Prod,
repo'dan bağımsız değişebilir; bu dosyanın eskimesi bir arıza değil, beklenen
davranıştır.

**Zorunlu tazeleme anları:**
- herhangi bir policy prod'a uygulandığında (migration ya da elle SQL)
- yeni tablo yaratıldığında
- rol modeli değiştiğinde — **Step 3 bu dosyayı tümüyle geçersiz kılacak**
- bir denetim turu bu dosyaya dayanacaksa ve son ölçümden bu yana prod'a DDL gitmişse

**Tazeleyen sorgu — filtreleyerek değil TAM SAYARAK:**

```sql
-- Bütün policy'ler, bütün komutlar. Filtre YOK: eksik bir satır,
-- yanlış bir satırdan daha tehlikelidir.
select tablename, policyname, cmd, roles, qual, with_check
  from pg_policies
 where schemaname = 'public'
 order by tablename, cmd, policyname;

-- §1'deki belirsizliği kapatan sorgu: goruntuleyici hangi SELECT'lerde geçiyor?
select tablename, policyname
  from pg_policies
 where schemaname = 'public' and cmd = 'SELECT'
   and qual ilike '%goruntuleyici%'
 order by tablename;
```

İkinci sorgu `tasks` ve `documents` döndürürse §1'in (b) okuması doğrudur ve
`ROLE_MATRIX` §4 ile gerçek bir çelişki vardır. Boş dönerse (a) doğrudur ve
prod `ROLE_MATRIX` ile uyumludur.

> **Ölçüm yöntemi uyarısı.** `grep`/`ilike` ile arama bir FİLTREDİR, sayım
> değildir ve sessizce kaçırır. Bu dosyanın hazırlanmasında tam bu hata bir kez
> yapıldı: `grep "FOR DELETE"` büyük harfle arandı, migration'ların çoğu
> `for delete` yazıyordu, ve "bu tablolar silinemiyor" diye yanlış bir gerekçe
> üretildi. Ayrıntı: `REVIEW_STANDARD.md` §9.
