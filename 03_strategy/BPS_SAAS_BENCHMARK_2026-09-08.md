# BPS — Hizmet Operasyonları ve SaaS Benchmark

**8 Eylül 2026 · Furkan ve BPS ürün/uygulama ekibi için**

Statü: **Araştırma ve yön önerisi.** Kabul edilmiş kapsam, satın alma önerisi veya
uygulama talimatı değildir. Türkiye'deki çok lokasyonlu hizmet firmalarının İDP,
dönemsel personel ve ofis operasyonuna odaklanır.

## Sonuç

**Firma → lokasyon → ihtiyaç → yerleştirme yönü sağlam. BPS'in büyüme alanı daha fazla
bağımsız modül değil, mevcut kayıtları sorumluya, tarihe, aksiyona ve geçmişe bağlayan
çalışma akışıdır.** Rakip dokümanları bu yaklaşımı destekliyor; müşterinin satın alma
isteğini veya BPS'in kullanım başarısını kanıtlamıyor.

En güçlü başlangıç, çok şubeli müşteriye hizmet veren operasyon ekibinin Excel ve
WhatsApp arasındaki tekrar işini azaltmak: şubeleri topluca al, talebi gir, açık günü
doldur, değişikliği izle, müşteri listesini aynı veriden çıkar. Firma/sözleşme/evrak
omurgası bu işi destekler. Bordro, genel CRM, çalışan sohbeti ve kapsamlı vardiya
optimizasyonu ilk ürünü büyütmemeli.

**Öncelik önerisi:** güvenilir ilk kurulum ve veri aktarımı → talep/yerleştirme →
sorumluluk ve geçmiş → sözleşme/evrak takibi → ücretli SaaS işletim kabiliyeti.
Güvenlik, veri dışa aktarma ve kullanıcı ayrılışı satış sonrasına bırakılacak lüksler
değildir; daha geniş otomasyon ise günlük kullanım kanıtlandıktan sonra büyütülmeli.

## Kapsam ve kanıtın gücü

Sekiz ürün ailesi: Quinyx, TEAM Software, Connecteam, Deputy, Bullhorn, ContractSafe,
SafetyCulture/Mitti ve Scoro. Üç ek SaaS altyapı referansı: Clerk, WorkOS, Stripe.
Hepsi BPS'in doğrudan rakibi değildir; farklı iş akışlarını karşılaştırmak için seçildi.
Fiyat, Türkiye satış/destek uygunluğu, sözleşme şartları ve satın alma sıralaması araştırılmadı.

- Rakiplerde resmî API, yardım dokümanı ve müşteri vakaları kullanıldı. Pazarlama
  yüzdeleri yatırım getirisi veya performans kanıtı olarak alınmadı.
- BPS tarafında repo HEAD `00a53c4` ve mevcut taslaklar incelendi. Aşağıda "var" demek
  kodda akışının bulunduğu anlamındadır; bu turda canlı oturumla çalıştırıldığı anlamına gelmez.
- Prod'a sorgu, deployment veya migration yapılmadı. Önceki `000400` uygulanma durumunu
  yeniden açan bir inceleme değildir. Bekleyen kimlikli smoke ayrı kalır.
- 13 Temmuz tarihli yetenek raporu bazı yeni özellikleri eksik gösteriyor. Görev
  ataması, admin ve duyurular için eski rapor yerine güncel kod esas alındı.
- Ürün içinde oturum açılmış rakip testi, saha pilotu, yük testi ve ödeme isteği ölçümü yok.

## 1. Önce üç farklı kimliği ayıralım

| Katman | BPS örneği | Anlamı |
|---|---|---|
| BPS müşterisi / çalışma alanı | Partner Staff veya Mek | SaaS sözleşmesi ve veri sınırı |
| Hizmet verilen firma | Vakıfbank veya Vakıf Katılım | Operasyonel müşteri kaydı |
| Hizmet noktası | Pendik şubesi, genel müdürlük binası | Talebin yerine getirileceği lokasyon |

Vakıfbank'ın yüzlerce şubesi yüzlerce tenant veya ayrı firma değildir. Aynı banka
iki ayrı BPS müşterisinin rehberinde yer alabilir; aralarında talep/personel verisi
kendiliğinden paylaşılmaz. Ayrıca operasyon çalışanının BPS hesabı ile sahaya gönderilen
personel kaydı ayrıdır. Her personel için kullanıcı hesabı açılması V1 şartı değildir.

Bu bölüm BPS tasarım çıkarımıdır. Clerk'in organization/membership modeli tenant
yönetimine referans sağlar; bankanın şube modeli yerine geçmez.
[Clerk Organizations](https://clerk.com/docs/guides/organizations/overview)

## 2. Rakipler neyi doğruluyor, neyi değiştirmemizi gerektiriyor?

| Referans | Belgelenmiş davranış | BPS için karar yönü |
|---|---|---|
| Quinyx | Personelsiz plan kaydı; atama ve onay ayrı alanlar | İhtiyaç atamadan önce var olabilir. Atama, onay ve gerçekleşme birleşmez. |
| TEAM / Timegate | Lokasyon görünümü, açık görev, çoklu atama, değişiklik izi | Şube odaklı plan ve gerekçeli personel değişimi doğru yön. |
| Connecteam | Üst/alt kaynakları CSV'den toplu alma, önizleme | Toplu şube girişi temel özellik; ülke rehberi bağlayıcısı ayrı iş. |
| Deputy | Kişisiz ihtiyaç, personele sunulan iş, atama, yayın ve teyit ayrımı | Türkçe "açık" etiketini bütün aşamalara yaymamak gerekir. |
| Bullhorn | Yerleştirme ve geçici çalışma için farklı akışlar | Otelde işe yerleştirme ile günlük hizmet karşılama aynı başarı ölçüsü değildir. |
| ContractSafe | Bitiş/yenileme/ihbar tarihleri ve sorumlu devri | Yalnız sözleşme bitişini hatırlatmak bazı işleri geç yakalar. |
| SafetyCulture/Mitti | Geçerlilik ve belge sahibi; denetimden takip aksiyonu | Evrakın sahibi ve yenileme işi, yüklenmiş dosya kadar önemlidir. |
| Scoro | Firma bağlamından görev/randevu; planlanan ve gerçekleşen maliyet ayrımı | Firma merkezi doğru; finansal özetin veri ve dönem anlamı açık olmalı. |

Kaynaklar: [Quinyx API](https://developer.quinyx.com/api/v1/operations/wsdlGetSchedules),
[Timegate 2021 kılavuzu](https://success-timegate.teamsoftware.com/PDFs/Templa/TimegateTemplaInterfaceV2-Sep2021.pdf),
[Connecteam import](https://help.connecteam.com/en/articles/8317115-how-to-import-jobs),
[Deputy durumları](https://help.deputy.com/hc/en-au/articles/6054132302991-Shift-status),
[Bullhorn Recruitment Cloud](https://kb.bullhorn.com/bh4sf/Content/BH4SF/Topics/closingReports.htm),
[ContractSafe tarih takibi](https://www.contractsafe.com/features/contract-tracking-software),
[Mitti belge geçerliliği](https://help.mitti.com/005854),
[Scoro firma listesi](https://support.scoro.com/hc/en-us/articles/12405025577101-Contact-list).

### Önemli karşı kanıt: her rakip davranışı kopyalanmamalı

Deputy'de "empty" planlama için kişisiz kayıt, "open" çalışanın talip olabileceği iştir.
BPS'te bugün çalışana teklif/başvuru sistemi yok; açık ihtiyaç için bu bütün durum
makinesini taşımak gereksizdir. Kaydetmek, personele yayımlamak ve teyit almak ayrı
olgular olarak korunur; sadece ihtiyaç doğduğunda yeni akış eklenir.
[Deputy Shift status](https://help.deputy.com/hc/en-au/articles/6054132302991-Shift-status)

Bullhorn'un incelediğimiz ATS Shift Scheduler özelliği resmî dokümana göre yalnız Kuzey
Amerika'da kullanılabiliyor. Bu bir tasarım referansıdır; Türkiye için doğrulanmış hazır
ürün önerisi değildir. Ayrıca Bullhorn'un ATS, Recruitment Cloud ve Jobscience belgeleri
tek sürümün aynı ekranları gibi birleştirilmemiştir.
[Bullhorn Shift Scheduler FAQ](https://kb.bullhorn.com/ats/Content/BHATS/Topics/shiftSchedulingFAQ.htm)

## 3. BPS modüllerinin güncel değerlendirmesi

### Firma, lokasyon ve ilk veri aktarımı — omurga doğru, şube ölçeği taslakta

Firma Detay ve firma/yetkili/sözleşme CSV import akışları kodda var. Mevcut import servisi
doğrulanan satırları ekliyor; bir şube rehberi senkronizasyonu veya import-job yönetimi
değil. Dolayısıyla "import yok" yanlış, "toplu şube güncellemesi hazır" da yanlış.
[BPS import servisi](../src/lib/import/import-service.ts)

Öneri: şube kodu, firma, ad, il/ilçe ve kaynak tarihiyle önizleme; yeni/değişmiş/belirsiz
satırlar; tekrar yüklemede aynı şubenin yeniden oluşmaması; aktarım sonucu ve hata listesi.
Resmî rehber şube kimliğini, operasyonun sözleşme listesi hizmet kapsamını belirler.
ATM, banka şubesi ve özel hizmet binası aynı kayıt türü gibi alınmamalı. Kapanmış veya
kaynakta bulunamamış kayıt geçmiş talepleriyle silinmemeli.

Connecteam'in toplu kaynak ve alt kaynak aktarımı bu gereksinimin ürün karşılığını
gösteriyor; resmî banka rehberini otomatik keşfettiğini göstermiyor.
[Connecteam toplu aktarım](https://help.connecteam.com/en/articles/8317115-how-to-import-jobs)

### Talep, yerleştirme ve iş gücü — en yüksek değerli geliştirme

Mevcut personel talebi servisi adet, sağlanan sayı, lokasyon metni ve başlangıç tarihi
üzerinden çalışıyor. Günlük personel yerleştirme modeli henüz taslak.
[BPS talep servisi](../src/lib/services/staffing-demands.ts),
[güncel kapsam taslağı](IDP_TALEP_KAPSAM_TASLAGI.md)

İlk paket: çalışma takvimi + günlük ihtiyaç + kişi ataması + çakışma kontrolü + tek gün
değiştirme + haftalık müşteri çıktısı. Yüzlerce şubede kayıtlı filtreler ve toplu işlemler
gösterişli bir takvimden önce gelir. Personel takvimi yardımcı görünüm olarak kalır.
Çalışma günleri ayrık iki dönem gereksiz çakışma üretmemeli; aynı gün kapasite aşımı ve
çift atama ise eşzamanlı işlemlerde de engellenmeli.

Üç gerçek ayrı kalır: kayıtlı atama / personelin kabulü / hizmetin gerçekleşmesi.
Connecteam gerçekleşen saatleri ayrıca Time Clock girişinden alıyor; sadece plan
verisinden gerçekleşen iş hesabı yapmıyor. BPS başlangıçta planlanan kişi-gün ve açık
kişi-gün raporlamalı.
[Connecteam planlanan–çalışılan karşılaştırması](https://help.connecteam.com/en/articles/10570510-compare-scheduled-vs-worked-hours-in-the-job-scheduler)

**Karar gerektiren sınır:** Otelde "beş garson" bir kez işe yerleştirme hedefiyse daily
coverage modelini zorlamayalım. Her gün beş kişilik hizmet taahhüdüyse önerilen model
uygun. Bu iş tanımı henüz kullanıcı tarafından netleştirilmedi.

### Sözleşmeler — temel mevcut, tarih ve sorumluluk derinleşmeli

Kodda durum, bitiş, yenileme hedefi ve hazırlık işaretleri mevcut; e-posta hatırlatması
da var. Yeni bir sözleşme modülü gerekmiyor.
[BPS sözleşme servisi](../src/lib/services/contracts.ts),
[bildirim türleri](../src/lib/notification-kinds.ts)

Öneri: her önemli tarihin yapılacak işi ve gerçek sorumlusu; sözleşmeden doğrulanmış
bildirim/aksiyon son tarihi; ana sözleşme–ek protokol ilişkisi. Örneğin "sorumlu belirlendi"
kutucuğu, belirli kullanıcıya atanmış takip işinin yerini tutmamalı. Bu bir ürün önerisidir,
sözleşmelere uygulanacak hukuki sürenin hesabı değildir.

ContractSafe farklı tarih türlerini, alıcı devrini ve ana sözleşmeye bağlı ek protokolleri
ayırıyor. BPS için alınacak parça bu ilişki ve takip disiplini; kapsamlı müzakere/e-imza
ve otomatik hukuk yorumlama ilk paket değil.
[Tarih ve devir](https://www.contractsafe.com/features/contract-tracking-software),
[ilişkili belgeler](https://www.contractsafe.com/support/what-are-related-documents)

### Görev, randevu ve günlük çalışma — sıfırdan başlamıyoruz

Görevde kullanıcı kimliğine bağlı atama var. Dashboard varsayılanı bana atanmış veya
atanmamış görevleri gösteriyor. Randevu tamamlama sonuç ve sonraki adımı istiyor,
bağlı takip görevi oluşturma akışı mevcut. Bunlar eski Temmuz değerlendirmesindeki
"gerçek sahiplik yok" cümlesini görev modülü için eskimiş kılıyor.
[Görev servisi](../src/lib/services/tasks.ts),
[Dashboard](../src/app/(main)/dashboard/page.tsx),
[Randevu servisi](../src/lib/services/appointments.ts)

Öneri: sahipsiz işleri görünür tutarken sahiplenme/devretme akışını tamamlamak; firma
ve kaynaktan ayrılmadan aksiyon almak; dar, tekrar kullanılabilir açılış/yenileme görev
paketleri. Yeni bir genel proje yönetimi modülü açmak gerekmiyor. Scoro'nun şirket
kaydından bağlı aktiviteye geçişi bu yönü destekliyor.
[Scoro Contact list](https://support.scoro.com/hc/en-us/articles/12405025577101-Contact-list)

### Evrak ve saha kontrolü — dosya deposundan takip zincirine

Firma/sözleşme bağlı belge, geçerlilik tarihi ve hatırlatma kodda var. Geliştirme yönü:
yenileme sorumlusu, eski–yeni belge ilişkisi, bekleyen yenileme işi ve tamamlanma izi.
[BPS evrak servisi](../src/lib/services/documents.ts)

Mitti (by SafetyCulture) belgesinde son geçerlilik uyarıları dosya sahibine gidiyor;
sahibi yoksa kimse bildirim almıyor. Bu örnek BPS için sahipsiz iş kontrolünü güçlendirme
gerekçesi; mevcut BPS mailinin aynı davranışı gösterdiği iddiası değil.
[Mitti dosya geçerliliği](https://help.mitti.com/005854)

Saha denetimi gerçek ihtiyaç olduğunda ziyaret sonucu → düzeltme görevi bağlantısı
mevcut modüllerle kurulabilir. SafetyCulture eğitim materyalinde bulgudan aksiyon üretimi
var. Form tasarımcısı, GPS, offline senkronizasyon ve puanlama motoru otomatik kapsam değil.
[SafetyCulture eğitim rehberi, Kasım 2024](https://assets.ctfassets.net/wum34wy9buzj/2JsRvVzB5bv6GZtCWiy8eg/757d2dd0eac8e678b30a34c77cf0fa00/SafetyCulture_Frontline_User_Training_Guide__Two_Page____Nov_24_-Generic_Version-_.pdf)

### Bildirimler, duyurular ve geçmiş — birbirinden ayrı üç kabiliyet

Dört e-posta türü kodda var: sözleşme bitişi, geciken görev, evrak bitişi, randevu
hatırlatması. Duyuru oluşturma/listeleme de mevcut. Firma timeline, bahsetme/yönlendirme
ve Dashboard aktivite akışı ise incelenen ekranlarda placeholder. Ayarlar'daki bildirim
kuralları düzenleme ekranı da aktif bir kural motoru değil.
[Bildirimler](../src/lib/notification-kinds.ts),
[duyurular](../src/lib/services/announcements.ts),
[Firma Detay](../src/app/(main)/firmalar/[id]/page.tsx),
[Ayarlar](../src/app/(main)/ayarlar/page.tsx)

Öneri: yeni chat yerine görev atandı/değişti/tamamlandı, talep değişti, evrak yenilendi
gibi sınırlı olay geçmişi. Uygulama içi bildirim daha sonra bu olaylardan beslensin;
gönderildi, okundu ve iş tamamlandı ayrı kalsın. Audit kaydı ise operasyon timeline'ından
ayrı amaç taşır: kim hangi hassas işlemi yaptı? WorkOS bu ayrımı action/actor/targets ve
organizasyon kapsamıyla somutlaştırıyor.
[WorkOS Audit Logs](https://workos.com/docs/audit-logs)

### Finansal özet ve raporlama — sınır doğru, metrik disiplini gerekli

Luca/mizan import yüzeyi, finansal özet ve PDF çıktısı kodda mevcut. Yeni muhasebe ürünü
önerilmiyor. Şirket bakiyesi, sözleşme bedeli, planlanan personel hacmi ve gerçekleşen
kâr farklı ölçülerdir; biri diğerinden doğrudan türetilmemeli.
[Finansal Özet](../src/app/(main)/finansal-ozet/page.tsx),
[Luca Import](../src/app/(main)/luca-import/page.tsx)

Scoro planlanan maliyet, gerçekleşen maliyet ve kârlılık raporlarını ayırıyor. Bizim
alacağımız ders yeni grafik sayısı değil; her metrikte kaynak, dönem, son güncelleme ve
plan/gerçekleşme ayrımı. Fiilî maliyet ve gerçekleşme verisi olmadan "gerçek kâr" demeyelim.
[Scoro Reports library](https://support.scoro.com/hc/en-us/articles/16489101116045-Reports-library)

İlk yeni operasyon raporları: gün bazında açık kişi, karşılanan kişi-gün, değiştirilen
atamalar ve yaklaşan sorumlusuz işler. Karşılanan burada **planla karşılanan** demektir;
hizmet teyidi yoksa gerçekleşen hizmet değildir. Yeni Dashboard kartı yığını yerine
mevcut sinyallerden ayrıntıya geçiş tercih edilmeli.

## 4. Diğer SaaS özellikleri: yönetim paneli ile satılabilir hizmet aynı değil

Platform admin kodunda tenant oluşturma, kullanıcıları listeleme, rol/üyelik atama var.
Bu ilerlemeyi yok saymıyoruz. Fakat bunun varlığı tam müşteri onboarding/offboarding,
abonelik veya kurumsal denetim kabiliyetinin tamamlandığı anlamına gelmez.
[BPS Platform Admin](../src/lib/services/platform-admin.ts),
[Admin işlemleri](../src/app/admin/actions.ts)

| Kabiliyet | BPS kanıt düzeyi | Önerilen en küçük sonraki adım |
|---|---|---|
| Tenant ve rol yönetimi | Kodda mevcut | Kimlikli smoke; tenant yöneticisi ve platform yöneticisi görevlerini ayır |
| Kullanıcı daveti ve ayrılışı | İncelenen uygulamada uçtan uca akış bulunmadı | Davet kabul/iptal; ayrılanın açık işlerini devir; yetki kaldırma doğrulaması |
| İlk müşteri kurulumu | Parçalar var, birleşik akış kanıtlanmadı | Firma/şube aktar → kullanıcıları yerleştir → ilk talep → ilk çıktı |
| Paket/modül yetkisi | İncelenen uygulamada entitlement akışı bulunmadı | Önce elle yönetilebilen tenant modül hakları; ödeme sistemi sonra |
| SaaS tahsilatı | Abonelik yönetimi kodu bulunmadı | Satış modeline göre manuel veya otomatik ödeme; BPS içindeki müşteri alacağından ayrı |
| Audit ve veri dışa aktarma | Genel yönetilebilir audit/export akışı kanıtlanmadı | Hassas işlem kaydı; müşterinin kendi verisini alabileceği tanımlı yol |
| Yedek/geri yükleme, MFA, destek erişimi | Bu araştırmada altyapı düzeyinde ölçülmedi | Varlığını/yokluğunu varsaymadan ayrı operasyon hazırlık kontrolü |
| Sağlık kontrolü | healthz ve cron kodu var | Sadece endpoint değil; başarısız işin fark edilmesi ve yeniden yürütülmesi |

Bu tablo uygulama dosyalarının incelemesine dayanır; yönetilen altyapıdaki ayarlar için
"yok" sonucu çıkarmaz. Dosya adı/anahtar kelime taraması tek başına canlı sistem yokluk
kanıtı sayılmadı.

Clerk'teki davet oluşturma/kabul/iptal akışı üyelik yaşam döngüsüne örnektir.
WorkOS Admin Portal SSO ve Directory Sync kurulumunu müşteri IT yöneticisine açar;
BPS'in bugünkü ihtiyacı hemen SSO satın almak değil, destek gerektiren kurulum adımlarını
ölçmektir. Kurumsal talep doğarsa bu katman eklenebilir.
[Clerk davetleri](https://clerk.com/docs/guides/organizations/add-members/invitations),
[WorkOS Admin Portal](https://workos.com/docs/admin-portal)

Stripe Entitlements ödeme ürünleri ile özellik haklarını ayıran referanstır. BPS için
ürün kuralı: bir özelliği kullanma hakkı **tenant paketi ∩ kullanıcı rolü ∩ kayıt kapsamı**
ile değerlendirilir. Paket açmak rol yetkisini genişletmez. Türkiye'de Stripe hesabı
açma/tahsilat uygunluğu bu çalışmada araştırılmadı; bu bir sağlayıcı seçimi önerisi değil.
[Stripe Entitlements](https://docs.stripe.com/billing/entitlements)

## 5. Paketleme yönü ve ürün sınırı

Fiyatlandırma değil, değer paketleme hipotezi:

1. **Çekirdek operasyon:** firmalar, sözleşmeler, görev/randevu, evrak, temel bildirim.
2. **Çok lokasyonlu personel hizmeti:** şube rehberi, talep, yerleştirme, haftalık çıktı.
3. **Sonraki saha paketi:** ziyaret bulgusu ve hizmet teyidi; müşteri ihtiyacı kanıtlanınca.

Finansal görünürlük bu akışları destekler. Güvenlik ve tenant izolasyonu üst pakete
bırakılacak özellik değildir. Modül sayısı tek başına satış argümanı olmamalı.

Başlangıç müşterisi önerisi: çok lokasyonlu müşterilere personel hizmeti veren ve
planını Excel/WhatsApp ile yürüten ekip. BPS'in bu hedefte farklılaşma hipotezi, Türkçe
iş akışı ve firma/sözleşme/evrak bağlamından ayrılmadan günlük ihtiyacı kapatmaktır.
"Rakiplerde yok" veya "pazar boş" sonucu çıkarılmadı; benzersizlik araştırması yapılmadı.

İlk kapsam dışında: bordro/özlük/izin, genel satış CRM'i, sohbet uygulaması, tam CLM,
proje ERP'si, otomatik personel optimizasyonu, kapsamlı form/workflow tasarımcısı.
Rakibin bunlara sahip olması BPS'in aynı anda yapmasını gerektirmez.

## 6. Uygulama sırası yerine geçmeyen öncelik önerisi

| Öncelik | İş paketi | Başarı kanıtı |
|---|---|---|
| Şimdi | Şube import + günlük talep/atama + müşteri çıktısı | Aynı dosya tekrarında mükerrer yok; çakışma/fazla atama yok; haftalık liste yeniden Excel'de kurulmadan kullanılabiliyor |
| Aynı teslimatta | Sorumlu, değişiklik geçmişi, tenant sınırı | Son değişikliği kimin yaptığı görülebiliyor; farklı tenant verisi açılmıyor; eski kayıtlar kaybolmuyor |
| Ardından | Sözleşme/belge aksiyon tarihleri ve devir | Yaklaşan iş gerçek sorumluda; kişi ayrılınca iş sahipsiz kalmıyor |
| Yeni müşteriye açmadan | Onboarding, davet/devir, veri çıkışı, modül hakları | Kurulumun gizli SQL adımı olmadan işletilebilmesi; müşteri verisinin geri alınabilmesi |
| Kullanım sonrası | Hizmet teyidi, dar görev şablonları, müşteri görünümü | Sahadan belgelenmiş tekrar işin azalması |
| Talep halinde | SSO/SCIM, otomatik tahsilat, ileri entegrasyon | Gerçek müşteri gereksinimi ve maliyet gerekçesi |

Bu sıra mevcut migration veya smoke sırasını değiştirmez. Yürütme için kapsam, rol,
durum ve iş akışı belgelerinin ilgili değişiklikleri ayrıca kabul edilmeli.

## 7. Doğru yolda olduğumuzu nasıl ölçeceğiz?

Önerilen pilot: bir haftalık banka verisi ve otelden temsili kısa bir dönem; önce
mevcut işlem süresini ölç, aynı işi BPS akışıyla karşılaştır. Bu çalışma henüz yapılmadı.

- İlk kullanılabilir müşteri listesine ulaşma süresi.
- Talep başına giriş ve atama süresi; kopyalama/düzeltme dahil.
- Haftalık çıktıyı Excel'de yeniden kurmak gerekip gerekmediği.
- Açıkların görünür kalması; atanmamış talebin listeden kaybolmaması.
- Tek gün personel değişiminin diğer günlere yanlış etkisi olup olmadığı.
- Sahipsiz takip işi ve başarısız aktarımın fark edilme biçimi.
- Operasyonun takip eden hafta yeniden kullanması ve müşterinin çıktıyı kabul etmesi.
- İkinci bağımsız hizmet firmasının aynı akışı özel kod istemeden kullanabilmesi.

Bu ölçüler ürün doğrulamasıdır; sayısal tasarruf, ödeme isteği ve pazar uyumu için
henüz sonuç yoktur. En büyük açık ürün kararı hâlâ otel talebinin işe yerleştirme mi,
günlük hizmet taahhüdü mü olduğudur. Diğer iki saha teyidi: aynı gün iki lokasyon var mı;
bankaya açıklar dahil plan mı, yalnız atanmış personel listesi mi gönderiliyor?

## Kaynak ve yöntem notları

Kaynaklara erişim: **8 Eylül 2026**. Tarih görünmeyen sayfalara yayın tarihi atanmadı.
Deputy Shift status: 16 Temmuz 2026; Clerk invitations: 4 Eylül 2026; Mitti expiration:
doğrudan açılışta 6 Eylül 2026. Timegate ayrıntılı rehberi Eylül 2021; SafetyCulture
eğitim belgesi Kasım 2024. Eski kılavuzlar tasarım örneği, güncel arayüz garantisi değil.

SafetyCulture dosya geçerliliği URL'si doğrudan açıldığında Mitti (by SafetyCulture)
alanına yönlendi; belge özellikleri bu nedenle Mitti adıyla yazıldı. Quinyx bazı yardım
sayfalarında redirect-loop oluştu; açılabilen resmî API ve önceki doğrulanmış ürün
kaynakları kullanıldı. WorkOS/Clerk/Stripe rakip uygulama değil, SaaS davranış referanslarıdır.

Araştırma: önce BPS güncel modül/servis envanteri ve önceki taslak; sonra iki bağımsız
rakip iş akışı araştırması ve SaaS kaynakları; son olarak önemli iddiaların resmî
sayfalardan tekrar kontrolü. Kaynaklar ürün davranışları ve BPS boşlukları için yeterli
kanıta ulaştığında geniş arama durduruldu. Fiyat, hukuki uygunluk, rakip performans
testleri ve canlı BPS doğrulaması kapsam dışında açık bırakıldı.

**Teslim sınırı:** yalnız bu araştırma notu oluşturuldu. Ürün kodu, SQL, rol matrisi,
durum sözlüğü ve kabul edilmiş yol haritası değiştirilmedi; push/deploy yapılmadı.
