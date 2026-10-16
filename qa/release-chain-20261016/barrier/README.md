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
