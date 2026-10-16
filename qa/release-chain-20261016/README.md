# 16 Ekim — Birleşik yerel migration provası

53 adayın dosya adları ve SHA-256 değerleri result.json içinde. İlk 31 adayın kaynak hash'leri önceki 29 modül + 2 duyuru uygulama kayıtlarıyla eşleşti. Mevcut sentetik bps_module_chain_20261005 tabanı geçici DB'ye klonlandı; kalan **22/22 migration** dosyaları değiştirilmeden, ayrı transaction'larıyla sırayla uygulandı. Geçici DB kaldırıldı.

Birleşik şemada takvim oluşturma, iptal, yeniden planlama, tamamlama ve takip görevi oluşturma geçti; tamamlanmış kaydı eski durumla değiştirme PT409 verdi. Evrak INSERT/UPDATE/DELETE için üç kısıtlayıcı false RLS politikası ve açık RLS doğrulandı. Üç workspace fonksiyonunda açık iş-kuralı 40001 kalmadığı kontrol edildi. Bunlar bütün uygulamanın regresyon testi değildir.

## İki prova düzeltmesi

- İlk deneme tabanın 29 migration içerdiğini varsaydı; duyuru politikası zaten vardı. Belgelenmiş iki ek migration ve hash'leri doğrulanarak başlangıç 31 yapıldı. initial-baseline-mismatch.json korunuyor.
- İlk birleşik kontrol yalnız tablo grant'ine baktığı için yanlış alarm verdi. Ürün doğrudan yazmayı REVOKE yerine kısıtlayıcı RLS ile kapatır. Kontrol gerçek üç politika, komut, rol, false koşulları ve RLS açık olma şartına düzeltildi. initial-grant-only-check.json korunuyor. Ürün güvenlik politikası değiştirilmedi.

## Yayın sınırı

Bu 53 migration'ın sıfırdan veya güncel üretim kopyasında replay edildiği anlamına gelmez. İlk 31'in tarihsel kaynak kanıtı kontrol edildi; canlı katalog eşitliği ölçülmedi. 5 Ekim şema snapshot dosyası artık /private/tmp altında yok. Mevcut oturumda üretim SQL aracı yok. Yeni salt okunur üretim katalog/ledger ölçümü ve temiz tabanda tam 53 aday provası yayın öncesinde gereklidir. Gerçek veri aktarımı/temizliği, commit/push/deploy yapılmadı. Modül kapatma kapalıdır.

Yeniden çalıştırma: aktif repo kökünden `python3 qa/release-chain-20261016/rehearse.py`. Sabit yerel Docker konteynerini kullanır; var olan tabanı değiştirmez. Sonuç JSON başarı ve temizlik durumlarını ayrı kaydeder, başarısızlıkta exit 1 döner.


## Salt okunur katalog ve girdi kontrolü

`catalog-preflight.sql` REPEATABLE READ / READ ONLY transaction içinde yalnız migration ledger ve katalog metadata okur. İş kayıtları, kullanıcı kayıtları veya dosya içerikleri alınmaz; fonksiyon gövdeleri yerine hash, owner ve ACL bilgileri döner. 30 saniye statement / 5 saniye lock timeout vardır. SQL sonucu tek JSON nesnesi olarak saklanmalıdır; sorgu hata verirse eksik sonuç kabul edilmez.

`python3 qa/release-chain-20261016/check-preflight.py /path/to/catalog.json` ölçümün en fazla bir saatlik olduğunu, ledger'ın önceki 129 kayıtla aynı olduğunu, katalog bölümlerinin dolu olduğunu ve aday dosyaların başarılı yerel prova hash'leriyle eşleştiğini kontrol eder. Değişiklikte exit 1 döner. Exit 0 yalnız girdi kontrollerinin geçtiğini gösterir; `productionReady` her zaman false kalır. Proje kimliği JSON'dan kanıtlanmaz: bağlantı hedefi ayrıca doğrulanmalıdır. Katalog içeriğinin tüm doğruluk/uyumluluk değerlendirmesi ve temiz şema üzerinde 53 migration provası hâlâ gerekir.

8 test geçti: geçerli girdinin bile yayını onaylamaması, eski/gelecek ölçüm, ledger değişimi, eksik katalog, değişen/silinen aday ve başarısız prova. Sorgu geçici sentetik klonda gerçek PostgreSQL üzerinde çalıştı (263 fonksiyon / 89 tablo / 116 politika); bu sayılar üretim ölçümü değildir. Sentetik ledger yalnız klonda oluşturuldu ve klon kaldırıldı. Kanıt: preflight-query-test.json.

Bu tur `supabase migration list --linked` salt okunur denemesi aktif klasörde proje bağlantısı olmadığı için durdu (`Cannot find project ref`). Oturumda Supabase MCP SQL aracı da yok. Hiçbir üretim SQL'i çalıştırılmadı ve proje bağlantısı tahmin edilerek değiştirilmedi.


## 16 Ekim — güncel üretim şemasıyla tam 53 aday provası (en güncel sonuç)

Önceki bağlantı engeli çözüldü: eski ana klasörün Supabase proje kaydı `dffdzbmnmnokbftbujsy` olarak doğrulandı; CLI --workdir üzerinden üretim ledger'ı salt okunur alındı. 129 kayıt önceki ölçümle birebir eşleşti; son kayıt 20261004001400. Aktif kaynak klasörü veya üretim şeması değiştirilmedi.

Yalnız public/auth/storage/extensions şema tanımları CLI db dump ile /private/tmp/bps-prod-schema-20261016.sql dosyasına 0600 izinle alındı. İş, auth kullanıcı ve Storage nesne verisi aktarılmadı; snapshot repoya eklenmedi. Temiz yerel DB'de platform eklentileri kuruldu, şema restore edildi. Tüm public/auth/storage tablolarının boş olduğu doğrulandı; sonra iki sentetik tenant/kullanıcı eklendi. **53/53 aday dosyası değiştirilmeden sıralı uygulandı.** Birleşik takvim yaşam döngüsü/takip görevi/eski durum çatışması, evrak RLS katalog kapıları ve workspace hata kodu kontrolü geçti. Yerel klon kaldırıldı.

Kanıtlar: production-ledger.json; full/result.json; full/snapshot-manifest.json; full/*.log. full-rehearse.py tekrar çalıştırırken snapshot hash'ini manifestle doğrular. Bu sonuç önceki 'temiz şemada tam prova bekliyor' ve 'üretim bağlantısı yok' durumlarını günceller. Ayrı catalog-preflight.sql üretimde çalıştırılmadı; güncel şema restore ve migration içi hash/ACL koşullarıyla uyumluluk ölçüldü.

Sınır: gerçek üretim satırlarının migration backfill maliyeti, trafik altında kilit süreleri ve canlı servis sürümleri bu sentetik provayla ölçülmez. Yayın sırası (komut API'si kullanan uygulama ile doğrudan yazma kapılarının uyumu), güncel kod/build, commit/yedek ve dağıtım sonrası kabul ayrıca tamamlanmalıdır. Yeni migration eklenmedi; commit/push/deploy veya üretim migration uygulaması yapılmadı. Gerçek modül kapatma kapalı kalır.


16 Ekim yayın paketi: Kod, migration ve QA kanıtları yerel `2d9f464` commit’ine kaydedildi. Commit hook TypeScript kontrolü de geçti. Bu kayıt uzak yedek/push veya dağıtım değildir. Son kontroller validation.json ve okunabilir hâle getirilen test loglarında; yayın koşulları ROLLOUT.md içinde.


## 16 Ekim — birleşik bariyer kabulü tamamlandı (yerel)

`BPS_RELEASE_BARRIER=1 python3 qa/release-chain-20261016/full-rehearse.py` güncel şema snapshot'ını temiz DB'ye kurdu; sentetik seed öncesi tabloların boşluğu doğrulandı. Bariyer kuruldu, 53 adayın her biri sırayla uygulandı; her migration sonrası extend + verify çalıştı. Birleşik takvim smoke, evrak RLS ve workspace hata kodları geçti. Bariyer remove başarıyla tamamlandı; geçici DB silindi. Kanıt full-barrier/result.json: applied=53, success=true, barrierRemoved=true, cleaned=true. İlk tam prova full/ altında korunur.

`BPS_RELEASE_BARRIER=1 node qa/contract-write-20261015/storage-http.mjs` gerçek yerel Storage/PostgREST servisleriyle **26/26** kontrolü geçti. Bu modda PostgREST doğrudan postgres yerine authenticator bağlantısı kullanır; böylece admin istisnası testi yanlışlıkla geçiremez. Önceki 25 HTTP kontrolü de aynı bağlantıyla geçti. Barrier kurulunca prepare RPC HTTP 503/PT503 verdi. Gerçek Storage upload ve delete HTTP 500 döndü (bu Storage sürümünün trigger hata eşlemesi; 503 değildir). Reddedilen upload için storage.objects kaydı oluşmadı; silinmesi istenen mevcut nesne indirildi ve byte içeriği korundu. Bariyer kaldırıldıktan sonra aynı rezervasyonla yükleme ve aynı dosyanın silinmesi başarılı. Kanıt barrier/http-result.json ve http-suite-result.json. Servisler/DB klonu temizlendi.

Bu, önceki 'bariyer altında tam zincir ve Storage HTTP kabulü bekliyor' maddelerini kapatır. Ürün TS/SQL migration kaynakları değişmedi; QA runner genişletildi, 53 aday değişmedi. Üretime uygulanmadı; tam uygulama/build testleri QA-only değişiklik için tekrarlanmadı. Node syntax ve diff kontrolü geçti.

Kalan sınırlar: Üretimde gerçek bağlantı session_user ve doğrudan admin kullanan dış yazıcılar ayrıca doğrulanmalı. Metadata'ya henüz ulaşmamış dosya byte aktarımı ve eski signed URL okumaları tamamen durdurulmuş sayılmaz. Her migration sonrası extend'den önce yeni tabloda kısa korumasız aralık vardır; uygulama kapalı tutulmalı, yeni tabloya yazan başka servis bulunmamalı. Gerçek trafik/veri hacminde kilit süreleri bu sentetik testte ölçülmez. Cron/e-posta gibi harici yan etkiler için uygulama kapısı da gereklidir. İki katman birlikte yayın planına göre işletilmelidir; bu testler kendi başına üretim yayın onayı değildir.


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
