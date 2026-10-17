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
| critical_dates | Ortak kurumsal tarih altyapısı; firma/randevu/sözleşme FK'sı yok. Modüller kapalıyken kendi şirkete yazma ve şirket sınırı yerel kabulde doğrulandı; aşağıdaki kapsam notuna bakın. |
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

## Güncel yerel katalog devamı

Staffing/workforce tablolarına başvuran public fonksiyonlar için yerel katalog taramasında yalnız yöneticinin modül önizlemesi bulundu. Bu, kaynak/runtime dışı yolları dışlamaz. Komut test şeması 23 eksik migration ile tamamlandı; aday metadata çıktısı post-migration-writer-candidates.json. Kalan doğrudan bariyersiz adaylar altı kimlik/davet/platform işlemi ve document_ack_cleanup_v1. Sonuncusu yeni evrak üretmez: yönetici/tenant doğrular, cleanup satırını kilitler, Storage/evrak/sürüm referansı yoksa tamamlanma kaydı yazar; tombstone'u kaldırmaz. Modül kapatma ön kontrolü pending cleanup'ı engeller. Bu iç bakım tamamlamasına iş üretme yetkisi gibi davranılmadı. Üretim yeniden ölçümü veya bütün servis/RPC yollarının tam kapanma kanıtı değildir.


## 17 Ekim — kurumsal tarihlerin modül sahipliği

critical_dates şeması ve src/app/(main)/kurumsal-tarihler/actions.ts incelendi: firma, sözleşme veya randevu FK'sı yok; ruhsat/izin/tescil gibi şirket geneli tarihleri tutuyor. Mevcut on modül kataloğunda bağımsız ortak altyapı olarak kalır; calendar veya staffing kapısı eklenmedi. Tarihlerdeki serbest metin, bir başka modülün kayıt ilişkisi sayılmaz.

Yerel sentetik transaction'da tüm modül ayarları fixture kurulumu için kapatıldı. authenticated yönetici kendi şirketinde tarih oluşturup okuyabildi; başka şirkete INSERT 42501, mevcut tarihi başka şirkete taşıma 23514 ile reddedildi. Test sonunda rollback yapıldı. Bu test tüm modüllerin gerçek komutla kapatılabileceği veya bütün rol matrisinin doğrulandığı iddiası değildir.

Komut/kabul süiti 22/22 geçti; result.tap güncellendi. Ürün kodu, migration veya üretim değişmedi. Yazma incelemesinde kurumsal tarihler başlığı bu kapsamla netleştirildi; diğer RPC/servis yolları ve yayın ön kontrolü açık kalır.
