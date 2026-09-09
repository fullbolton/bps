# Mevcut görev akışına operasyon bağlamı — ilk dilim tamamlandı

## 2026-09-09 kod envanteri ve teslim

Mevcut Görevler listesi, kimlikle kullanıcı seçici, atama/atamayı kaldırma,
“Bana atanan” ve “Atanmamış” filtreleri zaten var. `createTaskAction` pasif firma
kontrolünden sonra mevcut servisi çağırıyor. Yeni görev motoru yazılmadı.

Günlük aktif talep kartındaki “Takip görevi hazırla” bağlantısı yalnız firma UUID,
talep UUID ve gün taşır. Görev ekranındaki düğme bunları pilot rol/feature flag
kontrolüyle sunucuda yeniden okur. Erişilemeyen kayıt, yanlış gün, pasif firma,
iptal edilmiş talep ve bozuk/tekrarlı URL parametreleri önseçim üretmez.
Firma hazır seçilir; şube, gün, hizmet ve pozisyon düzenlenebilir başlığa kopyalanır.
Atanan kişi ve termin kullanıcıya bırakılır; saha personeli BPS hesabı yapılmaz.
Kaynak manuel kalır; `source_ref`, talep/şube FK veya kalıcı ilişki oluşturulmaz.
Talep değişimi göreve yansımaz ve görev tamamlanması talebi kapatmaz.

Form önceki başlık/önceliği yeni forma taşımıyor. Devam eden gönderimde kapanma ve
aynı formda çift tıklama engelleniyor. Bu, eski görev yazma yoluna ağ kaybında
exactly-once garantisi eklemez; pilot ops komut uzlaştırması görevler için geçerli değil.
Mevcut görev atama yetkileri ve raw-claim policy'ler değiştirilmedi.

## Ölçüm

75 operations unit (7 yeni önseçim kontrolü), 11 runner testi, legacy unit, tsc,
static186 dosya/0 FAIL/2 mevcut WARN, 181 PGlite, 48 native yarış, 42 yerel API,
izole build: tam paket 10/10 exit0. Rapor:
`/var/folders/fg/qm_gg6w16299dhr_lz9xr38r0000gn/T/bps-acceptance-kz1m16/report.md`.

Ayrı `node scripts/qa-local-task-prefill.mjs`: 9 gerçek yerel servis/Auth/API kontrolü.
`scripts/fixtures/local-task-prefill.sql` yalnız dedicated test ortamına görev
tablosu ve profile seçici yardımcıları ekler. Bu üretim migration'ı değildir.
Contracts/appointments yoktur: fixture bu ilişkilerin dolmasını CHECK ile reddeder;
tam geçmiş şema, bütün RLS/trigger'lar ve prod owner kabulü sayılmaz. Eski rol/claim
semantiği testte açıkça korunur; eski 43 policy için güvenlik kapanışı iddiası yok.

Tarayıcı: günlük kart → görev formu → gerçek server action → listede tek sentetik
kayıt. Önseçimli formu iptal edip “Yeni Görev” açınca boş başlık/firma doğrulandı.
673 px görünümde document.scrollWidth=innerWidth; 390 px ve tüm eski görev
ekranlarının erişilebilirlik/mobil kabulü bu ölçümle tamamlanmış sayılmaz.

## P07 devir teslimine geçiş (artık tamamlandı)

GOREV_DEVIR_DILIMI.md güncel sonucu içerir. Aşağıdaki karar bu teslimin ilk planıdır.

Atama mevcut; ancak gerçek devir geçmişi ve eşzamanlı edit çatışması ayrı iş.
Yeni bir “sahiplen” düğmesi eklemeden önce task UPDATE yollarını ve admin üye
taşıma/atama temizleme yolunu envanterle. Audit/revision tüm yazma yollarında
korunmalı; yalnız yeni UI/RPC'yi test edip direct UPDATE'i dışarıda bırakma.
Yeni yetki genişlemesi, eski raw-claim policy rewrite veya prod migration yok.
İlk sonraki teslim: bu sınırları açıklayan plan + mevcut davranışı ortaya koyan
yarış/izin regresyonları; ardından en küçük gerekli transaction/trigger değişimi.

Yan bulgu: `completeAppointmentAction` hâlâ serviste ayrı randevu UPDATE ve görev
INSERT çağırıyor. Eski `complete_appointment_atomic` RPC'nin erişimi
20260713000200 ile özellikle kapatılmış; yeniden GRANT ederek kullanıma alma.
Parçalı başarı ve eşzamanlı tekrar ihtimali statik kod bulgusudur, prod ölçümü değil.
Randevu atomikliği ayrı kabul gerektirir; görev önseçimi bunu düzeltmiş sayılmaz.

## İlk sözleşme ve değişmeyen sınırlar

Kaynak: ana SaaS iş planı P07. Yeni genel görev motoru kurulmayacak.

Önce src içindeki görev, randevu, sahiplik/devir ve scoped profile yardımcılarını
oku; hangi işin zaten yapıldığını güncel koddan çıkar. Günlük talep/şube bağlamından
mevcut görev açma akışına geçişte firma ve ilgili bağlamın yeniden seçtirilmemesi
ilk küçük hedef. BPS kullanıcı hesabı ve sahadaki personel ayrı varlıklardır.

Görev kaydı ops talep/şube ilişkisi taşıyacaksa tenant kapsamı ve FK/okuma-yazma
kuralları önceden belirlenmeli; yalnız URL önseçimi kalıcı ilişki var diye anlatılmamalı.
Sahiplenme/devir zaten varsa tekrar yazma. Atanmamış görev ve devir sonrası geçmiş
ayrı kabul; kişi erişimi genişlemesin. Görüşme kapanması takip görevini otomatik
kapatmasın. E-posta/Slack veya kullanıcıya bildirim gönderimi açma.

Mevcut dedicated yerel fixture görev/randevu tablolarının tam üretim baseline'ı
olmayabilir. Gerekli minimal şema testte açıkça modellenmeli; yeni fixture gerçek
prod ölçümü diye sunulmamalı. Üretim, gerçek hesaplar ve eski 43 raw-claim policy
bu yerel dilimde değiştirilmeyecek. Temizlik, push/deploy yapılmayacak.
