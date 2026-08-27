-- ==========================================================================
-- BPS — financial_summaries: tenant correctness + retire the unused RPC
-- ==========================================================================
-- `financial_summaries.tenant_id` is NOT NULL with no DEFAULT and no trigger,
-- but neither RPC that writes the table ever supplies it. Both are
-- SECURITY DEFINER, which bypasses RLS — it does NOT bypass a NOT NULL
-- constraint, so the calls do not fail on the policy, they fail on the
-- column: "null value violates not-null constraint". The table is empty, so
-- the path has never actually been exercised in production.
--
-- Same defect class as 074e859 (create paths not stamping tenant_id), but it
-- cannot be fixed from TypeScript: the missing column is inside the function
-- bodies.
--
-- Measured in production 2026-08-10 before writing this:
--   confirm_financial_data(jsonb, jsonb)          EXECUTE: anon, authenticated
--   derive_financial_summaries_from_mizan(uuid)   EXECUTE: anon, authenticated
--   financial_summaries                            0 rows
--   idx_financial_summaries_company    UNIQUE (company_id) WHERE company_id IS NOT NULL
--   idx_financial_summaries_portfolio  UNIQUE ((1))        WHERE company_id IS NULL
--
-- ⚠ OWNERSHIP NOTE: the `financial_summaries` TABLE and its indexes are not
--    created by any migration in this repo — like the tenant layer itself,
--    they exist only as out-of-band production DDL. PART 2 below therefore
--    drops and recreates indexes this repo never declared. That is deliberate
--    and is the smallest way to fix the defect, but the underlying gap —
--    production schema that lives nowhere as code — is not addressed here.
--
-- ✅ APPLIED 2026-08-10, ledger repaired.
--
-- ⚠⚠ RUN THIS FILE IN ONE GO — do not paste it into the SQL editor in pieces.
--    PART 2 drops each unique index before recreating it. Executed as a
--    single statement batch that is one transaction, so a failure rolls the
--    whole thing back and no index is left missing. Split across separate
--    editor runs, a failure between a DROP and its CREATE leaves
--    financial_summaries with NO uniqueness on that shape until someone
--    notices. The table is empty, so there is no data at risk today — what is
--    at risk is a silent window in which duplicate portfolio or per-company
--    rows can be written and the ON CONFLICT upserts stop behaving as
--    upserts.
--
-- ⚠⚠ BEFORE APPLYING — drift guard on PART 3. CREATE OR REPLACE overwrites
--    whatever body production currently holds. Production has diverged from
--    this repo before (RLS policies, the entire tenant layer), so confirm the
--    live body still matches 20260415000400 first:
--        select prosrc from pg_proc
--         where oid = 'public.derive_financial_summaries_from_mizan(uuid)'::regprocedure;
--    Verified 2026-08-10: md5 of the live body matched the repo body
--    (f7a94c5bbbe2705c, dollar-quote framing including both boundary
--    newlines). Re-check if time has passed — if it no longer matches,
--    STOP: applying would silently revert a production-only change.
-- ==========================================================================


-- ==========================================================================
-- PART 1 — retire confirm_financial_data (no fix)
-- ==========================================================================
-- Deliberately NOT repaired. Its profile is the one 20260713000200 already
-- closed on complete_appointment_atomic:
--   - SECURITY DEFINER, so it bypasses RLS;
--   - NO role gate at all (derive_financial_summaries_from_mizan checks for
--     yonetici; this one checks nothing);
--   - EXECUTE granted to anon and authenticated;
--   - ZERO callers anywhere in the application — the surface that used to
--     call it was removed with the mock-backed "Rapor Yükle" screen.
--
-- Fixing it would mean keeping an unreachable, ungated, anon-executable
-- writer alive, and applying the weakest available tenant source (the
-- caller's session claim) to its portfolio row — a row nobody creates.
-- Revoking is both smaller and safer.
--
-- ⚠ IF THIS IS EVER RE-ENABLED, do not simply re-grant. The function has TWO
--    upsert paths and PART 2 breaks BOTH of them, not just the portfolio one:
--      - portfolio row:    ON CONFLICT ((1)) WHERE company_id IS NULL
--      - per-company loop: ON CONFLICT (company_id) WHERE company_id IS NOT NULL
--    Neither clause infers against the new tenant-qualified indexes. The
--    failure is asymmetric and easy to misread: a re-granted function would
--    still throw on the FIRST statement, but if only the portfolio clause
--    were repaired it would appear to work and then fail on the per-company
--    loop instead. Both must be rewritten together with tenant_id, and a role
--    gate added, mirroring derive_financial_summaries_from_mizan.
--
-- anon and authenticated are named explicitly, not left to PUBLIC: Supabase
-- issues a default GRANT EXECUTE on public-schema functions to both, so
-- revoking only FROM PUBLIC would leave the two roles that actually reach
-- PostgREST still able to call it. (Learned on 20260713000200.)

REVOKE EXECUTE ON FUNCTION
  public.confirm_financial_data(jsonb, jsonb)
  FROM PUBLIC, anon, authenticated;

-- POST-APPLY VERIFICATION — required. "Retired" is a claim about effective
-- privilege, and a grant listing does not settle it: has_function_privilege()
-- answers explicit and inherited together, which is the whole lesson of
-- 20260713000200.
--
--   select
--     has_function_privilege('anon',
--       'public.confirm_financial_data(jsonb, jsonb)','EXECUTE')          as anon_exec,
--     has_function_privilege('authenticated',
--       'public.confirm_financial_data(jsonb, jsonb)','EXECUTE')          as auth_exec,
--     has_function_privilege('service_role',
--       'public.confirm_financial_data(jsonb, jsonb)','EXECUTE')          as service_exec;
--
-- Required: anon = false, authenticated = false. Those are the two roles that
-- reach PostgREST, so they are what "retired" has to mean here.
--
-- service_role = true is ACCEPTED, not a failure. complete_appointment_atomic
-- came out exactly this way after 20260713000200: service_role and postgres
-- held DIRECT grants, which a revoke from PUBLIC/anon/authenticated does not
-- touch — and should not. The intended end state is the same one: the browser
-- surface is shut, the server side stays reachable. Recorded here so the
-- result is not later mistaken for an incomplete revoke.


-- ==========================================================================
-- PART 2 — unique indexes must include the tenant
-- ==========================================================================
-- This is the more dangerous half of the defect, and it does not announce
-- itself. The portfolio index is UNIQUE ((1)) WHERE company_id IS NULL — a
-- constant expression, so it permits exactly ONE portfolio row in the entire
-- database, not one per tenant. Once tenant_id is being written, a second
-- tenant's portfolio upsert would not fail: it would match the existing row
-- and DO UPDATE would overwrite the first tenant's figures. Silent
-- cross-tenant data loss, which is a worse failure class than the constraint
-- error being fixed here.
--
-- The per-company index has the same shape of problem: UNIQUE (company_id)
-- alone is already implied by company ownership today, but pairing it with
-- tenant_id keeps the uniqueness statement honest and matches the new
-- ON CONFLICT target in PART 3.
--
-- Safe to recreate: the table has 0 rows, so there is no data to migrate and
-- no possibility of a uniqueness violation during creation.

DROP INDEX IF EXISTS public.idx_financial_summaries_portfolio;

CREATE UNIQUE INDEX idx_financial_summaries_portfolio
  ON public.financial_summaries (tenant_id)
  WHERE company_id IS NULL;

DROP INDEX IF EXISTS public.idx_financial_summaries_company;

CREATE UNIQUE INDEX idx_financial_summaries_company
  ON public.financial_summaries (tenant_id, company_id)
  WHERE company_id IS NOT NULL;

-- idx_financial_summaries_tenant_id (non-unique, lookup only) is left alone.


-- ==========================================================================
-- PART 3 — derive_financial_summaries_from_mizan writes the tenant
-- ==========================================================================
-- The tenant is taken from the DATA, not from the session: each summary row
-- inherits `companies.tenant_id` of the company it summarises. That is the
-- semantically correct answer — a summary's tenant is a property of the
-- firma, not of whoever happened to press the button — and it is also the
-- stronger one, because a wrong or forged session claim cannot redirect a
-- write. The browser client keeps calling this RPC unchanged; its tenant
-- assertion is simply never consulted.
--
-- The join is INNER and cannot silently drop rows:
-- `mizan_upload_rows.matched_company_id` is `REFERENCES companies(id)`
-- (20260415000100), so a matched row always has a company.
--
-- Everything else is preserved verbatim from 20260415000400: the yonetici
-- role gate, the upload existence check, the aggregation, the ROW_COUNT
-- return, and the deliberate exclusion of is_overdue / unbilled_amount /
-- created_by from the DO UPDATE list.
--
-- ⚠ NOT FIXED HERE — upload ownership. `p_upload_id` is only checked for
--    existence, never for ownership, and SECURITY DEFINER means RLS on
--    mizan_uploads does not constrain the lookup. `mizan_uploads` carries no
--    tenant_id at all, so there is currently nothing to check it against.
--    With tenant now derived from the companies join, a yonetici who passed
--    another tenant's upload id would write summaries into THAT tenant. It
--    is not reachable through the UI, which only offers uploads the user can
--    see, and closing it properly needs a tenant column on mizan_uploads —
--    schema work that belongs with the wider tenant layer, not smuggled in
--    here. Recorded so it is not mistaken for something this migration
--    already handled.

CREATE OR REPLACE FUNCTION public.derive_financial_summaries_from_mizan(
  p_upload_id uuid
) RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_now timestamptz := now();
  v_role text;
  v_upload_exists boolean;
  v_count int := 0;
BEGIN
  v_user_id := auth.uid();

  -- Role gate — yonetici only
  v_role := public.current_user_role();
  IF v_role IS NULL OR v_role <> 'yonetici' THEN
    RAISE EXCEPTION 'Yalnizca yonetici rolu mizan turevli finansal ozet uretebilir';
  END IF;

  -- Upload existence check
  SELECT true INTO v_upload_exists FROM mizan_uploads WHERE id = p_upload_id;
  IF v_upload_exists IS NULL THEN
    RAISE EXCEPTION 'Mizan yukleme bulunamadi: %', p_upload_id;
  END IF;

  WITH aggregated AS (
    SELECT
      matched_company_id AS company_id,
      SUM(borc_bakiyesi) AS open_receivable
    FROM mizan_upload_rows
    WHERE upload_id = p_upload_id
      AND match_status = 'matched'
      AND matched_company_id IS NOT NULL
    GROUP BY matched_company_id
  )
  INSERT INTO financial_summaries (
    tenant_id, company_id, open_receivable, is_overdue,
    last_source,
    confirmed_by, confirmed_at, created_by, updated_at
  )
  SELECT
    c.tenant_id,
    a.company_id,
    a.open_receivable,
    false,
    'mizan',
    v_user_id, v_now, v_user_id, v_now
  FROM aggregated a
  JOIN companies c ON c.id = a.company_id
  ON CONFLICT (tenant_id, company_id) WHERE company_id IS NOT NULL
  DO UPDATE SET
    open_receivable = EXCLUDED.open_receivable,
    last_source = EXCLUDED.last_source,
    confirmed_by = EXCLUDED.confirmed_by,
    confirmed_at = EXCLUDED.confirmed_at,
    updated_at = EXCLUDED.updated_at;
    -- is_overdue, unbilled_amount, created_by intentionally NOT updated

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION public.derive_financial_summaries_from_mizan(uuid) IS
  'Derives per-company financial summaries from a matched mizan upload. '
  'tenant_id is taken from companies.tenant_id via join — from the data, '
  'never from the caller session — so a wrong or forged JWT claim cannot '
  'redirect the write. yonetici-only. Upload ownership is NOT verified; see '
  'the migration 20260810000100 note.';
