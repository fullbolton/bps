# Geçici yayın yazma bariyeri — yerel prototip

Üretimde uygulanmadı. Otomatik migration değildir; 53 aday sayısı değişmedi. `install.sql` doğrudan postgres/supabase_admin oturumunda public/storage tablolarına sıralı SHARE ROW EXCLUSIVE kilidi alır. Mevcut DML transaction'larını bekler; normal SELECT'i engellemez. 5s lock ve 30s toplam timeout; kilitlenme/zaman aşımında transaction geri alınır, başarı sayılmaz. Aynı sıra farklı iş transaction'larıyla deadlock ihtimalini ortadan kaldırmaz; hata durumunda rollout durur.

BEFORE STATEMENT INSERT/UPDATE/DELETE/TRUNCATE trigger'ı bağlantının session_user kimliğine bakar. authenticator (authenticated/service_role rolüne geçse de) ve supabase_storage_admin PT503 alır. SECURITY DEFINER RPC'nin current_user=postgres olması bypass sağlamaz. Doğrudan postgres/supabase_admin, migration DML'i için geçebilir. Bu yönetici bağlantılarının kendileri denetimli olmalıdır; admin kullanan harici yazıcı varsa bariyer bunu durdurmaz.

`verify.sql` tüm public/storage tablolarının trigger türü, fonksiyonu ve enabled durumunu denetler. `extend.sql` yeni tabloları ekler, mevcut korumadaki sapmayı düzeltmiş gibi yapmadan reddeder. Yeni tabloların oluşturulması ile extend arasındaki aralık korunmuş sayılmaz; uygulama kapalı kalmalı, yeni tabloya erişen dış servis olmamalıdır. `remove.sql` kayıtlı trigger'ları doğrulayarak transaction içinde kaldırır. Sapma varsa tüm kaldırma geri alınır. Sessiz süre aşımıyla kendiliğinden açılma yoktur.

## Yerel kanıt

`NODE_PATH=/private/tmp/bps-calendar-qa-runtime/node_modules node qa/release-chain-20261016/barrier/test.mjs` (normal kurulumda package.json pg bağımlılığı kullanılır).

Geçici sentetik klonda 90 tablo korundu, 9 kontrol geçti: gerçek iki bağlantıda bekleme/okuma, commit sonrası kurulum, authenticated/service/Storage session kimlikleriyle dört DML türünün reddi, SECURITY DEFINER reddi, doğrudan admin DML, yeni tablo kapsam hatası ve idempotent extend, trigger sapmasında atomik kaldırma reddi, başarılı kaldırma sonrası yazmanın geri gelmesi. Klon finally içinde silinir. İlk bağımlılık/fixture izin hataları test düzenine aitti; ürün izinleri değiştirilmedi.

## Henüz kanıtlanmayan

- Üretimde gerçek API/Storage connection session_user ve ayrıcalıklı harici yazıcı envanteri.
- Gerçek Storage HTTP yükleme/silme kabulü; fiziksel dosya aktarımı veya önceden verilmiş signed URL iptali. Metadata bariyeri bunları bütünüyle durdurduğu iddiası taşımaz.
- Bariyer açıkken güncel şema üstünde tüm 53 migration, ardından extend/verify/remove sırasının provası.
- Auth şeması kapsanmaz; giriş/refresh engeli değildir. Dış e-posta gibi transaction dışı yan etkiler bu trigger'la geri alınmaz; uygulama/cron kapısı ayrıca gerekir.
- Üretim trafik hacminde bekleme süresi; tablo dışı sequence/advisory/harici servis yan etkileri.

Bu sınırlar kapanmadan tam yayın kilidi hazır değildir. Sadece middleware veya sadece bu SQL tek başına yeterli değildir.


## 16 Ekim — birleşik bariyer kabulü tamamlandı (yerel)

`BPS_RELEASE_BARRIER=1 python3 qa/release-chain-20261016/full-rehearse.py` güncel şema snapshot'ını temiz DB'ye kurdu; sentetik seed öncesi tabloların boşluğu doğrulandı. Bariyer kuruldu, 53 adayın her biri sırayla uygulandı; her migration sonrası extend + verify çalıştı. Birleşik takvim smoke, evrak RLS ve workspace hata kodları geçti. Bariyer remove başarıyla tamamlandı; geçici DB silindi. Kanıt full-barrier/result.json: applied=53, success=true, barrierRemoved=true, cleaned=true. İlk tam prova full/ altında korunur.

`BPS_RELEASE_BARRIER=1 node qa/contract-write-20261015/storage-http.mjs` gerçek yerel Storage/PostgREST servisleriyle **26/26** kontrolü geçti. Bu modda PostgREST doğrudan postgres yerine authenticator bağlantısı kullanır; böylece admin istisnası testi yanlışlıkla geçiremez. Önceki 25 HTTP kontrolü de aynı bağlantıyla geçti. Barrier kurulunca prepare RPC HTTP 503/PT503 verdi. Gerçek Storage upload ve delete HTTP 500 döndü (bu Storage sürümünün trigger hata eşlemesi; 503 değildir). Reddedilen upload için storage.objects kaydı oluşmadı; silinmesi istenen mevcut nesne indirildi ve byte içeriği korundu. Bariyer kaldırıldıktan sonra aynı rezervasyonla yükleme ve aynı dosyanın silinmesi başarılı. Kanıt barrier/http-result.json ve http-suite-result.json. Servisler/DB klonu temizlendi.

Bu, önceki 'bariyer altında tam zincir ve Storage HTTP kabulü bekliyor' maddelerini kapatır. Ürün TS/SQL migration kaynakları değişmedi; QA runner genişletildi, 53 aday değişmedi. Üretime uygulanmadı; tam uygulama/build testleri QA-only değişiklik için tekrarlanmadı. Node syntax ve diff kontrolü geçti.

Kalan sınırlar: Üretimde gerçek bağlantı session_user ve doğrudan admin kullanan dış yazıcılar ayrıca doğrulanmalı. Metadata'ya henüz ulaşmamış dosya byte aktarımı ve eski signed URL okumaları tamamen durdurulmuş sayılmaz. Her migration sonrası extend'den önce yeni tabloda kısa korumasız aralık vardır; uygulama kapalı tutulmalı, yeni tabloya yazan başka servis bulunmamalı. Gerçek trafik/veri hacminde kilit süreleri bu sentetik testte ölçülmez. Cron/e-posta gibi harici yan etkiler için uygulama kapısı da gereklidir. İki katman birlikte yayın planına göre işletilmelidir; bu testler kendi başına üretim yayın onayı değildir.


16 Ekim üretim yazıcı incelemesi: salt okunur metadata ölçümünde CLI session_user=cli_login_postgres/current_user=postgres, Storage TRIGGER=true fakat owner-role USAGE=false bulundu. Yerel supabase_admin prototipini bu bağlantıyla kurup kaldırabileceğimiz kanıtlanmadı; üretim bariyeri uygulanamaz kabul ediliyor. install/extend değişiklik öncesi owner-rol kontrolüyle eksik yetkide durur; yerel 10 kontrol geçti. Anlık idle oturumlar dış yazıcı yok kanıtı değildir. Platform cron/net worker mevcut, bu DB’de extension/job kaydı yok. WRITER_AUDIT.md ayrıntıyı ve repo servis yazıcılarını kaydeder. Üretime yazılmadı; roller değiştirilmedi, yayın yok.


## 16 Ekim düzeltmesi — Supabase özel DROP TRIGGER izni ölçüldü

Önceki owner-role USAGE=false ölçümü doğruydu; bundan üretimde trigger kaldırılamayacağı sonucu çıkarmak eksikti. Resmi supautils dokümanı, drop_trigger_grants ile tablo sahipliği olmadan belirli tablolarda kaldırmaya izin verildiğini açıklıyor: https://github.com/supabase/supautils . Üretimde salt okunur current_setting ölçümü postgres için storage.objects/buckets/prefixes/s3_multipart_uploads/s3_multipart_uploads_parts izinlerini doğruladı; production-supautils.json kanıttır. Standart PostgreSQL kuralı https://www.postgresql.org/docs/17/sql-droptrigger.html tek başına bu platform için yeterli değildir.

Bariyer şimdi sahiplik VEYA tam tablo adına yönelik mevcut supautils kaldırma iznini arar. İzin yok/NULL ise durur. Yetki genişletme veya sahiplik değişimi yoktur. CLI session_user=cli_login_postgres yalnız current_user=postgres ve postgres üyeliği birlikte varsa kabul edilir; API authenticator/service rolüne bypass verilmez. Üretimde CLI ile gerçek bariyer kurulmadı; bu dalın canlı uygulama kabulü yapılmış sayılmaz.

Kapsam: public tabloları ve yukarıdaki beş Storage dosya tablosu. Storage migration/istatistik/analytics gibi iç tablolarına bakım trigger'ı eklenmez. Supabase Storage şema sahipliğinin korunması ve kayıtların API üzerinden yönetilmesi tavsiyesi geçerlidir: https://supabase.com/docs/guides/storage/schema/design ve https://supabase.com/docs/guides/platform/permissions . Bu geçici trigger yönteminin Supabase tarafından özel bir bakım özelliği olarak onaylandığı iddia edilmiyor.

Yerelde postgres rolüyle kurma/extend/kaldırma testleri: 86 tabloda 10 kontrol geçti; yabancı sahibin özel izni bulunmayan public tablosunda kurulum önceden reddedildi. Güncel şema kopyasında bariyer kurma/extend/kaldırma artık postgres ile çalıştırılarak 53/53 migration ve temizleme geçti. Gerçek Storage/PostgREST 26/26 geçti. Restore için yerel supabase_admin kullanımı platform kurulumuyla sınırlı; bariyer süper kullanıcıyla sınanmıyor. Sonuçlar full-barrier/result.json ve barrier/http-suite-result.json.

Önceki 'sahiplik eksikliği nedeniyle uygulanamaz' sonucu bu ölçümle güncellenmiştir. Henüz üretim yayını yok; gerçek trafik altında eski deployment/cron geçişi, başlamış dış yan etkiler ve son canlı kabul açık. Üretime kalıcı yazma yapılmadı; 53 aday değişmedi. Node sözdizimi/diff temiz; ürün kodu değişmediği için uygulama build tekrar çalıştırılmadı.
