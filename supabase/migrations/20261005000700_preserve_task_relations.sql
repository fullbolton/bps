-- Prevent parent deletion from silently deleting tasks/history or detaching their sources.
-- Includes completed tasks. Deactivate business records; removing a membership is unchanged.
-- Hard profile deletion with linked tasks now requires a separate explicit retention/anonymization workflow.
BEGIN;
SET LOCAL lock_timeout='15s';
SET LOCAL statement_timeout='60s';
LOCK TABLE public.profiles,public.companies,public.contracts,public.appointments,public.tasks IN ACCESS EXCLUSIVE MODE;
DO $$
DECLARE expected record; actual record; child_keys text[]; parent_keys text[]; matches integer:=0;
BEGIN
 FOR expected IN SELECT * FROM (VALUES
 ('tasks_company_tenant_fkey','companies',ARRAY['tenant_id','company_id'],ARRAY['tenant_id','id'],'c'),
 ('tasks_contract_company_tenant_fkey','contracts',ARRAY['contract_id','company_id','tenant_id'],ARRAY['id','company_id','tenant_id'],'n'),
 ('tasks_appointment_company_tenant_fkey','appointments',ARRAY['appointment_id','company_id','tenant_id'],ARRAY['id','company_id','tenant_id'],'n'),
 ('tasks_created_by_fkey','profiles',ARRAY['created_by'],ARRAY['id'],'n'),
 ('tasks_assigned_to_user_id_fkey','profiles',ARRAY['assigned_to_user_id'],ARRAY['id'],'n')
 ) AS x(name,parent,child_columns,parent_columns,delete_action) LOOP
  SELECT * INTO actual FROM pg_constraint WHERE conrelid='public.tasks'::regclass AND conname=expected.name AND contype='f';
  IF NOT FOUND THEN RAISE EXCEPTION 'TASK_RELATION_MISSING: %',expected.name; END IF;
  SELECT array_agg(a.attname::text ORDER BY k.ord) INTO child_keys FROM unnest(actual.conkey) WITH ORDINALITY k(num,ord)
   JOIN pg_attribute a ON a.attrelid=actual.conrelid AND a.attnum=k.num AND NOT a.attisdropped;
  SELECT array_agg(a.attname::text ORDER BY k.ord) INTO parent_keys FROM unnest(actual.confkey) WITH ORDINALITY k(num,ord)
   JOIN pg_attribute a ON a.attrelid=actual.confrelid AND a.attnum=k.num AND NOT a.attisdropped;
  IF actual.confrelid<>('public.'||expected.parent)::regclass OR child_keys IS DISTINCT FROM expected.child_columns
   OR parent_keys IS DISTINCT FROM expected.parent_columns OR actual.confdeltype::text<>expected.delete_action
   OR actual.confupdtype<>'a' OR actual.confmatchtype<>'s' OR NOT actual.convalidated OR actual.condeferrable THEN
   RAISE EXCEPTION 'TASK_RELATION_DRIFT: %',expected.name;
  END IF;
  EXECUTE format('ALTER TABLE public.tasks DROP CONSTRAINT %I, ADD CONSTRAINT %I FOREIGN KEY (%s) REFERENCES public.%I (%s) ON DELETE RESTRICT',
   expected.name,expected.name,(SELECT string_agg(quote_ident(k.name),',' ORDER BY k.ord) FROM unnest(child_keys) WITH ORDINALITY k(name,ord)),expected.parent,
   (SELECT string_agg(quote_ident(k.name),',' ORDER BY k.ord) FROM unnest(parent_keys) WITH ORDINALITY k(name,ord)));
  matches:=matches+1;
 END LOOP;
 IF matches<>5 THEN RAISE EXCEPTION 'TASK_RELATION_COUNT'; END IF;
 -- Reject additional cascading foreign keys to these parents; names alone are not sufficient.
 IF EXISTS(SELECT FROM pg_constraint WHERE conrelid='public.tasks'::regclass AND contype='f'
   AND confrelid IN('public.profiles'::regclass,'public.companies'::regclass,'public.contracts'::regclass,'public.appointments'::regclass)
   AND confdeltype<>'r') THEN RAISE EXCEPTION 'TASK_RELATION_UNEXPECTED'; END IF;
END $$;
COMMIT;
