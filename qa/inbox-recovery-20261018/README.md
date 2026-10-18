# Bildirim kutusu bağlantı ve hata kurtarma paketi

18 Ekim 2026 — yerel ürün düzeltmesi; üretime yayımlanmadı.

## Bulgu ve değişiklik

1. Okundu çağrısı reddedildiğinde eski bildirimler/sayaç ekranda kalıyordu. Artık doğrulanamayan sonuçta liste, sayaç, cursor, son kontrol ve başarı mesajı birlikte temizlenir; kullanıcı yenileyebilir.
2. Eski sayfayı incelerken offline → online geçişi otomatik yenilemeyi atlıyordu. Offline listeyi temizler ve eski sayfa modunu sıfırlar; online güncel sayfayı ister.
3. Bağlantı kaybından önce başlayan çağrılar geç yanıt verirse yeniden bağlanmış kutuyu dolduramaz. Bağlantı sürümü okuma/okundu/ses devamında kontrol edilir. Devam eden istek varken reconnect en fazla bir yenilemeyi sıraya alır.
4. Offline tıklamalar yeni okuma/okundu isteği göndermez. Çift okundu tıklaması tek çağrıdır. Şirket uyumsuzluğu eski listeyi siler; unmount sonrası cevap yok sayılır.

## Kanıt

- 787/787 uygulama testi, 0 atlanan (application.log).
- 13/13 hedefli test (targeted.tap): gerçek bileşenin callback/effect akışları enjekte edilmiş ağ ve tarayıcı olaylarıyla çalıştırılır. DOM veya gerçek tarayıcı testi değildir.
- TypeScript --noEmit --incremental false geçti.
- Next üretim derlemesi localhost/sentetik build değerleri ve unified flag açıkken başarılı (build.log). Üretime bağlantı kurulmadı.
- Statik 16 kontrol, 0 FAIL / 0 WARN; diff boşluk kontrolü geçti.
- Yeni SQL/migration yok; üretim verisi veya tercih değiştirilmedi.

## Sınır

Bu paketin gerçek tarayıcıda offline/online kabulü ve yayını henüz yapılmadı. Önceki üç kaynak, mobil, iki sekme ve şirket ayrımı tarayıcı kanıtı bu yeni hata enjeksiyonu yerine sayılmaz. Son yayın a0230dd / 190 migration olarak kayıtlıdır; bu tur canlı yeniden ölçülmedi.
