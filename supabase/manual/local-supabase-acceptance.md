# Yerel Supabase Auth/API kabulü

2026-09-09. **Son durum: yerel ortam açıldı, 17 Auth/API kontrolü geçti.**
Docker Desktop 29.7.2, Supabase CLI 2.75.0 ile ayrı test projesi.
Üretim bağlantısı veya `.env.local` kullanılmaz. Yeni migration'ların yerelde
uygulanması, üretimde uygulanmış oldukları anlamına gelmez.

## Neden ayrı fixture?

Repoda `supabase/config.toml` yok. `tenants`, `tenant_memberships` ve
`current_user_active_tenant()` oluşturma DDL'i de migration klasöründe bulunmuyor.
Bu nedenle mevcut tarihsel migration listesinin boş Supabase'e tek başına eksiksiz
kurulum yaptığı varsayılmaz. Eksik temelin yeniden oluşturulması ayrı iştir;
üretim içeriği kopyalanarak test verisi oluşturulmaz.

Bu test gerçek Supabase Auth, `auth.uid()`, `auth.jwt()` ve PostgREST kullanır.
Public şema yalnız pilotun gerekli sözleşmesini tanımlayan sentetik fixture'dır.
JWT tenant alanı fixture'da `app_metadata.active_tenant` olarak tanımlanır.
Üretimin tüm auth hook/trigger/rol/grant geçmişinin eşdeğerliği iddia edilmez.

## Kurulum

```sh
mkdir -p /private/tmp/bps-supabase-acceptance
supabase init --workdir /private/tmp/bps-supabase-acceptance
supabase start --workdir /private/tmp/bps-supabase-acceptance \
  -x realtime,storage-api,imgproxy,postgres-meta,studio,edge-runtime,logflare,vector,supavisor,mailpit
node scripts/qa-local-supabase.mjs
```

Init yalnız config yokken yapılır. Test mevcut pilot tablosu varsa çalışmaz; otomatik
reset/silme yoktur. Tek kullanımlık test ortamına Auth admin API üzerinden sentetik
kullanıcılar açar, profil/üyelikleri yerel SQL ile kurar. Parola/JWT/yerel service key
çıktıya yazılmaz. Test hiçbir uzak URL veya ortam dosyasını kabul etmez.
Yerel anahtarlar CLI status'tan süreç belleğinde okunur.

İki yeni migration gerçek kaynak dosyalarından okunur:
`20260909000100_daily_operations_pilot.sql` → `20260909000200_location_import.sql`.

## Kabul sınırı

Gerçek oturum → JWT → RPC → tablo/RLS → API yanıtı sınanır. İstemci doğrudan yazma,
rol reddi, tenant ayrımı, şube import tekrarları ve üyelik/rol değişiminden önce
alınmış JWT ile yazma denemeleri kapsamdadır.

Kimlikli Next.js tarayıcı akışı, tam tarihsel şema, gerçek admin RPC'sinin session
silme davranışı, Storage ve e-posta kapsam dışındadır. Önceki native PostgreSQL
iki bağlantılı yarış kanıtı ayrı betikte korunur.

Ortamı durdurmak (veriyi saklar):

```sh
supabase stop --workdir /private/tmp/bps-supabase-acceptance
```

Mevcut test verisini silmek için otomatik komut çalıştırılmaz. Bu ortam uygulamanın
`.env.local` adresine otomatik yazılmaz; sentetik şema tam uygulama şeması değildir.


## İlk çalıştırma — BLOKE, 2026-09-09

Docker info 29.7.2 yanıt verdi. İlk imaj indirmesi Docker containerd meta.db için
`read-only file system` hatasıyla sonlandı (exit 1). Host df çıktısında yalnız
549 MiB boş alan görüldü. docker ps boş; test şeması/migration/hesaplar kurulmadı.
`qa-local-supabase.mjs` yalnız syntax kontrolünden geçti; Auth/API testleri
çalışmadı ve PASS kanıtı yok. Yer açıldıktan sonra Docker yeniden başlatılıp aynı
start komutu denenmeli. Hiçbir kullanıcı dosyası veya Docker volume silinmedi.


## Yer açıldıktan sonraki çalıştırma — PASS, 2026-09-09

Kullanıcı disk alanı açtı; başlangıç ölçümü 17 GiB boştu. Supabase start exit 0.
Auth/Kong/DB sağlıklı, PostgREST API yanıtları başarılı. DB `server_version=17.6`.
İndirmelerden ve kurulumdan sonra 9.1 GiB boş alan ölçüldü.

`node scripts/qa-local-supabase.mjs` exit 0, **17 kontrol PASS**:

- Dört gerçek Auth oturumu: yönetici, operasyon, İK, diğer tenant yöneticisi.
- Uygulamanın gerçek firma servisinde doğrulanmış tenant filtresi.
- JWT ile talep/atama ve gerçek board servisinin yanıt çözümlemesi.
- Operasyonun personel oluşturmasının, İK plan okumasının, tenant dışı erişimin reddi.
- PostgREST RLS görünmezliği; doğrudan tablo yazısı ve anonim RPC reddi.
- Gerçek import servisiyle aktarım, yeniden yüklemede atlama ve rol sınırı.
- İptalde aktif atamaların kaldırılması.
- Eski JWT ile rol iptalinden ve üyelik taşınmasından sonra yazının reddi.

Servisler `scripts/helpers/import-typescript.mjs` ile gerçek TS kaynaklarından
çalıştırılır; ikinci bir servis implementasyonu test edilmez. Bu loader test içindir.
İki pilot migration **yalnız yerel sentetik DB'ye** uygulandı. Üretime uygulanmadı;
.env.local, prod kayıtları ve deployment değişmedi. Yerel servisler sonraki çalışma
 için açık bırakıldı; test verisi saklandı. Harness yeniden çalıştırılırsa mevcut
pilot tablosunu görerek durur; otomatik reset yapmaz.

Kalan: kimlikli Next.js tarayıcı akışı ve gerçek tarihsel şema/admin RPC entegrasyonu.
Public fixture bu sınırı değiştirmez. Önceki BLOKE kaydı tarihsel olarak korunur.


## Kimlikli tarayıcı turu — 2026-09-09, kısmi kabul

Canlı www.bpsys.net üzerinde kullanıcının verdiği hesapla giriş başarılı. Dashboard,
firma listesi, firma detayı ve personel talepleri okundu; mevcut canlı iş kayıtları
değiştirilmedi. Canlıda Günlük plan bağlantısı görünmüyor. Bu, yeni pilotun kabulü
değildir. Gerçek hesap parolası repo/Vault/test dosyasına yazılmadı.

Yeni pilot, .env.local değiştirilmeden süreç ortamında yerel Supabase URL/key ve
BPS_DAILY_OPERATIONS_ENABLED=true verilerek Next dev'de açıldı. Ayrı sentetik
yöneticiyle /talepler/gunluk üzerinden giriş ve returnTo yönlendirmesi başarılı.
Tarayıcıdan lokasyon ve personel kaydedildi; iki kişilik talepte 0/2 → 1/2 → 2/2
görüldü. Dolu kapasitede Ata devre dışı; aynı gün atanmış personel seçenekte devre
dışı. Bir atama kaldırılınca 1/2 ve 1 kişi açık görüldü; personel tekrar seçilebilir.

İptal butonundaki window.confirm sırasında gömülü tarayıcı CDP zaman aşımına girdi;
dialog API görünür onay döndürmedi ve sekme kontrolü/kapama da zaman aşımına girdi.
Bu nedenle iptal UI testi PASS değildir. Salt okunur yerel DB kontrolü talebin hâlâ
active/2/1 olduğunu doğruladı. UI CSV aktarımı bu kesintiden sonra çalıştırılmadı.
Önceki 17 API, 37 DB ve 12 yarış kontrolleri ayrı kanıtlardır. Kullanıcı yerel
onay penceresini kapattıktan sonra iptal/CSV tarayıcı kabulüne devam edilir.
Next dev ve yerel Docker servisleri açık; üretim/deploy/migration değişmedi.


## Kalan tarayıcı adımları — PASS, 2026-09-09

Yerel oturum korunarak yeni sekmede test sürdürüldü. Sentetik fixture
`scripts/fixtures/browser-locations.csv` iki satırla önizlendi. İlk aktarım:
“2 şube eklendi, 0 aynı kayıt atlandı”; şubeler talep formunda göründü. Sayfa
yenilenip aynı dosya aktarıldığında “0 şube eklendi, 2 aynı kayıt atlandı”.

İptal teyidi uygulama içi HTML dialog'a taşındı; talep adı/gün ve atamalara etki
gösteriliyor. Vazgeç ile dialog kapandı, 1/2 ve bir açık korundu. Tekrar açıp
onaylayınca talep İptal / 0/2 oldu, atama listesi boşaldı. Önceki window.confirm
kilitlenmesi bu akışta tekrarlanmadı. Canlı kayıt değiştirilmedi.

Bu değişiklik sonrası TypeScript ve statik kontroller geçti (0 FAIL / 2 WARN).
Mutasyon SQL'i değişmedi. Yerel yönetici temel akışı artık tarayıcıdan da ölçüldü;
tüm rollerin UI matrisi, ağ kesintisi, mobil ekran ve tam tarihsel şema/admin
RPC entegrasyonu tamamlandı sayılmaz. Önceki kısmi kabul notu tarihseldir.


## Rol ve mobil tarayıcı turu — 2026-09-09

Yalnız yerel sentetik tarayıcı hesabı yönetici→operasyon→İK→yönetici sırasıyla
değiştirildi; sonunda başlangıç rolü geri getirildi. Operasyon ekranında personel,
lokasyon ve toplu aktarım formları yoktu; talep oluşturma ve 1/1 atama başarılıydı.
Ekran açıkken rol İK yapıldıktan sonra Atamayı kaldır denemesi “Bu işlem için
yetkiniz yok” verdi ve atama korundu. Yenilemede yalnız erişim yok mesajı görüldü.

390×844 görünümünde eski sabit sol menü içeriği 134 px civarına sıkıştırıyordu.
Kabuk düzeltildi: md altı menü düğmesi + modal gezinme, md ve üzeri sabit sol menü.
Mobil pilot screenshot ile incelendi; documentElement.scrollWidth=390 ve
innerWidth=390 ölçüldü. Menü açılışı, Escape kapanışı ve 1280×900'e geçince
modalın kapanıp masaüstü sidebar'ın görünmesi doğrulandı. Viewport testi bitince
varsayılan boyuta döndürüldü. Diğer modüllerin tüm mobil ekranları test edilmedi.

Bu tur canlı hesaba/role/veriye dokunulmadı. Mobil değişiklik tüm uygulama kabuğunu
etkiler; pilot ekranında doğrulandı. Tam tarihsel şema/admin entegrasyonu ve ağ
kesintisi kabulü hâlâ ayrı bekliyor.

Bu rol/mobil değişikliği sonrası TypeScript, açık pilot bayrağıyla build ve statik
kontrol başarılı (0 FAIL/2 WARN). Yerel dev sunucusu yeniden açıldı.


## Ağ kesintisi ve kayıp yanıt — 2026-09-09

`scripts/qa-local-network.mjs` mevcut ayrı yerel fixture'da yeni sentetik kullanıcıyla
çalıştı: **7 kontrol PASS**. Gerçek başarılı HTTP yanıtı, commit'ten sonra test
fetch katmanında tüketilip düşürüldü. Lokasyon/talep/import için tekrar aynı komut
kimliğiyle gönderildi; tek kayıt/olay kaldı, import ilk sonucun sayılarını döndürdü.
Aynı kimliğin değiştirilmiş içerikle tekrar kullanılması reddedildi. Okuma bağlantı
hatası boş plan veya yetki reddi olarak yorumlanmadı. Bu, gerçek DB + SDK + servis
testidir; tarayıcı ile Next server action arasındaki paketin düşürülmesi değildir.

```sh
node scripts/qa-local-network.mjs
```

Tarayıcıda ayrıca yalnız yerel PostgREST container durdurulup Yenile kullanıldı.
İlk denemede uzun bekleme görüldü; pilotun server Supabase client'ına isteğe bağlı
12.000 ms HTTP bekleme sınırı eklendi. Yalnız pilot bunu seçer; diğer çağrılar
varsayılan davranışta kalır. Bu toplam action süresi değil, HTTP isteği başına
sınırdır; iptal edilen HTTP DB transaction'ının rollback olduğunu garanti etmez.

İkinci kesinti testinde action yaklaşık 12.088 saniyede döndü. Ekran
“Plan doğrulanamadı” ve bağlantı/aynı formu tekrar deneme mesajı gösterdi;
“Bu gün için talep yok” görünmedi, yeni talep butonu kapalıydı. Container yeniden
açılıp Yenile seçilince 4 kart döndü, form açıldı, hata temizlendi. API servisi
çalışır durumda bırakıldı. Yerel iş verisi dışında hiçbir kayıt değişmedi.

Kalan sınır: komut kimliği hâlâ tarayıcı belleğinde; tam sayfa kapatma/yenilemeden
sonra belirsiz kayıt için yeni komut üretilebilir. Kalıcı komut kurtarma yoktur.
Tüm ağ/ilk oturum yükleme durumları veya gerçek tarihsel auth/admin entegrasyonu
bu testten geçmiş sayılmaz. Üretime migration/deploy uygulanmadı.

Ağ değişiklikleri sonrası 19 unit kontrolü, TypeScript, pilot açık build ve statik
kontrol (0 FAIL/2 WARN) geçti. Yerel dev yeniden başlatıldı.


## Kalıcı işlem kurtarma kabulü — 2026-09-09

Pilot form ve CSV gönderimleri artık localStorage'da actor/tenant kapsamlı
SHA-256 özet + komut UUID'si ayırır. Ham form/CSV, parola ve token bu kurtarma
kaydına yazılmaz. Sayfa yenilenince aynı normalize içerik aynı bekleyen kimliği
kullanır; Web Locks sekmelerin kimlik ayırmasını sıraya koyar. Depolama hatasında
korumasız gönderim yapılmaz. Başarı doğrulanınca yalnız ilgili kimlik kaldırılır.
Silme başarısızsa sunucu başarısı korunur ve kullanıcıya kalan işaret açıklanır.

`20260909000300_scoped_operation_command.sql` yalnız ayrı yerel Supabase'e
uygulandı; `ops_execute_scoped` profil kilidi altında beklenen actor/tenant'ı
kontrol eder, ardından mevcut rol/üyelik/idempotency kontrollerine gider.
Pilot server action'ları scope gerektirir. Eski temel RPC'ler mevcut yetki
kontrolleriyle durur; bu değişiklik bütün uygulamaya kapsam protokolü getirmez.
Üç pilot migration üretime uygulanmadı; push/deploy veya gerçek veri temizliği yok.

Ölçümler:
- 28 domain/form/CSV/kurtarma testi: yeniden açılış adapter'ı, aynı anda 20 kimlik
  isteği, farklı hesap/tenant, bozuk/engelli depolama, 50 sınırı ve onay temizliği.
- 46 PGlite PostgreSQL kontrolü; 14 native PostgreSQL kontrolü. Son ikisi yeni
  scoped RPC'nin gerçek profil kilidi beklemesinden sonra rol/üyelik değişimini
  görmesini ölçer. Sentetik fixture tam üretim şemasının yerine geçmez.
- 11 gerçek yerel Auth/API/servis kontrolü: scoped kayıttan sonra başarılı HTTP
  yanıtı kaybettirilip yeni storage adapter'ıyla aynı komut tekrarlandı; tek olay.
  CSV özgün 1 ekleme/0 atlama sonucunu tekrar verdi. Bu ağ testi SDK fetch sınırında
  yapılır; tarayıcı sunucu-action yanıtını gerçek ağda düşürme testi değildir.
- Ayrı tarayıcı denemesi: yalnız yerel PostgREST durduruldu; form gönderimi hata
  verdi ve 1 bekleyen kaldı. API açıldı; sayfa yeniden yüklendi, 1 bekleyen korundu.
  Aynı lokasyon formu girilince başarı, boş form ve bekleyen uyarısının kalkması
  görüldü. Yerel SQL sayımı: 1 lokasyon / 1 olay. API yeniden çalışır durumda.

Sınırlar: form kendiliğinden doldurulmaz/gönderilmez. Başka cihaz/origin, gizli
pencere kapanışı veya kullanıcı depolama temizliği kurtarılamaz. Özet şifreleme
sayılmaz. Bekleyen kimlikler otomatik eskimez. Sunucu hatasıyla biten veya artık
arayüzden tekrar gönderilemeyen atama/iptal kimlikleri de bekleyebilir; bu dilimde
sunucu sonucunu kimlikle sorgulama/uzlaştırma ekranı yoktur. 50 bekleyen sınırında
yeni işlem durur; üretime açılış öncesinde bu uzlaştırma akışı tamamlanmalıdır.

Son doğrulama: TypeScript ve production build geçti; statik 166 TS/TSX dosya,
0 FAIL/2 WARN (mevcut drift ve kullanılmayan TimelineList uyarıları). Yerel dev
derleme için durdurulup yalnız yerel Supabase ayarlarıyla tekrar açıldı.


## Bekleyen sonuçları uzlaştırma kabulü — 2026-09-09

Sonuç kontrolü ve onaylı kapatma tamamlandı. `ops_reconcile_commands` yalnız
çağıranın doğrulanmış actor/tenant'ındaki en fazla 50 kimlik için id + status döner.
Payload/iş verisi dönmez. Confirmed geçmişte tamamlanmış komuttur; güncel iş durumu
ayrıca plandan okunur. Unknown kimliği korur. Kapatma aynı komut anahtarında closed
kaydı oluşturur; gecikmiş mutate/import aynı kimlikle iş kaydı oluşturamaz.
Daha önce tamamlanan kayıt korunur. Kapatma yanıtı kaybolursa tekrar sorgulanabilir.
Bu closed kayıtları silinmemelidir; silmek gecikmiş isteğe karşı korumayı kaldırır.

Dördüncü migration `20260909000400_command_reconciliation.sql` yalnız sentetik
local Supabase'e uygulandı. Yerel sıralama 20260909000100 → 000200 → 000300 → 000400.
Bu adlar Ağustos tarihli eski migration'larla karıştırılmamalıdır. Dört pilot
migration üretime uygulanmadı; gerçek iş verisi, push/deploy değişmedi.

Ölçülen kabul:
- 31 birim testi: eksik/bozuk/yabancı/tekrarlı sonuçta kimlikler korunuyor;
  sorgu sırasında başka sekmede eklenen kimlik terminal temizliğinden etkilenmiyor.
- 62 PGlite PostgreSQL kontrolü: actor/tenant/rol, 50 sınırı, unknown, terminal
  sorgusu, eski ve scoped RPC'lerde geç gönderimin reddi.
- 18 native PostgreSQL kontrolü: yazı önce → confirmed; kapatma önce → geç yazı
  reddi; iki kapatma → tek işaret; devam eden yazıya salt sorgu → unknown, commit
  sonrası → confirmed. İlk üç yeni yarışta gerçek backend kilit beklemesi ölçüldü.
- 15 gerçek yerel Auth/API/servis kontrolü: dosyayı tekrar yüklemeden import
  sonucu bulundu; kayıp kapatma yanıtı tekrarlandı; kapatılmış komutla 0 iş kaydı.
  Yanıt kaybı SDK fetch sınırında, tarayıcı ile server action arasında değildir.
- Kimlikli tarayıcı: mevcut sentetik T1 kodu reddedildi → 1 bekleyen; sorguda
  unknown ve 1 bekleyen korundu; dialog'da Geri dön çalıştı; ardından onaylı
  kapatma 0 tamamlanan/1 kapatılan gösterdi, form temizlendi. Yerel SQL: 1 closed
  komut, 0 yeni personel. Tamamlanan sonuçların UI'dan temizlenmesiyle aynı ortak
  kod yolu birim ve API testlerinde doğrulandı; ayrı bir browser yanıt kaybı yok.

Sınır: 50 bekleyen için sunucuyla uzlaştırma yolu artık var. Depolama tamamen
silinmişse veya eski tenant erişimi artık yoksa bu ekrandan kurtarma yapılamaz.
Diğer sekmelerdeki dolu formlar otomatik sıfırlanmaz. Tam tarihsel üretim şeması,
migration sahibi ve admin/Auth entegrasyonu üretime açılış öncesinde hâlâ ayrı.
Ürün yönündeki sonraki dilim haftalık görünüm/müşteri çıktısıdır.


## Haftalık plan ve müşteri çıktısı — 2026-09-09

`/talepler/haftalik` firma ve pazartesi–pazar aralığında talepleri/atamaları/açıkları
gösterir. Toplamlar kişi-gündür; iptaller hariç tutulur, isteğe bağlı satır olarak
gösterilir. Yedi gün kartından günlük plana firma+gün korunarak geçilir. Günlük
sayfa artık doğrulanmış `gun` parametresini başlangıç tarihi olarak kullanır.

CSV seçili kapsamın satırlarını firma/hafta/ölçüm zamanı ile üretir; tüm alanlar
tırnaklı, formül ön ekleri metindir. UTF-8 BOM ve noktalı virgül kullanılır. CSV ve
yazdırma düğmesi önce server action üzerinden yeni veri/yetki kontrolü yapar.
Boş kapsamda çıktı yok. Yazdırma düzeni A4 yatay, gezinme/filtre düğmeleri gizli.
PDF indirme servisi yok; Yazdır / PDF tarayıcının yazdırma akışını açar.

`20260909000500_weekly_operations.sql` yalnız sentetik yerelde uygulandı. STABLE
SECURITY INVOKER fonksiyon mevcut RLS ile tek snapshot'ta sadece seçili firmanın
haftasını ve atanmış kişileri döndürür. 5000 talep aşımında eksik liste yerine hata.
Beş pilot migration üretime uygulanmadı; gerçek veri/push/deploy değişmedi.

Kabul: 39 birim testi, 73 PGlite PostgreSQL kontrolü ve 18 gerçek yerel Auth/API/
servis kontrolü geçti. Hafta/yıl/artık yıl sınırı, iptal ve kişi-gün toplamları,
CSV kaçış/formül, kapasite/tekrar atama tutarsızlığı, rol/tenant, 5001 talepte hata,
ağ hatasında boş çıktı olmaması ve rol kaldırıldıktan sonra sorgu reddi sınandı.
Önceki 18 native eşzamanlılık kontrolü bu salt-okunur ek için tekrar çalıştırılmadı.

Kimlikli UI: 2026-09-07 haftası 5 aktif talep / 5 ihtiyaç / 1 atama / 4 açık;
2 iptal seçenekle göründü, toplamlar değişmedi. Sonraki boş haftada çıktı kapalı.
Günlük ekrana geçince 2026-09-16 korundu. 673 px viewport/pageWidth 673, tablo 850,
kapsayıcı 623: tablo kendi içinde kayıyor, sayfa taşmıyor. CSV düğmesi yeni sorguyu
başlattı; tarayıcının indirdiği dosyanın diskteki son konumu ayrıca doğrulanmadı.
CSV içeriği doğrudan üretici testleriyle doğrulandı. Native yazdırma/PDF'nin görsel
sayfalama kabulü henüz yapılmadı; özellikle çok uzun personel listeleri ayrıca
bakılmalı. Puantaj, gerçekleşen mesai veya bordro kapsamda değildir.

Haftalık çıktı UI kesinti testi: yalnız yerel PostgREST durduruldu; CSV düğmesi
yeni sorguda hata aldı, eski tablo kaldırıldı ve iki çıktı düğmesi kapandı. API
yeniden açıldı. Salt sorgudaki hata metni tekrar form göndermeye yönlendirmeyecek
şekilde haftalık plana özel düzeltildi.


## Toplu gün talebi + gerçek CSV indirme — 2026-09-09

Günlük ekrana “Birden fazla gün için talep aç” eklendi. Aynı şubeye 31 takvim
gününe kadar aralık ve çalışma günleri; önizlemeden tek gün çıkarma; günlük kişi
sayısı ve toplam kişi-gün; tek transaction ile kayıt. Aktif aynı şube/gün/hizmet/
pozisyon varsa bütün parti reddedilir. İptaller engellemez; resmî tatiller otomatik
çıkarılmaz. Tekil günlük formun ek talep açma davranışı değişmedi; evrensel bir
veritabanı iş anahtarı UNIQUE kısıtı iddia edilmez.

`ops_create_request_batch` actor/tenant ve rolü profil kilidinden sonra doğrular,
komut → firma → lokasyon sırasıyla kilitler. Firma UPDATE kilidi mevcut tekil
yazıların SHARE kilidiyle de sıralanır. Aynı komut aynı request ID listesini döner.
Kapatılmış kimlik reddedilir; yanıt kaybı mevcut bekleyen sonuç ekranından çözülür.
Altıncı migration `20260909000600_request_batch.sql` yalnız sentetik yerelde
uygulandı. Altı pilot migration üretime uygulanmadı; gerçek veri/push/deploy yok.

Kabul:
- 45 birim, 93 PGlite PostgreSQL, 23 native PostgreSQL eşzamanlılık, 22 gerçek
  yerel API/servis kontrolü. İkinci satıra test hatası verildi: ilk satır ve olaylar
  da rollback oldu. Aynı komut yarışında aynı ID'ler; farklı çakışan partide ikinci
  ret; tekil talep önce commit ederse bekleyen parti çakışmayı görüyor. Kapama
  yarışının iki sırası ve commit sonrası yanıt kaybı tekrarları geçti.
- Kimlikli tarayıcı: 2026-09-21…27, beş hafta içi gün/10 kişi-gün önizlemesi;
  23 Eylül çıkarıldı → 4 gün/8 kişi-gün. Kayıt sonrası haftalıkta 4 talep/8 ihtiyaç/
  0 atama/8 açık; çıkarılan günde sıfır. Günlük ve haftalık sayfalar 390/390 px
  genişlikte taşmasız; geçici viewport geri alındı.

Önceki CSV indirme boşluğu bu turda kapandı: Blob URL yolu uygulama içi tarayıcıda
indirme olayı üretmedi. `/api/operations/weekly-export` eklendi; kendi yeni oturum,
yetki ve veri kontrolünü yaparak Content-Disposition attachment + private,no-store
ile dosya dönüyor. UI ön kontrolü ardından GET de bağımsız kontrol yapar; iki
istek arasında veri değişirse dosyadaki kendi zaman damgası geçerlidir.
Yeni yolda tarayıcı download olayı ölçüldü. Altı ayrı localhost HTTP testi:
attachment/cache/MIME; gerçek BOM/formül metni/tarih; anonim login yönlendirmesi;
rol iptali, başka tenant ve boş haftada dosya yok. HTTP ile alınan sentetik dosya
`/private/tmp/bps-weekly-export-acceptance.csv` standart CSV okuyucusunda 2 satır,
15 sütun, 4 kişi-gün olarak doğrulandı. Test scripti qa-local-export.mjs.

PDF sınırı: yazdırma düğmesi çağrıldı, fakat native önizleme doğrulanmadı. CUA,
Codex uygulamasına native erişimi güvenlik nedeniyle reddetti; bu yüzey başka
yöntemle okunmadı. Native PDF sayfalama kabulü hâlâ açık; CSV kabulü artık açık
bir iş değildir. Tam tarihsel prod şeması/migration sahibi/admin Auth kabulü ayrı.


## Mevcut günlük ihtiyacı düzenleme — 2026-09-09

Aktif talep kartına “Yeni kişi sayısı / İhtiyacı güncelle” eklendi. Yönetici ve
operasyon 1–100 aralığında değiştirebilir. Atanmış kişi sayısının altına düşülemez;
atamalar kendiliğinden silinmez. Ekranın gördüğü eski kişi sayısı DB'dekiyle
uyuşmazsa eski ekranın yazısı reddedilir. Bu kontrol count alanının beklenen
mevcut değeridir, tam kayıt revision/ABA geçmiş kontrolü değildir.

`20260909000700_resize_request.sql`: scoped RPC, profil → komut → firma → talep
kilidi, mevcut atama sayısı ve eski ihtiyaç kontrolü, tek UPDATE/olay/komut sonucu.
Aynı kimlik tekrarında önceki sonuç; kapatılmış kimlik reddi. İptal talepler ve pasif
firmalar yeni kapasite düzenlemesi alamaz. Yedinci pilot migration yalnız yerel
sentetik Supabase'e uygulandı; yedi migration üretime uygulanmadı.

Son kabul: 46 operasyon birim testi, 105 PGlite PostgreSQL kontrolü, 27 native
PostgreSQL kontrolü, 24 gerçek yerel API/servis kontrolü geçti. Ek olarak CSV
endpoint'inin 6 HTTP kabulü bu turda geçti. Eski qa:unit harness'i 0 FAIL; statik
174 TS/TSX dosyada 0 FAIL/2 mevcut WARN; TypeScript temiz.
Yeni yarışlar: ikinci atama önce commit ederse kapasite altına düşme reddi;
kapasite önce azalırsa yeni atama reddi; iki farklı eski-ekran düzenlemesinden
ikincisine stale hatası; iptal önceyse düzenleme reddi. API'de commit sonrası
resize yanıtı kaybettirildi: tekrar tek olay bıraktı. Kimlikli UI'da 21 Eylül
sentetik talebi 2 → 3 oldu; haftalık 4 talep korunup 8 → 9 kişi-gün çıktı.

Yerel kabul fixture'ı tam tarihsel prod şeması değildir. Native PDF sayfalama
kontrolü, tam şema/migration sahibi ve admin Auth üretim öncesi kabulü açık kalır.
Gerçek iş verisi temizliği, push ve deploy yapılmadı. Sonraki ürün dilimi: sahadaki
atamanın gelmedi/yerine personel değişimi gibi gerçekleşme bilgisini planlamadan
ayıran iş akışının dar kapsamı; önce ürün sözleşmesi, sonra kod.

Son doğrulama: pilot açık production build geçti. Yerel dev yalnız sentetik
Supabase ayarlarıyla tekrar açıldı. Resize RPC'de kilit beklerken kaybolmuş talep
için NOT FOUND kontrolü de eklendi; yerel fonksiyon güncellendi, 105 DB kontrolü
tekrar geçti. Bu düzeltme üretime uygulanmış bir migration'ı değiştirmedi.

## 2026-09-09 — Gerçekleşme ve atomik personel değişimi

00800/00900 yalnız dedicated yerel sentetik Supabase'de uygulandı. Günlük bildirim
unreported/present/absent ve revision taşır. Gelecek gün DB İstanbul tarihiyle reddedilir;
aynı tenant/personel/gün için tek present unique index ile korunur. Kaldırma/iptal
geçmiş bildirimi silmez; tarihsel kayıt düzeltilebilir. Yeni RPC'ler profil kilidi
sonrasında doğrulanmış tenant/rol kullanır; idempotency ve kapatma protokolüne uyar.
Değişim eski atama + yeni personeli tek transaction'da değiştirir; eski revision ve
aktiflik şartı vardır. Present atama için full-day değişim reddedilir.

Ölçümler: 48 birim, 141 PGlite DB, 37 native PostgreSQL eşzamanlılık, 28 gerçek yerel
Auth/API/service testi geçti. Native yarışlar pg_blocking_pids ile gerçek beklemeyi
ölçer. Zorlanmış yeni-atama INSERT hatası eski kaldırmayı geri aldı. Kayıp yanıt testleri
SDK fetch sınırındadır; tarayıcı ağı kesintisi diye etiketlenmez. tsc temiz;
qa:static 175 dosya, 0 FAIL / 2 mevcut WARN; eski unit 0 FAIL.

IAB yerel UI: 2002-01-01 / Tarayıcı Test Şubesi / Gerçekleşme tarayıcı denemesi.
Tarayıcı Test Personeli Gelmedi → Test personel ile değişim → Test personel Geldi →
talep iptali. Sonuç plan 0/1 İptal; tarihçede 1 geldi + 1 gelmedi. Mobil390px
scrollWidth390; kart görseli incelendi; console error/warn boş. Gerçek hesap/üretim
iş verisi, push/deploy, temizlik değişmedi. Gerçekleşme saat/ücret onayı değildir.

## 2026-09-09 — Haftalık gerçekleşme özeti ve devam sırası

01000 sadece sentetik yerel Supabase'de uygulandı; pilot toplam 10 migration.
ops_attendance_week tek snapshot'ta plan + tüm atama geçmişini doğrulanmış tenant/rol
ve RLS altında okur. 5000 talep / 20000 tarihsel atama üstünde kısmi sonuç vermez.
Haftalık ayrı panel: geldi=kişi-gün, gelmedi=beyan sayısı, bildirilmemiş=aktif atama.
İptal ve kaldırma geçmişi dahil; plan CSV/PDF değişmedi. UI'da iptal filtresinin
özeti değiştirmediği, iptal edilmiş talepteki 1 geldi + 1 gelmedi bildiriminin
korunduğu ve mobile390px scrollWidth390 ölçüldü.

Son kontroller: 53 unit, 149 PGlite, 30 gerçek yerel API/service, tsc temiz;
qa:static177 dosya 0 FAIL / 2 mevcut WARN. Önceki mutation aşamasının 37 native
iki-bağlantılı yarışı geçti; bu son salt-okunur RPC için aynı yarışlar tekrarlanmadı.
Önceki 6 HTTP CSV testi geçerli, export davranışı değişmedi. Native PDF görsel
sayfalama kabulü hâlâ açık. Üretim, veri temizliği, push/deploy yapılmadı.

Kullanıcının dur diyene kadar aşamaları başlat talebi üzerine görev heartbeat'i
kuruldu: bps-geli-tirmeye-devam, aktif, 30 dakikada bir. Kullanıcı dur derse duraklat.
Sonraki ürün dilimi: açık ihtiyaç / gelmedi / bildirilmemiş atama için günlük
operasyon kontrol listesi; öncelikle anlam sözleşmesi, sonra yerel kod ve doğrulama.
Gerçekleşme ücret veya saat onayı değildir; push/deploy/üretim hâlâ kapsam dışı.

Son doğrulama: BPS_DAILY_OPERATIONS_ENABLED=true npm run build geçti. Yerel dev sunucusu dedicated sentetik Supabase ile yeniden başlatıldı; .env.local değiştirilmedi. git diff --check temiz.

## 2026-09-09 — Günlük operasyon kontrol listesi

/talepler/kontrol eklendi. Seçili firma/gün için mevcut ops_attendance_week snapshot'ından
aktif gelmedi, atama açığı ve günü gelen unreported işaretleri türetilir. İptal ve
kaldırılmış atamalar hariç; gelecekte gerçekleşme bildirimi beklenmez. Tek talepte
birden fazla işaret olabilir, sayaçlar toplam personel açığına dönüştürülmez.
Şube/il/pozisyon araması + işaret filtresi + firma/gün/talep taşıyan günlük deep-link
var. Hedef kart scroll+ring ile görünür. Bir kaynak düzeltmesi sonraki fetch'te ilgili
işareti kaldırır; elle tamamlandı/telafi edildi varsayımı yok. Yeni SQL/tablo yok.

61 unit / 33 gerçek yerel API-service kontrolü geçti. İstanbul gece sınırı, future,
iptal/geçmiş, çoklu işaret, sıra/arama, yanlış snapshot ve ağ hatası sınandı. tsc temiz;
qa:static180 dosya 0 FAIL/2 eski WARN. Önceki 149 DB/37 native yarış testleri SQL
değişmediği için tekrarlanmadı. IAB: 2002-01-01'de iki bekleyen; şube araması ve
filtre; doğru hedef kart (151px, ring); gelmedi bildirimi sonrası 1 gelmedi +1 bekleyen
ve öncelik sırası değişti. Mobile390px main/scrollWidth390; console error/warn boş.

Sıradaki kapsam: şube/personel dizini arama ve kontrollü yönetim. Önce mevcut kodlar
ve kayıtların görünümü, sonra yönetici pasife alma; geçmişi koru ve atama/pasife alma
kilit sırasını inceleyip gerçek yarışları test et. Üretim, temizlik, push/deploy yok;
10 pilot migration yalnız yerel. Otomatik devam aktif.

Son kapı: pilot bayrağı açık npm run build exit0; git diff --check temiz. Yerel dev dedicated sentetik Supabase ile yeniden başlatıldı. Üretim env dosyası değiştirilmedi.

## 2026-09-09 — Aranabilir şube/personel dizini

/talepler/dizin ve salt-okunur ops_directory RPC eklendi. Şube seçili firmaya,
personel doğrulanmış çalışma alanına ait; scope farkı UI'da açık. Kod/ad/il arama,
aktif/pasif filtre, 50 satır sayfa. Toplam ve sayfa tek snapshot, sayfalar arası
donmuş liste iddiası yok. Literal yüzde/alt çizgi, kod başı sıfırları, null elle-eklenmiş
kod, sayfa/toplam tutarlılığı ve rol/tenant sınırı doğrulanıyor.

01100 sadece yerel dedicated Supabase'de uygulandı (toplam11). 66 unit / 163 PGlite /
37 gerçek yerel API-service kontrolü geçti; tsc temiz, qa:static183 kaynak dosya,
0 FAIL/2 eski WARN. Native37 yarış önceki yazma aşamasına ait, bu read-only RPC için
tekrarlanmadı. IAB: 51 şube 1–50 ve 51–51; pasif filtre; 000000000000001 kod arama;
personel BROWSER-01; mobile390px/main390px/scrollWidth390; console error/warn boş.
İki yerel sentetik sayfalama şubesi oluşturuldu, biri başlangıçta pasif. Mevcut gerçek
veri pasife alınmadı; üretim, temizlik, push/deploy yok.

Sıradaki B: manager-only aktiflik revision + kalıcı komut + kapatma/replay ve atama
geçmişini koruma. ops_mutate(assign) lokasyon aktifliğini kilitsiz okuyor; pasife alma
öncesi SHARE kilidi ve iki yönlü native yarış zorunlu. Bu tur B'nin planı yazıldı;
aktiflik RPC/butonları henüz yok. Yeni read-only dizin performans benchmark'ı değildir.

Son kapı: BPS_DAILY_OPERATIONS_ENABLED=true npm run build exit0; git diff --check temiz. Yerel dev dedicated sentetik Supabase ile yeniden başladı; .env.local değiştirilmedi.

## 2026-09-09 — Kontrollü dizin aktifliği

01200 sadece dedicated yerelde uygulandı; toplam12 pilot migration. Directory revision
ve manager-only ops_set_directory_active eklendi. Profil SHARE sonrası actor/verified
tenant/rol; command idempotency; şubede şirket SHARE sonra lokasyon UPDATE; personelde
worker UPDATE. ops_mutate(assign) lokasyon aktifliği artık SHARE ile kontrol edilir.
Yeni atama/pasife alma yarışı kapanır; geçmiş plan ve gerçekleşme silinmez. Pasif firma
şubesi aktifleştirilemez. Her kabul edilen yeni komut revision artırır, aynı komut
özgün sonucu döndürür. Dizin UI native onay dialogu + kalıcı pending/reconcile kullanır.

68 unit / 181 PGlite / 48 native iki-bağlantılı yarış / 42 gerçek yerel API-service
kontrolü geçti; tsc temiz, static184 dosya 0 FAIL/2 eski WARN. Native bekleme ölçülerek
worker/lokasyon iki yönlü atama, yeni/toplu talep, replacement, eski revision, komut
kapatma ve manager rol kaybı sınandı. API kayıp yanıtta tek revision/audit; eski
revision ve kapatılmış kimlik reddedildi; mevcut atama kaldı. IAB Dizin kabul00001
pasife alma/aktifleştirme ve pending temizliği; operasyon rolünde dizin yüklü ama
aktiflik düğmesi0; sentetik browser hesabı yöneticiye geri alındı. Mobil dialog390px,
scrollWidth390; personel dialogunda Vazgeç, console boş.

Üretim, asıl veri temizliği, push/deploy yok. Sıradaki dilim: YEREL_KABUL_PAKETI.md.
Büyüyen pilot için tek komut doğrulama, doğru yerel ortam kontrolü, adım/sonuç raporu;
mevcut fixture'ı sıfırlamadan ve üretim URL/anahtarını kullanmadan çalıştırılabilmeli.

Son kapı: BPS_DAILY_OPERATIONS_ENABLED=true npm run build exit0; git diff --check temiz. Yerel dev yalnız dedicated sentetik Supabase ile yeniden başladı. .env.local değiştirilmedi; test hesabı yönetici ve test şubesi aktif bırakıldı.

## 2026-09-09 — Tek komut yerel kabul paketi

npm run qa:acceptance (varsayılan5 hızlı adım), --sql/--local-api/--build/--all.
11 runner davranış testi; lokal hedefte kök project_id, DB/Kong container/portları,
loopback URL'ler, gerekli RPC imzaları ve fixture tenantları ön kontrol. Eksik runtime
FAIL, ilk hatadan sonra seçilmiş adımlar skipped; seçilmemiş modlar not_requested.
Süre, exit/signal ve log kesilmesi JSON/MD raporlanır. Secret biçimleri maskelenir;
API diagnostic payload'ları loga girmez. Rapor private OS temp klasöründedir.

Son tam koşu: 10/10 passed, exit0. 11 runner testi + 68 operations unit + eski unit +
static184dosya0FAIL2WARN + tsc + 181 PGlite + 48 native + 42 yerel API + build.
Rapor: /var/folders/fg/qm_gg6w16299dhr_lz9xr38r0000gn/T/bps-acceptance-YpM6di/report.md
Negatif CLI koşusu (runtime yok): exit1,5 passed/1 failed/1 skipped/3 not_requested;
rapor bps-acceptance-Y70rt5. Build .env'siz geçici kaynak kopyasında, dependency symlink,
sınırlı OS env ve yerel placeholder ile alındı; dev13745 durdurulmadı. Sonrasında IAB
dizin yeniden yüklendi, console boş. Temp build silindi; mevcut fixture resetlenmedi.
Yeni migration yok, toplam12 yalnız yerelde. Üretim/temizlik/push/deploy yok.

Kullanım: supabase/manual/acceptance-runner.md. HTTP CSV/native PDF/üretim Auth-owner
bu komutun PASS sonucuyla kapanmaz. Sıradaki dilim: ana SaaS planı P07 mevcut görev
sahiplik/devir akışını koddan incele ve firma/şube/günlük talep bağlamını mevcut
akışa taşı. GOREV_BAGLAMI_DILIMI.md ilk sözleşmedir; mevcut görev motorunu çoğaltma.


## 2026-09-09 — P07 talep → görev önseçimi ve kayıt kabulü

Günlük aktif talep kartından mevcut Görevler formuna geçiş eklendi. URL yalnız
firma/talep UUID ve gün taşır; pilot server action rol/flag ve scoped board ile
tekrar doğrular. Firma hazır, şube/gün/hizmet/pozisyon başlıkta; sorumlu ve termin
boş. Kaynak manuel, source_ref ve kalıcı ops FK yok. Form bu sınırı açıkça söyler.
Eski başlığın yeni forma kalması, aynı formun hızlı çift gönderimi ve gönderimde
kapanma düzeltildi. Ağ kaybında görev yazısı için exactly-once garantisi yok.

Tam paket: 75 operations unit +11 runner +legacy unit +static186/0FAIL/2WARN +tsc
+181 PGlite +48 native +42 API +izole build;10/10 passed exit0.
Rapor: /var/folders/fg/qm_gg6w16299dhr_lz9xr38r0000gn/T/bps-acceptance-kz1m16/report.md
Ayrı node scripts/qa-local-task-prefill.mjs:9 passed. Test loader dinamik literal
import/re-export çözümleyebiliyor; gerçek servis kodu testte kullanıldı.

Yerel baseline'da tasks/profile-picker eksikti. scripts/fixtures/local-task-prefill.sql
ve hedef/container/port doğrulayan test komutu ile yalnız dedicated sentetik DB
 genişletildi. tasks tablo comment'i fixture v1 değilse işlem reddedilir. Contract/
appointment ilişkileri fixture'da yok, CHECK NULL; üretim baseline kabulü değil.
Görev atama/atamayı kaldırma (id+isim), IK atama reddi, farklı firma kapsamı,
görev kapanırken talebin aktif kalması gerçek yerel servislerle ölçüldü.

IAB sentetik yönetici: günlük kart→hazır form→createTaskAction→listede1 kayıt.
SQL count1, kaynak talep active. İptal→Yeni Görev başlık/firma boş;673px taşma yok.
Gerçek kullanıcı/üretim/temizlik/push/deploy yapılmadı;12 pilot migration değişmedi.

Sıradaki: GOREV_BAGLAMI_DILIMI.md devir/audit/revision planı. Mevcut atama var,
devir geçmişi/çakışma koruması henüz yok. Bütün task update/admin yollarını kapsa.
Yan bulgu: randevu tamamlama servisi ayrı UPDATE+INSERT; eski atomic RPC özel
migration ile kapatılmış, yeniden GRANT etme. Bu statik bulgu, prod ölçümü değil.


## 2026-09-09 — görev atama geçmişi ve eşzamanlı düzenleme koruması

Plan/sonuç: 01_product/GOREV_DEVIR_DILIMI.md. Yeni01300 migration yalnız dedicated
sentetik yerel Supabase'e uygulandı (12 ops+1 görev). tasks her INSERT revision0,
UPDATE revision+1; BEFORE trigger istemcinin version değerini kullanmaz ve task
id/tenant/company taşınmasını reddeder. AFTER trigger created/atama/devir/atama
kaldırma geçmişi üretir. Eski görevlerde baseline; eski atayan kişi uydurulmaz.
Yeni geçmiş SELECT doğrulanmış tenant+mevcut task görünürlüğü; istemci DML yok.

Uygulamadaki updateTask/updateTaskStatus beklenen revision ister. Tek raw writer
WHERE id+revision ile CAS yapar;0row açık conflict. Direct SQL/admin eski erişimi
korur ve revision artırır, kendisi CAS zorunluluğu taşımaz. Eski43 raw policy ve
rol sınırları bu teslimle kapanmış sayılmaz. Admin tenant taşıma tasks'a dokunmaz,
otomatik devir yok. Görev silinirse geçmiş cascade silinir; mevzuat arşivi değildir.

79 unit,11 runner,legacy unit,static188/0FAIL/2WARN,tsc,181 opsPGlite,48 opsnative,
14 tasknative,42 opsAPI,build: paket11/11 exit0.
Rapor /var/folders/fg/qm_gg6w16299dhr_lz9xr38r0000gn/T/bps-acceptance-7ttu49/report.md
İki ek ret kontrolünden sonra ayrı native task koşusu16/16; yabancı atanan reddi
revision/geçmişi korur, güncel rol görünürlüğü geçmişte de uygulanır.
qa-local-task-prefill.mjs11/11: gerçek yerel Auth/servis/API, CAS ve geçmiş dahil.
Fixture tam prod şeması değil. Native fixture profile FK SET NULL ölçümü içerir;
eski dedicated fixture FK şeklinin tamamı/prod owner entegrasyonu ölçülmüş sayılmaz.

IAB: eski panel revision0 iken sentetik SQL status yazısı1'e geçti; panelde kaydet
conflict verdi. Güncel kaydı yükle son durumu getirdi; kullanıcı atama yazısı2,
panelde tek Atandı + baseline satırı görüldü.673px taşma yok. Migration sonrası
prod/push/deploy/gerçek iş verisi temizliği yok.

Sıradaki dilim: RANDEVU_TAKIP_BUTUNLUGU.md. Randevu UPDATE + görev INSERT ayrı
olduğu için yarım başarı/eşzamanlı tekrar riskini ele al. Eski atomic RPC bilinçli
olarak revoke edilmiş; tekrar GRANT etme. Önce rol/kapsam/owner gerekçesini oku,
minimum yerel appointment fixture'ı kur ve yeni atomik akışı uygun testlerle kapat.


## 2026-09-09 — atomik randevu sonucu ve takip görevi

RANDEVU_TAKIP_BUTUNLUGU.md güncel teslim.01400 yalnız dedicated sentetik yerelde;
artık12 ops+1 görev+1 randevu migration. Eski complete_appointment_atomic ACL açılmadı.
Yeni complete_appointment_scoped: actor profile SHARE→canlı rol/verifiedtenant,
firma SHARE/tenant→randevu FOR UPDATE. UPDATE + opsiyonel açık/atanmamış task +
taskhistory +private receipt aynı transaction. Pasif firma kapanır, görev skip açık.
Aynı actor/tenant/içerik retry aynı taskId; farklı retry ret. Reopened/edited state
eski receipt ile başarılı gösterilmez. Eski completed/no receipt geri doldurulmaz.

Service tek RPC, ayrı yazı fallback yok. Kullanılmayan status-only completion yolu
kapatıldı. UI actor kontrolü, çift gönderim/kapanma koruması, max4000/1000. Raw RPC
regex boşluk kontrolünün NBSP/BOM'u kabul ettiği native negatif testle bulundu;
JS trim whitespace listesi ile düzeltildi. Native22 ve yerel API9 tekrar geçti.
Yerel test kurulum komutu mevcut draft function'ı kontrollü CREATE OR REPLACE ile
yeniler; gerçek hedef değil, doğrulanmış fixture üzerinde. Receipt verisi korunur.

Son tam koşu:85 unit+11runner+legacyunit+static189/0FAIL/2WARN+tsc+181opsPGlite+
48opsnative+16tasknative+22appointmentnative+42opsAPI+build =12/12 passed,exit0.
Rapor /var/folders/fg/qm_gg6w16299dhr_lz9xr38r0000gn/T/bps-acceptance-BsKlG7/report.md
qa-local-appointment.mjs ayrı9 Auth/servis/API kontrolü. Başarılı cevap SDK fetch
sınırında kaybettirildi; DB tamamlandı+1task, aynıformretry1task. Browser ağ testi değil.

IAB sentetik yönetici: SQL seed edilen planlı randevu sonuç formundan tamamlandı;
SQL tamamlandi|1task|1receipt, task acik|revision0|atanmamis. Görevler ekranında
Randevu kaynağı ve Açık ölçüldü. Yeni randevu yaratma API geçti. UI NewAppointmentModal
date fill değeri React kontrollü formda korunmadı/Olustur pasif kaldı; tam yenilemede
tekrarlandı. Uygulama mı IAB köprüsü mü henüz ayrılmadı; UI create kabulü açık.
Sadece tarih/saat/sonuç alanlarına erişilebilir ad eklendi; validasyon gevşetilmedi.

Sonraki RANDEVU_FORM_BAGLAMI_DILIMI.md: native tarih seçimi/ayrı Chrome sentetik
session ile sorunu ayır; firma bağlamından randevu önseçimi ve form kabulü. CUA
kısıtları korunur; browser mutation için shell/CDP/evaluate kullanılmaz. Gerçek
hesap/üretim/temizlik/push/deploy yok. Fullprodşema/FK/owner ve toplu kullanıcı
devri açık; bu teslim eski43 rawpolicy kapanışı değildir. Receipt orijinal işlem
sonucudur, görevin hâlâ var/açık olduğu iddiası değildir.


## 2026-09-09 — firma randevu formu

RANDEVU_FORM_BAGLAMI_DILIMI.md: native date picker ile UI create geçti; aynı
mevcut modal firma detayında scoped company UUID/ad ile açıldı. Browser çift tıklama
1satır, genel native tarih create1, pasif ret0, iptal taslağı0; dedicated local SQL
sayım1|1|0|0. Hata sonrası taslak ve inline new-company Escape koruması ölçüldü.
local-appointments.sql sentetik companies risk sütunu ekler; diğer eski tablo
eksikleri tüm firma ekranının kabulü değildir. Migration değişmedi, API9/9.
Son hızlı+build6/6: /var/folders/fg/qm_gg6w16299dhr_lz9xr38r0000gn/T/bps-acceptance-mAWfwZ/report.md.
İlk sandbox build DNS/font hatası; izinli build geçti. Önceki SQL yarış testleri
bu tur yeniden koşulmadı. Yeni create ağ tekrar güvenliği/inline company insert
bu turun kabulü değil. Sonraki TOPLU_GOREV_DEVIR_DILIMI.md.


## 2026-09-09 — toplu devir ve aktif iş/üyelik koruması

Dedicated yerelde01500+01600 uygulandı, toplam16 yeni migration. Eski000400 dosyası
ve prod durumu değişmedi; local minimal admin assignment fixture gerçek000400 body
ve yeni01600 ile çalışır. Fulladminlistekranı/productionAuthhook baseline değildir.
26 native transfer,19 native membershipguard; gerçek API10+7. Cevap kaybı retry,
parti rollback, hedef rol/üyelik değişimi, admin açık iş engeli ve gerçek yerel
GoTrue sessions/refresh_tokens iptali ölçüldü. Native admin owner OID/ACL korundu;
RLS ile gizleyen farklı owner ve READ COMMITTED dışı işlem negatif testte reddedildi.
Sıfır üyelikli eski aktif sahiplik de admin taşımasından önce kontrol ediliyor.

Browser: önizleme açıkken sentetik tasktitle güncellendi; yenile sonrası güncel
başlık, doubleclick2taskdevir, hedef kişi listede, yeni sorguda kaynakta0. Receipt
sadeceorijinalparti, bu0sonrakiatamalarakarşıkalıcıgaranti değil. Modal673pxgörsel.
Son paket14/14:96unit+11runner+legacy+static194/0FAIL/2WARN+tsc+181PGlite+48opsnative+
16tasknative+22appointmentnative+26transfernative+19guardnative+42opsAPI+build.
Rapor `/var/folders/fg/qm_gg6w16299dhr_lz9xr38r0000gn/T/bps-acceptance-A1VYcc/report.md`. Üretim/temizlik/push/deploy yok.
Sıradaki SOZLESME_YENILEME_SAHIPLIGI_DILIMI.md.


## 2026-09-09 — 01700 yenileme görevi yerel kabulü

SOZLESME_YENILEME_SAHIPLIGI_DILIMI.md teslim kaydı: mevcut tasks motorunda tek açık
renewal ilişkisi/receipt, DB contract revision ve yönetici scoped yazma; 01600
üyelik/rol korumasına dahildir. Full runner15/15 (yenileme native18 yeni SQL adımı),
unit101; ayrıca `node scripts/qa-local-contract-renewal.mjs` gerçek yerel API7.
Sonuncusu tek başına, runner kilidi boşken çalışır; dedicated marker/container/
loopback kontrolü zorunlu. Tam prod şeması veya Storage fixture olduğu iddia edilmez.
17 migration yalnız sentetik yerel. Yeni görev açma pasif firmada yasak; mevcut
owner aynı task'tan okunur. Kapanma sözleşme yenilemez; ilişkili hard-delete ve
bağlam değiştirme engellenir. Yenileme tarihi operasyon takibi, hukuki süre değildir.
Native port55444, BPS_EMBEDDED_PG_MODULE mevcut geçici runtime. Frontend01700'dan
sonra etkinleştirilmeli; eksik RPC “görev yok” olarak gösterilmez.


Son arayüz entegrasyonundan sonra hızlı paket+izole build6/6 exit0:
/var/folders/fg/qm_gg6w16299dhr_lz9xr38r0000gn/T/bps-acceptance-LLpYVT/report.md.
Bu ek yalnız onCreated bağlı liste yenilemesi, tip/etiket ve kart semantiği sonrası
kontroldür; SQL değişmedi. Statik198 kaynak,0FAIL/2mevcutWARN. git diff --check temiz.


## 2026-09-09 — 01800 PDF sürüm referansı ve Storage yerel kabulü

01800 yalnız dedicated synthetic. Aynı doc kimliğinde immutable version reference,
DB revision/CAS replacement; obje actor sahibi ve bağlı context doğrulanır.
Yeni retained Storage read/delete/update restrictive policy; eskilerin gövdesi
korundu. Sonfull16/16 report: /var/folders/fg/qm_gg6w16299dhr_lz9xr38r0000gn/T/bps-acceptance-kbOvzq/report.md.
105unit,18PDFnative; ayrıca `node scripts/qa-local-contract-pdf.mjs`10gerçekStorageAPI,
byte karşılaştırması ve eşzamanlı Storage remove/publish gerçek bloklanma kabulü.
Standalone API runner kilidi boşken çalışır. PDF native port55445.

Eksik yerel Storage için `node scripts/start-local-document-storage.mjs`; yalnız
marker/loopback/dedicatedcontainer doğrulanınca internalnetwork'te v1.35.3 ekler,
DB'yi durdurmaz/resetlemez, hostport açmaz. Volume bps_document_storage_acceptance;
.env.local değiştirilmez; secret değerler print edilmez. Env adları için resmi
[Supabase Compose](https://github.com/supabase/supabase/blob/master/docker/docker-compose.yml)
incelendi, mevcut yerel imajla gerçek API kabulü yapıldı. Kurulum supersetschema değil.

Upload/CAS ayrı işlemler: kullanılmayan blob kalabilir, aynı-command receipt yok.
Baseline byte/hash doğrulaması yok; yeni dosya hash attestation sonraki aşama.
Native file chooser UI kabulü açık; UIversionlist/eskilink ve APIbytekabulü ölçüldü.
Sıradaki SOZLESME_PDF_YUKLEME_DEVAMLILIGI_DILIMI.md. Ek protokol daha sonra; current
uniquecontractPDF indeksi/maybeSingle değişmedi. Gerçek veri yedeği/temizlik,
üretim migration/push/deploy yok. Migration lock_timeout15s toplam süre SLA'sı değil.


## 2026-09-09 — 01900 PDF yükleme sürekliliği yerel teslimi

İlk PDF ve değiştirme aynı kalıcı komutu kullanır: prepare → Storage → byte readback
→ finish. Tam kimlikli iptal daha prepare gelmeden tombstone oluşturur. Company →
transaction advisory serialization → contract SHARE → command sırası; aynı contract'ta ilk yükleme yarışı tek kazanır. Rol,
verified tenant, aktif firma, document kimliği/revision ve gerçek obje owner/size/
mimetype kontrol edilir. Rezervasyonlu path authenticated delete/update'e kapalı;
pending/cancelled path raw document yazısıyla yayımlanamaz. Private publishing
state yalnız finish transaction'ında yaşar; geç hata document/version/receipt'i
birlikte geri alır. Contract FK RESTRICT iptal defterini silerek tekrar kullanım
olasılığını kapatır. Yeni UI manager-only, operation history/download yetkisi korunur.

115unit,20native upload ve ayrıca10gerçek Auth/Storage/HTTP kabulü. Son full17/17:
`/var/folders/fg/qm_gg6w16299dhr_lz9xr38r0000gn/T/bps-acceptance-XC4PZO/report.md`. Static209dosya,0FAIL/2öncekiWARN. Native55446;
`node scripts/qa-pdf-upload.mjs`, `node scripts/qa-local-pdf-upload.mjs` (ikincisi
runner kilidi boşken, dedicated marker/container/loopback doğrulanarak). API log:
`/private/tmp/bps-upload-api-final.log`. Native scope ve minimal fixtures tam prod
şemasının/owner'ın kanıtı değildir. 19migration yalnız dedicated sentetik yerelde.

Gerçek HTTP10MiB testi ara katmanın form zarfıyla birlikte erken kesme sorununu
buldu: Next middleware11mb; route10MiB+64KiB body, dosya10MiB. File chooser ilk
PDF/replace, reload pending recovery, farklı byte reddi, iptal/reload, eski/güncel
PDF görüntüleme doğrulandı. Tek sentetik contract2fbc6abb-1d23-4e60-a6d6-2b7186ff270b:
son2published+1cancelled/2version. Geçici hata constraint'i kaldırıldı.

Hash sınırı: declared_sha256 RPC çağırıcısının beyanıdır; DB server attestation
değildir. Normal HTTP yolu gerçek byte'ları hashler ve Storage'dan doğrular.
PDF başlığı tam parse/zararlı yazılım taraması değildir. Baseline dosya yedeği yok;
Storage/DB tek transaction değil, kullanılmayan obje otomatik temizlenmez.
localStorage yalnız metadata; farklı cihazda dosya kendiliğinden bulunmaz.
Eksik01900 frontend'de boş/başarılı kabul edilmez. Üretim/push/deploy yok.

Sıradaki plan `01_product/SOZLESME_EK_PROTOKOL_DILIMI.md`: belge rolü/kimliği,
partial-main index + okuyucu/RPC/history/komut hedefi birlikte değişecek. P08'in
ek protokol ve diğer geniş maddeleri henüz tamamlanmadı. Önceki01800 intent ve
native chooser açık notları bu teslimle tarihsel kaldı.

01900 son kilit kontrolü: pending komut varken contract firma/tenant/kimlik
değişikliği yasak; iptal erişimi korunur. Advisory serialization aynı contract
uploadlarını sıraya alır; legacy metadata yazısıyla contract/document deadlock
yaratmaz. Testte metadata yazısı tamamlanır, finish yeni revision ile conflict
alır. Native yükleme toplamı20; bu sayı önceki18'in yerine geçer.


## 2026-09-09 — 02000 ana PDF ve bağımsız ek protokoller

02000 yalnız dedicated sentetik yerelde uygulandı. Bağlı belge rolü main/appendix
ve ek başlığı değişmez. Ana PDF için partial unique, çoklu ekler için bağımsız
DB belge kimliği; aynı başlık kimlik değildir. Yeni yükleme hedefi komut kimliğine
katılır. 01900 main RPC imzası, eski localStorage anahtarı ve tamamlanmış/iptal/
bekleyen komutlar korunur. Eski history RPC main-only; ek history/path RPC'leri
actor+verified tenant+contract+document eşleşmesini doğrular. Liste20+1 keyset,
20gösterim ve sonraki düğmesi; history50+1. Okuma hatası boş liste sayılmaz.

Migration kategori tutarsızlığında PDF_ROLE_BASELINE_REVIEW_REQUIRED ile durur;
mevcut bağlı belgeyi sessizce ana belge yapmaz. Backfill exclusive documents/command
kilidi altında sadece documents_guard_version trigger'ını kısa süre kapatır,
revision/provenance artırmadan rolü ekler, trigger'ı geri açar. Öncesinde etkinlik
kontrolü var; bekleme timeout15s toplam uygulama süresi değildir. 01800/01900
fonksiyon gövdeleri artık02000 mevcutken eski yerel API scriptleri tarafından
geri yazılmaz. Eski migration dosyaları değişmedi.

Kabul:121unit,32native ek protokol kontrolü,ayrı15gerçek Auth/Storage/HTTP kontrolü.
Native55447: qa-contract-appendices.mjs; ilk32,01900 regresyonunu da içerir;
20+32 tamamen bağımsız test sayısı gibi toplanmaz. Gerçek API:
qa-local-contract-appendices.mjs; global runner kilidi boşken çalışır.
Son full18/18: `/var/folders/fg/qm_gg6w16299dhr_lz9xr38r0000gn/T/bps-acceptance-3LQQlC/report.md`. Static212dosya,0FAIL/2öncekiWARN.
API log `/private/tmp/bps-appendices-api.log`. Yeni parse/service testleri6.

Tarayıcıda contract00000000-0000-4000-8000-000000000400: iki ek gerçek file chooser
ile yüklendi, ilk ek değiştirildi, eski PDF görüntüleyicide BPS SYNTHETIC VERSION
ONE görüldü. DB: ana revision2/3sürüm, dönemsel destek revision0/1sürüm, ek temizlik
revision1/2sürüm. Ana ve diğer ek değişmedi. Firma Evraklar listesi ek başlığını,
Ek Protokol kategorisini ve sözleşme bağlantısını gösteriyor; bağlı dosyada silme
UI'ı yok, DB geçmiş FK'leri ayrıca koruyor. AX link ile sözleşmeye dönüş ölçüldü.

Sınırlar: ana PDF/ek protokol/destekleyici genel firma evrakı birbirine otomatik
aktarılmaz. Başlık değiştirme ve belge rolü taşıma bu dilimde yok. Keyset liste
sabit UUID sırasındadır, bir sorgu snapshot'ıdır; ardışık sayfalar transaction
snapshot değildir, eşzamanlı yeni kayıt için listeyi yenilemek gerekir. Başarılı
upload sözleşme statüsünü/yenileme görevini değiştirmez. Hash01900 beyan sınırı,
10MiB HTTP/readback ve Storage korumaları korunur; e-imza/hukuki doğrulama yok.
20migration sadece sentetik yerel, üretim/push/deploy ve gerçek veri yedeği/temizlik yok.

Sıradaki: `01_product/EVRAK_TAKIP_SAHIPLIGI_DILIMI.md`. Geçerlilik güncellemesinde
CAS ve evrak→gerçek görev/sorumlu; mevcut01700/01500/01600 motorlarını kullan.
Bu plan henüz kodlanmadı. Önceki01900 “sıradaki ek protokol” notları tarihsel kaldı.
