-- ==========================================================================
-- BPS — Close direct public insert path for access_requests
-- ==========================================================================
-- The login "Erişim Talebi" form now submits through the server-side Route
-- Handler (/api/access-request), which uses service role. The anon insert
-- path (used by the old browser-direct insert) is therefore retired.
--
-- Mirrors 20260414000200_close_demo_requests_public_insert.sql.
--
-- ⚠ APPLY ORDER: deploy the code (src/app/api/access-request/route.ts +
--    src/app/login/page.tsx) FIRST, THEN apply this migration. If this
--    runs while the old browser-anon-insert login is still live in prod,
--    access requests break until the new code deploys.
--
-- ⚠ POLICY NAME: the access_requests table was created outside this repo
--    (Auth Foundation Phase 2A, 2026-04-05), so its anon INSERT policy
--    name is not known here. Before applying, confirm the actual name:
--        select policyname from pg_policies
--          where schemaname = 'public' and tablename = 'access_requests';
--    Add/adjust the DROP POLICY lines below to match. The REVOKE is the
--    reliable closer: without the INSERT grant, anon cannot insert
--    regardless of any remaining policy (privilege is checked before RLS).
-- ==========================================================================

-- Best-effort policy cleanup (adjust names per pg_policies above).
DROP POLICY IF EXISTS access_requests_public_insert ON access_requests;
DROP POLICY IF EXISTS access_requests_anon_insert ON access_requests;
DROP POLICY IF EXISTS access_requests_insert ON access_requests;

-- Reliable closer: remove the anon INSERT grant.
REVOKE INSERT ON access_requests FROM anon;
