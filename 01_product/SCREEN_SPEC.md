# SCREEN_SPEC.md

2026-09-09 — 02400: `/kayit` davet kontrollü Auth signup, `/auth/callback` PKCE dönüşü; güvenli başlangıç profili/eksik profil onarımı. Metadata'dan rol/admin/unit kabulü kaldırıldı. Yerel18SQL,AuthAPI,type/build geçti. Mail doğrulaması açık prod ayarıyla uçtan uca kabul henüz yok; gerçek posta gönderilmedi.

2026-09-09 — 02300: Kurulumda mevcut hesaplara davet kodu (7 gün), listeleme/iptal; `/davet` doğrulanmış alıcı hesabıyla kabul. Tek üyelik, rol kontrolü, hash saklama, iptal/kabul yarışı ve refresh oturumu iptali. Otomatik e-posta/yeni hesap açma yok. Önceki Dashboard/kurulum tenant claim alanı varsayımı kaldırıldı, verified RPC kullanılır. Yerel13SQL/AuthAPI/127unit/typebuild geçti.

2026-09-09 — 02200: `/kurulum` yöneticinin firma/şube/ekip/personel/ilk plan/haftalık çıktı adımlarını gerçek sayaçlarla bir araya getirir. Dashboard ve Ayarlar bağlantısı. Tamamlandı yüzdesi yok; read-only verified tenant RPC. Yerel 10SQL + Auth/API + type/build geçti. Sıradaki kullanıcı davetleri.


2026-09-09 — Dashboard: manuel risk kartı ve günlük otel e-postası kaldırıldı. Son aktiviteler, tenant/rol doğrulayan 02100 RPC ile son 20 gerçek operasyon/görev atama/PDF olayını gösterir; yenileme, yükleme, hata ve boş durumları ayrı. Yönetici/operasyon kapsamı; baseline hariç, tam audit/realtime değil. Ayrıntı: `01_product/DASHBOARD_VE_SAAS_SIRASI.md`. Yalnız yerel geliştirme.

## Dashboard — Bileşen Listesi
- PageHeader
- DateRangePicker
- GlobalSearch
- KPIStatCard x6 (role-filtered)
- TodayTasksCard (hidden for muhasebe)
- ContractExpiryCard (hidden for ik + muhasebe)
- OpenDemandCard (hidden for ik + muhasebe)
- MissingDocumentCard (hidden for muhasebe)
- RiskyCompaniesCard
- KritikTarihlerCard (all roles, only when approaching/overdue items exist)
- HotelEmailDraftHelper (yönetici + operasyon only)
- YöneticiInisiyatifleriSection (yönetici only)
- DuyurularSection
- ActivityFeed (hidden for muhasebe)

---

## Firmalar Liste — Bileşen Listesi
- PageHeader
- SearchInput
- FilterBar
- SavedFilterChips
- DataTable
- RowActionMenu (Detaya Git)

---

## Firma Detay — Header
- FirmaSummaryHeader
- RiskBadge
- StatusBadge
- QuickActionButtons
- TabNavigation

### Genel Bakış
- ActiveContractsCard
- OpenRequestsCard
- WorkforceSummaryCard
- UpcomingAppointmentsCard
- MissingDocumentsCard
- CommercialSummaryCard
- LatestNotesCard
- RiskSignalsCard

#### Ticari Özet Kartı
- Açık Bakiye
- Son Fatura Tarihi
- Son Fatura Tutarı
- Kesilmemiş Bekleyen
- Ticari Risk Etiketi

#### Ticari Özet Kartı Davranışı
- varsayılan kullanım read-only görünürlüktür
- şirket geneli finans ekranı değildir; firma bağlamına bağlıdır
- kritik ticari sinyal varsa mevcut görev akışına takip aksiyonu bağlanabilir
- bu aksiyon muhasebe işlemi değil, ayrı görev / workflow aksiyonudur

### Yetkililer
- ContactsTable
- AddContactModal

#### İlk Derinlik ve Davranış
- minimum alanlar: ad soyad, rol / unvan, en az bir iletişim kanalı
- ilk sürümde firma bağlamlı kontak listesi yeterlidir; generic CRM rehberi beklenmez
- partner rolü ana bakım sahibidir; operasyon yalnızca operasyonel koordinasyon gereken temel alanlarda sınırlı müdahale eder
- yetkili ekleme ve anlamlı değişiklikler zaman çizgisine düşebilir
- yetkililer randevu ve görev bağlamında seçilebilir

### Sözleşmeler
- ContractsTable
- FilterChips
- AddContractButton

### Talepler
- RequestsTable
- RequestSummaryCards
- AddRequestButton

### Aktif İş Gücü
- WorkforceSummaryCard
- PositionDistributionCard
- HireExitSummaryCard
- CapacityRiskCard
- WorkforceTable

### Randevular
- AppointmentsTable
- StatusFilters
- AddAppointmentButton
- AppointmentDetailDrawer

### Evraklar
- DocumentsChecklistCard
- DocumentsTable
- UploadDocumentButton

### Notlar
- NotesComposer
- TagFilter
- PinnedNotesSection
- NotesFeed

#### İlk Derinlik ve Davranış
- notlar formal internal memory alanıdır
- not, görev yerine geçmez
- aksiyon gerekiyorsa görev açılmalıdır
- durum değişikliği gerekiyorsa ilgili kayıt ayrıca güncellenmelidir
- kullanıcı kendi notunu düzenleyebilir; başkasının notuna geniş müdahale beklenmez
- önemli veya sabitlenmiş notlar zaman çizgisine yansıyabilir

### Zaman Çizgisi
- TimelineList
- EventTypeFilter

#### İlk Derinlik ve Davranış
- ilk beklenti firma detay içinde basit, kronolojik, read-only olay listesidir
- temel olay tipi filtresi yeterlidir
- derin timeline analizi ve geniş filtreleme ilk aşamada gerekli değildir

---

## Sözleşmeler Liste — Bileşen Listesi
- PageHeader
- FilterBar
- SummaryChips
- DataTable
- RightPreviewPanel
- RenewalTaskModal

---

## Sözleşme Detay — Bileşen Listesi
- ContractSummaryHeader
- ActionButtons
- FileVersionsList
- CriticalClausesEditor
- RenewalTrackingCard
- LinkedTasksList
- LinkedAppointmentsList
- InternalNotesSection

---

## Personel Talepleri — Bileşen Listesi
- PageHeader
- FilterBar
- SummaryCards
- DataTable
- RequestDetailDrawer
- NewRequestModal
- AssignOwnerModal

---

## Aktif İş Gücü — Bileşen Listesi
- KPIStatCards
- FilterBar
- DataTable
- ExpandableRowDetails

---

## Randevular — Bileşen Listesi
- ViewSwitch
- PageHeader
- FilterBar
- DataTable
- AppointmentDetailPanel
- NewAppointmentModal
- AppointmentResultModal
- CreateTaskModal

---

## Görevler — Bileşen Listesi
- PageHeader
- FilterBar
- SummaryCards
- DataTable
- QuickActionMenu
- NewTaskModal

---

## Evraklar — Bileşen Listesi
- PageHeader
- FilterBar
- ChecklistSummaryCards
- DataTable
- FirmDocumentChecklistPanel
- UploadDocumentModal
- UpdateValidityModal

---

## Finansal Özet — Bileşen Listesi
### Sayfa Amacı
- yönetime ileriye dönük finansal görünürlük katmanı vermek
- alacaklar, faturalanan tutarlar, kesilmemiş tutarlar, maaş giderleri, sabit giderler ve kısa vadeli net görünümü bir araya getirmek
- muhasebe yazılımının yerini almamak
- aynı iç ofis ürününde yönetim görünürlüğü sağlamak

### Sahiplik ve aksiyon sınırı
- Finansal Özet şirket geneli yönetim görünürlüğüdür
- yönetici rolü yönetim sahibidir
- muhasebe rolü sınırlı kapsamlı özet-bakım aktörü olarak erişir: yükleme, inceleme, onay
- bu bakım resmi muhasebe kaydı değildir; yönetim görünürlüğü amaçlı özet veri bakımıdır
- muhasebe'nin ana çalışma yüzeyi Finansal Özet sayfasıdır; Dashboard ikincil/dar giriş noktasıdır
- muhasebe'nin Firma Detay kullanımı bağlamsal/referans amaçlıdır; geniş operasyonel çalışma yüzeyi değildir
- kritik finansal sinyaller görev veya takip aksiyonu önerebilir; bu aksiyon muhasebe işlemi değil ayrı workflow aksiyonudur
- bu ekran muhasebe yazılımına, fatura operasyonuna, tahsilat iş akışına veya ERP derinliğine dönüşmemelidir

### Temel Bileşenler
- PageHeader
- DateRangePicker
- FilterBar
- FinancialSummaryCard x6
- ReceivablesSummaryCard
- ExpenseSummaryCard
- NetPositionCard
- DataTable
- InvoiceStatusBadge

### Üst Özet Kartları
- Toplam Açık Alacak
- Bu Ay Kesilen Faturalar
- Kesilmemiş Alacaklar
- Maaş Giderleri
- Sabit Giderler
- Net Görünüm

### Orta Bölümler
1. Alacaklar Özeti
- total receivables
- overdue receivables
- company distribution
- risky companies

2. Faturalama Özeti
- invoiced this month
- change vs prior period
- uninvoiced pending amounts

3. Gider Özeti
- salary expenses
- fixed expenses
- other operating expenses if kept high-level only

### Alt Bölüm
- Dönemsel Görünüm
  - period-based income/expense summary
  - short-term pressure/outlook
  - simple management visibility only

### Bu ekran şunları içermez
- tax workflows
- accounting journal logic
- e-invoice operations
- payroll calculation workflows
- bank reconciliation

---

## Raporlar — Bileşen Listesi
- ReportSwitcher
- DateRangePicker
- TableArea
- ExportActions

### İlk Derinlik
- sabit read-only rapor tabloları
- temel tarih ve filtre desteği
- export aksiyonları
- ilk aşamada serbest rapor tasarımı veya derin drilldown beklenmez

---

## Ayarlar — Bileşen Listesi
- Tabs
- DataTable
- AddEditModal
- StatusToggle

### İlk Derinlik
- sıkı sınırlandırılmış yönetici konfigürasyonu
- kontrollü sözlük / liste yönetimi ve durum toggle'ları
- ilk aşamada dinamik workflow builder yok
- ilk aşamada detaylı permission editor yok
- ilk aşamada finans / muhasebe konfigürasyon motoru yok

---

## Kurumsal Kritik Tarihler — Bileşen Listesi
### Sayfa Amacı
- şirket geneli kritik belge ve son tarihlerini erken görünür kılmak
- yaklaşan ve gecikmiş son tarihleri öne çıkarmak
- belge yönetimi yazılımı değil, son tarih görünürlüğü yüzeyi
- firma bazlı Evraklar modülünden ayrı; şirket geneli kurumsal kayıtlar

### Sahiplik ve erişim
- tüm iç roller görüntüleyebilir
- yalnızca yönetici oluşturma / düzenleme / yönetme yapabilir
- Dashboard bağlantılı bağımsız sayfa (sidebar öğesi yok)

### Temel Bileşenler
- PageHeader (Yeni Kayıt action: yönetici only)
- KritikTarihlerList (sıralı: gecikmiş → yaklaşan → aktif, sonra önceliğe göre)
- StatusBadge (Süresi Doldu / Yaklaşıyor / Aktif)
- PriorityBadge (Kritik / Yüksek / Normal)
- CreateEditModal (başlık, tür, son tarih, öncelik, sorumlu, kısa not)

### Bu ekran şunları içermez
- dosya yükleme / belge deposu
- onay zincirleri
- ihale iş akışı motoru
- bildirim / hatırlatma otomasyonu
- takvim entegrasyonu
- uyum yazılımı derinliği

## Günlük operasyon pilotu — `/talepler/gunluk`

2026-09-09: lokal kod; migration uygulanmadı, sunucu bayrağı varsayılan kapalı.
Firma Detay bağlantısı firma UUID'sini `firma` sorgu parametresiyle taşır.
Üstte firma ve İstanbul tarihine göre başlangıç günü seçilir. Yönetici lokasyon
(ad/il) ve personel (ad/kod/İDP veya sabit) ekleyebilir. Yönetici ve operasyon
lokasyon/hizmet hattı/pozisyon/kişi sayısıyla talep açar. Talep kartında atanan/gerekli,
açık kişi sayısı, atamalar ve iptal aksiyonu bulunur. Boş talep de görünür.
Aynı gün atanmış personel seçenekte uygun gösterilmez; son karar sunucuya aittir.
Talep iptali kullanıcı teyidi ister ve aktif atamalarını birlikte kaldırır.
Yükleme, boş görünüm ve doğrulanamayan sonuç ayrı gösterilir. Açık kartları
Dashboard veya eski Talepler toplamlarına henüz katılmaz.


### Günlük pilot: toplu şube aktarımı (lokal, 2026-09-09)

Yalnız yönetici, günlük planda seçili aktif firmaya CSV önizleyip aktarır.
500 satır/256 KiB sınırı; firma içi şube kodu benzersiz. Aynı içerik atlanır,
değişmiş kod/içerik çakışmasında parti tamamen geri alınır.
[Akış sözleşmesi](../01_product/ILK_OPERASYON_DILIMI.md) esas alınır.


### Günlük pilot iptal teyidi — 2026-09-09 güncellemesi

Tarayıcı window.confirm yerine uygulama içi HTML dialog kullanılır. Talep adı ve
günü ile aktif atamaların kaldırılacağı gösterilir. İlk odak Vazgeç üzerindedir;
Vazgeç/Escape yazı başlatmaz. İşlem sürerken teyit/vazgeç kapanışı engellenir.
Sunucu hatası dialog içinde gösterilir; başarıda kapanır ve plan yenilenir.


### Mobil kabuk — 2026-09-09

768 px altı görünümde sabit 256 px sol menü yerine Menü düğmesiyle açılan modal
gezinme paneli kullanılır. İçerik ve üst çubuk tam genişliktedir. Link seçimi,
Kapat veya Escape paneli kapatır; masaüstüne geçince açık panel kapatılır.
Masaüstü menü/rol filtreleri korunur; kullanıcı düğmesine erişilebilir ad verilir.


### Günlük pilot — bağlantı hatası

Plan okuması başarısızsa boş talep sonucu gösterilmez; “Plan doğrulanamadı” ve
Yenile yönlendirmesi görünür. Yeni talep formu doğrulanmış plan gelene kadar
kapalıdır. Rol RPC'sindeki bağlantı hatası “yetkiniz yok” diye yorumlanmaz.
Belirsiz kayıt sonucunda aynı formu değiştirmeden tekrar deneme yönlendirilir.


## Haftalık personel planı — 2026-09-09 pilot eki

`/talepler/haftalik`: yönetici/operasyon, pilot bayrağı altında. Firma ve hafta
seçimi, kişi-gün ihtiyaç/atama/açık toplamları, yedi gün kartı, şube/personel tablosu.
İptaller seçenekle görünür, toplamlar aktif taleplerdendir. Günlük plana firma/gün
korunur. Güncel sorgu sonrası CSV ve tarayıcı yazdırması; boş/hatalı planda çıktı
kapalı. Ayrıntı: `01_product/HAFTALIK_OPERASYON_DILIMI.md`.


Günlük pilotta toplu gün formu: başlangıç/bitiş, haftanın günleri, lokasyon/hizmet/
pozisyon ve kişi sayısı → önizleme → gün çıkarma → tek atomik kayıt. Sonuç haftalık
plana bağlanır. 31 günlük sınır; resmî tatiller otomatik değildir. CSV indirme artık
aynı origin'deki yetkili attachment endpoint'iyle çalışır. Ayrıntı:
`01_product/TOPLU_GUN_TALEBI_DILIMI.md`.

Aktif günlük talep kartında Yeni kişi sayısı / İhtiyacı güncelle bulunur.
Atama sayısının altı reddedilir, mevcut atamalar korunur; eski ekrandan gönderimde
eski kişi sayısı uyuşmazsa Yenile gerekir. İptal talebinde form görünmez.

## Günlük ve haftalık gerçekleşme (2026-09-09)

Günlük talep kartı plan kapsamını ve gerçekleşmeyi ayrı gösterir. Atama satırında
Personeli değiştir, gerçekleşme panelinde Geldi/Gelmedi/Bildirimi geri al vardır.
Kaldırılmış atama etiketiyle tarihçe görünür kalır. Gelecek güne bildirim gönderilmez.
İptal dialogu bildirimlerin korunduğunu açıklar. Haftalık gerçekleşme paneli ayrı
getirilir ve kendi zaman damgasını gösterir; plan iptal filtresi etkilemez. Yedi
günün kartları düzeltme yapılabilecek günlük ekrana gider. Panel plan PDF'sine girmez.

## Operasyon kontrol listesi (2026-09-09)

/talepler/kontrol: seçili firma/gün, verinin zamanı, tekil talep + ayrı üç işaret
sayacı; arama ve işaret filtresi. İptal/kaldırılmış kayıtlar aksiyon değil. Gelecek
günde unreported bekleyen sayılmaz. Günlük kaydı aç ilgili talebi vurgular. Ağ veya
veri hatası temiz liste sayılmaz. Kaynak düzeltmesi ve yenileme işareti kaldırır.

## Aranabilir dizin (2026-09-09)

/talepler/dizin: Şubeler veya Personel, şubede firma seçimi, aktif/pasif filtre,
form gönderimiyle kod/ad/il arama, sunucuda 50 satır sayfa. Şube kodu null ise Kod yok.
Personel için çalışma alanı kapsamı açıklanır. Her sayfanın veri zamanı görünür;
boş/eskimiş ofset ilk sayfaya dönüş sunar. Aktiflik değiştirme bu ilk dilimde yok.

## Dizin aktiflik kontrolü (2026-09-09)

Dizin kartında yönetici Pasife al/Aktifleştir düğmesi görür. Native dialog mevcut
plan/geçmişin korunacağını açıklar. İşlem boyunca form/sayfa değişimi kapalı; kayıp
yanıt kimliği saklanır, yeniden gönderim veya Bekleyen işlemler ile uzlaştırılır.
Operasyon rolü aynı dizini salt-okunur kullanır. Aktiflik verisi eskiyse tekrar yazılmaz.


## 2026-09-09 — Sözleşme PDF yüklemesinde süreklilik

Sözleşme detayında yönetici, görünür PDF dosya seçicisinden en fazla10MB dosya
seçip açık yükleme düğmesiyle yayımlar. Yenileme sonrası yarım kalan işlem bulunur;
PDF byte'ı saklanmadığından aynı dosya yeniden seçilir. “Sonucu kontrol et” ve
“Yüklemeden vazgeç” sunucudaki komut sonucunu esas alır. Hata işlem kimliğini
silmez. İlk PDF ve yeni sürüm aynı akıştadır; eski PDF geçmişte kalır. Dosya
yüklenmesi sözleşmenin imzalandığı veya yenilendiği anlamına gelmez. Bu teslim
yalnız sentetik yerelde; çoklu ek protokol sonraki dilimdir.


## 2026-09-09 — Ana PDF ve ek protokoller

Sözleşme detayında ana PDF kartı korunur; Ek protokoller bölümünde başlıklı ayrı
belgeler bulunur. Her ek kendi PDF/sürüm geçmişi ve yönetici yükleme/devam/iptal
formuna sahiptir. Yeni ek başlığı gereklidir; aynı başlık iki ayrı kayıt olabilir.
Liste20'lik sayfalarla devam eder. Firma evrak listesinde ek başlığı/kategorisi ve
sözleşme bağlantısı görünür; bağlı dosya bu listeden silinmez. Genel destekleyici
belge otomatik sözleşmeye bağlanmaz. 02000 yalnız yerel kabul ortamında ölçüldü.


## 2026-09-09 — 02500 günlük Dashboard

Günlük talep/istenen/yerleştirilen/eksik, ilk 5 açık kayıt ve günlük plana bağlantı. Yönetici/operasyon, doğrulanmış tenant, sunucu özellik bayrağı. 8 native SQL + gerçek yerel Auth/RPC + genel/type/build 6/6. Runner artık 23 olası adım; tam paket bu tur çalıştırılmadı. Kanıt/sınırlar: `01_product/DASHBOARD_GUNLUK_OPERASYON_DILIMI.md`.


## 2026-09-09 — 026 rapor kaynakları

Raporlarda güncel günlük/haftalık operasyon, önceki kayıtların açık ayrımı ve gerçek filtre açıklamaları. Finansal özet eski personel/risk sayaçlarından arındırıldı; başarısız okuma onay bekleme gibi gösterilmez, yeniden denenir. Genel/type/build6/6; kanıt ve kalanlar `01_product/RAPOR_KAYNAKLARI_GECIS_DILIMI.md`. SQL/prod değişikliği yok.


## 2026-09-09 — 027 mali okuma kabulü

Boş/dolu/yalnız firma kaydı tarayıcıda doğrulandı. Eksik gecikme sayısı sıfır yerine bilinmiyor; mali yenileme düğmesi. Yerel minimum mali okuyucu fixture, iki test kaydı temizlendi.128unit/genel5adım geçti; DNS nedeniyle ilk build başarısız, build tekrarı başarılı. Kanıt: `01_product/FINANSAL_OKUMA_KABULU.md`; sıradaki `01_product/PILOT_UCTAN_UCA_KABUL.md`.


## 2026-09-09 — 028 gelişmiş finansal ilk görünüm

Gelişmiş özet modalı mevcut firma alacaklarını ve proje kırılımı veri gereksinimlerini gösterir. Proje kârı üretilmez. Luca120 müşteri alacağı kapsamı koddan doğrulandı; proje tanımı kararı bekleniyor.128unit/genel/type/build6/6. Plan `01_product/PROJE_FINANSALI_VE_LUCA_PLANI.md`.


## 2026-09-09 — 031 İşe Başlama Takibi

Resmi ürün dokümanları benchmark, kaynaklı plan ve `/talepler/ise-baslama/onizleme` etkileşimli sentetik tasarım. Arama sonucu/varış teyidi ayrı;140unit/genel/type/build6/6. Kayıt veya bildirim oluşturmaz. Sıradaki gerçek plan saat/sorumlu kalıcılığı. `01_product/ISE_BASLAMA_TAKIBI_PLANI.md`.

## 032 — İşe Başlama Takibi / canlı Supabase

> **032 — 2026-09-09: canlı aktarım kısmi, İşe Başlama Takibi kalıcı.** Canlıya 000100–001200 ve 002700 olmak üzere 13 migration uygulandı; SQL SHA256 doğrulandı, ledger özgün sürümlerle uzlaştırıldı. 001300–002600 mevcut modül değişiklikleri otomatik onay denetimi nedeniyle ayrı kullanıcı onayı bekliyor. 145 unit/genel+SQL+build 23/23; yeni takip 16SQL ve gerçek yerel Auth/RPC, tarayıcıda kayıt+reload geçti. localhost hâlâ yerel Supabase; frontend deploy yok. Güncel ayrıntı: [Canlı aktarım defteri](../supabase/manual/release-20260909.md).
