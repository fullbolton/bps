# TASK_ROADMAP.md

## Purpose
This document defines:
- completed batches
- the current active batch
- future planned batches
- why the execution order exists
- which operational pain points each future batch is meant to solve

This file is a product-planning layer.
It does not define database schema.
It does not define API contracts.
It does not replace `WORKFLOW_RULES.md`, `STATUS_DICTIONARY.md`, or `ROLE_MATRIX.md`.

---

## Current State
- `Batch 1 — Foundation` -> completed
- `Batch 2 — Core Backbone` -> completed
- `Batch 3 — Ticari ve Takip Derinligi` -> completed
- `Batch 4 — Operasyon Derinligi` -> completed
- `Batch 5 — Yonetim Gorunurlugu` -> completed
- `Batch 6 — On Sozlesme / Ticari Hazirlik` -> completed
- `Batch 7 — AI-Assisted Structured Entry` -> completed
- `Batch 8 — Finans Rapor Yukleme / Ozetleme` -> completed
- `Batch 9 — Agent Merkezi / AI Yardimcilari` -> completed
- `Batch 10 — Iletisim Katmani` -> completed

Parallel execution note:
- the UI Refresh track is completed as a separate documentation / design-system / UI-consistency pass
- it did not change roadmap sequencing or product scope
- it improved execution quality and visual consistency across the completed batches

Post-roadmap strategic workstream note:
- `Sehir + Altinda Operasyon Partnerleri ile Operasyon Sahipligi Gorunurlugu` is completed as a post-roadmap strategic workstream after the numbered roadmap batches
- `Partner Staff C-Level Visibility Layer` is completed as a post-roadmap strategic workstream, closed at Phase 1 as a compact `Finansal Ozet` portfolio-health summary
- `Proje Ticari Kalite / Tahmini Karlilik Gorunurlugu` is completed as a post-roadmap strategic workstream, closed at Phase 1 as a compact `Company Detail` commercial-quality visibility slice
- `Birimler Arasi Koordinasyon / Yonlendirme Katmani` is completed as a post-roadmap strategic workstream, closed at Phase 1 as a bounded `Company Detail` firma-context coordination primitive
- `Yonetici Inisiyatifleri / Ozel Takip Katmani` is completed as a post-roadmap strategic workstream through one bounded phase
- `Ticari Temas / Outbound Draft Katmani` is completed as a post-roadmap strategic workstream through one bounded phase
- `Ticari Hesap Motoru + Parametre Seti Yonetimi` is completed as a post-roadmap strategic workstream through one bounded phase
- `Role Model Extension — IK` is completed as a bounded role-extension phase adding `ik` as the 5th BPS role
- `Auth Foundation Phase 2A — Access Request + Admin Approval Flow` is completed and production-verified as a bounded onboarding-friction reduction step
- `Firma Yetkili Kisileri` is completed as a bounded Company Detail enhancement activating the `Yetkililer` tab
- `Role Model Extension — Muhasebe` is completed as a bounded role-extension phase adding `muhasebe` as the 6th BPS role
- `Firma Notlar Tab Activation` is completed as a bounded Company Detail enhancement activating the `Notlar` tab — all 9 Company Detail tabs are now active
- `Kurumsal Kritik Tarihler V1` is completed as a dashboard-linked standalone critical-date visibility surface with broad role visibility and yonetici-only management
- `Bounded Integrity Fix Batch` is completed covering note-create leak closure, Firmalar quick-note dead-end removal, CommercialSummaryCard financial-data consistency, and muhasebe contract-navigation cue removal
- these do not renumber or replace the completed batch history above

Current implementation direction remains:
- Company Detail stays central
- Dashboard stays a decision surface
- Contracts stay lifecycle objects
- completed appointments require result + next action
- tasks stay contextual
- AI and automation stay after core operational surfaces
- communication stays last

Role-model note:
- `partner` replaces `satis` in the final accepted role model
- authorization is `rol + kapsam` — enforced via RLS + service layer + UI gates
- partner-to-portfolio scope mapping is live and enforced (partner_company_assignments table + RLS)
- `goruntuleyici` remains as the bounded read-only role

Real-data migration state:
- `Faz 0 — Altyapi + Profiles + Kesif` -> completed
- `Faz 1A — Yetkililer + minimal company identity anchor` -> completed
- `Faz 1B — Notlar` -> completed
- `Faz 2 — Sozlesmeler` -> completed
- `Faz 3 — Talepler + Randevular + Gorevler + Aktif Is Gucu` -> completed
- `Faz 4 — Evraklar + Kurumsal Kritik Tarihler` -> completed
- `Faz 5 — Finansal Ozet` -> completed
- `Faz 6 — Dashboard + Raporlar` -> completed
- `Faz 7 — Cutover + Mock Temizligi` -> completed
- real-data migration program is completed
- all primary domain tables read from real Supabase truth
- RLS + partner scope enforced across all primary + derived readers
- `Firmalar` list and `Firma Detay` read from real `companies` table (including imported UUID-backed companies)

Post-migration shipped surfaces:
- public landing page at `/` with bounded demo request intake (not public signup)
- demo request abuse protection (honeypot + rate limit + server-controlled path)
- Sector Templates V1 (8-sector read-only catalog + company create-time sector selection)
- Excel Import V1 (CSV import for companies, contacts, contracts — yonetici-only, direct URL)
- Luca Mizan Import V1 (mizan Excel parsing, 120.xxx receivable extraction, snapshot storage — yonetici-only)
- company surface trust polish (real enrichment, no mock-backed commercial confidence, honest absence states)
- Luca downstream derived visibility (matched mizan rows → per-company `open_receivable` upsert on `financial_summaries` via yonetici-only RPC; preserves muhasebe-flow `is_overdue` / `unbilled_amount` / `created_by`; snapshot and derived write roll back together on failure)
- Luca source signal on Ticari Özet (minimal `last_source` column on `financial_summaries`, stamped by both writers — `muhasebe` for manual upload/review/confirm, `mizan` for Luca-derived — rendered as a subtle caption on the existing Firma Detay > Ticari Özet card, no layout redesign)
- Pre-launch mock audit pushdown (Ayarlar Kullanıcılar → real `profiles`; Login Erişim Talebi Birim dropdown removed; Topbar dead global search removed; contract amounts formatted as `₺X.XXX,XX` via `formatTRY` helper — display-only, schema unchanged)
- Dashboard truth correction (top 6 KPI cards on real Supabase truth; Bugünün Görevleri, Açık Personel Talepleri, Yaklaşan Sözleşme Bitişleri, and Eksik / Süresi Dolan Evraklar signal cards on real truth via existing service readers; Riskli Firmalar / Kurumsal Kritik Tarihler card / HotelEmailDraftHelper / İnisiyatifler / Duyurular / ActivityFeed remain later-decision on this surface)
- Katman 1 residual closure (`src/lib/draft-hotel-email.ts` mock dependency removed, dashboard workforce fetched from real truth — `src/app/` runtime `@/mocks` imports effectively sıfır; Katman 1 Geçiş ve Güven operasyonel olarak kapandı)
- Finansal Özet PDF Export V1 (yonetici-only bounded snapshot of the existing management-visibility surface via `window.print()` + shared print CSS; print-only export timestamp; no new data model, no new aggregation, no archive entity, no scheduling, no shareable link; muhasebe upload path unchanged)
- Finansal Özet authorized-role-gated reads (page fetch gated until role resolves to yonetici/muhasebe; unauthorized roles render bounded access screen — WARN fix hardening applied before PDF export opened)
- Kurumsal Kritik Tarihler PDF Export V1 (yonetici-only bounded snapshot of the existing critical-dates surface; reuses shared print infrastructure; in-page CTAs hidden in print; same pattern as Finansal Özet PDF — no new mechanism)
- Shared PDF print infrastructure (`@media print` block in `globals.css` preserving card backgrounds/borders/badge colors; `Layout.tsx` shell chrome `print:hidden` wrapping + main content offset reset; `PageHeader.tsx` actions `print:hidden`; ortak bağımlılık olarak main'de, landed as dedicated commit so both PDF slices render correctly)

Katman 2 active slices:
- Geri Çağırma ve Çıktı is the current active layer. Çıktı tarafı (PDF export) için iki slice shipped (Finansal Özet, Kurumsal Kritik Tarihler). Recall tarafı için Contract Expiry Email V1 shipped ama ops-gated.
- Contract Expiry Email Recall V1 — code-shipped, ops-gated: daily batched cron (`/api/cron/contract-expiry` via Vercel Cron) enumerates recipients from `profiles` (yonetici global) + `partner_company_assignments` (partner scoped); 30-day single threshold aligned with `getApproachingLevel("approaching")`; `contracts.responsible` stays display-only (never routing); per-(contract, recipient, threshold=30) idempotency via new `contract_expiry_emails_sent` table (service-role-only RLS, zero user policies); Resend REST transport with no new npm dependency; bearer-auth via `CRON_SECRET`; feature flag `BPS_CONTRACT_EXPIRY_EMAIL_ENABLED` default-disabled. Live enablement requires the ops gates documented in CHANGELOG + SESSION_HANDOFFS (Resend account + DNS DKIM/SPF/DMARC on bpsys.net + migration apply on both Supabase projects + env vars + flag flip).
- Weekly Digest V1 — framed and accepted as 3-block direction (not 4-block; the "aging open staffing demands" block is dropped if its data anchor proves weak at framing time). Implementation is **not opened**. Sequencing-blocked until the Contract Expiry Email Recall V1 has live pilot burn-in so the event-triggered pattern stabilizes before digest cadence is layered on.

Evre 1 closeout:
- Evre 1 is closed operationally. Rehearsal result: 6/7 PASS with 1 known WARN (sector-setup limitation affecting new-company button visibility). Demo preview access blocker was deployment/ops-layer and is resolved without code change.
- The following items are recorded as known later-decision scope only and are not active Evre 1 implementation targets: Luca `is_overdue` / ticari risk coherence, Luca stale carryover between successive uploads, Finansal Özet parity with `financial_summaries`, and the rehearsal sector-setup WARN. None of these are promoted into an active Evre 1.1 workstream by this closeout.

---

## Active Workstream — Hafta 1 (25 Nisan - 1 Mayıs 2026)

> **Master plan:** `Vault77/01-projects/bps/decisions/karar-bps-8-hafta-revize-plan.md` (8-10 hafta, iki track)
> **Detay:** `Vault77/01-projects/bps/haftalik/hafta-1-prioritization.md`
> **Review:** 27 Nisan Pazar gece, `Vault77/01-projects/bps/haftalik/hafta-1-review.md`

### MUST
- PDF upload V1 ship (sekreter sinyali kaynak; mevcut `documents` tablosu, hard caps: max 200 satır, 3 dosya, 1 commit, 2-3 saat)
- Tenant çekirdek karar (subdomain + auth model + email sender — yazılı dondurma)
- Vercel Pro upgrade (Hobby 1h log retention production blocker)
- Track B: 2 dış görüşme **yapılmış** (Pazar 27 Nisan gece slot lock, Pazartesi 12:00 kontrol)
- Testing Infra Gate (chosen tool + test scope + 5 critical scenarios + 1 executable smoke path)

### SHOULD
- Consulting Module v1 scope yazılı dondur (4 entity: `consulting_engagements`, `consultants`, `time_entries`, `milestones` + anti-goals)
- MODULE_SYSTEM_SPEC.md first draft

### DEFER → Hafta 2

**RoleResolutionRefactor** (Hafta 2-3 aday batch)

AuthContext şu an role'ü `auth.users.raw_user_meta_data.role` JWT claim'inden okuyor, `public.profiles.role` tablosundan değil. Hidden coupling — yeni hesap yaratırken iki ayrı SQL adım (profile insert + user_metadata update) + logout/login şart. Multi-tenant geçişinde tenant başına admin user oluştururken çığ etkisi riski.

Doğru yaklaşım: AuthContext profile tablosunu primary source yapsın, user_metadata.role fallback olsun. Profile değişikliğinin session'a yansıması için refreshSession() pattern'i.

Kaynak: `Vault77/01-projects/bps/notes/debt-authcontext-role-resolution.md`

- MULTI_TENANT_MIGRATION_PLAN.md first draft (tenant çekirdek kararın çıktısına bağlı)

### Operasyonel kurallar
- **Düşme sırası önceden tanımlı:** #4 MODULE_SYSTEM_SPEC → #3 Consulting scope (anlık karar yasak)
- **Hiçbir MUST düşemez;** düşerse hafta başarısız sayılır
- **Sessiz düşürme yok;** gerekçe `Vault77/.../hafta-1-prioritization.md` "Düşme kayıtları" bölümüne yazılır
- **Track B metrik:** saat değil görüşme sayısı (haftada 2 dış görüşme zorunlu)

### Anti-pattern hatırlatıcı (8 haftalık plan red flag listesi — özet)
1. "Önce tam sağlam olsun, sonra kullanıcı"
2. "B&P/PS kullanıyorsa market de kullanır"
3. "Görüşme yapıyoruz ama ödeme konuşmuyoruz"
4. "Landing page güzelleştirdik, validation ilerledi"
5. "Multi-tenant diye admin paneli büyüttük"
6. "Consulting için çok genel yapı kuralım"
7. "Security/ops hardening'i her modülde framework'e çevirelim"

---
## Strategic Direction — 5-Layer Framing

Strategic direction is defined in `03_strategy/BPS_YAPILANMA_PAKETI.md`. This section aligns roadmap reading with its 5-layer framing without erasing delivery history below.

- **Completed foundational work** (below) — Batch 1–10 + post-roadmap strategic workstreams + Faz 0–7 real-data migration + Evre 1 operational closeout. This is the firma-merkezli data backbone.
- **Current transition phase** — mock audit pushdown, pre-launch trust polish, Dashboard / Raporlar truth correction. Goal: honest office-internal usage before widening scope.
- **Next layer direction** — sequenced per Yapılanma Paketi; no new numbered batches are active from this alignment alone.

Five layers from `03_strategy/BPS_YAPILANMA_PAKETI.md`:

1. **Geçiş ve Güven** — Excel → BPS geçişinin güvenli yapılması. Güven kıran mock temizliği, ofis içi pilot, çıktı üretme (PDF / Excel), ilk bileşik firma sağlık sinyali. Active transition phase.
2. **Geri Çağırma ve Çıktı** — kullanıcıyı sisteme geri getiren + değeri dışarı taşıyan katman. Bildirim motoru, in-app bildirim, haftalık digest, yönetim rapor PDF'leri, export yüzeyleri.
3. **Ekonomik Görünürlük** — görünürlükten karar desteğine geçiş. Firma bazlı time tracking (firma bazlı operasyonel emek, not personnel payroll), firma bazlı kârlılık, utilization, kapasite planlama.
4. **Saha ve Büyüme** — operasyonun sahaya ve büyümeye açılması. Dar pipeline (aday firma → aktif firma activation, not generic sales CRM), mobil / PWA, takvim senkronizasyonu, API / webhook.
5. **Predictive / Platform** — bugünü göstermekten yarını öngörmeye geçiş. Predictive firma sağlık skoru, churn / renewal tahmini, automation rules 2.0, AI natural language insight, tenantization.

This layer framing informs future-batch sequencing. It does not override the completed batch history below, the workflow / status / role contracts, or the existing source-of-truth hierarchy. Specific batch activation and scope continue to be defined at batch-framing time.

---

## Completed Batches

### Batch 1 — Foundation
Scope completed:
- shell
- shared primitives
- layout and navigation frame

Included direction:
- `Layout`
- `Sidebar`
- `Topbar`
- `PageHeader`
- `SearchInput`
- `FilterBar`
- `StatusBadge`
- `RiskBadge`
- `DataTable`
- `EmptyState`
- `TabNavigation`

Boundary:
- no business surfaces yet
- no workflow logic yet
- no backend, auth, schema, or API definition

### Batch 2 — Core Backbone
Scope completed:
- `Dashboard`
- `Firmalar Listesi`
- `Firma Detay`
  - `Header`
  - `Genel Bakis`
  - `temel Zaman Cizgisi`
- `Sozlesmeler Listesi`
- `NewCompanyModal`
- `QuickNoteModal`
- `NewContractModal`
- `ModalShell`

Operational result:
- the product backbone became usable
- Company Detail became the main working surface
- Dashboard began routing to real operational surfaces
- `Ticari Ozet` stayed read-only and context-bound

### Batch 3 — Ticari ve Takip Derinligi
Scope completed:
- `Sozlesme Detay`
- `Randevular`
- `Gorevler`
- `Firma Detay` activates:
  - `Sozlesmeler` tab
  - `Randevular` tab
- `Dashboard` links to Batch 3 destinations where appropriate

Operational result:
- contracts became lifecycle objects with detail depth
- appointments became outcome-and-follow-up surfaces
- tasks became a contextual coordination layer
- Company Detail remained central while contract and appointment depth expanded

Binding clarifications preserved in this batch:
- contracts remain lifecycle objects
- completed appointments require result + next action
- tasks remain contextual
- Company Detail remains central

### Batch 4 — Operasyon Derinligi
Scope completed:
- `Personel Talepleri`
- `Aktif Is Gucu`
- `Evraklar`
- `Firma Detay` activates:
  - `Talepler` tab
  - `Aktif Is Gucu` tab
  - `Evraklar` tab
- `Firma Detay > Genel Bakis`:
  - open requests card is real
  - workforce summary card is real
  - missing documents card is real
- `Dashboard` links to Batch 4 destinations where appropriate

Operational result:
- operational demand visibility became real
- workforce mismatch / transfer risk became visible as an operational signal
- document completeness and billing-risk visibility became real
- Company Detail remained central while office operations gained depth

Binding clarifications preserved in this batch:
- `Personel Talepleri` stayed company-bound and operational
- `Aktif Is Gucu` stayed operational and did not drift into HRIS depth
- `Evraklar` stayed completeness/risk-oriented and did not drift into a drive/folder system
- billing-risk visibility stayed operational, not accounting

### Batch 5 — Yonetim Gorunurlugu
Scope completed:
- `Phase 1 — Finansal Ozet`
  - narrowed management-visibility surface
  - 4 KPI cards
  - 1 `ReceivablesSummaryCard`
  - 1 management-visibility banner
  - `yonetici`-only
  - display-only
- `Phase 2 — ticari baski signal integration`
  - additive signal visibility in `Dashboard > Riskli Firmalar`
  - additive signal visibility in `Firma Detay > Risk Sinyalleri`
- `Phase 3 — Raporlar`
  - 5 fixed read-only reports
  - `ReportSwitcher`
  - static period label
- `Phase 4 — Ayarlar`
  - conservative read-only admin/reference surface
  - 7 tabs
  - `yonetici`-only

Operational result:
- the management visibility layer became real without displacing the operational backbone
- company-level commercial pressure visibility became visible in bounded additive form
- reports stayed fixed and read-only
- settings stayed supportive and constrained

Binding clarifications preserved in this batch:
- `Finansal Ozet` stayed management visibility, not accounting truth
- `Raporlar` stayed fixed and read-only, not a BI tool
- `Ayarlar` stayed conservative and did not drift into an admin console or platform builder
- roadmap order and product scope did not change

### Batch 6 — On Sozlesme / Ticari Hazirlik
Scope completed:
- contract-context commercial preparation visibility
- `Sozlesme Detay` `Ticari Hazirlik` section
- lightweight `Firma Detay` enrichment
- timeline enrichment
- `Sozlesmeler Listesi` / `Raporlar` visibility propagation

Operational result:
- upstream commercial-preparation visibility became real inside contract and company context
- contract preparation state became visible without introducing a separate proposal object
- Company Detail remained central while upstream commercial context became easier to trace

Binding clarifications preserved in this batch:
- no separate `teklif` entity was introduced
- no CRM / pipeline drift was introduced
- commercial preparation stayed contract-context visibility, not a separate sales-system layer
- roadmap order and product scope did not change

### Batch 7 — AI-Assisted Structured Entry
Scope completed:
- Company Detail-context note suggestion helper
- Company Detail-context task suggestion helper
- preview -> confirm flow
- existing modal handoff

Operational result:
- structured-entry assistance became real inside Company Detail without displacing the operational backbone
- note and task suggestion stayed review-first and fed into the existing modal/write paths
- Company Detail remained central while structured entry became easier and more consistent

Binding clarifications preserved in this batch:
- no direct prompt-to-write was introduced
- no global copilot or chat surface was introduced
- no timeline suggestion or autonomous behavior was introduced
- roadmap order and product scope did not change

### Batch 8 — Finans Rapor Yukleme / Ozetleme
Scope completed:
- receivables-side accountant-artifact ingestion on `Finansal Ozet`
- simulated upload surface
- mock extraction engine
- section-level review -> confirm
- local visibility update
- shared receivables-side ticari baski feed update
- second-slice extension with `Maas Giderleri` and `Sabit Giderler`
- 6-card `Finansal Ozet` summary completion

Operational result:
- reviewed finance-summary ingestion became real inside the existing management-visibility surfaces
- receivables-side updates now feed the shared ticari baski loop consistently
- expense visibility was extended at summary level without displacing the operational backbone

Binding clarifications preserved in this batch:
- Batch 8 stayed management-visibility ingestion, not accounting software or finance ops
- no payroll engine behavior, profitability calculation, or accounting truth layer was introduced
- no manual re-entry workflow, `Net Gorunum`, or expense breakdown sections were introduced
- roadmap order and product scope did not change

### Batch 9 — Agent Merkezi / AI Yardimcilari
Scope completed:
- dashboard-context `Gunluk Otel E-postasi` draft helper
- company-context payment follow-up draft helper
- template-based generation
- draft-first / copy-first / human-reviewed flow
- no new route
- no new sidebar item
- no sending / scheduling / persistence / communication history

Operational result:
- bounded draft-helper assistance became real across `Dashboard` and `Firma Detay`
- repetitive communication drafting became easier without displacing the operational backbone
- Company Detail remained contextual and Dashboard remained a decision surface

Binding clarifications preserved in this batch:
- Batch 9 did not become a generic AI hub, chatbot, or copilot layer
- no autonomous sending, scheduling, or communication-layer behavior was introduced
- no message tracking/history or communication-product depth was introduced
- roadmap order and product scope did not change

### Batch 10 — Iletisim Katmani
Scope completed:
- `Phase 1`
  - Company Detail-context directed mentions (`bahsetmeler`)
  - lightweight record-context coordination inside `Genel Bakis`
  - sender + recipient + short text + timestamp
  - local demo state only
- `Phase 2`
  - Dashboard-only `Duyurular` section
  - yonetici-authored announcements
  - visible to all roles
  - compact one-directional management-announcement strip
  - local demo state only

Operational result:
- bounded communication became real through record-context coordination in `Firma Detay` and one-directional announcements on `Dashboard`
- Company Detail remained central and Dashboard remained a decision surface
- the communication layer stayed lightweight and support-oriented rather than becoming a product center

Binding clarifications preserved in this batch:
- Batch 10 remained non-chat, non-inbox, and non-messaging-product
- no chat threads / replies / reactions, DM / inbox / presence, or notification / push / badge systems were introduced
- limited group rooms were evaluated and intentionally not activated as part of the completed bounded outcome
- roadmap order and product scope did not change

---

## Future Batch Map
- No additional numbered batches are currently committed beyond Batch 10.
- Later planning remains intentionally captured below without changing roadmap order.

---

## Smoke Bulguları — Açık Kalemler (2026-08-10)

Tenant düzeltme batch'inin (`074e859`) production smoke turunda çıktı. Beş create
yolu 5/5 PASS; aşağıdakiler o turun **yan** bulguları, arıza değil eksik.

### a) Görevler ekranında silme kontrolü yok — ürün eksiği

`tasks_delete` policy'si DB'de var, UI karşılığı yok: ne buton, ne satır menüsü.
Kullanıcı oluşturduğu bir görevi arayüzden kaldıramıyor.

İki sonucu var. Birincisi ürün: sahipsiz iş yasağı olan bir üründe yanlış açılmış
bir görevin kapatılamaması gerçek bir boşluk. İkincisi operasyonel: smoke
turlarının cleanup'ı arayüzden yapılamıyor, elle SQL'e mecbur kalıyor.

Smoke artıkları (`BPS_SMOKE_*`) bilerek silinmedi — SQL'le silinselerdi bu bulgunun
kanıtı da kaybolurdu. **Silme UI'ı yazıldığında cleanup, o özelliğin kendi smoke'u
olur.**

### b) Not oluşturma sonrası liste tazelenmiyor — UX

Not kaydediliyor (DB'de satır var, tenant doğru), ama listeye düşmüyor ve form
açık kalıyor. Kullanıcı kaydın gittiğini sanıp tekrar deneyebilir. Veri kaybı yok.

İlk şüpheli `router.refresh()` eksikliği. Bu yol bu batch'te tarayıcıdan server
action'a taşındı, yani davranış değişikliği taşımanın yan etkisi olabilir —
düzeltmeden önce doğrulanmalı, körlemesine `refresh()` eklenmemeli.

### c) `tasks=2` sürprizi — açık değil, test artefaktı (KAPANDI)

Smoke sırasında beklenmedik ikinci görev satırı görüldü. Çift submit sanıldı,
idempotency açığı şüphesi doğdu. Çözüldü: iki kayıt arasında 36 dakika var — MCP
"timeout" döndürmüş ama çağrı aslında çalışmıştı. Ürün açığı yok, kayıt burada
sadece aynı şüphenin tekrar doğmaması için duruyor.

---

## Tenant Schema-as-Code Turu — Ertelenen Kalemler (2026-08-10)

Faz 1 envanteri ve Faz 2 taslakları sırasında çıktı. Hiçbiri o turun kapsamı
değildi; hepsi bilinçli olarak ertelendi ve burada duruyor ki oturumlar
arasında kaybolmasın.

### d) `financial_summaries` parasal alanları `text` — ertelenmiş tasarım borcu

Tabloda `open_receivable`, `unbilled_amount`, `total_open_receivable`,
`invoiced_this_month`, `total_unbilled`, `total_overdue`, `salary_costs`,
`fixed_costs` — sekizi de **`text`**, `numeric` değil.

`text` para toplama, karşılaştırma ve yuvarlamada sessiz hata üretir:
`'1000' > '999'` string karşılaştırmasında **false** döner, sıralama sözlük
sırasına göre yapılır, toplama için her seferinde cast gerekir ve bozuk bir
değer ancak cast anında patlar.

**Faz 2 bunu `text` olarak kaydedecek** — ilkesi "prod'u olduğu gibi yaz",
düzeltmek değil. Ama kaydetmek onaylamak değildir; bu not tam da Faz 2'nin
borcu meşrulaştırmaması için var. `numeric`'e taşımak ayrı bir karar,
ayrı bir migration ve veri dönüşümü konusu.

### e) `updated_at` garantisi iki tabloda uygulama katmanında

`documents` ve `critical_dates` `updated_at` taşıyor ama trigger'ları yoktu —
ne repo'da ne prod'da; diğer 11 tabloda var. **Veri hatası değildi**: ölçüldü,
uygulama katmanı damgayı doğru atıyordu. Sorun garantinin yeriydi — DB sınırı
yerine uygulama disiplini.

`827957c` ile trigger'lar yazıldı (**prod'a UYGULANMADI**). `tenants` bilerek
dışarıda: tabloyu hiçbir repo migration'ı yaratmıyor, Faz 2 yaratacak;
trigger'ı oraya ait.

Not: `critical_dates`'in uygulama deseni `documents`'inkinden dayanıklıydı —
damga patch nesnesinin ilk alanı, koşullu alanlar üstüne biniyor. `documents`
üç ayrı yolda ayrı ayrı hatırlıyor.

### f) `workforce_summary` mükerrer index — repo kaynaklı

`constraint workforce_summary_one_per_company unique (company_id)` **ve**
`create index workforce_summary_company_id_idx on (company_id)` bir arada
(`20260407000900`). Unique constraint zaten implicit index yaratıyor, düz
index gereksiz.

Prod drift'i **değil**, repo'nun kendi fazlalığı. Ara ölçümde "non-unique"
görünmesi sorgu artefaktıydı (`pg_indexes.indexdef`, unique constraint'in
implicit index'ini `CREATE UNIQUE INDEX` metniyle göstermiyor);
`pg_constraint.contype='u'` ile bütünlüğün yerinde olduğu doğrulandı.

Faz 2 ikisini de olduğu gibi kaydedecek. Temizlik ayrı karar.

### g) G1 gate'i vekil bir nicelik ölçüyor

G1 `count(distinct tenant_id) from companies` sorar ve `1` döndü — doğru.
Ama prod **üç tenant** taşıyor: `partnerstaff` (7 üye / 2 firma), `brothers`
(0/0), `bposgb` (0/0). Kurulum yapısal olarak çok kiracılı, ikisi boş.

Görev assignee picker'ı `profiles`'ı **kapsamsız** okuyor ve `profiles`'ta
tenant kolonu yok. Dolayısıyla asıl tetikleyici "başka tenant'a firma
eklenmesi" değil, **"başka tenant'a üye eklenmesi"** — o an bir tenant'ın
kullanıcıları diğerininkileri picker'da görür.

Bugün ölçülebilir ve daha doğru bir vekil var (gate yazıldığında
`tenant_memberships`'in varlığı bilinmiyordu):

```sql
select count(distinct tenant_id) from tenant_memberships;   -- bugün: 1
```

Gate'ler geriye dönük değiştirilmiyor — ölçüm o gün doğruydu. Kalıcı çözüm
Step 3 (b): `profiles`'a tenant üyeliği ve picker'ın kapsamlanması. G1 anlık
bir ölçüm; değeri kimse yeniden koşmadan değişebilir.

---

## custom_access_token_hook — Okunmuş Davranış ve Bir Tripwire (2026-08-10)

Gövde satır satır okundu (md5 `758af650dcaa`, 1224 char). Karar mantığı:

```
v_count = COUNT(*) ve v_tenant_id = MIN(tenant_id::text)::uuid  (tenant_memberships, user_id ile)
IF v_count = 1 → claims'e active_tenant_id yaz, event'i degistirerek don
v_count = 0 veya > 1 → claim EKLENMEZ, event aynen doner
```

`v_count = 0` veya `> 1` durumunda claim düşer → `current_user_active_tenant()`
NULL döner → 43 tenant koşullu policy **fail-closed** olur.

### Güvenlik `v_count = 1` kapısından geliyor, `MIN`'den değil

`MIN(tenant_id::text)::uuid` deterministik, ama **kullanılan tek dalda zaten
tek satır var** — orada seçecek bir şey yok. MIN, "çoklu arasından seç" işlevi
görmüyor; `COUNT(*)` ile aynı sorguda kolonu çekebilmek için gereken agrega
sarmalayıcısı. (`MIN(uuid)` PostgreSQL'de yok, text cast'i bu yüzden — bilinçli
workaround, temizlenecek hack değil.)

Ayrım önemli: ileride biri "MIN zaten deterministik" diyerek `v_count = 1`
kapısını gevşetirse davranış deterministik kalır ama kullanıcı hangi tenant'ta
olduğunu seçemeden **en küçük uuid'ye kilitlenir** — sessiz ve açıklanamaz bir
atama.

### ⚠ TRIPWIRE — ikinci üyelik erişimi anında kesiyor

Bir kullanıcı ikinci bir tenant'a üye yapılırsa `v_count > 1` olur, claim
düşer, ve o kullanıcı **birinci tenant'taki erişimini de anında kaybeder**.

Fail-closed olması doğru, ama arıza modu görünmez: kullanıcı "iki tenant'a
üyesin" diye bir hata görmez — her şey boş gelir ya da erişim reddedilir.
Tehlikeli olan, **"kullanıcıyı ikinci tenant'a ekle" işleminin idari ve
zararsız görünmesi**; kimse bunun mevcut erişimi kilitleyeceğini beklemez.

Bugün erişilemez (Brothers ve BP OSGB tenant'larının sıfır üyesi var). Tenant
switcher / aktif tenant seçimi geldiğinde bu hook değişmeli — o iş başlamadan
ikinci üyelik verilmemeli.

### Faz 2 için kısıt: kısmi gövdeyle yazılamaz

Okuma sırasında 4 satır araç tarafından bloklandı (user_id extraction, uuid
cast, WHERE, claims COALESCE). İskelet ve karar mantığı tam, ama migration
**tahminle tamamlanamaz**: taslaktaki md5 drift guard'ı prod gövdesinin
hash'ini bekliyor, dolayısıyla kendi yazdığımız "standart" satırlar guard'ı
kendi migration'ımıza karşı çalıştırır. Tam metin şart — guard'ın amacı zaten
tahmine dayalı yeniden kurgulamayı imkânsız kılmaktı.

---

## A (Firmasız Görev/Randevu) — Ölçülmüş Maliyet (2026-08-10)

`trg_tasks_validate_linked_fks` ve `trg_appointments_validate_linked_fks`
gövdeleri okundu. **A ucuz: yardımcı fonksiyonları değiştirmeye gerek yok,
kolonu nullable yapmak yeterli.** A, Step 3 kalemi olarak kalabilir; kendi
migration'ını istemiyor.

`validate_same_company_contract(p_contract_id, p_expected_company_id)` sırası:

1. `p_contract_id IS NULL` → `RETURN true` (bağ yoksa geç)
2. sözleşme bulunamazsa → `RAISE 'Linked contract % does not exist'`
3. `v_contract_company_id != p_expected_company_id` → `RAISE 'Cross-company...'`

`company_id` NULL geldiğinde: adım 2 **çalışmaya devam eder** (parametreye
dokunmuyor), adım 3 ise `X != NULL` → NULL → IF ateşlemez → sessizce geçer.

### A'nın migration yorumuna yazılacak

> Firmasız kayıtta (`company_id IS NULL`) bağlı FK'nın **varlık** doğrulaması
> çalışmaya devam eder — var olmayan bir `contract_id`/`appointment_id` yine
> reddedilir. Sessizce atlanan yalnız **cross-company sahiplik** kontrolüdür:
> `X != NULL` NULL döner ve IF ateşlemez. Bu bir boşluk değil, sorunun tek
> makul cevabı — firma yokken "aynı firmaya mı ait" sorusunun anlamı yoktur.
> Endişe davranışta değil görünürlükte: yardımcıya
> `IF p_expected_company_id IS NULL THEN RETURN true; END IF;` eklemek
> davranışı değiştirmez ama niyeti kodda görünür kılar. Ayrı karar.

### Yöntem notu — üçüncü yanıltıcı ölçüm

`comp_null=true` sonucu `p_expected_company_id`'yi değil, gövdedeki
`v_contract_company_id IS NULL` satırını yakalamıştı. Bu, aynı gün içindeki
üçüncü yanıltıcı gövde ölçümü (`raises=false` ve `RETURN NULL` sanısından
sonra). Ders yalnız "grep çağrılanları görmez" değil: **identifier üzerinde
substring eşleşmesi, adları benzeyen farklı değişkenleri birbirine karıştırır.**
Gövde okunmadan davranış iddiası kurulmamalı.

Uzun gövdeler artık okunabiliyor — satır bazında bölerek:

```sql
select ln, txt from (
  select row_number() over () ln, txt
    from pg_proc p, regexp_split_to_table(p.prosrc, E'\n') txt
   where p.proname = 'X'
) s where btrim(txt) <> '' order by ln;
```

---

## Faz 2 Envanter Yöntemi — Filtreleme Değil, Tam Sayım (2026-08-10)

Envanter üç turda üç kez eksik çıktı, ve üçü de aynı sebepten:

1. tablo / fonksiyon / policy sayıldı → **trigger'lar** kaçırıldı
2. trigger'lar eklendi → **trigger'ların çağırdığı yardımcı fonksiyonlar** kaçırıldı
   (`validate_same_company_contract`, `validate_same_company_appointment` —
   ikisi de repo'da yok, prod'da var, `tasks`/`appointments` trigger'ları
   tarafından çağrılıyor)
3. dördüncü bir kategorinin daha çıkacağını varsaymak makul

**Kök sebep: filtreleyerek sayıyoruz.** "Tenant fonksiyonları (3)" diye
ölçüldü — arayarak, listeleyerek değil. Bu iki yardımcı o filtreye takılmadı
çünkü adlarında `tenant` geçmiyor.

**İkinci kör nokta, aynı sınıftan:** bir fonksiyonun gövdesinde arama yapmak
(`prosrc ilike '%raise%'`) o fonksiyonun ÇAĞIRDIKLARINI görmez. PL/pgSQL
gövdesi düz metindir. `trg_tasks_validate_linked_fks` "RAISE yok" ölçüldü;
gerçekte RAISE alt fonksiyondaydı ve trigger satırı gerçekten reddediyordu.
Bu oturumda "şu fonksiyon tenant kontrolü yapıyor mu / rol geçidi var mı"
sorularının hepsi aynı zaafı taşıyor.

**`pg_depend` bunu çözmez** — Postgres, PL/pgSQL gövdesindeki fonksiyon
çağrılarını bağımlılık olarak kaydetmez. Çağrı grafiği oradan çıkarılamaz.

### Yapılacak: her kategoride TAM sayım, sonra repo ile diff

```sql
-- fonksiyonlar (repo'da 18 tane var; fark = repo-dışı)
select p.proname, p.pronargs, length(p.prosrc) as uzunluk, md5(p.prosrc) as md5
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' order by p.proname;
```

Aynısı tablolar, policy'ler, trigger'lar, index'ler ve constraint'ler için.
Tanımı gereği eksiksiz olur; çağrı grafiği çıkarmaya gerek kalmaz.

**Faz 2'nin "envanter tamam" iddiası bu sayım yapılana kadar güvenilir
değildir.**

---

## B Batch — Codex Review Sonrası Açık Kalemler (2026-08-10)

`06e6922..ab5c3b1` review'ından üç Medium. Must-fix yok, push serbest verildi;
bunlar ayrı dar bir batch.

### h) `NewCompanyModal.resetAndClose()` `saving`'i yok sayıyor

Escape / X / overlay tıklaması, `createCompanyAction()` **uçuştayken** modalı
kapatabiliyor. Kullanıcı "iptal ettim" sanıyor ama istek sürüyor: firma
yaratılıp seçilebiliyor.

`47cb056`'da düzelttiğimiz hatanın **kardeşi** — orada Escape formu siliyordu,
burada Escape iptal ettiğini sandırıyor ama etmiyor. Aynı kök: kapatma yolları
uçuştaki işi hesaba katmıyor. `NewRequestModal.resetAndClose()` `if (saving)
return;` ile korunuyor, yani emsal zaten kod tabanında var.

### i) `sector` sunucuda doğrulanmıyor — import yoluyla asimetri

`createCompany` / `createCompanyAction` `sector`'ü serbest metin olarak kabul
ediyor. UI `SECTOR_CODES` ile kısıtlıyor ama action doğrudan çağrılabilir.

Asimetri şurada: **import yolunda allow-list VAR** (`ALLOWED_CATEGORIES`
deseninin sektör karşılığı), inline create yolunda yok. Aynı listeyi buraya
taşımak yeterli.

### j) `legacy_mock_id` / `id` anahtar uyuşmazlığı — mükerrer görünüm

Form listesi `legacy_mock_id ?? id` ile kuruluyor
(`randevular/page.tsx:344`), in-session merge ise gerçek `id` ile de-dupe
ediyor. Yeni yaratılan firmada `legacy_mock_id` olmadığı için sorun çıkmıyor;
**mükerrer uyarısından "Bunu seç"** ile mevcut bir firma seçilince o firma
dropdown'da iki kez görünebilir (bir kez `f2`, bir kez UUID).

Yazma çalışıyor — resolver UUID kabul ediyor — yani veri hatası yok, görünüm
hatası var. `a193f48`'in commit mesajındaki "de-dupes by id" ifadesi bu yüzden
eksik: de-dupe anahtarı taban listenin anahtarıyla her zaman aynı değil.
Ya de-dupe aynı anahtara hizalanmalı, ya iddia düzeltilmeli.

---

## Lint Yok — Açık Karar (2026-08-10)

`npm run lint` bu projede çalışmıyor: ESLint kurulu değil, config dosyası yok,
`package.json`'da bağımlılık yok, `next.config.ts`'te ayar yok. Komut yalnız
interaktif kurulum sihirbazı açıyor. Dolayısıyla **`next build` de lint
yapmıyor** — "build geçti" ifadesi tip kontrolü + derleme demek, statik kod
analizi değil.

Bu bir kusur değil bir boşluk: kimse ESLint'i kaldırmamış, hiç kurulmamış.
`qa:static` bu boşluğun bir kısmını kapatıyor (14 özel kural) ama genel amaçlı
bir linter'ın yerini tutmuyor.

**Karar gerekiyor:** ESLint kurulacak mı? Olgun bir kod tabanına sonradan
eklemek çok sayıda bulgu üretir; kurulacaksa kapsam (yalnız yeni kod mu, tümü
mü) ve severity baştan kararlaştırılmalı. Kurulmayacaksa bu not, "neden lint
yok" sorusunun cevabı olarak durur.

---

## qa:static Kural Adayı — Ölü Bileşen Tespiti (2026-08-10)

B batch'i sırasında `NewCompanyModal`'ın bir mock kalıntısı olduğu ortaya çıktı:
submit'i `console.log` atıp kapanıyordu, hiçbir şey kaydetmiyordu, ve hiçbir
ekrandan açılmıyordu. Mock temizliğinden sağ kalmıştı çünkü `@/mocks`'tan
**import etmiyordu** — sadece kaydetmiyordu.

**Kör nokta:** mevcut tarama import grafiğine bakıyor, davranışa değil. Hiçbir
şeye bağlı olmayan, sahte veri de kullanmayan, sadece hiçbir şey yapmayan bir
bileşen görünmez kalıyor.

### Kuralı yazacak kişiye: naif hali bu vakayı KAÇIRIR

"Export edilmiş ama hiçbir yerden import edilmemiş bileşen" yetmez.
`src/components/modals/index.ts` şunu içeriyor:

```ts
export { default as NewCompanyModal } from "./NewCompanyModal";
```

Yani dosya *import edilmiş* görünür ve kural onu geçirir. Barrel dosyası, ölü
olan her bileşeni tüketici varmış gibi gösterir.

**Kuralın barrel re-export'larını tüketici saymaması gerekiyor:** gerçek soru
"bu bileşeni bir ekran ya da başka bir bileşen render ediyor mu", "bir
`index.ts` onu yeniden ihraç ediyor mu" değil.

### İkinci kural adayı — `CREATE TABLE` başına `ENABLE ROW LEVEL SECURITY`

Tam sayım prod'da `ensure_rls` adlı bir **event trigger** ortaya çıkardı
(`ddl_command_end`, `rls_auto_enable` fonksiyonunu çağırıyor): yeni yaratılan
tabloda RLS'i otomatik açıyor. Repo'da yok — beşinci repo-dışı kategori,
`pg_event_trigger` daha önce hiç sorgulanmamıştı.

Ölçüldü: repo'nun yarattığı **17 tablonun 17'sinde** açık
`ENABLE ROW LEVEL SECURITY` var. Yani repo bu event trigger'a GÜVENMİYOR ve
mevcut tablolar taze ortamda güvende.

**Asıl risk parite değil, ASİMETRİ.** Aynı hata iki ortamda farklı davranıyor:
biri `ENABLE RLS` yazmayı unutursa prod'da event trigger sessizce düzeltir,
taze ortamda tablo RLS'siz kalır. Hata prod'da hiç görünmez, demo/dev'de
sessizce güvenlik aleyhine sapar.

Event trigger'ı Faz 2'ye almak pariteyi sağlar ama KORUMA sağlamaz — çalışma
zamanına bağlı kalır. Statik kural daha güçlü:

> Her `CREATE TABLE` için eşleşen bir `ENABLE ROW LEVEL SECURITY` bulunmalı.

Review anında patlar, hiçbir ortamın davranışına bağlı değil, ve bugün 17/17
geçtiği için kural yeşil başlar — yalnız regresyonu yakalar. FAIL olabilir.

İkisi birden yapılmalı: parite için event trigger Faz 2'ye, koruma için bu
kural qa:static'e.

### Kapsam notu

İkinci sinyal (`console.log` atıp kapanan submit) daha dar ama daha kesin.
İkisini birleştirmek yerine ayrı kurallar olarak düşünmek daha iyi olabilir:
biri ulaşılabilirlik, diğeri sahte-kalıcılık. Ulaşılabilirlik kuralı yanlış
pozitif üretmeye açık (yeni yazılmış, henüz bağlanmamış bileşen), o yüzden
muhtemelen WARN; sahte-kalıcılık kuralı daha net, FAIL olabilir.

---

## Later Planning Notes
These items capture Partner Staff / BPS-specific post-roadmap workstreams and future planning notes.
They do not change the historical numbered roadmap order.
Some are active as bounded strategic workstreams after the numbered roadmap batches.
Others remain intentionally saved until an explicit future planning pass activates them.

### Sehir + Altinda Operasyon Partnerleri ile Operasyon Sahipligi Gorunurlugu
Positioning:
- post-roadmap strategic workstream
- organizational ownership visibility layer across city -> partner structure
- completed through four bounded phases

Intent:
- make organizational ownership easier to see across city/partner operating context
- support later management visibility without displacing Company Detail as the product center

Progress note:
- Phase 1 completed:
  - city + partner mock/data layer
  - `SEHIRLER`
  - `OPERASYON_PARTNERLERI`
  - `FIRMA_PARTNER_MAP`
  - `Ayarlar` page enrichment with:
    - `Sehirler`
    - `Operasyon Partnerleri`
  - read-only dictionary pattern only
- Phase 2 completed:
  - `Firmalar Listesi` partner visibility
  - partner filter in `Firmalar Listesi`
  - `Firma Detay` header partner metadata
  - lookup via existing `FIRMA_PARTNER_MAP`
  - additive metadata only
- Phase 3 completed:
  - `Raporlar`
  - one new report:
    - `Sehir ve Partner Operasyon Ozeti`
  - partner -> city -> portfolio hierarchy
  - per-partner rows
  - per-city subtotals
  - portfolio total
  - bounded receivables-side ticari gorunurluk kirilimi only:
    - `Alacak Yogunlugu`
    - `Kesilmemis Baski`
    - `Gecikmis Firma Yogunlugu`
  - yonetici-only visibility
  - unique row identity + hierarchy-preserving non-sortable structure
- Phase 4 completed:
  - `Dashboard` lightweight geographic concentration signal
  - inside existing `Riskli Firmalar` card only
  - only appears when meaningful concentration exists
- Boundaries preserved:
  - map visualization
  - new dashboard sections
  - expense-side rollup
  - profitability / pricing / accounting-truth behavior
  - access-control changes
  - partner performance scoring
  - partner detail pages
  - commercial rollup

### Partner Staff C-Level Visibility Layer
Positioning:
- post-roadmap strategic workstream
- management reporting / visibility enhancement focused on active firms, active workforce, open demands, critical firms, ticari baski concentration, overloaded city/partner nodes, and concentration risk
- completed through one bounded phase

Intent:
- provide higher-level Partner Staff management summary once the current roadmap layers are stable
- remain a bounded visibility enhancement, not a separate product track
- closed at Phase 1 because the core portfolio-health visibility gap was already solved and further expansion would add limited value while increasing summary inflation / BI drift risk

Progress note:
- Phase 1 completed:
  - `Finansal Ozet` page only
  - one compact `Portfoy Saglik Ozeti` card at the top of the page
  - present-state signals only:
    - `Aktif Firma`
    - `Aktif Is Gucu`
    - `Acik Talep`
    - `Kritik Firma`
    - `Portfoy Alacak Baskisi`
    - `En Yogun: {sehir} - {partner}`
    - `Ticari baski tasiyan` firms
  - yonetici-only visibility
  - no new route
  - no new page
  - no charts / BI-style analytics
  - no trend / delta / worsening logic
  - no drilldown
- Closeout decision:
  - no Phase 2 was opened
  - the workstream closes at Phase 1
  - wider portfolio-health expansion was intentionally not activated

### Proje Ticari Kalite / Tahmini Karlilik Gorunurlugu
Positioning:
- post-roadmap strategic workstream
- commercial-quality visibility layer using worker-type cost assumptions, billed unit price, estimated gross margin band, and low-margin warnings
- explicitly not accounting truth
- completed through one bounded phase

Intent:
- support commercial-quality visibility around project pricing quality
- remain bounded as management/commercial visibility rather than accounting software
- closed as a compact Company Detail-first visibility layer because the core visibility gap was already solved there and wider propagation would add limited value while increasing pricing-engine / analytics drift risk

Progress note:
- Phase 1 completed:
  - `Company Detail` only
  - `Genel Bakis`:
    - compact `Tahmini Ticari Kalite` card
    - role-gated to `yonetici` and `partner`
  - `Sozlesmeler` tab:
    - per-contract `MarginBandBadge`
    - role-gated to `yonetici` and `partner`
  - flat mock position-type assumptions only
  - user-facing surfaces show only band labels:
    - `saglikli`
    - `dar`
    - `riskli`
  - no raw assumption numbers exposed
  - no `Dashboard` changes
  - no `Finansal Ozet` changes
  - no `Raporlar` changes
  - no `Ayarlar` changes
  - no new routes or pages
- Accepted Phase 1 limitation:
  - contract-level badges currently use a firm-level worst-band proxy rather than truly contract-linked inputs
- Closeout decision:
  - no Phase 2 was opened
  - the workstream closes at Phase 1
  - wider propagation was intentionally not activated

### Ticari Hesap Motoru + Parametre Seti Yonetimi
Positioning:
- post-roadmap strategic workstream
- compact `Company Detail`-centered decision-support calculator
- completed through one bounded phase

Core framing:
- one hidden active parameter set only
- stateless reactive calculation only
- not payroll / accounting / ERP software
- not a pricing-admin surface
- not a spreadsheet replacement
- no free-form formula editor

Progress note:
- one bounded phase completed:
  - `Company Detail` only
  - `Genel Bakis` only
  - compact inline `Teklif Hesaplayici`
  - role-gated to `yonetici` and `partner`
  - user-facing inputs:
    - required:
      - `Net Ucret (gunluk)`
      - `Hedef Kar Orani (%)`
    - optional secondary inputs:
      - `Ek Odeme`
      - `Yemek`
      - `Servis`
      - `Kiyafet`
  - outputs:
    - `Tahmini Isveren Maliyeti`
    - `Onerilen Teklif Bedeli (KDV Haric)`
- Boundaries preserved:
  - no parameter-management UI
  - no admin reference panel
  - no effective-date logic
  - no parameter history / versioning
  - no payroll breakdown visibility
  - no tax / SGK branch breakdown visibility
  - no verification layers in UI
  - no quotation-document generation
  - no saved calculations / history / persistence
  - no report integration
  - no `Dashboard` integration
  - no `Finansal Ozet` integration
  - no free-form formula editing
- Implementation note:
  - the active parameter set is hidden and hardcoded for the bounded phase
  - the tool remained decision-support only
  - audit closed with no material findings
- Future wording refinement preserved:
  - any later expense-side parameter/output framing should prefer `Proje Gideri` language
  - lower-level cost breakdowns should be read as accountant-provided summary inputs, including uploaded Excel / report artifacts where relevant
  - this does not activate any new scope or change roadmap order

### Birimler Arasi Koordinasyon / Yonlendirme Katmani
Positioning:
- post-roadmap strategic workstream
- Partner Staff / BPS-specific organizational-coordination layer
- completed through one bounded phase

Core framing:
- not free-form messaging
- not a Slack/chat clone
- not DM/channels
- not a replacement for tasks
- role remains authorization
- unit remains organizational affiliation

Intent:
- add organizational-unit-based coordination on top of roles
- enable record-context directed routing between units such as operasyon, partner, muhasebe, and yonetim
- clarify cross-unit ownership, bottlenecks, and pending coordination across firms, contracts, demands, and tasks
- remain bounded as a coordination/routing layer rather than becoming a messaging or inbox product
- close at Phase 1 because the core firma-context coordination visibility gap was already solved and wider propagation would add limited value while increasing per-row complexity, `Dashboard` signal inflation, inbox emergence, and primitive blurring risk

Progress note:
- Phase 1 completed:
  - `Company Detail` only
  - `Genel Bakis` only
  - one compact `Bekleyen Yonlendirmeler` section
  - firma-attached routing only
  - create + resolve lifecycle only
  - local demo state only
  - unit-to-unit routing with:
    - `bekliyor`
    - `tamamlandi`
  - no new route
  - no new sidebar item
- Primitive distinction preserved:
  - note = information
  - routing = unit handoff
  - task = owned work
- Boundaries preserved:
  - no `Dashboard` count/signals
  - no propagation into `Sozlesmeler`, `Talepler`, `Evraklar`, or `Gorevler`
  - no inbox / thread / reply / reaction behavior
  - no notification / unread / badge behavior
  - no `Ayarlar` unit-management UI
  - no new authorization role
- Closeout decision:
  - no Phase 2 was opened
  - the workstream closes at Phase 1
  - wider propagation was intentionally not activated

### Yonetici Inisiyatifleri / Ozel Takip Katmani
Positioning:
- post-roadmap strategic workstream
- bounded yonetici-only attention-bookmark layer
- completed through one bounded phase

Primitive framing:
- yonetici-owned attention bookmark
- not where work is done
- not where tasks are managed

Progress note:
- one bounded phase completed:
  - `Dashboard` only
  - yonetici-only compact `Yonetici Inisiyatifleri` section
  - local demo state only
  - optional one-line cue in `Company Detail > Genel Bakis` when a linked initiative is active
  - fields:
    - `Baslik`
    - `Kisa amac`
    - `Ilgili kisi`
    - `Hedef tarih`
    - optional single `Firma`
    - `Yonetici notu`
- Boundaries preserved:
  - no new route
  - no new sidebar item
  - no kanban / board / gantt / sprint / workspace behavior
  - no subtasks / child items / milestones / dependencies
  - no task integration
  - no report integration
  - no file attachments
  - no tags / categories / priorities
  - no history / archive / completed-items page
  - no overdue logic, escalation, or reminders
- Audit note:
  - phase closed with tiny notes only
  - optional later polish could hide or reduce visible inactive-strip / `iptal` presence if stricter minimalism is desired, but no blocker exists

### Role Model Extension — IK
Positioning:
- bounded role-extension phase
- adds `ik` as the 5th BPS role
- narrow document-compliance / personnel-completion role
- completed through one bounded phase

Core framing:
- not a broad HR role
- not recruitment
- not leave / bordro / performance
- not a management role
- not a commercial role
- role exists because operasyon sees personnel/document gaps and IK is the real operator who completes them

Progress note:
- one bounded phase completed:
  - `ik` added to `UserRole` union, `VALID_ROLES`, `BirimKodu`, `birimFromRole()`
  - sidebar filtered: `Dashboard`, `Firmalar`, `Aktif Is Gucu`, `Gorevler`, `Evraklar`, `Raporlar`
  - `Company Detail` tab filtering: `Genel Bakis`, `Evraklar`, `Talepler` (read-only), `Aktif Is Gucu` (read-only)
  - `Company Detail > Genel Bakis`: operational cards 1-5 + Son Notlar + Bahsetmeler + Yonlendirmeler
  - hidden from IK: `Ticari Ozet`, `Risk Sinyalleri`, `Ticari Kalite`, `Ticari Temas`, `Teklif Hesaplayici`, yonetici-only cues
  - `Evraklar` main page: full access (upload, update validity)
  - `Aktif Is Gucu` main page: read-only
  - `Gorevler` main page: bounded execution (view, create, change status, no reassignment)
  - `Raporlar`: `is-gucu` report only
  - blocked from: `Sozlesmeler`, `Sozlesme Detay`, full `Talepler` page, `Randevular`, `Finansal Ozet`, `Ayarlar`
- Boundaries preserved:
  - no HR-software depth
  - no recruitment, leave, payroll, or performance surfaces
  - no commercial tool access
  - no financial visibility
  - no management-layer access
  - task reassignment explicitly blocked for IK
- Future note:
  - `muhasebe` remains a separate future role-extension phase
  - `muhasebe` is not implemented and should not be assumed as committed

### Auth Foundation Phase 2A — Access Request + Admin Approval Flow
Positioning:
- bounded auth-infrastructure phase
- onboarding-friction reduction step
- completed and production-verified

Core framing:
- not open self-signup
- not automatic account activation
- not public registration
- not invitation automation
- a controlled request -> admin review -> later manual user creation model

Progress note:
- completed and production-verified:
  - login page includes inline access-request toggle
  - request form fields: `Ad Soyad`, `E-posta`, `Birim` (Operasyon / Satis / IK / Muhasebe / Diger)
  - `Birim` is a request hint only, not the final approved BPS role
  - `Ayarlar` includes `Erisim Talepleri` tab (yonetici-only)
  - yonetici can review pending requests and mark them `onaylandi` or `reddedildi`
  - reviewed items visible as processed history
  - duplicate pending requests by same email are blocked at the data layer
  - yonetici-only review enforced at both application level and RLS policy level
  - anon request submission exists only for the bounded request form
  - approval does NOT create real auth users automatically
  - real user creation remains a manual Supabase dashboard step after approval
- Boundaries preserved:
  - no open self-signup or public registration
  - no automatic auth-user creation on approval
  - no invitation email flow
  - no password-reset flow
  - no broader identity-management or user-lifecycle platform
  - non-yonetici roles remain blocked from Ayarlar and from the review surface
  - existing login flow and session behavior remain unchanged

### Firma Yetkili Kisileri
Positioning:
- bounded Company Detail enhancement
- firm-scoped contact visibility and continuity
- completed through one bounded phase

Core framing:
- not a CRM module
- not a global contacts system
- not a people directory
- not a contact-history or relationship-timeline surface
- compact, firm-scoped, company-centered

Progress note:
- one bounded phase completed:
  - `Company Detail` only
  - `Yetkililer` tab activated (previously disabled stub)
  - up to 5 yetkili per firma
  - exactly one `ana yetkili` per firma
  - fields: `adSoyad`, `unvan`, `telefon`, `eposta`, `anaYetkili`, `kisaNotlar`
  - at least one of telefon/eposta required
  - `kisaNotlar` is a short context annotation only, not a thread or history
  - role-gated:
    - `yonetici`: view / add / full edit / ana yetkili management
    - `partner`: view / add / full edit / ana yetkili management
    - `operasyon`: view / phone-email-only edit
    - `ik`: no access
    - `goruntuleyici`: no access
  - ana yetkili consistency: draft generators within Company Detail derive from live yetkililer state
  - local demo state only
- Boundaries preserved:
  - no global contacts page
  - no new route or sidebar item
  - no CRM or contact-history behavior
  - no dashboard or reporting expansion
  - no relationship timeline
  - no sector-filter work needed (Firmalar Listesi sector filtering already existed)

### Ic Operasyon Talepleri / Onay Katmani
Positioning:
- later future work after current roadmap phases
- Partner Staff / BPS-specific internal-operations support layer
- not current committed batch scope

Core framing:
- not a full HR leave-management system
- not a full purchasing/procurement system
- not payroll / ERP software
- prioritize only internal requests with clear operational impact
- keep it narrow, approval-oriented, and support-layer only

Intent:
- add a later internal-operations request layer
- cover narrow, operations-relevant internal requests such as `izin talebi` and `satin alma talebi`
- frame them as support workflows with operational impact and coordination value
- remain saved intentionally until an explicit future planning pass activates it

### Oneri / Hata Bildir
Positioning:
- later future note after current roadmap phases
- bounded internal rollout-learning feedback intake surface
- not current committed batch scope

Core framing:
- not a helpdesk system
- not a ticketing platform
- not a request-tracking workflow
- not a chat/comment layer
- not a second task system
- keep it lightweight, bounded, and rollout-learning oriented

Intent:
- capture internal rollout bugs and suggestions before they are lost across verbal/chat channels
- keep feedback intake lightweight without expanding BPS into support-tool behavior
- remain saved intentionally until an explicit future planning pass activates it

Desired later behavior:
- name: `Oneri / Hata Bildir`
- type:
  - `Hata`
  - `Oneri`
- current screen/module context captured or selectable
- short title
- description
- priority:
  - `Dusuk`
  - `Normal`
  - `Yuksek`
- optional screenshot
- yonetici can review submissions

Boundaries preserved:
- no threaded replies
- no assignee workflow
- no SLA/support queue
- no `my request status` lifecycle
- no inbox/helpdesk behavior

### Gorev Talebi / Acik Ustlenilebilir Is
Positioning:
- later future note after current roadmap phases
- revisit only after Migration Phase 3 / real task activation
- not current committed batch scope

Core framing:
- not a permanent open work board
- not a marketplace
- not a bidding system
- not a cross-unit free-for-all
- not a second communication layer

Intent:
- cover a bounded task-request / open-claimable-work start mode only after real task truth exists
- keep temporary open work from getting lost before a clear owner takes responsibility
- preserve explicit ownership once work is claimed

Desired later behavior:
- two start modes:
  - assigned task
  - task request / open claimable work
- open task request remains temporary
- when claimed, it becomes a normal assigned task
- first version stays bounded by unit / relevant role pool
- no cross-unit open labor market behavior

### Gorev Yuku / Is Kapanis Gorunurlugu
Positioning:
- later future note after current roadmap phases
- revisit only after real task truth exists
- not current committed batch scope

Core framing:
- not person performance scoring
- not employee ranking
- not leaderboard behavior
- not HR performance management
- not payroll / bonus decision logic

Intent:
- show where task load is concentrating
- show where overdue work is clustering
- show closure / carrying patterns
- help management identify operational bottlenecks without turning BPS into a people-rating system

Desired later visibility:
- current open task count by person
- completed task count in last 7 / 30 days
- overdue task count by person
- stagnant assigned task count
- unclaimed open task requests
- task load by unit
- task load by partner portfolio

Boundaries preserved:
- no employee score
- no success percentage score
- no ranking table / leaderboard
- no good/bad worker labels
- no HR performance management drift
- no activation before real task truth exists

### Cografi Gorsellestirme Katmani / Turkiye -> Sehir -> Operasyon Noktalari
Positioning:
- later enhancement after the city -> partner ownership visibility work is already established
- Partner Staff / BPS-specific later visualization note
- not current committed batch scope

Core framing:
- not a GIS platform
- not a live dispatch / field-ops system
- not a map-centric main product experience
- not real-time location tracking
- must remain a later management / visibility enhancement only

Desired later behavior:
- Turkey map with city-level hover summaries
- click into a city
- city-level map with project / operation points and compact summaries
- record detail remains secondary to the existing core product surfaces

Intent:
- add a later visualization layer on top of the city -> partner ownership visibility work
- allow a Turkey-level geographic lens
- allow city drilldown
- allow visibility of project / operational points within a selected city
- show summary-first management visibility rather than map-first operational control
- remain saved intentionally until an explicit future planning pass activates it

### Ticari Temas / Outbound Draft Katmani
Positioning:
- post-roadmap strategic workstream
- Partner Staff / BPS-specific commercial-draft support layer
- completed through one bounded phase

Core framing:
- not a CRM
- not a shared inbox
- not a campaign tool
- not inbound-reply handling
- not automatic sending in first versions
- outbound draft generation first, external sending only
- outreach visibility can come before any deeper email infrastructure

Intent:
- support a bounded commercial-contact helper layer tied to existing firm relationships
- keep the layer draft-first and human-approved
- close through one bounded phase because the core firm-context outreach draft need was already covered without requiring broader CRM or communication infrastructure

Progress note:
- one bounded phase completed:
  - `Company Detail` only
  - `Genel Bakis` only
  - compact `Ticari Temas` action strip
  - two draft types only:
    - `Yeniden Temas`
    - `Odeme Takibi`
  - role-gated to `yonetici` and `partner`
  - plain text drafts only
  - generate -> preview -> copy pattern only
- Boundaries preserved:
  - no `tanisma maili`
  - no sending
  - no inbound reply handling
  - no communication history / persistence
  - no recipient management
  - no CRM / campaign behavior
  - no `Dashboard` integration
  - no new route or sidebar item
- Important implementation note:
  - the existing Batch 9 payment-follow-up helper remained untouched
  - the new `Odeme Takibi` entry point reused the same underlying generation logic
- Audit note:
  - workstream closed with tiny notes only
  - accepted tiny note:
    - `Odeme Takibi` currently has dual entry points (`Risk Sinyalleri` + `Ticari Temas`), which is acceptable for the bounded phase and may be consolidated later only if stricter single-surface draft access is desired

---

## Operational Problem Mapping

### Incomplete / late documents causing billing delays
Primary batch:
- `Batch 4 — Operasyon Derinligi` -> completed

Why:
- `Evraklar`
- checklist visibility
- missing / invalid / late document states
- operational billing-risk visibility tied to company and contract context

### Unauthorized staff transfers causing non-billable labor
Primary batch:
- `Batch 4 — Operasyon Derinligi` -> completed

Why:
- `Aktif Is Gucu`
- workforce mismatch visibility
- transfer-risk visibility
- branch/company-level operational risk detection

### Branch inconsistency / Recruiter dependency
Primary batches:
- `Batch 4 — Operasyon Derinligi` -> partially addressed
- `Batch 7 — AI-Assisted Structured Entry` -> completed

Why:
- Batch 4 made demand, workforce, and document operations visible and more standardized
- Batch 7 reduced structured-entry inconsistency through bounded Company Detail-context review-first suggestion flows

### Payment vs billable mismatch / hidden cost pressure
Primary batches:
- `Batch 5 — Yonetim Gorunurlugu` -> completed
- `Batch 8 — Finans Rapor Yukleme / Ozetleme` -> completed

Why:
- Batch 5 created the first bounded management visibility surfaces
- Batch 8 completed the first reviewed finance-summary ingestion loop that feeds those visibility surfaces

### Blurred IK-bordro-muhasebe ownership
Primary foundation:
- `Batch 3 — Ticari ve Takip Derinligi`
- `Batch 4 — Operasyon Derinligi`

Primary management visibility batch:
- `Batch 5 — Yonetim Gorunurlugu` -> completed

Why:
- Batches 3 and 4 made follow-up, demand, workforce, and document pressure visible inside one operational backbone
- Batch 5 clarified higher-level pressure and ownership boundaries through bounded management visibility
- this must stay visibility-first and must not become payroll/accounting software

### Repetitive daily hotel emails and payment inquiries
Primary batch:
- `Batch 9 — Agent Merkezi / AI Yardimcilari` -> completed

Why:
- repetitive office support is best addressed after core operational records are stable
- draft-first agent support should exist before any broader communication layer

---

## Ordering Rationale
The order exists for product-discipline reasons:

1. operational backbone first
- the company-centered backbone must exist before depth or automation makes sense

2. operational depth next
- demand, workforce, document, contract, appointment, and task reality must be visible before management layers deepen

3. management visibility after that
- `Finansal Ozet`, `Raporlar`, and control surfaces are safer after the operational center is stable

4. AI and automation after core surfaces exist
- AI should improve an already-structured system, not compensate for missing product structure
- automation should follow stable workflow surfaces, not substitute for them

5. communication last
- communication should support records and workflows after those records already exist cleanly

This order protects BPS from drifting into:
- generic CRM
- full HRIS
- ERP/accounting software
- chat product

---

## Final Reminder
This roadmap consolidates completed work, the current focus, and future sequencing.
It should help implementation planning stay aligned with the real operational pain points BPS is trying to solve.

If this file conflicts with workflow, status, or role rules, the rule documents win.
