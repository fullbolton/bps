# Kalan 16 migration — kontrollü kurulum adayı

Başlangıç: doğrulanmış 191 üretim kaydı, son 20261019000100. Bitiş: 207. Her SQL dosyası tam beklenen önceki ledger dizisini kontrol eder; DDL ve ledger aynı transaction içindedir. 60 saniye statement timeout kullanır; migration içindeki lock timeout korunur. Sıra atlamak ve tekrarlamak reddedilir.

Üretimde henüz uygulanmadı. Otomatik toplu yayın komutu yoktur. Uygulama adayı doğrulandıktan sonra her adımın sonucu ölçülerek devam edilmelidir; belirsiz HTTP sonucu yeniden çalıştırma nedeni değildir. Başarısız adımda önce ledger ölçülür. 002 katalog ve geçmişi değiştirir; geri dönüş uygulaması bridge/release.json içindeki uyumlu dağıtımdır.

Tekrar üretim: `node qa/hr-release-20261019/rehearse.mjs`, ardından `node qa/hr-release-20261019/remaining/prepare.mjs`. Yerel kabul: `node qa/hr-release-20261019/remaining/test.mjs`.

Her dosyada ledger yazımına hata enjekte edilir; rollback sonrası aynı dosyanın başarıyla kurulması ve başarılı kurulumun tekrarının reddedilmesi sınanır. 16 grubun tamamı geçti. Son kontrol İK/erişim tablolarında RLS ve aktivasyon kapılarının kapalı kalmasıdır. Gerçek şirket verisi kullanılmaz.

005/007/008 henüz üretime uygulanmadığı doğrulandıktan sonra RLS komutları dinamik döngüden açık tablo adlarına taşındı. Davranış aynı; statik denetlenebilirlik artırıldı. Kaynak ve kurulum hashleri manifest.json içinde yeniden üretildi. Önceki hash listeleri artık bu aday için kullanılmamalıdır.
