# COMPONENT_SYSTEM.md

## Amaç
Bu dosya, ürün genelinde tekrar edecek component sistemini ve tekrar kullanım mantığını tanımlar.

---

## Ortak Temel Componentler
- `PageHeader`
- `KPIStatCard`
- `FilterBar`
- `SearchInput`
- `StatusBadge`
- `PriorityBadge`
- `RiskBadge`
- `DataTable`
- `EmptyState`
- `ActivityFeed`
- `DetailDrawer`
- `RightSidePanel`
- `TimelineList`
- `NotesComposer`
- `ChecklistCard`
- `QuickActionMenu`
- `ConfirmModal`

---

## Domain-Specific Componentler
- `FirmaSummaryCard`
- `ContractExpiryCard`
- `WorkforceCapacityCard`
- `AppointmentResultCard`
- `MissingDocumentCard`
- `RenewalOpportunityCard`
- `TaskSourceBadge`

---

## Finansal Görünürlük Componentleri

### `FinancialSummaryCard`
- Amaç: şirket geneli finansal görünürlükte tek bir özet metriği sade biçimde göstermek.
- Nerede kullanılır: `Finansal Özet` ekranının üst özet kartlarında.
- Neden shared: aynı kart yapısı açık alacak, bu ay kesilen faturalar, kesilmemiş alacaklar, maaş giderleri, sabit giderler ve net görünüm için tekrar eder.

### `ReceivablesSummaryCard`
- Amaç: alacakların toplam, gecikmiş, firma dağılımı ve riskli firma görünümünü tek blokta özetlemek.
- Nerede kullanılır: `Finansal Özet` ekranındaki Alacaklar Özeti bölümünde.
- Neden shared: alacak görünürlüğü farklı dönem filtrelerinde ve yönetim özetlerinde aynı bilgi yapısıyla tekrar kullanılabilir.

### `InvoiceStatusBadge`
- Amaç: faturalama ve tahsilat görünürlüğünde yüksek seviyeli durumu tutarlı etiketlerle göstermek.
- Nerede kullanılır: `Finansal Özet` tablolarında ve gerektiğinde firma bazlı ticari özet çevresinde.
- Neden shared: aynı ticari durumun farklı yüzeylerde farklı renk veya kelimelerle anlatılmasını engeller.
- Sınır: resmi muhasebe durum makinesi değildir; yalnızca `STATUS_DICTIONARY.md` içinde tanımlanan yüksek seviyeli görünürlük etiketlerini taşır.

### `ExpenseSummaryCard`
- Amaç: maaş gideri, sabit gider ve gerekirse yüksek seviyeli diğer operasyon giderlerini özetlemek.
- Nerede kullanılır: `Finansal Özet` ekranındaki Gider Özeti bölümünde.
- Neden shared: gider görünürlüğü aynı yapıda farklı dönemlerde ve yönetim bloklarında tekrar eder.

### `NetPositionCard`
- Amaç: kısa vadeli net görünüm ve dönemsel baskıyı tek bakışta yönetim için görünür kılmak.
- Nerede kullanılır: `Finansal Özet` ekranının üst özet alanında ve Dönemsel Görünüm bölümünde.
- Neden shared: net görünüm farklı özet alanlarında aynı karar mantığıyla tekrar kullanılabilir.

### `CommercialSummaryCard`
- Amaç: firma bazlı ticari görünürlüğü şirket detay bağlamında özetlemek.
- Nerede kullanılır: `Firma Detay > Genel Bakış` içindeki Ticari Özet kartında.
- Neden shared: firma bazlı açık bakiye, son fatura, kesilmemiş bekleyen tutar ve ticari risk sinyali aynı özet kalıbıyla farklı firma yüzeylerinde tekrar kullanılabilir.
- Varsayılan davranış: görünürlük öncelikli, read-only bir özet yüzeyidir; ilk aşamada inline muhasebe benzeri veri girişi beklenmez.

---

## Tekrar Kullanım Kuralları

### 1. Header standardizasyonu
Liste ve detay ekranlarında mümkün olduğunca ortak header yapısı kullanılmalı.
Header içinde genellikle:
- başlık
- özet bilgi
- aksiyon butonları
olmalı.

### 2. Badge standardizasyonu
Durum, öncelik ve risk için ayrı ayrı ama tutarlı badge sistemleri kullanılmalı.
Aynı anlam farklı ekranlarda farklı renkle veya farklı sözcükle anlatılmamalı.

### 3. Table standardizasyonu
Tüm ana listelerde ortak tablo davranışı kullanılmalı:
- arama
- filtre
- sıralama
- satır tıklama
- aksiyon menüsü
- boş state

### 4. Drawer / side panel standardizasyonu
Yoğun detay ihtiyacı olan ama yeni sayfa açılmadan çözülebilecek bağlamlar drawer ile çözülmeli.
Örnek:
- talep satırı detayları
- randevu detay özeti
- sözleşme hızlı önizleme

### 5. Checklist standardizasyonu
Evrak ve uyum benzeri alanlarda checklist pattern'i ortak olmalı:
- gerekli
- mevcut
- eksik
- süresi yaklaşıyor

### 6. Timeline standardizasyonu
Timeline, firma özelinde ve genel activity feed tarafında benzer mantıkla çalışmalı:
- olay tipi
- tarih
- kullanıcı
- ilgili kayıt
- ilk derinlikte basit, kronolojik, read-only olay listesi yeterlidir
- gelişmiş filtreleme ve zengin timeline davranışları daha sonra derinleşebilir

### 7. Yönetim görünürlüğü standardizasyonu
Finansal görünürlük bileşenleri yüksek seviyede kalmalıdır:
- özet veri göstermeli
- karar görünürlüğü üretmeli
- ERP derinliğine inmemeli
- muhasebe ekranı gibi davranmamalı

---

## Yeni Component Açma Kuralı
Yeni component açmadan önce şu kontrol yapılmalı:
1. Bu görünüm mevcut bir ortak component varyantı ile çözülebilir mi?
2. Yalnızca bu ekrana özel mi, yoksa en az 2-3 yerde tekrar edecek mi?
3. Domain-specific component olarak ayrılması gerçekten okunabilirliği artırıyor mu?

Bu soruların cevabı zayıfsa yeni component açılmamalı.

---

## Anti-Patternler
- aynı işi yapan birden çok badge component
- ekran bazlı özel tablo bileşenleri
- çok erken ayrıştırılmış mikro component patlaması
- ortak davranışların kopya kodla çoğalması
- bilgi mimarisi problemi olan şeyi component problemi sanmak
- finansal özet bahanesiyle ERP widget'ları üretmek
