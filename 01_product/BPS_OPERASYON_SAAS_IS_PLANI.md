# BPS — Operasyon ve SaaS İş Planı

> Güncel yürütme yönü: [BPS Güncel Yön](BPS_GUNCEL_YON.md). Aşağıdaki paketler
> ayrıntı/backlog olarak korunur; önce dikey dilim, sonra toplu aktarım sırası geçerlidir.

**Tarih:** 2026-09-08  
**Sahip:** Furkan  
**Uygulama:** Claude Code  
**Plan netleştirme ve bağımsız kod inceleme:** Codex  
**Durum:** İş planı hazır; uygulama henüz başlamadı.

**Güncel başlangıç:** [Vault–repo–canlı uzlaştırma ve sıra](BPS_BASLANGIC_UZLASTIRMA_PLANI.md).
P00 kapsamında Vault okuması ve ilk canlı ölçüm yapıldı; tam katalog/dev envanteri
ve kimlikli smoke açık. P01 ve kod paketleri başlamadı.

**Teknik yürütme:** [Supabase ve Kod Uygulama Planı](BPS_TEKNIK_UYGULAMA_PLANI.md)
veri modeli önerisini, RPC/transaction sınırlarını, kod dosyalarını, migration ve
test sırasını açar. Yeni şema tanımlarını mevcut prod gerçeği diye sunmaz; P01'de
güncel ölçüm ve davranış/rol kararlarıyla kesinleştirir.

Bu belge, Furkan'ın konuşulan kapsamı Markdown iş planına çevirme talebiyle oluşturuldu.
Birlikte çalışmanın yürütme belgesidir; bütün gelecek paketleri aynı anda kodlama,
prod SQL uygulama, push veya deploy talimatı değildir. Paket başlangıcında aşağıdaki
giriş koşulları sağlanır. Açık kararlar cevaplanmış gibi uygulanmaz.

## 1. Hedef ve ürün sınırı

Çok şubeli müşterilere hizmet veren operasyon ekibi aynı veriyi tekrar yazmadan:

**Firma/şube aktarır → talep açar → personel yerleştirir → değişikliği yönetir →
müşteri listesini çıkarır → sözleşme/evrak/görev takibini aynı bağlamda sürdürür.**

Firma Detay merkezdir. Talepler, firmalar arası günlük çalışma yüzeyidir. Personel
görünümü yardımcıdır; tam HRIS değildir. BPS müşterisi/tenant (Partner Staff, Mek),
hizmet verilen firma (Vakıfbank) ve lokasyon (Pendik şubesi) ayrı kavramlardır.
BPS kullanıcı hesabı ile sahaya gönderilen personel kaydı da ayrıdır.

Altyapı yönü: mevcut Next.js + TypeScript + Supabase korunur. İş kuralları uygulama/
servis katmanında, veri bütünlüğü ve yetki kontrolleri sunucu/veritabanı sınırında.
Supabase'i değiştirme veya ayrı backend servisi kurma bu planın işi değildir.

Kapsam dışı: bordro/özlük/izin hakedişi, saatlik vardiya, genel CRM, sohbet, muhasebe
kayıtları, AI otomatik atama, kapsamlı workflow/form tasarımcısı. Müşteri portalı,
çalışan uygulaması, SSO/SCIM ve otomatik tahsilat yalnız ilerideki karar paketleridir.

## 2. Başlangıç durumu ve kaynaklar

- Firma, sözleşme, görev, randevu, evrak, finansal özet ve raporlar mevcut.
- Görevde kullanıcıya bağlı atama, Dashboard'da bana atanmış/atanmamış işleri gösterme,
  dört tür e-posta hatırlatması, duyuru ve platform admin kodda mevcut; yeniden yapılmaz.
- Şube rehberi, kişi/gün yerleştirme ve gelişmiş toplu şube güncellemesi taslak aşamasında.
- Firma zaman çizgisi, bazı koordinasyon yüzeyleri ve bildirim kuralları editörü
  mevcut kodda tamamlanmış akış değildir. Ekranda bulunmaları tamamlandıkları anlamına gelmez.
- Defterde `000200`, `000100`, `000400` uygulanmış olarak kayıtlıdır. `000400` yeniden
  uygulanacak iş değildir. Önceki kimlikli smoke'un sonucu kodlamadan önce kayıttan kontrol edilir.
- Eski `staffing_demands` yerine geçme yönü kabul edilmiştir. Önceki ölçümde tek test
  kaydı vardır; kesim gününde yeni veri oluşup oluşmadığı tekrar ölçülmeden tablo düşürülmez.
- Mevcut Step 3 RLS çalışmasıyla çakışan değişiklikler aynı envanter üzerinden koordine edilir;
  bu plan önceki migration numaralarını veya tamamlanan işleri yeniden açmaz.

Referanslar:
- [Kapsam taslağı](../03_strategy/IDP_TALEP_KAPSAM_TASLAGI.md)
- [Planlama davranışları ve 14 senaryo](../03_strategy/IDP_PLANLAMA_URUN_INCELEMESI.md)
- [SaaS benchmark](../03_strategy/BPS_SAAS_BENCHMARK_2026-09-08.md)
- [Çalışma kuralları](../00_core/CODEX.md)
- [Workflow](../02_rules/WORKFLOW_RULES.md), [durumlar](../02_rules/STATUS_DICTIONARY.md),
  [roller](../02_rules/ROLE_MATRIX.md)
- [RLS ölçüm notu](../02_rules/RLS_ACCESS_MATRIX.md),
  [prod/repo ayrışması](../02_rules/PROD_SCHEMA_DRIFT.md)

Referans taslakların eski önerileriyle bu plandaki açık kararlar çelişirse sessiz seçim
yapılmaz. Örneğin yalnız dönem aralığına dayalı çakışma kontrolü, seçili çalışma
günleri ayrık iki geçerli atamayı reddedebilir; teknik tasarım gerçek günleri esas almalıdır.

## 3. İşbirliği ve teslim protokolü

1. Furkan aktif paketi açar. Claude Code giriş koşullarını, güncel HEAD'i ve kapsamı doğrular.
2. Claude Code yalnız o paketi uygular; kapsam dışı bulguyu ayrı kaydeder.
3. Claude Code değişiklik özeti, commit/diff, test kanıtı ve açık sınırlamaları teslim eder.
4. Codex aynı commit/diff üzerinden bağımsız review yapar: iş davranışı, yetki,
   bütünlük, hata yolları ve kanıt. Ölçüm ile beyan ayrı etiketlenir.
5. Claude Code actionable bulguları düzeltir; Codex yalnız değişen riskleri yeniden inceler.
6. İnsan kullanım testi ve gerekli ortam kontrolleri sonrası paket kapatılır.
   Push/deploy/canlı migration ayrı açık talimatla yürütülür.

İki araç aynı dosyaları eşzamanlı değiştirmez. Review yapan araç bulgu verir; düzeltme
sahibi ayrıca belirlenmeden aynı değişikliği ikinci kez uygulamaz. Belgelendirme ve
kod aynı kavramları kullanır; yalnız yorum değiştirmek davranış düzeltmesi sayılmaz.

Her paketin kapanış kaydı:

| Alan | Kaydedilecek bilgi |
|---|---|
| Paket / durum | Paket ID, başlamadı/devam/review/doğrulandı |
| Kod kanıtı | Başlangıç ve teslim commit'i; çalışma ağacındaki ilgili fark |
| Kapsam | Yapılan davranış; özellikle ertelenen işler |
| Test | Komut, sonuç; senaryo girdisi ve gözlenen çıktı |
| Review | Açık bulgular veya incelenen kapsamda bulgu yok |
| Veri/ortam | Migration dosyası, uygulanma durumu ve doğrulama varsa kanıt |
| İnsan testi | Kim, tarih, ortam, sonuç; yapılmadıysa açıkça yazılır |
| Doküman | İlgili SoT güncellemeleri ve CHANGELOG kaydı |

## 4. Koddan önce kapatılacak kararlar

| ID | Karar | Öneri / mevcut sınır | Hangi işi etkiler? |
|---|---|---|---|
| K1 | Otelde talep ne zaman karşılanmış sayılır? | Günlük hizmet mi, bir defa işe yerleştirme mi? Cevap yok. Banka ilk teslimi bu cevabı beklemeden tasarlanabilir; otel kapsamı genişletilmez. | Otel modelinin P03/P05 kabulü |
| K2 | Aynı gün iki lokasyon / yarım gün var mı? | Mevcut taslak tam gün. Saatli gerçek ihtiyaç varsa ayrı kapsam kararı; saat bilgisi uydurulmaz. | P01/P03 |
| K3 | Müşteriye açıklar da gösterilecek mi? | İç görünüm açıkları her zaman korur. Dış görünüm için açıklar dahil veya yalnız atananlar seçimi teyit edilir. | P05 |
| K4 | Personel havuzu, lokasyon import ve geçmiş düzeltme yetkileri | Yönetici/operasyon sınırı açık aksiyon matrisiyle yazılır; İK okuma sınırı ve partner HOLD korunur. | P01/P02/P03 |
| K5 | İlk resmî şube kaynağı | Banka/TBB erişimi ve bütünlüğü ölçülür; makinece alınabilir servis henüz doğrulanmadı. Excel ortak giriş yoludur. | P02 |
| K6 | Çalışma takvimi ve tatil davranışı | Tek gün, her gün, hafta içi, seçili günler + tekil tarih çıkarma; resmî tatil otomatik çıkarılmaz. | P01/P03 |
| K7 | Personelin gelecekte ataması varken pasife alma | Etki listesi + yeniden atama/iptal seçimi; sessizce planı bozma yok. | P03/P04 |
| K8 | Talep durumları ve öncelik | Doluluk, iptal/bekleme ve dönemin geçmesi ayrı değerlendirilir; mevcut sözlüğe açık değişiklik gerekir. | P01/P03 |

K1 çözülmedi diye firma/şube aktarımı bekletilmez. K3 çözülmeden müşteri paylaşım
çıktısının davranışı kesinleştirilmez. Bu planın yazılması karar hücrelerini kapatmaz.

## 5. Paket sırası ve izleme tablosu

2026-09-09: aşağıdaki durumlar yerel kanıta göre güncellendi. Güncel uygulama sırası [Dashboard ve SaaS sırası](DASHBOARD_VE_SAAS_SIRASI.md); sıra numaraları takvim değildir.

Paket ID'leri bu belgeye aittir; eski Faz/Step numaralarını yeniden tanımlamaz.

| Paket | Çıktı | Bağımlılık | Durum |
|---|---|---|---|
| P00 | Mevcut durum, açık kararlar ve ilk paket hazırlığı | — | [ ] Devam: Vault ve ilk canlı ölçüm tamam; envanter/smoke açık |
| P01 | Yetki/durum/takvim sözleşmesi + teknik tasarım | P00; ilgili K2/K4/K6/K8 | Yerel çekirdek uygulandı; pilot kararları açık |
| P02 | Lokasyon rehberi + toplu giriş + kaynak keşfi | P01 lokasyon bölümü | Yerel rehber + toplu aktarım var; harici otomatik kaynak keşfi açık |
| P03 | Günlük talep ve tek atama | P01 + P02 | Yerel günlük talep/atama kabulü geçti |
| P04 | Toplu atama, değişiklik ve operasyon geçmişi | P03 | Yerel toplu talep/değişiklik/katılım/geçmiş kabulü geçti |
| P05 | Haftalık plan, müşteri çıktısı ve ilk pilot | P04 + K3 | Yerel haftalık plan/çıktı var; gerçek müşteri pilotu açık |
| P06 | Eski talep akışından kontrollü geçiş | P05 | Kısmi: 02500 Dashboard + 026 rapor kaynak ayrımı; veri taşıma ve pilot açık |
| P07 | Görev sahipliği ve devir akışını tamamlama | P04; mevcut görev modeli | Yerel sahiplik/devir ve üyelik koruması tamam; kullanıcı yaşam döngüsü P10 |
| P08 | Sözleşme/evrak aksiyonları ve belge ilişkileri | P07 | Yerel yenileme görevi/PDF/ek protokoller tamam; evrak takip sahipliği açık |
| P09 | Dar bildirim ve rapor iyileştirmeleri | P05 + P07/P08 çıktıları | 02100 aktiviteler yerelde; bildirim/rapor kalanları açık |
| P10 | SaaS müşteri kurulum ve kullanıcı yaşam döngüsü | P00 envanteri; P07 devir | 02200 kurulum + 02300 davet + 02400 yeni hesap yerelde; email/PKCE/hook uçtan uca kapısı açık |
| P11 | Paket hakları, veri çıkışı ve işletim hazırlığı | P10; ticari model kararı | Kurulum + pilot sonrası, satışa açılış öncesi |
| P12 | Hizmet teyidi / sınırlı saha akışı | Pilot ve ayrı kapsam kararı | Pilot sonrası: saha kontrolü/hizmet teyidi ve ayrı müşteri portalı kapsamı |

P02 kaynak erişimi keşfi P01'in bağımsız belge çalışmalarıyla yürüyebilir. P10/P11
hazırlığı pilotla paralel yapılabilir; bütün kod paketleri tek büyük PR'da birleştirilmez.

## 6. İlk teslim — şube, talep, yerleştirme, çıktı

### P00 — Başlangıç ve kanıt paketi

- [ ] Güncel commit, çalışma ağacı, aktif işler ve bekleyen review'ları kaydet.
- [ ] `/firmalar` Yeni Firma, `/admin`, tenant kapsamlı seçici ve kendi üyesine atama
  kimlikli smoke'unun güncel sonucunu defterden doğrula; eksikse yapılacak testi yaz.
- [ ] Mevcut import, görev, admin, bildirim ve belge akışlarını tekrar yapılmayacak temel olarak işaretle.
- [ ] K1–K8 kararlarını açık/kapalı ve sahibiyle kaydet; banka ilk tesliminin sınırını belirle.
- [ ] Step 3 RLS çalışmasıyla çakışan dosya/işleri belirle.

**Kabul:** güncel kanıtla hazırlanmış başlangıç kaydı; eski migration tekrar uygulanmaz;
karar verilmemiş davranış uygulanmış gibi gösterilmez. P00 kod/SQL değişikliği gerektirmez.

### P01 — Davranış sözleşmesi ve teknik plan

- [ ] WORKFLOW_RULES: günlük ihtiyaç, çalışma takvimi, atama/kaldırma/iptal/değişiklik,
  talep sorumlusu, plan/gerçekleşme ayrımı.
- [ ] STATUS_DICTIONARY: yeni/kısmi/atandı ve iptal/bekleme/dönemi geçti anlamları;
  her gün 2/3 atanmış örneği doğru biçimde kısmi sayılır.
- [ ] ROLE_MATRIX: lokasyon/personel/import/atama/çıktı/geçmiş düzeltme aksiyonları;
  kullanıcı rolü ile kaydın firma/tenant kapsamı ayrı.
- [ ] SCREEN_SPEC ve ilgili yapı: Firma Detay lokasyon/talep yüzeyi; ana Talepler
  operasyon kuyruğu; haftalık görünüm. Ortak bileşenleri önce kullan.
- [ ] Teknik plan: kavramsal varlıklar, veri erişim yolları, FK/benzersizlik/bütünlük,
  gerçek çalışma gününe dayalı çakışma, günlük kapasite, atomik yazma ve tekrar deneme.
- [ ] Personel tipi (İDP/sabit) değiştiğinde geçmişin yeniden yorumlanmaması; metinle
  belirtilen "yerine" kişinin çalışan kaydıyla karıştırılmaması.
- [ ] Migration uygulama/geri dönüş, test ortamı ve prod envanter tazeleme adımları.

**Kabul:** güncel SoT ile uyumlu, Codex tarafından incelenmiş tasarım. Nihai SQL bu
belgeden varsayılmaz. Kurallar onaylandığında bağımlı docs + CHANGELOG birlikte güncellenir.

### P02 — Lokasyon rehberi ve toplu veri girişi

**Ekran:** Firma Detay → Lokasyonlar → Toplu ekle / kaynak güncellemesini kontrol et.

- [ ] Firma altında lokasyon: ad, il/ilçe, adres, varsa şube kodu ve kaynak referansı.
  Kodlar metin; baştaki sıfırlar korunur. Banka şubesi ve özel hizmet noktası ayırt edilir.
- [ ] Excel/CSV sütun eşleştirme, tarih/metin doğrulama, önizleme ve satır bazlı hata listesi.
- [ ] Yeni/değişmiş/belirsiz kayıt ayrımı; kesin anahtarla eşleştirme; isim benzerliği
  kesin eşleşme sayılmaz. Aynı dosya tekrarında mükerrer oluşmaz.
- [ ] Hizmet kapsamı ve sözleşme bağı, ülke genelindeki şube rehberinden ayrı tutulur.
- [ ] Banka/TBB için resmî kaynak keşfi: erişim, sayfalama, kayıt alanları, tamamlık,
  kaynak tarihi ve tekrar çalıştırma kanıtı. Kaynağın izinli erişim biçimine uyulur.
- [ ] Kaynak uygunsa bağlayıcı aynı önizleme/uygulama hattını kullanır; doğrudan
  kontrolsüz canlı yazma yapmaz. Erişilemiyorsa engel kaydedilir; Excel yolu çalışır,
  otomatik kaynak işi **tamamlandı** sayılmaz.
- [ ] Kaynaktan kaybolan kayıt silinmez; inceleme için işaretlenir. ATM yanlışlıkla şube olmaz.
- [ ] Sonuç: eklenen, değişen, atlanan/hatalı sayılar; yeniden denemede oluşan etki görünür.

**Kabul:** tekrar import, aynı adlı farklı şube, sıfırlı kod, hatalı satır, eksik kaynak
sayfası ve özel bina senaryoları. Gerçek kaynak toplamı bilinmiyorsa "tüm Türkiye alındı"
denmez. Toplu işlem başarısızlığı sessizce kısmi başarıya çevrilmez; sınırı açıklanır.

### P03 — Günlük talep ve güvenli tek atama

- [ ] Firma/lokasyon, hizmet hattı/pozisyon, adet, dönem/çalışma günleri, sorumlu;
  opsiyonel sözleşme ve yerine bilgisi. Firma Detay'dan açılırken bağlam önseçili.
- [ ] Personel havuzu: ad, ayırt edici kod, aktiflik ve kabul edilen dar tip bilgisi.
  TC/telefon/özlük eklenmez; serbest notlar ilgili veri sınırına göre doğrulanır.
- [ ] Günlük açık = ihtiyaç − etkin atama. Talep yok ile atama yok ayrılır.
- [ ] Aynı personel aynı çalışma gününde ikinci kez atanamaz; iki operatör kapasitenin
  son yerini aynı anda dolduramaz. Kontrol yalnız UI'da kalmaz.
- [ ] Günler gerçek takvim üzerinden hesaplanır; ayrık günlerde örtüşen dönemler kabul edilir.
- [ ] Sözleşmesiz kayıt uyarılıdır; sonradan bağlanırken firma/hizmet hattı doğrulanır.
- [ ] Hata, boş sonuç ve yükleme ayrı gösterilir; backend doğrulanamıyorsa atama durur.

**Kabul:** tek günlük banka talebi 0/1 → 1/1; beş iş günü × üç kişi, her gün iki atama
= 10/15 planlanan kişi-gün; aynı gün çift atama reddi; tenantlar arası olumsuz testler;
boş gün takvimi reddi. Otel davranışı K1 çözülmeden tamamlandı sayılmaz.

### P04 — Toplu işlem, değişiklik ve tarihçe

- [ ] Tarih seçimiyle toplu atama; engelleri gösteren önizleme. Seçilen küme son anda
  yeniden doğrulanır; kullanıcıya söylenmeden bazı günler kaydedilmez.
- [ ] Tek gün değiştir / bu tarihten itibaren değiştir / atamayı kaldır ayrımı.
- [ ] Müşteri ihtiyacını iptal etme ile personeli kaldırma ayrı; geçmiş korunur.
- [ ] Talep adedi/takvimi değişince etkilenen atamalar gösterilir; rastgele personel çıkarılmaz.
- [ ] Aktör, tarih, etkilenen gün ve gerekçe; atama yazısıyla geçmiş kaydı tutarlı.
- [ ] Çift tıklama/yanıt kaybı tekrar denemesinde mükerrer atama oluşmaz.
- [ ] Gelecek atamalı personeli pasife alma, K7'de kararlaştırılan şekilde çözülür.

**Kabul:** Ali haftalık atanmışken yalnız çarşamba Ayşe olur; diğer günler değişmez;
başarısız yeniden atama eski geçerli planı kaybettirmez; geçmişi silme yerine iz bırakılır.

### P05 — Haftalık plan, müşteri çıktısı ve pilot

- [ ] Ana listede firma, il/şube, gün, hizmet hattı, açık ihtiyaç ve sorumlu filtreleri.
- [ ] Lokasyon × gün görünümü; personel görünümü gerçekten faydalıysa aynı veri üzerinde.
- [ ] Firma/hafta başlıklı çıktı, üretim zamanı; günler ve isimler açık. K3'e uygun dış
  görünüm; iç not, diğer firma bilgisi ve gereksiz personel alanları dışarı çıkmaz.
- [ ] Önizle/kopyala; otomatik mesaj yok. Kopyalandı gönderildi veya teyit edildi sayılmaz.
- [ ] İç görünüm ve günlük ihtiyaç eksik atamaları korur; sadece atama tablosundan liste kurulmaz.
- [ ] Dar ekranda gün listesi; boş durum, hata, klavye ve okunabilir çıktı kontrolü.
- [ ] Operasyonla bir gerçek haftayı dene; anonim/izinli test verisiyle prova yapılabilir.

**Kabul:** müşteri listesi Excel'de yeniden kurulmadan kullanılabilir; gün/personel
değişimi doğru çıkar; operasyon 30 saniyelik talep giriş hedefi ölçülür (garanti değil);
pilot geri bildirimi ve takip eden kullanım kaydedilir.

### P06 — Eski modülden geçiş ve temizlik

- [ ] Kesim öncesi `staffing_demands` gerçek kayıt sayısı ve yeni kullanım tekrar ölçülür.
- [ ] Eski test kaydının temizliği, oluşmuş gerçek kayıt varsa taşıma yaklaşımı belgelenir.
- [ ] Dashboard, Raporlar, Firma Detay, Finansal Özet ve diğer eski reader/writer bağımlılıkları
  tam listelenir; yeni modele geçişte metrik anlamları korunur veya açıkça güncellenir.
- [ ] Yeni model doğrulanmadan eski veri yolu düşürülmez; kesim sırasında tek yazma kaynağı belirlenir.
- [ ] Eski servis/ekran/policy/tablo kaldırma yalnız bağımlılık ve geri dönüş kontrolünden sonra.

**Kabul:** eski tabloyu kullanan unutulmuş runtime yol yok; ekranlar aynı günlük ihtiyacı
anlatıyor; test kayıtları müşteri sinyali üretmiyor; geri dönüş yaklaşımı gözden geçirildi.

## 7. Mevcut modülleri derinleştirme

### P07 — Görev, randevu, sahiplik ve devir

2026-09-09 yerel ilerleme: görev atama/revision/history, firma-talep bağlamı,
atomik randevu/takip, önizlemeli toplu devir ve rol/üyelik aktif iş kapısı tamamlandı.
Kanıt TOPLU_GOREV_DEVIR_DILIMI.md + KULLANICI_AYRILIS_KAPISI_DILIMI.md; paket14/14.
Aşağıdaki geniş sözleşme sahipliği P08'e taşınır; tam kullanıcı kapatma P10'dur.

- [ ] Mevcut kullanıcıya görev atamasını koru; talep/sözleşme takip sahipliğine kontrollü genişlet.
- [x] Atanmamış işlere sahiplenme ve kişi değişiminde devir; geçmişi kaydet (yerel).
- [ ] Firma/şube bağlamından görev/randevu açma; tekrar firma seçtirmeme.
- [x] Randevu sonucu ve sonraki iş zinciri mevcut davranış üzerinden doğrulanır (yerel).

**Kabul:** devir sonrası eski kişide sahipsiz kalan aktif iş oluşmaz; görüşmenin kapanması
takip görevini kendiliğinden kapatmaz; erişim genişlemesi olmaz. Yeni genel görev motoru yok.

### P08 — Sözleşme ve evrak takibi

2026-09-09 dördüncü yerel teslim02000: ana PDF/çoklu ek protokol ve bağımsız geçmiş,
eski komut uyumluluğu, firma evrak başlık/bağlantısı.121unit,32native,15API,
full18/18. SOZLESME_EK_PROTOKOL_DILIMI.md kanıtları; EVRAK_TAKIP_SAHIPLIGI_DILIMI.md
sonraki plan. Aşağıdaki önceki “ek protokol açık” notları tarihsel kaldı.

2026-09-09 üçüncü yerel teslim01900: upload intent/receipt ve iptal tombstone,
reload sonrası aynı dosyayla devam, server byte/readback kontrolü.115unit,20native,
10Auth/Storage/HTTP; browser ilk PDF/replace/reload/iptal/eski ve güncel görüntüleme
tamam. Son paket 17/17 geçti — `/var/folders/fg/qm_gg6w16299dhr_lz9xr38r0000gn/T/bps-acceptance-XC4PZO/report.md`.
Sıradaki SOZLESME_EK_PROTOKOL_DILIMI.md. Aşağıdaki01800 açık intent/file chooser
notları bu teslimle kapandı; ek protokol ve diğer geniş P08 işleri hâlâ açık.

2026-09-09 ikinci yerel teslim01800: PDF sürüm referansları, CAS replacement ve
eski PDF signed download/Storage silme koruması.105unit,18native,10StorageAPI,
full16/16. Upload intent/receipt ve ek protokol ayrımı henüz tamamlanmadı.
SOZLESME_PDF_YUKLEME_DEVAMLILIGI_DILIMI.md sıradaki; eski plan maddelerinin tamamı
bu teslimle kapanmaz.


2026-09-09 ilk yerel teslim:01700 gerçek yenileme task/owner/tarih ve kullanıcı
operasyon dayanağı;101unit,18native,7API,full15/15. Hukuki kaynak doğrulaması veya
belge sürümleri tamamlanmış değildir. Sıradaki SOZLESME_BELGE_SURUMLERI_DILIMI.md.


- [ ] Sözleşme aksiyon son tarihi, doğrulanmış kaynak ve gerçek takip sorumlusu.
- [x] Ana PDF ve bağımsız çoklu ek protokol; her belgenin eski sürümü korunur (02000, yalnız yerel).
- [ ] Genel destekleyici firma evrakını sözleşmeye bağlama ihtiyacını ayrıca sınırla.
- [ ] Evrak yenileme işi ve sorumlusu; güncel belge ile öncekinin ilişkisi.
- [ ] Mevcut e-posta hatırlatmalarını kullan; yeni tarihlerin hatırlatma etkisini açık tanımla.

**Kabul:** yenileme işi kişiye bağlanır; yeni belge eskisini izsiz ezmez; kişinin ayrılması
takibi düşürmez. Hukuki süre AI tarafından kesinleştirilmez; e-imza/CLM kapsamı açılmaz.

### P09 — Bildirimler, raporlar ve yönetim görünürlüğü

- [ ] Mevcut dört e-posta türünü ve duyuruları koru; aynı olayı iki sistemden tekrar gönderme.
- [ ] P04/P07/P08 olaylarını firma geçmişine bağla; uygulama içi bildirim ihtiyacını pilotla sınırla.
- [ ] Günlük açık kişi, planlanan kişi-gün ve sorumlusuz yaklaşan iş raporları.
- [ ] Her raporda kaynak, dönem, güncelleme zamanı; plan/gerçekleşme ayrımı.
- [ ] Luca ve Finansal Özet mevcut akışlarını koru; personel planından gerçek kâr türetme.

**Kabul:** liste, Dashboard ve çıktı aynı tanımdan hesaplanır; yetkisiz bildirim/çıktı yok;
gönderim tekrarı ve başarısızlık görünür. Yeni KPI kartı yığını veya muhasebe modülü yok.

## 8. SaaS müşteriye açılış paketleri

### P10 — İlk kurulum ve kullanıcı yaşam döngüsü

- [ ] Mevcut platform admin üzerine müşteri kurulum adımları ve eksik adım görünürlüğü.
- [ ] Kullanıcı daveti, kabul/iptal/yeniden gönderme; yetkili aktör ve tenant sınırı.
- [ ] Kullanıcı ayrılışı: erişim sonlandırma + açık iş devri; P07 ile birlikte.
- [ ] İlk firma/şube aktarımı, ilk kullanıcı ataması ve ilk çıktı için kısa kurulum rehberi.

**Kabul:** yeni müşteri gizli manuel SQL adımları gerektirmeden tanımlı süreçle kurulur;
iptal edilmiş davet çalışmaz; ayrılanın işi ve verisi kaybolmaz. Çok-tenant kullanıcı
üyeliği mevcut tek-üyelik modeline sessizce eklenmez.

### P11 — Modül hakları, veri çıkışı ve işletim

- [ ] Tenant bazlı modül hakkı; rol ve kayıt kapsamından ayrı sunucu kontrolü.
- [ ] Hakkı kapanan modülün mevcut verisini koruma ve yeniden açma davranışı.
- [ ] Müşterinin kendi verisini dışa alacağı kapsam ve süreç; tenantlar arası sızıntı yok.
- [ ] Hassas yönetim olayları için audit; operasyon timeline'ıyla amaç ayrımı.
- [ ] Yedek/geri yükleme, destek erişimi, MFA ve başarısız arka plan işlerini tespit
  etme mevcut altyapıda ölçülür; var/yok varsayılmaz, kalan işletim işleri kaydedilir.
- [ ] Ödeme/paket ticari kararı: manuel satışla başlangıç veya otomatik abonelik.
  Sağlayıcı uygunluğu ayrıca araştırılır; Stripe seçilmiş kabul edilmez.

**Kabul:** modül hakkı açılması rol yetkisini artırmaz; veri çıkışı ve geri yükleme
provası tanımlı kanıta dayanır. Tenant izolasyonu ücretli üst paket özelliği olamaz.

### P12 — Koşullu saha ve gerçekleşme

Yalnız kullanıcı ihtiyacı teyit edilince: hizmet verildi/gelmedi teyidi, ziyaret
bulgusu → mevcut göreve bağlantı, gerekirse dar müşteri görünümü. Her biri ayrı küçük
paket yapılır. Pilot ve yeni rol/veri sınırı kararı olmadan personel app'i veya portal açılmaz.

## 9. Ortak test ve teslim koşulları

- Her kod paketinde hedefli davranış testleri; kuralı tekrar eden düşük değerli testlerden kaçın.
- İlgili paketlerde tarih takvimi, kapasite, çakışma, tekrar deneme ve eşzamanlılık testleri.
- Yazma veya okuma değişiminde yetkili/izinsiz rol ve iki tenant senaryoları; UI gizleme
  tek güvenlik kanıtı değildir. Katalog ölçümü ve kimlikli davranış testi ayrı kaydedilir.
- Mevcut komutlar: `npm run qa:static`, `npm run qa:unit`, `npx tsc --noEmit`,
  `npm run build`. Paket etkisine göre gerekenler çalıştırılır; çalıştırılmayan açık yazılır.
  Mevcut lint komutunun gerçekten yapılandırıldığı ayrıca doğrulanmadan "lint geçti" denmez.
- Migration varsa güncel prod/repo farkı, preflight, tek transaction gereken işler,
  post-check ve geri dönüş planı. Dosya hazır olması uygulanmış olması değildir.
- Kritik tablolar ve çıktılar örnek veriyle görsel/işlevsel kontrol edilir.
- Mevcut finans, sözleşme, görev ve evrak akışlarına yeni modül kaynaklı regresyon kontrolü.
- Her kapanışta CHANGELOG ve ilgili docs güncellenir. Obsidian'da kabul edilip repo'ya
  yansımayan karar var mı sorusu cevaplanır; bu tur Obsidian'a yazılmadı.

## 10. Claude Code'a ilk görev

```text
BPS için 01_product/BPS_OPERASYON_SAAS_IS_PLANI.md dosyasını oku.
Bu tur yalnız P00 başlangıç hazırlığını yap; ürün kodu veya SQL değiştirme.
00_core/CODEX.md ve ilgili güncel source-of-truth belgelerini esas al.
Güncel HEAD/çalışma ağacını, mevcut teslimleri ve bekleyen kimlikli smoke kanıtını kontrol et.
000200/000100/000400'ü bekleyen migration gibi yeniden açma; defterdeki güncel durumu oku.
K1–K8 açık kararlarını çıkar; cevaplanmış olanları kaynaklarıyla kapat, diğerlerini varsayma.
P01 için etkilenecek docs, teknik kararlar ve P02 lokasyon/import sınırını listele.
Sonuç: kapsam, açık kararlar, bağımlılıklar ve Codex review'una uygun kısa handoff.
Push, deploy ve canlı migration uygulama yapma.
```

Paket P01 açıldığında yukarıdaki prompt yalnız P01 kapsamıyla yenilenir. Sonraki paketler
de aynı biçimde tek tek açılır; bu belgeyi tek seferde bitirme talimatı verilmez.

## 11. Dokümantasyon teslim kaydı

- [x] Konuşulan kapsam ve benchmark iş paketlerine çevrildi.
- [x] Mevcut ile yeni işler ayrıldı; bağımlılıklar ve kabul koşulları yazıldı.
- [x] Claude Code uygulama / Codex review döngüsü tanımlandı.
- [x] Açık kararlar ve koşullu gelecek işler işaretlendi.
- [x] P00 başlatıldı; kapanış koşulları henüz tamamlanmadı.
- [ ] İlk kod paketi açıldı.

İş planı yazılmıştır; kod, test, migration, pilot veya satış hazırlığı tamamlandı anlamına gelmez.
