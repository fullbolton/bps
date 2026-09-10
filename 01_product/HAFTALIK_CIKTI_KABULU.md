# 043 — Haftalık çıktı düzeni ve kabul

2026-09-10. PDF sütunları eşit genişlikte olduğu için şube/personel metinleri gereksiz bölünüyordu. Yazdırma genişlikleri yeniden dağıtıldı; dört özet kutusu aynı satıra alındı. Aynı sentetik 40 talep 6 sayfadan 5 sayfaya indi.

100 personellik tek talep önce bir dev satır oluşturuyor, devam sayfalarında şube bağlamı kayboluyordu. Yazdırmada 12 kişilik devam satırları kullanılıyor. Gün/şube/pozisyon tekrarlanıyor; ihtiyaç/atanan/açık sayıları yalnız ilk satırda gösteriliyor. Ekranda hâlâ tek talep ve bütün personel adları var. CSV içeriği ve SQL değişmedi.

## Ölçüm

- Gerçek WeeklyOperations JSX'i ve print CSS'i AST üzerinden alınarak ayrı Chromium'da sentetik rapor üretildi; rapor ikinci kez elle uygulanmadı. Uygulamanın Auth/yenileme/print-dialog akışı bu testin kapsamı değildir.
- Tek talep: 1 sayfa. 40 talep: 5 sayfa; 40 kimlik sıralı ve birer kez. 100 personel: 4 sayfa; 100 kimlik sıralı ve birer kez. Tablo başlıkları tekrarlanıyor; bütün son çıktı sayfaları görsel kontrol edildi.
- Ekran görünümünde 100 personel tek talepte, yazdırmada 100 personel birer kez kontrol edildi. Mevcut haftalık plan testleri 8/8; TypeScript geçti.
- Araç: `scripts/qa-weekly-print.cjs`; sentetik dosyalar `/private/tmp/bps-print-043-final`. Playwright modül yolu ve Chrome executable çevre değişkeniyle verilir. CSS önce yerel uygulamada derlenmiş olmalıdır.

## Canlı CSV ve native yazdırma sınırı

Canlı 2026-09-07 haftasında önceki sentetik firma için ekran 1 talep / 2 ihtiyaç / 1 atama / 1 açık gösterdi. CSV düğmesine basıldı; indirilen dosya bulunamadığı için byte içeriği doğrulanmış sayılmadı. Native Chrome erişimi “Computer Use permissions are not granted” döndü. `chrome://downloads/` tarayıcı URL güvenlik politikasıyla engellendi; bu yol tekrar denenmedi veya başka yöntemle aşılmadı.

Bu yüzden canlı CSV byte kontrolü ve kullanıcı oturumundaki native PDF diyalogu açık; yerel CSV HTTP 9/9 kanıtı geçerlidir. Yeni canlı test kaydı oluşturulmadı, eski kayıt değiştirilmedi. Gerçek müşteri pilotu henüz yapılmadı.

Yayın sonucu `supabase/manual/release-20260910-043.json` kaydında tutulur.
