# CODEX.md

## Purpose
This file is the operating entrypoint for the BPS project.
It defines what BPS is, what it is not, which documents are authoritative, how they must be read, and how work should be framed before implementation begins.

BPS files are authoritative.
External reference packs may inform document structure or governance style, but they must never define BPS product logic, workflow rules, role rules, or schema assumptions.

---

## Project Definition
BPS is a web-based internal office operations interface.

It is centered on:
- companies
- contract lifecycle
- staffing demand
- active workforce visibility
- appointments
- tasks
- documents
- financial summary / management visibility

The product exists to help an internal office team manage company relationships, operational follow-up, staffing execution, document compliance, and management visibility inside one connected internal system.

---

## What The Product Is Not
BPS is not:
- a generic CRM
- a full HRIS
- a payroll system
- an ERP
- official accounting software
- a passive document archive

BPS may include company-level commercial visibility and company-wide financial summary visibility, but it must not expand into accounting operations, payroll engines, tax workflows, ledger logic, or banking processes.

---

## Read Order
Read the active source-of-truth files in this order before proposing structural solutions or implementation direction:

1. `00_core/README.md`
2. `00_core/CODEX.md`
3. `00_core/SKILLS.md`
4. `01_product/SYSTEM_MAP.md`
5. `01_product/PRODUCT_STRUCTURE.md`
6. `01_product/SCREEN_SPEC.md`
7. `01_product/COMPONENT_SYSTEM.md`
8. `01_product/BUILD_PRIORITY.md`
9. `01_product/TASK_ROADMAP.md`
10. `01_product/ARCHITECTURE.md`
11. `01_product/TECH_STACK_DECISION.md`
12. `02_rules/WORKFLOW_RULES.md`
13. `02_rules/STATUS_DICTIONARY.md`
14. `02_rules/ROLE_MATRIX.md`

`01_product/ARCHITECTURE.md` is a derived architectural synthesis file.
It helps organize system understanding, but it must not override workflow, status, or role rules.
`01_product/TASK_ROADMAP.md` is an authoritative product-planning file.
It tracks completed batches, current focus, future sequencing, and operational pain-point mapping, but it must not override workflow, status, or role rules for product behavior.
`01_product/TECH_STACK_DECISION.md` is an authoritative technical-direction file.
It guides stack and implementation boundaries, but it must not override workflow, status, or role rules for product behavior.

Read these conditionally when relevant:
- `02_rules/REVIEW_STANDARD.md` for execution-batch reviews, design reviews, or closeout checks
- `02_rules/MIGRATION_SAFETY.md` only when live internal usage and real data exist, and a contract-level change is being evaluated
- `00_core/CHANGELOG.md` when reconciling recent documentation decisions, and always update it after authoritative documentation changes

---

## Source-Of-Truth Hierarchy
Use this hierarchy when documents overlap:

1. Current explicit human instruction for the task
2. `00_core/README.md` and `00_core/CODEX.md`
3. `00_core/SKILLS.md`
4. `01_product/SYSTEM_MAP.md` and `01_product/PRODUCT_STRUCTURE.md`
5. `01_product/SCREEN_SPEC.md`, `01_product/COMPONENT_SYSTEM.md`, `01_product/BUILD_PRIORITY.md`, `01_product/TASK_ROADMAP.md`
6. `02_rules/WORKFLOW_RULES.md`, `02_rules/STATUS_DICTIONARY.md`, `02_rules/ROLE_MATRIX.md`
7. `01_product/ARCHITECTURE.md` and `01_product/TECH_STACK_DECISION.md` as technical-direction / synthesis layer only
8. `02_rules/REVIEW_STANDARD.md`
9. `02_rules/MIGRATION_SAFETY.md` when activated
10. `00_core/CHANGELOG.md` as historical record only

If two files in the same tier conflict, the earlier file in the read order wins.
If `01_product/TASK_ROADMAP.md`, `01_product/ARCHITECTURE.md`, or `01_product/TECH_STACK_DECISION.md` conflicts with workflow, status, or role rules, the rule documents win.
The changelog records decisions but does not override active source-of-truth documents.

---

## Core Product Rules
- Company Detail is the center of the product.
- Dashboard is a decision surface, not a KPI dump.
- Contracts are lifecycle objects, not stored files.
- Completed appointments require result plus next action.
- Active Workforce stays operational, not personnel-HR detail.
- Documents must not degrade into a plain folder system.
- Financial Summary is management visibility, not accounting software.
- Company Detail carries company-specific commercial visibility.
- Financial Summary carries company-wide management visibility.
- The operational backbone remains centered on company, contract, staffing demand, active workforce, appointments, tasks, and documents.

---

## Working Style
For every task, use this sequence:

1. Define the problem.
2. Place it in the product structure.
3. Identify the impacted modules and screens.
4. Identify impacted shared components or reusable patterns.
5. Check workflow, status, role, and review-rule implications.
6. Flag scope-drift or overreach risk.
7. Propose the smallest viable change.
8. Update the changelog when an authoritative document or structural decision changes.

Do not jump straight to screens, tables, or implementation details before the structural checks are complete.

---

## Output Expectation
Default task framing should follow this order:

1. Problem definition
2. Position in product structure
3. Impacted screens or modules
4. Impacted shared components
5. Workflow / status / role implications
6. Scope-drift or overreach risk
7. Proposed solution

---

## Archive Rule
Files under `99_archive/` are not active context.
They are historical memory only.

Do not use archived files as authority unless the human explicitly asks for archive review.
Archived material may explain history, but it must not silently redefine the live documentation system.

---

## Changelog Rule
Every meaningful change to an authoritative BPS documentation file or structural decision must be logged in `00_core/CHANGELOG.md`.

Each entry should record:
- date
- file
- change summary
- reason or impact

Do not silently rewrite past changelog entries.
Add newest entries at the top, and keep the changelog brief and factual.

---

## Final Reminder
The success of BPS comes from keeping the operational backbone clear, disciplined, and connected.
Management visibility is part of the same internal product, but it must not displace the company-centered operational core.
