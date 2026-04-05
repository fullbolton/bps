# SKILLS.md

## Purpose
This file defines BPS execution discipline.
It governs how changes are planned, scoped, checked, and resolved before implementation.

These skills protect BPS from drifting away from its actual product center.

---

## Skill 1 — BPS Docs Are Authoritative
Use BPS documentation as the source of truth.

Rules:
- `00_core/`, `01_product/`, and `02_rules/` define BPS.
- External project docs are reference-only and structural inspiration at most.
- Do not import foreign domain logic into BPS.
- Do not let reference material override BPS product boundaries.

---

## Skill 2 — Plan Before Implementation
Before implementation work, define the task in product terms.

Minimum planning frame:
- goal
- files or docs to change
- impacted modules or screens
- impacted workflows, statuses, or roles
- scope and overreach risk

Do not begin by drawing UI or inventing structure.

---

## Skill 3 — Approval Gate
Use an approval gate when the change has structural consequences.

Approval is required before implementation when a task changes:
- product structure
- workflow rules
- role/access behavior
- status meaning
- management-layer boundaries
- data or migration assumptions

Direct user requests for documentation-only changes count as approval for that requested documentation batch.
If the user asks to wait, pause immediately.

---

## Skill 4 — Prefer Small, Focused Changes
Change the smallest coherent set of files needed to solve the problem.

Rules:
- avoid unrelated refactoring
- avoid broad rewrites without reason
- if several source-of-truth files must move together, explain why
- keep structural changes narrow and intentional

---

## Skill 5 — Company Detail Stays Central
When evaluating a new feature or change, first ask:

**How does this appear inside Company Detail?**

If important company context lives only in disconnected modules, the product will fragment.

---

## Skill 6 — Guard Against Generic CRM Drift
Reject ideas that pull BPS toward a generic CRM.

Warning signs:
- lead-centric product logic
- sales-pipeline sprawl
- campaign automation
- contact management without operational context
- relationship surfaces detached from contracts, staffing, or tasks

BPS is company-centered operational work, not a generic sales CRM.

---

## Skill 7 — Guard Against Full HRIS Drift
Reject ideas that turn BPS into a personnel system.

Warning signs:
- employee master-record depth
- payroll-adjacent personnel detail
- leave, benefits, or employee lifecycle expansion
- detailed person-level HR operations replacing firm-level workforce visibility

Active Workforce in BPS is operational capacity visibility, not HR administration.

---

## Skill 8 — Guard Against ERP / Accounting-Software Drift
Reject ideas that turn BPS into accounting or ERP software.

Warning signs:
- tax workflows
- payroll engines
- ledger logic
- banking flows
- reconciliation logic
- deep invoicing operations

Financial Summary is allowed only as management visibility.

---

## Skill 9 — Contracts Are Lifecycle Objects
Treat contracts as active lifecycle records.

Every contract-oriented surface should preserve visibility for:
- start and end timing
- current status
- renewal need
- responsible owner
- linked appointments
- linked tasks

Contract value does not come from file storage alone.

---

## Skill 10 — Completed Appointments Require Result Plus Next Action
An appointment is not complete just because it happened.

Rules:
- completed appointments must carry result
- completed appointments must carry next action
- follow-up responsibility must remain visible

This rule is core to product discipline.

---

## Skill 11 — Active Workforce Stays Operational
Keep Active Workforce at company level.

Focus:
- active count
- target count
- open gap
- recent entries and exits
- workforce risk

Do not let this surface become a personnel file system.

---

## Skill 12 — Documents Are Contextual, Not Folders
Documents in BPS are not a passive archive.

They must preserve:
- business context
- required vs missing state
- validity or expiry visibility
- company or contract linkage
- operational follow-up implications

---

## Skill 13 — Financial Summary Is Management Visibility, Not Accounting
Keep Financial Summary high-level and management-oriented.

Allowed:
- receivables visibility
- invoicing visibility
- uninvoiced amounts
- salary expense visibility
- fixed expense visibility
- short-term net outlook

Not allowed:
- tax operations
- payroll calculation engines
- ledger behavior
- banking behavior
- ERP-style transaction depth

---

## Skill 14 — Reuse Shared Patterns Before Creating New Ones
Before creating a new component or pattern, check whether an existing shared pattern can solve it.

Typical BPS reusable patterns:
- page headers
- summary cards
- status, risk, and priority badges
- filter bars
- data tables
- drawers or side panels
- checklist cards
- notes and timeline blocks

New component creation must be justified by real reuse or real readability gain.

---

## Skill 15 — Workflow / Status / Role Compliance Comes Before Polish
Any proposed change must be checked against:
- `02_rules/WORKFLOW_RULES.md`
- `02_rules/STATUS_DICTIONARY.md`
- `02_rules/ROLE_MATRIX.md`

If a nice-looking solution breaks workflow meaning, status consistency, or role boundaries, it is the wrong solution.

---

## Skill 16 — Documentation Authority And Mutation Guard
Do not mutate source-of-truth docs casually.

Rules:
- only edit authoritative docs when the task requires it
- do not rewrite unrelated sections
- keep terminology aligned with the existing docs
- if one authoritative doc changes meaning, update the dependent docs that must stay consistent
- if no BPS schema source of truth exists, do not invent schema

This guard is especially important for role rules, statuses, and management-layer boundaries.

---

## Skill 17 — Review Before Closeout
Before closing a substantial batch, check it against `02_rules/REVIEW_STANDARD.md`.

At minimum verify:
- no scope drift
- workflow compliance
- component reuse discipline
- role/access consistency
- no CRM drift
- no HRIS drift
- no ERP/accounting drift
- no Financial Summary overreach

---

## Skill 18 — Conflict Handling
If a request conflicts with current BPS rules:

1. Stop.
2. Name the conflict clearly.
3. Cite the affected source-of-truth docs.
4. Ask for the decision or propose bounded options.

Never silently bypass the rules.
Never partially comply without flagging the contradiction.
