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
