-- ==========================================================================
-- BPS Role Simplification — STEP 2: retire partner / ik / goruntuleyici
--                            (HAND-RUN CHECKLIST, NOT A MIGRATION)
-- ==========================================================================
-- Lives in supabase/manual/ on purpose: the migration runner applies every
-- pending file in order, which would fire a data change at the wrong moment.
-- See supabase/manual/README.md.
--
-- RUN ONLY AFTER:
--   1. 20260722000200 (EXPAND — 'asistan' added to the CHECK) is applied, and
--   2. the role/RLS rewrite has shipped, so the target roles actually have
--      policies behind them. Remapping earlier strands people on a role the DB
--      ignores.
--
-- ==========================================================================
-- THIS SCRIPT PERFORMS NO AUTOMATIC UPDATES. THAT IS THE POINT.
-- ==========================================================================
-- An earlier draft bulk-mapped ik and partner to `operasyon`, justified as
-- "never upward, always the least privileged role". That justification does not
-- survive checking: the roles are NOT a total order, so there is no role that is
-- uniformly "less" than another, and every mapping grants something on at least
-- one axis:
--
--   ik → operasyon
--       GAINS contract read. `contracts_select` (20260407000500) has branches
--       for yonetici / operasyon / muhasebe / partner — and NO ik branch. ik
--       cannot see contracts today; operasyon can.
--
--   partner → operasyon
--       GAINS tenant-wide visibility. partner is company-scoped everywhere
--       (`current_user_has_company_scope(company_id)`); operasyon is a flat
--       `then true`. A partner limited to their assigned portfolio would come
--       out able to see every company in the tenant.
--       partner is also deliberately FROZEN (ROLE_MATRIX §2) — mapping it to
--       `asistan` would be worse still, silently reactivating a suspended role.
--
--   goruntuleyici → anything
--       Every role in the new set can write, so any mapping is a grant. And
--       leaving the row untouched does NOT close the account: goruntuleyici
--       still has write rights today (`tasks_insert` / `tasks_update` both
--       branch `when 'goruntuleyici' then true`, 20260407000800). The only
--       thing that actually cuts access is banning the auth user.
--
-- So each account is decided by a person who knows what that person does. Work
-- the list, then re-run the guard at the bottom until it passes.
--
-- ==========================================================================
-- 1. Produce the list
-- ==========================================================================
--     select role, email, display_name, id
--       from profiles
--      where role in ('partner', 'ik', 'goruntuleyici')
--      order by role, email;
--
-- ==========================================================================
-- 2. Decide per account, then run ONE of these for that person
-- ==========================================================================
-- Still doing the job, and the target role matches it — accept the delta above
-- knowingly:
--     update profiles set role = 'operasyon'   -- or 'asistan' / 'muhasebe'
--      where email = '<kişi@firma>';
--
-- Should no longer have access:
--     -- (a) ban the auth user first (docs/runbooks/user-offboarding.md).
--     --     The ban is what actually cuts access. There is no durable
--     --     disabled state today, and none of the roles a retired account
--     --     can be left on or moved to is zero-privilege — so no value
--     --     written to profiles.role closes an account. Then
--     -- (b) leave profiles.role AS IS and do not unban until the durable
--     --     disabled state exists (see below).
--     -- Do NOT park the row on an active role: a ban is reversible and nothing
--     -- links it to the role value, so one future "Unban" would silently
--     -- restore write access to an account everyone believed was closed.
--     -- Do NOT delete the profile row — it orphans historical references.
--
-- ==========================================================================
-- 3. Blocking dependency for STEP 3 (CONTRACT)
-- ==========================================================================
-- Accounts in the "no longer has access" case cannot be represented in the new
-- model at all: it has no zero-privilege state. STEP 3 (the role/RLS rewrite)
-- MUST add one — an `is_active boolean` every policy checks, or a role value
-- the new policies grant nothing — and CONTRACT must not narrow the CHECK while
-- any account still depends on it. Until then the ban is the only thing holding
-- the door shut, which is why step 3 cannot be deferred indefinitely.
--
-- ==========================================================================
-- 4. Guard — run this until it returns without raising
-- ==========================================================================

DO $$
DECLARE
  v_retired int;
  v_detail  text;
BEGIN
  SELECT count(*), coalesce(string_agg(role || ':' || email, ', '), '')
    INTO v_retired, v_detail
    FROM public.profiles
   WHERE role IN ('partner', 'ik', 'goruntuleyici');

  IF v_retired > 0 THEN
    RAISE EXCEPTION
      'HALT: % account(s) still on a retired role (%). Decide each one by hand — '
      'no mapping here is a pure privilege reduction, so none can be automated. '
      'Accounts that should lose access need the durable disabled state STEP 3 '
      'must add; ban them now and leave the row alone until then.',
      v_retired, v_detail;
  END IF;

  RAISE NOTICE 'OK: no account remains on partner / ik / goruntuleyici. '
               'STEP 3 CONTRACT may narrow profiles_role_check.';
END $$;
