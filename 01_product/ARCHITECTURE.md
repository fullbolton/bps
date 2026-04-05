# ARCHITECTURE.md

## Purpose
This document describes the operating architecture of BPS at product-system level.
It defines system context, module boundaries, flows, and architectural principles.

It does not define database schema.
It does not invent tables, fields, or implementation-specific storage models.
It is a synthesis layer for system understanding and must not override `02_rules/WORKFLOW_RULES.md`, `02_rules/STATUS_DICTIONARY.md`, or `02_rules/ROLE_MATRIX.md`.
Initial technical stack and architecture direction are defined separately in `01_product/TECH_STACK_DECISION.md`.
The UI token / design-system layer documented under `docs/design/` is an implementation consistency layer only.
It does not override workflow, status, role, or product-structure documents.

---

## 1. Project Identification

**Project:** BPS

**Product:** Web-based internal office operations interface

**Core value:** Help an internal office team manage company operations through one connected product centered on company context, contract lifecycle, staffing demand, active workforce visibility, appointments, tasks, documents, and management visibility.

---

## 2. System Context

```text
Internal Office Users
        |
        v
   BPS Web Interface
        |
        v
Application / Workflow Layer
        |
        +--> Operational Backbone
        |     - companies
        |     - contracts
        |     - staffing demand
        |     - active workforce
        |     - appointments
        |     - tasks
        |     - documents
        |
        +--> Management Visibility Layer
              - company-level ticari ozet
              - financial summary
              - reports

External Accounting / Finance Tools
        |
        v
Summary Inputs Only
        |
        v
Financial Summary Visibility
```

Key architectural boundary:
- BPS includes management visibility
- BPS does not become official accounting, payroll, banking, or ERP software

---

## 3. Primary Product Modules

### Operational Backbone Modules
- Dashboard
- Companies
- Contracts
- Staffing Demand
- Active Workforce
- Appointments
- Tasks
- Documents

### Central Core Surface Inside The Companies Domain
- Company Detail

Company Detail is not a separate top-level peer module.
It is the central working surface inside the Companies domain, where company-specific operational, contractual, document, appointment, task, and commercial context converges.

Company Detail includes a bounded Yetkililer (contacts) tab providing firm-scoped contact visibility: up to 5 contacts per firma with exactly one ana yetkili, minimal structured fields (name, title, phone, email, short context note), and role-gated access. This is firm-context contact memory, not a CRM contacts system or a global people directory.

### Management Visibility Layer
- Financial Summary
- Reports

### System Control Layer
- Settings

The operational backbone is the product center.
The management visibility layer exists inside the same internal product, but must not displace the operational center.

---

## 4. Assumed Repo And Document Structure

### Active Documentation Structure

```text
BPS/
├── 00_core/
│   ├── README.md
│   ├── CODEX.md
│   ├── SKILLS.md
│   └── CHANGELOG.md
├── 01_product/
│   ├── SYSTEM_MAP.md
│   ├── PRODUCT_STRUCTURE.md
│   ├── SCREEN_SPEC.md
│   ├── COMPONENT_SYSTEM.md
│   ├── BUILD_PRIORITY.md
│   ├── ARCHITECTURE.md
│   └── TECH_STACK_DECISION.md
├── 02_rules/
│   ├── WORKFLOW_RULES.md
│   ├── STATUS_DICTIONARY.md
│   ├── ROLE_MATRIX.md
│   ├── REVIEW_STANDARD.md
│   └── MIGRATION_SAFETY.md
└── 99_archive/
```

### Assumed Implementation Separation

Exact code folders are not fixed by this document.
However, the implementation should preserve separation between:
- web interface and navigation
- shared UI/component system
- workflow and domain logic
- role/access enforcement
- document/compliance behavior
- management visibility surfaces
- summary-input integration boundary if external finance data is connected

The separation of concerns is binding.
Specific framework folders are not.

---

## 5. Role And Access Model

The architecture assumes six main roles:
- `yönetici`
- `operasyon`
- `satış`
- `ik`
- `muhasebe`
- `görüntüleyici`

Role shape:
- `yönetici` has full cross-system operational and management visibility
- `operasyon` focuses on staffing demand, active workforce, tasks, documents, and operational follow-up
- `satış` focuses on company relationship, appointments, contacts, contract follow-up, and company-level commercial visibility where needed
- `ik` focuses narrowly on document compliance and personnel completion — sees Evraklar (full), Aktif İş Gücü (read-only), Görevler (bounded execution, no reassignment), and Company Detail operational context — does not see commercial tools, financial surfaces, or management-layer features
- `muhasebe` focuses on bounded summary-level financial visibility maintenance — sees Finansal Özet (full including upload-extract-confirm), Company Detail (Ticari Özet read-only + Sözleşmeler read-only + Yönlendirmeler), and Dashboard (narrow financial context only) — does not see operational modules, commercial tools, Ayarlar, or management-layer features
- `görüntüleyici` is summary-observation only and should not mutate records or access operational-depth surfaces

Company-wide Financial Summary remains a management-visibility layer. Yönetici is the management owner. Muhasebe participates as a bounded summary-maintenance actor — uploading, reviewing, and confirming summary financial data — but this does not transform Financial Summary into accounting software, ERP, payroll, ledger logic, or reconciliation.

`ik` is not a broad HR role. It does not cover recruitment, leave management, payroll, or performance tracking. It exists because document compliance for deployed personnel is a recurring operational workflow that needs a dedicated BPS identity distinct from operasyon.

`muhasebe` is not accounting software. It does not cover invoice operations, collections workflows, tax processing, bank reconciliation, or ledger behavior. It exists because financial summary data maintenance is a recurring input workflow that needs a dedicated BPS identity distinct from yönetici's strategic-oversight role.

Access onboarding follows a controlled request-approval model:
- the login surface includes an inline access-request form (not open self-signup)
- requests are reviewed by yönetici in Ayarlar
- approval marks the request as accepted but does not automatically create an auth user
- real user creation remains a manual administrative step
- this model preserves controlled internal access without introducing public registration or invitation automation

---

## 6. Operational Flows

### Flow 1 — Company Management
Dashboard -> Companies -> Company Detail -> related operational tabs

### Flow 2 — Contract Lifecycle
Company Detail / Contracts -> Contract Detail -> renewal / warning / follow-up

### Flow 3 — Staffing Demand And Workforce Visibility
Company Detail / Staffing Demand -> demand status -> open gap -> Active Workforce visibility

### Flow 4 — Appointment Follow-Up
Appointment -> result -> next action -> task

### Flow 5 — Document Compliance
Company Detail / Documents -> missing or expiring state -> warning / follow-up task

These flows form the operational backbone and should remain the primary product center.

---

## 7. Management Visibility Layer

### Company-Level Commercial Visibility
Company Detail includes company-specific commercial visibility through Ticari Ozet.

This layer belongs next to the company context and may include:
- open receivables visibility
- latest invoice visibility
- uninvoiced amount visibility
- commercial or payment risk signal

Completed Batch 6 added upstream commercial-preparation visibility as contract-context metadata.
It did not introduce a separate proposal system or sales pipeline layer.

### Company-Wide Financial Visibility
Financial Summary provides company-wide management visibility.

This layer may include:
- total receivables
- invoiced amounts
- uninvoiced amounts
- salary expenses
- fixed expenses
- short-term net outlook

Completed Batch 5 management surfaces were implemented as bounded visibility/reference layers.
They do not redefine BPS into accounting, BI, or platform-admin systems.

Completed Batch 8 added reviewed finance-summary ingestion into the existing visibility surfaces.
It remained management-visibility oriented and did not introduce accounting-system behavior, payroll logic, profitability/accounting truth, or a manual re-entry workflow.

Architectural boundary:
- management visibility is allowed
- accounting operations are not
- payroll engines are not
- ledger logic is not
- banking workflows are not

---

## 8. Shared Architecture Principles

### Company Context First
Company is the top-level business context.
Important activity should resolve back to Company Detail whenever possible.

Completed Batch 7 added bounded structured-entry assistance inside Company Detail.
It did not introduce a general AI assistant, autonomous behavior, or a direct-write AI channel.

Completed Batch 9 added bounded draft-helper assistance across Dashboard and Company Detail.
It remained draft-first and human-reviewed, and did not introduce generic assistant/chat/autonomous communication behavior.

Completed Batch 10 Phase 1 began with a bounded record-context coordination primitive inside Company Detail.
It remained distinct from notes, tasks, and chat behavior, and did not introduce inbox, messaging-product, or notification-system behavior.

Completed Batch 10 Phase 2 added a bounded management-announcement primitive on Dashboard.
It remained one-directional and non-conversational, and did not introduce inbox, feed, or messaging-product behavior.

Batch 10 closed with these two bounded primitives.
It remained non-chat, non-inbox, and non-messaging-product, and limited group-room depth was intentionally not activated.

### Lifecycle Over Storage
Contracts, appointments, documents, and follow-up records must behave like workflow objects, not passive files or isolated rows.

### Operational Backbone First
Management visibility supports the product, but it does not become the product center.

### Shared Components Before Custom Surfaces
Repeated patterns should use shared component architecture before screen-specific widgets are introduced.

### Status And Role Consistency
Workflow meaning, statuses, and access boundaries must stay aligned across modules.

### Summary Finance Only
Financial Summary must remain management visibility, fed by summary inputs, without expanding into accounting-software behavior.

Management/commercial visibility themes in this layer must remain bounded.
They do not redefine current product structure.
The Partner Staff C-level visibility layer closed as a compact `Finansal Ozet` portfolio-health summary layer at Phase 1.
It remained calm, present-state, and management-oriented and did not drift into BI, executive-dashboard, or analytics-product behavior.
The project commercial-quality / estimated profitability visibility workstream closed as a compact `Company Detail`-first layer at Phase 1.
It remained assumption-driven, visibility-only, and role-gated and did not introduce pricing-engine, accounting-truth, `Dashboard`, `Finansal Ozet`, or reporting propagation behavior.
The pricing-calculator / parameter-set workstream closed as a compact `Company Detail`-centered decision-support calculator.
It remained hidden-parameter, stateless, and non-payroll / non-accounting in behavior and did not drift into spreadsheet-replacement, pricing-admin, or ERP behavior.
Future expense-side visibility, if activated later, should prefer `Proje Gideri` framing and accountant-provided summary inputs rather than payroll/accounting truth.
The organizational-unit coordination/routing workstream closed as a firma-context coordination visibility layer in `Company Detail` at Phase 1.
It remained distinct from tasks, mentions, and messaging behavior, `muhasebe` handling remained a bounded demo simplification rather than an auth-model expansion, and it did not propagate into `Dashboard` or record-row surfaces.
The executive-initiatives / special-tracking workstream closed as a compact yonetici-only attention-bookmark layer.
It remained clearly distinct from tasks and PM-tool behavior, and `Company Detail` linkage stayed as a subtle cue only.
The outbound-draft workstream closed as a compact `Company Detail`-centered commercial-draft support layer.
It remained draft-first, human-approved, and stateless and did not drift into CRM, inbox, campaign, or communication-history behavior.
Future internal-operations request/approval themes are also recognized as later support-layer extensions only, not present-scope HR or procurement commitments.
Future geographic-visualization themes are also recognized as later management-visibility enhancements only, not present-scope map-first product commitments.
The city -> partner ownership-visibility workstream closed through four bounded phases covering the `Ayarlar` structural layer, lightweight list/detail partner visibility, a yönetici-only reporting lens, and a lightweight `Dashboard` concentration signal.
It remained visibility-oriented and did not drift into org-management, accounting, profitability, or map-first behavior.

### Additive Structural Change Preference
When architecture evolves, prefer additive refinement over disruptive rewrites, especially once live usage exists.

### No Schema Invention Here
This document must not be used to invent or imply a database schema.
Schema decisions require their own explicit source of truth if and when BPS introduces one.
