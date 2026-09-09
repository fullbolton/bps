# Sözleşmede ana PDF ve ek protokoller — 02000 yerel teslim

2026-09-09. 02000 yerelde tamamlandı. Aşağıdaki ilk plan tarihsel başlangıçtır.
Güncel başlangıç: 01800 sürüm geçmişi +01900 kalıcı yükleme/iptal komutları.

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


## Kullanıcı sonucu

Sözleşmede bir ana PDF, birden çok ek protokol ve bunların ayrı sürüm geçmişleri
olmalı. Kullanıcı bir ek protokol yüklerken ana PDF'yi değiştirmiş olmamalı.
Ek protokolün yeni sürümü aynı protokolün altında kalmalı; sözleşme statüsü ve
mevcut yenileme görevi kendiliğinden değişmemeli. Destekleyici genel firma evrakı
bu teslimde sözleşmeye otomatik taşınmayacak.

## Önce kodla uzlaştırılacak noktalar

- `documents_contract_active_unique` şimdi tüm non-null contract_id'leri tekilleştiriyor.
- `getActiveContractDocument()` yalnız contract_id ile maybeSingle yapıyor; birden
  çok belge eklenirse indeks kadar bu okuyucu da değişmeli.
- `category` genel evrak alanı; tek başına değiştirilebilir kategoriye güvenerek
  ana PDF/ek protokol kimliği kurma. Bağlı belgenin türünü DB'de sabitle.
- 01800 geçmişinde `current`, her document'ın güncel path'ine göre hesaplanıyor;
  mevcut UI/parser bütün sözleşmede tek current varsayıyor. Liste ve sürüm RPC'leri
  belge kimliğiyle ayrılmalı, başka belgenin sürümü yanlış panelde görünmemeli.
- 01900 prepare/finish sözleşmedeki tek belgeyi SELECT ediyor. Yeni ek protokol
  yaratma, mevcut ek protokolü değiştirme ve ana PDF değiştirme ayrı hedefler olmalı.
- Firma evrak listesi aynı documents satırlarını görüyor. Yeni ekler iki farklı
  yerde çelişkili kategori, silme veya güncelleme davranışı kazanmamalı.

## Uygulama sırası

1. Ayrı migration: bağlı belgeye değişmez rol (`main`/`appendix`) ve ek protokol
   için kullanıcının verdiği başlık. Mevcut bağlı belgeleri varsayımla sessizce
   yeniden adlandırma; mevcut kategori/sayı tutarsızlıklarını pre-check ile bildir.
   Ana belge için contract başına partial unique; ekler kendi document kimliğiyle
   yaşar. Tenant/company/contract bağlamı, rol ve kimlik daha sonra taşınamaz.
2. Komut kimliğine hedef rolü ve ek belge kimliğini kat. İlk ek belge kimliği DB
   tarafından ayrılmalı ve aynı komutla tekrar denemede sabit kalmalı. Aynı adlı
   iki farklı ek protokolü otomatik birleştirme; başlık kimlik değildir.
   01900 yayımlanmış/iptal edilmiş kayıtlarının eski cevapları çalışmaya devam etsin.
3. Sözleşme detayında ana PDF kartı + ek protokol listesi; ek yaratma/güncelleme
   yalnız yönetici, okuma mevcut sözleşme okuma rolüyle uyumlu. Her ek kendi
   yükleme, devam, iptal, güncel dosya ve geçmiş bölümünü kullanır. localStorage
   anahtarı sözleşme kadar belge hedefini de içermeli; eski bekleyen01900 ana PDF
   komutları kaybolmamalı veya bir ek protokole dönüşmemeli.
4. Liste RPC'si açık üst sınır ve devam bilgisi versin. Başarısız okuma boş liste
   sayılmasın. History/path RPC'leri actor+verified tenant+contract+document
   eşleşmesini kontrol etsin. Var olan main maybeSingle yalnız main rolünü süzsün.
5. Kabul: bir ana+iki ek; bir eki değiştirme diğer iki güncel dosyayı değiştirmez;
   her geçmiş kendi eski byte'ını indirir; ana için eşzamanlı ilk yüklemede tek
   kazanan, iki ayrı ek yaratmada iki bağımsız sonuç; eski komut tekrarları; scope,
   pasif firma, iptal/finish yarışları; firma listesi ve silme koruması regresyonu.
   10 MiB HTTP, Storage readback ve sunucu hash kontrolleri korunmalı.

## Sınırlar

Bu dilim e-imza, hukuki metin değerlendirme, otomatik sözleşme yenileme veya
imzalı belgenin geçerliliğini doğrulama değildir. Evrak yüklemek onaylanmış veya
imzalanmış olmak anlamına gelmez. Yeni hukuki tarih/ihbar süresi türetilmez.
Dosya silme/boşta kalan obje temizliği ve gerçek içerik yedeği eklenmez.

Önce repo ve Obsidian günlüğünü güncel ölçümle uzlaştır. Yalnız dedicated
bps-supabase-acceptance; 19 migration sentetik yerelde. Üretim migration/push/deploy
bu planın yetkisi değildir. .env.local eski remote hedefte; testler onu kullanmaz.
