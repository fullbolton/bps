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
