-- Preserve existing contact/note authorship and mizan row history, even when a module is disabled.
-- Hard deletion with dependent history requires a separate explicit retention workflow.
BEGIN;
SET LOCAL lock_timeout='15s';
SET LOCAL statement_timeout='60s';
LOCK TABLE public.profiles,public.companies,public.contacts,public.notes,public.mizan_uploads,public.mizan_upload_rows IN ACCESS EXCLUSIVE MODE;
DO $$
DECLARE expected record; actual record; child_keys text[]; parent_keys text[]; matches integer:=0;
BEGIN
 FOR expected IN SELECT * FROM (VALUES
 ('contacts','contacts_company_id_fkey','companies',ARRAY['company_id'],ARRAY['id'],'c'),
 ('contacts','contacts_created_by_fkey','profiles',ARRAY['created_by'],ARRAY['id'],'n'),
 ('notes','notes_company_id_fkey','companies',ARRAY['company_id'],ARRAY['id'],'c'),
 ('notes','notes_author_id_fkey','profiles',ARRAY['author_id'],ARRAY['id'],'n'),
 ('mizan_upload_rows','mizan_upload_rows_upload_id_fkey','mizan_uploads',ARRAY['upload_id'],ARRAY['id'],'c')
 ) AS x(child,name,parent,child_columns,parent_columns,delete_action) LOOP
  SELECT * INTO actual FROM pg_constraint WHERE conrelid=('public.'||expected.child)::regclass AND conname=expected.name AND contype='f';
  IF NOT FOUND THEN RAISE EXCEPTION 'CUSTOMER_HISTORY_RELATION_MISSING: %',expected.name; END IF;
  SELECT array_agg(a.attname::text ORDER BY k.ord) INTO child_keys FROM unnest(actual.conkey) WITH ORDINALITY k(num,ord)
   JOIN pg_attribute a ON a.attrelid=actual.conrelid AND a.attnum=k.num AND NOT a.attisdropped;
  SELECT array_agg(a.attname::text ORDER BY k.ord) INTO parent_keys FROM unnest(actual.confkey) WITH ORDINALITY k(num,ord)
   JOIN pg_attribute a ON a.attrelid=actual.confrelid AND a.attnum=k.num AND NOT a.attisdropped;
  IF actual.confrelid<>('public.'||expected.parent)::regclass OR child_keys IS DISTINCT FROM expected.child_columns
   OR parent_keys IS DISTINCT FROM expected.parent_columns OR actual.confdeltype::text<>expected.delete_action
   OR actual.confupdtype<>'a' OR actual.confmatchtype<>'s' OR NOT actual.convalidated OR actual.condeferrable THEN
   RAISE EXCEPTION 'CUSTOMER_HISTORY_RELATION_DRIFT: %',expected.name;
  END IF;
  EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I, ADD CONSTRAINT %I FOREIGN KEY (%s) REFERENCES public.%I (%s) ON DELETE RESTRICT',
   expected.child,expected.name,expected.name,(SELECT string_agg(quote_ident(k.name),',' ORDER BY k.ord) FROM unnest(child_keys) WITH ORDINALITY k(name,ord)),expected.parent,
   (SELECT string_agg(quote_ident(k.name),',' ORDER BY k.ord) FROM unnest(parent_keys) WITH ORDINALITY k(name,ord)));
  matches:=matches+1;
 END LOOP;
 IF matches<>5 THEN RAISE EXCEPTION 'CUSTOMER_HISTORY_RELATION_COUNT'; END IF;
 -- Unexpected referential actions could still mutate records indirectly.
 IF EXISTS(SELECT FROM pg_constraint WHERE contype='f' AND
  ((conrelid IN ('public.contacts'::regclass,'public.notes'::regclass) AND confrelid IN ('public.profiles'::regclass,'public.companies'::regclass))
   OR (conrelid='public.mizan_upload_rows'::regclass AND confrelid='public.mizan_uploads'::regclass))
  AND (confdeltype NOT IN ('a','r') OR confupdtype<>'a')) THEN RAISE EXCEPTION 'CUSTOMER_HISTORY_RELATION_UNEXPECTED';END IF;
END $$;
COMMIT;
