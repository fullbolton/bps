-- P1-07: same-company/tenant relations. Pending migration; accepts the verified 0010 company-free task schema.
-- PostgreSQL 15+ is required for column-specific ON DELETE SET NULL.
-- Manual apply blocks reads/writes on these tables until commit; timeout only bounds lock waits.
BEGIN;
SET LOCAL lock_timeout = '15s';
LOCK TABLE public.contracts, public.appointments, public.tasks IN ACCESS EXCLUSIVE MODE;

DO $$
DECLARE r record; n integer;
BEGIN
  IF current_setting('server_version_num')::integer < 150000 THEN
    RAISE EXCEPTION 'PostgreSQL 15+ required';
  END IF;
  -- Reject schema drift instead of dropping a differently defined constraint.
  FOR r IN SELECT * FROM (VALUES
    ('tasks','contract_id','contracts','tasks_contract_id_fkey'),
    ('tasks','appointment_id','appointments','tasks_appointment_id_fkey'),
    ('appointments','contract_id','contracts','appointments_contract_id_fkey')
  ) AS x(child,col,parent,constraint_name) LOOP
    SELECT count(*) INTO n FROM pg_constraint c
    WHERE c.conrelid=('public.'||r.child)::regclass AND c.conname=r.constraint_name
      AND c.contype='f' AND c.confrelid=('public.'||r.parent)::regclass
      AND c.confdeltype='n' AND c.confupdtype='a' AND c.convalidated AND NOT c.condeferrable
      AND c.conkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid=c.conrelid AND attname=r.col)]
      AND c.confkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid=c.confrelid AND attname='id')];
    IF n<>1 THEN RAISE EXCEPTION 'Unexpected constraint: %',r.constraint_name; END IF;
  END LOOP;
  -- MATCH SIMPLE may only bypass optional relation IDs, never missing scope.
  SELECT count(*) INTO n FROM pg_attribute
  WHERE attrelid IN ('public.tasks'::regclass,'public.appointments'::regclass,'public.contracts'::regclass)
    AND attname IN ('company_id','tenant_id') AND attnotnull AND NOT attisdropped;
  IF n=5 AND EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='public.tasks'::regclass AND attname='company_id' AND NOT attnotnull AND NOT attisdropped) THEN
    -- 0010 may already be applied: a company-free task cannot carry linked context.
    -- Ask PostgreSQL to canonicalize the expected CHECK; do not trust its name alone.
    CREATE TEMP TABLE bps_expected_task_context (LIKE public.tasks) ON COMMIT DROP;
    ALTER TABLE bps_expected_task_context ADD CONSTRAINT expected_context CHECK (
      company_id IS NOT NULL OR (contract_id IS NULL AND appointment_id IS NULL AND source_type='manuel' AND source_ref IS NULL)
    );
    IF NOT EXISTS(SELECT 1 FROM pg_constraint c
      WHERE c.conrelid='public.tasks'::regclass AND c.conname='tasks_independent_context_check'
      AND c.contype='c' AND c.convalidated
      AND pg_get_expr(c.conbin,c.conrelid)=(SELECT pg_get_expr(e.conbin,e.conrelid) FROM pg_constraint e WHERE e.conrelid='bps_expected_task_context'::regclass AND e.conname='expected_context')) THEN
      RAISE EXCEPTION 'Nullable task company requires the verified independent-context CHECK';
    END IF;
  ELSIF n<>6 THEN RAISE EXCEPTION 'Unexpected nullable scope columns'; END IF;
  IF EXISTS (SELECT 1 FROM public.tasks t LEFT JOIN public.contracts c
      ON (c.id,c.company_id,c.tenant_id)=(t.contract_id,t.company_id,t.tenant_id)
      WHERE t.contract_id IS NOT NULL AND c.id IS NULL)
    OR EXISTS (SELECT 1 FROM public.tasks t LEFT JOIN public.appointments a
      ON (a.id,a.company_id,a.tenant_id)=(t.appointment_id,t.company_id,t.tenant_id)
      WHERE t.appointment_id IS NOT NULL AND a.id IS NULL)
    OR EXISTS (SELECT 1 FROM public.appointments a LEFT JOIN public.contracts c
      ON (c.id,c.company_id,c.tenant_id)=(a.contract_id,a.company_id,a.tenant_id)
      WHERE a.contract_id IS NOT NULL AND c.id IS NULL) THEN
    RAISE EXCEPTION 'Existing mismatched relations; run related_company_inventory.sql. No data repaired.';
  END IF;
END $$;

ALTER TABLE public.contracts ADD CONSTRAINT contracts_company_tenant_identity UNIQUE (id,company_id,tenant_id);
ALTER TABLE public.appointments ADD CONSTRAINT appointments_company_tenant_identity UNIQUE (id,company_id,tenant_id);
ALTER TABLE public.tasks DROP CONSTRAINT tasks_contract_id_fkey, DROP CONSTRAINT tasks_appointment_id_fkey;
ALTER TABLE public.appointments DROP CONSTRAINT appointments_contract_id_fkey;
ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_contract_company_tenant_fkey FOREIGN KEY (contract_id,company_id,tenant_id)
    REFERENCES public.contracts(id,company_id,tenant_id) ON DELETE SET NULL (contract_id),
  ADD CONSTRAINT tasks_appointment_company_tenant_fkey FOREIGN KEY (appointment_id,company_id,tenant_id)
    REFERENCES public.appointments(id,company_id,tenant_id) ON DELETE SET NULL (appointment_id);
ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_contract_company_tenant_fkey FOREIGN KEY (contract_id,company_id,tenant_id)
    REFERENCES public.contracts(id,company_id,tenant_id) ON DELETE SET NULL (contract_id);
COMMIT;
