-- TEST ONLY: dedicated local acceptance database, not a production migration.
-- Minimal task contract from 20260407000800 + tenant/assignee additions.
-- Contracts/appointments are absent: their IDs MUST stay NULL in this fixture.
BEGIN;
SET LOCAL lock_timeout='5s';
DO $$ BEGIN
  IF to_regclass('public.tasks') IS NOT NULL AND
     obj_description(to_regclass('public.tasks')) IS DISTINCT FROM 'BPS synthetic task-prefill fixture v1'
  THEN RAISE EXCEPTION 'Refusing non-fixture tasks table'; END IF;
END $$;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS display_name text NOT NULL DEFAULT 'Yerel kabul kullanıcısı';
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS legacy_mock_id text;
CREATE OR REPLACE FUNCTION public.current_user_active_tenant() RETURNS uuid
LANGUAGE sql STABLE SET search_path='' AS $$ SELECT (auth.jwt()->'app_metadata'->>'active_tenant')::uuid $$;
CREATE OR REPLACE FUNCTION public.is_active_tenant_member(p_user_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT EXISTS(SELECT 1 FROM public.tenant_memberships WHERE user_id=p_user_id AND tenant_id=public.current_user_verified_tenant())
$$;
CREATE OR REPLACE FUNCTION public.active_tenant_profiles() RETURNS SETOF public.profiles
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT p.* FROM public.profiles p WHERE public.is_active_tenant_member(p.id) ORDER BY p.display_name
$$;
REVOKE ALL ON FUNCTION public.is_active_tenant_member(uuid),public.active_tenant_profiles() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.is_active_tenant_member(uuid),public.active_tenant_profiles() TO authenticated;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS profiles_task_fixture_read ON public.profiles;
CREATE POLICY profiles_task_fixture_read ON public.profiles FOR SELECT TO authenticated
USING(id=auth.uid() OR public.is_active_tenant_member(id));
GRANT SELECT ON public.profiles TO authenticated;
CREATE TABLE IF NOT EXISTS public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  contract_id uuid CHECK(contract_id IS NULL), appointment_id uuid CHECK(appointment_id IS NULL),
  title text NOT NULL CHECK(length(btrim(title))>0),
  assigned_to text, assigned_to_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL, due_date text,
  source_type text NOT NULL DEFAULT 'manuel' CHECK(source_type IN ('manuel','randevu','sozlesme')),
  source_ref text, priority text NOT NULL DEFAULT 'normal' CHECK(priority IN ('dusuk','normal','yuksek','kritik')),
  status text NOT NULL DEFAULT 'acik' CHECK(status IN ('acik','devam_ediyor','tamamlandi','gecikti','iptal')),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.tasks IS 'BPS synthetic task-prefill fixture v1';
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
-- Mirrors the legacy role/claim and assignee membership guards, not the new ops RPC model.
DROP POLICY IF EXISTS tasks_fixture_select ON public.tasks;
CREATE POLICY tasks_fixture_select ON public.tasks FOR SELECT TO authenticated
USING(current_user_role() IN ('yonetici','operasyon','ik') AND tenant_id=current_user_active_tenant());
DROP POLICY IF EXISTS tasks_fixture_insert ON public.tasks;
CREATE POLICY tasks_fixture_insert ON public.tasks FOR INSERT TO authenticated WITH CHECK(
  current_user_role() IN ('yonetici','operasyon','ik') AND tenant_id=current_user_active_tenant()
  AND (assigned_to_user_id IS NULL OR is_active_tenant_member(assigned_to_user_id)));
DROP POLICY IF EXISTS tasks_fixture_update ON public.tasks;
CREATE POLICY tasks_fixture_update ON public.tasks FOR UPDATE TO authenticated
USING(current_user_role() IN ('yonetici','operasyon','ik') AND tenant_id=current_user_active_tenant())
WITH CHECK(current_user_role() IN ('yonetici','operasyon','ik') AND tenant_id=current_user_active_tenant()
  AND (assigned_to_user_id IS NULL OR is_active_tenant_member(assigned_to_user_id)));
GRANT SELECT,INSERT,UPDATE ON public.tasks TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
