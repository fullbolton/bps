-- TEST ONLY. Minimal reader contract, not a reconstruction of production DDL.
BEGIN;
SET LOCAL lock_timeout='15s';
DO $$ BEGIN
 IF obj_description(to_regclass('public.tasks')) IS DISTINCT FROM 'BPS synthetic task-prefill fixture v1'
 OR (to_regclass('public.financial_summaries') IS NOT NULL AND obj_description(to_regclass('public.financial_summaries')) IS DISTINCT FROM 'BPS synthetic financial reader fixture v1')
 THEN RAISE EXCEPTION 'Refusing non-fixture financial table'; END IF;
END $$;
CREATE TABLE IF NOT EXISTS public.financial_summaries (
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES public.tenants(id),company_id uuid REFERENCES public.companies(id),
 total_open_receivable text,invoiced_this_month text,total_unbilled text,total_overdue text,overdue_company_count integer,
 salary_costs text,fixed_costs text,open_receivable text,unbilled_amount text,is_overdue boolean
);
COMMENT ON TABLE public.financial_summaries IS 'BPS synthetic financial reader fixture v1';
CREATE UNIQUE INDEX IF NOT EXISTS fixture_finance_portfolio ON public.financial_summaries(tenant_id) WHERE company_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS fixture_finance_company ON public.financial_summaries(tenant_id,company_id) WHERE company_id IS NOT NULL;
ALTER TABLE public.financial_summaries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.financial_summaries FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.financial_summaries TO authenticated;
DROP POLICY IF EXISTS fixture_financial_read ON public.financial_summaries;
CREATE POLICY fixture_financial_read ON public.financial_summaries FOR SELECT TO authenticated USING (
 tenant_id=public.current_user_verified_tenant() AND public.current_user_role() IN ('yonetici','muhasebe')
);
COMMIT;
