# CLAUDE.md — BPS Agent Steering Primer

> **This file is NOT source-of-truth.** It is a compressed agent entry point.
> CODEX.md is the authoritative operating entrypoint.
> When this file and any governance doc conflict, the governance doc wins.
> See Source-of-Truth Hierarchy below.

---

## Project Identity

**BPS** (Business Process System) — a **firma-merkezli service operations platform** with a **kişi-merkezli daily experience**, built for B2B service companies.

**Çekirdek prensip:** firma-merkezli veri + kişi-merkezli deneyim. The data backbone is company-centered (sözleşme, evrak, alacak, talep, risk firmaya aittir). The daily experience is organized around the user — role, scope, and assignment — so that each person opens the app and sees the work they actually need to move that day.

Started as an internal tool for Partner Staff (staffing industry) and is transitioning toward a multi-tenant SaaS product serving staffing, security, cleaning, OSGB, consulting, logistics, and facility management companies.

**Stack:** Next.js (App Router) + TypeScript + Tailwind CSS + Supabase (Postgres + Auth + RLS + Storage)
**Hosting:** Vercel (production: bpsys.net)
**Language:** Turkish UI, Turkish domain terminology, English code/comments

---

## Current State

- **Evre 0 (Migration) — completed and closed.** 14 Supabase tables, 12+ service files, all mock truth removed, RLS + partner scope enforced everywhere.
- **Role model:** 6 roles (yonetici, partner, operasyon, ik, muhasebe, goruntuleyici)
- **Authorization:** `rol + kapsam` (not role-only). Partners see only assigned portfolio companies. RLS enforces this.
- **Demo environment:** deployed on separate Supabase project, validated for sales readiness.

> **Active workstream is defined by human instruction at session start.** Do not assume the current task from this file — ask or read the opening prompt. Roadmap phases are tracked in `TASK_ROADMAP.md` and `BPS_Revized_5_Phase_Roadmap.md`.
> Do not infer the current active phase, batch, or implementation target from this file alone. The opening human prompt and the active source-of-truth docs always decide current scope.

---

## Product Center — Non-Negotiable Rules

### The Core Chain
```
Dashboard → Firma Detay → Sözleşme / Randevu → Görev → Evrak / Risk / Uyarı
```

### Module Topology
- **Current product center:** Companies, Company Detail, Dashboard, Contracts, Appointments, Tasks, Documents, Reports, Settings
- **Sector-detachable surfaces:** Personel Talepleri, Aktif İş Gücü (positioned for sector-specific gating, not permanent backbone)
- **Management visibility layer:** Financial Summary (yönetim görünürlüğü, not accounting)

This section describes the current accepted product center for agent steering. It does not override future modularization planning captured in strategy/reference docs.

### Absolute Boundaries
1. **Company Detail is the center of the product.** Every feature must strengthen it, not bypass it.
2. **Dashboard is a decision surface**, not a KPI dump or report graveyard.
3. **Contracts are lifecycle objects**, not stored files.
4. **Completed appointments require result + next action.** Calendar alone produces no value.
5. **Active Workforce stays operational** — not personnel/HR detail, not payroll, not HRIS.
6. **Documents must not degrade into a plain folder system.** Documents have validity, status, and compliance context.
7. **Financial Summary is management visibility**, not accounting software.
8. **Tasks must have owners.** Sahipsiz iş yasağı.

### BPS is NOT and must NEVER become:
- Generic CRM (deals, stages, pipeline analytics, lead scoring, marketing automation)
- Generic HRIS / HR software (bordro, özlük, izin yönetimi, shift / vardiya, performance)
- Payroll / bordro software
- Generic ERP (stok, üretim, tedarik zinciri)
- Muhasebe yazılımı / accounting software (fatura kesme, KDV, e-defter, banka mutabakatı)
- Ticketing / helpdesk system
- Generic admin panel
- Email / inbox platform
- Chat / messaging app (thread, reply, DM, real-time chat, inbox)
- Project-centered PSA clone (BPS is firma-centered, not proje-centered)

### Natural growth areas (do NOT block these)

These are explicitly recognized growth areas per `03_strategy/BPS_YAPILANMA_PAKETI.md`. They do not turn BPS into generic CRM, HRIS, or ERP — the guardrails above still apply:

- **Firma-merkezli time tracking** — firma bazlı operasyonel emek kaydı ("bu firmaya kaç adam-saat harcadık"), NOT personnel payroll, shift management, mesai/fazla mesai calculation.
- **Firma-bazlı ekonomik görünürlük** — firma bağlamında gelir / maliyet / kârlılık visibility, NOT invoice issuance, KDV, e-defter, banka mutabakatı.
- **Dar pipeline (aday firma → aktif firma activation)** — firma aktivasyonuna giden dar ticari akış, NOT generic sales CRM with deals, stages, probabilities, or funnel reports.

Scope limits for each growth area are defined in `03_strategy/BPS_YAPILANMA_PAKETI.md`. Until execution-layer docs (TASK_ROADMAP, WORKFLOW_RULES, ROLE_MATRIX, STATUS_DICTIONARY) are explicitly updated to activate a growth area, no implementation work begins on it.

BPS is an **operational coordination hub** — it connects with external systems rather than replacing them.

### Emerging Design Guardrails
These are strong steering heuristics, not source-of-truth rules unless later adopted into governance docs.
- **3 Sinyal Sınırı:** avoid loading the firma card with too many external/module-derived signals; prefer a very small number of high-value signals
- Prefer explanation over meta-scoring
- Prefer additive visibility over dashboard inflation

---

## Architecture Rules

### Layer Separation (mandatory)
```
UI Layer (shared components + screens)
  → Application / Domain Layer (business rules, orchestration, visibility decisions)
    → Supabase Access Layer (data access, storage operations)
```

Direct UI-to-database access is forbidden. Every data flow passes through the service/domain layer. The exact folder structure may evolve — the layer separation principle is what matters, not specific directory names. See `TECH_STACK_DECISION.md` for the authoritative technical direction.

### Technical Principles
- Web-first, desktop-first
- Shared shell first, shared primitives before screen-specific widgets
- Domain/application layer between UI and Supabase
- Conservative auth and access
- No premature ORM or backend layering
- No realtime-first architecture
- No generic admin template dependency
- TypeScript safety everywhere — build must pass without errors

### Tenantization Direction (future planning, not current implementation truth)

> This section captures the currently preferred planning direction. It is not an implementation instruction and must not override active source-of-truth docs.

- Shared DB + `tenant_id` + strict RLS is the current preferred direction
- Module gating is expected to begin at UI + service visibility level first
- Sabit 6 rol korunur in the first tenant version
- `/admin/` separation is a planning direction, not an active structural requirement
- Event-driven inter-module data flow is a preferred architectural principle for future modularity

---

## Role Model (6 Roles)

| Role | Scope | Core Access |
|------|-------|-------------|
| `yonetici` | Global full access | All modules, all companies, management layer, settings |
| `partner` | Portfolio-scoped admin | Full operations within assigned companies only. Cannot see other partners' data. |
| `operasyon` | Operational execution | Talep, iş gücü, görev, evrak, randevu. No finance, no settings. |
| `ik` | Document compliance | Evraklar (full), İş Gücü (read), Görevler (limited). No commercial access. |
| `muhasebe` | Financial summary maintenance | Finansal Özet (full upload/review/confirm), Ticari Özet (read-only). No operations. |
| `goruntuleyici` | Bounded read-only | All visible surfaces, zero mutation capability. |

### Authorization Logic
- `partner` sees ONLY assigned portfolio companies — enforced by RLS
- `Sınırlı` means: works only within the role's existing accessible context
- Role boundaries are defined in `ROLE_MATRIX.md` — when in doubt, check there first
- Yönlendirme resolution: each role resolves own birim, yonetici resolves all

---

## Status Dictionary (key values)

### Firma: `aday` → `aktif` → `pasif`
### Sözleşme: `taslak` → `imza_bekliyor` → `aktif` → `süresi_doldu` | `feshedildi`
### Talep: `yeni` → `değerlendiriliyor` → `kısmi_doldu` → `tamamen_doldu` | `beklemede` | `iptal`
### Randevu: `planlandı` → `tamamlandı` | `iptal` | `ertelendi`
### Görev: `açık` → `devam_ediyor` → `tamamlandı` | `gecikti` | `iptal`
### Evrak: `tam` | `eksik` | `süresi_yaklaşıyor` | `süresi_doldu`
### Risk: `düşük` | `orta` | `yüksek`
### Öncelik: `düşük` | `normal` | `yüksek` | `kritik`

**Rule:** Before adding any new status, check `STATUS_DICTIONARY.md`. New statuses require explicit approval.

---

## Workflow Rules (critical subset)

1. Every contract belongs to a company. Contracts cannot exist independently.
2. Contract expiry approaching → 4 renewal signals: bitiş tarihi, görüşme açıldı mı, sorumlu var mı, görev üretildi mi.
3. Every staffing demand belongs to a company. Demands show talep edilen vs sağlanan vs açık kalan.
4. Appointments completed → result + next action mandatory.
5. Tasks should have a source: `manuel` | `randevu` | `sözleşme` | `talep` | `evrak`.
6. Notes are internal memory, not task replacements. If work needs doing → create a görev.
7. Critical status changes must leave a trail in the timeline.

Full rules: `WORKFLOW_RULES.md`

---

## Component System

### Shared Primitives (reuse mandatory)
`PageHeader`, `StatusBadge`, `RiskBadge`, `PriorityBadge`, `DataTable`, `EmptyState`, `TabNavigation`, `SearchInput`, `FilterBar`, `ModalShell`, `CommercialSummaryCard`, `CapacityRiskCard`, `DocumentsChecklistCard`, `RenewalTrackingCard`, `RightSidePanel`

### Rules
- New component creation must be justified by real reuse or readability gain
- Components must not absorb domain logic they don't own
- Badge colors follow `STATUS_DICTIONARY.md` mapping — never invent new color meanings
- Full component specs: `SCREEN_SPEC.md` and `DESIGN_SYSTEM.md`

---

## AI Behavior Rules

### Core Principles (Karpathy-derived + BPS-tested)

#### 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them — don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

#### 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

**The test:** Would a senior engineer say this is overcomplicated? If yes, simplify.

#### 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it — don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

**The test:** Every changed line should trace directly to the user's request.

#### 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

### What AI agents may do:
- Read, understand, and analyze the codebase
- Draft code following the architecture layers
- Suggest changes with clear rationale
- Flag conflicts with governance documents
- Push back on overcomplicated or out-of-scope requests

### What AI agents must NOT do:
- Write directly to database without user confirmation
- Silently expand schema
- Invent new domains, modules, or screens not in scope
- Change the role model without explicit approval
- Bypass RLS or partner scope isolation
- Weaken Company Detail centrality
- Push Financial Summary beyond visibility into accounting behavior
- Add status values not in STATUS_DICTIONARY
- Create mock data that contradicts real domain rules
- Silently pick an interpretation when ambiguity exists (Think Before Coding)
- Add features, abstractions, or configurability beyond what was asked (Simplicity First)
- Touch adjacent code, comments, or formatting unrelated to the task (Surgical Changes)
- Remove pre-existing dead code unless explicitly asked (Surgical Changes)

### Confidence Pattern (for AI-assisted features)
```
Upload → Extract → Review → Confirm → Write
```
AI may understand, draft, structure, and suggest. AI may NOT silently commit.

### How to know these rules are working:
- Fewer unnecessary changes in diffs — only requested changes appear
- Fewer rewrites due to overcomplication — code is simple the first time
- Clarifying questions come before implementation — not after mistakes
- Clean, minimal PRs — no drive-by refactoring or "improvements"

---

## Source-of-Truth Hierarchy

When documents conflict, follow this priority:

1. Current explicit human instruction for the task
2. `README.md` and `CODEX.md`
3. `SKILLS.md`
4. `PRODUCT_STRUCTURE.md`
5. `SCREEN_SPEC.md`, `TASK_ROADMAP.md`
6. `WORKFLOW_RULES.md`, `STATUS_DICTIONARY.md`, `ROLE_MATRIX.md`
7. `ARCHITECTURE.md`, `TECH_STACK_DECISION.md` (synthesis / technical-direction layer only)
8. `CHANGELOG.md` (historical record only)

If two files in the same tier conflict, follow the read-order defined in `CODEX.md`.

**This `CLAUDE.md` file sits BELOW all of the above.** It is a steering companion, not an authority.

`03_strategy/BPS_YAPILANMA_PAKETI.md` is **strategic direction** — it defines the current product framing and growth-area intent. It informs roadmap direction and scope evolution but **does not override** the source-of-truth execution docs above until those docs are explicitly updated to match. When Yapılanma Paketi and an execution-layer doc appear to conflict, the execution-layer doc wins in the current task.

---

## Working Sequence (for every task)

1. Define the problem
2. Place it in the product structure
3. Identify impacted modules and screens
4. Identify impacted shared components
5. Check workflow, status, role, and review-rule implications
6. Flag scope-drift or overreach risk
7. Propose the smallest viable change
8. Update CHANGELOG when authoritative docs change

---

## Batch Workflow (standard)

```
Step 1: Scope Framing (human defines problem, target, out-of-scope, domain impact)
Step 2: Plan + Risk Scan (which domains/flows affected, which files change, acceptance criteria)
Step 3: Implementation (only from approved plan — SQL, service, component, build, commit)
Step 4: Review (scope drift? role compliance? workflow rules? Company Detail centrality?)
Step 5: Live Smoke Test (deploy → real user flow → role-based visibility → blockers?)
Step 6: Docs Sync Decision (update governance docs only if behavior actually changed)
Step 7: Closeout (plan met? review passed? next batch?)
```

### Implementation Guardrails
- Do NOT invent new domains outside the plan
- Do NOT silently expand schema
- Do NOT break role model
- Do NOT weaken Company Detail centrality
- PRESERVE layer separation (UI → Service → Supabase)
- PRESERVE TypeScript safety — build must be error-free
- If ambiguity exists on a structural, role, workflow, or scope-changing issue → stop and ask
- If ambiguity is minor and bounded → prefer the smallest safe interpretation and state the assumption clearly

### Anti-Patterns (learned the hard way)
1. Giving the same job to two tools in parallel
2. Closing a batch without review
3. Starting implementation without a plan
4. Two writer sessions touching the same file
5. Letting AI run platform-level destructive commands
6. Band-aid fixes — let it fail visibly, fix root cause
7. Half-live ambiguity — either it works or it's invisible
8. Continuing after merge without build + type check

### Autonomous Agent Loop (within a single session)
For well-scoped tasks, the agent can run a self-contained cycle:
```
Human kickoff (5-10 min: scope, plan, acceptance criteria)
  → Agent implements
    → Agent tests / type-checks
      → Agent fixes failures
        → Agent tests again (repeat until clean)
          → Agent commits + pushes PR
            → Human reviews final output
```
This loop works for chore sessions and well-specced implementation tasks. It does NOT work for ambiguous scope, new domain exploration, or architecture decisions — those require human-in-the-loop throughout.

---

## Multi-Session Orchestration (summary)

BPS development uses parallel Claude Code sessions with git worktree isolation.

### Session Types and Sustainable Limit
```
1 implementation (serial, human-tested) + 1-2 planning (parallel, spec-only) + 1 chore (autonomous, low-attention) = 4 max
```

**Plan parallel, implement serial.** End-to-end human testing cannot be parallelized. Ship one feature cleanly before starting the next.

### Worktree Layout
```
bps-main        → production, protected
bps-hotfix      → dedicated quick-fix tree (branch switches per fix)
bps-feature-X   → current active feature implementation
bps-planning    → spec/research workspace (no implementation)
bps-chores      → docs, tests, quality (low-attention autonomous)
```

### Agent Roles
| Tool | Role |
|------|------|
| Claude Code (Opus) | Deep reasoning, spec generation, architecture decisions |
| Claude Code (Sonnet) | Implementation, component work, service layer |
| ChatGPT Codex | Independent review, alternative perspective, async PR checks |

### Agent Teams (experimental)

Claude Code Agent Teams enable Claude-orchestrated parallelism: one lead spawns teammates with a shared task list and direct messaging. Use for parallel code review, research, or debugging with competing hypotheses. Not for sequential work or schema migrations.

BPS patterns: (1) post-implementation governance review with 3 teammates checking WORKFLOW_RULES / ROLE_MATRIX / DESIGN_SYSTEM, (2) parallel research when planning a new module, (3) debugging with competing hypotheses across RLS / service / component layers.

Setup: set `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` in `~/.claude/settings.json`. Requires v2.1.32+. Teammates load CLAUDE.md automatically.

For detailed multi-session operating patterns, worktree setup, and infrastructure automation plans, see:
- `docs/policies/BPS_WORKTREE_POLICY.md` (when and why)
- `docs/runbooks/git-worktree-setup.md` (how and commands)

---

## AI Instrument Map

Each tool has one role in the chain. Never give the same job to two tools simultaneously.

| Tool | Role | One-line |
|------|------|----------|
| **ChatGPT Chat** | CPO — product mind | Frames problems, gates scope, guards roadmap, writes prompts for other tools |
| **Claude Chat** | Principal Planner / Reviewer | Planning reports, impact analysis, acceptance criteria, post-implementation review |
| **Claude Code** | Lead Engineer / Builder | Implements approved plans — code, migrations, services, components, build, commit |
| **ChatGPT Codex** | Independent Technical Reviewer | Second-eye review of Claude Code output, access/type/architecture verification |

### Standard Flow
```
New feature / batch:
  ChatGPT Chat (scope gate) → Claude Chat (plan) → Claude Code (build) → Codex (review) → ChatGPT Chat (sanity check)

Small bug / hygiene:
  Claude Code (fix) → Codex (quick review)

Strategic planning:
  ChatGPT Chat → Claude Chat → implementation only if needed

Docs / governance patch:
  ChatGPT Chat (is this needed?) → Claude Chat (impact) → Claude Code (apply) → Codex (consistency)
```

### Decision Rule
- **Ne yapılmalı?** → ChatGPT Chat
- **Nasıl planlanmalı?** → Claude Chat
- **Kim uygulamalı?** → Claude Code
- **Bağımsız teknik kontrol?** → Codex

---

## Conflict Handling

If a request conflicts with BPS rules:
1. **Stop.**
2. Name the conflict clearly.
3. Cite the affected source-of-truth document.
4. Ask for decision or propose bounded options.

Never silently bypass rules. Never partially comply without flagging the contradiction.

---

## Key Turkish Domain Terms

| Turkish | Meaning |
|---------|---------|
| Firma | Company (the central entity) |
| Sözleşme | Contract (lifecycle object) |
| Personel Talebi | Staffing Demand (detachable sector module) |
| Aktif İş Gücü | Active Workforce (detachable sector module) |
| Randevu | Appointment |
| Görev | Task |
| Evrak | Document |
| Yetkili | Company Contact/Authority |
| Puantaj | Timesheet/Attendance |
| Yönlendirme | Cross-unit routing/referral |
| Bahsetme | @Mention |
| Finansal Özet | Financial Summary (management visibility) |
| Ticari Özet | Commercial Summary (per-company) |
| Açık Alacak | Open Receivable (company-wide label) |
| Açık Bakiye | Open Balance (per-company label) |
| Kesilmemiş Bekleyen | Unbilled Pending |

---

## Drift Detection Checklist

Before completing any substantial change, verify:
- [ ] No scope drift beyond the approved plan
- [ ] WORKFLOW_RULES compliance maintained
- [ ] ROLE_MATRIX boundaries respected
- [ ] Company Detail centrality preserved
- [ ] Financial Summary stayed as visibility (not accounting)
- [ ] No CRM drift, no HRIS drift, no ERP drift
- [ ] STATUS_DICTIONARY terms used correctly
- [ ] Detachable modules not hardwired into the current product center
- [ ] TypeScript build passes
- [ ] Shared components reused (no unnecessary new components)
- [ ] Every changed line traces to the user's request (Surgical Changes test)
- [ ] Code is minimal — could this be simpler? (Simplicity First test)

---

## Infrastructure Automation Horizon

> Target state, not current setup. Implement incrementally.

**Goal:** A single command bootstraps worktree + branch + agent context + environment for any BPS task.

**Sequence:** (1) manual worktree discipline → (2) shell scripts for worktree + `.env.local` → (3) Claude Code slash commands → (4) Supabase MCP for live schema → (5) full CLI with ticket-driven orchestration.

**Environment isolation:** each worktree points to a different Supabase via `.env.local` (production, demo, or feature-specific).

---

*Tradeoff note: These guidelines bias toward caution over speed.
For trivial tasks (typo fixes, obvious one-liners), use judgment —
not every change needs the full rigor.
The goal is reducing costly mistakes on non-trivial work.*
