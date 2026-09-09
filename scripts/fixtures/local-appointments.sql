-- Synthetic-only extension of local-task-prefill.sql. No contracts baseline.
BEGIN;
SET LOCAL lock_timeout='5s';
DO $$ BEGIN
  IF obj_description(to_regclass('public.tasks')) IS DISTINCT FROM 'BPS synthetic task-prefill fixture v1'
    THEN RAISE EXCEPTION 'Requires synthetic tasks fixture'; END IF;
  IF to_regclass('public.appointments') IS NOT NULL AND obj_description(to_regclass('public.appointments')) IS DISTINCT FROM 'BPS synthetic appointments fixture v1'
    THEN RAISE EXCEPTION 'Refusing non-fixture appointments'; END IF;
END $$;
-- Company detail UI needs a synthetic risk value; no production schema claim.
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS risk text NOT NULL DEFAULT 'dusuk' CHECK(risk IN ('dusuk','orta','yuksek'));
CREATE TABLE IF NOT EXISTS public.appointments(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  company_id uuid NOT NULL REFERENCES public.companies(id),contract_id uuid CHECK(contract_id IS NULL),
  meeting_date date NOT NULL,meeting_time text,meeting_type text NOT NULL DEFAULT 'diger',attendee text,
  status text NOT NULL DEFAULT 'planlandi' CHECK(status IN ('planlandi','tamamlandi','iptal','ertelendi')),
  result text,next_action text,created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK(meeting_type IN ('ziyaret','online','telefon','teklif_sunumu','denetim','diger')),
  CHECK(status<>'tamamlandi' OR (result IS NOT NULL AND length(btrim(result))>0 AND next_action IS NOT NULL AND length(btrim(next_action))>0))
);
COMMENT ON TABLE public.appointments IS 'BPS synthetic appointments fixture v1';
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS appointments_fixture_select ON public.appointments;
CREATE POLICY appointments_fixture_select ON public.appointments FOR SELECT TO authenticated
USING(current_user_role() IN ('yonetici','operasyon') AND tenant_id=current_user_active_tenant());
DROP POLICY IF EXISTS appointments_fixture_insert ON public.appointments;
CREATE POLICY appointments_fixture_insert ON public.appointments FOR INSERT TO authenticated
WITH CHECK(current_user_role() IN ('yonetici','operasyon') AND tenant_id=current_user_active_tenant());
DROP POLICY IF EXISTS appointments_fixture_update ON public.appointments;
CREATE POLICY appointments_fixture_update ON public.appointments FOR UPDATE TO authenticated
USING(current_user_role() IN ('yonetici','operasyon') AND tenant_id=current_user_active_tenant())
WITH CHECK(current_user_role() IN ('yonetici','operasyon') AND tenant_id=current_user_active_tenant());
GRANT SELECT,INSERT,UPDATE ON public.appointments TO authenticated;
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_appointment_id_check;
DO $$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.tasks'::regclass AND conname='tasks_appointment_id_fkey') THEN
    ALTER TABLE public.tasks ADD CONSTRAINT tasks_appointment_id_fkey FOREIGN KEY(appointment_id) REFERENCES public.appointments(id) ON DELETE SET NULL;
  END IF;
END $$;
NOTIFY pgrst,'reload schema';
COMMIT;
