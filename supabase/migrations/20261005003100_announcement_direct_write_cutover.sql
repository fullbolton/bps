-- CONTRACT: apply only after 003000 + RPC frontend + authenticated smoke.
BEGIN;
SET LOCAL lock_timeout='15s';
LOCK TABLE public.announcements IN ACCESS EXCLUSIVE MODE;
DO $$ BEGIN
 IF to_regprocedure('public.announcement_execute_v1(text,uuid,uuid,text)') IS NULL THEN
  RAISE EXCEPTION 'ANNOUNCEMENT_GATEWAY_MISSING';END IF;
END $$;
REVOKE INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON public.announcements FROM PUBLIC,anon,authenticated,service_role;
-- No service reader consumes announcements; browser reads retain the role RLS.
REVOKE SELECT ON public.announcements FROM PUBLIC,anon,service_role;
DO $$ DECLARE r text; BEGIN
 FOREACH r IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
  IF has_table_privilege(r,'public.announcements','INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
   OR has_any_column_privilege(r,'public.announcements','INSERT,UPDATE,REFERENCES')
   OR (r<>'authenticated' AND has_any_column_privilege(r,'public.announcements','SELECT')) THEN
   RAISE EXCEPTION 'ANNOUNCEMENT_PRIVILEGE_DRIFT: %',r;END IF;
 END LOOP;
END $$;
COMMIT;
