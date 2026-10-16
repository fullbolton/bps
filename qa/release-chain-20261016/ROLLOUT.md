> **17 Ekim güncel durum: yayın tamamlandı, üretim ledger 182, bakım kaldırıldı.** Son bölüm ve release-manifest-20261017.json esas alınır; aşağıdaki hazırlık bölümleri tarihsel kayıttır.

# Güncel yayın kontrolü — 16 Ekim, hazırlık dağıtımları sonrası

Bu bölüm alttaki kronolojik notların güncel özetidir; eski “henüz yapılmadı” maddeleri tek başına kullanılmaz.

- Canlı www.bpsys.net: dpl_CamuYBKVLbRg1WgStdWgjuRF4xVw. Son bağımsız inspect kanıtı production-alias-after-module-stage.json.
- Eski kod + bakım kapısı hazır: dpl_2K2qPJNmHybF13XJUVagGtVTG248.
- Yeni kod + bakım kapısı hazır: dpl_GMtdntpuCNrjwChLiGtWZHRBtGzv; kaynak a394b47. İkisinin de bakım HTTP kabulü geçti. Hiçbiri www alanına promote edilmedi.
- 53 migration'ın temiz şemada bariyerli provası geçti; üretime uygulanmadı. Üretim ledger son ölçümde 129. Metadata izin kontrolü 82 hedefte eksiksiz; üretimde gerçek bariyer kurma/kaldırma henüz sınanmadı.
- Gerçek Storage yerel HTTP 26/26; uygulama 690/690 ve TypeScript kontrolü geçti. Bakım açık bulut sürümünde ürün akışları test edilmiş değildir.

## Geçiş kapıları ve hata davranışı

1. Uzak Git yedeği, güncel ledger, şema uyumu ve dış yazıcılar doğrulanmadan bakım geçişine girilmez. Uzak dal yedeği bu kayıtta tamamlanmış sayılmıyor. Eski deployment URL'leri ve admin bağlantılı harici servisler ayrıca değerlendirilir.
2. Eski kodun bakım sürümü ana alana alınır ve HTTP kapısı tekrar ölçülür. Bariyer kurulamazsa migration başlatılmaz. Henüz SQL uygulanmadığı doğrulanırsa eski canlı deployment'a dönüş mümkündür.
3. Bariyer kurulduktan sonra verify geçmeden migration çalıştırılmaz. Her dosya sonrası ledger, extend ve verify kontrol edilir. Hata durumunda otomatik devam veya otomatik bariyer kaldırma yoktur. Uygulanmış SQL prefix'i ve ledger birlikte incelenir.
4. Migration sonrası eski uygulamaya rollback yapılmaz. Yeni sürüm bakım açık kalır. Şema/katalog kontrolleri yazma kapalıyken yapılabilir; normal oturumla mutasyon kabulü bariyer açıkken başarılı olamaz.
5. Normal açılış için bakım kapalı AYRI deployment gerekir; Vercel proje env değiştirmek mevcut deployment'ı değiştirmiş sayılmaz. E-posta flag'i kapalı korunur. Bu deployment'ın doğrudan erişim koruması doğrulanmadan eski şemaya açık yeni uygulama URL'si oluşturulmaz.
6. Kimlikli mutasyon kabulü için DB bariyerinin kaldırılması gerekir; bu anda eski doğrudan istemciler de tekrar erişebilir. Bunu “tüm yazıcılar kapalı özel kabul penceresi” diye sunmayız. Ana alan bakımdayken sınırlı kabul yapılır, başarılıysa yeni normal deployment promote edilir. Kabul başarısızsa güvenli biçimde bariyer yeniden kurulur ve bakım korunur; eski kod geri açılmaz. Başlamış dış e-posta/dosya aktarımı geri alınmış sayılmaz.

## Kesinti sonrası çevrimdışı kontrol

`python3 qa/release-chain-20261016/reconcile-ledger.py /path/to/fresh-ledger.json`

Girdi project/measuredAt/migrations içerir. Ölçüm en fazla bir saatlik olmalıdır. Komut bağlantı kurmaz veya SQL çalıştırmaz. Tarihsel ledger'ın aynen korunmasını, dosya/hash eşleşmesini ve 53 adayın yalnız sıralı prefix'inin uygulanmış olmasını denetler. Aradaki boşluk, farklı proje, yabancı/tekrarlı tarih, değişen dosya ve başarısız prova exit 1 üretir. Tam zincir eşleşse bile productionReady=false ve automaticResumeAllowed=false kalır: ledger şemanın doğru olduğunu tek başına ispatlamaz.

10 test geçti; testler 0–53 arasındaki 54 olası prefix'i de tarar. ledger-reconciliation.json kayıtlı ölçüm üzerinde not_started/53 bekleyen sonucudur; yeni bir üretim sorgusu değildir. Üretim geçişinden hemen önce ölçüm yenilenmelidir.

---

# Yayın sırası — 16 Ekim 2026

Durum: güncel üretim ledger 129, son 20261004001400. Güncel yalnız-şema kopyasında 53 aday geçti. Uygulama 686/686, tip kontrolü ve yerel adresle üretim derlemesi başarılı. Bu belge yayın gerçekleştirildiğini göstermez.

## Birlikte geçiş gerektiren durum

Eski uygulama tabloya doğrudan yazıyor. Yeni uygulama appointment_execute_v1, contract_execute_v1, contract_delete_v1 ve document_* komutlarını kullanıyor. Yeni uygulamayı önce açmak eksik RPC hatası; tüm migration'ları önce uygulamak eski uygulamada yazma hatası doğurabilir. Eski tarayıcı sekmeleri ve arka plan yazıcıları da hesaba katılmalı.

Özellikle 20261013000200 takvim, 20261015000200/000400 sözleşme yazma/silme, 20261016000600/000700/000800 evrak yazma kapılarını kapatır. 20261015000600 ve 20261016000900 Storage silme/legacy yollarını sınırlar. İlk 31 aday da görev/firma/not/kişi ve diğer modüllerde eski yolları kapatan adımlar içerir. Bazı dosyalar yeni komut ile kapıyı aynı transaction'da ekler; sadece dosya adındaki cutover kelimesine göre ayırmak güvenli değildir.

## Uygulama sırası

1. Sürüm commit'i ve uzak dal yedeği doğrulanır; Vercel yayınlanacak commit açıkça seçilir. İşlem öncesi ledger yeniden okunur, 53 dosyanın hashleri full/result.json ile karşılaştırılır. Kaynak değişmişse prova yenilenir.
2. Yazma trafiği için doğrulanmış bakım/geçiş mekanizması hazırlanır. Sadece banner veya kullanıcıya mesaj yeterli değildir: eski sekmeler, API/server action çağrıları, zamanlanmış servis yazıcıları ve Storage yolları da durmalıdır. Bu mekanizma bu pakette uygulanmış veya ölçülmüş değildir. Doğrulanmadan eşzamanlı canlı trafik altında tek paket geçişe başlanmaz.
3. Trafik durduktan sonra yalnız bu 53 dosyalık izole yayın klasörü üzerinden sayısal sırayla migration uygulanır. 20260722000200 eski taslağı kesinlikle dahil edilmez. Her transaction sonucu ve uzak ledger kaydı ölçülür; hatada sonraki adım çalıştırılmaz.
4. Yeni uygulamanın doğrulanan commit'i dağıtılır; gerçek ortam değişkenleri/feature flagleri kontrol edilir. Modül kapatma mutationAvailable=false olarak korunur.
5. Oturum, şirket seçimi, takvim oluşturma/tamamlama, sözleşme düzenleme, evrak yükleme/kurtarma/iptal/temizlik yetkileri kimlikli kabulden geçirilir. Başarılı olmadan trafik tekrar açılmaz. Eski sekmelere yeni sürüm yükletilir.
6. Canlı commit, migration listesi, kabul kanıtı ve güncel ilerleme kaydı tek yayın kaydında birleştirilir.

## Hata ve geri dönüş

Şema geçişinden sonra eski uygulamaya kör rollback yapılmaz: kapatılan raw yazma yollarını kullanacaktır. Hatalı migration kendi transaction'ını geri alır; daha önce commit edilen migration'lar kalır. Trafik kapalı tutulur, uygulanmış prefix ledger üzerinden saptanır, aynı şemayla uyumlu uygulama/düzeltme hazırlanır. Veritabanını resetleme, tablo/veri silme veya uygulanan tarihsel migration'ı değiştirme yoktur.

## Açık kalanlar

- Yazma trafiğini gerçekten durduran bakım mekanizması ve tekrar açma kabulü.
- Gerçek veri hacminde kilit/backfill maliyeti; boş sentetik prova bunu ölçmez.
- Gerçek Vercel ortamıyla son build/dağıtım, uzak yedek ve yayın sonrası kabul.
- Tam DB suite bu tur yeniden çalıştırılmadı; envanterde 27 DB ve 7 pending dosya bulunması hepsinin geçtiği anlamına gelmez.


## Uygulama bakım kapısı — uygulandı, varsayılan kapalı

`BPS_MAINTENANCE_MODE=1` sunucu ortam değişkeniyle middleware bütün istekleri oturum yenilemeden önce HTTP 503 ile durdurur. GET cron, server action POST, API ve uzantılı yollar dahil; header/URL ile bypass yok. GET HTML için Türkçe sayfa, diğer istekler için MAINTENANCE JSON kodu, HEAD için boş gövde döner. no-store ve Retry-After:120 gönderilir; mutasyon otomatik yeniden denenmez. Ortam değeri tam olarak 1 değilse mevcut oturum davranışı korunur. Üretim ortamı bu tur değiştirilmedi.

Gerçek yerel Next sunucusunda Supabase adresi erişilemezken altı HTTP yolu/yöntemi ve Türkçe HTML kabulü geçti. Kanıt maintenance-http.json. Kapı tüm dağıtımlara kendiliğinden yayılmaz: eski deployment URL'leri ve doğrudan Supabase/Storage bağlantıları dışarıdadır. Başlamış işlemleri iptal etmez veya boşaldıklarını kanıtlamaz. Eksik DB/Storage yazma bariyeri ve in-flight drain kabulü kapanmadan tam bakım koruması sayılmaz. Bu kodu içeren yeni sürümün önce SQL'siz/uyumsuz biçimde canlıya alınması da çözüm değildir; gerekirse mevcut canlı sürüme yalnız bu bağımsız kapı taşınır ve bakım açık dağıtım ayrıca doğrulanır.


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
