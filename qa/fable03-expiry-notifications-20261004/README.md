# Fable 03 — B-1 yenileme bildirimleri

Durum: yerelde doğrulandı; üretime uygulanmadı. Canlı sorgu, gerçek e-posta gönderimi ve tarayıcı testi yapılmadı.

Sözleşme/evrak gönderim anahtarı `30d:YYYY-MM-DD` oldu. Aynı tarih tekrar gönderilmez; bitiş tarihi yenilendiğinde yeni gönderim yapılabilir. Görev ve randevu anahtarları değişmedi. Hatalı gönderimin geri alınması yalnız aynı tarihli damgayı siler.

Migration mevcut `30d` kayıtlarını aynı tenant ve varlığın mevcut bitiş tarihine kopyalar, özgün kayıtları ve gönderim zamanını korur. Mevcut tarihli kayıt varsa ezmez. Tarihsiz, silinmiş veya farklı tenant kaydına eşleşmez. Eski çalışanların yeni `30d` rezervasyonlarını NOT VALID CHECK engeller; eski satırlar tutulur.

## Yayın sırası

1. Üretimde aşağıdaki salt-okunur ön kontrolü çalıştır; beklenen kolon tiplerini ve mevcut constraint durumunu doğrula.
2. E-posta cron tetikleyicilerini durdur ve eski çalışan isteklerin bitmesini bekle. Veritabanı kilidi harici e-posta gönderimini atomik hale getirmez.
3. `20261004001200_expiry_notification_date_keys.sql` uygula. 15 saniye lock timeout; kilit/migration hatasında transaction geri alınır.
4. Tarihli anahtarı kullanan kodu yayınla; eski deployment'ın cron çalıştırmadığını doğrula.
5. Geçiş sorgularını tekrar kontrol et; cron'u aç, kontrollü gönderim sonucunu izle.

Kodun tek başına eski sürüme döndürülmesi güvenli geri dönüş değildir: constraint eski gönderim anahtarını reddeder. Acil geri dönüşte cron kapalı kalmalı; kod ve şema beraber ele alınmalıdır.

## Sınırlar

Geçmişte hangi bitiş tarihine e-posta gönderildiği saklanmamış. Bu yüzden eski damga mevcut tarihe ihtiyatlı biçimde bağlanır: toplu tekrar e-postayı önler, geçişten önce kaçırılmış bir yenileme bildirimini otomatik telafi etmez. Aynı bitiş tarihine geri dönülmesi yeni dönem sayılmaz. Gönderim öncesi damga ile harici e-posta arasındaki mevcut süreç çökmesi aralığı bu değişiklikte çözülmedi.

## Kanıt

- Uygulama paketi: 522/522; son eklenen kesin-tarih geri-alma testi ayrıca 4/4 bildirim testinin içinde geçti.
- Sentetik PostgreSQL 17: önceki güvenlik/yoklama testleriyle birlikte 16/16.
- TypeScript: hata yok. Statik tarama: 0 FAIL, mevcut 2 WARN.
- Test envanteri: 102 uygulama dosyası, 8 DB dosyası, 7 bekleyen dosya. Bu tur tüm DB envanteri değil, ilgili 3 DB dosyası çalıştırıldı.
- Veritabanı testi: legacy koruma, tenant eşleşmesi, NULL/orphan atlama, DateStyle bağımsızlığı, mevcut tarihli damgayı ezmeme, yenileme/dedup, eski çalışan reddi.
