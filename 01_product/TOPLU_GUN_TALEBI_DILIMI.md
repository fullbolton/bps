# Birden fazla gün için talep açma

2026-09-09 — aynı firma/şubede aynı hizmet ve pozisyon için en fazla 31 takvim
günlük aralık seçilir. Haftanın çalışma günleri seçilerek tarihler önizlenir.
Önizlemeden tek tek gün çıkarılabilir. Resmî tatiller otomatik çıkarılmaz.
Her gün için kişi sayısı 1–100; önizleme toplam kişi-günü gösterir.

Onay tek komutla bütün günleri bir transaction'da oluşturur; kısmi kayıt yoktur.
Hesap/tenant ve rol kilit altında doğrulanır. Pasif firma/şube reddedilir. Kayıt
anında aynı şube/gün/hizmet/pozisyonda aktif talep varsa tüm parti reddedilir.
İptal talep yeni partiyi engellemez. Mevcut günlük tekil talep formunun ek talep
açabilme davranışı değişmez; bu kontrol evrensel iş anahtarı benzersizliği değildir.
Firma kilidi partileri ve o anda süren tekil yazıları sıraya koyar.

Tek komut kimliği sayfa yenilemesinde korunur; aynı payload aynı sonucu döndürür.
Yanıt kaybı bekleyen sonuç panelinden sorgulanabilir. Kapatılmış komut geç yazıyı
reddeder. Başarı sonrası günlük/haftalık listelerde normal talepler olarak görünür.
Personel otomatik atanmaz; şimdilik kapasite ihtiyacı oluşturulur.

Kabul: ters/aralık dışı tarihler, artık yıl, seçilmemiş gün, 31 sınırı; scope/rol;
partinin atomikliği; iki eşzamanlı parti; önizleme sonrasında oluşan aktif çakışma;
tekrar/kayıp yanıt/kapatma; haftalık toplam ve kimlikli tarayıcı. Yalnız sentetik
yerel DB uygulanır; üretim/veri temizliği/push/deploy bu işin parçası değildir.
