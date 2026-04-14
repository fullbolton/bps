-- ==========================================================================
-- BPS Luca V1 — Source transparency on financial_summaries
-- ==========================================================================
-- Adds a minimal `last_source` signal so Firma Detay > Ticari Özet can
-- honestly distinguish mizan-derived values from muhasebe manual-flow
-- values. Both existing writers are rewritten to set last_source on
-- every write. This is a trust/visibility patch — it does not change
-- risk logic, does not add carryover cleanup, and does not alter
-- management-visibility scope.
--
-- Values:
--   'mizan'    — written by derive_financial_summaries_from_mizan
--   'muhasebe' — written by confirm_financial_data (upload/review/confirm)
--
-- NULL is allowed for historical rows written before this migration.
-- ==========================================================================

ALTER TABLE financial_summaries
  ADD COLUMN IF NOT EXISTS last_source text;

ALTER TABLE financial_summaries
  DROP CONSTRAINT IF EXISTS financial_summaries_last_source_check;

ALTER TABLE financial_summaries
  ADD CONSTRAINT financial_summaries_last_source_check
  CHECK (last_source IS NULL OR last_source IN ('mizan', 'muhasebe'));


-- --------------------------------------------------------------------------
-- Rewrite confirm_financial_data to stamp last_source = 'muhasebe'
-- on every upsert (portfolio row + per-company rows).
-- --------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.confirm_financial_data(
  p_portfolio_kpis jsonb,
  p_company_rows jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_now timestamptz := now();
  v_row jsonb;
  v_company_id uuid;
  v_check_exists uuid;
BEGIN
  v_user_id := auth.uid();

  -- Validate all company_ids exist BEFORE any writes
  FOR v_row IN SELECT * FROM jsonb_array_elements(p_company_rows)
  LOOP
    v_company_id := (v_row ->> 'company_id')::uuid;
    SELECT id INTO v_check_exists FROM companies WHERE id = v_company_id;
    IF v_check_exists IS NULL THEN
      RAISE EXCEPTION 'Unknown company_id: %', v_company_id;
    END IF;
  END LOOP;

  -- Upsert portfolio-wide row (company_id IS NULL)
  INSERT INTO financial_summaries (
    company_id, total_open_receivable, invoiced_this_month,
    total_unbilled, total_overdue, overdue_company_count,
    salary_costs, fixed_costs,
    last_source,
    confirmed_by, confirmed_at, created_by, updated_at
  ) VALUES (
    NULL,
    p_portfolio_kpis ->> 'total_open_receivable',
    p_portfolio_kpis ->> 'invoiced_this_month',
    p_portfolio_kpis ->> 'total_unbilled',
    p_portfolio_kpis ->> 'total_overdue',
    (p_portfolio_kpis ->> 'overdue_company_count')::int,
    p_portfolio_kpis ->> 'salary_costs',
    p_portfolio_kpis ->> 'fixed_costs',
    'muhasebe',
    v_user_id, v_now, v_user_id, v_now
  )
  ON CONFLICT ((1)) WHERE company_id IS NULL
  DO UPDATE SET
    total_open_receivable = EXCLUDED.total_open_receivable,
    invoiced_this_month = EXCLUDED.invoiced_this_month,
    total_unbilled = EXCLUDED.total_unbilled,
    total_overdue = EXCLUDED.total_overdue,
    overdue_company_count = EXCLUDED.overdue_company_count,
    salary_costs = EXCLUDED.salary_costs,
    fixed_costs = EXCLUDED.fixed_costs,
    last_source = EXCLUDED.last_source,
    confirmed_by = EXCLUDED.confirmed_by,
    confirmed_at = EXCLUDED.confirmed_at,
    updated_at = EXCLUDED.updated_at;

  -- Upsert per-company rows
  FOR v_row IN SELECT * FROM jsonb_array_elements(p_company_rows)
  LOOP
    v_company_id := (v_row ->> 'company_id')::uuid;

    INSERT INTO financial_summaries (
      company_id, open_receivable, unbilled_amount, is_overdue,
      last_source,
      confirmed_by, confirmed_at, created_by, updated_at
    ) VALUES (
      v_company_id,
      v_row ->> 'open_receivable',
      v_row ->> 'unbilled_amount',
      (v_row ->> 'is_overdue')::boolean,
      'muhasebe',
      v_user_id, v_now, v_user_id, v_now
    )
    ON CONFLICT (company_id) WHERE company_id IS NOT NULL
    DO UPDATE SET
      open_receivable = EXCLUDED.open_receivable,
      unbilled_amount = EXCLUDED.unbilled_amount,
      is_overdue = EXCLUDED.is_overdue,
      last_source = EXCLUDED.last_source,
      confirmed_by = EXCLUDED.confirmed_by,
      confirmed_at = EXCLUDED.confirmed_at,
      updated_at = EXCLUDED.updated_at;
  END LOOP;
END;
$$;


-- --------------------------------------------------------------------------
-- Rewrite derive_financial_summaries_from_mizan to stamp last_source = 'mizan'
-- on every upsert. Still preserves is_overdue, unbilled_amount and
-- created_by on existing rows (muhasebe flow's fields).
-- --------------------------------------------------------------------------

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
    company_id, open_receivable, is_overdue,
    last_source,
    confirmed_by, confirmed_at, created_by, updated_at
  )
  SELECT
    a.company_id,
    a.open_receivable,
    false,
    'mizan',
    v_user_id, v_now, v_user_id, v_now
  FROM aggregated a
  ON CONFLICT (company_id) WHERE company_id IS NOT NULL
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
