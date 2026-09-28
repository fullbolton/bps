# Operasyon metinlerinde sayı biçimi kontrolü

Kapsam: talep mesajı, personel görüşme notu, yedek personel görüşme notu, çalışma kaydı notu ve iade/yeniden açma gerekçesi. Genel notlar, görev açıklamaları, dosya içerikleri ve kişi kartının iletişim alanı bu pakete dahil değildir. Telefon alanının saklanması/dışa aktarılması hakkındaki ürün kararı ayrı kalır.

Yeni gönderimler istemcide ve sunucu doğrulayıcılarında kontrol edilir. Beş asıl kayıt tablosundaki INSERT/UPDATE trigger'ları doğrudan yazmayı da denetler. Çalışma geçmişinin snapshot.note kopyası dahildir. İşlem günlüğü tablolarının tüm JSON alanlarını veya bütün veritabanını tarayan bir çözüm değildir. Mevcut iş RPC'lerindeki asıl kayıt ve işlem kaydı aynı transaction içindedir; trigger hatası o transaction'ı geri alır.

NFKC normalizasyonundan sonra rakam, boşluk, nokta, parantez ve tire içeren azami sayı dizisinin rakamları sayılır. Tam 11 rakam, 5 ile başlayan 10 rakam ve 905 ile başlayan 12 rakam engellenir. Kontrol TC doğrulaması yapmaz; telefon sahibini araştırmaz. Satır sonu, slash, harfle yazılmış sayı, farklı ülkelerin biçimleri ve başka ayırıcılar kapsam dışıdır. Yan yana sayılar birleşebilir; 11 rakamlık meşru referanslar da uyarı alabilir. UUID ve tarih örneklerinin testten geçmesi bütün serbest metinlerde yanlış pozitif olmayacağı anlamına gelmez. Değerler otomatik silinmez veya dönüştürülmez; kullanıcı metni düzenler.

Eski görüşmeleri okuma ve bekleyen mesajın sonucunu sorgulama yalnız yapısal doğrulama kullanır. Yeni kural eski bir gönderimi kurtarma yolunu kilitlemez. Yeni mesaj/yedek görüşme/çalışma komutu tarayıcıdaki kurtarma kaydına yazılmadan önce kontrol edilir.

Migration beş tabloyu SHARE ROW EXCLUSIVE ile kilitler; normal SELECT devam eder, yazılar bekler. lock_timeout 5 saniye, statement_timeout 60 saniyedir. Ön kontrol yalnız eşleşen kayıt sayısını üretir. Tek eşleşme bile varsa transaction tamamen iptal edilir; eski satırlar değiştirilmez. Bu durumda sonuç ayrıca değerlendirilmeden veritabanı paketi uygulanmış sayılmaz.

Doğrulama: uygulama testleri sayı biçimlerini, normal operasyon metinlerini, dört yazma doğrulayıcısını, geçmiş okuma ve bekleyen komut çözümlemeyi kapsar. SQL testleri sentetik veritabanında kural eşitliğini, beş tablo sınırını, UPDATE ve snapshot kontrolünü, ön kontrolün geri almasını sınar. Eksik tablolar için minimal test tabloları kullanılır; bunlar tüm operasyon RPC işleyişinin uçtan uca testi değildir.
