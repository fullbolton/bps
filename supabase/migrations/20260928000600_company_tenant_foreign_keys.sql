-- Fable G-5: company references must belong to the row's tenant.
-- Short manual migration: readers/writers on all four tables wait until commit.
-- lock_timeout bounds each lock wait, not total execution; statement_timeout
-- bounds each statement. Any error rolls back every constraint change.
BEGIN;
SET LOCAL lock_timeout = '15s';
SET LOCAL statement_timeout = '60s';
LOCK TABLE public.companies, public.contracts, public.appointments, public.tasks IN ACCESS EXCLUSIVE MODE;

DO $$
DECLARE child text; child_oid regclass; company_att smallint; tenant_att smallint;
BEGIN
 FOR child IN SELECT unnest(ARRAY['contracts','appointments','tasks']) LOOP
  child_oid:=('public.'||child)::regclass;
  SELECT attnum INTO STRICT company_att FROM pg_attribute
   WHERE attrelid=child_oid AND attname='company_id' AND NOT attisdropped;
  SELECT attnum INTO STRICT tenant_att FROM pg_attribute
   WHERE attrelid=child_oid AND attname='tenant_id' AND attnotnull AND NOT attisdropped;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint c
   WHERE c.conrelid=child_oid AND c.conname=child||'_company_id_fkey'
    AND c.contype='f' AND c.confrelid='public.companies'::regclass
    AND c.conkey=ARRAY[company_att]
    AND c.confkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid='public.companies'::regclass AND attname='id')]
    AND c.confdeltype='c' AND c.confupdtype='a' AND c.convalidated AND NOT c.condeferrable) THEN
   RAISE EXCEPTION 'Unexpected company foreign key on %',child;
  END IF;
  -- Fail before replacing anything; never infer or repair ownership.
  IF child='tasks' AND EXISTS(SELECT 1 FROM public.tasks t LEFT JOIN public.companies c ON (t.tenant_id,t.company_id)=(c.tenant_id,c.id) WHERE t.company_id IS NOT NULL AND c.id IS NULL)
   OR child='contracts' AND EXISTS(SELECT 1 FROM public.contracts t LEFT JOIN public.companies c ON (t.tenant_id,t.company_id)=(c.tenant_id,c.id) WHERE t.company_id IS NOT NULL AND c.id IS NULL)
   OR child='appointments' AND EXISTS(SELECT 1 FROM public.appointments t LEFT JOIN public.companies c ON (t.tenant_id,t.company_id)=(c.tenant_id,c.id) WHERE t.company_id IS NOT NULL AND c.id IS NULL) THEN
   RAISE EXCEPTION 'Existing company tenant mismatch on %',child;
  END IF;
 END LOOP;
END $$;

-- PostgreSQL verifies a valid unique parent key; missing/drifted keys fail closed.
ALTER TABLE public.contracts
 ADD CONSTRAINT contracts_company_tenant_fkey FOREIGN KEY (tenant_id,company_id) REFERENCES public.companies(tenant_id,id) ON DELETE CASCADE,
 DROP CONSTRAINT contracts_company_id_fkey;
ALTER TABLE public.appointments
 ADD CONSTRAINT appointments_company_tenant_fkey FOREIGN KEY (tenant_id,company_id) REFERENCES public.companies(tenant_id,id) ON DELETE CASCADE,
 DROP CONSTRAINT appointments_company_id_fkey;
-- MATCH SIMPLE deliberately permits company_id NULL for independent tasks.
-- tenant_id remains NOT NULL and the existing independent-context CHECK remains.
ALTER TABLE public.tasks
 ADD CONSTRAINT tasks_company_tenant_fkey FOREIGN KEY (tenant_id,company_id) REFERENCES public.companies(tenant_id,id) ON DELETE CASCADE,
 DROP CONSTRAINT tasks_company_id_fkey;
NOTIFY pgrst, 'reload schema';
COMMIT;
