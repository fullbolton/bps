-- ==========================================================================
-- BPS Role Simplification — STEP 1 of 3: EXPAND (add 'asistan')
-- ==========================================================================
-- Target role set (product decision, 2026-07-22):
--     yonetici   — everything + settings + users
--     asistan    — all operations + contracts; does NOT see financial/Luca
--     operasyon  — firms/contracts read, uploads files, only OWN tasks
--     muhasebe   — financial + Luca (write), reads the rest (internal staff)
-- Retired: partner, ik, goruntuleyici.
--
-- This migration ONLY widens the CHECK so 'asistan' becomes assignable.
-- Nothing is removed and no policy changes, so it is safe to apply at any
-- time and in either order with a code deploy.
--
-- Why three steps (expand → migrate → contract): dropping the old roles in one
-- shot fails on two fronts — the CHECK is rejected while any profiles row still
-- holds a retired role, and a deploy where code and DB disagree about the
-- vocabulary breaks live sessions. Widen first, move people, narrow last.
--
-- ⚠ WRITTEN BUT NOT APPLIED.
-- ⚠ Assigning someone 'asistan' before the role/RLS rewrite ships leaves them
--    with almost no access: no policy has an 'asistan' branch yet, so RLS
--    denies by default. Create asistan users only after STEP 3.
-- ==========================================================================

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check CHECK (role IN (
    -- active target set
    'yonetici',
    'asistan',
    'operasyon',
    'muhasebe',
    -- retired, still permitted until STEP 2 (remap) has run
    'partner',
    'ik',
    'goruntuleyici'
  ));
