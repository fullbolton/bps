-- CONTRACT: apply ONLY after 001800/001900/002000 + new frontend + authenticated smoke.
-- Contacts direct DML, definer/service projections and parent FK effects remain separate.
BEGIN;
SET LOCAL lock_timeout='15s';
LOCK TABLE public.companies,public.notes IN ACCESS EXCLUSIVE MODE;
DO $$ BEGIN
 IF to_regprocedure('public.company_execute_v1(text,uuid,uuid,uuid,jsonb)') IS NULL
  OR to_regprocedure('public.note_execute_v1(text,uuid,uuid,uuid,uuid,jsonb)') IS NULL
  OR NOT coalesce((SELECT prosecdef FROM pg_proc WHERE oid=to_regprocedure('public.write_company_contact(uuid,uuid,text,text,text,text,boolean,text)')),false) THEN
  RAISE EXCEPTION 'CUSTOMER_WRITE_GATEWAY_MISSING';END IF;
END $$;
REVOKE INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON public.companies,public.notes FROM PUBLIC,anon,authenticated,service_role;
DO $$
DECLARE relation regclass; role_name text;
BEGIN
 FOREACH relation IN ARRAY ARRAY['public.companies'::regclass,'public.notes'::regclass] LOOP
  FOREACH role_name IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
   IF has_table_privilege(role_name,relation,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
    OR has_any_column_privilege(role_name,relation,'INSERT,UPDATE,REFERENCES') THEN RAISE EXCEPTION 'CUSTOMER_WRITE_PRIVILEGE_DRIFT: % %',role_name,relation;END IF;
  END LOOP;
 END LOOP;
END $$;
COMMIT;
