# Modül kapatma öncesi yazma yüzeyi — 17 Ekim 2026

## Yenilenen kaynak ölçümü

`node scripts/module-access-inventory.mjs`: 473 TS/TSX, 47 route, 322 çağrı, 6 dinamik hedef. Güncel çıktı qa/tenant-modules-foundation-20260928/access-inventory.json. Bu AST envanteri erişim kanıtı değildir; helper/SDK içleri ve repo dışı yazıcılar kapsam dışıdır. Üretim kataloğu bu tur yeniden ölçülmedi.

## Doğrulanmış engel ve yerel düzeltme

staffing_demands ve workforce_summary doğrudan insert/update/upsert kullanıyor. Yerel şema klonunda mevcut policy/trigger katalogları modül kontrolü taşımıyordu. authenticated rolüyle staffing kapalıyken iki tabloya yazma ve talebi okuma başarıyla yeniden üretildi.

supabase/migrations/20261017000100_legacy_staffing_module_barriers.sql, iki tabloda restrictive ALL modül/tenant policy ve BEFORE STATEMENT yazma bariyeri ekler. Statement bariyeri config SHARE kilidini UPDATE/DELETE iş satırı kilidinden önce alır; profile SHARE sonrası canlı bağlam tekrar denetlenir. Mevcut rol politikaları korunur. Salt okunur SELECT kilit almaz. Yönetici/service maintenance bypass'ı değişmez; bu rollerin dış yazıcı denetimi ayrıca gerekir.

legacy-staffing-result.tap: 6 alt senaryo + kapsayıcı = 7/7. Hatanın düzeltme öncesi yeniden üretimi, kapalı okuma ve üç DML reddi, açıkken normal güncelleme, tenant değiştirme reddi ve gerçek config Lock beklemesinden sonra kapalı durumun görülmesi. Sentetik klon sonunda kaldırıldı. Migration dosyası hazır; canlıya uygulanmadı. RLS kapalı şema sapmasıyla atomik ret ve geride helper/policy kalmaması ayrıca test edildi.

## Diğer görülen yüzeyler

| Yüzey | İnceleme / sınır |
|---|---|
| profiles, access_requests; demo/access request API | Kimlik/platform altyapısı; staffing gibi ürün modülü olarak kapatılmamalı. Mevcut rol/tenant kuralları ayrı. |
| critical_dates | Ortak tarih altyapısı; modül sahipliği ve bağlantılı kaynak davranışı ayrıca kararlaştırılmalı, keyfi staffing kapısı eklenmedi. |
| documents Storage | 20261016001100 config bariyeri + rezervasyon + profile sonrası tekrar kontrol; önceki HTTP/yarış kanıtları mevcut. |
| person-files Storage | talent_attachment_access(upload=true) ve cleanup helper config bariyeri taşıyor; 20261005002200. Bu tur yeni HTTP testi yapılmadı. |
| project-sources Storage | reporting_source_access(write=true) config bariyeri; 20261005002800. Kaynak aksiyondaki dinamik bucket sabit project-sources'a çözülüyor. Yeni HTTP testi yapılmadı. |
| Dinamik import RPC'leri | import-undo: review/undo_update; talent-import: close/recover. Sabit iki uç seçiliyor; keyfi istemci RPC adı yok. |
| Dinamik related-company-record | contracts/appointments salt okunur ilişki doğrulaması. |
| notification_log/service e-posta | Damga ve geri alma doğrudan servis yazımı; gönderim öncesi modül uygunluk sorgusu var. Dış HTTP teslimi DB transaction dışında; başlamış e-posta geri alınamaz. Otomatik e-posta açılmadı. |

## Açık işler

- İki tablo düzeltmesi 20261017000100 migration dosyasına taşındı; RLS/tenant tipi/önkoşul fonksiyon kontrolleri var. Eski fonksiyon gövdesi değiştirilmediği için gövde hash yaması yok. Aday komutla aynı yerel klonda doğrudan authenticated INSERT ve UPSERT yarış kabulü geçti; bütün üretim zinciri provası ayrı.
- Definer RPC/trigger/FK/servis yollarını güncel katalogdan signature bazında tamamla. Bu doküman bütün SQL fonksiyonlarının incelendiği iddiası değildir.
- Üretim katalog ve migration sırasını yayın öncesinde yeniden ölç.
- Kayıt komutu/receipt protokolü ve menü/cache/UI bağlantısı ile gerçek kayıt tarayıcı kabulü hâlâ açık; komuta EXECUTE verilmedi.
