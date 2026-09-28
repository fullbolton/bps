-- CONTRACT: only after 002400/002500, new workers and controlled notification acceptance.
-- Outside-repo service integrations must be inventoried before production apply.
BEGIN;
SET LOCAL lock_timeout='15s';
LOCK TABLE public.companies,public.contacts,public.notes,public.contracts,public.appointments,public.documents IN ACCESS EXCLUSIVE MODE;
DO $$ DECLARE signature text; relation regclass; BEGIN
 FOREACH signature IN ARRAY ARRAY['public.notification_company_names_v1(uuid[],uuid[],text)','public.appointment_notification_candidates_v1(date)','public.contract_notification_candidates_v1()','public.document_notification_candidates_v1(date)','public.document_notification_state_v1(uuid[],uuid[])'] LOOP
  IF NOT coalesce((SELECT prosecdef FROM pg_proc WHERE oid=to_regprocedure(signature)),false)
   OR NOT has_function_privilege('service_role',signature,'EXECUTE') THEN RAISE EXCEPTION 'NOTIFICATION_GATEWAY_MISSING: %',signature; END IF;
 END LOOP;
 REVOKE SELECT ON public.companies,public.contacts,public.notes,public.contracts,public.appointments,public.documents FROM service_role;
 FOREACH relation IN ARRAY ARRAY['public.companies'::regclass,'public.contacts'::regclass,'public.notes'::regclass,'public.contracts'::regclass,'public.appointments'::regclass,'public.documents'::regclass] LOOP
  IF has_table_privilege('service_role',relation,'SELECT') OR has_any_column_privilege('service_role',relation,'SELECT') THEN
   RAISE EXCEPTION 'NOTIFICATION_READ_PRIVILEGE_DRIFT: %',relation; END IF;
 END LOOP;
END $$;
COMMIT;
