-- CUTOVER ONLY after the RPC application and authenticated acceptance.
BEGIN;
SET LOCAL lock_timeout='15s';
LOCK TABLE public.appointments IN ACCESS EXCLUSIVE MODE;
DO $$ BEGIN
 IF to_regprocedure('public.appointment_execute_v1(text,uuid,uuid,jsonb)') IS NULL THEN
  RAISE EXCEPTION 'APPOINTMENT_GATEWAY_REQUIRED'; END IF;
END $$;
REVOKE INSERT,UPDATE,DELETE ON public.appointments FROM PUBLIC,anon,authenticated,service_role;
DO $$ BEGIN
 IF has_any_column_privilege('authenticated','public.appointments','INSERT,UPDATE')
  OR has_table_privilege('authenticated','public.appointments','DELETE')
  OR has_any_column_privilege('service_role','public.appointments','INSERT,UPDATE')
  OR has_table_privilege('service_role','public.appointments','DELETE') THEN
  RAISE EXCEPTION 'APPOINTMENT_DIRECT_WRITE_REMAINS'; END IF;
END $$;
NOTIFY pgrst,'reload schema';
COMMIT;
