# BPS — Tenant bazlı seçilebilir modüller: uygulama planı

> Birleştirilmiş ana karar ve uygulama sırası: [Çalışma Alanı ve Ayarlar ana planı](../../01_product/CALISMA_ALANI_VE_AYARLAR_ANA_PLANI.md). Bu dosya ayrıntı/araştırma eki olarak korunur.


Tarih: 28 Eylül 2026 · Durum: uygulama öncesi detaylı plan · Sürüm: 1 + teknik v2 eki
Referans: canlı `01c46b561ee20263a82331067ffda6f7b13c8cb6`.
İncelenen kod: `/private/tmp/bps-notification-inbox-20260928`.
Bu belge ürün veya üretim veritabanı değişikliği yapmaz. Tablo/RPC adları öneridir; migration numaraları uygulama sırasında güncel ledger üzerinden atanacaktır.

İlgili araştırma: [Modül envanteri ve sektör benchmarkı](./modul-envanteri-ve-sektor-plani.md).

> Teknik karar güncellemesi: [Teknik mimari v2](./teknik-mimari-v2.md). Scope, protokol sürümleri, veri projeksiyonları, bildirim teslimi ve uyumluluk konularında bu ek önceliklidir. Kabul kapsamı T01–T38 oldu.

> Ürün karar eki: [Yeni benchmarklar ve kararlar v3](./benchmark-karar-ekleri-v3.md). Önkoşul açıklamaları, şablon değişim farkı ve kurulum UX ayrıntıları bu ekte tanımlı.

## 1. Hedef ve tamamlanma tanımı

BPS kullanan her şirket yalnız ihtiyaç duyduğu iş modüllerini açabilsin. Personel hizmeti vermeyen bir şirket müşteri, görev, takvim, belge ve sözleşmeleri kullanırken personel talebi/İDP/işe başlama kavramlarıyla karşılaşmasın. Mek Group ve Partner Staff mevcut işlerini veri veya erişim kaybı olmadan sürdürsün.

Tamamlandı demek için:

- Şirket bazlı modül seçimi veritabanında saklanıyor; yalnız tarayıcı tercihi değil.
- Masaüstü, mobil, ana ekran, raporlar, kurulum, bildirimler ve doğrudan bağlantılar aynı seçime uyuyor.
- Sunucu, doğrudan Supabase erişimi, RPC, dosya işlemleri ve arka plan işleri aynı sınırlara uyuyor.
- Mevcut rollerin verdiği haklar artmıyor; tenantlar birbirine karışmıyor.
- Kapatma verileri silmiyor; açık işleri ve bağımlılıkları göz ardı etmiyor.
- Gerçek kullanım senaryoları, DB yarış testleri ve canlı yayın doğrulaması tamamlanmış.

### Kapsam dışında

Yeni ERP, stok/üretim/bordro/e-fatura modülleri; sektör başına ayrı repo/backend; plugin pazaryeri; kullanıcı tanımlı kod/workflow; faturalandırma ve plan satışı; alan bazında onlarca aç/kapa; kişi performans puanı; süreye bağlı yönetici bildirimi. Modülerleştirme, eksik bir iş özelliğini tamamlanmış saydırmaz.

## 2. Karar defteri

| Konu | V1 kararı | Gerekçe |
|---|---|---|
| Seçim kapsamı | Tenant | Mek/Partner ayrımıyla uyumlu; şube/ekip düzeyi karmaşıklığı yok |
| Sektör | Öneri bilgisi | Aynı sektörde farklı çalışma biçimleri olabilir |
| Şablon | İlk seçimi doldurur; sonradan canlı bağlantısı yok | Şablon güncellemesi tenant ayarını sessiz değiştirmesin |
| Rol | Mevcut üyelik/kayıt izinleri korunur | Modül açmak kullanıcıyı yetkilendirmez |
| Yönetim | Tenant yöneticisi; platform işlemleri ayrı denetlenir | Platform adminlik aktif tenant üyeliğinin yerine geçmesin |
| Başlangıç | Mevcut tenantlara davranışı koruyan açık kayıtlar | Eski müşterilerde ani kayıp yok |
| Eksik yapılandırma | Hata ve yeniden dene; iş ekranları kapalı | Eksik veri “hepsi açık” veya sahte sıfır olmasın |
| Kapatma | Veriyi koru, normal erişimi durdur | Silme ile ürün tercihi farklı |
| Açık işler | Kapatma engeli; çözüm bağlantıları | İşler görünmez halde kalmasın |
| Geçmiş okuma | V1'de yeniden etkinleştirme gerekir | Gizli arşiv yetkisi yaratmayalım |
| Temel altyapı | Kapatılmaz | Kimlik, tenant, kişi/şube çekirdeği, audit ve dosya altyapısı |
| Yayın flag'i | Modül tercihinden ayrı | Operasyonel rollout ile müşteri tercihi karışmasın |

## 3. Modül kataloğu

Sabit teknik anahtarlar kullanıcı tarafından değiştirilemez. Kullanıcı Türkçe adları görür. Katalog kodda tanımlanır; DB'de izinli anahtarlar aynı sürümden üretilen kısıtla doğrulanır. İki ayrı elle tutulan listeye izin verilmez; CI eşleşme kontrolü yapar.

| Anahtar | Kullanıcı adı | Gerekli görünür modül | Ortak altyapı / kritik sınır |
|---|---|---|---|
| customers | Müşteriler | Yok | Firma ve iletişim kayıtları |
| tasks | Görevler | Yok | Bağımsız görev mümkün; müşteri/randevu/sözleşme bağları isteğe bağlı |
| calendar | Takvim ve görüşmeler | V1'de customers | Mevcut firma ilişkili randevular korunur; bağımsız randevu ayrıca yapılmadıkça vaat edilmez |
| documents | Belgeler | V1'de customers | Firma belgeleri; havuz eki ve rapor kaynak dosyası kendi modülüne ait |
| contracts | Sözleşmeler | customers + documents | Sözleşme dosyası sahipliği contracts; yalnız documents açık diye sözleşme PDF erişimi açılmaz |
| talent | Personel havuzu | Yok | Aday kartı, uygunluk, ekler ve aktarım; operasyon geçmişi ayrı izinli katkı |
| staffing | Personel operasyonu | customers | Temel kişi/şube dizini; zengin havuz UI'sı zorunlu değil |
| reporting | Proje raporlama | customers | Proje/dönem/gerçekleşme ve kaynak dosyası; staffing zorunlu değil |
| finance | Finansal özet | customers | Firma alacağı/Luca; reporting veya staffing zorunlu değil |
| announcements | Duyurular | Yok | Mevcut temel duyuru; yeni hedefleme/okundu ayrı geliştirme |

Bu bağımlılıklar V1 ürün kararıdır. İlk teknik eşleme paketinde mevcut servisler bunlarla çelişiyorsa eksik ayrıştırma işi açılacak; yanlış bağımlılığı kullanıcıya kalıcı zorunluluk diye sunmayacağız.

### Görünür modül olmayan altyapı

Oturum, şirket seçimi, ekip/yetki, denetim kayıtları, dosya yükleme mekanizması, sayfalama, filtre altyapısı, bildirim kabuğu ve genel görünüm. Bunlar ortak hizmettir. Altyapının açık kalması doğrudan tüm tablolara kullanıcı erişimi anlamına gelmez.

Kişi ve şube çekirdeği ortak olmalı: bugün `ops_workers` ile `talent_people.worker_id` arasında FK var. Şimdilik tablo adını değiştirmek gereksiz büyük migration olur. Mevcut tablolar korunur; çağrılar kullanım amacına göre sınırlandırılır. İstemcinin gönderdiği `purpose` tek başına yetki sayılmaz; hangi yetkili RPC'nin hangi alanları döndürdüğü belirleyicidir.

### Operasyon alt seçenekleri

`staffing` içinde İDP, sabit kadro ve günlük/dönemsel çalışma biçimleri. İlk güvenlik geçişinde bunlar bağımsız yetki kapıları değil, iş akışını sadeleştiren kurulum tercihleri olacak. İşe başlama/yedek/çalışma onayı ayrı satılabilir modül yapılmayacak. Alt seçenek kapatma veri erişimini durduracaksa bunu V2 güvenlik işi olarak ayrıca ele almak gerekir; görünüm tercihi ile güvenlik engeli aynı isimle sunulmaz.

## 4. Örnek şirket konfigürasyonları

### Genel ekip/müşteri şirketi

customers, tasks, calendar, documents, announcements açık. contracts ve finance ihtiyaca göre. talent/staffing/reporting varsayılan kapalı.
Menü: Genel Bakış / Görevler / Takvim / Müşteriler / Belgeler / Ayarlar. Duyurular ana ekranda; sırf açık diye yeni sidebar satırı şart değil.

### Mek ve Partner geçişi

Mevcut tüm kullanılabilir modüller başlangıçta açık, bugünkü erişim rolleri aynı. Mek için İDP/sabit; Partner için günlük/dönemsel kurulum önerisi gösterilebilir fakat kayıtlı işler ölçülmeden otomatik kapatma uygulanmaz.

### Dış proje raporlama

customers, reporting, documents, contracts, tasks açık. staffing ve talent kapalı. Projeye şube bağlanabilir; bunun için günlük personel talebi açmak gerekmez.

### Yalnız aday havuzu

talent ve gerekirse tasks açık. Firma kaydı veya günlük talep açmadan aday ekleme, filtreleme, iletişim kaydı ve ek yükleme çalışmalı. Operasyon atama geçmişi bileşeni sorgu yapmaz. Profilde olmayan bilgi “0 görev” diye yorumlanmaz.

## 5. Ekranlar ve kullanıcı akışı

### 5.1 Yeni tenant kurulumu

1. Şirket adı ve mevcut üyelik kurulumu.
2. “Hangi işleri burada takip edeceksiniz?” iş odaklı çoklu seçim.
3. İsteğe bağlı sektör seçimi; önerilen seçimleri değiştirebilir. “Diğer” geçerli seçenek.
4. Yalnız seçili işlerin ek soruları. staffing yoksa İDP/şube/personel soruları yok.
5. Menü ve ana ekran kartlarının kısa önizlemesi.
6. “Çalışma alanını oluştur” atomik tenant + yönetici üyelik + konfigürasyon oluşturur veya mevcut provisioning akışına güvenli şekilde eklenir. Başarısızlıkta yarım tenant açılmaz.
7. İlk iş önerisi: modülün gerçek başlangıç aksiyonu; boş şablon verisi oluşturulmaz.

### 5.2 Ayarlar → Modüller

Sayfada şirket adı, mevcut seçim, arama gerektirmeyecek on kart/satır. Her biri: ad, tek cümle fayda, etkinlik anahtarı, gerekli diğer modüller. Teknik anahtarlar kullanıcıya gösterilmez.

Değişiklikler yerel taslakta birikir. Alt çubuk: “3 değişiklik” / Vazgeç / Değişiklikleri incele. İnceleme yanıtı geldikten sonra “Kaydet”. Yetkili olmayan kullanıcı modül ayarını değiştiremez; sunucu da reddeder.

Bağımlılık örneği: “Sözleşmeler için Müşteriler ve Belgeler de açılacak.” Kullanıcıya toplam değişiklik sunulur. Kapatırken bağımlı modüller sessizce kapatılmaz: “Müşteriler, Sözleşmeler tarafından kullanılıyor.” Çözüm seçilir ve tüm değişiklik tek transaction ile uygulanır.

### 5.3 Kapatma önizlemesi

Üç bölüm: hangi ekranlar kalkacak, hangi kayıtlar korunacak, hangi açık işler engelliyor. Sayı alınamazsa kapatılabilir denmez. Engellerin listesi sayfalı, ilk sınırlı örnekler ve yetkili çözüm bağlantıları içerir; tüm kayıtlar tarayıcıya indirilmez.

Örnek: “Personel operasyonu kapatılamıyor: gelecekte görevlendirmeler ve etkin tekrar planları var.” “Planları incele” ve “Görevlendirmeleri incele” bağlantıları. Önizleme izin değildir; Kaydet sırasında aynı kontroller kilit altında tekrar yapılır.

### 5.4 Kapalı rota ve eski bağlantı

Ekran: “Personel operasyonu bu şirkette kullanılmıyor.” Yöneticiye Modüllere git; diğer kullanıcıya Genel Bakış'a dön. Kayıt adı, sayısı veya detay sızdırılmaz. Oturumsuz istek normal giriş akışına gider; kapalı modül bilgisi anonim kullanıcıya açıklanmaz.

### 5.5 Modül ayarı değişirken açık form

Eski sekme algılandığında ilgili yazma kontrolleri durur, açık form kaybolmaz; “Şirketin modül ayarları değişti. Bu işlem artık kullanıma kapalı.” Kaydet başarısızlığında başka şirkete veya başka modüle otomatik taşıma yok. Mevcut güvenli taslak koruması sürer; modül konfigürasyon güncellemesi tüm form ağacını düşünmeden unmount etmez. Şirket değişimindeki mevcut daha sıkı veri ayırımı korunur.

### 5.6 Dashboard, mobil ve yardımcı yüzeyler

- Genel Bakış sabit üst başlık; kart kaydı modül + rol şartlarını kullanır.
- Kapalı kartın component'i mount edilmez; yalnız CSS ile gizlenmez.
- Erişim doğrulanmadan önce bütün kartları kısa süre gösterme yok.
- Mobilde 3–4 ilgili kısayol; yalnız iki iş varsa iki kısayol. Boş yer doldurmak için kapalı modül eklenmez.
- Firma detayındaki sekmeler, hızlı oluştur, rapor kataloğu, yönetim bağlantıları, arama, son aktiviteler, dışa aktarım ve kurulum checklist'i aynı katalogdan beslenir.
- Bildirim olaylarında kaynak modül alanı bulunur; kapalı kaynağın içerikleri listelenmez veya ses üretmez. Yeni görev/duyuru olayları bu kural üzerine eklenir.

## 6. Veri modeli taslağı

V1'de üç tablo yeterli; plugin/abonelik tabloları yok.

### tenant_module_config

- `tenant_id uuid primary key`, tenants FK.
- `revision bigint not null`, pozitif; başarılı değişiklikte bir artar.
- `catalog_version integer not null`.
- `industry_code text null` ve `preset_key text null`, `preset_version integer null` (uygulanan önerinin kaydı).
- `created_at`, `updated_at`, `updated_by`.
- Her tenant için tam bir satır; günlük modül mutasyonları için ortak kilit noktası.

### tenant_module_settings

- `tenant_id`, `module_key` bileşik primary key.
- `enabled boolean not null`.
- config'e FK; izinli module_key CHECK.
- V1 on modülün tamamı için açık/kapalı satır. Satır yokluğu kapalı seçimiyle karıştırılmaz: yapılandırma geçersizdir.
- Kullanıcının doğrudan INSERT/UPDATE/DELETE yetkisi yok. Değişiklik yalnız yönetim RPC'si.

### tenant_module_changes

- tenant_id, actor_id, command_id, request_hash; tenant+actor+command eşsiz.
- önceki/sonraki revision, değişen anahtarların önceki/sonraki boolean değerleri, zaman, sonuç.
- Aynı command farklı payload ile kullanılamaz. Hash sunucuda kanonik payload'dan türetilir.
- Başarılı yeniden denemede aynı sonuç döner; önce hâlâ canlı üyelik/yetki denetlenir.
- Denetim satırı değişiklik transaction'ının parçası; başarısız işlemler uygulama logunda PII içermeyen hata kodu ile tutulur.
- Kullanıcıya aday/kişi içeriği, mail veya belge metni bu tablo üzerinden taşınmaz.

Gerekli indeksler: ayar tablosu PK çoğu sorguya yeterli; audit için `(tenant_id, changed_at DESC, id DESC)`. Ek indeks yalnız sorgu planına göre. Şablonlar kodda versiyonlu veri; ayrı runtime kural motoru yok.

### RPC sözleşmeleri (öneri)

| Fonksiyon | Girdi | Çıktı / davranış |
|---|---|---|
| workspace_module_context | beklenen actor/tenant isteğe bağlı doğrulama | doğrulanmış scope, configRevision, catalogVersion, enabledModules |
| preview_module_changes | expectedRevision, açık/kapalı değişiklikler | tam normalize değişiklik kümesi, bağımlılıklar, engeller, korunacak veri özeti |
| apply_module_changes | expectedRevision, commandId, değişiklikler | yeni revision ve nihai etkin küme; kilit altında tüm kontroller |
| assert_module_read | doğrulanmış tenant + sabit module key | izin ver/standart hata; kullanıcıya doğrudan geniş sorgu aracı değil |
| lock_and_assert_module_write | doğrulanmış tenant + sabit module key | config ortak kilidi + güncel durum kontrolü; transaction sonuna kadar |

RPC adlarının projedeki mevcut fonksiyonlarla çakışmadığı katalogdan kontrol edilir. JSON yanıtları TypeScript tarafında fail-closed parse edilir. `null`, bozuk enum, yinelenen key, eksik zorunlu satır ve scope farkı başarı sayılmaz.

## 7. Yetki ve eşzamanlılık

### 7.1 İzin kuralı

Bir işleme izin = doğrulanmış oturum ∧ canlı tenant üyeliği ∧ mevcut rol/kayıt izni ∧ modül etkinliği. Çoklu modül işleminde gereken bütün izinler sağlanır. Kullanıcı meta verisindeki tenant veya istemcinin enabled listesi güvenlik kaynağı değildir.

RLS tablo okumaları için modül şartı mevcut tenant/kayıt şartına AND olarak eklenir; yeni permissive policy ile yanlışlıkla OR üzerinden eski kapı açık bırakılmaz. SECURITY DEFINER RPC'lerde modül kontrolü fonksiyonun kendisinde gerekir. Sahip, search_path, EXECUTE grant, PUBLIC/anon erişimi incelenir. Ortak tablolar tek bir görünür modüle körlemesine kilitlenmez; dar projeksiyonlu yetkili RPC gerekir.

### 7.2 Yazma ve kapatma yarışı

Hedef: kapatma tamamlandıktan sonra eski formdan yeni bir işin commit edilmemesi.

Önerilen sıra:

1. Yetkili iş yazma RPC'si, iş satırlarını kilitlemeden önce `tenant_module_config` satırını `FOR SHARE` ile kilitler.
2. Kilitten sonra canlı kapsam/rol ve modül durumu doğrulanır, mevcut iş mantığı çalışır.
3. Modül ayarı değiştirme RPC'si aynı config satırını `FOR UPDATE` ile kilitler.
4. Kilit alındıktan sonra revision, yetki, bağımlılıklar ve açık işler yeniden okunur; uygunsa ayar ve audit atomik kaydedilir.
5. Bekleyen yazıcı, kapatma sonrası kilidi alınca güncel kapalı durumu görür ve reddedilir. Önceden başlamış yazıcı önce biter; kapatma onun oluşturduğu açık işi görüp engellenebilir.

Bu strateji READ COMMITTED için iki bağlantılı gerçek DB testi ile ispatlanacak. Kilit alan assertion VOLATILE/PLpgSQL yazma yolu olmalı; eski STABLE read helper'a yan etki eklenmez. Yetki değişimi/profile kilitleriyle sıralama ayrıca incelenir. Tek sıralama belgesi çıkarılmadan “deadlock olmaz” iddiası yok.

Doğrudan tablo yazan eski istemci yolları bu garantiyi yalnız RLS kontrolüyle sağlayamaz. Katalogda bunlar açıkça işaretlenip korumalı RPC'ye taşınır; tüketiciler taşındıktan sonra ilgili doğrudan DML grant'leri kaldırılır. Bir row trigger'ın ilk iş kilidinden sonra çalışması nedeniyle genel çözüm olduğu varsayılmaz. Dönüştürülmemiş yol varsa o modül kullanıcı tarafından kapatılamaz; yarım güvenlik yayınlanmaz.

Uzun Excel aktarımı tek büyük kilitle yapılmaz. Her commit edilen parça config kilidini alır; aktif aktarım statüsü kapanma önizlemesinde engeldir. Önizleme hesaplaması kilit tutmaz. Ağ/e-posta/dosya transferi sırasında DB transaction açık tutulmaz.

### 7.3 Garantinin sınırı

Önceden tamamlanmış okuma kullanıcının ekranından veya indirilmiş dosyasından geri alınamaz. Snapshot ile devam eden okumanın anında iptal edildiği vaat edilmez. Yeni talepler yetkiyi kontrol eder; arayüz focus/visibility/config refresh ile eski durumu kapatır. Önceden üretilmiş signed URL, geçerlilik süresince kullanılabilir; kısa süre ve yeni URL üretim kontrolü uygulanır.

### 7.4 Hata sözlüğü

`MODULE_DISABLED`, `MODULE_CONFIG_UNAVAILABLE`, `MODULE_DEPENDENCY`, `MODULE_HAS_OPEN_WORK`, `MODULE_REVISION_CONFLICT`, `MODULE_FORBIDDEN`, `MODULE_BUSY`.

Modül kapalı ≠ yetkisiz ≠ ağ hatası. Kullanıcıya “Ayarlar alınamadı, tekrar deneyin” ile “Bu modül şirketinizde kapalı” ayrı gösterilir. Lock timeout sessiz başarıya veya kısmi ayara dönüşmez. Yalnız idempotent komutlar sınırlı tekrar edilebilir.

## 8. Veri sahipliği ve kapanma engelleri

| Modül | Kapatmayı engelleyecek durum | Geçmişte saklanacak veri |
|---|---|---|
| customers | Bağımlı etkin modüller, devam eden firma aktarımı | Firmalar ve kişiler |
| tasks | Açık/devam eden işler; atanmamış açık işler de dahil | Tamamlanan görevler, atama geçmişi |
| calendar | Sonuçlandırılmamış gelecekteki görüşmeler | Tamamlanan/iptal randevular |
| documents | contracts bağımlılığı, devam eden upload/finalize | Belgeler, nesne metadata'sı |
| contracts | Etkin sözleşmeler, tamamlanmamış belge/yenileme işlemi | Süresi biten/iptal kayıt ve ekler |
| talent | Çalışan aktarım/birleştirme/ek yükleme ve açık arama listesi işi | Adaylar, iletişim kayıtları, ekler |
| staffing | Açık talepler, sonuçsuz atamalar/teyitler/onaylar, aktif İDP/kadro/tekrar planları | Geçmiş çalışma ve olaylar |
| reporting | Kapanmamış rapor dönemi, işlenen aktarım, kaynak dosya işlemi | Kapanmış dönem ve raporlar |
| finance | Devam eden Luca aktarımı/uzlaşmamış aktarım işlemi | Mizan ve mali özet kayıtları |
| announcements | İleride zamanlanmış yayın varsa o iş; bugünkü temel modelde bu özellik yok | Eski duyurular |

Bunlar iş kuralları hedefidir. Kesin SQL, mevcut durum enum'ları ve gerçek tamamlanma alanları üzerinden yazılacak. Geçmiş tarihli her kayıt açık iş değildir; tarihe bakarak otomatik kapatma yok. Bilinmeyen durum kapanmaya uygun sayılmaz. Modül kapatma için gerçek bir açık işi sahte “tamamlandı” yapmaya teşvik etmeyiz; gerekli ise mevcut iptal/devret akışı kullanılır.

`talent` kapalı, `staffing` açık olabilir: mevcut operasyon kişi çekirdeği ve atamalar korunur, yeni zengin havuz kaydı UI'sı kapanır. Havuz kapatma operasyon personelini devre dışı bırakmaz. Bu kombinasyon kanıtlanamıyorsa seçim geçici olarak bağımlılık engeliyle kapatılır ve ayrıştırma işi bitirilir.

## 9. Dosya ve entegrasyon yüzeyleri

- Genel firma belgesi: documents + ilgili firma erişimi.
- Sözleşme PDF'si: contracts + ilgili sözleşme/firma erişimi.
- Aday eki/fotoğrafı: talent + aday erişimi.
- Proje kaynak dosyası: reporting + proje erişimi.
- Upload başlatma, upload metadata, finalize, indirme/link üretme, silme/geri alma ayrı ayrı kontrol edilir.
- Upload başladıktan sonra modül kapanırsa finalize reddedilir; yetim nesne yalnız doğrulanmış kendi upload kimliği ve güvenli temizlik süreciyle ele alınır. Veri sızıntısını önlemek için dosya adı/prefix tek başına sahiplik kanıtı değildir.
- Cron `service_role` kullandığından modül kapısı açıkça uygulanır. Sözleşme/görev/evrak/randevu e-postası kaynak modül kapalıysa yeni gönderim planlanmaz.
- Dış e-posta sağlayıcısına teslim edilmiş ileti geri alınamaz. Kapatma ile aynı anda gönderim için “sıfır geç teslim” garantisi verilmez; kuyruk/dispatch öncesi tekrar kontrol ve durum kaydı tutulur.
- Bu iş gerçek kişilere test bildirimi göndermeyi kapsamaz. Testler sentetik alıcı/stub transport ile yapılır.

## 10. Kod değişiklik haritası

### Yeni küçük ortak katman

- `src/lib/modules/catalog.ts`: anahtar, isim, bağımlılık ve yüzey metadatası.
- `src/lib/modules/config.ts`: response parser, revision/scope doğrulama.
- `src/lib/modules/server.ts`: yetkili context / standart hata adaptörü.
- `src/lib/modules/presets.ts`: versiyonlu öneriler.
- `src/context/ModuleContext.tsx`: yalnız doğrulanmış tenant durumunu UI'ya verme.
- `src/app/(main)/ayarlar/moduller/`: düzenle/önizle/kaydet ekranı ve action'ları.

Bunlar önerilen dosya yollarıdır; ortak mevcut context tekrarını artırmamak için uygulamada gerekirse WorkspaceContext içine dar bir genişletme tercih edilir. İki ayrı bağımsız scope kaynağı yaratılmaz.

### Mevcut değişecek yüzeyler

| Yüzey | Somut kaynak | Yapılacak |
|---|---|---|
| Tenant scope | `AuthContext.tsx`, `WorkspaceContext.tsx`, `workspace-context.ts`, `auth-workspace.ts` | moduleRevision ve güvenli cache/scope geçişi; üyelik generation davranışını koru |
| Menü | `Sidebar.tsx`, `MobileOperationsNav.tsx`, `Topbar.tsx`, `Layout.tsx` | Aynı katalog, rol+modül; kapalı provider/poller mount etme |
| Dashboard | `src/app/(main)/dashboard/*`, `src/lib/supabase/dashboard-cards.ts` | Kart ve sorgu düzeyinde modül seçimi |
| Yönetim/kurulum | `yonetim/ManagementBoard.tsx`, `kurulum/*`, `ayarlar/*` | Sabit personel bağlantılarını kaldır; etkin işlere göre checklist |
| Firma ayrıntısı | `firmalar/[id]/*` | Sekmeler ve toplu özetlerde kaynak modül kontrolü |
| Havuz | `personel-havuzu/*`, `talent_assert_scope`, `talent_person_detail/json` | Havuz bağımsız; operasyon projeksiyonu koşullu |
| Operasyon | `talepler/*`, `src/lib/operations/*`, `src/lib/services/*` | Mutasyon başı modül kilidi, ortak dizin ayrımı |
| Projeler | `src/lib/project-reporting/server.ts`, `projeler/*`, `reporting_*` RPC'leri | Operasyonsuz proje/şube/rapor senaryosu |
| Finans/rapor | `finansal-ozet`, `luca-import`, `raporlar/ReportsClient.tsx` | Kaynak modül sorgularını ve raporları ayır |
| Dosya | `api/contracts/pdf-upload`, `pdf-upload-context.ts`, `projeler/source-actions.ts`, talent attachments | Sahip modüle göre tüm aşamalar |
| Bildirim | `iletisim/actions.ts`, `ConversationInbox.tsx`, `api/cron/notifications`, `src/lib/email/*` | Olay kaynağı + etkinlik; service-role denetimi |

Geçmiş migration dosyaları değiştirilmez. Mevcut fonksiyonların son etkin tanımları DB/catalog + migration zincirinden bulunur; sadece ilk CREATE FUNCTION metnine göre karar verilmez.

## 11. Uygulama paketleri

### M0 — Tam erişim haritası ve başlangıç ölçümü

Çıktı: makine okunur `module-surface-map.json` ve incelenmiş markdown.
Route, server action, HTTP endpoint, `.from` erişimi, RPC exact signature, view, trigger, storage policy, cron ve export başına sahibi/kullanıcıları/izin tipi/testi yazılır. Dinamik SQL ve runtime tablo adı gibi statik taramanın kaçırabileceği yerler ayrıca incelenir.

DB şema/izin kataloğu salt okunur karşılaştırılır; kişisel iş verisi yedeği çıkarılmaz. Özellikle legacy talep/iş gücü, ops_workers, şirket notları ve finans kolonlarının ortak kayıtla nasıl döndüğü çıkarılır. Bilinmeyen yüzey boş listeyle başarı sayılmaz.

Kabul: bütün kullanıcıya açık yolların sahibi veya gerekçeli ortak altyapı etiketi var; ana çalışma klasöründeki yayımlanmamış işler kazara kapsamda değil; canlı commit/ledger ölçülmüş.

### M1 — Konfigürasyon temeli, davranış değişikliği yok

Katalog/preset/parser testleri; üç tablo, grant ve RPC iskeleti. Mevcut tenantlara on modülün açık satırları; yeni tenant provisioning'e atomik varsayılan seçim. Şirket başına eksiksizlik raporu.

Ayar değişimi henüz son kullanıcıya açık değil. Okuma gölge modda mevcut menüyle karşılaştırılır; shadow mode izin bypass'ı oluşturmaz, enforcement henüz kullanıcı seçimi sunulmayan tüm-açık konfigürasyonda hazırlanır.

Kabul: null/hatalı cevap reddi, yetkisiz ayar yazma reddi, idempotency ve revision testleri, sıfır eksik tenant konfigürasyonu.

### M2 — Modül güvenlik kapıları ve paylaşılan kayıt ayrımı

Modül bazında direct reads/RLS/RPC/DML dönüşümü, kaynak dosya ve cron kapsamı. Yazma kilit sırası çıkarılır ve mevcut üyelik/atama kilitleriyle test edilir. Ortak çalışan/şube/firma projeksiyonları daraltılır. Tamamlanmayan modül kapatılamaz.

Kabul: gerçek DB testlerinde tenant/role/disabled/RPC/direct REST/storage atlatma denemeleri başarısız; açık modüllerde mevcut davranış geçer. Her modül için enforcementReady yalnız incelenmiş/test edilmiş kod sürümünün rollout metadatasıdır; müşteri tarafından değiştirilemez.

### M3 — Genel şirket UX'i ve ayar ekranı

Sidebar/mobil/dashboard/kurulum/detaylar/raporlar birlikte katalogya geçer. Modüller ekranı, önizleme, engeller, kaydet, revision conflict ve form koruması. Yeni şirket kurulum önerileri.

Kabul: sentetik genel şirket sadece müşteri/görev/takvim/belge kullanır; personel menüsü/kartı/sorgusu yok. Modül ayar yüklemesi başarısızsa eski başka tenant görünümü yok.

### M4 — Kapatma, uzun işler ve operasyon uyumluluğu

İDP/sabit/dönemsel, havuz-only, reporting-only kombinasyonları; Excel parça commitleri, yarım upload, eski sekme, iki yönetici, aktif plan ve geçmiş erişim. Gerekli dar ayrıştırmalar burada tamamlanır; “Diğer” proje türünün genel sektör kabiliyeti abartılmaz.

Kabul: çift bağlantılı yarış testleri, üretim benzeri büyük sentetik liste, mevcut veri korunması, devre dışı modülde yeni görev/bildirim oluşmaması.

### M5 — Üretime kontrollü geçiş

Yeni şema + geriye uyumlu uygulama sırası aşağıdaki runbook ile. Önce tüm-açık mevcut tenantlar üzerinde davranış korunur. Sektör şablonu mevcut şirketin modüllerini otomatik değiştirmez. Sonra sentetik test tenantında modül değişimleri; kabulden sonra yöneticinin seçim ekranı açılır.

Kabul: exact commit/deployment doğrulaması, migration ledger eşleşmesi, canlı kimlikli masaüstü/mobil temel akış, DB güvenlik postcheck, gözlem raporu ve Obsidian güncellemesi.

### M6 — Yeni modüller ve bildirimlerle entegrasyon

Görev ataması ve duyuru bildirimi işi bu temel üzerine devam eder; her yeni olay/route/query katalogda kaynak modülle tanımlanır. Modülerleştirme tamamlandı diye duyuru hedefleme veya yeni sektör özellikleri tamamlandı sayılmaz.

## 12. Test matrisi

| No | Senaryo | Beklenen |
|---|---|---|
| T01 | Eksik/null/bozuk konfigürasyon | İş ekranı açılmaz; doğru hata |
| T02 | A tenant staffing kapalı, B açık | A'da kapalı, B'de normal; cache sızıntısı yok |
| T03 | Üyelik kaldırılır veya rol düşer | Eski modül cache'i erişim sağlamaz |
| T04 | Operasyon/İK kullanıcısı apply RPC çağırır | Yetki reddi |
| T05 | Modül açılır ama kullanıcı rolü erişemez | Yetki reddi devam eder |
| T06 | URL/RPC/doğrudan tablo üzerinden kapalı modül | Veri/yazma reddi; gerekirse liste için RLS boş sonuç ancak UI modül durumunu ayırır |
| T07 | Permissive policy veya SECURITY DEFINER atlatma | Hiçbir eski kapı açık kalmaz |
| T08 | İki yönetici aynı revision ile değiştirir | Bir başarı, bir conflict; kayıp güncelleme yok |
| T09 | Aynı komut yeniden gönderilir | Tek audit/aynı sonuç; farklı payload reddi |
| T10 | Kapatma + yeni görev/atama eşzamanlı | Sıralamaya göre yazı önce tamamlanır ve kapatma engellenir veya yazı reddedilir |
| T11 | Kapatma + aktif plan/aktarımı başlatma | Aynı güvence; TOCTOU yok |
| T12 | Üyelik değiştirme + modül değiştirme/yazma | Yetki ihlali yok; kilit sırası doğrulanır |
| T13 | Ağ kesilir, lock timeout, transaction hata | Kısmi konfigürasyon/audit yok |
| T14 | Eski açık sekmede form kaydet | Açık hata, taslak korunur, başka tenant'a aktarılmaz |
| T15 | Kapat → yeniden aç | Kayıt kimlikleri/tarihçe aynı; kaçırılan işler kendiliğinden tetiklenmez |
| T16 | staffing kapalı, talent açık | Aday işlemleri çalışır; operasyon geçmişi sorgulanmaz |
| T17 | talent kapalı, staffing açık | Kişi dizini/görevlendirme çalışır; zengin havuz erişimi yok |
| T18 | staffing/talent kapalı, reporting açık | Şube/proje/dönem/kaynak dosya çalışır |
| T19 | customers kapatılırken bağımlı modül açık | Bağımlılık mesajı, mutasyon yok |
| T20 | Dosya başlat → kapat → finalize | Yetkisiz sonuç oluşturulmaz; temizlenebilir upload durumu |
| T21 | Eski signed URL | Sınır belgelenir; yeni link üretimi reddedilir |
| T22 | Cron ve inbox kaynağı kapalı | Yeni gönderim planlama/ses/içerik yok; eski provider teslim sınırı belgelenir |
| T23 | Mobil 360/390, masaüstü, klavye | Taşma yok, mantıklı odak, en az 44px temel kontroller |
| T24 | Kaynak veri yok/yüklenemiyor | Sahte 0 veya örnek veri yok |
| T25 | Büyük sentetik tenant | Önizleme sayfalı/indeksli; gereksiz tüm veri indirme yok |
| T26 | Eski istemci/eski deployment | DB kapısı geçilemez; uyumlu rollback sınırı bilinir |

Birim testleri: katalog döngüsü/bilinmeyen key, bağımlılık closure, parser, kart/nav seçimi, hata eşlemesi. DB testleri: gerçek Postgres/RLS/RPC, eşzamanlı iki bağlantı. UI testleri: kullanıcı sonucu. Uygulamayı aynalayan önemsiz testler yerine yukarıdaki riskler hedeflenir.

## 13. Performans ve gözlem

- Modül kontrolü için her kart ayrı HTTP isteği atmaz; doğrulanmış workspace bootstrap'a bir defa eklenir veya tek scoped çağrı kullanılır.
- Sunucu isteği içinde memoization olabilir; tenantlar arasında kapsamı belirsiz cache yok. Yazma izni stale UI cache'den alınmaz.
- Başlangıç, focus/visibility ve ayar kaydı sonrası yenileme; aynı sayfada birden çok context poller yaratılmaz. Modül değişimi nadir olduğu için ayrı realtime altyapısı şart değil.
- Kapalı modülde network çağrısı sayısı hedefi sıfır; ortak altyapının yetkili tüketici çağrıları bu ölçümden ayrı etiketlenir.
- Kapama önizlemesi COUNT/EXISTS ve sınırlı örnekler; tarayıcıya kişisel veri yığını indirilmez.
- Ölçümler: bootstrap ek süre/payload, p50/p95 modül RPC ve önizleme, lock bekleme/timeout, istek sayısı ve egress. İlk hedef: kritik ekranlarda baz ölçüme göre %10'dan fazla p95 bozulma varsa inceleme; bu ölçülmüş garanti değil kabul bütçesi.
- Loglar: tenant/command/config revision/modül/hata kodu; belge/aday metni veya gizli anahtar yok. Tenant ID içeren loglara mevcut erişim koruması uygulanır.

## 14. Migration ve yayın runbook'u

1. Güncel main/production SHA, repo durumu, migration ledger, mevcut flag'ler ölçülür. Plan referansı eskiyse dosya haritası yenilenir.
2. Temiz `codex/tenant-modules-*` worktree. Ana kirli klasör topluca stage edilmez; eski deploy klasöründeki `.env` veya kişisel veriler git'e alınmaz.
3. M0 yüzey haritası ve güncel SQL tanımları onaylanmış teknik girdidir. Uygulama yeni migration'larla yapılır.
4. Sentetik yerel Supabase üzerinde genişletici şema; mevcut tenantları tam açık backfill; yeni tenant provisioning. DB'ye her modül satırı eksiksiz yazılır.
5. Uyumlu yeni kodda konfigürasyon okuması ve kapılar; ayar değiştirme UI kapalı. Eski istemci yazma adaptörleri RPC'ye geçirildikten sonra grant değişimleri uygulanır. Gerekirse kısa bakım penceresi; eski client hata alabilir ama bypass edemez.
6. Testler/CI/build geçer. Sadece yeni migration setiyle preflight; grants/RLS/owner/ledger postcheck hazırlanır. Uygulama mevcut onaylı yayın prosedürüne uyar; bu belge üretim ölçümü yerine geçmez.
7. Production şema genişletmesi ve uyumlu uygulama yayını; kullanıcı modül kapatma henüz açık değil. Mevcut tenantlar eski kapsamlarını korur.
8. Güvenlik enforcement ve gerçek sentetik tenant kabulü tamamlanır. Menü/ayar UI açılır. Mevcut Mek/Partner modülleri kullanıcının seçimi olmadan kapanmaz.
9. Deployment kimliği/exact SHA, health, kimlikli smoke ve mobil doğrulama kaydedilir. İlk gözlem hataları sınıflanır; canlı kişilere test ileti gönderilmez.
10. `qa/latest-release.json`, paket manifest/rapor, kalan işler ve Obsidian güncellenir. Test sayısı ölçümden alınır; çalıştırılmayan DB/UI testi geçmişten başarı diye yazılmaz.

### Geri dönüş

Şema genişletmeleri silinmez; veri düşüren down migration yok. Sorun varsa yeni ayar değişimi kapatılır. Son modül-aware uyumlu deployment'a dönülür; modül ayarları ve güvenlik kapıları korunur. Bazı modüller kapandıktan sonra eski pre-module uygulamaya dönmek güvenli sayılmaz. “Hepsini aç” güvenlik bypass'ı rollback değildir. Tenant konfigürasyon düzeltmesi mevcut yönetim RPC'si ve audit üzerinden ayrı yapılır.

## 15. İş büyüklüğü, sıra ve riskler

Bu iş tek menü düzenlemesi değil; eski doğrudan DML yüzeyleri kapsamı belirler. M0 bitmeden kesin süre sözü verilmez. Göreli büyüklük: M0 orta; M1 orta; M2 en büyük; M3 büyük; M4 büyük; M5 orta. Dış bağımlılık esas olarak mevcut SQL/istemci geçişi; Supabase'ten taşınma gerekmiyor.

En büyük riskler ve karşılıkları:

1. Eski izin yolu açık kalması → endpoint/RPC/tablo/storage matrisi ve bypass testleri.
2. Paylaşılan çalışan/şube verisinin kopması → görünür modül ile ortak çekirdeği ayır; tenant FK'lerini koru.
3. İki yerde farklı modül listesi → tek katalogdan üretim/CI tutarlılığı.
4. Kapatılan modülde aktif iş kaybolması → atomik kapanma önkoşulları.
5. Eski sekme ve config yarışları → revision + sunucu yeniden kontrol + tutarlı kilit sırası.
6. Kapsamın ERP'ye kayması → mevcut on modül sınırı; yeni sektör ihtiyacı ayrı ürün işi.

## 16. İlk uygulama adımı ve teslimatlar

İlk kodlama turu M0 + M1'i hedefler: eksiksiz yüzey matrisi, tipli katalog, test edilmiş bağımlılık/parser, yerel migration ve davranışı değiştirmeyen konfigürasyon okuması. Bu aşamanın sonunda kullanıcıya modül kapatma düğmesi açılmaz. Sonraki büyük paket M2 + M3; ardından M4 + M5 kabul/yayın.

Her paket teslimi: amaç, değişen dosyalar/migration'lar, ölçülen test sonucu, kalan risk, üretim durumu. Her küçük adımda kullanıcıdan yeniden yönlendirme gerekmez; yalnız kapsamı değiştiren ürün kararı veya mevcut yetkiyi aşan işlem varsa ayrıca ele alınır.

Hazır sayılacak belgeler: modül kataloğu, veri/erişim yüzey matrisi, bağımlılık grafiği, rol×modül matrisi, kapanma engel listesi, migration runbook, test matrisi, release manifest ve kullanıcıya kısa kullanım notu.

## 17. Kaynaklar ve kanıt sınırı

Ürün benchmark kaynakları önceki envanter dosyasında. Teknik dayanaklar:
- [PostgreSQL satır kilitleri ve deadlock kuralları](https://www.postgresql.org/docs/current/explicit-locking.html): paylaşılan/dışlayan kilit tasarımının dayanağı; bizim fonksiyonların doğruluğu ayrıca test edilecek.
- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security): doğrudan veri erişimi güvenlik sınırının dayanağı; service-role ve definer yolları ayrıca denetlenecek.

Bu tur yalnız kod ve doküman okuması/plan yazımı yapıldı. Üretim şemasının güncel tanımlarını tekrar ölçme, kapsamlı erişim matrisi ve test yürütme M0 ve sonraki paketlerin işidir; burada tamamlanmış gibi gösterilmez.
