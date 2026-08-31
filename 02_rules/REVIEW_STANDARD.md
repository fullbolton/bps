# REVIEW_STANDARD.md

## Purpose
This file defines the lightweight review standard for BPS execution batches.
It applies to documentation batches, design batches, and implementation batches.

The goal is to catch scope drift and rule violations before work is considered complete.

---

## When To Use
Use this review standard:
- before closing a substantial batch
- when reviewing a multi-file change
- when validating a proposed design direction
- when checking whether a management-layer change is still within BPS scope

---

## Review Checks

### 1. Scope Drift Check
Question:
Does the batch still serve the BPS product center?

Pass when:
- the work clearly supports companies, contracts, staffing demand, active workforce, appointments, tasks, documents, or management visibility
- no unrelated module or new domain is introduced

Fail signs:
- generic platform expansion
- unrelated module creation
- structure added without product justification

---

### 2. Workflow Compliance Check
Question:
Does the batch preserve `WORKFLOW_RULES.md` behavior?

Pass when:
- company remains the parent context
- contracts stay lifecycle objects
- appointments still require result plus next action on completion
- documents remain contextual and compliance-oriented
- Financial Summary remains summary visibility only

Fail signs:
- workflow shortcuts that break the documented chain
- silent reinterpretation of status or lifecycle meaning

---

### 3. Component Reuse Check
Question:
Does the batch respect `COMPONENT_SYSTEM.md`?

Pass when:
- existing shared patterns are reused where appropriate
- new components are justified by repeated need or clear readability gain

Fail signs:
- screen-specific duplication
- unnecessary widget creation
- component explosion without architectural reason

---

### 4. Role And Access Consistency Check
Question:
Does the batch preserve `ROLE_MATRIX.md` boundaries?

Pass when:
- management surfaces stay conservative
- company-level commercial visibility and company-wide Financial Summary follow documented access logic
- company-level `Ticari Ozet` may be visible in limited form to `satış` and, where explicitly documented, to limited operational roles
- company-wide `Finansal Ozet` access follows documented role rules: yönetici as management owner, muhasebe as bounded summary-maintenance actor where explicitly documented in `ROLE_MATRIX.md`
- no role silently gains new power beyond what is documented in the active role rules

Fail signs:
- expanded access without rule change
- operational roles receiving management-wide finance visibility by accident
- viewer roles gaining mutation paths
- summary-maintenance access expanding into accounting operations, invoice handling, or ledger behavior

---

### 5. Generic CRM Drift Check
Question:
Does the batch pull BPS toward generic CRM behavior?

Fail signs:
- lead-centric product logic
- sales-pipeline sprawl
- campaign or marketing automation
- relationship features detached from operational context

---

### 6. Full HRIS Drift Check
Question:
Does the batch pull BPS toward personnel-HR depth?

Fail signs:
- employee master-record expansion
- leave, benefits, or payroll-adjacent personnel features
- person-level HR workflows replacing company-level workforce visibility

---

### 7. ERP / Accounting Drift Check
Question:
Does the batch turn BPS into ERP or accounting software?

Fail signs:
- tax workflows
- payroll engines
- ledger logic
- reconciliation behavior
- deep financial transaction handling

---

### 8. Financial Summary Overreach Check
Question:
Does Financial Summary stay within management visibility scope?

Pass when:
- it remains summary-oriented
- it uses high-level inputs and outputs
- it supports management understanding without displacing the operational backbone

Fail signs:
- accounting behavior
- transaction-entry depth
- operational ownership moving out of company-centered flows into finance screens

---

### 9. Measurement Discipline Check

Every claim in a review — including the reviewer's own — has to be traceable to
something that was actually run. This section exists because five distinct
failures of this kind were recorded in a single day (2026-08-27), and four of
them passed type-checking, `grep`, and a green test suite before being caught.

**The five recognised shapes:**

1. **A body search does not see what a function calls.** `prosrc ilike '%raise%'`
   reported "no RAISE"; the `RAISE` lived in a nested function and the trigger
   really was rejecting rows. PL/pgSQL bodies are plain text and `pg_depend`
   does not record calls.
2. **A substring match on an identifier conflates different variables.** A search
   for `company_id IS NULL` matched `v_contract_company_id` instead of
   `p_expected_company_id` — and produced the opposite conclusion.
3. **A naive text replacement mutates the wrong occurrence.** `replace(...,1)`
   hit the wrong one of five identical guards; a `.update(` search mutated a
   comment. Two rules then looked "broken" when the test had simply landed
   somewhere else. **An unverified negative test is not a test.**
4. **`null` means different things on either side of a comparison.**
   `g.assigned_to_user_id !== (user?.id ?? null)` — with no session, `null !==
   null` is false, so a "my tasks" filter shows exactly the UNOWNED tasks as
   "mine". Type-checking accepts both forms.
5. **A filtered search is not a count.** `grep -rn "FOR DELETE"` was
   case-sensitive while most migrations write `for delete`; the miss became the
   stated rationale for a design decision ("these tables cannot be deleted from")
   and shipped into a migration comment before review caught it.

**A sixth shape belongs to agents rather than queries:** an agent without the
tool to measure something may produce a plausible value for it instead of
declining. A fabricated sha256 was pasted into an apply step in exactly this way.
It was caught only because a second agent computed the real one. **An agent that
cannot measure a thing must say so and name who can — never fill the field.**

**Counter-measures, required for any claim a review depends on:**

- **Count fully, do not filter.** Pull the complete list (`pg_proc`, `pg_class`,
  `pg_policies`, `pg_trigger`, `pg_event_trigger`) and diff against the repo. Three
  successive filtered counts missed three separate categories.
- **Case-insensitive, or it is not a count.** SQL keywords appear in both cases
  across this repo.
- **Absence is proved by a full listing, never by an empty filtered query.**
  `where cmd = 'UPDATE'` returning nothing also returns nothing when the table
  does not exist. List every row and count them instead.
- **Read the body before asserting behaviour.**
- **Mutate by line, then read back.**
- **Prove each rule has been seen red at least once.** `qa:static`'s 14 rules were
  each negative-tested.
- **Handle `null` branches first and explicitly.**
- **A claim of contradiction needs verifying as much as a claim of measurement.**
  Of three "contradictions" raised in one day, two evaporated on measurement —
  each had been produced by reading a *summary* of a source (`CLAUDE.md`) or a
  *side property* of one (a missing role condition mistaken for a missing tenant
  condition) rather than the source itself.

**A symptom is not a cause.** "I cannot sign in" produced three hypotheses
(password unset / email unconfirmed / banned); all three were wrong and the real
answer was that the passwords were not known. State the known constraint up front.

**A repo policy definition is not evidence about production.** See
`PROD_SCHEMA_DRIFT.md` and `RLS_ACCESS_MATRIX.md`: prod and repo currently
disagree on both tenant and role boundaries. A review that reads
`supabase/migrations/` and concludes "this role can see X" is unsound unless it
also states which layer and which snapshot it is describing.

---

## Review Output Format
Each review should return:
- overall result: `PASS`, `WARN`, or `FAIL`
- area reviewed
- finding
- rule reference
- required action or fix direction

If any critical area fails, the batch should not be considered complete.

---

## Final Reminder
The review standard protects BPS from becoming broader, heavier, and less coherent than intended.
Passing polish is not enough.
The batch must still belong to BPS.
