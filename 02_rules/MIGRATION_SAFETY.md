# MIGRATION_SAFETY.md

> Deferred document
>
> This file is not an active day-to-day rule until BPS has real internal usage and live data that must be protected.
> Until then, it should be treated as principle-level guidance only.

---

## Purpose
This document captures the high-value migration safety principles BPS should use once live internal usage exists.

It is intentionally simplified.
It does not define schema.
It does not define database tables, columns, or migration files.

---

## When This Document Becomes Active
Activate this document when both conditions are true:
- BPS is in real internal use
- BPS contains live data that would be harmed by destructive structural change

Typical triggers:
- destructive rename or drop discussions
- workflow contract changes on live records
- status meaning changes on live records
- role/access contract changes affecting live users

---

## Principle 1 — Prefer Additive Change
When the system is live, prefer additive evolution.

Preferred direction:
- add before remove
- introduce new structure before deprecating old structure
- prefer passive or closed states over destructive deletion

Avoid live-system changes that force immediate reinterpretation of existing records.

---

## Principle 2 — Avoid Destructive Renames And Drops
Once live usage exists, renames and drops become risky.

Do not casually:
- rename live structures
- drop live structures
- silently redefine existing meanings

If a rename is unavoidable, use a staged path:
- add replacement
- adopt replacement
- deprecate old behavior
- remove only after safe transition

---

## Principle 3 — Preserve Workflow And Status Contracts
BPS depends on stable workflow meaning.

Protect the contracts defined in:
- `02_rules/WORKFLOW_RULES.md`
- `02_rules/STATUS_DICTIONARY.md`
- `02_rules/ROLE_MATRIX.md`

Do not change the meaning of live statuses, workflow steps, or responsibility boundaries without an explicit safety review.

---

## Principle 4 — Preserve Operational Center
Live migration decisions must not distort the product center.

Do not let structural changes:
- push work away from Company Detail without reason
- weaken the contract / demand / appointment / task backbone
- turn Financial Summary into accounting operations
- turn Active Workforce into HR detail

Safety includes product integrity, not only data integrity.

---

## Principle 5 — Activate Only When It Matters
Before real internal usage exists, this document stays deferred.

That means:
- it should not force speculative schema design
- it should not invent migration mechanics
- it should not block documentation-level exploration

After real internal usage begins, destructive or contract-level changes should be reviewed against this document before execution.

---

## Safety Review Questions
When this document is active, ask:

1. Is the change additive or destructive?
2. Does it rename or drop something that live usage depends on?
3. Does it change workflow meaning?
4. Does it change status meaning?
5. Does it alter role/access expectations?
6. Does it weaken the operational backbone?
7. Does it push Financial Summary beyond management visibility?

If the answers are unclear, slow down and review before acting.

---

## Final Reminder
Migration safety for BPS is not about freezing the product forever.
It is about protecting live operational continuity once the system is truly in use.
