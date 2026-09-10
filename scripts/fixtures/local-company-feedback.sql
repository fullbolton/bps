-- Synthetic UI fixture extension only; not a production migration/security acceptance.
BEGIN;
SET LOCAL lock_timeout='5s';
DO $$ BEGIN
 IF obj_description(to_regclass('public.documents')) IS DISTINCT FROM 'BPS synthetic documents fixture v1'
 THEN RAISE EXCEPTION 'Requires dedicated synthetic documents fixture'; END IF;
END $$;
ALTER TABLE public.companies ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS sector text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id);
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
GRANT INSERT ON public.companies TO authenticated;
DROP POLICY IF EXISTS companies_fixture_insert ON public.companies;
CREATE POLICY companies_fixture_insert ON public.companies FOR INSERT TO authenticated
 WITH CHECK(tenant_id=public.current_user_verified_tenant() AND public.current_user_role()='yonetici' AND created_by=auth.uid());
NOTIFY pgrst, 'reload schema';
COMMIT;
