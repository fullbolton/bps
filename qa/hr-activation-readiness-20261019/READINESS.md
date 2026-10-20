# İK pilot açılışı — kabul sınırı

Bu kayıt aktivasyon yetkisi veya üretimde İK'nın açık olduğu anlamına gelmez. Son doğrulanmış üretim: c2fbbf0 uygulaması, 216 migration; İK kapalı. Güncel yayın kanıtı: ../auth-deadline-20261019/release.json.

## Ayrı kontrol noktaları

| Kontrol | Görevi | Mevcut durum / kanıt |
|---|---|---|
| Uygulama önizlemesi | İK ve rol ayarları rotalarını sunar | BPS_HR_PREVIEW_ENABLED ve BPS_ACCESS_PREVIEW_ENABLED ayrı sunucu bayrakları; rota açmak veri yetkisi vermez |
| Katalog hazırlığı | Modülün açılabilir ürün olarak sunulması | UI'da hazırlanıyor; kod/SQL katalog kapıları ayrıca doğrulanmalı |
| Kullanım hakkı ve modül durumu | Şirketin İK'ya erişebilmesi | tenant_module_entitlements + tenant_module_settings; şirket bazında ayrı |
| Teknik kabul | Şirketin kapsamlı yetki geçişine uygunluğu | hr_access_release_gates varsayılan kapalı; normal kullanıcı doğrudan yazamaz |
| Rol hazırlığı | İK hesaplarında kalıcı çalışan okuma kuralı | Ön kontrol eksik rol/kuralı sayar; seçili departman/iş yeri ve açık ret ayrıca uygulanır |
| Şirket geçişi | Eski erişimden kapsamlı yetkiye geçiş | Token bağlı atomik komut; ön kontrolden sonra değişen rol/üyelik/hak kabul edilmez |

Modülün görünür olması, kullanım hakkının verilmesi ve özel yetkilerin uygulanması aynı işlem değildir. Birini açıp diğerlerinin tamamlandığını varsaymayın. Üretimde trigger kapatma veya test fixture SQL'i kullanma yoktur.

## Pilot ürün kapsamı

Çalışan dizini ve oluşturma/düzenleme, istihdam sonlandırma/yeniden başlatma, iş yeri transferi, Excel önizleme ve atomik aktarım, özel PDF yükleme/indirme ve yarım yükleme kurtarma. Bu kapsam bordro, izin hakedişi, izin onayı veya satın alma onayı içermez. Bu akışlar ayrı geliştirme paketleridir.

## Açılıştan önce tamamlanacaklar

1. Pilot şirket ve kullanılacak yönetici/İK hesapları belirlenir. Bir hesap bir şirket yaklaşımı korunur; eski Partner–Mek seçimine dayalı ürün akışı eklenmez.
2. İK hesaplarının departman/iş yeri kapsamı ve açık ret kuralları incelenir. Personel havuzu ile çalışan dizini ayrı yetki alanları olarak değerlendirilir. Maaş, dışa aktarma ve belge indirme ayrı yetkilerdir.
3. Mevcut 216 şemasıyla gerçek PostgreSQL kabulü ve uygulama eşlemesi doğrulanır. access-activation-schema.mjs bu tur dört grupta geçti: varsayılan kapı/yetkisiz erişim, stale token, audit rollback/eşzamanlı tekrar, eski yazıcı engeli.
4. Yerel birleşik tarayıcı kabulü tamamlandı: aktivasyon kesin ret/yenileme/başarı, transfer kesin ret/yenileme/başarı ve özel PDF indirme/izin iptali. Gerçek uygulama, GoTrue ve API kullanıldı. Kanıt tablosu aşağıdadır. Bu sonuçlar gerçek pilot hesaplarını veya tam klavye erişilebilirlik denetimini kapsamaz.
5. Özel PDF politikasının ilk kapsamı belirlenir. Mevcut sahiplik/tür/özet doğrulaması zararlı yazılım taraması değildir; gerçek özel evrak pilotu için bu sınır ürün kabulünde açıkça kaydedilir.
6. Katalog/readiness, sunucu bayrakları, kullanım hakkı, teknik kabul ve şirket geçişinin uygulanacak sırası tek pilot için somutlaştırılır. Her aşamada yalnız gerekli kapsam değişir; doğrulanmamış toplu aktivasyon yapılmaz.

## Açılışta kanıtlanacaklar

- Yönetici ve kapsamlı İK: izinli çalışanları görme; kapsam dışı çalışanı görmeme; izinli düzenleme; yasak indirme/dışa aktarmanın reddi.
- Üyelik/rol değişiminde eski oturum ve açık formun yetkiyi koruyamaması.
- Aynı komutla yeniden denemede tek sonuç; veri katmanının tekrar yetki denetimi.
- İK dışındaki günlük operasyon ve modül geçmişinin çalışması.
- Yeni modül kapatılırken yarım dosya yüklemesinin kontrol edilmesi.

## Durdurma ve toparlanma

Yanlış kapsam görünürlüğü, yetkisiz yazma veya belirsiz aktivasyon sonucu varsa sonraki adıma geçilmez. Belirsiz yanıt yeni komutla tekrarlanmaz; mevcut komut makbuzu/ön kontrol okunur. Veri veya denetim kaydı silinmez. Şirket kapsam modu doğrudan legacy'ye çevrilmez. Uygulama geri dönüşü sadece şemayla uyumluluğu doğrulanmış sürüme yapılır; kapatma için mevcut bekleyen iş kontrolleri korunur.

## Sonraki ürün paketleri

1. İzin yönetimi: çalışan talebi → yetkili yönetici kuyruğu → onay/ret → hak hareketi; aynı talepte çift karar ve kendi talebini onaylama kuralları.
2. Satın alma: talep → tutar/şube/birim bazlı yönetici → gerekli ek onaylar → satın alma/teslim takibi; karar ile ödeme ayrı işlemler.

Bu iki akışın ortak onay altyapısı tasarlanabilir; izin bakiyesi ile satın alma bütçesi aynı veri modeli veya tek bir genel görev durumu olarak tutulmamalıdır.

## 20 Ekim — güncel kabul özeti

Aşağıdaki kanıtlar farklı katmanları kapsar; satırların test sayıları toplanarak tek bir test toplamı üretilmez. Tamamlanmış senaryolar, kod veya kabul koşulu değişmedikçe tekrar çalıştırılmaz.

| Alan | Kanıt | Sonuç ve sınır |
|---|---|---|
| Hazırlık listesi | browser-acceptance.json | Sentetik RPC ile üç engel ve temel Enter kullanımı; tam erişilebilirlik denetimi değil |
| Transfer API | transfer-http-result.json | Gerçek GoTrue/PostgREST ile 4 grup; stale ret, tekrar, rol iptali |
| Transfer ekranı | transfer-browser-result.json | Gerçek uygulama/oturum/API; kesin ret → yenileme → başarı; DB tarih geçmişi |
| Aktivasyon API | activation-http-result.json | Gerçek oturum/API ile 4 grup; engeller, stale token, eşzamanlı tek geçiş |
| Aktivasyon ekranı | activation-browser-result.json | Gerçek uygulama/oturum/API; kesin ret → yenileme → scoped; DB tek makbuz |
| Kapsam ve evrak listesi | scope-http-result.json | Gerçek oturum/API ile 4 grup; departman, ayrı evrak izni, açık ret, rol iptali |
| Dosya baytları | ../hr-catalog-20261018/hr-storage-http-result.json | Gerçek Storage HTTP ile 7 grup; sentetik JWT, izin iptali ve içerik eşleşmesi |
| Dosya indirme ekranı | download-browser-result.json | Gerçek GoTrue/uygulama/Storage; tarayıcı indirilen bayt eşleşmesi, açık panelde izin iptali |

Son ürün kodu kontrolü: 857 uygulama testi, TypeScript ve production build geçti (activation-browser-result.json). Sonraki değişiklikler kabul araçları ve kayıtlarıdır. Bu durum üretimde pilot açıldığı anlamına gelmez.

## Kalan işler ve kapanış ölçütü

| İş | Gereken | Kapanış kanıtı |
|---|---|---|
| Pilot hesap/kapsam | Kullanıcının şirket, yönetici/İK hesapları ve departman/şube kapsamını belirtmesi | Hesap bazında görünür/gizli örnekler, belge ve dışa aktarma yetkileri onaylı matrise işlenmiş |
| Özel PDF politikası | Sentetik belgelerle pilot veya gerçek belgeler öncesi tarama tercihinin belirlenmesi | Belge kapsamı ve mevcut tarama sınırı açıkça kabul edilmiş; gerekiyorsa tarama geliştirmesi tamamlanmış |
| Yayın ön kontrolü | Güncel canlı uygulama/şema, kaynak commit ve yayın sırasının tekrar ölçümü | Kaynak ve migration eşleşmesi; bu belgede yazan eski ölçüm tek başına yeterli değil |
| Pilot aktivasyon sırası | Katalog hazırlığı, ayrı sunucu bayrakları, kullanım hakkı, teknik kabul ve şirket geçişinin tek şirket için hazırlanması | Her adımın ön koşulu ve sonucu kayıtlı; fixture SQL'i üretimde kullanılmaz |
| Gerçek pilot kabulü | Onaylanan hesaplarla görünürlük/ret, izinli düzenleme, evrak ve operasyon kontrolleri | Hesap bazında sonuçlar; bekleyen dosya varken kapatma kontrolü |

Güncelleme (20 Ekim): kullanıcı teknik kararları gerekçeleriyle kaydederek öneriye göre ilerlemeyi onayladı. Sentetik pilot ve gerçek özel evrak öncesi ClamAV seçildi. Gerçek hesap kimlikleri henüz belirlenmedi; tahmini kişilere kapsam atanmaz. Aşağıdaki karar kaydı eski PDF tercih bekleme maddesinin yerini alır.

## Tekrar kurulumu

- API: BPS_LOCAL_BROWSER=1 ve ilgili BPS_HR_TRANSFER_HTTP / BPS_HR_ACTIVATION_HTTP / BPS_HR_SCOPE_HTTP=1.
- Transfer ekranı: BPS_LOCAL_BROWSER=1 BPS_HR_TRANSFER_BROWSER=1 BPS_HR_PREVIEW_ENABLED=true.
- Aktivasyon ekranı: BPS_LOCAL_BROWSER=1 BPS_HR_ACTIVATION_BROWSER=1 BPS_ACCESS_PREVIEW_ENABLED=true.
- İndirme ekranı: BPS_HR_STORAGE_ACCEPTANCE=1 BPS_HR_DOWNLOAD_BROWSER=1 BPS_LOCAL_BROWSER=1 BPS_HR_PREVIEW_ENABLED=true.

Bu değişkenlere BPS_RELEASE_BARRIER=1 eklenerek `node qa/contract-write-20261015/storage-http.mjs` çalıştırılır. Yalnız sentetik yerel fixture içindir. Tarayıcı senaryoları ayrıca UI adımlarını gerektirir; sunucunun açılması testin geçtiği anlamına gelmez.

## 20 Ekim — tarama ve karantina karar kaydı

Kullanıcı öneriye göre ilerlemeyi ve kararların gerekçeleriyle kayıt altına alınmasını istedi. Seçim: sentetik pilot devam eder; gerçek özel evrak pilotundan önce tarama eklenir. Pilot yönetici şirket genelinde, İK tek şube/departman, şube yöneticisi temel çalışan bilgileri, muhasebe başlangıçta kapalı. Bunlar rol şablonlarıdır; gerçek hesap kimlikleri atanmış değildir.

- Motor: kendi yönettiğimiz ClamAV işçisi. Dış genel dosya tarama servisine İK belgeleri gönderilmez. clamd TCP kimlik doğrulamaz; internete açılmaz, özel ağ/soket kullanılır. Sunucu satın alınmadı veya servis kurulmadı.
- Akış: yükleme rezervasyonu → erişime kapalı nesne → tarama → içerik/sahiplik doğrulaması → yayın. Mevcut pending nesne okuma politikası doğrulayıcının kullanıcı oturumuyla indirmesine izin verir; bu nedenle mevcut pending durumuna yalnız “karantina” adı vermek yeterli değildir. Ayrı durum/işçi okuma yetkisi ve Storage RLS değişikliği gereklidir.
- Bağlama: temiz sonucu tenant, upload, object kimliği, object sürümü, boyut ve SHA-256 ile aynı dosyaya bağla. Tarayıcı temiz raporu veremez. Veritabanı finalize kontrolü de bunu zorunlu tutmalı.
- Hata: tarama yoksa/yarımsa, limit aşılmışsa veya şifreli içerik incelenemiyorsa temiz sayılmaz. Şüpheli dosya otomatik silinmez; normal indirme kapalı kalır.
- Başlangıç mühendislik politikası: imza yaşı en çok 24 saat, finalize için sonuç yaşı en çok 5 dakika, saat toleransı 30 saniye. Bunlar ürün tercihi; antivirüs garantisi değildir. Yeniden denemede nesne sürümü tekrar doğrulanır.
- Kapsam: geçmiş yayımlanmış dosyalara toplu değişiklik yok. Gerçek rollout öncesi eski belgelerin nasıl ele alınacağı ayrı migration/ön kontrol kapsamında belirlenir.

İlk kod parçası: src/lib/services/hr-malware-verdict.ts temiz rapor sözleşmesi. Üç test grubu geçer (bağlama, kısmi/zararlı sonuç, eski/gelecek zaman). Henüz yükleme/finalize/Storage politikasına bağlanmadı; mevcut sistem antivirüs koruması kazanmış sayılmaz. Sıradaki paket: kalıcı tarama durumu ve SQL/Storage karantina sınırı, ardından özel işçi ve gerçek motor kabulü.

Kaynaklar: https://docs.clamav.net/manual/Usage/Scanning.html ve https://docs.clamav.net/manual/Usage/SignatureManagement.html (20 Ekim incelemesi). Belgelerde dosya limiti nedeniyle atlanan dosyaların temiz varsayılabilmesi özellikle ele alındı; işçi limit/şifreli içerik durumlarını temiz rapora dönüştürmemeli.

Karantina veri katmanı adayı: ../hr-quarantine-20261020/candidate.sql ve result.json. Yedi geçici PostgreSQL grubu geçti. Normal pending okumayı kapattığı için mevcut server readback akışıyla uyumsuzdur; işçi entegrasyonu bitmeden migration zincirine alınmaz. Gerçek antivirüs motoru henüz kurulu değildir.


## 20 Ekim — ClamAV bağlantı katmanı

workers/hr-malware/clamd.mjs özel Unix soketinden INSTREAM protokolüyle en çok 10 MiB dosyayı parçalı gönderir. Gönderilen baytlar çağırandan bağımsız kopyalanır. Mutlak zaman aşımı, bağlantı hatası, erken temiz yanıt, kesik/çoklu/bilinmeyen/aşırı uzun yanıt temiz sonuç üretmez. Zararlı bulgusu ayrı sonuçtur. TCP uç noktası kabul edilmez.

Karar: bu katmanın clean sonucu tek başına yayına izin değildir. İmza güncelliği, motor yapılandırması (şifreli/limit nedeniyle atlanan içerik), nesne sürümü ve sahiplik ayrıca güvenilir işçide doğrulanmalı. Gerçek motor henüz kurulmadı; yedi test gerçek Unix soketi üstündeki sahte daemon ile protokol kabulüdür, antivirüs tespit başarısı değildir. Kaynak: https://docs.clamav.net/manual/Usage/ClamdProtocol.html.

Doğrulama: 7 bağlantı testi, 867 uygulama testi ve TypeScript geçti. İlk genel test denemesi yeni iki test dosyası envantere eklenmediği için durdu; sınıflandırma tamamlandıktan sonra tüm 867 test geçti. Üretim yayını yapılmadı. Sıradaki kapanış işi: dar yetkili işçi okuma/raporlama akışı, gerçek motor ve uçtan uca karantina kabulü.


## 20 Ekim — güvenilir tarama sonucu kayıt sınırı

qa/hr-quarantine-20261020/worker-report.sql adayına hr_malware_report_v1 eklendi. Yalnız service_role ve uygun JWT rolü çağırabilir; normal kullanıcı/anon doğrudan kayıt yazamaz. Kayıt pending ve temizleme istenmemiş yüklemeye bağlıdır; şirket, yükleme, boyut ve özet eşleşir. Mevcut hr_document_attest_v1 tekrar kullanılarak nesne sahibi, MIME, sürüm ve boyut doğrulanır; dosya değişmezliği korunur. Tarama sonucuyla içerik doğrulaması tek transaction içindedir.

Kararlar: aynı zaman damgasındaki birebir sonuç tek kaydı korur; çelişen tekrar ve daha eski sonuç reddedilir. Infected sonucu sıradan clean/error raporuyla kaldırılamaz; yanlış pozitif için gelecekte ayrı denetimli inceleme gerekir. Hata raporu daha yeni geçerli taramayla yenilenebilir. Yayımlanmış veya temizleme istenmiş yüklemeye yeni rapor yazılmaz. ClamAV işlemine service_role anahtarı verilmeyecek; RPC güvenilir uygulama/işçi koordinatöründe kalacak.

Kanıt: geçici sentetik PostgreSQL'de 8 kabul grubu geçti (result.json). Yeni senaryolar: anon/kullanıcı reddi, eksik service rol iddiası, yanlış şirket/sürüm, tip hataları, eski/kısmi rapor, tek kayıtlı tekrar, çelişen/eski sonuç, infected düşürme, temizleme ve yayın sonrası ret. Ürün TypeScript değişmedi; bu tur genel uygulama testleri tekrar edilmedi.

Sınır: worker-report.sql üretim migration zincirinde değildir. Gerçek ClamAV kurulumu, imza/config doğrulaması, dar kapsamlı dosya okuma ve yükleme API entegrasyonu henüz tamamlanmadı. Bu RPC kendi başına tarama yapmaz ve service_role anahtarını dar yetkili hale getirmez. Mevcut kullanıcı pending readback yolu değiştirilmeden karantina adayı yayımlanamaz. Üretim değişmedi.


## 20 Ekim — tarama işçisi içerik bağlama çekirdeği

workers/hr-malware/job.mjs: güvenilir adaptörlerden alınan nesne kimliği/sürümü, PDF başlığı, gerçek bayt uzunluğu ve SHA-256 rezervasyonla eşleştirilir; aynı baytların özel kopyası taramaya gönderilir. Motorun politika, imza güncelliği ve ölçüm güncelliği tarama öncesi/sonrası kontrol edilir; motor örneği, ayar özeti veya imza sürümü değişirse sonuç kaydedilmez. Tarama sonrası nesne yeniden kontrol edilir; persist başarısızlığı başarı makbuzuna dönüşmez. Temiz rapor mevcut TypeScript sözleşmesiyle uyumludur.

Karar: motorun PDF tarama ve şifreli/limit aşımı uyarıları gerçek çalışma yapılandırmasından doğrulanmadan temiz sonuç oluşturulmaz. Bu bilgi tarayıcıdan veya kontrol edilmemiş bir env bayrağından alınamaz. FOUND yanıtı ayrıntısı bilinmediğinden complete=false ile kapalı tutulur; şifreleme/limit alt nedeni bu çekirdekte ayrıştırılmaz. Dosyalar kayda/loga yazılmaz.

Doğrulama: 6 işçi senaryosu ve toplam 873 uygulama testi geçti. İçerik/sürüm değişimi, eski imza/ölçüm, uygun olmayan yapılandırma, motor yenilenmesi, zararlı/bilinmeyen sonuç, bağlantı ve kayıt hatası kapsandı. Temiz raporun mevcut doğrulayıcı tarafından kabulü ayrıca geçti.

Sınır: bu paket adaptörleri enjekte edilen çekirdektir; gerçek motor ölçüm adaptörü, sınırlı Storage okuması ve guarded RPC persist bağlantısı henüz bağlanmadı. readObject adaptörü aktarım sırasında 10 MiB sınırını da uygulamalı; sonradan uzunluk kontrolü tek başına yeterli değildir. Gerçek motor kurulumu ve uçtan uca kabul tamamlanmadan yayın yok. Üretim değişmedi.


## 20 Ekim — sınırlı Storage okuma ve sonuç gönderme adaptörü

workers/hr-malware/storage.mjs: kullanıcı oturumuyla hr_document_verification_context_v1 çağrısı, actor/tenant/upload/path/pending/boyut/özet/sürüm doğrulaması; ardından yalnız doğrulanmış UUID yolundan özel PDF okuması. İndirme öncesi ve sonrası kullanıcı kapsamı ve nesne bağlamı yeniden okunur. Content-Length olmasa bile akış beklenen dosya boyutunu ve 10 MiB üst sınırını aşarsa iptal edilir. Yanlış MIME, eksik içerik, yönlendirme ve zaman aşımı reddedilir. Sonuç yalnız hr_malware_report_v1 üzerinden gönderilir; kayıt hatası başarı sayılmaz.

Karar: karantina pending okumaları kullanıcı RLS'sinde kapalı kalırken hizmet anahtarı yalnız güvenilir sunucu koordinatöründe sabit Storage yolu için kullanılır; clamd sürecine verilmez. Bu, anahtarın kendisini dar yetkili yapmaz. Uç adresi sunucu yapılandırmasından gelir; kullanıcıdan URL alınmaz, HTTPS zorunludur (yerel test için loopback HTTP istisnası). Motor bağlanana kadar mevcut upload route değiştirilmez.

Kanıt: 8 adaptör testi ve toplam 881 uygulama testi geçti. Gerçek yerel HTTP sunucusunda yönlendirme hedefi sıfır istek aldı; takılan indirme gövdesi zaman aşımıyla durdu. Diğer testler sentetik RPC/Response kullanır; gerçek Supabase Storage uçtan uca kabulü değildir. Son sıkı objectId tipi kontrolünden sonra 8 adaptör testi ayrıca geçti.

Kalan entegrasyon: çalışan motorun imza/ayar ölçümü, gerçek ClamAV kurulumu ve EICAR/temiz/limit/şifreli kabulü, bu adaptörlerle işçi çekirdeğinin sunucuya bağlanması, gerçek yerel Storage + karantina SQL uçtan uca testi. Üretime migration veya uygulama yayını yapılmadı; antivirüs hâlâ aktif değil.


## 20 Ekim — gerçek ClamAV ve Unix soket kabulü

qa/hr-clamav-20261020 altında gerçek motor kanıtı eklendi. Resmî ClamAV imajı digest ile sabitlendi; ARM manifesti bulunmadığı için linux/amd64 emülasyonu kullanıldı. Ölçülen sürüm: ClamAV 1.5.4, imza 28157 (18 Ekim 06:24 UTC). İmaj imzaları 24 saat politikasını karşılamıyor; bu çalışma yalnız motor/protokol kabulüdür, üretim hazırlığı veya güncel koruma değildir.

Yazdığımız workers/hr-malware/clamd.mjs gerçek clamd Unix soketine bağlandı: temiz PDF clean; EICAR Eicar-Test-Signature; şifreli PDF Heuristics.Encrypted.PDF; 1 MiB test sınırını aşan PDF Heuristics.Limits.Exceeded.MaxFileSize olarak FOUND verdi. Son üçü taşımada infected şeklinde kapalı tutulur; şifreli/limit dosyalarının gerçekten zararlı olduğu iddia edilmez. Dört kontrol geçti, aynı set ölçülen motor bilgisiyle tekrar da geçti.

Karar: testte MaxFileSize=1M bilerek düşük, StreamMaxLength=10M; bu clamd.conf üretim ayarı değildir. SocketMode=666 yalnız iki geçici konteynerin izole paylaşılan volume'ü içindir; üretimde grup bazlı 660 gerekir. Her iki konteyner network=none; dışarıya dosya/port açılmadı. Motor konteyneri ve socket volume testten sonra kaldırıldı. İndirilen imaj ve geçici sentetik fixture/venv yeniden test için yerelde durur. Gerçek şirket dosyası kullanılmadı.

Tekrar araçları: fixtures.py pypdf==6.21.1 ile geçici dizinde PDF/EICAR üretir. clamd.conf salt okunur bağlanarak sabitlenmiş imajda clamd başlatılır; /run/bps-clam paylaşılan Docker volume'dür. accept.mjs, engine.json ölçümüyle, /worker=workers/hr-malware (salt okunur), /fixtures=sentetik dizin (salt okunur), /evidence=bu QA dizini bağlanmış Node konteynerinde çalışır. Node imajı digest'i engine.json içindedir. Standart EICAR test verisi dışında zararlı yazılım örneği kullanılmaz.

Kaynaklar: https://docs.clamav.net/manual/Installing/Docker.html ve https://raw.githubusercontent.com/Cisco-Talos/clamav/main/etc/clamd.conf.sample. Sonraki işler: güncel imza temini ve çalışan motor/config ölçüm adaptörü, işçi/Storage/SQL birlikte yerel uçtan uca kabulü; sonra yayın ön kontrolü. Bu tur ürün kodu değişmedi, genel uygulama testleri tekrarlanmadı. Üretime yayın yok.


## 20 Ekim — güncel imza ve çalışan motor sürümü ölçümü

Freshclam resmî kaynaktan daily veritabanını 28157 → 28158 güncelledi ve kendi database testini geçti. Güncelleme sırasında daemon çalışmadığından bildirilemedi uyarısı beklenen durumdu; sonrasında güncel volume ile yeni clamd başlatıldı. workers/hr-malware/version.mjs, VERSION komutunu Unix soketinden okuyup tam yanıtı, motor sürümünü, imza numarasını ve geçerli takvim tarihini ayrıştırır. Eksik/çoklu/bilinmeyen yanıt başarısızdır; bu ölçüm configurationVerified üretmez.

Ölçülen çalışan motor: 1.5.4 / 28158 / 2026-10-19T06:26:01Z. Kabul anında imza yaşı 24 saatin içindeydi (fresh-result.json). Temiz, EICAR, şifreli ve limit aşımı dosyaları gerçek soketle tekrar beklenen sonuçları verdi; taramalar öncesi/sonrası sürüm aynı kaldı. Son tarih ayrıştırma sıkılaştırmasından sonra gerçek set yeniden geçti. Toplam 883 uygulama testi geçti.

Karar: VERSION tarihi yerel saat formatında olduğundan yönetilen daemon TZ=UTC ile başlatıldı; bu ön koşul sağlanmadan adaptör sonucu üretim kanıtı sayılmaz. İmza yaşı her işte tekrar ölçülmeli; bu kayıttaki güncellik zamanla geçerliliğini kaybeder. Güncelleyici ayrı konteynerde ağ erişimiyle, tarayıcı network=none ve imza volume salt okunur olarak çalıştı. Güncelleyici/daemon ve socket volume kaldırıldı; bps-clam-signatures-20261020 imza volume'ü sonraki kabul için yerelde korundu, şirket verisi içermez.

Sınır: sunucu config ölçüm adaptörü hâlâ eksik; imza sürümü ölçmek motor ayarlarını doğrulamak değildir. Storage/SQL/işçi birleşik yerel kabulü ve upload route bağlantısı tamamlanmadan karantina migration'ı yayımlanmaz. Üretim değişmedi; canlı antivirüs aktif değil.


## 20 Ekim — çalışan motor ayarı ölçümü ve gerçek işçi akışı

workers/hr-malware/config.mjs eklendi. Sıkı izinli config anahtar listesi ve SHA-256 pini; PDF/heuristic/şifreli/limit uyarılarının açık olması, limitler, socket yolu ve izinleri kontrol edilir. Duplicate, Include, ExcludePath veya bilinmeyen override reddedilir. Üretim modunda 660 ve 10M; kabul testinde açık acceptanceOnly ile 666 ve 1M sınırı desteklenir.

Linux ölçüm adaptörü paylaşılan PID namespace içinde clamd komut satırını, süreç başlangıç kimliğini, TZ=UTC ortamını, config mount'un salt okunur olmasını ve soket inode/device eşleşmesini kontrol eder. VERSION ölçümünden sonra süreç kimliğini yeniden kontrol eder. Yanlış config özeti gerçek motor üzerinde reddedildi. Bu kanıt yalnız güvenilir başlatıcının sabit imajı ve doğru config'i başlangıçtan itibaren salt okunur bağladığı yönetilen kurulum içindir; keyfî bir daemon'un ne yüklediği sırf sonradan config okuyarak ispatlanamaz. Üretim dağıtım tanımı henüz yapılmadı.

config-job-accept.mjs / config-job-result.json: gerçek ClamAV + gerçek config/süreç/soket ölçümü + runHrScan çekirdeğiyle üç iş geçti. Temiz PDF complete=true; şifreli ve limitli PDF complete=false/infected. İçerik özeti ve boyut gerçek sentetik dosyalardan hesaplandı. Storage read/persist bu testte sentetik adaptördür; tam veritabanı/Storage entegrasyonu değildir. 886 uygulama testi geçti; üretim config kabulü ek doğrulaması sonrasında üç config testi ayrıca geçti.

Geçici daemon ve socket volume kaldırıldı; üretime dokunulmadı. Kalan kapanış: gerçek yerel Storage ve guarded SQL raporlama ile birleşik tarama/finalize kabulü, upload route'un yeni akışa bağlanması, güncel şema/yayın sırası kontrolü. Antivirüs henüz canlıda aktif değil.


## 20 Ekim — gerçek Storage / ClamAV / SQL birleşik kabulü

BPS_RELEASE_BARRIER=1 BPS_HR_MALWARE_HTTP=1 node qa/contract-write-20261015/storage-http.mjs ile 31 HTTP kabul grubu geçti. Yeni hook aday karantina SQL'lerini yalnız geçici sentetik veritabanına uygular. storage-accept.mjs gerçek Storage'a PDF yükler; ayrı Linux işçisi ölçülen ClamAV config/sürümüyle Storage adaptöründen dosyayı okur, runHrScan ile tarar ve hr_malware_report_v1 RPC'sine kaydeder. storage-runner.mjs içinde yerel proxy yalnız testteki Storage'ın /storage/v1 yolunu eşler; gerçek Storage/PostgREST istekleri taklit edilmez.

storage-result.json: temiz PDF tarama öncesi indirilemez/finalize edilemez; başarılı taramadan sonra yayımlanır ve indirilebilir; finalize tekrarı tek metadata kaydı bırakır. Şifreli ve 1 MiB tarama limitini aşan PDF'ler infected/complete=false raporuyla pending kalır; kullanıcı okuyamaz ve finalize reddedilir. Bekleyen yüklemeler modül kapatmayı engeller. Motor, Storage HTTP, PostgREST, guarded SQL ve işçi adaptörleri bu kez birlikte gerçektir; yalnız veriler ve JWT'ler sentetiktir.

Test geçici veritabanını, Storage/PostgREST/ClamAV/işçi konteynerlerini ve socket volume'ünü kaldırdı. İmza volume'ü sonraki ölçüm için korundu. Üretim hesabı/verisi kullanılmadı. Bu tur yalnız kabul araçları ve kanıtları değişti; genel uygulama testleri tekrar edilmedi.

Karar: ClamAV ayrı yönetilen servis olarak kalır; Vercel upload route içinde Unix soketi veya kalıcı daemon varmış gibi entegrasyon yapılmayacak. Yükleme ekranına bağlamadan önce tarama işinin güvenilir teslimi/yeniden denemesi ve bekleyen durumun kullanıcıya gösterilmesi tamamlanmalı. Aday SQL hâlâ production migration zincirinde değil. Kalan: uygulama/ayrı işçi servis bağlantısı ve kullanıcı akışı; ardından güncel canlı şema ve yayın sırası kontrolü. Bu kabul productionReady anlamına gelmez, canlı antivirüs hâlâ aktif değil.


## 20 Ekim — dayanıklı tarama kuyruğu SQL adayı

qa/hr-quarantine-20261020/queue.sql eklendi; production migration değildir. Kullanıcı doğrulanmış pending dosyayı bir kez kuyruğa ekler. Tablo RLS ve doğrudan erişim kapalıdır. Servis işçiye 2 dakikalık rastgele lease verir; yalnız geçerli worker/lease sonuç kaydedebilir. Tarama raporu ve iş durumu aynı transaction içinde tamamlanır. Kuyruk adayı uygulandığında eski service_role doğrudan report yetkisi kaldırılır; lease kontrolü atlanamaz.

Kararlar: en çok 3 deneme, hata sonucu sonrası 30 saniye bekleme. Çöken işçinin süresi bitince yeni lease üretilir; eski işçi sonuç gönderemez. Üçüncü çökme/hata failed olur, sıradan enqueue bütçeyi sıfırlamaz. Infected sonucu blocked olur. Tamamlanan isteğin birebir tekrarı aynı durum makbuzunu döndürür; farklı rapor çakışma hatasıdır. Kullanıcı JWT'si veya dosya içeriği kuyrukta saklanmaz. Temizleme istenmiş veya yayımlanmış yükleme yeniden alınmaz; eski iş kaydı denetim için kalır.

queue-accept.mjs gerçek geçici PostgreSQL'de 6 grup geçti. İki ayrı eşzamanlı oturum tam bir lease ve bir attempt aldı. Süresi dolmuş/eski/yanlış işçi lease reddi, hatalı raporda atomik geri alma, backoff, üç deneme sınırı, tek tarama/tek yayın, aynı tamamlamanın tekrarı, çelişen rapor, infected ve cleanup kontrolleri geçti. Veritabanı test bitiminde kaldırıldı. Ürün TypeScript değişmedi; genel uygulama testleri tekrar edilmedi.

Kalan: işçi runner'ın claim/complete API'sine geçmesi, kullanıcı oturumu saklamadan işçinin güncel kapsam kontrolü, API/UI bekleyen tarama akışı. Önceki storage-accept testi queue.sql uygulamaz; eski report yetkisiyle çalışır. Kuyruk entegrasyonu tamamlandığında birleşik kabul yeni lease akışıyla tekrar edilmelidir. Adaylar birlikte üretime hazır sayılmaz. Üretim değişmedi.


## 20 Ekim — kullanıcı JWT'siz lease işçisi ve birleşik kabul

queue.sql içine hr_malware_context_v1 eklendi: servis rolü + geçerli worker/lease, güncel yönetici üyeliği, şirket seçimi (eski tek üyelikli hesap için mevcut fallback kuralı), açık İK kullanım hakkı, pending/cleanup, nesne sahipliği/MIME/boyut kontrolleri. Aynı kontrol yeni sonuç kaydından hemen önce de yapılır. Kullanıcı iddiası taklit edilmez veya JWT üretilmez/saklanmaz. Mevcut özel evrak yazma yetkisi yalnız yönetici olduğundan işçi de aynı sınırı uygular.

workers/hr-malware/leased-storage.mjs, bounded Storage adaptörünü context/complete RPC'lerine bağlar; tamamlanma makbuzunun id/durumunu doğrular. storage-runner artık service claim alır ve kullanıcı token'ı olmadan tarar. Gerçek HTTP kabulüne queue.sql dahil edildi; eski doğrudan raporlama yetkisi kapalıyken test geçti.

Kanıt: 889 uygulama testi, 7 geçici PostgreSQL kuyruk grubu, 31 gerçek HTTP kabul grubu geçti. Son HTTP tekrarında clean işin complete, şifreli/limit işlerinin blocked durumu SQL'den ayrıca doğrulandı. storage-result.json leasedExecution=true ve userJwtPassedToWorker=false içerir. Yönetici rolü kaldırılınca context ve completion reddedildi; cleanup context'i kapattı; bekleyen dosya kullanım hakkı kapatmasını engelledi. Geçici servisler ve DB test sonunda kaldırıldı.

Test düzeltmeleri: ilk denemede workspace_selections kaydı olmayan eski tek şirket hesabı gereksiz reddediliyordu; mevcut current_user_active_tenant kuralındaki tek üyelik fallback'i uygulandı. Başka bir denemede kullanım hakkı kapatma test hazırlığı mevcut HR_UPLOADS_PENDING korumasına takıldı; koruma atlanmadı, beklenen ret olarak teste işlendi.

Sınır: bu, yerel worker runner entegrasyonudur; kalıcı işçi dağıtımı ve upload route/UI hâlâ bağlı değildir. Sonraki paket kullanıcıya bekleyen/taranıyor/engellendi durumları ve idempotent enqueue/finalize akışıdır. Production migration/yayın yapılmadı; canlı antivirüs aktif değil.


## 20 Ekim — kullanıcıya güvenli tarama durumu

hr_malware_status_v1 aday RPC'si yalnız mevcut yetkili yükleme sahibine durum döndürür; şirket/kişi/yükleme kimliği doğrulanır. Yanıtta worker, lease, ham rapor veya dosya içeriği bulunmaz. Kuyruğa alınmamış, bekleyen, taranan, hazır, engellenen, başarısız, süresi geçmiş, yayımlanmış ve iptal durumları ayrılır. Temiz raporun 5 dakika / imza 24 saat güncelliği korunur. İstemci ayrıştırıcısı kapsam uyuşmazlığını ve bilinmeyen durumları reddeder; yalnız ready sonlandırma adayıdır, nihai yetki ve içerik denetimi veritabanında kalır.

Kanıt: 891/891 uygulama testi, 8 gerçek geçici PostgreSQL kuyruk test grubu ve TypeScript denetimi geçti. Rol geri alma, yanlış yükleme, süre aşımı ve lease bilgilerinin dışarı çıkmaması doğrulandı. Gerçek ClamAV/Storage birleşik testi bu değişiklikte tekrar çalıştırılmadı; önceki kanıt ayrı tutuldu.

Karar: süresi geçmiş temiz sonucu otomatik yeniden kuyruğa almıyoruz; yeniden tarama için açık, sınırlı ve idempotent işlem tasarlanmalı. Failed/blocked sonuç sıradan enqueue ile temizlenmez veya deneme bütçesi sıfırlanmaz. Sonraki paket yeniden tarama sözleşmesi ve ardından asenkron upload API/UI bağlantısıdır. Kalıcı işçi dağıtımı, production migration ve canlı antivirüs aktivasyonu yapılmadı.


## 20 Ekim — sınırlı ve idempotent yeniden tarama

Aday hr_malware_rescan_v1 yalnız pending yüklemenin yetkili sahibine, tamamlanmış temiz fakat süresi geçmiş sonuç için yeniden tarama verir. Güncel doğrulama bağlamı her çağrıda kontrol edilir. İstek UUID'si kuyrukta tutulur; aynı isteğin queued/running/complete aşamalarındaki tekrarı yeni iş veya deneme oluşturmaz. Yeni taramada eski lease iptal edilir. Toplam deneme sayısı sıfırlanmaz: yükleme ömrü boyunca en çok 3. Engellenmiş/başarısız iş, hâlâ güncel temiz sonuç veya bütçesi bitmiş sonuç yeni isteği reddeder. İstemci durum modeli yalnız expired ve 1–2 denemeli sonuçta canRescan verir; sunucu kontrolünün yerine geçmez.

Karar: güvenlik kontrolünü aşabilen genel “tekrar dene” yerine yalnız eski temiz sonuç yenilenebilir. Üç hakkı dolan yüklemenin kullanıcı akışı ayrıca açıklanmalı; otomatik sonsuz tekrar yok. Aynı istek kimliği istemci tarafından tekrar gönderimde korunmalı. Bu sözleşme henüz upload API/UI'ye bağlanmadı.

Kanıt: 892/892 uygulama testi, 9 gerçek geçici PostgreSQL test grubu, TypeScript ve diff kontrolü geçti. Yenileme sırasında eski lease reddi, isteğin üç aşamada tekrarı, yeni sonuçtan sonra eski isteğin iş başlatmaması, fresh/blocked/failed retleri ve toplam üç hak sınırı test edildi. ClamAV/Storage birleşik kabul bu SQL ve durum modeli paketinde tekrar edilmedi. Production migration, dağıtım veya canlı tarama aktivasyonu yapılmadı. Sonraki iş: asenkron upload API/UI ve kalıcı worker işletimi.


## 20 Ekim — asenkron karantina API ve form bağlantısı (kapalı)

BPS_HR_MALWARE_ENABLED=true olduğunda upload route artık kullanıcı kapsamıyla prepare → upsert:false Storage upload → doğrulama bağlamı → enqueue → durum kontrolü yürütür. Pending makbuz HTTP 202 döner; kullanıcı üzerinden karantina dosyası indirilmez, route servis anahtarı oluşturmaz ve evrakı sonlandırmaz. Kuyruk/bağlam hatasında eski senkron yola fallback yapılmaz. Mevcut ayar kapalıyken eski davranış korunur; yeni ayar hiçbir ortamda açılmadı.

Yeni /api/hr/documents/scan POST uç noktası preview+malware bayrakları, aynı origin, doğrulanmış kullanıcı ve seçili şirket kontrolü uygular. Gövde akış sırasında 4096 byte ile sınırlıdır. Durum sorgusu, request UUID ile yeniden tarama ve temiz güncel sonuçta finish desteklenir. Her mutasyondan önce çalışan kapsamı doğrulanır; finish RPC son yetki/içerik/güncellik denetimidir. Form pending makbuzu başarıyla yayımlanmış saymaz; durum kontrolü, evrakı kaydet ve yeniden tara düğmeleri eklendi. Kayıp yeniden tarama yanıtında aynı istek UUID'si korunur. Otomatik polling yerine kullanıcı kontrollü yenileme seçildi.

Kanıt: 897/897 uygulama testi ve TypeScript geçti. Beş yeni servis testi gerçek TypeScript yürütür: karantina indirmeme/attest/finish çağırmama, kayıp Storage cevabı, context/queue hataları, yanlış hash, yayımlanmış tekrar, hazır olmadan finalize reddi, son RPC stale reddi ve farklı çalışan kapsamını mutasyondan önce reddetme. Bu tur tarayıcı üzerinden form kabulü ve gerçek worker/Storage/HTTP birleşik kabul çalıştırılmadı; UI bağlantısı bu doğrulamalar bitmeden kabul edilmiş sayılmaz.

Yayın engeli: candidate.sql → worker-report.sql → queue.sql üretim ön kontrolü/migration sırası, kalıcı worker kurulumu, güncel imza/config ölçümü, yeni route+form+gerçek worker uçtan uca kabul ve ardından kontrollü bayrak aktivasyonu. Bayrak tek başına güvenlik kurulumu değildir; SQL koruması olmadan açılmamalı. Sonraki paket bu yeni asenkron akışın tarayıcı ve gerçek HTTP kabulüdür. Üretim değişmedi.


## 20 Ekim — asenkron form ve gerçek uygulama servisi kabulü

Gerçek HrDocumentUpload bileşeni ayrı yerel Next uygulamasında CUA tarayıcı ile denendi. Sentetik API sınırında taranıyor → hazır → kaydet akışında kaydedilen sayı 0'dan 1'e çıktı. Engellenmiş sonuçta kaydet/yeniden tara yoktu. Süresi geçmiş sonuçta yeniden tara çıktı; işlemden sonra “Tarama bekliyor” ve kaydedilen sayı 0 görüldü. Kanıt: qa/hr-quarantine-20261020/browser-result.json ve browser-rescan.png. Form testi gerçek kullanıcı/üretim/API oturumuna bağlı değildir.

storage-accept.mjs artık gerçek enqueueHrDocumentUpload ve actOnHrDocumentScan TypeScript servislerini kullanıyor. Gerçek yerel Storage HTTP + PostgREST + geçici PostgreSQL + ölçülmüş ClamAV + lease işçisiyle 31 kabul grubu geçti. Yükleme pending, sorgu queued, tarama sonrası temiz ready/diğer blocked, sonlandırma temiz published doğrulandı. Şifreli ve limit dosyaları okunamaz/yayımlanamaz kaldı. storage-result.json realApplicationService=true, nextRouteTested=false olarak kapsamı ayırır.

Kalan somut kabul: Next upload/scan route seviyesinde oturum/origin/gövde limiti ve bayrak testleri; dosya seçimiyle tam form→gerçek route→worker birleşimi; kalıcı worker işletimi ve üretim ön kontrolü. Bu tur ürün kodu değişmedi, önceki 897 uygulama testi tekrar çalıştırılmadı. Geçici tarayıcı sekmeleri, uygulama ve test servisleri kapatıldı; gerçek veri kullanılmadı. Üretim yayını ve bayrak aktivasyonu yok.


## 20 Ekim — route güvenlik kabulü ve gövde okuma süresi

Yeni scripts/hr-scan-route.test.mjs gerçek scan/upload POST kodunu ve gerçek uygulama servislerini yürütür; yalnız Supabase oturum/RPC sınırı sentetiktir. Kapalı preview/malware, eksik/farklı/bozuk origin, oturumsuz JSON 401, yanlış şirket/kullanıcı/çalışan kimliği, bilinmeyen işlem, bozuk JSON, yanlış Content-Length ile 4096 byte üzeri gövde, no-store yanıtı, blocked finalize reddi, iç hata ayrıntısının saklanması, ready finalize ve rescan UUID kontrolü test edildi. Canlı HTTP oturumu veya dağıtılmış Next sunucusu testi değildir.

Bulgu ve düzeltme: boyut sınırı olan body reader için okuma süresi yoktu. readHrScanRequest artık 12 saniyelik toplam okuma/JSON ayrıştırma yarışı, 4096 byte sınırı ve katı UTF-8 uygular. Hata/başarı sonunda okuyucu iptal edilir; iptal sağlayıcısının yanıtı handler'ı bekletmez. Testte bekleyen stream kısa test süresinde iptal edildi; bozuk UTF-8 reddedildi. Dönüşte nesne yapısı açıkça kontrol edilir.

Kanıt: 905/905 uygulama testi (8 yeni route grubu dahil), TypeScript ve diff kontrolü geçti. Önceki gerçek Storage/ClamAV testi bu body-reader değişikliğinde tekrar edilmedi. Kalan: gerçek oturumlu Next HTTP/form dosya seçimi birleşik kabulü, kalıcı worker dağıtım/işletim planı ve üretim ön kontrolü. Bayraklar açılmadı; üretime yayın yapılmadı.


## 20 Ekim — yönetilen işçi döngüsü ve çalıştırma girişi

workers/hr-malware/coordinator.mjs tek yapılandırılmış şirket için sıralı işleme yapar. Claim öncesi aynı job.mjs motor politikası/güncellik doğrulaması uygulanır; eski imzalar deneme bütçesini tüketmez. Dönen lease şirketi, kimlikleri, attempt 1–3 ve kalan süre 90–150 saniye aralığıyla doğrulanır. İşlem hatası sahte tarama raporu üretmez; lease SQL'de zaman aşımına bırakılır. Boş kuyrukta 5 saniye, iş sonrasında 1 saniye, hatada 30 saniye beklenir. Beş ardışık hata döngüyü durdurur. SIGTERM/SIGINT yeni iş almayı durdurur, başlamış işi tamamlar. Günlükler yalnız sabit durum/zaman/sayaç içerir.

main.mjs Linux sidecar başlangıcıdır. BPS_SCAN_TENANT ve BPS_SCAN_WORKER UUID'leri, BPS_SCAN_ORIGIN HTTPS kök adresi, BPS_SCAN_CONFIG_SHA256 sabit yapılandırma özeti gerekir. Servis anahtarı yalnız /run/secrets/bps_scan_service_key dosyasından okunur (grup/diğer erişimi kapalı); daemon'a verilmez. @supabase/supabase-js bağımlılığı kurulu olmalı. Socket /run/bps-clam/clamd.sock, config salt okunur /qa/clamd.conf, daemon PID namespace paylaşımı ve TZ=UTC mevcut ölçüm sözleşmesidir. Yeni workers/hr-malware/clamd.conf üretim politikasıdır: socket 660, MaxFileSize 10M; testteki 666/1M istisnaları yoktur.

Kanıt: genel uygulama paketi 909/909 geçti; son eklenen config kontrolü dahil odaklı coordinator paketi 5/5 geçti. Gerçek uygulama servisi + yeni coordinator cycle + Storage/PostgREST/DB/ClamAV 31 kabul grubu geçti; storage-result realCoordinatorCycle=true. Main girişinin sözdizimi kontrol edildi; tam sürekli Linux entrypoint/secret mount ve üretim daemon config birlikte çalıştırılmadı. Kabul daemon'u hâlâ ayrı acceptance config kullanır. Bu ayrım üretim hazır iddiasını engeller.

Kalan dağıtım işleri: güvenilir sabit image/launcher, UID/GID socket erişimi, read-only secret/config mount, imza güncelleme→daemon yeniden yükleme/yeniden başlatma ve tazelik alarmı, supervisor yeniden başlatma sınırı, graceful-stop süresi, gerçek oturumlu Next tam akış kabulü ve üretim şema ön kontrolü. Anahtar sağlayıcı/host kurulmadı, üretim yayını ve bayrak aktivasyonu yapılmadı.


## 20 Ekim — bağımsız RPC taşıyıcısı ve sağlık göstergesi

main.mjs artık Supabase SDK'ya ihtiyaç duymaz; service.mjs yalnız hr_malware_claim_v1, hr_malware_context_v1, hr_malware_complete_v1 çağrılarına izin verir. HTTPS kök adresi, redirect:error, 12 saniye ağ sinyali, JSON MIME/UTF-8 ve 16 KB cevap sınırı vardır. HTTP/JSON/boyut hataları sabit HR_WORKER_RPC_UNAVAILABLE döner; servis cevabı veya anahtar loga taşınmaz. Bu allowlist servis anahtarının veritabanı yetkisini daraltmaz, yalnız istemci davranışını sınırlar.

health.mjs /run/bps-worker/health.json dosyasını 0600 ve atomic rename ile yazar. Başlangıç unavailable; başarılı motor+claim/tarama sonrası idle/complete/blocked sağlıklı kabul edilir. Hata/durma anında unhealthy, son ilerleme 150 saniyeden eskiyse unhealthy olur. node workers/hr-malware/health.mjs çıkış kodu 0/1 döndürür. Çalıştırıcı /run/bps-worker dizinini yalnız worker kullanıcısına yazılabilir sağlamalıdır. Koordinatör event yazımını await eder; sağlık yazılamıyorsa çalışmaya güvenilir görünümle devam edilmez.

Kanıt: 913/913 uygulama testi, runtime+coordinator odaklı 8 test ve main sözdizimi/diff kontrolü geçti. Yeni HTTP taşıyıcısı bu tur gerçek HTTPS Supabase sunucusuna bağlanmadı; taşıma testinde fetch sınırı sentetiktir. Önceki gerçek servis kabulü eski test RPC taşıyıcısını kullanır; bununla yeni taşıyıcı için gerçek ağ kanıtı iddia edilmez.

Dağıtım kararı: hazır production compose/host kurulumu henüz yapılmıyor. Mevcut /proc ölçümü worker'ı daemon PID namespace'ine bağlar; aynı UID/root ile iki yönlü /proc üzerinden worker dosyası okuma riski ayrıca doğrulanmalıdır. Anahtarı clamd'a doğrudan mount etmemek tek başına izolasyon kanıtı değildir. Sentetik anahtarla süreç/UID/proc erişim kabulü ve gerekirse ayrı kimlik/ölçüm mimarisi tamamlanmadan gerçek service key bağlanmayacak. Bu, üretimde tespit edilmiş bir olay değil; yerel tasarımın açık dağıtım kabul şartıdır. Sonraki paket: bu izolasyon testi ve gerçek HTTPS taşıyıcı kabulü. Üretim değişmedi.


## 20 Ekim — gerçek Docker süreç izolasyonu bulgusu ve koruması

qa/hr-worker-isolation-20261020/accept.mjs gerçek Docker süreçleri ve yalnız sentetik 0600 canary dosyasıyla çalıştırıldı. Aynı UID=0/PID namespace düzeninde daemon rolündeki süreç worker'ın /proc/PID/root/run/secrets/canary dosyasını, environ ve fd listesini okuyabildi; kill(pid,0) erişim kontrolü de geçti. Bu yerel tasarım testidir, üretim ihlali değildir; gerçek anahtar kullanılmadı.

Çözüm adayı: daemon UID/GID 10001, tüm capability'ler kapalı, no-new-privileges; güvenilir worker UID/GID 0, yalnız SYS_PTRACE ve DAC_READ_SEARCH, no-new-privileges, socket 660 erişimi için ek grup 10001. Aynı testte daemon'ın worker anahtar/ortam/fd/sinyal erişimleri reddedildi; worker daemon environ/mountinfo/root ölçümünü yapabildi. İlk denemede yalnız SYS_PTRACE yetmedi: environ EACCES verdi. DAC_READ_SEARCH eklenince ölçüm geçti; daha geniş DAC_OVERRIDE verilmedi.

workers/hr-malware/isolation.mjs bu UID/GID/capability/NoNewPrivs/ek grup sözleşmesini doğrular; config.mjs üretim modunda motor sorgusundan önce uygular. Aynı UID veya gereksiz capability ile fail closed. acceptanceOnly eski sentetik ClamAV düzeni için istisnadır; main.mjs bunu açmaz. İşçi hâlâ güvenilir ve ayrıcalıklı bileşendir; bu koruma host/kernel/container-runtime güven sınırının yerini tutmaz.

Kanıt: 915/915 uygulama testi geçti. Son ek grup şartından sonra odaklı 2 test ve gerçek Docker izolasyonu yeniden geçti. result.json aynı UID guard=rejected, ayrı UID guard=accepted ve dört daemon erişiminin false olduğunu kaydeder. Test süreçleri Node'dur (realClamav=false); yeni UID/socket/secret dizilimiyle gerçek clamd + main sürekli çalışma henüz sınanmadı. Tüm geçici container/volume kaldırıldı. Sonraki paket bu gerçek daemon birleşimi ve HTTPS taşıyıcı kabulüdür. Üretim yayını/anahtar kurulumu yok.


## 20 Ekim — gerçek ClamAV izolasyonu ve gerçek HTTPS kabulü

qa/hr-worker-isolation-20261020/clamd-accept.mjs gerçek ClamAV'ı UID/GID 10001, cap-drop ALL, no-new-privileges, read-only kök, ağsız ve yazılabilir sınırlı /tmp ile başlattı. Socket volume 10001:10001/0770; socket dosyası üretim config'inde 660. Gözlemci worker root, ek grup 10001 ve yalnız SYS_PTRACE+DAC_READ_SEARCH ile bağlandı. verifyProcessIsolation ve üretim verifyClamdConfig geçti; gerçek runHrScan temiz PDF için clean, şifreli PDF için infected verdi. clamd-result.json kaydedildi. Mac'teki amd64 motor Rosetta ile çalıştığından reader'ın yalnız emülasyon kabul istisnası kullanıldı; strict isolation ve üretim config ayrıca her ölçümde/başlangıçta doğrulandı. Native Linux main girişinin sürekli servis testi olarak sunulmaz; Storage/persist adaptörleri sentetiktir.

qa/hr-worker-runtime-20261020/https-accept.mjs geçici yerel TLS sertifikası ve gerçek HTTPS sunucusu ile service.mjs taşıyıcısını sınadı. Node TLS doğrulaması açık tutuldu; yalnız test alt sürecine geçici CA tanıtıldı. Geçerli JSON alındı, 302 takip edilmedi (sunucuya tam 4 istek), 16 KB üstü ve bozuk JSON reddedildi. CA tanıtılmayan ayrı süreçte bütün istekler TLS'de reddedildi ve sunucu sayacı değişmedi. https-result.json kaydedildi. Hiçbir gerçek servis anahtarı veya harici veri aktarımı yok; geçici sertifika/anahtar dizini ve test container/socket volume temizlendi.

Bu tur ürün kodu değişmedi; önceki 915 uygulama testi tekrar çalıştırılmadı. Yeni gerçek daemon/socket ve HTTPS kabulü geçti. Kalan: native Linux'te kalıcı launcher/main+health/SIGTERM kabulü, imza güncelleme/yeniden başlatma işletimi, gerçek oturumlu Next form→API tam akışı ve üretim şema/yayın sırası. Mevcut çalışan üretime yeni worker/secret/bayrak kurulmadı.


## 20 Ekim — servis başlangıcı ve eski sağlık kaydı düzeltmesi

main.mjs işletim mantığı runtime.mjs içine taşındı; main yalnız gerçek process sinyallerini AbortController'a bağlar ve halted durumunda exit 1 verir. Runtime ilk işlem olarak unavailable sağlık yazar; ardından config/secret/motor hazırlanır. Önceki sırada secret/config hatası eski sağlıklı kaydı TTL süresince bırakabiliyordu. Artık startup hatası da unavailable kaydını yeniler; ham hata/key loglanmaz. Runtime test bağımlılıkları yalnız fonksiyon parametresidir, çevre değişkeniyle üretim ölçümü atlanmaz.

Config UUID/digest/HTTPS kök adresi en başta doğrulanır. Secret okuyucu O_NOFOLLOW ile açar; izin/sahip ve byte kontrolünü aynı file descriptor üstünde yapar. Yalnız root sahipli normal dosya, grup/diğer izni kapalı, 1–8192 byte; boş/iç boşluk/kontrol karakteri olan anahtar reddedilir. Okuyucu en çok 8193 byte alır. Docker secret mount bu koşulları sağlamalıdır.

Kanıt: 920/920 uygulama testi, 5 yeni lifecycle grubu dahil geçti. Sentetik lifecycle testinde mevcut iş tamamlanıp stopped sağlık yazıldı; hatalı config ve secret hatasında başarı kalmadı. qa/hr-worker-runtime-20261020/startup-accept.mjs gerçek Linux Node konteynerinde gerçek main ve health girişlerini çalıştırdı: root/0600 sentetik key okundu, eksik config main exit 1 verdi, önceki idle health unavailable oldu, health komutu exit 1 verdi. startup-result.json kaydedildi; test volume temizlendi. Bu gerçek daemon ile başarılı sürekli main çalışması veya gerçek SIGTERM entegrasyon testi değildir.

Kalan: native Linux gerçek main+ClamAV+HTTPS işleme ve SIGTERM kabulü, imza güncelleme/yeniden başlatma işletimi, gerçek oturumlu Next form/API birleşimi, üretim şema/yayın sırası. Bu tur yeni canlı hizmet veya anahtar kurulmadı; üretim değişmedi.


## 20 Ekim — gerçek çalışma döngüsü, HTTPS ve SIGTERM birleşik kabulü

qa/hr-worker-runtime-20261020/continuous-accept.mjs ayrı UID'li gerçek ClamAV, internal Docker ağındaki geçici TLS API, salt okunur sentetik key mount, worker runtime ve sağlık dosyasını birlikte çalıştırdı. API sınırı sentetik claim/context/Storage/complete cevapları üretir; taşıyıcı ve worker kodu gerçektir. Gerçek temiz PDF indirilip hash/binding kontrolünden ve clamd taramasından geçti.

Complete isteği sunucuya ulaştığında yanıt 5 saniye bekletildi; bu sırada docker kill --signal TERM gönderildi. Worker başlayan işi tamamladı, exit 0 ile durdu. Sunucu sayaçları claims=1, completionStarted=1, completed=1 ve validReport=true; ikinci claim alınmadı. Sağlık dosyası stopped oldu, logda complete görüldü, sentetik anahtar loga çıkmadı. continuous-result.json kanıtı kaydedildi. Geçici network/container/volume/TLS dosyaları temizlendi.

Kapsam: realClamav/realHttps/realRuntime/realSigtermDuringCompletion=true; realDatabase=false. Bu Mac kabulünde daemon Rosetta ile çalışır; test girişindeki engine reader emülasyona izin verirken strict process isolation ve üretim config kontrolünü uygular. Üretim main girişi değiştirilmedi; productionMainEntry=false, productionReady=false. Native Linux production main + gerçek PostgREST/Storage uçları için kabul hâlâ gerekir. Ürün kodu değişmedi; önceki 920 uygulama testi tekrar edilmedi. Yeni üç test dosyasının sözdizimi ve diff kontrolü geçti.

Kalan işletim paketi: imza dosyalarını ayrı güncelleyicide hazırlama, daemon'u kontrollü yeniden başlatma ve yeniden ölçüm, native Linux launcher/supervisor sınırları, gerçek oturumlu Next form/API birleşimi ve üretim şema ön kontrolü. Üretim yayını veya gerçek anahtar kurulumu yok.


## 20 Ekim — bakım kapısı ve imza yenileme sözleşmesi

Worker bakım işaretini motor ölçümünden önce ve claim öncesinde denetler. Bakım başlayınca mevcut işi bitirir, maintenance sağlık durumuna geçer ve yeni iş almaz. Maintenance hazır/sağlıklı sayılmaz. İşaret root sahipli normal dosya olmalı; sembolik bağlantı veya yazılabilir güvensiz izinler hata verir. Üretimde kontrol dizini host tarafından yönetilip worker'a salt okunur bağlanmalıdır.

maintenance.mjs imza yenileme sırasını tanımlar: kilit → bakım → mevcut işin bitişi → aday hazırlama → daemon durdurma → imzaları etkinleştirme → yeniden başlatma → ölçüm → devam. Eski imzaya dönüş, bayat/gelecek tarih, aynı daemon instance, farklı config veya beklenen imzayı yüklemeyen motor reddedilir. Hata durumunda otomatik devam/geri dönüş yok. Bu fonksiyonun host adaptörleri henüz hazırlanmadı; gerçek imza indirme/volume değiştirme/daemon yenileme tamamlanmış değildir.

Kanıt: 925/925 uygulama testi geçti; bunların 5'i yeni bakım/yenileme test grubudur. BPS_TEST_MAINTENANCE=1 ile continuous-accept.mjs gerçek ClamAV + HTTPS + runtime üzerinde çalıştı: devam eden tek iş tamamlandı, maintenance görüldü, claims=1 kaldı; ardından SIGTERM ile exit 0/stopped. maintenance-result.json kaydedildi. Sentetik API cevapları kullanıldı, gerçek DB yok; Mac/Rosetta kabulü üretim main/native Linux kabulünün yerine geçmez. Geçici kaynaklar temizlendi.

Kalan: gerçek host launcher ve imza güncelleme adaptörleri, native Linux üretim main kabulü, gerçek oturumlu Next form/API birleşimi ve üretim şema/yayın sırası. Canlıya yayın, gerçek anahtar kurulumu veya İK aktivasyonu yapılmadı.


## 20 Ekim — host bakım kilidi ve isteğe bağlı tamamlanma kanıtı

host-control.mjs gerçek dosya sistemi üstünde O_EXCL kilit, root/0600 bakım isteği yazımı, güncel worker onayı bekleme ve aynı isteği kaldırma adaptörlerini ekler. Host dizinleri önceden güvenli sahiplik/izinlerle hazırlanmalı; kontrol dizini worker'a salt okunur, sağlık dizini ayrı bağlanmalıdır. Mevcut kilit veya bakım isteği otomatik silinmez; çökme sonrası operatör incelemesi gerekir. Eski release çağrısı yeni kilidi kaldıramaz.

Bakım işareti artık JSON requestId UUID taşır; worker aynı kimliği maintenance sağlık kaydına geçirir. Boş/eski biçimdeki işaret reddedilir. İşaret O_NONBLOCK/O_NOFOLLOW ve en fazla 513 byte okunur; FIFO'da bekleme ve sembolik bağlantı engellenir. Host yalnız aynı UUID'yi taşıyan, son 15 saniye içinde yazılmış maintenance kaydını kabul eder; en fazla 150 deneme sonrası hata ile beklemeyi bırakır ve bakım korunur. Bu kontrol aynı host zamanına dayanır.

Kanıt: genel uygulama kontrolü 928/928 geçti. Son kilit-release düzeltmesi sonrası odaklı host testleri 4/4 geçti. Gerçek ClamAV + HTTPS runtime kabulü yeniden geçti; worker sağlık kaydındaki bakım kimliği istekle birebir eşleşti, mevcut tek iş tamamlandı ve claims=1 kaldı. API/DB cevapları sentetik, daemon Mac/Rosetta; native Linux üretim kabulü değildir.

Entegrasyon sınırı: createHostControl.waitDrained yalnız işçinin durakladığını doğrular; rotateSignatures için host adaptörü bunun ardından eski motor baseline ölçümünü döndürmelidir. Güncel olmayan imza baseline'ı bakım sebebi olabileceğinden ayrı ölçülür. Bu tur gerçek imza indirme, signature volume değişimi veya daemon yeniden başlatma adaptörleri eklenmedi. Üretim/İK bayrakları değişmedi. Sıradaki iş bu adaptörler ve native Linux launcher kabulüdür.


## 20 Ekim — gerçek FreshClam ile ayrı imza hazırlama

signature-stage.mjs her çalışmada UUID ile yeni Docker volume oluşturur; canlı imza alanını yazılabilir bağlamaz. İsteğe bağlı önceki imza volume'u salt okunur kaynak olarak yalnız main/daily/bytecode CVD/CLD normal dosyalarını sağlar. Sabit digest'li ClamAV image, UID/GID 10001, cap-drop ALL, no-new-privileges, read-only root, sınırlı tmpfs ve bellek ile FreshClam çalışır. Güncelleyici uygulama dosyası, Storage içeriği veya servis anahtarı almaz. freshclam.conf yalnız resmi database.clamav.net kaynağını ve TestDatabases yes kullanır. Referans: https://docs.clamav.net/manual/Usage/Configuration.html ve https://github.com/Cisco-Talos/clamav/blob/main/etc/freshclam.conf.sample.

Başarılı staging dahi activationReady=false döndürür; adayın ayrı daemon ile yüklenip ölçülmesi ve kontrollü geçiş hâlâ gerekir. Hatalı staging volume'u tanı için korunur; çalışan güncelleyici container'ı finally ile kaldırılır. Komutlar shell olmadan execFile ile süre/çıktı sınırları altında çalışır. Bu hazırlayıcı henüz otomatik işletim servisine bağlanmadı.

Kanıt: genel testler 932/932. signature-stage-accept.mjs gerçek FreshClam çalıştırdı, yeni staging volume'uyla ayrı ClamAV başlattı; temiz PDF clean, şifreli PDF infected/engelli çıktı. İlk rapor okuma denemesi test çıktısı JSON olmadığı için hata verdi; çıktı JSON'a düzeltildi ve kabul yeniden başarıyla geçti. signature-stage-result.json kaydedildi. Geçici staging volume/container temizlendi, önceki imza volume'u korundu. İmza sürümünün arttığı iddia edilmez: güncelleyici mevcut sürümün güncelliğini de doğrulayabilir.

Kalan: staged daemon ölçümünü rotateSignatures akışına bağlama, çalışan daemon/worker PID namespace'inin kontrollü değiştirilmesi, native Linux main kabulü, gerçek oturumlu Next entegrasyonu ve üretim ön kontrolü. Bu test Mac/Rosetta üzerinde, Storage/persist sentetik; liveDaemonRestart=false, productionReady=false. Üretime yayın veya İK aktivasyonu yok.


## 20 Ekim — daemon değişiminde işçinin yeniden bağlanması

rotateSignatures artık stopWorker/startWorker/waitWorkerPaused adaptörlerini zorunlu tutar; eksikse kilit veya bakım dahil hiçbir yan etki başlamaz. Sıra: bakım onayı ve aday hazırlığı → işçiyi durdur → eski daemon'u durdur → imza alanını değiştir → yeni daemon → yeni PID namespace'ine bağlanan işçi → bakım onayı → yeni motor ölçümü → devam. Böylece yalnız daemon yenileyip işçiyi eski süreç alanında bırakma yolu kapatıldı. Bu adımlardaki hata otomatik resume yapmaz.

Kanıt: 933/933 uygulama testi ve TypeScript kontrolü. replacement-accept.mjs gerçek FreshClam staging, gerçek ClamAV, HTTPS sentetik API ve worker runtime ile tek işi tamamladı. Bakım kimliği doğrulandı, eski işçi SIGTERM ile exit 0 verdi, eski daemon kaldırıldı. Yeni imza volume'uyla yeni daemon ve ona bağlı yeni işçi oluşturuldu. İşçi içinden yapılan ölçümde engine instance ve host PID değişti; config digest aynı kaldı, imzalar güncel ve sürüm geri gitmemişti. Ölçümden önce claims=1 kaldı. Bakım kaldırılınca ikinci claim isteği geldi; yeni iş üretilmedi (API null döndü), ilk işin completed=1 sonucu korundu. Yeni işçi de SIGTERM ile exit 0 verdi. replacement-result.json kaydedildi; geçici container/network/volume temizlendi.

Sınır: gerçek yeniden oluşturma kabulü geçmiştir, ancak bu test Docker adımlarını QA sürücüsüyle yürütür; üretim host launcher'ının tamamı veya rotateSignatures'ın gerçek host adaptörleriyle uçtan uca kabulü değildir. Mac/Rosetta ölçüm istisnası yalnız QA girişindedir. realDatabase=false, productionMainEntry=false, productionReady=false. Sırada bu kanıtlanmış adımların üretim launcher'ına bağlanması, native Linux main kabulü ve gerçek oturumlu uygulama/DB birleşimi vardır. Canlıya yayın ve İK aktivasyonu yapılmadı.


## 20 Ekim — yönetilen geçiş ve Docker yaşam döngüsü adaptörü

managed-rotation.mjs host-control, staging, rotateSignatures ve deployment adaptörünü birbirine bağlar. Başarılı dönüş aktif imza volume adını da içerir. Staging artık gerçek clamscan --version çıktısını strict parser ile okuyarak aday sürüm/tarihini döndürür; daemon açıldıktan sonraki ölçüm bu adayla karşılaştırılır.

deployment.mjs yalnız kendi bps.deployment etiketi olan container'ları durdurur; düzgün kapanma (exit 0) yoksa kaldırmaz. Daemon yalnız signature-staging etiketi taşıyan aday volume'u salt okunur bağlar. Worker yeni daemon PID namespace'inde, sabit image digest ve yalnız gerekli capability'lerle açılır; main.mjs ve measure.mjs üretim kontrollerini kullanır, emülasyon istisnası yoktur. Secret/control/health/socket yolları ayrı ve iç içe olmayacak şekilde doğrulanır. Host bu dizinlerin root sahipliğini, izinlerini ve socket 10001:10001/0770 hazırlığını sağlamalıdır. Bu modül mevcut yönetilen kurulum içindir; bootstrap, otomatik supervisor veya üretim kurulumu bu tur yapılmadı.

Kanıt: genel 938/938 test geçti. Son ek volume sahiplik ve yol çakışması kontrollerinden sonra odaklı 6/6 test geçti. managed-rotation-accept.mjs doğrudan rotateManagedDeployment akışını gerçek FreshClam, ClamAV, HTTPS ve Docker değiştirme işlemleriyle çalıştırdı. Aynı imza adayının yeni daemon'da yüklendiği ölçüldü, bakım kaldırılana kadar claim alınmadı, sonrasında sorgu devam etti. managed-rotation-result.json kaydedildi; geçici kaynaklar temizlendi.

Kapsam ayrımı: bu gerçek kabulde managed orchestration ürün kodudur; Docker ve kontrol adaptörleri QA sürücüsüdür (qaDockerAdapters=true). deployment.mjs güvenlik ve komut sözleşmeleri odaklı testlerle doğrulandı; native Linux üzerinde gerçek host-control + deployment + main birleşimi hâlâ bekler. Mac/Rosetta istisnası üretim koduna taşınmadı. realDatabase=false, productionMainEntry=false, productionReady=false. Üretim yayını/İK aktivasyonu yok. Sonraki kapılar: host bootstrap/supervisor ve native Linux birleşik kabul, gerçek oturumlu uygulama/DB kabulü ve üretim ön kontrolü.


## 20 Ekim — değişiklikten önce host güvenlik ön kontrolü

host-preflight.mjs yönetilen geçişin ilk adımıdır; kilit/bakım/servis durdurma öncesinde çalışır. Native Linux x64, kernel machine x86_64 ve root gerektirir. Mac üzerinde gerçek çağrı HR_DEPLOY_NATIVE_ROOT_REQUIRED ile dosya okumaya başlamadan reddedildi. Bu koşul daemon'un native çalışmasına ilişkin nihai /proc ölçümünün yerine geçmez.

Mount yolları canonical olmalı; çift slash, nokta/üst dizin alias'ı, kök dizin ve çakışan/iç içe writable/secret mount'lar reddedilir. Config'in code altında olması desteklenir. Parent dizinler root sahibi ve grup/diğer yazmasına kapalı; health/control/secrets özel, socket 10001:10001/0770 olmalıdır. Config SHA256 eşleşmeli; anahtar root sahipli, özel izinli, normal ve sınırlı boyutlu dosya olmalıdır. Kod dosyalarında symlink veya başka kullanıcı yazma izni kabul edilmez. Secret içeriği ön kontrolde okunmaz/loglanmaz.

Kanıt: 941/941 uygulama testi geçti. preflight-accept.mjs gerçek Linux container dosya sistemi üstünde geçerli özel dizilimi kabul etti; açık izinli secret, yazılabilir control, yanlış socket sahibi, config digest farkı, secret/code symlink'lerini reddetti. preflight-result.json kaydedildi; sentetik tmpfs/container temizlendi. Bu yalnız filesystem kabulüdür (nativeHostAcceptance=false). QA managed-rotation sürücüsündeki emülasyon düzeni açık dependency seam ile preflight atlar; üretim varsayılanı atlamaz ve çevre değişkeni istisnası yoktur.

Kalan yayın kapıları değişmedi: gerçek host bootstrap/supervisor ve native Linux strict main birleşimi; gerçek oturumlu Next/DB akışı; üretim şema/yayın sırası. Host ön kontrolü yerel dosya sistemini doğrular; uzak Docker endpoint kurulumu doğrulanmış değildir. Üretime yayın, anahtar kurulumu veya İK aktivasyonu yapılmadı.


## 20 Ekim — sıkı izolasyon ile gerçek DB/Storage birleşik kabulü

Docker engine ölçümü linux/aarch64 döndü. Native x64 üretim kabulü bu hostta tamamlanmış sayılmadı. Bu tur birbirinden ayrı doğrulanan süreç izolasyonu ve gerçek DB/Storage zinciri birleştirildi.

BPS_RELEASE_BARRIER=1 BPS_HR_MALWARE_HTTP=1 BPS_HR_STRICT_ISOLATION=1 node qa/contract-write-20261015/storage-http.mjs komutu 31/31 kabul grubu geçti. ClamAV UID/GID 10001, capability yok, no-new-privileges, read-only root ve socket 660; işçi root/ek grup 10001 ve yalnız SYS_PTRACE+DAC_READ_SEARCH ile çalıştı. Her motor ölçümünde strict isolation ve üretim clamd.conf ayrıca doğrulandı. Gerçek uygulama servis fonksiyonları, PostgREST, klon sentetik PostgreSQL ve Storage HTTP kullanıldı.

Temiz PDF tarama öncesi okunamadı/finalize edilmedi; temiz sonuçtan sonra bir kez yayımlandı ve okunabildi. Şifreli PDF blocked kaldı; finalize/read reddedildi ve modül kapatma ön kontrolü engel bildirdi. strict-storage-result.json kanıtı kaydedildi. Önceki 1 MB sınır fixture'ı üretimin 10 MB politikasını temsil etmediği için bu modda çalıştırılmadı (sizeLimitFixtureTested=false); eski ayrı sınır testi korunur. Şifreli PDF için infected sonucu zararlı yazılım bulunduğu iddiası değil, şifreleme politikasının konservatif engel sonucudur.

Kapsam: realDatabase/realStorageHttp/realPostgrest/realApplicationService/realCoordinatorCycle=true. Transport yerel HTTP; daemon Mac/Rosetta; worker main sürekli servis ve gerçek oturumlu Next route/form bu testte yok. nextRouteTested=false, productionMainEntry=false, productionReady=false. Test DB/container/volume temizlendi; gerçek şirket verisine dokunulmadı. Ürün kodu değişmediğinden 941 uygulama testi yeniden çalıştırılmadı; yeni kabul, sözdizimi ve diff kontrolleri geçti.

Kalan iki ana kabul: gerçek Next oturumuyla form/API zinciri ve native Linux host launcher/main uçtan uca çalışması. Sonrasında üretim şema/yayın sırası kontrolü gerekir. Canlıya yayın veya İK aktivasyonu yapılmadı.


## 20 Ekim — gerçek Next route ve parola oturumu birleşik kabulü

BPS_HR_SCAN_ROUTE=1 yolu mevcut yerel Auth/Next harness'ine eklendi. Üretim ortam dosyası veya hesabı yerine geçici GoTrue Auth DB'sinde sentetik hesapla parola girişi yapıldı; gerçek custom access token hook kapsamı üretildi. @supabase/ssr ile gerçek oturum çerezleri oluşturuldu; Next createServerSupabaseClient/getUser kontrolü atlanmadı. Preview/malware bayrakları yalnız test alt sürecinde açıldı.

Gerçek POST /api/hr/documents/upload multipart isteği 202/pending verdi. Tarama öncesi finalize reddedildi. Gerçek PostgreSQL + PostgREST + Storage + strict UID izolasyonlu ClamAV işçisi sonrası POST /api/hr/documents/scan status ready oldu ve finalize published döndü. Temiz dosya tek kez yayımlandı. Şifreli dosya blocked kaldı; finalize ve Storage read reddedildi, modül kapatmayı engelledi. Oturumsuz scan 401, yabancı origin 403, forged actor 409 verdi; yanıtlar no-store. next-route-result.json ve next-route-storage-result.json kanıtları kaydedildi.

Komut: BPS_RELEASE_BARRIER=1 BPS_HR_MALWARE_HTTP=1 BPS_HR_STRICT_ISOLATION=1 BPS_LOCAL_BROWSER=1 BPS_HR_SCAN_ROUTE=1 BPS_HR_PREVIEW_ENABLED=true BPS_HR_MALWARE_ENABLED=true node qa/contract-write-20261015/storage-http.mjs. 30 genel Storage/tenant/yayın bariyeri kabul grubu ve ek Next upload/scan zinciri başarılı. Geçici Next/Auth/Storage/ClamAV süreçleri ve sentetik DB'ler temizlendi. Ürün kodu değişmedi; genel uygulama testleri gereksiz tekrar edilmedi.

Kapsam: realNextRoutes/realPasswordSession/realAuth/realStorage/realDatabase/realClamav=true. Bu HTTP kabulü gerçek form bileşeninde tıklama değildir (browserFormInteraction=false). Mac/Rosetta daemon, yerel HTTP ve worker coordinator kullanılır; native Linux production main kabulünün yerini almaz. Kalan: form etkileşiminin aynı gerçek altyapıyla tarayıcı kabulü, native Linux host servis kabulü ve üretim şema/yayın sırası. Üretim yayını veya gerçek şirket aktivasyonu yok.


## 20 Ekim — gerçek tarayıcı kurtarma formu kabulü

BPS_HR_SCAN_BROWSER=1 ile gerçek HrDocumentUpload bileşeni geçici /qa-hr-scan sayfasına bağlandı; sentetik hesap gerçek giriş ekranından oturum açtı. Aynı gerçek Next/Auth/PostgreSQL/PostgREST/Storage/ClamAV altyapısında tarayıcıdan “Tarama durumunu kontrol et” seçildi. Temiz PDF için “Tarama tamamlandı, kayıt bekliyor” görüldü, “Evrakı kaydet” tıklandı ve “Kaydedildi” doğrulandı. Ardından HTTP finalize tekrarının tek evrak kaydını koruduğu kabul harness'inde geçti. Şifreli PDF için “Dosya güvenlik kontrolünden geçemedi” görüldü; kaydet/yeniden tara eylemleri yoktu, tamamlama düğmesi pasifti. Backend finalize/read reddi ve modül kapatma engeli de geçti.

30 genel Storage kabul grubu ve ek HR route/worker zinciri exit 0. Kanıt: qa/hr-clamav-20261020/browser-recovery-result.json ve browser-recovery-blocked.jpg. Bu manuel CUA kontrollü kurtarma-formu kabulüdür; ilk dosya yükleme multipart HTTP ile yapıldı, tarayıcı dosya seçici veya tam İK sayfası entegrasyonu test edilmiş sayılmadı. Geçici test sayfası ve süreçler temizlendi. Mac/Rosetta + yerel HTTP/coordinator sınırı sürüyor; native Linux üretim main/host kabulü ve üretim şema/yayın sırası hâlâ gerekli. Canlı yayın/İK aktivasyonu yok.


## 20 Ekim — ilk dosya seçimiyle gerçek tarayıcı kabulü

BPS_HR_INITIAL_BROWSER=1, BPS_HR_SCAN_BROWSER=1 ve önceki gerçek Next/strict Storage test bayraklarıyla ilk yükleme kabulü tamamlandı. Gerçek HrDocumentUpload bileşeni test sayfasında recovery prop olmadan açıldı. Sentetik kullanıcı login ekranından giriş yaptı; istihdam dönemi gerçek API ile geldi. CUA dosya seçicisiyle clean.pdf ve encrypted.pdf seçildi, başlık girildi ve Yükle tıklandı. Dosya alındı/tarama bekleniyor mesajı görüldü. Tarayıcının ürettiği UUID esas alınarak DB'de tek yükleme kaydı, hash, boyut, başlık ve istihdam dönemi eşleşmesi doğrulandı.

Temiz dosya gerçek ClamAV sonrası ready oldu; aynı formda Evrakı kaydet tıklandı ve Kaydedildi görüldü. Tek kayıt/idempotent finalize, karantina öncesi okuma yasağı ve sonrasında okuma geçti. Şifreli dosyada güvenlik engeli, kaydet/yeniden tara seçeneğinin bulunmaması ve backend finalize/read reddi geçti; kapanış ön kontrolü engeli korundu. 30 genel Storage grubu ve HR zinciri exit 0. browser-initial-result.json ile browser-initial-saved.jpg / browser-initial-blocked.jpg kaydedildi. Bu manuel CUA checkpoint kabulüdür; tam İK sayfasının navigasyon/entegrasyon kabulü değildir.

Üretim yayını ve gerçek şirket aktivasyonu yok. Native Linux x64 sürekli worker main/host kabulü, ardından güncel üretim şeması/yayın sırası kontrolü bekliyor. Geçici sayfa kaldırıldı; Next route tipleri yeniden üretildi ve geçici sayfanın eski üretilmiş tip dosyası temizlendi.


## 20 Ekim — yönetilen tarama servisi ilk başlatma kapısı

workers/hr-malware/bootstrap.mjs eklendi. Native root host/dosya ön kontrolü → ortak lifecycle kilidi → ayrılmış container adlarının boş olduğunu doğrulama → nonce pause → daemon → worker → güncel nonce bekleme onayı → çalışan motor ölçümü → imza yaşı/politika/config digest kontrolü → resume sırası zorunlu. Mevcut (durdurulmuş dahil) container adları alınmaz/silinmez. Hatalı veya kısmi başlangıç pause/container/volume'u inceleme için korur; otomatik cleanup/restart yoktur. Mevcut pause işareti de üzerine yazılmaz. İlk başlangıç için önceden hazırlanmış signature-staging sahiplik etiketli hacim gerekir.

6 yeni bootstrap testi ve ilgili lifecycle/preflight testleri toplam 18/18; uygulama paketi 947/947 geçti. Test envanteri güncellendi. Bunlar birim/adapter testleridir; native Linux x64 gerçek host/main sürekli servis kabulü yapılmış sayılmaz. Supervisor/host işletim entegrasyonu ve native uçtan uca kabul hâlâ kalan iştir. Canlı yayın/aktivasyon yok.


## 20 Ekim — salt okunur servis gözetimi

workers/hr-malware/supervision.mjs eklendi. Native host ön kontrolü, sahipliği doğrulanmış daemon/worker çalışma durumu, güvenli ve 512 baytla sınırlı sağlık dosyası okuması, sağlık tazeliği ve gerçek motor ölçümü birlikte değerlendirilir. Güncel nonce bakım onayı ayrı maintenance durumudur; bakım sırasında motor ölçümü/resume yapılmaz. Ölçüm sırasında pause başlarsa ready verilmez. Hatalar ham hata/credential içermeyen attention nedenlerine dönüşür.

Karar: automaticRestart=false. Hatalı worker/daemon için otomatik restart veya pause kaldırma yapılmaz; özellikle PID namespace değişimi mevcut ölçüm ve bakım kapılarından geçmelidir. Bu API yalnız sağlık örneği üretir; kalıcı gözetmen/systemd kurulumu değildir ve ready sonucu kalıcı garanti/lease değildir.

6 yeni gözetim testi, bootstrap/rotation ile 18/18 odaklı test; uygulama paketi 953/953 geçti. Kalan: host servis kurulum/işletim entegrasyonu ve native Linux x64 sürekli main uçtan uca kabulü. Üretim yayını veya gerçek şirket aktivasyonu yok.


## 20 Ekim — host işletim komut arayüzü

workers/hr-malware/host-cli.mjs mevcut bootstrap/rotation/supervision/staging parçalarını birleştirir. Komutlar: `node host-cli.mjs status /mutlak/config.json`, `stage /mutlak/config.json`, `start /mutlak/config.json bps-signatures-stage-<uuid>`, `rotate /mutlak/config.json`. start sadece ilk başlangıçtır; mevcut container'a restart/adopt uygulamaz. stage yeni imza hacmini hazırlar ama aktive etmez; dönen volume adı start için açıkça seçilir. rotate mevcut yönetilen deployment'ın ölçümlü değiştirme yoludur. status attention ise çıkış 1; maintenance ise ready=false döner.

Config tam olarak name, tenant, worker, digest, origin, code, config, socket, health, control, secrets string alanlarını içerir. Key dosyasının içeriği JSON'a veya argümanlara alınmaz; secrets yalnız özel dizin yoludur. JSON dosyası root sahibi/özel izinli/normal dosya ve en çok 16 KiB olmalı; parent dizinlerde root sahipliği, symlink ve yazılabilirlik kontrolü var. Bütün komutlarda native Linux x64/root ve mount ön kontrolü zorunlu. CLI hataları credential/ham hata içermez; otomatik restart komutu yok.

4 yeni komut testi, bootstrap/supervision ile 16/16 odaklı; uygulama 957/957 geçti. Geçersiz restart CLI çağrısı güvenli hata verdi. Bu host kurulumunun kendisi veya native kabul değildir. Kalan: gerçek host hazırlığı/servis zamanlayıcısı entegrasyonu ve native sürekli main kabulü; ardından üretim ön kontrolü. Canlı yayın/aktivasyon yapılmadı.


## 20 Ekim — systemd zamanlayıcı dağıtım adayları

`deploy/hr-malware/systemd` altında status/rotate oneshot service ve timer dosyaları; yanında host dizinleri, izinler, config anahtarları, aktivasyon sırası, hata/restart kısıtlarını açıklayan README eklendi. Status: boot sonrası 2 dk, her tamamlanmadan 1 dk sonra. Rotate: 00/06/12/18 UTC, en fazla 15 dk jitter, missed-run catch-up kapalı. Restart=no; host/Docker reboot sonrasında otomatik scanner ayağa kaldırma yok, kontrollü recovery gereksinimi açıkça yazıldı. Timerların uyarı göndermediği ve host izleme bağlantısı gerektiği belirtildi.

Resmî Debian bookworm-slim geçici container içinde systemd ve nodejs paketleriyle `systemd-analyze verify --man=no /qa/*.service /qa/*.timer` exit 0; calendar normalizasyonu `*-*-* 00,06,12,18:00:00 UTC` başarılı. Host/Docker hâlâ linux/aarch64: bu yalnız unit sözdizimi/takvim doğrulamasıdır, native x64 çalışma kabulü değildir. Ürün kodu değişmedi; 957 uygulama testi gereksiz tekrar edilmedi.

Hiçbir servis/timer kurulmadı veya etkinleştirilmedi. Gerçek host hazırlığı, sürekli main + rotation kabulü, işletim izleme ve kontrollü kesinti kurtarma prosedürü tamamlanmadan üretim aktivasyonu yapılmaz.


## 20 Ekim — eski işçi sağlık onayının yeniden kullanımını kapatma

İncelemede rotation sırasında aynı pause nonce korunurken eski işçinin health.json kaydının 15 saniye tazelik sınırı içinde yeni işçi onayı sanılabileceği bulundu. createDeployment.startWorker şimdi daemon sahipliği/çalışma kontrolünden sonra, yeni container oluşturulmadan önce yalnız üretilmiş health.json kaydını kaldırır. ENOENT normaldir; başka silme hatası başlatmayı engeller. Böylece yeni worker kendi unavailable/maintenance kaydını yazmadan host eski onayla resume edemez. İş verisine, imzalara, pause veya lock dosyalarına dokunulmaz.

İlk iki regresyonla uygulama paketi 959/959 geçti. Ardından eklenen gerçek geçici dosya testi dahil odaklı managed-rotation paketi 9/9 geçti: launch anında eski health dosyası yok, temizleme hatasında Docker run yok. Son ek dosya testi sonrası tüm paket yeniden çalıştırılmış gibi 960 sonucu iddia edilmedi. Native host uçtan uca kabulü hâlâ bekliyor; canlı yayın yok.


## 20 Ekim — bakım onayı okuma sınırları ve geçersizleşme

Host-control sağlık/pause okumaları readFile sonrası boyut kontrolünden, O_NOFOLLOW/O_NONBLOCK ile açılan aynı inode üzerinde regular-file/sahiplik/yazma izni kontrolü ve en fazla 513 bayt okuma modeline taşındı (512 üzeri red). Host üretimde native root ön kontrolünden geçtiğinden dosya sahibi root olmalıdır; yerel kontrol testi kendi UID'sinde sentetik dosyalarla çalışır. Symlink veya aşırı büyük sağlık kaydı drain onayı vermez, değiştirilmiş symlink pause resume edilemez. Her waitDrained başlangıcında önceki drained izni temizlenir; sonraki kontrol timeout olursa eski başarıyla resume yapılamaz.

3 yeni dosya/regresyon testi dahil host-control/rotation 16/16; uygulama 963/963 geçti. Native Linux servis kabulü veya üretim aktivasyonu yapılmadı.


## 20 Ekim — Docker hedefi ve daemon mimarisi sınırı

Host native kontrolünün yalnız Node hostunu ölçtüğü, varsayılan Docker context'in farklı/uzak sunucuya yönlenebileceği tespit edildi. Yeni docker-host.mjs tüm gerçek lifecycle ve signature-stage çağrılarını --host unix:///var/run/docker.sock ile sabitler; DOCKER_HOST/CONTEXT/TLS_VERIFY/CERT_PATH/API_VERSION override'larını reddeder. Ön kontrol root sahibi, world-writable olmayan gerçek socket ve read-only docker info üzerinden Linux x86_64/amd64, rootless olmayan daemon gerektirir. Yerelde doğrulanan mount'ların başka hosta taşınması engellenir.

4 yeni test; ilgili paket 15/15; uygulama 967/967 geçti. README güncellendi. Yerel Mac/aarch64 ortam bu üretim kapısını geçmez; mevcut emülasyon kabulü native kabul sayılmadı. Gerçek host, izleme ve kesinti kurtarma kabulü hâlâ gerekli. Canlı yayın yok.


## 20 Ekim — native kabul sınırının netleştirilmesi

Dal temiz, son commit 5e4a349; önceki 967/967 test sonucu korundu, gereksiz tekrar yapılmadı. deploy/hr-malware/README.md içine native kabul matrisi eklendi: gerçek main döngüsü, temiz/şifreli PDF, rotation/PID yeniden bağlama, hata enjeksiyonu, reboot, timer ve izleme için gereken gözlemler ayrı yazıldı. Üretim verisi/anahtarı taşınmaz; yalnız ayrı sentetik ortam.

Mevcut Mac/ARM ortam native kabulü tamamlayamaz. Kullanıcıya üretimden ayrı Linux x64 test hostunun mevcut olup olmadığı soruldu; henüz host seçilmedi, sunucu satın alınmadı veya gerçek hesaba erişim verilmedi. Bu kabul için ortam bilgisi gerekiyor. Önceki yerel testler tekrar edilerek native kabul geçmiş sayılmayacak. Canlı yayın yok.


## 20 Ekim — test hostu önerisi hazır

Kullanıcı hazır Linux sunucu olmadığını belirtti. deploy/hr-malware/README.md içine sağlayıcı/maliyet/erişim/veri ayrımı ve 72 saatlik kabul planı eklendi. Öneri DigitalOcean Basic x64 4 vCPU/8 GiB; listelenen $0.07143/saat üzerinden 72 saat yaklaşık $5.14 (ekler hariç). Hetzner CX33 kapasitesi resmî sayfada unavailable olduğundan hazır varsayılmadı. Satın alma, sunucu oluşturma veya credential aktarımı yapılmadı. Sıradaki bağımlılık kullanıcı hesabında onaylı test hostu ve ayrı HTTPS test backend'inin sağlanmasıdır.


## 20 Ekim — Linux beklemede; İK form yeniden deneme bütünlüğü

Kullanıcı Linux kabulünü beklemeye alıp diğer işlere devam edilmesini istedi. Linux host/main kabulü tamamlanmış sayılmaz; tarama kapıları veya üretim aktivasyonu değiştirilmedi. Bağımsız paket olarak mevcut çalışan oluşturma ve iş yeri transferi formlarının belirsiz kayıt sonucunu koruma eksikliği kapatıldı.

ScopedEmployeeForm ve LocationTransfer, ağ/yanıt hatasıyla sonucu belirsiz kalan komutu form/panel kapatarak kaybetmeye artık izin vermiyor. Aynı dondurulmuş komutla yeniden deneme sürüyor. Daha sonraki kesin ret, önceki belirsiz denemenin kaydedilmediğini kanıtlamadığından yeni komut açmıyor. İlk denemedeki kesin rollback sonrasında kapatma ve güncel seçenekleri inceleme korunuyor. Transfer mesajındaki paneli kapatma önerisi kaldırıldı. Yetki, veri modeli veya migration değişikliği yok.

Kanıt: gerçek TSX callback'lerini mevcut hook driver ile çalıştıran scripts/hr-form-retry.test.mjs, iki formda ağ hatası → daha sonra ret → başarı zincirinde aynı komut nesnesi/UUID ve tek başarı bildirimi; ilk kesin rette kapatabilme için 4/4 geçti. Bu DOM/tarayıcı veya gerçek ağ kabulü değildir. Uygulama paketi 971/971, TypeScript ve git diff --check geçti. Üretim yayını yapılmadı.


## 20 Ekim — İK aktarım sonrası liste tutarlılığı

Linux kabulü beklemede. Mevcut Excel ön kontrolündeki başarılı kaydın ardından panel kapandığında çalışan listesi artık otomatik yenilenir. Kullanıcı başka sayfadaysa ilk sayfaya döner; kaydetmeden kapatırsa mevcut sayfa ve liste korunur. HrImportPreview kapanışa doğrulanmış done sonucunu taşır; belirsiz aktarımda kapatma engeli korunur. Liste okuması başarısız olduğunda aktarım başarısı geri alınmış gibi gösterilmez; okuma hatası ve Yenile eylemi görünür, eski çalışan satırları temizlenir. Veri modeli/yetki/migration değişmedi.

Kanıt: scripts/hr-directory-import.test.mjs gerçek Directory ve useScopedResource callback/effect akışında üç senaryoyu doğruladı: ilk sayfada yenileme, sonraki sayfada iptal/başarılı aktarım ayrımı, başarılı kayıt sonrası liste okuma hatası. Alt import bileşeni ve ağ bağımlılıkları sentetiktir; gerçek dosya/tarayıcı kabulü olarak sunulmaz. Uygulama 974/974, TypeScript ve diff kontrolü geçti. Üretim yayını yok.


## 20 Ekim — İK listesinde önceki sayfa ve okuma hatasından dönüş

Linux kabulü beklemede. Çalışan dizinine önceki 50 kayda dönüş ve mevcut sayfa göstergesi eklendi. Cursor geçmişi yalnız ekran oturumunda tutulur; ilk sayfa ve başarılı oluşturma/aktarım geçmişi sıfırlar. İleri sayfa okuması hata verdiğinde gezinme görünür kalır, önceki/ilk sayfaya dönüş mümkündür; ileri düğmesi veri yokken kapalıdır. Yükleme ve açık düzenleme/aktarım/evrak panellerinde gezinme kilidi korunur. Geri dönüş güncel kapsamla yeniden okur, önceki çalışan verileri önbellekten gösterilmez. Yetki/SQL değişikliği yok.

Kanıt: hr-directory-import.test.mjs içindeki iki yeni senaryo üç sayfada ileri/geri, ilk sayfa sıfırlaması, hata sonrası geri dönüş ve açık panel kilidini gerçek component/hook callback'leriyle doğrular; 5/5 odaklı, uygulama 976/976, TypeScript ve diff kontrolü geçti. Driver metin yardımcısı sayısal JSX çocuklarını okuyacak şekilde düzeltildi (ilk testte sayfa rakamı okunamıyordu). Bu tarayıcı kabulü değildir. Üretim yayını yok.


## 20 Ekim — özel evrak listelerinde işlem sonrası yenileme

Linux kabulü beklemede. EmployeeDocuments başarılı yükleme sonrasında evrak ve bekleyen yükleme listelerini ilk sayfadan birer kez yeniler; cursor sıfırlanırken eski sayfaya ayrıca reload gönderilmez. Başarılı iptal sonraki bekleyen sayfayı ilk sayfaya döndürür; evrak listesini gereksiz yenilemez. İptal sonucu belirsizse sayfa ve işlem kimliği korunur, aynı yüklemeye yeniden deneme sürer. SQL, tarama ve erişim politikaları değişmedi.

Kanıt: hr-document-list-refresh.test.mjs gerçek bileşen ve useScopedResource ile dört callback/effect senaryosu: sonraki sayfalardan başarılı yükleme, ilk sayfada başarılı yükleme, başarılı iptal, belirsiz iptal ve aynı kimlikle tekrar. 4/4 odaklı; uygulama 980/980, TypeScript ve diff kontrolü geçti. Ağ servisleri ve alt yükleme bileşeni sentetiktir; bu tarayıcı/Storage kabulü değildir. Üretim yayını yok.


## 20 Ekim — özel evrak ve bekleyen yüklemelerde geri gezinme

Linux kabulü beklemede. EmployeeDocuments içinde evraklar ve bekleyen yüklemeler için birbirinden bağımsız cursor geçmişi, önceki sayfa düğmesi ve sayfa göstergesi eklendi. Evrak okuması hata verdiğinde gezinme artık kaybolmaz; önceki/ilk sayfa üzerinden yeniden güncel kapsamla okunabilir. Yükleme, iptal veya belirsiz iptal sırasında iki listenin kontrolleri kilitli kalır. Veri yokken ileri düğmesi kapalıdır. İlk sayfa sıfırlamaları önceki paketteki tek yenileme davranışını korur. SQL/erişim/Storage politikası değişmedi.

Kanıt: hr-document-list-refresh.test.mjs 7/7; ek üç senaryo iki listenin hata sonrası geri dönüşünü, bağımsız geçmişini ve yükleme kilidini doğruladı. Uygulama 983/983, TypeScript ve git diff --check geçti. Testler gerçek component/hook ve sentetik servislerle çalışır; tarayıcı/gerçek Storage kabulü değildir. Üretim yayını yok.


## 20 Ekim — doğrulanmış İK kaydı ile ekran güncelleme hatasını ayırma

Linux kabulü beklemede. Çalışan oluşturma, düzenleme, istihdam değişikliği ve iş yeri transferinde onSaved callback hatası artık kayıt isteğinin hatası gibi sınıflandırılmaz. Doğrulanmış yazma sonrası ekran güncellenemezse kayıt başarısı korunur ve liste yenileme mesajı gösterilir. Düzenleme/istihdam/transferde done durumu tekrar yazmayı engeller, belirsizlik ve gezinme korumasını kaldırır; panel kapatılabilir. Oluşturma formu başarıyla kapanır ve yeniden deneme komutu kaybolduğu halde belirsiz durumda bırakılmaz. SQL, yetki ve yazma sözleşmeleri değişmedi.

Kanıt: gerçek TSX callback'lerinde hem ağ hatası hem PostgreSQL ret biçimli callback hatası enjekte edilen 8 yeni regresyon; önceki belirsiz yazma/aynı komut testleriyle 12/12 odaklı. Uygulama 991/991, TypeScript ve diff kontrolü geçti. Bu sentetik callback/hook testidir; gerçek tarayıcı/DB kabulü değildir. Üretim yayını yok.


## 20 Ekim — özel evrak yayın başarısını ekran hatasından ayırma

Linux kabulü beklemede. HrDocumentUpload içindeki upload replay ve scan/finalize published makbuzu yolları ortak completed akışına alındı. Yalnız doğrulanmış published makbuzundan sonra done olur; onSaved ekran callback hatası kayıt başarısını belirsizleştirmez. Başarılı form tekrar upload/scan yapmaz, tarama eylemleri kaldırılır, gezinme koruması kalkar ve kapatma açılır. Liste yenileme hatası ayrı mesajla anlatılır. Pending/bozuk makbuz başarı sayılmaz. Backend, tarama politikası ve erişim kuralları değişmedi.

Kanıt: hr-upload-committed.test.mjs gerçek TSX ve makbuz ayrıştırıcısıyla upload/finalize yollarında başarılı makbuz + callback hatası ve yanlış upload kimlikli makbuz senaryoları 4/4 geçti. Başarıdan sonra tekrar submit ağ isteği yapmıyor. Servisler sentetik; gerçek tarayıcı/Storage kabulü değil. Uygulama 995/995, TypeScript ve diff kontrolü geçti. Üretim yayını yok.


## 20 Ekim — çalışan düzenlemede ilk okuma hatasından toparlanma

Linux kabulü beklemede. EmployeeEdit ilk okuma hatasında form içinden Bilgileri yeniden getir eylemi sunar. İlk başarılı tekrar ad ve personel kodunu sunucudan doldurur; ilk hata sırasında kaydetme alanları açılmaz. Kayıt çakışması sonrası yenilemede kullanıcının taslağı korunur; personel havuzuna bağlı ad düzenlenemez hale geldiyse güncel sunucu adı kullanılır. Tamamlanmış veya sonucu belirsiz komut için refresh başlatılmaz. Veri/yetki/migration değişikliği yok.

Kanıt: hr-edit-recovery.test.mjs üç yeni gerçek callback/hook senaryosu: tekrarlanan okuma hatası ardından başarı, düzenlenebilir ad taslağını koruma, bağlı adın güncel değerini kullanma. Önceki committed testleriyle 7/7 odaklı, uygulama 998/998, TypeScript ve diff kontrolü geçti. Servisler sentetik; tarayıcı/DB kabulü değil. Üretim yayını yok.
