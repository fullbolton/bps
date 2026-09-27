-- LOCAL DRAFT. Supports critical-date updated_at CAS, including multiple writes in one transaction.
BEGIN;
SET LOCAL lock_timeout = '15s';
LOCK TABLE public.critical_dates IN ACCESS EXCLUSIVE MODE;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.critical_dates WHERE updated_at IS NULL OR NOT isfinite(updated_at)) THEN
    RAISE EXCEPTION 'Invalid critical date timestamps; review data before applying. No automatic repair.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger
    WHERE tgrelid='public.critical_dates'::regclass AND tgname='critical_dates_set_updated_at'
      AND tgfoid='public.critical_dates_set_updated_at()'::regprocedure
      AND tgtype=19 AND tgenabled='O' AND NOT tgisinternal) THEN
    RAISE EXCEPTION 'Expected BEFORE UPDATE ROW timestamp trigger missing or changed';
  END IF;
END $$;
CREATE OR REPLACE FUNCTION public.critical_dates_set_updated_at()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
  -- now() is transaction-stable; it cannot distinguish two edits in the same transaction.
  -- Never trust a caller-supplied updated_at value or permit a repeated/backwards stamp.
  IF OLD.updated_at IS NULL OR NOT isfinite(OLD.updated_at) THEN
    RAISE EXCEPTION 'Invalid previous critical date timestamp';
  END IF;
  NEW.updated_at := greatest(clock_timestamp(), OLD.updated_at + interval '1 microsecond');
  RETURN NEW;
END $$;
COMMIT;
