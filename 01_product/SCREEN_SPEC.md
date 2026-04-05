# SCREEN_SPEC.md

## Dashboard — Bileşen Listesi
- PageHeader
- DateRangePicker
- GlobalSearch
- QuickAddButton (yönetici + satış only)
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
- PageHeader (Yeni Firma action: yönetici + satış only)
- SearchInput
- FilterBar
- SavedFilterChips
- DataTable
- RowActionMenu (Detaya Git)
- NewCompanyModal

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
- satış rolü ana bakım sahibidir; operasyon yalnızca operasyonel koordinasyon gereken temel alanlarda sınırlı müdahale eder
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
- NewContractModal
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
