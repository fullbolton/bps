# Rapor kaynaklarının kontrollü geçişi — 026 (SQL yok)

Plan, 2026-09-09: Finansal özetten dönem/tarih belirtmeyen eski iş gücü ve talep sayaçları ile elle verilen kritik firma sayısı çıkarılacak. Mali tutarlar mevcut muhasebe kaynağında kalacak. Okuma hatası muhasebe onayı bekleniyor diye sunulmayacak; yeniden deneme olacak.

Raporlara 02500 günlük özet ve haftalık plan/katılım çıktısı erişimi eklenecek; sunucu bayrağı ve mevcut yönetici/operasyon yetkisi korunacak. Önceki iş gücü ve talep verileri açıkça önceki kayıtlar diye adlandırılacak. Gerçekte filtre uygulanmayan sabit Mart 2026 dönem etiketi kaldırılacak. Elle verilmiş firma risk etiketi otomatik analiz olarak sunulmayacak.

Bu dilim tarih aralıklı yeni rapor motoru, mali hesaplama, veri taşıma/silme veya rol genişletme içermez. P06/pilot kapanmış sayılmaz. Kabul: genel test/tip/build ve yerel tarayıcıda yeni/önceki kaynak ayrımı ile mali hata davranışı.

## Teslim ve kanıt

Plan uygulandı. Rapor sayfası sunucu bayrağını ReportsClient'a geçirir; günlük özet mevcut DailyOverview bileşenini kullanır. Yeni rol veya SQL yok. Rol değişiminde seçili rapor izinli listeye uyarlanır. Eski veriler ve okuyucular raporlarda korunur; finansal ekran artık bu iki eski personel kaynağını okumaz. Sözleşme tarih açıklaması mevcut hesabı tam anlatır: süresi dolmuş ve sonraki 90 gün.

Genel/type/build6/6,128unit; rapor `/var/folders/fg/qm_gg6w16299dhr_lz9xr38r0000gn/T/bps-acceptance-erRin9/report.md`. SQL değişmediğinden native/API paketi tekrar çalıştırılmadı. Tarayıcıda raporlarda günlük36/62/1/61 ölçümü, haftalık link, önceki kayıt etiketleri ve sabit dönemin kaldırılması görüldü. Finansal ekranda yerel eksik mali kaynak nedeniyle doğru hata ve yeniden deneme, PDF düğmesinin yokluğu doğrulandı. Başarılı ve başarılı-boş mali cevap bu tur tarayıcıda ölçülmedi; sentetik fixture kabulü sonraki pilot işine alındı. Bu fixture eksikliği prod hakkında bulgu değildir.

P06 kısmi: günlük/haftalık rapor erişimi hazır; önceki veriler taşınmadı, yeni tarih aralıklı rapor motoru yok. Sıradaki pilot uçtan uca kabul senaryosu ve mali başarılı/boş okuma kontrolü. E-posta/PKCE/hook doğrulaması açık. Prod/push/deploy/veri silme yapılmadı.
