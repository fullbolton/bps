-- TEST ONLY: dedicated synthetic database; actual contract fields/checks, bounded RLS fixture.
BEGIN;
DO $$ BEGIN
 IF obj_description(to_regclass('public.tasks')) IS DISTINCT FROM 'BPS synthetic task-prefill fixture v1'
 OR (to_regclass('public.contracts') IS NOT NULL AND obj_description(to_regclass('public.contracts')) IS DISTINCT FROM 'BPS synthetic contracts fixture v1')
 THEN RAISE EXCEPTION 'Refusing non-fixture database'; END IF;
END $$;
create table if not exists public.contracts (
  id                          uuid primary key default gen_random_uuid(),
  company_id                  uuid not null references public.companies(id) on delete cascade,

  -- Identity
  name                        text not null,
  contract_type               text,

  -- Lifecycle dates (nullable for taslak — drafts may have no dates yet).
  -- The active-dates CHECK below makes them required for non-draft statuses.
  start_date                  date,
  end_date                    date,

  -- Status (per types/ui.ts SozlesmeDurumu and STATUS_DICTIONARY.md).
  -- The whitelist CHECK is the database-level safety net; the service
  -- layer rejects invalid values earlier with a friendly Turkish message.
  status                      text not null default 'taslak',

  -- Display fields preserved from the existing mock UI shape.
  -- contract_value is text (not numeric) because the existing UI
  -- displays formatted strings like "₺1.200.000" and Faz 2 explicitly
  -- excludes ERP/accounting widening. A future phase may promote this
  -- to numeric + currency code if needed.
  contract_value              text,
  scope                       text,
  responsible                 text,

  -- List-row metadata: the denormalized "last meaningful action" text
  -- shown in the Sözleşmeler list "Son İşlem" column. Updated by the
  -- service layer when status or content changes; not a status history.
  last_action_label           text,

  -- Lifecycle metadata (Faz 2 in-scope)
  critical_clauses            text[] not null default '{}',

  -- Bounded renewal tracking truth (scope item 5)
  -- Mirrors RenewalTrackingCard's four-signal model 1:1.
  renewal_target_date         date,
  renewal_discussion_opened   boolean not null default false,
  renewal_responsible_set     boolean not null default false,
  renewal_task_created        boolean not null default false,

  -- Audit
  created_by                  uuid references public.profiles(id) on delete set null,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),

  -- Hard invariants
  constraint contracts_name_not_blank
    check (length(btrim(name)) > 0),

  constraint contracts_status_whitelist
    check (status in (
      'taslak',
      'imza_bekliyor',
      'aktif',
      'suresi_doldu',
      'feshedildi'
    )),

  -- Active and signature-pending contracts must have both dates set.
  -- Drafts may omit them. Expired and terminated contracts are usually
  -- read-only historical rows that already had dates while active, but
  -- we don't enforce dates on those statuses to keep the constraint
  -- additive — historical rows imported without dates would otherwise
  -- be rejected.
  constraint contracts_active_dates_set
    check (
      status not in ('aktif', 'imza_bekliyor')
      or (start_date is not null and end_date is not null)
    ),

  -- start_date <= end_date when both are set.
  constraint contracts_date_order
    check (
      start_date is null
      or end_date is null
      or end_date >= start_date
    )
);
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS tenant_id uuid NOT NULL REFERENCES public.tenants(id);
COMMENT ON TABLE public.contracts IS 'BPS synthetic contracts fixture v1';
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS contracts_fixture_read ON public.contracts;
CREATE POLICY contracts_fixture_read ON public.contracts FOR SELECT TO authenticated
USING(tenant_id=current_user_active_tenant() AND current_user_role() IN ('yonetici','operasyon'));
DROP POLICY IF EXISTS contracts_fixture_write ON public.contracts;
CREATE POLICY contracts_fixture_write ON public.contracts FOR ALL TO authenticated
USING(tenant_id=current_user_active_tenant() AND current_user_role()='yonetici')
WITH CHECK(tenant_id=current_user_active_tenant() AND current_user_role()='yonetici');
GRANT SELECT,INSERT,UPDATE,DELETE ON public.contracts TO authenticated;
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_contract_id_check;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.tasks'::regclass AND conname='tasks_contract_id_fkey') THEN
 ALTER TABLE public.tasks ADD CONSTRAINT tasks_contract_id_fkey FOREIGN KEY(contract_id) REFERENCES public.contracts(id) ON DELETE SET NULL;
 END IF;
END $$;
NOTIFY pgrst,'reload schema';
COMMIT;
