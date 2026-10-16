# Genel evrak yaşam döngüsü — 15 Ekim 2026

Bu çalışma yereldir. Yeni migration, üretim verisi değişikliği veya yayın yoktur.

## Tamamlanan düzeltmeler

- Firma evrakı yükleme aksiyonu tenant seçimini `current_user_verified_tenant` ile doğrular.
- Storage yüklemesi exception fırlatırsa sonuç belirsiz olarak bildirilir; otomatik yeniden yüklenmez.
- Yüklemeden sonraki profil okuması veya metadata INSERT exception fırlatırsa mevcut kurtarma akışı özgün belge kimliğiyle çalışır. Aynı tenant/firma/yükleyen/dosya yolu eşleşen kayıt bulunursa başarı doğrulanır. Taşıma hatası tek başına dosya silme gerekçesi değildir.
- Metadata silindikten sonraki Storage temizliği artık tam dosya adına ait silme yanıtını arar. Boş veya farklı dosya yanıtı, API hatası ve exception başarı sayılmaz. Belge kaydının silinmiş olduğu bilgisi korunur; dosya temizliği için kullanıcıya işlem kimlikli uyarı gösterilir.
- Teknik Storage yolu kullanıcı mesajından çıkarıldı; sunucu korelasyon kaydında tutuluyor.

## Doğrulama

`scripts/company-document-lifecycle.test.mjs`: 9 test geçti. Gerçek TypeScript kodu üzerinde kayıp INSERT yanıtı, yanlış kapsam, okuma hatası, korunmuş dosya referansı, kesin INSERT reddi, boş/yanlış Storage yanıtı ve upload/profile/insert exception senaryoları yürütüldü.

Mevcut `document-delete.test.mjs`, çıkarılan gerçek temizlik fonksiyonunu çalıştıracak şekilde güncellendi. Başarılı Storage mock'u artık silinen dosya makbuzunu döndürüyor.

Uygulama paketi: **665/665 geçti**. TypeScript: hata yok. Statik tarama: 0 FAIL / 2 mevcut WARN. `git diff --check`: temiz. Tarayıcı ve gerçek Storage HTTP kabulü bu turda yapılmadı.

## Hâlâ açık — modül kapatmayı açmadan önce

1. Genel evrak için kalıcı hazırlama/yayınlama işlem kaydı ve kontrollü tekrar deneme.
2. Metadata silme ile aynı DB transaction'ında oluşturulan kalıcı dosya temizleme kuyruğu ve tamamlanma kaydı. Mevcut sunucu logu kuyruk değildir.
3. Genel evrak metadata değişikliklerinin revision kontrollü komutlara taşınması; Storage INSERT/DELETE kapıları ve bekleyen işlem kapatma engelleri.
4. Kurtarmada görünür referans kontrolü ile dosya silme ayrı işlemlerdir. Mevcut RLS kontrolleri atomik referans korumasının yerine geçmez. Yeni yaşam döngüsü bu sınırı DB/Storage yetki modeliyle çözmelidir.
5. Yerel veritabanı yarış testleri, tarayıcı kabulü, güncel üretim ön ölçümü ve sıralı yayın.

Bu paket evrak yaşam döngüsünü veya modül aç/kapa işini tamamlanmış hâle getirmez.

## Devam paketi — kalıcı silme temizliği kaydı

`20261015000500_document_cleanup_queue.sql` yeni yerel EXPAND adayıdır. Uygulama yayınından önce uygulanmalıdır; üretime uygulanmadı. Aday toplamı 39.

- `document_cleanup_jobs`, belge silme transaction'ındaki AFTER DELETE trigger ile oluşturulur. Dosyasız belge için iş üretilmez; rollback hem silmeyi hem kuyruğu geri alır. Silinmiş belgeye FK olmadığı için iş kaydı yaşamaya devam eder.
- Kuyruk doğrudan yazılamaz. Yalnız doğrulanmış tenant'ın yöneticisi okuyabilir. Anonymous/service rolüne RPC çalıştırma izni verilmez.
- Storage silme makbuzundan sonra `document_ack_cleanup_v1` çağrılır. Bu komut dosyanın Storage kataloğunda ve belge/sözleşme sürümü referanslarında bulunmadığını kontrol eder. Gerçek boolean `true` dışındaki sonuçlar bekleyen kontrol uyarısıdır. Tamamlanma kaydı silinmez, zaman damgasıyla saklanır.
- RPC yalnız temizlik makbuzunu günceller; Storage dosyası silmez, erişim yetkisi genişletmez ve kapalı modülde yeni belge yazılmasına izin vermez. Mevcut dosyanın yeniden oluşturulmasını engelleyen bir reservation mekanizması değildir.
- Uygulama testleri **666/666**, gerçek yerel şemada SQL testleri **8/8** geçti. TypeScript hatasız, statik tarama **0 FAIL / 2 WARN**, diff temiz. SQL denemeleri sentetik veriyle çalıştı ve rollback yapıldı.

Kapsam sınırı: Bu kayıtlar için otomatik worker veya yönetici tekrar-deneme ekranı henüz yok. Eski yetim dosyalar geriye dönük bulunmaz. Genel yükleme işlem defteri, eşzamanlı referans koruması, Storage yazma kapıları ve modül kapatma engelleri hâlâ tamamlanacak. Yukarıdaki önceki turdaki “kuyruk yok” ifadesi bu altyapı paketiyle tarihsel hâle geldi; tam yaşam döngüsü hazır değildir. Tarayıcı/gerçek Storage HTTP ve üretim kabulü yapılmadı.

## Devam paketi — yöneticinin kontrollü tekrar denemesi

`20261015000600_document_cleanup_retry.sql` yeni yerel adaydır; 005'ten sonra ve uygulamadan önce uygulanmalı. Aday toplamı 40; üretime uygulanmadı.

- Evraklar ekranında yöneticiye açılan, varsayılan kapalı **Dosya temizliği** bölümü eklendi. Yalnız açıldığında veri yükler; belge adı, firma, tarih ve işlem kimliği gösterir. 50 satır + sonraki sayfa işareti kullanır; yükleme hatası boş liste gibi sunulmaz.
- İstemci tenant/user/role kapsamıyla yeniden oluşturulur. Kapanan kapsamın sonucu yeni ekrana yazılmaz. Çift tıklama aynı işlemi iki kez başlatmaz. Başarıdan sonra liste yenilenir; hata durumunda iş tutulur.
- `retryDocumentCleanup` dosya yolunu tarayıcıdan almaz; tenant doğrulamalı RPC ile kuyruktan çözer. Önce tamamlanma kontrolünü dener: dosya önceden kaldırılmışsa tekrar silme çağrısı yapmaz. Gerçek boolean olmayan veya hatalı yanıt dosya silmeyi başlatmaz.
- Kuyruğa giren dosya yolları kalıcı olarak yeniden belgeye bağlanamaz. Metadata INSERT/path UPDATE ve kuyruğa alma aynı path advisory lock'unu kullanır. Kuyruk oluşmadan önceki bir başka belge referansı varsa Storage DELETE restrictive policy silmeyi engeller. Eski retained-version ve reserved-upload politikaları korunur; yeni permissive Storage izni yoktur.
- Yeni belge adları silme sırasında saklanır; eski kuyruk kaydında isim yoksa ekranda açıkça “Silinen belge” gösterilir.

Doğrulama: genel uygulama testleri **671/671**, yerel SQL **11/11**, statik tarama **0 FAIL / 2 mevcut WARN**. Yeni 5 uygulama testi gerçek server action ve React component callback'lerini mock bağımlılıklarla çalıştırır; tarayıcı testi değildir. SQL testleri gerçek yerel şema üzerinde rollback yapar, üretime dokunmaz.

Kalanlar: Gerçek Storage HTTP + tarayıcı kabulü ve iki bağlantılı yarış testi henüz yapılmadı. Otomatik worker yok; tekrar deneme yöneticinin açık eylemidir. Genel upload işlem defteri, diğer Storage yazma yolları ve modül kapatma engelleri hâlâ açık. Özellikle kapalı modülde mevcut Storage SELECT politikası temizlemeyi durdurabilir; modül kapatma bu işlerin entegrasyonu bitmeden açılmamalı. Yukarıdaki “tekrar-deneme ekranı yok” ifadesi artık tarihsel kayıttır.

## Devam paketi — modül ön kontrolü ve eşzamanlılık kanıtı

`20261015000700_document_cleanup_module_preview.sql` yeni yerel adaydır; toplam 41. Üretime uygulanmadı. `preview_workspace_modules_v1` tam imza ve yerel gövde MD5 kontrolüyle güncellenir; beklenmeyen gövdede migration durur. `CREATE OR REPLACE` mevcut sahip ve grant'leri korur.

- Evraklar kapatılmak istenirse `pending_document_cleanup` kontrolü aynı tenant'ın tamamlanmamış kuyruk işlerini bildirir. İş tamamlanınca engel kalkar. Diğer tenant'ın işleri sonucu etkilemez.
- İstemci artık 17 kontrolün eksiksiz yanıtını bekler. Yeni SQL uygulanmadan yeni istemci yayımlanmamalıdır; eksik cevap başarılı ön kontrol sayılmaz.
- Bu yalnız **önizleme entegrasyonudur**. `advisoryOnly=true`, `mutationAvailable=false` korunur. Gerçek modül kapatma komutu hâlâ açık değildir; gelecekte config kilidi altında yeniden değerlendirme gereklidir.
- Genel uygulama testleri **671/671**, yerel kuyruk/önizleme SQL testleri **12/12**, iki gerçek bağlantılı yarış testi **2/2** geçti. TypeScript hatasız; statik tarama **0 FAIL / 2 mevcut WARN**; diff temiz.
- Yarış 1: silme önce kilidi aldı; yeni referans bekledi ve commit sonrası `23514` ile reddedildi. Yarış 2: referans önce kilidi aldı; silme bekledi, sonrasında kalan referans nedeniyle Storage silme kontrolü false döndü. Her test yalnız sentetik kabul DB'sinin geçici klonunda çalıştı, klon finally içinde silindi.

Komutlar: `npm run qa:document-cleanup:local`, `npm run qa:document-cleanup:race`. İkinci test için `pg` dev dependency ve yerel Docker kabul DB'si gerekir. Bu çalıştırmada eksik yerel paket için önceden kurulmuş `/tmp/bps-calendar-qa-runtime/node_modules` NODE_PATH kullanıldı. Hiçbir bağlantı bilgisi loglanmadı.

Yerel web sunucusu çalışmıyordu; bu turda tarayıcı veya gerçek Storage HTTP kabulü yapılmadı. Modülün tam kapatma güvenliği, genel upload işlem defteri ve kalan Storage yazma kapıları hâlâ açık. Önceki paragraftaki “iki bağlantılı yarış testi henüz yapılmadı” artık tarihsel kayıttır.

## 16 Ekim — genel evrak yükleme işlem defteri

15 Ekim'de başlayan devam paketinin yerel adayı `20261015000800_document_upload_attempts.sql`; aday toplamı 42. Üretime uygulanmadı; uygulama kodundan önce migration gerekir.

- `document_prepare_upload_v1`, doğrulanmış tenant, güncel rol, aktif firma ve documents modülünü kontrol ederek dosya gönderilmeden önce kalıcı kayıt oluşturur. Config → profile → company sırası kullanılır. Aynı kimlik ve aynı metadata hazırlığı yeniden kullanabilir; farklı payload reddedilir. Bu dosya içeriği hash'i veya genel otomatik retry garantisi değildir.
- Kayıtta belge/tenant/firma/yükleyen kimlikleri, hedef yol, ad, kategori, tarih ve boyut tutulur. Doğrudan tablo yazımı API rollerine kapalıdır. İlgili tenant'ta yükleyen kendi kayıtlarını, yönetici tüm kayıtları okuyabilir.
- Metadata INSERT trigger'ı hazırlık kaydıyla alanları eşleştirir ve `published_at` makbuzunu aynı transaction'da yazar. Metadata rollback olursa makbuz da geri alınır; hazırlık kaydı bekler. `published_at`, metadata commit makbuzudur; tek başına Storage içeriğinin/bütünlüğünün doğrulandığı anlamına gelmez.
- Server action hazırlık yanıtı doğru yolu dönmeden Storage'a byte göndermez. Belirsiz yanıtta eski kayıt-dışı akışa düşmez. Rezervasyonlu metadata hatalarında otomatik dosya temizliği yapılmaz; aynı ID ile mevcut kayıt doğrulanır veya kontrol uyarısı döner. İzinli roller yönetici/operasyon/İK ile eşitlendi. INSERT'ten farklı belge ID'si dönerse doğrudan başarı sayılmaz.

Doğrulama: **672/672** uygulama testi, **6/6** yeni yerel SQL testi, TypeScript hatasız, statik **0 FAIL / 2 WARN**. Son küçük aksiyon kontrollerinden sonra ilgili **27/27** test yeniden geçti; diff temiz. SQL testleri rollback kullanır. Komut: `npm run qa:document-upload:local`.

Kapsam sınırı: Bu bir izlenebilirlik EXPAND paketidir; genel document INSERT/UPDATE yetkilerini kapatmaz ve tüm Storage yazılarını rezervasyona zorlamaz. Eski kayıt-dışı yollar bu aşamada hâlâ vardır. Pending upload liste/kurtarma/iptal UI ve RPC'leri, dosya sahipliği/içerik doğrulamalı finalize komutu, pending upload modül önizleme kontrolü ve Storage write cutover henüz eklenecek. Hazırlığı belirsiz veya dosya gönderilmeden kesilmiş denemeler de bekleyen kayıt bırakabilir; temizlendi sayılmaz. Gerçek modül kapatma bu bütünlük tamamlanmadan açılmamalıdır. Tarayıcı/Storage HTTP kabulü ve yayın yapılmadı.

## 16 Ekim — otomatik devam: bekleyen yükleme ön kontrolü

`20261016000100_document_upload_module_preview.sql` eklendi; aday toplamı 43. Yereldir, üretime uygulanmadı. Önceki preview gövdesi tam imza ve MD5 ile doğrulanır; şema sapması migration'ı durdurur. Yeni istemciden önce SQL uygulanmalıdır.

- Evraklar kapatılmak istendiğinde aynı tenant'taki `published_at IS NULL` yüklemeler `pending_document_upload` engeli oluşturur. Dosya gönderilemeden kesilen hazırlıklar da dahildir; zaman aşımı kendiliğinden iptal sayılmaz.
- Metadata makbuzu oluştuğunda bu engel kalkar; makbuz yine dosya içeriği doğrulaması anlamına gelmez. Başka tenant kayıtları ve kapatılması istenmeyen modüller gereksiz engel üretmez.
- İstemci 18 kontrol bekler. Eksik yükleme değerlendirmesi veya bozuk yanıt başarılı rapora dönüştürülmez. Gerçek kapatma hâlâ kapalı: `advisoryOnly=true`, `mutationAvailable=false`.
- **673/673** uygulama testi, **9/9** yükleme/önizleme SQL testi geçti. TypeScript hatasız; statik tarama **0 FAIL / 2 mevcut WARN**, diff temiz. SQL testleri sentetik yerel veritabanında rollback yaptı; üretim ve gerçek dosyalar değişmedi.

Sıradaki paket: bekleyen yüklemelerin listeleme/kurtarma/iptal komutları ve kullanıcı akışı; ardından Storage sahipliği/içerik doğrulamalı finalize, yazma kapıları ve gerçek yerel Storage/tarayıcı kabulü. Bu kayıt önceki bölümdeki “pending upload önizleme kontrolü eksik” durumunu kapatır; diğer açıklar devam eder.

## 16 Ekim — bekleyen yüklemelerin görünürlüğü

`20261016000200_document_pending_uploads.sql` ile salt okunur listeleme RPC'si eklendi. Aday toplamı 44; üretime uygulanmadı. Migration uygulamadan önce yayımlanmalı.

- Evraklar ekranında varsayılan kapalı **Yarım kalan yüklemeler** bölümü var. Açılınca yüklenir; 50 satırlık sayfa ve 51. satır işareti kullanır. Belge adı, firma, zaman, işlem kimliği ve dosyanın Storage kataloğunda görünüp görünmediği gösterilir. Dosya byte'ı, imzalı bağlantı veya iç yol döndürülmez.
- Yönetici doğrulanmış tenant'ın tüm bekleyenlerini; operasyon ve İK yalnız kendi yüklemelerini görür. Görüntüleyici, başka tenant, kapalı documents modülü ve public/service-role erişimi reddedilir. Tamamlanan metadata makbuzları listeden çıkar.
- Servis bozuk/eksik/yanlış tenant/tekrar eden kayıtları ve boolean olmayan dosya durumunu reddeder. Yükleme hatası boş liste sayılmaz. Ortak `useScopedResource` geç kalan yanıtların yeni kapsamı ezmesini engeller; bileşen tenant/user/role anahtarıyla yeniden oluşturulur.
- Bu ekran yalnız durum kontrolüdür. Kurtarma/iptal düğmeleri henüz yok; açıklama bunu açıkça söyler. Dosya varlığı içerik veya sahiplik doğrulaması sayılmaz.

Kanıt: **677/677** uygulama testi, **13/13** yerel yükleme SQL testi, TypeScript temiz, statik **0 FAIL / 2 mevcut WARN**, diff temiz. Yeni dört uygulama testi servis veri doğrulaması ve gerçek component callback'lerini çalıştırır; tarayıcı kabulü değildir. SQL testleri rollback yapar. Üretim verisi veya dosyası değiştirilmedi.

Sonraki paket: güvenli finalize/kurtarma ve iptal protokolü. Storage'da devam eden bir yüklemeyle iptal yarışını ve paylaşılan dosya referanslarını çözmeden doğrudan silme düğmesi açılmamalı. Ardından Storage yazma kapıları, tarayıcı/gerçek yerel Storage kabulü ve gerçek modül kapatma entegrasyonu tamamlanacak.

## 16 Ekim — genel yükleme finalize komutu

`20261016000300_document_finalize_upload.sql` eklendi. Yerel aday toplamı 45; üretime uygulanmadı. Uygulamadan önce migration gerekir.

- Genel upload server action artık doğrudan documents INSERT yapmaz; orijinal işlem ID'siyle `document_finalize_upload_v1` çağırır. Tek çağrı yapar; yanlış/eksik/transport yanıtında eski ID üzerinden okuma ile uzlaştırır, otomatik dosya silmez.
- Komut doğrulanmış tenant ve güncel rol/modül/firma kontrolünden sonra hazırlık kaydını kilitler. Şimdilik yalnız ilk yükleyen kendi işlemini tamamlayabilir; yönetici başkasının yüklemesini bu komutla tamamlayamaz.
- Storage kataloğundaki owner_id, MIME ve sayısal dosya boyutu rezervasyonla eşleşmelidir. Belge alanları ve yükleyen etiketi DB'den gelir; Istanbul gününe göre geçerlilik durumu hesaplanır. Bu PDF içeriğinin DB'de analiz edildiği anlamına gelmez. Normal server action dosyanın `%PDF-` başlangıcını yükleme öncesi kontrol etmeye devam eder.
- Metadata makbuzu oluşmuşsa aynı ID doğrulanarak döner; tekrar belge oluşturulmaz. Sonradan silinen belge makbuzu kurtarma adı altında yeniden oluşturulmaz. Config → profile → company → path advisory → attempt → Storage sırası kullanılır.
- Rezervasyonlu nesneye Storage UPDATE restrictive fence eklendi. DELETE için kalıcı temizlik işi gerekir; önceki referans/tenant/version politikaları ayrıca geçerlidir. Bu yeni INSERT yetkisi veya tam raw-DML cutover değildir.

Kanıt: genel uygulama paketi **677/677**, ardından eklenen başarılı/bozuk finalize makbuzu testi dahil ilgili yaşam döngüsü paketi **12/12** geçti. Yerel yükleme SQL paketi **17/17** geçti. TypeScript temiz, statik **0 FAIL / 2 WARN**, diff temiz. SQL dosya sınamaları Storage katalog fixture'ları kullanır; gerçek HTTP/binary test değildir.

Kalan: kurtarma düğmesi henüz UI'da açılmadı. Gerçek Storage HTTP ve tarayıcı kabulü; devam eden upload ile iptal yarışını çözen iptal protokolü; kalan legacy metadata yazıları ve Storage INSERT sınırları. DB finalize komutu dosyanın içeriğine hash/PDF parse uygulamaz; bu sınır sonraki kurtarma protokolünde gözetilmeli. Genel modül kapatma hâlâ kapalı; yayın yapılmadı.

## 16 Ekim — gerçek yerel Storage HTTP kabulü

`npm run qa:document-storage:http` eklendi (`storage-http.mjs`). Yeni migration yok, aday toplamı 45; üretim değişmedi.

**8/8 kontrol geçti:** authenticated HTTP PDF yükleme; yükleyen owner_id kaydı; finalize ve tekrarlı makbuz; byte-for-byte authenticated indirme; başka tenant indirmesinin reddi; rezervasyonlu nesnenin üzerine yazmanın reddi; metadata silinmeden yapılan HTTP DELETE'in dosyayı kaldırmaması; metadata silindikten sonra HTTP temizleme ve kalıcı acknowledgement.

Ortam: bilgisayarda hazır `storage-api:v1.35.3` ve `postgrest:v14.3` imajları, yalnız 127.0.0.1'e bağlı rastgele Storage portu, sentetik kabul DB'sinin geçici klonu, geçici üretilmiş JWT'ler ve sentetik PDF. Dosya bytes gerçek Storage API'den geçti; finalize/metadata/ack SQL çağrıları authenticated rol ve sentetik claims ile çalıştı. Dolayısıyla bu bir tarayıcı veya tüm RPC'lerin HTTP üzerinden testi değildir.

Başlangıçta kaynak katalog kopyasında Storage migration defterinin boş olması servis başlangıcını bozdu. Migration geçmişi uydurulmadı. Yalnız geçici klondaki Storage şeması kaldırılıp servisin kendi migration'larıyla oluşturuldu; kaynak Storage politikaları ve kaynakta mevcut schema USAGE izinleri aynen geri yüklendi. Public fonksiyon sayısının değişmediği kontrol edildi. Servis için geçici DB'de şema oluşturma izni verildi; global rol ayarları ve kaynak DB değiştirilmedi. Bu yeniden kurulan Storage şeması, üretimin Storage sürümünün birebir kopyası olarak sunulmamalıdır.

Başarısız denemeler dahil runner finally içinde geçici servisleri ve DB klonunu kaldırır. Auth bilgileri bellek içinde kalır; hata çıktıları maskelenir. Test konfigürasyonu için Supabase'in [resmi Docker yapılandırması](https://github.com/supabase/supabase/blob/master/docker/docker-compose.yml) ve kurulu imajın kaynak ayarları incelendi. Uygulama politikaları gevşetilmedi.

Kalan: kurtarma UI/server action, iptal ile devam eden upload yarışı, legacy metadata/Storage INSERT cutover ve tarayıcı kabulü. Önceki “gerçek Storage HTTP kabulü yok” ifadesi bu dar akış için kapanmıştır; üretim veya browser kabulü yapılmış değildir.

## 16 Ekim — bekleyen yüklemeyi güvenle tamamlama

`20261016000400_document_upload_recovery.sql` yeni yerel adaydır; toplam 46. Üretime uygulanmadı. Pending liste dönüşüne `can_resume` eklendiği için migration uygulama sürümünden önce gerekir. Liste fonksiyonu aynı transaction içinde yeniden oluşturulur ve authenticated grant'i yeniden tanımlanır.

- Yeni salt okunur hedef RPC'si yalnız doğrulanmış tenant'ta, documents açıkken, yönetici/operasyon/İK rolündeki **ilk yükleyene** orijinal yol ve boyutu döndürür. Yönetici başkasının bekleyen kaydını görebilir ama kurtaramaz; UI bu ayrımı açıkça gösterir.
- Evraklar panelindeki “Yüklemeyi tamamla” server action'ı tarayıcıdan dosya yolu almaz. RPC hedefindeki dosyayı authenticated Storage ile okur; kayıtlı boyut ve `%PDF-` başlangıcını doğrulayıp orijinal ID ile finalize çağırır. Finalize güncel rol/modül/tenant/owner/MIME/boyut kontrolünü DB kilitleri altında tekrar yapar. PDF başlangıç kontrolü tam PDF parse, zararlı içerik taraması veya hash doğrulaması değildir.
- Çift tıklama ikinci isteği başlatmaz; sonuç belirsizse başarıya çevrilmez, otomatik yazma tekrarı/silme yapılmaz. Başarılı işlem bekleyen listeyi ve ana evrak listesini yeniler. Scope değişip bileşen kaldırılırsa eski işlem sonucu yeni ekrana taşınmaz.
- **682/682** genel uygulama testi, **19/19** sentetik yerel SQL testi, **9/9** gerçek yerel Storage HTTP kontrolü geçti. HTTP kabulüne bekleyen yüklemenin hedefini çözme ve metadata finalize olmadan dosyanın gerçek byte'larını indirme eklendi. RPC çağrıları bu kabulde SQL üzerinden authenticated claims ile yapılır; Next server action/tarayıcı uçtan uca testi değildir. TypeScript hatasız; statik **0 FAIL / 2 mevcut WARN**; diff temiz.

Kalan: iptal ile devam eden Storage yüklemesinin yarışını çözen protokol; legacy document DML ve Storage INSERT cutover; tarayıcı kabulü. İptal düğmesi henüz açılmadı, gerçek modül kapatma hâlâ kapalı. Bu paketin hiçbir kısmı üretime yayımlanmadı.

## 16 Ekim — yükleme iptali ve geç gelen Storage yazısı

`20261016000500_document_upload_cancellation.sql` yerel adaydır; toplam 47. Üretime uygulanmadı. Uygulamadan önce migration ve Storage trigger uyumluluğu için güncel üretim ön kontrolü gerekir.

- İlk yükleyen, kendi tenant'ındaki tamamlanmamış yüklemeyi açık onayla iptal edebilir. Güncel rol/modül kontrolü ve config → profile → path → attempt kilit sırası kullanılır. Tamamlanmış belge, başka yükleyenin kaydı ve referanslı dosya iptal edilmez. Tekrarlanan iptal aynı kalıcı temizlik işini kullanır.
- İptal ayrı bir silme iddiası değildir: mevcut cleanup kuyruğu aynı transaction'da oluşturulur ve yol kalıcı olarak emekliye ayrılır. Bekleyen yükleme listesinden çıkar; modül önizlemesinde yükleme engeli yerine temizlik engeli kalır. Yönetici Dosya temizliği panelinden kontrol/temizleme yapar; temizlik tamamlanana kadar modül ön kontrolündeki engel kalkmaz.
- Storage INSERT trigger'ı aynı path advisory kilidini kullanır ve kilit sonrasında kalıcı kuyruk kaydını yeniden okur. İptal önce commit olursa bekleyen INSERT `23514` alır. Storage INSERT önce commit olursa iptal onu silinmiş saymaz; kalıcı temizlik işi bırakır. Tamamlanan temizlikten sonra bile yol tekrar kullanılamaz. API'den Storage kataloğuna doğrudan DELETE yapılmaz.
- UI iptal öncesi açıklama, onay ve vazgeç sunar; çift tıklama engellenir. RPC'nin yalnız boolean `true` makbuzu başarıdır; eksik/bozuk/transport yanıtı iptal edildi mesajına dönüşmez. Yönetici temizlik paneli açıksa yeni iş için “Listeyi yenile” kullanılabilir.

Kanıt: **683/683** genel uygulama testi; son eklenen onay/vazgeç testiyle ilgili panel/servis paketi **10/10**; yerel SQL **22/22**; gerçek iki bağlantılı iptal/Storage INSERT yarışı **2/2**; yerel Storage HTTP **11/11**. TypeScript temiz, statik **0 FAIL / 2 mevcut WARN**, diff temiz. Yeni komut `npm run qa:document-upload:race`; bu çalıştırmada mevcut `/tmp/bps-calendar-qa-runtime/node_modules` üzerinden pg kullanıldı. Yarış ve HTTP ortamları geçici sentetik klonlardır; runner finally blokları klon/servisleri kaldırır.

Sınır: HTTP testleri API sonucu ve Storage katalog görünürlüğünü doğrular; Storage servisinin kendi geçici fiziksel blob temizliğini bağımsız incelemez. Bu, üretimdeki Storage sürümüyle tam uyumluluk veya tarayıcı kabulü değildir. Legacy document DML ve tüm rezervasyonsuz Storage INSERT yollarının cutover'ı hâlâ açık. Gerçek modül kapatma kapalı; yayın yapılmadı. Önceki “iptal düğmesi açık değil” kaydı bu yerel paket için kapanmıştır.

## 16 Ekim — evrak metadata komutu ve doğrudan UPDATE kapısı

`20261016000600_document_metadata_command.sql` eklendi; yerel aday toplamı 48. Üretime uygulanmadı. RPC ve UPDATE fence aynı transaction'da kurulur; uygulama/SQL yayın sırası ve eski istemcilerin etkisi yayın öncesinde değerlendirilmelidir.

- Klasör değiştirme ve geçerlilik düzenleme, `document_edit_metadata_v1` üzerinden çalışır. Tenant, firma, rol, modül ve ekranda görülen revision doğrulanır. Tarih penceresi açıldıktan sonra kayıt değişmişse yeni sürümü okuyup üzerine yazmak yerine `40001` ile durur. Tarihten türeyen durum sunucuda İstanbul gününe göre hesaplanır.
- Komut yalnız category/validity değiştirir; path, kimlik, firma veya tenant kabul etmez. Sözleşmeye bağlı evrakın kategorisi taşınamaz; geçerlilik güncellemesi yönetici ve açık documents/contracts modülleri gerektirir. Config → profile → company → contract (varsa) → document kilit sırası kullanılır.
- `documents_command_update_only` restrictive politikası authenticated doğrudan UPDATE'i kapatır. SECURITY DEFINER sözleşme PDF komutları kendi yetki kontrolleriyle devam eder. API'den doğrudan INSERT/DELETE henüz kapatılmadı; bu paket tam DML cutover olarak sunulmaz.
- Kullanılmayan raw `insertDocument`, `updateDocument`, `replaceDocumentFile` ve servis `updateContractDocumentFile`, `updateDocumentStatus` kaldırıldı. Eski raw PDF helper testinin yerine export'un kaldırılması kontrolü kondu; gerçek SQL PDF prepare/finish/sürüm testleri ayrıca çalıştırıldı. Fail-closed eski `createDocument` stub'ı korunuyor.

Kanıt: **685/685** uygulama testi; **25/25** yerel yükleme/metadata SQL testi; yeni fence altında **13/13** sözleşme/evrak erişim SQL testi. Son grup linked category reddi, yönetici/modül şartı ve gerçek PDF değiştirme/sürüm yolunu içerir. TypeScript temiz; statik **0 FAIL / 2 mevcut WARN**; diff temiz. Sentetik yerel SQL testleri rollback kullanır. Bu turda Storage HTTP veya tarayıcı kabulü yeniden çalıştırılmadı; önceki HTTP kanıtı önceki pakete aittir.

Kalan: genel belge DELETE komutu ve gördüğü sürümle silme; doğrudan INSERT kapısı; rezervasyonsuz Storage INSERT sınırları; tarayıcı kabulü; üretim şeması/izinleri ve yayın sırası kontrolü. Gerçek modül kapatma kapalı, yayın yok.

## 16 Ekim — onaylanan evrak sürümünü silme

`20261016000700_document_delete_command.sql` eklendi; aday toplamı 49. Üretime uygulanmadı. Yeni RPC ve authenticated doğrudan DELETE engeli aynı migration içindedir; uygulama uyumu ve yayın sırası ön kontrolde değerlendirilmelidir.

- Firma detayı silme onayı, o an görülen tenant/firma/revision değerlerini taşır. Aksiyon sonradan güncel revision okuyarak kullanıcının eski onayını yeni kayda uygulamaz. Manager rolü, doğrulanmış tenant, documents ve bağlıysa contracts modülü veritabanında tekrar kontrol edilir.
- Kilit sırası config → profile → company → contract (varsa) → path advisory → document. Silme öncesi revision, firma, tenant, bağlı sözleşme ve yol yeniden doğrulanır. Sürüm tarihçesi bulunan evrak silinmez. Eski sürüm `40001`, tarihçe `23503`; bulunmayan/erişilemeyen kayıt başarı sayılmaz.
- Metadata DELETE ve mevcut cleanup trigger'ının iş kaydı aynı transaction'dadır. Aksiyon yalnız beklenen kimlik/kapsam/revision ve geçerli yol taşıyan makbuzdan sonra Storage temizliği dener. Belirsiz transport/yanlış makbuzda dosyaya dokunmaz; kalıcı kuyruk yöneticinin tekrar kontrolüne kalır. Dosyasız evrak için sahte temizlik işi oluşturulmaz.
- `documents_command_delete_only` restrictive policy API'den doğrudan DELETE'i kapatır. Doğrudan INSERT ve tüm rezervasyonsuz Storage yüklemeleri henüz kapatılmadı. Gerçek modül kapatma hâlâ kapalı.

Kanıt: **685/685** uygulama testi; **28/28** yükleme/metadata/silme SQL testi; **13/13** sözleşme/evrak SQL testi (tarihçeli evrak silme reddi dahil); **11/11** gerçek yerel Storage HTTP kontrolü (metadata silme artık yeni RPC ile); **2/2** gerçek iki bağlantılı düzenleme/silme yarışı. Son yarışlar silme önceyse bekleyen edit'in, edit önceyse eski revision ile delete'in reddedildiğini doğrular. TypeScript temiz; statik **0 FAIL / 2 mevcut WARN**, diff temiz. `npm run qa:document-delete:race` yerel Docker + pg gerektirir; bu turda mevcut `/tmp/bps-calendar-qa-runtime/node_modules` NODE_PATH kullanıldı. Klonlar finally içinde kaldırılır.

Kalan: INSERT ve rezervasyonsuz Storage yazma sınırları, tarayıcı kabulü, güncel üretim şeması/izinleri ve sıralı yayın kontrolü. Bu turda üretim verisi değiştirilmedi, yayın yapılmadı.

## 16 Ekim — belge INSERT ve rezervasyonsuz Storage yükleme sınırı

`20261016000800_document_insert_reservations.sql` yerel adaydır; toplam 50. Üretime uygulanmadı. İlk olarak git durumu ve son ilerleme kaydı doğrulandı; önceki kurtarma/iptal/düzenleme/silme işleri tekrarlanmadı.

- Authenticated doğrudan documents INSERT restrictive policy ile kapatıldı. Metadata yalnız mevcut SECURITY DEFINER finalize komutlarından yayımlanır; genel belge ve sözleşme komutları kendi tenant/rol/modül kontrollerini korur. Önceki UPDATE/DELETE kapılarıyla birlikte authenticated ham tablo DML yolu artık kapalıdır. Bu, servis/yönetici rollerinin DB yetkilerinin kaldırılması değildir.
- Documents bucket INSERT yeni bir restrictive policy ile mevcut rezervasyona bağlandı. Genel yüklemede doğrulanmış tenant, ilk yükleyen, aynı owner_id, izinli rol, açık documents modülü, pasif olmayan firma ve yayımlanmamış hazırlık gerekir. Sözleşme yüklemesinde ayrıca yönetici, açık contracts modülü, pending komut ve eşleşen sözleşme/firma kapsamı gerekir. Diğer bucket'lara ek kısıt getirilmedi.
- Kuyrukta emekliye ayrılmış yollar reddedilir; önceki aynı-path trigger iptal ile geç gelen INSERT yarışını korumaya devam eder. MIME/boyut ve dosya içeriği kontrolleri mevcut finalize/server action katmanlarında kalır; bu politika bunların yerine geçmez.

Kanıt: **31/31** yerel SQL, **13/13** gerçek yerel Storage HTTP kontrolü geçti. Yeni HTTP kontrolleri rezervasyonsuz yüklemenin reddi ve mevcut sözleşme prepare → HTTP upload → finalize akışının hâlâ yayımlanabilmesidir. Static **0 FAIL / 2 mevcut WARN**, diff temiz. Bu SQL/test paketinde uygulama kaynakları değişmedi; önceki 685/685 uygulama testi bu turda yeniden çalıştırılmadı. SQL rollback, HTTP geçici sentetik DB/servisler kullanır; üretim yok.

Kalan: tarayıcı kabulü, tüm adayların güncel üretim şeması üzerinde sıralı provası ve yayın ön kontrolü. Storage politikasının modül/rol kontrolleri statement snapshot'ına dayanır; modülün gerçek kapatılması sırasında devam eden tüm Storage yazılarıyla koordinasyon ayrıca değerlendirilmelidir. Eski rezervasyonsuz nesnelerin UPDATE/taşıma yolları da bu INSERT paketiyle tamamen kapatılmış sayılmaz. Gerçek modül kapatma hâlâ kapalı; bu kayıt tam yaşam döngüsü/yayın kabulü iddiası değildir.

## 16 Ekim — eski Storage nesnelerinde değişmezlik ve temizlik şartı

`20261016000900_document_storage_legacy_write_fences.sql` yerel adaydır; toplam 51. Git durumu ve önceki ilerleme kaydı doğrulandı. Üretime uygulanmadı.

- Documents bucket'taki authenticated UPDATE hem USING hem WITH CHECK ile kapatıldı. Eski rezervasyonsuz dosyalar da üzerine yazılamaz/taşınamaz; başka bucket'tan UPDATE ile documents'a giriş de bu kontrolden geçemez. Yeni sürüm mevcut rezervasyonlu yeni yol akışını kullanır.
- Authenticated DELETE için eski nesnelerde de aynı tenant'ın tamamlanmamış cleanup işi ve mevcut referans/yetki kontrolü gerekir. Belge kaydı dururken dosyanın bağımsız kaldırılması engellenir. Diğer bucket politikaları değiştirilmedi; servis/DB yönetici rollerinin yetkileri bu paketle kaldırılmadı.
- Gerçek yerel HTTP testine servis rolüyle yalnız geçici sentetik ortamda eski dosya fixture'ı eklendi. Kullanıcı token'ıyla overwrite/move reddi, erken DELETE sonrası byte'ların aynı kalması ve metadata DELETE/cleanup işi sonrası Storage DELETE + ack başarıları doğrulandı. Bu servis token'ı fixture kurmak içindir, uygulama akışına eklenmedi.

Kanıt: **32/32** yerel SQL, **16/16** gerçek Storage HTTP kontrolü geçti; statik **0 FAIL / 2 mevcut WARN**, diff temiz. İlk SQL testindeki doğrudan storage.objects DELETE, Storage'ın kendi `protect_delete` korumasına takıldı. Koruma aşılmadı; SQL testi UPDATE/iş kaydı/ack sınırına daraltıldı, gerçek silme HTTP testinde doğrulandı. Uygulama kaynakları değişmedi; genel uygulama/TypeScript testleri bu turda tekrar edilmedi. Gerçek veri ve üretim değişmedi.

Kalan: tarayıcı kabulü; gerçek modül kapatma ile devam eden Storage yazılarının koordinasyonu; bütün adayların güncel üretim şeması/Storage sürümü üzerinde sıralı prova ve yayın ön kontrolü. Önceki kayıttaki eski nesne UPDATE/taşıma açığı bu yerel paketle kapandı. Gerçek modül kapatma hâlâ kapalı; yayın yapılmadı.

## 16 Ekim — gerçek bileşenin sentetik tarayıcı kabulü

Git durumu ve son kayıt doğrulandı; uygulama sunucusu çalışmıyordu. Yalnız 127.0.0.1:3059 üzerinde Next 15.5.26 ile gerçek PendingDocumentUploads/useScopedResource bileşenleri ve sentetik servis yanıtları çalıştırıldı. Codex in-app browser üzerinden panel açma, başkasının kaydında işlem düğmesi olmaması, iptal onayı/vazgeç, işlem sırasında disabled düğmeler, başarılı tamamlama ve ana liste callback'i, liste hatası, belirsiz sonuçta kaydın korunması, onaylı iptal ve ayrı temizlik mesajı gözlendi. Tarayıcı error log sorgusu boştu.

Kanıt ve tekrar çalıştırma: `browser-fixture/README.md`, `browser-fixture/cancel-result.png`. Fixture ürün bileşenini import eder; yanıtlar stub'dır. Genel uygulama kabuğu/font kurulumu, mobil viewport, tenant geçişi, 50 satır sayfalama ve gerçek server action/RPC/Storage uçtan uca akışı bu testin kapsamında değildir. Bu sınırlı tarayıcı kabulü üretim kabulü olarak sunulmaz. Yeni migration veya ürün kodu değişikliği yok; aday toplamı 51. Yayın yapılmadı.

Kalan: gerçek oturum/server action ile bütünleşik yerel tarayıcı testi; modül kapatma sırasında Storage yazı koordinasyonu; güncel üretim şeması/Storage sürümü üzerinde sıralı prova ve yayın ön kontrolü. Gerçek modül kapatma kapalı.

## 16 Ekim — gerçek PostgREST RPC kabulü ve çatışma hata kodu düzeltmesi

Storage HTTP düzeneğine gerçek PostgREST HTTP RPC çağrıları eklendi. Genel evrak prepare, kurtarma hedefi, finalize/tekrar finalize, metadata düzenleme, eski revision ile silme, geçerli silme, iptal ve cleanup ack artık HTTP üzerinden doğrulanır. Yabancı tenant ve anonim prepare reddi de ölçülür. Sözleşme finalize ve eski dosya fixture komutlarının bazıları hâlâ SQL üzerinden çalışır; tüm akışların HTTP veya tarayıcı uçtan uca kabulü yapıldı denmez.

İlk HTTP denemesinde eski revision ile document_delete_v1 çağrısı 10 saniyede zaman aşımına uğradı. Yerel pg_stat_activity engelleyen kilit göstermedi; iş kuralı çatışması için kullanılan 40001, PostgREST yeniden denemesine yol açıyordu. Supabase resmi açıklaması: https://supabase.com/docs/guides/troubleshooting/high-cpu-and-infinite-transaction-retries-when-using-custom-error-codes-in-rpc-functions-77326b

Yayımlanmamış yedi migration'daki iş kuralı çatışmaları PT409 yapıldı: 20261013000100, 20261015000100, 20261015000300, 20261016000300, 20261016000500, 20261016000600, 20261016000700. İstemci hata eşlemeleri PT409 ve eski/gerçek 40001'i tanır. Önceki bölümlerdeki 40001 ifadeleri tarihsel kayıttır; bu komutların güncel iş kuralı çatışması PT409'dur. Yeni migration eklenmedi, aday toplamı 51. Bunlar uygulanmamış kaynaklardır; üretim migration geçmişi değiştirilmedi. Yayın öncesi sıralı prova ve fonksiyon gövdesi kontrolleri güncel dosyalarla tekrarlanmalıdır.

Kanıt: HTTP 19/19 (eski revision için gerçek HTTP 409 ve PT409 dahil); evrak SQL 32/32; sözleşme komutları 18/18; iki bağlantılı düzenleme/silme yarışı 2/2; takvim SQL smoke exit 0/rollback. Uygulama 685/685, TypeScript exit 0, statik 0 FAIL / 2 mevcut WARN, diff temiz. HTTP kabul JSON'u rpc-http-result-20261016.json içinde saklandı. Testler sentetik yerel klonlarla çalıştı; gerçek veri değişmedi ve yayın yapılmadı.

Kalan: diğer mevcut RPC'lerde iş kuralı için kullanılan 40001 kodlarının ayrıca taranması; gerçek oturum/server action ile tarayıcı kabulü; Storage yazılarıyla gerçek modül kapatmanın koordinasyonu; güncel üretim şemasında tüm adayların sıralı provası. Gerçek modül kapatma kapalıdır.

## 16 Ekim — kalan workspace çatışmalarının ileri migration ile kapatılması

Repo SQL taramasında kalan açık iş kuralı 40001 kullanımları admin_manage_membership (2 dal), select_workspace (3 dal) ve preview_workspace_modules_v1 (1 dal) olarak bulundu. Tarihsel 20260926000100 ve 20261005002100 dosyaları değiştirilmedi. Yeni yerel aday `20261016001000_workspace_conflict_http.sql` üç fonksiyonu PT409'a geçirir; aday toplamı 52. Önce 20261016000500 dahil preview ekleri uygulanmalıdır. Tam imza, beklenen prosrc MD5 ve değiştirme sayısı doğrulanır; farkta işlem durur. CREATE OR REPLACE mevcut owner/ACL, SECURITY DEFINER, volatility ve config değerlerini korur. Bu üretim kataloğunun güncel ölçümü değildir; yayından önce ayrıca ölçülmelidir.

Üyelik UI hata eşlemesi PT409 ve eski 40001 için anlaşılır yenileme mesajı döndürür. Yerel HTTP testinde altı çatışma dalı gerçek PostgREST üzerinden 409/PT409 verdi: mevcut üyeliğe add, eski sürümle rol değişimi, üyelik sürümü değişmiş şirket seçimi, eski seçim sürümü, başka şirket için command_id tekrar kullanımı ve eski modül ön kontrolü. Yetkisiz üyelik çağrısı 403; reddedilen çağrılarda rol değişmedi. Geçerli şirket seçimi ve güncel advisory preview çalıştı; mutationAvailable=false korundu. Sentetik platform-admin bayrağı yalnız geçici klonda açılıp kapandı.

Kanıt: `storage-http.mjs` 22/22 kontrol; `workspace-conflict.test.mjs` 2/2 (katalog özellikleri/ACL korunması ve ikinci fonksiyon gövdesi değişmişse ilk değişikliğin de geri alınması); uygulama 686/686, TypeScript exit 0, statik 0 FAIL / 2 mevcut WARN, diff temiz. Son HTTP ölçümü `workspace-rpc-http-result-20261016.json`. Önceki evrak/Storage HTTP kontrolleri yeni migration altında da geçti. SQL fixture'ları rollback, HTTP geçici sentetik klon ve servis temizliği kullanır. Üretim verisi değişmedi, commit/push/deploy yapılmadı.

Sınır: Bu tarama repo içindeki açık SQL hata kodlarını kapsar; üretimde farklı fonksiyon veya dış servis bulunmadığı iddiası değildir. Eski migration'lardaki 40001 kodları tarihsel olarak kalır, yeni ileri düzeltmeyle değiştirilir. Gerçek oturum/server action tarayıcı kabulü, Storage–modül kapatma koordinasyonu ve güncel üretim üzerinde bütün adayların sıralı provası/yayın ön kontrolü hâlâ açıktır. Gerçek modül kapatma kapalı.

## 16 Ekim — Storage INSERT ve modül yapılandırması eşzamanlılık kapısı

Yeni yerel aday `20261016001100_document_storage_module_barrier.sql`; aday toplamı 53. Mevcut document_storage_retired_path_v1 trigger gövdesi hash ile doğrulanır. Authenticated JWT ile documents INSERT artık tenant config SHARE → profile SHARE → yeniden modül/rezervasyon kontrolü → path advisory sırasını izler. Sözleşme rezervasyonlarında documents ve contracts birlikte kontrol edilir. Her beklemeden sonra yeni sorgu snapshot'ı kullanılır; yalnız dış INSERT'in RLS snapshot'ına güvenilmez. Trigger lock_timeout 5 saniye; mevcut tombstone kontrolü tüm roller için korunur. Service/admin bakımının mevcut ayrı yetkileri kaldırılmaz.

Gerçek iki bağlantılı testte: (1) config kilidi alınıp modül kapatıldıktan sonra bekleyen authenticated INSERT BM001 ile reddedildi ve nesne metadata kaydı oluşmadı; (2) INSERT önce başladıysa config UPDATE kilidi transaction sonuna kadar bekledi, ardından bekleyen rezervasyon görüldü. İkinci testte kapatma yapılmadı: gelecekteki kapatma komutu aynı kilit altında blocker kontrolünü tekrar yapmak zorundadır. İptal önce/INSERT önce yarışları yeni trigger ve authenticated claim altında da geçti.

Kanıt: `storage-module-race.test.mjs` 2/2, `cancel-race.test.mjs` 2/2 ve önceki workspace migration korumaları 2/2; toplam 6/6. Gerçek yerel Storage/PostgREST HTTP paketi 23/23: kapalı contracts modülü rezervasyonlu PDF yüklemesini reddetti; yeniden açıldığında mevcut prepare/upload/finalize çalıştı. Diğer evrak kurtarma/iptal/silme, yetki ve workspace HTTP kontrolleri korundu. `storage-barrier-http-result-20261016.json` sonucu saklar. Statik 0 FAIL / 2 mevcut WARN, diff temiz. Bu tur ürün TypeScript kodu değişmedi; önceki 686/686 uygulama ve TypeScript sonucu yeniden çalıştırılmadı.

Sınırlar: Bu kapı Storage metadata INSERT transaction'ını koordine eder; fiziksel byte transferi boyunca uygulama kilidi tutulduğu veya tüm HTTP isteğinin atomik olduğu iddiası değildir. Finalize kendi doğrulamalarını sürdürür. Ayrıcalıklı SQL ile config/settings güncelleyen her bakım komutunun bu kilit protokolüne uyması gerekir. Gerçek modül kapatma hâlâ kapalı; onun blocker kontrolü ve diğer modüllerin yazıları ayrıca kabul edilmeden açılmaz. Gerçek oturum/server action tarayıcı kabulü, güncel üretim kataloğu ve tüm adayların sıralı yayın provası bekliyor. Üretim verisi değişmedi; commit/push/deploy yapılmadı.

## 16 Ekim — oturumlu tarayıcı hazırlığı ve tam derleme

`authenticated-browser.mjs` ve isteğe bağlı `BPS_LOCAL_BROWSER=1` dalı eklendi. Gerçek Next uygulaması, geçici Auth ve loopback API proxy'si için hazırlıktır; stub UI kabulünden ayrıdır. Gerçek ürün auth/server action bypass edilmez. Denemeler sentetik klon üzerinde kaldı.

Auth v2.186.0 migration başlangıcı, auth.oauth_clients tablosunda client_id sütunu bulunmadığı için 20250731150234 migration'ında 42703 verdi. Dolayısıyla gerçek giriş, ekran kurtarma/iptal ve bütünleşik tarayıcı kabulü **yapılmadı**. Bu UI hatası değil, test Auth sürümü/şema uyumsuzluğudur. Ayrıntı ve tekrar adımları AUTHENTICATED_BROWSER_ACCEPTANCE.md içinde. Geçici servisler/klonlar temizlendi; üretim şeması veya gerçek hesap değişmedi.

Buna paralel `npm run build`, explicit yerel Supabase URL ve sentetik build anahtarı ile exit 0 verdi; Next 15.5.26 üretim derlemesi ve sayfa üretimi tamamlandı. Bu ölçüm canlı bağlantı veya giriş kabulü değildir. Diff kontrolü temiz. Ürün TypeScript/SQL değişmedi, aday 53; yayın yok. Öncelik: uyumlu yerel Auth fixture'ını doğrulayıp gerçek oturumlu kabulü bitirmek, ardından güncel üretim kataloğu ve sıralı yayın provası. Gerçek modül kapatma kapalı.

## 16 Ekim — gerçek oturumlu kurtarma ve iptal kabulü

Auth engeli boş ayrı sentetik Auth DB + resmi migration'larla çözüldü. Gerçek hook gövdesi ve üyelik/seçim snapshot'ı kullanıldı; bu fixture dinamik tenant/rol değişimini kapsamaz. Gerçek parola girişi, gerçek Next /evraklar, server action, PostgREST ve Storage üzerinden kurtarma ve iptal doğrulandı. Tamamlama ana listeyi güncelledi; Vazgeç kaydı korudu; iptal temizlik işini oluşturdu. Reload sonrası sonuçlar kalıcı. SQL: published=true, belge=1, iptal edilen belge=0, bekleyen cleanup=1. Tarayıcı error log boş. Kanıtlar AUTHENTICATED_BROWSER_ACCEPTANCE.md, authenticated-db-result-20261016.json ve authenticated-cancel-20261016.png.

Bu tur yeni ürün SQL/TS değişikliği yok; 53 aday yerelde. UI'den yeni dosya seçimi/yükleme, mobil ve çoklu şirket/token değişimi kabulü; güncel üretim katalog ölçümü ve sıralı prova açık. Yayın yapılmadı. Önceki tam build sonucu bu QA-only değişiklikte yeniden çalıştırılmadı.

## 16 Ekim — UI dosya seçimi/yükleme ve mobil kabul

Gerçek oturumlu /evraklar formunda sentetik 125 byte PDF dosya seçiciden seçildi; Synthetic HTTP ve Firma / Yetki Belgesi ile yüklendi. Kaydetme sırasında form kilitlendi, başarı bildirimi geldi ve Firma evrakları sayacı arttı. Reload sonrası kayıt görünür kaldı. DB ölçümü: category=yetki_belgesi, company=Synthetic HTTP, published=true, bytes=125, ownerMatches=true. Bu küçük dosya tam PDF render kalitesi testi değildir; dosya yükleme hattı kabulüdür. Dosya seçici beklenenden uzun sürdü; aynı dosya ikinci kez yüklenmedi.

390×844 viewport'ta sayfa genişliği 390, scrollWidth 390; ana ekran ve yükleme formunda yatay taşma yok. Formun iptal/yükle düğmeleri görünür ve boş formda Yükle disabled. Türkçe karakterleri eksik form etiketleri, placeholder ve hata metinleri UploadDocumentModal.tsx içinde düzeltildi; gerçek tarayıcıda yeni etiketler görüldü. Viewport geri alındı. Tarayıcı error log sorgusu boş; TypeScript exit 0, diff temiz. Metin düzeltmesine yeni birim testi eklenmedi.

Kanıtlar: ui-upload-result-20261016.json, ui-upload-mobile-20261016.png, ui-upload-form-mobile-20261016.png. Üretim yayını yok, aday SQL sayısı 53 değişmedi. Dinamik tenant/rol değişimi ve token yenileme bu snapshot Auth fixture kapsamı dışındadır. Fiziksel mobil cihaz/klavye, çok sayfalı listeler, güncel üretim katalog ölçümü ve sıralı yayın provası hâlâ ayrıca doğrulanmalıdır.

## 16 Ekim — rol ve şirket değişimi HTTP kabulü

storage-http.mjs gerçek PostgREST/Storage sınırında genişletildi. Şirket seçimi ve üyelik sürümü içeren imzalı sentetik JWT kullanılır. Yönetici yetkisiyle gerçek dosyası yüklenmiş bir bekleyen kayıt hazırlandı. Üyelik goruntuleyici yapıldığında eski token'ın pending listesi 403; yeni membership sürümünü taşıyan salt-okunur token'ın liste, prepare, finalize ve cancel çağrıları 403 döndü. Kayıt yayımlanmadı ve reddedilen cancel cleanup oluşturmadı. Yönetici rolü geri getirildikten sonra geçerli token ile iptal başarılı oldu.

Gerçek select_workspace RPC ile A→B geçişi yapıldı. Eski A token'ı A pending/prepare çağrılarında 403; geçerli B token'ı da A pending/prepare çağrılarında 403 aldı. B'nin kendi pending listesi 200 döndü. Reddedilen prepare kimlikleri için kayıt oluşmadı. Fixture sonunda RPC ile A'ya dönüldü ve ek sentetik B üyeliği kaldırıldı; tamamı geçici klon içindedir.

Kanıt: scope-http-result-20261016.json, **25/25** HTTP kontrolü; eski 23 kontrol korundu. Node sözdizimi ve diff kontrolü temiz. Ürün TS/SQL değişmedi, önceki tip/build ölçümleri yeniden çalıştırılmadı. Yeni migration yok, 53 aday; yayın yok. Bu, tarayıcıdaki açık ekranın kapanma/yeniden yüklenme davranışını veya gerçek Auth refresh akışını doğrulamaz: token üretimi test imzalama yardımcısıyladır. Browser Auth fixture üyelik snapshot'ı henüz dinamik eşitlenmiyor. Bu tur öncelik veri sınırında gerçek değişim/reddin doğrulanması oldu.

Kalan: tarayıcı şirket seçici/rol değişimi ve gerçek token yenileme; güncel üretim kataloğu, tüm adayların sıralı provası ve yayın ön kontrolü. Gerçek modül kapatma kapalı. Gerçek veri değiştirilmedi.


## 16 Ekim — gerçek tarayıcı şirket seçimi ve rol yenileme kabulü

Önceki snapshot sınırı bu seri geçiş testi için giderildi. authenticated-browser.mjs, gerçek Auth token isteğinden önce sentetik kaynak klondaki üyelik/seçim durumunu tek sorguyla okuyup ayrı Auth fixture tablolarına transaction ile eşitler; eşitleme başarısızsa 503 döner. Ürün custom_access_token_hook gövdesi değişmedi. Yerel Next sürecinde NEXT_PUBLIC_BPS_MULTI_WORKSPACE_ENABLED=true açıldı; üretim ayarı değiştirilmedi.

Gerçek şirket seçiciyle A→B geçişi, select_workspace ve gerçek Auth refresh sonrası Synthetic B başlığı ve boş evrak/pending listesi gösterdi; A kayıtları görünmedi. B→A dönüşünde A'nın yarım yüklemesi yeniden göründü. A ekranı açıkken yalnız sentetik klonda rol goruntuleyici yapıldı. Eski ekrandaki Yüklemeyi tamamla yetki hatası verdi; başarı gösterilmedi. Şirket seçici güncel Görüntüleyici rolünü gösterdi; yeniden seçim/gerçek token refresh sonrası /evraklar Erişim kısıtlı gösterdi. SQL sonucu: role=goruntuleyici, documents=0, published=false. Tarayıcı error log sorgusu boş.

Kanıt: browser-role-result-20261016.json; browser-switch-b-20261016.png, browser-role-denied-20261016.png ve browser-role-restricted-20261016.png. HTTP hazırlık paketi 25/25; Node sözdizimi ve git diff --check geçti. Bu tur QA fixture değişti; ürün SQL/TS ve migration sayısı değişmedi. Önceki 686/686 uygulama ve tam derleme sonuçları yeniden çalıştırılmadı. 53 aday yerelde; commit/push/üretim yayını yapılmadı.

Sınır: Auth fixture ayrı DB'de token isteği anında eşitlenir; üretimin birebir tek-DB topolojisi veya eşzamanlı refresh yarışı kanıtı değildir. Çok sekmeli açık formda şirket değişimi, refresh sırasında eşzamanlı üyelik değişimi ve fiziksel mobil cihaz/klavye ayrıca açık. Güncel üretim kataloğu, 53 adayın sıralı yayın provası ve yayın ön kontrolü bekliyor. Gerçek modül kapatma advisoryOnly/mutationAvailable=false olarak kapalı kalır.


## 16 Ekim — birleşik sıralı yerel prova

İlk 31 adayın kaynak hash’leri tarihsel uygulama kayıtlarıyla eşleşti. Bu sentetik tabanın yeni geçici klonunda kalan 22/22 migration tek sırada geçti. Birleşik takvim yaşam döngüsü/takip görevi/eski durum çatışması, evrak kısıtlayıcı RLS katalog kontrolleri ve workspace hata kodları kontrolü geçti. Geçici DB temizlendi. İki QA varsayım düzeltmesi (tabanın 29 değil 31 olması; yazma engelinin grant değil RLS olması) ilk başarısız sonuçlarıyla kaydedildi; ürün değişmedi. Kanıt qa/release-chain-20261016/README.md ve result.json. Bu tam 53 replay veya güncel üretim doğrulaması değildir. Eski snapshot dosyası yok, oturumda üretim SQL aracı yok; güncel katalog/ledger ölçümü ve temiz tabanda tam prova yayın öncesi açık. 53 aday yerelde, yayın yok, gerçek modül kapatma kapalı.


## 16 Ekim — yayın ön kontrol girdileri

qa/release-chain-20261016 altına salt okunur katalog SQL'i ve eksik/eski kanıtta duran Python kontrolü eklendi. Kontrol 129 kayıtlık baseline ledger, prova dosya hashleri ve ölçüm tazeliğini denetler; başarı bile productionReady=false döndürür. Proje kimliği, tam katalog karşılaştırması ve temiz snapshot üzerinde tam prova ayrıca gereklidir. 8/8 test; gerçek yerel PostgreSQL sorgusu başarılı (263 fonksiyon/89 tablo/116 politika metadata). Geçici klon temizlendi. Aktif klasörde `supabase migration list --linked` proje ref yok hatası verdi; MCP SQL aracı yok. Üretim erişimi/ölçümü/yayın yapılmadı. Ürün kodu ve 53 migration adayı değişmedi; gerçek modül kapatma kapalı.


## 16 Ekim — güncel üretim şemasıyla tam 53 aday provası (en güncel sonuç)

Önceki bağlantı engeli çözüldü: eski ana klasörün Supabase proje kaydı `dffdzbmnmnokbftbujsy` olarak doğrulandı; CLI --workdir üzerinden üretim ledger'ı salt okunur alındı. 129 kayıt önceki ölçümle birebir eşleşti; son kayıt 20261004001400. Aktif kaynak klasörü veya üretim şeması değiştirilmedi.

Yalnız public/auth/storage/extensions şema tanımları CLI db dump ile /private/tmp/bps-prod-schema-20261016.sql dosyasına 0600 izinle alındı. İş, auth kullanıcı ve Storage nesne verisi aktarılmadı; snapshot repoya eklenmedi. Temiz yerel DB'de platform eklentileri kuruldu, şema restore edildi. Tüm public/auth/storage tablolarının boş olduğu doğrulandı; sonra iki sentetik tenant/kullanıcı eklendi. **53/53 aday dosyası değiştirilmeden sıralı uygulandı.** Birleşik takvim yaşam döngüsü/takip görevi/eski durum çatışması, evrak RLS katalog kapıları ve workspace hata kodu kontrolü geçti. Yerel klon kaldırıldı.

Kanıtlar: production-ledger.json; full/result.json; full/snapshot-manifest.json; full/*.log. full-rehearse.py tekrar çalıştırırken snapshot hash'ini manifestle doğrular. Bu sonuç önceki 'temiz şemada tam prova bekliyor' ve 'üretim bağlantısı yok' durumlarını günceller. Ayrı catalog-preflight.sql üretimde çalıştırılmadı; güncel şema restore ve migration içi hash/ACL koşullarıyla uyumluluk ölçüldü.

Sınır: gerçek üretim satırlarının migration backfill maliyeti, trafik altında kilit süreleri ve canlı servis sürümleri bu sentetik provayla ölçülmez. Yayın sırası (komut API'si kullanan uygulama ile doğrudan yazma kapılarının uyumu), güncel kod/build, commit/yedek ve dağıtım sonrası kabul ayrıca tamamlanmalıdır. Yeni migration eklenmedi; commit/push/deploy veya üretim migration uygulaması yapılmadı. Gerçek modül kapatma kapalı kalır.


## 16 Ekim — güncel kod kontrolü ve yayın sırası

686/686 uygulama, 19 birim vaka + 4 kontrol, TypeScript exit 0, statik 0 FAIL/2 mevcut WARN ve açıkça yerel Supabase adresiyle Next build exit 0. Envanter 123 uygulama/27 DB/7 pending dosya; tüm DB suite bu tur tekrarlanmadı. qa/release-chain-20261016/ROLLOUT.md eski uygulama/yeni RPC uyumsuzluğunu ve doğrudan yazma kapılarını ele alır. Canlı geçiş için eski sekmeler ve servis yazıcıları dahil doğrulanmış bakım mekanizması eksik; bu koşul karşılanmadan 53 aday tek seferde canlı trafiğe uygulanmamalı. Üretim yayını yok.
