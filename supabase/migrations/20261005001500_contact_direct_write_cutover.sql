-- CONTRACT: apply ONLY after 002200 + new frontend + authenticated contact smoke.
-- This is a separate later cutover; definer/service projections and FK effects remain separate.
BEGIN;
SET LOCAL lock_timeout='15s';
LOCK TABLE public.contacts IN ACCESS EXCLUSIVE MODE;
DO $$ BEGIN
 IF to_regprocedure('public.contact_execute_v1(text,uuid,uuid,uuid,uuid,jsonb)') IS NULL
  OR NOT coalesce((SELECT prosecdef FROM pg_proc WHERE oid=to_regprocedure('public.write_company_contact(uuid,uuid,text,text,text,text,boolean,text)')),false) THEN
  RAISE EXCEPTION 'CONTACT_WRITE_GATEWAY_MISSING';END IF;
END $$;
REVOKE INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON public.contacts FROM PUBLIC,anon,authenticated,service_role;
DO $$
DECLARE relation regclass; role_name text;
BEGIN
 FOREACH relation IN ARRAY ARRAY['public.contacts'::regclass] LOOP
  FOREACH role_name IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
   IF has_table_privilege(role_name,relation,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
    OR has_any_column_privilege(role_name,relation,'INSERT,UPDATE,REFERENCES') THEN RAISE EXCEPTION 'CONTACT_WRITE_PRIVILEGE_DRIFT: % %',role_name,relation;END IF;
  END LOOP;
 END LOOP;
END $$;
COMMIT;
