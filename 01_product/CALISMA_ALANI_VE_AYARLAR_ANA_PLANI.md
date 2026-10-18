# BPS — Çalışma Alanı ve Ayarlar ana planı

## Bağlayıcı ürün yönü ve faz sınırı — 18 Ekim 2026

Kullanıcının açık kararı: **BPS yalnız operasyon yazılımı değildir. Güçlü İnsan Kaynakları ve diğer şirket yönetimi modülleri, tenant bazında seçilebilir ürünün ana kapsamıdır.** Operasyon öncelikli mevcut geliştirme sırası, İK veya diğer modüllerin önemsiz/kalıcı kapsam dışı olduğu şeklinde yorumlanamaz. İK artık yalnız değerlendirilen bir aday değildir; onaylı ürün yönüdür. Eski dar operasyon paketlerindeki kapsam dışı notları bu kararı geçersiz kılmaz.

İK kullanan şirket müşteri, müşteri şubesi veya personel talebi açmak zorunda değildir. Operasyon kapalı + İK açık; İK kapalı + operasyon açık; ikisi açık senaryoları desteklenecek. MEK ve Partner ayrı tenanttır. Modül hakkı, etkinliği ve kullanıcı veri yetkisi ayrı kontrollerdir. Operasyondaki kişi görünürlüğü özel İK belgelerine erişim vermez.

### Faz 1: mevcut operasyon çekirdeğini teslim edilebilir noktada kapat

Faz 1 hedefi kusursuz veya bütün sektörleri kapsayan ürün değil: mevcut talep→atama→teyit/yedek→gerçekleşme→çalışma onayı zincirinin çalışması ve açık risklerin dürüst kaydı. 791 uygulama testi, 9 birleşik SQL kontrol grubu ve evrak kabulü tekrar tekrar bağımsız iş paketi olarak açılmaz; yeni kod/failure gerekçesi olmadan yeniden çalıştırılmaz.

18 Ekim son kabul: ana tarayıcı zinciri, şirket değişimi ve 390×844 görünüm geçti; 10 SQL kontrol grubuna ek olarak beş bağımsız GoTrue oturumuyla 5 HTTP rol grubu geçti. F1-A/B/C kabul kapsamı tamam, bu kapsamda açık P0/P1 yok. **Faz 1 kapandı; sıradaki uygulama İK-1.** Kanıt: `qa/operations-chain-20261018/BROWSER_ACCEPTANCE.md`, `role-http-result.json`. Rol bazlı düğmelerin ayrı görsel incelemesi ve fiziksel cihaz testi açık; backend yetki reddi doğrulandı. Ürün kodu değişmedi, yeni yayın yapılmadı.

**Üç kapanış paketi; yeni özellik eklenmez:**

| Paket | İş | Tamamlanma kanıtı |
|---|---|---|
| F1-A Günlük operasyon tarayıcı kabulü | Sentetik talep, atama, gelememe, yedek görüşmesi ve ayrı ataması, personel beyanı, bağımsız şube teyidi; tamamlanmış vardiyada gerçekleşme, çalışma taslağı/gönder/onay | Gerçek Next/Auth/PostgREST üzerinde UI adımları ve DB son durumları; yenilemede kayıt korunur, çift kayıt yok. Tarih gerektiren iki senaryo açık ayrılır. |
| F1-B Yetki ve mobil kabulü | Yönetici/operasyon olumlu yolları; İK/muhasebe/görüntüleyici için mevcut rol politikasına uygun ret; tenant değişimi; 390×844 ve masaüstü ana akış | Tarayıcı/HTTP kanıt matrisi; yanlış tenant erişimi veya yetkisiz onay yok. Viewport testi fiziksel cihaz diye sunulmaz. |
| F1-C Düzeltme ve teslim | Yalnız A/B'de bulunan engelleri düzelt, ilgili regresyon/build, değişiklik varsa şema ön kontrolü ve kontrollü yayın; kısa operatör kullanım yolu ve açık işler listesi | Çözümsüz P0/P1 yok; yayın/source kanıtı, kalan maddelerin etki ve sonraki faz kaydı. Ürün farkı yoksa gereksiz yayın yok. |

P0: veri kaybı, yetkisiz erişim/tenant sızıntısı veya üretim çökmesi. P1: ana işi tamamlamayı engelleyen hata, çift atama, yanlış gerçekleşme/onay veya yanlış toplam. Bunlar faz kapatmayı engeller. Kozmetik P2/P3, yeni rapor/filtre ve rakipte görülen ek özellikler yeni faz iş listesine taşınır. Kritik bulgu çıkarsa kapsam yalnız o bulgu için uzar; genel tarama döngüsü yeniden açılmaz.

**Faz 1 kapanış kuralı:** F1-A/B/C kanıtları tamam + açık P0/P1 yok + ertelenenler kayıtlı. Sonrasında sıradaki uygulama bloğu İK-1 olur; kullanıcıdan tekrar yön seçmesi istenmez. İK araştırması ve veri sözleşmesi şimdi hazırlanabilir; şema/UI uygulaması bu kapıdan sonra başlar.

Fiziksel telefon/zayıf ağ kabulü, gerçek Excel/Luca dosyası mutabakatı, bulut/S3 felaket kurtarma, bildirim sağlayıcısı ve tüm ikincil modüllerin kapsamlı kabulü ayrı takip edilir; tamamlandı sayılmaz, fakat İK kodlamasına başlama ön koşulu değildir. İlgili özellik gerçek kullanıma açılırken kendi kabulü gerekir. Keşfedilmiş veri kaybı/güvenlik açığı varsa bu erteleme kullanılamaz. Mevcut gerçek veriyi temizleme ve tam içerik yedeği almama sınırı korunur.

H0a ilerleme: `qa/hr-catalog-20261018/contract.mjs` ve `accept.mjs` ile 7 geçiş sözleşmesi grubu geçti. İzole öneridir; ürün/SQL/API bağlı değildir. Eski katalog 10 modülle korunur. H0b izole PostgreSQL işlem algoritması 5 grupta geçti: gerçek lock wait/commit/rollback, değişmez makbuz ve sentetik pending engeli. Bu mevcut BPS RPC kabulü değildir. H0c yetki, gerçek ön kontrol/geçmiş ve v1/v2 API adaptasyonu açık.

### İK-1 öncesi koddan doğrulanan entegrasyon sınırları — 18 Ekim, Faz 1 sonrası

Bu bölüm ürün uygulaması değildir; mevcut kaynakla doğrulanmış uygulama sırasıdır. Yeni rakip incelemesi yapıldığı iddia edilmez. Eski Zeops tasarımındaki kavramsal ortak kişi tablosu, mevcut kaynakta henüz bağımsız bir çekirdek değildir.

| Mevcut kaynak | Doğrulanan durum | İK için sonuç |
|---|---|---|
| `src/lib/modules/catalog.ts` | Katalog v1; tam 10 anahtar doğrulaması; İK yok | Yalnız menü/anahtar eklemek mevcut yanıt doğrulamasını bozar. |
| `supabase/migrations/20261005000100_tenant_module_foundation.sql` | catalog_version CHECK = 1; context tam anahtar kümesi bekler; bootstrap tüm mevcut modülleri açık kurar | Yeni modül otomatik bütün müşterilerde açılmamalı. Sürümleme, varsayılan kapalı ekleme ve eski istemci uyumluluğu birlikte çözülmeli. |
| `scripts/module-catalog-sql.mjs` | Üretimde uygulanmış v1 migration içindeki SQL'i üretir | İK eklemek için eski migration --write ile değiştirilmez; yeni sürümün üreticisi ve yeni migration gerekir. |
| `supabase/migrations/20260914000200_talent_people.sql` | Kişi talent_people; worker_id ops_workers'a bağlı; iletişim/beceri aday tablosunda | HR çalışanını otomatik aday veya operasyon personeli yapmamak gerekir. |
| `supabase/migrations/20261005002200_talent_module_rpc_gates.sql` | Kişi RPC'leri talent modülünü gerektirir | İK açık + havuz kapalı senaryosunda bu API doğrudan kullanılamaz. |
| `supabase/migrations/20261005002700_talent_linked_name_gate.sql` | Bağlı kişinin adını değiştirmek staffing kapalıysa reddedilir; mevcut kilit sırası korunur | Genel İK isim düzenlemesi bu yola bağlanamaz; modül sınırı arka kapıdan aşılmamalı. |
| `src/lib/talent/merge-review.ts`, `src/lib/talent/people.ts` ve merge migration'ları | Birleşen kişinin eski kimliği yönlendirilir; operasyon geçmişi bağlantılı | İK istihdamı eklenince birleştirme, personel kodu ve dönem çakışmasını da atomik kontrol etmeli. |
| `src/lib/modules/change-preview.ts` | Kapatma engelleri somut açık işlere bağlı | İK'da çalışan bulunması tek başına sonsuz kapatma engeli olmamalı; bekleyen aktarım/yazma/dosya işlemleri engel, geçmiş veri korunur. |

H0c uygulama parçası: açık geçmiş paneline yeni katalog sürümünde açık güncelleme mesajı ve sayfa yenileme düğmesi eklendi (yerel). İlk sayfa yüklemesinde güncelleme yönlendirmesi de eklendi; tam v2 geçmiş/API hâlâ bağlı değil, HR açılmaz.

H0c veri katmanı: 20261019000100 ileri migration ile olay bazlı katalog sürümleri ve workspace_module_history_v2 okuyucusu yerelde eklendi. Gerçek sentetik BPS şemasında 5 kabul grubu ve 796 uygulama testi geçti. Katalog v1, istemci v1; bu adım HR aktivasyonu veya tam v2 katalog geçişi değildir. Üretime uygulanmadı.

**H0c uyumluluk bulgusu:** gerçek `parseModuleHistory` HR-only olayı üç biçimde de (ham, HR alanı çıkarılmış, olay atlanmış) reddediyor. `qa/hr-catalog-20261018/legacy-history-result.json` bunu çalıştırarak doğrular. Eski istemcinin yalnız state projeksiyonuyla bütün geçmişi okuyacağı varsayımı geçersizdir. Önce sürümlü geçmişi anlayan uyumluluk istemcisi/API, sonra HR aktivasyonu; eski açık istemciye gerektiğinde açık güncelleme yönlendirmesi. Olayları gizleyerek ya da revision numaralarını değiştirerek uyumluluk taklidi yapılmaz. Bu engel yeni HR yayını içindir; mevcut canlı v1 çalışmasını bozmaz.

**Uygulama sırası ve her adımın çıkışı:**

1. **H0 katalog uyumluluğu:** v1'in yayımlanmış sözleşmesini koruyan v2 context/komut/ön kontrol/geçmiş şeması tasarlanıp yerel fixture üzerinde denenir. v1 yanıtı 10 alanını korur; v2 tam 11 alanı bilir. Her istemci yalnız gönderdiği sürümün alanlarını değiştirebilir; eski v1 ayar kaydı yeni İK değerini yanlışlıkla sıfırlayamaz. Eski/yeni eşzamanlı ayar değişimleri aynı tenant revision kilidi altında çatışma verir. Yeni hr anahtarı existing ve new tenant için kapalıdır; etkinleştirme ancak erişim hakkı + yönetici yetkisi + hazır backend ile mümkündür. Geri dönüşte hr yazmaları kapatılabilir, istihdam verileri silinmez. Önce şema, sonra uyumlu uygulama, sonra kontrollü açma; yalnız TS dizisi değiştirilmez.
2. **H1 ortak kimlik kararı/provası:** tenant kapsamlı ortak kimlik kaydı ve eski talent kişi/worker bağlantısı için küçük bir compatibility migration denenir. Mevcut kişi ID'leri korunur; kör isim/telefon eşlemesi yapılmaz. Sadece İK'dan açılan kişi otomatik talent_people/ops_workers satırı almaz. Aday işe alınırken mevcut ortak kimliğe istihdam bağlanır. Mevcut kişi/merge/ithalat olaylarının tamamı ortak kimliğe geçişte test edilmeden eski tablolar kaldırılmaz. Ad-soyad için tek yetkili kaynak ve eski ekranlara okuma projeksiyonu belirlenir; iki yönlü sessiz trigger senkronizasyonu kullanılmaz. İK düzeltmesi müşteri operasyonu kapalı diye engellenmez; eski operasyon olay metinleri geriye doğru yeniden yazılmaz. Bu adım müşteri verisi üzerinde otomatik dönüşüm yetkisi değildir; önce sentetik prova.
3. **H2 istihdam/organizasyon çekirdeği:** personel kaydı ortak kişi + tenant personel kodu; istihdam dönemleri ayrı başlangıç/bitiş; departman/pozisyon/yönetici ataması tarihli. Aynı iş ilişkisi için üst üste dönem reddi; yeniden işe almada yeni dönem, aynı kişi ve korunmuş tarihçe. Departman müşteri firması/şubesi değildir. Aynı tenant bileşik FK; manager döngüsü ve tarih aralığı doğrulaması; optimistic revision + actor/tenant/command makbuzu; aynı komut tekrarında aynı sonuç. Normal UI fiziksel silme yerine tarihli kapatma kullanır.
4. **H3 ilk ekran ve aktarım:** Çalışanlar listesi (aktif/ayrılmış/tümü, departman/pozisyon, arama), kısa yeni çalışan formu, detayda istihdam/organizasyon geçmişi. Personel kodu, ad ve başlangıçla başlanır; ücret/sağlık/TC zorunlu alan değildir. Excel dry-run → kolon eşleme → yeni/güncelle/inceleme → açık onay → satır bazlı sonuç. Eksik hücre alanı silmez; silme açık seçimdir. Kod birincil eşleme; isim benzerliği yalnız aday önerisi, otomatik merge değildir. Kaynak dosya/satır kimliği ve beklenen revizyon saklanır; tekrar yükleme ikinci istihdam üretmez.
5. **H4 özel dosyalar ve bağımsız kabul:** genel firma evrakı veya aday eki yetkisi özel İK dosyasına geçmez. HR metadata ve private Storage yolu; prepare/finalize/cleanup idempotency, tenant/istihdam/sahiplik/içerik kontrolü, kısa ömürlü yetkili indirme. Genel audit içine belge içeriği/ücret/sağlık detayı yazılmaz. Auth hesabı oluşturma veya geniş erişim otomatik verilmez. Operasyon+havuz+müşteriler kapalı, yalnız hr açık senaryoda kayıt/aktarım/okuma çalışır.

**İK-1 kabul matrisi:** İK ve yönetici yetkili temel işlemleri yapar; operasyon, muhasebe ve görüntüleyici özel İK kaydını API/Storage üzerinden alamaz (daha dar muhasebe veri projeksiyonu ayrı sonraki karar). Başka tenant ID'si, pasif üyelik, eski revision, komut tekrarı, eşzamanlı yeniden işe alma, birleşen aday, ad çakışması, eksik hücre, yarım dosya yükleme ve modül kapanırken devam eden yazma ayrı test edilir. Temel kişi erişimi özel HR alanlarını içermez. Kişisel performans puanı ve süreye bağlı yönetici eskalasyonu eklenmez.

**Bu tur tamamlanan:** kaynak bağımlılık incelemesi ve H0–H4 uygulama sözleşmesi. **Henüz yapılmayan:** hr katalog kaydı, yeni tablolar/RPC/UI, veri taşıma ve üretim yayını. Sonraki somut kod paketi H0 katalog sürüm geçişidir; İK ekranı hazırmış gibi menüye eklenmeyecek. Telefon/TC gibi önceden açık veri politikaları bu planla sessizce genişletilmeyecek.

### Faz 2: İK yönetimi — somut teslim sırası

Önceki ayrıntılı tasarım referansı (salt okunur eski kaynak): `/Users/furkanyahsi/Desktop/BPS/01_product/IK_MODULU_ZEOPS_TEKNIK_TASARIM.md`. Aktif uygulama sözleşmesi bu kararla uzlaştırılarak geliştirilecek; eski dosyanın tüm önerileri otomatik uygulanmış/onaylanmış sayılmaz.

| Paket | Kullanıcı ve karar | Kapsam ve kabul |
|---|---|---|
| İK-1 Personel ve organizasyon | İK/yönetici: kim çalışıyor, hangi birimde, hangi istihdam döneminde? | Ortak kişiye bağlı istihdam dönemleri; personel kodu; departman/pozisyon/yönetici geçmişi; yeniden işe alma; temel çalışan kartı; Excel önizleme/eşleme/mükerrer kararı; yetkili özel belge alanı. Operasyon kapalıyken baştan sona çalışır; aday→çalışan dönüşümü ikinci kişi üretmez. |
| İK-2 İzin ve çalışan self servis | Çalışan: talebim/bakiyem; yönetici: ekibin izin planı | Çalışma takvimi, izin türü, hareket defteriyle bakiye, başvuru/iptal/iade/onay, ekip takvimi; kendi kaydına dar erişim. Çakışma, kısmi gün, bakiye düzeltmesi ve revizyon testleri. Hukuki hesap varsayımları doğrulanmadan otomatik yasal hak iddiası yok. |
| İK-3 İşe giriş/çıkış ve zimmet | İK/ekip: hangi adım kimde, ne teslim/iade edildi? | Mevcut görev altyapısına bağlı kontrol listeleri, sorumlular, belge durumu, zimmet teslim/iade geçmişi. İşten ayrılma kaydı hesap erişimini belirsizce otomatik değiştirmez; ayrı açık işlem. |
| İK-4 Masraf/avans ve dış bordro bağlantısı | Çalışan/İK/finans: talep, onay ve ödeme hangi aşamada? | Belge ekli masraf/avans, sınırlı sıralı onay; onay≠ödeme; dönemli Luca/harici bordro aktarımı ve mutabakat. Kendi bordro hesap motoru ve banka ödemesi bu paketin ilk sürümü değil. |

İK-1 veri sözleşmesi: kişi ≠ adaylık ≠ istihdam ≠ organizasyon görevi ≠ müşteri ataması ≠ uygulama hesabı. Ortak kişi kaydında mevcut havuz yeniden kullanılır; ayrı bir paralel kişi tabanı kurulmaz. Modül/rol/tenant kontrolleri UI+server+DB katmanında; belgeler özel storage ve süreli erişim; kapanışta açık İK işi ön kontrolü, veri silmeden kapatma. İçe aktarma yeniden denemesi ve onay komutları idempotent, değişiklikler revizyonlu ve izlenebilir olmalı. Hassas alanlar genel kişi kartına taşınmaz; önceki telefon/TC kararları yeni kullanıcı kararı olmadan genişletilmez.

İK-1 kabulünün zorunlu kombinasyonları: yalnız İK; yalnız operasyonun bozulmaması; iki modül açık ortak kişi; şirket değişiminde form/sonuç sızıntısı olmaması; kapalı İK'ya doğrudan URL/RPC erişiminin reddi. Dashboard ve kurulum etkin modüllere göre şekillenir; herkese personel talebi akışı gösterilmez.

### Diğer modüllerin ürün yolundaki yeri

Müşteri/sözleşme, görev/ekip, evrak, finans/Luca, proje raporlama ve duyuru/bildirim de birinci sınıf modüllerdir. Kaldırılmaz veya yalnız operasyonun yan ekranı sayılmazlar. İK-1 sonrasında İK-2/3 ilerlerken bu modüllerin gerçek kullanım eksikleri ayrı teslim bloklarıyla ele alınır. Hepsini aynı anda genişleten genel iş akışı motoru kurulmaz. Abonelik/lisans motoru ve e-imza sağlayıcısı ayrı paketlerdir. Kişisel performans puanı ve süreye bağlı yönetici eskalasyonu eklememe kararı devam eder.

### Güncellenen benchmark eşlemesi — 18 Ekim

Bu tur kamuya açık resmi kaynaklar araştırıldı; hesap içi yeni test yapılmadı. Üretici açıklaması backend kanıtı veya tüm ürünün incelendiği iddiası değildir.

- Zeops: personel/özlük, izin, zimmet ve masraf aileleri İK paketlerinin dayanağı. Eski yetkili hesap incelemelerinin eksik alanları (yazma gerektiren onay/iptal/geri alma, kapalı modüller) hâlâ doğrulanmamış; gerçek şirket hesabında test kaydı açılmaz. https://www.zeops.com/tr/ ve https://www.zeops.com/tr/masraf-yonetimi
- Personio: izin bakiye/takvim ve onboarding iş takibi → İK-2/3. https://www.personio.com/product/absence-management/ ve https://www.personio.com/product/onboarding/
- BambooHR: onboarding ile çalışan kaydının bağlantısı, işe giriş/çıkış → İK-1/3; ikinci kişi girişi yerine açık dönüşüm. https://www.bamboohr.com/platform/onboarding/
- Recruiter: mevcut aday havuzu/görüşme/ekler → işe alma geçişi; adaylık istihdamın yerine kullanılmaz. Mevcut kayıtlı incelemeler referans; bu tur yeniden giriş yok.

Eksik benchmark araştırmasının teslim çıktısı ekran sayısı değil karar tablosudur: çalışan/istihdam kimliği ve yeniden işe alma; izin bakiyesi/iptal/kısmi gün; alan ve belge yetkileri; Excel hata düzeltme/tekrar; işten çıkış/zimmet; self servis; çok adımlı onay ve ödeme ayrımı. Her birinde resmi kaynak veya yetkili salt okunur gözlem, BPS kararı, mevcut karşılık ve açık soru yazılacak. Gerekli kararlar yeterli kanıta ulaştığında araştırma durup uygulamaya geçilir; sınırsız benchmark turu açılmaz.


> Güncel yayın özeti — 18 Ekim 2026: Modüller aç/kapat, değişiklik geçmişi, Hesabım ve ortak ses tercihi yayında. H görev/duyuru/talep kutusu da `a0230dd` / 190 migration ile yayımlandı; kanıt `qa/unified-inbox-20261018/release.json`. Aşağıdaki uygulama sırası ve eski “sıradaki” kayıtları tarihsel ilerlemeyi gösterir. Dış e-posta/push teslimi, fiziksel mobil ve tüm rollerin tarayıcı kabulü tamamlanmış sayılmaz.


28 Eylül 2026 · Birleştirilmiş karar sürümü 1 · Durum: planlama, uygulanmadı.

Bu dosya, seçilebilir modüller ve Ayarlar çalışmasının ana giriş ve karar belgesidir. Önceki araştırmalar kanıt ve teknik ayrıntı olarak korunur. Ürün kapsamı, adlandırma ve uygulama sırası konusunda bu belge; teknik ayrıntıda atıf verilen teknik v2 geçerlidir. Plan dosyaları üretim durum raporu değildir.

Kod inceleme referansı `01c46b5`. Son kayıtlı yayın `qa/latest-release.json` içindedir; uygulama öncesi gerçek main/deployment/DB ledger tekrar ölçülecek.

## 1. Ürün kararı

**Çalışma Alanı**, şirketin BPS'te hangi işleri yürüteceğini belirleyen düzendir. Düzenleme eylemi **Çalışma alanını düzenle**, ayarlardaki bölüm **Modüller** olarak adlandırılır.

Sektör başlangıç önerisi sunar; şirketin çalışma biçimi modülleri belirler. Kullanıcıların mevcut rol ve kayıt yetkileri ayrıca uygulanır. Sektör değiştirmek veri, rol veya modül ayarını kendiliğinden değiştirmez.

Mek Group ve Partner Staff ayrı tenant kalır. Bir müşterinin (`companies`) sektörü ile BPS kullanan şirketin (`tenants`) çalışma alanı farklıdır. Bir bankaya hizmet vermek Mek'i bankacılık yazılımına dönüştürmez.

## 2. Bugünkü ürün ile yapılacak işin ayrımı

Mevcut üründe şirket seçimi/üyelikler, role göre menü, ekip listesi, davetler, operasyon odaklı kurulum rehberi ve günlük iş dağılımı var. Personel, müşteri, görev, belge ve diğer iş modülleri kodda mevcut.

Tenant bazlı modül seçimi, bütün yüzeylerde modül erişim kapısı, birleşik Ekip ve davetler sayfası ve kapsamlı kişisel ayarlar henüz bu planla uygulanmadı. Mevcut bildirim kutusu talep konuşması etiket/yanıtlarını kapsıyor; görev ve duyuru olayları henüz bağlı değil. Mevcut ses sekme bazlı kullanıcı etkinleştirmesi; push veya kalıcı cihaz tercihi değil.

Bu plan mevcut işlevleri yeniden paketler. Yeni sektörlere eksik iş özellikleri kazandırdığımız anlamına gelmez. Finansal Özet tam muhasebe/bordro değildir; Proje Raporlama da genel proje teslimat motoru değildir.

## 3. Ayarların üç etki alanı

| Alan | Kim için? | Giriş | Kapsam |
|---|---|---|---|
| Hesabım | Oturum açan kullanıcı | Sağ üst kullanıcı menüsü | Kendi bilgileri, gerçekten desteklenen tercihler, çıkış |
| Şirket ayarları | Seçili şirketin yetkili yöneticisi | Ana menü → Ayarlar | Genel bilgi, Modüller, Ekip ve davetler, kurulum, ayar geçmişi |
| Platform yönetimi | Ayrı platform admin yetkisi | Yetkili admin alanı | Platform başvuruları ve platform düzeyi işler |

Şirket ayarlarının üstünde şirket adı ve etki kapsamı görünür. Şirket seçimi değişince eski form yeni şirkete kaydedilemez. Şirket yöneticisi olmak platform yöneticiliği vermez.

### Önerilen gezinme

```text
Ana menü
  Genel Bakış                  ← etkin ve yetkili modüllerin kartları
  İş modülleri                 ← şirket seçimi × kullanıcı yetkisi
  Şirket Yönetimi               ← günlük iş dağılımı; ayar ekranı değil
  Ayarlar
    Genel
    Modüller                   ← Çalışma alanını düzenle
    Ekip ve davetler
    Kurulum rehberi             ← mevcut /kurulum akışına tek giriş
    Değişiklik geçmişi          ← yalnız audit kapsamı hazır olduğunda

Kullanıcı menüsü
  Hesabım
  Şirket değiştir
  Çıkış
  Platform yönetimi             ← yalnız ayrı yetki varsa
```

Bu ağaç bütün kullanıcıların her öğeyi göreceği anlamına gelmez. Yapılmamış işlev için boş kategori açılmaz. Masaüstünde dar bölüm listesi; mobilde taşmayan bölüm seçimi ve büyük temel kontroller. URL, geri tuşu ve yenileme doğru bölümü korur.

## 4. On seçilebilir iş modülü

| Modül | Sağladığı iş | V1 sınırı |
|---|---|---|
| Müşteriler | Firma/iletişim ve ilişkili iş kayıtları | Tenant şirket ayarıyla aynı kayıt değil |
| Görevler | Bağımsız veya ilişkili iş, üstlenme, devir, tamamlama | Firma zorunlu değil |
| Takvim ve görüşmeler | Randevu ve sonuçlar | Mevcut firma bağı sürer; genel kişisel takvim vaat edilmez |
| Belgeler | Firma evrakları ve klasörler | Aday eki/rapor kaynağı kendi modülünün verisi |
| Sözleşmeler | Anlaşma, ekler, yenileme | Müşteri/belge bağımlılığı |
| Personel havuzu | Aday/personel, filtre, görüşme, ekler, Excel | Günlük operasyon olmadan kullanılabilir olmalı |
| Personel operasyonu | Talep, atama, İDP/sabit/dönemsel, teyit ve çalışma takibi | Alt akışlar ayrı ürün yapılmaz |
| Proje raporlama | Dışarıda yürüyen işlerin dönem ve gerçekleşme raporu | Günlük personel talebi zorunlu olmamalı |
| Finansal özet | Firma mali özetleri ve Luca aktarımı | Tam muhasebe/proje kârlılığı değil |
| Duyurular | Şirket içi duyuru | Hedefleme/okundu geliştirmeleri ayrı backlog |

Ortak altyapı: kimlik, tenant, üyelik, kayıt geçmişi, kişi/şube çekirdeği, dosya mekanizması, bildirim kabuğu. Açık altyapı herkese geniş veri erişimi vermez. Dashboard ve rapor kataloğu bağımsız satılacak modül değil, açık işlerin ortak görünümüdür.

İDP/sabit/dönemsel tercihler ilk sürümde operasyon UX düzenidir; ayrı güvenlik kapısı gibi sunulmaz. Yetkiyi kısıtlayan bir alt modül haline getirilecekse ayrıca backend politikası gerekir.

## 5. Benchmarklardan alınan kararlar

Resmi dokümanlardan doğrulanan davranışlar; hesap içi uçtan uca ürün testi veya şirketlerin özel kod incelemesi değildir.

| Kaynak | Gözlenen yaklaşım | BPS kararı |
|---|---|---|
| [ClickUp ayarlar](https://help.clickup.com/hc/en-us/articles/10853931837335-Workspace-and-account-settings) | Kişisel hesap ve workspace ayarları ayrı; People üyelik işlerini topluyor | Hesabım ayrımı; ekip/davet tek bölüm |
| [Notion ayarlar](https://www.notion.com/help/workspace-settings) | Arama ayarın yerini gösteriyor; sonuçlar erişime göre sınırlı | Ayarlar büyürse izin filtreli arama; şimdi az sayıda net başlık |
| [Connecteam izinler](https://help.connecteam.com/en/articles/1981698-admin-permissions) | Yönetici izinleri özellik/varlık bazında düzenlenebiliyor | Modül seçimi yetki ataması değildir; V1'e dev yetki editörü ekleme |
| [Business Central deneyim](https://learn.microsoft.com/en-us/dynamics365/business-central/ui-experiences) | Şirket özellik kapsamı, kullanıcı izinleri ve kişiselleştirme ayrılıyor | Şirket düzeni + mevcut rol + kişisel tercih ayrımı |
| [Jira feature API](https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-project-features/) | State, prerequisites, toggleLocked gibi alanlar | Anahtarın neden değiştirilemediğini açıklayan backend sonucu |
| [Jira kapatma](https://support.atlassian.com/jira-software-cloud/docs/enable-the-development-feature/) | Development kapatma bazı diğer yüzeylerdeki bilgiyi kaldırmıyor | BPS'te görünüm gizleme ve iş modülü kapatma açıkça farklı |
| [Frappe workspace](https://docs.frappe.io/framework/user/en/desk/workspace/access) | Workspace görünürlüğü modül/rolle ilişkilendiriliyor | Kart/menu görünürlüğü rol ve modülün kesişimi |
| [Zoho yönetici kapsamları](https://help.zoho.com/portal/en/kb/one/admin-guide/admins/articles/zohoone-assign-admins) | Farklı idari kapsamlar | Şirket ile platform yönetimini ayır |
| [Connecteam paketler](https://help.connecteam.com/en/articles/608571-what-are-the-costs-of-the-platform) | Anlamlı işlev grupları seçilebiliyor | Her düğmeyi modül yapma |

Teknik dayanaklar ve detaylı kaynaklar teknik v2 belgesinde: Unleash/OpenFeature bağlam ayrımı, PostgreSQL RLS/kilit davranışı, AWS dış teslim tutarlılığı. Bu ürünlerin lisans, altyapı veya özellik listesini bütünüyle BPS'e taşımıyoruz.

## 6. Kullanıcı yolculukları

### Yeni şirket

“Hangi işleri burada takip edeceksiniz?” → sektör/çalışma biçimine uygun öneri → seçimleri düzenle → menü önizlemesi → çalışma alanını oluştur → ilk gerçek iş. Örnek iş verisi otomatik yaratılmaz.

### Mevcut şirkette düzenleme

Ayarlar → Modüller → değişiklikleri seç → fark/önkoşul/açık iş özeti → Kaydet. Kontroller kayıt anında tekrar yapılır. Şablon değişimi önce fark üretir; önceki özel seçimleri sessizce ezmez.

### Ekip üyesi ekleme

Ayarlar → Ekip ve davetler. Mevcut üyeler ve bekleyen davetler aynı bölümde ama durumları ayrı. Davet etme, rol değiştirme ve üyelik kaldırma yetkileri mevcut backend sınırına göre gösterilir. Sayfa taşımak daha geniş yetki verme gerekçesi değildir. Havuzdaki personel ile uygulama kullanıcısı ayrı anlatılır.

### Günlük yönetim

İş atama/devir/tamamlama iş ekranında; Ayarlar'da değil. Yönetici ekip dağılımını, operasyon çalışanı ilgili günlük işleri görür. Kart sırası deterministik; algoritma her girişte menüyü oynatmaz.

### Kapalı modüle eski bağlantı

“Bu modül seçili şirkette kullanılmıyor.” Yöneticiye Modüller bağlantısı, diğer kullanıcıya Genel Bakış. Kapalı kaynak adı/içeriği/finans kolonları başka karttan sızmaz. Önceden alınmış dosya geri alınamaz; signed URL süre sınırı belgelenir.

## 7. Sabit kullanıcı sözleşmeleri

- Kısayol gizlemek kişisel görünüm; modül kapatmak şirket iş erişimi; veri silmek ayrı işlem. V1 modül ekranında veri silme yok.
- Modül kapatıldığında veri korunur. Açık iş veya bağımlılık varsa kapatma engellenir; çözüm bağlantısı verilir.
- Geçmişe normal erişim için modül yeniden açılır. Ayrı arşiv okuma rolü V1'de yok.
- Yeniden açma kaçırılan bildirimleri toplu göndermeyi tetiklemez.
- Modül açık ve henüz boş olabilir. “Henüz kayıt yok” ile “erişim yok” ve “yükleme hatası” farklı.
- Veri alınamadığında boş/default değerle üzerine yazma, sahte sıfır veya sahte başarı yok.
- Basit formda Kaydet/Vazgeç; etkili modül değişiminde önizleme. Gereksiz her tıkta onay yok.
- Ayarlar ve tercih isimleri mevcut yeteneği doğru anlatır; push, MFA, otomatik entegrasyon veya kalıcı ses hazır değilse hazır gibi gösterilmez.

## 8. Teknik omurga

1. Tek kod tabanı ve Supabase/PostgreSQL korunur.
2. Tek tipli modül kataloğu; `requires` zorunlu, `enhances` isteğe bağlı katkı; ortak altyapı ayrı.
3. Config/settings/change-receipt tabloları; son tarihli migration'lar uygulama anında atanır. Geçmiş migration değiştirilmez.
4. actor/tenant/role/üyelik ve seçim generation/config revision tek doğrulanmış bootstrap. UI sonucu mutasyon yetkisi değildir.
5. schemaVersion, catalogVersion ve tenant configRevision ayrı. Eski istemciye desteklenen protokol yanıtı.
6. İş yazma ve kapatma aynı config kilidi protokolünü kullanır; READ COMMITTED altında kilit sonrası durum tekrar okunur. Dönüştürülmeyen direct DML varsa kapatma açılmaz.
7. RLS, SECURITY DEFINER, storage, export, service-role cron ve paylaşılan tablo projeksiyonları denetlenir. Sadece menü gizlenmez.
8. Şirket modülü açmak rol yükseltmez. Müşteriler açık/Finans kapalı örneğinde mali kolonlar dar view/RPC/izin tasarımıyla korunur.
9. Aynı DB'deki iş ve uygulama bildirimi atomik yazılabilir. Dış teslim outbox/lease yalnız ihtiyaç duyulduğunda M6'da; mevcut email stamp-first sınırı körlemesine kopyalanmaz.
10. Anahtar/üyelik değişiminde cache kapsamı yenilenir; eski tenant sonucu gösterilmez. Modül revision değişimi kaydedilmemiş bütün formları gereksiz unmount etmez.

Ayarlar için tek sınırsız JSON patch endpoint yok. Hesap tercihi, tenant ayarı, üyelik ve platform başvuruları ayrı yetkili komutlar. Ham secret hiçbir ayar yanıtında yer almaz.

## 9. Birleştirilmiş uygulama sırası

İki ayrı S/M backlog yerine aşağıdaki sıra kullanılır. Eski belgelerdeki S ve M kodları kaynak işlerin izlenmesi içindir.

| Paket | Teslim | Bağımlılık / yayın sınırı |
|---|---|---|
| A — Gerçek erişim haritası | Ekran/action/RPC/table/storage/cron eşlemesi; roller ve paylaşılan alanlar | M0; prod schema/ledger salt okunur ölçülmeden bitmez |
| B — Ayarları toparla | Ekip+davet tek yer, platform başvuruları ayrımı, günlük işlerin doğru bağlantıları | S1; mevcut yetkiyi değiştirmeden ayrı küçük yayın mümkün |
| C — Modül altyapısı | Katalog, config, bootstrap, audit/receipt, backfill | M1; mevcut tenant davranışı korunur, kullanıcı kapatma yok |
| D — Erişim ve bağımlılıklar | RLS/RPC/DML/storage/cron kapıları, kişi/şube/finans projeksiyonları | M2; atlatılabilir eski yol kalmayacak |
| E — Çalışma alanını düzenle | Modüller ekranı, önizleme, kurulum, dinamik menü/mobil/dashboard/rapor | M3 + S2; D tamamlanmadan kapatma açılmaz |
| F — Kişisel tercihler ve kabul | Desteklenen Hesabım, tutarlı formlar, audit yüzeyi, operasyon kombinasyonları | S3/S4 + M4; yeni auth/teslim özellikleri ayrı |
| G — Kontrollü yayın | CI, migration pre/postcheck, exact SHA, kimlikli smoke, rollback | M5; modül-aware rollback, veri silme yok |
| H — Bildirim devamı | Görev/duyuru kaynaklarını bağlama; gerekiyorsa dış teslim modeli | M6; modülerleştirme bitti diye bildirim backlog'u kapanmaz |

Araştırma artık işin yönünü seçmek için yeterli; yeni benchmark yalnız açık bir kararı çözecekse eklenir. Sonraki teknik çalışma A paketinin ölçümleridir. Süre tahmini direct DML/RPC haritası çıkınca yapılır; belirsiz kapsam için kesin gün taahhüdü yok.

## 10. Kabul ve kanıt

Mevcut belgelerde tanımlı T01–T38 teknik senaryo korunur. Ayarlar araştırmasındaki 12 kullanıcı/erişim senaryosu ve v3 ürün görevleri bu sete bağlıdır; toplamlarını test başarısı diye sunmayız, henüz çalıştırılmadılar.

Öncelikli uçtan uca senaryolar:
- Personel operasyonu olmayan genel şirket: personel terimi/kartı/sorgusu yok; ekip işleri çalışıyor.
- Mek/Partner: ayrı tenant, farklı seçenek, aynı kullanıcının eşzamanlı sekmelerinde sızıntı yok.
- Havuz-only ve reporting-only: ortak kişi/şube altyapısı çalışıyor, kapalı modülün özel verisi görünmüyor.
- Modül kapatma + eşzamanlı yazma; iki yönetici; eski form; belirsiz ağ sonucu; yeniden açma.
- Davet/üyelik/platform yetkilerinin taşınma sonrası genişlememesi.
- Mobil ve klavye ile ayar bulma, hatayı düzeltme, kaydetme; taslak korunması.

Performans: etkin olmayan modülün iş sorguları sıfır; ortak altyapı ayrı ölçülür. Config bootstrap tek scoped okuma; mutasyon denetimi DB'de. Büyük sentetik veri, lock beklemeleri, p95 ve egress baz sürümle karşılaştırılır. İnsan kullanılabilirlik testi yapılmış gibi raporlanmaz.

## 11. Kesinleştirilmesi gereken teknik ölçümler

Bunlar ürün yönünü tekrar tartışmak için değil, A paketinin uygulama girdileridir:

- Güncel production SQL tanımları/grants/policies ile repo eşleşiyor mu?
- Hangi mutasyonlar direct DML; hangi fonksiyonlar ortak kilit sırasına taşınmalı?
- Üyelik değişiminde son yönetici/açık iş kuralları tam olarak nerede uygulanıyor?
- Kişi/şube/firma üzerindeki ortak alanlar hangi modüle hangi projeksiyonla dönmeli?
- Kapatma engellerinin gerçek enum ve indeksleri; yarım import/upload kurtarma koşulları.
- Genel şirket adı/hesap adı düzenlemede mevcut backend var mı; yoksa ayrı dar komut ihtiyacı.

Mevcut prod verileri tam içerik yedeği bu araştırmanın parçası değil. Önceki yedek istememe tercihi geçerli; şema ölçümü ve sentetik testler bununla karıştırılmaz.

## 12. Sonraya bırakılanlar

Şube/ekip bazlı modül override, kişisel dashboard editörü, abonelik/lisans motoru, özel rol tasarımcısı, kapalı modül arşiv yetkisi, draining durumu, yeni auth güvenlik ekranları, otomatik entegrasyon kataloğu. Gerçek ihtiyaç ve güvenli backend olmadan boş düğme eklenmez.

## 13. Ayrıntı ve kanıt dizini

- [Mevcut modül envanteri](../qa/modular-saas-20260928/modul-envanteri-ve-sektor-plani.md)
- [Detaylı uygulama planı ve T01–T26](../qa/modular-saas-20260928/uygulama-plani.md)
- [Teknik v2 ve T27–T38](../qa/modular-saas-20260928/teknik-mimari-v2.md)
- [Yeni ürün benchmarkları v3](../qa/modular-saas-20260928/benchmark-karar-ekleri-v3.md)
- [Ayarlar benchmarkı ve kabul senaryoları](../qa/settings-benchmark-20260928/ayarlar-arastirma-ve-plan.md)

Planın ilk birleştirme turunda yalnız dokümanlar güncellendi. Ürün kodu, kullanıcı tercihleri, yetkiler, DB veya deployment değiştirilmedi.


## Uygulama kaydı — 28 Eylül 2026, ilk modül paketi

Plan uygulamaya alındı. İzole dal: `codex/tenant-modules-foundation-20260928`; çalışma klasörü `/Users/furkanyahsi/.codex/worktrees/bps-tenant-modules/BPS`.

- M0 statik erişim envanteri: 452 TS/TSX, 47 page/route, 332 veri erişim çağrı adayı; altı dinamik hedef manuel eşlendi. Üretim catalog/grant/policy karşılaştırması henüz yapılmadı; M0 tamamen kapalı değil.
- M1: on modülün kataloğu, bağımlılık doğrulaması, üç tablo, mevcut/yeni tenant başlangıcı, bootstrap audit'i ve `current_workspace_modules_v1()` okuyucusu kodlandı.
- `20260928000900_tenant_module_foundation.sql` yerel adaydır; **üretime uygulanmadı**. Modül kapatma mutasyonu, business erişim kapıları ve kullanıcı ekranı henüz açılmadı.
- Mevcut roller, shell/menu, kimlik RPC'si ve üretim davranışı değişmedi.
- Uygulama sonucu ve test kanıtları: çalışma dalındaki `qa/tenant-modules-foundation-20260928/README.md`.
- Sıradaki blok M2: ortak veri projeksiyonları, direct DML/RPC/RLS/storage/export/cron kapıları ve ayar değiştirme kilit protokolü. Bu bitmeden modül kapatma yok.


## Uygulama kaydı — 28 Eylül 2026, görev modülü erişim geçişi M2a

Aynı izole dalda ortak modül okuma/yazma kapıları, task_execute_v1 ve uygulamadaki dört görev yazma yolunun RPC geçişi tamamlandı. Şirketsiz görev, rol ve üyelik kuralları korunuyor; atananın adı/creator sunucuda belirleniyor. Config/profil/görev kilit sırası ve eşzamanlı üstlenme sentetik DB'de test edildi.

531 uygulama testi, 27 PostgreSQL 17.10 testi, TypeScript ve build geçti. Rapor: çalışma dalında `qa/tenant-module-task-gateway-20260928/README.md`.

**Henüz üretimde değil.** Yayın sırası: 000900 temel + 001000 expand → yeni frontend + kimlikli smoke → 001100 direct-write cutover. İki yeni dosya tek üretim DB adımında uygulanmaz. Genel modül kapatma hâlâ açılmadı.

M2b açık: görev devri/sözleşme yenileme/randevu tamamlama definer yolları, dashboard ve cron okuyucuları, ortak projeksiyonlar/FK yan etkileri; ardından diğer modüller ve ayar mutasyonu/UI.

## Uygulama kaydı — 28 Eylül 2026, görev iş akışları M2b

Toplu devir, sözleşme yenileme ve randevu tamamlama config kilidini profil/iş kilitlerinden önce alıyor; makbuz tekrarları da modül kontrolünden geçiyor. Devir/yenileme definer okuyucuları ve dashboard kaynakları filtrelendi. Firmasız görev devrindeki eski firma zorunluluğu düzeltildi. Görev cron'u service-only modüllü aday okuyucusu kullanıyor; damga öncesi ve gönderim öncesi doğruluyor, kapanan/doğrulanamayan modül için yeni damgaları geri alıyor. HTTP gönderimiyle SQL arasında atomiklik/geri çağırma garantisi yok.

538 uygulama testi, 38 PostgreSQL 17.10 senaryosu ve 39 odaklı regresyon geçti. Detaylı sonuçlar: `qa/tenant-module-task-workflows-20260928/README.md` ve `manifest.json`.

**Yerel; üretime uygulanmadı.** Genişletilmiş kontrollü sıra: 000900 + 001000 + 001200 + 001300 expand → yeni frontend ve kimlikli smoke → 001100 contract. Numaraya göre bütün bekleyen SQL'leri aynı adımda uygulamayın.

Sırada: görevlerin ortak ekran/kaynak projeksiyonları ve FK CASCADE/SET NULL etkileri; diğer modüllerin erişim kapıları; açık iş/bağımlılık kontrollü ayar komutu ve Modüller UI. Üretim etkin yetki ölçümü, tarayıcı/PostgREST kabulü hâlâ açık. Kapatma seçeneği henüz kullanıcıya sunulmuyor.

## Uygulama kaydı — 28 Eylül 2026, görev ekranı ve ilişki koruması M2c

Görevler ekranı modül snapshot'ını doğruluyor; kapalı modüle bağlantı/aksiyon sunmuyor. Firma seçimi tek dar ve RLS korumalı endpoint'e taşındı; mali/iletişim alanları görev ekranına taşınmıyor. Firma dizini yükleme/boş/kapalı/hata durumları ayrıldı, bağımsız retry görev taslağını koruyor. Kapalı müşteriler modülü mevcut firmalı görevi “firma dışı” diye göstermiyor.

Beş task-parent FK'nin CASCADE/SET NULL davranışı RESTRICT'e çevrilen yerel migration hazır. Görev veya atama geçmişi ebeveyn silmeyle kaybolmaz; firma pasifleştirme değişmez. Bağlı profil hard-delete'i de engellenir; ilerideki anonimleştirme/hesap silme iş akışı ayrı ele alınmalıdır.

541 genel uygulama testi + 4 odaklı servis/form testi (üçü ortak), 42 PostgreSQL 17.10 testi geçti. Rapor: `qa/tenant-module-task-context-20260928/README.md`; son tip/derleme kanıtı aynı dizinde.

**Yerel, yayın yok.** Yeni adaylar 001400 dar firma projeksiyonu ve 001500 ilişki koruması. 001400 frontend'den önce; eski 001100 doğrudan görev yazma cutover'ı frontend smoke sonrasında. Bekleyen bütün SQL'leri tek seferde uygulamayın. Genel modül kapatma mutasyonu/UI hâlâ açılmadı.

## Uygulama kaydı — 28 Eylül 2026, ortak ekranların modül bağlamı M2d

Ana ekran, randevular ve sözleşme detayı ortak doğrulanmış sayfa girişine bağlandı. Modül kapalı/hata/rol reddi boş veri gibi gösterilmiyor. Ana ekran modül ve role göre yalnız ilgili sorguları çalıştırıyor; Firma kapalıyken bağımsız görevler çalışıyor. Randevuyu görev oluşturmadan tamamlama seçeneği eklendi; bağlı görev ve yenileme panelleri kendi modül/rol koşuluyla çalışıyor. Partner için sunucunun reddettiği görev ve randevu tamamlama düğmeleri kaldırıldı. Form hatalarında metinler korunuyor.

550/550 uygulama testi, statik 0 FAIL/1 WARN, TypeScript ve üretim derlemesi geçti. Sekiz yeni test gerçek bileşen fonksiyonları/effect/callback'lerini sentetik hook/ağ sürücüsüyle çalıştırır; kimlikli tarayıcı/PostgREST smoke değildir. SQL değişmedi, DB testleri bu tur tekrarlanmadı. Rapor: `qa/tenant-module-shared-screens-20260928/README.md`.

**Yerel; push/deploy veya üretim migration yok.** Modül kapatma hâlâ açılmadı. Sayfa giriş snapshot'ı canlı değişiklik yayını değildir; UI kapıları DB güvenliğinin yerini tutmaz. Firma detayında ayrı görev bölümü yok; buradaki diğer alanların modül kapıları, genel gezinme/cache yenileme ve diğer modüllerin DB/storage/export/cron erişimleri sıradaki işlerdir. M2c'nin kontrollü yayın sırası değişmedi.

## Uygulama kaydı — 28 Eylül 2026, firma detayının modül bağlamı M2e

Firma detayı ortak modül doğrulamasına bağlandı. Sekme/kart/aksiyon/okuyucu aynı erişim planını kullanıyor; kapalı modül veya uygun olmayan rol veri sorgusu başlatmıyor. Önceki seçili sekme artık görünür değilse Genel Bakış açılıyor. Repo policy'leriyle rol eşlemesi yapıldı: finans yönetici/muhasebe, talepler/randevu/sözleşme yönetici/operasyon; İK'nın eski kadro özeti erişimi korunuyor. Dashboard ve randevu/sözleşme girişindeki eski partner koşulları da aynı repo kurallarına çekildi; yeni yetki verilmedi.

Sözleşmeler kapalıyken firma belge okuyucusu her sayfada contract_id IS NULL koşulu kullanıyor; firma belgesi yüklenebiliyor. Yükleme formu ayrı bileşene çıkarıldı. Kullanılamaz hale gelen eski sözleşme seçimi açıkça kaldırılıyor, dosya korunuyor. Finans okuması artık dar kolonlarla tenant/şirket doğruluyor; hata/boşluk/yükleme ayrılıyor, geç cevaplar eleniyor. Sıfır tutar ve bilinmeyen gecikme bilgisi sağlıklı/borçlu gibi yanlış sınıflandırılmıyor.

560/560 uygulama testi, TypeScript, üretim derlemesi ve statik 0 FAIL/1 WARN. On yeni senaryo gerçek TS/TSX ve useScopedResource ile sentetik hook/ağ sürücüsünde koştu; DOM/kimlikli tarayıcı/PostgREST smoke değil. SQL değişmedi, DB suite'i bu tur tekrarlanmadı. Rapor: `qa/tenant-module-company-screen-20260928/README.md`.

**Yerel; push/deploy/üretim migration yok.** UI ve sorgu filtresi DB/storage güvenliği sayılmaz. Diğer modüllerin RLS/RPC/direct-write/storage/export/cron/FK kapıları, üretim etkin izin ölçümü, bağımlılık/açık iş engelleri ve ayar mutasyonu + Modüller UI hâlâ açık. Genel gezinme/cache yenileme ve firma servislerinin tekrarlı tam satır çözümlemesini daraltma da sıradadır. Modül kapatma açılmadı; M2c/M2d kontrollü yayın sırası korunuyor.

## Uygulama kaydı — 28 Eylül 2026, finans erişim kapıları M2f

Finans Özeti ve Luca aktarımı ortak modül/rol sınırına bağlandı. Luca onayı önizleme aktör/tenant bağlamını koruyor; modül hatasında belirsiz aktarımın idempotency kaydı silinmiyor. Yerel 001600 migration, atomik aktarıma profil ve iş kilitlerinden önce config kilidi ekliyor. Üç finans tablosu restrictive okumayla korunuyor; doğrudan yazımlar, service ham okumaları ve eski finans RPC'leri kapatılıyor. Fonksiyon/etkin yetki/overload sapması migration'ı geri alıyor.

PostgreSQL 17.10 üzerinde 55/55 senaryo geçti (13 yeni finans); detay ve nihai release ölçümleri `qa/tenant-module-finance-access-20260928/README.md` ve `manifest.json` içinde. Eski finans RPC stub'larında algoritma değil yetki; gerçek atomik mizan gövdesinde çalışma ve yarış durumları test edildi.

**Yerel; üretim SQL/push/deploy yok.** Canlı yetki/owner/entegrasyon ve tarayıcı/PostgREST kabulü açık. Finansın parent-FK etkileri ve diğer modül yolları tamamlanmadan modül kapatma açılmaz. 001600 ortak 000900/001000 sonrasında; eski görev 001100 cutover'ı frontend smoke sonrasında. Toplu kör migration uygulaması yapılmaz.

## Uygulama kaydı — 28 Eylül 2026, müşteri okuma sınırı M2g

Firmalar listesi doğrulanmış modül bağlamına taşındı. Yetkili/sözleşme özetlerinin sorgu, masaüstü sütunu, mobil detayı ve arama ipucu aynı modül/rol koşuluna uyuyor. Erişilemeyen sözleşme özeti 0 gibi gösterilmiyor; gerçek boşluk ve hata ayrılıyor. Firma okuması başarısızsa bağlı özetler başlamıyor.

Yerel 001700 migration companies/contacts/notes için restrictive authenticated SELECT filtrelerini ekliyor; mevcut rol izinleri korunuyor. Contacts tenant'ı görünür firmasından alıyor. Şema/RLS sapmasında işlem geri alınıyor. Sekiz yeni PostgreSQL ve dört gerçek TSX/hook testi eklendi. Son ölçümler ve sonraki yazma bloğunun somut giriş noktaları: `qa/tenant-module-customer-reads-20260928/README.md` / `manifest.json`.

**Yerel; push/deploy/üretim SQL yok.** Bu bir okuma bloğudur; müşteri/kişi/not yazımları, import, service/definer projeksiyonları ve parent-FK etkileri henüz modül kapanmasına tam bağlanmadı. Dolayısıyla modül kapatma UI'si açılmadı. 001700 ortak 000900/001000 sonrasında; önceki görev cutover sırası değişmedi. Canlı katalog/izin ön kontrolü ve kimlikli tarayıcı/PostgREST kabulü açık.

## Uygulama kaydı — 28 Eylül 2026, firma yazma komutu M2h

Yerel 001800 ile firma oluşturma ve aktif/pasif durum değişimi doğrulanmış tenant/aktör, config→profil→firma kilidi ve bekleme sonrası yönetici kontrolüne bağlandı. Inline oluşturma ve firma CSV aynı komutu kullanıyor. Durum action'ları ortaklaştırıldı; yok/başka tenant kaydı başarılı sayılmıyor, aynı duruma tekrar UPDATE tetiklemiyor. CSV ilk doğrulanamayan yazmada duruyor; önceden doğrulanmış satırlar korunuyor ve kalan satırların işlenmediği bildiriliyor. Oluşturmada kalıcı idempotency makbuzu henüz yok; ağ belirsizliğinde otomatik tekrar yapılmaz.

11 yeni PostgreSQL + 8 gerçek servis/action + 4 statik yol sözleşmesi testi; tam ölçümler `qa/tenant-module-company-commands-20260928/manifest.json`. Rapor aynı dizinde.

**Yerel expand, üretim SQL/push/deploy yok.** Direct-DML yetkileri henüz kaldırılmadı: mevcut invoker `write_company_contact` firma FOR UPDATE için UPDATE iznine ihtiyaç duyuyor. Sırada kişi/not/import-yetkili komutları, ardından uygun frontend smoke sonrası direct-write cutover; ayrıca service/definer/FK/açık iş kontrolleri. Modül kapatma UI'si hâlâ açılmadı. 001800 ortak 000900/001000 sonrası ve yeni frontend öncesi; eski görev cutover planı değişmedi.

## Uygulama kaydı — 28 Eylül 2026, not komutları ve kişi kilit sınırı M2i

Notların dört yazma işlemi doğrulanmış tenant/aktör/firma kapsamlı RPC'ye taşındı; aynı tenant içindeki başka firmanın notuna işlem reddediliyor. Yetki/yazar kuralları SQL'de toplanıp tekrarlı istemci kontrolleri kaldırıldı. Mevcut yetkili kişi komutu kaynak gövdesi birebir doğrulanarak config→profil→firma sırasına alındı; beş kişi ve atomik ana yetkili davranışı korunuyor.

001900/002000 expand ve 002100 şirket/not direct-DML contract dosyaları hazır. Contract yalnız yeni frontend ve kimlikli smoke sonrasında uygulanacak; contacts ham yazımları henüz kesilmedi. Yedi yeni uygulama ve 18 yeni PostgreSQL testi eklendi; kesin release sonuçları `qa/tenant-module-customer-notes-20260928/manifest.json` içinde.

**Yerel; üretim SQL/push/deploy yok.** Kişi telefon/e-posta, silme ve CSV yolları, service/definer/FK etkileri ve genel modül kapatma işleri açık. Modül kapatma UI'si açılmadı. Kaynak gövdesi sapmasında kişi migration'ı durur. Oluşturmada kalıcı idempotency yok; ağ belirsizliğinde otomatik tekrar yapılmaz. Ayrıntılar aynı rapor dizinindeki README'de.

## Uygulama kaydı — 28 Eylül 2026, yetkili kişi komutları M2j

Yetkili kişinin telefon/e-posta düzenleme, silme ve CSV ekleme yolları tenant/aktör/firma kapsamlı komuta taşındı. Config→profil→firma→kişi kilit sırası; bekleme sonrası rol/üyelik kontrolü. Gönderilmeyen iletişim alanı kilitlenmiş güncel satırdan korunuyor. CSV mevcut ana yetkiliyi sessizce değiştirmiyor; ilk başarısız/belirsiz yazmada durup önceki doğrulanmış satırları koruyor. Firma isim eşlemesi tam sayfalı okumaya taşındı. Ham kişi yazma yardımcıları kaldırıldı.

002200 expand ve 002300 kişi direct-DML contract dosyaları hazır. Contract yalnız yeni frontend ve kimlikli smoke sonrası; eski 002100/001100 kabul sıraları korunur. 13 yeni DB ve 8 uygulama testi; kesin sonuçlar `qa/tenant-module-contact-commands-20260928/manifest.json` içinde.

**Yerel; üretim SQL/push/deploy yok.** Müşteri uygulama yazma yolları tamamlandı; service/definer/FK etkileri, diğer modüller, açık iş/bağımlılık ve ayar mutasyonu/cache işleri açık. Genel modül kapatma UI'si hâlâ açılmadı. CSV idempotency/tek dosya atomikliği yok; ağ belirsizliğinde otomatik tekrar yapılmaz. Eşleme 10.000 firma sınırını aşarsa eksik veriyle ilerlemez.

## Uygulama kaydı — 28 Eylül 2026, müşteri bildirimleri M2k

Randevu/sözleşme bildirimleri ilgili tenant modülünü hazırlıkta, gönderim kaydı öncesinde ve gönderim öncesinde doğruluyor. Arada kapanan modülün ayrılan gönderim kaydı geri alınıyor; geri alma hatası ayrıca raporlanıyor. Firma isimleri service-only, tenant/firma eşleşmesini kontrol eden dar RPC'den geliyor. Görevler mevcut RPC'sini koruyarak ortak istemci doğrulamasını kullanıyor. 002400 expand migration hazır.

Sekiz yeni PostgreSQL ve yedi yeni uygulama senaryosu; nihai ölçümler `qa/tenant-module-customer-notifications-20260928/manifest.json`. Gerçek e-posta gönderilmedi. HTTP taşıma SQL ile atomik değil; yola çıkmış mail geri çağrılamaz. Aday randevu/sözleşme kayıtlarının ham servis okuması, evrak bildirimlerinin bağlı sözleşme ayrımı ve servis ham SELECT kesimi hâlâ sırada.

**Yerel; üretim SQL/push/deploy yok.** Genel modül kapatma UI'si açılmadı. Parent-FK/açık iş/diğer modül/ayar mutasyonu/cache işleri sürüyor. Yeni 002400 ortak foundation ve 001300 snapshot sonrası, bildirim uygulama kodundan önce; önceki direct-DML cutover kabul sıraları değişmedi.

## Uygulama kaydı — 28 Eylül 2026, bildirim adayları ve evrak sınırı M2l

Randevu/sözleşme/evrak aday okumaları service-only SQL projeksiyonlarına taşındı. Evraklar açık, sözleşmeler kapalıysa yalnız firma evrakı bildirimde kalıyor. Bağlı sözleşmede tenant/firma eşleşmesi aranıyor. Evrak gönderim kaydı öncesi ve sonrası güncel id/tenant/sözleşme ilişkisi tekrar doğrulanıyor; kapanma veya silinmede rezervasyon geri alınıyor. Gruplanmış gönderimin uygunluk kontrolü ortaklaştırıldı.

002500 expand ve altı tabloda service_role ham SELECT kesen 002600 contract hazır. Contract yalnız yeni worker kabulü ve repo dışı entegrasyon envanteri sonrası; etkin inherited/kolon izni kalırsa migration durur. Kaynak incelemesinde dört service-key rotası kontrol edildi; e-posta dizininde bu dört kaynak tabloyu doğrudan okuyan yol kalmadı. On yeni DB ve altı uygulama senaryosu; kesin sonuçlar `qa/tenant-module-notification-candidates-20260928/manifest.json` içinde.

**Yerel; üretim SQL/push/deploy/gerçek mail yok.** Kimlikli tarayıcı/PostgREST kabulü ve canlı şema/izin ölçümü yapılmadı. Son kontrol ile HTTP arasında atomik iptal garantisi yok. Genel modül kapatma UI'si kapalı; parent-FK/diğer definer ve modül yolları, açık iş/bağımlılık, ayar mutasyonu/cache işleri sürüyor. Eski cutover sıraları korunur.

## Uygulama kaydı — 28 Eylül 2026, müşteri/mizan geçmişi M2m

002700 ile contacts/notes şirket ve yazar ilişkileri ile mizan snapshot yükleme ilişkisi (beş FK) RESTRICT'e çevrilmek üzere hazırlandı. Bağlı kayıt varken şirket/profil/yükleme hard-delete reddediliyor; pasifleştirme ve üyelik kaldırma değişmiyor. Şema sapması veya beklenmeyen ek dolaylı mutasyon varsa migration geri alınıyor. Sekiz yeni gerçek PostgreSQL senaryosu, eşzamanlı çocuk ekleme/silme yarışı dahil; nihai sonuç `qa/tenant-module-customer-history-20260928/manifest.json` içinde.

**Yerel; üretim SQL/push/deploy yok.** TS/TSX değişmedi; uygulama/derleme önceki M2l kanıtı yeniden koşulmuş sayılmıyor. Profilin bağlı geçmiş varken fiziksel silinmesi ayrı saklama/anonimleştirme süreci gerektirir. financial_summaries temel CREATE TABLE repo'da bulunamadı; canlı katalog olmadan constraint varsayılmadı. Diğer parent/FK yolları ve açık iş/bağımlılık, modül erişimleri, ayar mutasyonu/cache açık; modül kapatma UI'si kapalı. Kilit maliyeti ve rollback koşulları raporda.

## Uygulama kaydı — 29 Eylül 2026, sözleşme/randevu/evrak geçmişi M2n

20260929000100 migration'ıyla altı FK RESTRICT'e çevrilmek üzere hazırlandı: sözleşme/randevu/evrak firma bağlantıları, randevu/evrak sözleşme bağlantıları ve completion receipt randevu bağlantısı. Sözleşme silinince PDF'nin genel firma belgesine dönüşmesi ve randevu silinince tekrar kontrolü kaydının kaybolması engelleniyor. Composite FK eski SET NULL kolon kapsamı ayrıca doğrulanıyor; şema sapması/ek cascade bütün işlemi geri alıyor.

Sekiz yeni PostgreSQL senaryosu ve ortak modül suite'leri; kesin ölçümler `qa/tenant-module-business-history-20260929/manifest.json`. TS/TSX değişmedi; önceki uygulama testi/derleme yeniden koşulmuş sayılmıyor.

**Yerel; üretim SQL/push/deploy yok.** Canlı katalog/kimlikli tarayıcı/PostgREST kabulü yapılmadı. Diğer parent/FK/definer ve modül yolları, açık iş/bağımlılık, ayar mutasyonu/cache açık; genel modül kapatma UI'si kapalı. Düşük trafikte kontrollü uygulama, okuyucu/yazar kilit maliyeti ve rollback koşulları raporda. Önceki cutover sıraları korunuyor.

## Uygulama kaydı — 29 Eylül 2026, modül değişiklik önizlemesi M2o

20260929000200 read-only expand: yöneticiye tenant/actor/revision doğrulamalı tek snapshot üzerinden taslak, bağımlılıklar ve 15 bilinen açık iş kontrolü. Görev/randevu/sözleşme, aktarım, operasyon kadro/plan/onay ve proje dönemleri; firma/randevu/sözleşmeye bağlı açık görevler dahil. Veri silmez veya ayar değiştirmez. İstemci bütün kontrol listesini ve bağlamı doğrular; hata/eksik ölçüm boş başarıya dönüşmez. EXISTS sorguları yalnız kapanacak modüllerde, İstanbul gün sınırıyla çalışır.

611/611 uygulama ve 164/164 modül PostgreSQL testi; 7 yeni uygulama + 25 yeni DB senaryosu. TypeScript ve test envanteri başarılı; statik 0 FAIL / 2 WARN. Rapor: `qa/tenant-module-change-preview-20260929/README.md`.

**Yerel; push/deploy/üretim SQL/tarayıcı kabulü yok.** Yeni UI veya kaydetme yetkisi açılmadı. Önizleme tüm açık iş türlerinin eksiksiz kabulü değildir; evrak/finans/duyuru ve kalan çapraz yollar ayrıca incelenecek. Kayıt anında kilit/revizyon/üyelik/engel tekrarı zorunlu; diğer modül erişimleri ve direct-writer dönüşümü tamamlanmadan kapatma yok. Üretim derlemesi bu tur çalıştırılmadı. Önceki cutover sıraları korunur.

## Uygulama kaydı — 29 Eylül 2026, personel havuzu modül kapıları M2p

20260929000300 yerel migration: 39 açık RPC girişinde 19 okuma/20 yazma denetimi; talent hazırlama operasyona geçerken staffing de ister. Yazma config SHARE kilidi eski profil/iş kilidinden önce; bekleme sonrası güncel ayar doğrulanır. Ortak talent_assert_scope nötr kalır, operasyon sırf havuz kapalı diye durmaz. Fotoğraf/ek dosya Storage yardımcısında modül kapısı ve upload yazma bariyeri; dosya sahibi/tenant/onboarding sınırları korunur. Ortak hata mesajında kapalı modül açıkça ayrılır.

Kaynak gövdesi hash doğrulamalı üretici, exact signature, üç implementation alias ACL ve beklenmeyen yeni actor-scoped endpoint denetimi; katalog sapmasında tüm transaction rollback. 52 yeni DB + 3 yeni uygulama testi. Ortak sonuç: 216/216 modül DB ve 614/614 uygulama testi; TypeScript/envanter başarılı, statik 0 FAIL / 2 WARN. Kanıt: `qa/tenant-module-talent-gates-20260929/README.md`, endpoint envanteri, manifest ve loglar.

**Yerel; üretim SQL/push/deploy/tarayıcı kabulü yok.** Fixture tüm eski iş algoritmalarını enabled modda uçtan uca çalıştırmaz; çoğu hedefte gate reddi + kaynak gövdesi koruması, saved-view okuma/arşivde gerçek enabled davranış sınandı. İmzalı eski URL süresinden önce iptal garantisi yok. Havuzun operasyon projeksiyonları, worker→talent sync, kalan doğrudan veri/service/trigger/FK yolları ve operasyon/reporting giriş kapıları hâlâ açık. Genel modül kaydetme/kapatma UI'si açılmadı. Üretim derlemesi bu tur yeniden çalıştırılmadı; kontrollü cutover sıraları değişmedi.

## Uygulama kaydı — 29 Eylül 2026, operasyon kapsamlı RPC kapıları M2q

20260929000400 yerel migration: 40 actor/tenant kapsamlı operasyon girişinde staffing denetimi; 15 okuma snapshot, 25 config SHARE bariyeri. Günlük komutlar, işe başlama/yedek, yazışma, çalışma onayı, İDP, sabit kadro ve tekrarlı plan. Plan liste/önizleme eski profil kilidi aldığı için bariyer sınıfındadır. Talent bağımlılığı eklenmedi. Beş hata sunumunda kapalı modül/bozuk ayar bağlantı belirsizliğinden ayrıldı.

Exact-source/signature/ACL kontrolü, beklenmeyen yeni actor-scoped endpoint reddi ve transaction rollback. 49 yeni DB + 7 yeni uygulama testi. Ortak 265/265 modül DB ve 621/621 uygulama testi; TypeScript/envanter başarılı, statik 0 FAIL / 2 WARN. Kanıt: `qa/tenant-module-operations-gates-20260929/README.md`, endpoint listesi, manifest ve loglar.

**Yerel; üretim SQL/push/deploy/tarayıcı kabulü yok.** Fixture tüm eski iş algoritmalarını enabled modda sınamaz; IDP okuma ve bildirim okundu yazması gerçek enabled gövdelerle, diğerleri giriş reddi/kaynak korumasıyla doğrulandı. Eski actor parametresiz ops_mutate/import/board/week/directory/idp_list yolları ve doğrudan ops tablo okumaları ayrı blokta; raporlama/çapraz projeksiyon/senkronizasyon/FK yolları açık. Genel modül kaydetme/kapatma hâlâ yok. Üretim derlemesi bu tur yeniden çalıştırılmadı; eski cutover sıraları korunuyor.

## Uygulama kaydı — 29 Eylül 2026, eski operasyon yolları ve tarihsel temel M2r

Önemli düzeltme: M2q kaynak üreticisi iki eski migration'ın dinamik rol/vardiya değişikliklerini kaçırıyordu. Sekiz scoped fonksiyonun hash'i gerçek migration zinciriyle uyuşmayıp uygulamayı BODY_DRIFT ile durduracaktı; üretime uygulanmadı. Yerel 000400 düzeltildi; fixture artık asıl tarihsel SQL bloklarını yürütür, eski temel açıkça reddedilir. Eski M2q raporunun temel/hash kapsamı bu kayıtla düzeltilmiştir.

Yeni 20260929000500: yedi eski ops_mutate/import/board/week/attendance_week/directory/idp_list girişinde staffing kontrolü; invoker kimlikleri definer yapılmaz. ops_locations/workers/daily_requests/assignments doğrudan SELECT yollarında restrictive tenant+modül politikası. Eski rol/grant sınırları korunur. ACCESS EXCLUSIVE okuyucu/yazıcı maliyeti ve uygulama önkoşulları raporda.

624/624 uygulama, PostgreSQL 17.10 üzerinde 281/281 modül DB testi; 3 yeni uygulama + 16 yeni DB senaryosu. TypeScript/envanter başarılı, statik 0 FAIL / 2 WARN. Rapor: `qa/tenant-module-legacy-operations-20260929/README.md`, 47 endpoint kaynak envanteri, manifest ve loglar. İlk runtime kurulumunda gelen PostgreSQL 18 eski FK hata metni beklentileriyle uyuşmadı; nihai kabul CI ile aynı 17 üzerinde. 18 uyumluluğu iddia edilmez.

**Yerel; üretim SQL/push/deploy/tarayıcı kabulü yok.** Service/trigger/FK yan yolları, ops→talent sync, çapraz projeksiyonlar, raporlama/diğer modüller ve ayar mutasyonu/UI/canlı kabul açık. Genel modül kapatma açılmadı. 14 modül DB suite koşuldu, beş eski bağımsız DB suite ve üretim build bu tur koşulmadı. Kontrollü cutover sıraları korunuyor.


### M2s — 2026-09-29: aday kartı atama ayrımı (yerel)

`20260929000600` detail gövdesini önceki talent kapısından sonraki hash ile doğrular. Staffing kapalıyken atama sorgusu çalışmaz, açık/kapalı bilgisi ayrı döner; havuzdaki personel bağlantısı korunur. Arayüz atamalar/hazırlama/talebe dönüşü yalnız doğrulanmış açık durumda gösterir. Eski yanıt bilinmeyen kabul edilir; migration arayüzden önce uygulanmalı.

626 uygulama ve 54 talent DB testi geçti; TypeScript temiz, statik 0 FAIL / 2 WARN. Kanıt: `qa/tenant-talent-projection-20260929/`. Diğer DB süitleri ve tarayıcı bu turda tekrarlanmadı. Üretime SQL/push/deploy yok.

Kalan: görüşmelerin talep bağlamı, personel JSON/list/merge projeksiyonları ve ops→talent senkronizasyon kararı; reporting ve diğer kapılar; tam blocker listesi; ayar mutation/UI ve uçtan uca kabul. Bu parça tüm çapraz modül erişimlerini kapatmaz.

### M2t — 2026-10-04: görüşmelerin operasyon bağlamı (yerel)

Staffing kapalıyken görüşme geçmişi korunur; canlı talep/şube/firma projeksiyonu sorgulanmaz ve UI bağlantısı gösterilmez. RequestId içeren yeni görüşme staffing yazma bariyerinden geçer; genel görüşme bağımsızdır. Tarihsel requestId ve serbest notlar korunur; tüm tarihsel veri izolasyonu değildir.

628 uygulama / 57 talent DB testi geçti. TypeScript temiz; statik 0 FAIL / 2 WARN. Kaynak driftinde rollback ve fonksiyon metadata korunması ölçüldü. Kanıt `qa/tenant-conversation-modules-20261004/`. Tarayıcı/canlı ve diğer DB süitleri tekrar edilmedi. Üretime yayın yok.

Sırada diğer havuz projeksiyonları/senkronizasyon, reporting ve kalan kapılar; ardından tam blocker, ayar mutation/UI ve uçtan uca kabul.

### M2u — 2026-10-04: bağlı kişi ad senkronizasyonu (yerel)

Ortak `talent_save_person` kapalı staffing'e bağlı kişinin adını yazamaz; diğer havuz alanları ve bağımsız/yeni kişiler çalışır. Kontrol mevcut config SHARE bariyeri altında, kişi revision kontrolünden sonra ve değişiklikten önce yapılır; yeni ters kilit sırası yok. Özel hata mesajı diğer alanların düzenlenebileceğini açıklar.

629 uygulama / 59 talent DB testi geçti. TypeScript temiz; statik 0 FAIL / 2 WARN. Reddedilen ad değişikliği iki tabloya/receipt/history'ye yazmaz; açılınca aynı komut çalışır. Kanıt: `qa/tenant-linked-name-20261004/`. Import/merge/undo ortak fonksiyonu kullanır fakat üst akış kabulü bu turda tekrarlanmadı. Üretime yayın yok.

Kalan: ops→talent trigger kararı, worker kodu/aktiflik projeksiyonları, reporting/diğer modüller, tam blocker, ayar mutation/UI ve uçtan uca kabul.

### M2v — 2026-10-04: operasyon → havuz senkronizasyon kararı ve kabul

Talent kapalıyken açık staffing'in personel oluşturması/isim güncellemesi engellenmez; dahili minimal kişi projeksiyonu korunur. Havuz kullanıcı RPC'leri kapalı kalır. Trigger'ı koşulsuz susturmak yeniden açmada eksik/eski kişi bırakacağından yapılmadı. Trigger'a ters sırada config kilidi eklenmedi. Bu, kapalı modülde kullanıcı işlemi açmak değil ortak kimlik bakımıdır.

Gerçek ops_mutate, talent_prepare_worker ve güncel trigger ile sentetik SQL kabulü: tek kişi/idempotent tekrar, tenant ayrımı, değişmeyen adda tek event, staffing kapalıyken sıfır kayıt. 63 talent DB testi geçti. Kanıt `qa/tenant-worker-sync-20261004/`. Uygulama kodu/SQL davranışı değişmedi; migration ve yayın yok. Tüm üretim trigger/ACL ağı, isim düzenleme RPC'si ve yeniden açma UI'ı bu kanıtın dışında.

Sırada worker kodu/aktiflik projeksiyonları ve reporting; ardından kalan kapılar, tam blocker, ayar mutation/UI ve canlı kabul.

### M2w — 2026-10-04: raporlama girişleri ve kaynak dosyalar (yerel)

12 reporting RPC'si için açık manifest, kaynak hash doğrulama ve reporting kapısı; beş yazma bariyeri ilk profile/iş kilidinden önce. Kaynak dosya helper'ı kapalı modülde okuma/yüklemeyi reddeder; yazmada config bariyeri nedeniyle VOLATILE'a dönüşür. Mevcut bucket politikaları korunur; eski imzalı URL'ler iptal edilmez.

Yeni açık uç nokta/iç yardımcı ACL/gövde driftinde migration durur. UI BM001'i açık modül mesajı ve bilinen ret olarak ayırır. 631 uygulama + 20 reporting DB testi geçti, TypeScript temiz, statik 0 FAIL / 2 WARN. Gerçek config bekleme/commit sonrası ret ölçüldü. Kanıt `qa/tenant-reporting-gates-20261004/`.

Tam aktarım algoritması, gerçek Storage HTTP/politika birleşimi, canlı/tarayıcı/build ve diğer DB süitleri bu turda tekrarlanmadı. Ortak kişi/şube projeksiyonları ayrı inceleme. Kalan: diğer kapılar, tam blocker, ayar mutation/UI, servis tüketici/şema/ACL ön kontrolü ve uçtan uca kabul. Üretime yayın yok.

### M2x — 2026-10-04: dosya lifecycle kaynak düzeltmesi ve 16. kapatma kontrolü

M2p attachment helper beklenen gövdesi eski migration'a dayanıyordu; güncel iptal migration'ı PL/pgSQL gövde kullanıyor. Önceki aday production'da hash kontrolünde duracaktı; eski fixture bunu temsil etmiyordu. Henüz uygulanmamış 000300 güncel kaynağa düzeltildi: iptal tombstone ve attachment SHARE kilidi korunur, config bariyeri önce gelir. Temizlik helper'ının Storage SELECT/DELETE geçidi de talent kapısına bağlandı.

Henüz uygulanmamış 000200 önizlemesi 16 kontrol: tamamlanmamış yükleme/iptal temizliği talent için engel. ready veya cleaned dosya engel değil. Önizleme hâlâ salt okunur; kapatma açılmadı.

631 uygulama + 15 modül DB süitinde 315 test geçti, TypeScript temiz, statik 0 FAIL / 2 WARN. Gerçek iptal politika SQL'i sentetik Storage tablosunda kapalı modülde SELECT/DELETE sıfır satır verdi. Kanıt `qa/tenant-file-lifecycle-20261004/`. Gerçek Storage HTTP/canlı/tarayıcı bu kanıtın dışında. Üretime yayın yok.

## 18 Ekim — modül değişiklik geçmişi ÜRETİMDE

Ayarlar → Modüller içine isteğe bağlı açılan Değişiklik geçmişi eklendi. workspace_module_history_v1 yalnız seçili şirket yöneticisine son 20 kaydı verir; anon/service EXECUTE kapalı, tablolara doğrudan okuma verilmedi. Kullanıcının güncel profil adı, İstanbul saatiyle tarih, açılan/kapatılan modüller ve ayrı ilk kurulum kaydı gösterilir. Hash/command ID ekrana taşınmaz. İstemci context, sıra, eksiksiz kayıt sayısı ve önce/sonra durum zincirini doğrular; şirket değişiminde eski yanıt ve hata durumunda eski liste gösterilmez.

14 hedefli UI/fixture testi, 6 gerçek yerel DB testi ve 748/748 uygulama testi geçti. Yerel GoTrue/PostgREST tarayıcı akışında Duyurular kaydedilerek kapatıldı ve yeni geçmiş satırı doğrulandı; 29 Storage HTTP kontrolü geçti, geçici ortam temizlendi. Dev/typegen çakışmasında ilk commit durdu; sunucu kapatılıp tipler yeniden üretildi, TypeScript temiz. Statik kontrol 0 FAIL; çalışma ağacında henüz commitlenmemiş migration uyarısı ve bilinen iki kullanılmayan bileşen uyarısı vardı.

Canlı ön kontrolde 185 migration, bakım bariyeri yok, doğrulanmış context fonksiyon gövdesi aynıydı. Yeni migration ve defter kaydı exact prefix kontrolüyle aynı transaction'da uygulandı; sayı 186. Kaynak 1e99a70, Vercel dpl_6tdQgVxfnnZiJk5zEsMUNPAo3zT3 ana alana promote edildi ve inspect ile doğrulandı. Mek Group kimlikli geçmiş okumasında ilk kurulum kaydı görüldü. Üretimde şirket ayarları değiştirilmedi, veri silinmedi veya yedeklenmedi. Otomatik e-posta false kalır. Kanıt qa/module-history-20261018/production-release.json.

Sınır: son 20 kayıt; eski geçmiş korunur ama panelde sayfalama yok. İsimler tarihsel snapshot değildir. Canlı yeni değişiklik ve yarış/ağ hatası enjeksiyonu yapılmadı; bunların yerel kabulü ayrı kanıttır. F paketinin audit yüzeyi tamamlandı; kişisel tercihler ve bildirim devamı otomatik olarak tamamlanmış sayılmaz.

## 18 Ekim — Hesabım giriş yüzeyi (YEREL)

Kullanıcı menüsüne /hesabim eklendi. Hesap adı mevcut profiles servisinden kimlik eşleşmesi doğrulanarak okunur; giriş e-postası oturumdan, şirket ve rol doğrulanmış çalışma alanından gösterilir. Şirket uyuşmazlığı veya okuma hatasında önceki bilgi gösterilmez. Şirket ayarları yalnız yöneticiye, şirket değişimi ve bildirim sesi açıklaması mevcut capability/rol koşullarına göre görünür. Menü bağlantısı kaydedilmemiş form korumasını kullanır. Yeni DB yetkisi veya migration yok.

Beş hedefli bileşen testi geçti: doğrulanmış bilgiler, hesap değişimi/hata, geç yanıt, auth öncesi istek atmama, eksik/yanlış profil ve yeniden deneme. TypeScript geçti; statik 0 FAIL/1 bilinen kullanılmayan bileşen WARN. Bunlar DOM/tarayıcı kabulü değildir. Tarayıcı kabulü ve yayın henüz yapılmadı.

Bulgu: updateOwnDisplayName profiles.display_name yazar; AuthContext üst çubuk adı için auth metadata okur. Bu nedenle düzenleme formu açılmadı. Sıradaki iş bu iki kaynağın tutarlı hale getirilmesi ve gerçek yerel RLS yazma kabulü; sonra ad düzenleme. Kalıcı ses tercihi, görev/duyuru bildirimleri veya F/H paketlerinin tamamlandığı iddiası yok. Canlı son kaynak 1e99a70 ve 186 migration kaydı önceki yayın kanıtına dayanır; bu tur üretim yeniden ölçülmedi.

Genel uygulama koşusu 752/752 geçti (111,7 sn); koşu başladıktan sonra eklenen beşinci hesap testi dahil hedefli dosya ayrıca 5/5 geçti. Tam koşuda 753 test çalıştığı iddia edilmez. git diff --check temiz.

## 18 Ekim — hesap adı düzenleme ve tutarlılık paketi

Hesabım ad formu tamamlandı; üst çubuk da artık profiles.display_name okur. Eski auth metadata adı ekranda doğrulanmış ad gibi gösterilmez. Yazma beklenen hesap ve eski ad koşuluyla yapılır; belirsiz cevapta kontrol et akışı taslağı korur. Formdan ayrılma ve çıkış korumalıdır. Gerçek yerel tarayıcıda iki sekme çakışması, kayıt sonrası üst çubuk, taslak ve 390px mobil kabulü geçti. 757 genel uygulama testi; son değişikliklerde 10 hedefli test; gerçek PostgreSQL'de 5 test geçti. Kanıt qa/account-settings-20261018. Next sayfa export hatası ayrılmış bileşenle düzeltildi. İlk buildsiz ortamda URL/anahtar eksikliği nedeniyle prerender başarısızdı; sentetik yerel ortam değerleriyle build tekrarlandı. Üretim profil ACL/186 ledger ön kontrolü salt okunur geçti; yeni migration yok. Yayın sonucu ayrıca kaydedilecek.

## 18 Ekim — Hesabım paketi ÜRETİMDE

Kaynak cef7b4d; Vercel dpl_6L7SC5x4BCGFfsaTxTXhwtyZru1Y www.bpsys.net alanına promote edildi ve bağımsız inspect ile READY doğrulandı. Yeni migration yok; ön kontrolde 186 sürüm ve mevcut kendi-profil/yalnız-ad yazma sınırı doğrulandı. Canlı kimlikli /hesabim ekranında ad ile üst çubuk aynı, şirket/rol doğru bağlamda, değişmemiş formun Kaydet düğmesi kapalı, bildirim yardım metni görünür. Gerçek profil değiştirilmedi; yazma ve iki sekme çakışması yalnız sentetik yerel ortamda sınandı. Otomatik e-posta false korundu. Kanıt qa/account-settings-20261018/release.json. Bu paket ad düzenleme ve hesap görünümünü kapatır; kalıcı ses tercihi veya görev/duyuru bildirimlerini bitirmiş sayılmaz.

## 18 Ekim — ortak bildirim sesi tercih paketi (yayın adayı)

Hesabım ve bildirim kutusu tek ses kontrolüne bağlandı. Hesap+şirket bazlı bu tarayıcı tercihi, kullanıcı hareketi ile etkinleştirme, deneme sesi, sekmeler arası kapatma ve bekleyen etkinleştirmeyi iptal etme tamamlandı. Depolama veya ses hatasında açık görünmez. 766/766 uygulama testi, TypeScript, build ve statik kontrol (0 FAIL/1 mevcut WARN) geçti. Gerçek yerel oturumla iki yüzey, yenileme, iki sekme kapatma ve 390px mobil kabulü yapıldı. Üretim salt okunur 186 ledger ön kontrolü geçti; migration yok. Kanıt qa/notification-preferences-20261018. Görev/duyuru olayları ve push/e-posta kapsam dışı; bu kayıt yayın tamamlandı anlamına gelmez.

## 18 Ekim — bildirim sesi tercih paketi ÜRETİMDE

Kaynak 6cd6007, Vercel dpl_DzXDKuGn8wt2bQdPwAP45qAnrVJR www.bpsys.net üzerinde READY. Hesabım ve bildirim kutusunda ortak kontroller canlı kimlikli okumayla doğrulandı; bildirim listesi hatasız yüklendi. Gerçek hesap tercihine yazılmadı; kalıcılık/iki sekme/mobil akışları sentetik yerelde kabul edildi. 766 test, TypeScript, build geçti. 186 migration, yeni SQL yok. Otomatik e-posta false. Kanıt qa/notification-preferences-20261018/release.json. Sıradaki onaylı kapsam görev/duyuru bildirimlerinin ayrı olay ve yetki tasarımıdır; bu paket onları tamamlamaz.

## 18 Ekim — H bildirim devamı sözleşmesi (tasarım)

6cd6007 kaynakları incelendi; görev atama geçmişi ve duyuru komutları olay kaynakları olarak eşlendi. Ortak kutu yetkisi, alıcı/dedupe/okundu kuralları, kaynak detay bağlantıları, modül kapatma ve geri dönüş sırası BILDIRIM_DEVAMI_UYGULAMA_PLANI_2026_10_18.md içinde yazıldı. Özellikle görev URL hedefi ve ilk üç dışındaki duyuru okuyucusu mevcut değil; UI öncesi bağımlılık olarak kaydedildi. Yeni SQL/kod/yayın yapılmadı. Eski ana durum belgesinin üst özeti güncellendi; tamamlanan modül kapatma işi yeniden açık gösterilmiyor. Sonraki somut blok yerel SQL adayı ve gerçek DB yetki/olay testleri.

## 18 Ekim — görev bildirim olayları yerel aday

qa/task-inbox-20261018/candidate.sql, mevcut atama geçmişi trigger'ından UUID olay kaydı üretir; source transaction ile atomik, task/revision tekil, kendi üstlenme ve kapalı görev sessiz. Gerçek yerel task_execute_v1 üzerinden 8 alt senaryo, üst test dahil 9/9 geçti. Bildirim yazımı hatasının kaynak işlemi de rollback ettiği doğrulandı. İstemci tablo/RPC yetkisi yok; okuyucu, okunma komutu, duyuru modeli ve ortak UI hâlâ açık. SQL production migration zincirine alınmadı ve uygulanmadı; canlı 6cd6007/186 değişmedi (son yayın kaydı). Ayrıntı qa/task-inbox-20261018/README.md. Genel olay+delivery modeli tek alıcılı görev için kaynak bazlı olay tablosuna daraltıldı; ortak API/ses kimliği işi sonraki aşamada.
