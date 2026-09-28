# Fable H-1–H-4 — Davranış düzeltmeleri

Baz: uygulama 26b2e77, DB/test commit 0d20ab9. Yeni SQL yok.

## Değişiklikler
- Tarihli evrakların durumu servis okumalarında yeniden türetilir. Saklı 'tam' değeri geçmiş tarihi gizlemez; eksik dosya ve açık 'eksik' kararı önceliklidir.
- Gün hesabı Europe/Istanbul. Evraklar, firma detayı ve dashboard gün değişiminde/focus sonrasında yeniden okunur (yerel saat kontrolü 30sn; her kontrolde ağ isteği yapılmaz).
- Teklif girdilerinde negatif/NaN/Infinity, taşma ve model tabanı altı reddedilir. Boş zorunlu girdi geçersiz, boş opsiyonel gider sıfırdır. Kâr maliyet üzerine eklenir. Mevcut oranlar yeniden doğrulanmadı; sonuç kesin teklif/bordro değildir.
- Sözleşme, randevu, görev, not ve işgücü okuyucuları exact count ile tamlığı kontrol eder. Eksik yanıt hata verir. Bu paket büyük liste sayfalaması eklemez.
- Dashboard tam toplamları kullanır; eksik satır listesi gösterilmez. Raporlar eksik firma eşlemelerini ve taşımada oluşan hataları boş/başarılı saymaz.
- Firma detayının karışık yerel finans/risk/grafik değişiklikleri pakete alınmadı; yalnız evrak ve teklif ilgili satırlar taşındı.

## Kabul
`node --test scripts/document-validity.test.mjs scripts/document-status-service.test.mjs scripts/istanbul-day-watch.test.mjs scripts/teklif-validation.test.mjs scripts/complete-result.test.mjs`

35 test, TypeScript ve üretim derlemesi geçti. Ek strict tarih sınır kontrolü geçti.
Yerel gerçek dashboard bileşeni + sentetik veri adaptörü: auth/transport hatası → hata ve bilinmeyen sayılar; kesilmiş yanıt → doğrulanmış 2000/1500 toplamları ve satır hata durumu; tekrar deneme → tam tek kayıt görünür. İş verisi yazılmadı.

Birim testleri ve UI fixture yardımcıları aynı commit'te bulunur. Önceden eksik genel qa:operations envanteri bu paketle tamamen onarılmış sayılmaz; ayrı sonraki iş.

Rapor tarayıcı kabulü: transport hatası ve kesilmiş firma listesi hata gösterdi; tam yanıtla tekrar denemede gerçek adı '—' olan firma satırı korunarak 1 kayıt gösterildi.
