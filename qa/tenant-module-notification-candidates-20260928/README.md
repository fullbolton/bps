# M2l — Bildirim aday projeksiyonları ve evrak modül sınırı

**Yerel; üretim SQL, push/deploy veya gerçek e-posta gönderimi yok.** Temel commit: `f7bce27d397d90cca644649a6833f73e80ecb5a6`.

## Tamamlanan işler

- Randevu, sözleşme ve evrak adayları artık ham tablo SELECT'i yerine service-only RPC'lerden okunur. SQL, tenant başına tam konfigürasyonu doğrulayıp ilgili modülü kapalı tenantları döndürmez. Bozuk/eksik konfigürasyon hata verir; kapalı varsayımı veya tümü açık fallback yoktur. Görev adaylarının mevcut RPC'si korunur.
- Randevularda planlandı + hedef tarih; sözleşmelerde aktif + bitiş tarihi var; evraklarda geçerlilik tarihi üst sınıra kadar koşulları korunur. Sözleşmenin 30 günlük İstanbul tarih penceresi mevcut uygulama hesaplamasında kalır. Projeksiyonlar yalnız bildirimde kullanılan kolonları döndürür; storage yolu, mali alan veya diğer evrak içeriği dönmez.
- Evraklar modülü açık, sözleşmeler kapalı olduğunda firma evrakı bildirimi çalışır; sözleşmeye bağlı evrak adaylardan çıkarılır. Bağlı sözleşmenin tenant ve firma kimliği de eşleşmelidir. Geçersiz bağlantıdan isim/veri taşınmaz.
- `document_notification_state_v1` en fazla 500 id/tenant çiftini güncel kayıttan denetler. Silinen veya o tenantta bulunmayan kayıt `enabled=false` ile gönderimden çıkar. Eksik/bozuk ayar ise hata olur. Sonradan sözleşmeye bağlanan evrakın güncel ilişkisi kullanılır; eski istemci `contract_id` bilgisine güvenilmez.
- Gruplanmış bildirimlerin gönderim kaydı öncesi/sonrası denetimi ortaklaştırıldı. Evraklar kayıt bazında, görev/randevular tenant modülü bazında süzülür. Reddedilen kalemlerin gönderim kaydı geri alınır; geri alma hatası raporlanır. Tenant üyeliği ve alıcı rol kuralları değiştirilmedi.
- Ayrı 002600 contract migration'ı service_role için companies, contacts, notes, contracts, appointments, documents tablolarında SELECT'i kaldırır. Etkin tablo/kolon izinleri kontrol edilir; PUBLIC veya başka rolden kalan izin varsa işlem geri alınır. Kullanıcı rollerinin SELECT izinleri değiştirilmez. Yeni RPC'lerin varlığı, definer durumu ve service execute yetkisi ön koşuldur.

## Repo içi servis taraması

`src` içinde service key kullanan noktalar cron notifications, healthz, demo-request ve access-request rotalarıdır. healthz profiles başlık sayımı yapar; diğer iki rota kendi talep tablolarına yazar. `src/lib/email` içinde companies/documents/appointments/contracts ham okuması kalmadı. Bu statik kaynak incelemesi repo dışı script, MCP, webhook veya ayrı servislerin envanteri değildir; üretim contract uygulamasından önce bu entegrasyonlar da doğrulanmalıdır.

## Kanıt

**604/604 uygulama ve 123/123 PostgreSQL testi geçti. TypeScript ve üretim derlemesi başarılı.** Statik denetim 0 FAIL / 2 WARN: commit öncesi yeni migration dosyaları ve mevcut kullanılmayan CapacityRiskCard/TimelineList.

Nihai ölçümler `manifest.json`, çıktılar `release.log` ve `database.log` içindedir. Mevcut müşteri bildirim DB suite'ine 10 test eklendi: dört RPC'nin service-only erişimi, tarih/durum/kolon kapsamı, sözleşmeye bağlı/bağımsız evrak, tenant izolasyonu, hatalı ilişki, güncel ilişki/silinme, eksik katalog, dizi doğrulaması, servis SELECT reddiyle RPC uyumluluğu ve inherited kolon izni reddi.

Altı yeni uygulama testi: kayıt bazlı id/tenant/boolean kontrolü, 501 kayıtta sayfalama/tekilleştirme, ağ/DB hatası, sözleşmeye bağlı evrakın ayıklanması, kayıt sonrası modül kapanmasında rezervasyonların geri alınması, doğrulanamayan evrak ayarları. Önceki sayfalama ve gerçek gönderici entegrasyon testleri yeni RPC yollarıyla yeniden çalışır. Ağ taşıyıcısı sentetiktir; gerçek alıcıya mail gitmez.

PostgreSQL tabloları sentetik ve sadeleştirilmiştir; gerçek repo module/snapshot/projection/cutover SQL'i çalıştırılır. Canlı şema/index/owner/grant/trigger/PostgREST ölçümü veya kimlikli tarayıcı testi yapılmadı. Beş eski DB suite'i ve yedi pending dosya çalıştırılmadı; lint yapılandırılmamış.

## Sınırlar ve yayın sırası

002500 expand: foundation + 001300 snapshot ve 002400 sonrasında, yeni uygulama/cron öncesinde. Yeni okuyucularla kontrollü bildirim kabulünden sonra 002600 contract uygulanır; eski worker ham sorguları bundan sonra çalışmaz. 002600 altı tabloyu ACCESS EXCLUSIVE kilitler; 15 saniye lock_timeout vardır. Düşük trafikte kontrollü uygulanmalıdır. Önceki görev/şirket/not/kişi cutover sıraları bağımsız korunur; bekleyen SQL'ler tek kör db push işlemine toplanmaz.

SQL ayar snapshot'ı ile HTTP gönderimi tek transaction değildir; son kontrolden sonra yola çıkmış mail geri çağrılamaz. Çok sayfalı HTTP okuması tek snapshot değildir; mevcut sayı ve kimlik tamlık kontrolleri aynı sayıda eşzamanlı bütün değişiklikleri yakalamaz. Evrakın gönderim öncesi denetimi modül/tenant/güncel sözleşme ilişkisine yöneliktir; bütün tarih/içerik değişiklikleri için revision protokolü değildir. Üretim performans/egress ölçümü yapılmadı; tenant ayarları SQL aday sorgusunda tenant başına, gönderim kontrolünde en fazla 500 kayıt gruplarıyla okunur.

**Genel modül kapatma UI'si açılmadı.** Parent-FK etkileri, kalan definer projeksiyonları ve diğer modüllerin RLS/RPC/storage/export erişimleri, açık iş/bağımlılık engelleri, ayar mutasyonu ve gezinme/cache yenileme hâlâ açık.
