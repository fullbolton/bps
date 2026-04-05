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
