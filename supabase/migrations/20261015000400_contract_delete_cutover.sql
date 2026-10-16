-- CUTOVER after authenticated acceptance of the new delete action.
BEGIN;
SET LOCAL lock_timeout='15s';
LOCK TABLE public.contracts IN ACCESS EXCLUSIVE MODE;
DO $$ BEGIN
 IF to_regprocedure('public.contract_delete_v1(uuid,uuid,bigint)') IS NULL THEN RAISE EXCEPTION 'CONTRACT_DELETE_REQUIRED';END IF;
END $$;
REVOKE DELETE,TRUNCATE ON public.contracts FROM PUBLIC,anon,authenticated,service_role;
DO $$ DECLARE r text;BEGIN
 FOREACH r IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
  IF has_table_privilege(r,'public.contracts','DELETE,TRUNCATE') THEN RAISE EXCEPTION 'CONTRACT_DELETE_GRANT_REMAINS';END IF;
 END LOOP;
END $$;
NOTIFY pgrst,'reload schema';
COMMIT;
