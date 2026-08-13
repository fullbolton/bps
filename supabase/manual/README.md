# supabase/manual — hand-run scripts and pre-deploy gates

Files here are **NOT migrations** and must never be applied by the migration
runner. `supabase db push` / `supabase migration up` walk
`supabase/migrations/` in filename order and apply everything pending — which is
exactly wrong for scripts that:

- change **data**, not schema, and need a per-person decision;
- must run at a specific point in a multi-step rollout, not "whenever the next
  deploy happens";
- may need to be run partially, or not at all.

Run these by hand in the SQL editor, after reading the file's own preconditions.

| File | Run when |
|---|---|
| `role_remap_retired.sql` | Step 2 of the role simplification — **after** the role/RLS rewrite ships, so anyone reassigned lands on a role that has policies behind it. It performs no automatic updates; it is a checklist plus a guard. |

---

## PRE-DEPLOY GATES

A gate written only as a comment inside a migration is not enforcement: the
migration is applied at one moment, by one person, and the deploy decision
happens later. These must be **run and their answer recorded here** before the
matching change ships.

Each gate carries a marker line that `qa:static` (rule R12) parses. It clears
only when `status=cleared` **and** `value` equals the one answer that makes
shipping safe — writing a different answer, or deleting the marker, keeps the
harness red. Filling it in is a statement that you ran the query and read the
result, so do not edit a marker you did not run.

### G1 — tenant topology (blocks the görev assignee picker)

The picker lists whatever `profiles` returns. `profiles` has **no tenant_id**,
and its SELECT policy is open to every authenticated user, so there is nothing
to scope the list by. On a multi-tenant deployment it would expose other
tenants' users and allow a cross-tenant assignee — a real FK to a foreign
profile, which the old free-text field never created.

```sql
select count(distinct tenant_id) as tenant_count from companies;
```

<!-- gate:G1 status=cleared value=1 checked_on=2026-08-10 cleared_by=Furkan-Yahsi -->

- **1** → set `status=cleared value=1`. Necessary, but **not sufficient on its
  own** — see G3.
- **anything else, or unverifiable** → **do not ship the picker.** Adding tenant
  membership to `profiles` and constraining assignment belongs to the role/RLS
  rewrite (Step 3). Leave the marker as-is.

### G3 — profile roster attestation (also blocks the picker)

G1 counts tenants in `companies`. That does **not** prove every row in
`profiles` belongs to that tenant: the two tables are unrelated today, and
`profiles` carries no tenant at all. **No query can prove profile isolation** —
so this gate is a human attestation, not a machine check, and it is recorded as
such.

List the full roster and read every row:

```sql
select email, display_name, role, created_at from profiles order by email;
```

<!-- gate:G3 status=cleared value=attested checked_on=2026-08-10 cleared_by=Furkan-Yahsi -->

- Every account is **this organisation's own staff**, no external or
  other-tenant user → set `status=cleared value=attested`.
- Any account you cannot vouch for, or you would rather not make this claim →
  **do not ship the picker.** Leave the marker as-is; the durable fix is tenant
  membership on `profiles` in Step 3.

### G2 — migration before deploy (blocks the görev code)

The task paths that carry an assignee — `createTask` (Yeni Görev, and the
Randevular "Görev Oluştur" flow) and the assignee edit in `updateTask` — always
send `assigned_to_user_id`. Deploying the code before `20260722000100` is
applied breaks those with PGRST204 ("column does not exist"), because PostgREST
has no such column in its schema cache.

Not every task write is affected: `completeAppointment` builds its handoff
`TaskInsert` directly and sends neither assignee field, so it would keep working
against the old schema. That narrows the blast radius; it does not make the gate
optional.

```sql
select column_name from information_schema.columns
 where table_schema = 'public' and table_name = 'tasks'
   and column_name = 'assigned_to_user_id';
```

<!-- gate:G2 status=cleared value=assigned_to_user_id checked_on=2026-08-10 cleared_by=Furkan-Yahsi -->

- **one row returned** → set `status=cleared value=assigned_to_user_id`.
- **no rows** → the migration is not applied. Apply it first; never deploy the
  code ahead of it.
