-- ==========================================================================
-- BPS Luca V1 — Derive financial_summaries from the latest confirmed mizan
-- ==========================================================================
-- Runs downstream of the mizan_uploads / mizan_upload_rows snapshot.
-- For each matched row of the given upload, upserts the per-company
-- financial_summaries row so that open_receivable tracks borc_bakiyesi.
--
-- Semantics:
--   * Only matched rows feed the derivation — unmatched / ambiguous rows
--     carry no matched_company_id and are skipped by the match_status
--     consistency constraint.
--   * If a company appears on multiple 120.xxx leaf rows in the upload,
--     their borc_bakiyesi values are summed into a single
--     open_receivable (one financial_summaries row per company).
--   * The upsert preserves is_overdue, unbilled_amount and created_by
--     on existing per-company rows — those belong to the muhasebe
--     (manual) confirmation flow. Only open_receivable and the
--     confirmed_by / confirmed_at / updated_at audit fields are
--     overwritten by the mizan-derived snapshot.
--   * Portfolio-wide aggregates (company_id IS NULL) are NOT touched
--     by this RPC — only per-company rows.
--   * Management visibility only. Not accounting truth.
--
-- Authorization: yonetici only — mirrors mizan_uploads RLS and the
-- Luca import page role guard.
-- ==========================================================================

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

  -- Upload existence check (hard-fail on unknown upload_id)
  SELECT true INTO v_upload_exists FROM mizan_uploads WHERE id = p_upload_id;
  IF v_upload_exists IS NULL THEN
    RAISE EXCEPTION 'Mizan yukleme bulunamadi: %', p_upload_id;
  END IF;

  -- Aggregate matched rows by company → upsert open_receivable
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
    company_id, open_receivable, is_overdue,
    confirmed_by, confirmed_at, created_by, updated_at
  )
  SELECT
    a.company_id,
    a.open_receivable,
    false,  -- mizan does not carry overdue info; preserved on conflict below
    v_user_id, v_now, v_user_id, v_now
  FROM aggregated a
  ON CONFLICT (company_id) WHERE company_id IS NOT NULL
  DO UPDATE SET
    open_receivable = EXCLUDED.open_receivable,
    confirmed_by = EXCLUDED.confirmed_by,
    confirmed_at = EXCLUDED.confirmed_at,
    updated_at = EXCLUDED.updated_at;
    -- is_overdue, unbilled_amount, created_by intentionally NOT updated

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.derive_financial_summaries_from_mizan(uuid) TO authenticated;
