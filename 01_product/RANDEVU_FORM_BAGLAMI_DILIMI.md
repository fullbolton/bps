# Firma bağlamından randevu ve form kabulü — yerelde tamamlandı

## Ölçülen teslim — 2026-09-09

Firma detayındaki kapalı Randevu Planla, yönetici/operasyon için mevcut modalı açar.
Firma scoped companyShell'den UUID/ad olarak hazır gelir; bu ekranda başka firma
ve inline yeni firma yok. Genel Randevular formundaki inline yeni firma korunur.
Pasif firma düğmesi kapalı; mevcut server action pasiflik kontrolü korunur.
Firma/user/rol/claim değişimi eski formu kapatır, gecikmiş company shell cevabı
önceki firmanın formunu yeniden dolduramaz. Claim UI reset kimliğidir, yetki kanıtı değil.

Zorunlu alanlar korunur; form submit sırasında disabled ve ref çift gönderimi
engeller, Escape/arka plan/iptal pending kaydı kapatamaz. Submit hatasında alanlar
korunur; iptal/yeniden açmada temizlenir ve firma önseçimi döner. Inline oluşturulan
firma adı payload'da birleşik listeden bulunur. Başarılı create sonrası liste yenileme
hatası yeniden gönderilebilir create formu bırakmaz; firma sekmesinde açık hata vardır.

IAB'nin native takvimi (Show date picker → Right → Return) tarihi React state'e
geçirdi; alan değiştirdikten sonra korundu ve UI create başarılı oldu. Eski fill
sorunu bu yöntemle tekrar etmedi; date onChange veya validation gevşetilmedi.
Local manager ile company20: genel formda tarih kabulü1, firma formunda double-click
kabulü1, iptal edilen taslak0, pasif firma reddi0 satır; SQL sayım **1|1|0|0**.
Firma Randevular sekmesinde 11.09.2026 / Firma bağlamı tarayıcı kabulü görüldü.
Pasif ret sonrası tarih/katılımcı durdu. Inline Yeni Firma aç→Escape yalnız üst formu
kapattı; randevu alanları kaldı. Inline firmanın gerçek create işlemi bu turda ölçülmedi.

Son hızlı paket + izole build **6/6 exit0**:11 runner,85 operasyon unit,legacy unit,
static189/0FAIL/2WARN,tsc,build. Rapor:
`/var/folders/fg/qm_gg6w16299dhr_lz9xr38r0000gn/T/bps-acceptance-mAWfwZ/report.md`.
Ayrı gerçek local appointment API **9/9**. Bu tur SQL migration değişmedi; önceki
12/12 tam SQL yarış raporu tarihsel kanıt, bu tur yeniden çalışmış sayılmaz.
İlk build sandbox DNS nedeniyle Google Fonts indirmedi; izinli tekrar geçti.
Sentetik company fixture'a risk eklendi; diğer eksik legacy tablolar yüzünden firma
özetindeki tüm kartlar kabul edilmiş sayılmaz. Üretim/RPC owner/tam schema kabulü yok.
Yeni randevu yaratma hâlâ eski insert: ref çift tıklama koruması ağda kayıp create
cevabının tekrarını idempotent yapmaz. Receipt garantisi sadece tamamlama RPC'sinde.
Şube FK eklenmedi; bu teslim mevcut company_id ilişkisini kullanır.

Sıradaki: TOPLU_GOREV_DEVIR_DILIMI.md. P07 kullanıcı ayrılışı/devri henüz kapanmadı.

## Başlangıç planı (tarihsel)

P07'nin firma/şube bağlamı maddesindeki randevu tarafı. Önce mevcut firma detayındaki
randevu açma/link yolunu ve NewAppointmentModal'ı oku. Aynı firmayı yeniden seçtirmeden
mevcut randevu formuna geçir; yeni form veya görev motoru kurma. URL adları/verileri
otorite değildir; firma scoped kaynaktan bulunur, mevcut pasif firma yazı kontrolü
korunur. Şube kalıcı FK değilse başlık/açıklama önseçimini kalıcı bağ diye sunma.

Önce açık UI kabulünü ele al: IAB'de NewAppointmentModal date `fill('2026-09-11')`
DOM value'yu değiştirse de başka alana geçince tarih boş ve Olustur pasif kaldı.
Tam yenilemede tekrarlandı. Kodda tarih `value={tarih}` + onChange; API create geçti.
Uygulama hatası henüz kanıtlanmadı; native tarih seçici/klavye veya ayrı Chrome
test oturumuyla ayır. CUA dokümanlarını oku; browser state/event dispatch için shell,
CDP veya evaluate mutasyonu kullanma. Gerçek prod Chrome sekmelerine dokunma.
Yeni sentetik login gerekirse yalnız local Supabase Auth; gerçek BPS şifresi kullanılmaz.

Form alanlarının erişilebilir adlarını, zorunlu alanları, başarısız submit'te korunmayı,
iptal/yeniden açma ve çift gönderimi doğrula. Inline yeni firma akışını bozma. Gönderim
API'sini atlayıp arayüz çalışmış sayma; SQL ile seed edilen randevunun tamamlanması
yalnız tamamlama kabulüdür, yaratma kabulü değildir.

Randevu→takip tamamlaması yeni scoped/receipt transaction üzerinden çalışır;01300
task geçmişi ve01400 tamamlama migration'larını geri alma/eskisini açma. Gerekli
testler ve kabul kanıtı repo/Vault'a yazılır. Üretim/temizlik/push/deploy yok.

P07 toplu kullanıcı ayrılışı/devri hâlâ açık; atama geçmişi bu işi tamamlamaz.
P08 sözleşme/evrak bir sonraki ana modüldür, mevcut iş planı referansı korunur.
