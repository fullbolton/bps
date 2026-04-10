-- ==========================================================================
-- BPS Mutation Integrity — Financial confirm atomicity
-- Single RPC that upserts portfolio + per-company rows in one transaction.
-- Unknown company_ids hard-fail. All-or-nothing.
-- ==========================================================================

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
  -- Get current user
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
    confirmed_by = EXCLUDED.confirmed_by,
    confirmed_at = EXCLUDED.confirmed_at,
    updated_at = EXCLUDED.updated_at;

  -- Upsert per-company rows
  FOR v_row IN SELECT * FROM jsonb_array_elements(p_company_rows)
  LOOP
    v_company_id := (v_row ->> 'company_id')::uuid;

    INSERT INTO financial_summaries (
      company_id, open_receivable, unbilled_amount, is_overdue,
      confirmed_by, confirmed_at, created_by, updated_at
    ) VALUES (
      v_company_id,
      v_row ->> 'open_receivable',
      v_row ->> 'unbilled_amount',
      (v_row ->> 'is_overdue')::boolean,
      v_user_id, v_now, v_user_id, v_now
    )
    ON CONFLICT (company_id) WHERE company_id IS NOT NULL
    DO UPDATE SET
      open_receivable = EXCLUDED.open_receivable,
      unbilled_amount = EXCLUDED.unbilled_amount,
      is_overdue = EXCLUDED.is_overdue,
      confirmed_by = EXCLUDED.confirmed_by,
      confirmed_at = EXCLUDED.confirmed_at,
      updated_at = EXCLUDED.updated_at;
  END LOOP;
END;
$$;
