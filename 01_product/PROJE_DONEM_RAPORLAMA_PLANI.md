# Dışarıda yürütülen projelerin BPS raporlaması

28 Eylül 2026. Durum: uygulama planı ve ilk yerel önizleme kontrolü. Canlıya çıkmadı.

## Ürün kararı

Kullanıcının yönü: projeler dışarıda yürütülür; BPS proje sonuçlarını toplar, doğrular ve raporlar. Operasyonun aynı bilgiyi hem sahada hem BPS'de girmesi zorunlu olmayacak. Mevcut işe başlama/atama akışları kullanılabilir; atama veya müşteriye personel iletimi gerçekleşmiş çalışma sayılmaz.

Mek ve Partner ayrı tenant kalır. Hiyerarşi: müşteri → proje → hizmet verilen şubeler; raporlar proje ve aylık dönem üzerinden açılır. Sözleşme isteğe bağlı bağlantıdır; her sözleşme veya şubeden otomatik proje oluşturulmaz. Bu hiyerarşi uygulama varsayımıdır; gerçek pilotla doğrulanacaktır.

## Mevcut koddan doğrulananlar

- `src/lib/operations/location-import-preview.ts`: şube kodu ile yeni/aynı/değişen/pasif ayrımı ve tam sayfalama kontrolü yeniden kullanılabilir.
- `src/lib/talent/import-compare.ts`: kişi aktarımında karşılaştırma örüntüsü var. Çalışma dosyası yüklenince kişiyi otomatik müsait havuza döndürmek doğru değil.
- `supabase/migrations/20260915000900_work_approval.sql`: `ops_work_records` atama kimliğine bağlı. Dış çalışma satırını kaydetmek için hayali BPS ataması üretmeyeceğiz.
- `supabase/migrations/20260924000400_idp_period.sql`: İDP izin/görevlendirme dönemi; aylık raporlama dönemi değildir. İki kavram birleştirilmeyecek.
- `src/lib/luca/mizan-parser.ts`: mevcut cari/mizan akışı proje gelir ve personel maliyeti kaynağı sayılmaz.

Bu inceleme kaynak koda dayanır; bu tur canlı şema sorgulanmadı.

## Kullanıcı akışı

1. Projeler: müşteri, proje adı, sorumlu, son rapor dönemi, son aktarım ve eksik veri durumu.
2. Proje detayı: Özet / Çalışmalar / Finans / Dosyalar. Finans kaynağı yoksa hesaplanmış kâr gösterilmez.
3. Rapor yükle: proje, dönem, kaynak seç → dosya ve sütunlar → önizleme → sorunları çöz → onayla.
4. Önizleme: Yeni / Değişen / Aynı / Kontrol gereken. Satırda önceki ve yeni değer görünür. Henüz eşlenmemiş şube/kişi ayrı sorun olarak gösterilir.
5. Tam ay dosyası ile ek kayıt dosyası açık ayrılır. İlk sürüm ikisinde de eksik satırı silmez; tam dosyada eksilenleri düzeltme incelemesine taşır.
6. Mobil: rapor özeti ve sorun incelemesi; geniş sütun eşleme ve toplu düzeltme masaüstüne uygun kalır.

## Verinin anlamı

- DEVAM: göreve devam. HAVUZ: görev bitmiş, yeni göreve uygun. OK: talep karşılandı ve bilgi müşteriye e-posta ile iletildi. Hiçbiri çalışma/ücret onayı değildir.
- Kaynak kişi ve şube kodları metin olarak korunur; baştaki sıfırlar atılmaz. İsimle sessiz eşleme yapılmaz.
- Satır kimliği dosyadaki satır numarası değildir. Kaynak sabit kimlik vermiyorsa şube+kişi+gün+vardiya anahtarı açık kuralla üretilir; aynı gün birden çok vardiya ayrılır.
- İlk normalize edilmiş satır sözleşmesi: kaynak satır kimliği, şube kodu, kişi kodu, gün, vardiya kodu, dakika. Gerçek dosya saat içermiyorsa gün birimini ayrıca tasarlamak gerekir; gün keyfî biçimde 8 saate çevrilmez.
- Belirtilmeyen süre sıfır değildir. Sıfır açık kaynak değeridir; nedeninin UI/iş kuralında ayrıca açıklanması gerekir.
- Proje gelir/gideri tahsilat/ödemeden ayrılır. Bordro ile Luca aynı personel maliyetini iki kez yazmaz. Para birimleri topluca toplanmaz.

## Uygulama paketleri ve kabul kapıları

### A — Proje ve rapor dönemi

Yeni proje tablosu, proje-şube bağı, aylık dönem ve dış kod eşlemeleri. Mevcut firma/şube/kişi kayıtları kullanılır. Tenant içeren bileşik FK'lar ve tenant kapsamlı benzersizlik; aynı şubenin proje bağlantıları tarih aralığıyla ele alınır. Üyelik/rol kontrolü sunucuda; finans okuma operasyon yetkisinden ayrı.

Kabul: Mek kullanıcısı Partner projesini okuyamaz/yazamaz; başka müşterinin şubesi yanlış projeye eklenemez; aynı proje kodu aynı tenant'ta çoğalmaz. Kapalı döneme yazı engellenir.

### B — Dosya önizleme ve atomik onay

Private Storage dosyası → aktarım başlığı/staging → kaynak kod eşlemeleri → onaylı dış çalışma kayıtları. Dosya hash'i tekrar uyarısıdır, tek iş kimliği değildir. Kaynak/dönem kapsamı, komut kimliği ve payload uyuşması sunucuda doğrulanır. Onay transaction içinde dönem kilidi ve beklenen revision kontrolüyle yapılır. Önizleme sonucu yetki veya kesin eşleşme garantisi değildir.

Kısmi onay desteklenecekse aktarım açıkça kısmi görünür; sorunlu satırlar başarıya dönüştürülmez. Çalışma düzeltmeleri önceki sürümü ve onaylayanı korur. Silme/iptal ayrı açık işlem olur. Dönem kapatma ve yeniden açma gerekçeli ve kayıtlıdır.

Kabul: ilk dosya, aynı dosya, sırası değişmiş dosya, süre düzeltmesi, eksilen satır, değişen kişi kimliği, iki eşzamanlı onay, ağ kesilmesi sonrası yeniden deneme, bozuk/kısmi okuma. Dosya okuma boyut/kodlama sınırları mevcut import altyapısından taşınır.

### C — Gerçekleşme raporu

Şube/personel/gün kırılımı; onaylanan toplamdan kaynak dosya ve satıra kadar izlenebilirlik. BPS iç çalışma onayıyla aynı iş dışarıdan geldiyse iki kez sayılmaz; açık kaynak eşlemesi gerekir. Eksik kaynak ve onay bekleyen satırlar görünür. Tüm kayıtlar tarayıcıya çekilmez; sunucu toplamları ve sayfalama kullanılır.

### D — Luca ve proje finansı

Gerçek detay dökümü görülmeden kolonlar veya masraf merkezi eşlemesi uydurulmaz. Gelir, personel maliyeti, diğer gider, ortak gider ve para birimi mutabakatı; eşleşmeyen tutar listesi. Eksik maliyet varken kesin kâr gösterilmez. İlk pilot: bir Mek İDP projesi/bir ay ve düzeltme dosyası; sonra Partner vardiyalı örnek.

## Bu tur tamamlanan

`src/lib/project-reporting/actual-preview.ts`: normalize edilmiş satırlar için saf karşılaştırma; kapsam ve tam snapshot kontrolü; gerçek tarih/süre doğrulama; yeni/aynı/değişen/inceleme ayrımı; kaynak kimliği ve iş anahtarıyla mükerrer kontrolü; eksilen satırları silmeden listeleme. Veri erişimi, yetkilendirme, şube/kişi eşleme, Excel okuma veya onay RPC'si değildir.

`scripts/project-actual-preview.test.mjs`: 6 test geçti. Modül bağımsız strict TypeScript kontrolü geçti. Ekran, migration, Supabase uygulaması, deploy ve gerçek dosya kabulü yapılmadı. Yayın kaynağı `qa/latest-release.json` değişmedi.

Bir sonraki somut paket A: proje/dönem veritabanı ve gerçek veriyle çalışan liste/detay. B için gerçek örnek dosyada sabit satır kimliği ve süre/gün biriminin doğrulanması gerekir.


## İkinci tur — veritabanı temeli (yerel)

`supabase/planned/project-reporting/01_foundation.sql` hazırlandı. Henüz migration defterine veya canlıya alınmadı.

- Proje, tarih aralıklı proje-şube bağı, aylık rapor dönemi ve tekrar deneme komut kayıtları.
- Şube aynı müşteriye ve tenant'a ait olmak zorunda; composite FK bunu korur. Aynı proje/şube için kesişen tarih aralıkları RPC tarafından reddedilir.
- Proje oluşturma, şube bağlama, dönem açma tek execute RPC'sinde. Yazı yetkisi yönetici/operasyon; aynı tenant'ın doğrulanmış rolü okur. Doğrudan tablo erişimi authenticated/anon için kapalı, RLS açık.
- Aynı commandId+payload aynı sonucu döndürür; payload değişirse hata verir. Revision kontrolü eski ekranın üstüne yazmasını engeller. İlk sürümde kısa tenant kilidi yazıları sıraya alır; 5 saniye kilit zaman aşımı vardır.
- Liste ve detay RPC'leri 50 satırlık sayfalama yapar. Detayda şubeler ve dönemler bağımsız sayfalanır.
- `scripts/project-foundation.test.mjs`: yalnız işaretli sentetik Docker veritabanında migration ve senaryolar tek transaction içinde çalışır; sonunda ROLLBACK. Kalıcı yerel veya canlı veri değişmedi.

Kabul: oluşturma/tekrar, komut payload uyuşmazlığı, yinelenen kod/dönem, eski revision, kesişen şube aralığı, yabancı müşteri/tenant, doğrudan tablo ve anonim erişim, IK yazı reddi, detay sayfalama. Önizleme testleriyle toplam 7 test geçti.

Sınırlar: test tabanındaki auth helper'ları kullanıldı; güncel canlı çoklu çalışma alanı Auth/HTTP kabulü henüz yapılmadı. Eşzamanlı iki bağlantı testi henüz yok. UI/servis bağlantısı, sorumlu seçimi, düzenleme/arşivleme, şube bağlantısı değiştirme, dönem kapatma/yeniden açma ve import onayı bu dosyada yok. Dönem status alanının varlığı kapatma akışının hazır olduğu anlamına gelmez. Proje detail ekranı ve güncel auth kabulü tamamlanmadan prod uygulanmayacak.


## Üçüncü tur — gerçek yerel UI ve HTTP kabulü

/projeler ve /projeler/[id] ekranları, müşteri/şube arama, proje oluşturma, şube bağlama ve dönem açma bağlandı. İzole aday son canlı manifest üzerine kuruldu. Ana menü bağlantısı adayda var. Bilinmeyen işlem sonucu aynı komutla yeniden denenir; kesin SQL reddinde alanlar düzenlenebilir; başarı mesajı korunur.

10 test ve production build geçti. Güncel çoklu workspace yerel Auth/REST oturumuyla Mek oluşturma/şube/dönem akışı CUA üzerinden ölçüldü; Partner oturumundan Mek detayına erişilemedi ve Partner listesi boş kaldı. 320px mobil görünüm taşmasız. Kanıt: qa/project-reporting-ui-20260928/README.md. Bu, önceki turdaki HTTP kabul eksikliğinin bu iki operasyon oturumu için kapanmasıdır; tüm rol matrisi/eşzamanlı bağlantı kabulü hâlâ açık.

Henüz canlıya alınmadı. Sonraki paket: proje düzenleme ve hata düzeltme akışları, dönem yaşam döngüsü ve ardından dış dosya staging/onay bağlantısı. Gerçek dosya semantiği doğrulanmadan gün/saat dönüşümü veya Luca kârlılığı üretilmeyecek.


## Dördüncü tur — düzeltme ve dönem yaşam döngüsü

Proje adı/türü ve şube tarihleri gerekçeyle düzenleniyor. Yönetici dönem kapatıyor/açıyor; kapalı ayla kesişen şube bağları değiştirilemiyor. Olaylar aktör/gerekçe/zaman/revision ile tutuluyor, son gerekçe UI'da. Başlangıç revision'ı formda sabit; eşzamanlı güncellemenin üstüne sessiz yazı yok.

10 test + production build; gerçek yerel yönetici oturumu ile kapat→reddet→aç→düzelt tarayıcı kabulü; 320px görünüm; iki bağımsız DB bağlantısında biri başarılı/biri revision conflict ve tekrar güvenliği geçti. Kanıt: qa/project-lifecycle-20260928/README.md. Kaynak ve SQL hash'li arşivlendi. Prod SQL/push/deploy yok.

Sıradaki büyük parça dış çalışma staging/onay. Dönem kilidi bu yeni yazılara da uygulanmalı ve onay bekleyen aktarım varken kapanma engellenmeli. Bugünkü kapatma ücret/çalışma onayı değildir. Arşivleme, sorumlu seçimi ve tam olay geçmişi UI ayrıca açık.


## Beşinci tur — dış çalışma aktarımı çekirdeği

source-rows.ts: açık kolon ve dakika/saat birimi, UTF-8 CSV doğrulama. 02_actual_import.sql: açık personel kod eşlemesi, staging, atomik onay/iptal, düzeltme geçmişi, tekrar güvenliği. Bekleyen aktarım kapanmayı engeller; onaylı çalışma şube tarih kapsamı dışına çıkarılamaz. Havuz müsaitliği/ücret otomatik değişmez.

15 temel/SQL/normalizasyon testi, ayrıca izole aday üzerinde örtüşen 7 CSV/normalizasyon testi ve tam TypeScript geçti. SQL transaction+rollback; prod/kalıcı yerel şema/push/deploy yok. Kanıt qa/project-import-core-20260928/README.md. UI bağlantısı, yanlış kişi kod eşlemesini düzeltme, XLSX worker ve private kaynak dosyası saklama açık. 1.000 satırlık all-or-nothing ilk paket; tam dosya kaynakta olmayanı silmez. Bu modül henüz kullanıma açık sayılmaz.


## Altıncı tur — CSV aktarım ekranı ve yerel kabul

Proje raporu CSV akışı tamamlandı: ay/sütun/birim seçimi → mevcut kişi eşlemesi → fark önizleme → onay/iptal; bekleyen aktarımı yeniden açma. 17 test ve izole production build geçti. Yerel Auth/REST tarayıcı kabulünde 480→420 düzeltmesi tek satırda korundu; aynı dosyayı iptal etmek kayıt değiştirmedi. 320px mobil kontrol geçti. Kanıt: qa/project-import-ui-20260928/README.md. Henüz canlıya alınmadı. XLSX, private kaynak dosyası saklama, aylık rapor ekranı, gerçek dosya/Luca pilotu açık.


## Yedinci tur — aylık proje/şube çalışma raporu

Onaylı çalışma satırlarından aylık süre, benzersiz personel, şube ve kayıt toplamları; şube başına kişi/gün/süre dağılımı eklendi. Bekleyen aktarım ayrı gösteriliyor. Kayıtsız dönem boş durum, olmayan dönem hata. Aylık indeks ve tek snapshot RPC var. 19 test ve izole production build geçti. Yeni rapor ekranının tarayıcı kabulü henüz yapılmadı; yayımlanmadı. Kanıt: qa/project-monthly-report-20260928/README.md. XLSX, kaynak dosyası saklama, kişi/gün detayı ve gerçek dosya/Luca pilotu açık.


## Sekizinci tur — XLSX, kaynak dosyası, detay ve canlı yayın

XLSX/CSV sayfa-başlık seçimi, Excel tarihi ve kod koruma; private kaynak dosyası saklama; aylık rapordan şube/kişi/gün detayı tamamlandı. 27 test ve local/cloud production build geçti. Sentetik tarayıcıda CSV 480→XLSX 420 düzeltmesi, iki kaynak dosyası, tek çalışma satırı; 320px rapor/detail ve tenant ayrımı kabul edildi. Okuma rolleri yönetici/operasyon/İK/muhasebe ile sınırlandı, dış partner ve görüntüleyici SQL ret testleri eklendi.
Supabase 20260928000100–20260928000500 APPLIED ve defter doğrulandı. Vercel dpl_8aan5KvdhnaF5gpPoMk26YnMMsS7 canlı bpsys.net'e bağlı. Sağlık 200, anonymous RPC 401, korunan rotalar login 307; private bucket ayarları ölçüldü. Kanıt: qa/project-completion-20260928/README.md. Yeni canlı manifest qa/latest-release.json içinde.
Açık veri bağımlılıkları: gerçek aylık çalışma dosyası pilotu, gün→saat kuralı (gerekirse), Luca proje/masraf merkezi ve bordro/masraf hesap eşlemesi. Bunlar mevcut HAVUZ/DEVAM/OK bilgisinden türetilmedi. Kaynak dosyası isteğe bağlı; orphan Storage otomatik temizliği ve kapsamlı yük testi henüz yok.
