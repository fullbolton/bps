# Modül değişiklik komutu — yerel aday, 17 Ekim 2026

Üretime uygulanmadı. `command-candidate.sql` migration dizininin dışında; PUBLIC, anon, authenticated ve service_role EXECUTE yetkileri açıkça kaldırılır. UI bu komutu çağırmaz. Komutun bulunması modül kapatmanın ürün olarak hazır olduğunu göstermez.

## Davranış

- READ COMMITTED zorunlu; actor/tenant ön kontrolünden sonra config UPDATE kilidi, ardından profile SHARE kilidi alınır.
- Kilit sonrası canlı şirket, yönetici rolü, üyelik ve seçim sürümü tekrar doğrulanır.
- UUID komut kimliği + actor/tenant/generation/revision/tüm seçimleri içeren SHA256, ağ yanıtı kaybolduğunda aynı işlemin tekrar yazılmasını önler. Aynı kimlikle farklı içerik reddedilir. Replay da güncel yetki kontrolünden geçer.
- Önizleme mevcut transaction içinde kilitten sonra yeniden çağrılır. Bağımlılık/açık iş varsa rollback; eski revision reddedilir. Değişiklik yoksa receipt üretilmez.
- Ayarlar, revision ve önce/sonra audit kaydı tek transaction içinde yazılır. Yeniden açma veri silmez veya geçmiş bildirimleri üretmez.

## Ölçülen kabul

`result.tap`: 15 alt senaryo + kapsayıcı test = 16/16. Gerçek yerel PostgreSQL üzerinde sentetik `bps_module_chain_20261005` klonu; son evrak migration'ları ayrıca uygulanır. Sonunda klon kaldırılır.

Doğrulananlar: istemci yetkileri kapalı; idempotent tekrar; farklı payload reddi; stale revision; bağımlılık/actor/membership/no-op; yanlış tenant ve repeatable-read; bekleyen evrak; aynı actor'ın iki eşzamanlı oturumu; iş yazma/kapatma iki sıralama; yeniden açmada verinin korunması. Yarış testleri pg_stat_activity ile gerçek Lock beklemesini ölçer. İki farklı yönetici; config ve profile kilidinde beklerken rol düşürme; rol geri verilse bile eski üyelik sürümünü reddetme; gerçek select_workspace RPC ile şirket seçimi değişirken eski komutun reddi ayrıca doğrulandı. Her ret sonrası revision ve receipt yokluğu kontrol edildi. HTTP/tarayıcı veya bütün mutasyon yollarının kabulü değildir.

Çalıştırma:
```sh
NODE_PATH=/private/tmp/bps-calendar-qa-runtime/node_modules node --test qa/module-change-command-20261017/command.test.mjs
```
İlk çalışma pg modülü çözümlenemediği için başlamadı; mevcut QA runtime ile tekrar çalıştı. Paket kurulmadı.

## Yayın öncesi kalanlar

1. Diğer tüm yazma/cron/Storage yollarının ortak config bariyerine uyumunu güncel katalogla teyit et; yalnız tasks yarışından genel kapsama sonucu çıkarma.
2. Yetki/şirket değişimi bekleme yarışları ve farklı yöneticilerle yerel SQL kabulü tamamlandı; HTTP oturumu/yenileme ve UI sonucu kabulü kalıyor.
3. Güncel şema ön kontrolüyle tarihli migration oluştur; protokol/version ve receipt yanıtını istemcide doğrula. Kayıp yanıt sonrası aynı commandId ile güvenli tekrar, başarısız sonucu başarı göstermeme.
4. Kayıt sonrasında menü/cache/form kapsamını güncelle ve gerçek tarayıcı kabulü yap. Sonra kontrollü yayın; mevcut canlı 312a468 / 182 migration değişmedi.

## Yetki yarışı genişletmesi

İlk genişletme çalışmasında çoklu üyeliğe geçişten sonra açık şirket seçimi yapılmayan fixture WORKSPACE_SCOPE ile reddedildi. Test, gerçek select_workspace çağrısı ve dönen üyelik/seçim sürümlerini taşıyan sentetik claim ile düzeltildi; ürün kontrolü gevşetilmedi. Son çalışma 14/14. Ürün SQL değişikliği gerekmedi. Geçici klon sonunda kaldırıldı.

## Eski personel tablolarıyla birleşik kabul

20261017000100_legacy_staffing_module_barriers.sql komuttan önce uygulanır. Authenticated staffing_demands INSERT önce commit ederse gerçek komut 23514 ile kapanmayı reddeder, receipt oluşmaz. Gerçek komut önce kapatırsa bekleyen authenticated workforce_summary UPSERT BM001 ile reddedilir. Yeniden açmada talep görünür ve başarısız upsert değeri değişmemiştir. Toplam komut süiti 16/16; ayrı tablo/migration süiti 7/7. Migration dosyası hazır fakat üretime uygulanmadı. Kayıt komutu hâlâ yerel aday ve istemci EXECUTE kapalıdır.

## Şema kapsamı düzeltmesi

Önceki komut testi base şablona yalnız evrak migration'larını ekliyordu; takvim, sözleşme gateway ve PT409 yamalarını kapsamıyordu. Önceki sonuçlar bu dar şema için geçerlidir, tam yayın zinciri kabulü değildir. Artık fixture-migrations.json içindeki 23 eksik migration (20261013000100–20261017000100) sırayla uygulanır. Şablonda duyuru politikası zaten bulunduğundan 20261005003000/03100 tekrar uygulanmaz. Son komut testi 16/16; eski 40001 beklentileri yayınlanmış PT409 sözleşmesine düzeltildi.

post-migration-writer-candidates.json, bu yerel şemada authenticated EXECUTE taşıyan definer gövdelerinde belirli yazma ifadeleri bulunan ve doğrudan workspace_require_module_write_v1 içermeyen adayları kaydeder. Dinamik SQL/helper zinciri veya tüm yazım biçimleri için tam analiz değildir. Sözleşme hazırlama/finalize fonksiyonları eski şablonda aday görünürken güncel migration sonrası bu listeden çıkar.


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


## 17 Ekim — iptalden temizlik tamamlamaya modül engeli

Gerçek document_cancel_upload_v1 ve document_ack_cleanup_v1 helper'ları aday modül komutuyla aynı güncel yerel fixture üzerinde çalıştırıldı. İptalde pending_document_upload=false olurken pending_document_cleanup=true kalıyor; kapatma komutu 23514 ile reddediliyor, revision ve receipt değişmiyor. Storage nesnesi hiç oluşturulmamış sentetik rezervasyonda ack, nesne yokluğunu doğruladı; ardından iki engel de false oldu. completed_at taşıyan cleanup satırı korundu ve tekrar ack başarılıydı. Bu satırın korunması eski yolun yeniden kullanımını engelleyen tombstone sözleşmesidir.

Süit 23/23 geçti; result.tap güncellendi. Bu senaryoda gerçek HTTP dosya yükleme/silme yapılmadı; önceki 29/29 Storage HTTP kanıtı ayrı kapsamda kalır. Bütün diğer engellerin kalktığı veya UI kaydetmenin hazır olduğu iddia edilmez. Ürün SQL/arayüz değişmedi, yeni migration veya üretim yayını yok.


## 17 Ekim — evrak hazırlama ile gerçek kapatma komutu yarışı

İki ayrı PostgreSQL bağlantısında authenticated document_prepare_upload_v1 ile yerel aday change_workspace_modules_v1 yarıştırıldı; pg_stat_activity üzerinden gerçek Lock beklemesi doğrulandı. Hazırlama önce commit ettiğinde bekleyen kapatma yeni rezervasyonu gördü ve 23514 ile reddedildi; context ve receipt değişmedi. Kapatma önce commit ettiğinde bekleyen hazırlama BM001 ile reddedildi, document_upload_attempts satırı oluşmadı. Test sonunda modüller aday komutla yeniden açıldı; ilk yarışın sentetik rezervasyonu gerçek cancel/ack helper'larıyla kapatıldı.

Süit 25/25 geçti; result.tap güncellendi. Bu kabul metadata rezervasyonu ve config kilidi içindir; HTTP byte aktarımı veya tarayıcı testi değildir. Önceki Storage HTTP kanıtı ayrı kapsamda kalır. Yalnız test ve kanıt değişikliği; ürün kodu, yeni migration, EXECUTE grant veya üretim yayını yok.

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

Kanıt browser-switch.png/.txt ve browser-switch-ledger.json. Yerel metadata: receipt yok, iki şirketin modül revision'ı 1. Bu kabul kayıt başlamadan navigasyonla şirket değişimini kapsar; uçuş halindeki istekte cross-tab geçiş tarayıcıda ölçülmedi (DB yarış ve bileşen geç yanıt testleri ayrı). Harness exit0 ve geçici DB/container/route temizliği tamamlandı; TypeScript tekrar kontrol edildi. Üretim değişmedi.
