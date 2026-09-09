# Yerel kabul komutu

Durum: sentetik yerelde doğrulandı. Üretim uygulama veya migration komutu değildir.

## Kullanım

Hızlı kontroller (veritabanına bağlanmaz):

```sh
npm run qa:acceptance
```

Geçici kaynak kopyasında build eklemek için:

```sh
npm run qa:acceptance -- --build
```

Bu bilgisayardaki hazır runtime'larla tüm desteklenen modlar:

```sh
BPS_PGLITE_MODULE=/private/tmp/bps-operations-pgtest/node_modules/@electric-sql/pglite/dist/index.js \
BPS_EMBEDDED_PG_MODULE=/private/tmp/bps-native-pgtest/node_modules/embedded-postgres/dist/index.js \
npm run qa:acceptance -- --all
```

`--sql` yalnız SQL modlarını, `--local-api` yalnız eklemeli gerçek yerel API testini
hızlı kontrollere ekler. Bayraklar birlikte kullanılabilir. `--help` ayrıntıyı gösterir.
`--all` bu runner'ın desteklediği modların tamamıdır; aşağıdaki ayrı kabul kapılarını
kapsamaz. Runtime'lar repo bağımlılığı olarak eklenmedi; başka bilgisayarda mevcut
kuruluma ait mutlak modül yollarını açıkça ver. Araç kendiliğinden paket indirmez.

## Çalıştırılan adımlar

| Adım | Varsayılan | Ek koşul |
|---|---|---|
| Runner davranış testleri | Evet | — |
| Operations birim testleri | Evet | — |
| Mevcut unit testleri | Evet | — |
| Static kontrol | Evet | — |
| TypeScript | Evet | — |
| PGlite DB testleri | Hayır | `--sql`, mevcut BPS_PGLITE_MODULE |
| Native PostgreSQL yarış testleri | Hayır | `--sql`, mevcut BPS_EMBEDDED_PG_MODULE |
| Yerel ortam ön kontrolü + API testleri | Hayır | `--local-api` |
| Geçici kopyada build | Hayır | `--build` |

API modu önce `/private/tmp/bps-supabase-acceptance/supabase/config.toml` kök proje
kimliğini, DB/Kong container adlarını ve çalışmasını, 54321/54322 host portlarını,
CLI'nin loopback API/DB adreslerini, gerekli pilot RPC imzalarını ve iki sentetik
fixture tenantını doğrular. Test scripti de kendi yerel adres kontrolünü korur.
Eksik/başka ortamda API testine geçilmez. Var olan fixture sıfırlanmaz; API testi
sentetik kullanıcı/iş verisi ekler. Başlangıç one-shot `qa-local-supabase.mjs` çağrılmaz.

Build, src/public ve gerekli config dosyalarını geçici dizine kopyalar; node_modules
salt kopya yerine symlink ile çözülür. `.env*` ve mevcut `.next` kopyalanmaz. Build
env'si sınırlı OS değişkenleri ve yerel placeholder Supabase bilgisiyle kurulur.
Gerçek uygulama env'si kullanılmaz. Geçici build sonunda silinir; çalışır dev sunucusu
kapatılmaz. Bu binary, yayınlanacak üretim çıktısı değildir.

## Sonuç ve hata

Her çalıştırma OS temp altında kullanıcıya özel dizine `report.json`, `report.md`
ve adım logları üretir. Yol terminal sonunda verilir; dosyalar600, dizin700 erişimlidir.
Bilinen credential/JWT/Bearer/parola biçimleri maskelenir. Yerel API adımında yalnız
PASS etiketleri ve test toplamı loglanır; teşhis payload'ları dosyaya yazılmaz.
Rapor adım kimliği, çıkış kodu, süre, sinyal ve log kesilmesini içerir. Ortamın
anahtarları veya tam ortam dökümü rapora girmez.

- `passed`: istenen adım exit0 ile tamamlandı.
- `failed`: adım, runtime veya ön kontrol başarısız.
- `timed_out`: adım süreyi aştı; yalnız runner'ın oluşturduğu süreç grubu sonlandırılır.
- `interrupted`: SIGINT/SIGTERM; genel çıkış130.
- `skipped`: önceki hata/kesinti nedeniyle istenen adım başlamadı.
- `not_requested`: o mod istenmedi; PASS sayılmaz.

Hata/zaman aşımı çıkış1; geçersiz CLI seçeneği2; istenen adımların tamamı geçerse0.
İlk hatadan sonraki seçili adımlar çalışmaz. Kilit aynı anda ikinci kabul çalışmasını
engeller; normal çıkışta kaldırılır. Ölmüş PID kilidi seri recovery altında alınır;
okunamayan kilit veya yarım kalmış recovery otomatik silinmez, açık hata üretir.
Test sırasında kaynak dosyalarının başka araçlarca değiştirilmesi engellenmez.

## Ayrı kalan kabul

2026-09-09 ek: `--sql` ayrıca `qa-task-concurrency.mjs` çalıştırır; tam paket artık
11 adım. Bu test ayrı geçici native DB'de minimum tasks fixture'ı +01300 migration
kullanır. Ana ops DB testlerinin181/48 sayısı görev kabulünü kapsamaz; görev native
kontrolleri ayrıca16. `qa-local-task-prefill.mjs` ayrı çalışır ve dedicated sentetik
Supabase'e minimum görev fixture'ı/eksik01300'ü ekler; normal runner bu kurulumu
yapmaz. O komutun11 gerçek Auth/API kontrolü runner PASS'inden ayrıca raporlanır.

Kimlikli tarayıcı görsel akışları, HTTP CSV indirme testi (`qa-local-export.mjs`), native
PDF sayfalaması ve tam üretim şeması/Auth/function-owner entegrasyonu bu runner'ın
başarı sonucundan çıkarılamaz. API kayıp-yanıt testi SDK fetch sınırındadır; tarayıcı
paket kaybı testi değildir. Static mevcut WARN'ları kendi logunda gösterir; exit0
WARN yok demek değildir. Push/deploy, migration veya veri temizliği yapılmaz.


2026-09-09 randevu eki: --sql ayrıca qa-appointment-concurrency.mjs22 kontrolünü
çalıştırır; tam paket12 adım. Ayrı qa-local-appointment.mjs dedicated minimum
appointments fixture'ı +01400 kurar, mevcut draft RPC'yi yeniler;9 gerçek yerel API
kabulü runner sonuçlarına dahil değildir. Ops ana baseline hâlâ appointments
içermez. Gerçek üretim migration/owner/FK kabulü ve yeni-randevu tarih UI kabulü açık.


## 2026-09-09 — devir ve üyelik koruması ekleri

Tam runner14adım: yeni transfer-postgres (qa-task-transfer.mjs,26 kontrol) ve
membership-guard-postgres (qa-membership-task-guard.mjs,19 kontrol) --sql'e eklendi.
96 operasyon unit. Native portlar55442/55443, geçici dizin, loopback; mevcut runtime.
Son rapor /var/folders/fg/qm_gg6w16299dhr_lz9xr38r0000gn/T/bps-acceptance-A1VYcc/report.md.
Ayrı ve global kabul kilidi altında çalışacak kurulumlu API scriptleri:
`node scripts/qa-local-task-transfer.mjs` (10); ardından
`node scripts/qa-local-membership-task-guard.mjs` (7). Dedicated proje/container,
loopback ve synthetic tasks marker doğrulanır;01500/01600 eksikse yalnız buraya
uygulanır. Tekrar koşuda receipt'ler korunur, geçerli draft fonksiyonları yenilenir.
Üyelik scripti korunmuş admin fonksiyon sahibinin SELECT/UPDATE/RLS koşullarını da
transaction içinde doğrular. Auth kullanıcıları sentetiktir; parola/key loglanmaz.
Bu scriptler runner içinden iç içe çağrılmaz. Tam --all bunları kapsamaz; ayrı kabul.


## 2026-09-09 — 01700 yenileme görevi yerel kabulü

SOZLESME_YENILEME_SAHIPLIGI_DILIMI.md teslim kaydı: mevcut tasks motorunda tek açık
renewal ilişkisi/receipt, DB contract revision ve yönetici scoped yazma; 01600
üyelik/rol korumasına dahildir. Full runner15/15 (yenileme native18 yeni SQL adımı),
unit101; ayrıca `node scripts/qa-local-contract-renewal.mjs` gerçek yerel API7.
Sonuncusu tek başına, runner kilidi boşken çalışır; dedicated marker/container/
loopback kontrolü zorunlu. Tam prod şeması veya Storage fixture olduğu iddia edilmez.
17 migration yalnız sentetik yerel. Yeni görev açma pasif firmada yasak; mevcut
owner aynı task'tan okunur. Kapanma sözleşme yenilemez; ilişkili hard-delete ve
bağlam değiştirme engellenir. Yenileme tarihi operasyon takibi, hukuki süre değildir.
Native port55444, BPS_EMBEDDED_PG_MODULE mevcut geçici runtime. Frontend01700'dan
sonra etkinleştirilmeli; eksik RPC “görev yok” olarak gösterilmez.


## 2026-09-09 — 01800 PDF sürüm referansı ve Storage yerel kabulü

01800 yalnız dedicated synthetic. Aynı doc kimliğinde immutable version reference,
DB revision/CAS replacement; obje actor sahibi ve bağlı context doğrulanır.
Yeni retained Storage read/delete/update restrictive policy; eskilerin gövdesi
korundu. Sonfull16/16 report: /var/folders/fg/qm_gg6w16299dhr_lz9xr38r0000gn/T/bps-acceptance-kbOvzq/report.md.
105unit,18PDFnative; ayrıca `node scripts/qa-local-contract-pdf.mjs`10gerçekStorageAPI,
byte karşılaştırması ve eşzamanlı Storage remove/publish gerçek bloklanma kabulü.
Standalone API runner kilidi boşken çalışır. PDF native port55445.

Eksik yerel Storage için `node scripts/start-local-document-storage.mjs`; yalnız
marker/loopback/dedicatedcontainer doğrulanınca internalnetwork'te v1.35.3 ekler,
DB'yi durdurmaz/resetlemez, hostport açmaz. Volume bps_document_storage_acceptance;
.env.local değiştirilmez; secret değerler print edilmez. Env adları için resmi
[Supabase Compose](https://github.com/supabase/supabase/blob/master/docker/docker-compose.yml)
incelendi, mevcut yerel imajla gerçek API kabulü yapıldı. Kurulum supersetschema değil.

Upload/CAS ayrı işlemler: kullanılmayan blob kalabilir, aynı-command receipt yok.
Baseline byte/hash doğrulaması yok; yeni dosya hash attestation sonraki aşama.
Native file chooser UI kabulü açık; UIversionlist/eskilink ve APIbytekabulü ölçüldü.
Sıradaki SOZLESME_PDF_YUKLEME_DEVAMLILIGI_DILIMI.md. Ek protokol daha sonra; current
uniquecontractPDF indeksi/maybeSingle değişmedi. Gerçek veri yedeği/temizlik,
üretim migration/push/deploy yok. Migration lock_timeout15s toplam süre SLA'sı değil.


## 2026-09-09 — 01900 PDF yükleme sürekliliği yerel teslimi

İlk PDF ve değiştirme aynı kalıcı komutu kullanır: prepare → Storage → byte readback
→ finish. Tam kimlikli iptal daha prepare gelmeden tombstone oluşturur. Company →
transaction advisory serialization → contract SHARE → command sırası; aynı contract'ta ilk yükleme yarışı tek kazanır. Rol,
verified tenant, aktif firma, document kimliği/revision ve gerçek obje owner/size/
mimetype kontrol edilir. Rezervasyonlu path authenticated delete/update'e kapalı;
pending/cancelled path raw document yazısıyla yayımlanamaz. Private publishing
state yalnız finish transaction'ında yaşar; geç hata document/version/receipt'i
birlikte geri alır. Contract FK RESTRICT iptal defterini silerek tekrar kullanım
olasılığını kapatır. Yeni UI manager-only, operation history/download yetkisi korunur.

115unit,20native upload ve ayrıca10gerçek Auth/Storage/HTTP kabulü. Son full17/17:
`/var/folders/fg/qm_gg6w16299dhr_lz9xr38r0000gn/T/bps-acceptance-XC4PZO/report.md`. Static209dosya,0FAIL/2öncekiWARN. Native55446;
`node scripts/qa-pdf-upload.mjs`, `node scripts/qa-local-pdf-upload.mjs` (ikincisi
runner kilidi boşken, dedicated marker/container/loopback doğrulanarak). API log:
`/private/tmp/bps-upload-api-final.log`. Native scope ve minimal fixtures tam prod
şemasının/owner'ın kanıtı değildir. 19migration yalnız dedicated sentetik yerelde.

Gerçek HTTP10MiB testi ara katmanın form zarfıyla birlikte erken kesme sorununu
buldu: Next middleware11mb; route10MiB+64KiB body, dosya10MiB. File chooser ilk
PDF/replace, reload pending recovery, farklı byte reddi, iptal/reload, eski/güncel
PDF görüntüleme doğrulandı. Tek sentetik contract2fbc6abb-1d23-4e60-a6d6-2b7186ff270b:
son2published+1cancelled/2version. Geçici hata constraint'i kaldırıldı.

Hash sınırı: declared_sha256 RPC çağırıcısının beyanıdır; DB server attestation
değildir. Normal HTTP yolu gerçek byte'ları hashler ve Storage'dan doğrular.
PDF başlığı tam parse/zararlı yazılım taraması değildir. Baseline dosya yedeği yok;
Storage/DB tek transaction değil, kullanılmayan obje otomatik temizlenmez.
localStorage yalnız metadata; farklı cihazda dosya kendiliğinden bulunmaz.
Eksik01900 frontend'de boş/başarılı kabul edilmez. Üretim/push/deploy yok.

Sıradaki plan `01_product/SOZLESME_EK_PROTOKOL_DILIMI.md`: belge rolü/kimliği,
partial-main index + okuyucu/RPC/history/komut hedefi birlikte değişecek. P08'in
ek protokol ve diğer geniş maddeleri henüz tamamlanmadı. Önceki01800 intent ve
native chooser açık notları bu teslimle tarihsel kaldı.

01900 son kilit kontrolü: pending komut varken contract firma/tenant/kimlik
değişikliği yasak; iptal erişimi korunur. Advisory serialization aynı contract
uploadlarını sıraya alır; legacy metadata yazısıyla contract/document deadlock
yaratmaz. Testte metadata yazısı tamamlanır, finish yeni revision ile conflict
alır. Native yükleme toplamı20; bu sayı önceki18'in yerine geçer.


## 2026-09-09 — 02000 ana PDF ve bağımsız ek protokoller

02000 yalnız dedicated sentetik yerelde uygulandı. Bağlı belge rolü main/appendix
ve ek başlığı değişmez. Ana PDF için partial unique, çoklu ekler için bağımsız
DB belge kimliği; aynı başlık kimlik değildir. Yeni yükleme hedefi komut kimliğine
katılır. 01900 main RPC imzası, eski localStorage anahtarı ve tamamlanmış/iptal/
bekleyen komutlar korunur. Eski history RPC main-only; ek history/path RPC'leri
actor+verified tenant+contract+document eşleşmesini doğrular. Liste20+1 keyset,
20gösterim ve sonraki düğmesi; history50+1. Okuma hatası boş liste sayılmaz.

Migration kategori tutarsızlığında PDF_ROLE_BASELINE_REVIEW_REQUIRED ile durur;
mevcut bağlı belgeyi sessizce ana belge yapmaz. Backfill exclusive documents/command
kilidi altında sadece documents_guard_version trigger'ını kısa süre kapatır,
revision/provenance artırmadan rolü ekler, trigger'ı geri açar. Öncesinde etkinlik
kontrolü var; bekleme timeout15s toplam uygulama süresi değildir. 01800/01900
fonksiyon gövdeleri artık02000 mevcutken eski yerel API scriptleri tarafından
geri yazılmaz. Eski migration dosyaları değişmedi.

Kabul:121unit,32native ek protokol kontrolü,ayrı15gerçek Auth/Storage/HTTP kontrolü.
Native55447: qa-contract-appendices.mjs; ilk32,01900 regresyonunu da içerir;
20+32 tamamen bağımsız test sayısı gibi toplanmaz. Gerçek API:
qa-local-contract-appendices.mjs; global runner kilidi boşken çalışır.
Son full18/18: `/var/folders/fg/qm_gg6w16299dhr_lz9xr38r0000gn/T/bps-acceptance-3LQQlC/report.md`. Static212dosya,0FAIL/2öncekiWARN.
API log `/private/tmp/bps-appendices-api.log`. Yeni parse/service testleri6.

Tarayıcıda contract00000000-0000-4000-8000-000000000400: iki ek gerçek file chooser
ile yüklendi, ilk ek değiştirildi, eski PDF görüntüleyicide BPS SYNTHETIC VERSION
ONE görüldü. DB: ana revision2/3sürüm, dönemsel destek revision0/1sürüm, ek temizlik
revision1/2sürüm. Ana ve diğer ek değişmedi. Firma Evraklar listesi ek başlığını,
Ek Protokol kategorisini ve sözleşme bağlantısını gösteriyor; bağlı dosyada silme
UI'ı yok, DB geçmiş FK'leri ayrıca koruyor. AX link ile sözleşmeye dönüş ölçüldü.

Sınırlar: ana PDF/ek protokol/destekleyici genel firma evrakı birbirine otomatik
aktarılmaz. Başlık değiştirme ve belge rolü taşıma bu dilimde yok. Keyset liste
sabit UUID sırasındadır, bir sorgu snapshot'ıdır; ardışık sayfalar transaction
snapshot değildir, eşzamanlı yeni kayıt için listeyi yenilemek gerekir. Başarılı
upload sözleşme statüsünü/yenileme görevini değiştirmez. Hash01900 beyan sınırı,
10MiB HTTP/readback ve Storage korumaları korunur; e-imza/hukuki doğrulama yok.
20migration sadece sentetik yerel, üretim/push/deploy ve gerçek veri yedeği/temizlik yok.

Sıradaki: `01_product/EVRAK_TAKIP_SAHIPLIGI_DILIMI.md`. Geçerlilik güncellemesinde
CAS ve evrak→gerçek görev/sorumlu; mevcut01700/01500/01600 motorlarını kullan.
Bu plan henüz kodlanmadı. Önceki01900 “sıradaki ek protokol” notları tarihsel kaldı.


2026-09-09: `dashboard-activity-postgres` (02100) eklendi. `--all` artık 19 adım; yeni read-only feed tenant/rol/üyelik/baseline/20 kayıt kontrolleri. `node scripts/qa-local-dashboard-activity.mjs` ayrı ve yalnız guarded sentetik Supabase; 02100 uygulama + gerçek Auth/RPC + geçici test hesabı temizliği. Bu tur tam 19 adım çalıştırıldı iddiası yok; 6/6 genel/build, ayrı 11 SQL ve Auth/RPC kabulü.

02200: `workspace-setup-postgres` eklenince `--all` 20 adım. Ayrı `qa-local-workspace-setup.mjs` sadece guarded sentetik ortam; `local-workspace-setup.sql` yerel eksik tenant adını tamamlar. Bu teslim 6/6 genel/build ve ayrı 10SQL/Auth/RPC ile doğrulandı; full20 ölçümü değil.

02300: `workspace-invitations-postgres` ile runner21 adım;13SQL paralel kabul/iptal/eski claim/session kontrolü. Ayrı `qa-local-workspace-invitations.mjs` gerçek sentetik Auth kabulünü ölçer, geçici hesapları ve daveti temizler. Genel/type/build6/6 raporu `bps-acceptance-p0MVgJ`; full21 çalıştırılmadı.

02400: `invited-registration-postgres` ile runner22;18SQL eski13davet kontrolleri dahil. Ayrı `qa-local-invited-registration.mjs` guarded sentetik gerçek Authsignup/trigger; geçici trigger/kullanıcı/davet temizliği. Yerelde confirmations=false; email/PKCE/hook akışı test edilmiş sayılmaz. Genel/type/build6/6 raporu `bps-acceptance-TXpa14`; full22 çalıştırılmadı.


## 2026-09-09 — 02500 günlük Dashboard

Günlük talep/istenen/yerleştirilen/eksik, ilk 5 açık kayıt ve günlük plana bağlantı. Yönetici/operasyon, doğrulanmış tenant, sunucu özellik bayrağı. 8 native SQL + gerçek yerel Auth/RPC + genel/type/build 6/6. Runner artık 23 olası adım; tam paket bu tur çalıştırılmadı. Kanıt/sınırlar: `01_product/DASHBOARD_GUNLUK_OPERASYON_DILIMI.md`.


## 2026-09-09 — 027 mali okuma kabulü

Boş/dolu/yalnız firma kaydı tarayıcıda doğrulandı. Eksik gecikme sayısı sıfır yerine bilinmiyor; mali yenileme düğmesi. Yerel minimum mali okuyucu fixture, iki test kaydı temizlendi.128unit/genel5adım geçti; DNS nedeniyle ilk build başarısız, build tekrarı başarılı. Kanıt: `01_product/FINANSAL_OKUMA_KABULU.md`; sıradaki `01_product/PILOT_UCTAN_UCA_KABUL.md`.


## 2026-09-09 — 029 atomik Luca

Yeni confirm_mizan_atomic transaction sınırı, tenant/rol/firma kontrolleri, aynı UUID tekrarında receipt. Eski ham yazma ve derive istemci yetkileri kapatıldı.9nativeSQL+gerçekAuth/RPC+genel/type/build6/6. Yeni runner24olasıadım. Kanıt/açıklar `01_product/LUCA_ATOMIK_ONAY_DILIMI.md`. Yalnız yerel02600; prod yok.


## 2026-09-09 — 030 Luca kalıcı kurtarma

Mali veri saklamayan actor/tenant scoped digest+UUID rezervasyonu; sekmeler arası kilit; kesin ret ve belirsiz yanıt ayrımı.134unit/genel/type/build6/6 ve gerçekAuth/RPC yeniden oluşturulan kimlik testi. Browser gerçek reload açık. `01_product/LUCA_KALICI_KURTARMA_DILIMI.md`.
