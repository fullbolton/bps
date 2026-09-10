# BPS — Yeni çalışma alanı tasarımı

2026-09-10: Kullanıcı tüm UI/UX düzenini değiştirme yetkisi verdi. Görsel değişiklikler çalışan veri ve yetki akışları üzerinde uygulanır.

## Tasarım yönü

Koyu lacivert gezinme, açık gri çalışma yüzeyi, beyaz kartlar ve mavi aksiyonlar. Durum renkleri anlamını korur: yeşil tamamlandı, amber dikkat, kırmızı hata. Süs amaçlı grafik/sayı yok. Mobilde başlık ve aksiyonlar alt alta; tablolar kendi alanlarında yatay kayar.

## 055 kapsamı

- Menü: Çalışma Alanı / Müşteri ve Hizmet / Yönetim. Mevcut rol görünürlüğü korunur. Genel Bakış adı; aktif sayfa aria-current. Mobil native dialog ve Escape.
- Üst bar: bulunulan modül, bildirimler, kullanıcı ve geniş ekranda saat. Ana içeriğe klavye atlama bağlantısı.
- Ortak sayfa başlıkları, 44 px ana butonlar, 16 px kart köşeleri, KPI hiyerarşisi, okunabilir ikincil metin ve filtre etiketleri.
- Dashboard: gerçek ve role/feature flag'e bağlı hızlı erişimler; KPI; günlük operasyon; takip masası; duyurular ve son aktiviteler. Aktif olmayan Yönetici İnisiyatifleri kaldırıldı. Tarihe göre filtrelenmeyen görev kartının başlığı Bekleyen Görevler oldu.
- Klavye odak göstergeleri ve azaltılmış hareket tercihi.

Bu tur yeni SQL, veri taşıma veya yetki modeli değişikliği içermez. Ortak bileşenleri kullanan sayfalar yeni temeli alır; her modülün iç iş akışını baştan tasarladık iddiası yok.

## Sonraki tasarım blokları

1. Firma ve sözleşme detayları: ilk düzen 056 ile uygulandı; kalan form/alt sekme ayrıntıları izlenecek.
2. Günlük plan ve işe başlama: yoğun masa görünümü ile mobil saha kullanımının ayrılması.
3. Form ve paneller: alan gruplama, hata konumu, klavye/odak yönetimi.
4. Finans ve proje özeti: dönem, veri kaynağı, gelir/maliyet ayrımının aynı hiyerarşide sunulması.

## Kabul

Yerel TypeScript ve izole production build geçti. Dashboard, Firmalar, Görevler, Randevular, Sözleşmeler, Finansal Özet: 1280 px ve 390 px taşma kontrolü, mobil menü/Escape ve firma oluşturma regresyonu geçti. Ekranlar yönetici rolü yüklendikten sonra ölçüldü. Kanıt: `/private/tmp/bps-company-feedback-dBwxnN`. Dashboard ve mobil Firmalar ekranları görsel olarak incelendi. Kritik tarihler/duyurular dedicated fixture eksikliği nedeniyle hata gösteriyor; bunların başarılı veri okuması bu testin kanıtı değildir. Sentetik şirketler ve test hesabı temizlendi. Üretime yayımlanmadı.

## 056 — Firma ve sözleşme detay düzeni

Firma sayfasındaki işlevsiz Zaman Çizgisi sekmesi, Son Bahsetmeler ve Bekleyen Yönlendirmeler kutuları kaldırıldı. İletişim ürün planı korunur.

Firma başlığı: firma çalışma alanı etiketi, durum/sektör/şehir, uzun adın satıra kırılması ve mobilde alt satıra geçen işlem grubu. Günlük personel planına görünür buton. Ortak bölüm gezintisi yatay kaydırılır; seçili bölüm `aria-pressed` ile duyurulur, normal klavye Tab/Enter davranışı korunur. ARIA tab widget iddiası yok.

Sözleşme başlığı: dönem / bitişe kalan süre / sorumlu notu / tutar ayrı tanım alanları. Geçmiş bitiş tarihi eksi gün yerine “gün önce doldu” olarak gösterilir. PDF/ekler tam genişlikte; maddeler/yenileme/bağlı işler geniş ekranda iki sütuna ayrılır. Bölüm bağlantıları gerçek hash/anchor kullanır; sabit üst bara scroll payı bırakılır. Durum seçicinin erişilebilir adı ve dokunma alanı eklendi.

Sözleşme firma bağlantısında legacy id olmayan kayıt artık `#` yerine gerçek `company_id` ile açılır. Veri yazma, izinler ve SQL değişmedi. Detay sayfasındaki diğer veri okuma hataları bu tasarım bloğuyla çözülmüş sayılmaz.

Kabul: TypeScript ve diff kontrolü geçti. Sentetik firma/sözleşmeyle 1280/390 px uzun başlık, sekme seçimi, yenileme hash bağlantısı, UUID firmaya dönüş ve sayfa taşması kontrolü geçti. Firma oluşturma/inline mevcut seçimi/hata/bekleme regresyonu da geçti. Kanıt: `/private/tmp/bps-company-feedback-OtPkYj`. Test şirketleri, bağlı sözleşme ve Auth hesabı temizlendi. Test veri modeli sınırlı: not tablosu olmayan fixture içindeki hata veya henüz yüklenen alt paneller, bütün detay veri akışlarının başarılı kabulü sayılmaz. Mobil/masaüstü başlık ve düzen görsel olarak incelendi. Üretim yayını yapılmadı.

## 057 — Günlük plan ve işe başlama takibi

Günlük plan: kaydırılabilir operasyon gezinmesi, firma/gün filtre kutusu, seçili firma ve günün aktif taleplerinden türeyen dört özet (talep, istenen, atanan, açık). Yükleme sırasında özet gösterilmez. Şube/personel hazırlığı açılır alana taşındı; talep formu ve atamalar görünür kaldı. Ana butonlar 44 px, kartlar ve personel satırları ortak tasarıma uyar. Firma varken seçim yoksa “firma seçin” denir.

İşe başlama: ortak sayfa başlığı, filtre alanı, gün toplamı/filtre toplamı/bu sayfa ayrımı. Bu sayfa sayısı tüm günün aksiyon sayısı gibi sunulmaz. Personel kartında metinli durum rozeti, arama adımları, belirgin bağımsız teyit butonu ve ayrı geçmiş alanı. Kayıtlı görüşme mavi; teyitli işe başlama yeşil. Personelin “şubedeyim” beyanı teyit yerine geçmez. Yetki, revision, komut uzlaştırması, sorumlu kilidi ve zaman kuralları değişmedi.

Kabul: günlük talep, başlangıç durumu ve gönderim hatası testleri 18/18 geçti; TypeScript geçti. Yerel banka/otel tarayıcı kabulüne yeni günlük özet, 1440/390 px taşma, başlangıç planı/görüşme kaydı/reload ve aksiyon filtresi eklendi. İlk koşu yeni yedek atama teyidinde START_TIME aldı; fixture zamanları DB clock_timestamp kaynağına taşındı (ürün kontrolü gevşetilmedi). Nihai kabul: 15 grup geçti. Gerçek UI üzerinden başlangıç planı ve yolda görüşmesi kaydedildi, reload sonrası korundu; teyit sayılmadı. Teyitli kayıt aksiyon filtresinde görünmedi. Günlük özet, 1440/390 px taşma, talep açma/atama/gelmedi/yedek ve CSV regresyonları geçti. Kanıt: `/private/tmp/bps-sector-pilot-tkkQ8B`. Masaüstü günlük plan ve mobil işe başlama görselleri incelendi. Kendi sentetik kayıtları ve Auth hesabı temizlendi. Ürün SQL veya üretim yayını yok.

## 058 — Finans ve ortak pencere/panel düzeni

Finans: kayıtlı son özetin sınırı görünür; gerçek dönem verisi olmadığı için dönem seçici eklenmedi. Alacak/faturalama ve maliyetler ayrı gruplar. Yinelenen toplam alacak üst kartı kaldırıldı, aktif firma sayısı korunur. Gelişmiş özet hâlâ firma alacağı ve proje kırılımının mevcut sınırını gösterir; yeni muhasebe hesabı yok.

ModalShell / RightSidePanel: native dialog top layer, arka planın inert olması, üst pencereye Escape, tanımlı erişilebilir başlık/kapatma butonu, büyük dokunma alanı, kaydırılabilir içerik ve iç içe açılışta gövde kaydırma kilidi. Kapatma kararı hâlâ çağıranın onClose handler'ına aittir; bekleyen kaydın kapanma engeli korunur. Tab/Shift+Tab uçları açıkça sarılır. Bağlı alan hâlâ DOM'daysa kapanışta odak geri döner.

Tarayıcı kabulü genişletildi: gerçek yeni/mevcut firma, yavaş kayıtta Escape engeli; randevu/talep üstünde alt firma penceresi, odak sınırları ve geri dönüş; randevu yan paneli; finans/gelişmiş özet 1280/390 px. Testte selectOption tek başına odak vermediğinden klavye senaryosu picker.focus ile başlatılır. Native pencere açık olmadan görünmemeli (display:flex varsayılan display:none'i ezmemeli). Nihai tarayıcı kabulü geçti: iç içe odak sarma/geri dönüş, sadece üst pencereye Escape, kayıt beklerken kapanmama; panel ve finans/gelişmiş özet 1280/390 px; gerçek Auth şirket oluşturma/mevcut seçimi/hata regresyonu. Kanıt `/private/tmp/bps-company-feedback-VpXIGQ`. Finans boş kayıt durumuyla incelendi; dolu veri/PDF baskı veya diğer tüm modal çağıranlarının kabulü değildir. Sentetik randevu, firmalar ve hesap temizlendi.

058 doğrulama: izole production build (tüm rotalar ve TypeScript) başarıyla tamamlandı.

## 059 — Ortak liste kullanımı

Tablo veri kimliği değişince ilk sayfaya döner; artık filtre sonrası eski sayfa numarası yüzünden boş sayfa göstermez. Mevcut sayfa üst sınıra sıkıştırılır. Sayısal değerler sayısal karşılaştırılır; tarih/para metinleri otomatik tahmin edilmez. Sıralama başlıkları klavye butonu ve aria-sort kullanır; ayrıca görünür Detay butonu vardır. Yükleme durumu erişilebilir; kayıt aralığı tek sayfada da görünür.

Satır işlemleri native popover ile üst katmanda açılır, tablo overflow alanında kesilmez. Ekran sınırına göre üst/alt konumlandırılır; dış tıklama/Escape ile kapanır, ekran kaydırma/boyut değişiminde gizlenir. İşlemler mevcut onClick ve disabled kurallarını korur. Arama temizleme butonunun adı ve dokunma alanı eklendi; temizledikten sonra odak arama alanına döner.

Kabul için `scripts/fixtures/table-workspace.tsx` yalnız disposable snapshot içinde `/qa-ui-acceptance` rotasına kopyalanır; ürün src/app'a eklenmez ve yayın build'inde yoktur. Gerçek ortak bileşenler 25 sentetik satırla sınanır. Yerel gerçek Auth firma akışının regresyonu da aynı koşuda çalışır. Nihai kabul geçti: 25 satırdan ikinci sayfadayken iki satıra filtreleme ilk sayfayı gösteriyor; sayısal sıralama Enter ile artan/azalan; boş arama/temizle/odak; Detay klavye açılışı; menü disabled/Escape/aksiyon ve 1280/390 px ekran sınırları + düğmeye 8 px içinde açılış. İlk görsel incelemede saptanan native inset=0 konumu inset-auto ile düzeltildi. Kanıt `/private/tmp/bps-company-feedback-nf84xz`. TypeScript ve izole production build geçti; son CSS konumu tarayıcıda yeniden doğrulandı. Sentetik gerçek Auth şirket kayıtları temizlendi.

059 yeniden çalıştırma: izole sunucunun logunda bildirilen bps-build-* snapshot içine `scripts/fixtures/table-workspace.tsx` dosyasını `src/app/(main)/qa-ui-acceptance/page.tsx` olarak kopyalayın; `BPS_TABLE_DESIGN_CHECK=1` ile şirket kabul harnessini çalıştırın. Alt çizgiyle başlayan klasör Next.js özel klasörü olduğu için test yolu qa-ui-acceptance kullanır. Production build snapshotı yeniden kaynaktan kurulduğundan bu rota yayına girmez.


## 060 — Kayıt sonucu, boş durum ve yeniden deneme

Görev oluşturma/güncelleme, randevu oluşturma, randevudan manuel görev ve sözleşme oluşturma başarılı sunucu yanıtından sonra ortak ActionNotice gösterir. Kullanıcı kapatabilir; yeni kayıt açılışı önceki bildirimi temizler. Bildirimde kimlik/aktif tenant/rol kapsamı bulunur; geç dönen eski kapsam yanıtı yeni kapsamda gösterilmez. Bu kontrol veri okuyucularının kapsam/yarış kabulünün yerine geçmez.

Görev/randevu/sözleşme listeleri gerçekten boşsa ilk kayıt yönlendirmesi, filtre sonucu boşsa filtreyi değiştirme açıklaması gösterir. Sözleşme oluşturma yetkisi olmayan kullanıcıya bulunmayan buton önerilmez. Okuma hatası boş veri diye sunulmaz: AsyncSection anlaşılır hata ve yalnız reload çağıran Tekrar dene butonu gösterir. Başarılı yazma bildirimi sonraki liste hatasında korunur. Ham veri katmanı hata metni bu liste alanlarında kullanıcıya basılmaz. AsyncSection yükleme durumu erişilebilir, yeniden dene butonu 44 px.

Tarayıcıda uzun sentetik firma/katılımcı adlarıyla bulunan mobil taşma: DataTable sr-only başlıkları mutlak konumuyla ana sayfa kaydırma genişliğini büyütüyordu. Tablo kaydırma kabı relative yapıldı; başlıklar erişilebilir kalır ve yatay kaydırma tablo içinde kalır.

Kabul: gerçek yerel Auth ile firma oluşturma/bekleme/hata/inline seçim regresyonu; görev oluşturma ve panel güncelleme; randevu ve taslak sözleşme oluşturma; tek DB kaydı; bildirimi kapatma; 390 px yatay taşma geçti. Görev okumasına 503 enjekte edildi: yazma bildirimi ve ayrı okuma hatası, boş başlığın görünmemesi, Tekrar dene ile aynı tek kaydın okunması ve sayfa yenilemesinde kalıcılık doğrulandı. Kanıt `/private/tmp/bps-company-feedback-3SQISr`; mobil bildirim ve masaüstü başarılı yazma/hatalı okuma ekranları incelendi. Kendi sentetik kayıtları ve Auth hesabı temizlendi. Randevudan manuel görev ek bildirimi koddan kontrol edildi; bu tur o alt akışın ayrıca tarayıcı kabulü veya tenant değişim yarışı testi yapılmadı. Ürün SQL veya canlı yayın yok.

Son kaynak ile TypeScript/lint ve izole production build geçti. Yeni test rotası veya üretim ortamı değişikliği yok.
