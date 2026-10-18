# Genel evrak yaşam döngüsü — güncel durum ve kronolojik kayıt

## Güncel durum — 17 Ekim 2026

Bu özet son kayıtlı ölçümlere dayanır; aşağıdaki 15–16 Ekim notları kronolojik geçmişi korur. Bu özet hazırlanırken üretime yeniden sorgu gönderilmedi.

- **Canlı kaynak:** `312a468` (ürün düzeltmeleri `415dfff` dahil), deployment `dpl_CQ9mr8chp8Ppat2BEWunDquhgzMs`. Kanıt: `qa/release-chain-20261016/recovery-fix-release-20261017.json`.
- **Veritabanı:** son salt okunur ölçümde 182 migration; bakım bariyeri yok. Kanıt: `qa/release-chain-20261016/recovery-fix-preflight-20261017.json`.
- **Evrak paketi yayımlandı:** kalıcı hazırlama/yayınlama defteri, bekleyen liste, güvenli kurtarma/iptal, revision kontrollü metadata/silme ve kalıcı dosya temizliği. Son bağlantı hatası mesajları ve istek başına deadline da canlıda.
- **Modül kapatma:** pending upload ve pending cleanup ön kontrolüne bağlı; gerçek kapatma işlemi **hâlâ kapalı** (`advisoryOnly=true`, `mutationAvailable=false`). Evrak paketinin bitmesi tüm modüllerin güvenle kapatılabildiği anlamına gelmez.
- **Son doğrulama:** 692 uygulama testi, 12 hedefli evrak testi; statik 0 FAIL / 1 mevcut WARN; TypeScript temiz. Güncel yerel Storage HTTP 28/28. Farklı tarihlerdeki test sayıları toplanmaz.
- **Canlı kabul:** kimlikli evrak/pending/cleanup ekranları açıldı. Önceki sentetik belge yükleme/klasör değişikliği, randevu ve sözleşme yazma kontrolleri ayrı tarihli kanıtlardır.

### Kabul kapsamı ve kalanlar

| Akış | Kanıtlı kapsam | Kalan sınır |
|---|---|---|
| Kurtarma ve iptal | Yerel gerçek Auth + Next server action + Storage; dosyalı/dosyasız iptal; eşzamanlı finalize tek evrak | Üretimde kasıtlı kesinti/timeout enjekte edilmedi |
| Şirket geçişi | İki tarayıcı sekmesinde açık form kapanıyor; HTTP gövdesi açıkken şirket değişirse eski upload/finalize reddediliyor | Bu iki kanıt, kesintili dosya aktarımı sırasında tarayıcı UX'inin uçtan uca testi değildir |
| Yetki değişimi | Eski token ve güncel salt okunur rol reddediliyor; gerçek Auth refresh sonrası kısıtlı ekran | Refresh isteğiyle tam eşzamanlı üyelik değişimi ayrı senaryo |
| Modül kapatma koordinasyonu | İki DB bağlantısıyla Storage/config kilit sırası; bekleyen işlem ön kontrolü | Gerçek kapatma yazma komutu ve bütün modül engellerinin uçtan uca kabulü ayrı iş |
| Mobil | Önceki 390×844 tarayıcı viewport kabulü | Fiziksel cihaz, dosya seçici ve zayıf bağlantı testi yapılmadı |

Bu evrak bloğunda bekleyen ürün düzeltmesi veya migration yok. Sonraki ek kabul işleri yukarıdaki sınırlarla sınırlanır; tamamlanan kontrol listesi yeniden başlatılmaz. Otomatik e-postalar kapalı; gerçek veri temizliği veya tam içerik yedeği yapılmadı.

---

## Tarihsel başlangıç — 15 Ekim 2026

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


## 16 Ekim — uygulama bakım kapısı

Server-only BPS_MAINTENANCE_MODE=1 ile middleware, oturum yenilemeden önce tüm yolları 503/no-store/Retry-After ile durduruyor. Türkçe GET HTML, diğer isteklerde JSON; POST/server action otomatik replay veya yönlendirme yok. Matcher bütün yolları kapsıyor; bakım kapalıyken önceki asset bypass korunuyor. 4 yeni test; gerçek Next HTTP üzerinde 6 yol/yöntem + HTML testi erişilemeyen Supabase adresiyle geçti. 690/690 uygulama testi, TypeScript ve statik 0 FAIL/1 WARN. Üretimde etkinleştirilmedi; migration sayısı 53 değişmedi. Bu yalnız uygulama kapısıdır: doğrudan Supabase/Storage, eski deployment URL'leri ve devam eden işlemlerin drain kontrolü hâlâ yayın engeli. Ayrıntı ROLLOUT.md.


16 Ekim: Geçici DB yayın bariyeri prototipi qa/release-chain-20261016/barrier altında hazır. Yerel 90 tabloda mevcut DML bekleme/okumaya izin, authenticated/service/Storage session_user reddi, SECURITY DEFINER yolu, yeni tablo extend ve atomik kaldırma dahil 9 kontrol geçti. Doğrudan admin migration DML’i açık. SQL otomatik migration değil; aday sayısı 53. Üretimde uygulanmadı. Gerçek Storage HTTP, üretim bağlantı kimliği ve bariyer açık tam 53 zincir provası bekliyor; fiziksel dosya aktarımı/drain bütünüyle kanıtlanmadı.


## 16 Ekim — birleşik bariyer kabulü tamamlandı (yerel)

`BPS_RELEASE_BARRIER=1 python3 qa/release-chain-20261016/full-rehearse.py` güncel şema snapshot'ını temiz DB'ye kurdu; sentetik seed öncesi tabloların boşluğu doğrulandı. Bariyer kuruldu, 53 adayın her biri sırayla uygulandı; her migration sonrası extend + verify çalıştı. Birleşik takvim smoke, evrak RLS ve workspace hata kodları geçti. Bariyer remove başarıyla tamamlandı; geçici DB silindi. Kanıt full-barrier/result.json: applied=53, success=true, barrierRemoved=true, cleaned=true. İlk tam prova full/ altında korunur.

`BPS_RELEASE_BARRIER=1 node qa/contract-write-20261015/storage-http.mjs` gerçek yerel Storage/PostgREST servisleriyle **26/26** kontrolü geçti. Bu modda PostgREST doğrudan postgres yerine authenticator bağlantısı kullanır; böylece admin istisnası testi yanlışlıkla geçiremez. Önceki 25 HTTP kontrolü de aynı bağlantıyla geçti. Barrier kurulunca prepare RPC HTTP 503/PT503 verdi. Gerçek Storage upload ve delete HTTP 500 döndü (bu Storage sürümünün trigger hata eşlemesi; 503 değildir). Reddedilen upload için storage.objects kaydı oluşmadı; silinmesi istenen mevcut nesne indirildi ve byte içeriği korundu. Bariyer kaldırıldıktan sonra aynı rezervasyonla yükleme ve aynı dosyanın silinmesi başarılı. Kanıt barrier/http-result.json ve http-suite-result.json. Servisler/DB klonu temizlendi.

Bu, önceki 'bariyer altında tam zincir ve Storage HTTP kabulü bekliyor' maddelerini kapatır. Ürün TS/SQL migration kaynakları değişmedi; QA runner genişletildi, 53 aday değişmedi. Üretime uygulanmadı; tam uygulama/build testleri QA-only değişiklik için tekrarlanmadı. Node syntax ve diff kontrolü geçti.

Kalan sınırlar: Üretimde gerçek bağlantı session_user ve doğrudan admin kullanan dış yazıcılar ayrıca doğrulanmalı. Metadata'ya henüz ulaşmamış dosya byte aktarımı ve eski signed URL okumaları tamamen durdurulmuş sayılmaz. Her migration sonrası extend'den önce yeni tabloda kısa korumasız aralık vardır; uygulama kapalı tutulmalı, yeni tabloya yazan başka servis bulunmamalı. Gerçek trafik/veri hacminde kilit süreleri bu sentetik testte ölçülmez. Cron/e-posta gibi harici yan etkiler için uygulama kapısı da gereklidir. İki katman birlikte yayın planına göre işletilmelidir; bu testler kendi başına üretim yayın onayı değildir.


16 Ekim üretim yazıcı incelemesi: salt okunur metadata ölçümünde CLI session_user=cli_login_postgres/current_user=postgres, Storage TRIGGER=true fakat owner-role USAGE=false bulundu. Yerel supabase_admin prototipini bu bağlantıyla kurup kaldırabileceğimiz kanıtlanmadı; üretim bariyeri uygulanamaz kabul ediliyor. install/extend değişiklik öncesi owner-rol kontrolüyle eksik yetkide durur; yerel 10 kontrol geçti. Anlık idle oturumlar dış yazıcı yok kanıtı değildir. Platform cron/net worker mevcut, bu DB’de extension/job kaydı yok. WRITER_AUDIT.md ayrıntıyı ve repo servis yazıcılarını kaydeder. Üretime yazılmadı; roller değiştirilmedi, yayın yok.


## 16 Ekim düzeltmesi — Supabase özel DROP TRIGGER izni ölçüldü

Önceki owner-role USAGE=false ölçümü doğruydu; bundan üretimde trigger kaldırılamayacağı sonucu çıkarmak eksikti. Resmi supautils dokümanı, drop_trigger_grants ile tablo sahipliği olmadan belirli tablolarda kaldırmaya izin verildiğini açıklıyor: https://github.com/supabase/supautils . Üretimde salt okunur current_setting ölçümü postgres için storage.objects/buckets/prefixes/s3_multipart_uploads/s3_multipart_uploads_parts izinlerini doğruladı; production-supautils.json kanıttır. Standart PostgreSQL kuralı https://www.postgresql.org/docs/17/sql-droptrigger.html tek başına bu platform için yeterli değildir.

Bariyer şimdi sahiplik VEYA tam tablo adına yönelik mevcut supautils kaldırma iznini arar. İzin yok/NULL ise durur. Yetki genişletme veya sahiplik değişimi yoktur. CLI session_user=cli_login_postgres yalnız current_user=postgres ve postgres üyeliği birlikte varsa kabul edilir; API authenticator/service rolüne bypass verilmez. Üretimde CLI ile gerçek bariyer kurulmadı; bu dalın canlı uygulama kabulü yapılmış sayılmaz.

Kapsam: public tabloları ve yukarıdaki beş Storage dosya tablosu. Storage migration/istatistik/analytics gibi iç tablolarına bakım trigger'ı eklenmez. Supabase Storage şema sahipliğinin korunması ve kayıtların API üzerinden yönetilmesi tavsiyesi geçerlidir: https://supabase.com/docs/guides/storage/schema/design ve https://supabase.com/docs/guides/platform/permissions . Bu geçici trigger yönteminin Supabase tarafından özel bir bakım özelliği olarak onaylandığı iddia edilmiyor.

Yerelde postgres rolüyle kurma/extend/kaldırma testleri: 86 tabloda 10 kontrol geçti; yabancı sahibin özel izni bulunmayan public tablosunda kurulum önceden reddedildi. Güncel şema kopyasında bariyer kurma/extend/kaldırma artık postgres ile çalıştırılarak 53/53 migration ve temizleme geçti. Gerçek Storage/PostgREST 26/26 geçti. Restore için yerel supabase_admin kullanımı platform kurulumuyla sınırlı; bariyer süper kullanıcıyla sınanmıyor. Sonuçlar full-barrier/result.json ve barrier/http-suite-result.json.

Önceki 'sahiplik eksikliği nedeniyle uygulanamaz' sonucu bu ölçümle güncellenmiştir. Henüz üretim yayını yok; gerçek trafik altında eski deployment/cron geçişi, başlamış dış yan etkiler ve son canlı kabul açık. Üretime kalıcı yazma yapılmadı; 53 aday değişmedi. Node sözdizimi/diff temiz; ürün kodu değişmediği için uygulama build tekrar çalıştırılmadı.


## 16 Ekim — bakım sürümü Vercel’de hazır, ana alan adına alınmadı

Mevcut www.bpsys.net deployment kimliği canlıdan doğrulandı: dpl_CamuYBKVLbRg1WgStdWgjuRF4xVw. Bu kimlik kayıtlı dcc8065 yayın manifestiyle aynı; Vercel inspect yanıtı kaynak commit alanı vermediğinden commit eşleşmesi tarihsel manifest bağlantısına dayanır.

Geçici paket git archive dcc8065154fd7386b2ce0991175c932f5f97c704 üzerine yalnız src/middleware.ts ve src/lib/maintenance.ts eklenerek hazırlandı. Modül geliştirme dalındaki diğer kodlar/migration'lar karıştırılmadı. --prod --skip-domain ile üretim ortamını kullanan fakat ana alan adına promote edilmeyen dağıtım oluşturuldu. Deployment'a özel BPS_MAINTENANCE_MODE=1 ve BPS_NOTIFICATION_EMAILS_ENABLED=false (build/runtime) verildi; proje genelindeki ortam ayarları değiştirilmedi.

Hazır deployment: dpl_2K2qPJNmHybF13XJUVagGtVTG248 — https://bps-e4mkr2l05-furkanyahsi-1537s-projects.vercel.app . Bulut derlemesi geçti. Vercel CLI koruma bypass'ıyla yalnız bu adreste /dashboard GET HTML, /api/cron/notifications GET, /api/demo-request POST ve /evraklar POST 503/MAINTENANCE verdi; HTML Türkçe başlık içerdi. Kimlikli kullanıcı veya form içeriği gönderilmedi. Sonraki inspect www.bpsys.net'in hâlâ dpl_CamuYBKVLbRg1WgStdWgjuRF4xVw olduğunu doğruladı.

Kanıtlar: maintenance-release-manifest.json, maintenance-vercel-smoke.json ve production-alias-after-maintenance-stage.json. Bu bir hazırlık dağıtımıdır: ana site bakıma alınmadı; DB bariyeri kurulmadı, 53 migration uygulanmadı, modül sürümü yayımlanmadı. Sonraki adım yeni uygulama sürümünün ayrı ve bakım açık dağıtımı/yedeği, son ledger/izin ölçümü ve kontrollü promote → bariyer → migration → yeni uygulama → kabul → yeniden açma. Eski deployment erişimi ve başlamış dış servis işleri için önceki sınırlar korunur.


## 16 Ekim — yeni uygulamanın bakım açık bulut dağıtımı doğrulandı

Kaynak a394b47d6ab57c0e3421e6334800f9d0dd4d034b git archive ile paketlendi; 53 migration dosyasının hash'leri başarılı tam bariyer provasındaki manifestle eşleşti. Yeni uygulama --prod --skip-domain ile dağıtıldı; build/runtime BPS_MAINTENANCE_MODE=1 ve BPS_NOTIFICATION_EMAILS_ENABLED=false. Vercel bulut derlemesi READY: dpl_GMtdntpuCNrjwChLiGtWZHRBtGzv, https://bps-4xwqzh04e-furkanyahsi-1537s-projects.vercel.app . Bu sürüm bakım açık olduğundan ürün akışlarının bulut kabulü değildir.

Dört koruma kontrolü geçti: /dashboard GET Türkçe bakım HTML 503; /api/cron/notifications GET, /api/demo-request POST ve /evraklar POST JSON MAINTENANCE 503. Kimlikli istek veya form içeriği gönderilmedi. www.bpsys.net son inspect sonucunda hâlâ dpl_CamuYBKVLbRg1WgStdWgjuRF4xVw üzerinde. Vercel'in proje varsayılan alias'ı çıktılarda bulunduğu için tüm alias'ların değişmediği iddia edilmiyor; doğrulanan kullanıcı alan adı www.bpsys.net'tir.

Üretimde salt okunur katalog ön kontrolü 82 hedef tabloda TRIGGER ve kaldırma izni eksiği bulmadı. Gerçek oturum cli_login_postgres, etkin rol postgres ve üyelik true. Bu metadata ölçümü üretimde bariyer kurma/kaldırma testi değildir. Kanıtlar: production-barrier-scope-preflight.json, barrier/scope-preflight.sql, module-staged-release-manifest.json, module-vercel-smoke.json, production-alias-after-module-stage.json.

Ana site bakıma alınmadı; üretim bariyeri kurulmadı; 53 migration uygulanmadı; gerçek modül kapatma hâlâ kapalı. Sonraki yayın bloğu: son ledger/şema farkı ve dış yazıcı kontrolü, bakım sürümünü ana alan adına alma, bariyer kurma, sıralı migration+extend+verify, yeni uygulamanın kontrollü açılışı ve canlı kabul. Bakım bayrağı deployment'a bağlıdır; normal açılış için bakım kapalı ayrı dağıtım planlanmalıdır. Eski deployment erişimi ve başlamış dış yan etkilerle ilgili sınırlar devam eder. Gerçek veri silinmedi veya içerik yedeği alınmadı.


## 16 Ekim — kesinti sonrası migration sırası kontrolü

reconcile-ledger.py eklendi: yalnız çevrimdışı ledger/dosya kontrolü yapar; üretime bağlanmaz veya otomatik devam etmez. Eski 129 kaydın korunması, güncel zaman/proje, 53 dosyanın prova hash'leri ve yalnız sıralı uygulanmış prefix kabul edilir. Eksik/tekrarlı/yabancı migration, değişen hash veya başarısız prova reddedilir. 10 test geçti; 54 olası prefix tarandı. Kayıtlı üretim ölçümüyle sonuç not_started, 53 bekleyen; bu yeni canlı ölçüm değildir.

ROLLOUT.md başına güncel durum ve hata/yeniden açma sırası eklendi. Bakım açıkken kimlikli mutasyon kabulünün yapılamayacağı ve bariyer kaldırılınca doğrudan istemcilerin de erişeceği açıklandı. Uzak Git yedeği, taze şema/ledger, dış yazıcı değerlendirmesi, bakım kapalı dağıtım ve canlı geçiş hâlâ tamamlanmadı. Üretim SQL veya alan adı değişikliği yapılmadı.


## 17 Ekim — açık onayla GitHub yedeği tamamlandı

Kullanıcı GitHub'a gönderimi ve yalnız geliştirme dalının otomatik yayınını kapatmayı açıkça onayladı. vercel.json git.deploymentEnabled içinde yalnız codex/tenant-modules-foundation-20260928=false eklendi. main ve diğer dalların ayarı değiştirilmedi. TypeScript commit kontrolü geçti. Önceki 10 commit ve ayar commit'i mevcut origin fullbolton/bps deposuna gönderildi. Uzak ls-remote ile 5240923410f6c1567849bea40f60c048e52ba01e eşleşti.

Vercel salt okunur kontrolde www.bpsys.net hâlâ dpl_CamuYBKVLbRg1WgStdWgjuRF4xVw üzerinde; gönderilen commit için otomatik deployment bulunmadı (anlık ölçüm). Kanıt qa/release-chain-20261016/remote-backup-result.json. Önceki 'açık onay/yedek bekleniyor' engeli kapanmıştır. Üretim SQL uygulanmadı; 53 migration bekliyor. Bu kaynak yedeğidir, canlı ürün yayını değildir.


## 17 Ekim — üretim şeması yeniden doğrulandı

Yeni salt okunur üretim ölçümünde ledger hâlâ aynı 129 kayıt; 53 adayın sıralı/hash kontrolü geçti (final-ledger-reconciliation-20261017.json). public/auth/storage/extensions yalnız-şema export'u /private/tmp/bps-prod-schema-20261017.sql içinde 0600 izinle tutuluyor; gerçek iş/auth/Storage içerikleri alınmadı ve dump repoya eklenmedi. Dosya 894801 byte; SHA256 ecc638f7007122e8ee5bbcfa880e614e6757f1d76d93815aebf1fb974c693387, başarılı tam bariyer provasının snapshot'ıyla byte düzeyinde aynı. Kanıt schema-comparison-20261017.json. Kaynak SQL değişmediğinden tam prova tekrar edilmedi.

Dump sırasında gözlenen cli_login_postgres idle-in-transaction oturumu dump bittikten sonraki tekrar ölçümünde yok; activeOtherTransactions=[] (production-transaction-check-20261017.json). Anlık boş liste dış yazıcıların bulunmadığını veya gelecekte yazmayacağını kanıtlamaz. Üretimde bps_release_guard yok. Vercel son deployment listesinde son iki manuel hazırlık sürümü duruyor; yeni Git yedek commitlerinden otomatik deployment görünmüyor.

Bu tur üretim DDL/DML, promote veya veri temizliği yapılmadı. Sonraki gerçek geçiş: bakım sürümünü promote etme, bariyer kurma ve canlı kapı doğrulaması, 53 migration'ı ledger kaydıyla kontrollü uygulama, yeni sürümün bakım kapalı dağıtımı ve kimlikli kabul. Şema eşitliği ve idle ölçümü bu adımları tamamlanmış kılmaz.


## 17 Ekim — atomik şema / bariyer / migration defteri provası

Önceki full-barrier provasında dosya COMMIT'inden sonra extend çalışıyordu; yeni tablo için kısa korumasız aralık vardı ve Supabase migration defteri aynı transaction'da test edilmiyordu. atomic-package.py yalnız başarılı provada hash'i kayıtlı 53 dosyayı kabul eder. Orijinal dosyalar değiştirilmez; operasyon SQL paketi BEGIN içinde beklenen ledger prefix'ini kontrol eder, migration gövdesini çalıştırır, bariyer extend+verify yapar ve migration kaydını ekleyerek COMMIT eder. Şema, yeni tabloların bariyeri ve ledger artık tek transaction'dır. Her paket kaynak ve çalıştırılan SQL hash'leriyle kaydedilir. Genel amaçlı SQL parser değildir; bu sabit manifest dışındaki dosyaları reddeder. Otomatik üretim bağlantısı/çalıştırma komutu içermez.

BPS_RELEASE_BARRIER=1 BPS_RELEASE_ATOMIC=1 ile temiz şema kopyasında 53/53 geçti; ledger 129→182. İlk migration'da ledger INSERT sonrasında, COMMIT öncesinde kasıtlı hata enjekte edildi: yeni fonksiyon oluşmadı, ledger 129 kaldı, bariyer target sayısı değişmedi; kapsam verify geçti. İkinci migration'ı önce çalıştırma RELEASE_LEDGER_PREFIX_CHANGED ile reddedildi. Ardından normal sıralı zincir, birleşik smoke ve bariyer kaldırma geçti; geçici DB temizlendi. Kanıt full-atomic/result.json.

Üretim schema_migrations tablosunun sütun ve constraint tanımları salt okunur ölçüldü; version/text PK, statements/text[], name/text ve nullable created_by/idempotency_key/rollback alanları yerel fixture'a yansıtıldı. Kanıt production-ledger-shape-20261017.json; tablo içeriği yedeklenmedi. Bu paket uygulaması eski ayrı migration→extend adımı yerine kullanılacak adaydır; üretimde henüz çalıştırılmadı. Aktif trafik, eski deployment ve harici yan etkiler hakkındaki bakım koşulları sürer. Üretimde 53 migration hâlâ bekliyor; canlı yayın yapılmadı.


## 17 Ekim — ÜRETİM YAYINI TAMAMLANDI

Canlı www.bpsys.net artık dpl_KwdtN1U24ytdEtbF876GLhowEyy1 üzerinde (bps-61o6db4p9-furkanyahsi-1537s-projects.vercel.app), kaynak 1daf5e3913289451b55fd6157024feb524009ff8. BPS_MAINTENANCE_MODE=0; otomatik e-postalar false kalır. Yayın öncesi Vercel korumalı hazırlık adresi, login 200 ve bakım adresi 503 kontrolleri yapıldı.

Eski kodun bakım sürümü ana alana alındı; production-maintenance-http-20261017.json ile dashboard GET, evrak POST ve cron GET 503 ölçüldü. Üretim bariyeri kuruldu. 53 migration, yerelde denenmiş atomik SQL hash'leri doğrulanarak uygulandı: her transaction migration gövdesi + bariyer extend/verify + Supabase ledger INSERT içerir. İlk 35 dosyadan sonra pooler kimlik doğrulaması EAUTHQUERY unsupported or invalid secret format hatası verdi; sonraki dosya çalışmadı. Nedenin token süresi olduğu kesinleştirilmedi. Bağlantı yenilendi; üretim ledger tam 35 dosyalık prefix ve bariyer varlığı doğrulandı; yalnız kalan 18 dosya uygulandı. İki denemenin ayrı kanıtları korunur.

Üretim ledger 129→182; tüm 53 aday tamamlandı. Kapsam doğrulandı, PostgREST schema reload bildirimi gönderildi, bariyer kaldırıldı; son kontrolde bariyer yok ve ledger 182. Yeni sürüm promote edildi; production-promotion-20261017.json alan adı/deployment eşleşmesini doğrular. Bakım kaldırıldıktan sonra normal alan adında kimlikli smoke yapıldı; özel erişime kapalı bir mutasyon kabul penceresi iddia edilmez.

Canlı kabul: mevcut Mek Group oturumu/dashboard, randevu listesi, sözleşme listesi ve ayarlar/ekip yüklendi. Pasif test firmasına evrak yükleme beklenen kuralla reddedildi. Aktif BPS_SMOKE_MEK_FIRMA_2026_09_08 için 'SMOKE TEST · 17 Ekim atomik yayın kabulü' adlı 125 byte sentetik PDF yüklendi/finalize oldu; başarı mesajı ve Tam durumu görüldü; klasörü Diğer'den Operasyon Evrakı'na başarıyla değişti. Bekleyen yükleme ve dosya temizliği listeleri hatasız/boş. Sentetik belge silinmedi; gerçek kayıt temizliği veya tam içerik yedeği yapılmadı. PDF sıfır sayfalık teknik fixture'dır; görsel PDF render testi değildir.

Sınırlar: üretimde kesilen upload kurtarma/iptal, tüm roller/tenantlar, concurrency ve takvim/sözleşme yazmaları bu kısa kabulde tekrar edilmedi; yerel test kanıtları ayrı durur. Gerçek modül kapatma hâlâ advisoryOnly=true/mutationAvailable=false; bu yayın altyapı ve komut kapılarını getirir, tamamlanmamış kapatma ekranı/işlemini açmaz. Otomatik e-postalar kapalı. Önceki '53 migration üretimde bekliyor' ve 'canlı eski sürümde' ifadeleri bu kayıtla geçersizdir.


## 17 Ekim — canlı takvim ve sözleşme yazma kabulü

Aktif sentetik BPS_SMOKE_MEK_FIRMA_2026_09_08 firmasında 17.10.2026 tarihli, saatsiz SMOKE TEST randevusu oluşturuldu ve sonuç girilerek Tamamlandı durumuna geçti. Takip görevi oluştur kutusu kapatıldı; görev sayısı ayrıca DB üzerinden ölçülmedi. Gerçek görüşme yapılmadığı sonuç metnine yazıldı.

SMOKE TEST · 17 Ekim sözleşme komutu adlı taslak oluşturuldu (9d8a3a79-0df7-4fdc-9b58-1cf7d81a903d). Kapsam düzenlendi ve sayfa yenilendikten sonra kalıcılığı doğrulandı. Tutar/tarih girilmedi, durum Taslak kaldı; gerçek sözleşme veya mali taahhüt değildir. Her iki sentetik kayıt korundu, silme yapılmadı. Kanıt: qa/release-chain-20261016/production-write-smoke-20261017.json.

Bu kabul önceki kısa smoke kapsamındaki takvim/sözleşme yazma açığını daraltır; tüm mutasyonları kapsamaz. Üretimde kesilen upload kurtarma/iptal, eşzamanlı kullanıcı ve tenantlar arası ret senaryoları henüz tekrar edilmedi. Uygulama kodu/SQL değişmedi, ek deploy gerekmedi. Canlı kaynak 1daf5e3 ve migration sayısı son yayın ölçümünde 182; bu tur ledger yeniden ölçülmedi.


## 17 Ekim — kesilen yükleme ve eşzamanlı kurtarma kabulü

Gerçek yerel Storage + PostgREST kabulüne iki yeni senaryo eklendi: (1) prepare sonrası dosyasız bekleyen kaydın, dosya yüklendiğinde kurtarılabilir görünmesi; aynı anda iki finalize isteğinin aynı kimliği döndürmesi ve yalnız bir documents satırı oluşturması; tamamlanınca bekleyen listeden çıkması. (2) Dosya yüklenmişken iptalin finalize işlemini reddetmesi, dosyanın açık temizlik adımına kadar korunması, HTTP temizliği ve ack sonrasında aynı yolun yeniden kullanılamaması.

Sonuç: **27/27 HTTP kontrolü**, ayrıca modül kapatma/Storage yazma kilit sırası için **2/2 gerçek iki bağlantılı yarış testi** geçti. Kanıtlar: storage-recovery-http-result-20261017.json ve storage-module-race-20261017.tap (qa/contract-write-20261015). Yarış testi ilk çalıştırmada eksik pg çözümlemesiyle başlayamadı; daha önce kurulmuş /private/tmp/bps-calendar-qa-runtime/node_modules NODE_PATH ile tekrar çalıştırıldı ve geçti. Yeni paket kurulmadı. Geçici klon/container temizliği harness finally adımında tamamlandı.

Yalnız test kodu ve kanıtlar değişti; uygulama/SQL değişmedi, yeni yayın gerekmiyor. Üretim iş verisine dokunulmadı. Bu kanıt üretimde kesintili yükleme UI kabulü veya gerçek kullanıcı yük testi değildir; canlıdaki bu sınırlar açık kalır.


## 17 Ekim — dosyası yüklenmiş kaydın tarayıcıdan iptali

Yerel Auth/Next/Storage kabul fixture'ına üçüncü sentetik kayıt eklendi: dosyası depoda mevcut, evrak kaydı henüz tamamlanmamış. Gerçek giriş ve /evraklar ekranından bu kayıt için iptal onayı verildi. İşlem sırasında düğmeler kilitlendi; başarı mesajı dosya temizliğinin yöneticinin listesine alındığını açıkladı ve kayıt bekleyenlerden çıktı. SQL sonucu: documents=0, storage.objects=1, tamamlanmamış cleanup=1. Böylece iptalin dosyayı anında silmediği de doğrulandı. Kanıt browser-uploaded-cancel-20261017.json.

Önceden geçen temel kurtarma, dosyasız iptal ve şirket geçiş testleri tekrar edilmedi. Bu tur yeni kabul yalnız dosyası mevcut iptal akışıdır. Yerel başlangıçta ilk sayfa derlemesi navigasyon bekleme süresini aştı; aynı sekme hazır olduğunda giriş tamamlandı. Ürün hatası görülmedi. Ürün kodu/SQL değişmedi, üretime işlem yapılmadı; yeni yayın gerekmiyor.


## 17 Ekim — iki gerçek sekmede açık form / şirket değişimi kabulü

Birinci sekmede Synthetic A evrak yükleme formu açılıp yalnız sentetik evrak adı yazıldı; kaydedilmedi. İkinci sekmede gerçek şirket seçici ile Synthetic B seçildi ve Auth yenilemesi tamamlandı. Birinci sekme kendiliğinden formu kaldırarak “Şirketinizi yeniden doğrulayın” ekranını gösterdi. İkinci sekmede Synthetic B başlığı görüldü. SQL: seçili tenant B, taslak adına ait documents=0 ve document_upload_attempts=0. Kanıt browser-multitab-result-20261017.json.

Bu sonuç önceki çok sekmeli açık form kabul açığını, kaydedilmemiş evrak formu için kapatır. Devam eden byte transferi sırasında şirket değişimi, refresh ile eşzamanlı üyelik değişimi ve fiziksel mobil cihaz hâlâ ayrıca sınanmalıdır. Ürün kodu/SQL değiştirilmedi, canlıya işlem yapılmadı. Tarihsel metinlerdeki yayın bekliyor ifadeleri güncel değildir: 17 Ekim yayın manifesti geçerlidir.


## 17 Ekim — kurtarma hatalarında doğru neden ve belirsizlik

Kod incelemesinde document_upload_recovery_target_v1 bağlantı hatası veya bozuk/null yanıtının “yükleme bulunamadı veya yetkiniz yok” mesajına dönüştüğü görüldü. document-upload-recovery.ts artık yalnız 42501 için erişim, BM001 için kapalı modül mesajı gösterir. Diğer RPC hataları ve geçersiz yanıtlar sonuç doğrulanamadı mesajında kalır; indirme/finalize başlatılmaz. İptalde doğrulanamayan sonuç için de varsayımsal yetki/işlem nedeni kaldırıldı.

11/11 hedefli test geçti; taşıma hatası, timeout kodu, bozuk/null yanıt ve iki doğrulanmış ret kodu ayrı test edildi. Kanıt recovery-errors-20261017.tap. SQL/migration değişikliği yok. Bu ürün metni düzeltmesi GitHub geliştirme dalına gönderilir; otomatik yayın kapalı olduğundan canlıda henüz yoktur.


## 17 Ekim — kurtarma/iptal bağlantı beklemesi sınırlandı

Evrak upload server action'ları mevcut createServerSupabaseClient(12_000) korumasına geçirildi; diğer yazma akışlarıyla aynı fetch deadline uygulanır. Bu sınır istek başınadır, bütün kurtarma işleminin toplam 12 saniye sürdüğü iddia edilmez. Timeout sunucu işleminin rollback olduğunu kanıtlamaz: mevcut doğrulanamadı mesajı korunur, otomatik yazma tekrarı yapılmaz.

12/12 hedefli test geçti. Yeni test her iki action'ın başarı/belirsiz yanıt/exception yollarını çalıştırır; bounded client, tek mutation, yalnız doğrulanmış kurtarmada revalidation doğrulanır. Kanıt recovery-deadline-20261017.tap. SQL ve migration değişmedi. Önceki hata mesajı düzeltmesiyle birlikte geliştirme dalındadır, canlıya yayımlanmadı.


## 17 Ekim — son evrak düzeltmelerinin geniş yayın doğrulaması

415dfff kaynağında npm run qa:release çalıştırıldı. Envanter: 124 uygulama, 27 DB, kapsam dışı 7 bekleyen özellik test dosyası. Unit 19 vaka + 4 kontrol hatasız; uygulama **692/692**; statik **16 kontrol / 0 FAIL / 1 WARN** (CapacityRiskCard, TimelineList kullanılmıyor); TypeScript temiz. DB suite bu komutun parçası değildir, yeniden çalıştırılmadı.

Komutun tamamı ilk seferde exit 1 verdi: worktree'de Supabase URL/anahtar env bulunmadığı için /firmalar prerender aşamasında durdu. Build yalnız sentetik loopback URL ve gerçek yetki sağlamayan placeholder anahtarla tekrar edildi; exit 0, 29/29 statik sayfa. Bu build üretim ortamı doğrulaması değildir ve yayımlanacak artifact olarak kullanılmaz. Kanıt release-validation-20261017.json; iki ayrı logun hash'leri kaydedildi.

Canlı 1daf5e3 referansına göre uygulama farkı yalnız upload-actions.ts ve document-upload-recovery.ts; migration farkı yok. Bu tur yeni ürün kodu/üretim SQL/deploy yapılmadı. Son iki düzeltme geliştirme dalında yayına adaydır; canlıya alınmadan Vercel güncel deployment ve gerçek ortam ayarları ayrıca doğrulanmalıdır.


## 17 Ekim — evrak düzeltmesi Vercel hazırlık dağıtımı

312a468 git archive kaynağı temiz geçici klasörden --prod --skip-domain ile dağıtıldı; sentetik yerel build çıktısı kullanılmadı. Build/runtime bakım 0, otomatik e-postalar false. Deployment dpl_CQ9mr8chp8Ppat2BEWunDquhgzMs READY; bulut build ve 29/29 sayfa geçti. Vercel yetkili CLI ile /login HTML 200; anonim erişim 302 vercel.com korumasına yönleniyor. HTML gövdesinde giriş metni assertion'ı geçmedi; bu yüzden hydrated login UI kabulü iddia edilmez.

Son inspect www.bpsys.net'in hâlâ dpl_KwdtN1U24ytdEtbF876GLhowEyy1 üzerinde olduğunu doğruladı. Ana alan promote edilmedi. Yeni migration yok; üretim şema/ledger bu tur yeniden ölçülmedi, SQL çalıştırılmadı. Sonraki adım salt okunur ölçüm, normal sürüm promote ve canlı kabul. Kanıt qa/release-chain-20261016/recovery-fix-stage-20261017.json. Bu hazırlık dağıtımıdır; düzeltmeler ana sitede henüz yoktur.


## 17 Ekim — evrak kurtarma düzeltmeleri CANLIDA

Salt okunur ön kontrol: 182 migration sürümü önceki yayınla birebir eşleşti, bakım bariyeri yok, dört gerekli evrak RPC imzası mevcut; fonksiyon fingerprint'leri kaydedildi. Bu tam şema eşitliği iddiası değildir. Yeni migration veya üretim DML/DDL uygulanmadı.

Hazır dpl_CQ9mr8chp8Ppat2BEWunDquhgzMs ana alana promote edildi; bağımsız Vercel inspect www.bpsys.net eşleşmesini doğruladı. Kaynak 312a468 (ürün değişiklikleri 415dfff dahil). Otomatik e-posta false, bakım 0. Mevcut Mek Group oturumuyla /evraklar yüklendi; pending upload ve cleanup listeleri hatasız/boş. Gerçek veri değiştirilmedi; üretimde timeout veya yarım upload enjekte edilmedi. Yerel 692 uygulama testi ve 12 hedefli test kanıtı ayrı kalır.

Kanıtlar: qa/release-chain-20261016/recovery-fix-preflight-20261017.json ve recovery-fix-release-20261017.json. Önceki “son iki düzeltme canlıda değil” ifadeleri bu kayıtla geçersizdir.


## 17 Ekim — HTTP gövdesi açıkken şirket değişimi

Storage HTTP kabulüne gerçek parça gönderimli istek eklendi. A şirketinde rezervasyon açıldı; Content-Length taşıyan HTTP isteğinde ilk 5 byte yazılıp kalan gövde bekletildi. Gerçek select_workspace RPC ile B seçimi commit olduktan sonra gövde tamamlandı. Storage hata yanıtı verdi; storage.objects=0 ve documents=0. Eski A ve yeni B tokenlarıyla finalize 403, dosya okuma başarısız.

28/28 yerel HTTP kontrolü geçti; önceki 27 kontrol korundu. Kanıt storage-switch-stream-result-20261017.json. Bu test istemcinin HTTP gövdesini açık tuttuğu aralığı doğrular; sunucunun ilk parçayı hangi anda fiziksel depoya yazdığı veya her olası interleaving hakkında iddia taşımaz. Gerçek tarayıcı dosya aktarım UI'sinin kesintili bağlantı mesajı ve fiziksel mobil test ayrıca açık.

Ürün SQL/TS değişmedi; yalnız test/kanıt eklendi. Üretime işlem yapılmadı, yeni yayın gerekmiyor. Geçici yerel klon ve servisler test sonunda kaldırıldı.


## 17 Ekim — tamamlama ile iptalin aynı yüklemede yarışması

Mevcut cancel-race.test.mjs yalnız Storage INSERT/iptal sırasını kapsıyordu; finalize/iptal için iki ek sıralama eklendi. İki ayrı bağlantı açık transaction ile çalışır; gözlemci pg_stat_activity üzerinden ikinci bağlantının gerçekten Lock beklediğini doğrular, sonra ilk transaction commit edilir.

İptal önceyse bekleyen finalize 23514 ile reddedilir; documents=0, cleanup=1, dosya metadata kaydı korunur. Finalize önceyse bekleyen iptal 23514 ile reddedilir; documents=1, cleanup=0, dosya metadata kaydı korunur. İptal tamamlanmış evrakı yanlışlıkla temizlik listesine alamaz. Önceki iki Storage INSERT yarışı da korunarak **4/4** geçti. Kanıt finalize-cancel-race-20261017.tap. SQL transaction/claim kabulüdür; HTTP/tarayıcı yarışı olarak sunulmaz.

Yalnız sentetik yerel klon kullanıldı, finally ile kaldırıldı. Ürün kodu ve migration değişmedi; üretime işlem veya yeni yayın yok.


## 17 Ekim — Ayarlar / Modüller görünürlüğü (YEREL, yayımlanmadı)

Mevcut modül planındaki durum ekranı eklendi. Seçili şirkette yönetici erişimi doğrulandıktan sonra current workspace RPC yanıtı kullanılır; şirket adı, 10 modülün açık/kapalı durumu ve zorunlu bağımlılıkları gösterilir. Açma/kapatma veya kaydetme komutu yoktur. Hatalı yenilemede eski durum gizlenir; şirket değişiminden sonra geç gelen yanıt gösterilmez. Atomik modül değiştirme akışı henüz tamamlanmadı.

14/14 hedefli test ve TypeScript kontrolü geçti. Gerçek yerel Auth/PostgREST/Next oturumunda Ayarlar → Modüller açıldı; Synthetic A ve 10 modül görüntülendi, Durumu yenile başarılı. Bu tarayıcı kabulü sentetik yerel ortam içindir; üretim testi değildir. Kanıt: modules-panel-20261017.tap ve modules-panel-20261017.jpg. Yeni migration yok. Canlı sürüm 312a468 ve ledger 182 olarak kalır.


## 17 Ekim — modül değişikliği önizlemesi (YEREL, yayımlanmadı)

Ayarlar / Modüller ekranına seçim, değişiklik özeti ve mevcut preview_workspace_modules_v1 servisi bağlandı. Kullanıcı seçimi kayıt yapmaz. Eksik bağımlılıklar ve sunucunun bildirdiği açık iş engelleri çözüm bağlantılarıyla gösterilir. Düzenlenen seçim eski sonucu anında geçersiz kılar; gecikmiş yanıt gösterilmez. Yenileme/şirket değişimi üst bileşen tarafından önizlemeyi kaldırır. Hata boş/başarılı sonuç sayılmaz. Bekleyen evrak mesajı mevcut kurtarma/iptal ekranına yönlendirecek şekilde güncellendi.

26/26 hedefli uygulama testi ve TypeScript geçti. Gerçek yerel Auth/PostgREST/Next ile Belgeler seçimi kaldırıldığında Sözleşmeler bağımlılığı, pending_document_cleanup ve pending_document_upload göründü; sıfırlama seçimleri geri getirdi ve sonucu kaldırdı. Kanıt: module-preview-panel-20261017.tap ve module-preview-panel-20261017.jpg. Sentetik klon kullanıldı; üretim verisi değiştirilmedi.

Kalan: config kilidi altında yeniden kontrol eden, revision/idempotency/audit sözleşmesi bulunan atomik değişiklik komutu ve eşzamanlı iş yazma kabulü. Bu paket bu komutu veya genel modül kapatmayı tamamlamaz. Migration eklenmedi; canlı kaynak 312a468 / ledger 182 değişmedi.


## 17 Ekim — atomik modül komutu yerel adayı

qa/module-change-command-20261017 altında istemcilere yetkisi kapalı SQL aday + gerçek PostgreSQL kabul testi hazırlandı. Config kilidi altında canlı scope ve açık iş yeniden kontrolü, revision, idempotent receipt ve audit tek transaction içinde. 9 alt senaryo + kapsayıcı = 10/10 geçti; iki oturumda gerçek Lock beklemesi ölçülerek iş yazma/kapatma her iki sıra doğrulandı. Pending evrak, stale revision/üyelik, çapraz tenant, bağımlılık ve tekrar çağrı da kapsandı.

Bu bir migration veya yayın değildir; UI kayıt yapmaz. Genel yazma yüzeyi son denetimi, farklı yöneticiler/üyelik değişimi yarışları, istemci receipt protokolü ve browser kayıt kabulü açık. Ayrıntı/kanıt: qa/module-change-command-20261017/README.md ve result.tap. Canlı kaynak 312a468, ledger 182 değişmedi. Gerçek veri değiştirilmedi.


## 17 Ekim — modül komutu yetki yarışları doğrulandı

Yerel aday komut süiti 14/14 oldu (13 alt senaryo + kapsayıcı). Config veya profile kilidinde beklerken rol düşürülmesi, rol geri verilse de eski membership generation, iki farklı yöneticinin aynı revision ile yarışı, başkasının receipt kimliğinin kullanımı ve select_workspace ile A→B sırasında eski A komutu test edildi. Retlerde revision değişmedi/receipt yazılmadı. Gerçek Lock beklemesi gözlemlendi. Çoklu üyelik fixture'ı ilk çalışmada açık seçim olmadığı için reddedildi; gerçek seçim RPC'si ve doğru sentetik claimlerle düzeltildi.

Ürün SQL değişmedi. HTTP/browser kayıt kabulü ve tüm writer/cron/Storage sınırlarının son denetimi açık. İstemci EXECUTE hâlâ kapalı; migration ve yayın yapılmadı. Kanıt qa/module-change-command-20261017/result.tap.


## 17 Ekim — eski personel tablolarında modül sınırı açığı

AST envanteri yenilendi: 473 kaynak / 47 route / 322 çağrı / 6 dinamik hedef. staffing_demands ve workforce_summary üzerinde modül kapalıyken authenticated doğrudan yazma/okuma yerel klonda yeniden üretildi. İki tabloya restrictive modül policy + satır kilidinden önce config kilidi alan statement trigger adayı eklendi. 6/6 yerel PostgreSQL testi geçti; açık modül davranışı, tenant reddi ve kapatma sırasında bekleyen yazım dahil.

Kanıt ve kalan kapsam: qa/module-change-command-20261017/WRITER_REVIEW.md ve legacy-staffing-result.tap. Üretim katalog bu tur ölçülmedi; aday SQL migration zincirine alınmadı, yayımlanmadı. Gerçek modül kapatma hâlâ kapalı.


## 17 Ekim — eski personel sınırı migration ve birleşik kabul

20261017000100_legacy_staffing_module_barriers.sql hazırlandı; eski QA SQL kopyası kaldırıldı, testler doğrudan migration dosyasını çalıştırıyor. RLS/tenant UUID NOT NULL ve önkoşul kontrolleri eklendi. Şema sapmasında hiçbir helper/policy bırakmadan ret dahil 7/7 tablo testi geçti.

Komut süiti 16/16: authenticated talep INSERT önceyse gerçek kapatma reddi; kapatma önceyse bekleyen workforce UPSERT reddi; yeniden açmada veri korunması. İki paket aynı yerel sentetik şema üzerinde çalıştı; gerçek veri kullanılmadı. Üretime migration veya uygulama yayını yapılmadı. Kayıt komutu yerel aday, istemci EXECUTE kapalı. Diğer writer denetimi/üretim preflight/istemci kayıt akışı açık.


## 17 Ekim — modül test şeması güncel zincire tamamlandı

Eski şablonun takvim/sözleşme gateway ve PT409 yamalarını içermediği saptandı. Komut testi artık fixture-migrations.json içindeki 23 migration'ı sırayla uyguluyor; 16/16 geçti. Yanlış 40001 test beklentileri güncel PT409 ile değiştirildi. Eski sonuçlar dar fixture kanıtıdır, bütün güncel zincir kanıtı sayılmaz. Güncel şemada sözleşme yükleme bariyerleri mevcut; metinsel definer yazıcı adayları post-migration-writer-candidates.json dosyasına kaydedildi ve bakım/kimlik yolları sınıflandı. Üretime işlem/yayın yapılmadı; diğer runtime sınırları ve UI kayıt bağlantısı açık.


## 17 Ekim — yarım sözleşme PDF yüklemesi kapatma engeli

20261017000200_contract_upload_module_preview.sql eklendi. Güncel preview gövde md5'i yerel güncel şemadan ölçüldü (4cde00fbcf8756586146ad19aba5d398); farklı gövde/anchor migration'ı durdurur. contracts kapanacaksa contract_pdf_upload_commands pending/publishing kayıtları ayrıca engel sayılır. Süresi dolmuş sözleşmede unfinished_contracts=false iken pending_contract_upload=true kanıtlandı; aday atomik komut 23514 ile reddetti. İptal edilmiş rezervasyon pending sayılmaz; iptal edilmiş dosyaların Storage temizliği bu kontrolün kapsamı değildir.

Önizleme parser'ı 19 kontrolün ilgili alt kümesini doğrular; eksik sözleşme yükleme kontrolünü başarı saymaz. Bu nedenle migration frontend'den önce uygulanmalı; eski server + yeni UI fail-closed hata verir. Fixture artık 24 migration uygular. Veritabanı 17/17, önizleme/parser/bileşen 13/13, TypeScript temiz. Üretime hiçbir işlem yapılmadı; migration bekliyor. UI mutasyon ve diğer erişim/yayın kabul kapıları hâlâ açık.


## 17 Ekim — güncel ortak fixture ile Storage HTTP kabulü

storage-http.mjs artık modül komut testiyle aynı fixture-migrations.json listesini (24 migration) kullanıyor. Eski ayrı/dar evrak listesi kaldırıldı. BPS_LOCAL_BROWSER modu da aynı kurulumdan yararlanır; bu tur tarayıcı UI kabulü yapılmadı.

Gerçek yerel Storage/PostgREST üzerinden 29/29 kontrol geçti. Yeni kontrol: pending sözleşme PDF rezervasyonunda HTTP preview pending_contract_upload=true; gerçek dosya upload ve finalize sonrasında false. Önceki kurtarma/iptal/Storage sahiplik ve şirket değişimi kontrolleri korundu. Kanıt qa/module-change-command-20261017/storage-http-result.json. Geçici klon/container'lar finally ile kaldırıldı. Üretim değişmedi; migration ve modül UI yayını hâlâ bekliyor.


## 17 Ekim — ortak fixture eksiksizlik kontrolü

fixture-migrations.mjs, manifesti repo migration diziniyle karşılaştırır: baseline 20261005003100 sonrasındaki her SQL dosyası tam ve sıralı bulunmalı. Yeni migration atlanması, eksik dosya, tekrar, sıra hatası veya geçersiz ad kabulü durdurur. Komut DB testi ve Storage/browser harness aynı loader'ı kullanır. Baseline şablonun içeriği veya geçmiş dosya hash'i bu kontrolle doğrulanmaz; tam şema/üretim preflight yerini tutmaz.

module-fixture-integrity.test.mjs 4/4 geçti, application envanterine kaydedildi (127 dosya). Ürün SQL/arayüz değişmediği için 29 HTTP ve 17 DB kontrolü tekrar koşturulmadı; önceki kanıtlar korunur. Üretim yayını yok.


## 17 Ekim — modül komutu receipt sözleşmesi

Yerel aday SQL yanıtı schemaVersion, actorId, tenantId, commandId, revision, modules ve replayed taşır. Yeni change-receipt.ts yalnız beklenen kullanıcı/şirket/komut ve tam istenen modül seçimiyle eşleşen yanıtı kabul eder; revision BigInt üzerinden tam +1 olmalı. Null/eksik/başka işleme ait yanıt başarı değildir. Replay, o komutun commit kanıtıdır; güncel ayar görüntüsü değildir ve ardından context yenilenmelidir.

15/15 receipt+katalog testi; 17/17 gerçek PostgreSQL komut testi geçti. Gerçek ilk commit ve replay yanıtları aynı TypeScript parser'a verildi. Önizleme/HTTP/GUI yazma akışı bağlanmadı; istemci RPC çağrısı veya EXECUTE yetkisi eklenmedi. Yeni migration yok; ürün kaydetme henüz açılmadı, üretim değişmedi.


## 17 Ekim — belirsiz yanıt ve eşzamanlı tekrar kabulü

Komut süiti 19/19 oldu. Aynı UUID ve payload ile iki bağlantı yarıştığında gerçek Lock beklemesi gözlendi: ilk işlem commit, ikincisi replay; tek receipt ve tek revision artışı. Daha sonraki bir komut ayarları değiştirdikten sonra eski komut tekrarlandığında eski commit receipt'i döndü, güncel ayarlar/revision değişmedi. Dönen gerçek yanıt TypeScript receipt parser ile doğrulandı. Ağ bağlantısı fiziksel olarak kesilmedi; DB seviyesinde tekrar semantiği kabulüdür.

Ürün SQL/TS değişmedi. Üretim yayını, EXECUTE grant veya UI kaydetme açılmadı. Kanıt qa/module-change-command-20261017/result.tap.


## 17 Ekim — eksik önizleme yanıtında güvenli ret

Yerel modül değiştirme adayı, önizleme yanıtının şema sürümünü, doğrulanmış context ve istenen ayarlarla eşleşmesini, bağımlılık/kontrol dizilerini ve boolean blocking değerlerini doğrular. Kapatılan modüllerin beklenen kontrol kümesi tam olmalıdır; eksik, yinelenen veya bilinmeyen kontrol MODULE_ASSESSMENT_INVALID ile işlemi durdurur. SQL'deki 19 kontrolün TypeScript listesiyle birebir eşleşmesi fixture testine eklendi.

Yerel işlem içinde güvenilir preview helper geçici olarak null yanıt, null checks, eksik kontrol, string blocking ve yinelenen kontrol döndürecek şekilde değiştirildi; her deneme reddedildi, revision ve receipt değişmedi. Her denemenin rollback'i gerçek helper'ı geri getirdi. Bu, gelecekteki helper değişikliklerine karşı savunma kabulüdür; üretimde bozuk yanıt görüldüğü iddiası değildir.

PostgreSQL komut süiti 20/20, fixture bütünlüğü 5/5 geçti. Kanıtlar result.tap ve fixture-tests.tap. Komut hâlâ qa altında yetkisiz yerel adaydır; yeni migration, EXECUTE grant, UI kaydetme veya üretim yayını yok. Önceki Storage HTTP kabulü tekrar çalıştırılmadı.


## 17 Ekim — kayıt ortasında hata ve güvenli tekrar

Yerel komut kabulüne audit/receipt INSERT hatası eklendi. Sentetik tetikleyici kayıt son adımını 23514 ile reddetti; komut autocommit çağrıldı. Testin ayrıca ROLLBACK yapmasına gerek kalmadan modül ayarları ve config revision tamamen önceki değerinde kaldı, receipt oluşmadı. Hata tetikleyicisi kaldırılınca aynı command UUID ve payload başarılı ilk işlem olarak tamamlandı; tek receipt oluştu. Böylece tekrar deneme başarısız bir komutu yanlışlıkla tamamlanmış saymıyor.

PostgreSQL süiti 21/21 geçti (kapsayıcı dahil); kanıt qa/module-change-command-20261017/result.tap. Geçici veritabanı kaldırıldı. Yalnız test ve kayıt değişikliği; ürün kodu, migration, EXECUTE yetkisi ve UI kaydetme değişmedi. Üretim yayını yapılmadı. Sonraki kapılar: yazma yüzeyi incelemesinin kalanları, komutun uygulama bağlantısı ve gerçek kayıt tarayıcı kabulü, güncel üretim preflight.


## 17 Ekim — kurumsal tarihlerin modül sahipliği

critical_dates şeması ve src/app/(main)/kurumsal-tarihler/actions.ts incelendi: firma, sözleşme veya randevu FK'sı yok; ruhsat/izin/tescil gibi şirket geneli tarihleri tutuyor. Mevcut on modül kataloğunda bağımsız ortak altyapı olarak kalır; calendar veya staffing kapısı eklenmedi. Tarihlerdeki serbest metin, bir başka modülün kayıt ilişkisi sayılmaz.

Yerel sentetik transaction'da tüm modül ayarları fixture kurulumu için kapatıldı. authenticated yönetici kendi şirketinde tarih oluşturup okuyabildi; başka şirkete INSERT 42501, mevcut tarihi başka şirkete taşıma 23514 ile reddedildi. Test sonunda rollback yapıldı. Bu test tüm modüllerin gerçek komutla kapatılabileceği veya bütün rol matrisinin doğrulandığı iddiası değildir.

Komut/kabul süiti 22/22 geçti; result.tap güncellendi. Ürün kodu, migration veya üretim değişmedi. Yazma incelemesinde kurumsal tarihler başlığı bu kapsamla netleştirildi; diğer RPC/servis yolları ve yayın ön kontrolü açık kalır.


## 17 Ekim — iptalden temizlik tamamlamaya modül engeli

Gerçek document_cancel_upload_v1 ve document_ack_cleanup_v1 helper'ları aday modül komutuyla aynı güncel yerel fixture üzerinde çalıştırıldı. İptalde pending_document_upload=false olurken pending_document_cleanup=true kalıyor; kapatma komutu 23514 ile reddediliyor, revision ve receipt değişmiyor. Storage nesnesi hiç oluşturulmamış sentetik rezervasyonda ack, nesne yokluğunu doğruladı; ardından iki engel de false oldu. completed_at taşıyan cleanup satırı korundu ve tekrar ack başarılıydı. Bu satırın korunması eski yolun yeniden kullanımını engelleyen tombstone sözleşmesidir.

Süit 23/23 geçti; result.tap güncellendi. Bu senaryoda gerçek HTTP dosya yükleme/silme yapılmadı; önceki 29/29 Storage HTTP kanıtı ayrı kapsamda kalır. Bütün diğer engellerin kalktığı veya UI kaydetmenin hazır olduğu iddia edilmez. Ürün SQL/arayüz değişmedi, yeni migration veya üretim yayını yok.


## 17 Ekim — evrak hazırlama ile gerçek kapatma komutu yarışı

İki ayrı PostgreSQL bağlantısında authenticated document_prepare_upload_v1 ile yerel aday change_workspace_modules_v1 yarıştırıldı; pg_stat_activity üzerinden gerçek Lock beklemesi doğrulandı. Hazırlama önce commit ettiğinde bekleyen kapatma yeni rezervasyonu gördü ve 23514 ile reddedildi; context ve receipt değişmedi. Kapatma önce commit ettiğinde bekleyen hazırlama BM001 ile reddedildi, document_upload_attempts satırı oluşmadı. Test sonunda modüller aday komutla yeniden açıldı; ilk yarışın sentetik rezervasyonu gerçek cancel/ack helper'larıyla kapatıldı.

Süit 25/25 geçti; result.tap güncellendi. Bu kabul metadata rezervasyonu ve config kilidi içindir; HTTP byte aktarımı veya tarayıcı testi değildir. Önceki Storage HTTP kanıtı ayrı kapsamda kalır. Yalnız test ve kanıt değişikliği; ürün kodu, yeni migration, EXECUTE grant veya üretim yayını yok.


## 17 Ekim — bekleyen yüklemelerde boş son sayfadan dönüş

PendingDocumentUploads.tsx: sonraki sayfalardan birinde tek kalan yükleme başarıyla tamamlandığında veya iptal edildiğinde önceki sayfaya dönülür. İlk sayfada veya birden fazla satır varsa mevcut sayfa yenilenir. Başarı mesajı korunur; belirsiz/başarısız işlem sayfayı değiştirmez. Şirket bağlamı değişiminde parent key ile yeniden kurulma ve useScopedResource korumaları mevcut.

scripts/document-pending-uploads.test.mjs: tamamlama ve iptal için 0→50→0 offset akışı ve mesajın korunması bileşen sürücüsünde doğrulandı. Kanıt pending-upload-pagination-tests.tap. Bu tarayıcı/üretim kabulü değildir. Yeni SQL/migration yok; arayüz düzeltmesi yerelde, yayınlanmadı.


## 17 Ekim — güncel kaynakla yerel oturum ve Storage tarayıcı kabulü

03f6b49 kaynak, ortak güncel migration fixture, gerçek yerel GoTrue/PostgREST/Storage kullanıldı. CUA tarayıcısında sentetik document-qa hesabıyla /evraklar açıldı. Yarım kalanlar yalnız açılınca listelendi; dosyası bulunan Tarayıcı kurtarma için tamamla işlemi başarı mesajı verdi, bekleyen satır kayboldu ve ana evrak listesi 2→3 oldu. Dosyası bulunmayan Tarayıcı iptal onayla iptal edildi; listeden çıktı ve temizlik kuyruğuna alındığı mesajı görüldü. Ana evrak sayısı 3 kaldı.

Storage HTTP harness 29 kontrolü tamamlayıp exit 0 ile kapandı; geçici container/DB temizliği finally üzerinden geçti. browser-storage-result-20261017.json ve browser-recovery-cancel-20261017.png kanıtları kaydedildi. Üretim sekmesine/verisine dokunulmadı. Son sayfadan önceki sayfaya dönüş bu tarayıcı fixture'ında 50+ satır bulunmadığından yalnız önceki 13/13 bileşen testinde doğrulanmıştır; bu tur çok sayfalı tarayıcı kabulü değildir. Üretime yayın yapılmadı.


## 17 Ekim — 51 yükleme ile çok sayfalı tarayıcı kabulü

Yerel authenticated-browser harness'e BPS_BROWSER_PAGINATION=1 seçeneği eklendi; gerçek prepare RPC ile bekleyen kayıt sayısı 51'e tamamlanır. CUA ile ilk sayfa → ikinci sayfa (tek kayıt) → iptal onayı çalıştırıldı. Başarı sonrası ilk sayfadaki 50 article göründü, Önceki ve Sonraki devre dışı kaldı ve iptal mesajı korundu. JSON ve ekran kanıtları browser-pagination-20261017.{json,png}. Bu tarayıcı senaryosu iptal yolunu kapsar; tamamlama yolunun son sayfa davranışı önceki bileşen testinde doğrulanmıştır.

İlk fixture hazırlığı başarısız oldu; ayrı sentetik UUID aralığı ve ayrıntılı hata mesajıyla yeniden kurulum başarılı geçti. Son koşu 29 Storage HTTP kontrolünü tamamlayarak exit 0 ile kapandı; geçici DB/container temizliği yapıldı. Üretim değişmedi. Ürün arayüzünde yeni değişiklik yok; önceki 03f6b49 düzeltmesinin çok sayfalı iptal kabulü tamamlandı.


## 17 Ekim — iptal sonrası açık temizlik listesini yenileme

Evraklar sayfasında başarılı kurtarma/iptal callback'i ana evrak listesiyle birlikte cleanupRefreshVersion artırır. DocumentCleanupPanel bunu yükleme bağımlılığı olarak izler: panel açıksa mevcut sayfayı yeniden sorgular, kapalıysa sorgu yapmaz. Panelin açık/kapalı durumu korunur; şirket/kullanıcı kapsamına göre parent key koruması devam eder. Önceden açık bir temizlik listesi yeni iptalden sonra eski boş durumunu gösterebiliyordu.

Bileşen testinde kapalı panelin sürüm değişiminde sorgu yapmadığı, açık boş listenin yeni iptal kaydını aldığı ve açık kaldığı doğrulandı. Cleanup ve pending upload süitleri birlikte 19/19 geçti; cleanup-refresh-tests.tap. Bu değişiklik için tarayıcı kabulü henüz yapılmadı. SQL/migration yok, üretim değişmedi.


## 17 Ekim — açık temizlik paneli yenilemesinin tarayıcı kabulü

6fe34a4 kaynakla yerel sentetik Auth + Storage ortamı açıldı. CUA tarayıcısında Dosya temizliği önce açıldı (bir mevcut iş), ardından Yarım kalan yüklemelerden Dosyası yüklenmiş iptal kaydı onayla iptal edildi. Listeyi yenileye basılmadan açık temizlik panelinde yeni 9103 kaydı görüldü; eski 9205 işi de korundu. Temizlik paneli açık kaldı. İptal dosyayı bu adımda fiziksel olarak silmez; bu tur temizlik düğmesi çalıştırılmadı.

browser-cleanup-refresh-20261017.png ve .txt ekran/DOM kanıtları kaydedildi. Aynı kurulumdaki 29 Storage HTTP kontrolü geçti; süreç exit 0 ile geçici kaynaklarını temizleyerek kapandı. Önceki 19/19 bileşen testiyle birlikte son yenileme düzeltmesinin yerel tarayıcı kapısı kapandı. Üretim yayını, migration veya gerçek veri işlemi yapılmadı.


## 17 Ekim — temizlik listesi yanıt doğrulaması

DocumentCleanupPanel artık document-pending-cleanup.ts servisini kullanır. En fazla 51 satır, benzersiz boş olmayan ID, nullable metin etiketleri, geçerli created_at ve 50'nin katı sınırlı offset doğrulanır. Hatalı/eksik yanıt başarı veya boş liste sayılmaz; yenilemede eski satırlar ve sonraki sayfa bilgisi temizlenir. Tenant/yönetici denetimi mevcut RPC'dedir; dönüş satırlarında tenant alanı olmadığı için istemcide tenant eşleşmesi iddia edilmez.

Cleanup + pending upload süitleri 21/21 geçti. Yeni testler geçerli nullable etiketleri, 51 satır sentinel'i, bozuk/tekrarlı/aşırı yanıtları, geçersiz offset'in istek yapmamasını ve bozuk yenilemede eski satır yerine hata gösterilmesini doğruladı. Kanıt cleanup-validation-tests.tap. SQL/migration yok; bu son doğrulama değişikliği tarayıcıda henüz denenmedi, üretime yayımlanmadı.


## 17 Ekim — toplu regresyon ve yayın hazırlığı özeti

0dc821b üzerinde qa:release çalıştırıldı: envanter 128 application / 27 database / 7 pending; saf fonksiyon kontrolleri, 715/715 application testi, statik 16 kontrolde 0 FAIL/1 WARN ve TypeScript geçti. İlk derleme NEXT_PUBLIC_SUPABASE_URL/ANON_KEY eksikliğiyle /import prerender aşamasında durdu; qa:release bütünü başarılı diye kaydedilmedi.

NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:3061 ve açıkça sentetik build-only anon değeriyle ayrı npm run build exit 0 geçti. Bu derleme gerçek üretim bağlantısı veya canlı veri kabulü değildir. İlk koşu ve tekrar ayrı loglarda korundu: release-check-20261017.log, build-local-env-20261017.log.

RELEASE_READINESS_20261017.md tamamlanan kanıtları ve kalan kapıları tek yerde toplar. Son cleanup parser tarayıcı kabulü, güncel üretim şema/ledger ölçümü, iki pending migration'ın sıralı provası ve modül gerçek kayıt akışının kalan işleri açık. Üretim ölçümü/yayını bu tur yapılmadı. Statik WARN: kullanılmayan CapacityRiskCard, TimelineList; kapsam dışı silme yapılmadı.


## 17 Ekim — son cleanup parser tarayıcı kapısı tamamlandı

f3b11eb kaynak (ürün 0dc821b) ile gerçek yerel Auth/PostgREST/Storage kuruldu. CUA tarayıcısında temizlik paneli açıldı; sentetik 9205 işi isim, firma ve tarih alanlarıyla görüntülendi. Listeyi yenile sonrası aynı geçerli kayıt ve işlem düğmesi korundu; boş/hata görünümü oluşmadı. Gerçek RPC yanıtı yeni parser ile uyumlu. Bozuk yanıt senaryoları önceki bileşen testinde kalır; tarayıcıda hata enjeksiyonu yapılmadı. Temizlik/silme düğmesi çalıştırılmadı.

browser-cleanup-parser-20261017.png/.txt kanıtları eklendi. Kurulumun 29 HTTP kontrolü geçti; exit 0 ve geçici kaynak temizliği tamamlandı. RELEASE_READINESS listesindeki son parser tarayıcı kapısı kaldırıldı. Kalanlar güncel üretim ölçümü, iki migration provası/sırası ve ayrı gerçek modül kayıt işidir. Üretime yayın/veri işlemi yapılmadı.


## 17 Ekim — güncel üretim ledger ve şema ölçümü

Supabase CLI'nin mevcut oturumu ile proje dffdzbmnmnokbftbujsy doğrulandı. Kaynak klasörün bağlantısı değiştirilmedi; geçici klasörde link + migration list çalıştırıldı. Canlı ledger 182 kayıt; repo ile tüm tarihsel sürümler eşleşiyor, yalnız 20261017000100 ve 20261017000200 bekliyor. Aday dosya SHA256'ları live-ledger-preflight-20261017.json içine kaydedildi.

Yalnız public şeması (iş tablosu satırları olmadan) geçici kullanıcı erişimli dosyaya alındı. preview_workspace_modules_v1 tam argümanları eşleşti ve gövde md5'i 4cde00fbcf8756586146ad19aba5d398 çıktı: 000200 yamasının beklediği gövdeyle aynı. staffing_demands/workforce_summary tabloları, UUID NOT NULL tenant_id ve açık RLS doğrulandı; iki önkoşul helper adı bulundu. Metadata kanıtı live-schema-preflight-20261017.json. Bu sınırlı şema metni kontrolüdür; tam izin/owner/trigger kabulü veya iki migration'ın güncel şemada provası değildir. productionReady=false korunur.

İş verisi okunmadı, tam içerik yedeği alınmadı, migration/üretim DML/yayın yapılmadı. Geçici şema dosyası repo dışındadır; sonraki sıralı prova için korunur. Sonraki kapı bu yeni şema üzerinden prova ve izin kontrolüdür.

## 17 Ekim — iki bekleyen migration için sıralı prova

`rehearse-pending.py`, SHA256 ile sabitlenen 17 Ekim public şema ölçümüne `20261017000100` ve `20261017000200` dosyalarını sırayla uyguladı: ikisi de exit 0. Kanıt: `pending-rehearsal-20261017/result.json`. Geçici yerel veritabanı kaldırıldı. Üretime SQL uygulanmadı.

Katalog kabulü: iki statement-level BEFORE yazma trigger'ı, iki restrictive politika, postgres sahipli SECURITY DEFINER bariyeri, boş search_path/5s lock timeout; anon/authenticated/service_role için bariyer EXECUTE kapalı. Preview fonksiyonunun owner/ACL değeri değişmedi ve pending_contract_upload kontrolü eklendi.

Sınır: public şeması üretimden; auth/storage/extensions bağımlılıkları sentetik yerel şablondan geldi. DROP public CASCADE ile kaldırılan şemalar arası bağımlılıklar bu provayla üretim eşdeğeri sayılmaz. Bu bir sıralı DDL/katalog provasıdır; canlı trafik, lock süresi veya tüm yetki/yazma yüzeyleri için kanıt değildir. Yayından hemen önce canlı ledger ve gövde ölçümü yenilenmeli. Gerçek modül kapatma hâlâ açılmadı.

## 17 Ekim — şema temelli yazma yüzeyi envanteri

Güncel public şema snapshot'ı + iki bekleyen migration yeniden yerelde uygulandı. `qa/contract-write-20261015/writer-catalog.sql` 285 fonksiyonun tam imzasını, owner/definer/config/rol EXECUTE durumunu ve gövde MD5'ini; 70 kullanıcı tetikleyicisini ve 179 FK tanımını kaydetti. Kanıt: `qa/contract-write-20261015/pending-rehearsal-20261017/writer-catalog.json`. İş verisi veya fonksiyon gövdeleri rapora alınmadı; geçici DB temizlendi.

Genişletilmiş kelime taramasında authenticated EXECUTE sahibi definer yazma adaylarından doğrudan modül guard sinyali olmayanlar önceki yedi imzayla aynı: accept_workspace_invitation, admin_create_tenant, admin_manage_membership, document_ack_cleanup_v1, manage_workspace_invitation, prepare_invited_profile, select_workspace. Bunlar önceki kimlik/platform ve cleanup sınıflandırmasıyla uyumlu. Anon EXECUTE + definer + yazma kelime sinyali birleşiminde aday yok. Bu metin taramasıdır; dolaylı çağrı veya yetki kanıtı değildir.

18 ON DELETE CASCADE ilişkisi var. Özellikle companies → financial_summaries, staffing_demands, workforce_summary ve partner_company_assignments yolları doğrudan child tablo çağrılarından ayrı test edilmeli. Profil/tenant silme yolları da bakım sınırında tutulmalı. FK iç işlemlerinde RLS yeterli kanıt değildir; trigger ve gerçek rol altında transaction sonucu ölçülmeli. Henüz açıkların istismar edilebilir olduğu iddia edilmez. Kalan kabul: bu silme zincirleri, diğer dolaylı RPC/servis yolları, ardından gerçek modül kayıt UI bağlantısı. Üretim yayını yapılmadı.

## 17 Ekim — firma silme zinciri kabulü

`qa/module-change-command-20261017/company-cascade.test.mjs`, güncel ortak migration fixture'ıyla sentetik yerel PostgreSQL klonunda 5/5 geçti. anon/authenticated/service_role için companies DELETE ve TRUNCATE kapalı. authenticated doğrudan silme, staffing/finance açık ve kapalıyken 42501 döndürür; parent ve child kayıtlar korunur. company_execute_v1('delete',...) BC400 ile reddedilir. Mevcut status/pasif komutu staffing_demands, workforce_summary, financial_summaries kayıtlarını ilgili modül açık/kapalıyken korur.

İlk test beklentisi BM001 idi; ölçüm silmenin child bariyerine ulaşmadan companies tablo izninde 42501 ile engellendiğini gösterdi. Test gerçek sözleşmeye düzeltildi; silme yetkisi verilmedi, politika gevşetilmedi. Kanıt company-cascade-result.tap. Burada FK cascade çalıştırıldığı iddia edilmez: uygulama giriş yolu kapalıdır. Yetkili SQL bakım silmeleri ve diğer dolaylı definer yolları kapsam dışı; genel yazma incelemesi bütünüyle kapanmadı. Geçici DB temizlendi; ürün kodu, migration ve üretim değişmedi.

## 17 Ekim — modül kaydı için güvenli tekrar deneme altyapısı

`src/lib/modules/change-attempt.ts` tek onaylanmış niyetin immutable snapshot/payload'unu ve UUID'sini korur. İstek devam ederken ikinci çağrı aynı promise'i paylaşır. Transport hatası veya geçersiz receipt unconfirmed döner; başarı gösterilmez. Tekrarda güncel revision ilerlemiş olsa da ilk revision/payload gönderilir: önceki commit'in replay kanıtı alınabilir. Actor/tenant/üyelik/seçim veya yönetici rolü değişmişse transport çağrılmaz. Doğrulanmış commit tekrar yazılmaz.

`module-change-attempt.test.mjs` + receipt süiti 10/10, TypeScript ve test envanteri geçti (129 application). Kanıt attempt-tests.tap. Bu injectable transport altyapısıdır; gerçek RPC çağrısı, grant, migration veya UI bağlantısı eklenmedi. Component unmount/context değişiminde eski sonucu göstermeme, reload sonrası kalıcı kurtarma ve kullanıcı mesajları sonraki UI kabulünün konusudur. Receipt güncel ayar görüntüsü değildir; sonrası context refresh zorunludur. Üretim değişmedi.

## 17 Ekim — ayrılan ekranın geç yanıtını yok sayma

Modül kayıt denemesine discard yaşam döngüsü eklendi. UI bağlandığında unmount veya şirket/yetki değişiminde çağrılacak. İstek henüz başlamadıysa gönderilmez; başlamış isteğin geç başarı/hata yanıtı discarded döner, önceki commit cache'i de gösterilmez. Bu sunucuya ulaşmış işlemi geri almaz; tekrar girişte güncel ayarlar yeniden okunmalıdır.

Attempt + receipt süiti 13/13, TypeScript geçti. Yeni kabuller: dispatch öncesi ayrılma, dispatch sonrası geç başarı/hata, doğrulanmış receipt sonrası ayrılma. Kanıt attempt-tests.tap. Henüz component bağlantısı bulunmadığından tarayıcıda şirket geçişi koruması tamamlandı denmez. Yeni SQL/grant veya üretim yayını yok.

## 17 Ekim — tekrar deneme katmanı gerçek SQL komutuyla birlikte

command.test.mjs artık gerçek TypeScript createModuleChangeAttempt katmanını yerel change_workspace_modules_v1 adayına, SQL'in gerçek isimli argümanlarıyla bağlar. İlk SQL commit'inden sonra transport kasıtlı hata verir (fiziksel ağ kesintisi değil, yanıt kaybı enjeksiyonu). İstemci unconfirmed olur. Yenilenmiş context ile aynı deneme tekrar gönderildiğinde replayed=true receipt doğrulanır: aynı immutable payload/UUID, yalnız bir receipt ve tek revision artışı. Sonraki tekrar transport çağırmaz. Fixture ayarları ayrı komutla eski durumuna döndürülür.

Gerçek PostgreSQL süiti 26/26 geçti; önceki yarış/yetki/rollback senaryoları da geçti. Kanıt qa/module-change-command-20261017/result.tap. Geçici DB temizlendi. Bu PostgreSQL sürücüsü üzerinden kabul; HTTP/RPC grant veya tarayıcı entegrasyonu değildir. Aday komut istemcilere hâlâ kapalı. Ürün kodu/migration/üretim değişmedi.

## 17 Ekim — kayıt paneli adayı

ModuleChangeCommit.tsx eklendi: onayla/kaydediliyor, belirsiz sonuçta aynı işlemi tekrar dene, doğrulanmış commit sonrası ayarları yenile, yenileme başarısızsa yalnız okumayı tekrar dene. Ayrılan panel geç yanıtla refresh çağırmaz; niyet discard edilir. Parent entegrasyonu aynı reviewed draft/attempt'i korumalı, şirket/üyelik/seçim değişiminde paneli yeniden kurmalıdır.

Bileşen + attempt + receipt 16/16 ve TypeScript geçti; commit-ui-tests.tap. Üç bileşen kabulü çift tıklama/belirsiz tekrar, commit sonrası yalnız okuma tekrarı, unmount sonrası geç yanıtı kapsar. Panel henüz WorkspaceModules'a bağlanmadı, gerçek RPC/grant açılmadı, tarayıcı kabulü yapılmadı. Üretim değişmedi.

## 17 Ekim — önizlemeden onaya isteğe bağlı bağlantı

ModuleChangePreview artık açıkça enjekte edilen commit capability ile ModuleChangeCommit panelini açabilir. Mevcut WorkspaceModules bu capability'yi sağlamaz: canlı davranış önizleme olarak kalır. Başarılı, güncel seçimle eşleşen, bağımlılık/engel içermeyen sonuç gerekir; hata/yükleniyor/eskimiş seçim onay hazırlayamaz. Onay niyeti bir kez hazırlanır, seçim ve reset kontrolleri kilitlenir. Kayıt başlamadan Seçimlere dön niyeti discard eder ve düzenlemeyi açar; belirsiz kayıt başladıktan sonra bu geri dönüş sunulmaz.

İlgili dört süit 22/22, TypeScript geçti; editor-integration-tests.tap. Varsayılan önizleme davranışı, engel/bağımlılık/hata, çift hazırlama, sabit seçim ve kayıt öncesi geri dönüş kapsanır. Parent hâlâ şirket/üyelik/seçim/revision key sözleşmesiyle paneli yeniden kurmalıdır. Gerçek HTTP transport, SQL grant ve üretim etkinleştirmesi yok; tarayıcı kabulü hâlâ açık.

## 17 Ekim — gerçek yerel PostgREST komut kabulü

http-acceptance.mjs disposable DB + PostgREST v14.3 oluşturur; authenticator bağlantısı ve yalnız yerel rastgele anahtarla imzalı sentetik JWT kullanır. Gerçek GoTrue giriş/tarayıcı kabulü değildir. Aday SQL ve güncel ortak migration fixture uygulanır. İlk authenticated çağrı 403; yalnız geçici DB'de authenticated EXECUTE verildiğinde çağrı açılır. anon/service hâlâ reddedilir.

Gerçek HTTP commit yanıtından sonra istemcide hata enjeksiyonu yapılır; createModuleChangeAttempt unconfirmed döndürür. Context tekrar okunur, aynı payload/UUID ile HTTP replay doğrulanır: tek receipt, tek revision artışı. Başka tenant/actor çağrısı 403; grant geri alınınca replay de 403. Beş kontrol başarılı, http-result.json success=true/cleaned=true. Container ve DB sonunda kaldırıldı. Bu grant üretim migration'ına veya ürün ekranına eklenmedi; üretim değişmedi.

Kalan: write-surface incelemesinin kalanları, gerçek oturumlu tarayıcıda capability bağlantısı, yayın öncesi güncel ledger/katalog doğrulaması. HTTP testi, canlı modül kaydetmenin açıldığı anlamına gelmez.

## 17 Ekim — oturumlu tarayıcıda ilk gerçek modül kaydı

BPS_LOCAL_BROWSER=1 BPS_BROWSER_MODULES=1 ile gerçek yerel GoTrue, PostgREST, Storage ve Next çalıştı. Harness geçici /qa-module-acceptance sayfasını yalnız yeni dizine kurar; mevcut dizinin üzerine yazmaz, kapanışta kaldırır. Aday komuta authenticated grant yalnız disposable DB'dedir. CUA sentetik document-qa hesabıyla giriş yaptı; Duyurular kapatma seçimi → Etkisini kontrol et → Kaydetmeden önce onayla → kilitli seçimler → Onayla ve kaydet çalıştı. Yenilenen context sürüm 1→2, Duyurular=false gösterdi. Kanıt browser-commit.png ve browser-commit.txt.

İlk kurulumda eksik rest parametresi, ardından Docker restart sonrası değişen rastgele REST portunun eski proxy adresinde kalması düzeltildi. Önceki yetki senaryosundan kalan sentetik profiles rolü bu kabul için açıkça yöneticiye ayarlanır. Ürün yetki kontrolü gevşetilmedi. Son harness exit 0; önceki 29 Storage kontrolü geçti, geçici route/container/DB temizlendi. Geçici route'un Next tipleri temizlenip next typegen ve TypeScript tekrar çalıştırıldı.

Bu kabul izole test sayfasındaki gerçek ürün bileşenleri içindir; üretim ayarlar ekranında capability açılmadı. Tarayıcıda belirsiz yanıt, şirket geçişi ve geri açma henüz ölçülmedi; önceki katman testleri ayrı kanıttır. Üretim SQL/yayın yapılmadı.

## 17 Ekim — tarayıcıda yanıt kaybı, replay ve yeniden açma

QA paneline yalnız sentetik ortamda tek başarılı HTTP yanıtını kaybettiren seçim eklendi. CUA ile Duyurular kapatıldı: SQL/HTTP başarılı olsa da istemciye hata enjeksiyonu nedeniyle belirsiz sonuç ve Aynı işlemi tekrar dene düğmesi göründü. Tekrar sonrası aynı UUID, revision=2, replayed=true; context 2'ye yenilendi. Ardından yeniden açma ayrı UUID ile revision=3/replayed=false tamamlandı, Duyurular tekrar seçili göründü.

Kanıtlar browser-unconfirmed.txt, browser-replay.txt, browser-reopen.png/.txt. Yerel SQL metadata ölçümü browser-retry-ledger.json: iki farklı komut, yalnız iki receipt, revision 2 ve 3. Fiziksel ağ kesintisi değil başarılı HTTP cevabının istemci katmanında kayıp simülasyonudur. Test ortamı exit 0 ile temizlendi; 29 Storage kontrolü geçti. Next route tipleri yenilendi ve TypeScript kontrol edildi. Şirket geçişinin tarayıcı kabulü ve kalan yazma incelemesi açık; üretim değişmedi.

## 17 Ekim — kayıt panelinin kendi bağlam koruması

ModuleChangeCommit artık yalnız parent key/unmount sözleşmesine güvenmez. Aynı mount içinde actor/tenant/üyelik/seçim/rol değişirse niyet kalıcı olarak geçersizleşir, işlem düğmeleri kalkar ve güncel ayarları açma uyarısı gösterilir. Eski isteğin veya refresh'in geç sonucu yeni duruma yazamaz. A→B→A da eski denemeyi canlandırmaz. Parent key kullanımı korunur.

İlgili dört süit 24/24 geçti (scope-ui-tests.tap); yeni senaryolar beş bağlam alanı değişimini, geç commit, eski refresh hatası ve eski bağlama dönüşü kapsar. Bu bileşen sürücüsü kabulüdür; gerçek tarayıcıda şirket seçimi henüz ölçülmedi. Üretim değişmedi; son tarayıcı kanıtları önceki kaydetme/replay/yeniden açma sürümüne aittir.

## 17 Ekim — gerçek şirket seçiciden A→B tarayıcı kabulü

Yerel QA panelinin sabit tenant'ı kaldırıldı; current_workspace_context + resolveWorkspaceAccess ile doğrulanmış seçili şirket/rol kullanılır. Üründeki /sirket-sec bağlantısı eklendi. CUA sentetik hesapla A'da Duyurular kapatma önizlemesini onay paneline getirdi, kaydetmeden şirket seçiciye geçti ve Synthetic B'yi seçti. Gerçek select_workspace + Auth refresh akışından sonra QA sayfası Synthetic B/revision1/tüm modüller açık/yeni seçim yok gösterdi; A'nın taslağı veya onayı taşınmadı.

Kanıt browser-switch.png/.txt ve browser-switch-ledger.json. Yerel metadata: toplam 2 ledger satırı var; başlangıç sayısı bu senaryoda ölçülmediği için yeni receipt oluşmadığı iddia edilmez. İki şirketin modül revision'ı 1. Bu kabul kayıt başlamadan navigasyonla şirket değişimini kapsar; uçuş halindeki istekte cross-tab geçiş tarayıcıda ölçülmedi (DB yarış ve bileşen geç yanıt testleri ayrı). Harness exit0 ve geçici DB/container/route temizliği tamamlandı; TypeScript tekrar kontrol edildi. Üretim değişmedi.

## 17 Ekim — servis yazıcıları ve bildirim kapıları

Kaynak taramasında SUPABASE_SERVICE_ROLE_KEY yalnız dört API rotasında bulundu: cron/notifications, healthz, demo-request, access-request. healthz profiles üzerinde head/count okur; iki public başvuru rotası yalnız sabit demo_requests/access_requests alanlarına INSERT yapar, tenant/modül ayarı veya iş kaydı yazmaz. Bu platform başvuruları ürün modülleri kapanınca durdurulmaz. Rate limit süreç içi/best-effort'tur; dağıtık kötüye kullanım koruması olduğu iddia edilmez. Cron tek dış gönderim yolu olarak notification_log damga/geri alma yazılarını yapar. Bu sınıflandırma repo içindeki bu istemciler içindir; dış servis anahtarı kullanıcılarını kapsamaz.

Gerçek TypeScript helper ve batch koduyla dört test dosyası 40/40 geçti; kanıt qa/module-change-command-20261017/service-notification-result.tap. Yeni 7 test tasks/calendar/contracts için yanlış tenant, yinelenen/eksik satır, null/string/sayısal enabled, ikinci sayfa RPC/transport/eksik sonuç hatalarını reddetmeyi kapsar. Önceden başarılı ilk 500 sonuç ikinci sayfa hatasında kısmi izin olarak dönmez. Mevcut batch testleri modül damgadan sonra kapanırsa gönderim yapılmaması ve geri alma çağrısını; sözleşmede geri alma hatasının görünmesini doğrular. DB ve e-posta transport'u sentetiktir; gerçek e-posta gönderilmedi.

Sınır: son uygunluk okuması ile dış HTTP gönderimi atomik değildir. Modül bu okumadan hemen sonra kapanırsa e-posta başlayabilir; başlamış gönderim geri çağrılamaz. Mevcut kontrol bu pencereyi sıfırlamaz. Üyelik snapshot'ı için de eşzamanlı değişiklikte anlık iptal garantisi yoktur. Otomatik e-postalar bu tur açılmadı ve canlı ayar yeniden ölçülmedi. Ürün kodu/SQL değişmedi. Kalanlar: diğer dolaylı RPC/Storage yollarının kapsamlı kabulü, üretim ön kontrolünün yenilenmesi ve gerçek modül kaydının kontrollü yayını; bu tur bütün yazıcıların kapandığı iddiası değildir.

## 17 Ekim — personel/proje Storage politikalarının gerçek şema kabulü

qa/module-change-command-20261017/storage-policy.test.mjs, bps_module_chain_20261005 sentetik şablonu ve manifestteki bütün sonraki migration'larla ayrı yerel DB oluşturdu. storage.objects tablosu ve gerçek politikalar değiştirilmeden authenticated rolünde iki bucket sınandı: person-files/talent ve project-sources/reporting. Açık modülde geçerli rezervasyonla INSERT ve hazır dosya SELECT başarılı; kapalı modülde SELECT sıfır satır ve yeni INSERT 42501. İkinci bağlantıda config kilidinde bekleyen INSERT'in gerçek Lock beklemesi ölçüldü; ilk bağlantı kapatmayı commit edince BM001 ve sıfır yeni metadata doğrulandı. Aynı rezervasyon modül yeniden açıldığında başarıyla yazıldı; ret geçersiz fixture'dan kaynaklanmıyor.

Sonuç: dört alt senaryo + kapsayıcı 5/5; storage-policy-result.tap. İlk denemede testin doğrudan Storage metadata silme hazırlığı 42501 ile engellendi. Koruma gevşetilmedi; ayrı rezervasyon/path kullanılarak düzeltildi. Geçici DB sonunda kaldırıldı. Bu SQL/RLS/gerçek kilit kabulüdür; Storage HTTP upload/download veya dosya byte/içerik doğrulaması değildir. Genel evraklar için önceki 29 HTTP kabulü ayrı kanıttır; bu iki bucket için HTTP kabulü henüz bu blokta yapılmadı. Ürün kodu, migration ve üretim değişmedi. Diğer dolaylı RPC'lerin tam incelemesi ve yayın ön kontrolü açık kalır.

## 17 Ekim — personel ekleri ve proje kaynakları HTTP kabulü

BPS_MODULE_STORAGE_HTTP=1 node qa/contract-write-20261015/storage-http.mjs ile gerçek yerel Storage v1.35.3 ve PostgREST v14.3 çalıştırıldı. Yeni storage-http-acceptance.mjs mevcut geçici DB/container düzeneğine opt-in olarak bağlandı; üretim adresi veya anahtarı kullanılmadı. Sentetik rezervasyonlar SQL ile hazırlandı; personel dosyasının ready durumu fixture olarak işaretlendi. Bu test reserve/finalize RPC'lerinin yeni uçtan uca kabulü değildir.

person-files ve project-sources için HTTP yükleme, caller owner_id, indirilen birebir byte içeriği; foreign/anon okuma-yükleme reddi; modül kapalıyken okuma/yükleme reddi ve sıfır yeni metadata; yeniden açılınca mevcut byte'ların korunması ve bekleyen rezervasyona başarılı yükleme ölçüldü. İki bucket için 10 kontrol + önceki genel evrak 29 kontrol = 39/39. Kanıt qa/module-change-command-20261017/storage-http-result.json. Çalıştırma exit0; finally geçici Storage/PostgREST container'larını ve DB'yi kaldırdı. Gerçek kullanıcı verisi veya üretim değişmedi.

Bu iki bucket'ın önce açık kalan temel HTTP kabulü tamamlandı. Eşzamanlı kapanma SQL kilit testi önceki storage-policy-result.tap dosyasında ayrı kanıttır; HTTP streaming yarış testi bu iki bucket için yapılmış sayılmaz. Kalan kapılar: dolaylı RPC incelemesinin tamamlanması, yayından önce güncel üretim şema/ledger sırasının yeniden ölçümü, aday kayıt komutunun migration/izin/UI bağlantısının kontrollü yayın paketi. Aday komut hâlâ üretime uygulanmadı; ayarlar ekranında gerçek modül kapatma açılmadı.

## 18 Ekim — gerçek ayarlar ekranı kayıt bağlantısı ve toplu kontrol

WorkspaceModules, varsayılan false changesEnabled capability'siyle gerçek ModuleChangePreview → ModuleChangeCommit bağlantısını aldı. Ayarlar sayfasında NEXT_PUBLIC_BPS_MODULE_CHANGES_ENABLED yalnız tam "true" ise açılır; mevcut ortam ayarı değiştirilmedi. createModuleChangeCapability typed RPC payload'ını aynen iletir, 15 saniye abort sınırı uygular, hata durumunda kendiliğinden yeni komut üretmez/tekrarlamaz. UUID yalnız onay niyeti hazırlanırken üretilir. Receipt doğrulaması eski attempt katmanındadır; başarılı commit sonrası tam sayfa yenileme auth/provider/menü snapshot'larını birlikte yeniden oluşturur. Kullanıcının kapattığı modül verileri silinmez. Flag yetkilendirme değildir: SQL EXECUTE ve atomik bağlam/rol/önizleme kontrolleri zorunlu kalır.

31 hedefli test, 132 application dosyasında 740/740 test, qa:unit, TypeScript ve statik 16 kontrolde 0 FAIL geçti. Bilinen CapacityRiskCard/TimelineList uyarısı korunuyor. Release flag true ve yalnız localhost/sentetik Supabase değerleriyle Next production build exit0 geçti; bu üretim bağlantısı veya yeni ekranın tarayıcı kabulü değildir. Kanıt product-ui-result.tap ve product-release-checks-20261018.json. Önceki tarayıcı testleri ayrı QA paneline aittir.

Kalan yayın işi somut olarak üç kapıdır: (1) aday SQL komutunun tarihli migration/ACL paketine dönüştürülmesi ve kalan dolaylı yazma değerlendirmesinin imza bazında kapatılması; (2) güncel üretim şema/ledger ölçümüyle sıralı prova; (3) gerçek Ayarlar ekranında kayıt sonrası tüm uygulama yenilemesinin tarayıcı kabulü, ardından kontrollü flag açılışı. Bu tur bunlar bitmiş veya üretim yayımlanmış sayılmaz. İki pending migration ve candidate SQL üretime uygulanmadı; varsayılan UI hâlâ önizlemedir.

## 18 Ekim — gerçek Ayarlar tarayıcı kabulü ve yeni menü engeli

Yerel GoTrue/PostgREST/Storage/Next ortamında gerçek /ayarlar ekranı CUA ile kullanıldı. Duyurular kapatıldı; yeniden yüklemeden sonra kapalı durum okundu. İkinci komutta Duyurular yeniden açılıp Finansal özet kapatıldı; kayıttan sonra yeni seçimler doğrulandı. İlk kayıt kullanıcıyı Şirket ekibi sekmesine döndürdü. WorkspaceModules artık /ayarlar?bolum=moduller adresine tam navigasyon yapıyor; Ayarlar yalnız bu tanımlı query değerinde Modüller sekmesini açıyor. İkinci kayıt sonrasında Modüller sekmesi açık kaldığı tarayıcıda ölçüldü.

ÖNEMLİ AÇIK: Finansal özet kapalıyken sol menü bağlantısı görünmeye devam ediyor. Sidebar.tsx yalnız role göre süzüyor, modül snapshot'ı tüketmiyor. Önceki 'tam reload menüleri günceller' varsayımı bu ölçümle yeterli değil: reload mevcut olmayan modül filtresini yaratmaz. Modül bazlı menü görünürlüğü ve yükleme/hata davranışı eklenmeden UI flag üretime açılmamalı. Bu görsel bulgu veri erişimi açığı olduğu iddiası değildir; veri kapıları ayrı kanıttır.

Kanıt product-settings-browser.png/.txt. 7 panel/transport testi ve TypeScript geçti. Yerel harness exit0; 29 mevcut Storage kontrolü, geçici container/DB/route temizliği tamamlandı. İlk localhost yönlendirmesinde test proxy CORS kaynaklı giriş başarısızdı; aynı 127.0.0.1 hostunda gerçek giriş başarılı oldu. Üretim değişmedi. Sonraki somut öncelik Sidebar modül filtresi, ardından SQL release paketi ve güncel üretim ön kontrolü.

## 18 Ekim — modül bazlı menü filtresi tamamlandı

Sidebar artık her modüle bağlı bağlantıda doğrulanmış modül durumu ile mevcut rol filtresinin kesişimini kullanır. Desktop/mobile aynı içerikten üretilir. useNavigationModules scoped RPC snapshot'ı okur; yükleme veya hata sırasında modül linkleri görünmez, hata için tekrar dene vardır. Genel bakış, ortak raporlar ve rolün izin verdiği Ayarlar/Şirket Yönetimi gibi ortak girişler korunur. Başka şirketten geç gelen yanıt yeni menüyü değiştirmez. Bu UI filtresi SQL yetkilendirmesinin yerine geçmez; diğer sekmede sonradan değişen ayarlar için anlık push/revocation garantisi yoktur.

9 hedefli test geçti: kapalı modül, başarısız yenileme, şirket değişimi/geç yanıt, kimlik yüklenirken istek atmama, masaüstü/mobil rol-modül kesişimi. Gerçek yerel Ayarlar ekranında Finansal Özet açıktı ve menüdeydi; onaylı kayıt sonrası kapalı duruma geçti, Modüller sekmesi korundu ve Finansal Özet bağlantısı menüden kalktı. Önceki product-settings-browser.txt içindeki menü engeli bu sürümde giderildi. Kanıt navigation-result.tap, navigation-browser.png/.txt. Harness exit0, 29 Storage kontrolü ve geçici DB/container/route temizliği tamamlandı. Üretim değişmedi; SQL yayın paketi ve güncel üretim ön kontrolü hâlâ bekliyor.

## 18 Ekim — güncel üretim ön kontrolü ve kayıt komutu provası

Supabase CLI ile yalnız migration listesi ve public schema-only dump alındı. Proje dffdzbmnmnokbftbujsy; 182 remote sürüm önceki listeyle birebir aynı, son sürüm 20261016001100. Yeni şema SHA256 706e8399171f68a8cb454c275b933ba653623da6503be0b64884b0d39c288ce2 önceki ölçümle aynı. Şema repo dışında 0600 dosyada tutuldu; iş verisi okunmadı/yedeklenmedi. Kanıt live-preflight-20261018.json, dosya hash'leri ve tam migration sürüm listesi.

rehearse-pending.py artık açık --preflight/--out/--candidate seçenekleriyle hash'i ölçüme bağlı tekrar üretilebilir prova yapabiliyor. Varsayılan eski prova davranışı korunur. Yeni ölçüme karşı ayrı yerel DB'de public şema restore + 20261017000100 + 20261017000200 + aday change_workspace_modules_v1 başarıyla uygulandı. Preview owner/ACL korunuyor; aday postgres SECURITY DEFINER, boş search_path, 5s lock_timeout; anon/authenticated/service_role EXECUTE kapalı. Son katalog 286 fonksiyon/70 trigger/179 FK. result.json success=true ve cleaned=true; geçici DB kaldırıldı. Auth/Storage/extensions yerel sentetik bağımlılıklardır; tüm üretim eşdeğerliği veya trafik kilit süresi iddiası yoktur.

Bu yayın ön hazırlığıdır: aday SQL hâlâ tarihli production migration zincirine eklenmedi, grant verilmedi, UI flag açılmadı. Sonraki somut adım aday SQL ve ACL açılışını tarihli kontrollü release paketine almak; yazıcı incelemesinin kapsam sınırlarını release kararında açıkça belirtmek. Gerçek yayın öncesinde bu ölçümün güncelliği yeniden doğrulanmalı. Üretime DDL veya uygulama yayını yapılmadı.

## 18 Ekim — kayıt komutu ve ayrı etkinleştirme paketi

Aday SQL 20261018000100_workspace_module_change_command.sql migration dosyasına taşındı; eski QA kopyası kaldırıldı. Kurulum PUBLIC/anon/authenticated/service_role EXECUTE kapalı bırakır. Ayrı enable.sql exact signature/gövde/sahip/ayar/ACL denetiminden sonra yalnız authenticated yetkisi açar; disable.sql yeni çağrıları kapatır. Ayarları eksik proconfig durumunda SQL NULL değerlendirmesinin kapıyı atlamaması için coalesce(false) kullanıldı ve gerçek HTTP testine eklendi.

Ortak fixture 25 migration; komut SQL 26/26, fixture 5/5. Üç migration güncel ölçülmüş public şema üzerinde sıralı provadan geçti; clientExecute=false, success=true, cleaned=true. Kayıt komutu runtime pg bağımlılığı eski geçici klasörde bulunamadığından ilk test başlamadı; repo dışında /tmp/bps-module-release-runtime içine pg kurularak test başarıyla tekrarlandı. Üretime DDL/grant/deploy yapılmadı. Yayın sırası, etkinleştirme/geri kapatma ve inceleme sınırları qa/module-change-command-20261017/release/README.md içinde. Sonraki iş güncel canlı ön kontrol sonrası kontrollü SQL/uygulama yayını ve kimlikli canlı kabul; bunlar bu kayıtta tamamlanmış sayılmaz.

## 18 Ekim — Modüller paketi ÜRETİMDE

Kaynak 132feab; Vercel dpl_BKQKaeNxjU1kZDhNR3sncDFrtokF www.bpsys.net alanına alındı ve bağımsız inspect ile doğrulandı. Güncel public şema hash'i prova ile aynıydı; canlı 182 ledger sürümü ve bakım bariyeri yokluğu yeniden doğrulandı. Üç migration, exact prefix kontrolü ve ledger kilidiyle tek transaction içinde uygulandı: 20261017000100, 20261017000200, 20261018000100. Ledger artık 185. Sonraki ayrı etkinleştirmede gövde/sahip/ayar/ACL kontrolü geçti; authenticated EXECUTE açık, anon/service_role kapalı. UI flag açık; otomatik e-postalar false korunuyor.

744/744 uygulama testi; Vercel production build READY; statik 0 FAIL/1 bilinen WARN. Atomik yerel prova hata enjeksiyonunda bütün DDL ve ledger rollback, normal 185 kayıt, tekrar uygulama reddi ve grant/revoke doğruladı. İlk fixture sahiplik hataları düzeltildi; üretim politikası gevşetilmedi.

Canlı Mek Group oturumunda Modüller ekranı yüklendi; açık görevler Görevler kapanmasını engelledi; Duyurular önizlemesi son onay adımına ulaştı. Kaydet tıklanmadı, seçimler sıfırlandı, şirketin modül ayarları değiştirilmedi. Evrak listesi yüklendi. Canlı kayıt, ağ kaybı ve yarış enjeksiyonu yapılmış sayılmaz; yerel kanıtları ayrıdır. Gerçek veri temizliği/yedeği yapılmadı. Kanıt qa/module-change-command-20261017/release/production-release.json ve production-install/enable.json. Önceki 'üretimde bekliyor' kayıtları bu paket için tarihsel kaldı.

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

## 18 Ekim — görev bildirimi okuma/okundu yerel adayı

read-candidate.sql eklendi; üretim zincirinde değil. task_inbox_visible_v1 özel yardımcıdır (client EXECUTE yok); task_inbox_page_v1 ve task_inbox_read_v1 yalnız authenticated için yerel açık. Aktör/şirket/güncel rol ve tasks modülü doğrulanır. Görev ataması değişmiş veya kapanmış olaylar liste ve sayaçtan birlikte düşer; aynı kişiye yeniden atama eski olayı diriltmez. Başlık güncel kaynaktan okunur. 30 kayıt keyset sayfalama, global unread ve idempotent okundu vardır; okundu görevi tamamlamaz.

8 alt senaryo, üst test dahil 9/9 gerçek PostgreSQL test geçti (read.tap). 32 kayıtla 30+2 sayfalama, başka kullanıcı/tenant/cursor, güncel üyelik rolü, IK erişimi, modül kapalıyken sıfır görünür kayıt, client tablo/helper reddi ve anon/service RPC reddi sınandı. İki DB bağlantısında task kilidini bekleyen okundu çağrısı, diğer transaction görevi tamamlayıp commit ettikten sonra 42501 ile reddedildi; read_at değişmedi.

İlk test koşusu sentetik ikinci hesabın çoklu üyeliğine rağmen selection/version içermeyen JWT yüzünden WORKSPACE_SCOPE ile durdu. Test gerçek select_workspace çağrısıyla düzeltildi. Aktif işi olan üyeyi muhasebeye düşürmenin mevcut korumayla reddedilmesi korunarak rol testi transaction içinde görevler kapatıldıktan sonra yapıldı. Yarış testinin ilk kontrolü önceden okunmuş kayıt seçiyordu; açıkça okunmamış kayıt seçimine düzeltildi. Üretim korumaları gevşetilmedi.

Açık: duyuru olay/alıcıları, ortak kaynak kimliği/ses dedupe, ortak UI ve hedef bağlantıları; diğer eşzamanlı üyelik/modül yarışları ve büyük veri plan ölçümü. Yeni uygulama veya üretim SQL yayını yok. Canlı son kayıt 6cd6007/186 olarak kalır.

## 18 Ekim — duyuru bildirimleri yerel kabul

qa/announcement-inbox-20261018/candidate.sql: paylaşım anındaki tenant alıcıları (yazar hariç), atomik teslim, özel okundu, güncel üyelik/rol/modül kapısı ve 30 satır sayfalama eklendi. Yeni üyeye eski duyuru dağıtılmıyor; önceki alıcı yeniden katılırsa mevcut kaynağın eski teslimini görebilir. 9 alt senaryo, üst test dahil 10/10 gerçek DB testi geçti; silme kilidini bekleyen okundu çağrısı iki bağlantıda 42501 ile reddedildi. Şema/client yetkileri production'a uygulanmadı. Ortak kutu, hedef bağlantıları ve büyük alıcı sayısı ölçümü açık. Kanıt qa/announcement-inbox-20261018/README.md ve access.tap; canlı son yayın 6cd6007/186, bu tur yeniden ölçülmedi.

## 18 Ekim — ortak bildirim veri katmanı yerel paket

Görev+duyuru+talep konuşması tek global sayaç/sayfalama/okundu sözleşmesine bağlandı; role göre kaynaklar ayrı korunuyor. Cursor ve ses kimliği tür+UUID ile çakışmaya dayanıklı; istemci yanlış şirket/bozuk yanıt/kısmi sonucu reddeder. Gerçek DB 8 alt senaryo (üst test dahil 9/9), genel uygulama 774/774, son tarih kontrolünden sonra hedefli 8/8, TypeScript temiz, statik 0 FAIL/1 mevcut WARN. Kanıt qa/unified-inbox-20261018. Ortak UI ve hedef detay bağlantıları henüz bağlı değil; SQL yalnız QA adayı. Üretim değişmedi, son yayın kaydı 6cd6007/186. Sıradaki paket server action + kutu + görev/duyuru hedefleri + tarayıcı kabulü.

## 18 Ekim — ortak bildirim kutusu uygulama paketi (yerel)

Server action + ortak panel + kaynak hedefleri + Hesabım ses erişimi tamamlandı. Ayrı yeni flag kapalıyken legacy uçlar korunur. Sunucuda beklenen aktör/şirket ve katı cevap doğrulaması var. Görev mevcut TaskLinkOpener ile açılır (önceki yok tespiti düzeltildi); duyuru tam metni kutuda açılır, ilk üç dashboard kaydına bağlı değildir. 780/780 uygulama, 19/19 hedefli test, TypeScript/build ve statik 0 FAIL/1 mevcut WARN. Gerçek yerel Auth/PostgREST/DB tarayıcı kabulünde 32 olay, 30+2 sayfalama, okundu sayacı 32→31, doğru görev detayı ve 390px mobil doğrulandı. Kanıt qa/unified-inbox-20261018/UI_ACCEPTANCE.md. Dört SQL adayı hâlâ QA dizininde; production migration paketi/şema provası, ölçek ve kalan yarış/çoklu sekme kabulü açık. Canlı son ölçüm 6cd6007/186; yeni üretim yayını yok.

## 18 Ekim — ortak kutu migration hazırlığı ve yarış kabulü

Üretim salt okunur ölçüldü: 186 migration, yeni inbox fonksiyonları yok, yayın bariyeri yok. Dört QA SQL adayı 20261018000300–0600 migration sırasına taşındı; eski kopyalar kaldırıldı, fixture manifesti güncellendi. İlk dosya altı bağımlı fonksiyonun güncel ölçülen gövde hash'ini doğrular. 44/44 gerçek PostgreSQL test; config/profil kilidinde bekleyen görev/duyuru okundu çağrıları modül/üyelik değişimi sonrası reddediliyor. Drift halinde ilk tablo oluşmadan rollback testi geçti. 10.000 ek duyuru ile unread 10.002, sayfa 30; yerelde 16–27ms (üretim/fan-out ölçümü değil). Fixture bütünlük 5/5, TypeScript temiz; statik 0 FAIL/2 WARN (yeni yayınlanmamış migration drift + önceki unreachable). Kanıt qa/unified-inbox-20261018/RELEASE_PREPARATION.md. Üretim SQL/yayın yapılmadı. Sıradaki: yüksek alıcı sayısı ve üç kaynak/şirket değişimi/çoklu sekme UI kabulü, sonra taze ön kontrol ve yayın.

## 18 Ekim — bildirim kalan yerel kabulü

45/45 DB testi; 5.001 alıcıya tek duyuru tekil teslimi geçti. Üç kaynak aynı yerel kutuda 33 bildirim; doğru talep mesajı hedefi, şirket B'de boş kutu, diğer sekmeden şirket geçişinde eski ekranın kapanması, sekmeler arası ses kapatma kabul edildi. Ses fiziksel çıktısı ölçülmedi; tekil çalma mantığı otomatik testte. Kanıt qa/unified-inbox-20261018/RELEASE_PREPARATION.md. Üretim kurulumu henüz yapılmadı; sıradaki taze ön kontrol, SQL ve uygulama yayını.


## 18 Ekim — ortak bildirim kutusu ÜRETİMDE

Dört migration tek transaction içinde uygulandı: ledger 190, 2 RLS tablo, 11 fonksiyon ve 2 trigger doğrulandı. a0230dd kaynaklı Vercel dpl_GaMr7ESWyJuM6CjnxeczNd44Esih www.bpsys.net üzerinde READY. Canlı kimlikli ortak kutu hatasız boş sonuç ve ortak ses kontrolleri verdi; gerçek veri/tercih değişmedi. Görev/duyuru olayları kurulum sonrası oluşur, geçmişe bildirim dağıtılmaz. Otomatik e-posta false korundu. 45 yerel DB testi; 5.001 alıcıya dağıtım; üç kaynak, talep hedefi, şirket ayrımı ve sekmeler arası ses kapatma yerel kabulü tamam. Kanıt qa/unified-inbox-20261018/release.json. Bu H görev/duyuru ortak kutu yayınını kapatır; push/e-posta veya her rolün tarayıcıda ayrı kabulü iddia edilmez.

## 18 Ekim — yayın sonrası bakım ve durum uzlaştırma

Ana durum belgesinin üst özeti hâlâ 6cd6007/186 ve görev-duyuru eksik diyordu; son yayın kanıtıyla a0230dd/190 olarak düzeltildi. Modül ana planına güncel yayın özeti eklendi; tarihsel kayıtlar korunuyor. Kod kullanım taramasında yalnız barrel export'u kalan CapacityRiskCard ve TimelineList kaldırıldı; ikinci tarama TimelineList'in tek tüketici olduğu ActivityFeed'i açığa çıkardı, o da kullanılmadığı doğrulanarak kaldırıldı. Mevcut operasyon notları veya canlı aktivite ekranları kaldırılmadı. Tasarım/agent giriş envanteri güncellendi.

Statik 16/16, 0 FAIL/0 WARN; 487 TS/TSX parse edildi. TypeScript --noEmit --incremental false ve git diff --check geçti. Görünür davranış değiştirmeyen ölü kod temizliğinde yeni test yazılmadı; build/tarayıcı kabulü tekrarlanmadı. Bu bakım commit'i yayına alınmadı; canlı kaynak a0230dd, 190 migration önceki yayın kanıtıdır. Yeni SQL veya gerçek veri işlemi yok.


## 18 Ekim — yayın sonrası bildirim rol matrisi

Gerçek yerel DB kabulüne görüntüleyicinin yalnız duyuru erişimi, gizli görev/konuşma okundu reddi, partner rolüne geçişte eski token reddi ve yenilenmiş bağlamla da erişim reddi eklendi: 11/11. Gerçek dış UI bileşeninin beş rol, partner/bilinmeyen/yükleme/eksik bağlam ve rol+şirket değişiminde yeniden mount anahtarı kontrolü eklendi: action dosyası 7/7. İlk DB testi eski konuşma sözleşmesinin P0001/COMM_FORBIDDEN reddini 42501 beklediği için başarısızdı; ürün değil test beklentisi düzeltildi. Tarihsel UI kabul belgesinin güncel yayınla ilişkisi açıklandı. Üretim değişmedi; bu kontroller her rolün tarayıcıda testi değildir. Kanıt qa/unified-inbox-20261018/role-matrix.tap ve UI_ACCEPTANCE.md.

## 18 Ekim — bildirim bağlantı/hata kurtarma ürün paketi (yerel)

Okundu reddinde eski satır/sayaç kalması ve geçmiş sayfada offline→online yenilemenin atlanması testle üretildi ve düzeltildi. Ortak snapshot temizliği, bağlantı sürümüyle geç yanıt reddi ve devam eden isteğin ardından tek reconnect yenilemesi eklendi. Offline tıklama, çift okundu, yanlış şirket ve unmount kabulü de var. 787/787 genel uygulama, 13/13 hedefli, TypeScript ve production build geçti; statik 0 FAIL/0 WARN. Kanıt qa/inbox-recovery-20261018. Testler hook-driver üzerinden gerçek bileşeni çalıştırır; gerçek tarayıcı offline enjeksiyonu henüz yok. Yeni migration/yayın/üretim veri değişikliği yok. Sonraki somut adım bu paketin tarayıcı kabulü ve mevcut yayın kapılarıyla uygulama yayınıdır.

## 18 Ekim — benchmark tabanlı bildirim filtreleri (yerel)

Asana ve monday.com resmi bildirim belgeleri incelendi. Ortak kutuya yüklenenlerde Türkçe arama, tür ve okunmamış filtreleri, tek temizleme eklendi. Global sayaç değişmez; daha eski sayfa yüklenebilir; eşleşme yok açıklaması yüklenen kapsamını belirtir. 14/14 hedefli test, TypeScript, statik 0 FAIL/0 WARN ve diff kontrolü geçti. Arşiv/toplu okundu sunucu sözleşmesi olmadan eklenmedi. Kanıt qa/inbox-benchmark-20261018. Önceki bağlantı düzeltmesiyle birlikte tarayıcı kabulü/yayın bekliyor; yeni migration veya üretim veri değişikliği yok.


## 18 Ekim — bildirim filtreleri ve kurtarma ÜRETİMDE

Kaynak f58db6c, Vercel dpl_55LYaXDQCB1L2onxtqbNUAPRr9xY www.bpsys.net üzerinde READY olarak bağımsız inspect ile doğrulandı. Yeni SQL yok; salt okunur ledger 190 ve önceki kurulumla birebir. 788/788 genel test, production build, yerel filtre/okundu/sayfalama/servis kesintisi-toparlanma ve 390px mobil kabulü geçti. Gerçek browser offline/online event enjeksiyonu yapılmadı; bileşen testi kanıtı ayrıdır. Canlı kimlikli kutu yeni kontrollerle hatasız boş yüklendi, gerçek veri/tercih değiştirilmedi. E-posta false. Kanıt qa/inbox-benchmark-20261018/release.json. Önceki yerel/bekliyor notları bu paket için tarihseldir.

## 18 Ekim — sentetik geri yükleme tatbikatı

qa/synthetic-restore-20261018/rehearse.mjs geçti: mevcut sentetik baseline + 30 migration, bellekte dump, template0 hedefe restore. 120 tablonun satır sayısı/içerik hash'i ve sahiplik/ACL dahil şema birebir; inbox anon/authenticated EXECUTE sınırı korundu. Normal postgres restore sahipliği yetmedi; yerel supabase_admin bağlantısı ile sahiplik/ACL atlanmadan doğrulandı. Geçici iki DB kaldırıldı, gerçek veri/yedek veya üretim değişikliği yok. Bu aynı yerel sunucuda DB restore kabulüdür; eksik tarihsel baseline, yeni sunucu rolleri/eklenti kurulumu, harici Storage byte'ları, sequence değerleri ve uçtan uca kurtarma hâlâ ayrı kabul. Canlı son yayın f58db6c / 190 değişmedi.

## 18 Ekim — geri yükleme sayaç kabulü

Sentetik restore testi 3 sequence için last_value/is_called ve restore sonrası nextval eşitliğiyle genişletildi. 120 tablo + 3 sayaç + 30 migration tatbikatı geçti. Önceki sequence kabul sınırı kapandı; boş sunucu/harici Storage/uçtan uca kurtarma sınırları duruyor. Üretim değişmedi. Kanıt qa/synthetic-restore-20261018/result.json.

## 18 Ekim — Storage dahil kurtarma ve işlem devamlılığı

Sentetik DB + gerçek yerel Storage file backend restore paketi 35/35 HTTP kontrolüyle geçti. Yeni boş Storage konteynerinde yalnız DB ile dosya yok; byte arşivi + gerçek extended attributes geri yazılınca SHA-256 eşit indirme HTTP 200. Bekleyen dosya tekil finalize, iptal/temizlik ve dosyasız rezervasyon iptali restore sonrasında çalıştı; mevcut metadata, sözleşme, modül ön kontrolü, rol/tenant HTTP kabulü de geçti. Düz docker cp/tar xattr kaybı ve restart sonrası dinamik port değişimi test altyapısında giderildi. Geçici DB/konteynerlerin temizlendiği ölçüldü. Kanıt qa/synthetic-restore-20261018/storage-http-result.json. Gerçek veri/üretim değişikliği yok; cloud S3, yeni sunucu/roller, gerçek Auth ve tarayıcı kurtarma kabulü ayrı kalır. Canlı f58db6c/190 son yayın kaydıdır.

## 18 Ekim — geri yüklenmiş sistemde tarayıcı kabulü

35 HTTP restore kontrolünün ardından gerçek yerel GoTrue girişi, dashboard/evrak erişimi, Next server action ile tamamla, dosyalı/dosyasız iptal ve temizlik tarayıcıda geçti. Belge 3→4; ek DB sayımı tek belge/0 iptal dosyası/2 tamamlanmış temizlik doğruladı. Auth taze ayrı sentetik DB'de kuruldu; parola/oturum restore kanıtı değildir. UI kayıtları restore sonrası seed edildi, restore öncesi pending devamlılığı HTTP testindedir. Kanıt qa/synthetic-restore-20261018/BROWSER_ACCEPTANCE.md ve ekran görüntüsü. Harness çıkış 0, yerel kaynaklar temizlendi. Üretim/kod değişmedi.
