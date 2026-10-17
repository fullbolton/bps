# Gerçek oturumlu evrak kabulü — kurtarma ve iptal sonucu

16 Ekim 2026. **Gerçek oturumlu kurtarma ve iptal geçti.** İlk hazırlık hatası aşağıda tarihsel kayıt olarak korunur; güncel ölçüm Sonuç bölümündedir. Diğer açık kabul adımları ayrıca belirtilmiştir.

## Çalıştırma

Aktif repo kökünde `BPS_LOCAL_BROWSER=1 node qa/contract-write-20261015/storage-http.mjs`.
Standart komut bayrak olmadan önceki HTTP kontrol paketidir. Bayrak ile kontrollerden sonra `authenticated-browser.mjs` geçici Auth, yalnız loopback 3061 proxy ve 3060 gerçek Next uygulaması hazırlamayı dener. Kendi sentetik DB klonu, rastgele JWT anahtarı ve geçici servisleri kullanır; üretim ortamı hedeflenmez. Gerçek kullanıcı şifresi kullanılmaz. Kaynakta bulunan parola yalnız bu sentetik yerel hesap içindir.

## İlk denemede ölçülen engel (aşıldı)

Mevcut yerel Auth imajı `public.ecr.aws/supabase/gotrue:v2.186.0`. Sentetik şema kopyasının auth OAuth tablo biçimi bu imajın migration dizisiyle uyuşmuyor. Başlangıçta `20250731150234_add_oauth_clients_table.up.sql`, `auth.oauth_clients(client_id)` indexini oluştururken `42703: column client_id does not exist` hatası alınıyor. Auth health hazır olmuyor; login ve UI server action kabulü başlamadı. Tarayıcıda 3060 ilk açılışı bağlantı reddi verdi; bu ürün UI hatası olarak sınıflandırılmadı.

Geçici Auth/Storage/REST servisleri ve DB klonu finally içinde kaldırıldı. Üretim tablosu değiştirilmedi. Eksik migration ledger'ını tamamlanmış gibi işaretleme, şema korumalarını aşma veya prod parolası kullanma yapılmadı.

## İlk denemede planlanan kabul

1. Sentetik Auth şemasıyla uyumlu resmi Auth sürümünü belirle veya doğrulanabilir temiz Auth fixture kur; migration başarısını ölç.
2. Gerçek parola girişi, custom_access_token_hook tenant/selection claim doğrulaması.
3. Evraklar ekranında sentetik bekleyen dosyayı gerçek recoverDocumentUpload server action ile yayımla; ana liste ve DB makbuzunu doğrula.
4. Dosyasız sentetik giriş için iptal/vazgeç ve onaylı iptal; cleanup işini doğrula.
5. Gerçek UI yüklemesi, yenileme sonrası kalıcılık, scope değişimi ve mobil görünüm.

Bu QA düzeni ürün koduna test hesabı veya test giriş bypass'ı eklemez. Hazır olunca SIGINT/SIGTERM ile kapat; kaynak runner klonu temizler. Bu sınırlı yerel kabul üretim yayın kabulünün yerine geçmez.

## Sonuç — 16 Ekim, gerçek oturumlu kurtarma/iptal geçti

Önceki engel aşağıdaki düzenle aşıldı; baştaki başarısızlık kaydı tarihsel kanıttır. Auth v2.186.0 ayrı boş sentetik DB'de kendi resmi migration'larıyla başlatıldı. Aynı imzalı JWT sırrı PostgREST/Storage ile paylaşıldı. Gerçek custom_access_token_hook gövdesi ve sentetik kullanıcının membership/selection snapshot'ı bu Auth DB'sine kopyalandı; uydurma migration ledger veya ürün auth bypass'ı kullanılmadı. Sentetik kullanıcı gerçek Auth admin API ile oluşturuldu, gerçek parola girişi yaptı. İş kayıtları ayrı disposable klonda kaldı.

CUA tarayıcıda gerçek uygulama kabuğu ve /evraklar ekranı üzerinden:
- Sentetik giriş ve şirket/rol çözümü başarılı.
- İki pending kayıt listelendi; dosyası olan için Tamamla, olmayan için yalnız iptal sunuldu.
- Yüklemeyi tamamla gerçek recoverDocumentUpload server action ile çalıştı; işlem sırasında düğmeler kilitlendi, başarı mesajı geldi, ana liste 1'den 2'ye çıktı.
- İptal onayı → Vazgeç kaydı korudu; ikinci onay gerçek cancelDocumentUpload ile iptal etti ve temizlik mesajını gösterdi.
- Sayfa reload sonrası pending boş, tamamlanan belge listede kaldı. Tarayıcı error log sorgusu boştu.
- Ayrı SQL ölçümü: published=true, documentCount=1, cancelledDocumentCount=0, cancelCleanup=1. `authenticated-db-result-20261016.json` ve `authenticated-cancel-20261016.png` kanıttır.

Sınır: Auth hook üyelik snapshot'ı bu fixture'da anlık eşitlenmez; çoklu şirket değiştirme, rol değişiminden sonra token refresh veya üyelik iptali bu kabulde sınanmadı. Üretimin birebir Auth topolojisi değildir. İlk dosya/rezervasyon kurulumu API ile yapıldı; yeni dosyayı UI dosya seçicisinden yükleme, mobil görünüm ve temizlik düğmesiyle fiziksel silme bu turun kapsamında değil. Gerçek ekran kurtarma/iptal kabulü tamamlandı; bütün ürün/üretim kabulü tamamlandı denmez.

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


## 17 Ekim — dosyası yüklenmiş kaydın tarayıcıdan iptali

Yerel Auth/Next/Storage kabul fixture'ına üçüncü sentetik kayıt eklendi: dosyası depoda mevcut, evrak kaydı henüz tamamlanmamış. Gerçek giriş ve /evraklar ekranından bu kayıt için iptal onayı verildi. İşlem sırasında düğmeler kilitlendi; başarı mesajı dosya temizliğinin yöneticinin listesine alındığını açıkladı ve kayıt bekleyenlerden çıktı. SQL sonucu: documents=0, storage.objects=1, tamamlanmamış cleanup=1. Böylece iptalin dosyayı anında silmediği de doğrulandı. Kanıt browser-uploaded-cancel-20261017.json.

Önceden geçen temel kurtarma, dosyasız iptal ve şirket geçiş testleri tekrar edilmedi. Bu tur yeni kabul yalnız dosyası mevcut iptal akışıdır. Yerel başlangıçta ilk sayfa derlemesi navigasyon bekleme süresini aştı; aynı sekme hazır olduğunda giriş tamamlandı. Ürün hatası görülmedi. Ürün kodu/SQL değişmedi, üretime işlem yapılmadı; yeni yayın gerekmiyor.


## 17 Ekim — iki gerçek sekmede açık form / şirket değişimi kabulü

Birinci sekmede Synthetic A evrak yükleme formu açılıp yalnız sentetik evrak adı yazıldı; kaydedilmedi. İkinci sekmede gerçek şirket seçici ile Synthetic B seçildi ve Auth yenilemesi tamamlandı. Birinci sekme kendiliğinden formu kaldırarak “Şirketinizi yeniden doğrulayın” ekranını gösterdi. İkinci sekmede Synthetic B başlığı görüldü. SQL: seçili tenant B, taslak adına ait documents=0 ve document_upload_attempts=0. Kanıt browser-multitab-result-20261017.json.

Bu sonuç önceki çok sekmeli açık form kabul açığını, kaydedilmemiş evrak formu için kapatır. Devam eden byte transferi sırasında şirket değişimi, refresh ile eşzamanlı üyelik değişimi ve fiziksel mobil cihaz hâlâ ayrıca sınanmalıdır. Ürün kodu/SQL değiştirilmedi, canlıya işlem yapılmadı. Tarihsel metinlerdeki yayın bekliyor ifadeleri güncel değildir: 17 Ekim yayın manifesti geçerlidir.


## 17 Ekim — HTTP gövdesi açıkken şirket değişimi

Storage HTTP kabulüne gerçek parça gönderimli istek eklendi. A şirketinde rezervasyon açıldı; Content-Length taşıyan HTTP isteğinde ilk 5 byte yazılıp kalan gövde bekletildi. Gerçek select_workspace RPC ile B seçimi commit olduktan sonra gövde tamamlandı. Storage hata yanıtı verdi; storage.objects=0 ve documents=0. Eski A ve yeni B tokenlarıyla finalize 403, dosya okuma başarısız.

28/28 yerel HTTP kontrolü geçti; önceki 27 kontrol korundu. Kanıt storage-switch-stream-result-20261017.json. Bu test istemcinin HTTP gövdesini açık tuttuğu aralığı doğrular; sunucunun ilk parçayı hangi anda fiziksel depoya yazdığı veya her olası interleaving hakkında iddia taşımaz. Gerçek tarayıcı dosya aktarım UI'sinin kesintili bağlantı mesajı ve fiziksel mobil test ayrıca açık.

Ürün SQL/TS değişmedi; yalnız test/kanıt eklendi. Üretime işlem yapılmadı, yeni yayın gerekmiyor. Geçici yerel klon ve servisler test sonunda kaldırıldı.
