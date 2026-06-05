-- ===========================================================================
-- BPS QA Mini Harness V1 — qa:state  (READ-ONLY)
-- ===========================================================================
-- Run this by hand in the Supabase SQL editor against the target project,
-- then diff the output against qa/state.expected.json.
--
-- No script connects to the DB. No service_role, no credential is read by
-- any harness code. This file is SELECT-only — it never writes.
--
-- The SQL editor runs as a privileged role and bypasses RLS, so counts are
-- whole-tenant. That is fine for a human-run baseline check.
-- ===========================================================================

-- 1. Companies — count + name:status
select 'companies_total' as metric, count(*)::text as value from companies
union all
select 'company:' || name, status from companies
order by 1;

-- 2. Contacts — count (+ names, if any)
select 'contacts_total' as metric, count(*)::text as value from contacts
union all
select 'contact:' || full_name, '(present)' from contacts
order by 1;

-- 3. Contracts — count + name:status
select 'contracts_total' as metric, count(*)::text as value from contracts
union all
select 'contract:' || name, status from contracts
order by 1;

-- 4. Documents — count
select 'documents_total' as metric, count(*)::text as value from documents;

-- 5. Must-be-absent artifacts (expected: ZERO rows from each).
--    NOTE: BPS_SMOKE_IMPORT_* is a CANONICAL company (pasif) and is NOT an
--    artifact — it is intentionally excluded from the companies check below.
select 'neg_company' as check, name from companies
  where name ilike 'BPS\_NEG\_%' escape '\';

select 'neg_contact' as check, full_name from contacts
  where full_name ilike 'BPS\_SMOKE\_CONTACT%' escape '\'
     or full_name ilike 'BPS\_NEG\_%' escape '\';

select 'neg_contract' as check, name from contracts
  where name ilike 'BPS\_SMOKE\_CONTRACT%' escape '\'
     or name ilike 'BPS\_NEG\_%' escape '\';

-- 6. Storage orphan visibility (optional, WARN-only): a known ~491KB object
--    in the `documents` bucket has no documents row. Confirm count, do not
--    treat as FAIL. (Run only if storage.objects is readable in this editor.)
-- select count(*) as documents_bucket_objects
--   from storage.objects where bucket_id = 'documents';
