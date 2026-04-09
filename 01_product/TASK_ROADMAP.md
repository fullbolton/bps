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

Role-model migration note:
- `partner` replaces `satis` in the final accepted role model
- authorization is now interpreted as `rol + kapsam`, not role-only
- real-data migration will require partner -> portfolio / firma mapping so scoped access can be enforced
- `goruntuleyici` remains as the bounded read-only role

Real-data migration state:
- `Faz 0 — Altyapi + Profiles + Kesif` -> completed
- `Faz 1A — Yetkililer + minimal company identity anchor` -> completed
- `Faz 1B — Notlar` -> completed
- `Faz 2 — Sozlesmeler` -> completed
- `Faz 3 — Talepler + Randevular + Gorevler + Aktif Is Gucu` -> completed
- validated Phase 2 readers: `Firma Detay > Sozlesmeler`, `Genel Bakis > Aktif Sozlesmeler`, `Sozlesmeler` listesi, `Firmalar` list active-contract count
- validated Phase 3 readers/writers: `Talepler`, `Randevular`, `Gorevler`, `Firma Detay > Talepler`, `Firma Detay > Randevular`, `Firma Detay > Aktif Is Gucu`, `Firmalar` list appointment-derived parity
- migration order does not change; Faz 4 is not started by this closeout patch

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
