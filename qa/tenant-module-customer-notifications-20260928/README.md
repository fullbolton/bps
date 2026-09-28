# M2k — Randevu/sözleşme bildirimlerinin modül sınırı

**Yerel; üretim SQL, push/deploy veya gerçek e-posta gönderimi yapılmadı.** Temel commit: `47dc8fea144779f57a2d8f78a212c7c9877dfd60`.

## Tamamlanan yollar

- Randevu ve sözleşme bildirimleri, aday listesini aldıktan sonra ilgili tenantın `calendar` / `contracts` modülünü doğrular. Kapalı tenantlar firma adı, alıcı ve gönderim hazırlığından çıkarılır. Hatalı/eksik ayarlar kapalı gibi yutulmaz; koşu hata verir ve göndermez.
- `customer_notification_modules_v1(uuid[],text)` yalnız service_role için, en fazla 500 tenantlık dar durum projeksiyonudur. Mevcut bütün katalog ve bağımlılık doğrulamasını kullanır; bilinmeyen modül kabul etmez. Görevlerin mevcut RPC yolu korunur; istemci tarafındaki tamlık/doğruluk kontrolü ortaklaştırıldı.
- Firma adları doğrudan `companies` sorgusundan alınmaz. `notification_company_names_v1(uuid[],uuid[],text)` en fazla 100 firma/tenant çiftinde yalnız id, tenant_id, name döndürür. Yanlış firma/tenant eşleşmesi, eksik firma, kapalı ilgili modül ve bozuk katalog sorguyu durdurur. Fonksiyonlar authenticated/anon kullanıcılarına açık değildir; inherited execute sapması migration'ı durdurur.
- Firma adını kullanan gerçek randevu ve sözleşme göndericileri beklenen tenantı taşır. Eksik/yanlış/tekrarlı yanıtta isim uydurulmaz ve bildirim hazırlanmaz. Müşteri modülü bağımlılık doğrulaması üzerinden korunur; müşteri kapalı ama bağlı modül açık bozuk durum olarak reddedilir.
- Gönderim kaydı ayırmadan önce ve kayıttan sonra e-posta hazırlanmadan hemen önce tekrar kontrol edilir. Arada modül kapanırsa ayrılan kayıt geri alınır; geri alma hatası ayrıca raporlanır. Böylece gönderilmemiş bildirim başarılı gönderilmiş sayılarak sessizce kalmaz.
- Mevcut alıcı rolleri, şirket ataması, tenant üyeliği, İstanbul tarih sınırları ve bildirim idempotency anahtarları değiştirilmedi. Testlerde gerçek göndericiler sentetik veritabanı/e-posta taşıyıcısıyla çalıştırılır; dış servise mail gitmez.

## Sınırlar

HTTP e-posta gönderimi SQL transaction'ıyla atomik değildir. Son kontrolden sonra başlayan modül değişikliğiyle hâlihazırda yoldaki e-posta geri çağrılamaz. Gönderim öncesi kontroller bu aralığı küçültür; tam iptal garantisi değildir. Mevcut stamp-first çökme aralığı ve gönderim belirsizliği protokolü değişmedi.

Randevu/sözleşme **aday kayıtları hâlâ servis hesabıyla ham tablolardan okunur**, sonra filtrelenir. Servis rolünün companies SELECT yetkisi bu pakette kaldırılmadı; bu iki göndericinin firma adı yolu artık dar RPC kullanır. Tüm arka plan okuma sınırı tamamlandı diye değerlendirilmemelidir. Bir tenantın eksik konfigürasyonu ilk toplu kontrolde koşuyu durdurabilir; bu hata durumunda diğer tenantlara devam edildiği iddia edilmez.

Durum sorguları 500 tenant, firma adları 100 çift olarak tekilleştirilir. Gönderim öncesi taze doğrulama için ek RPC maliyeti vardır: randevuda alıcı grubu başına, sözleşmede sözleşme/alıcı başına iki kontrol; eski konfigürasyon önbelleği kullanılmaz. Üretim gecikme/egress ölçümü yapılmadı.

## Kanıt

**598/598 uygulama ve 113/113 PostgreSQL testi geçti. TypeScript ve üretim derlemesi başarılı.** Statik 0 FAIL / 2 WARN: commit öncesi yeni migration ve mevcut kullanılmayan CapacityRiskCard/TimelineList.

Nihai sayılar `manifest.json`; çıktılar `release.log` ve `database.log`. Sekiz yeni PostgreSQL senaryosu gerçek foundation/snapshot/yeni migration'ı sentetik şemada çalıştırır: service-only ACL, tenant eşlemesi, bağımsız modül durumları, müşteri bağımlılığı, eksik katalog, bilinmeyen modül, sınırlı/tekil diziler ve kayıp kayıtlar.

Yedi yeni uygulama senaryosu: çapraz tenant firma cevabı, randevu kapanması (başlangıçta/kayıt sonrası), sözleşme kapalı/okunamaz durumları, kayıt sonrası kapanma ve geri alma hatası. Mevcut bildirim entegrasyon testleri büyük listeler, alıcı izolasyonu ve tarih sınırlarıyla yeniden çalışır. Tarayıcı/PostgREST, canlı katalog ve gerçek e-posta kabulü yapılmadı. Beş eski DB suite'i ve yedi pending dosya çalıştırılmadı; lint yapılandırılmamış.

## Yayın ve sıradaki blok

002400 expand, 000900 foundation ve 001300 snapshot'tan sonra; bu frontend/cron kodundan önce uygulanır. Canlı owner/etkin grant ve katalog kontrolü gerekir. Ardından sentetik alıcılı kontrollü bildirim kabulü gerekir; mevcut alıcılara test maili gönderilmez. Önceki 001100/002100/002300 direct-write cutover sıraları korunur.

**Genel modül kapatma UI'si açılmadı.** Evrak bildirimlerinin documents/contracts ilişki filtresi, ham aday okumalarının SQL projeksiyonuna taşınması ve servis ham SELECT kesimi sıradaki somut bildirim işleri. Parent-FK etkileri, diğer modül erişimleri, açık iş/bağımlılık engelleri, ayar mutasyonu ve gezinme/cache yenileme hâlâ açık.
