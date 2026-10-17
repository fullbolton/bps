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

## 17 Ekim — şema temelli yazma yüzeyi envanteri

Güncel public şema snapshot'ı + iki bekleyen migration yeniden yerelde uygulandı. `qa/contract-write-20261015/writer-catalog.sql` 285 fonksiyonun tam imzasını, owner/definer/config/rol EXECUTE durumunu ve gövde MD5'ini; 70 kullanıcı tetikleyicisini ve 179 FK tanımını kaydetti. Kanıt: `qa/contract-write-20261015/pending-rehearsal-20261017/writer-catalog.json`. İş verisi veya fonksiyon gövdeleri rapora alınmadı; geçici DB temizlendi.

Genişletilmiş kelime taramasında authenticated EXECUTE sahibi definer yazma adaylarından doğrudan modül guard sinyali olmayanlar önceki yedi imzayla aynı: accept_workspace_invitation, admin_create_tenant, admin_manage_membership, document_ack_cleanup_v1, manage_workspace_invitation, prepare_invited_profile, select_workspace. Bunlar önceki kimlik/platform ve cleanup sınıflandırmasıyla uyumlu. Anon EXECUTE + definer + yazma kelime sinyali birleşiminde aday yok. Bu metin taramasıdır; dolaylı çağrı veya yetki kanıtı değildir.

18 ON DELETE CASCADE ilişkisi var. Özellikle companies → financial_summaries, staffing_demands, workforce_summary ve partner_company_assignments yolları doğrudan child tablo çağrılarından ayrı test edilmeli. Profil/tenant silme yolları da bakım sınırında tutulmalı. FK iç işlemlerinde RLS yeterli kanıt değildir; trigger ve gerçek rol altında transaction sonucu ölçülmeli. Henüz açıkların istismar edilebilir olduğu iddia edilmez. Kalan kabul: bu silme zincirleri, diğer dolaylı RPC/servis yolları, ardından gerçek modül kayıt UI bağlantısı. Üretim yayını yapılmadı.

## 17 Ekim — firma silme zinciri kabulü

`qa/module-change-command-20261017/company-cascade.test.mjs`, güncel ortak migration fixture'ıyla sentetik yerel PostgreSQL klonunda 5/5 geçti. anon/authenticated/service_role için companies DELETE ve TRUNCATE kapalı. authenticated doğrudan silme, staffing/finance açık ve kapalıyken 42501 döndürür; parent ve child kayıtlar korunur. company_execute_v1('delete',...) BC400 ile reddedilir. Mevcut status/pasif komutu staffing_demands, workforce_summary, financial_summaries kayıtlarını ilgili modül açık/kapalıyken korur.

İlk test beklentisi BM001 idi; ölçüm silmenin child bariyerine ulaşmadan companies tablo izninde 42501 ile engellendiğini gösterdi. Test gerçek sözleşmeye düzeltildi; silme yetkisi verilmedi, politika gevşetilmedi. Kanıt company-cascade-result.tap. Burada FK cascade çalıştırıldığı iddia edilmez: uygulama giriş yolu kapalıdır. Yetkili SQL bakım silmeleri ve diğer dolaylı definer yolları kapsam dışı; genel yazma incelemesi bütünüyle kapanmadı. Geçici DB temizlendi; ürün kodu, migration ve üretim değişmedi.

## 17 Ekim — servis yazıcıları ve bildirim kapıları

Kaynak taramasında SUPABASE_SERVICE_ROLE_KEY yalnız dört API rotasında bulundu: cron/notifications, healthz, demo-request, access-request. healthz profiles üzerinde head/count okur; iki public başvuru rotası yalnız sabit demo_requests/access_requests alanlarına INSERT yapar, tenant/modül ayarı veya iş kaydı yazmaz. Bu platform başvuruları ürün modülleri kapanınca durdurulmaz. Rate limit süreç içi/best-effort'tur; dağıtık kötüye kullanım koruması olduğu iddia edilmez. Cron tek dış gönderim yolu olarak notification_log damga/geri alma yazılarını yapar. Bu sınıflandırma repo içindeki bu istemciler içindir; dış servis anahtarı kullanıcılarını kapsamaz.

Gerçek TypeScript helper ve batch koduyla dört test dosyası 40/40 geçti; kanıt qa/module-change-command-20261017/service-notification-result.tap. Yeni 7 test tasks/calendar/contracts için yanlış tenant, yinelenen/eksik satır, null/string/sayısal enabled, ikinci sayfa RPC/transport/eksik sonuç hatalarını reddetmeyi kapsar. Önceden başarılı ilk 500 sonuç ikinci sayfa hatasında kısmi izin olarak dönmez. Mevcut batch testleri modül damgadan sonra kapanırsa gönderim yapılmaması ve geri alma çağrısını; sözleşmede geri alma hatasının görünmesini doğrular. DB ve e-posta transport'u sentetiktir; gerçek e-posta gönderilmedi.

Sınır: son uygunluk okuması ile dış HTTP gönderimi atomik değildir. Modül bu okumadan hemen sonra kapanırsa e-posta başlayabilir; başlamış gönderim geri çağrılamaz. Mevcut kontrol bu pencereyi sıfırlamaz. Üyelik snapshot'ı için de eşzamanlı değişiklikte anlık iptal garantisi yoktur. Otomatik e-postalar bu tur açılmadı ve canlı ayar yeniden ölçülmedi. Ürün kodu/SQL değişmedi. Kalanlar: diğer dolaylı RPC/Storage yollarının kapsamlı kabulü, üretim ön kontrolünün yenilenmesi ve gerçek modül kaydının kontrollü yayını; bu tur bütün yazıcıların kapandığı iddiası değildir.

## 17 Ekim — personel/proje Storage politikalarının gerçek şema kabulü

qa/module-change-command-20261017/storage-policy.test.mjs, bps_module_chain_20261005 sentetik şablonu ve manifestteki bütün sonraki migration'larla ayrı yerel DB oluşturdu. storage.objects tablosu ve gerçek politikalar değiştirilmeden authenticated rolünde iki bucket sınandı: person-files/talent ve project-sources/reporting. Açık modülde geçerli rezervasyonla INSERT ve hazır dosya SELECT başarılı; kapalı modülde SELECT sıfır satır ve yeni INSERT 42501. İkinci bağlantıda config kilidinde bekleyen INSERT'in gerçek Lock beklemesi ölçüldü; ilk bağlantı kapatmayı commit edince BM001 ve sıfır yeni metadata doğrulandı. Aynı rezervasyon modül yeniden açıldığında başarıyla yazıldı; ret geçersiz fixture'dan kaynaklanmıyor.

Sonuç: dört alt senaryo + kapsayıcı 5/5; storage-policy-result.tap. İlk denemede testin doğrudan Storage metadata silme hazırlığı 42501 ile engellendi. Koruma gevşetilmedi; ayrı rezervasyon/path kullanılarak düzeltildi. Geçici DB sonunda kaldırıldı. Bu SQL/RLS/gerçek kilit kabulüdür; Storage HTTP upload/download veya dosya byte/içerik doğrulaması değildir. Genel evraklar için önceki 29 HTTP kabulü ayrı kanıttır; bu iki bucket için HTTP kabulü henüz bu blokta yapılmadı. Ürün kodu, migration ve üretim değişmedi. Diğer dolaylı RPC'lerin tam incelemesi ve yayın ön kontrolü açık kalır.
