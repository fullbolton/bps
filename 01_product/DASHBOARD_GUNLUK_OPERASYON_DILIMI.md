# Dashboard günlük operasyon — 02500

2026-09-09. Yerel sentetik ortamda uygulandı ve doğrulandı; prod/push/deploy yok.

## Kapsam ve hesap

Eski staffing_demands açık talep kartı ve workforce_summary aktif personel KPI'sı kaldırıldı. Bugünün talep kaydı, istenen kişi, kaldırılmamış yerleştirme ve eksik kişi ölçülür. Yerleştirme katılım/puantaj değildir. İstanbul takvim günü, yalnız active talepler; geçmiş/gelecek ve iptal dışarıda. Eksik her talepte max(0, istenen-yerleştirilen), sonra toplamdır.

Firma/lokasyon sonradan pasif olmuşsa iptal edilmeyen operasyon taahhüdü gizlenmez. Bu nedenle kurulum envanterinin aktif dizin ölçümleriyle aynı sayaç değildir. En çok açık ilk 5 talep, eşitlikte id sırası. Bağlantı firma+gün+talep seçip doğru kayda kaydırır.

Tek SQL snapshot'ı, doğrulanmış tenant + auth.uid actor + yönetici/operasyon rolü; ham tablo okuma yetkisi verilmez. Diğer roller bu özeti görmez. Eksik/geçersiz RPC cevabı sıfıra çevrilmez. Hesap/tenant değişimi eski sonucu gizler. BPS_DAILY_OPERATIONS_ENABLED sunucu bayrağı kapalıysa kart render edilmez. Otomatik realtime/gece yarısı yenileme yok; tarih görünür, manuel yenileme/sayfa açılışı yeni gün ölçer.

## Ölçülen kabul

- 8 native PostgreSQL kontrolü: boş gün, actor/tenant/rol/üyelik, iptal/geçmiş/gelecek/yabancı tenant, pasif dizin taahhüdü, kaldırılan yerleştirme, ilk 5 sıralaması.
- Gerçek yerel Auth/RPC: özet parser'ı, yanlış tenant, rol kaybı, stale claim ve anonim ret. Geçici test hesabı temizlendi.
- Genel/type/build 6/6; 128 operasyon unit; statik 226 dosya, 0 FAIL / 2 mevcut WARN. Tam 23 adım çalıştırılmadı; native ve gerçek API ayrıca çalıştırıldı.
- Rapor: `/var/folders/fg/qm_gg6w16299dhr_lz9xr38r0000gn/T/bps-acceptance-WB5Gh7/report.md`.
- Tarayıcı sentetik ölçüm: 36 talep / 62 istenen / 1 yerleştirilen / 61 eksik; 35 açık kayıt. Yenileme ve ilk talebin vurgulanarak günlük planda açılması doğrulandı.

## Açık işler

P06 tamamlanmadı: raporlar ve finansal özet staffing_demands okumaya devam ediyor; mali anlamı günlük kişi sayısına sessizce çevrilmemeli. Sonraki iş bu iki ekranın kaynak/anlam incelemesi ve kontrollü geçişidir. Eski veriler silinmedi. Pilot, davet e-posta/PKCE/hook uçtan uca kabulü ve prod ön kontrolleri açık. Yerel critical_dates/duyuru fixture eksikliği bu dilimde değişmedi.
