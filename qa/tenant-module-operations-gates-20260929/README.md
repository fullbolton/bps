# M2q — Operasyonun kimlik/şirket kapsamlı RPC girişleri

> Düzeltme: tarihsel workspace/shift SQL değişiklikleri önceki fixture temelinde eksikti. Yerel 000400 ve test kurulumu M2r ile düzeltildi. Güncel kanıt: `../tenant-module-legacy-operations-20260929/README.md`.

Yerel geliştirme; üretim SQL, push/deploy, tarayıcı ve PostgREST kabulü yapılmadı.

## Tamamlanan blok

40 açıkça listelenmiş actor/tenant parametreli RPC'nin girişinde staffing modülü doğrulanır. Günlük talep komutları, karşılık/sonuç uzlaştırma, katılım, işe başlama ve yedek görevlendirme, yazışmalar, çalışma onayı, İDP, sabit kadro ve tekrarlı planlar kapsanır. Tam signature/kaynak dosya listesi endpoints.json içindedir.

15 okuma snapshot doğrulaması; 25 işlem ortak config SHARE bariyeri kullanır. Plan liste/önizleme fonksiyonları eski ops_schedule_scope üzerinden profil/üyelik kilidi aldığı için salt okuma görünmesine rağmen config bariyeri ilk alınır. Yazma sınıflandırması bu yüzden yalnız DML sayısı değildir.

Her giriş auth.uid ile beklenen actor/tenant'ı doğrular; geçerli workspace/config kontrolünün ardından eski iş gövdesi çalışır. Eski rol/kayıt koşulları kaldırılmaz. Talent zorunlu yapılmaz; havuz kapalıyken operasyon devam edebilir. Staffing'in customers bağımlılığı mevcut config doğrulamasıyla korunur.

Beş ortak hata sunumu (günlük operasyon, kadro, tekrarlı plan, işe başlama, çalışma onayı) modül kapalı/ayar bozuk hatasını taşıma belirsizliğinden ayırır.

## Migration yöntemi

20260929000400, açık manifestten üretilen exact-source migration'dır. Önceki talent üreticisinin sınırlı source okuyucusu yeniden kullanılır; inline BEGIN bulunan tek schedule_preview için anchor desteği eklenmiştir. Eski talent migration üretimi değişmez ve testte birebir karşılaştırılır.

Function signature, dil, SECURITY DEFINER, yazma volatility ve prosrc SHA256 doğrulanır. Guard ilk dış BEGIN'e eklenir; eski gövde, parametre/default/return tipi/owner/ayarları korunur. Authenticated izni önceden var olmalıdır. Anon/service EXECUTE kaldırılır; inherited erişim kalırsa durur. Manifest dışında authenticated actor-scoped ops endpoint/overload bulunursa migration reddedilir. Bu kontrol actor parametresi olmayan legacy API'leri kapsamış sayılmaz.

Bir hedefte sapma varsa önceki patch'ler dahil tüm transaction geri alınır. Repo dışı service entegrasyonları uygulamadan önce incelenmelidir.

## Test sınırı

49 yeni PostgreSQL testi gerçek migration ve function kaynaklarını kullanır. 40 hedefin kapalı modülde reddi, her hedefte kimlik sahteciliğinin reddi, late-drift rollback, yeni endpoint reddi, ACL ve settings kilidinde gerçek bekleme sonrası yeni durumu görme kapsanır.

Enabled IDP okuması ve bildirim okundu yazması gerçek gövdelerle çalıştırılır. IDP için İK rolü reddi, talent kapalıyken operasyonun sürmesi, başka alıcının bildiriminin korunması ve tekrar işlemde timestamp'in değişmemesi doğrulanır.

Sentetik fixture tüm operasyon algoritmaları veya tam üretim şeması değildir: kalan hedeflerde disabled giriş kontrolü + orijinal kaynak korunması test edilir. Diğer katılım/onay/kadro algoritmalarının tüm kombinasyonları bu DB suite'inde yeniden çalıştırılmış sayılmaz. 7 yeni uygulama testi deterministik üretim, plan kilit sınıflandırması ve beş hata metni yolunu çalıştırır.

13 modül DB suite çalışır; beş eski bağımsız DB suite bu tur çalıştırılmadı. TypeScript ve statik kontroller yapıldı; üretim derlemesi/tarayıcı testi bu tur çalıştırılmadı.

## Açık kalanlar

- Actor/tenant parametresi olmayan eski girişler: ops_mutate, ops_import_locations, ops_board, ops_week, ops_attendance_week, ops_directory ve ops_idp_list gibi yollar ayrı blokta kapılanacak veya kontrollü contract ile kapatılacak. Mevcut frontend tüketicileri incelenmeden grant kesilmez.
- Doğrudan ops_* tablo okumaları, tüm service/trigger/FK yolları ve proje raporlama sınırları.
- Havuz kartlarında staffing kapalıyken operasyon bilgilerinin ayrıştırılması; worker→talent senkronizasyonu.
- Açık iş kontrollerini tamamlayıp kilitli ayar mutasyonu, ayar ekranı, canlı kabul.

Bu nedenle genel modül kapatma/kaydetme UI'si hâlâ açılmadı. Dosya yeni expand adımıdır; önceki cutover sıralarını değiştirmez. Ortak foundation/read/write helper'ları önkoşuldur.
