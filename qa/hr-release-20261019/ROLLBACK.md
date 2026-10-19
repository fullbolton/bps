# Yayın ve geri dönüş sınırı — 19 Ekim

## Kabul edilen sonuç

Güncel public katalog kapsamı: {'tables': 85, 'columns': 790, 'indexes': 228, 'policies': 99, 'triggers': 72, 'functions': 298, 'constraints': 489}. İndeksler (valid/ready dahil), tetikleyiciler (enabled dahil) ve kısıtlar karşılaştırıldı. Sekiz CHECK ifadesinde yalnız birleşik AND parantezleri farklıdır. reviewed-constraint-shapes.json tam yerel/canlı çiftleri sabitler; herhangi bir başka değişim provayı durdurur. Canlı ifadeler disposable DB'ye tekrar kurulunca yerel PostgreSQL aynı düz AND gösterimini üretir. Tam metinsel eşitlik iddiası yoktur.

Geçici bps_release_guard şeması yok, bps_release_write_guard sayısı 0. Bu ölçüm normal modül erişim kapılarının kaldırılması anlamına gelmez.

## Yayın sınırları

1. 20261019000100 geçmiş sürümü kolonları ve v2 okuyucusunu ekler. Eski katalog değişmeden uyumlu uygulama köprüsü hazırlanabilecek ayrım noktası budur.
2. 20261019000200 mevcut şirketleri katalog 2'ye geçirir, revizyon artırır ve catalog_upgrade audit kaydı oluşturur. HR kapalı eklenir; ancak bu migration sadece boş tablo kurulumu değildir.
3. Eski geçmiş parser'ı yeni olay/katalog biçimini kabul etmez. legacy-history.mjs üç karakterizasyonu geçti. Bu nedenle 002 sonrası eski canlı uygulamaya körlemesine alias dönüşü güvenli geri dönüş değildir.
4. Önerilen sıra: önce 001 + hem eski hem yeni geçmişi okuyabilen, HR preview kapalı uyumluluk uygulaması ayrı aday olarak doğrulanır. Bu uyumlu dağıtım geri dönüş hedefi olarak saklanır. Sonra kalan SQL ve yeni uygulama kontrollü uygulanır. Uyumluluk kaynak adayı bridge/ altında hazırlandı ve iki SQL aşamasında test edildi; tarayıcı kabulü ve yayın henüz yapılmadı.
5. Sonraki uygulama sorunu durumunda SQL tablolarını/audit kayıtlarını silerek geri dönülmez. Uyumlu uygulama hedefi kullanılır; DB ileri düzeltme ile onarılır. Şirket scoped aktivasyonu ayrı kabul ve karardır; gerçekleştiyse legacy'ye otomatik dönüş yapılmaz.

## Kilit ve başarısızlık yönetimi

001 mevcut geçmiş tablosunu değiştirir; 002 şirket yapılandırması ve audit geçmişine yazar. Yerel sentetik süre üretim kilit süresi değildir. Yayın öncesi güncel işlemler ve tablo boyutları yalnız aggregate olarak ölçülmeli; sınırlı lock_timeout/statement_timeout ile kontrollü bağlantı kullanılmalı. Her dosyanın transaction ve ledger işlemi birlikte ele alınmalı; yarım paket halinde hangi sürümde kalındığı ölçülmeden yeniden başlatılmamalı. Uygulanmış SQL dosyası değiştirilmez.

## Bu tur testler

- Genişletilmiş katalog karşılaştırması ve 17 sıralı migration geçti.
- Gerçek yerel katalog migration senaryoları: 6 grup geçti; eski komut makbuzu ve v1 yazma uyumluluğu dahil.
- Eski geçmiş okuyucusunun uyumsuzluk karakterizasyonu: 3 test geçti.
- Üretim yazımı/deploy/şirket aktivasyonu yok.

Kalan: hazırlanan uyumluluk adayının tarayıcı kabulü; üretim yük/kilit ölçümü; kontrollü yayın ve canlı smoke. Public dışı şemaların tam karşılaştırması ve gerçek veri klonlaması bu provanın kapsamı değildir.
