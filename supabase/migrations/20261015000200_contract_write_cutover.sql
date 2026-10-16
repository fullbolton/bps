-- Apply only after both UI and CSV-import RPC callers pass authenticated acceptance.
-- DELETE is a separate remaining workflow; this does not enable module disabling.
BEGIN;
SET LOCAL lock_timeout='15s';
LOCK TABLE public.contracts IN ACCESS EXCLUSIVE MODE;
DO $$ BEGIN
 IF to_regprocedure('public.contract_write_v1(uuid,uuid,bigint,jsonb)') IS NULL THEN RAISE EXCEPTION 'CONTRACT_GATEWAY_REQUIRED';END IF;
END $$;
REVOKE INSERT,UPDATE ON public.contracts FROM PUBLIC,anon,authenticated,service_role;
DO $$ DECLARE r text; BEGIN
 FOREACH r IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
  IF has_any_column_privilege(r,'public.contracts','INSERT,UPDATE') THEN RAISE EXCEPTION 'CONTRACT_DIRECT_WRITE_REMAINS';END IF;
 END LOOP;
END $$;
NOTIFY pgrst,'reload schema';
COMMIT;
