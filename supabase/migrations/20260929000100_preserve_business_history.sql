-- Preserve contracts, appointments, document classification and completion receipts across parent deletion.
-- Hard deletion with dependent history requires a separate explicit retention workflow.
BEGIN;
SET LOCAL lock_timeout='15s';
SET LOCAL statement_timeout='60s';
LOCK TABLE public.companies,public.contracts,public.appointments,public.documents,public.appointment_completion_receipts IN ACCESS EXCLUSIVE MODE;
DO $$
DECLARE expected record; actual record; child_keys text[]; parent_keys text[]; matches integer:=0;
BEGIN
 FOR expected IN SELECT * FROM (VALUES
 ('contracts','contracts_company_tenant_fkey','companies',ARRAY['tenant_id','company_id'],ARRAY['tenant_id','id'],'c'),
 ('appointments','appointments_company_tenant_fkey','companies',ARRAY['tenant_id','company_id'],ARRAY['tenant_id','id'],'c'),
 ('appointments','appointments_contract_company_tenant_fkey','contracts',ARRAY['contract_id','company_id','tenant_id'],ARRAY['id','company_id','tenant_id'],'n'),
 ('documents','documents_company_id_fkey','companies',ARRAY['company_id'],ARRAY['id'],'c'),
 ('documents','documents_contract_id_fkey','contracts',ARRAY['contract_id'],ARRAY['id'],'n'),
 ('appointment_completion_receipts','appointment_completion_receipts_appointment_id_fkey','appointments',ARRAY['appointment_id'],ARRAY['id'],'c')
 ) AS x(child,name,parent,child_columns,parent_columns,delete_action) LOOP
  SELECT * INTO actual FROM pg_constraint WHERE conrelid=('public.'||expected.child)::regclass AND conname=expected.name AND contype='f';
  IF NOT FOUND THEN RAISE EXCEPTION 'BUSINESS_HISTORY_RELATION_MISSING: %',expected.name; END IF;
  SELECT array_agg(a.attname::text ORDER BY k.ord) INTO child_keys FROM unnest(actual.conkey) WITH ORDINALITY k(num,ord)
   JOIN pg_attribute a ON a.attrelid=actual.conrelid AND a.attnum=k.num AND NOT a.attisdropped;
  SELECT array_agg(a.attname::text ORDER BY k.ord) INTO parent_keys FROM unnest(actual.confkey) WITH ORDINALITY k(num,ord)
   JOIN pg_attribute a ON a.attrelid=actual.confrelid AND a.attnum=k.num AND NOT a.attisdropped;
  IF actual.confrelid<>('public.'||expected.parent)::regclass OR child_keys IS DISTINCT FROM expected.child_columns
   OR parent_keys IS DISTINCT FROM expected.parent_columns OR actual.confdeltype::text<>expected.delete_action
   OR (expected.child='appointments' AND expected.parent='contracts' AND actual.confdelsetcols IS DISTINCT FROM ARRAY[actual.conkey[1]])
   OR actual.confupdtype<>'a' OR actual.confmatchtype<>'s' OR NOT actual.convalidated OR actual.condeferrable THEN
   RAISE EXCEPTION 'BUSINESS_HISTORY_RELATION_DRIFT: %',expected.name;
  END IF;
  EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I, ADD CONSTRAINT %I FOREIGN KEY (%s) REFERENCES public.%I (%s) ON DELETE RESTRICT',
   expected.child,expected.name,expected.name,(SELECT string_agg(quote_ident(k.name),',' ORDER BY k.ord) FROM unnest(child_keys) WITH ORDINALITY k(name,ord)),expected.parent,
   (SELECT string_agg(quote_ident(k.name),',' ORDER BY k.ord) FROM unnest(parent_keys) WITH ORDINALITY k(name,ord)));
  matches:=matches+1;
 END LOOP;
 IF matches<>6 THEN RAISE EXCEPTION 'BUSINESS_HISTORY_RELATION_COUNT'; END IF;
 -- Reject extra destructive paths among the reviewed table pairs.
 IF EXISTS(SELECT FROM pg_constraint c WHERE c.contype='f' AND
  ((c.conrelid IN ('public.contracts'::regclass,'public.appointments'::regclass,'public.documents'::regclass) AND c.confrelid='public.companies'::regclass)
   OR (c.conrelid IN ('public.appointments'::regclass,'public.documents'::regclass) AND c.confrelid='public.contracts'::regclass)
   OR (c.conrelid='public.appointment_completion_receipts'::regclass AND c.confrelid='public.appointments'::regclass))
  AND (c.confdeltype NOT IN ('a','r') OR c.confupdtype<>'a')) THEN RAISE EXCEPTION 'BUSINESS_HISTORY_RELATION_UNEXPECTED';END IF;
END $$;
COMMIT;
