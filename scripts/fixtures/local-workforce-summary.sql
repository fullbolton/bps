-- TEST ONLY: aggregate workforce reader in the dedicated synthetic database.
BEGIN;
SET LOCAL lock_timeout='5s';
DO $$ BEGIN
 IF obj_description(to_regclass('public.documents')) IS DISTINCT FROM 'BPS synthetic documents fixture v1'
 OR (to_regclass('public.workforce_summary') IS NOT NULL AND obj_description(to_regclass('public.workforce_summary')) IS DISTINCT FROM 'BPS synthetic workforce fixture v1')
 THEN RAISE EXCEPTION 'Refusing non-fixture database'; END IF;
END $$;
CREATE TABLE IF NOT EXISTS public.workforce_summary (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),company_id uuid NOT NULL UNIQUE REFERENCES public.companies(id) ON DELETE CASCADE,
 location text,target_count integer NOT NULL DEFAULT 0,current_count integer NOT NULL DEFAULT 0,
 hires_last_30d integer NOT NULL DEFAULT 0,exits_last_30d integer NOT NULL DEFAULT 0,
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(target_count>=0 AND current_count>=0 AND hires_last_30d>=0 AND exits_last_30d>=0)
);
COMMENT ON TABLE public.workforce_summary IS 'BPS synthetic workforce fixture v1';
ALTER TABLE public.workforce_summary ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS workforce_fixture_read ON public.workforce_summary;
CREATE POLICY workforce_fixture_read ON public.workforce_summary FOR SELECT TO authenticated
 USING(current_user_role() IN ('yonetici','operasyon') AND EXISTS(SELECT 1 FROM public.companies c WHERE c.id=company_id AND c.tenant_id=current_user_verified_tenant()));
GRANT SELECT ON public.workforce_summary TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
