# BPS — Real-Data Migration Master Plan
### Final Merged Version — GPT Governance + Claude Operational Detail
_Son güncelleme: 2026-04-06 — Terminoloji düzeltmesi uygulandı_

---

## 0. Yönetici Özeti

BPS ürün omurgası, auth, rol modeli, sayfa koruması ve cross-surface truth katmanı çalışıyor. Ama iş nesneleri `src/mocks/` dosyalarından okunuyor — kalıcı veritabanına yazılmıyor.

Bu plan, BPS'i **mock-backed demo shell'den gerçek Supabase-backed operasyon sistemine** dönüştürür.

**Yaklaşım:** Fazlı, domain-merkezli migration
**Araçlar:** Claude Code (uygulama) + Codex (review/governance) + Claude.ai (canlı test)
**Süre:** 10-14 gün (iyi senaryo), 2-3 hafta (güvenli planlama)

**Doküman seviyesi:** Schema intent + migration governance. Tam SQL, kolon tanımları ve CHECK constraint'ler bu dokümanın kapsamında değildir — her batch'in implementation aşamasında üretilir.

### Aktif Rol Modeli
- `yonetici` — tam global erişim
- `partner` — atanmış firmalar içinde tam operasyonel yetki
- `operasyon` — operasyonel yürütme
- `ik` — evrak/personel belge takibi
- `muhasebe` — sınırlı finansal özet bakım
- `goruntuleyici` — salt okunur

**`satis` rolü kaldırılmıştır.** Eski satis varsayımları hiçbir yerde kullanılmaz.

---

## 1. Migration Anayasası (Vazgeçilmez Kurallar)

### 1.1 Migration'ı fazlandır
Tüm modülleri aynı anda migrate etme. Domain domain ilerle.

### 1.2 Merkezden dışarı doğru ilerle
BPS firma merkezli. Önce Company Detail'i gerçek yap, sonra bağlı modülleri ekle.

### 1.3 Aktif domain başına tek truth
Bir domain gerçek veriye geçtiyse, o domain için mock truth'u hemen kaldır. İki kaynak aynı anda yaşamasın.

### 1.4 Truth before polish
Write/read/source-of-truth zinciri UX güzelleştirmesinden önce gelir.

### 1.5 Yarı-canlı belirsizlikten kaçın
Kullanıcı neyin demo neyin gerçek olduğunu her zaman bilmeli.

### 1.6 Türetilmiş yüzeyler domain truth'tan sonra gelir
Dashboard KPI'ları, raporlar ve summary kartlar bağımsız sistemler olarak migrate edilmez — kaynak domain gerçek olduktan sonra ondan türetilir.

### 1.7 Rol ve aksiyon sınırlarını her adımda koru
Migration sırasında permission leak açılmasına izin verme. Her batch sonunda rol + scope denetimi yap.

### 1.8 Authoritative kural dokümanlarına uy
Migration yeni rol/erişim kuralı, status tanımı veya workflow kuralı icat etmez.

Authoritative kaynaklar:
- `ROLE_MATRIX.md` — rol/erişim sözleşmesi
- `STATUS_DICTIONARY.md` — status tanımları
- `WORKFLOW_RULES.md` — iş akışı kuralları

Herhangi bir uyumsuzluk **DECISION REQUIRED** olarak işaretlenir.

### 1.9 Yetkilendirme = rol yeteneği + atanmış scope
BPS yetkilendirmesi artık salt rol bazlı değildir.

- `partner` kabul edilmiş operasyonel sahip rolüdür
- `partner` global admin DEĞİLDİR
- `partner` metadata etiketi DEĞİLDİR
- Rol, partner'ın ne yapabileceğini tanımlar
- Atanmış firma/portföy scope'u, partner'ın nerede yapabileceğini tanımlar
- Bir firmaya birden fazla partner atanabilir
- Atanmamış firmalar görünmez ve aksiyon alınamaz olmalıdır

### 1.10 Scope filtresi her yerde uygulanmalı
Scope filtreleme sadece ana sayfalarda değil, şu yüzeylerde de zorunludur:
- Firma listesi ve Company Detail
- Sözleşmeler, talepler, randevular, görevler, evraklar
- Firma bazlı ticari görünürlük
- Portföy sınırlı finansal görünürlük
- Rapor satırları ve dashboard summary'leri
- CTA yolları

---

## 2. Veri Katmanı Ayrımı

### 2.1 Birincil Kalıcı Domain'ler (Supabase tablosu olacak)
- Companies / Firmalar
- Contacts / Yetkililer
- Notes / Notlar
- Contracts / Sözleşmeler
- Requests / Personel Talepleri
- Workforce summary / Aktif İş Gücü
- Appointments / Randevular
- Tasks / Görevler
- Documents / Evraklar
- Routings / Yönlendirmeler
- Critical Dates / Kurumsal Kritik Tarihler
- Financial Summaries / Finansal Özet verileri
- Profiles / Kullanıcı profilleri
- Partner scope assignments / Partner-firma atama modeli

### 2.2 Türetilmiş Okuyucular (Tablo olmayacak — birincil domain'den türetilecek)
- Dashboard headline KPI'ları
- Riskli firmalar listesi
- Ticari baskı summary'leri
- Açık talep hacmi grafiği
- Company Detail genel bakış kartları
- Rapor satırları
- Summary strip'ler

### 2.3 Yalnızca Arayüz Davranışı (Veritabanıyla ilgisi yok)
- Tab/CTA görünürlüğü → rol bazlı app logic
- Topbar tarih/saat → client-side utility
- Empty state, chart filtre → component logic
- Read-only vs editable surface → rol bazlı app logic

---

## 3. Mimari Kararlar

### 3.1 Katman Ayrımı

```
UI Component
    ↓
src/lib/services/[modul].ts — İş mantığı, validasyon, dönüşüm
    ↓
src/lib/supabase/[modul].ts — Supabase CRUD sorguları
    ↓
Supabase Postgres + RLS
```

İş mantığı doğrudan UI component'lere konulmaz.

### 3.2 Profiles Tablosu
`auth.users` yerine `public.profiles` app-facing identity katmanı olarak kullanılacak.

**Amaç:** display_name, role, unit, author/owner referansları, join-friendly uygulama kimliği.
**Gerekli alanlar:** id, auth_id (FK → auth.users), display_name, email, role, unit, timestamps
**Kurallar:** Tüm created_by/author_id FK'ları profiles.id'ye bağlanır. Auth signup → otomatik profiles trigger.

### 3.3 Kapsam-Duyarlı Erişim Modeli
`partner` rolü portföy-scoped olduğu için BPS'in açık bir atama modeli gerekir:
- Bir partner → birden fazla firma
- Bir firma → birden fazla partner
- Many-to-many assignment desteği zorunlu

Bu bir **erişim-modeli gereksinimidir**, ürün scope genişlemesi değildir.

Kesin implementation formu (tablo adı, yapısı) implementation batch'inde belirlenir. Ama sistem şunları desteklemek zorundadır:
- Atanmış partner → izinli firma scope'u
- Sorgu ve türetilmiş okuyucularda scope-aware filtreleme
- List / detail / dashboard / rapor / finansal yüzeylerde tutarlı enforcement

### 3.4 RLS Stratejisi
App-level guard tek savunma hattı değildir. Hassas tablolarda DB seviyesinde de koruma şarttır.

**Kritik kural:** RLS politikaları `ROLE_MATRIX.md`'deki kabul edilmiş erişim sözleşmesine uyar. Migration planı yeni kısıtlama icat etmez.

**Hassasiyet katmanları (yön gösterici — kesin politikalar implementation'da yazılır):**

| Seviye | Tablolar | Yaklaşım |
|--------|----------|----------|
| **Düşük** | companies, contacts, contracts, requests, appointments, routings, workforce | Authenticated read + rol bazlı write + partner scope filtresi |
| **Orta** | notes, tasks, critical_dates | Rol-filtered read (per ROLE_MATRIX.md) + author-based write + partner scope |
| **Yüksek** | documents, financial_summaries | Sıkı rol-filtered read/write (per ROLE_MATRIX.md) + partner scope |
| **Sistem** | profiles, scope assignments | Authenticated read own, yönetici read all |

**Partner scope enforcement notu:** Yalnızca UI gizleme ile partner izolasyonu sağlanamaz. DB/service katmanında da scope filtresi zorunludur.

### 3.5 Production Seed Kuralı
Production mock seed ile başlamaz.

| Ortam | Politika |
|-------|---------|
| Development | Mock veriler seed olarak yüklenir |
| Staging/Demo | Seçilmiş demo verisi, "[DEMO]" etiketli |
| **Production** | **Boş başlar** veya kontrollü gerçek import |

### 3.6 Doküman Depolama Kuralı
Evrak truth'u storage-path/object-key bazlı modellenir. Doğrudan URL saklanmaz. Runtime'da signed URL generate edilir.

### 3.7 Aktif İş Gücü Koruma Sınırı — Sert Kural
Workforce aggregate-only kalır. Bu migration'da kişi bazlı çalışan kaydı, HRIS, bordro veya employee-master davranışı YOKTUR.

Bu tabloya şunlar ASLA eklenmez:
- Kişi bazlı çalışan listesi / employee registry
- Kişi seviyesi persistence (ad, TC, SGK no)
- İşe alım pipeline'ı
- İzin / bordro / performans takibi

Bu guardrail'in gevşetilmesi ayrı bir ürün kararı gerektirir.

---

## 4. Yapılmayacaklar Listesi

1. Tüm modülleri tek batch'te migrate etme
2. Dashboard/report truth'u domain truth'tan önce aktive etme
3. Migrate edilmiş domain'de dual active truth bırakma
4. Production gerçek veriyi belirsiz mock ile karıştırma
5. Finance migration'ı accounting/ERP davranışına çevirme
6. Workforce'u HRIS/personnel registry'e dönüştürme
7. Migration planında yeni status tanımı icat etme
8. Migration planında yeni erişim kuralı icat etme
9. Sahte-başarılı create akışlarını açık bırakma
10. Proje/saha kayıtlarını firma tipi olarak modelleme
11. Partner izolasyonunu yalnızca UI gizleme ile sağlamaya çalışma
12. Partner'ı global admin gibi muamele etme
13. Partner'ı metadata etiketi gibi muamele etme
14. Firma ağacını çok seviyeli ERP-style hiyerarşiye dönüştürme

---

## 5. Faz Yapısı

```
Faz 0: Altyapı + Profiles + Keşif
    ↓
Faz 1: Firmalar + Yetkililer + Notlar
    ↓
Faz 2: Sözleşmeler
    ↓
Faz 3: Talepler + Randevular + Görevler + İş Gücü
    ↓
Faz 4: Evraklar + Kritik Tarihler
    ↓
Faz 5: Finansal Özet
    ↓
Faz 6: Dashboard Live KPI + Raporlar
    ↓
Faz 7: Cutover + Mock Temizliği
```

**Sonraya atılan (Faz 2 — Gözlemlenebilirlik):** Activity Log, Zaman Çizgisi, gelişmiş dosya lifecycle, audit trail

---

# FAZ 0 — Altyapı + Profiles + Keşif

## Amaç
Migration altyapısını hazırla. Mevcut mock bağımlılıklarını haritala. Partner scope enforcement noktalarını tanımla.

## Kapsam
- Profiles tablosu + auth-profile linkage + trigger
- Supabase tip generate + service katmanı base pattern
- Screen → mock dependency haritası
- Summary → source-of-truth haritası
- Partner scope enforcement touchpoint keşfi: hangi yüzeylerde scope filtresi gerekecek

## Kabul Kriterleri
- [ ] Profiles katmanı çalışıyor, kullanıcılar eşlendi
- [ ] Auth/profile linkage çalışıyor
- [ ] Dependency haritaları çıkarıldı
- [ ] Partner scope touchpoint'lar tanımlandı

## Süre: 4-6 saat | Risk: Düşük

---

# FAZ 1 — Firmalar + Yetkililer + Notlar

> **Hedef:** "Firma ekle dediğimde kalıcı kaydediliyor. Yetkili ve not da gerçek."

---

## Batch 1A — Firmalar

### Amaç
Merkez varlık. Tüm domain'ler firmaya bağlı. İlk gerçek tablo.

### Şema Niyeti
- **Kimlik alanları:** firma adı, vergi no, sektör, şehir, adres, telefon, e-posta, açıklama
- **Durum alanları:** status (per STATUS_DICTIONARY.md), risk_level (per STATUS_DICTIONARY.md)
- **Grup ilişkisi:** parent_company_id (nullable self-FK), company_type (holding / sirket / sube)
- **Ownership:** created_by → profiles FK
- **Meta:** timestamps

### Grup İlişkisi Kuralları
- Tek seviye: holding → şirket/şube. Çok seviyeli ağaç YASAK
- `project` firma tipi DEĞİLDİR — proje/saha sözleşme/operasyon katmanında temsil edilir
- V1'de holding aggregate sınırlı: bağlı firma sayısı, toplam aktif sözleşme, toplam açık talep
- Holding seviyesi finans birleştirme, karma risk skoru V1'de YOK

### Firmalar Listesi UI
- Varsayılan düz liste + grup badge
- Opsiyonel grup görünümü filtresi
- Tree explorer YAPILMAZ

### Company Detail UI
- Holding → "Bağlı Firmalar" kartı
- Child → "Bağlı Olduğu Grup" + parent link

### Erişim
Per `ROLE_MATRIX.md`. Partner erişimi atanmış scope ile sınırlı — atanmamış firmalar görünmez.

### Kabul Kriterleri
- [ ] Firma CRUD kalıcı çalışıyor
- [ ] Grup parent/child ilişkisi çalışıyor
- [ ] Rol bazlı kısıtlama per ROLE_MATRIX.md
- [ ] Atanmamış firmalar partner için görünmez ve aksiyon alınamaz
- [ ] Company Detail parity: list ve detail aynı truth
- [ ] Guardrail: proje tipi firma olarak oluşturulamıyor

### Süre: 4-6 saat | Risk: Orta

---

## Batch 1B — Yetkili Kişiler

### Amaç
Firma bazlı kontakt truth'u. CRM veya global people directory DEĞİL.

### Şema Niyeti
- **İlişki:** company_id → companies FK (NOT NULL)
- **Kişi alanları:** full_name, title, phone, email
- **Durum:** is_primary (boolean, firma başına tam 1)
- **Context:** notes (kısa not)

### Uygulama Seviyesi Kısıtlar
- Firma başına max 5 yetkili
- Firma başına tam 1 ana yetkili
- Telefon veya e-posta en az biri zorunlu

### Erişim
Per `ROLE_MATRIX.md` + partner scope restriction.

### Kabul Kriterleri
- [ ] Yetkili CRUD kalıcı çalışıyor
- [ ] Ana yetkili mantığı ve değişim uyarısı doğru
- [ ] Firmalar listesinde ana yetkili gerçek tablodan
- [ ] Partner atanmış scope dışındaki yetkililere erişemiyor
- [ ] Company Detail parity

### Süre: 3-4 saat | Risk: Düşük

---

## Batch 1C — Notlar

### Amaç
Firma bazlı kurumsal hafıza. Chat değil, task sistemi değil, case thread değil.

### Şema Niyeti
- **İlişki:** company_id → companies FK (NOT NULL), author_id → profiles FK
- **İçerik:** content, tags (array)
- **Durum:** is_pinned
- **Ownership:** author_id, author_name (denormalized)

### Sahiplik Kuralları
- Kullanıcı kendi notunu düzenler
- Yönetici tüm notları düzenleyebilir
- Pin/unpin yönetici-only

### Erişim
Per `ROLE_MATRIX.md` + partner scope restriction.

> **DECISION REQUIRED:** Mevcut ROLE_MATRIX.md'de notlar için muhasebe ve görüntüleyici erişimi açıkça tanımlı mı? DB seviyesi enforcement için netleştirilmeli.

### Kabul Kriterleri
- [ ] Not CRUD kalıcı çalışıyor
- [ ] Ownership kuralları doğru
- [ ] Tag filtre ve pin/unpin çalışıyor
- [ ] Son Notlar kartı güncel
- [ ] Atanmış scope dışındaki notlar partner için görünmez
- [ ] Company Detail parity

### Süre: 3-4 saat | Risk: Düşük

---

## Faz 1 Kontrol Noktası
- ✅ Company Detail firma/yetkili/not katmanı gerçek
- ✅ Ekip gerçek firma girmeye başlayabilir
- ✅ **Prensip 1.3 uygulanır:** bu 3 domain için mock truth kaldırılır, aktif dual-truth bırakılmaz

---

# FAZ 2 — Sözleşmeler

> **Hedef:** "Sözleşmeler kalıcı lifecycle nesneleri."

### Amaç
Sözleşmeleri lifecycle nesnesi olarak gerçek veriye taşı. Belge arşivi değil, yaşam döngüsü.

### Şema Niyeti
- **İlişki:** company_id → companies FK (NOT NULL), created_by → profiles FK
- **Kimlik:** name, type
- **Lifecycle:** start_date, end_date, value, responsible
- **Durum:** status (per STATUS_DICTIONARY.md)
- **Türetilen (app seviyesi):** remaining_days, approaching_signal

### Bağlı Yüzeyler
Sözleşmeler list/detail, Company Detail tab + genel bakış kartı, Firmalar list kolonu, NewContractModal, Dashboard KPI (Faz 6'da derived)

### Erişim
Per `ROLE_MATRIX.md` + partner scope restriction.

### Kabul Kriterleri
- [ ] Sözleşme CRUD kalıcı çalışıyor
- [ ] Kalan gün doğru hesaplanıyor
- [ ] Company Detail ve Firmalar listesi tutarlı
- [ ] Partner yalnızca atanmış scope'taki sözleşmeleri görüyor
- [ ] Company Detail parity + summary truth parity

### Süre: 4-6 saat | Risk: Orta

---

# FAZ 3 — Koordineli Operasyon Katmanı

> **Hedef:** "Talep, randevu, görev ve iş gücü aggregate birlikte gerçek."

Bu domain'ler birlikte migrate edilir çünkü güçlü etkileşimleri var.

---

## Batch 3A — Personel Talepleri

### Amaç
Açık personel ihtiyaçlarını gerçek veriye taşı.

### Şema Niyeti
- **İlişki:** company_id → companies FK, created_by → profiles FK
- **Talep:** position, requested_count, provided_count, location, start_date, responsible
- **Durum:** status (per STATUS_DICTIONARY.md), priority (per STATUS_DICTIONARY.md)
- **Türetilen:** open_count = requested - provided

### Erişim
Per `ROLE_MATRIX.md` + partner scope restriction.

### Kabul Kriterleri
- [ ] Talep CRUD kalıcı çalışıyor
- [ ] Open-demand visibility doğru
- [ ] Talep grafiği gerçek truth'tan çiziyor
- [ ] Atanmamış talepler partner için görünmez

---

## Batch 3B — Randevular

### Amaç
Firma görüşme takibi ve sonuç yönetimini gerçek veriye taşı.

### Şema Niyeti
- **İlişki:** company_id → companies FK (NOT NULL), contract_id (opsiyonel), request_id (opsiyonel), created_by → profiles FK
- **Görüşme:** date, type, attendees, location
- **Sonuç:** result (tamamlandığında zorunlu), next_action (tamamlandığında zorunlu)
- **Durum:** status (per STATUS_DICTIONARY.md)

### İş Akışı Kuralları Uyumu
Tamamlandığında result + next_action ZORUNLU (per WORKFLOW_RULES.md).

### Kabul Kriterleri
- [ ] Randevu CRUD kalıcı çalışıyor
- [ ] Tamamlandığında result + next_action zorunluluğu çalışıyor
- [ ] Atanmamış randevular partner için görünmez

---

## Batch 3C — Görevler

### Amaç
Bağlamsal görev truth'unu gerçek veriye taşı. Çoklu kaynaktan doğar.

### Şema Niyeti
- **İlişki:** company_id, contract_id (opsiyonel), request_id (opsiyonel), appointment_id (opsiyonel), created_by → profiles FK
- **Görev:** title, description, due_date, assigned_to
- **Kaynak:** source_type (per STATUS_DICTIONARY.md)
- **Durum:** status (per STATUS_DICTIONARY.md), priority (per STATUS_DICTIONARY.md)

### Rol Matrisi Uyumu
İK görev oluşturabilir ama atama değiştiremez.

### Kabul Kriterleri
- [ ] Görev CRUD kalıcı çalışıyor
- [ ] Çoklu kaynak (manuel, randevu, talep) çalışıyor
- [ ] Atanmamış görevler partner için görünmez

---

## Batch 3D — Aktif İş Gücü

### Amaç
Firma bazlı iş gücü aggregate'ini gerçek veriye taşı.

### Şema Niyeti
- **İlişki:** company_id → companies FK (NOT NULL, UNIQUE)
- **Aggregate:** target_count, current_count, hires_this_month, exits_this_month

### KORUMA SINIRI — HRIS Drift Yasağı
Aggregate-only. Kişi bazlı çalışan kaydı YOK. (Bkz. §3.7)

### Kabul Kriterleri
- [ ] İş gücü aggregate kalıcı çalışıyor
- [ ] Kişi seviyesi kayıt tanıtılmadı
- [ ] Atanmamış iş gücü kayıtları partner için görünmez

---

## Faz 3 Kabul Kriterleri (Koordineli)
- [ ] Tüm operasyon domain'leri kalıcı çalışıyor
- [ ] Status değerleri STATUS_DICTIONARY.md ile tutarlı
- [ ] Company Detail parity
- [ ] Summary truth parity
- [ ] Partner scope kısıtlamaları tüm operasyonel domain'lerde geçerli

### Süre: 6-8 saat | Risk: Yüksek

---

# FAZ 4 — Evraklar + Kritik Tarihler

> **Hedef:** "Evrak kaydı doğru, süresi dolunca sinyal veriyor. Kritik tarihler yönetiliyor."

---

## Batch 4A — Evraklar

### Amaç
Firma bazlı belge truth'unu gerçek veriye taşı.

### Şema Niyeti
- **İlişki:** company_id → companies FK (NOT NULL), contract_id (opsiyonel), uploaded_by → profiles FK
- **Belge:** name, category, expiry_date
- **Durum:** status (per STATUS_DICTIONARY.md — geçerlilik durumları)
- **Dosya:** storage_path (object key — URL değil), file_name, file_size, mime_type
- **Türetilen (app):** süresi_yaklaşıyor, süresi_doldu (expiry_date bazlı)

### Migration Başarı Kriteri (Sadeleştirilmiş)
- **Birincil hedef:** Record truth + validity truth + visibility truth
- **İkincil hedef:** Upload/storage entegrasyonu (aynı batch'te yapılabilir ama migration acceptance için zorunlu değil)
- Gelişmiş dosya lifecycle (versioning, preview, bulk upload) → kesinlikle sonraya

### Dosya Depolama Niyeti
Supabase Storage, storage_path/object-key bazlı. Runtime'da signed URL generate edilir. Raw URL saklanmaz.

### Erişim
Per `ROLE_MATRIX.md` + partner scope restriction.

> **DECISION REQUIRED:** Mevcut ROLE_MATRIX.md'de görüntüleyici evrak erişimi açıkça tanımlı mı? DB enforcement öncesi netleştirilmeli.

### Kabul Kriterleri
- [ ] Evrak record truth + validity truth çalışıyor
- [ ] Süresi yaklaşan/dolmuş sinyal doğru
- [ ] Atanmamış evraklar partner için görünmez
- [ ] Company Detail parity

---

## Batch 4B — Kurumsal Kritik Tarihler

### Amaç
Şirket seviyesi deadline visibility. Firma seviyesi DEĞİL.

### Şema Niyeti
- **company_id YOK — şirket geneli**
- **Tarih:** title, type, expiry_date
- **Durum:** status (per STATUS_DICTIONARY.md)
- **Ownership:** created_by → profiles FK

### Erişim
Broad read (tüm authenticated), yönetici-only write (per ROLE_MATRIX.md).

### KORUMA SINIRI
Evraklar'a veya compliance-software'e çekilmez. Deadline visibility surface olarak kalır.

### Kabul Kriterleri
- [ ] Kritik tarih CRUD kalıcı çalışıyor
- [ ] Dashboard sinyali ve liste sayfası tutarlı
- [ ] Compliance/helpdesk drift yok

### Süre: 5-7 saat | Risk: Yüksek

---

# FAZ 5 — Finansal Özet

> **Hedef:** "Finansal veriler Supabase'de, onay akışı çalışıyor."

**DİKKAT:** En hassas migration fazı. Scope-creep riski en yüksek.

### Amaç
Firma bazlı bounded management financial visibility'yi gerçek veriye taşı. **Accounting truth DEĞİL.**

### Şema Niyeti
- **İlişki:** company_id → companies FK (NOT NULL, UNIQUE — firma başına 1), confirmed_by → profiles FK
- **Finansal:** open_receivables, last_invoice_amount, last_invoice_date, uninvoiced_amount
- **Yönetim:** risk_label, confirmed_at, confirmed_by

### KORUMA SINIRI — Finansal Scope Sınırı
Bu tablo şunları İÇERMEZ:
- Fatura detayları / tahsilat akışı / banka mutabakatı
- Vergi hesaplaması / bordro bilgisi / muhasebe defteri

Confirmed management-visibility snapshot olarak kalır.

### Erişim
Per `ROLE_MATRIX.md` — yönetici ve muhasebe (bounded summary-maintenance actor).

**Partner kısıtlaması:**
- Partner yalnızca atanmış portföy finansal/ticari görünürlüğünü görür
- Atanmamış firma finansal görünürlüğü YOK
- Partner için global finansal görünürlük YOK

### Kabul Kriterleri
- [ ] Finansal veri CRUD kalıcı çalışıyor
- [ ] Upload/confirm akışı gerçek veri yazıyor
- [ ] Company Detail ticari özet gerçek veriden
- [ ] Partner yalnızca portföy-bounded finansal truth görüyor
- [ ] Accounting drift yok — scope sınırı korunmuş
- [ ] Company Detail parity + summary truth parity

### Süre: 4-6 saat | Risk: Orta teknik, yüksek scope-creep

---

# FAZ 6 — Dashboard Live KPI + Raporlar

> **Hedef:** "Dashboard ve raporlar gerçek truth'tan türetiliyor."

### Amaç
Mock-derived summary reading'i canlı derived reader'larla değiştir. Yeni truth tablosu YOK — mevcut primary truth'tan türetilir.

### İşler
1. Dashboard KPI kartları → Supabase count/sum
2. Dashboard sinyal kartları → Supabase filtered queries
3. Raporlar → Supabase filtered queries
4. Rol bazlı dashboard daraltması korunur (per ROLE_MATRIX.md)

### Partner Scope Kuralı (Kritik)
Partner filtreleme şunlara uygulanmalı:
- Dashboard summary'leri ve CTA yolları
- Rapor satırları
- Risk/ticari summary'ler
- Finansal görünürlük dilimleri

### Activity Log ve Zaman Çizgisi bu fazda YOK
Faz 2 — Gözlemlenebilirlik workstream'ine atıldı.

### Kabul Kriterleri
- [ ] Dashboard reader'ları gerçek veriyi kullanıyor
- [ ] Raporlar gerçek veriyi kullanıyor
- [ ] Scope-aware filtreleme tüm derived reader'larda çalışıyor
- [ ] Summary truth parity

### Süre: 4-6 saat | Risk: Orta

---

# FAZ 7 — Cutover + Mock Temizliği

> **Hedef:** "Aktif mock truth kalmadı."

### Amaç
Migrate edilmiş domain'lerin mock bağımlılığını kesin olarak kaldır. Final denetim yap.

### Mock Silme Protokolü (her domain için)
```
1. Supabase tablosu oluştur
2. Service katmanını yaz
3. Component'leri service'e bağla
4. Mock import'unu kaldır, service import'unu ekle
5. Test et — tüm acceptance kriterleri geç
6. Mock dosyasını fallback olarak tut (yorum satırı)
7. Batch PASS → Prensip 1.3 uygula: mock truth kaldır
8. Faz 7'de tüm mock dosyaları kesin silinir
```

### Final Denetimler
1. Her mock dosyası → aktif import referansı kalmamış mı
2. Sahte-başarılı create akışları temiz
3. Dead-end path'ler temiz
4. **Final rol audit:** per ROLE_MATRIX.md
5. **Final status audit:** per STATUS_DICTIONARY.md
6. **Final Company Detail parity:** 9 tab × gerçek veri
7. **Final partner scope audit:** atanmamış firmalar → görünmez + aksiyon alınamaz

### Kabul Kriterleri
- [ ] src/mocks/ klasöründe aktif import yok
- [ ] Tüm CRUD Supabase'e yazıyor
- [ ] Rol kuralları ROLE_MATRIX.md ile tutarlı
- [ ] Status kuralları STATUS_DICTIONARY.md ile tutarlı
- [ ] Partner scope tüm primary + derived reader'larda çalışıyor
- [ ] Cross-surface truth audit PASS

### Süre: 3-5 saat | Risk: Düşük

---

## 6. Yönlendirmeler

Faz 3 veya Faz 4'e dahil edilebilir (bağımsız domain).

### Amaç
Birimler arası yönlendirme.

### Şema Niyeti
- **İlişki:** company_id → companies FK, created_by → profiles FK
- **Yönlendirme:** from_unit, to_unit, message
- **Durum:** status (per STATUS_DICTIONARY.md)
- **Çözüm:** resolved_by, resolved_at
- **canResolve:** hedefBirim === kullanıcıBirim || role === "yönetici"

---

## 7. Kritik Zorluklar ve Çözüm Stratejileri

### 7.1 Bölünmüş truth (aynı domain için iki kaynak)
**Çözüm:** Prensip 1.3 — aktif domain'de tek truth.

### 7.2 Yetki sızıntısı
**Çözüm:** Her batch sonunda rol audit + scope audit.

### 7.3 Güncelliğini kaybetmiş türetilmiş okuyucular
**Çözüm:** Prensip 1.6 — derived reader'lar domain truth stabilize olduktan sonra bağlanır.

### 7.4 Company Detail merkeziliği kaybolur
**Çözüm:** Her batch acceptance'ında Company Detail parity zorunlu.

### 7.5 Finansal scope genişlemesi
**Çözüm:** Guardrail + anti-pattern #5. Confirmed management-visibility snapshot.

### 7.6 Evrak lifecycle kapsamının şişmesi
**Çözüm:** Record truth + validity + visibility önce. Dosya lifecycle sonra.

### 7.7 Demo vs gerçek belirsizliği
**Çözüm:** Production no-mock policy + Prensip 1.5.

### 7.8 Partner görünürlük sızıntısı
**Çözüm:** Scope-aware filtreleme primary + derived yüzeylerde. Yalnızca UI gizleme yetmez — DB/service katmanında da enforcement şart.

### 7.9 Status tanımı uyumsuzluğu
**Çözüm:** Tüm status alanları STATUS_DICTIONARY.md'den. Migration planı yeni status icat etmez.

---

## 8. Zaman Çizelgesi

| Faz | Kapsam | Süre | Risk |
|-----|-------|------|------|
| 0 | Altyapı + profiles + keşif | 4-6h | Düşük |
| 1 | Firmalar + yetkililer + notlar | 10-14h | Orta |
| 2 | Sözleşmeler | 4-6h | Orta |
| 3 | Talepler + randevular + görevler + iş gücü | 6-8h | Yüksek |
| 4 | Evraklar + kritik tarihler | 5-7h | Yüksek |
| 5 | Finansal özet | 4-6h | Orta |
| 6 | Dashboard + raporlar | 4-6h | Orta |
| 7 | Cutover + mock temizliği | 3-5h | Düşük |
| **TOPLAM** | | **40-58h** | |

**İyi senaryo:** 10-14 iş günü
**Güvenli planlama:** 2-3 hafta

---

## 9. Migration Başarı Kriterleri

Migration başarılıdır ancak ve ancak:

1. Migrate edilmiş CRUD akışları kalıcı çalışıyor
2. Sayfa yenilenince truth korunuyor
3. Farklı cihaz/tarayıcıdan tutarlı truth
4. Company Detail güvenilir merkez olarak duruyor
5. Derived reader'lar gerçek truth kullanıyor
6. Aktif migrate-edilmiş domain'de mock truth kalmadı
7. Rol kuralları ROLE_MATRIX.md ile tutarlı
8. Status kuralları STATUS_DICTIONARY.md ile tutarlı
9. Partner scope her yerde enforce ediliyor
10. Workforce aggregate-only kalmış
11. Finansal özet bounded kalmış
12. Proje/saha firma modeline girmemiş
13. Production'da mock veri yok
14. Performans kabul edilebilir (< 2 sn)

---

## 10. Codex + Claude Code Çalışma Akışı

```
1. PLAN      → Codex: schema intent, gerekli alanlar, ilişkiler, RLS hassasiyeti, guardrail'ler
2. SPEC      → Claude Code: implementation-level SQL, kolon tanımları, CHECK constraint'ler
3. REVIEW    → Codex: ROLE_MATRIX + STATUS_DICTIONARY + WORKFLOW_RULES + scope drift denetimi
4. IMPLEMENT → Claude Code: kod + service katmanı + git push
5. TEST      → Claude.ai: canlı smoke test
6. ACCEPT    → Company Detail parity + summary truth parity + rol audit + partner scope audit
7. DOCS      → Codex: gerekirse CHANGELOG, SCREEN_SPEC, ARCHITECTURE güncelle
8. CUTOVER   → Mock import kaldır (Prensip 1.3)
```

**Bu doküman Adım 1'i (intent/governance) yönetir. Adım 2 (implementation SQL) her batch'in kendi çalışmasında üretilir.**

---

## 11. Sonraya Atılanlar (Faz 2 — Gözlemlenebilirlik)

- Activity Log tablosu + event logging
- Company Detail > Zaman Çizgisi
- Dashboard > Son Aktiviteler
- Gelişmiş dosya lifecycle (versioning, preview, bulk upload)
- Audit trail / değişiklik geçmişi

---

## EK A — Grup / Bağlı Kayıt İlişkisi

**Core karar:** Çok seviyeli firma hiyerarşisi modellenMEZ. Sınırlı parent/child firma ilişkisi modellenir.

**Veri modeli intent:** parent_company_id (nullable self-FK) + company_type (holding/sirket/sube)

**V1'de project firma tipi YOKTUR.** Proje/saha → sözleşme/operasyon katmanında temsil edilir.

**Neden:** Projeler firma ağacına sokulursa firma listesi truth'u kirlenir, Company Detail zayıflar, raporlama güvenilmez olur.

**UI:** Holding → "Bağlı Firmalar" kartı (hafif aggregate). Child → "Bağlı Olduğu Grup" + parent link.

**Guardrail:** Çok seviyeli ağaç yasak, org-chart yasak, parent seviyesi otomatik finans birleştirme yasak.

---

## EK B — Kullanıcı Gözlem Notları

| # | Konu | Karar | Ne Zaman |
|---|------|-------|----------|
| 1 | Randevular → Pazarlama dönüşümü | WARN — CRM drift riski | Migration sonrası ayrı değerlendirme |
| 2 | Personel Talepleri akışı | Değişiklik yok | — |
| 3 | Bildirimler | Doğru ihtiyaç | Faz 2 |
| 4 | Arama butonu çalışmıyor | Bug fix | Hemen yapılabilir |
| 5 | Profil listesi / çevrimiçi / mesaj | Scope dışı | BPS'te yapılmaz |
| 6 | Luca muhasebe çıktısı | Finansal Özet kapsamı | Faz 5 |
| 7 | Finansal tablolar güncelleme tarihi + şablon | İyi ihtiyaç | Faz 5 |
| 8 | Holding/grup firma yapısı | parent_company_id + company_type | Faz 1 |

---

_Bu doküman GPT migration governance çerçevesi ve Claude operasyonel execution detayının final birleşimidir. Partner scope model, 6 GPT revizyonu, cleanup patch ve rol modeli güncellemesi dahil edilmiştir. satis rolü kaldırılmış, partner scope-aware yetkilendirme modeli her faza gömülmüştür._
