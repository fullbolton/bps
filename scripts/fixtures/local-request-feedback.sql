-- Dedicated synthetic UI acceptance only; not a production RLS acceptance.
BEGIN;
SET LOCAL lock_timeout='5s';
DO $$ BEGIN
 IF obj_description(to_regclass('public.documents')) IS DISTINCT FROM 'BPS synthetic documents fixture v1'
 THEN RAISE EXCEPTION 'Requires dedicated synthetic documents fixture'; END IF;
 IF to_regclass('public.staffing_demands') IS NOT NULL AND obj_description(to_regclass('public.staffing_demands')) IS DISTINCT FROM 'BPS synthetic requests fixture v1'
 THEN RAISE EXCEPTION 'Refusing non-fixture staffing_demands'; END IF;
END $$;
CREATE TABLE IF NOT EXISTS public.staffing_demands (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES public.tenants(id),
 company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
 position text NOT NULL CHECK(length(btrim(position))>0),
 requested_count integer NOT NULL DEFAULT 1 CHECK(requested_count>=0),
 provided_count integer NOT NULL DEFAULT 0 CHECK(provided_count>=0 AND provided_count<=requested_count),
 location text,start_date text,priority text NOT NULL DEFAULT 'normal' CHECK(priority IN ('dusuk','normal','yuksek','kritik')),
 status text NOT NULL DEFAULT 'yeni' CHECK(status IN ('yeni','degerlendiriliyor','kismi_doldu','tamamen_doldu','beklemede','iptal')),
 responsible text,created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.staffing_demands IS 'BPS synthetic requests fixture v1';
ALTER TABLE public.staffing_demands ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS requests_fixture_select ON public.staffing_demands;
CREATE POLICY requests_fixture_select ON public.staffing_demands FOR SELECT TO authenticated
 USING(tenant_id=current_user_verified_tenant() AND current_user_role() IN ('yonetici','operasyon'));
DROP POLICY IF EXISTS requests_fixture_insert ON public.staffing_demands;
CREATE POLICY requests_fixture_insert ON public.staffing_demands FOR INSERT TO authenticated
 WITH CHECK(tenant_id=current_user_verified_tenant() AND current_user_role() IN ('yonetici','operasyon') AND created_by=auth.uid());
GRANT SELECT,INSERT ON public.staffing_demands TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
