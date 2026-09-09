# Görev atama geçmişi ve düzenleme çatışması

2026-09-09 sözleşmesi ve tamamlanan yerel teslim. Üretim migration/deploy yok.

Mevcut updateTask ve kullanılmayan updateTaskStatus servisi aynı raw writer'a iner.
UI tek hızlı güncelleme panelidir. Yeni görev/randevu takip insert'leri aynı tasks
tablosuna yazar. Admin rol/tenant taşıma RPC'si tasks güncellemez; üyeliği taşınan
kişide kalan işleri otomatik devretme bu teslimin kapsamı değildir.

Her task INSERT revision=0, her UPDATE revision+1; istemci revision değerini
yazamaz. Eski ekran beklediği revision ile UPDATE yapar, eşleşmeyince yazmaz ve
yenileme ister. Tüm uygulama update servisleri beklenen revision ister. Doğrudan
PostgREST/admin UPDATE eski erişimini korur, revision'ı ilerletir; onların beklenen
revision göndermesi zorunlu hale gelmez. Bu güvenlik yetkisi değil, UI çatışma koruması.

DB AFTER trigger, ilk kayıt ve atanan kullanıcı kimliği değişimini geçmişe ekler.
Sadece isim metni düzeltmek devir değildir. Başlangıçtaki mevcut görevler için
baseline kaydı üretilir, geçmişte kimin atadığı uydurulmaz. actor=auth.uid(); SQL
bakımında NULL olabilir. İsimler güncel scoped profile listesinden çözülür; ayrılmış
üyenin kimliği geçmişte kalır. Bütün task update yolları aynı trigger'a tabidir.

Geçmiş mevcut görev görünürlüğü + doğrulanmış tenant ile okunur, istemciye doğrudan
yazma yetkisi verilmez. Son20 kayıt açıkça belirtilir. Görev silinirse geçmiş FK
cascade ile silinir: bu değiştirilemez mevzuat arşivi değildir. Task id/tenant/company
bu dar teslimde taşınmaz; değiştirme girişimi reddedilir. Auth/profile silinmesinin
SET NULL işlemi de revision ve geçmiş üretir.

Eski43 raw-claim policy ve eski rol yetkileri değişmez. Görev ataması hizmetindeki
İK kısıtı direct SQL için yeni bir güvenlik garantisi sayılmaz. Randevu tamamlama
atomikliği, görev oluşturmanın kayıp yanıtta tekrar güvenliği ve toplu kullanıcı
ayrılışı/devri ayrı teslimdir. Migration önce, kod sonra uygulanmalı; eksik revision
ile uygulama güvenli biçimde yazmayı reddeder. Eski istemciler CAS yapmaz.

Kabul: gerçek iki bağlantıyla aynı revision yarışında tek kazanan; direct UPDATE
eski ekranı geçersiz kılar; başlangıç/devir/atama kaldırma kayıtları; rollback geçmişi
geri alır; geçmişe DML reddi; başka tenant/stale claim okuma reddi; eski görev
servis ve tarayıcı akışı. Tam tarihsel prod şema/owner kabulü ayrıca gerekir.

## Ölçülen sonuç

`20260909001300_task_assignment_history.sql` yalnız dedicated yerel sentetik
Supabase'de uygulandı. Mevcut task policy'leri değişmedi. Son20 atama kaydı hızlı
güncelleme panelinde; eski ekran yazısı reddedilir ve açık bir form yenileme düğmesi
sunulur. Admin üyelik taşıma tasks'a dokunmaz; otomatik devir yoktur.

79 unit +11 runner testi +legacy unit +static188/0FAIL/2WARN +tsc +181 ops PGlite
+48 ops native +14 task native +42 API +build: tam paket11/11 exit0.
Rapor: `/var/folders/fg/qm_gg6w16299dhr_lz9xr38r0000gn/T/bps-acceptance-7ttu49/report.md`.
İki ek olumsuz kontrol sonrası ayrı task native koşusu **16/16**: yabancı atananın
reddi revision/geçmişi değiştirmedi, rol görünürlüğü geçmişe de uygulandı.
`qa-local-task-prefill.mjs` **11/11**: gerçek Auth/API ile yeni CAS ve geçmiş okuması.

Tarayıcı: panel açıkken sentetik SQL status güncellemesi revision0→1; eski panelin
kaydı conflict ile reddedildi. Yenileme güncel durumu getirdi; yeni atama revision2
ve tek “Atandı” geçmiş kaydı oluşturdu. Baseline zamanı ve sınırlaması görünür.
673px'de taşma yok. Native testte profile FK SET NULL da ölçüldü; bu fixture'ın
tüm üretim FK/trigger/owner davranışını kanıtladığı iddia edilmez.

Sıradaki dilim: RANDEVU_TAKIP_BUTUNLUGU.md. Mevcut randevu UPDATE + görev INSERT
iki ayrı yazı; eski kapatılmış RPC yeniden açılmadan atomikliği planla/test et.
