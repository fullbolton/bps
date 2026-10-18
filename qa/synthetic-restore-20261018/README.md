# Sentetik veritabanı geri yükleme tatbikatı

18 Ekim 2026. Ürün kaynağı: f58db6c (başlangıç HEAD: 13a6737). Üretime bağlanılmadı; gerçek veri yedeği alınmadı.

## Ölçüm

`node qa/synthetic-restore-20261018/rehearse.mjs` geçti. Sabit yerel Supabase konteynerindeki bilinen sentetik başlangıç kopyasına manifestteki 30 sonraki migration uygulandı. Bellekte pg_dump üretildi ve template0 ile oluşturulan boş, ayrı veritabanına geri yüklendi.

- 120 public/auth/storage tablosunun satır sayıları ve sıralanmış satır içeriklerinin hash'leri birebir eşleşti.
- pg_dump şema çıktısı; sahiplik, fonksiyonlar, politikalar ve ACL tanımları dahil birebir eşleşti. Yalnız pg_dump'ın rastgele restrict/unrestrict işaretleri karşılaştırma dışında.
- Ortak bildirim listeleme RPC'sinde anon EXECUTE kapalı, authenticated EXECUTE açık kaldı.
- Kaynak ve hedef geçici veritabanları finally ile kaldırıldı. Dump diske yazılmadı. result.json yalnız tablo sayıları, hash'ler ve ölçüm içerir.

İlk deneme normal postgres rolünün supabase_admin sahipliğini geri kuramaması nedeniyle durdu. İkinci denemede yerel yönetici bağlantısının parola gereksinimi görüldü. Son koşu yerel konteyner ortamındaki parolayı dışarı yazmadan supabase_admin ile restore yaptı. Rol yetkileri değiştirilmedi, --no-owner/--no-acl kullanılmadı.

## Sınır

Bu, tamamen yeni sunucuya üretim kurtarma veya repo migration'larından sıfırdan kurulum kanıtı değildir. Aynı yerel PostgreSQL sunucusunun mevcut rollerine ve kurulu eklentilerine dayanır; başlangıç şeması önceden hazırlanmış fixture'dır. Tarihsel eksik temel migration sorunu kapanmış sayılmaz. Harici Storage dosya byte'ları, Auth HTTP, uygulama tarayıcı akışları ve fiziksel cihaz bu tatbikatta yoktur. Gerçek operasyon Excel/Luca mutabakatının yerine geçmez.

## Tekrar çalıştırma

Yerel Docker açıkken aktif repo kökünden `node qa/synthetic-restore-20261018/rehearse.mjs`. Script yalnız sabit kabul konteyneri ve bps_module_chain_20261005 sentetik template kullanır; mevcut veritabanının üzerine yazmaz. Migration manifesti repodan saparsa durur. Parola/log/dump repoya alınmaz. Test üretim yayınını değiştirmez.

## Sayaç kabulü — 18 Ekim devamı

Tatbikat genişletilerek tekrar geçti: 120 tablo ve 3 sequence. auth.refresh_tokens_id_seq, public.ops_events_id_seq ve public.talent_person_events_id_seq için last_value/is_called eşleşti; ardından iki geçici veritabanında nextval çağrısı aynı sonraki değeri üretti. Bu, geri yüklemenin sayaç durumunu koruduğunu kanıtlar; kaynakta önceden var olabilecek sayaç/veri tutarsızlıklarını tarayan bir denetim değildir. Sonuçlar result.json içindedir. Geçici veritabanları kaldırıldı.

Başlangıç değerlerinde kalan sayaçların yetersiz kanıt üretmemesi için dump öncesi yalnız geçici kaynakta ops_events=101/true ve talent_person_events=202/false ayarlandı. Restore sonrası nextval sırasıyla 102 ve 202 verdi; refresh_tokens 1/false → 1 olarak ayrıca korundu. Böylece sequence DATA atlanırsa bu test başarısız olur.

## DB + dosyalar + bekleyen işlemler kurtarma paketi

Güncel kabul: `BPS_RESTORE_REHEARSAL=1 node qa/contract-write-20261015/storage-http.mjs` — 35/35 HTTP kontrolü geçti. `storage-result.json` geri yükleme safhasını, `storage-http-result.json` bütün koşuyu belgeler. İlk bölümdeki yalnız-DB sınırı bu ek kabul ile genişlemiştir; cloud S3/boş sunucu sınırı devam eder.

1. Sentetik kullanıcı HTTP RPC ile rezervasyon açtı, PDF'yi Storage'a yükledi ve yayınladı.
2. Ayrıca dosyası gönderilmiş bekleyen yükleme, iptal edilmiş/temizlik bekleyen dosya ve dosyasız rezervasyon oluşturuldu.
3. İstekler tamamlandıktan sonra PostgREST durduruldu, dosyaların ek öznitelikleri okundu, Storage durduruldu. DB dump ve dosya arşivi bellekte tutuldu.
4. Yalnız bu koşunun geçici veritabanı template0'dan yeniden oluşturuldu; sahiplik ve ACL ile restore edildi. Eski geçici Storage konteyneri kaldırıldı ve aynı resmi imajdan boş yenisi başlatıldı.
5. Yalnız DB geri gelince dosya indirmesi başarısızdı (bu file backend eksik byte için 500 verdi). Dosya ve ek öznitelikler yüklendikten sonra HTTP 200 ve SHA-256 eşitliği doğrulandı.
6. Bekleyen dosya kurtarma listesinden bulundu, byte'ları okundu ve iki finalize çağrısı aynı evrakı döndürdü. İptal edilmiş kayıt yayımlanamadı; dosya temizliği ve acknowledgement tamamlandı, aynı yola tekrar upload reddedildi. Dosyasız rezervasyon güvenle iptal edildi.
7. Geri yükleme sonrasında mevcut metadata/revision çakışması, silme/temizlik, iptal, eşzamanlı finalize, sözleşme dosyası, modül ön kontrolü, rol ve şirket geçişi HTTP kontrolleri de geçti.
8. Koşu sonunda geçici DB ve konteynerler kaldırıldı; Docker/pg_database ile kalmadıkları ayrıca doğrulandı.

### Tatbikatta bulunan önkoşullar

- `docker cp`/BusyBox tar tek başına file backend'in `user.supabase.*` extended attribute bilgilerini korumuyor. İlk byte kopyasında indirme ENODATA/500 verdi. Resmi Storage imajının kendi fs-xattr modülüyle değerler base64 olarak bellekte korunup geri yazıldı; hayali content-type üretilmedi.
- Dinamik Docker portları restart sonrasında değişebiliyor. RPC/Storage adresleri tekrar ölçülüyor ve schema cache hazır olmadan yazma başlatılmıyor. Başarısız yazma otomatik tekrar edilmiyor.
- Veritabanı seviyesindeki Storage CONNECT/CREATE önkoşulu ayrıca kuruldu. Bu tek veritabanı dump'ının sunucu rollerini/kurulum ayarlarını kapsamadığını gösterir.

Bu kod yalnız test altyapısıdır; uygulama kodu/production migration değiştirilmedi. Gerçek şirket verisi veya dosyası okunmadı/yedeklenmedi. JWT'ler sentetik imzalıdır: gerçek Auth login, Next server action ve tarayıcı kabulü bu koşuda yapılmadı. Yerel file backend kabulü Supabase yönetilen S3 felaket kurtarma kanıtı değildir. Fiziksel telefon, gerçek Excel/Luca mutabakatı ve yeni sunucuda temel kurulum açık kalır.

## Auth parola ve oturum geri yükleme kabulü

`BPS_RESTORE_REHEARSAL=1 BPS_LOCAL_BROWSER=1 BPS_AUTH_RESTORE_REHEARSAL=1 BPS_AUTH_RESTORE_HTTP_ONLY=1 node qa/contract-write-20261015/storage-http.mjs` geçti. Önce 35 iş/Storage HTTP kontrolü, ardından 7 Auth kontrolü çalıştı; bunlar uygulama birim-test sayısına eklenmez.

Resmi yerel GoTrue ile sentetik kullanıcı giriş yaptı. Auth durduruldu, Auth DB belleğe dump edildi, template0 hedefe aynı isimle yeniden kuruldu ve sahiplik/ACL korunarak restore edildi. Sonra eski access token /user'dan aynı kullanıcıyı döndürdü; eski refresh token yeni geçerli oturum üretti ve tenant hook claim'i korundu; aynı parola tekrar giriş yaptı; yanlış parola HTTP 400 ile reddedildi. Kanıt auth-result.json. Token, parola veya dump kanıt dosyasına yazılmadı. HTTP_ONLY modu Next/tarayıcı açmadan sonunda bütün geçici kaynakları kapatır.

Önceki tarayıcı kabulünün Auth restore yapılmadı sınırı bu ayrı HTTP testiyle kısmen kapanır; birleşik restore-sonrası tarayıcı koşusu yapılmış sayılmaz. Aynı yerel sunucu rolleri ve aynı JWT imzalama anahtarı kullanıldı. Anahtar rotasyonu, MFA/e-posta, cloud servis kurtarma ve başka sunucu kurulumu kapsam dışıdır. Gerçek hesaplara veya üretime erişilmedi.

## Oturum iptali korunumu

Auth kabulü 10 kontrole genişletildi. Aynı sentetik kullanıcı iki bağımsız oturum açtı; ikinci oturum resmi `/logout?scope=local` ile yedek öncesinde kapatıldı. Bu oturumun refresh token'ı hem yedek öncesinde hem restore sonrasında HTTP 400 ile reddedildi. İlk aktif oturum restore sonrasında yenilenebildi. 35 Storage/iş HTTP kontrolüyle birlikte tüm koşu exit 0 verdi. Son kanıt auth-result.json'dır; önceki 7 sayısı tarihsel kapsamdır.

Sınır: bu kontrol yalnız yedek anındaki iptali korur. Snapshot SONRASI yapılan oturum iptalleri, parola/rol değişiklikleri veya hesap kapatma eski snapshot'ta yoktur. Bu nedenle eski yedeğe dönülünce güncel erişim kararlarının ayrıca uzlaştırılması gerekir. Salt JWT'nin logout sonrası süre dolmadan davranışı bu testte ölçülmedi; ölçülen, refresh token ile yeni oturum alınamamasıdır.

## Ayrı boş PostgreSQL sunucusu — 18 Ekim

`BPS_ISOLATED_RESTORE=1 node qa/synthetic-restore-20261018/rehearse.mjs`

Ağ erişimi ve host portu olmayan, aynı `17.6.1.075` imajından yeni initdb: 120 tablo, 3 sayaç, 30 migration geçti (`isolated-result.json`). Rol tanımları parola içermeden bellekte taşındı; kaynak bootstrap grantor `supabase_admin` korundu. Şema sahipliği ve ACL karşılaştırılır; ardışık DEFAULT PRIVILEGES GRANT satırlarının yalnız sırası normalize edilir. Gerçek veri okunmaz; geçici sunucu ve kaynak DB sonunda kaldırılır.

Bu, platformdan bağımsız sıfırdan Supabase kurulumu değildir: aynı imajın eklenti dosyaları ve sentetik tarihsel temel şema kullanılır. Ayrı sunucuda Auth/Storage/tarayıcı birleşik kabulü henüz yok.

### 18 Ekim — ayrı sunucuda rol ve eklenti eşitliği

Ayrı sunucu kabulüne katalog kontrolleri eklendi: rol özellikleri/ayarları, rol üyelikleri (grantor, admin/inherit/set), eklenti sürümleri/sahipleri kaynakla aynı. OID yerine isimlerle karşılaştırıldı. Hedefte parola hash’i olan rol sayısı sıfır; parola aktarılmadığı ayrıca ölçüldü. 120 tablo/3 sayaç/30 migration kabulü tekrar geçti. Birleşik yeni sunucu Auth/Storage/tarayıcı testi hâlâ açık; üretim değişmedi.

### 18 Ekim — yeni sunucuda birleşik HTTP kabulü

`node qa/synthetic-restore-20261018/combined-server.mjs` temiz koşusu geçti: 35 Storage/işlem kontrolü ve 10 Auth kontrolü, yeni initdb PostgreSQL sunucusunda birlikte çalıştı. Rol parolaları kopyalanmadı; rastgele yerel parola üretildi. Host DB portu açılmadı; Docker servis ağına SCRAM bağlantısı tanımlandı. Test şeması yönetici rolüyle kuruluyor, HTTP kullanıcı istekleri JWT/tenant kontrollerinden geçiyor. Geri yükleme sonrasında ANALYZE eklendi; PostgREST OpenAPI hazır olma okumasına 10 saniye sınır verildi. Bu işlem gerçek veriye veya üretime dokunmadı.

Kanıtlar: `combined-result.json`, `combined-http-result.json`, `auth-result.json`, `storage-result.json`. Geçici konteynerler temizlendi. Auth ve iş şeması ayrı yerel DB'lerde; gerçek hook sentetik üyelik eşitlemesiyle çalışır. Yönetilen Supabase/S3, MFA ve birleşik tarayıcı kabulü değildir. Sonraki adım `BPS_COMBINED_BROWSER=1` ile aynı düzenin tarayıcı kabulü.

## 18 Ekim — birleşik yeni sunucu tarayıcı kabulü

Kaynak bcca042; komut `BPS_COMBINED_BROWSER=1 node qa/synthetic-restore-20261018/combined-server.mjs`. Önce aynı yeni PostgreSQL sunucusunda 35 Storage/iş ve 10 Auth restore kontrolü; ardından gerçek Next.js giriş ve server action UI kabulü geçti. Synthetic A açıldı; Tarayıcı kurtarma tamamlandı (3→4 belge); dosyalı 9103 ve dosyasız 9102 iptal edildi, temizlikleri tamamlandı. Salt okunur SQL: 9101 documents=1, 9103 storage.objects=0, 9102/9103 completed cleanup=2.

Kanıt `combined-browser-result.json`, `combined-browser.png`. Test sekmesi kapatıldı; SIGTERM sonrası harness exit 0; yeni DB, Auth, Storage ve PostgREST konteynerleri kaldırıldı. Üretim ve gerçek veri değişmedi. Tarayıcı fixture kayıtları restore sonrasında eklenmiştir; restore öncesi pending devamlılığı HTTP aşamasındadır. Ayrı Auth DB/hook fixture eşitlemesi, yerel file-backend ve aynı platform imajı sınırları sürer. Bulut/S3, fiziksel mobil, MFA ve snapshot sonrası erişim değişiklikleri bu kabulün kapsamı değildir.
