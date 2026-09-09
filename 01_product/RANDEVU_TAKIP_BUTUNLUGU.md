# Randevu sonucu ve takip görevinin bütünlüğü — yerelde tamamlandı

## 2026-09-09 teslim

`20260909001400_appointment_completion.sql` yalnız dedicated sentetik Supabase'e
uygulandı. Yeni `complete_appointment_scoped` eski revoke edilmiş RPC'yi kullanmaz
ve yetkisini açmaz. UI/server action gerçek actor eşleşmesini kontrol eder; RPC
actor profile SHARE kilidinden sonra canlı role ve verified tenant bakar. Yalnız
yonetici/operasyon; İK ve diğer roller yok. Firma tenant eşleşmesi + SHARE, sonra
randevu FOR UPDATE; kilit sonrasında company/tenant tekrar eşleştirilir.

Randevu UPDATE, opsiyonel tasks INSERT (açık/atanmamış/revision0), trigger geçmişi
ve kapalı receipt tablosu tek transaction'dır. Görev yazısı hata alırsa randevu
da kapanmaz. Pasif firma randevusu kapanır, yeni görev yerine açık skip sebebi döner.
Sonuç 1–4000, sonraki adım 1–1000 karakter. SQL trim listesi JS trim boşluklarını
(NBSP/BOM dahil) kapsar; yalnız regex \s'nin boşluk doğrulamasını aşabildiği ölçüldü
ve kapatıldı. UI UTF-16 uzunluğuyla saydığı için emoji sınırında DB'den daha dar olabilir.

Receipt randevu başına tek ilk tamamlama sonucudur. Aynı actor/tenant ve aynı içerik
yeniden gönderilirse aynı taskId/skip döner. Farklı içerik veya actor ret; eski
tamamlanmış fakat receipt'siz randevu için geriye dönük görev üretilmez. Sonradan
yeniden açılmış/sonucu değiştirilmiş randevu başarılı tekrar gibi gösterilmez.
Receipt mevcut görevin sonradan silinmediğini veya hâlâ açık olduğunu iddia etmez.
Manuel ek takip görevi akışı hâlâ ayrı; bütün tasks tablosuna tek-görev kısıtı yok.

`completeAppointment` artık tek RPC'ye iner; eski ayrı yazılara fallback yok.
Kullanılmayan `updateAppointmentStatus` helper'ı tamamlamayı bu akışa yönlendirerek
eski parçalı yolu yeniden açamaz. Direct PostgREST UPDATE eski yetkilerini korur;
43 policy bu teslimle düzeltilmiş sayılmaz. Tamamlama formunda uzunluk sınırları,
actor değişiminde kapanma, istek sırasında içerik/kapanma ve çift tıklama koruması var.
Kalıcı tarayıcı form taslağı yok; kayıp yanıtta aynı form içeriğiyle tekrar güvenli.

## Ölçüm ve sınırlar

85 unit,11 runner,legacy unit,static189/0FAIL/2WARN,tsc,181 opsPGlite,48 opsnative,
16 tasknative,22 appointmentnative,42 opsAPI,build: tam paket12/12 exit0.
Son rapor: `/var/folders/fg/qm_gg6w16299dhr_lz9xr38r0000gn/T/bps-acceptance-BsKlG7/report.md`.
Ayrı `qa-local-appointment.mjs`:9 gerçek Auth/servis/API kontrolü; başarılı cevap
SDK fetch sınırında kaybettirildi, DB tamamlandı+1task, tekrar aynı sonuç/1task.
Bu tarayıcı ağına paket kaybı testi değildir.

Native iki bağlantı ve pg_blocking_pids: aynı/farklı tekrarlar, company pasife alma,
profile rol ve tenant taşıma kilit yarışları; task insert failure rollback;
eski RPC ACL kapalı, private receipt okuma/yazma reddi; scope ve metin kontrolleri.
Native/sentetik şema tam prod FK/trigger/owner entegrasyonu sayılmaz.

IAB sentetik hesap: SQL ile hazırlanan planlı randevu → sonuç formu → gerçek server
action → tamamlandı/1task/1receipt. Görevler ekranında Randevu kaynağı, Atanmadı,
Açık, revision0. Randevu oluşturma servisi API'de geçti. Yeni Randevu formunda IAB
date fill DOM değerini değiştirdi ama kontrollü formda korunmadı/Olustur pasif kaldı;
tam yenilemede de tekrarlandı. Bunun uygulama mı araç köprüsü mü olduğu kesinleşmedi.
Bu nedenle tarayıcıdan yeni randevu oluşturma kabulü tamamlandı diye raporlanmaz.
Sonraki dilim RANDEVU_FORM_BAGLAMI_DILIMI.md; tarih kontrolünü gerçek UI etkileşimiyle
ayır, sırf otomasyon için uygulama doğrulamasını gevşetme.

Üretim/gerçek hesap/temizlik/push/deploy yok. 12 ops+1 task+1 appointment migration
yalnız yerelde. Migration önce, kod sonra; endpoint yoksa uygulama eski parçalı yola dönmez.

## İlk sözleşme (tarihsel plan)

Önce mevcut `completeAppointmentAction`, `completeAppointment`, eski
`20260407001700_complete_appointment_atomic.sql` ve onu bilerek kapatan
`20260713000200_revoke_complete_appointment_atomic_execute.sql` dosyalarını oku.
Şu an servis önce randevuyu kapatır, sonra opsiyonel görev açar. İkinci yazı hata
alırsa kapanmış randevu/takipsiz iş oluşabilir; eşzamanlı tekrarın yarış kapısı var.
Bu statik kod bulgusudur, üretim ölçümü değildir.

İlk hedef: mevcut ekran ve sonuç/sonraki adım davranışını koruyarak tek transaction.
Pasif firma randevusu kapanabilmeli; yeni takip görevi açılmaması açık sonuç olarak
gösterilmeli. Görev açık ve atanmamış başlar, görüşme tamamlandı diye görev kapanmaz.
Sorumlu BPS hesabıdır, saha personeli değildir. Yeni görev trigger'ları revision0
ve başlangıç geçmişi üretmeli; iki tablo arasında yarım başarı kalmamalı.

Eski RPC'nin execute yetkisini geri vermek çözüm sayılmaz. Kapatılma gerekçesini,
mevcut RLS rol/kapsamını, tenant doğrulamasını ve fonksiyon sahibini önce incele.
Yetki genişletme yok. Mevcut43 raw-claim policy ve admin/Auth body rewrite yok.
Yalnız yeni akışın sınırlarını doğrula; gerekirse yeni scoped RPC + komut kimliği
ile kayıp yanıt/tekrar sonucunu koru. Sadece UI double-click koruması yeterli değil.

Yerel fixture'da appointments/contracts yok; minimum randevu test şemasını gerçek
migration'lardan açık sınırlarla çıkar. Test fixture'ını tam prod baseline diye
sunma. Native iki bağlantı/kilit beklemesi, rollback, rol/tenant reddi, pasif firma,
aynı komut tekrar ve gerçek yerel servis/UI doğrulaması kabulün parçasıdır.

Üretim/gerçek hesap/temizlik/push/deploy yapılmaz. Plan, kod ve ölçüm repo/Vault'a
aynı dilimde işlenir. Eski task UPDATE CAS kodu ve tüm mevcut uncommitted çalışma korunur.
