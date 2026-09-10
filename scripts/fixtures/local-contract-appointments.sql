-- TEST ONLY: contract-linked appointments in the dedicated synthetic database.
-- Mirrors the nullable FK in 20260407000700_create_appointments.sql.
BEGIN;
SET LOCAL lock_timeout='5s';
DO $$ BEGIN
 IF obj_description(to_regclass('public.contracts')) IS DISTINCT FROM 'BPS synthetic contracts fixture v1'
 OR obj_description(to_regclass('public.appointments')) IS DISTINCT FROM 'BPS synthetic appointments fixture v1'
 THEN RAISE EXCEPTION 'Refusing non-fixture contract/appointment tables'; END IF;
END $$;
ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_contract_id_check;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.appointments'::regclass AND conname='appointments_contract_id_fkey') THEN
  ALTER TABLE public.appointments ADD CONSTRAINT appointments_contract_id_fkey FOREIGN KEY(contract_id) REFERENCES public.contracts(id) ON DELETE SET NULL;
 END IF;
END $$;
NOTIFY pgrst,'reload schema';
COMMIT;
