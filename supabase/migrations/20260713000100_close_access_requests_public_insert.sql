-- ==========================================================================
-- BPS — Close the anon write path on access_requests, and move its yonetici
--       policies off user_metadata
-- ==========================================================================
-- Two changes to one table, in one file because they touch the same object
-- and must not land half-applied:
--   PART 1 — retire the anon insert path (grants + the open policy).
--   PART 2 — stop the yonetici read/write policies trusting user_metadata,
--            which the user can write to themselves.
--
-- PART 1. The login "Erişim Talebi" form now submits through the server-side
-- Route Handler (/api/access-request), which uses service role. The anon
-- insert path (used by the old browser-direct insert) is therefore retired.
--
-- Mirrors 20260414000200_close_demo_requests_public_insert.sql.
--
-- ⚠ APPLY ORDER: deploy the code (src/app/api/access-request/route.ts +
--    src/app/login/page.tsx) FIRST, THEN apply this migration. If this
--    runs while the old browser-anon-insert login is still live in prod,
--    access requests break until the new code deploys.
--
-- ⚠ POLICY NAME: the access_requests table was created outside this repo
--    (Auth Foundation Phase 2A, 2026-04-05), so the name was unknown when
--    this file was written and three plural spellings were guessed. All
--    three were wrong — every DROP was a silent no-op. Confirmed against
--    prod on 2026-07-29: the policy is `anon_insert_access_request`
--    (singular, and the words in the other order), with_check = true, i.e.
--    unconditionally open. Re-confirm before applying to any OTHER
--    environment, where the name may differ again:
--        select policyname, cmd, with_check from pg_policies
--          where schemaname = 'public' and tablename = 'access_requests';
--
-- TWO INDEPENDENT CLOSERS, deliberately both — each covers the other's
-- failure mode:
--   1. DROP POLICY removes the unconditionally-open insert rule. Revoking
--      alone would leave it in place, and a later blanket grant (Supabase
--      templates do issue GRANT ... ON ALL TABLES IN SCHEMA public TO anon)
--      would reopen the insert path the same instant.
--   2. REVOKE removes the privilege surface. Privileges are checked before
--      RLS, so with no grant anon cannot insert whatever policy survives.
--
-- ⚠ REVOKE ALL, not REVOKE INSERT. The 2026-07-29 prod audit found anon
--    holding INSERT, SELECT, UPDATE, DELETE, TRUNCATE, TRIGGER and
--    REFERENCES on this table. SELECT/UPDATE/DELETE are blocked today only
--    by the ABSENCE of an anon policy — one permissive policy added later
--    and the rows (names and e-mail addresses typed into the login form)
--    become readable. TRUNCATE differs in kind: RLS does not apply to
--    TRUNCATE at all, so no policy can ever restrain it and the grant is
--    the only brake. anon has no legitimate privilege here — the sole
--    writer is /api/access-request under service_role.
--
--    The `authenticated` GRANTS are deliberately left alone — only anon is
--    revoked. The two yonetici policies that run under authenticated are
--    rewritten in PART 2 below, but their privileges are unchanged.
-- ==========================================================================

DROP POLICY IF EXISTS anon_insert_access_request ON public.access_requests;

REVOKE ALL ON public.access_requests FROM anon;


-- ==========================================================================
-- PART 2 — yonetici policies: user_metadata → profiles.role
-- ==========================================================================
-- Confirmed against prod on 2026-07-29, both policies on this table read the
-- role out of the JWT's user_metadata claim:
--     yonetici_select_access_requests  SELECT  qual
--     yonetici_update_access_requests  UPDATE  qual + with_check
--         auth.jwt() -> 'user_metadata' ->> 'role' = 'yonetici'
--
-- user_metadata is USER-WRITABLE: any authenticated user can call
-- supabase.auth.updateUser({ data: { role: 'yonetici' } }), get a refreshed
-- JWT carrying that claim, and satisfy both policies. That is privilege
-- escalation by design of the claim, not a misconfiguration — the claim was
-- never meant to carry authorization. (app_metadata is the non-writable
-- counterpart; profiles.role is what the rest of this schema already trusts.)
--
-- The audit found exactly two policies reading user_metadata and both are on
-- this table, so this is the whole surface — no sweep of other tables needed.
--
-- The authorization DECISION is unchanged: yonetici, and only yonetici. Only
-- the source changes, mirroring 415d67b, which moved the client off
-- user_metadata to current_user_role() and left the role conditions alone.
--
-- Why current_user_role() is safe inside a policy: it is SECURITY DEFINER
-- (20260407000200) and therefore reads public.profiles WITHOUT re-entering
-- that table's RLS — no policy recursion. It is STABLE with
-- `set search_path = public`, and 17 migrations already use it in exactly
-- this position. access_requests is small, so the per-row call is not a
-- planning concern.
--
-- `TO authenticated` is added on both. The plain-table idiom in this repo
-- often omits it, but here it pairs with the PART 1 revoke: if an anon grant
-- ever returns, these policies still must not match anon.
-- ==========================================================================

DROP POLICY IF EXISTS yonetici_select_access_requests ON public.access_requests;

CREATE POLICY yonetici_select_access_requests ON public.access_requests
  FOR SELECT TO authenticated
  USING (public.current_user_role() = 'yonetici');

DROP POLICY IF EXISTS yonetici_update_access_requests ON public.access_requests;

CREATE POLICY yonetici_update_access_requests ON public.access_requests
  FOR UPDATE TO authenticated
  USING (public.current_user_role() = 'yonetici')
  WITH CHECK (public.current_user_role() = 'yonetici');
