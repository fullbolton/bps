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


## 061 — Formların klavye, mobil ve kayıt davranışı

NewTaskModal, NewAppointmentModal ve NewContractModal: native form ve form dışında ilişkili submit düğmesi; Enter ile gönderme, useId ile benzersiz htmlFor/id bağları, required alanlar ve açıklama. Alanlar ve footer düğmeleri en az 44 px, mobilde tek sütun, kaydırılabilir gövde ve görünür footer. Randevu formundaki Türkçe etiketler düzeltildi. Görev kaynak referans UUID'si kullanıcı metninden çıkarıldı; payload/bağlantı korunur.

Üç formda disabled fieldset ve erişilebilir bekleme durumu var. Görev/randevudaki senkron gönderim koruması korunur; sözleşmeye ref kilidi eklendi. Sözleşme başarılı kayıtta doğrudan kapanır; kapanma koruması kullanıcı iptaline uygulanır. Bitiş başlangıçtan önceyse ilgili alanda aria-invalid + açıklama ve kaydetme engeli bulunur; mevcut sunucu doğrulaması aynen durur. Bu istemci kilidi sunucu idempotency veya ağ kopmasında komut uzlaştırması iddiası değildir.

Native dialog açılmadan çalışan React autoFocus tarayıcı kabulünde ilk alana odak veremedi. useModalDialog, yalnız data-dialog-initial-focus işaretli, görünür ve etkin alanı showModal sonrasında odaklar. Dışarıdaki dönüş hedefi önce kaydedilir; işaretli alanı olmayan diğer pencerelerin başlangıç davranışı korunur.

Kabul: gerçek sentetik Auth/Chromium ile her formda etiket-alan eşleşmesi, ilk odak, eksik zorunlu alanda disabled submit, 390 px görünüm, Escape ile iptalde odağın tetikleyiciye dönüşü, Enter ile gönderme; geciktirilen POST sırasında bütün alanların kilitlenmesi, Escape/kapatmanın engellenmesi ve requestSubmit tekrarlarına rağmen tek POST + DB kaydı geçti. Sözleşmede yanlış tarih aralığı; sunucunun pasif firma reddinde değerlerin korunması ve hata giderilince kayıt; düzenlemede firma kilidi ve Enter sonrası DB kalıcılığı geçti. 060 görev yazma + liste 503 + yalnız okuma yeniden deneme regresyonu, firma inline oluşturma/mevcut seçim, iç içe dialog Tab/Escape/odak/scroll kilidi, yan panel ve finans 1280/390 px kontrolleri geçti. Kanıt `/private/tmp/bps-company-feedback-1HpKOk`. Mobil görev/sözleşme form görselleri incelendi. Sentetik test verileri ve Auth hesabı temizlendi. Fiziksel iOS/Android klavye veya tüm formlar için kabul iddiası yok. Ürün SQL/push/deploy yapılmadı.

Son kaynak ile TypeScript/lint ve izole production build geçti.


## 062 — Firma durumu ve sözleşme silme onayları

Firmayı aktife/pasife alma ve sözleşmeyi kalıcı silme işlemlerinde window.confirm yerine ConfirmActionDialog kullanılır. Kayıt adı, etki açıklaması, belirgin işlem düğmesi; ilk odak Vazgeç üzerindedir. Senkron ref kilidi ve disabled düğmeler, pending sırasında Escape/kapatma engeli ve role=alert sunucu hatası vardır. Hata sonrasında yeniden deneme mümkündür; kapanıp tekrar açıldığında eski hata temizlenir. Ürün yetki ve sunucu aksiyonları değişmedi.

Firma aksiyonu UPDATE RETURNING ile name döndürdüğünde durum ve başarı bildirimi güncellenir. Sıfır satır artık pasife/aktife alındı şeklinde sunulmaz. Bildirim ve onay kayıt/kimlik/tenant/rol kapsamına bağlıdır; geciken eski kapsam yanıtı yeni kapsamın durumunu yazmaz. Bu, bütün detay okuyucularının yarış koşulları için kabul iddiası değildir.

Sözleşme silme sonucu artık kullanıcı okumadan listeye kaybolmaz: sonuç ekranı ve listeye dön düğmesi vardır, başlık odağı alır. deletedName döndüyse doğrulanan silme; yoksa “Silinen kayıt doğrulanamadı” gösterilir. Sıfır DELETE satırı, SELECT görünürlüğünün kaybolduğunu kanıtlamaz; bu yüzden “artık görünmüyor” denmez. Kayıt önceden kaldırılmış veya silme erişimi değişmiş olabilir. PDF/yenileme geçmişinin silmeyi engelleyebileceği açıklanır; mevcut sunucu korumaları aynıdır.

Kabul: gerçek sentetik Auth/Chromium ile kayıt adı, başlangıç/iptal odağı, iptalde değişmeyen DB, sunucu rol reddi sonrası pencerenin açık kalması, hata temizleme/yeniden deneme, geciktirilmiş tek POST ve pending kapanma engeli, gerçek pasif/aktif durumları ve bildirim, UPDATE RLS sıfır satırında sahte başarı olmaması geçti. Kendi sentetik sözleşmesinin DELETE sonucu ve kalıcılığı, rol reddi, önceden silinmiş kaydın farklı sonucu, sonuç odağı, listeye dönüş, native confirm açılmaması ve 390 px taşma kontrolü geçti. Firma oluşturma/inline seçim/yavaş yanıt/yetki reddi regresyonu da geçti. Kanıt `/private/tmp/bps-company-feedback-BL3bHW`; mobil firma onayı, sözleşme hata ve silme sonucu görselleri incelendi. Kendi test kayıtları ve Auth hesabı temizlendi.

İlk koşuda dedicated fixture UPDATE politikası olmadığı için firma değişikliği sıfır satır döndü. local-company-feedback.sql yalnız sentetik aktörün kendi şirketlerine yönelik status UPDATE politikasıyla genişletildi. Bu üretim RLS/migration kabulü değildir. Ürün SQL/push/deploy yok. Yetkili kişi ve belge silmedeki iki mevcut window.confirm bu bloğun dışında; ilgili DB/Storage sonuçlarıyla birlikte sonraki onay bloğuna kalır.

Son kaynakla TypeScript/lint ve izole production build geçti.


## 063 — Yetkili kişi ve belge silme

Firma detayındaki son iki window.confirm kaldırıldı. Kişi/belge adı ve silme etkisi ConfirmActionDialog içinde görünür; manager-only düğmeler, ilk Vazgeç odağı, pending ref kilidi, Escape/kapatma koruması ve pencere içi sunucu hatası korunur. Satır aksiyonlarının dokunma alanları büyütüldü. Onay hedefi ve sonuç mesajı firma/hesap/tenant/rol kapsamına bağlıdır.

Yetkili silme, mevcut deletedName RETURNING kanıtıyla başarı bildirir; no-op ayrı uyarıdır. deleteCompanyDocumentAction yanıtına zorunlu deleted boolean eklendi: bulunamayan/zero-row sonuç false, gerçekten silinen DB kaydı true. Yazma sırası, RLS, rol kontrolü ve PDF sürüm koruması değişmedi. Storage remove hata verirse deleted:true + warning korunur. UI, kayıt silinip dosya temizliği tamamlanmadığını amber uyarıda açıklar; ham storage path ürün metnine basılmaz. Normal başarı yalnız belge kaydının silindiğini söyler, bir Storage çağrısının fiziksel bütünlük denetimi olduğunu iddia etmez. Uyarı kalıcı bir yönetici iş kuyruğu veya otomatik orphan onarımı değildir; mevcut sunucu uyarısını görünür kılar.

Yetkili ve belge liste okuyucularında generation + kapsam kontrolü, loading/error/empty ayrımı ve Tekrar dene vardır. Silme başarısı sonraki okuma hatasında kayıp/başarısız yazma diye sunulmaz. Gerçek boşluk yalnız başarılı okumada gösterilir. Bu değişiklik firma detayındaki bütün diğer okuyucuların yarış veya eksik veri kabulü değildir.

Kabul: gerçek yerel Auth ve Storage ile sentetik yetkili/belge adları, iptalde DB değişmemesi ve odak dönüşü, rol reddi/değişmeyen kayıt, geciktirilmiş tek POST ve kapanma engeli, 390 px, gerçek silme/RETURNING, önceden silinmiş kayıt uyarısı geçti. Normal belge silmede Storage nesne kaydının kaldırıldığı ölçüldü. Yalnız testin kendi dosya yoluna bağlı geçici BEFORE DELETE trigger Storage hatası üretti: DB belge kaydı 0, Storage nesne kaydı 1 ve UI amber uyarısı doğrulandı. Trigger/function finally ile kaldırıldı, kalan test dosyası cleanup ile temizlendi. İki listeye 503 verilince boş mesajın görünmemesi ve tekrar okumayla gerçek boş duruma dönülmesi geçti. Firma oluşturma/inline seçim/bekleme/rol reddi regresyonu da geçti. Kanıt `/private/tmp/bps-company-feedback-1BBbro`; mobil pending belge onayı ve Storage uyarısı görselleri incelendi.

Gerçek server action gövdesini AST ile alıp yalnız session client bağımlılığını değiştiren document-delete.test.mjs: rol reddi, read failure, missing/zero rows, sürüm bağı DB reddi, RETURNING path kullanımı ve DB→Storage sırası, dosyasız kayıt, Storage hata/confirmed deletion 7/7 geçti. Test qa:operations listesine eklendi. TypeScript/lint ve son kaynakla izole production build geçti. local-contact-feedback.sql sadece marker ile korunan dedicated fixture içindir; gerçek contacts limitleri/RLS paritesi iddiası yok. Test hesapları, kayıtları, dosyaları ve hata düzeneği temizlendi. Üretim migration/push/deploy yok.


## 064 — Firma/sözleşme listesine kaldığı filtrelerle dönüş

Arama ve filtreler `useListViewState` ile sessionStorage üzerinde sekme başına saklanır. Anahtar liste, kullanıcı, active_tenant ve rol kapsamını ayırır. Tercihler yetkilendirme veya veri kapsamı değildir; mevcut Supabase okuyucuları/RLS değişmedi. Auth/kapsam hazır olana kadar varsayılan filtreyle yanlış liste gösterilmez. Kayıtta sadece bilinen filtre anahtarları/string değerler kabul edilir; alanlar 512, ham kayıt 8192 karakterle sınırlıdır. Arama kutularının maxLength değeri 512 olur.

SearchInput başlangıçta veya dışarıdan değer alırken onChange çalıştırmaz. Kullanıcı yazısına ait 300 ms zamanlayıcı temizleme, dış değer, unmount ve keyed kapsam geçişinde iptal edilir. Hook eski kapsam callback'lerini ayrıca reddeder. Yeni firma oluşturulduğunda mevcut davranış korunur: arama/filtre sıfırlanır ve kayıt gösterilir.

Gerçek Auth + dedicated sentetik Supabase tarayıcı kabulü: iki listede tam arama/durum filtresi, yenileme, detaya gidip geri dönüş, tek sonuç, temizleyip yenileme, bozuk JSON'dan toparlama, 390 px taşmama. Yalnız disposable snapshot'a eklenen kabul rotası gerçek hook/SearchInput ile iki kapsamın ayrımını, bekleyen arama sonrası kapsam değişimini, dışarıdan arama değiştirmeyi ve sessionStorage SecurityError durumunda bellekten çalışmayı doğruladı. Ortak tablo sayfalama/sayısal sıralama/klavye/menü regresyonu ve firma oluşturma/yetki reddi de geçti. Kanıt: `/private/tmp/bps-company-feedback-yD0p5k`.

Gerçek TS yardımcılarını çalıştıran list-view-state.test.mjs 4/4; qa:operations'a eklendi. Son kaynak izole production build, TypeScript ve lint geçti. Kendi test kayıtları/hesabı temizlendi. Kabul rotası ürün src ağacında bulunmaz. Ürün SQL/push/deploy yok.

Sınırlar: sayfa numarası, sıralama ve scroll saklanmaz; URL veya cihazlar arası paylaşım yok. Debounce tamamlanmadan ayrılınca bekleyen giriş saklanmaz. Seçenek değerleri güncel veriye karşı yeniden eşleştirilmez; silinmiş firma filtresi kullanıcı temizleyene kadar boş sonuç verebilir. Engelli storage durumunda yalnız mount süresince bellek kullanılır, yenilemede varsayılana dönülür.


## 065 — Görev ve randevu filtrelerini koruma

064'te doğrulanan useListViewState, Görevler ve Randevular sayfalarında kullanılır. Görevler için durum/atama/öncelik/kaynak/firma, randevular için durum/tip/firma anahtarları açık varsayılan listesine dahildir. Özellikle atama anahtarı normalize sırasında düşmez. Arama kontrollü, kapsam anahtarıyla yeniden mount olan ve maxLength=512 içeren SearchInput üzerinden yapılır. Yetki/kapsam hazırlığı bitmeden kayıtlı tercihle uyumsuz ilk liste gösterilmez. Veri okuyucuları/yazıcıları, RLS ve rol kapıları değişmedi.

Kabul: BPS_OPERATIONS_LIST_MEMORY_CHECK=1. Dedicated sentetik DB'de sadece bu çalışmaya ait firma, atanmış ve atanmamış iki görev, bir randevu ile gerçek Auth tarayıcı testi. Her iki sayfada tüm filtreler birlikte uygulandı; tek doğru satır, reload, detay panelini Escape ile kapatma, başka sayfadan browser back, 390 px yatay taşmama, eşleşmeyen arama, arama temizlemede odak, tüm filtreleri temizleyip reload doğrulandı. Görevde Atanmamış tercihi reload sonrası korundu, aynı sorguyu Bana atanan yapınca boş sonuç geldi. Firma kayıt/pending/tek POST ve sunucu yetki reddi regresyonu geçti. Kanıt `/private/tmp/bps-company-feedback-rcpA4H`.

İlk test turunda atanmamış görev zaten görünürken hücreyi beklemek debounce tamamlandığını kanıtlamıyordu; reload arama yazılmadan gerçekleşti. Test sessionStorage'daki tamamlanmış aramayı bekleyecek şekilde düzeltildi. Ürün davranışı değiştirilmedi; 064'ün debounce tamamlanmadan ayrılınca girişin saklanmaması sınırı sürer. Başarısız turun kendi kayıtları da temizlendi.

TypeScript, lint ve izole production build geçti. Kendi sentetik kayıtları ve Auth hesabı temizlendi. Yeni unit testi yok: ortak hook/normalizasyon 064 testleriyle, bu sayfalara bağlanması gerçek tarayıcı kabulüyle ölçülür. 064'ün sekme/cihaz/sayfalama/sıralama/scroll ve storage sınırları aynen geçerli. Ürün SQL/push/deploy yok.


## 066 — Görev ekranında listeyi öne alma

Dört büyük KPI kartı ve aynı durumların tekrarlandığı chip satırı kaldırıldı. Tümü + Açık/Devam Ediyor/Tamamlandı/Gecikti/İptal tek özet alanında: mobilde üç sütun/iki sıra, geniş ekranda altı sütun. Her durum gerçek bir button; aria-pressed ve seçili stil içerir. Seçim yalnız durum filtresini değiştirir; aynı duruma tekrar basmak bu filtreyi kaldırır. Tümü de yalnız durum filtresini temizler. Sayılar filtrelenmiş sonuç sayısı değildir: yüklenmiş tüm görünür görevlerin adetleridir; açıklama bunu açıkça belirtir.

CollapsibleFilters aynı FilterBar kontrollerini mobilde başlangıçta kapalı tutar. 44 px tetikleyici, aria-expanded/aria-controls ve etkin filtre adedi içerir. Masaüstünde panel CSS ile daima görünür, mobil tetikleyici gizlidir. Kapsam anahtarı değişiminde disclosure kapanır; filtre değerleri 065 kapsamında korunur. Açık/kapalı tercihi saklanmaz. Gizli mobil kontroller Tab sırasına girmez. Arama her zaman görünür ve aktif filtre adedine dahil değildir.

Gerçek Auth + dedicated sentetik Supabase kabulü: BPS_OPERATIONS_LIST_MEMORY_CHECK=1 ve BPS_TASK_MOBILE_CHECK=1. 065 tam filtre/reload/panel/browser-back/boş sonuç regresyonu; toplam adedin DB ile eşleşmesi; tamamlandı durumuna Enter ile filtreleme; sadece doğru kayıt; reload sonrası kapalı panelde etkin rozet; Enter ile açma ve Tab ile ilk select'e geçiş; ikinci filtreyle rozet artışı; temizlemenin aramayı koruması; kapatınca Tab'ın tabloya geçmesi; 320/390/1280 px sayfa taşmaması ve desktop filtre görünürlüğü geçti. 390×844 sentetik kabul sayfasında ilk görev satırının alt kenarı viewport içinde ölçüldü. Bu ölçüm ekstra talep bağlantısı/bildirim banner'ları veya daha büyük yazı ayarları için bir garanti değildir.

Görsel kanıt: `/private/tmp/bps-company-feedback-0dFuD3/compact-tasks-390.png`, `task-filters-expanded-390.png`, `compact-tasks-desktop.png`. TypeScript/lint ve izole production build başarılı; kendi test kayıtları/Auth hesabı temizlendi. İş kuralları, veri okuma/yazma ve Supabase şeması değişmedi. Yeni unit testi yok; etkileşimler gerçek tarayıcıda ölçüldü. Ürün SQL/push/deploy yok.


## 067 — Filtre alanlarının anlamı ve kayıtlı seçim açıklığı

Ortak FilterBar'da yalnız placeholder/aria-label kullanımı yerine, select ve tarih alanlarına görünür label + useId tabanlı htmlFor/id eklendi. Aktif değer seçilince alanın Durum/Atama/Öncelik/Firma gibi anlamı kaybolmaz. Birden fazla FilterBar aynı ekrandayken id'ler ayrıdır.

064'te belgelenen, sonradan seçenek listesinden kalkan firma filtresi sınırı görünür hale getirildi: mevcut value otomatik değiştirilmez; disabled seçili option 'Kayıtlı seçim (listede yok)' ve aria-describedby ile açıklama gösterilir. Böylece görünür boş/tümü izlenimi ile gerçekte uygulanan filtre ayrışmaz. Bu bir kaydın silindiği veya yetkisinin kaldırıldığı teşhisi değildir; yalnız mevcut seçeneklerde bulunmadığını ifade eder. Seçenekler geçici olarak yüklenmemişse de aynı bilgi geçerlidir. Seçenek geri gelince normal etiketi döner ve açıklama kalkar. Kullanıcı başka seçenek seçebilir veya temizleyebilir.

Temizle düğmesi minimum 44 px, type=button ve işlem sonrası ilk filtre kontrolüne odak taşır. Böylece düğme kaybolduğunda klavye odağı boşluğa düşmez ve üst form yanlışlıkla gönderilmez. Tarih/select değerleri aynı sözleşmeyle temizlenir; arama ayrı kalır.

Kabul: dedicated sentetik Supabase/gerçek Auth ile BPS_OPERATIONS_LIST_MEMORY_CHECK + BPS_TASK_MOBILE_CHECK + BPS_FILTER_BAR_CHECK. 065/066 filtre hafızası/mobil özeti regresyonu geçti. Yalnız disposable snapshot'a eklenen qa-filter-bar-acceptance rotası gerçek FilterBar ile görünür label ve benzersiz id'leri, aktif seçeneğin kaldırılmasında değerin korunmasını/açıklama bağını, geri gelmesini, kullanıcı temizlemesini, tarih temizlemeyi, Enter ile Temizle'nin form göndermemesini ve odağı doğruladı. 320/390/1280 ekranlarda taşma yok. Kanıt `/private/tmp/bps-company-feedback-fDoJf7`; `filter-missing-320.png` ve `task-filters-expanded-390.png` görsel incelendi.

TypeScript/lint ve izole production build geçti; sonrasında yalnız JSX girintisi düzenlendi. Kendi sentetik kayıtlar/Auth hesabı temizlendi. Kabul rotası ürün src ağacında yok. Ortak bileşen değişikliği diğer FilterBar kullanıcılarına da uygulanır; her ekranın tüm iş akışı test edildi iddiası yok. Yeni SQL/migration/push/deploy yok.


## 068 — Boş arama sonucundan tek adımda dönüş

Firma, sözleşme, görev ve randevu listeleri: yüklenmiş kayıt varsa, arama veya aktif filtre uygulanmışsa ve sonuç boşsa 'Arama ve filtreleri temizle' aksiyonu sunulur. DataTable opsiyonel emptyAction'ı EmptyState'e aktarır; dolu tabloda veya bu dört listede henüz hiç kayıt yokken bu aksiyon gösterilmez. Okuma hata yüzeyleri değişmedi.

Aksiyon SearchInput'un React 19 ref handle clear metoduyla aramayı ve zamanlayıcıyı temizler, son onChange callback'ini çağırır ve input'a odak verir; sayfa filtre varsayılanlarını uygular. Mevcut useListViewState üzerinden sekme kaydı da temizlenir. Dış value zaten boşken bekleyen kullanıcı yazısı varsa da doğrudan clear çalışır; sadece dış value effect'ine güvenilmez. Ref kullanmayan mevcut SearchInput çağrılarının davranışı değişmez. EmptyState aksiyonları minimum 44 px ve type=button olur.

Kabul: BPS_LIST_RECOVERY_CHECK=1, dedicated sentetik Supabase + gerçek Auth. Dört listede eşleşmeyen sorgu ve durum filtresi, 390 px aksiyon/taşmama, Enter ile temizleme, gerçek listenin dönüşü, arama odağı, tüm filtrelerin boşluğu ve reload sonrası temiz kalması geçti. Snapshot-only qa-list-recovery-acceptance gerçek DataTable/EmptyState/SearchInput ile 3 saniyelik pending debounce kurar; callback henüz 0 iken aksiyon uygulanır, 3.3 saniye sonra yalnız clear callback'i (1) kalır. Form submit sayısı 0 ve odak aramadadır. Kanıt `/private/tmp/bps-company-feedback-XpX5iB`; firma/görev mobil görselleri incelendi.

İlk TypeScript turunda metinsel yerleştirme ve kabul fixture'ının ColumnDef header alanı hataları yakalanıp düzeltildi; son TypeScript ve izole production build/lint başarılı. Derlemeden sonra yalnız JSX girintisi düzenlendi. Kendi sentetik kayıtları/Auth hesabı temizlendi; test rotası ürün src ağacında yok. Yeni SQL/migration/push/deploy yok.


## 069 — Görevde atanan kişinin doğru gösterilmesi

Önceki kabul görsellerinde UUID ataması olan fakat eski assigned_to metni olmayan satırın Atanmadı yazdığı görüldü; COLUMNS doğrudan eski metin alanını okuyordu. Yeni taskAssigneeLabel yalnız gösterim içindir: UUID varsa aktif tenant kişi dizininin güncel adı; yüklemede/hata halinde ayrı metin; ready dizinde UUID yoksa 'Atanan kullanıcı listede yok'; boş profile adı için 'Adı belirtilmemiş kullanıcı'. UUID yoksa eski isim '(eski kayıt)' ile korunur; hem UUID hem eski isim yoksa Atanmadı denir. Liste sütunu, panel bilgisi ve kişi adına göre arama aynı etiketi kullanır. Bana atanan/Atanmamış filtreleri UUID ile çalışmaya devam eder; isim-only eski kayıt bir UUID atamasına dönüştürülmez.

Kişi dizini snapshot'ı kullanıcı/active_tenant/rol listScope anahtarına bağlıdır. Scope eşleşmezse eski kişi adları kullanılmaz, ilgili fetch iptal bayrağı geç gelen sonucu reddeder. Hata görev listesini tamamen gizlemez; adların doğrulanamadığı açıklanır ve Kişi listesini tekrar yükle sunulur. Diğer görev/firma okuyucularının kapsam/refetch davranışı bu tur yeniden tasarlanmadı; bütün ekranın tenant izolasyonunun yeniden kabul edildiği iddiası yok.

Panelin Durum ve Atanan Kişi label/id bağları eklendi. Seçeneklerde olmayan mevcut UUID disabled option olarak görünür; boş/Atanmadı izlenimi vermez. Kişi dizini adı değişince enriched selectedTask nesnesi yenilenir; bunun kaydedilmemiş düzenlemeyi silmemesi için edit senkronizasyonu görev id/status/assignee/revision alanlarına bağlıdır. Atama RPC/yazma ve rol kuralları değişmedi.

Gerçek TS yardımcı testi 6/6 (UUID/metinsiz, güncel adın eski metni geçmesi, loading/error/missing, boş ad, legacy-only, gerçekten atanmamış); qa:operations listesine eklendi. BPS_ASSIGNEE_LABEL_CHECK=1: dedicated sentetik DB ve gerçek Auth ile UUID/null metin görevi güncel adla gösterildi, kişi adına arama doğru tek satırı verdi; legacy ve atanmamış satırlar ayrıldı. RPC 503'te atanmamış denmedi, tekrar yüklemeyle ad geldi. RPC [] halinde seçicide UUID ve doğru eksik-kullanıcı etiketi korundu. Geciktirilmiş RPC sırasında panelde durum değiştirildi; kişi dizini gelince taslak değişiklik korundu, kaydetmeden kapatınca DB durumunun değişmediği doğrulandı. Son kaynak kanıt `/private/tmp/bps-company-feedback-gGj21K`; önceki daha dar kabul `/private/tmp/bps-company-feedback-GODGzn`. Mobil eksik-kullanıcı paneli ve hata ekranı görsel incelendi.

Son kaynak TypeScript/lint ve izole production build geçti. Test kayıtları/Auth hesabı temizlendi. Ürün SQL/migration/push/deploy yok.


## 070 — Görev ve randevu panelinden bağlı firmaya geçiş

İki panel firma bağlantısını yalnız legacy_mock_id bulunduğunda gösteriyordu; yeni oluşturulan UUID tabanlı firmalar düz metin kalıyordu. Firma detayının mevcut resolveCompanyByIdOrLegacy yolu UUID zaten kabul eder. Artık görev ve randevu panelinde company_id ile /firmalar/{UUID} Link vardır. Legacy kimliği bulunan kayıtlar da aynı kanonik hedefe gider. Ad çözümlenememişse anlaşılır Firma kaydını aç metni kullanılır; firma okuma ve yetki kontrolü mevcut detay sayfasında sürer. Yeni erişim veya yazma yolu eklenmedi.

Bağlantı altı çizili, minimum 44 px ve uzun adları sarabilecek biçimdedir. Görev sayfasında yalnız bu link için tutulan companyLegacyById/firma_legacy_id kaldırıldı. Firma seçici/yazma katmanının legacy uyumu değişmedi; randevu sayfasında görev oluşturma için gereken harita kaldı.

BPS_COMPANY_LINK_CHECK=1 kabulünde dedicated sentetik DB ve gerçek Auth kullanıldı. Kendi firmasının legacy kimliği önce NULL, sonra sentetik değer yapılarak iki durumda da hem görev hem randevu paneli açıldı. href gerçek UUID, 390 px taşmama/44 px, odak+Enter ile doğru firma başlığının açılması, açık dialog/scroll kilidi kalmaması ve browser back sonrası önceki arama/durum filtresi doğrulandı. Dört akış geçti. Kanıt `/private/tmp/bps-company-feedback-UlMq2Y`; iki mobil panel görüntüsü incelendi. Firma kayıt/tek POST ve sunucu yetki reddi regresyonu da geçti.

TypeScript/lint ve izole production build başarılı. Yalnız kendi test kayıtları/Auth hesabı temizlendi. Yeni unit testi yok; gezinme gerçek tarayıcıda doğrulandı. Ürün SQL/migration/push/deploy yok.


## 071 — Randevuya bağlı görevlerde doğru yükleme ve hata görünümü

Randevular paneli selectTasksByAppointmentId hatasını [] yapıp bölümü gizliyordu. Ayrıca başka randevu seçilirken selectedTasks önceki satırları yeni okuma tamamlanana kadar tutuyordu. AppointmentTasks bileşeni randevu ve listScope anahtarıyla mount edilir; yükleme/error/ready durumları içerir, cleanup bayrağı kapanmış okuyucunun yanıtını uygulamaz. Liste/panelin başka okuyucuları bu tur değiştirilmedi.

Bölüm artık sürekli görünür: yüklenirken Yükleniyor, okumada hata varsa Veri yüklenemedi ve Tekrar dene, başarılı sıfır satırda Bu randevuya bağlı görev yok. İçerikte görev başlığı ve gerçek durum rozeti vardır. Eski raw reader ve appointment_id eşitlik filtresi korunur; sorgu/yetki/yazma semantiği değişmez. Okuma panel açılınca veya hatadan tekrar deneyince yapılır; realtime güncelleme eklenmedi.

BPS_APPOINTMENT_TASKS_CHECK=1: dedicated sentetik Supabase + gerçek Auth; kendi üç randevusundan ilk ikisine bağlı görevler. İlkine REST 503 enjekte edilince boş demedi, retry ile Açık görev geldi. İkinci randevu sorgusu tutulurken loading ve önceki görevin yokluğu doğrulandı; ilk randevuya geri dönülüp geciken ikinci yanıt serbest bırakılınca yanlış kayıt görünmedi. İkinci yeniden açıldığında Tamamlandı görev geldi. Üçüncü gerçek sıfır satırda boş durum ve retry bulunmaması doğrulandı. Mobil hata görünümü 390 px taşmıyor. Kanıt `/private/tmp/bps-company-feedback-zqnyAW`; hata ve içerik ekranları görsel incelendi.

TypeScript/lint ve izole production build başarılı. Kendi görev/randevu/firma ve Auth kayıtları temizlendi. Yeni unit testi yok; asenkron durumlar ve yanıt sırası gerçek tarayıcıyla ölçüldü. Ürün SQL/migration/push/deploy yok.


## 072 — Bağlı görevden doğrudan güncelleme paneline geçiş

Randevunun bağlı görev başlıkları 44 px, altı çizili Link olarak /gorevler?gorev=UUID hedefine gider. task-link yardımcıları tek UUID parametresini kabul eder; boş/bozuk/tekrarlı parametre geçersizdir. TaskLinkOpener, Suspense içinde yalnız mevcut kullanıcı/tenant/rol kapsamıyla başarıyla yüklenmiş görev listesine bakar; URL bir yetki kanıtı değildir ve yeni ayrıcalıklı sorgu eklenmedi. Arama/filtreler hedefi gizliyor olsa da seçilen görev tüm yüklenmiş satırlardan panelde açılır; filtreler sıfırlanmaz.

Açılınca gorev parametresi router.replace ile tüketilir; paneli kapatmak tekrar açılmasına yol açmaz. Diğer sorgu parametreleri korunur. Geçersiz bağlantı ile başarıyla yüklenmiş listede bulunamayan/erişilemeyen görev ayrı açıklamalardır; ikinci durumda erişimsiz ve silinmiş kayıt ayrımı yapılmaz. Liste okuma hatasında bulunamadı denmez; mevcut retry başarılı olunca bağlantı çözülür. Parametre yoksa mevcut görev akışı aynen sürer.

Görev listesi artık auth listScope hazır olunca yüklenir; veri scope'u mevcut scope'a uymuyorsa satırlar kullanılmaz. Her yenileme generation alır, eski veya unmount sonrası yanıt uygulanmaz; önceki scope'a ait reload callback'i güncel scope ref'iyle reddedilir. Firma adları ve görevler birlikte tamamlanır. Scope değişiminde seçili panel kapanır. Firma seçici okuyucusu bu tur yeniden tasarlanmadı; bütün uygulamanın tenant izolasyon kabulü iddiası yok.

Unit task-link.test.mjs 3/3, qa:operations'a eklendi. BPS_TASK_LINK_CHECK: dedicated sentetik Supabase + gerçek Auth ile randevu→görev→panel, iptal filtresi ve alakasız arama altında gizli hedefin Açık durumuyla açılması, 390 px/Enter, URL tüketimi, panel kapatma, filtreler ve randevuya browser back, bozuk/kayıp UUID açıklamaları, başka query parametresini koruyarak kapatma, görev listesi REST503'te sahte not-found olmaması ve retry ile panelin açılması doğrulandı. Göreve yazma yapılmadığı DB durumuyla kontrol edildi. Kanıt `/private/tmp/bps-company-feedback-kmpy1y`; mobil panel görsel incelendi.

BPS_WRITE_FEEDBACK_CHECK aynı kaynakta geçti: görev oluşturma/güncelleme, kayıt başarılı fakat yenileme503, tekrar okuma ve bildirimler; randevu/sözleşme kayıt regresyonu. Bu ilk turun devamındaki deep-link testi arama debounce'u bitmeden ayrılmıştı; test kaydın sessionStorage'a yazılmasını bekleyecek şekilde düzeltildi. Ürün davranışı değişmedi. İlk tur kanıt `/private/tmp/bps-company-feedback-0qQWrR`; iki turun kendi test verileri/Auth hesapları temizlendi. TypeScript/lint ve izole production build başarılı. Ürün SQL/migration/push/deploy yok.


## 073 — Görev panelinde kaydedilmemiş düzenleme ve kayıt koruması

Görev panelinin Durum ve yetkili kullanıcı için Atanan Kişi değerleri kayıtlı değerlerle karşılaştırılır. Değişiklik varsa X, Escape, panel dışına tıklama ve normal aynı sekme firma bağlantısı mevcut ConfirmActionDialog ile bırakma onayı ister. İlk odak Vazgeç'tedir; iptal veya onay penceresinde Escape düzenlemeyi korur. Bırakma onayı yalnız yerel formu kapatır; firma bağlantısından geldiyse ardından UUID detayına gider. Temiz form doğrudan kapanır.

RightSidePanel opsiyonel closeDisabled aldı; diğer kullanıcıları varsayılan davranışta kalır. Görev kaydında senkron ref tekrar girişini engeller; fieldset, kapatma ve normal firma gezinmesi pending süresince kilitlidir. Alanlar ve kayıt düğmesi minimum 44 px, bekleme metni role=status olur. Başarı/hata yanıtı yakalanan listScope güncel scope ile eşleşirse uygulanır. Hata düzenlemeyi ve paneli korur; finally kilidi kaldırır. Mevcut updateTask/revision ve rol kontrolleri değişmedi.

BPS_TASK_PANEL_GUARD_CHECK=1 + BPS_ASSIGNEE_LABEL_CHECK=1: dedicated sentetik Supabase ve gerçek Auth ile temiz/kirli Escape, X/backdrop, Vazgeç, iç içe dialog Escape/odak, firma bağlantısını bırakma ve DB'nin değişmemesi doğrulandı. Gerçek görev PATCH'i bekletildi; çift tıklama tek istek üretti, alanlar/kapatma/normal firma linki kilitli kaldı. Yanıt açılınca DB devam_ediyor oldu. Sonraki kayıt PATCH503 ile reddedildi; düzenleme kaldı ve retry DB'yi tamamlandi yaptı. Geç kişi dizini yanıtının düzenlemeyi koruması testi yeni bırakma onayını kabul edecek biçimde güncellendi ve geçti. Standart firma kayıt/izin reddi regresyonu da geçti. Kanıt `/private/tmp/bps-company-feedback-Oba4fS`; task-discard-confirm-390.png görsel incelendi. Kendi sentetik kayıtlar/Auth hesabı temizlendi.

TypeScript, lint ve izole production build başarılı. Tarayıcı Back/yenile/tab kapatma veya genel gezinme koruması bu kapsamda değil. Modifier/yeni sekme bağlantıları korunur; mevcut panel yerinde kalır. Auth scope değişimi paneli kapatmaya devam eder, gönderilmiş ağ isteği iptal edilmez. Mevcut açıkça etiketlenmiş Güncel kaydı yükle (formu yeniler) aksiyonu formu yeniler. Ürün SQL/migration/push/deploy yok.


## 074 — Randevu tamamlama formunda metni koruma ve kayıt geri bildirimi

AppointmentResultModal içinde sonuç veya sonraki aksiyon metni varsa X, Escape, backdrop ve İptal mevcut ConfirmActionDialog ile bırakma onayı ister. Vazgeç ve iç onayda Escape metni korur. Onay formu kapatıp temizler; yeni açılış boştur. Açıklama yalnız penceredeki metni bırakmayı anlatır; önceki belirsiz ağ hatasında veritabanına hiç yazılmadığı iddiası üretmez.

Görünür label/id, useId tabanlı form/alan kimliği, sonuç alanında başlangıç odağı, required ve mevcut 4000/1000 maxLength ile ilişkili karakter sayaçları eklendi. Native form footer Kaydet düğmesiyle bağlıdır; textarea Enter satır eklemeye devam eder. Boş/yalnız boşluk alanlar kaydı etkinleştirmez, onComplete yoksa da Kaydet pasiftir. Düğmeler minimum 44 px. Önceden var olan senkron submitting ref ve async hata sözleşmesi korunur. ModalShell opsiyonel closeDisabled ile kayıt sürerken X'i görünür biçimde devre dışı bırakır; Escape/backdrop da kapanmaz. Bekleme role=status açıklaması vardır.

Randevu sayfasında action taskCreated sonucu doğru başarı mesajını belirler. Takip görevi atlanmışsa mevcut gerekçe bildirimi kalır. Sonuç modalı listScope/randevu kimliğiyle key alır. Bu tur genel randevu okuyucusu veya geç gelen üst sayfa action yanıtlarının scope davranışı yeniden tasarlanmadı; uygulama genelinde tenant izolasyonu kabulü iddiası yok. Browser geri/yenile/tab kapatma için genel dirty guard yok; taslaklar disk/storage'a yazılmaz. SQL, hizmet doğrulaması ve tamamlama RPC'sinin iş kuralları değişmedi.

BPS_APPOINTMENT_RESULT_CHECK=1 gerçek Auth + dedicated sentetik Supabase kabulü: temiz kapatma, ilk odak ve label bağlantıları, Enter ile satır, zorunlu/whitespace alanlar, X/Escape/backdrop/İptal onayı, iptal ve iç Escape ile metni koruma, bırakmada DB planlandi kalması, temiz yeniden açılma geçti. 390 px taşmama/görsel kontrolü başarılı. Server action POST503 enjekte edildi; iki metin ve düzenleme yeteneği kaldı, DB değişmedi/takip görevi oluşmadı. İkinci gönderim bekletildi, requestSubmit iki kez çağrıldı; tek POST, pending alan/kapatma kilidi ve Escape/backdrop engeli doğrulandı. Serbest bırakınca gerçek RPC randevuyu tamamladı, metinler DB'de doğrulandı ve tek takip görevi oluştu; başarı bildirimi görüldü. Kayıt sonrası geri bildirimde taskCreated=false dalı bu tarayıcı kabulünde ayrıca çalıştırılmadı.

İlk TypeScript turu action sonucunun taskCreated alanını kullanmamız gerektiğini yakaladı; düzeltildi. İlk tarayıcı turundaki yanlış arama label eşleşmesi düzeltildi; bu turun kendi verileri de temizlendi. Son kabul kanıtı `/private/tmp/bps-company-feedback-jDwVqb`, appointment-result-390.png görsel incelendi. Firma kayıt/bekleme/izin reddi ve iç firma seçici regresyonu geçti. Son TypeScript/lint ve izole production build başarılı; kendi sentetik kayıtları/Auth hesabı temizlendi. Ürün SQL/migration/push/deploy yok.


## 075 — Randevu listesinde güncel yanıt, kapsam ve manuel yenileme

Önceki reload, randevuları firma adları gelmeden state'e yazıyor ve birden fazla isteğin sırasını denetlemiyordu. Liste artık auth hazır olduktan sonra listScope (kullanıcı/active_tenant/rol) ile yüklenir. Her reload artan generation alır; hem randevu sorgusu hem firma haritasından sonra request/güncel scope denetlenir. Satırlar, firma adları ve legacy haritası tek snapshot'tır. Eski başarı/hata yanıtı yeni okumanın durumunu değiştiremez; effect cleanup generation'ı artırır ve canlı kapsam referansını temizler.

Listeyi yenile düğmesi minimum 44 px; yüklemede disabled ve dönen ikon vardır. Randevular yükleniyor metni role=status taşır; yükleme sırasında tablo gösterilmez. Aynı kapsamın son durum adetleri yükleme boyunca kalabilir. Arama/filtre tercihlerine dokunulmaz. Firma adları sorgusu başarısızsa boş liste iddiası yerine mevcut hata/retry görünür.

Liste snapshot'ı ve firma/kişi dizinleri yalnız mevcut kapsamla eşleşirse kullanılabilir. Dizinler kapsam değişiminde yeniden okunur, cleanup ile geç yanıtları reddeder. Kapsam değişiminde seçili detay, yeni randevu, sonuç formu, görev oluşturma ve görev-atlama açıklaması temizlenir. Üç action callback'i sonuç ve reload sonrasında güncel kapsamı denetler; modalların onClose callback'leri de denetim yapar. Böylece eski mount'un await sonrası onClose çağrısı yeni kapsamda açılmış pencereyi kapatamaz. YeniTaskModal da kapsam/randevu key'i alır.

Sınırlar: Listeyi yenile yalnız randevu/firma-adı okumasıdır; firma ve atama dizinlerini ayrıca yenilemez (bunlar kapsam değişince okunur). Firma dizini okuma hatasının mevcut boş seçenek davranışı bu tur değiştirilmedi. RLS/yazma yetkisi ve server action sözleşmeleri değişmedi; gönderilmiş yazma işlemi kapsam değişince iptal edilmez. Kapsamın her değişiminde yeni bir nesne kimliği üretilir; eski yazma yanıtı A→B→A sonrasında string aynı olsa bile reddedilir. Bu tur bütün uygulamanın veya iki tenant arasındaki güvenlik kabulü değildir.

BPS_APPOINTMENT_REFRESH_CHECK=1: dedicated sentetik Supabase ve gerçek Auth ile manuel okumanın başarılı yanıtı tutuldu, arada UI üzerinden yeni randevu oluşturuldu ve daha yeni reload tamamlandı; eski yanıt serbest kalınca yeni kayıt kaldı. Aynı akış eski 503 ile tekrarlandı; yeni başarılı liste hata ekranına dönmedi. Firma-adı yanıtı tutulduğunda tablo yayımlanmadı; firma-adı 503'ünde boş denmedi, retry listeyi ve aynı aramayı geri getirdi. 320/390/1280 taşmama ve mobil yenileme görünümü doğrulandı.

Snapshot-only qa-appointment-scope gerçek RandevularPage/AuthProvider kullanır; yalnız test olayında auth.refreshSession çağırır. Sentetik kullanıcının DB rolü yonetici→operasyon değiştirildi, bekleyen eski okuma sırasında yeni randevu formu kapandı ve yeni veri okundu; eski yanıt geri gelince eski satır görünmedi. Ek test gerçek create action'ını sunucuda tamamlatıp HTTP yanıtını tuttu; rol yonetici→operasyon→yonetici değiştikten sonra yeni form ve taslak açıldı, eski yanıt serbest bırakılınca yeni form/metin kaldı ve eski başarı bildirimi gösterilmedi. Rol geri alındı. Bu rol değişimi kabulüdür; ayrı tenant değişimi tarayıcıda çalıştırılmadı.

BPS_APPOINTMENT_RESULT_CHECK=1 aynı son kaynakta geçti: kapatma/onay, odak/etiket, POST503/metni koruma/retry, tek tamamlanma/takip görevi. Standart firma kayıt/bekleme/izin reddi ve iç firma seçicileri de geçti. Son kanıt `/private/tmp/bps-company-feedback-NP6dFt`; önceki dar kabul `/private/tmp/bps-company-feedback-c7pVx3`. Kendi test kayıtları/Auth hesabı temizlendi. Kabul rotası ürün src ağacında yok. Ürün SQL/migration/push/deploy yok.

Son kaynak TypeScript/lint ve izole production build geçti; 28 statik sayfa üretildi. Son mobil yenileme görseli incelendi. Yalnız kendi geçici 3010 sunucusu kapatıldı.


## 076 — Randevuda firma ve atama dizinleri için doğru durum / tekrar deneme

Randevular sayfasının firma dizini catch→[] davranışı error durumuna ayrıldı. Firma ve kişi dizinleri bağımsız retry sayaçlarıyla yenilenir; 075 kapsam/cleanup koruması sürer. Randevu listesindeki firma filtresi için de dizin yükleme/hata/boş açıklaması görünür. Mevcut Listeyi yenile yalnız randevu satırları/firma adlarını yeniler; dizin tekrarları ayrı ve açık adlandırılmıştır.

Ortak PickerFeedback yükleniyor, yüklenemedi/tekrar dene ve başarılı sıfır kayıt açıklamalarını ayırır; hata aksiyonları type=button, minimum 44 px. Select açıklaması aria-describedby ile bağlanır. NewAppointmentModal ve NewTaskModal opsiyonel firmalarDurum/onRetryFirmalar, görev formu ayrıca onRetryKullanicilar alır. Bu tur retry callback'leri Randevular sayfasına bağlandı; diğer çağıranlar varsayılan ready sözleşmesinde kalır. Tüm uygulamanın dizin sorguları bu tur değiştirilmedi.

Firma dizini loading/error iken firma seçimi ve form gönderimi kapalıdır. Dizin başarıyla boş gelmişse gerçek boş mesajı vardır; randevuda mevcut yeni firma ekleme seçeneği çalışmaya devam eder. Firma yeniden yüklenirken tarih, saat, katılımcı veya görev başlığı resetlenmez. Seçili firma seçeneklerden kalkarsa UUID/değer korunur ve disabled açıklayıcı option gösterilir; seçenek doğrulanmadan kayıt gönderilmez.

Atama isteğe bağlı kalır: kişi dizini hatası veya gerçekten boş olması, seçilmiş kişi yoksa atanmamış görevi engellemez. Seçilmiş kişi dizinde yoksa otomatik null'a çevrilmez; kimlik korunur, gönderim durur. Başarılı fakat boş dizinde mevcut eksik seçim temizlenerek atanmadan devam edilebilir. Kullanıcıya verilen roller/RPC/yazma yetkisi değişmedi; sunucu doğrulaması otorite olmaya devam eder. Diğer NewTaskModal çağıranlarında da seçili firma/kişi seçenek geçerliliği kontrolü uygulanır; bilinen çağıranlar tarandı, firma detayının hazır tek firma ve görev prefill seçenek sözleşmeleri korunur.

BPS_PICKER_RECOVERY_CHECK=1 + BPS_WRITE_FEEDBACK_CHECK=1, dedicated sentetik Supabase/gerçek Auth: firma dizini tutulduğunda loading ve kilitli seçim/gönderim; 503'te boş mesajının yokluğu; tekrar yükleme sonrası aynı tarih/katılımcı ve doğru firmayla tek randevu; başarılı [] için gerçek boş açıklaması ve retry olmaması doğrulandı. Randevudan görev açılışında hem firma hem kişi dizini 503 iken başlık/default firma korundu. Firma retry sonrası başlık/UUID aynı kaldı. Kişi retry [] için boş/atanmamış seçenek, sonraki 503→retry gerçek kişi dizininde doğru kullanıcıyla tek görev yazımı geçti. Görev/firma/randevu/sözleşme kayıt bildirimi, başarısız liste yenilemesi, inline firma seçimi ve yetki reddi regresyonları geçti. Seçilmiş kişi dizinden sonradan kaldırılması fallback'i bu kabulde ayrıca canlandırılmadı.

İlk kabul turundaki option görünürlüğü beklemesi attached beklemesine düzeltildi; ürün verisi gelmişti. Aynı turda disk ENOSPC oluştu ve Docker cevap veremez hale geldi. BPS package.json ve repo node_modules bağı doğrulanan, etkin node çalışma dizini olmayan 15 eski test snapshot'ının yalnız .next önbelleği temizlendi. İlk ölçüm 150 MiB → 5.7 GiB; daha sonraki ölçüm 40 GiB (son artışın tamamı bu temizliğe atfedilmez). Docker'ın normal restart komutu zaman aşımına uğradı; resmi force-stop/start ile veriler silinmeden toparlandı. CUA Docker erişimi de zaman aşımına uğradığından kurtarma CLI ile tamamlandı.

İlk tur cleanup kapanışında takılan yalnız doğrulanmış kabul PID'si durduruldu. Docker toparlanınca eski test önekiyle şirket kaydı 0 olduğu görüldü; o kilitli testin çıktı dizini oluşturulması ile ilk kanıt görseli arasındaki sentetik orphan Auth hesabı sayısı da 0 idi. Son kabul kendi verilerini/Auth hesabını normal şekilde temizledi. Son kanıt `/private/tmp/bps-company-feedback-oUT6QD`, appointment-picker-error-390.png görsel incelendi. TypeScript/lint ve izole production build başarılı. Ürün SQL/migration/push/deploy yok.


## 077 — Görevler ekranına dizin hata/retry tutarlılığı

Genel Görevler sayfasının firma okuyucusu catch→[] yerine kapsamlı loading/error/ready snapshot kullanır. Auth scope hazır olmadan okumaz; kullanıcı/active_tenant/rol değişince tekrar kurulur ve cleanup geç yanıtı reddeder. Firma filtresi ve yeni görev için 076 PickerFeedback kullanılır. Firma tekrar yükle ve mevcut kişi tekrar yükle callback'leri NewTaskModal'a geçirildi; form mount'u ve alan değerleri değişmez.

Normal görev için firma listesi doğrulanmalıdır. Talep bağlamından hazırlanmış görevde server action'ın doğruladığı companyId/companyName tek seçenek olarak ready kalır; genel dizin hatası bu doğrulanmış bağlamı engellemez. TaskPrefillBanner ve NewTaskModal artık listScope key kullanır; yeni form/prefill temizliği tenant değişimini de kapsar. Create callback ve onun onClose'u kapsam nesne kimliğiyle korunur, unmount'ta canlı referans temizlenir. Böylece eski create yanıtının yeni scope'a UI yan etkisi vermesi engellenir; bu tur görev güncelleme panelinin tüm callback'leri yeniden tasarlanmadı.

BPS_TASK_PICKER_RECOVERY_CHECK=1: dedicated sentetik Supabase/gerçek Auth ile firma dizini tutuldu; loading, kilitli firma/gönderim doğrulandı. Firma ve kişi dizinlerine 503 verildiğinde ayrı retry ve boş olmayan hata mesajı geldi. Firma retry sonrasında başlık, 2026-10-01 termin, yüksek öncelik korundu. Kişi retry mevcut firmayı ve başlığı korudu; seçilen sentetik kullanıcıya doğru firma/tarih/öncelikle tek task DB'de doğrulandı. Başarılı [] firma dizini boş olarak gösterildi, retry yoktu ve firmasız gönderim etkinleşmedi. 390 px hata formu taşmadı; task-directory-error-390.png görsel incelendi.

BPS_ASSIGNEE_LABEL_CHECK=1: güncel UUID adı, gerçekten atanmamış/eski metin ayrımı, kişi adı araması, geciken dizinde kaydedilmemiş düzenlemeyi koruma, hata/retry ve eksik seçili UUID regresyonu geçti. Standart firma kayıt/bekleme/izin reddi ve iç firma seçimi geçti. Task-prefill yardımcı testleri 7/7; bu tur prefill+genel dizin hatası kombinasyonu ayrıca tarayıcıda çalıştırılmadı. Yeni görev kapsam callback'inin A→B→A senaryosu da bu tur yeniden ölçülmedi; 075'te kullanılan nesne kimliği deseni uygulandı.

İlk test sunucusu başlatmasında node_modules içindeki @next/swc-darwin-arm64 eksikti. Kilit dosyasındaki 15.5.20 paketi kuruldu; npm yerel paket ağacını düzenlediği için ardından npm ci --ignore-scripts --include=optional ile tamamı mevcut package-lock sürümlerine eşitlendi. package.json/package-lock değişmedi. Son kaynak TypeScript/lint ve izole production build geçti. Kanıt `/private/tmp/bps-company-feedback-w2ZXaf`; kendi test verileri/Auth hesabı temizlendi. Ürün SQL/migration/push/deploy yok.


## 078 — Yeni görev ve randevuda kaydedilmemiş form koruması

NewTaskModal başlangıç başlık/firma/kaynak/öncelik değerlerini, boş atama ve terminle karşılaştırır. NewAppointmentModal başlangıç firmasını, boş tarih/saat/katılımcıyı ve ziyaret tipini karşılaştırır; inline firma seçimi/eklemesi de bırakma onayına dahildir. Değişiklik varsa X, Escape, backdrop ve İptal mevcut ConfirmActionDialog'u açar. Vazgeç veya onay penceresinde Escape alanları korur; Değişiklikleri bırak resetAndClose çağırır. Varsayılan değerler tek başına kullanıcı düzenlemesi sayılmaz; eski değere geri dönüş onayı kaldırır.

Kayıt sırasında senkron submitting ref engeli korunur ve ModalShell closeDisabled ile X açıkça disabled olur. Başarılı kayıt onayı atlayarak mevcut onClose akışını sürdürür. Formun içinden açılan Yeni Firma penceresinde Escape yalnız çocuğu kapatır. Inline oluşturulan veya seçilen firmanın kaydı randevu taslağından bağımsızdır; bırakma açıklaması firma kayıtlarının silinmediğini belirtir. Formun kapanması firma kaydını geri alma işlemi değildir.

BPS_CREATE_DRAFT_GUARD_CHECK=1 gerçek Auth/dedicated sentetik Supabase: görev ve randevuda boş Escape, kirli X/Escape/backdrop/İptal, Vazgeç ve çocuk onay Escape ile metni koruma, başlangıç odağı, bırakmada kayıt oluşmaması, temiz yeniden açılış, değer değiştirip eski değere dönünce onaysız kapanma ve 390 px taşmama geçti. Randevudan görev açılışında firma/kaynak varsayılanları temiz kabul edildi. Firma detayındaki Randevu Planla ile açılan tek firma varsayılanı da onaysız kapandı. Inline firma oluşturulup randevu bırakıldıktan sonra DB'de firma 1, ona bağlı randevu 0 doğrulandı.

BPS_WRITE_FEEDBACK_CHECK + BPS_FORM_DESIGN_CHECK + BPS_DIALOG_DESIGN_CHECK ilk turda geçti: üç formun label/ilk odak/Enter, pending alanlar/kapanma engeli/çift requestSubmit tek POST, tarih doğrulaması, sunucu reddi ve toparlama, sözleşme düzenleme; iç içe pencere odağı/scroll kilidi/panel ve finans mobil regresyonları. Pending kapatma testinde disabled düğmeye Playwright click beklemek yerine DOM click kullanılır; geçersiz ikinci gönderim yine ref ile engellenir. Önceki opsiyonel kabul senaryolarındaki bilinçli taslak bırakmalar yeni onayı kabul edecek şekilde uyarlandı. Bu opsiyonel senaryoların tamamı bu tur yeniden çalıştırılmadı.

İlk turun son firma detay kontrolü yanlış Yeni Randevu düğme adını arıyordu; Randevu Planla olarak düzeltildi ve yeni koruma kabulü tekrar geçti. İlk tur kanıt `/private/tmp/bps-company-feedback-MxiLbk`; son kabul `/private/tmp/bps-company-feedback-RZOcTN`. Mobil onay görseli incelendi. İki turun kendi verileri/Auth hesapları temizlendi. TypeScript/lint ve izole production build başarılı.

Sınır: browser geri/yenile/tab kapatma veya üst sayfanın auth scope nedeniyle unmount etmesi bu yerel onayı kullanmaz. Taslaklar kalıcı depolanmaz. Server action/RPC/yetki veya SQL değişmedi. Ürün migration/push/deploy yok.


## 079 — Yeni firma formu, taslak ve açık mükerrer kararı

NewCompanyModal ad/sektör/şehir değerlerini boş başlangıçla karşılaştırır. X, Escape, backdrop ve İptal değişiklik varsa ConfirmActionDialog açar; Vazgeç/nested Escape alanları korur. Onaylı bırakma state'i temizler. Başarılı kayıt ve mevcut firmayı seçme bırakma onayını atlar. ModalShell closeDisabled kayıt süresince X'i devre dışı bırakır; senkron submitting ref korunur.

İçerik native form oldu; footer düğmesi form kimliğiyle bağlandı. Normal Enter submit(false) kullanır. Mükerrer uyarısı görünürken form submit hiçbir yazı başlatmaz; Yine de oluştur yalnız açık düğme eylemiyle submit(true) çağırır. Bunu seç type=button kullanır. İlk ad alanı data-dialog-initial-focus ve required, alanlar/düğmeler minimum 44 px kullanır. Server action ve mükerrer iş kuralı değişmedi.

BPS_COMPANY_DRAFT_GUARD_CHECK=1: gerçek Auth/dedicated sentetik Supabase ve Chrome ile temiz Escape; kirli X/Escape/backdrop/İptal; üç alanın korunması; nested onayda Escape; bırakmada DB 0; temiz yeniden açılış; başlangıca dönüş; 390 px taşmama; ilk ve geri dönen odak doğrulandı. Enter normal kaydı oluşturdu. Mükerrer uyarısında input Enter ve programatik requestSubmit POST başlatmadı, DB 1 kaldı. Bunu seç kayıt artırmadı, açık Yine de oluştur DB sayısını 2 yaptı. Randevu→firma→bırakma onayı üç katmanda çalıştı, onay kapandıktan sonra firma bilgisi ve randevu korundu, firma bırakıldığında odak parent seçiciye döndü.

BPS_DIALOG_DESIGN_CHECK=1 ile randevu/talep iç firma yaratma ve mevcut seçme, Tab odak sınırı/geri dönüş, body scroll kilidi, yan panel ve finans masaüstü/mobil regresyonları geçti. Standart şirket kabulü beklemede kapatma/gönderim/alan kilitlerini, tek POST/DB satırını ve sunucu yetki reddinde düzenlenebilir formun korunmasını doğruladı. Kanıt `/private/tmp/bps-company-feedback-UnFAGN`; company-discard-390.png görsel incelendi. Kendi test kayıtları/Auth hesabı temizlendi. TypeScript/lint ve izole production build başarılı.

Sınır: sayfa yenileme, tarayıcı geri/tab kapatma ve üst bileşenin unmount etmesi taslağı korumaz; kalıcı taslak yok. Bu blok yalnız firma formunu kapsar. SQL/migration/push/deploy yok.


## 080 — Personel talebi formu ve taslak koruması

NewRequestModal native form/Enter kullanır; yedi label useId üzerinden kontrolüne bağlıdır. İlk odak firma seçicisinde; required alanlar native doğrulamaya bağlıdır. Adet pozitif güvenli tam sayı olmalıdır (önceki min=1 niyeti artık handler/canSubmit içinde de uygulanır); seçilen firma tumFirmalar içinde bulunmalıdır. Yüksek/kritik sorumlu zorunluluğu korunur. Inline firmalar payload firma adının çözümlemesine dahil edildi. Türkçe etiketler düzeltildi; 44 px kontrol ve mobil tek sütun düzeni uygulandı.

Senkron submitting ref aynı turdaki çift requestSubmit'i engeller. Pending açıklaması/aria-busy ve closeDisabled kayıt süresince görünür; başarı ref'i serbest bırakıp onaysız kapatır, hata alanları düzenlenebilir bırakır. X/Escape/backdrop/İptal değişiklik varsa bırakma onayı ister. Temiz varsayılan veya düzenlemeyi geri alma onaysız kapanır. Inline firma yaratılmış/seçilmişse açıklama firma kayıtlarının silinmediğini söyler. Açılışta eski firma bildirimi, inline seçenekler ve iç pencere/onay state'i de sıfırlanır.

BPS_REQUEST_FORM_CHECK=1 için dedicated sentetik DB'de staffing_demands yoktu; local-request-feedback.sql marker kontrolüyle yalnız sentetik tabloyu kurar. Kolonlar ve sayım kontrolleri ürün şemasından alınmıştır; fixture RLS yalnız yerel kabulü mümkün kılar, prod RLS güvenlik kanıtı değildir. Şirket FK'si ON DELETE CASCADE olduğundan harness'in kendine ait şirket temizliği talepleri de kaldırır. Ürün migration değişmedi/uygulanmadı.

Gerçek Auth/Chrome kabulü: yedi label/ilk odak, temiz Escape; kirli X/Escape/backdrop/İptal sonrası alanların korunması; onayda Escape; bırakmada DB 0; yeniden açılış ve temiz hale dönüş geçti. Inline firma eklenip talep bırakıldıktan sonra firma DB 1 kaldı, eski bildirim yeniden açılan formda görünmedi. 0/-1/1.5 kişi sayıları gönderimi kapattı; yüksek öncelikte sorumlu girilince açıldı. Enter ile gönderime 503 verildi: hata görünür, form düzenlenebilir, DB 0. Retry'da aynı anda iki requestSubmit: tek POST ve DB'de doğru 3 kişi/tarih/konum/öncelik/sorumlu satırı. Pending X disabled, Escape/backdrop kapatmadı. 390 px ekran görüntüsü incelendi.

BPS_DIALOG_DESIGN_CHECK=1 randevu/talep iç firma seçme/oluşturma, odak sınırı/geri dönüş, scroll kilidi, panel ve finans mobil regresyonları geçti. Eski dialog testi talep taslağını artık açıkça bırakıyor. Standart firma bekleme/tek kayıt/yetki reddi de geçti. Kanıt `/private/tmp/bps-company-feedback-IiEa1P`; kendi şirket/talep/Auth verileri temizlendi. TypeScript/lint ve izole production build geçti (ardından yalnız JSX girintisi düzeltildi).

Sınır: üst sayfa yenileme/auth unmount veya browser geri/tab kapatma koruması yok; kalıcı taslak yok. Sunucu yetkileri/sayım kuralları değişmedi. Talepler sayfasının firma dizini loading/error ayrımı, kayıt sonrası görünür sonuç mesajı ve kapsam/geç yanıt yönetimi bu bloğun dışında, sonraki inceleme adayıdır. Ürün SQL/push/deploy yok.


## 081 — Talep kaydı bildirimi, firma dizini ve liste toparlaması

Talepler sayfasında selectAllCompanies hatası artık [] olarak gizlenmez. Kullanıcı/tenant/rol kapsamlı companySnapshot ready/error, ayrı retry sayacı ve loading durumu kullanılır. NewRequestModal firmalarDurum/onRetryFirmalar alır; PickerFeedback form içinde hata/boş/yükleme ayrımı ve tekrar yükleme sunar. Firma seçimi yükleme/hata süresince disabled, formdaki diğer alanlar korunur ve İptal kullanılabilir. canSubmit yalnız ready ve seçili firma mevcutsa çalışır; seçili kimlik bulunamazsa disabled açıklama seçeneği korunur. Başarılı boş dizinde yeni firma ekleme erişilebilir; hata durumunda önce tekrar yüklemek gerekir.

Talep yaratma server action'ı ok döndüğünde mevcut ActionNotice ile pozisyon ve kişi sayısı duyurulur. Sonraki reload hatası başarıyı silmez ve create hatası gibi yeniden fırlatılmaz. Liste için ayrı, sade hata metni ve Listeyi tekrar yükle düğmesi vardır; bu yalnız okuma çağırır. Loading/error durumlarında tablo ve KPI/durum sayıları gösterilmez. Başarı bildirimi kullanıcı kapatana ya da bağlam değişene kadar kalır; sayfa yenilemesinde kalıcı değildir.

Talep listesi rows/names/legacy tek snapshot olarak hazırlanır, iki okuma tamamlanmadan görünmez. Her reload generation ve bağlam nesnesini kontrol eder; auth hazır değilken başlamaz. Kapsam değişimi selected/new/owner modal hedeflerini temizler. Firma dizini cleanup ile eski yanıtı reddeder. NewRequestModal listScope key kullanır; create callback/onClose eski bağlama UI etkisi vermez, nesne kimliği A→B→A durumunu da ayırır. Bu tur kapsam değişimi/geç yanıt senaryosu ayrıca tarayıcıda ölçülmedi; Randevular'daki mevcut desen uygulandı. AssignOwnerModal'ın gecikmiş yazı callback'leri yeniden tasarlanmadı.

BPS_REQUEST_RECOVERY_CHECK=1: dedicated sentetik Supabase ve gerçek Auth/Chrome ile firma sorgusu tutuldu; loading ve kapalı gönderim doğrulandı. 503 firma hatası boş liste sayılmadı. Form içi retry pozisyon, 4 kişi, 2026-10-02 tarih, kritik öncelik ve sorumluyu korudu. Gerçek create başarılıyken yalnız browser liste GET'ine 503 verildi; DB tek doğru satır, form kapalı, başarı bildirimi + ayrı liste hatası, boş tablo mesajı yok. Liste retry ardından satır geldi ve POST sayısı 1 kaldı. Başarı bildirimi kapatılabildi. [] firma yanıtında boş metni, açık seçici, kapalı gönderim ve inline yeni firma giriş/geri dönüş çalıştı. 390 px hata formu ve başarı/liste hata görselleri incelendi.

İlk tur BPS_REQUEST_FORM_CHECK=1 ile 080 kapanış/alan koruma, firma kalıcılığı, sayı/sorumlu, hata-retry ve çift gönderim regresyonu da geçti; kanıt `/private/tmp/bps-company-feedback-fU1iiF`. Son kullanıcı hata metni sadeleştirildikten sonra yeni toparlama kabulü ve izole build tekrar geçti; son kanıt `/private/tmp/bps-company-feedback-NCyj09`. İki turun kendi şirket/talep/Auth verileri temizlendi. TypeScript/lint/production build başarılı. Ürün SQL/migration/push/deploy yok.


## 082 — Talep sorumlusu atama ve güncelleme

AssignOwnerModal initialSorumlu alır ve kayıtlı isimle açılır. Talepler satır eylemi responsible değerini ownerTarget içine alır; form talep/kapsam key ile ayrılır. Mevcut isim varsa Güncelle, yoksa Ata düğmesi vardır. Trim sonrası aynı veya boş isim yeniden yazılmaz. Native form/Enter, required bağlı etiket, ilk odak ve 44 px kontroller eklendi.

Taslak mevcut başlangıçtan farklıysa X/Escape/backdrop/İptal bırakma onayı ister. Vazgeç ve onayda Escape metni korur; bırakma DB yazmaz. Synchronous submitting ref aynı turdaki çift requestSubmit'i engeller; closeDisabled ve pending açıklaması kayıt sürerken kapanmayı engeller. Sunucu hatası sade Türkçe mesajla aynı düzenlenebilir formda görünür. Başarı mesajı talep referansı ve yeni sorumluyu içerir; ardından liste yenilemesi hata verse bile başarı kalır.

Parent atama callback'i yazı öncesi/sonrası, hata ve reload sonrası context nesnesini kontrol eder; onClose da aynı korumayı kullanır. Böylece eski kullanıcı/tenant/rol callback'i yeni scope'u kapatamaz/duyuru veremez. Bu tur gerçek kapsam değişimi/A→B→A tarayıcı senaryosu yeniden ölçülmedi; 081 desenine tamamlayıcı koruma uygulandı. Sorumlu hâlâ mevcut ürün modelindeki serbest metindir; kullanıcı üyeliğine bağlı atama veya kişisel performans takibi eklenmedi.

BPS_OWNER_FORM_CHECK=1: dedicated sentetik talep fixture'ına yalnız kendi talebi/tenant/izinli rol için UPDATE(responsible) hakkı eklendi. Bu ürün RLS kabulü değildir; prod şema/policy değiştirilmedi. Gerçek Auth/Chrome testinde mevcut ismin görünmesi/ilk odak/değişmemiş düğme disabled; temiz Escape; kirli X/Escape/backdrop/İptal; Vazgeç/ikinci Escape; bırakma sonrası eski DB değeri ve tekrar açılış geçti. Yalnız boşluk yazılamadı. PATCH'e 503 verildiğinde önceki DB değeri ve girilen yeni isim korundu. Retry'da iki requestSubmit tek PATCH yaptı; pending input/X disabled, Escape/backdrop etkisizdi. Gerçek güncelleme sonrası liste GET'i 503 olsa da başarı bildirimi vardı; liste-only retry güncel sorumluyu gösterdi. Tekrar açılış yeni sorumlu ile temizdi. NULL sorumlu senaryosu Ata/Enter ile çalıştı. 390 px hata görseli incelendi.

BPS_REQUEST_RECOVERY_CHECK=1 firma loading/error/empty, retry taslak koruma, talep başarılı/liste hatalı ayrımı ve tek kayıt regresyonu geçti. Standart firma ekleme/bekleme, randevu/talep iç firma seçme ve izin reddi de geçti. Kanıt `/private/tmp/bps-company-feedback-LrQSx3`; kendi şirket/talep/Auth kayıtları temizlendi. TypeScript/lint/izole production build başarılı. Tarayıcı geri/yenile/tab kapatma ve kalıcı taslak kapsam dışı. Ürün SQL/migration/push/deploy yok.


## 083 — Talep listesi hafızası, boş durum ve firma geçişi

Talepler useListViewState ile mevcut sekme-local tercihler desenine geçti. Arama ve durum/öncelik/firma filtreleri kullanıcı/tenant/rol/list key ile sessionStorage'da saklanır; auth ve tercih yüklemesi tamamlanmadan eski görünüm gösterilmez. SearchInput kontrollü value/key, 512 karakter sınırı ve clear ref kullanır. Tercihler veri yetkisi/sorgu kapsamı değildir, yalnız görünüm durumudur.

DB okuması başarılı ve talepler gerçekten boşsa Henüz personel talebi yok / İlk talebi oluştur gösterilir. Kayıt var ama arama/filtre eşleşmiyorsa ayrı başlık ve Arama ve filtreleri temizle eylemi vardır. clear() bekleyen debounce'u iptal eder, aramayı boşaltıp odağı döndürür; filtreler varsayılana alınır ve saklanır. Okuma hatası hâlâ ayrı hata/retry olarak kalır.

Detay panelinde firma bağlantısı artık her zaman selectedTalep.company_id UUID kullanır; legacy ID olmayan firmalar da açılır. Next Link ile geçiş, 44 px alt sınır, uzun isim satır kırılması ve isim çözümlenememişse Firma kaydını aç etiketi vardır. Kullanılmayan legacyById snapshot alanı kaldırıldı.

BPS_REQUEST_LIST_CHECK=1 gerçek Auth/dedicated sentetik Supabase/Chrome: iki talep oluşturuldu; arama + üç filtre sonrası tek doğru satır ve reload'da tüm seçimlerin korunması doğrulandı. Firma legacy_mock_id NULL ve dolu durumlarında detay linki aynı UUID'yi kullandı. 390 px/44 px/Enter ile doğru firma açıldı; dialog/body scroll kilidi temizlendi. Geri dönünce arama ve üç filtre korundu. Sonuçsuz arama ekranında debounce sürerken temizleme: input boş, filtreler boş, odak aramada; gecikme sonrası eski arama dönmedi ve reload'da sıfır durum korundu. Sentetik [] yanıtı gerçek boş liste CTA'sını gösterdi ve Yeni Personel Talebi açıldı. Liste/bağlantı kontrolleri DB'deki iki talebi değiştirmedi. Mobil iki görsel incelendi.

BPS_OWNER_FORM_CHECK=1 ve BPS_REQUEST_RECOVERY_CHECK=1 de geçti: 081/082 atama, hata/retry/tek güncelleme, firma dizini ve başarılı kayıt/liste hatası regresyonları. Liste tercihi yardımcı testleri 4/4; TypeScript/lint/izole build başarılı. Kanıt `/private/tmp/bps-company-feedback-FaP8f7`; kendi şirket/talep/Auth verileri temizlendi. Bu tur gerçek role/tenant geçişi ve engelli sessionStorage yeniden tarayıcıda ölçülmedi; mevcut ortak hook ve yardımcı testler kullanıldı. Kalıcı çapraz cihaz tercihi yok. Ürün SQL/migration/push/deploy yok.


## 084 — Mobil talep özeti ve detaydan sorumlu düzenleme

Talepler ilk firma sütunu mobilde 224 px, satır kırılabilen özet içerir: firma, pozisyon, durum, talep/sağlanan/açık kişi sayıları ve 44 px Talep detayı düğmesi. Düğme satır click'ini durdurur ve kaydı açar; klavye için pozisyon içeren erişilebilir adı vardır. Masaüstünde ilave özet/düğme gizlidir, standart tablo sütunları kalır. Mobilde bütün tablonun yatay kaydırılması hâlâ mümkündür; temel bilgi ve detay erişimi ilk sütundadır.

Detay panelindeki sorumlu bölümünde Sorumluyu değiştir, boşsa Henüz sorumlu atanmadı + Sorumlu ata gösterilir. Satır menüsüyle aynı openOwner fonksiyonunu kullanır. Mevcut AssignOwnerModal, detay panelinin üstüne sibling native dialog açar; onun bırakma onayı üçüncü katmandır. Mevcut yazı/yetki ve bildirim davranışı korunur.

İlk gerçek tarayıcı kabulünde sorumlu değiştikten sonra detay kapanış odağının eski satır düğmesine dönmediği bulundu: reload sırasında tablo loading yüzünden unmount olup yeni düğme oluşturur. Mobil düğmeler kayıt ID'siyle ref map'te tutulur; closeDetail sonraki frame'de güncel/bağlı/görünür düğmeye odak verir. Callback eski kullanıcı/tenant/rol context'inde çalışmaz. Normal native dialog odak dönüşü korunur.

BPS_REQUEST_MOBILE_CHECK=1: dedicated sentetik Supabase/gerçek Auth ve Chrome. 10 talep, 7 sağlanan, 3 açık kaydı; masaüstünde ek düğme gizli, 390 px'de tablo scrollLeft=0 ve düğme ekran sınırları içinde/44 px doğrulandı. Enter ile detay açıldı. Detaydan sorumlu formunda mevcut isim/ilk odak; temiz Escape→detay odağı; kirli Escape→onay/Vazgeç; onaylı bırakma→DB değişmedi, parent açık ve scroll kilitli. Gerçek güncelleme tek PATCH; açık panel yeni ismi gösterdi; çocuk kapanışında detay eylemine, parent kapanışında güncel mobil satır düğmesine odak döndü. NULL sorumluda doğru boş mesaj/atama eylemi görüldü. Mobil iki son görsel incelendi.

İlk tur BPS_OWNER_FORM_CHECK=1 (082) geçti; son mobil odak adımında fail kanıtı `/private/tmp/bps-company-feedback-KVHRyU`. Düzeltme sonrası BPS_REQUEST_MOBILE_CHECK + BPS_REQUEST_LIST_CHECK (083) tamamen geçti; son kanıt `/private/tmp/bps-company-feedback-cz0Bxh`. Her iki turun kendi şirket/talep/Auth verileri temizlendi. Son kaynak TypeScript/lint/izole production build başarılı. Auth kapsam değişimi bu tur tarayıcıda ölçülmedi; yeni yetki veya kişisel performans modeli yok. Ürün SQL/migration/push/deploy yok.


## 085 — Sözleşme oluşturma/düzenleme taslak koruması

NewContractModal sekiz alanı başlangıç değerleriyle karşılaştırır: ad, firma, tür, başlangıç/bitiş tarihleri, kapsam, tutar ve sorumlu. Düzenlemede editData, oluştururken boş alanlar ve varsa defaultFirmaId referanstır. Dirty form X/Escape/backdrop/İptal ile ConfirmActionDialog açar; Vazgeç/çocuk Escape alanları korur. Bırakma resetAndClose kullanır, sunucuya yazmaz. Düzenleme açıklaması kayıtlı bilgilerin korunduğunu belirtir.

ModalShell closeDisabled kayıt süresince X'i devre dışı bırakır; önceki synchronous submitting ref engeli ve fieldset disabled korunur. Başarılı submit onClose ile onayı atlayarak kapanır. Oluşturma bildirimi zaten vardı; bu tur tekrar doğrulandı. Düzenleme sayfasının başarı bildirimi/kapsam ve firma dizini yükleme/error akışları bu blokta değiştirilmedi.

BPS_CONTRACT_DRAFT_GUARD_CHECK=1 gerçek Auth/dedicated sentetik Supabase: hem yeni hem düzenleme temiz Escape; kirli X/Escape/backdrop/İptal; Vazgeç sonrası tüm alanların aynı kalması; onay Escape; 390 px; onaylı bırakma ve odağın tetikleyiciye dönüşü geçti. DB'deki kayıt row_to_json ile öncesi/sonrası aynı kaldı ve taslak adıyla yeni satır oluşmadı. Tekrar açılış başlangıç değerlerini verdi. Yedi düzenlenebilir alan tek tek değiştirilip kapanış onayı sınandı; yeni formda firma alanı ayrıca sınandı. Değerleri geri alınca gereksiz onay çıkmadı. Düzenleme firması kilitli kaldı. defaultFirmaId uygulama çağrılarında kullanılmadığından ayrı fixture kurulmadı; karşılaştırmada desteklenir.

BPS_WRITE_FEEDBACK_CHECK + BPS_FORM_DESIGN_CHECK de geçti: görev/randevu/sözleşme label/ilk odak/mobil, Enter, pending alanlar ve X kilidi, aynı anda iki requestSubmit tek POST; tarih kontrolü; pasif firma reddinde taslağın korunması ve doğru firma durumunda retry; sözleşme edit Enter ve kayıtlı sonuç. Sözleşme oluşturma bildirimi ve diğer kayıt regresyonları başarılı.

Kanıt `/private/tmp/bps-company-feedback-z0WiuF`; mobil düzenleme bırakma görseli incelendi. Kendi şirket/sözleşme/görev/randevu/Auth verileri temizlendi. TypeScript/lint/izole production build başarılı. Tarayıcı geri/yenile/tab kapatma, üst bileşen unmount ve kalıcı taslak kapsam dışı. editData/default prop değişiminde mevcut form reset davranışı korundu; bu tur harici eşzamanlı yenileme davranışı yeniden tasarlanmadı. Ürün SQL/migration/push/deploy yok.


## 086 — Sözleşme firma seçicisi hata/toparlama ve sabit düzenleme firması

Sözleşmeler sayfasının genel firma dizini artık account/tenant/role kapsamlı companySnapshot ready/error ve retry sayacı kullanır; auth hazır değilken sorgu başlamaz. Cleanup eski dizin yanıtını reddeder. Sayfa ve NewContractModal PickerFeedback ile loading/error/empty ayrımını gösterir. Form içi Firmaları tekrar yükle aynı formu korur; yükleme/hata sırasında firma seçimi/gönderim kapalı, diğer alanlar ve İptal kullanılabilir. Yeni sözleşmede seçilen firma ready dizinde bulunmalıdır; kaybolan seçimin kimliği disabled açıklama seçeneğinde korunur. Gerçek boş liste önce Firmalar'dan kayıt eklemeyi söyler.

Düzenleme firmasının değişmesi zaten yasaktı. Detay sayfasından tüm firmaları çekme kaldırıldı; firmaOptions yalnız yüklenen sözleşmenin company_id UUID'si ve firmaName değerinden kurulur. Önceden legacy_mock_id ile üretilen option value ile editData.company_id uyuşmadığında select boş görünüyordu. Artık eşleşir ve alakasız genel dizin hatası içerik düzenlemesini engellemez. Düzenlemede form sözleşmedeki company_id eşleşmesini doğrular; sunucu yetki/scope kontrolleri değişmedi.

BPS_CONTRACT_PICKER_CHECK=1 gerçek Auth/dedicated sentetik Supabase/Chrome: genel firma GET'i bekletildi, loading ve kapalı gönderim ölçüldü. 503 hata boş sayılmadı. Retry ad, başlangıç/bitiş, 2500 TL tutar ve kapsamı korudu. Doğru firma/tarihler/tutar/kapsam ile DB tek sözleşme ve oluşturma bildirimi doğrulandı. [] yanıtta boş metni ve firmasız kapalı gönderim geldi; retry düğmesi yoktu. Sonra aynı firmaya legacy ID verildi, genel dizin hata verecek şekilde bırakıldı: düzenleme kilitli doğru UUID ve firma adını gösterdi, genel dizin GET sayısı 0 kaldı, kapsam güncellendi ve firma UUID değişmedi. Sentetik legacy değişikliği test bitiminde geri alındı. Mobil hata görseli incelendi.

BPS_CONTRACT_DRAFT_GUARD_CHECK + BPS_WRITE_FEEDBACK_CHECK + BPS_FORM_DESIGN_CHECK de geçti: 085 taslak, dört kapanış yolu, alan koruma, eski değerlere dönüş ve DB değişmemesi; Enter, pending/X kilidi, tek POST, tarih hatası, pasif firma reddi/retry ve edit kayıt regresyonları. Kanıt `/private/tmp/bps-company-feedback-EXLQv1`; kendi şirket/sözleşme/görev/randevu/Auth verileri temizlendi. TypeScript/lint/izole build başarılı.

Sınır: bu blok yalnız firma dizini ve edit firma sunumunu kapsar. Sözleşme liste/detay okuma akışlarının tamamı ve yazı callback'lerinin kapsam değişimi/geç yanıt yönetimi yeniden tasarlanmadı; bunlar ayrı inceleme adayıdır. Gerçek scope değişimi ve kaybolan seçili ID senaryosu bu tur tarayıcıda ayrıca ölçülmedi. Ürün SQL/migration/push/deploy yok.


## 087 — Sözleşme listesi yenileme ve geç yanıt koruması

Sözleşmeler listesi rows/names/legacy tek snapshot ve scoped readState kullanır. Her reload artan generation ve mevcut context nesnesini doğrular; auth hazır değilken başlamaz. Satır sorgusu ile firma isimleri tamamlanmadan yeni veri görünmez. Eski başarı veya hata daha yeni isteğin sonucunu değiştiremez. Listeyi yenile düğmesi beklemede disabled, yükleme role=status; status chip'leri yükleme/hata sırasında gizlenir. Filtreler korunur.

Context kullanıcı/tenant/role anahtarından üretilen nesnedir; aynı anahtara geri dönüşte nesne değişir. Kapsam değişiminde snapshot/create/preview temizlenir ve bildirim kaldırılır; eski cleanup generation'ı geçersiz kılar. NewContractModal scope key kullanır, onClose ve create callback'i yazı öncesi/sonrası/reload sonrası context denetler. Başarılı kayıt bildirimi sonraki liste hatasından ayrıdır; tekrar deneme yalnız okumayı tekrarlar.

BPS_CONTRACT_REFRESH_CHECK=1 gerçek Auth/dedicated sentetik Supabase/Chrome: eski liste GET başarı ve 503 yanıtları ayrı ayrı bekletildi; bu sırada yeni sözleşme oluşturulup liste yenilendi. Eski yanıt geldiğinde yeni kayıt kaybolmadı/hata gösterilmedi. Firma isimleri GET'i tutulduğunda tablo görünmedi; isim hatası gerçek hata/retry gösterdi ve filtre korundu. Create sonrası yalnız liste GET'i hata verdiğinde başarı mesajı kaldı ve retry sonrası DB tek satırdı. 320/390/1280 taşma kontrolü geçti. Yenileme düğmesine self-start verildi, yüksek filtre alanıyla dikey uzaması önlendi.

contract-scope-workspace.tsx yalnız geçici kabul snapshot'ına /qa-contract-scope olarak kopyalandı; gerçek ürün rotası değildir, production build'e dahil değildir. Sentetik profiles rolü ve AuthProvider refreshSession üzerinden yönetici→operasyon değişimi sırasında eski GET bekletildi: form kapandı, rolün filtreleri ayrı/başlangıç oldu, güncel DB adı okundu, eski yanıt güncel adı değiştirmedi. Yazı gerçekten commit edildikten sonra response tutulup yönetici→operasyon→yönetici yapıldı. Yeni formda Yeni bağlam taslağı yazıldı; eski saved response serbest bırakılınca form kapanmadı, taslak korunup eski başarı bildirimi gösterilmedi.

İlk kabulde rol değişiminde filtreler sıfırlanınca kayıt ilk sayfa dışında kaldı; test yanlış biçimde filtre uygulamadan hücreyi bekledi. Kanıt `/private/tmp/bps-company-feedback-HYZ2L4`. Test yeni kapsamın boş aramasını doğrulayıp sonra query uygulayacak şekilde düzeltildi. Son kabul `/private/tmp/bps-company-feedback-5uh1uo`; BPS_CONTRACT_PICKER_CHECK (086) de geçti. Son mobil görsel incelendi. İki turun kendi şirket/sözleşme/Auth verileri temizlendi. TypeScript/lint/izole production build başarılı. Gerçek tenant/user değişimi ayrıca çalıştırılmadı; aynı scope deseninin rol değişimi ölçüldü. Sözleşme detay sayfasının okuma/yazı callback'leri bu blokta değiştirilmedi. Ürün SQL/migration/push/deploy yok.


## 088 — Sözleşme detay geri bildirimi ve kapsam koruması

Auth çözülmeden veya erişim dışı rolde ContractWorkspace mount edilmez. Kayıt/user/active_tenant/role key değiştiğinde instance sıfırlanır; unmount active ref'ini kapatır. A→B→A eski instance'ı canlandırmaz. Read generation tüm ana/bağlı görev/randevu/PDF dönüşlerini korur; sözleşme ve firma adları beraber gösterilir. Firma bağlantısı canonical company UUID kullanır. Ana hata “Sözleşme yüklenemedi” ve tekrar deneme; gerçekten null sonuç “Sözleşme bulunamadı”dır. Bağlı işler hata sırasında boş gösterilmez. Bölüm retry şimdilik bütün detay verisini yeniden okur.

Durum/yenileme/content yazıları ortak pending ref ile seri hale gelir; durum, yenileme, düzenleme ve silme düğmeleri beklemede devre dışıdır. Başarılı yazı formu kapatıp bildirim gösterir; sonraki read hatası bu başarıyı silmez ve retry yeniden yazmaz. Edit yazı hatası formdaki taslağı korur. Eski callback'ler güncel formu kapatamaz, router.refresh/notice çalıştıramaz. Silme aynı pending sınırını paylaşır, sonucu anahtarlı tutar; hata confirm dialog'da kalır, doğrulanmış silme sonucuna odak gider. PDF signed URL ve yayın callback'i de eski instance'ta ekrana etki etmez. Başlamış ağ yazıları iptal edilmez; sunucu yetkisi/RLS otoritedir.

Kabul: BPS_CONTRACT_DETAIL_CHECK=1, helpers/contract-detail-acceptance.mjs. Ayrılmış sentetik Supabase + gerçek Auth + Chrome ile ana GET failure/retry, bağlı tasks/appointments bekleme→hata→retry→empty, tek bekleyen PATCH ve rakip kontroller, status/renewal DB sonuçları, edit failure taslağı, başarılı PATCH sonrası GET failure + ayrı notice + read-only retry, 320/390/1280 kontrolleri geçti. Mobil screenshot incelendi. Snapshot-only /qa-contract-detail/[id] üzerinden gerçek rol yönetici→operasyon→yönetici değişimi, bekleyen eski GET ve gerçekten commit edilmiş gecikmiş edit response ile ölçüldü; yeni taslak ve güncel veri korundu. Delete transport failure satırı/confirm'i korudu, tekrar deneme DB silmesini ve sonuca odaklanmayı doğruladı. 086 BPS_CONTRACT_PICKER_CHECK de geçti. Son kanıt /private/tmp/bps-company-feedback-6vdWmK; runner exit 0 ve kendi şirket/sözleşme/Auth cleanup başarılı.

Test düzeltmeleri: HtHmSQ turunda bağlantının erişilebilir adındaki “→” eksik seçilmişti; 7VzhdQ turunda sunucudan teyit alan controlled checkbox için anında check() yerine click + DB/yeniden render isChecked doğrulaması gerekti; IXiJnc turunda error injection yazı öncesi visibility GET'ini de engelliyordu, yalnız PATCH commit sonrası GET'e sınırlandı. Bu ilk turların da kendi verileri temizlendi. Kaynak kodu bu test düzeltmeleri sırasında değişmedi.

Doğrulama sınırı: gerçek tenant/user geçişi, gecikmiş delete response ve PDF upload akışının tamamı bu blokta ayrıca çalıştırılmadı; gerçek rol geçişi ölçüldü. TypeScript ve izole production build geçti. `npm run lint` ESLint yapılandırma sihirbazı açıp exit 1 verdi; bağımsız lint başarısı iddia edilmiyor (build'in “Linting and checking validity of types” satırı bunun yerine kanıt değildir). Ürün SQL/migration/push/deploy yok. Test route yalnız geçici snapshot'ta, üretim build'inde bulunmaz.


## 089 — Sözleşme bağlı işlerinde bağımsız tekrar deneme

088 sonrasında bölüm tekrar denemesinin tüm detayı loading ekranına aldığı görüldü: bu sırada PdfUploadPanel unmount olur, henüz yüklenmemiş dosya seçimi kaybolur. Plan bu iki bölümün tekrar denemesini yerelleştirmek ve komşu form/dosya durumuna dokunmadığını ölçmekti. Görev/randevu için ayrı reloadTasks/reloadAppointments eklendi. Her okuyucu yalnız kendi loading/error/rows durumunu değiştirir; kendi generation'ı, üst readGeneration ve active instance koşuluyla yanıt uygular. Ana reload bu okuyucuları çağırır; daha eski bölüm yanıtı yeni ana yüklemeyi veya kapsamı değiştiremez. PDF ve ana kayıt yenilemesi bu blokta yeniden tasarlanmadı.

BPS_CONTRACT_DETAIL_CHECK genişletildi: iki bölümün ilk GET'i tutulup 503 döndürüldü, ardından ana PDF panelinde sentetik dosya seçildi. Retry GET'i de tutuldu; bu sırada sözleşme düzenleme açılıp kapsam taslağı yazıldı. Yanıt sonrası dosya seçimi ve açık taslak korundu. Browser request sayacı her bölüm için tam [['GET','/rest/v1/tasks']] veya appointments gördü; başka REST isteği yoktu. Dosya yalnız tarayıcıda seçildi; upload yapılmadı. Ayrıca eski tasks/appointments GET'i beklerken ana detay yenilendi; yeni empty sonucu geldikten sonra eski 503 serbest bırakıldı ve yeni sonuç error'a dönüşmedi.

088 regresyonları aynı turda geçti: ana hata/retry, doğru firma UUID bağlantısı, durum/yenileme tek yazı, edit hata/taslak ve başarılı edit + başarısız reload ayrımı, read-only retry, gerçek rol A→B→A gecikmiş GET/commit edilmiş PATCH, silme hata/retry/focus, 320/390/1280. Son kanıt /private/tmp/bps-company-feedback-0pXlK2; mobil PDF seçimi görseli incelendi. Runner exit 0; kendi şirket/sözleşme/Auth kayıtları temizlendi. TypeScript ve izole production build exit 0. Bağımsız lint yapılandırması hâlâ eksik, geçiş iddiası yok. Ürün SQL/migration/push/deploy yok.

Sınır: koruma bağlı görev/randevu bölüm retry'leri içindir. Ana kayıt/PDF yenilemesi, kapsam değişimi veya sayfadan ayrılma dosyayı tarayıcıdan geri getirmez. Gerçek PDF upload ve gerçek tenant/user değişimi bu tur ayrıca çalıştırılmadı.


## 090 — Sözleşmeden bağlı göreve doğrudan geçiş

İncelemede sözleşme detayındaki her görev bağlantısının yalnız /gorevler sayfasına gittiği görüldü; kullanıcı seçtiği görevi tekrar aramak zorundaydı. Plan mevcut 072 task-link sözleşmesini bu kaynağa bağlamak, filtreleri bozmadan doğru hedefin açıldığını ve mobil kartları ölçmekti. Kartlar taskLinkHref(g.id) kullanır; hedef yalnız başarılı yüklenen güncel kapsam görev listesinde çözülür. Yeni backend veya yetki yolu açılmadı. Başlık + durum + Görevi aç eylemi, min-h-11 hedef, görünür klavye odağı, min-w-0/break-words ve shrink-0 durum etiketi var.

BPS_CONTRACT_TASK_LINK_CHECK gerçek Auth/dedicated sentetik Chrome: aynı sözleşmeye iki farklı statüde görev ve aynı firmaya sözleşmeyle ilişkisiz üçüncü görev oluşturuldu. Kartlarda yalnız iki ilgili kayıt göründü; her href kendi UUID'sini taşıdı. Görevler listesinde önceden kaydedilmiş eşleşmeyen arama/iptal filtresi varken ilk kart Enter ile doğru açık görevi açtı. Panel kapanınca filtreler korundu, browser back sözleşmeye döndü. İkinci kart tamamlanmış görevi açtı. 320/390/1280 kart boyutu/taşma ve uzun kesintisiz başlık ölçüldü, 390 görseli incelendi. Kaynak kart DOM'da kaldıktan sonra yalnız testin hedef görevi DB'den silindi; bağlantı başka görevi açmayıp bulunamadı/erişim yok mesajı verdi. Gezinme PATCH/DELETE sayacı 0; testin silmesinden önce üç görev satırı başlangıç snapshot'ıyla aynıydı.

BPS_TASK_LINK_CHECK regresyonu da geçti: randevu kaynağı, Enter/mobile/back, yanlış/eksik ID, diğer query parametresini koruma, okuma hatasını bulunamadı saymama ve retry. Task-link unit 3/3; TypeScript ve izole production build exit 0. Kanıt /private/tmp/bps-company-feedback-zlTIZQ; tüm kendi sentetik şirket/görev/sözleşme/randevu/Auth kayıtları temizlendi. Bağımsız lint yapılandırma eksikliği sürüyor, lint başarısı iddia edilmiyor. Ürün SQL/migration/push/deploy yok.

Sınır: bu blok sözleşme→görev bağlantısıdır. Sözleşme→randevu kartları hâlâ genel randevu listesine gider; randevu için tek kayda bağlantı protokolü ayrı dilimdir. Dosya seçimi gezinme boyunca saklanmaz. Rol/tenant değişimi bu tur ayrıca çalıştırılmadı; hedef çözümleyici mevcut güncel kapsam listesini kullanır.


## 091 — Sözleşmeden bağlı randevuya doğrudan geçiş

090'ın kalan bağlantı boşluğu ele alındı: sözleşmedeki randevu kartı genel listeye gidiyor, seçili randevu açılmıyordu. Plan UUID bağlantı sözleşmesi, hazır/güncel kapsamdaki listede çözümleme, filtre hafızasının korunması, hata/eksik hedef ayrımı ve mobil kabulden oluştu. appointmentLinkHref/parseAppointmentLink eklendi; yalnız tek geçerli UUID kabul edilir, parse lowercase yapar. AppointmentLinkOpener Suspense içinde çalışır; auth/view gate sonrasında ve snapshot scope/read başarı koşuluyla hedefi açar. onOpen canlı context nesnesini doğrular. router.replace yalnız randevu parametresini kaldırır; diğer query korunur, panel kapanınca tekrar açılmaz.

Sözleşme bağlı randevu kartları doğru href, 44 px hedef, focus ring, tarih/tür/katılımcı/durum ve Randevuyu aç sunar. Uzun katılımcı/sonuç metni kartta sarılır. Görsel inceleme Randevu Detay panelinde uzun kesintisiz katılımcının yatay kesildiğini gösterdi; DL_VALUE break-words ile düzeltildi, panel içi scrollWidth/clientWidth ölçümü eklendi ve son görsel doğrulandı.

BPS_APPOINTMENT_LINK_CHECK: iki farklı sözleşme randevusu ve aynı firmada ilişkisiz randevu; yalnız doğru ikisi kartta görünür. Kaydedilmiş eşleşmeyen arama/iptal filtresine rağmen Enter ile doğru detay açılır, Escape sonrası filtreler korunur, back sözleşmeye döner; ikinci kart da kendi kaydını açar. 320/390/1280 kart ve 390 detay kontrolü; invalid/duplicate/missing UUID; koru=1 parametresi; list GET 503'ünde kayıp mesajının çıkmaması ve retry sonrası doğru panel; kart görünürken hedefin yalnız fixture DB'den silinmesi sonrası kayıp hedef; gezinme PATCH/DELETE 0 ve silme öncesi kayıt snapshot'ının değişmemesi ölçüldü.

İlk tur /private/tmp/bps-company-feedback-1LGvgx: eski local-appointments fixture, contracts henüz yokken contract_id IS NULL kuralıyla kurulmuştu. Ürün şeması 20260407000700_create_appointments.sql nullable FK + ON DELETE SET NULL kullanıyor. Yeni local-contract-appointments.sql iki tablo marker'ını doğrulayıp yalnız dedicated sentetik DB'de NULL kısıtını gerçek ilişkiyle değiştirir; production migration değildir. Tamamlanmış sentetik randevu için zorunlu result/next_action değerleri verildi. İkinci tur YhgTtY hem 091 hem 090 görev bağlantısı regresyonunu geçti; görselde panel kesilmesi fark edildi. Son kaynakla 091 kabulü /private/tmp/bps-company-feedback-8OFzdg exit 0; tüm turların kendi şirket/randevu/görev/sözleşme/Auth kayıtları temizlendi. TypeScript, appointment/task link unit toplam 6/6, son izole production build başarılı. Bağımsız lint yapılandırma eksikliği sürüyor.

Sınır: bu dilim mevcut ilişkili randevuya gezinmedir; yeni randevuyu sözleşmeye bağlayan oluşturma formu eklenmedi. RLS/sunucu yetkisi değişmedi; rol/tenant değişimi ayrıca bu yeni bağlantı için ölçülmedi. Ürün SQL/migration, push, deploy veya üretim veri işlemi yok.


## 092 — Firma sekme hafızası ve randevuya geçiş

Firma detayında randevu satırları yalnız metindi. 091 bağlantısı bu kaynağa da taşındı; kartlar appointmentLinkHref ile doğru randevuyu açar, başlık/katılımcı sarılır, durum ayrı tutulur, 44 px hedef ve klavye odağı vardır. Planın ikinci kısmı geri dönüşte firma sekmesinin kaybolmamasıydı. Mevcut useListViewState, firma-sekme namespace ve companyScope (URL id/user/tenant/role) ile kullanıldı. Auth/tercih hazır olmadan sekme düğmeleri disabled; hazır olduğunda yalnız role göre visibleTabs içindeki tercih gösterilir. Bozuk/bilinmeyen veya gizli sekme Genel Bakış'a düşer. Bu bir UI tercihi, veri yetkisi değildir.

İlk kabul /private/tmp/bps-company-feedback-aGvsYZ geçti; görsel seçili Randevular sekmesinin mobil yatay şerit dışında kaldığını gösterdi. Ortak TabNavigation activeTab değişiminde ve ResizeObserver ile şerit boyutu değişiminde seçili düğmeyi yatay scrollLeft ile görünür yapar; sayfayı dikey kaydırmaz. Kabulde seçili düğmenin şerit sınırları içinde olması 320/390/1280 ve back/reload sonrasında ölçüldü. Son mobil görsel incelendi.

BPS_COMPANY_APPOINTMENT_LINK_CHECK: gerçek Auth/dedicated sentetik DB; firma randevu kartından Enter ile doğru detay, önceden kaydedilmiş randevu filtrelerinin korunması, back/reload'da kaynak Randevular sekmesi, başka firmada Genel Bakış varsayılanı ve geri dönünce eski seçim. Gerçek profiles rolü görüntüleyici yapılıp o role ait sessionStorage'a randevular tercihi enjekte edildi: yalnız Genel Bakış düğmesi ve içeriği kaldı. Yöneticiye dönünce kendi eski seçimi geri geldi. Yönetici tercihine unknown-tab yazılınca Genel Bakış açıldı; geçerli seçim tekrar çalıştı. Gezinme PATCH/DELETE 0, randevu satırı başlangıçla aynı. Son kabul /private/tmp/bps-company-feedback-PgjeCx exit 0; iki turun kendi şirket/randevu/Auth kayıtları temizlendi. Liste tercihleri + appointment-link unit toplam 7/7; TypeScript ve son izole production build geçti. Bağımsız lint yapılandırma eksikliği sürüyor.

Sınır: tercih sessionStorage'dadır; cihazlar arasında veya tarayıcı sekmesi kapanınca garanti edilmez. UUID ve legacy URL kimlikleri aynı firma için ayrı tercih anahtarı oluşturabilir. Gerçek tenant/user geçişi bu tur ayrıca ölçülmedi; gerçek rol ayrımı ölçüldü. Firma detayındaki eski randevu okuma/yazma callback'leri, loading/error truth ve diğer modüllerin async kapsamı bu blokta yeniden tasarlanmadı. Ürün SQL/migration/push/deploy yok.


## 093 — Firma randevularında doğru yükleme/hata ve kayıt geri bildirimi

Firma randevuları eski effect'te diğer okumalara bağlıydı; yüklenirken sıfır/boş görünüyordu ve hata sonrası sayfa yenilemesi isteniyordu. Oluşturma callback'i eski scope'ta yeni form/listeye müdahale edebiliyordu. Plan randevu okumasını ayırmak, tek scoped snapshot ile genel bakış ve sekmeyi beslemek, bölüm retry'si ve ölçülmüş kayıt bildirimi eklemekti.

appointmentContext companyScope/auth-ready temelinde nesne kimliği taşır; live ref ve generation her okuma öncesi/sonrası kontrol edilir. Snapshot yalnız aynı context'te görünür; auth hazır değilken sorgu başlamaz. Context değişimi formu ve bildirimi temizler; cleanup eski okuma generation'ını geçersiz kılar. A→B→A aynı string'e dönse de eski context nesnesi geçerli olmaz. AsyncSection hem Yaklaşan Randevular kartı hem Firma Randevuları için loading/error/ready ayrımı yapar. Retry yalnız randevu okuyucusunu çalıştırır, öteki firma bölümlerini yeniden mount etmez.

Yeni randevu callback'i başlangıçta context ve seçilen gerçek firma ID'sini doğrular, yanıt sonrası tekrar context kontrol eder. Başarılı kayıt formu kapatır, Randevular sekmesine geçer, başarı bildirir ve scoped reload yapar. Başarılı kayıt sonrası read hatası tekrar create gönderimine dönüşmez. onClose da eski context'te yeni formu kapatamaz. Diğer şirket aksiyonlarının callback'leri değiştirilmedi.

BPS_COMPANY_APPOINTMENT_RECOVERY_CHECK gerçek Auth/dedicated sentetik Chrome: ilk GET tutulup genel bakışta sayı/planlanmış yok metninin, sekmede boş başlığın çıkmadığı görüldü. 503 iki yüzeyde hata/retry gösterdi; retry doğru kaydı getirdi. Eski GET başarı ve hata yanıtları ayrı ayrı tutulurken yeni randevu oluşturuldu; eski dönüş yeni listeyi bozmadı. Create başarılı, sonraki GET başarısız koşulunda başarı bildirimi kaldı; retry sonrası DB'de tek satırdı. Snapshot-only /qa-company-scope/[id] üzerinden commit edilmiş create response tutulup gerçek yönetici→operasyon→yönetici yapıldı; yeni taslak kapanmadı/değişmedi ve eski başarı bildirimi çıkmadı.

092 regresyonu (firma/randevu linki, sekme hafızası, firma ayrımı, rolün gizli sekme tercihini reddetmesi, 320/390/1280 ve klavye) aynı turda geçti. Son kanıt /private/tmp/bps-company-feedback-4pTmky, hata görseli incelendi; runner exit 0 ve kendi şirket/randevu/Auth cleanup başarılı. TypeScript ve son kaynakla izole production build başarılı. Bağımsız lint yapılandırma eksikliği sürüyor. QA route ürün build'inde bulunmaz.

Sınır: bu blok firma randevusu okuması ve oluşturma callback'idir. Firma talepleri, iş gücü, evrak ve diğer genel bakış sayılarının loading/error doğruluğu ayrı inceleme konusudur. Gerçek tenant/user geçişi ayrıca ölçülmedi; gerçek rol değişimi ve aynı scope içindeki geç sorgular ölçüldü. Ürün SQL/migration/push/deploy yok.


## 094 — Firma talep ve iş gücü özetlerinde doğru veri durumu

093 incelemesinde kalan iki sessiz catch kaldırıldı: talep okuyucusu hata sonucunu [] yapıyor, iş gücü okuyucusu null'a çeviriyordu; genel bakış bunları tüm talepler karşılanmış/0 personel gibi gösteriyordu. Plan ayrı loading/error/data durumları, bağımsız retry, context koruması ve gerçek boş kayıt metniydi.

useScopedResource(scope, reader) eklendi; memoize reader ve scope yeni context nesnesini belirler. Her reload artan generation/live context kontrol eder, cleanup eski yanıtları geçersiz kılar. Null scope'ta okuma başlamaz; eski context'in snapshot'ı görünmez. Firma detayında useCallback ile sabitlenmiş iki service reader kullanılır. Genel bakış ve ilgili sekmeler AsyncSection ile aynı kaynağı paylaşır; talep grafiği yükleme/hata durumunda çizilmez. Gerçek talep yokluğunda “Bu firmaya ait talep kaydı yok”; dolu veri kümesinde hesaplanan açık sıfırsa “Açık personel ihtiyacı görünmüyor” gösterilir. İş gücü summary null ise 0 sayısı uydurulmaz, kayıt yok mesajı gösterilir. Gerçek current_count=0 satırı varsa sayısal 0 hâlâ geçerli veridir.

BPS_COMPANY_STAFFING_CHECK: marker korumalı local-workforce-summary.sql yalnız dedicated DB'de aggregate tablo, sayım kontrolleri, company cascade FK ve tenant/rol sınırlandırılmış SELECT fixture'ı kurar; prod migration değildir. Mevcut sentetik request fixture da kullanılır. Talep 10/6 ve iş gücü hedef 10/mevcut 8 kayıtlarıyla her GET ayrı bekletilip 503 verildi; genel bakış/sekme loading ve error ayrımı, sıfır/başarı cümlesinin yokluğu ölçüldü. Retry diğer domain'in tablosunu tekrar okumadı ve gerçek değerleri getirdi. Eski başarılı GET tutulurken DB sayıları değiştirildi, gerçek rol yönetici→operasyon yapıldı; yeni 7 açık/9 mevcut sonucu geldi, eski GET geri alamadı. Sonra kendi kayıtları silinip başarılı boş okumada doğru açıklamalar ve sekme empty durumları doğrulandı; UI PATCH/DELETE 0.

Son kabul /private/tmp/bps-company-feedback-nEY7a1 exit 0. 092 firma sekme hafızası/randevu bağlantısı/rol enjeksiyonu/mobil regresyonu da geçti; boş özet 390 görseli incelendi. Kendi talep/iş gücü/şirket/randevu/Auth verileri temizlendi. TypeScript ve izole production build geçti; bağımsız lint yapılandırma eksikliği sürüyor.

Sınır: workforce_summary mevcut toplu kaynaktır; bu blok canlı personel vardiyalarından yeniden hesaplama veya yazma ekranı eklemez. Gerçek tenant/user değişimi ve aynı anahtara dönüşte bekleyen yanıt bu yeni hook için ayrıca ölçülmedi; gerçek rol A→B geçişi ölçüldü. Firma evrakları ve diğer kartların veri durumu ayrı inceleme konusudur. Ürün SQL/migration/push/deploy yok.


## 095 — Firma evrak okuması ve doğru genel bakış durumu

Plan: Evraklar sekmesinde mevcut loading/error ayrımını genel bakışa da taşımak, sıfır kayıt için tüm evraklar tamam iddiasını kaldırmak ve scope değişiminde eski evrak yanıtını reddetmek. Eski docsGeneration/string karşılaştırması useScopedResource ile değiştirildi. Auth hazır değilken veya evrak erişimi kısıtlı rolde null scope okuyucuyu başlatmaz. Genel bakış ve sekme aynı kaynak ve retry kullanır; context nesnesi ve generation eski yanıtı görünür snapshot'a sokmaz.

Kart adı Evrak Takibi, sayı etiketi takip gerektiren belge oldu. Sayım saklanan status != tam üzerinden yapılır; eksik, süresi yaklaşan ve süresi dolan kayıtları kapsar. Başarılı boş okuma “Bu firmaya ait belge kaydı yok.”; dolu ama tüm status değerleri tam olduğunda “Kayıtlı belgelerde takip gerektiren durum yok.” gösterilir. Kısıtlı erişim mesajı sayıdan önce ayrılır. Bu özellik zorunlu belge checklist'i veya tarih bazlı otomatik uygunluk denetimi değildir.

BPS_COMPANY_DOCUMENT_CHECK yalnız mevcut marker korumalı dedicated sentetik documents tablosuna kendi şirketi için üç metadata satırı ekler; storage dosyası oluşturmaz. Gerçek Auth/Chrome kabulü: GET tutulurken iki yüzeyde loading ve sahte empty/sayı yokluğu; 503 sonrası iki yüzeyde hata; overview retry ile iki takip kaydı ve tabda üç belge; tamamlanmış eski GET tutulurken DB'de eksik→tam değişimi; gerçek yönetici→operasyon→yönetici boyunca yeni 1 değerinin okunması; eski 2 sonucunun aynı role dönüldükten sonra da reddi. Ardından tüm kayıtlar tam ve hiç kayıt yok durumları ayrı doğrulandı. Gerçek görüntüleyici rolünde yeniden açılışta bu şirket için documents GET 0 ve sayı yok; UI PATCH/DELETE 0. Mevcut 092 randevu bağlantısı/sekme hafızası/rol tercihi/mobil regresyonu aynı turda geçti.

Son kanıt /private/tmp/bps-company-feedback-bvmx3E, exit 0; kendi şirket/evrak/randevu/Auth kayıtları temizlendi. 390 px hata ve boş kart görüntüleri incelendi, sayfa yatay taşmadı. TypeScript ve git diff --check geçti. İlk izole build sandbox DNS nedeniyle Google Fonts indiremedi; ağ erişimli tekrar son kaynakla başarılı oldu. Bağımsız lint yapılandırma eksikliği sürüyor; build çıktısı bağımsız lint kanıtı sayılmadı. QA route yalnız kabul snapshot'ında, ürün build'inde yok.

Sınırlar: belge yükleme/silme/indirme callback'lerinin tüm kapsam davranışı bu blokta değiştirilmedi; gerçek kullanıcı/tenant değişimi ayrıca ölçülmedi. Gecikmiş GET başarı yanıtı A→B→A test edildi; bu turda gecikmiş hata varyantı ayrı çalıştırılmadı. Mobil kanıtta Son Notlar kartı, yerel minimal fixture'da notes tablosu bulunmadığından ham servis hata metni gösteriyor; evrak testi için bu alan başarılı sayılmadı. Sıradaki UX incelemesi notların loading/error/retry ve kullanıcıya uygun hata bildirimi. Ürün SQL/migration/push/deploy yok.


## 096 — Firma notlarında okunabilir hata, retry ve eski yanıt koruması

095 mobil incelemesi Son Notlar kartının ham notes select failed/schema cache metnini kullanıcıya çıkardığını gösterdi. Kod incelemesinde reloadNotlar'ın scope/generation koruması olmadığı, retry sunmadığı ve Notlar sekmesinin hata ile Not yok mesajını birlikte gösterebildiği bulundu. Plan iki yüzey için ortak scoped okuma, teknik ayrıntı içermeyen hata/retry, gerçek boş durum ve eski yanıt korumasıydı.

Firma notları useScopedResource'a taşındı. Auth hazır değilken veya görüntüleyici/muhasebe rolünde okuyucu başlamaz; servis ve RLS yetkilendirmesi aynen devam eder. Son Notlar ve Firma Notları AsyncSection üzerinden aynı loading/error/data kaynağını kullanır. Overview yalnız başarılı listenin ilk üçünü, service sırası olan pinned-first/newest-first ile gösterir; tam liste Notlar sekmesindedir. Tekrar deneme yeni okuma başlatır. Uzun metinlere whitespace-pre-wrap/break-words eklendi; etiket seçicisine erişilebilir ad verildi.

Eski notlarError hem okuma hem pin hatası taşıyordu. Pin hatası ayrı context etiketli action error olarak ayrıldı; kullanıcıya Türkçe mesaj verir ve okunmuş not listesini saklar. Pin handler başlangıç/yanıt/refetch sonrasında live context doğrular; kapsam değişimindeki eski action sonucu görünmez. Başarılı pin + başarısız reload pin hatası sayılmaz; bölüm retry'si kullanılabilir. Yeni pin pending kilidi, create/edit modal callback'leri ve draft koruması bu blokta yapılmadı.

BPS_COMPANY_NOTES_CHECK yalnız dedicated marker korumalı local-notes-feedback.sql fixture'ını kullanır. Fixture mevcut ürün sütunları, blank/tag kontrolleri ve company cascade FK'siyle minimal tablo kurar; verified tenant + manager/operasyon/ik SELECT, manager UPDATE sağlar. Tam prod policy kopyası değildir, CREATE/DELETE uygulama yetkisi vermez. Sentetik dört not SQL ile eklenip tarayıcı gerçek Auth ile okudu. GET beklerken iki yüzeyde loading ve sahte empty yokluğu, 503'te ham mesajın DOM'a çıkmaması, iki yüzeyde error ve overview retry doğrulandı. Eski tarihli pinned kayıt önce, ardından son iki kayıt overview'da; dört kayıt sekmede görüldü. 390 px uzun kesintisiz notta yatay taşma olmadı, hata ve liste görüntüleri incelendi.

Başarı ve hata GET yanıtları ayrı ayrı tutuldu; her turda DB içerik değiştirildi ve gerçek yönetici→operasyon→yönetici geçişi yapıldı. Yeni içerik iki rolde okundu; eski yanıt dönüşte yeni listeyi bozmadı. Pin PATCH 503 ile başarısızken liste kaldı ve teknik metin gösterilmedi. Sonraki pin başarılı olup reload 503 olduğunda DB is_pinned=false doğrulandı, pin hata mesajı yoktu; bölüm retry'si güncel notu getirdi. Kendi notları silinip gerçek empty doğrulandı; görüntüleyici rolünde notes GET 0 ve Son Notlar kartı yok. 095 evrak read/mobil/rol/regresyon testleri aynı turda geçti.

Son kanıt /private/tmp/bps-company-feedback-wwlPil, exit 0. Kendi şirket/not/evrak/randevu/Auth kayıtları temizlendi. TypeScript, git diff --check ve izole production build geçti; bağımsız lint yapılandırması eksikliği sürüyor. QA route ürün build'inde yok. Ürün SQL/migration/push/deploy yok.

Sınırlar: gerçek kullanıcı/tenant geçişi ayrıca ölçülmedi; scope geçişi gerçek rol üzerinden ölçüldü. Pin callback'in geç yanıt varyantı ayrıca test edilmedi, pin başarısızlığı ve başarılı yazı/başarısız read ayrımı test edildi. Not formunun kaydetme bildirimi, gecikmiş create/edit callback'i, kapsam değişiminde taslak ve küçük ikon aksiyon hedefleri sıradaki inceleme. Etiket filtreleme mantığı değiştirilmedi; pinned notlar mevcut davranışla filtreden bağımsız gösterilmeye devam eder.


## 097 — Firma notunda taslak koruması ve kayıt sonucu

096 sonrası incelemede QuickNoteModal'ın Escape/arka plan/kapat düğmesiyle kaydetme sırasında kapanabildiği, kirli taslak için kontrol yapmadığı ve callback yoksa demo console çıktısıyla başarı gibi kapanabildiği görüldü. Firma parent callback'i başarılı yazıdan sonra reload bekliyordu ve eski role ait sonuçlar yeni taslağı etkileyebiliyordu. Plan not formunu diğer ürün formlarının etkileşim düzenine taşımak, gerçek kayıt sonucunu bildirmek ve create/edit yanıtlarını scope'a bağlamaktı.

QuickNoteModal her açılışta ayrı NoteDraft mount eder; onSubmit zorunlu, demo fallback kaldırıldı. Form/fieldset, textarea ve select label bağlantısı, ilk alan odağı, native çok satırlı Enter, min 44 px butonlar ve kaydetme status metni var. Synchronous submitting ref tekrar gönderimi ve kapanmayı engeller; ModalShell closeDisabled Escape/arka plan/kapat yollarını kapatır. Değişmiş taslak için Kaydedilmemiş değişiklikler dialog'u açılır; Vazgeç veriyi tutar, Değişiklikleri bırak kapatır. Edit'te başlangıç içeriği/etiketiyle karşılaştırılır; yeni notta öneriden gelen dolu metin de taslak sayılır. Unmount sonrası asenkron modal sonucu state/onClose çalıştırmaz.

Firma detayında açık form boolean yerine noteContext nesne kimliğine bağlıdır; context değiştiği render'da eski form görünmez. Kayıt türü/kimliği key ile ayrılır. Context effect'i not/düzenleme/öneri alanlarını ve etiket filtresini temizler. Create/edit callback başlangıçta ve yanıt sonrasında live context doğrular. Başarılı kayıt formu kapatır, Notlar sekmesine geçirir, filtreyi sıfırlar ve Not firmaya eklendi / Not güncellendi bildirir; liste okuması bağımsız başlar. Yazı başarısızlığında genel Türkçe hata gösterilir, ham backend mesajı modal dışına taşınmaz. Yetkilendirme mevcut server action/service/RLS tarafında kalır. Not satırı düzenle ikonuna erişilebilir ad, pin/edit aksiyonlarına 44×44 hedef, mobilde dikey aksiyon dizilimi ve metadata satır sarılması eklendi.

BPS_COMPANY_NOTE_FORM_CHECK mevcut marker korumalı fixture'ı INSERT politikasıyla genişletir: verified tenant, author_id=auth.uid() ve yönetici/operasyon/ik rolü gerekir. Bu yalnız dedicated yerel fixture'dır; UPDATE fixture'ı hâlâ yönetici ile sınırlıdır, prod self-edit policy'sini temsil etmez. Gerçek Auth/Chrome testinde boş form focus/disabled submit, Enter'ın satır açması, etiket ve taslağın Escape→Vazgeç ile kalması, X→bırak ile silinmesi ölçüldü. Create POST tutuldu; alanlar ve kapat düğmesi disabled, Escape/arka plan formu kapatmadı; tek POST/DB satırı ve doğru etiket/başarı bildirimi görüldü. Değişmemiş edit Escape ile sorusuz kapandı. Edit PATCH 503, içerik/etiketi korudu ve teknik mesajı göstermedi. Sonraki tek PATCH başarılı ama GET 503 iken form kapandı/başarı bildirildi; DB içeriği/etiketi doğruydu, retry sadece okuyup PATCH sayısını 1'de tuttu.

Create ve edit için commit edilmiş HTTP yanıtı ayrı ayrı tutuldu. Gerçek yönetici→operasyon→yönetici geçişinden sonra yeni taslak açıldı; eski yanıtın dönüşü taslağı kapatmadı/değiştirmedi ve eski başarı mesajı göstermedi. 390 px form/aksiyon ekranları incelendi, yatay taşma yok, düzenle hedefleri en az 44×44 ölçüldü. 096 not okuma/rol A→B→A success-error/sabitleme hata ayrımı regresyonu aynı turda geçti.

İlk kabul /private/tmp/bps-company-feedback-3OVJwU yalnız testteki getByLabel(Not) seçicisinin kapat düğmesine de uyması nedeniyle durdu; textbox rolü ve tam adıyla düzeltildi, ürün hatası değildi. Sonraki /private/tmp/bps-company-feedback-BXQXf4 geçti. Açık formu context kimliğine bağlayan ek render koruması sonrası son kabul /private/tmp/bps-company-feedback-NLWIA0 exit 0; kendi şirket/not/randevu/Auth kayıtları temizlendi. Son kaynakla TypeScript, git diff --check ve izole production build geçti. Bağımsız lint yapılandırma eksikliği sürüyor. QA route ürün build'inde yok; ürün SQL/migration/push/deploy yok.

Sınır: taslak tarayıcı yenilemesine kalıcı kaydedilmez; kapsam değişiminde temizlenir. Ağ yanıtı tamamen kaybolmuş bir create için backend idempotency anahtarı eklenmedi; test bekleyen tek gönderim ve yanıtı bilinen başarılı kayıt sonrası read retry'si kapsamındadır. Gerçek user/tenant geçişi ayrıca ölçülmedi. Sabitleme işlemi hâlâ ayrı pending kilidi/başarı bildirimi almamıştır; bu sıradaki küçük bloktur. Öneri akışının tamamı veya operasyon/ik sahiplik politikası bu turda yeniden kabul edilmedi.


## 098 — Not sabitlemede pending, sonuç ve işlem kimliği

097 sonunda açık kalan pin aksiyonunda bekleme göstergesi ve tekrar gönderim kilidi yoktu. Plan aynı firma/auth kapsamındaki pin işlemlerini tek bekleyen yazı ile sınırlandırmak, başarıyı görünür kılmak ve eski async finally'nin yeni kapsamın kilidini kaldırmasını engellemekti.

NotePinOperation context nesnesi, not ID ve hedef durumu taşır. notePinFlight ref'i aynı context'te yeni pin başlatmayı senkron engeller; notePinPending yalnız güncel context'te görünür. UI tüm pin/unpin düğmelerini bekleme süresince disabled yapar, hedef düğmeye aria-busy ve bölüm üstüne Notun sabitleme durumu kaydediliyor metni verir. Diğer not işlemleri bağımsız kalır. Başarılı service yanıtında Not sabitlendi / Notun sabitlemesi kaldırıldı mesajı yayınlanır; okuma sürerken kilit devam eder. Okuma başarısızlığı pin hatasına çevrilmez. finally yalnız kendi operasyon ref/state kimliği hâlâ geçerliyse kilidi bırakır; yeni context'teki yeni yazıyı etkileyemez.

BPS_COMPANY_NOTE_PIN_CHECK mevcut dedicated notes fixture'ıyla kendi iki notunu oluşturur. Gerçek Auth/Chrome kabulünde klavye Enter ile pin PATCH tutuldu; iki düğme disabled, hedef aria-busy=true, status görünür ve tek PATCH ölçüldü. Başarı sonrası DB is_pinned=true ve mesaj doğrulandı. Unpin 503 olduğunda okunmuş liste kaldı, genel hata çıktı, kilit kalktı; ham teknik hata gösterilmedi. Sonraki unpin başarılı fakat GET 503 iken DB false, başarı bildirimi ve bölüm read hatası ayrıydı; read retry PATCH sayısını 1'de tuttu.

İki ayrı gecikmiş-yanıt turunda eski pin success (DB commit edilmiş) veya error tutuldu. Gerçek yönetici→operasyon→yönetici sonrası başka not için yeni PATCH de tutuldu. Eski yanıt bırakıldığında yeni işlem hâlâ pending/disabled kaldı, eski başarı veya hata mesajı çıkmadı. Yeni yanıt bırakılınca başarı mesajı/DB true ve açık düğme görüldü. Bu test yalnız eski sonucun veri değiştirmemesini değil yeni operasyon kilidinin old finally tarafından açılmamasını da ölçer.

097 not create/edit/draft/rol A→B→A/mobil regresyonu aynı turda geçti. Kanıt /private/tmp/bps-company-feedback-Y5teu6 exit 0; 390 px pending görüntüsü incelendi, yatay taşma yok. Kendi şirket/not/randevu/Auth kayıtları temizlendi. TypeScript, git diff --check ve izole production build başarılı; bağımsız lint yapılandırma eksikliği sürüyor. Yeni SQL/fixture değişikliği yok; ürün migration/push/deploy yok.

Sınır: kilit aynı sayfa instance'ında ve aynı context'tedir; farklı tarayıcı/operatörler arasında DB kilidi veya revision çakışma sistemi eklenmedi. Rol değişmeden iki notu aynı anda pinlemek engellenir; başka notu yazı tamamlandıktan sonra sabitlemek gerekir. Gerçek tenant/user geçişi ayrıca ölçülmedi. Sıradaki firma yetkili kişileri incelemesinde kalan string scope/generation okuyucusu ve AddContactModal kayıt/taslak davranışı ele alınacak.
