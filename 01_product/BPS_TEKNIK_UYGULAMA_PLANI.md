# BPS — Supabase ve Kod Uygulama Planı

> Son kullanıcı yönlendirmesi: [Güncel yön](BPS_GUNCEL_YON.md).
> Önce tek şubede talep/atama dikey dilimi, sonra toplu aktarım; aşağıdaki eski
> P02→P03 yürütme sırası revize edilmiştir. Teknik detaylar tasarım girdisi olarak kalır.

**Tarih:** 2026-09-08 · **Repo inceleme noktası:** `4e3fc00`  
**Durum:** Teknik tasarım önerisi; SQL uygulanmadı, ürün kodu değişmedi.  
**Bağlı plan:** [Operasyon ve SaaS iş planı](BPS_OPERASYON_SAAS_IS_PLANI.md)

**Sonraki canlı kanıt:** [2026-09-08 MCP ölçümü](../02_rules/SUPABASE_MCP_OLCUM_2026-09-08.md).
Bağlantı artık çalışıyor; sınırlı katalog ölçümü alındı. Aşağıdaki “bu belge turunda
ölçüm yapılmadı” ifadeleri ilk yazım turuna aittir. İlk admin kaydıyla canlı durum
çelişkisi açıktır; tam baseline karşılaştırması henüz tamamlanmadı.

Bu belge Furkan'ın “Supabase tarafı, kod kısmı, nasıl yapacağız” talebinin teknik
karşılığıdır. Yeni tablo ve RPC adları öneridir; mevcut prod şeması diye okunmaz.
P01'de davranış/rol/durum belgeleriyle birlikte kesinleştirilir. Açık K1–K8 kararları
iş planındadır. Teknik tercihler aşağıda gerekçeleriyle önerildi; ürün cevabı uydurulmadı.

## 1. Yapacağımız ilk ürün

İlk dikey teslim: **Vakıfbank → şubeler → temizlik talebi → günlük İDP ataması → haftalık çıktı.**
Diğer bankalar aynı modelden yararlanır. Otelin bir defalık işe yerleştirmesi ile günlük
hizmet taahhüdü aynı kabul edilmez; K1 çözülmeden otel akışı kapsamı genişletilmez.

Firma Detay'a Lokasyonlar ve Talep/Plan görünümleri eklenir. `/talepler` firmalar arası
operasyon listesidir. Personel havuzu küçük bir yardımcı yüzeydir. Mevcut tablo,
filtre, drawer ve durum bileşenleri kullanılır; yeni bağımsız tasarım sistemi kurulmaz.

## 2. Mimari karar

```text
Ekran / form
  → Next.js Server Action: oturum, girdi doğrulama, hata dönüşü
  → TypeScript servis: kullanım senaryosu ve DTO dönüşümü
  → Supabase erişim katmanı: sorgu veya tek RPC
  → PostgreSQL: yetki, ilişkiler, transaction, çakışma/kapasite
```

Supabase Auth, Postgres ve Storage kalır. Yeni NestJS/Express, Prisma, Redis,
mesaj kuyruğu veya Edge Function ilk teslim için eklenmez. Dış kaynak toplama
sunucuda yapılır; veritabanı transaction'ı açıkken internet isteği yapılmaz.

Kodda bu ayrım zaten var: `src/lib/services`, `src/lib/supabase` ve sayfa
`actions.ts` dosyaları. Mevcut talepler yalnız sayaç/serbest metin lokasyon tutuyor;
yeni günlük planı eski `provided_count` alanına sıkıştırmayacağız.

**Güvenlik sınırı:** Server Action çağrısı da doğrudan RPC çağrısı da güvenilmeyen
girdi alır. UI doğrulaması kolaylık sağlar; yetki ve bütünlük DB'de tekrar sağlanır.
Operasyon işlemlerinde kullanıcının cookie oturumlu client'ı kullanılır; service-role
anahtarıyla genel bir yazma yolu açılmaz.

## 3. İlk iş: doğru geliştirme veritabanı

Repo migration'ları tek başına güncel prod'u kurmuyor. Bu nedenle boş yerelde
`db reset` başarılı olması, mevcut tenant yapısına uyum kanıtı değildir.

P00/P01 teslimi:

1. Güncel HEAD, bekleyen işler ve kimlikli smoke sonuçlarını kaydet.
2. Erişilebilir yetkili kaynaktan salt-okunur şema ölçümü al: tablolar/kolonlar,
   constraint/index, policy/grant, helper gövdeleri/owner, trigger ve migration ledger.
   Kaynak, ortam ve zamanı kaydet; erişim yoksa mevcut snapshot'ı canlı ölçüm diye sunma.
3. Prod dışı test ortamında ilgili tenant/auth/company/contracts temelini yeniden
   üretilebilir hale getir. Repo dışı objeleri incelemeden eski migration'ları prod'a basma.
4. İki sentetik tenant ve gereken rol hesapları oluştur; gerçek müşteri/personel
   verisini test ortamına taşıma. Test fixtures ve önkoşul kontrolü versiyonlansın.
5. Aynı baseline üzerinde yeni migration ve davranış testlerini çalıştır.

`000200`, `000100`, `000400` defterde uygulanmış; tekrar uygulama işi değildir.
Eski 43 raw-claim policy ve `current_user_active_tenant()` gövdesi bu paketle
genel refactor edilmez. Yeni yüzeyler doğrulanmış üyelik yaklaşımını kullanır.

## 4. Önerilen veri modeli

İş günü SQL `date`; olay zamanı `timestamptz`. UI'da iş günü `YYYY-MM-DD` olarak
taşınır; UTC dönüşümüyle bir önceki güne kaydırılmaz. Türkiye operasyon görünümü
`Europe/Istanbul` kullanır. Tarih aralığı iki uç dahil; gerçek günler ayrıca tutulur.

| Önerilen nesne | Temel alanlar / amaç | Paket |
|---|---|---|
| `company_locations` | UUID, tenant, company, ad, il/ilçe, adres opsiyonel, aktiflik, hizmet veriliyor işareti, sürüm | P02 |
| `location_source_refs` | tenant/company/location, kaynak kodu, kaynağın değişmez şube kodu, son görülme zamanı | P02 |
| `location_import_batches` | tenant/company, kaynak/dosya özeti, durum, oluşturan, önizleme sürümü, sonuç sayıları | P02 |
| `location_import_rows` | batch, satır numarası, normalize veri, eşleşme/karar, hata, beklenen mevcut sürüm | P02 |
| `workers` | UUID, tenant, ad, personel kodu, İDP/sabit türü, aktiflik, sürüm | P03 |
| `service_lines` / `positions` | tenant kapsamlı küçük sözlükler; hizmet hattı ve pozisyon ayrı | P03 |
| `service_requests` | tenant, company, location, opsiyonel contract, hizmet hattı, pozisyon, açıklama/kimin yerine, sorumlu kullanıcı, yaşam durumu, sürüm | P03 |
| `service_request_days` | tenant, request, iş günü, gerekli kişi sayısı, günün açık/iptal durumu, sürüm | P03 |
| `worker_assignments` | tenant, request-day, iş günü, worker, oluşturma/kaldırma bilgisi, işlem kimliği | P03 |
| `operation_commands` | tenant/actor/idempotency key, işlem türü, payload özeti, tamamlanan sonuç | P03 |
| `operation_events` | tenant/company/request, actor, olay türü, önce/sonra gerekli alanlar, command, zaman | P03/P04 |
| `plan_exports` | tenant/company, hafta/filtre, üreten, içerik snapshot'ı, kaynak sürümü | P05 |

İlk kez kullanılmayacak tablo önce açılmaz. Örneğin `plan_exports` P05'te gelir.
Gönderim takibi gerekiyorsa export'a bağlı ayrı olay kaydı eklenir; kopyalama
“gönderildi” sayılmaz. Bu tablo adları uygulama öncesi gerçek ad çakışmaları için kontrol edilir.

İlişki kuralları:

- Her yeni iş tablosunun tenant'ı zorunlu. Parent-child FK'lar mümkün olduğunca
  `(tenant_id, parent_id)` üzerinden; parent'ta karşılık gelen benzersiz anahtar.
- Lokasyon firmanın; talep lokasyonunun firmasıyla aynı firma içinde olmalı.
  Bunu yalnız iki bağımsız UUID FK'sına bırakma: company dahil bileşik ilişki veya
  DB doğrulaması kullan. Tenant eşitliği tek başına firma eşitliği değildir.
- Atamanın `(tenant_id, request_day_id, work_date)` ilişkisi gün tablosuyla eşleşir;
  istemci başka bir tarih vererek personel benzersizliğini aşamaz.
- Sözleşme opsiyonel; bağlandığında firma ve hizmet hattı eşleşmeli. Mevcut
  sözleşmelere hizmet hattı eklenecekse önce nullable ekle; eski satırları rastgele
  “temizlik” doldurma. Sözleşme değişiklikleri bağlı taleple çelişemez.
- Personel kodu tenant içinde benzersiz; ad benzersiz değil. İki Ahmet aynı kişi sayılmaz.
  Personel BPS hesabı değildir; Auth kullanıcı kaydı açılmaz.
- Yetkili kişi opsiyonel mevcut contact bağı olabilir; firma uyumu DB'de doğrulanır.
  Yeni kişi havuzuna TC, telefon, maaş veya izin bakiyesi eklenmez.
- Geçmişi olan lokasyon/personel fiziksel silinmez. Parent silmede sessiz CASCADE
  ile operasyon geçmişini kaybetme; RESTRICT/pasife alma yönü kullanılır.

## 5. Günlük doluluk ve çakışma

**Öneri: gerçek çalışma günlerini satırlaştır.** Form “8–12 Eylül, hafta içi, 2 kişi”
alır; onayda yalnız seçilen tarihler için request-day oluşur. Kaydedilen bu günler
asıl ihtiyaçtır; aralık/hafta içi seçimi giriş kolaylığıdır. Sonradan takvim değişirse
açık bir gün ekleme/kaldırma işlemi yapılır, eski atamalar sessizce yeniden üretilmez.

- Günlük doluluk = o günün kaldırılmamış atama sayısı.
- Günlük açık = gerekli kişi − doluluk. İptal günleri aktif ihtiyaçtan çıkarılır.
- Dönem kişi-gün açığı = seçilen aktif günlerdeki açıkların toplamı.
- “Atandı” seçilen ihtiyacın bütün günlerinde açık sıfırsa; tarih geçmesi hizmetin
  gerçekleştiğini kanıtlamaz. İptal/bekleme ile doluluk ayrı alan/anlamlardır.
- Tek kişi beş gün çalışıyorsa beş atama-gün satırı vardır. Ortak command kimliği
  bunları kullanıcıya tek toplu işlem olarak gösterebilir; ikinci dönem-atama tablosu gerekmez.

DB korumaları:

1. `UNIQUE(tenant_id, request_id, work_date)` gün tekrarını engeller.
2. Kaldırılmamış atamalarda `UNIQUE(tenant_id, worker_id, work_date)` partial unique
   index tam gün çakışmasını engeller. Kaldırılmış geçmiş satırları saklanır.
3. Gerekli kişi pozitif tamsayıdır. Kapasite bir aggregate olduğu için basit CHECK
   yetmez; ilgili gün satırını kilitleyen RPC, sayımı kilitten SONRA yapar.
4. Yeni atama, değiştirme, iptalden geri alma, gün/adet değişikliği aynı protokolü
   izler. `authenticated` doğrudan INSERT/UPDATE/DELETE edemez; yalnız RPC yolu açıktır.
5. Gerekli adet mevcut atama sayısından aşağı indirilemez; önce açık düzeltme işlemi.

Bu günlük tasarım seçili günleri ayrık iki dönem arasında yanlış çakışma üretmez.
Yarım gün/saatli çalışma onaylanırsa unique kuralını kaldırıp geçmek yerine ayrı
aralık ve kapasite tasarımı gerekir. İlk sürüm tam gün sınırını ekranda açık gösterir.

## 6. Atomik yazma protokolü

Önerilen RPC yüzeyleri: `create_service_request`, `assign_request_days`,
`replace_assignment_days`, `remove_assignment_days`, `change_request_days`,
`set_worker_active`, `apply_location_import`. İsim/imzalar P01'de kesinleşir;
PostgREST için aynı adla overload üretme.

Bir toplu yerleştirme çağrısı:

1. `auth.uid()` zorunlu; canlı doğrulanmış tenant, güncel rol ve firma kapsamı
   denetlenir. İstemciden tenant/actor/created_at alınmaz.
2. Aynı actor/tenant/command key için kayıt kilitlenir/oluşturulur. Aynı anahtar
   ve aynı payload tekrarında önceki sonuç; farklı payload'da açık hata.
3. Etkilenen kayıtlar önceden belirlenir. Ortak kilit sırası: command → şirketler →
   lokasyonlar → talepler → talep günleri → personeller; her sınıfta UUID sırası.
   Kilit sonrası ilişki/sürüm tekrar doğrulanır. Eski ilişkiye göre yanlış kayıt
   kilitlendiği anlaşılırsa işlem reddedilir; sıralamayı bozarak yeni kilit eklenmez.
4. Gün ve gerekli personel kilitlerinden SONRA ayrı sorgularla kapasite, aktiflik,
   mevcut atama ve beklenen sürüm okunur. RPC `VOLATILE` yazma fonksiyonu olur;
   READ COMMITTED varsayımı test ortamında doğrulanır.
5. Atamalar, gerekli sürüm artışları, olay kaydı ve command sonucu tek transaction'da yazılır.
6. Herhangi bir gün başarısızsa bütün çağrı geri alınır. Eski atama kaldırılıp
   yenisi eklenirken hata gelirse eski atama da korunur.

Şirket/lokasyon aktiflik değişimleri aynı üst kayıt kilidini paylaşmalıdır;
eski pasife alma yolu bunu sağlamıyorsa P03'te dar uyarlama yapılır. Personeli
pasife alma yalnız worker kilidi alıp gelecekte atama varsa reddedebilir; worker
kilidinden sonra gün kilidi alan ters sıra kullanılmaz. “Hepsini taşı ve pasife al”
ayrı toplu komuttur ve en baştan ortak sıraya uyar. K7'ye göre son davranış netleşir.

**İki oturum testi:** A son boş yere atama yaparken B aynı gün için bekler. A commit
edince B yeni sayımı görüp kapasite hatası alır. Başka talebe aynı worker/gün ataması
unique index ile de korunur. Deadlock/serialization hataları gene mümkündür;
sınırsız retry yok. Bilinen geçici hata sınırlı retry, ağ sonucu belirsizse aynı
command key ile tekrar sorgulama/yürütme kullanılır. Başarılı işlem çoğaltılmaz.

Her batch için gün/satır/payload üst sınırları ölçülerek belirlenir; sınırsız JSON kabul
edilmez. Büyük iş bölünecekse UI her parçanın durumunu gösterir; tüm parçalar için
tek transaction varmış gibi “tamamlandı” denmez.

## 7. RLS, RPC yetkileri ve hata sözleşmesi

Yeni tablolar: RLS açık, SELECT açık rol+kapsam koşuluyla. Yazma tablolarında normal
kullanıcıya DML grant yok; mutasyonlar kontrollü SECURITY DEFINER RPC'lerden.
Definer, RLS'ye güvenerek yetki atlayamaz: her RPC auth/tenant/rol/kapsamı kendi
denetler. Mümkün olan en dar owner, boş `search_path`, şema nitelikli nesneler,
PUBLIC/anon execute revoke ve yalnız gerekli authenticated execute grant kullanılır.
Helper ve view'ların da grant/owner sınırı gözden geçirilir. Bu kullanım Supabase'in
[fonksiyon güvenliği](https://supabase.com/docs/guides/database/functions) rehberiyle uyumludur.

Yeni RLS'de `current_user_verified_tenant()` yaklaşımı; raw claim tek başına yeterli
değil. Helper'ın gerçek gövdesi/owner/grant'i preflight'ta ölçülür. Üyelik taşınırken
devam eden transaction için mevcut admin kilit protokolü ayrıca incelenir: stale-token
testi, işlem sırasında yetki iptalinin anında kesileceği iddiası değildir.

Rol önerisi: yönetici import ve sözlük yönetir; yönetici+operasyon talep/atama yapar.
İK'nın kişi/gün detayı okuması K4 kararıdır; muhasebe/görüntüleyici/partner için
eski geniş policy kopyalanmaz. Nihai aksiyon matrisi P01 teslimidir.

Servis dönüşü ayrık union:

```ts
type MutationResult<T> =
  | { ok: true; data: T; commandId: string }
  | { ok: false; code: string; message: string; retryable: boolean };
```

Kod listesi P01'de kapalı union yapılır: `UNAUTHENTICATED`, `FORBIDDEN`,
`OUT_OF_SCOPE`, `VALIDATION`, `CAPACITY_FULL`, `WORKER_CONFLICT`, `STALE_VERSION`,
`IDEMPOTENCY_MISMATCH`, `UNVERIFIABLE`. Ağ/bozuk RPC dönüşü “personel uygun değil”
veya boş liste sayılmaz. Client'a raw SQL/kişisel veri dökülmez; sunucuda command
kimliğiyle teşhis yapılır. Yetkisiz hata mesajı başka tenant'ın kaydını açıklamaz.

## 8. Şubeleri toplu alma

Giriş biçimi: CSV/XLSX veya doğrulanmış resmî kaynak adaptörü → aynı normalize
satır modeli. Kaynak adaptörü doğrudan company/location yazamaz.

Örnek kolonlar: `kaynak`, `sube_kodu`, `sube_adi`, `il`, `ilce`, `adres`.
Hedef firma kullanıcı tarafından seçilir ve sunucuda doğrulanır. `0012` metindir;
Excel'in sayıya çevirdiği kodun başındaki sıfırlar tahminle geri eklenmez.

1. Dosya türü/boyutu/satır sayısı sınırları ve sunucu doğrulaması; UTF-8/Excel hücre
   tipleri kontrol edilir. Mevcut CSV akışı yeniden kullanılır ama insert-only servisi
   doğrudan upsert motoruna dönüştürülmez.
2. Kaynak anahtarı `(tenant, company, source, external_branch_id)` benzersizdir.
   Kod yoksa isim benzerliği otomatik merge yapmaz; manuel eşleştirme gerekir.
3. Önizleme: yeni / değişmiş / aynı / belirsiz / hatalı. Değişen alanlar gösterilir.
   Aynı dosyada yinelenen anahtarlar commit öncesi çözülür.
4. Onayda batch sahipliği, satır kararları ve mevcut location sürümü tekrar kontrol
   edilir. Arada kayıt değişmişse yeni önizleme gerekir; kullanıcının düzeltmesi ezilmez.
5. İlk hacim sınırında batch tek transaction; büyük dosyada açık parçalı ilerleme.
   Tekrarda source unique + batch idempotency çift kayıt oluşmasını engeller.
6. Kaynakta kaybolan şube yalnız inceleme adayıdır; silinmez/pasifleşmez. Kapsama
   aldığımız şubeler `hizmet veriliyor` işaretiyle ayrılır; tüm banka rehberi aktif iş değildir.
7. Bina/kat gibi manuel lokasyonlar kaynak senkronundan etkilenmez. İkinci kaynak
   aynı şubeye bağlanabilir; isim benzerliğinden otomatik karar verilmez.

İlk adaptörün URL/API, erişim izni, sayfalama ve toplam kayıt bütünlüğü ölçülecek.
CAPTCHA aşma veya doğrulanmamış endpoint varsayımı yok. Kaynak erişimi yoksa
Excel teslimi çalışır; “otomatik resmî kaynak aktarımı tamam” kutusu açık kalır.
V1 periyodik otomatik sync yerine kullanıcının başlattığı önizleme+onay kullanır.

## 9. Kod haritası

Yeni yollar öneridir; mevcut dosyalar teslim başlangıcında yeniden okunur.

| Katman | Dosya / yapılacak değişiklik |
|---|---|
| Domain | `src/lib/operations/`: gerçek tarih üretimi, günlük açık, durum türetme, DTO, hata kodları; saf fonksiyonlar |
| Servis | `src/lib/services/company-locations.ts`, `workers.ts`, `service-requests.ts`, `worker-assignments.ts` |
| Erişim | `src/lib/supabase/` altında eş servislerin RLS okumaları ve RPC wrapper'ları |
| Import | `src/lib/import/location-*.ts`: parser/normalizasyon/diff; kaynak adaptörü server-only |
| Aksiyon | `src/app/(main)/talepler/actions.ts`, `firmalar/[id]/actions.ts`, `import/actions.ts` dar eklemeler |
| Ekran | `/firmalar/[id]` lokasyon+talep; `/talepler` gün/hafta+atama; `/import` şube önizlemesi |
| UI parçaları | mevcut ortak bileşenlerle `LocationImportPreview`, `RequestDayTable`, `AssignmentDrawer`, `WeeklyPlanExport` |
| Tipler | `src/types/database.types.ts` yalnız doğrulanmış yeni şemaya göre; prod/repo drift yüzünden tüm dosyayı körlemesine overwrite etme |
| DB | `supabase/migrations/` yeni ileri tarihli benzersiz dosyalar; `supabase/manual/` preflight/post-check |
| Test | saf fonksiyon testleri + `supabase/tests/` SQL testleri + iki bağlantılı concurrency testi |

Mevcut talepler okuyucuları: Talepler, Firma Detay, Dashboard, Raporlar ve Finansal
Özet. P06'da hepsi sayılır ve taşınır. Yeni modül geldi diye yalnız `/talepler` değişip
Dashboard eski test satırını göstermeye devam edemez. Eski sayısal rapor ile kişi-gün
ölçüsü aynı değil; etiket ve hesap birlikte değişir.

## 10. Okuma ve performans

- Tarih aralığı+firma filtreli, sayfalı sorgu; tüm tenant'ın bütün atamalarını tarayıcıya alma.
- Günlük/haftalık görünüm request-days merkezli LEFT JOIN/aggregate: sıfır atamalı
  ihtiyaçlar listede kalır. N+1 personel/firma sorgusu yok.
- İndeks adayları: locations tenant/company; request-days tenant/date/request;
  assignments tenant/request-day ve aktif worker/date unique; events tenant/request/time.
- View kullanılırsa owner-RLS bypass riski kontrol edilir; desteklenen sürümde
  security-invoker view veya aynı kapsamı sağlayan kontrollü okuma RPC'si.
- Cross-tenant cache yok. Yeni akışta ilk sürüm oturum bazlı güncel okuma; mutation
  sonrası ilgili firma/gün görünümü yenilenir. Realtime zorunlu değil.
- Test veri hedefi: 1.000 lokasyon, 100 personel, 90 günlük örnek plan; bu satış
  kapasitesi garantisi değil ölçüm fixture'ı. EXPLAIN ANALYZE test ortamında, yanıt
  boyutu ve p95 sorgu süresi kaydedilir. Üretim hacmiyle tekrar değerlendirilir.

## 11. Migration ve yayın sırası

| Sıra | DB değişikliği | Kodun açılması / kapanış |
|---|---|---|
| M0 / P00–P01 | Güncel schema baseline ve davranış/rol sözleşmesi | Yeni operasyon kodundan önce |
| M1 / P02 | Lokasyon, kaynak, import; RLS/grants/RPC aynı güvenli paket | Şube ekranı + import testleri |
| M2 / P03 | Personel, sözlük, request/day/assignment, command/event; ilgili sözleşme alanı | Tek talep→tek atama uçtan uca |
| M3 / P04 | Toplu/değiştirme RPC ve gereken indeksler | Atomik değişiklik testleri |
| M4 / P05 | Çıktı snapshot'ı ve dar olay kaydı | Haftalık pilot |
| M5 / P06 | Eski yazma yolunu kapama; ancak ayrı doğrulanmış aşamada eski tablo temizliği | Bütün okuyucular taşınmış olmalı |

M0–M5 mantıksal paketlerdir, gerçek migration timestamp'i değildir. Başka ajanın
yeni migration'ıyla ad/sıra çakışması başlangıçta kontrol edilir. Kullanılmış SQL
dosyası geriye dönük değiştirilmez.

Her paket: preflight → test ortamı apply → DB ve uygulama testleri → Codex review →
insan kabulü → kontrollü prod apply → post-check/ledger → uyumlu kod deploy → kimlikli smoke.
Yeni tablolar+RLS+grant aynı transaction'da; arada açık tablo bırakılmaz. Mevcut büyük
tabloya indeks/constraint eklemenin lock maliyeti ayrıca ölçülür; kör `db push` yok.
`lock_timeout` ve `statement_timeout` paket bazında belirlenir; eski 15 saniyeyi
bütün veri işlemleri için otomatik kabul etme.

P05 pilot görünümü, tenant bazlı kapalı rollout üzerinden açılır. Pilot kullanıcıları
aynı ihtiyaç için iki yazma yüzeyine yönlendirilmez. P06 genel kesimde yeni okuyucular
birlikte açılır. Eski tabloyu ilk migration'da düşürme.

Geri dönüş: yeni yazma başlamadan uygulama rollback basit; yeni operasyon verisi
oluşunca eski sayaç ekranına dönmek eşdeğer geri dönüş değildir. Bu durumda yeni
yazmayı geçici durdur, veriyi koru ve düzeltme/uyumlu sürüm yayınla. Destructive
temizlikten önce veri sayımı, yedek ve geri yükleme yolu doğrulanır.

## 12. Zorunlu davranış kanıtları

| Test | Beklenen |
|---|---|
| Tenant A kimliğiyle B location/request/worker UUID'si | Okuma/yazma reddi, kaydın varlığı sızmaz |
| A→B taşınmış kullanıcının eski A token'ı | Yeni yüzeyde reddet; raw claim kabul edilmez |
| RPC'yi UI atlayarak çağırma; doğrudan tablo DML | Yetki ve bütünlük korunur; doğrudan DML reddi |
| Aynı worker/gün, iki farklı request, iki bağlantı | Tek aktif atama |
| Tek boş yere farklı iki worker, iki bağlantı | Bir başarı, bir kapasite hatası |
| Adet düşürme ile atama yarışır | Kapasite invariant'ı korunur |
| Pazartesi/Çarşamba ve Salı/Perşembe dönemleri | Yanlış çakışma yok |
| Beş günlük atamanın yalnız Çarşambasını değiştirme | Diğer dört gün aynı; geçmiş görünür |
| Toplu işlemin son gününde hata | Hiçbir gün değişmemiş |
| Response kaybı ardından aynı command tekrarı | Tek sonuç/tek etki |
| Aynı command, farklı payload | Açık hata |
| Gün iptali / worker pasifliği / firma pasifliği yarışı | Kararlaştırılan protokol, sessiz geçersiz atama yok |
| Aynı şube dosyasını iki kez yükleme | İkinci yüklemede çoğalma yok |
| Önizleme sonrası location kullanıcı tarafından değişmiş | Import eski veriyi ezmez |
| Sıfır atamalı request günü | Haftalık iç görünümde ve açık hesabında var |
| RPC error/null/bozuk veri | Başarılı/boş/uygunsuz diye yorumlanmaz |

`qa:static` bir tarayıcıdır; transaction/RLS kanıtı değildir. `qa:unit` mevcut saf
fonksiyon testleri içindir. Yeni domain testleri uygulama fonksiyonunu çalıştırmalı;
algoritmayı test içinde tekrar yazıp kendini doğrulama. TS test runner seçimi P01'de
küçük bağımlılık kararı olarak yapılır. SQL testleri ve gerçek iki bağlantılı yarış
testleri ayrıca gereklidir; yalnız mock Supabase client yeterli değildir.

Her kod paketinde etkisine göre `npm run qa:static`, `npm run qa:unit`,
`npx tsc --noEmit`, `npm run build`; yeni DB testleri ayrı sonuç. Çalışmayan test
PASS sayılmaz. Bu belge turunda kod/DB testleri çalıştırılmış iddiası yoktur.

## 13. Diğer modüllerin teknik devamı

| Paket | Teknik yaklaşım | Özellikle korunacak sınır |
|---|---|---|
| P07 görev/devir | Mevcut `tasks.assigned_to_user_id` + üyelik kontrollü atama; devirde görev/event aynı işlem | Yeni paralel görev motoru yok |
| P08 sözleşme/evrak | Mevcut contract/document FK'larını genişlet; sorumlu+aksiyon tarihi+görev ilişkisi; tetik kaydına idempotent görev üretimi | Otomatik hukuki sonuç çıkarma yok |
| P09 bildirim/rapor | Mevcut cron ve notification-log üzerinden kaynak olay+alıcı+kural tekrar önleme; başarısız gönderim retry/izlenebilirlik | Provider yanıtı belirsizken kesin exactly-once e-posta iddiası yok |
| P10 onboarding | Mevcut platform-admin üstüne davet durumları, süreli davet, üyelik/rol, görev devir envanteri | Auth API ile DB tek transaction değil; ara durum ve uzlaştırma gerekir |
| P11 SaaS işletimi | Modül hakları server+DB sınırında; tenant export manifest'i; restore provası; audit ve erişim kaydı | Modül satın alma rol yetkisi vermez; tenant izolasyonu her pakette |
| P12 gerçekleşme | Atamaya bağlı ayrı hizmet teyidi/istisna kaydı | Planlanan atama gerçekleşmiş iş değildir |

Bu paketler için ilk modülün şemasına şimdiden bütün gelecek kolonları ekleme.
Her birinin RPC/DDL sözleşmesi kendi başlangıcında mevcut kod üzerinden ayrıntılanır.

## 14. Claude Code ve Codex çalışma biçimi

Benim sorumluluğum teknik kararları, riskli sınırları, test senaryolarını ve review
ölçütlerini netleştirmek. Claude Code küçük paketi uygular ve kanıtıyla teslim eder.
Ben bağımsız diff/kod/SQL incelemesi yaparım; isim veya önceki başarı güvenlik kanıtı değildir.
Furkan ürün davranışını kabul eder. Aynı dosyayı aynı anda değiştirmeyiz.

İlk uygulayıcı görevi:

```text
01_product/BPS_OPERASYON_SAAS_IS_PLANI.md ve BPS_TEKNIK_UYGULAMA_PLANI.md dosyalarını oku.
P00/P01 hazırlığını yap. Bu tur ürün kodu veya canlı SQL çalıştırma.
Güncel HEAD ve aktif işleri doğrula. Teknik plandaki mevcut-kod iddialarını kontrol et.
Güncel DB ölçümünü kaynağı/ortamı/tarihiyle ayır; erişimin yoksa ölçtüm deme.
Yeni veri modelini mevcut FK/helper/grant'lerle karşılaştır; somut çelişkileri raporla.
K1–K8'den ilk banka dilimini etkileyen açık kararları listele.
Davranış/rol/durum belgeleri için dar diff önerisi ve baseline test ortamı planı hazırla.
P02 için kesin dosya listesi, DDL önkoşulları, RPC imzaları ve test matrisi çıkar.
Handoff: kapsam + kararlar + dosya/DB etkisi + açık sorular + Codex review noktaları.
```

P01 kapandığında ilk kod paketi **P02 lokasyon + import**. Aynı turda personel,
atama, bildirim, abonelik ve eski tablo DROP'unu başlatma. Her paket önce çalışan
uçtan uca küçük senaryo, ardından ilgili olumsuz/yetki/yarış senaryolarıyla kapanır.

## Teknik kaynaklar ve sınırları

- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security):
  yeni veri yüzeylerinde satır erişim sınırı; BPS rol kararının kaynağı değildir.
- [PostgreSQL kilitler](https://www.postgresql.org/docs/current/explicit-locking.html)
  ve [transaction isolation](https://www.postgresql.org/docs/current/transaction-iso.html):
  kilit sırası ve READ COMMITTED tasarım gerekçesi. Prod PostgreSQL sürümü ayrıca ölçülür.
- [Partial indexes](https://www.postgresql.org/docs/current/indexes-partial.html):
  yalnız aktif atamalarda benzersizliğin teknik dayanağı.
- [Prod drift kaydı](../02_rules/PROD_SCHEMA_DRIFT.md) ve
  [RLS ölçüm kaydı](../02_rules/RLS_ACCESS_MATRIX.md): tarihli repo kanıtlarıdır;
  bu tur yeni canlı ölçüm yapılmadı.
