# Finansal özet boş/dolu kabulü — 027 (ürün migration'ı yok)

2026-09-09. 026 sonundaki başarılı/boş okuma kapısı yerel tarayıcıda kapatıldı.

İşaretli minimum okuyucu fixture'ı `scripts/fixtures/local-financial-summary.sql` ve dedicated proje/port/container doğrulamalı `scripts/qa-local-financial-fixture.mjs` eklendi. Bu tablo tarihsel prod DDL'sinin kopyası değildir; repo o DDL'yi içermediğinden üretim şema kabulü hâlâ açık. Fixture SELECT yalnız yönetici/muhasebe ve doğrulanmış tenant; uygulamaya yazma izni yok. Script yalnız kendisine ait iki UUID'yi değiştirir. `empty`, `filled`, `company-only`, `clean` kipleri. Kullanım yalnız dedicated yerel ortamda; .env.local okunmaz.

## Ölçülen UI

- Başarılı boş cevap: tutarlar “—”, kayıt bulunamadı; teknik hata veya muhasebe onayı bekleniyor diye sunulmuyor.
- Dolu sentetik cevap: 12.500 TL açık, 8.000 TL fatura, 2.500 TL kesilmemiş, 1.000 TL gecikmiş; 1 firma. Firma bağlantısı doğru UUID, dağılım değerleri doğru.
- Yalnız firma kaydı: firma tutarı korunur, portföy toplamları “—”; eksik gecikmiş firma sayısı “bilinmiyor”. Önceki `?? 0` yanıltıcıydı, düzeltildi; ölçülen sıfır hâlâ 0 olarak render edilir.
- Mali verileri yenile düğmesi eklendi; sayfayı kapatmadan yeni ölçüm alınır. Yüklemede düğme devre dışı, PDF düğmesi önceki hata/yükleme sınırını korur.
- Kabul sonrası iki sentetik mali kayıt temizlendi; işaretli boş test tablosu kaldı. Başka kayıtlar silinmedi.

Bu tur yeni SQL işlevi/ürün migration'ı, tam native paket veya canlı finansal kabul yapılmadı. Sıradaki plan `PILOT_UCTAN_UCA_KABUL.md`.

## Test raporu

128 operasyon unit; runner/operations/legacy/static/TypeScript 5/5 geçti. İlk izole build Google Fonts DNS ENOTFOUND ile başarısız: `/var/folders/fg/qm_gg6w16299dhr_lz9xr38r0000gn/T/bps-acceptance-AKCOt9/report.md`. Yalnız build bir kez yeniden çalıştırıldı ve geçti: `/private/tmp/bps-financial-build-retry.log`. Başarısız rapor üzerine yazılmadı. `git diff --check` temiz. Tam23adım bu tur çalıştırılmadı.
