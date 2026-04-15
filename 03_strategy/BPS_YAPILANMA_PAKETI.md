# BPS — Yapılanma Paketi

> **Tarih:** Nisan 2026 itibarıyla yön belgesi
> **Statü:** Stratejik yön belgesi — execution planı değil, task listesi değil
> **Pozisyon:** Mevcut source-of-truth docs'un üstünde yön belgesi. Onları silmez; yeniden hizalar.

---

## 1. Neden Bu Belge Var?

BPS bugüne kadar güçlü bir operasyon omurgası kurdu:

- Firma-merkezli mimari kuruldu (14 tablo, sözleşme/evrak/görev/randevu/finansal görünürlük)
- Rol/scope/RLS altyapısı kuruldu (6 rol, partner izolasyonu)
- Import/sektör/Luca temeli kuruldu (CSV 3 mod, 8 sektör şablonu, Luca V1 mizan okuma)
- Dashboard ve finansal görünürlük gerçek truth'a bağlandı

Bu yanlış bir yön değildi. Doğru ilk katmandı.

Ama gelinen noktada ana soru artık "hangi mock kaldı?" değil. Ana kırılım şudur:

**BPS omurga kurdu. Şimdi çalışma sistemi kurmalıdır.**

BPS bugün ağırlıklı olarak bir **görme sistemi** — veriyi gösteriyor ama kullanıcıyı geri çağırmıyor, dışarı çıktı vermiyor, ekonomik karar desteği sunmuyor, sahada çalışmıyor.

Bu belge, BPS'i eski haliyle inkâr etmek için değil, mevcut temeli daha doğru bir ikinci evreye taşımak için yazılmıştır. Bu bir "v2" etiketi değildir. Bu bir yapılanma paketidir.

---

## 2. Güncellenmiş Ürün Tanımı

### BPS Nedir?

BPS, **firma-merkezli veri omurgasına** sahip, **kişi-merkezli günlük deneyim** sunan bir service operations platformudur.

BPS:

- Firma portföyünü tek yerde toplar
- Firma bazlı operasyonel gerçekliği görünür kılar
- Kritik şeylerin kaçmasını azaltır
- Rol, scope ve sorumluluk alanına göre kullanıcıyı aksiyona yönlendirir
- Zamanla firma bazlı ekonomik görünürlük üretir

### Çekirdek Prensip

**Firma-merkezli veri + kişi-merkezli deneyim.**

Veri neden firma-merkezli kalır? Çünkü işin doğal bağlamı firmadır — sözleşme, evrak, alacak, talep, risk hep firmaya aittir. Veri modelini kişi-merkezli yaparsan ürün todo uygulamasına kayar.

Deneyim neden kişi-merkezli başlar? Çünkü sabah sisteme giren insan firma değil. Batuhan "bugün ne yapmalıyım?" sorusuyla girer. Muhasebe "neyi onaylamalıyım?" sorusuyla girer. Yönetici "portföy nereye kırılıyor?" sorusuyla girer.

Record system firma-merkezli kalır. Home experience kişi-merkezli olur.

---

## 3. BPS Ne Değildir — ve Ne Olabilir?

### Değişmeyen Sınırlar

BPS şunlar değildir ve olmayacaktır:

- Generic CRM (satış pipeline'ı, lead scoring, marketing automation)
- Generic HRIS (bordro, izin yönetimi, personel özlük)
- Generic ERP (stok, üretim, tedarik zinciri)
- Muhasebe yazılımı (fatura kesme, KDV hesaplama, e-defter)
- Chat/messaging uygulaması (thread, reply, real-time chat)
- Proje-merkezli PSA kopyası (BPS firma-merkezlidir, proje-merkezli değil)

### Güncellenen Yorumlar

Aşağıdaki alanlar eskiye göre daha geniş yorumlanır. Bu guardrail gevşemesi değil, ürünün doğal olgunlaşma yönüdür:

| Eski Yorum | Yeni Yorum | Neden |
|------------|-----------|-------|
| "Finansal Özet yalnızca tek özet rakam gösterir" | Firma bazlı ekonomik görünürlük (gelir, maliyet, kârlılık) doğal genişleme alanıdır | PSA benchmark'ında firma/müşteri bazlı kârlılık temel beklenti. Bu muhasebe yapmak değil, muhasebeden gelen veriyi firma bağlamında anlamlandırmak. |
| "Zaman takibi BPS kapsamı dışı" | Firma bazlı time tracking çekirdek genişlemedir | Hizmet şirketlerinde zaman = envanter. "Bu firmaya kaç adam-saat harcadık?" sorusu operasyonel, İK değil. |
| "Pipeline / CRM yapılmaz" | Aday firma → teklif → karar → aktif firma dönüşüm akışı doğal uzantıdır | BPS'te `aday` firma statüsü zaten var. Satış öncesi sürecin dar hali (pipeline ≠ CRM). |
| "BPS yalnızca iç operasyon görünürlüğü" | BPS bildirim, çıktı, geri çağırma ve ekonomik karar desteği katmanlarını kapsayacak | Kullanıcıyı geri getirmeyen ürün operasyon sistemi olamaz. |
| "Puantaj core'a girmez" | Firma bazlı zaman kaydı operasyonel çekirdektir; kişi bazlı İK puantajı hâlâ kapsam dışı | Ayrım: "bu firmaya harcanan zaman" (BPS) vs "bu çalışanın mesai saati" (İK). |

### Keskin Sınırlar (Yeni)

Bu sınırlar yeni genişleme alanlarının kontrolsüz büyümesini önlemek içindir:

- **Pipeline sınırı:** BPS satış organizasyonunu yönetmez; firma aktivasyonuna giden dar ticari akışı destekler. Pipeline, satış ekibi verim optimizasyonu için değil; firmayı operasyon omurgasına kontrollü şekilde aktifleştirmek için vardır. Deals, stages, probabilities, funnel reports gibi CRM derinliği kapsam dışıdır.
- **Time tracking sınırı:** BPS'in time tracking'i çalışan puantajı değil, firma bazlı operasyonel emek kaydıdır. Mesai hesaplama, fazla mesai, vardiya yönetimi İK alanıdır ve BPS kapsamı dışındadır.
- **Finansal sınır:** Firma bazlı kârlılık görünürlüğü operasyonel zekâdır. Fatura kesme, KDV hesaplama, e-defter, banka mutabakatı muhasebe alanıdır ve BPS kapsamı dışındadır.

---

## 4. Bugüne Kadar Doğru Yapılan Şey

### Güçlü Çekirdek

- Firma-merkezli mimari (14 tablo, firma = merkez entity)
- Sözleşme yaşam döngüsü yönetimi
- Evrak compliance checklist sistemi
- Randevu sonuç + sonraki aksiyon zorunluluğu
- Görev atama + öncelik + sahiplik
- 6 rol + scope-aware RLS + partner izolasyonu
- 8 sektör şablonu
- CSV import 3 mod
- Luca V1 mizan okuma → financial_summaries
- Finansal Özet reader + writer parity
- Dashboard KPI'lar + sinyal kartları real truth
- Landing page + demo talep formu + abuse protection

### Neden Değerli?

Rakip PSA araçlarının çoğu proje-merkezlidir. BPS'in firma-merkezli yaklaşımı farklı bir kategorik açıdan kurulmuş bir ürün yaratıyor. Bu gerçek bir moat potansiyeli.

**Özet:** Doğru ilk katman yapıldı. Yanlış yön değil, eksik yön.

---

## 5. Asıl Eksik Olan Yarı

BPS bugün ağırlıklı olarak bir görme sistemidir. Henüz tam bir çalışma sistemi değildir. Eksik olan yarı 4 başlıkta toplanır:

### A. Geçiş ve Güven

Kullanıcı neden Excel'den BPS'e geçsin?

- Import temeli var ama onboarding akışı eksik
- Duplicate kontrolü ve toplu güncelleme zayıf
- Export / PDF çıktısı yok
- Güven kıran mock/preserved yüzeyler hâlâ var

### B. Geri Çağırma ve Çıktı

Kullanıcı neden geri gelsin?

- Bildirim sıfır
- Digest yok
- Sistem kullanıcıya gitmiyor
- Yönetim raporu çıktısı yok

### C. Ekonomik Görünürlük

Bu firma bize ne kazandırıyor?

- Time tracking yok
- Firma bazlı kârlılık yok
- Utilization yok
- Kapasite planlama yok

### D. Saha ve Büyüme

Sistem masaüstü görünürlüğün ötesine nasıl geçecek?

- Mobil yok
- Pipeline zayıf
- API / webhook yok
- Takvim senkronizasyonu yok

---

## 6. Yeni Yol Haritası İskeleti

Her katman bir amacı temsil eder. Spesifik execution sırası ve batch planlaması bu belgede değil, `TASK_ROADMAP.md`'de tanımlanır.

### Katman 1 — Geçiş ve Güven (Şimdi – 30 gün)

**Amaç:** Excel'den geçişi mümkün ve güvenli yapmak.

- Güven kıran mock/preserved yüzeylerin temizlenmesi veya dürüstleştirilmesi
- Ofis içi pilotun başlatılması — gerçek ekip, gerçek operasyon
- Çıktı üretme kapasitesinin açılması (PDF / Excel export)
- İlk bileşik karar sinyali (mevcut verilerden türetilmiş firma sağlık göstergesi — kapsam ve formül pilot sinyallerine göre netleştirilir)

**Başarı ölçütü:** Ekip BPS'i günlük açıyor, sahte hiçbir şey görmüyor, yönetim toplantısında BPS'ten çıktı alınabiliyor.

### Katman 2 — Geri Çağırma ve Çıktı (30 – 90 gün)

**Amaç:** Sistem kullanıcıya gelsin, kullanıcı sisteme bağımlı olsun.

Bu katman iki farklı değer üretir:
- **Geri çağırma (kullanım ritmi):** Bildirim, digest, hatırlatma — kullanıcının sisteme dönmesini sağlar
- **Çıktı (organizasyonel yayılım):** PDF rapor, Excel export — BPS'in değerini sistemi açmayan paydaşlara da taşır

İçerik:
- Email bildirim motoru (sözleşme bitiş, evrak süre dolum, görev gecikme)
- In-app bildirim merkezi
- Haftalık digest
- Yönetim rapor PDF'leri
- Export ve paylaşım yüzeyleri

**Başarı ölçütü:** Kullanıcı uygulamayı açmasa bile kritik olaydan haberdar. "Kaçırdık" duygusu azalıyor.

### Katman 3 — Ekonomik Görünürlük (3 – 9 ay)

**Amaç:** Görünürlükten karar desteğine geçmek.

- Firma bazlı time tracking ("bu firmaya bu hafta kaç saat?")
- Firma bazlı kârlılık (sözleşme geliri vs gerçek operasyon maliyeti)
- Utilization (kim dolu, kim müsait)
- Kaynak / kapasite planlama

**Not:** Bu katmanın discovery'si ofis içi pilot sinyallerine dayanmalı. Spekülatif PSA taklidi yerine gerçek kullanım ihtiyacından türetilmeli.

**Başarı ölçütü:** "Bu firma kârlı mı?" sorusu cevaplanıyor. Operasyon yöneticisi kaynak kararı alabiliyor.

### Katman 4 — Saha ve Büyüme (9 – 15 ay)

**Amaç:** Operasyonun sahaya ve büyümeye açılması.

- Pipeline (aday → teklif → karar → aktif firma — CRM derinliğine girmeden)
- Mobil / PWA
- Google Calendar senkronizasyonu
- API / webhook

**Başarı ölçütü:** Sahadaki kullanıcı BPS'i gerçekten kullanıyor. Satıştan operasyona veri akışı var.

### Katman 5 — Predictive / Platform (15+ ay)

**Amaç:** Bugünü göstermekten yarını öngörmeye geçmek.

- Gelişmiş firma sağlık skoru (predictive)
- Sözleşme yenileme / churn tahmini
- Automation rules 2.0
- AI natural language insight
- Tenantization / multi-tenant ölçek

**Başarı ölçütü:** Sistem sadece bugünü göstermiyor, yarını tahmin ediyor.

---

## 7. Preserved Surfaces Felsefesi

BPS'te bazı yüzeyler bugün gerçek veri modeline sahip değil ama ürünün gelecek katmanlarında yeri var (timeline, yönlendirmeler, duyurular, inisiyatifler, activity feed, bahsetmeler). Bu yüzeyler için üç ilke geçerlidir:

### İlke 1: Güven kıran mock kalmamalı

Ekibin gerçek sanıp karar verebileceği, yanlış kesinlik üreten mock yüzeyler en yüksek öncelikle temizlenir. Bu ürün güveninin ön koşuludur.

### İlke 2: Tablosuz yüzeyler honest absence gösterir

Henüz gerçek veri modeli olmayan ama ürün içinde yeri olan yüzeyler mock verisi yerine dürüst boş durum gösterir. "Yakında" gibi pazarlama dili kullanılmaz. Dürüst alternatifler: "Bu alan henüz aktif değil", "Kayıt bulunmuyor", "Bu modülün veri akışı henüz bağlı değil."

### İlke 3: Kozmetik kalan temizlik ertelenebilir

Karar kalitesini etkilemeyen küçük teknik borçlar, fixture kalıntıları, kozmetik parity farkları pilot sonrasına bırakılabilir.

**Ana ilke:** Sıfır mock kutsal değil. Sıfır güven-kırıcı mock zorunlu.

Spesifik hangi yüzeylerin hangi kategoriye girdiği bu belgede değil, aktif execution planında (`TASK_ROADMAP.md` veya session handoff notlarında) takip edilir.

---

## 8. "Benim Günüm" Tasarım Prensibi

BPS'in bir sonraki önemli UX sıçraması "kişiselleştirilmiş widget dashboard" değil, **rol/scope/assignment-aware home layer** olmalıdır.

### Yanlış Yol

- Rol başına ayrı mini ürünler
- Farklı navigation evrenleri
- Erken widget builder karmaşası
- Firma bağlamından kopuk todo deneyimi

### Doğru Yol

Tek ürün, tek veri modeli, tek firma-merkezli omurga — kullanıcıya göre önceliklenen giriş deneyimi.

### Üç Filtreleme Ekseni

- **Role:** Kullanıcı ne tür iş görür (yönetici, operasyon, muhasebe…)
- **Scope:** Kullanıcı hangi firmaları görebilir (partner portföyü, tüm firmalar…)
- **Assignment:** Bugün hangi iş doğrudan o kullanıcıya atanmış (görevler, randevular, onaylar)

Bu üçlü ayrım "Benim Günüm" deneyiminin temelini oluşturur. Role ne göreceğini belirler, scope hangi firmaları göreceğini belirler, assignment bugün ne yapacağını belirler.

### İki Katmanlı Yapı

**Üst katman: Bugün ne yapmalıyım?**

- Benim görevlerim (bana atanmış, bugün/bu hafta)
- Benim randevularım
- Bana atanmış kritik işler
- Bugün aksiyon gerektiren öğeler

**Alt katman: Benim alanım ne durumda?**

- Benim firmalarım (partner: portföy, operasyon: atanmış firmalar)
- Portföyümde riskli firmalar
- Açık talepler, eksik evraklar, yaklaşan sözleşmeler
- Finansal baskı sinyalleri

### Rol Bazlı Varyasyonlar

| Rol | Üst Katman Önceliği | Alt Katman Önceliği |
|-----|---------------------|---------------------|
| Yönetici | Bekleyen onaylar, kritik sinyaller | Tüm portföy özeti, risk haritası |
| Partner | Benim görevlerim, benim randevularım | Benim firmalarım, firmalarımdaki riskler |
| Operasyon | Bugünün görevleri, bugünün randevuları | Açık talepler, eksik evraklar |
| Muhasebe | Onay bekleyen finansal veriler | Gecikmiş alacaklar, son yüklemeler |
| İK | Eksik/süresi dolan evraklar | Evrak tamamlama oranı |
| Görüntüleyici | — | Read-only portföy özeti |

Bu yapıyla BPS ne sadece portföy panosu olur, ne de todo list. İkisinin doğru birleşimi.

---

## 9. Kategori Gücü — BPS'in Moat'u Nerede Oluşacak?

BPS'in asıl farklılaşması üç şeyin birleşiminde oluşur:

**1. Firma-merkezli operasyon hafızası**
Firma etrafında yaşayan sözleşme, evrak, görüşme, görev, finansal ve risk bağlamı. CRM gibi satış-merkezli değil, proje yönetimi gibi deliverable-merkezli değil — firma operasyonu merkezli.

**2. Geri çağırma sistemi**
Kullanıcının kontrol etmesini beklemeyen, kritik şeyi ona taşıyan sistem.

**3. Firma bazlı ekonomik görünürlük**
Rakip PSA'lar "bu projeye kaç saat" sorar. BPS "bu firmaya bu hafta kaç saat, bu firma kârlı mı?" sorar. Firma-merkezli ekonomik lens, BPS'in kategorik farkıdır.

---

## 10. Mevcut Docs ile İlişki

Bu belge mevcut source-of-truth docs'u silmez.

**Yön ilkesi:** Bu belge stratejik yönü belirler. Alt source-of-truth dokümanlar bu belgeyle çelişiyorsa, güncellenmesi gereken taraf alt dokümandır. Ancak güncelleme yapılana kadar execution anında mevcut source-of-truth geçerlidir.

| Belge | Rolü | Bu belgeyle ilişki |
|-------|------|-------------------|
| `CODEX.md` | Execution / review disiplini, okuma sırası | Korunur, gerekirse okuma sırası güncellenir |
| `WORKFLOW_RULES.md` | Operasyonel ürün sınırları | Korunur. Yeni domain'ler eklendiğinde genişler |
| `ROLE_MATRIX.md` | Rol / scope gerçeği | Korunur. Yeni roller eklenmedikçe değişmez |
| `STATUS_DICTIONARY.md` | Yaşam döngüsü doğruluğu | Korunur. Yeni entity'ler eklendiğinde genişler |
| `TASK_ROADMAP.md` | Aktif teslim sırası | Güncellenir — bu belgedeki katman yapısıyla hizalanır |
| `CLAUDE.md` | Agent steering primer | Güncellenir — yeni ürün tanımı ve prensiplerle hizalanır |
| `README.md` | Proje giriş noktası | Güncellenir — yeni ürün tanımıyla hizalanır |

**Operating model** (Claude Code multi-session, agent rolleri, worktree discipline, spec-driven development) bu belgenin kapsamı dışındadır. `CLAUDE.md` ve ilgili runbook'larda tanımlanır.

---

## 11. Sonuç

BPS'in bugüne kadar yaptığı şey yanlış değildir; eksiktir. Eksik olan şey küçük UI parçaları değil, ürünün ikinci yarısıdır.

**BPS = firma-merkezli veri omurgası + kişi-merkezli günlük deneyim + bildirim/çıktı katmanı + firma bazlı ekonomik görünürlük.**

Bu formül, BPS'i "iç operasyon görünürlüğü aracı"ndan "firma-merkezli service operations platform"a taşıyan yön belgesidir.

---

*Bu belge doğrudan execution planı değildir. Yeni roadmap'in stratejik hammaddesidir. Execution sırası ve batch planlaması `TASK_ROADMAP.md`'de tanımlanır.*
