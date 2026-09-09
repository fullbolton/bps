# Günlük operasyon pilotu — uygulama ve kabul notu

2026-09-09. **On iki pilot migration yalnız yerel sentetik Supabase’de uygulandı; üretime uygulanmadı, push/deploy yapılmadı.**
Bu belge uygulanmış işlem kaydı veya canlı uygulama izni değildir.

## Paket

- Migration sırası: `20260909000100_daily_operations_pilot.sql` → `20260909000200_location_import.sql` → `20260909000300_scoped_operation_command.sql` → `20260909000400_command_reconciliation.sql` → `20260909000500_weekly_operations.sql` → `20260909000600_request_batch.sql` → `20260909000700_resize_request.sql` → `20260909000800_attendance.sql` → `20260909000900_replace_assignment.sql` → `20260909001000_attendance_week.sql` → `20260909001100_operations_directory.sql` → `20260909001200_directory_activation.sql`.
- Altı tablo: `ops_locations`, `ops_workers`, `ops_daily_requests`,
  `ops_assignments`, `ops_commands`, `ops_events`.
- RPC: `ops_mutate(uuid,text,jsonb)`, `ops_board(uuid,date)`.
- Ekran: `/talepler/gunluk`; Firma Detay ve Talepler üzerinden bağlantı.
- Yönetici lokasyon/personel oluşturur. Yönetici ve operasyon günlük talep,
  atama, kaldırma ve iptal kullanır. Üyelikle doğrulanmış tenant zorunludur.

## Uygulama öncesi

1. Hedef proje kimliğini ölçerek doğrula. Eski `.env.local` dev URL'sinin varlığı,
   o projenin hâlâ çalıştığını kanıtlamaz. Üretim bağlantısı geliştirme ortamı değildir.
2. Migration sahibi, mevcut `companies(tenant_id,id)`, `profiles(id)`, `tenants(id)`
   ve iki tenant/rol yardımcısını incele. PGlite fixture gerçek Auth şemasının tümü
   değildir. `SECURITY DEFINER` fonksiyonu oluşturan rolün erişimi ayrıca incelenmeli.
3. Migration geçmişini karşılaştır. Önceden uygulanmış `000100/000200/000400`
   tekrar uygulanmaz; bekleyen ilgisiz asistan migration'ını toplu `db push` ile
   bu pakete katma. Test iş verisi temizliği bu migration'ın parçası değildir.
4. Yalnız bu migration'ı uygun test veritabanına uygula. Transaction içindeki
   `lock_timeout=5s` kilit başına beklemeyi sınırlar; toplam işlem süresi sınırı
   değildir. Mevcut companies tablosundaki normal unique-index oluşturma yazıları
   bekletebilir; zaman aşımında transaction geri alınmalıdır.

## Açılış

Migration ve aşağıdaki kabul kontrolleri tamamlandıktan sonra uygulama sunucusunda
`BPS_DAILY_OPERATIONS_ENABLED=true` ayarlanır. Varsayılan kapalıdır. Sayfa dinamik
çalışır; server action'lar da bayrağı kontrol eder. Bu **uygulama kapısıdır**:
migration uygulanınca yetkili authenticated roller doğrudan RPC çağırabilir.
DB yetkisini kapatmak gerekirse fonksiyon EXECUTE hakları ayrıca değerlendirilir;
yalnız ortam bayrağını kapatmak doğrudan Supabase erişimini kesmez.

## Çalıştırılan kontroller

```sh
npm run qa:operations
node --test scripts/prepare-test-data-reset.test.mjs
npm run qa:static
npm run qa:unit
npx tsc --noEmit --incremental false
BPS_DAILY_OPERATIONS_ENABLED=true npm run build
```

13 domain/form/yanıt testi; temizlik üreticisinde 5 test; statik kontrolde 0 FAIL
(2 WARN: bu paketin package/migration farkı ve mevcut kullanılmayan TimelineList); eski unit harness başarılı. Kapalı ve açık bayrakla derleme başarılı.

Geçici PostgreSQL/WASM testi repo dışında kurulan PGlite kullanır. Uygulama
dependency'si değildir; üretim verisi veya kimlik bilgisi okumaz.

```sh
npm install --prefix /private/tmp/bps-operations-pgtest @electric-sql/pglite
BPS_PGLITE_MODULE=/private/tmp/bps-operations-pgtest/node_modules/@electric-sql/pglite/dist/index.js node scripts/qa-daily-db.mjs
```

25 kontrol geçti. Bu test gerçek migration metnini uygular: RLS/rol/tenant ayrımı, doğrudan yazma
engeli, personel/gün çakışması, kapasite, tekrar deneme, kaldırma ve iptal.
Tek oturumlu motor iki bağımsız bağlantı yarışını kanıtlamaz.

## Kabul senaryoları (güncel sonuç için aşağıdaki native test ekine bakın)

- İki PostgreSQL bağlantısı: kapasitesi 1 talebe iki farklı personel eşzamanlı
  atanır; yalnız biri başarılı, diğeri kapasite hatası olmalı.
- İki talebe aynı personel/gün: yalnız bir aktif atama kalmalı. Aynı komut
  eşzamanlı iki kez gönderilince bir kayıt ve bir olay oluşmalı.
- Atama ile iptal yarışı: iptal edilmiş talepte aktif atama kalmamalı.
- Rol/üyelik taşıması ile mutasyon: profil kilidini bekleyen mutasyon yeni
  üyelik/rolü görmeli; eski tenant claim'i ile yazı olmamalı.
- Kimlikli tarayıcı: yönetici ve operasyon akışı, yetkisiz rol, farklı tenant,
  firma/gün hızlı değiştirme, ağ hatası ve aynı formu yeniden gönderme.

Komut kimliği tarayıcı belleğinde tutulur; sayfa yeniden yüklenirse korunmaz.
Belirsiz sonuçtan sonra planı kontrol etmeden yeni komutla tekrar kayıt açma.
Pilot tam gündür; “atanmamış” gerçek dünyada müsaitlik/izin/yetkinlik kanıtı değildir.
Toplu şube importu, günler arası plan ve fiili devam bu pakette bulunmaz.

## Geri alma yaklaşımı

Uygulama bayrağı kapatılarak arayüz devre dışı bırakılabilir. Yeni tabloları veri
varken DROP etmek geri alma değildir. Veri ve migration geçmişi korunarak ayrı
incelenmiş düzeltme migration'ı hazırlanır. Bu runbook hiçbir DROP/DELETE çalıştırmaz.


## Toplu şube aktarımı eki — 2026-09-09

İkinci lokal migration: `20260909000200_location_import.sql`; yalnız pilotun
`20260909000100` migration'ından sonra uygulanır. İkisi de canlıya uygulanmadı.
`ops_locations.external_code` nullable eklenir; mevcut manuel kayıtlara kod uydurulmaz.
Firma/tenant/kod unique index ve yöneticiye özel `ops_import_locations` RPC'si vardır.
Aktarım aynı firma üzerindeki diğer aktarımları firma satırı kilidiyle sıraya koyar.
Kod büyük/küçük harfe duyarlı; yalnız ASCII harf, rakam, tire ve alt çizgi (1–40).
Aynı kod+ad+il+aktiflik atlanır, uyuşmazlık tüm partiyi geri alır. Kodsuz manuel
kayıtlarla isim eşleştirmesi yapılmaz; bunları aktarım öncesi ayrıca uzlaştırmak gerekir.

Dosya UTF-8 CSV, başlık `sube_kodu,sube_adi,il`; virgül veya noktalı virgül, BOM/CRLF
ve tırnak kaçışı desteklenir. Bozuk UTF-8, kontrol karakterleri, boş satırlar,
tekrarlayan kodlar, 500'den çok satır veya 256 KiB üzeri dosya reddedilir.
Şablon `public/templates/import_template_locations.csv`; örnek şubeler gerçek banka
verisi değildir. Dosyalar tarayıcıda çözülür; yalnız doğrulanmış alanlar action'a gider.
Önizleme ilk 20 satırı gösterir; tüm satırlar doğrulanır. Mevcut DB kodlarıyla son
kontrol atomik aktarım anında yapılır. Otomatik internetten keşif ve XLSX henüz yoktur.

Bu ek sonrası ölçüm: 19 domain/form/CSV testi, 37 PostgreSQL kontrolü başarılı.
Pilot bayrağı açık build başarılı (tip kontrolü dahil); statik 0 FAIL / 2 WARN.
İki bağımsız bağlantıyla yarış ve kimlikli tarayıcı kabulü hâlâ bekliyor. Özellikle
aynı firmaya aynı kodları iki eşzamanlı import ve import/manuel lokasyon ekleme
senaryoları gerçek PostgreSQL test ortamında çalıştırılmalı.


## Native PostgreSQL yarış ölçümü — 2026-09-09

Önceki “iki bağlantılı yarış testi bekliyor” notu bu lokal paket için güncellendi.
`scripts/qa-daily-concurrency.mjs` PostgreSQL **17.10** üzerinde 10 gerçek kilit
bekleme senaryosu ve iki son durum kontrolüyle **12 kontrolü** geçti. A/B farklı
backend PID'leri; monitor bağlantısı `pg_blocking_pids` ile B'nin A'yı beklediğini
ölçmeden commit etmez. READ COMMITTED altında test edilmiştir.

Geçenler: son kapasite, personel/gün tekilliği, aynı komutun tekrar sonucu/tek olay,
atama→iptal ve iptal→atama sıraları, aynı/farklı içerikli eşzamanlı import, import ile
manuel lokasyon ekleme, rol iptali ve üyelik taşıması sonrası eski claim reddi.
Üyelik/rol değişimi test fixture'ında mevcut profil-kilit protokolüyle taklit edilir;
canlı admin RPC/Auth bütününün uçtan uca kabulü değildir. Canlı ölçülen 17.6 ile
aynı ana sürüm, farklı yama sürümüdür.

```sh
npm install --prefix /private/tmp/bps-native-pgtest embedded-postgres@17.10.0-beta.17
BPS_EMBEDDED_PG_MODULE=/private/tmp/bps-native-pgtest/node_modules/embedded-postgres/dist/index.js node scripts/qa-daily-concurrency.mjs
```

Harness yalnız 127.0.0.1:55439 üzerinde kendisinin oluşturduğu geçici DB'ye bağlanır;
uzak URL veya uygulama parolası almaz. Sentetik fixture PGlite harness ile ortaktır.
Sunucu ve veriler finally bloğunda kapatılır/temizlenir. Port doluysa testi başarısız
sayar; başka DB'ye bağlanmaz. macOS sandbox shared-memory engelinde yerel çalıştırma
izni gerekir. Repo bağımlılığına PostgreSQL eklenmedi.

Fixture ayrıştırıldıktan sonra 37 PGlite regresyon kontrolü de tekrar geçti.
Kalan: kimlikli tarayıcı, gerçek Supabase auth/admin entegrasyonu ve migration sahibinin
hedef ortamda doğrulanması. İki yeni migration hâlâ uygulanmadı; push/deploy yok.


## Gerçek yerel Supabase kabulü — 2026-09-09

Docker disk engeli kullanıcı yer açınca çözüldü. Ayrı yerel Supabase 17.6 üzerinde
iki pilot migration uygulandı ve 17 gerçek Auth/API/servis kontrolü geçti. Üretim
migration'ları hâlâ uygulanmadı. Yerel sentetik public fixture tam tarihsel şema
değildir; kimlikli tarayıcı/admin RPC kabulü bekliyor. Ayrıntı:
[Yerel Supabase kabulü](local-supabase-acceptance.md).


2026-09-09 tarayıcı kabulü tamamlanan temel akış: sentetik yöneticiyle
lokasyon/personel/talep/atama/kaldırma/iptal ve CSV önizleme/aktarım/tekrar atlama.
İptal onayı uygulama içi dialog'a taşındı. Ayrıntılı sınırlar local-supabase-acceptance
belgesinin son ekinde; üretime açılış ve tam tarihsel şema entegrasyonu hâlâ ayrı.


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


2026-09-09 görev eki: 12 ops migration yanında01300 task assignment history yalnız
yerel minimum görev fixture'ına uygulandı. Görev kodu revision gerektirir; ileride
onaylı dağıtımda migration önce gelmeli. Yetki/owner/tamprod şema kabulü açık.
Komut/kanıt ve sınırlar: 01_product/GOREV_DEVIR_DILIMI.md; ops reset script'ine
01300 eklenmedi çünkü baseline tasks içermez. Görev test kurulumu ayrı ve sentetiktir.
