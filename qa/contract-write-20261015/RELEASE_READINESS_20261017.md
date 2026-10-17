# Evrak yaşam döngüsü — yayın hazırlığı, 17 Ekim

İncelenen kaynak: `0dc821b`. Bu belge yayın yapıldığını göstermez.

## Tamamlanan yerel kabuller

- Bekleyen yükleme listeleme, kurtarma, iptal; içerik/sahiplik doğrulamalı finalize ve Storage yazma sınırları: `browser-storage-result-20261017.json`, 29 HTTP kontrolü.
- Gerçek yerel oturum/server action ile kurtarma ve iptal: `browser-recovery-cancel-20261017.png`.
- 51 kayıtla ikinci sayfanın son satırını iptal edip ilk sayfaya dönüş: `browser-pagination-20261017.json`. Tamamlama yolunun aynı sayfalama davranışı bileşen testinde; tarayıcıdaki senaryo iptal içindir.
- Açık temizlik panelinin yeni iptali otomatik göstermesi: `browser-cleanup-refresh-20261017.txt`.
- Temizlik yanıtının eksik/bozuk/tekrarlı satırlarında hata, eski listeyi temizleme: `cleanup-validation-tests.tap`, ilgili iki süit 21/21.
- Yerel aday modül komutu: `../module-change-command-20261017/result.tap`, 25/25. Kapatma/prepare yarışının iki sırası, iptal→temizlik engeli, audit hatasında rollback ve tekrar, rol/şirket değişimi, idempotency içerir. Komut qa altında; istemci EXECUTE kapalı.

- Cleanup yanıt parser'ı gerçek yerel RPC yanıtıyla ilk açılış/yenileme tarayıcı kabulü: `browser-cleanup-parser-20261017.txt` (kaynak f3b11eb; ürün 0dc821b).

## Yayından önce açık kapılar

1. Ledger ve hedef preview gövdesi 17 Ekim canlı ölçümüyle eşleşti (live-ledger-preflight-20261017.json, live-schema-preflight-20261017.json). Bekleyen `20261017000100` ve `20261017000200` sıralı yerel provası ve değişen nesnelerin owner/ACL kontrolü tamamlandı (pending-rehearsal-20261017/result.json). Kalan: yayın öncesi güncel canlı ölçüm ve kapsamlı yazma yüzeyi incelemesi. Önceki üretim ölçümü güncelmiş gibi kullanılamaz.
2. SQL ve frontend sırası: yeni preview parser'ı `pending_contract_upload` kontrolünü bekler; SQL önce. Eski sunucu + yeni parser hatayla durur.
3. Aday modül değiştirme komutunun kalan RPC/servis yazma yüzeyi incelemesi, uygulama bağlantısı ve gerçek kayıt tarayıcı kabulü. Bu yayın hazırlığı gerçek modül kapatmayı açmaz.
4. Seçilen yayın commit'i ve dağıtım kaydı, canlı kimlikli smoke. GitHub push otomatik üretim yayını değildir.

## Son kayıtlı üretim durumu (bu tur yeniden ölçülmedi)

`../release-chain-20261016/recovery-fix-release-20261017.json`: kaynak `312a468`, deployment `dpl_CQ9mr8chp8Ppat2BEWunDquhgzMs`, migration sayısı 182. Bu yalnız kayıtlı önceki ölçümdür. Bu tur üretim verisi/DDL, temizlik veya içerik yedeği işlemi yok.

## Kapsam dışı uyarılar

Statik tarama kullanılmayan `CapacityRiskCard` ve `TimelineList` bileşenlerini bildiriyor. Bu paket içinde silinmediler. Test envanterinin database/pending sınıfları qa:release tarafından çalıştırılmaz; tüm veritabanı testleri geçti diye yorumlanmamalı.


## 17 Ekim — toplu regresyon ve yayın hazırlığı özeti

0dc821b üzerinde qa:release çalıştırıldı: envanter 128 application / 27 database / 7 pending; saf fonksiyon kontrolleri, 715/715 application testi, statik 16 kontrolde 0 FAIL/1 WARN ve TypeScript geçti. İlk derleme NEXT_PUBLIC_SUPABASE_URL/ANON_KEY eksikliğiyle /import prerender aşamasında durdu; qa:release bütünü başarılı diye kaydedilmedi.

NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:3061 ve açıkça sentetik build-only anon değeriyle ayrı npm run build exit 0 geçti. Bu derleme gerçek üretim bağlantısı veya canlı veri kabulü değildir. İlk koşu ve tekrar ayrı loglarda korundu: release-check-20261017.log, build-local-env-20261017.log.

RELEASE_READINESS_20261017.md tamamlanan kanıtları ve kalan kapıları tek yerde toplar. Son cleanup parser tarayıcı kabulü, güncel üretim şema/ledger ölçümü, iki pending migration'ın sıralı provası ve modül gerçek kayıt akışının kalan işleri açık. Üretim ölçümü/yayını bu tur yapılmadı. Statik WARN: kullanılmayan CapacityRiskCard, TimelineList; kapsam dışı silme yapılmadı.

## 17 Ekim — iki bekleyen migration için sıralı prova

`rehearse-pending.py`, SHA256 ile sabitlenen 17 Ekim public şema ölçümüne `20261017000100` ve `20261017000200` dosyalarını sırayla uyguladı: ikisi de exit 0. Kanıt: `pending-rehearsal-20261017/result.json`. Geçici yerel veritabanı kaldırıldı. Üretime SQL uygulanmadı.

Katalog kabulü: iki statement-level BEFORE yazma trigger'ı, iki restrictive politika, postgres sahipli SECURITY DEFINER bariyeri, boş search_path/5s lock timeout; anon/authenticated/service_role için bariyer EXECUTE kapalı. Preview fonksiyonunun owner/ACL değeri değişmedi ve pending_contract_upload kontrolü eklendi.

Sınır: public şeması üretimden; auth/storage/extensions bağımlılıkları sentetik yerel şablondan geldi. DROP public CASCADE ile kaldırılan şemalar arası bağımlılıklar bu provayla üretim eşdeğeri sayılmaz. Bu bir sıralı DDL/katalog provasıdır; canlı trafik, lock süresi veya tüm yetki/yazma yüzeyleri için kanıt değildir. Yayından hemen önce canlı ledger ve gövde ölçümü yenilenmeli. Gerçek modül kapatma hâlâ açılmadı.

## 17 Ekim — personel ekleri ve proje kaynakları HTTP kabulü

BPS_MODULE_STORAGE_HTTP=1 node qa/contract-write-20261015/storage-http.mjs ile gerçek yerel Storage v1.35.3 ve PostgREST v14.3 çalıştırıldı. Yeni storage-http-acceptance.mjs mevcut geçici DB/container düzeneğine opt-in olarak bağlandı; üretim adresi veya anahtarı kullanılmadı. Sentetik rezervasyonlar SQL ile hazırlandı; personel dosyasının ready durumu fixture olarak işaretlendi. Bu test reserve/finalize RPC'lerinin yeni uçtan uca kabulü değildir.

person-files ve project-sources için HTTP yükleme, caller owner_id, indirilen birebir byte içeriği; foreign/anon okuma-yükleme reddi; modül kapalıyken okuma/yükleme reddi ve sıfır yeni metadata; yeniden açılınca mevcut byte'ların korunması ve bekleyen rezervasyona başarılı yükleme ölçüldü. İki bucket için 10 kontrol + önceki genel evrak 29 kontrol = 39/39. Kanıt qa/module-change-command-20261017/storage-http-result.json. Çalıştırma exit0; finally geçici Storage/PostgREST container'larını ve DB'yi kaldırdı. Gerçek kullanıcı verisi veya üretim değişmedi.

Bu iki bucket'ın önce açık kalan temel HTTP kabulü tamamlandı. Eşzamanlı kapanma SQL kilit testi önceki storage-policy-result.tap dosyasında ayrı kanıttır; HTTP streaming yarış testi bu iki bucket için yapılmış sayılmaz. Kalan kapılar: dolaylı RPC incelemesinin tamamlanması, yayından önce güncel üretim şema/ledger sırasının yeniden ölçümü, aday kayıt komutunun migration/izin/UI bağlantısının kontrollü yayın paketi. Aday komut hâlâ üretime uygulanmadı; ayarlar ekranında gerçek modül kapatma açılmadı.

## 18 Ekim — gerçek ayarlar ekranı kayıt bağlantısı ve toplu kontrol

WorkspaceModules, varsayılan false changesEnabled capability'siyle gerçek ModuleChangePreview → ModuleChangeCommit bağlantısını aldı. Ayarlar sayfasında NEXT_PUBLIC_BPS_MODULE_CHANGES_ENABLED yalnız tam "true" ise açılır; mevcut ortam ayarı değiştirilmedi. createModuleChangeCapability typed RPC payload'ını aynen iletir, 15 saniye abort sınırı uygular, hata durumunda kendiliğinden yeni komut üretmez/tekrarlamaz. UUID yalnız onay niyeti hazırlanırken üretilir. Receipt doğrulaması eski attempt katmanındadır; başarılı commit sonrası tam sayfa yenileme auth/provider/menü snapshot'larını birlikte yeniden oluşturur. Kullanıcının kapattığı modül verileri silinmez. Flag yetkilendirme değildir: SQL EXECUTE ve atomik bağlam/rol/önizleme kontrolleri zorunlu kalır.

31 hedefli test, 132 application dosyasında 740/740 test, qa:unit, TypeScript ve statik 16 kontrolde 0 FAIL geçti. Bilinen CapacityRiskCard/TimelineList uyarısı korunuyor. Release flag true ve yalnız localhost/sentetik Supabase değerleriyle Next production build exit0 geçti; bu üretim bağlantısı veya yeni ekranın tarayıcı kabulü değildir. Kanıt product-ui-result.tap ve product-release-checks-20261018.json. Önceki tarayıcı testleri ayrı QA paneline aittir.

Kalan yayın işi somut olarak üç kapıdır: (1) aday SQL komutunun tarihli migration/ACL paketine dönüştürülmesi ve kalan dolaylı yazma değerlendirmesinin imza bazında kapatılması; (2) güncel üretim şema/ledger ölçümüyle sıralı prova; (3) gerçek Ayarlar ekranında kayıt sonrası tüm uygulama yenilemesinin tarayıcı kabulü, ardından kontrollü flag açılışı. Bu tur bunlar bitmiş veya üretim yayımlanmış sayılmaz. İki pending migration ve candidate SQL üretime uygulanmadı; varsayılan UI hâlâ önizlemedir.

## 18 Ekim — gerçek Ayarlar tarayıcı kabulü ve yeni menü engeli

Yerel GoTrue/PostgREST/Storage/Next ortamında gerçek /ayarlar ekranı CUA ile kullanıldı. Duyurular kapatıldı; yeniden yüklemeden sonra kapalı durum okundu. İkinci komutta Duyurular yeniden açılıp Finansal özet kapatıldı; kayıttan sonra yeni seçimler doğrulandı. İlk kayıt kullanıcıyı Şirket ekibi sekmesine döndürdü. WorkspaceModules artık /ayarlar?bolum=moduller adresine tam navigasyon yapıyor; Ayarlar yalnız bu tanımlı query değerinde Modüller sekmesini açıyor. İkinci kayıt sonrasında Modüller sekmesi açık kaldığı tarayıcıda ölçüldü.

ÖNEMLİ AÇIK: Finansal özet kapalıyken sol menü bağlantısı görünmeye devam ediyor. Sidebar.tsx yalnız role göre süzüyor, modül snapshot'ı tüketmiyor. Önceki 'tam reload menüleri günceller' varsayımı bu ölçümle yeterli değil: reload mevcut olmayan modül filtresini yaratmaz. Modül bazlı menü görünürlüğü ve yükleme/hata davranışı eklenmeden UI flag üretime açılmamalı. Bu görsel bulgu veri erişimi açığı olduğu iddiası değildir; veri kapıları ayrı kanıttır.

Kanıt product-settings-browser.png/.txt. 7 panel/transport testi ve TypeScript geçti. Yerel harness exit0; 29 mevcut Storage kontrolü, geçici container/DB/route temizliği tamamlandı. İlk localhost yönlendirmesinde test proxy CORS kaynaklı giriş başarısızdı; aynı 127.0.0.1 hostunda gerçek giriş başarılı oldu. Üretim değişmedi. Sonraki somut öncelik Sidebar modül filtresi, ardından SQL release paketi ve güncel üretim ön kontrolü.

## 18 Ekim — modül bazlı menü filtresi tamamlandı

Sidebar artık her modüle bağlı bağlantıda doğrulanmış modül durumu ile mevcut rol filtresinin kesişimini kullanır. Desktop/mobile aynı içerikten üretilir. useNavigationModules scoped RPC snapshot'ı okur; yükleme veya hata sırasında modül linkleri görünmez, hata için tekrar dene vardır. Genel bakış, ortak raporlar ve rolün izin verdiği Ayarlar/Şirket Yönetimi gibi ortak girişler korunur. Başka şirketten geç gelen yanıt yeni menüyü değiştirmez. Bu UI filtresi SQL yetkilendirmesinin yerine geçmez; diğer sekmede sonradan değişen ayarlar için anlık push/revocation garantisi yoktur.

9 hedefli test geçti: kapalı modül, başarısız yenileme, şirket değişimi/geç yanıt, kimlik yüklenirken istek atmama, masaüstü/mobil rol-modül kesişimi. Gerçek yerel Ayarlar ekranında Finansal Özet açıktı ve menüdeydi; onaylı kayıt sonrası kapalı duruma geçti, Modüller sekmesi korundu ve Finansal Özet bağlantısı menüden kalktı. Önceki product-settings-browser.txt içindeki menü engeli bu sürümde giderildi. Kanıt navigation-result.tap, navigation-browser.png/.txt. Harness exit0, 29 Storage kontrolü ve geçici DB/container/route temizliği tamamlandı. Üretim değişmedi; SQL yayın paketi ve güncel üretim ön kontrolü hâlâ bekliyor.

## 18 Ekim — güncel üretim ön kontrolü ve kayıt komutu provası

Supabase CLI ile yalnız migration listesi ve public schema-only dump alındı. Proje dffdzbmnmnokbftbujsy; 182 remote sürüm önceki listeyle birebir aynı, son sürüm 20261016001100. Yeni şema SHA256 706e8399171f68a8cb454c275b933ba653623da6503be0b64884b0d39c288ce2 önceki ölçümle aynı. Şema repo dışında 0600 dosyada tutuldu; iş verisi okunmadı/yedeklenmedi. Kanıt live-preflight-20261018.json, dosya hash'leri ve tam migration sürüm listesi.

rehearse-pending.py artık açık --preflight/--out/--candidate seçenekleriyle hash'i ölçüme bağlı tekrar üretilebilir prova yapabiliyor. Varsayılan eski prova davranışı korunur. Yeni ölçüme karşı ayrı yerel DB'de public şema restore + 20261017000100 + 20261017000200 + aday change_workspace_modules_v1 başarıyla uygulandı. Preview owner/ACL korunuyor; aday postgres SECURITY DEFINER, boş search_path, 5s lock_timeout; anon/authenticated/service_role EXECUTE kapalı. Son katalog 286 fonksiyon/70 trigger/179 FK. result.json success=true ve cleaned=true; geçici DB kaldırıldı. Auth/Storage/extensions yerel sentetik bağımlılıklardır; tüm üretim eşdeğerliği veya trafik kilit süresi iddiası yoktur.

Bu yayın ön hazırlığıdır: aday SQL hâlâ tarihli production migration zincirine eklenmedi, grant verilmedi, UI flag açılmadı. Sonraki somut adım aday SQL ve ACL açılışını tarihli kontrollü release paketine almak; yazıcı incelemesinin kapsam sınırlarını release kararında açıkça belirtmek. Gerçek yayın öncesinde bu ölçümün güncelliği yeniden doğrulanmalı. Üretime DDL veya uygulama yayını yapılmadı.

## 18 Ekim — kayıt komutu ve ayrı etkinleştirme paketi

Aday SQL 20261018000100_workspace_module_change_command.sql migration dosyasına taşındı; eski QA kopyası kaldırıldı. Kurulum PUBLIC/anon/authenticated/service_role EXECUTE kapalı bırakır. Ayrı enable.sql exact signature/gövde/sahip/ayar/ACL denetiminden sonra yalnız authenticated yetkisi açar; disable.sql yeni çağrıları kapatır. Ayarları eksik proconfig durumunda SQL NULL değerlendirmesinin kapıyı atlamaması için coalesce(false) kullanıldı ve gerçek HTTP testine eklendi.

Ortak fixture 25 migration; komut SQL 26/26, fixture 5/5. Üç migration güncel ölçülmüş public şema üzerinde sıralı provadan geçti; clientExecute=false, success=true, cleaned=true. Kayıt komutu runtime pg bağımlılığı eski geçici klasörde bulunamadığından ilk test başlamadı; repo dışında /tmp/bps-module-release-runtime içine pg kurularak test başarıyla tekrarlandı. Üretime DDL/grant/deploy yapılmadı. Yayın sırası, etkinleştirme/geri kapatma ve inceleme sınırları qa/module-change-command-20261017/release/README.md içinde. Sonraki iş güncel canlı ön kontrol sonrası kontrollü SQL/uygulama yayını ve kimlikli canlı kabul; bunlar bu kayıtta tamamlanmış sayılmaz.

## 18 Ekim — Modüller paketi ÜRETİMDE

Kaynak 132feab; Vercel dpl_BKQKaeNxjU1kZDhNR3sncDFrtokF www.bpsys.net alanına alındı ve bağımsız inspect ile doğrulandı. Güncel public şema hash'i prova ile aynıydı; canlı 182 ledger sürümü ve bakım bariyeri yokluğu yeniden doğrulandı. Üç migration, exact prefix kontrolü ve ledger kilidiyle tek transaction içinde uygulandı: 20261017000100, 20261017000200, 20261018000100. Ledger artık 185. Sonraki ayrı etkinleştirmede gövde/sahip/ayar/ACL kontrolü geçti; authenticated EXECUTE açık, anon/service_role kapalı. UI flag açık; otomatik e-postalar false korunuyor.

744/744 uygulama testi; Vercel production build READY; statik 0 FAIL/1 bilinen WARN. Atomik yerel prova hata enjeksiyonunda bütün DDL ve ledger rollback, normal 185 kayıt, tekrar uygulama reddi ve grant/revoke doğruladı. İlk fixture sahiplik hataları düzeltildi; üretim politikası gevşetilmedi.

Canlı Mek Group oturumunda Modüller ekranı yüklendi; açık görevler Görevler kapanmasını engelledi; Duyurular önizlemesi son onay adımına ulaştı. Kaydet tıklanmadı, seçimler sıfırlandı, şirketin modül ayarları değiştirilmedi. Evrak listesi yüklendi. Canlı kayıt, ağ kaybı ve yarış enjeksiyonu yapılmış sayılmaz; yerel kanıtları ayrıdır. Gerçek veri temizliği/yedeği yapılmadı. Kanıt qa/module-change-command-20261017/release/production-release.json ve production-install/enable.json. Önceki 'üretimde bekliyor' kayıtları bu paket için tarihsel kaldı.
