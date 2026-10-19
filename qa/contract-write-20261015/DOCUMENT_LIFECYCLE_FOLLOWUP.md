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

## 18 Ekim — sentetik Auth parola/oturum restore

35 Storage/iş HTTP kabulünün ardından 7 Auth kontrolü geçti: resmi GoTrue parola girişi, Auth DB dump/template0 restore, eski access token /user, eski refresh token, tenant hook claim, aynı parola tekrar giriş ve yanlış parola reddi. Kanıt qa/synthetic-restore-20261018/auth-result.json. Aynı yerel roller/JWT secret kullanıldı; MFA/anahtar rotasyonu/yeni sunucu/cloud kurtarma kanıtı değildir. HTTP_ONLY koşusu temiz kapandı; gerçek hesap/yedek/üretim değişikliği yok. Önceki tarayıcı koşusu ile bu Auth restore testi ayrı kabul kanıtlarıdır.

## 18 Ekim — restore sonrası iptal edilmiş oturum reddi

Auth kabulü 10 kontrol: iki ayrı oturumdan biri snapshot öncesi gerçek local logout ile kapatıldı; refresh önce/sonra 400, diğer aktif oturum restore sonrası çalışıyor. 35 Storage/iş kontrolü de geçti. Snapshot sonrası iptallerin bu kanıtla kapsanmadığı açıklandı. Kurtarma kapsamı/sırası qa/synthetic-restore-20261018/RECOVERY_SCOPE.md içinde toplandı. Üretim ve gerçek veri değişmedi.

### 18 Ekim — ayrı boş PostgreSQL kabulü
- Ağsız, port yayımlamayan ayrı initdb konteynerinde 120 tablo, 3 sayaç, 30 migration geri yüklemesi geçti.
- Rol parolaları aktarılmadı; sahiplik/ACL korundu. Bootstrap grantor supabase_admin gerekliliği ölçüldü.
- Kanıt: qa/synthetic-restore-20261018/isolated-result.json. Geçici kaynak DB ve hedef konteyner kaldırıldı.
- Gerçek veriye/üretime dokunulmadı. Aynı imajın eklentileri ve tarihsel sentetik temel kullanılıyor; birleşik yeni sunucu Auth/Storage/tarayıcı kabulü açık.

### 18 Ekim — ayrı sunucuda rol ve eklenti eşitliği

Ayrı sunucu kabulüne katalog kontrolleri eklendi: rol özellikleri/ayarları, rol üyelikleri (grantor, admin/inherit/set), eklenti sürümleri/sahipleri kaynakla aynı. OID yerine isimlerle karşılaştırıldı. Hedefte parola hash’i olan rol sayısı sıfır; parola aktarılmadığı ayrıca ölçüldü. 120 tablo/3 sayaç/30 migration kabulü tekrar geçti. Birleşik yeni sunucu Auth/Storage/tarayıcı testi hâlâ açık; üretim değişmedi.

### 18 Ekim — yeni sunucuda birleşik HTTP kabulü

`node qa/synthetic-restore-20261018/combined-server.mjs` temiz koşusu geçti: 35 Storage/işlem kontrolü ve 10 Auth kontrolü, yeni initdb PostgreSQL sunucusunda birlikte çalıştı. Rol parolaları kopyalanmadı; rastgele yerel parola üretildi. Host DB portu açılmadı; Docker servis ağına SCRAM bağlantısı tanımlandı. Test şeması yönetici rolüyle kuruluyor, HTTP kullanıcı istekleri JWT/tenant kontrollerinden geçiyor. Geri yükleme sonrasında ANALYZE eklendi; PostgREST OpenAPI hazır olma okumasına 10 saniye sınır verildi. Bu işlem gerçek veriye veya üretime dokunmadı.

Kanıtlar: `combined-result.json`, `combined-http-result.json`, `auth-result.json`, `storage-result.json`. Geçici konteynerler temizlendi. Auth ve iş şeması ayrı yerel DB'lerde; gerçek hook sentetik üyelik eşitlemesiyle çalışır. Yönetilen Supabase/S3, MFA ve birleşik tarayıcı kabulü değildir. Sonraki adım `BPS_COMBINED_BROWSER=1` ile aynı düzenin tarayıcı kabulü.

## 18 Ekim — birleşik yeni sunucu tarayıcı kabulü

Kaynak bcca042; komut `BPS_COMBINED_BROWSER=1 node qa/synthetic-restore-20261018/combined-server.mjs`. Önce aynı yeni PostgreSQL sunucusunda 35 Storage/iş ve 10 Auth restore kontrolü; ardından gerçek Next.js giriş ve server action UI kabulü geçti. Synthetic A açıldı; Tarayıcı kurtarma tamamlandı (3→4 belge); dosyalı 9103 ve dosyasız 9102 iptal edildi, temizlikleri tamamlandı. Salt okunur SQL: 9101 documents=1, 9103 storage.objects=0, 9102/9103 completed cleanup=2.

Kanıt `combined-browser-result.json`, `combined-browser.png`. Test sekmesi kapatıldı; SIGTERM sonrası harness exit 0; yeni DB, Auth, Storage ve PostgREST konteynerleri kaldırıldı. Üretim ve gerçek veri değişmedi. Tarayıcı fixture kayıtları restore sonrasında eklenmiştir; restore öncesi pending devamlılığı HTTP aşamasındadır. Ayrı Auth DB/hook fixture eşitlemesi, yerel file-backend ve aynı platform imajı sınırları sürer. Bulut/S3, fiziksel mobil, MFA ve snapshot sonrası erişim değişiklikleri bu kabulün kapsamı değildir.

## 18 Ekim — evrak rol tarayıcı kabulü

Yalnız yerel sentetik storage-http/authenticated-browser düzeneğinde yönetici, operasyon ve görüntüleyici ekranları kontrol edildi. Yönetici yükleme/pending/temizlik eylemlerini görüyor. Operasyon yükleme ve pending görürken temizlik panelini görmedi; sözleşme geçerlilik eylemi disabled; kendi 9101 bekleyen yüklemesini gerçek server action ile tamamladı (başarı mesajı). Görüntüleyiciye rol değişiminde eski kapsam reddedildi; şirket seçiminde Synthetic A Görüntüleyici seçilip /evraklar açılınca Erişim kısıtlı görüldü.

Test düzeneğinde Next geliştirme yönlendirmesinin localhost kullanması nedeniyle yalnız 127.0.0.1'e izin veren CORS ayarı girişte başarısızlık oluşturdu. Proxy artık yalnız iki açık yerel origin'e (localhost:3060 ve 127.0.0.1:3060) cevap verir, Vary: Origin ekler. Üretim kodu/izinleri değiştirilmedi. İkinci temiz harness koşusu ve tarayıcı adımları başarılı; SIGTERM exit 0.

Kanıt: role-operations.png ve role-viewer.png. Bu üç rolün evrak ekranı kabulüdür; tüm roller/modüller, başka kullanıcının pending kaydı, fiziksel mobil veya üretimde rol değişimi değildir. Kullanıcı üretim sekmesi değiştirilmedi; geçici sekmeler/konteynerler temizlendi.

## 18 Ekim — aynı şirket / farklı yükleyen ve rol HTTP kabulü

`BPS_DOCUMENT_OWNER_ACCEPTANCE=1 node qa/contract-write-20261015/storage-http.mjs` 36/36 geçti (29 mevcut + 7 yeni kontrol grubu). Gerçek yerel PostgREST/Storage, iki sentetik kullanıcı aynı şirkette. İkinci kullanıcı çoklu üyelik nedeniyle gerçek seçim/üyelik sürümleriyle token alır; eksik scope nedeniyle reddi sahiplik kabulü sayılmaz.

- Yönetici başkasının pending kaydını görür, can_resume=false; recovery/finalize/cancel 403.
- Operasyon ve İK başka kullanıcının pending kaydını göremez ve bu üç işlemi yapamaz.
- İK kendi dosyasını hazırlama/yükleme/finalize akışını tamamlar.
- Muhasebe list/prepare/recovery/finalize/cancel işlemlerinde 403 alır; reddedilen prepare yeni kayıt bırakmaz.
- Reddedilen işlemlerden sonra asıl pending kayıt, dosya byte'ları ve boş temizlik kuyruğu korunur; asıl yükleyen finalize yapabilir.

Kanıt: document-owner-http-result.json; helper document-owner-acceptance.mjs. Her koşu yalnız geçici DB'yi değiştirir, ek üyelik/seçim ve rol değişiklikleri finally içinde geri alınır; dış harness DB/konteynerleri kaldırır. Üretim değişmedi. Bu İK/muhasebe için tarayıcı değil HTTP kabulüdür; diğer modüllerdeki yetkiler ayrıca değerlendirilir. İlk denemedeki 403 eksik workspace selection fixture'ından geldi; düzeltme ürün yetkisini gevşetmedi.

## 18 Ekim — Evraklar beş rol ekran kabulü

İK kendi pending evrakını gerçek tarayıcı server action ile tamamladı; yönetici temizlik panelini görmedi. Muhasebe geçişinde eski kapsam kapandı, güncel şirket seçimi sonrası doğrudan evrak erişimi reddedildi. Önceki yönetici/operasyon/görüntüleyici kanıtlarıyla beş rolün sınırlı evrak matrisi DOCUMENT_ROLE_BROWSER.md içinde toplandı. Tüm modüllerin rol kabulü değildir. Ürün/yayın değişmedi; sentetik test ortamı temizlendi.

## 18 Ekim — Storage yanıt kesintisi / tarayıcı toparlanması

Sentetik authenticated-browser düzeneğinde yalnız geçici Storage container docker pause ile duraklatıldı. Tarayıcıdan 9101 için Yüklemeyi tamamla seçildi. Gerçek server action süre sınırı sonrası Dosya okunamadı mesajı gösterdi; başarı mesajı yok, kontroller yeniden açıldı. SQL ölçümü documents=0, pending=1, storage.objects=1. Storage unpause sonrası aynı düğme ile yeniden denemede başarı; documents=1, pending=0, object=1. Dosya tekrar yüklenmedi.

Kanıt: storage-outage-browser-result.json; ../synthetic-restore-20261018/storage-outage.png ve storage-reconnected.png. Test sekmesi kapatıldı, harness SIGTERM exit 0, geçici servisler temizlendi. Bu fiziksel mobil/zayıf internet veya upload body kesintisi kabulü değil; gerçek Storage yanıt vermemesi ve UI toparlanma kabulüdür. Tam gecikme ölçülmedi. Ürün kodu ve üretim değişmedi.

## 18 Ekim — dosya gövdesi yarıda kesildiğinde yeniden yükleme

`BPS_UPLOAD_BODY_INTERRUPTION=1 node qa/contract-write-20261015/storage-http.mjs` exit 0, 32/32 (29 mevcut + 3 yeni kontrol grubu). Kaynak e47e88e üzerine QA eklemesi. Gerçek yerel Storage'a Content-Length=47 ile 12 bayt gönderilip istemci soketi kapatıldı. Storage katalog kaydı ve documents kaydı sıfır; finalize HTTP 400; rezervasyon yayımlanmamış ve pending file_present=false kaldı. Aynı path'e upsert=false ile tam dosya yeniden gönderildi; indirilen byte'lar eşit; iki finalize çağrısı tek documents kaydı üretti.

Kanıt `upload-body-interruption-result.json`; tekrarlanabilir yardımcı `upload-body-interruption.mjs`. Test sonunda geçici DB ve konteynerler harness tarafından kaldırıldı. Bu istemci HTTP soket kesintisi kabulüdür; fiziksel mobil, tarayıcı yükleme hata ekranı veya file-backend içindeki olası geçici byte temizliği ölçülmedi. Ürün kodu, üretim, gerçek veri değişmedi.

## 18 Ekim — ilk yükleme için eksik upstream süre sınırı

Kaynak fac852b incelemesinde uploadCompanyDocumentAction genel sunucu istemcisini süre sınırı vermeden kullanıyordu; kurtarma aksiyonları sınırlıyken ilk Storage yüklemesi uzun süre yanıt bekleyebilirdi. Bu aksiyon artık her upstream isteğe 30 saniye deadline verir. Bu tüm form için toplam süre garantisi değildir; tarayıcı→Next dosya aktarım süresini sınırlamaz. Timeout mevcut reviewRequired akışına gider, finalize veya otomatik dosya silme çalışmaz. Rezervasyon korunur.

Doğrulama: scripts/company-document-lifecycle.test.mjs 12/12 (TimeoutError senaryosu dahil); scripts/supabase-server-timeout.test.mjs 2/2 (gerçek yanıt vermeyen localhost HTTP sunucusunda deadline abort ve çağıran iptal sinyali). Deadline testinde 100 ms kullanıldı; üretim aksiyonunun 30.000 ms parametresi aksiyon testinde doğrulanır. Fiziksel mobil ve tarayıcı upload hata ekranı kabulü hâlâ açık. Bu ürün düzeltmesi yerel/geliştirme dalındadır, yayımlanmadı; migration yok.

## 18 Ekim — ilk yükleme zaman aşımı ve geç dosya kurtarma tarayıcı kabulü

Kaynak 14755c2, BPS_LOCAL_BROWSER=1 storage-http. Gerçek sentetik giriş sonrası Evrak Yükle formundan PDF seçildi. Yalnız geçici Storage duraklatılarak form gönderildi. Deadline sonrası form beklemeden çıktı; hata odağı, korunmuş alanlar, açık kapatma ve kapalı tekrar Yükle düğmesi görüldü. SQL documents/pending/object=0/1/0. Storage devam ettirilince proxy üzerinden iletilmiş yükleme geç tamamlandı; listede dosya mevcut oldu. Aynı kaydın Yüklemeyi tamamla server action işlemi başarılı; SQL 1/0/1. Yeniden dosya gönderilmedi.

Kanıt initial-upload-timeout-browser.json ve iki PNG. Tam süre ölçülmedi. Yerel proxy çağıran abort sonrasında forward işlemini tamamlayabildiği için bu özellikle belirsiz/geç tamamlanan yükleme senaryosudur; tüm ağ topolojileri veya tarayıcı→Next gövde kesintisi değildir. Test sekmesi kapatıldı; Storage önce unpause edildi; harness SIGTERM exit 0 ve geçici servis temizliği geçti. Üretim değişmedi; 14755c2 düzeltmesi henüz yayında değil.

## 18 Ekim — yayın test envanteri ve toplu regresyon

8c0abae üzerinde yayın ön kontrolünde yeni scripts/supabase-server-timeout.test.mjs dosyasının test-inventory.json sınıflandırmasının eksik olduğu görüldü. Envanter kontrolü beklenildiği gibi FAIL verdi; application kaydı eklendi. Düzeltilmiş envanter: application 140, database 27, pending 7 dosya. Ardından node scripts/qa-test-suite.mjs application exit 0: 790/790, fail/skip/todo 0. Database ve pending paketleri bu koşuda çalıştırılmadı; toplam uygulama sonucu bunları kapsamaz. Üretime yayın yapılmadı; migration yok.

## 18 Ekim — deadline düzeltmesi statik ve build ön kontrolü

Kaynak f85ff4e. Kayıtlı canlı f58db6c ile ürün farkı yalnız firmalar/[id]/actions.ts: 30 saniye istemci deadline ve yorum düzeltmesi. Migration/bağımlılık/yayın ayarı farkı yok. Statik 16 kontrol, 0 FAIL/0 WARN, 487 kaynak dosyası. İlk build yerel Supabase public ortam değerleri eksik olduğu için prerender aşamasında durdu; sentetik localhost URL ve dummy anon değeriyle tekrar build exit 0 (tip kontrolü dahil). Webpack büyük cache string performans uyarısı var; hata değil.

Kanıt deadline-build-preflight.json. Önceki 790/790 uygulama sonucu aynı ürün koduna aittir. Bu üretim ortamı/şema ölçümü veya yayın değildir. Üretim yayını yapılmadı; yeni gerçek şema ölçümü ve yayın durumunun doğrulanması yayın öncesinde gerekir.

## 18 Ekim — deadline düzeltmesi üretimde

3585375 kaynaklı dpl_2fidor9Mb3pyZqBPFSQcSft4faHi Vercel üretim yayını READY; www.bpsys.net inspect yeni deployment kimliğini doğruladı. Ürün farkı yalnız ilk yüklemenin upstream 30 saniye deadline'ı. Yayından hemen önce salt okunur migration defteri 190 ve önceki sürümle birebir; bariyer yok, SQL uygulanmadı. Vercel uzak build geçti. Canlı kimlikli evrak listesi/yükleme/pending/temizlik kontrolleri salt okunur görüldü; gerçek kayıt/dosya veya tercih değiştirilmedi.

Kanıt deadline-production-preflight.json ve deadline-release.json. Ekran görüntüsü yalnız /tmp/bps-deadline-live.png içinde, GitHub'a alınmadı. Yerel 790 test, 16 statik kontrol ve ilk yükleme timeout/kurtarma tarayıcı kanıtları bu ürün koduna aittir. Üretimde timeout enjekte edilmedi. Otomatik Git yayını kapalı kaldı. Fiziksel mobil kabulü açık.

## 18 Ekim — yükleme belirsizliğinde yönlendirme UX'i (yerel)

Genel evrak ve firma formuna ortak DocumentUploadReviewHelp eklendi. Yalnız reviewRequired sonucunda aynı dosyayı tekrar göndermeden kontrol etme açıklaması ve /evraklar#yarim-kalan-yuklemeler bağlantısı görünür. target=_blank, noopener noreferrer; eski form/dosya korunur. Pending panel hash hedefinde açılır, otomatik mutation yapmaz; listener unmount sırasında kaldırılır.

Tarayıcı: gerçek yerel sentetik form + Storage pause ile timeout; yardım metni/link, korunmuş dosya/ad ve kapalı Yükle görüldü. Link yeni sekme 52'yi açtı; pending panel açık ve ilgili kayıt görünür. Eski formda alanların korunduğu gözlendi. Screenshot upload-review-help.png. Storage unpause, iki test sekmesi kapalı, harness exit 0. Oturum açık bağlantı kabulüdür; oturum süresi dolmuş giriş dönüşü ve fiziksel mobil ayrı kalır.

Test: genel koşu 791 testte 789 geçti, 2 eski bileşen fixture'ı yeni bağımlılığı tanımadı. Fixture eşlemesi düzeltildi; iki etkilenen dosyada 24/24 geçti (hash navigation testi dahil). Genel koşunun son hâlde tümü tekrar geçtiği iddia edilmez. TypeScript temiz. Bu UX eklemesi henüz yayımlanmadı; canlı 3585375 süre sınırı sürümü olarak kalır.

## 18 Ekim — kurtarma UX genel kabulü tamamlandı

Son kaynak c4f8c8e üzerinde genel uygulama 791/791, 0 fail/skip/todo; statik 16 kontrol 0 FAIL/0 WARN; sentetik public ortam değerleriyle production build exit 0. Önceki iki fixture hatası düzeltildikten sonraki tam koşudur. Kanıt review-help-preflight.json. Üretim değişmedi, UX henüz yayında değil; canlı kaynak 3585375. Eski ana klasördeki durum belgesi tek güncel tablo ve ayrı 18 Ekim tarihçesi olarak düzenlendi; tarihsel kanıtlar silinmedi.

## 18 Ekim — evrak sonrası operasyon kabul kapsamı

Mevcut 791 uygulama testini yeniden çalıştırmadan kaynak kapsamı incelendi. Bu bir uçtan uca kabul sonucu değildir. Sıradaki sentetik günlük prova aşağıdaki tek iş zincirini izlemelidir:

| Adım | Mevcut kod/test dayanağı | Kapanması gereken kabul |
|---|---|---|
| Şube talebi ve uygun personel atama | daily-demand.test.mjs; talepler/gunluk/DailyOperations.tsx | Talep aç, uygun kişiyi ata; ikinci oturumun aynı kapasiteyi aşması engellensin. |
| Arama ve bağımsız şube teyidi | start-tracking.test.mjs, start-board.test.mjs, start-shift-db.test.mjs | Geldim beyanı teyit sayılmasın; şube teyidi kalan aramaları kapatsın; gece vardiyası korunsun. |
| Gelmeme ve yedek | replacement-options.test.mjs, replacement-outreach.test.mjs | Uygun olmayan kişi seçilemesin; görüşmede kabul ile fiili atama ayrı doğrulansın; eski atamanın kontrolü kapanmalı. |
| Gerçekleşme | attendance-controls.test.mjs, attendance-lifecycle-db.test.mjs, weekly-attendance.test.mjs | İptal/kaldırılmış atamaya yeni bildirim reddedilsin; önceki gerçekleşme raporda korunmalı. |
| Çalışma onayı | work-approval.test.mjs; WorkApprovalDialog.tsx | Gerçek saat, mola, gece geçişi, düzeltme nedeni ve revizyon görülsün; teyit otomatik ücret onayı olmamalı. |
| Tekrar/bağlantı kaybı ve mobil | start-failure.test.mjs, mobile-operations.test.mjs | Aynı komut tekrarında çift kayıt oluşmasın; belirsizlik başarıya dönmesin; fiziksel cihaz ayrıca ölçülsün. |

Kapsam sınırı: kaynak testleri farklı fixture ve katmanları doğrular; tek zincir tarayıcı kanıtı yerine kullanılamaz. Gerçek üretim verisinde deneme yazımı, bildirim gönderimi veya veri temizliği yapılmadı. Prova sentetik yerel ortamda yapılacak.

## 18 Ekim — kurtarma UX üretim yayını tamamlandı

6300bee kaynak arşivi Vercel dpl_CiWugmjyyW4wtyBqj7tSR5i9t1FA olarak yayımlandı; www.bpsys.net inspect READY ve aynı kimliği doğruladı. Uzak production build geçti. Öncesinde salt okunur 190 migration birebir eşleşti, bariyer yok; SQL yok. Otomatik Git yayını kapalı. 791/791 uygulama ve 16 temiz statik kontrol aynı ürün koduna ait.

Canlı kimlikli /evraklar#yarim-kalan-yuklemeler yeni sekmede açıldı: pending panel expanded, liste yüklü, boş durum doğru. Üretimde form gönderimi veya timeout enjeksiyonu yapılmadı; belirsiz yükleme formu yerel tarayıcı kabulüne dayanır. Ekran kanıtı /tmp/bps-review-help-live.png, üretim ekranı olduğu için GitHub'a alınmadı; test sekmesi kapatıldı. Kanıt review-help-release.json ve review-help-production-preflight.json. Operasyon zinciri tablosu kabul planıdır, tamamlanmış prova değildir.

## 18 Ekim — birleşik operasyon SQL zinciri, ilk kabul

qa/operations-chain-20261018/rehearse.mjs aynı disposable veritabanında kapsamlı gerçek fonksiyonları çalıştırır. Tarihsel sentetik template üzerine manifestteki tüm yeni migration'lar uygulanır. Firma sentetik fixture; şube, iki personel, talep ve atama ops_execute_scoped ile oluşturuldu. Talep→atama→gerçekleşme→taslak çalışma→gönder→onay zinciri 5 kontrol grubu geçti. Dokuz saat eksi 60 dakika mola = 480 dakika. Atama ve onay komutu tekrarları çift kayıt/olay üretmedi. Kapasite aşımı, eski revizyon ve gönderilmeden onay atomik reddedildi; reddedilen komutların makbuzu oluşmadı.

Sonuç qa/operations-chain-20261018/result.json. Her koşu finally ile yalnız kendi geçici DB'sini sildi. Bu yönetici rolünde SQL zinciridir; ayrı şube teyidi, yedek atama kolu, eşzamanlı iki bağlantı ve tarayıcı/rol matrisi henüz bu zincire dahil değildir. Önceki tekil testleri bu eksik kabuller yerine saymıyoruz. Ürün kodu veya üretim değişmedi.

## 18 Ekim — operasyon zincirine yedek ve şube teyidi eklendi

Aynı yerel geçici DB provasının ikinci talebi güncel İstanbul gününde oluşturuldu; olay tarihleri geri yazılmadı. Gerçek ops_start_execute / ops_record_replacement_outreach / ops_replace_assignment fonksiyonları üzerinden 8/8 kontrol grubu geçti. Gelememe araması ardından yedek görüşmesi accepted: mevcut atama değişmedi. Ayrı yedek atama komutu tek aktif atama ve miras alınan plan oluşturdu; komut tekrarı çoğaltmadı. Eski atamaya arama START_CLOSED ile reddedildi ve makbuz bırakmadı.

Yeni personelin claimed_arrival araması attendance=unreported ve confirmed_at=NULL bıraktı. worker kaynaklı teyit START_WITNESS ile reddedildi. branch + tanık teyidi present yaptı; tekrarı yalnız bir confirm olayı bıraktı. Şube teyidi için ops_work_records hâlâ sıfır: çalışma/ücret onayıyla karışmadı. Kanıt qa/operations-chain-20261018/result.json. finally geçici DB'yi temizledi; üretim değişmedi. Kalan: aynı zincirin gerçek tarayıcı kabulü, çoklu rol ve iki eşzamanlı bağlantı senaryosu.

## 18 Ekim — son kontenjan için gerçek eşzamanlılık kabulü

Operasyon zinciri 9/9 kontrol grubu geçti. concurrency.mjs iki ayrı psql oturumu açar. A atamayı yapıp transaction'ı açık tutar; gözlemci idle-in-transaction durumunu görür. B aynı tek kişilik talebe farklı personel atamak ister; pg_stat_activity üzerinde gerçek wait_event_type=Lock gözlenir. A commit sonrası B OPS_CAPACITY_FULL ile reddedilir. Tek aktif atama, A'nın personeli ve B için sıfır komut makbuzu doğrulanır. Bu yalnız sıralı iki çağrı testi değildir.

Oturumlar yalnız geçici DB kapsamında finally ile kapatılır; ana harness kendi DB'sini siler. Kanıt qa/operations-chain-20261018/result.json; ürün kodu/üretim değişmedi. Kapsam: aynı sentetik yönetici, farklı bağlantılar. Çoklu rol, A rollback olursa B'nin devamı ve tarayıcı kabulü bu ölçüme dahil değildir.

## 18 Ekim — ürün yönü ve Faz 1 kapanış kararı

Kullanıcı İK'nın ve diğer seçilebilir modüllerin operasyon kadar önemli olduğunu açıkça teyit etti. Ana karar CALISMA_ALANI_VE_AYARLAR_ANA_PLANI.md başına işlendi. Operasyon Faz 1 üç kapanış paketiyle sınırlandı: gerçek tarayıcı zinciri, rol/mobil viewport, engel düzeltme ve teslim. Açık P0/P1 olmadan kapanır; yeni özellikler/kozmetik işler bu fazı uzatmaz. Sonraki uygulama bloğu İK-1 personel/organizasyon ve bağımsız çalışma kabulüdür. Fiziksel cihaz, gerçek Luca ve bulut kurtarma açık kalır ama İK geliştirmesini süresiz bekletmez. Bu tur plan/kayıt değişikliği; ürün kodu veya yayın yok.

## 18 Ekim — operasyon büyük kabul paketi

Gerçek yerel Next/Auth/PostgREST üzerinde talep→atama→gelememe→yedek görüşmesi→ayrı değişim→personel beyanı→şube teyidi→çalışma taslağı/gönder/onay zinciri tarayıcıda tamamlandı. DB son durumu bir aktif/bir kaldırılmış atama, tek teyit, approved çalışma 25 dakika/sürüm 3. Şirket değişiminde eski firma erişimi reddedildi; dönüşte kayıt korundu. 390×844 görünümde yatay taşma yok, onay dialogu incelendi. SQL rol matrisiyle toplam 10 grup geçti; İK/muhasebe/görüntüleyici yazamaz, operasyon gönderebilir ama onaylayamaz. Kanıt qa/operations-chain-20261018/BROWSER_ACCEPTANCE.md ve browser-result.json; ekranlar tamamen sentetik.

F1-A ana zincir tamam. F1-B ayrı rol oturumları HTTP/UI kabulü hâlâ açık; SQL rol testini bunun yerine saymıyoruz. F1-C kapanış sonra. Ürün/migration değişikliği ve yeni üretim yayını yok. Fiziksel telefon ve gerçek bordro doğrulaması yapılmış sayılmaz.

## 18 Ekim — bağımsız HTTP rol kabulü ve Faz 1 kapanışı

Beş ayrı sentetik kullanıcı gerçek GoTrue parola oturumuyla giriş yaptı; JWT sub ve active_tenant_id doğrulandı. PostgREST RPC çağrılarında operasyon hesabı talep/atama/yoklama/çalışma kaydı/gönderme yaptı, onay ve yeniden açma reddedildi. Yönetici ayrı oturumla onayladı: 480 net dakika. İK, muhasebe ve görüntüleyici ayrı hesapları talep/işe başlama/çalışma yazamadı; reddedilen komutlar makbuz bırakmadı. 5/5 HTTP rol grubu geçti. Kanıt `qa/operations-chain-20261018/role-http-result.json`. Oturumlar aynı aktörün rolünü değiştirerek taklit edilmedi. Tokenlar kaydedilmedi. İlk fixture denemesi auth.users trigger'ının zaten profil oluşturması nedeniyle durdu; yalnız sentetik fixture profil upsert'i düzeltildi, ürün değişmedi.

Tekrar komutu: `BPS_LOCAL_BROWSER=1 BPS_OPS_ROLE_HTTP=1 node qa/contract-write-20261015/storage-http.mjs`. Harness yalnız izinli yerel sunucuda geçici DB/containers açar, finally temizler; bu modda Next başlatılmaz.

F1-A yönetici tarayıcı zinciri ve DB son durumları, F1-B bağımsız HTTP rol matrisi + tenant geçişi + 390×844 görünüm tamam. F1-C: bu kabul kapsamında açık P0/P1 bulunmadı, kullanım yolu BROWSER_ACCEPTANCE.md içinde; ürün/migration farkı yok, gereksiz yayın yapılmadı. **Operasyon Faz 1 kapanmıştır; sıradaki geliştirme İK-1 personel/organizasyon/istihdam çekirdeğidir.** Canlı ürün kaynağı hâlâ 6300bee; QA commit'leri yeni ürün sürümü değildir.

Açık ve fazı uzatmayanlar: rol bazlı düğmelerin her hesapta ayrı görsel incelemesi (backend yetkisi kabul edildi); fiziksel telefon/zayıf ağ; gerçek Luca/Excel mutabakatı; bulut felaket kurtarma; bildirim sağlayıcısı ve ikincil modüllerin kendi kabulü. Bunlar tamamlandı sayılmaz. İK geliştirmesi operasyon kapalı tenantta bağımsız çalışacak; müşteri şubesi ile şirket içi organizasyon karıştırılmayacak. Yeni operasyon özellikleri yeni faz iş listesidir.

## 18 Ekim — İK entegrasyon incelemesi tamamlandı

Faz 1 tekrar açılmadı. Kaynakta kişi çekirdeğinin talent_people/ops_workers ve talent/staffing kapılarına bağlı olduğu; modül kataloğunun v1/tam 10 alan ve DB CHECK=1 kullandığı doğrulandı. Eski uygulanmış katalog migration'ı değiştirilmeden v2 geçişi gerekli. Ana planın İK-1 entegrasyon bölümüne H0 katalog uyumluluğu, H1 ortak kimlik, H2 istihdam/organizasyon, H3 ekran/aktarım, H4 özel dosya/bağımsız kabul sırası ve test matrisi işlendi. İK rolü müşteri operasyonundan bağımsız; çalışan eklemek aday/operasyon personeli/uygulama hesabı üretmeyecek. Bu tur dokümantasyon; ürün kodu/şema/veri/yayın yok. Sıradaki somut paket H0'dır.

## 18 Ekim — H0a katalog geçişi yürütülebilir sözleşmesi

`qa/hr-catalog-20261018/contract.mjs` üretimden izole bir v1→v2 geçiş önerisi olarak kodlandı. `node qa/hr-catalog-20261018/accept.mjs` 7 kontrol grubu geçti: eski 10 alanın tam roundtrip'i, hr=false upgrade, eksik/fazla/boolean olmayan alanların reddi, bağımsız HR durumu, hak+hazır backend şartı, eski istemci kaydında HR korunması, yeni revision sonrası eski ekranın reddi, bigint hassasiyeti ve taşma. Canlı v1 SQL/TS katalog karşılaştırması hâlâ 10 modülle geçti; uygulanmış migration değiştirilmedi. Sonuç `qa/hr-catalog-20261018/result.json`.

Bu H0'ın tamamı değildir. Kod ürün tarafından import edilmez ve DB/HTTP güvenlik garantisi olarak sunulmaz. Sonraki H0b: v1 ve v2 okuma/yazma sözleşmelerinin gerçek disposable DB'de ortak config revision kilidi, değişmez komut makbuzu, açık iş ön kontrolü ve sürümlü geçmişle provası. Yeni migration/güncel şema karşılaştırması ardından; HR açma hâlâ kapalı. Bugünkü kod provası hiçbir tenant ayarını veya üretimi değiştirmedi. Faz 1 tekrar açılmadı.

## 18 Ekim — H0b PostgreSQL işlem algoritması provası

`qa/hr-catalog-20261018/prototype.sql` ve `postgres.mjs` yalnız template0'dan oluşturulan geçici bps_hr_catalog_probe_<PID> veritabanında çalışır. 5/5 kontrol grubu geçti: v1 kaydında HR korunması; aynı komutun tek makbuz/tarihçe ile tekrarı ve farklı payload reddi; sonraki v2 değişikliğinden sonra eski makbuzun değişmemesi; sentetik pending engelinde sıfır makbuz/revizyon değişimi; gerçek iki psql bağlantısında lock wait ardından STALE; ilk işlem ROLLBACK olduğunda bekleyen eski istemcinin özgün HR durumunu koruyarak devamı. Sonuç `postgres-result.json`; finally oturumları ve kendi geçici DB'sini temizledi.

Sınır açık: bu üretim BPS RPC'si veya migration değildir, iki anahtarlı izole işlem algoritmasıdır. Auth/RLS, hak/hazırlık kapıları ve gerçek açık iş sorguları bu testle doğrulanmadı. Pending tablosu yalnız sentetik engeli temsil eder. H0 bütünü henüz tamam değil; H0c'de mevcut current_workspace_modules/change/preview/history ve makbuz sözleşmelerine adaptasyon, güncel şema üzerinde ileri migration provası gerekir. Üretim/veri/menü değişmedi; uygulanmış migration dosyalarına dokunulmadı. İK kullanıma açılmış sayılmaz.

## 18 Ekim — H0c gerçek sözleşme uyumsuzluğu bulundu

Mevcut `change_workspace_modules_v1` ve `parseModuleHistory` kaynaklarıyla adaptasyon incelemesi yapıldı. Gerçek geçmiş parser'ı çalıştırılarak üç durum doğrulandı: HR anahtarı içeren olay v1'in tam alan kontrolünden geçmez; HR alanını çıkarmak değişikliksiz olay üretir ve reddedilir; HR olayını tamamen çıkarmak revision/satır sayısı zincirini bozar ve reddedilir. Kanıt `qa/hr-catalog-20261018/legacy-history.mjs` / `legacy-history-result.json`. Bu mevcut üretimde hata değildir; henüz yapılmamış HR geçişinin uyumluluk engelidir.

Karar: yalnız v1 state projeksiyonu yeterli değil. HR açılmadan önce sürümlü olayları anlayan uyumluluk istemcisi ve geçmiş API'si gerekir. HR olayını gizleme, sahte değişiklik üretme veya global revision'ı yeniden numaralama yok. Eski açık istemcinin güncelleme gereksinimi açık hata/yenileme yönlendirmesiyle ele alınmalı; eski yazmanın HR değerini koruması ayrı garanti olarak sürer. Eski v1 geçmişinin kesintisiz çalışacağı iddiası bu kanıtla geri çekildi.

Ek düzeltme: H0a/b prototiplerinin değişikliksiz yeni komutu başarılı sayması gerçek BPS komutunun MODULE_CHANGE_EMPTY davranışıyla eşitlendi. Aynı komutun mevcut makbuzla tekrarı hâlâ başarılı. Güncellenen 7 sözleşme + 5 PostgreSQL grubu ve 3 gerçek parser karakterizasyonu geçti. H0c uygulama/migration/API bağlantısı tamamlanmadı. Ürün kodu, canlı şema ve veri değişmedi.

## 18 Ekim — H0c açık geçmiş ekranına güncelleme yönlendirmesi

Ürün kodunda ilk uyumluluk parçası eklendi: `parseWorkspaceModuleContext` geçerli aktör/tenant/üyelik kapsamından gelen daha yeni katalog sürümünü MODULE_CLIENT_UPDATE_REQUIRED olarak ayırır; sürüm dışındaki hatalar normal ret kalır. `ModuleChangeHistory` bu durumda eski/eksik olay listesi göstermez, sürüm değişti mesajı ve Sayfayı yenile düğmesi gösterir; önce açık formları kaydetme uyarısı vardır. Genel ağ/bozuk veri hataları önceki tekrar-deneme davranışını korur.

Bu yalnız zaten açık olan geçmiş panelinin yeni yanıtla karşılaşma akışıdır. Yeni katalog API'si, v2 geçmiş modeli, başlangıç sayfasının v2 okuması veya HR açılması uygulanmış değildir. Gerçek tarayıcıda yeni sunucu yanıtı testi henüz yok; bileşen testi yeni sürüm, yanlış tenant ve boş olay göstermeme davranışını sınar. İlk hedefli 15 test geçti. Toplu test/derleme sonucu aşağıdaki kanıt dosyasına yazılacak: `qa/hr-catalog-20261018/history-refresh-checks.json`. Yeni migration veya yayın yok; bu değişiklik yereldir.

H0c geçmiş yönlendirmesi doğrulaması: 792/792 uygulama testi, 15 hedefli test, tsc ve sentetik localhost açık değerleriyle production build geçti. İlk build ortam değerleri yokken /davet prerender aşamasında durdu; ortam düzeltilerek tekrar geçti. Kanıt history-refresh-checks.json. Gerçek tarayıcı yeni-sürüm kabulü ve v2 backend bağlantısı açık; üretime yayımlanmadı.

## 18 Ekim — H0c ilk yükleme sürüm yönlendirmesi

`loadCurrentWorkspaceModules` doğrulanmış daha-yeni-katalog sinyalini genel ağ hatasına çevirmeden taşır. `WorkspaceModules` bu sinyalde eski modül listesi/ön kontrol/editörü açmaz; açık form uyarısıyla Sayfayı yenile düğmesi gösterir. `WorkspaceModuleBoundary` güncelleme gerektiğinde business children'ı mount etmez; ağ hatasının Tekrar dene yolu korunur. Nav okuyucusu aynı hata durumunda kapalı/eksik varsayımlar üretmeden mevcut ret yolunda kalır.

33 ilgili test (service, sayfa sınırı, ayar paneli, geçmiş, navigation ve katalog) ve tsc geçti. Bu değişiklik için tam 792 test ve build yeniden çalıştırılmadı; önceki d4a1b13 kanıtı yeni kaynak için tekrar geçmiş sayılmaz. Yeni katalog API/migration ve gerçek tarayıcı sürüm geçiş testi hâlâ açık. Ürün değişikliği geliştirme dalında; üretime yayımlanmadı, HR açılmadı. Sonraki H0c adımı v2 backend okuma/geçmiş sözleşmesi ve gerçek yerel tarayıcı kabulüdür.


## 19 Ekim — H0c sürüm geçişi regresyon paketi

Başlangıç HEAD d48c63d; çalışma klasörü temizdi. Üç yeni gerçek bileşen callback testi eklendi: açık editörün yeni katalog yanıtıyla kaldırılması ve yenilemenin yalnız kullanıcı tıklamasıyla çalışması; şirket değişiminden sonra önceki şirketin geç gelen update-required hatasının yeni ayarları gizlememesi; geçmiş yenilenirken yeni sürüm yanıtının eski olayları ekranda bırakmaması. 14 hedefli test, 796/796 uygulama testi, tsc ve sentetik localhost public ortamıyla production build geçti. Kanıt `qa/hr-catalog-20261018/transition-refresh-checks.json`.

Bu tur ürün davranışı değiştirilmedi; önceki iki yerel ürün commit'i de toplu doğrulandı. Bileşen sürücüsü DOM/tarayıcı kabulü değildir. V2 backend/geçmiş API bağlantısı, ileri migration ve gerçek tarayıcı sürüm geçişi açık. HR açılmadı; üretim yayını yapılmadı. Sonraki paket v2 geçmişte her olayın katalog sürümünü koruyan API/istemci sözleşmesi ve gerçek BPS şemasında geçiş provasıdır; tamamlanan evrak ve operasyon Faz 1 tekrar açılmaz.


## 19 Ekim — H0c gerçek şemada sürümlü geçmiş okuyucusu

Yeni ileri migration `20261019000100_module_history_catalog_versions.sql` eklendi. `tenant_module_changes` için before_catalog_version/after_catalog_version açık metadata alanları (şimdilik yalnız 1), yeni `workspace_module_history_v2` için historySchemaVersion=2 ve olay bazlı sürümler var. Katalog hâlâ v1/tam 10 modül; geçmiş API sürümü ile katalog sürümü ayrı kavramlardır. Eski migration/API değiştirilmedi; yeni okuyucu yönetici ve tenant kapsamını aynı doğrulanmış context üzerinden denetler. UI henüz v2 okuyucuya bağlanmadı.

`history-schema.mjs` gerçek BPS şablonunu yalnız geçici yerel DB'ye klonlayıp bütün ileri migration'ları sırasıyla uygular. 5 grup geçti: v1 yanıtı ve mevcut olay/makbuz/hash içerikleri aynı; gerçek change_workspace_modules_v1 komutunun migration sonrası tekrarı aynı sonucu verir; v2 aynı olayları sürüm metadata'sıyla döndürür; başka tenant/operasyon rolü/anon ve doğrudan tablo yazması reddedilir; bilinmeyen sürüm yazılamaz; eski bootstrap yeni metadata'yı sağlar. İlk rol fixture'ında yalnız profiles.role değiştirmek yetmediği görüldü; canlı yetki kaynağı tenant_memberships de sentetik fixture içinde değiştirilerek ret doğrulandı. Ürün yetki mantığı gevşetilmedi. Harness finally kendi geçici DB'sini temizledi.

796/796 uygulama testi geçti. Kanıt `qa/hr-catalog-20261018/history-schema-result.json`. Bu değişiklik SQL/QA'dır; önceki build kanıtı yeni migration'ın üretim doğrulaması değildir. Üretim ön kontrolü/yayın yok. Yeni migration tablo kilidi gerektirir; üretim katalog ölçümü ve yayın sırası tekrar doğrulanmadan uygulanmaz. Sonraki: sürümlü geçmiş istemcisi ve v1→v2 katalog geçişi/yazarların birlikte güncellenmesi; ardından gerçek HTTP/tarayıcı kabulü. İK açılmadı.


## 19 Ekim — H0c sürümlü geçmiş uygulama bağlantısı

`loadModuleHistory` artık workspace_module_history_v2 çağırır. Yeni parseVersionedModuleHistory açık historySchemaVersion=2 ve her olayda before/afterCatalogVersion=1 ister; ardından mevcut scope, revision, tam alan, olay sayısı ve durum zinciri doğrulamalarını kullanır. Eksik sürüm metadata'sı varsayılmaz; API hatasında v1'e sessiz fallback yok. Geçmiş paneli aynı kullanıcı akışını korur. Database RPC tipi eklendi. Bu yalnız v2 geçmiş protokolüdür; katalog hâlâ v1, HR açılmaz.

8 hedefli ve 798/798 uygulama testi, tsc, sentetik localhost public değerleriyle production build geçti. Gerçek BPS şeması kopyasında 5 grup yeniden geçti; yeni SQL yanıtı bu kez gerçek uygulama parser'ından da geçirildi. İlk DB girişimi Docker kapalı olduğu için başlamadı; Docker başlatıldı, tekrar başarılı oldu ve geçici DB temizlendi. Kanıt history-schema-result.json. HTTP/tarayıcı kabulü hâlâ yapılmadı.

Yayın bağımlılığı: 20261019000100 migration uygulamadan ÖNCE çıkmalı; API olmadan yeni arayüz yayımlanmamalı. Üretim yayını/şema değişimi yapılmadı. Sonraki kalan: katalog v2, versiyonlu değişim/ön kontrol ve eski komutlarla birlikte çalışma; gerçek tarayıcı kabulü. Faz 1 tekrar açılmaz.


## Güncel karar — hesap başına tek şirket — 19 Ekim 2026

Kullanıcının son kararı önceki MEK/Partner ayrımı planını geçersiz kılar: **Her hesap tek bir şirketi yönetecek.** Yeni ürün akışında Partner–MEK ayrımı, şirket seçimi ve şirketler arası geçiş tasarlanmayacak. Şirketin departmanları, şubeleri ve yöneticileri bu tek şirketin altında yer alır; izin ve satın alma onayları ilgili şirket içi yöneticiye yönlenir. Modül aç/kapa bu şirket hesabına göre çalışmaya devam eder.

Teknik tenant sınırı farklı müşteri şirketlerinin verisini ayırmak için korunur; bu karar tüm müşterilerin tek tenantta birleşmesi değildir. Mevcut çoklu üyelik/şirket seçimi kodunun sadeleştirilmesi ayrıca envanter ve geçiş gerektirir. Mevcut gerçek kayıtları birleştirme/silme veya üyelik taşıma bu karar kapsamında yapılmadı. Bu kayıt ürün yönünü değiştirir; canlı davranış henüz değişmedi. Aşağıdaki eski şirket geçişi testleri tarihsel kanıttır, yeni ürün gereksinimi değildir.


## 19 Ekim — tek şirket ve ticari modül alanı uzlaştırması

Son insan kararları ana plana işlendi: hesap başına tek şirket; Partner/MEK ayrımı yeni UX kapsamından çıktı. “Modüller ve abonelik” alanı kullanım hakkı, etkinlik, rol ve ödeme olarak ayrıldı. Mevcut H0 → platformdan hak tahsisi → şirket modül ekranı → ticari koşullar sonrası self servis ödeme sırası kaydedildi. Fiyat/deneme/sağlayıcı/iptal politikaları henüz seçilmedi. İzin ve satın alma yönetici onayları abonelik satın almayla karıştırılmayacak.

Bu tur yalnız plan/ilerleme kayıtları; kaynak kodu, migration, müşteri verisi ve canlı yayın değişmedi. Önceki 798 test bu belge değişikliği için yeniden çalıştırılmadı. Operasyon Faz 1 ve evrak kabulü yeniden açılmadı. Aktif uygulama görevi hâlâ H0 katalog geçişi ve gerçek tarayıcı kabulüdür.


## 19 Ekim — Zeops ürün aileleri ve menü kapsamı onaylandı

Kullanıcının talebiyle ana plana ürün ailesi/menü/kapsam/teslim sırası matrisi eklendi. İK, self servis, izin/onay, idari işler/satın alma, zimmet, masraf/avans, formlar, işe alım, toplu işlemler, raporlar, bilgi bankası/anket ve sonraki eğitim başlıkları kayıtlı. Menü grubu satılan modülle aynı olmak zorunda değil; hak+etkinlik+yetki ile görünür. Kişisel performans ve süreye bağlı eskalasyon kapsam dışı kalır. Bordro motoru, konum takibi, ödeme ve zaman damgası sağlayıcısı ayrıca karar gerektirir. Bu tur plan güncellendi; uygulama ve yayın yapılmadı.


## 19 Ekim — H0c geçmiş bağlantısı gerçek tarayıcı kabulü

Sentetik yerel Next/GoTrue/PostgREST üzerinde giriş→Ayarlar→Modüller→Değişiklik geçmişi zinciri tamamlandı. Gerçek v2 geçmiş RPC'si kurulum kaydını gösterdi. Yalnız geçici bps_storage_http_<PID> DB'de history RPC yanıtının context.catalogVersion değeri 2 yapıldığında açık panel güncelleme mesajı gösterdi ve time satırı sayısı 0 oldu. Normal fonksiyon geri yüklendi; kullanıcı yenilemesi sonrası kayıt tekrar göründü. Bu tam katalog v2 geçişi değildir; yanıt uyumluluğu testidir.

Tarayıcıda bulunan UX hatası düzeltildi: Sayfayı yenile eylemi şirket ekibine dönüyordu; geçmiş ve modül panelindeki eylemler artık /ayarlar?bolum=moduller adresine tam yenilemeyle döner. Gerçek tarayıcıda aynı sekme ve bir geçmiş satırı doğrulandı. 16 hedefli test ve tsc geçti. İki callback değişimi için tam suite/build tekrarlanmadı. Kanıt browser-result.json, browser-refresh.png, browser-restored.png; tekrar için browser-response.mjs yalnız allowlist geçici DB adını kabul eder. Test sekmesi kapandı; harness SIGTERM sonrası exit 0 ile kendi kaynaklarını temizledi.

Bu kabul geçmiş bağlantısı ve açık panel yenileme yolunu kapatır. Katalog v2 geçişi, v2 yazma/ön kontrol, ilk sayfa gelecek sürüm tarayıcı kabulü ve yayın ön kontrolü hâlâ açık. Üretim değişmedi, HR açılmadı.


## 19 Ekim — H0 sürümlü katalog veri sözleşmesi

Uygulama kaynağına catalog-snapshot.ts eklendi: sürümü açık v1/v2 snapshot doğrulama, yalnız açık geçişte hr=false ekleme, eski istemci isteğinde mevcut HR değerini koruyan merge ve ayrı katalog geçişi/değişiklik karşılaştırması. Geçiş sırasında mevcut ayarlar değiştirilemez, HR açılamaz veya katalog düşürülemez. HR-only olay gerçek değişiklik olarak korunur. Mevcut v1 geçmiş okuyucusu aynı karşılaştırmayı kullanır; görünür katalog ve API context hâlâ v1'dir. Yeni yardımcılar tek başına yetki, abonelik hakkı veya veritabanına yazma izni vermez.

6 yeni test grubu tüm 1024 eski bool kombinasyonundan geçerli bağımlılıklı durumları, geçersiz alanları, eski istemci korumasını, yalnız HR değişikliğini ve migration ayrımını sınar. 14 hedefli, 804/804 uygulama testi, tsc ve sentetik localhost public değerleriyle production build geçti. Önceki QA prototipinin snapshot/merge kopyası kaldırıldı; 7 kabul grubu gerçek uygulama yardımcılarıyla geçti. Bu tur yeni SQL migration veya gerçek DB/HTTP kabulü yapılmadı.

Kalan H0: gerçek SQL katalog v2 geçişi, kilitli/rol ve hak kontrollü yazarlar, sürümlü ön kontrol, karma geçmiş olaylarının uçtan uca sunulması ve gerçek yerel DB/tarayıcı kabulü. Tam katalog geçişi tamamlandı sayılmaz. İK kullanıcı ekranı açılmadı; üretime yayın yapılmadı. Operasyon Faz 1 yeniden açılmadı.


## 19 Ekim — H0 katalog v2 depolama ve karma geçmiş paketi

Yeni ileri migration `20261019000200_module_catalog_v2_storage.sql` mevcut şirketleri katalog 2'ye taşır, HR=false ekler, eski ayar/olay/makbuzları değiştirmeden ayrı catalog_upgrade olayıyla revizyonu artırır. Yeni şirket kurulumu doğrudan v2/hr=false başlar. İK aktivasyonu key guard tarafından reddedilir; kullanım hakkı/İK yazma akışları henüz hazır değildir. Beş değiştirilen fonksiyonun beklenen kaynak gövdesi migration başında doğrulanır; farklı üretim gövdesinde durur.

V1 modül context/ön kontrol ve ayar komutu on alanlı sözleşmesini korur. Eski komut yalnız bildiği anahtarları yazar; geçiş sonrası tam on bir alanı v2 sürüm metadata'sıyla geçmişe kaydeder. Eski ve yeni komut tekrarları aynı on alanlı makbuzu verir. V2 tam context RPC'si eklendi. V2 geçmiş okuyucusu gerçek katalog context'ini döndürür; istemci eski/yeni snapshotları, sürüm zincirini, kurulum/geçiş/HR-only olaylarını eksiksiz doğrular. Katalog geçişi kullanıcı aç/kapa işlemi gibi gösterilmez. Son 20 olay penceresi korunur.

Doğrulama: 808/808 uygulama testi; gerçek BPS şablonunun geçici yerel kopyasında 6 katalog geçiş grubu + 5 eski geçmiş migration grubu; tsc; production build geçti. İlk build yerel browser sunucusuyla aynı anda başlatıldığı için .next çıktısı çakıştı ve page-module ENOENT verdi. Test sunucusu kapatıldıktan sonra bağımsız build geçti. Gerçek tarayıcıda sentetik kullanıcıyla Ayarlar/Modüller açıldı, kurulum+katalog geçişi birlikte görüldü, finans kapatma ön kontrolü başarılı oldu; ayar kaydedilmedi. Kanıt catalog-schema-result.json, catalog-browser.png ve catalog-package-checks.json. Test sekmesi ve geçici HTTP/DB kaynakları temizlendi.

Kalan: kullanım hakkı tahsisi/HR hazır olma denetimi, v2 tam modül düzenleme/ön kontrol ve HR aktivasyonu; tek şirket UX sadeleştirme ve HR1 personel/organizasyon paketi. Bunlar tamamlanmış değildir. Üretim şeması ölçülmedi/yayın yapılmadı. Yayın öncesi güncel şema ve sıra doğrulanmalı; yeni arayüz karma geçmişi desteklediğinden arayüzün bu uyumluluk sürümü depolama geçişinden önce çıkmalıdır (geçmiş v2 RPC'si 20261019000100 zaten gerekli). Operasyon Faz 1 yeniden açılmadı.


## 19 Ekim — Modül kullanım hakkı ve açma yetkisi altyapısı

20261019000300_module_entitlements.sql: şirket bazlı kullanım hakkı defteri, ayrı hak revizyonu ve değişiklik makbuzları eklendi. Eski on modülün kullanım hakları korunur; İK hakkı kapalı başlar. Yeni şirket kurulumunda aynı kayıtlar otomatik oluşur. Tablolar RLS ve doğrudan SELECT/INSERT/UPDATE/DELETE kapalı; tenant kapsamlı yönetici okuyucusu açık sürüm, hak ve hazır olma bilgilerini ayrı döndürür. Uygulama parser/service ve RPC tipleri eklendi; veri eksikliğinde hak varsayılmaz. Hak listesi bağımlılık doğrulamasıyla karıştırılmaz; etkin durum kendi bağımlılıklarını korur.

Yalnız mevcut platform yöneticisi set_module_entitlement_v1 ile hak tahsis/geri alma yapabilir. Şirket yöneticisi kendine hak veremez. Kimlik ve platform yetkisi config/profil kilidinden sonra tekrar doğrulanır. İşlem idempotent makbuz, beklenen hak revizyonu ve aynı config kilidiyle korunur. Açık modülün hakkı geri alınamaz; önce normal açık iş kontrolleriyle kapatılmalıdır. Tahsis modülü etkinleştirmez. İK hakkı verilse bile hazır değil ve kapalı kalır. Canlı hiçbir kullanıcıya platform yöneticiliği verilmedi.

Mevcut change_workspace_modules_v1 kilit altında false→true geçişinde tahsis hakkını denetler; hakkı olmayan modülü açma reddedilir. Eski komut tekrarları korunur. Hak revizyonu modül geçmiş revizyonunu değiştirmez; karma geçmişte boşluk oluşmaz. Yeni migration önceki yazar gövdesini hash ile doğrular. Ödeme veya otomatik abonelik iptali eklenmedi.

Kanıt: 812/812 uygulama testi, 4 yeni istemci test grubu, gerçek geçici BPS şemasında 5 grup, tsc ve sentetik localhost public değerleriyle production build geçti. Gerçek SQL okuyucu yanıtı uygulama parser'ından geçirildi. Paralel iki hak değişikliğinde yalnız biri kaydoldu, diğeri eski revizyon olarak reddedildi; hak kaldırma/yeniden verme sonrasında eski modül komutunun açma denetimi doğrulandı. Yerel test veritabanı temizlendi. Kanıt entitlements-schema-result.json ve entitlements-checks.json.

Bu paket backend + istemci veri sözleşmesidir. Platform hak yönetimi arayüzü, şirketin yeni hak/abonelik ekranı, v2 tam modül düzenleme/ön kontrol ve HR aktivasyonu henüz tamamlanmadı. Yeni UI/tarayıcı kabulü bu tur yok. Üretim şeması ölçülmedi ve yayın yapılmadı; geçiş yayın sırası önceki katalog paketinin uyumluluk şartlarıyla birlikte doğrulanmalı. Sonraki: hak yönetimi ekranını bu RPC'lere bağlama; ardından tek şirket UX ve HR1. Operasyon Faz 1 tekrar açılmadı.


## 19 Ekim — Şirket modül ekranında hak ve hazır olma ayrımı

WorkspaceModules önce doğrulanmış şirket modül context'ini, ardından aynı kapsam/revizyona bağlı kullanım hakkını okur. Hak yanıtı alınmadan kartlar/editör gösterilmez; hata veya yenilemede eski haklar temizlenir. Modül kartlarında kullanım hakkı var/tanımlanmamış bilgisi eklendi. İK ayrı kartta Hazırlanıyor olarak görünür; hak tanımlı olması etkinmiş gibi sunulmaz. Açma yeteneği hak+hazır olma bilgisiyle hesaplanır; kapalı ve açma hakkı olmayan modül checkbox'ı devre dışıdır, doğrudan callback de etkinleştiremez. Hak revizyonu değiştiğinde editör yeniden kurulur. SQL yetkisi son otoritedir; frontend release bayrağı değiştirilmedi.

816/816 uygulama testi, tsc ve sentetik localhost public değerleriyle production build geçti. İlk toplu çalışmada yeni testin JSX children dizisini string sanan assertion'ı başarısızdı; test düzeltildi ve tüm suite geçti. Gerçek yerel GoTrue/PostgREST/Next tarayıcısında haklar ve İK Hazırlanıyor görüldü. Yalnız geçici fixture şirketinde gerçek komutlarla finans kapatılıp hakkı kaldırıldı; Durumu yenile sonrası finans kartı Kapalı/Kullanım hakkı tanımlanmamış, checkbox disabled göründü. İlk fixture çağrısı güncel seçim/üyelik claim sürümleri eksik olduğundan kapsam kontrolünde reddedildi; mevcut sentetik sürümler eklenince başarılı oldu. Ürün yetki kontrolleri gevşetilmedi. Test sekmesi ve geçici kaynaklar temizlendi. Kanıt rights-ui-browser.png ve rights-ui-checks.json.

Bu paket şirketin hak bilgilerini görmesi ve uygunsuz seçimlerin engellenmesini tamamlar. Platform yöneticisinin hak tahsis ekranı, v2 tam modül düzenleme/ön kontrol, İK aktivasyonu ve HR1 hâlâ açık. Satın alma/ödeme eklenmedi, otomatik yayın açılmadı, üretime yayın yapılmadı. Yeni şirket ekranı 20261019000300 RPC'sini gerektirir; katalog uyumluluk arayüzü → katalog depolama → hak migration → bu arayüz sırası güncel üretim ölçümüyle doğrulanmalıdır.


## 19 Ekim — Platform modül hakkı yönetimi ekranı

Ayarlar/Platform modül hakları eklendi. Platform yöneticisi şirketi açıkça seçer; 11 modülün kullanım hakkı, açık/kapalı ve hazır olma durumunu ayrı görür. Hak verme/kaldırma şirket+modül onayıyla mevcut idempotent SQL yazarına gider. Açık modülün hakkı kaldırılamaz; önce şirket yöneticisi normal kapatma kontrollerinden geçmelidir. Hak tahsisi aktivasyon, ödeme veya abonelik iptali değildir. Belirsiz yanıtta aynı komut kimliği tekrar kullanılır; eksik/yanlış kapsamlı makbuz başarı sayılmaz. Şirket değişiminde editör yeniden kurulur.

Yeni 20261019000400 migration yalnız platform yöneticisine kapsamlı okuyucu sağlar; normal yönetici ve sahte actor reddedilir. Ayarlar bolum bağlantıları tüm tanımlı sekmeler için düzeltildi. Gerçek yerel tarayıcıda normal şirket yöneticisinin erişimi reddedildi; yalnız geçici sentetik profil platform yöneticisi yapılarak Synthetic A şirketine İK hakkı verildi. Başarı mesajı ve Kullanım hakkı var / Modül hazırlanıyor birlikte doğrulandı; İK açılmadı. Test sekmesi ve geçici HTTP/DB kaynakları kapatıldı. Üretimde kimseye platform yöneticiliği verilmedi.

Doğrulama: 819 uygulama testi; 6 gerçek yerel veritabanı kontrol grubu; tsc ve production build geçti. Kanıt platform-rights-browser.png, entitlements-schema-result.json, platform-rights-checks.json. Bu ekran 20261019000400 okuyucusunu ve önceki hak migration'ını gerektirir. Üretim şeması ölçülmedi; yayın yapılmadı; otomatik yayın kapalı kaldı.

Sıradaki paket: tek şirket kullanıcı deneyimi sadeleştirmesi ve HR1 personel/organizasyon sınırlarının uygulanması; İK hazır olduğunda v2 açma/ön kontrol. İzin ve satın alma yönetici onayları takip eden paketlerdir. Operasyon Faz 1 yeniden açılmadı; ödeme entegrasyonu bu pakette yok.


## 19 Ekim — Tek şirket kullanıcı akışı

Üst menü ve Hesabım şirket değiştirme bağlantıları kaldırıldı. Eski /sirket-sec adresi kırılmadan şirket bağlantısı doğrulama ekranına çevrildi. Doğrulanmış aktif şirket varsa yalnız o şirket sunulur; aktif şirket yok ve tek üyelik varsa o üyelik sunulur. Birden fazla eski üyelik ve belirlenmiş şirket yoksa rastgele ilk kayıt seçilmez, platform yöneticisine yönlendirme gösterilir. Yetkisiz veya eksik okumada şirket kartı gösterilmez. Devam işlemi mevcut idempotent seçim, oturum yenileme ve DB bağlam doğrulama zincirini korur.

Giriş ekranındaki sabit Partner Staff adı kaldırıldı; Hesabım ve erişim yenileme metinleri tek şirket diline getirildi. Bu bir kullanıcı akışı geçişidir: eski üyelikler silinmedi/taşınmadı, tenant izolasyonu ve eski seçim RPC'si korunur. Sunucuda hesap başına tek üyelik zorunluluğu tamamlandı sayılmaz; eski çoklu üyeliklerin ölçümü ve kontrollü geçişi ayrı iştir. Platform yöneticisinin müşteri şirketlerine hak tahsis ekranı farklı amaçlıdır ve korunur.

821/821 uygulama testi geçti; sıfır/tek/çok üyelik ve mevcut şirketi koruma, belirsiz hesapta devam düğmesi olmaması doğrulandı. İlk yeni bileşen testi VM bağlamında AbortSignal bulunmadığı için hata verdi; test ortamına AbortSignal eklenince geçti, ürün kontrolü gevşetilmedi. Son metin değişikliklerinden sonra ilgili 7 test tekrar geçti. Gerçek yerel tarayıcıda Synthetic A doğrulama → dashboard geçişi ve Hesabım şirket/rol görünümü doğrulandı; şirket değiştirme seçeneği yok. Kanıt single-company-browser.png ve single-company-account.png. Test sunucusu/veritabanı temizlendi.

İK-1 personel/organizasyon şema ve ekranları henüz bu pakette uygulanmadı. Sonraki uygulama bloğu budur; bağlı yönetici ilişkisi izin ve satın alma onaylarının temelini oluşturacak. Üretime yayın yapılmadı ve otomatik yayın açılmadı.

Son kontrol: tsc ve yerel sentetik public değerlerle production build geçti.


## 19 Ekim — İK kişi, istihdam ve organizasyon veri çekirdeği

20261019000500_hr_organization_foundation.sql ile beş özel tablo eklendi: hr_people (kimlik köprüsü), hr_employees (personel kodu), hr_employment_periods (ayrı işe giriş/çıkış dönemleri), hr_departments ve hr_assignments (tarihli departman/pozisyon/yönetici). İK kişisi otomatik aday/ops_workers kaydı oluşturmaz. Mevcut adaya yalnız açık kimlik bağlantısı yapılabilir; bağlı isim talent kaydından okunacak, ikinci isim kopyası tutulmaz. Otomatik eşleme/backfill yoktur. Ortak kimliğe bütün eski yolların taşınması tamamlanmadı; mevcut tablolar korunur.

Tenant bileşik FK'leri, şirkette tek kişi/personel kodu, çakışan istihdam ve organizasyon dönemlerine PostgreSQL exclusion constraint eklendi. Tarihler son gün dahil değerlendirilir; 30 Haziran çıkışın ardından 1 Temmuz yeni dönem olabilir. Atama ve yöneticinin dönemi atama aralığını kapsamalıdır. Tarihlerin kesiştiği yönetici zincirinde kendine bağlılık ve dolaylı döngü engellenir. Şirket satırı kilidi eşzamanlı organizasyon değişikliklerini seri işler; gelecek RPC'ler aynı kilidi revizyon okumadan önce almalıdır. Departman/yönetici dönemini kısaltmak mevcut tarihçeyi geçersiz kılamaz. Normal fiziksel silme ve kişi/istihdam kimliği değiştirme engellidir.

Aday birleştirme henüz İK farkındalıklı değildir: bağlı adayın birleştirilmesi açık HR_LINKED_PERSON_MERGE_REQUIRED hatasıyla durdurulur; birleşmiş adaya yeni bağlantı reddedilir. Bu geçici koruma, birleşme desteği tamamlandı anlamına gelmez. Yeni tablolar boş başlar; canlıda backfill/HR link oluşturulmaz. Tüm tablolarda RLS açık, anon/authenticated/service_role doğrudan tablo izinleri kapalıdır. Bu migration kullanıcı yazma API'si açmaz, İK hakkını/aktivasyonunu açmaz.

Gerçek geçici PostgreSQL şemasında 7 kontrol grubu geçti: özel erişim/no-backfill; aday/worker oluşturmayan kişi ve tenant/kod bütünlüğü; yeniden işe giriş/çakışma; dönem ve doğrudan/dolaylı yönetici döngüsü; geçmişi koruyan kapatma/silme/kimlik; aday bağlantı ve merge koruması; eşzamanlı zıt yöneticilikte bir commit ve bir döngü reddi. İlk ters tarih testi PostgreSQL daterange hatasıyla reddedildi; kullanıcıya kararlı hata için HR_DATE_RANGE doğrulaması eklendi. Kanıt organization-schema.mjs ve organization-schema-result.json. Geçici test DB'si temizlendi.

Bu paket yalnız veri çekirdeğidir. Revizyon/idempotent makbuzlu yetkili HR yazar/okuyucular, HR-aware merge, özel isim düzenleme, çalışan/organizasyon ekranları, Excel ve özel belgeler henüz tamamlanmadı. HR aktivasyonu kapalı kalır. Yeni arayüz olmadığı için bu pakette tarayıcı kabulü yapılmadı. Üretim şeması ölçülmedi ve yayın yapılmadı. Sıradaki paket: bu tablolara rol+modül denetimli komutlar ve çalışan/departman ekranları; ardından yönetici onayı/izin akışı.

Genel uygulama regresyonu: 821/821 geçti. Uygulama kaynak kodu değişmediği için yeni frontend build/tarayıcı sonucu iddia edilmez.


## 19 Ekim — İK çalışan/departman kayıt API'leri ve ilk ekran

20261019000600_hr_directory_commands.sql: hr_assert_access HR modülü+hak+doğrulanmış tenant+İK/yönetici rolünü kontrol eder. Kayıt komutu config→profile→tenant kilidinden sonra erişimi tekrar doğrular; kişi, personel, ilk istihdam dönemi ve isteğe bağlı departman/pozisyon tek transaction içinde kaydedilir. Departman oluşturma aynı komut defterini kullanır. Aynı actor/tenant/command ve aynı payload aynı makbuzu döndürür; farklı payload reddedilir. Komut payload/makbuzları RLS ve kapalı doğrudan izinlerle korunur. Yeni çalışan bu ilk sürümde HR-only kişidir; mevcut adayı işe alma/merge henüz bu ekranda yoktur.

hr_directory_v1 50 satırlık UUID keyset sayfalama ve açık departman listesini döndürür; 1000'den fazla departmanda eksik liste sunmak yerine durur. Tarihler ve aktif organizasyon günü Europe/Istanbul üzerinden hesaplanır. İstemci scope/alan/tarih/tekillik/sayfa sözleşmesini ve yazma makbuzunu doğrular. Yanlış/eksik yanıt başarı sayılmaz.

/insan-kaynaklari ilk ekranı: çalışan listesi, yeni çalışan, yeni departman, personel kodu/başlangıç ve isteğe bağlı departman/pozisyon; ilk/sonraki sayfa; yenileme ve boş/hata halleri. Form açıkken uygulama içi gezinme ve sekme kapanışı korunur. Belirsiz yazmada alanlar kilitlenir, aynı komutla tekrar denenir. Sayfa BPS_HR_PREVIEW_ENABLED=true sunucu bayrağı gerektirir; varsayılan erişim 404. Bu bayrak tek başına veri erişimi vermez: SQL HR etkinliği/hakkı/rolü ayrıca gerekir. Üretim HR key guard ve hazır değil durumu aynen korunur; menüye genel İK bağlantısı eklenmedi.

824/824 uygulama testi, gerçek geçici PostgreSQL'de 6 grup geçti: kapalı modül/yanlış actor/tenant; operasyon/muhasebe/görüntüleyici reddi ve İK yazma; atomik kayıt/idempotency; geçersiz tarih/departmanda orphan bırakmayan rollback; 52 kaydın iki sayfada eksiksiz gelmesi; hak geri alınca okuma ve tekrar yazmanın reddi. Gerçek SQL yanıtı actual TS parser ile doğrulandı.

Gerçek yerel GoTrue/PostgREST/Next tarayıcısında önce kapalı modülün listeyi vermediği görüldü. Yalnız disposable fixture DB'sinde HR guard kısa süre devre dışı bırakılıp HR=true yazıldı ve guard tekrar açıldı; kaynak/üretim koruması değiştirilmedi. Sentetik departman ve QA-HR-001 çalışanı formdan kaydedildi, yenilemede ad/kod/tarih/departman/pozisyon korundu. Browser date fill React state'i güncellemediği için yerel tarih alanı giriş API'si kullanıldı; gerçek kayıt başarılı. Kanıt hr-directory-browser.png ve directory-schema-result.json. Test sunucusu ve DB temizlendi.

Kalan: çalışan detayı/düzenleme, tarihli yönetici atama ve yeniden işe giriş/ayrılış komutları, adaydan ortak kimliğe geçiş/HR-aware merge, filtre/arama, Excel ve özel belgeler; v2 modül açma ve HR hazır olma teslimi. İK-1 bütünü tamamlanmadı. Üretime yayın, gerçek kişi oluşturma veya gerçek HR aktivasyonu yapılmadı.

Son kontrol: TypeScript ve sentetik localhost public değerlerle production build geçti.


## 19 Ekim — özel roller karar çekirdeği ve çok iş yeri geçiş planı

Kullanıcının onaylı devamı doğrultusunda özel rol/işlem/kapsam/hassas alan ayrımı kod sözleşmesine taşındı. src/lib/access/policy.ts: 9 İK/finans yeteneği, tüm şirket/kendisi/seçilmiş departman ve kendi iş yeri kapsamı, açık ret önceliği, gerekçeli süreli istisna, actor/tenant/revizyon bağlama, modül+hak kontrolü. Departman ve iş yeri birlikteyse kesişim uygulanır. Export, maaş okuma ve dosya indirme ayrı izinlerdir; aynı kayda okuma iznini de gerektirir. İzin/ satın alma onay rotası, özel rol yetkisiyle karıştırılmadı; bunlar sonraki veri/API paketidir.

832/832 uygulama testi ve TypeScript geçti. Yeni 8 grup: geçersiz sözleşme/wildcard; tenant/actor/revizyon/modül sınırları; kapsam kesişimi/null; açık ret; süre sınırları; export/hassas alan ön koşulu; muhasebe elemanı/yönetici ayrımı; yetenek bağımlılık döngü kontrolü. git diff --check temiz. UI/SQL değişmediği için tarayıcı/Storage veya SQL kabulü yapıldığı iddia edilmez.

Ana plana A–D sırası işlendi: A karar sözleşmesi; B kendi iş yerleri+hesap/çalışan bağı+özel rol deposu ve SQL yazarları; C rol/kişi/geçmiş ekranı ve bütün erişim yollarına aşamalı bağlama; D İK-1 bitişi ve yöneticiye yönlenen izin/satın alma. Son yönetici, kendine yetki artırma, modül kapısı, revizyon iptali, SQL kapsamlı sayfalama ve alan projeksiyonu kabul şartları kaydedildi.

Sınır: bu çekirdek üretim yetkilendirmesine BAĞLI DEĞİLDİR. Mevcut rol/SQL korumaları değişmedi; özel rol menüsü veya rol kaydetme henüz yok. Karar fonksiyonuna yalnız sunucunun doğruladığı kayıt/bağlam verilebilir; istemci tarafı filtre güvenlik değildir. Özel rol sistemi veya İK-1 tamamlandı sayılmaz. Üretime yayın ve yeni migration yok. Sonraki somut paket B; operasyon Faz 1 kapsamı genişletilmedi.


## 19 Ekim — kendi iş yerleri ve çalışan–hesap bağlantısı paketi (yerel)

20261019000700_hr_work_locations_and_accounts.sql: müşteri şubelerinden ayrı hr_work_locations; tarihli hr_location_assignments; geçmişi koruyan hr_account_links. İş yeri ataması istihdam dönemi içinde kalır, aynı çalışanın tarihleri çakışamaz, ardışık dönemler mümkündür. Departman/pozisyon atamasından ayrı tutulur. Açık atama varken iş yeri kapatma veya istihdamı kısaltma reddedilir. Normal fiziksel silme yok; bitiş ve kapanış beklenen revizyonla yapılır.

hr_workplace_command_v1 altı işlem sağlar: iş yeri oluşturma, tarihli atama, atama bitirme, iş yeri kapatma, hesap bağlama ve bağlantıyı sonlandırma. Doğrulanmış tenant/actor, açık HR modülü+hak, config→profile→tenant kilidi, idempotent komut defteri ve kesin makbuz kullanır. Hesap bağlama/ayırma yalnız yönetici içindir; İK rolü tek başına kendisi erişimini değiştiremez. Read committed dışındaki yazma izolasyonu reddedilir; kilit bekleme sınırı 5 saniye. Aynı komut eşzamanlı geldiğinde bir kayıt ve aynı makbuz oluşur.

Bir hesap şirkette yalnız bir çalışanla, çalışan yalnız bir hesapla aktif bağlı olabilir. Üyelik varlığı ve üyelik kaydının kimliği tutulur; silinip yeniden oluşturulmuş üyelik eski bağı canlandırmaz. İç resolver güncel üyelikle eşleşmeyen bağlantıyı döndürmez. Üyelik kaldırmayı bu yeni tablo FK ile engellemez. Resolver istemciye açık değildir; mevcut self erişim akışları henüz bu bağı kullanmaz. Bağlantı oluşturma mevcut üyeliği veya rolü değiştirmez.

src/lib/services/hr-workplace.ts veri sözleşmesi/immutable komut ve makbuz doğrulaması eklendi; TypeScript RPC tipi tanımlandı. Aynı belirsiz komut güvenle tekrar gönderilebilir; başka kayıt/şirket/kişi/komut/revizyon makbuzu başarı sayılmaz. Yeni yönetim ekranı veya okuma listesi eklenmedi; mevcut İK ekranı henüz bu komutlara bağlı değildir.

Doğrulama: 834/834 uygulama testi; TypeScript; yeni gerçek PostgreSQL 6 kontrol grubu; mevcut İK dizin 6 ve organizasyon 7 grubu geçti. Eşzamanlı aynı komut iki bağlantıda test edildi. Kanıt qa/hr-catalog-20261018/workplace-schema-result.json ve workplace-schema.mjs; eski İK sonuçları yeniden ölçüldü. Geçici test DB'leri finally ile kaldırıldı. UI değişmedi; tarayıcı/build veya üretim kontrolü yapılmış sayılmaz.

Paket B'nin organizasyon ve hesap bağı alt paketi tamamlandı. Özel rol depolaması, rol/istisna/atama komutları, revizyon iptali ve SQL yetki değerlendirmesi hâlâ sıradadır; özel rol yönetimi tamamlandı değildir. Ardından Ayarlar/Roller ve erişim, iş yerleri ve çalışan detayı ekranlarına bağlama. Yeni migration üretimde uygulanmadı, HR aktivasyonu açılmadı, gerçek veriye dokunulmadı. Otomatik yayın kapalı geliştirme dalında ilerleniyor.


## 19 Ekim — özel roller yönetim API'si ve SQL karar önizlemesi (yerel)

20261019000800_custom_access_roles.sql özel tabloları: şirket erişim revizyonu, roller, tek ana rol ataması, süreli istisnalar, komut makbuzları ve önce/sonra geçmişi. Doğrudan anon/authenticated/service_role tablo erişimi kapalıdır. Başlangıçta mevcut kullanıcı/rol dönüştürme veya otomatik atama yapılmaz.

company_access_command_v1: rol oluştur/düzenle/arşivle; rol ata/kaldır; süreli istisna ekle/iptal et. Doğrulanmış actor/tenant ve mevcut şirket yöneticisi şartı; config→profile→tenant→üyelik kilitleri; beklenen şirket erişim revizyonu; idempotent komut; atomik revizyon ve önce/sonra audit. Eşzamanlı farklı komutlardan biri eski revizyonla reddedilir. İstisnada gerekçe ve kesin UTC başlangıç/bitiş zorunlu; scope içindeki departman ve iş yerleri şirkete ait olmalıdır. Geçersiz payload, wildcard, boş seçilmiş kapsam reddedilir.

Bu ilk sürüm erişim yöneticiliği atamaz: kendi hesabına ve yönetici hesaplarına rol/istisna komutları kapalıdır. Yönetici bağlı bir rolü değiştirmek de kapalıdır. Böylece özel rol API'si yönetici yetkisini veya son yöneticiyi kaldıramaz; mevcut üyelik yönetiminin kuralları değiştirilmez. Normal kullanıcıya verilmiş rol/istisna şirket yöneticisi tarafından yönetilir. Şirketten ayrılan kişinin eski ataması kaldırılabilir; yeniden oluşturulmuş üyelik eski rol veya istisnaları canlandırmaz. Arşivleme bağlı atama varken reddedilir. Süre dolması cron gerektirmez; SQL kararında zaman değerlendirilir.

company_access_settings_v1 yalnız yöneticiye kapsamlı ayar kaydı ve son 20 geçmiş olayını döndürür; enforcement=preview_only açıkça taşınır. İlk sınırlar: 250 rol, 1000 atama, 1000 iptal edilmemiş istisna; aşılırsa sessiz kesme yerine ACCESS_SETTINGS_LIMIT. Eski audit satırları korunur fakat bu okuyucuda geçmiş sayfalaması yoktur. Sonraki UI büyüklük sınırlarını işlem öncesinde görünür kılmalı veya sayfalı okuyucuya geçmelidir.

Özel SQL policy materializer + karar fonksiyonu: kapalı/haksız modül, açık ret, şirket/kendisi/departman+iş yeri kesişimi, aynı kayda okuma ön koşulu ve süre bitişi TypeScript kararlarıyla karşılaştırıldı. Bu yardımcılar istemciye açık değildir. company_access_employee_preview_v1 yalnız yöneticiye bir çalışanın erişim kararını döndürür; sahiplik, departman, iş yeri ve saat sunucudan gelir. Ad/maaş/belge içeriği dönmez. Finans kararı iç yardımcıda tanımlı; kullanıcıya açık çalışan önizlemesi yalnız İK içindir. Onay rotası, tutar sınırı veya izin hakkı bu paket değildir.

src/lib/services/access-management.ts: iç içe nesneleri de dondurulan komut hazırlama ve tam actor/tenant/command/kind/id/revizyon makbuzu doğrulaması. Ortak parseAccessPolicy kullanılır; effect alanının string dışı coercion kabulü kapatıldı. RPC TypeScript tipleri eklendi.

Kanıt: 836/836 uygulama testi, TypeScript, yeni gerçek PostgreSQL 7 test grubu; iş yeri 6 ve mevcut İK dizin 6 grup geçti. Gerçek SQL policy/receipt gerçek TS parser/adapter'dan geçti. Modül kapalı, açık ret, kesin bitiş anı, iptal, kapsam kesişimi/null, export ön koşulu, self, yeni üyelik kimliği, yanlış actor, İK rolüyle yönetim reddi, kendi yönetici hesabı, idempotency, yarış ve audit sürekliliği sınandı. İlk SQL koşusunda CASE ifadesinin parantezi düzeltildi; son koşular başarılı. Geçici test veritabanları kaldırıldı. Kanıt access-schema.mjs ve access-schema-result.json. UI değişmedi; tarayıcı/build/üretim testi iddiası yok.

SINIR: özel roller saklanabiliyor ve sunucuda önizlenebiliyor; mevcut İK/finans okuma-yazma/export/download uçları HENÜZ yeni yetkiye geçirilmedi. Bu nedenle özel rol atama mevcut erişimi daralttı/genişletti diye sunulmamalı. Ayarlar/Roller ve erişim ekranı, sayfalı/alan kontrollü gerçek veri okuyucuları ve tüm yazma yollarının geçişi sıradadır. Eski rol OR yeni rol şeklinde bypass eklenmedi. Üretime migration/deploy yok, gerçek rol değiştirilmedi, HR açılmadı. Sıradaki paket C: yönetim ekranı ve ilk İK erişim yolunun uçtan uca kontrollü geçişi; HR aktivasyonu bütün yollar hazır olmadan açılmaz.


## 19 Ekim — Roller ve erişim hazırlık ekranı (yerel)

/ayarlar/roller sunucu BPS_ACCESS_PREVIEW_ENABLED=true bayrağıyla açılır; varsayılan kapalı/404. Genel Ayarlar menüsüne aktif erişim yönetimi gibi eklenmedi. Yalnız doğrulanmış şirket yöneticisi ekranı görebilir; SQL ayrıca denetler. Roller/Kişiler/Değişiklikler: rol oluşturma, düzenleme, kopyalama, arşivleme; işlem–izin/ret–kapsam satırları; tüm şirket/kendisi/seçili departman+iş yeri; kişiye atama/kaldırma; son 20 değişikliğin zaman/revizyon özeti. Her kayıt öncesi gözden geçirme; atamada kişi ve rol adları gösterilir. Bağlı rol arşivlenemez, yönetici hesapları seçilemez.

Form gezinme ve sekme kapanış koruması; kayıtta çift tıklama kilidi; belirsiz yanıtta aynı immutable komutla tekrar; hesap/tenant değişiminde remount. Ayar okuma hatasında başarı gibi boş liste yok. 20261019000900 yalnız manager seçenek okuyucusu: kişi adı/rol/üyelik kimliği, departman ve şirketin kendi iş yerleri; e-posta veya hassas HR alanları yok. Boyut başına 1000 sınır aşımı açık hatadır. Strict istemci parser kapsam, tekillik, rol bağlantısı ve sıralı geçmişi doğrular. Yeniden oluşturulan üyeliğe ait eski atama geçerliymiş gibi gösterilmez, yeniden atama/kaldırma açıklaması vardır.

Gerçek yerel GoTrue/PostgREST/Next tarayıcı kabulü: sentetik rol oluşturma; yenilemede kalıcılık; departman ve iş yeri checkbox kesişimini düzenleme/kaydetme; kişi atamasında isimli onay ve kayıt; kaydedilmemiş formda Ayarlar navigasyonunun engellenmesi; 3 olayın geçmişte görünmesi. Kanıt access-settings-browser.png. Test sekmesi/sunucusu ve disposable DB kapatıldı. Gerçek kullanıcı/rol değiştirilmedi. Masaüstü kabulü yapıldı; mobil ve yarış/ağ hatası UI enjeksiyonu bu tur yapılmadı.

838/838 genel uygulama testi geçti; son üyelik/parser/UI düzeltmelerinden sonra ilgili 12 test tekrar geçti. Gerçek PostgreSQL 7 erişim grubu ve gerçek SQL settings/options yanıtının TS parser kabulü geçti. TypeScript geçti. Production build sonucu aşağıya eklenecek.

Sınır: bu bir HAZIRLIK ekranıdır ve bunu açıkça yazar. Mevcut İK/finans veri erişimine yeni kurallar henüz bağlanmadı; özel rol atama gerçek erişimi değiştirmez. Süreli istisna ve çalışan karar önizleme API'leri mevcut, fakat bu ekranda henüz formu yok. Geçmiş görünümü yalnız revizyon/zaman özetidir, önce/sonra ayrıntı okuyucuda durur; ayrıntı ve sayfalama UI'sı açık iştir. İK erişiminin uçtan uca geçişi ve HR hazır olma tamamlanmadı. Yeni migration/deploy üretime uygulanmadı.

Son kontrol: sentetik localhost public değerleriyle production build geçti; önizleme bayrağı varsayılan kapalı bırakıldı.


## 19 Ekim — kapsamlı İK okuyucusu ve sayfalama kabulü (yerel aday)

20261019001000_hr_scoped_directory.sql: hr_scoped_directory_v1 özel rol politikasını/aktif istisnaları bir kez okur; şirket/kendisi/departman+iş yeri filtresini 51 kayıtlık sayfa sondasından ÖNCE uygular. Çıktı en çok 50 satır, hasMore yalnız izinli satırlardan. Açık ret izinleri bastırır. Hesap ilişkisi, güncel üyelik kimliği, tarihli departman ve iş yeri sunucudan bulunur; istemci scope/hesap/saat veremez. HR modülü ve kullanım hakkı zorunlu; özel rol yoksa eski yönetici/İK rolüne fallback yoktur. Maaş/belge alanları dönmez, kapsam dışı organizasyon seçicisi sızmaması için departments boş döner. Yazma için ayrıca yetkili seçenek sözleşmesi gerekecek.

Gerçek geçici PostgreSQL'de 105 sentetik kayıt testi: ilk 50 kayıt kapsam dışı; kalan 55 kayıt eksiksiz 50+5 sayfada döner. Eksik konum, açık ret, aynı kişi bağlantısı ve bağlantıyı kesme, aktif istisna ve iptal, hak geri alma kontrol edildi. Gerçek yanıt uygulama HrDirectory parser'ından geçti. 4 yeni kontrol grubu + mevcut dizin 6 + erişim yönetimi 7 grup geçti (17 toplam). Kanıt scoped-directory-schema.mjs / scoped-directory-schema-result.json. Geçici DB'ler kaldırıldı; git diff --check temiz. Bu SQL-only paket için yeni tarayıcı/build veya genel frontend test sonucu iddia edilmez; önceki 838 testi yeniden çalıştırmış sayılmaz.

Önemli geçiş sınırı: bu fonksiyonun authenticated/service_role EXECUTE izni BİLİNÇLİ KAPALI. Eski hr_directory_v1 ve yazarlar değiştirilmedi; yeni okuyucuyu alternatif açık endpoint olarak sunmak özel rol kısıtını güvenceye almaz. Mevcut hazırlık ekranının “gerçek erişim değişmez” ifadesi doğru kalır. Yeni fonksiyon sadece privileged disposable kabulünde gerçek JWT/tenant doğrulamasıyla çağrıldı; gerçek kullanıcıya özel rol/erişim verilmedi.

Sıradaki bağlayıcı paket: eski okuyucuya erişimi kapatacak koordineli geçiş; oluşturma ve iş yeri yazıcılarında yeni kapsamın aynı transaction içinde denetimi; kapsamlı kullanıcı için departman seçenekleri; İK ekranı eylem görünürlüğü ve şirket erişim modu. Bunlar birlikte kabul edilmeden özel rol enforcement ve HR aktivasyonu açılmayacak. Süreli istisna UI'sı da hâlâ açık iştir. Üretime migration/deploy yok.


## 19 Ekim — kapsamlı çalışan oluşturma ve atomik iş yeri ataması (yerel aday)

20261019001100_hr_scoped_employee_create.sql: yeni özel rol yazıcısı, kişinin adı/kodu/istihdam başlangıcı ile departman ve şirketin kendi iş yerini tek transaction içinde oluşturur. Doğrulanmış actor/tenant, config→profile→tenant→üyelik kilidi, read committed ve 5 saniye kilit sınırı; şirket erişim revizyonu; işlem türüne bağlı idempotent komut makbuzu. Client accountId gönderemez, yeni çalışan kendisi kapsamına otomatik bağlanmaz. hr.employees.create ve aynı kayda read şartı, açık ret ve modül hakkı her çağrıda (tekrar dahil) denetlenir. Eski rol fallback yoktur.

Gelecek başlangıç tarihli çalışan, bugün departman/iş yeri ataması aktif olmadığından, mevcut boş kapsamı da okuyabilen kullanıcı tarafından oluşturulabilir. Böylece kapsamlı oluşturucunun kaydettiği kişinin listeden kaybolması engellenir. Kapsam dışı/eksik iş yeri reddedilir; varlık doğrulaması yetkiden sonra yapılır. Geçersiz tarih, bulunmayan organizasyon, mükerrer kod veya eski revizyon hiçbir yarım kişi/dönem/atama/komut bırakmaz. Bölüm/iş yeri oluşturma veya hesap bağlama yetkisi bu API'ye eklenmedi.

Gerçek disposable PostgreSQL: yeni 5 grup + scoped directory 4 + access 7 = 16 grup geçti. İki eşzamanlı bağlantı aynı komutta tek çalışan ve aynı makbuzu aldı. Yazılan kayıt gerçek kapsamlı okuyucudan ve TS parser'dan geçti. Güncel JSON kanıtları qa/hr-catalog-20261018 altında. Geçici DB'ler temizlendi. UI değişmedi; bu tur tarayıcı, build veya genel uygulama suite çalıştırılmış sayılmaz.

SINIR: yeni yazıcının PUBLIC/anon/authenticated/service_role EXECUTE izni yoktur; koordineli geçiş için adaydır. Eski okuyucu/yazıcılar henüz değiştirilmedi. Hazırlık ekranı gerçek erişimin değişmediğini doğru biçimde göstermeye devam eder. Tam enforcement/HR-1 tamamlanmadı, HR aktivasyonu açılmadı, üretime migration/deploy yapılmadı.

Kalan bağlayıcı paket: açık şirket erişim modu ve yönetici modeli, kapsamlı yazma seçenekleri, mevcut iş yeri değiştirme yetkisi, bütün eski HR uçlarının aynı anda kapatılması/yönlendirilmesi, UI eylem görünürlüğü ve uçtan uca kabul. Departman/iş yeri yönetim yeteneği ayrıca tanımlanmadan employee create yetkisine organizasyon yönetimi eklenmeyecek.


## 19 Ekim — yetkili çalışan formu seçenekleri ve istemci sözleşmesi (yerel aday)

20261019001200_hr_create_options.sql: hr_scoped_create_options_v1 yalnız birlikte izinli departman–şirket iş yeri eşleşmelerini döndürür. Bağımsız iki listenin çarpımından yetkisiz eşleşme üretilmez. Şirket, kendisi, seçili kapsam, read+create ön koşulu, açık ret, aktif istisna ve HR modül hakkı SQL'de uygulanır. Yeni çalışan hesap bağı taşımadığı için self-only rol seçenek alamaz. Kapanmış organizasyon birimleri dahil edilmez. Politika bir kez materialize edilir; kapsam filtresi 51 kayıt sondasından önce, çıktı 50, UUID çiftiyle keyset sayfalama. Null seçenek ancak gerçek karar izin veriyorsa döner. canCreateFuture mevcut boş kapsamı okuma yetkisini açıkça taşır; bu flag tek başına oluşturma yetkisi değildir. Yazar tüm kontrolleri kayıtta tekrar yapar.

src/lib/services/hr-scoped-create.ts: kapsam/revizyon/isim–kimlik uyumu/sıralama/sayfa bütünlüğünü doğrulayan parser; değişen revizyon, aktör, şirket veya gelecek tarih yetkisiyle sayfaları birleştirmeyi reddetme; immutable oluşturma komutu; kesin makbuz doğrulaması. Henüz RPC istemci bağlaması veya UI entegrasyonu yoktur. Seçeneklerin eskiyebilmesi (örneğin istisna süresi) nedeniyle bu sözleşme güvenlik kontrolünün yerini almaz; transaction içindeki yazıcı yetkilidir.

Doğrulama: 841/841 uygulama testi; yeni gerçek PostgreSQL 4 seçenek grubu + mevcut scoped create 5 + scoped directory 4 = 13 DB grubu geçti. 56 izinli eşleşme 50+6 sayfada; gerçek SQL yanıtı TS parser ve merge fonksiyonundan geçti; ilk eşleşme gerçek yazıcıda kaydedildi. Açık ret, self-only, read-only, boş şirket kapsamı, hatalı cursor ve entitlement kaldırma doğrulandı. qa/hr-catalog-20261018/create-options-schema-result.json kanıttır. Geçici DB'ler kaldırıldı. Büyük departman×iş yeri kardinalitesi için performans kabulü henüz yapılmadı; 56 seçenek kabulü üretim ölçeği benchmark'ı değildir.

SINIR: yeni fonksiyon istemci EXECUTE yetkisine kapalı adaydır. Hazırlık ekranı ve canlı yetkiler değişmedi; üretim migration/deploy yok. UI değişmediği için yeni tarayıcı/build kabulü iddia edilmez. Koordineli enforcement geçişi halen açık: şirket erişim modu ve yönetici modeli, iş yeri güncelleme yetkisi, eski HR endpointlerinin birlikte yönlendirilmesi/kapatılması, form/listenin yeni sözleşmeye bağlanması ve uçtan uca kabul. HR aktivasyonu açılmadı. Yeni modül eklenmedi.


## 19 Ekim — yetkili ve atomik güncel iş yeri değişikliği (yerel aday)

20261019001300_hr_scoped_location_transfer.sql / hr_scoped_location_transfer_v1: şirketin kendi iş yerleri arasında bugünden geçerli transfer. Önceki atama dün biter, yeni atama bugün başlar; geçmiş silinmez. Aynı transaction içinde config→profile→tenant→üyelik kilidi, doğrulanmış actor/tenant, read committed, 5s kilit sınırı, beklenen şirket politika revizyonu ve kaynak atama revizyonu denetlenir. Çalışanın güncel kapsamı, kaynak iş yeri ve hedef iş yeri için hr.employees.update + read şartı ayrı ayrı aranır; açık ret ve modül hakkı dahil. İstemci çalışan/departman/hesap kimliğini veya yürürlük tarihini değiştiremez; bunlar DB ve İstanbul tarihinden belirlenir. Hesap bağlama veya organizasyon oluşturma yetkisi verilmez.

İdempotent komut makbuzu aynı işlemde kaydedilir; tekrar çağrıda da güncel kapsam yetkileri denetlenir. Aynı komutta iki bağlantı tek yeni atama ve aynı makbuzu aldı. İkinci INSERT'e sentetik hata enjekte edilince ilk UPDATE geri alındı; eski atama açık/revizyon1 kaldı. Eski revizyon, kaynak/hedef tek taraflı yetki, yalnız okuma, hedefe açık ret ve hak geri alma reddedildi. Gerçek SQL makbuzu src/lib/services/hr-scoped-transfer.ts parser'ından geçti. İstemci sözleşmesi immutable komut ve kişi/kaynak/komut/tarih eşleşmesi sağlar; RPC veya UI henüz bağlanmadı.

Sınır: bu API yalnız geçmişte başlamış, halen açık atamanın bugünden transferidir. Aynı gün açılmış atamanın düzeltmesi, ileri tarihli plan veya atama bitirme bu komutla yapılmaz; açıkça reddedilir. Bunlar destekleniyormuş gibi sunulmayacak. Eski iş yeri API'si değiştirilmedi; yeni aday PUBLIC/anon/authenticated/service_role EXECUTE yetkisine kapalı. Özel rol enforcement henüz aktif değil; canlı yetkiler değişmedi, üretime migration/deploy yok.

Doğrulama: 843/843 uygulama testi; yeni gerçek PostgreSQL 4 transfer + eski iş yeri 6 = 10 DB kontrol grubu geçti. Kanıt location-transfer-schema-result.json ve workplace-schema-result.json. Geçici DB'ler kaldırıldı. UI değişmedi; tarayıcı/build çalıştırılmış sayılmaz. Koordineli erişim modu ve yönetici modeli, eski uçların birlikte yönlendirilmesi, form/listeler ve uçtan uca kabul halen açık. Bu alt paket tamamlandı; tüm HR enforcement veya HR-1 tamamlandı değildir.


## 19 Ekim — İK erişim yollarının koordineli backend geçişi (yerel aday)

20261019001400_hr_access_cutover_routes.sql: özel company_hr_access_modes tablosu, varsayılan legacy. Tabloya client SELECT/INSERT/UPDATE/DELETE yok, mod değiştiren public API yok; hiçbir şirket için otomatik scoped aktivasyon yapılmaz. Mod yazımı config→tenant kilidini kullanır; HR yazarları config→profile→tenant kilidi sonrası modu tekrar ölçer. Actor/tenant kontrolü kilitlerden önce yapılır, read committed zorunludur. Eski iş yeri izolasyon hata sözleşmesi korunur.

Eski üç public endpoint korunarak yönlendirildi. Scoped modda hr_directory_v1 nonmanager için özel kapsamlı okuyucuyu çağırır; eski İK rolü alternatif yetki sağlamaz. hr_create_record_v1 ve hr_workplace_command_v1 nonmanager için HR_SCOPED_API_REQUIRED döndürür. Yönetici ayrı ve açık şirket yönetim yetkisiyle eski yönetim yolunu kullanır; özel rol API'sinin zaten koruduğu yönetici hesaplarına yeni bir rol bypass'ı eklenmez. Legacy uygulamalar internal isimlere taşındı ve istemci EXECUTE izinleri kaldırıldı.

Yeni oluşturma, transfer ve seçenek public fonksiyonları yalnız scoped modda çalışır; asıl implementasyonları internal/private kaldı. Yeni endpointlerde authenticated GRANT bu migration adayında vardır, ancak varsayılan legacy modda kapı kapalıdır. Kaydetme ve makbuz tekrarında gerçek scoped implementasyon yetkiyi yeniden kontrol eder. Doğrudan kapsamlı dizin halen private; tek public liste yolu eski adı üzerinden yönlenir. company_access_settings_v1 scoped modda enforcement=hr_scoped döndürür; yanlış preview_only iddiası üretmez.

Gerçek disposable PostgreSQL, authenticated rol ve geçerli workspace/üyelik sürümüyle: default legacy iki kaydı gösterir; scoped moda geçince aynı eski endpoint yalnız izinli kaydı gösterir; eski iki yazıcı reddedilir; yeni oluşturma/seçenek endpointleri çalışır; özel rol silinince İK legacy role fallback olmaz; yönetici şirket listesini yönetmeye devam eder. Privileged test modu geri alınca legacy yol geri gelir ve yeni scoped yazıcı kapanır; veri silinmez. İlk test hatası sentetik çoklu üyeliğin workspace seçim/sürüm claim'lerinin eksikliği idi, fixture gerçek sürümlerle düzeltildi; üretim doğrulaması gevşetilmedi.

4 yeni geçiş + workplace6 + directory6 + access7 + transfer4 + options4 + scoped-create5 = 36 DB kontrol grubu geçti. Önceki private aday testleri yeni internal isimleri hedefleyecek şekilde güncellendi; gerçek authenticated public route kabulü ayrı access-cutover-schema.mjs dosyasında. Kanıt access-cutover-schema-result.json ve yenilenen regresyon sonuçları. Geçici DB'ler temizlendi. SQL ağırlıklı bu turda genel uygulama suite/build/tarayıcı yeniden çalıştırılmış sayılmaz.

AKTİVASYON SINIRI: backend routing yerelde tamamlandı, fakat şirketlerde scoped modu açmaya hazır ürün değil. Mevcut İK UI legacy rol/form sözleşmesini kullanır; erişim ayarları parser'ı preview_only beklediğinden enforced yanıtı başarı gibi göstermez. Bu nedenle gerçek şirket modu açılmadı ve açılmayacak: UI erişim bağlamı/eylem görünürlüğü, yeni oluşturma formu, yönetim ekranının aktif HR/henüz aktif olmayan finans ayrımı, transfer arayüzü ve gerçek tarayıcı kabulü sonraki zorunlu bloktur. HR readiness/aktivasyon kapısı değişmedi. Mod açma UI/komutu/audit ve bitiş kabulü de tamamlanmadan production aktivasyon yapılmaz. Migration/deploy üretime uygulanmadı.


## 19 Ekim — İK erişim bağlamı ve kapsamlı çalışan oluşturma ekranı (yerel)

20261019001500_hr_screen_context.sql: doğrulanmış actor/tenant, açık+hak verilmiş HR, şirket modu ve yönetici ayrımından writeMode döndürür. Legacy mod eski yönetici/İK şartını korur; scoped modda nonmanager için gerçek özel politika şarttır. /insan-kaynaklari artık yalnız frontend rol adına bakarak kullanıcı reddetmez; bağlamı sunucudan okur. Şirket yöneticisi legacy yönetim formunu, özel rol kullanıcısı yeni kapsamlı formu görür. Her veri/yazma endpointi kendi denetimini sürdürür; bağlam yanıtı güvenlik kararı yerine geçmez.

ScopedEmployeeForm: yetkili departman–iş yeri eşleşmesi, sayfalı seçenek yükleme, politika revizyonu uyuşmazlığı, ad/kod/tarih/pozisyon, immutable komut ve kesin makbuz. Seçenek yoksa yeni çalışan düğmesi yoktur. Gelecek tarih yetkisi olmayan kullanıcıya açıklama gösterilir; kayıt SQL'de denetlenir. Form açıkken gezinme/sekme kapanışı korunur; üst liste yenileme ve sayfalama kilitlenir. Başka actor/tenant/rol bağlamında remount olur. Form kapatılınca eski gezinme uyarısı temizlenir.

Rol ayarları parser'ı preview_only ve hr_scoped değerlerini ayrı kabul eder. Banner, kayıt onayı ve başarı metni İK aktif/finans henüz hazırlık ayrımını doğru gösterir; yönetici yönetim erişiminin korunduğu açıklanır. Diğer modüllerde özel rol enforcement varmış gibi söylenmez. Bu tur aktif rol ekranının tarayıcı kabulü yapılmadı; parser sözleşmesi test edildi.

Gerçek yerel GoTrue/PostgREST/Next tarayıcı kabulü: sentetik şirket/İK üyeliği ve özel politika; çalışan oluşturma, yetkili tek eşleşme seçimi, gerçek SQL kaydı; sayfa yenilemede kalıcılık; açık formda Görevler navigasyonunun engellenmesi; Yenile düğmesinin kilitlenmesi. Kanıt hr-scoped-screen-browser.png sentetik kayıt ve gezinme koruması aşamasındandır. Son küçük düzeltme form kapatılınca uyarının temizlenmesidir; ekran görüntüsü bu düzeltmeden önce alınmıştır. Test sekmesi/sunucusu/disposable DB kapatıldı; gerçek veriye dokunulmadı.

844/844 uygulama testi geçti; son parser/metin/koruma düzeltmesinden sonra ilgili 6 test ve TypeScript tekrar geçti. Gerçek DB geçiş testi 4 grup (yeni ekran bağlamında legacy/scoped/manager ayrımı dahil) geçti. Mobil, ağ hatası tarayıcı enjeksiyonu ve transfer UI testi bu tur yapılmadı.

Sınır: ekran hâlâ BPS_HR_PREVIEW_ENABLED sunucu bayrağı arkasındadır. Hiçbir gerçek şirketin scoped modu açılmadı; HR readiness değişmedi; production migration/deploy yok. Kalan zorunlu parçalar: transfer için güncel atama/izinli hedef okuyucusu ve ekranı; aktif rol ekranının tarayıcı kabulü; mod açma ön kontrolü+audit+komutu ve bütün akışların kabulü. İK-1 bütünü tamamlandı değildir.

Son kontrol: sentetik localhost public değerleriyle production build geçti.


## 19 Ekim — Yetki kapsamlı iş yeri transfer ekranı tamamlandı (yerel)

20261019001600_hr_transfer_options.sql ve LocationTransfer.tsx: güncel atama ve yalnız yetkili hedef iş yerlerini okuyan, 50 satırlık sayfalama kullanan transfer paneli tamamlandı. Kaynak iş yeri, çalışan adı ve yürürlük tarihi kayıt öncesi onayda gösterilir. Politika/atama revizyonu veya tarih değişen sayfalar birleştirilmez. Kayıt tek uçuş ve sabit komut kimliği kullanır; sonucu doğrulanamayan işlem aynı komutla yeniden denenir. Panel açıkken gezinme korunur, liste yenileme/sayfalama kapatılır. Başarı mesajında yeni iş yeri ismi görünür.

Gerçek authenticated PostgreSQL testi: kaynak/hedef/read-only/deny ayrımı, 56 hedefin 50+6 sayfalanması ve TypeScript parser uyumu, eski revizyon reddi, atomik geri alma, eşzamanlı tekrarın tek atama oluşturması ve kesintisiz geçmiş dahil 5 kontrol grubu geçti. Sonuç dosyasındaki clientExecuteGranted bilgisi public scoped route gerçeğine göre düzeltildi; internal implementasyonlar istemcilere kapalı kalır.

845/845 uygulama testi, TypeScript ve sentetik localhost değerleriyle production build geçti. Gerçek yerel GoTrue/PostgREST/Next tarayıcı kabulünde sentetik çalışan Merkez'den Anadolu Ofisi'ne taşındı; isimli onay ve başarı görüldü. Kanıt: qa/hr-catalog-20261018/location-transfer-browser.png. Geçici test sunucusu/DB kapatıldı. Gerçek şirket verisi değiştirilmedi.

Sınırlar: transfer ekranı scoped nonmanager yolundadır; yönetici eski yönetim yolunu kullanır. Aynı gün açılmış veya bitiş tarihli atamalar ve ileri tarih transferleri bu akışta desteklenmez. Satır düğmesi uygunluğu panel açıldığında doğrular; satır bazında gizleme ve listede iş yeri kolonu henüz yoktur. Mobil ve ağ hatası tarayıcı enjeksiyonu yapılmadı. HR preview/readiness kapıları korunur; gerçek şirket scoped aktivasyonu ve üretim migration/deploy yapılmadı.

Sonraki zorunlu paket: aktif rol ekranının tarayıcı kabulü; şirket bazlı kapsamlı yetki aktivasyonu için ön kontrol, etki özeti, audit ve atomik komut; mobil ve uçtan uca kapanış kabulü. Bu transfer paketi tamamlandı; İK-1 bütünü tamamlandı değildir.


## 19 Ekim — Şirket bazlı özel İK yetki aktivasyonu (yerel paket)

20261019001700_hr_access_activation.sql: yöneticiye özel ön kontrol ve tek yönlü legacy→scoped aktivasyon komutu eklendi. Ön kontrol mevcut üyelikleri, kalıcı çalışan okuma kuralı/rol ataması eksiğini, HR modül+hakkını ve ayrı teknik kabul kapısını döndürür. 1000 üyeden fazlasında listeyi sessiz kesmek yerine hata verir. Üyelik kimliği/sürümü, rol, politika revizyonu, şirket modu ve kapı durumu birlikte ön kontrol belirtecine dahil edilir; belirteç yetkilendirme yerine geçmez. Her çağrıda actor/tenant/yönetici kontrolü yapılır.

Komut read committed ve config→profile→tenant→üyelik kilit sırasıyla ön kontrolü tekrar yapar. Eski kontrol reddedilir. Aynı komut+belirteç tekrarı aynı makbuzu döndürür; farklı belirteçle komut kimliği yeniden kullanılamaz. Mod değişikliği ve ön kontrol anlık görüntüsünü içeren özel işlem kaydı tek transaction içindedir. İşlem kaydı hata verirse mod değişikliği de geri alınır. Teknik kabul tablosuna istemci okuma/yazma verilmedi; hiçbir şirket için onay satırı migration ile oluşturulmaz. UI üzerinden legacy'ye geri dönüş yoktur; geniş erişimi sessizce geri açan bir seçenek eklenmedi.

Roller ve erişim → İK geçişi: kişi bazında etki açıklaması, eksik rol uyarısı, teknik kabul/modül kapısı, yenilenebilir ön kontrol, sabit komutlu isimli şirket geçiş onayı ve tekrar deneme eklendi. Onay açıkken diğer sekmeler/yenileme/gezinme korunur. Özel rol atanması tüm kayıtları göreceği şeklinde sunulmaz: ret, kapsam ve süreli kuralların kayda göre uygulanacağı açıklanır. Kontrol, kayıt bazında tam izin karşılaştırması değildir. Etki listesi tüm şirket üyelerini kapsar; eksik kalıcı rol kuralı engeli mevcut İK kullanıcıları içindir, yöneticiler açık yönetim yetkisini korur.

Doğrulama: 847/847 uygulama testi; son parser sıkılaştırması sonrası ilgili 2 test tekrar geçti. Gerçek PostgreSQL aktivasyon 4 grup ve mevcut cutover regresyonu 4 grup geçti. Aktivasyon grubunda yetkisiz/cross-tenant çağrı, kapalı kabul kapısı, eksik rol, politika/üyelik/hak/kapı değişiminde eski belirteç reddi, audit hata enjeksiyonu, eşzamanlı aynı komut, tek makbuz ve eski yazıcı bypass reddi var. TypeScript ve sentetik localhost ayarlarıyla production build geçti.

Gerçek yerel GoTrue/PostgREST/Next tarayıcı kabulü: teknik kabul yokken engel; yalnız disposable DB'de kabul verilince eksik İK rolü engeli; sentetik rol atandıktan sonra onay; başarılı geçiş ve aktif İK/henüz aktif olmayan finans banner'ı görüldü. Kanıt qa/hr-catalog-20261018/access-activation-browser.png. Test sunucusu/DB kapatıldı; üretim verisine dokunulmadı.

Sınır: HR readiness ve server preview bayrakları korunur; teknik kabul kapısı varsayılan kapalıdır. Hiçbir gerçek şirkette aktivasyon, production migration veya deploy yapılmadı. Bu tur mobil, tarayıcı ağ hata enjeksiyonu ve tam kayıt bazlı erişim karşılaştırması yapılmadı. Sonraki kapanış paketi: mobil/klavye ve yetki değişimi sırasında açık form kabulü; sınırlı HR ekran kapsamının ürün kabulü; güncel şema ve migration sırasıyla yayın hazırlığı. HR-1 çalışan düzenleme, ileri tarihli atama, yeniden işe alma ve özel evrak/Excel işleri ayrıca açık; izin/satın alma onay zinciri bu erişim rolünden ayrı planlanır.


## 19 Ekim — Mobil İK listesi ve açık formda yetki değişimi

Mobil Çalışanlar listesi 768 piksel altında kartlara ayrıldı; masaüstü tablosu korundu. Ad/kod/işe giriş/ayrılış/departman/pozisyon ve transfer eylemi kartta yer alır. Form düğmeleri satıra sığmadığında alta geçer, kapsam seçicilerinin genişliği sınırlandı.

hr-write-failure.ts: yalnız açıkça tanınan PostgreSQL P0001 rollback yanıtları kesin ret sayılır. Ağ hatası, bozuk makbuz ve bilinmeyen yanıt belirsiz kalır. Daha önce belirsiz sonuç alınmışsa sonraki ret ilk isteğin kaydedilmediğini kanıtlamaz; aynı komut kimliği korunur. ScopedEmployeeForm kesin rette ad/kod/tarih/pozisyonu silmeden güncel seçenekleri getirir; artık yetkili olmayan eşleşmeyi kaldırır, yazma yetkisi yoksa Kaydet kapalı kalır. Yeniden denetleme açık taslak üzerinde mümkündür. LocationTransfer kesin rette güncel atama/izinli hedefleri yeniden getirir; belirsiz sonucu yeni komuta çevirmez.

Yerel 390×844 tarayıcı kabulü: form açıkken politika revizyonu değiştirildi; eski kayıt reddedildi, alanlar korundu, yeniden kontrol sonrası tam bir kayıt oluşturuldu. İkinci taslakta oluşturma yetkisi kaldırıldı; kayıt reddedildi, seçenek yenileme boş döndü ve Kaydet kapalı kaldı. SQL sayımı QA-MOBILE=1; QA-DENIED yok. Mobil DOM viewport=390/scrollWidth=390; yatay taşma yok. Kanıtlar mobile-draft-recovery.png ve mobile-revoked-draft.png. Yerel test sunucusu/DB kapatıldı; geçici viewport sıfırlandı.

849/849 uygulama testi geçti; bunlara kesin ret/belirsizlik ve belirsiz ilk istek sonrası yetki reddinde aynı komutu koruma testleri dahildir. Son metin ve boş seçenek yenileme düzenlemesi tarayıcıda doğrulandı. Bu tur yeni migration yok. Transferin yeni kesin ret arayüzü ayrı tarayıcı senaryosuyla test edilmedi; ortak sınıflandırıcı test edildi. Mobil test gerçek telefon/Safari veya tüm ekranlar için kabul değildir. Gerçek ağ kesilmesi/yanıt kaybı tarayıcı enjeksiyonu, tam klavye kabulü ve üretim şema ölçümü yapılmadı.

Yayın kapıları: canlı sürüm/ledger yeniden ölçülmeli; seçilen adayın tüm bekleyen migration'ları canlı şema üzerine sıralı prova edilmeli; HR teknik kabul ve preview/readiness kapıları açıkça değerlendirilmeden hiçbir şirket modu açılmamalı. Eski yayın hazırlığı belgelerindeki sayılar güncel canlı ölçüm yerine kullanılmaz. Üretim deploy/şirket aktivasyonu yapılmadı. Sonraki blok gerçek belirsiz yanıt/kurtarma kabulü ve transfer/aktivasyon ekranlarının mobil-klavye kapanışıdır; bütün HR-1 tamamlanmış değildir.

Son kontrol: sentetik localhost public değerleriyle production build ve TypeScript geçti.


## 19 Ekim — Yanıt kaybı, mobil transfer ve aktivasyon kabulü tamamlandı

Yerel authenticated-browser.mjs test proxy'sine BPS_HR_DROP_RESPONSE_ONCE=1 eklendi. Yalnız açıkça seçilen üç HR RPC'sinin ilk başarılı upstream yanıtını tüketip sentetik 502 döndürür; kayıt gerçek PostgreSQL'de tamamlanmıştır. Sonraki istek gerçek makbuzu alır. Flag olmadan davranış değişmez; üretim kodu/SQL değişmedi. İlk denemede socket kesintisi tarayıcı tarafından otomatik tekrarlandığı için görünür belirsizlik kabulü sayılmadı; ölçülen son senaryo commit sonrası 502'dir.

Gerçek yerel oturum/tarayıcı ile üç akış: çalışan oluşturma, iş yeri transferi, şirket özel İK aktivasyonu. Oluşturmada ilk başarı yanıtı kayboldu; ekleme yetkisi kaldırılıp tekrar denendiğinde form yeni komuta açılmadı. Yetki geri gelince aynı komutun makbuzu alındı. Transfer ve aktivasyonda da ilk başarı yanıtı kayboldu, aynı işlemle tekrar tamamlandı. Kesin SQL sonuçları: 1 çalışan, 2 atama (1 açık), 1 aktivasyon makbuzu. Kanıt lost-response-browser-result.json, mobile-transfer-uncertain.png, mobile-activation-recovered.png.

Transfer ve aktivasyon ekranlarında 390×844 viewport/390 scrollWidth; yatay taşma yok. Onay ve tekrar düğmeleri Enter ile çalıştırıldı. Bu tam klavye/screen-reader veya gerçek iOS kabulü değildir. Testte aynı sentetik hesap önce İK sonra yönetici fixture'ına geçirildi; stale üyelik oturumu doğrulama ekranına düştü. Yönetici senaryosu için yalnız disposable fixture üyelik sürümü Auth fixture ile eşlendi; bu adım gerçek rol değişimi/yeniden giriş kabulü sayılmaz. Teknik release onayı da yalnız disposable DB'de verildi. Üretim şirket modu veya verisi değiştirilmedi.

İlgili 7 sözleşme testi geçti; uygulama kodu değişmediğinden önceki 849 test/production build tekrar koşulmadı, bu turun sonucu olarak yeniden sunulmaz. Test sekmeleri/sunucuları/DB'leri kapatıldı ve viewport sıfırlandı.

Kapanan işler: commit sonrası belirsiz yanıtın gerçek tarayıcı kabulü; mobil transfer/aktivasyon onay-tekrar kullanım kontrolü. Sonraki yayın hazırlığı: canlı sürüm ve migration ledger'ının güncel salt okunur ölçümü, seçilen yayın adayının sıralı migration provası ve bağımlılık sırası, sonra kapsamı belli yayın/smoke. Ürün sınırı: HR readiness ve teknik release kapıları halen kapalı; mevcut sınırlı İK ekranları tüm HR-1 değildir. Tam klavye/erişilebilirlik turu ve transferde kesin ret sonrası hedef yenileme tarayıcı kabulü ayrıca açık. Bu paket yayına alınmadı.


## 19 Ekim — İK yayın adayı sıralı kurulum provası

Canlı Vercel dağıtım kimliği salt okunur kontrolle dpl_CiWugmjyyW4wtyBqj7tSR5i9t1FA / READY bulundu; kayıtlı 6300bee yayınıyla eşleşiyor. Güncel production ledger ölçülmedi: aktif worktree bağlı olmadığı için migration list başarısız. Son kayıtlı 190 migration yalnız tarihsel baseline olarak kullanıldı.

qa/hr-release-20261019/rehearse.mjs, tarihsel baseline üstüne 17 bekleyen migration'ı disposable yerel DB'de sırayla uyguladı. Yinelenen/geri tarihli dosya, eksik baseline ve fixture manifest sapması kontrolleri geçti. Onaylı teknik HR kabul kaydı ve scoped şirket modu oluşmadı; otomatik Git yayını kapalı. SHA-256 aday listesi result.json, yayın sırası/eksik kapılar READINESS.md içinde. Gerçek veri değiştirilmedi; üretim yayını veya şirket aktivasyonu yapılmadı. Güncel üretim şema ölçümü ve bu şemaya göre aday doğrulaması yayın öncesi hâlâ zorunlu.


## 19 Ekim — Güncel üretim ledger ve public katalog doğrulaması

Resmi read-only Management API üzerinden güncel üretim ledger ölçüldü: 190 migration tarihsel kayıtla birebir eşleşti. Public fonksiyon hash/ACL/owner, kolon, tablo RLS/ACL ve policy metaverisi alındı; şirket içeriği veya dosyalar indirilmedi. Tarihsel fixture'daki tek fark modül değiştirme fonksiyonunun authenticated EXECUTE izniydi; yalnız disposable DB'de canlıdaki grant eşlendi. Son karşılaştırma eşleşti ve 17 aday migration bu tabanda tekrar geçti. Beklenmedik katalog farkı artık provayı durduruyor.

Kanıtlar qa/hr-release-20261019/live-ledger.json, live-catalog.json, catalog-comparison.json ve result.json. Bu bir tam şema/veri klonu değildir: index/constraint/trigger ve public dışı katalog kapsamı, güncel bariyer, üretim kilit süreleri, uygulama geri dönüşü ve yayın sonrası smoke ayrıca açık. Üretim SQL yazımı/deploy/gerçek şirket İK aktivasyonu yapılmadı. Teknik kabul kapıları kapalı kalır.


## 19 Ekim — Genişletilmiş şema ve geri dönüş paketi

Public indeksler/valid-ready, constraint/validated ve trigger/enabled durumları üretimde salt okunur ölçüldü. İndeks/tetikleyici farkı yok; sekiz CHECK yalnız AND parantez gösteriminde farklı. Tam çiftler sabitlendi ve canlı ifadelerin yerel PostgreSQL'de aynı düz gösterime dönüştüğü disposable DB'de doğrulandı. Başka fark provayı durdurur. Geçici yayın guard şeması yok, trigger sayısı 0. 17 sıralı migration, 6 katalog senaryosu ve 3 eski parser uyumsuzluk testi geçti.

Önemli yayın sınırı: 20261019000200 catalog_upgrade geçmişi ürettiğinden eski uygulamaya koşulsuz dönüş güvenli değil. Önce 001 ve iki geçmiş sürümünü okuyan preview-kapalı uyumluluk uygulaması adayının doğrulanması, sonra kalan paket öneriliyor. Bu dağıtım henüz hazırlanmadı. SQL/audit geri silme planlanmıyor. qa/hr-release-20261019/ROLLBACK.md kalan kapıları içerir. Üretim yazımı/deploy/aktivasyon yapılmadı.


## 19 Ekim — Ayrı geçmiş uyumluluk adayı hazırlandı

Canlı 6300bee kaynak arşivinden ayrı geçici aday oluşturuldu; yalnız beş dosya değişir. Yeni İK ekranları/hak servisi alınmadı. workspace_module_history_v2 okuyucusu, sürümlü parser ve catalog_upgrade ekran karşılığı dahil. Tam patch ve dosya hashleri qa/hr-release-20261019/bridge altında; prepare.py yeniden üretir.

Adayın kendi TypeScript koduyla gerçek yerel PostgreSQL: SQL 001 sonrası 5, SQL 002 sonrası 6 grup geçti. İzole TypeScript kontrolü geçti. Ön koşul SQL 001; v2 yokken v1'e sessiz fallback yok. Aday tarayıcı kabulü ve üretim yayını yapılmadı. Yeni SQL 002+ öncesi bu uyumluluk hedefi yayımlanıp doğrulanmalı; gerçek İK aktivasyonu ayrı kalır.

Uyumluluk adayının sentetik localhost public ayarlarıyla production build kontrolü de geçti. Kaynak patch temiz 6300bee arşivine git apply --check ile doğrulandı.


## 19 Ekim — Uyumluluk adayının gerçek tarayıcı kabulü

İzole canlı-kaynak aday, resmi yerel Auth/PostgREST/Storage ve Next ile çalıştırıldı. SQL 001 sonrası katalog 1 kurulum kaydı görüldü; aynı disposable DB'ye SQL 002 uygulanıp durum yenilenince catalog_upgrade ve kurulum kayıtları birlikte görüntülendi. Geçmiş yenileme Enter ile çalıştı. Testte prepare.py başlık değiştirmesinin eski metne uymadığı bulundu; düzeltildi ve tam eşleşme assertion eklendi. Aday patch/hashler güncellendi.

Fixture'ın 29 Storage/Auth HTTP kontrolü geçti. Test sekmesi, sunucular ve disposable DB kapatıldı. Kanıt qa/hr-release-20261019/bridge/browser-result.json ve browser-catalog2.png. Dev sunucuda tarayıcı kabulüdür; production build ayrıca sınanır. Yerelde modül yazma özelliği kapalı olduğundan write-enabled canlı benzeri tarayıcı akışı, üretim kilit ölçümü ve yayın hâlâ açık. Üretim SQL/yayın/şirket aktivasyonu yapılmadı.


## 19 Ekim — Uyumluluk adayında modül yazma kabulü kapandı

Gerçek yerel oturumda yazma flag'i açıkken Finansal özet ön kontrol/onay ile kapatılıp yeniden açıldı. Menü buna göre kaybolup geri geldi. Dört geçmiş kaydı (bootstrap, katalog yükseltmesi, kapatma, açma) görüldü; SQL tam iki settings olayı ve HR=false doğruladı. 29 fixture HTTP kontrolü geçti. Geçici sunucu/DB kapatıldı. Kanıt bridge/write-browser-result.json ve browser-write-roundtrip.png.

Üretimde yalnız aggregate yük ölçümü: 19 Ekim 20:20:58 İstanbul saatinde bekleyen kilit/diğer aktif transaction 0. Üç hedef tablo toplam boyutları 48/24/32 KiB; satır tahmini -1 olduğundan satır sayısı bilinmiyor. Yayın anında tekrar ölçülmeli. Yerel okuma/yazma kabulü tamam; sıradaki operasyonel adım 001 + uyumluluk uygulaması kontrollü yayını ve canlı smoke. Bu tur production yazımı/deploy/gerçek şirket aktivasyonu yapılmadı.


## 19 Ekim — Geçmiş uyumluluk paketi CANLIDA

Yalnız 20261019000100 atomik DDL + migration ledger işlemiyle uygulandı; üretim kayıt sayısı 191. Canlı www.bpsys.net dağıtımı dpl_HqsDv6dSm8tej9yeAEsqnEG9Tjib (READY). Kaynak: 6300bee tabanı + bridge/candidate.json içindeki beş dosya; geliştirme dalının tamamı yayımlanmadı.

Üretim doğrulaması: v2 geçmiş okuyucusu authenticated erişimine açık, anon erişimine kapalı; katalog 2 şirket sayısı 0, HR ayarı sayısı 0, geçici yayın bariyeri yok. Gerçek oturumla Ayarlar > Modüller ekranı, geçmiş ilk yükleme ve yenileme geçti. Canlı şirket ayarları değiştirilmedi. Yerel kabul: 11 SQL grup, 29 Storage/Auth HTTP kontrolü, okuma/yazma tarayıcı akışı ve production build; atomik kurulum/rollback/tekrar reddi 3 test. Kanıt: qa/hr-release-20261019/bridge/release.json ve production-verification.json.

Süreç notu: İlk yayın sonrası kontrolün sonuç dosyası yanlış çalışma dizinine yazılamadı; shell promote işlemine devam etti. Kontrol doğru dizinde hemen tekrarlandı, beklenen tüm koşullar doğrulandı. Sonraki yayın komutları hata halinde kesin durmalı.

Sıradaki sınır: kalan 16 SQL (002–017) için artık 191 kayıtlı canlı şema üstünden ön kontrol/prova; yeni uygulama ve İK kapalı teknik altyapı yayını. Bu uyumluluk dağıtımı katalog yükseltmesinden sonra uygulama geri dönüş hedefidir; gerçek İK aktivasyonundan sonra tek başına yeterli değildir. İK açma, satın alma/izin onayları ve özel roller tamamlanmış veya yayımlanmış sayılmaz.


## 19 Ekim — 191 başlangıcından kalan 16 migration kabul paketi

Canlı ledger/public katalog/bariyer/yük ölçümü yenilendi. 001 canlı; kalan 002–017 sentetik DB üzerinde 191 başlangıcından geçti, beklenmeyen katalog farkı 0. remaining/ altında her biri DDL+ledger atomik, tam önceki sürüm listesine kilitli 16 kurulum dosyası üretildi. Her adımda hata enjeksiyonu/rollback, yeniden başarılı kurulum, başarılı işlemin tekrar reddi geçti (16 grup). İK/erişim tablolarının tümünde RLS açık; teknik onay ve scoped aktivasyon kapalı.

Statik kontrol dinamik RLS döngülerini tanımadığı için 005/007/008 henüz uygulanmamış migration'larda RLS ifadeleri açık tablo adlarıyla yazıldı. Yeni hashlerle tüm provayı tekrar geçirdik. 849 uygulama testi geçti, statik kontrol 0 hata (commit öncesi migration değişikliği uyarısı), TypeScript geçti. İlk build ortam değişkeni eksikliğiyle durdu; sentetik Supabase URL/anahtarı ve HR preview kapalı yapılandırmayla production build geçti. Bu build gerçek üretim ortamı kabulü değildir.

Üretim bu tur değişmedi: 191 migration ve uyumluluk uygulaması. Kalan yayın kapısı: yeni uygulamanın gerçek production ortamında alan adına bağlanmadan derlenmesi; ardından güncel ön kontrol ve kontrollü 002–017 kurulumu, uygulama geçişi, canlı smoke. Şirket İK aktivasyonu ayrı kalır. Kanıt qa/hr-release-20261019/remaining/test-result.json ve package-checks.json.


## 19 Ekim — İK/modül altyapısı büyük paketi CANLIDA

Kalan 20261019000200–01700 16 migration sırayla uygulandı. Her adımın DDL ve ledger kaydı aynı transaction içinde tamamlandı; ardından tam sürüm dizisi doğrulandı. Üretim artık 207 migration. Kaynak f02edb04433daa85ccb69b64b740c1c1ccc7bce6, Vercel dpl_3pr5omHWjqsUAAVaL7sLksb7P8GU, www.bpsys.net READY. Üretim ortamındaki temiz remote build başarılı.

Üretimde katalog 2 geçişi tamamlandı. Onaylı İK teknik kapısı 0, scoped şirket 0, etkin İK modülü 0; İK/özel erişim tablolarının tümünde RLS açık. BPS_HR_PREVIEW_ENABLED=false. Mevcut modül aç/kapa üretim flag'i değiştirilmedi. Kullanım hakkı altyapısı ödeme entegrasyonu değildir.

Gerçek oturumla salt okunur smoke: Modüller kullanım hakkı etiketleri, İnsan Kaynakları Hazırlanıyor durumu, katalog yükseltmesi + eski kurulum geçmişi; platform yöneticisi olmayan hesapta haklar alanı ret; günlük operasyon yükleme; kapalı İK rotası 404 geçti. Gerçek iş kaydı veya İK aktivasyonu yapılmadı. Kanıt qa/hr-release-20261019/remaining/release.json, production-install.json ve production-verification.json.

Sıradaki ürün paketi: İK-1 çalışan düzenleme/istihdam yaşam döngüsü, özel evrak ve Excel kabulü; yetki kapsamlarıyla uçtan uca doğrulama. İzin/satın alma yönetici onayları ayrıca tamamlanacak. Gerçek şirket İK aktivasyonu bu kabulden ayrı. Önceki 191 canlı / 16 bekliyor ifadeleri tarihsel kaldı. Geri dönüş için uyumluluk dağıtımı saklanıyor; SQL/audit silerek geri alınmaz.


## 19 Ekim — İK çalışan temel bilgisi düzenleme paketi (yerel)

Çalışan listesinde masaüstü/mobil Düzenle eylemi ve ad/personel kodu formu eklendi. Yeni 20261019001800 migration; context ve edit RPC'leri mevcut legacy/scoped yetki modelini izler. Scoped kullanıcıda hem okuma hem güncelleme yetkisi gerekir; her denemede ve makbuz tekrarında güncel erişim kontrol edilir. Çalışan/kişi/politika sürümleri ve mod değişikliği eski formu reddeder. Şirket kilidi, tek komut kimliği ve hr_commands geçmişi birlikte çalışır; audit hatasında veri geri alınır. Havuz bağlantılı ad salt okunur, personel kodu düzenlenebilir.

UI yazılanları kesin ret sonrası korur ve güncel kayıtla karşılaştırır; belirsiz sonuçta aynı komutu tekrarlar. Bu paket işe giriş/çıkış tarihi, departman değişikliği veya yeniden işe alma düzenlemesi değildir. Yeni ekran gerçek yerel tarayıcıda henüz kabul edilmedi; yayına hazır tamamlanmış ürün olarak değerlendirilmez.

Doğrulama: 6 PostgreSQL kabul grubu (idempotency/eski sürüm/mükerrer kod/audit rollback/scoped yetki/bağlı ad/kapalı modül kontrolleri), 4 gerçek kaynak istemci sözleşmesi grubu; 849 mevcut uygulama testi, TypeScript, statik kontrol (0 hata, commit öncesi migration uyarısı) ve sentetik ortam production build geçti. Kanıt qa/hr-catalog-20261018/employee-edit-*-result.json. Canlı hâlâ 207 migration; 018 uygulanmadı, İK kapalı. Sonraki adım: tarayıcıda form kaydetme/ret/yenileme ve mobil kabul, ardından istihdam yaşam döngüsü paketi.


## 19 Ekim — Çalışan düzenleme tarayıcı ve mobil kabulü tamamlandı

Gerçek yerel Next + resmi Auth/PostgREST/Storage fixture'ında sentetik çalışan düzenlendi. İlk başarılı DB yanıtı proxy tarafından kaybedildi; UI alanları kilitledi ve aynı işlemi tekrar etti. SQL yalnız bir edit makbuzu ve revision=2 doğruladı. Sonra başka değişiklik simüle edildi; eski form HR_EDIT_STALE ile reddedildi. MY-DRAFT taslağı korundu, yenileme OTHER-CHANGE güncel kodunu gösterdi. Mobil 390x844 görünümde taslak yeniden kaydedildi; scrollWidth=390, taşma yok. Son SQL revision=4, iki edit makbuzu; aradaki bir revizyon sentetik eşzamanlı değişikliktir.

Test proxy'sinin yanıt kaybı listesine hr_employee_edit_v1 eklendi. Fixture 29 HTTP kontrolünü geçti, SIGTERM ile geçici DB/Auth/Storage/Next kapandı. Tarayıcı boyutu sıfırlandı ve test sekmesi kapandı. Kanıt employee-edit-browser-result.json ve employee-edit-mobile.png. Üretim değişmedi: 207 migration; çalışan düzenleme 018 hâlâ yerel/GitHub. Sonraki paket istihdam dönemini kapatma/yeniden işe alma ve bağlı görevlendirmeleri koruma akışıdır.


## 19 Ekim — İstihdam yaşam döngüsü altyapısı (yerel, ekran bekliyor)

20261019001900 migration ile yöneticiye özel ayrılış ön kontrolü ve ayrılış/yeniden işe alma komutları eklendi. Ön kontrol token'ı dönem, departman/işyeri atamaları, bağlı çalışanlar ve hesap bağlantısı değiştiğinde eski işlemi reddeder. Ayrılış çocuk atamaları ve dönemi aynı transaction içinde kapatır; aktif hesap bağlantısı, devam eden bağlı çalışanlar veya seçilen tarihten sonra başlayan atamalar varsa engellenir. Yeniden işe alma aynı çalışan için yeni ve çakışmayan dönem açar; eski atama veya hesap erişimi kopyalanmaz. Komut makbuzu ve geçmiş birlikte yazılır; aynı komut tekrarında ikinci işlem oluşmaz. Özel İK rollerine yeni yetki verilmedi; yönetici dışı erişim reddedilir.

Gerçek geçici PostgreSQL üzerinde 6 kabul grubu geçti: tarih sınırları, audit hatasında tam rollback, atamaları birlikte kapatma, tekrar/eski token, geçmişi koruyan yeniden işe alma, aktif hesap/bağlı çalışan/gelecek atama engelleri ve yetki izolasyonu. Gerçek TypeScript kaynak üzerinde 3 istemci sözleşmesi grubu geçti. TypeScript ve diff kontrolü geçti; statik kontrol 0 hata, commit öncesi yeni migration uyarısı. Kanıt: qa/hr-catalog-20261018/employment-lifecycle-{schema,client}-result.json. Sentetik DB test sonunda kaldırıldı; gerçek şirket verisi kullanılmadı.

Bu paket henüz yönetici ekranına bağlanmadı; tarayıcı kabulü yapılmadı. Sıradaki iş: etki özeti ve engelleri gösteren ayrılış/yeniden işe alma formu, belirsiz sonuçta aynı komutu yeniden deneme, eski ön kontrolde taslağı koruma ve mobil kabul. 018 ve 019 üretime uygulanmadı. Son doğrulanmış canlı durum 207 migration, İK kapalı; bu tur üretime istek/yayın yapılmadı.


## 19 Ekim — İstihdam yönetici ekranı ve tarayıcı kabulü tamamlandı (yerel)

Çalışan listesinin masaüstü ve mobil satırlarına yalnız yöneticide Ayrılış kaydet / Yeniden işe al eylemleri eklendi. Yeni EmploymentChange formu güncel dönemi, seçilen tarihin etkilediği departman/işyeri görev sayılarını ve hesap/bağlı çalışan/gelecek atama engellerini gösterir. Tarih veya güncel kayıt değiştiğinde onay sıfırlanır. İşlem belirsizse alanlar ve kapatma kilitlenir; aynı komut tekrarlanır. Kesin eski-kayıt reddinde tarih korunarak ön kontrol yenilenir. Diğer formlar ve sayfalama işlem açıkken kilitli. Yeniden işe alma eski görevlendirmeleri veya hesap erişimini kopyalamaz.

Yerel resmi Auth/PostgREST/Storage + Next üzerinde sentetik kabul: ilk başarılı ayrılış cevabı kaybettirildi, aynı işlem tekrarında SQL yalnız 1 makbuz doğruladı. Yeniden işe alma ön kontrolünden sonra tarih başka işlemle değiştirildi; eski token reddedildi, 2026-07-01 taslağı korundu ve onay sıfırlandı. Mobil yeniden işe alma başarılı: 2 dönem, 2 komut makbuzu; 390x844 ekran, scrollWidth=390. İki doğrudan sentetik tarih güncellemesi yalnız eşzamanlılık testi içindir. Test sekmesi, viewport ve geçici servis/DB temizlendi. Kanıt employment-browser-result.json ve employment-mobile-result.png.

5 gerçek kaynak istemci test grubu, 849 uygulama testi, TypeScript, statik kontrol (0 hata/0 uyarı), diff ve sentetik ortam production build geçti. Önceki 019 veritabanı kabulü 6 gruptur; bu tur SQL değişmedi. GitHub yedeği otomatik yayın kapalı geliştirme dalında tutulur. 018/019 ve yeni ekranlar henüz üretime yayımlanmadı; son doğrulanmış canlı 207 migration ve İK kapalı. Sonraki onaylı ürün işleri: İK özel evrak ve Excel kabulü; gerçek şirket aktivasyonu/yayın ayrı kontrol kapısında kalır.


## 19 Ekim — İK Excel ön kontrolü (yerel; toplu kayıt henüz yok)

İK planındaki H3 için mevcut sınırlı XLSX/CSV worker yeniden kullanıldı. Yönetici çalışan ekranında dosya/sayfa ve personel kodu-ad-işe giriş sütunlarını seçebilir. İlk dolu satır başlık; 10 MB dosya ve 200 veri satırı ön kontrol sınırı. Formül/hata hücreleri, kimlik benzeri numara, tekrarlanan kod, belirsiz/geçersiz tarih ve gizli sayfa reddedilir. Boş hücre mevcut bilgiyi silmez. Yalnız açık Türkçe veya ISO tarihler normalize edilir.

20261019002000 hr_import_preview_v1 salt okunur, şirket ve yönetici yetkili, en fazla 200 satırlık kod karşılaştırmasıdır. Yeni/değişmeyen/adı değişen/eksik/elle inceleme ayrımı yapar. Ayrılmış çalışan, farklı işe giriş tarihi veya bağlı havuz ad değişikliği otomatik güncellenmez. Komut/çalışan/istihdam yazmaz. Yetki tanımı genişletilmedi; scoped İK import ve gerçek toplu yazma ayrıca tasarlanacak. UI açıkça ön kontrol olduğunu belirtir; aktarım tamamlandı mesajı veya sahte kaydet düğmesi yok.

Doğrulama: geçici PostgreSQL'de 4 kabul grubu, gerçek TypeScript kaynakta 5 istemci grubu, TypeScript ve sentetik production build geçti. Statik 0 hata/1 yeni migration uyarısı; diff temiz. Bu turun ekranı tarayıcıda henüz test edilmedi. Kanıt hr-import-schema-result.json ve hr-import-client-result.json. Üretim değişmedi; son doğrulanmış 207 migration, İK kapalı; 018–020 bekliyor.

Kalan: Excel ön kontrol tarayıcı/mobil kabulü; açık satır kararı + revizyonlu/idempotent toplu kayıt ve kaynak satır kimliği; ayrı İK özel belge erişimi ve upload yaşam döngüsü. Özel evrak bu tur uygulanmadı. Önceki ürün hedefi tamamlanmış sayılmaz.


## 19 Ekim — İK onaylı Excel toplu kayıt (yerel; tarayıcı kabulü bekliyor)

021 migration, salt okunur ön kontrolün üzerine veri+karşılaştırma token'ı ve yönetici toplu komutu ekler. Kullanıcı yeni/adı değişen satırları açıkça seçer; eski/yeni ad ve yeni işe giriş gösterilir. Aynı/değerlendirilecek/eksik satırlar yazılamaz. Dosya SHA-256 ve kaynak satırlar komut makbuzunda tutulur. Yeni kayıt kişi+çalışan+ilk dönem oluşturur; ad güncellemesi kodu, istihdamı veya bağlı aday adını değiştirmez. Tüm seçili satırlar tek transaction; stale karşılaştırma veya audit hatası bütün paketi geri alır. Aynı komut aynı makbuzu verir; yeniden karşılaştırılan mevcut çalışan tekrar oluşturulamaz. Bu işlem aday eşleştirme veya yeniden işe alma değildir.

UI belirsiz sonuçta kaynak/sütun/karar değişimini ve form kapatmayı engeller, aynı komutu tekrarlar. Kesin ret sonrası yeniden karşılaştırma ve seçim gerekir. Tamamlanınca listeyi yenileme yönlendirmesi görünür. Scoped İK rolüne yeni toplu yetki verilmedi; yönetici kontrolü sürer.

5 geçici PostgreSQL commit kabul grubu, 2 commit istemci grubu ve önceki 5 import istemci grubu geçti; 849 mevcut uygulama testi geçti. TypeScript, statik (0 hata; yeni migration uyarısı) ve sentetik build kontrolü yapıldı. Ekran uçtan uca gerçek dosya/tarayıcı kabulü HENÜZ yapılmadı; bu paket tamamlanmış üretim özelliği sayılmaz. Sonraki: dosya yükleme→eşleme→ön kontrol→seçim→kayıt, stale/yanıt kaybı ve mobil kabul; ardından özel İK evrakları. Üretim değişmedi, son doğrulanmış 207 migration; 018–021 bekliyor. İK kapalı.


## 19 Ekim — İK Excel aktarımı gerçek yerel tarayıcı kabulü

Resmi Auth/PostgREST/Storage ve yerel Next üzerinde sentetik CSV dosyası dosya seçiciden okundu; sütunlar, yeni çalışan, ad değişikliği ve eksik kayıt ayrımı doğrulandı. Ön kontrolden sonra sentetik ad değişikliği yapıldı; eski token bütün aktarımı reddetti. Yeniden karşılaştırmada güncel ad gösterildi ve seçimler sıfırlandı. İlk başarılı commit cevabı proxy'de kaybettirildi; UI kaynak/sütun/seçim/kapatmayı kilitledi. Aynı komut tekrarında sonuç doğrulandı: 1 aktarım makbuzu, 2 çalışan, 2 istihdam; eksik satır oluşturulmadı.

Aynı veriler XLSX olarak 390x844 mobil görünümde tekrar seçildi: iki satır Değişiklik yok, üçüncü Eksik bilgi; tüm seçimler ve kaydetme kapalı. scrollWidth=390. Satır metninde iki UX kusuru düzeltildi ve ekranda doğrulandı: değişmeyen ad iki kez/okla gösterilmiyor; eksik yeni ad için yanlış Ad korunacak yerine Ad soyad eksik deniyor. TypeScript, 5 import ve 2 commit istemci grubu geçti. SQL değişmedi; önceki 5 commit DB grubu ve 849 uygulama testi geçerlidir, bu tur yeniden çalıştırılmadı.

Kanıt hr-import-browser-result.json, hr-import-mobile.png ve sentetik fixtures/employees.csv/.xlsx. Test sekmesi/viewport ve geçici servisler/DB temizlendi; üretim değişmedi. 018–021 hâlâ yayın ön kontrolünü bekler. Sıradaki ana İK-1 işi özel evrak erişimi/yükleme yaşam döngüsüdür; scoped İK toplu aktarımı, aday bağlantısı ve daha geniş dosya akışları ayrıca açıktır.


## 19 Ekim — Özel İK belge erişim sınırı (yerel altyapı)

022 migration ile genel firma/aday evraklarından ayrı private HR metadata tablosu kuruldu. Belge aynı şirket/çalışan/istihdam dönemine bileşik FK ile bağlı; dosya boyutu, içerik SHA-256 ve süre tarihi alanları var. RLS açık, doğrudan tablo erişimi anon/authenticated/service_role için kapalı. İstemci yalnız yetkili ve 50 satırlık sayfalı RPC'den başlık/dönem/geçerlilik bilgisi alabilir; Storage yolu dönmez. Süre dolumu her okumada hesaplanır; süresiz belge expired=false.

Erişim: yönetici şirket erişimi; legacy İK okuma; scoped kullanıcıda hr.employees.read VE hr.documents.download aynı gerçek çalışan kapsamıyla aranır. Genel firma evrakı izni aktarılmaz. Seçili departman ve açık deny uygulanır. Yazma için henüz özel capability yok, gelecekteki iç yardımcı manager dışını reddeder; helper dışarıya çağrılamaz. Bu migration Storage bucket/policy, dosya yükleme veya indirme bağlantısı AÇMAZ.

6 geçici PostgreSQL kabul grubu: sayfalama/süre/path gizleme, legacy rol sınırları, scoped çift izin, departman ve explicit deny, doğrudan tablo/helper erişimi, tenant/kapalı modül. 3 gerçek kaynak istemci grubu ve TypeScript geçti. Statik 0 hata/1 yeni migration uyarısı; diff temiz. Kanıt hr-private-documents-result.json ve hr-private-documents-client-result.json. Üretim değişmedi; son doğrulanmış 207 migration; 018–022 yerel/GitHub bekliyor.

Kalan zorunlu paket: prepare/finalize defteri; dosya sahipliği ve gerçek içerik doğrulaması; iptal/kurtarma/temizleme; modül kapanış bağlantısı; yetkili süreli indirme; çalışan ekranı ve gerçek Storage/tarayıcı kabulü. Özel evrak ürünü tamamlandı veya kullanılabilir diye sunulmaz. Geçici SQL test verisi temizlendi; gerçek belge kullanılmadı.


## 19 Ekim — İK özel evrak yükleme defteri ve istemci sözleşmesi (yerel)

023 migration ile şirkete/çalışana/istihdama ve işlemi başlatan yöneticiye bağlı yükleme rezervasyonu eklendi. Aynı kimlik ve aynı içerik tekrarında mevcut sonuç döner; değişen içerik reddedilir, iptal edilmiş kayıt yeniden açılmaz. Bekleyenler yalnız kendi yöneticisine 50 satırlık sayfalarla döner; şirket/yönetici başına 100 bekleyen sınırı vardır. Boş rezervasyon güvenle iptal edilir; Storage nesnesi varsa kayıt pending kalır ve temizleme akışı zorunlu tutulur. Yazma komutlarında read-committed ve mevcut şirket/modül kilit sırası uygulanır.

Gerçek TypeScript hizmeti rezervasyon makbuzunun bütün alanlarını gönderilen girdiye bağlar; şirket/kullanıcı/çalışan uyuşmazlığı, geçersiz tarih/boyut/hash, mükerrer veya sırasız sayfa ve yanlış iptal yanıtı reddedilir. RPC hatası başarıya çevrilmez. Bu hizmet henüz ekrana bağlı değildir; Storage bucket/policy veya gerçek dosya yüklemesi açılmadı.

Doğrulama: 7 geçici PostgreSQL test grubu, 4 gerçek kaynak istemci grubu, TypeScript ve diff kontrolü geçti. Statik 0 hata/1 yeni migration uyarısı. Ek SQL kabulü gerçek Storage HTTP kabulü değildir: yalnız geçici DB'de sentetik nesne metadata'sı oluşturuldu; test DB'si tamamen kapatıldı, gerçek veri kullanılmadı. İlk genişletilmiş testte Storage doğrudan silme korumasına takılan fixture temizliği düzeltildi; son koşu başarılı. Kanıt hr-document-upload-result.json ve hr-document-upload-client-result.json.

Sıradaki zorunlu işler: gerçek dosya sahipliği/içerik doğrulamalı finalize, nesneli iptal ve kurtarma, pending yüklemelerin modül kapatma ön kontrolüne bağlanması, süreli yetkili indirme, çalışan ekranı ve gerçek yerel Storage/tarayıcı kabulü. Bu parça özel evrak ürününü tamamlamaz. Üretime yayın yapılmadı; son doğrulanmış canlı 207 migration/İK kapalı, 018–023 geliştirme dalında bekliyor.


## 19 Ekim — Özel İK evrak paneli ve modül kapanış engeli

Çalışan listesinin masaüstü/mobil satırlarına Evraklar eylemi ve ayrı yetkili panel bağlandı. Panel belge başlığı/geçerlilik/süre dolumunu sayfalı getirir; yönetici yalnız kendi bekleyen yüklemelerini görür. Boş yükleme iptalinde aynı kimlik korunur; belirsiz sonuçta yeni işlem ve kapatma engellenir, aynı iptal tekrarlanır. Dosya mevcut veya yayımlanmışsa ayrı anlaşılır mesaj gösterilir. Panel açıkken diğer çalışan formları ve sayfalama kilitlenir. Gerçek dosya yükleme/indirme düğmesi henüz eklenmedi.

024 migration yöneticiye şirketin bekleyen İK yükleme sayısını veren salt okunur preflight sağlar. İK modülü enabled=false veya kullanım hakkı granted=false yapılırken pending kayıt varsa veritabanı trigger'ı HR_UPLOADS_PENDING ile reddeder; prepare ile aynı şirket modül kilidi kullanılır. Bu, gelecekteki HR kapatma yazıcısı için de alt katman korumasıdır. Mevcut v1 modül ekranı HR açma/kapatma sunmadığından bu tur o ekranın ön kontrol listesine HR satırı eklendi diye değerlendirilmez. HR aktivasyon yasağı korunur.

Doğrulama: 8 PostgreSQL yükleme/kapama grubu; 4 gerçek kaynak istemci grubu; 849 mevcut uygulama testi; TypeScript ve statik kontrol (0 hata, yeni migration uyarısı). Gerçek yerel tarayıcıda sentetik süresi dolmuş metadata gösterildi, boş yükleme iptal edildi ve DB state=cancelled doğrulandı. 390x844 mobil görünümde scrollWidth=390. Kanıt hr-documents-browser-result.json ve hr-documents-mobile.png. Test sekmesi, viewport, geçici servisler ve test DB temizlendi. Dosya transferi/gerçek içerik kabulü bu testin kapsamı değildir.

Özel evrakın kalan zorunlu sınırı: güvenilir sunucu doğrulamasına bağlı finalize (doğrudan istemci RPC'siyle atlanamayacak), immutable Storage sahipliği, nesneli iptal/temizleme, süreli indirme ve gerçek baytlarla kabul. Bunlar tamamlanmadan yükleme açılmayacak. Üretim yayını yapılmadı; son doğrulanmış canlı 207 migration/İK kapalı. 018–024 ve ekranlar geliştirme dalında kalır.

Son doğrulama: sentetik ortamla production build de başarıyla tamamlandı.


## 19 Ekim — İK özel evrakta güvenilir doğrulama ve atomik finalize çekirdeği

025 migration ile doğrulama kaydı ayrı RLS tablosuna alındı. Tarayıcı/anon doğrulama oluşturamaz; yalnız service_role için dar attest RPC yetkisi var, tabloya doğrudan erişim yok. Attest rezervasyon sahibi/şirketi, içerik özeti/boyutu ve Storage nesnesinin kimliği/sürümü/sahibi/PDF MIME metadata'sını eşleştirir. SQL gerçek bayt okumaz; doğrulama kaydı yalnız güvenilir sunucu kodunun bayt kontrolünden sonra üretilecek. Nesne kimliğinde unique indeks hem tekillik hem Storage trigger sorgu maliyetini sınırlar.

Kullanıcı kapsamlı context RPC nesne sürümünü sağlar. Yeni hizmet kullanıcı istemcisiyle gerçek dosyayı indirir; boyut, PDF başlığı ve SHA-256 kontrolünden sonra ayrı doğrulayıcı istemciyle attest, ardından kullanıcı istemcisiyle finalize yapar. PDF başlığı kontrolü zararlı içerik taraması veya tam PDF yapısal doğrulaması değildir. Finalize her seferinde güncel erişimi kontrol eder, aynı nesne/sürüm/doğrulama eşleşmeden belge oluşturmaz. Belge metadata'sı ve published durumu atomiktir; tekrarda tek belge kalır. Doğrulanmış Storage nesnesine UPDATE/DELETE kapalıdır; ayrı temizleme protokolü henüz yoktur.

6 gerçek PostgreSQL kabul grubu geçti: tarayıcı attest reddi, doğrulamasız finalize reddi, yanlış owner/hash/size/version reddi, context sürümü, tek doğrulama ve immutable nesne, metadata hatasında rollback, tek belge/replay ve güncel yetki. Gerçek kaynak hizmetinde 5 grup gerçek sentetik baytlarla geçti: doğru sıra, boyut/hash/PDF başlığı reddi, scope/path/sürüm, attest hatası, finalize yanıt kaybında başarı üretmeme. Önceki 8 yükleme/kapama DB grubu da geçti. TypeScript ve diff temiz; statik 0 hata/1 yeni migration uyarısı.

Bu tur HTTP Storage transferi veya tarayıcı testi yapılmadı. Hizmette kimlik bilgisi oluşturulmadı; yeni public API route veya bucket/policy açılmadı. Kalan: dar sunucu route bağlantısı ve rol anahtarının mevcut statik güvenlik kuralına kontrollü entegrasyonu; immutable upload/read Storage kuralları; nesneli iptal/kurtarma; yetkili indirme; gerçek yerel Storage ve tarayıcı uçtan uca kabul. Üretim değişmedi, son doğrulanmış 207 migration/İK kapalı; 018–025 geliştirme dalında bekler. Kanıt hr-document-finalize-result.json ve hr-document-verification-client-result.json.


## 19 Ekim — İK özel Storage, sunucu yükleme bağlantısı ve dosyalı iptal

026 migration private hr-private bucket (10 MB/PDF) ve dar RLS politikaları ekler. Rezervasyonsuz yükleme, başka şirket/anon okuma, UPDATE/upsert reddedilir. Pending dosyayı yalnız başlatan yönetici okur; published okuma mevcut çift kapsam yetkisine bağlıdır. Storage INSERT/DELETE güncel izinleri şirket modül kilidinden sonra tekrar kontrol eder. Yayımlanmış dosya iptal edilemez.

Dosyalı iptal önce kalıcı cleanup_requested işareti koyar; upload/attest/finalize kapanır. Kullanıcı kapsamlı Storage remove sonrası mevcut empty finalizer nesnenin yokluğunu doğrular ve cancelled yapar. Dosya kaldığı sürece state pending ve modül kapatma engeli korunur. Doğrulanmış pending nesnenin silinmesine yalnız bu protokolde izin verilir; yayımlanmış nesne korunur. Evrak panelinin iptal eylemi bu hizmete bağlandı. Yeni yükleme formu ve indirme düğmesi bu tur eklenmedi.

/api/hr/documents/upload sunucu route'u aynı-origin, getUser, doğrulanmış şirket, actor/employee ve sınırlı multipart kontrolüyle eklendi. BPS_HR_PREVIEW_ENABLED kapalıysa 404. Service role yalnız gerçek kullanıcı kapsamlı readback sonrası attest RPC için kullanılır; Storage veya belge yazımı için kullanılmaz. Statik anahtar kuralına yalnız bu tam route dosyası için istisna eklendi; genel API klasörü açılmadı. Route henüz gerçek tarayıcı formuyla kabul edilmedi.

Gerçek geçici resmi Storage/PostgREST üzerinde 33 HTTP kontrolü geçti (29 mevcut + 4 İK grubu). Sentetik PDF upload/download bayt eşleşmesi, unreserved/foreign/anon/overwrite/unverified retleri, service attest sonrası tek publish, verified pending cancel→HTTP delete→cancelled→yeniden yükleme reddi ve kapatma engelinin yalnız temizlik sonrası kalkması doğrulandı. Geçici servis/DB temizlendi. Kanıt hr-storage-http-result.json. 8 upload SQL grubu, 6 finalize SQL grubu, 6 gerçek kaynak hizmet grubu, 849 mevcut uygulama testi, TypeScript ve production build geçti. Statik 0 hata/1 yeni migration uyarısı; diff temiz.

Kalan: yükleme formu (dosya/başlık/dönem), aynı dosyayla kurtarma, yetkili indirme bağlantısı ve yeni route dahil gerçek tarayıcı/mobil kabul. Mevcut HTTP test route yerine doğrudan Storage/RPC katmanlarını test etti; bu ayrım korunur. Üretim yayını yok, son doğrulanmış canlı 207 migration/İK kapalı; 018–026 geliştirme dalında bekliyor.


## 19 Ekim — İK PDF yükleme, kurtarma ve indirme tarayıcı kabulü

Çalışanın özel evrak paneline PDF yükle formu eklendi: başlık, isteğe bağlı geçerlilik ve 10 MB sınırı; boyut dosyayı belleğe almadan kontrol edilir. Yeni belge mevcut son istihdam dönemine bağlanır, dönem tarihleri gösterilir. Kurtarmada ilk kaydın dönem/başlık/hash/boyutu korunur; başka dosya istemcide reddedilir. Belirsiz yanıtta aynı işlem kimliği kullanılır, form/kapatma kilitlenir. İptal niyeti için sunucunun kesin HR_UPLOAD_CANCELLED cevabında form kapatılabilir; bu son mesaj dalı ayrıca tarayıcıda denenmedi.

PDF indir eylemi kullanıcı kapsamlı Storage download üzerinden çalışır; kalıcı veya paylaşılabilir signed URL üretilmez. Geçici blob adresi serbest bırakılır. Sentetik test harness'i İK açık yerel testte yalnız geçici service credential'ını Next doğrulayıcısına sağlar; üretim anahtarı kullanılmaz.

Gerçek dosya seçici→multipart API→Storage→attest→finalize kabulü sırasında iki bağlantı kusuru bulundu ve düzeltildi: Next'in normalize ettiği hostname yerine request Host/protokol ile aynı-origin karşılaştırması; başarılı response'a eksik actor/tenant/employee envelope eklenmesi. İlk başarılı DB kaydı UI tarafından doğrulanamayınca form aynı komutla tekrarlandı; SQL tek belge doğruladı. İndirme gerçek browser download olayıyla tamamlandı ve baytları kaynak sentetik PDF ile aynı çıktı. İndirilen test dosyası kaldırıldı.

Ayrı sentetik pending rezervasyonda farklı PDF reddedildi; doğru PDF ile mobil kurtarma tamamlandı. SQL yeni belge=1, kurtarılan belge=1, pending=0. 390x844 mobilde scrollWidth=390. Test sekmesi/viewport ve geçici servis/DB temizlendi. Kanıt hr-upload-browser-result.json ve hr-upload-mobile.png; fixtures/hr-upload.pdf ve hr-wrong.pdf tamamen sentetik. 849 uygulama testi, TypeScript, statik 0 hata/0 uyarı ve diff kontrolü geçti. DB migration değişmedi; yerel HTTP fixture önceki 33 kontrolü de geçti.

Bu paket temel yeni yükleme, aynı dosyayla kurtarma ve yetkili indirmeyi uçtan uca bağlar. Üretim yayını yapılmadı; 018–026 migration zinciri ve sunucu env/yayın sırası üretim ön kontrolü gerektiriyor. Geçmiş istihdam dönemi seçimi, malware taraması, daha ayrıntılı belge türü politikaları ve yeni iptal mesaj dalının tarayıcı kabulü bu kanıtın kapsamı değildir. İK modülü üretimde açılmadı.

Son kaynakla sentetik ortam production build de başarıyla tamamlandı.


## 19 Ekim — İptal kurtarma kabulü ve 018–026 yayın adayı kontrolü

Gerçek yerel tarayıcıda cleanup_requested=true sentetik bekleyen yükleme aynı PDF ile tekrarlandı. Sunucu kesin iptal yanıtı verdi; yeniden gönderme kapandı, formu kapatma açık kaldı. Bekleyenler panelinden iptal tamamlandı ve liste boşaldı. SQL state=cancelled, cleanup_requested=true, oluşturulan belge=0 doğruladı. Kanıt hr-cancel-browser-result.json ve hr-cancel-browser.png. Önceki kayıttaki iptal mesaj dalı kabul eksiği kapandı. Test sekmesi kapatıldı, geçici Storage/DB servisleri sonlandırıldı; gerçek veri kullanılmadı.

Yeni documents/check-candidate.mjs geçmiş yayın commit'indeki 207 migration dosyasını mevcut kaynakla birebir karşılaştırır, yinelenen/geriye tarihli sürümleri ve 018–026 sırasını kontrol eder. Dokuz adayın SHA-256 özeti candidate.json içinde kayıtlı; beklenen son sayı 216. Geliştirme dalının otomatik yayını kapalı doğrulandı. Kontrol geçti. Bu tarihsel kaynak kontrolüdür: güncel üretim şeması ölçülmedi, yayın onayı veya yayın başarısı değildir.

Sıradaki yayın kapıları: güncel salt okunur üretim ledger/katalog/yük ve Storage politikası karşılaştırması; korumalı atomik kurulum dosyaları ve güncel baseline provası; ortam/geri dönüş uyumluluğu; İK preview ve şirket aktivasyonu kapalı canlı smoke. Yeni modül açılmadı, üretim yayını yapılmadı.


## 19 Ekim — 018–026 atomik kurulum ve rollback provası

Dokuz migration için tam beklenen ledger denetimi, ledger kilidi, 5 sn lock_timeout ve 60 sn statement_timeout içeren kurulum dosyaları üretildi. Kaynak/kurulum SHA-256 manifesti hazır. Gerçek geçici PostgreSQL'de her dosyada ledger yazımından hemen önce kasıtlı hata verildi: public katalog, Storage politikaları/tetikleyicileri ve hr-private bucket durumu birebir geri döndü. Ardından kurulum geçti, tekrar uygulama reddedildi. Yanlış sırada kurulum da reddedildi. Son sentetik ledger 216, aktivasyon kapalı. İlk test betiğindeki parantez hatası düzeltildikten sonra genişletilmiş son koşu geçti.

Yalnız metadata/toplam okuyan preflight.sql baseline üzerinde doğrulandı; gerçek çalışan/dosya içeriği okumaz. Güncel üretim sorgusu bu tur çalıştırılmadı. Yayın kapıları ve hata halinde durma sırası documents/READINESS.md içinde kayıtlı. Kalan: güncel üretim ledger/public+Storage katalog/yük karşılaştırması, yeni SQL ile uygulama geri dönüş uyumluluğu ve kapalı İK üretim smoke. Üretim değişmedi; otomatik dal yayını kapalı.


## 19 Ekim — Güncel üretim karşılaştırması ve eşlenmiş kurulum

Resmi Supabase salt okunur Management API ile üretim metadata'sı yenilendi (19:01 UTC / 22:01 Türkiye). Ledger 207, son sürüm 20261019001700; İK enabled=0, onaylı aktivasyon=0, scoped şirket=0, hr-private bucket yok, yayın bariyeri yok. Ölçüm anında bekleyen kilit ve diğer aktif transaction sayısı sıfır. Bu anlık ölçüm ileride kilit olmayacağını garanti etmez. Çalışan satırları/dosya içerikleri alınmadı, kimlik bilgisi kayda yazılmadı.

Public fonksiyon/hash/ACL, tablo/kolon/indeks/kısıt/tetikleyici/policy ve Storage nesne politikası/tetikleyicisi karşılaştırıldı. Tarihsel fixture'daki bilinen change_workspace_modules_v1 authenticated EXECUTE farkı yalnız disposable DB'de canlıya eşlendi. Önceden tek tek incelenmiş sekiz CHECK parantez farkı dışında çözülmemiş fark sıfır. Yeni farkları genel normalizasyonla gizleyen bir kural eklenmedi.

Bu karşılaştırılmış tabana dokuz hash-doğrulamalı kurulum uygulandı: sentetik ledger 216; aktivasyon kapalı. Mevcut üretim fonksiyonlarının hiçbirinin imzası/gövde hash'i/ACL/owner bilgisi değişmedi. Bu yapısal uyumluluk kanıtıdır; eski uygulamanın davranışsal rollback testi sayılmaz. Geçici DB kaldırıldı. Kanıtlar documents/live-preflight.json, live-catalog.json, baseline-comparison.json ve compared-installation.json.

Ön kontrol sorgusundaki istihdam tablo adı hr_employment_periods olarak düzeltildi ve hr_assignments boyut ölçümüne eklendi; güncel sorgu üretimde tekrar salt okunur çalıştırıldı. Kalan yayın kapısı: aday build/env ve eski uygulama davranışsal uyumluluğu, yayın anında ölçüm tazeleme, kontrollü SQL+uygulama ve canlı smoke. Üretime yazım/yayın yapılmadı.
