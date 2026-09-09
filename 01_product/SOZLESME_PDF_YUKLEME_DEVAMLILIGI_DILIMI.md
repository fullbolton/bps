# Sözleşme PDF yüklemesinde kesintiden devam — 01900 yerel teslim

2026-09-09. 01900 yalnız dedicated sentetik yerel ortamda uygulandı.
Aşağıdaki başlangıç/uygulama sırası teslim öncesindeki planı kaydeder.

## Teslim ve ölçüm

- İlk yükleme ve değiştirme aynı kalıcı komutta: prepare → Storage upload → gerçek
  byte'ları geri oku/doğrula → finish. Path DB tarafından ayrılır. Aynı komutun
  hash/ad/boyut/document/revision bilgileri değiştirilemez. Published receipt,
  sonraki sürümlerden sonra bile aynı sonucu döndürür.
- İptal, ilk prepare henüz gelmemişken de tam komut kimliğiyle tombstone oluşturur.
  Company → sözleşme başına transaction advisory kilidi → contract SHARE → command kilit sırası; aynı sözleşmede ilk yükleme yarışının
  kaybedeni güncel document'ı görür ve conflict alır. İptal/finish tek kazananla
  sonuçlanır. Company pasifse finish durur, cancel mümkündür.
- Rezervasyonlu Storage path üzerinde authenticated silme/üzerine yazma engelli.
  Pending path actor+verified tenant+yönetici ile sınırlı. Reserved pending/cancelled
  path raw documents yazısıyla yayımlanamaz. Private geçici `publishing` durumu,
  document+version+receipt ile aynı transaction'da tamamlanır; hata hepsini geri alır.
  Sözleşme silinmesi komut/iptal defterini silemez (FK RESTRICT). Bekleyen komut
  varken sözleşmenin firma/tenant/kimliği de değiştirilemez; iptal erişilebilir kalır.
  Sözleşme başına advisory serialization, legacy belge metadata yazısının tuttuğu
  document satırı ile contract guard arasında deadlock oluşmasını önler. Native
  testte metadata yazısı tamamlanır, bekleyen finish yeni revision ile conflict alır.
- UI account/tenant/contract kapsamında yalnız komut metadatasını localStorage'a
  kaydeder; PDF byte'ları saklanmaz. Reload sonrası status okur; aynı dosya yeniden
  seçilir. Başarılı/malformed/ulaşılamayan/henüz bulunmayan sonuçlar ayrıdır.
  Hata veya bilinmeyen sonuçta komut korunur; yeni kimlikle sessiz tekrar yapılmaz.
- Cookie oturumlu HTTP route, origin ve verified tenant kontrolü. PDF başlığı,
  10 MiB boyut ve SHA-256 sunucuda kontrol edilir; Storage'dan geri okunan gerçek
  byte'lar aynı hash ile karşılaştırılır. service_role uygulama akışına eklenmedi.
- Gerçek HTTP testi Next middleware'in varsayılan10MiB sınırının form zarfını da
  sayıp dosyayı kestiğini gösterdi. Middleware11mb; route body10MiB+64KiB, dosya10MiB.
  Eksik/yanlış Content-Length actual byte sayısının yerine kullanılmaz;20s body
  okuma süresi, ayrı18s Supabase istek süreleri, browser90s toplam bekleme.

Kabul:115unit (10 yeni yükleme testi),20native yükleme kontrolü; ayrı10gerçek
Auth/Storage/HTTP kontrolü. Prepare/upload/finish cevaplarının gerçek başarılı
istekten sonra düşürülmesi, tekrar/tek sürüm,10MiB,rol/tenant,Storage koruması.
Tam kabul: 17/17 geçti — `/var/folders/fg/qm_gg6w16299dhr_lz9xr38r0000gn/T/bps-acceptance-XC4PZO/report.md`.

Tarayıcı: gerçek file chooser ile ilk PDF ve replace; özel sentetik constraint
finish'i durdurdu →1pending/0version →reload komutu buldu →farklı PDF reddedildi
→aynı PDF1published/1version →replace2published/2version. Üçüncü deneme iptal
edildi; reload sonrası pending UI yok, DB2published+1cancelled/2version. Geçici
constraint kaldırıldı. Eski PDF `BPS SYNTHETIC VERSION TWO`, güncel PDF
`BPS SYNTHETIC VERSION ONE` tarayıcı PDF görüntüleyicisinde ayrı ayrı görüldü.
Sentetik sözleşme:2fbc6abb-1d23-4e60-a6d6-2b7186ff270b.

## Güven sınırı ve açık işler

`declared_sha256` doğrudan authenticated RPC çağırıcısının beyanıdır; DB tarafından
sunucu imzası/hash attestation sayılmaz. Gerçek HTTP uygulama yolu byte doğrular;
DB finalize obje owner/mimetype/size/CAS doğrular. PDF başlığı tam PDF parse veya
zararlı içerik taraması değildir. Baseline dosyaları dışarı aktarılıp hashlenmedi.
Storage ve DB tek transaction değildir; kullanılmayan/iptal edilmiş bloblar korunur.
service_role veya storage filesystem bypass'ına karşı immutable yedek iddiası yok.
Tam prod şeması, function owner, hosting reverse proxy ve üretim upload limitleri
bu yerel kabulün ölçümü değildir. Legacy raw belge yazıları yükleme komutuna
otomatik dönüşmez; rezervasyonsuz eski yollar01800 korumasına tabidir.
Tarayıcı depolaması kapalı/bozuksa yeni upload durur; dosya başka cihazda otomatik
bulunmaz. Aynı tarayıcı profiliyle aynı scope'a dönerek komut sürdürülebilir.

Sıradaki: [Ana PDF ve ek protokoller](SOZLESME_EK_PROTOKOL_DILIMI.md).


## Başlangıç ve açık problem

01800 hem ilk belge INSERT'inde hem yeni storage_path UPDATE'inde değişmez sürüm
kaydını tutar. Eski dosya referansları korunur, normal uygulama/Storage silme ve
üzerine yazma engellenir. Doküman revision tüm yazılarda DB'den ilerler; replacement
servisi expectedRevision ile CAS yapar. UI'da okuma hatası “PDF yok” değildir.

Dosya yükleme hâlâ belge güncellemesinden ayrı. İlk yükleme server action, replace
browser upload → CAS. CAS başarısız veya cevap kayıpsa yüklenmiş kullanılmayan obje
kalabilir; 01800 bunu temizlemez ve tamamlanmış komut sonucu tutmaz. Şimdiki UI
PDF kaydını yeniden yüklemeyi ister. Yeni aşama bu boşluğu kapatmalı; sürüm
geçmişi veya ek protokol ilişkisi yeniden kurulmayacak.

## Uygulama sırası

1. Tek upload intent/komut: actor, verified tenant, contract/company, mevcut document
   kimliği+revision veya yokluk, önerilen dosya adı, boyut ve yükleme kimliği.
   Path'i güvenilir sunucu/DB üretmeli; istemciden key alınmamalı. Aynı komut farklı
   payload ile kullanılırsa reddet; farklı komutlar aynı eski revizyondan tek
   yayınlanan sürüm üretmeli. Kullanıcıya yayınlanmış sonucu sorgulama sağlanmalı.
2. İlk yükleme ve replacement aynı doğrulanmış akışa taşınmalı. Auth/rol/aktif firma
   upload öncesi ve finalize sırasında tekrar denetlensin. Komutu iptal etmek
   geçmiş PDF'i silmesin. Yeni byte upload ve DB finalize iki sistemdir; tek
   transaction oldukları söylenmemeli. Storage nesnesi gerçekten var ve actor'a
   ait olmalı. 01800 object owner/retained-file/bağlam korumalarını koru.
3. Yeni yükleme byte'larını sunucuda PDF başlığı, boyut ve hash ile kontrol et.
   Hash bir RPC parametresinden geliyorsa kötü niyetli doğrudan RPC çağrısının
   aynı alanı uydurabildiğini hesaba kat: buna “sunucuca doğrulandı” deme. Gerekirse
   DB alanını beyan edilen hash / gerçek server-attested alan diye ayır veya
   ayrı güvenilir finalize yetkisi tasarla. service_role sınırını rastgele genişletme.
   Geçmiş baseline blob'larını dışarı aktararak checksum doldurma yok.
4. Form, belirsiz sonuçta aynı komutu korusun; seçili dosya/komut reload sınırını
   açıkça ele al. Başarılı upload cevabı kaybı, finalize cevabı kaybı, sayfa
   yenileme ve kullanıcı/tenant değişimi ayrı. “Tekrar dene” ikinci PDF üretmesin.
   Sunucu action body-size varsayılanı ile10MB UI sınırını ölç; var diye varsayma.
5. Kullanılmayan upload listesi/temizlik ileride ayrı explicit policy. Otomatik
   silme veya eski sürüm silme ekleme. Bu teslimin test artıkları yalnız sentetik
   ortamdadır; gerçek dosya yedeği/temizliği kapsamda değildir.
6. Unit + native DB race + gerçek yerel Storage/Auth kesinti kabulü. Browser'da
   gerçek dosya seçimiyle ilk yükleme/değiştirme ve eski/yeni dosya açma doğrulansın.
   01800 UI'da sürüm listesi ve eski indirme bağlantısı ölçüldü; native file chooser
   bu ilk dilimde test edilmedi, tamamlanmış gibi devralma.

## Sonraki adım

Kesintiden devam kabulünden sonra ana PDF / birden çok ek protokol ayrımı.
Mevcut documents_contract_active_unique tüm contract_id'leri tekilleştiriyor;
getActiveContractDocument maybeSingle. İndeks/okuyucu/UI aynı dar teslimde değişmeli.
Yeni evrak sözleşme statüsünü veya yenileme görevini otomatik kapatmamalı.

## Yerel çalışma koşulları

Dedicated bps-supabase-acceptance;18migration yerelde. Storage yalnız bu Docker
network'üne bağlı, host port açılmadı; files volume bps_document_storage_acceptance.
`scripts/start-local-document-storage.mjs` mevcut DB'yi durdurmaz/sıfırlamaz;
kimlik/loopback/marker kontrolüyle eksik Storage'ı ekler, gizli değerleri yazdırmaz.
Storage imajı mevcut CLI2.75 ile gelen public.ecr.aws/supabase/storage-api:v1.35.3.
Ortamdaki normal supabase start mevcutDB'yi görünce “already running” dönüyordu;
Storage daha önce kaynak sınırı için exclude edilmişti. Gerekmedikçe servisleri
silip yeniden kurma. Üretim/push/deploy, gerçek dosya yedeği/temizliği yok.
