-- =============================================================================
-- BPS Faz 2 — Contracts (Sözleşmeler) primary truth
-- =============================================================================
--
-- Per REAL_DATA_MIGRATION_MASTER_PLAN.md §FAZ 2:
--   "Sözleşmeleri lifecycle nesnesi olarak gerçek veriye taşı.
--    Belge arşivi değil, yaşam döngüsü."
--
-- Per ROLE_MATRIX.md §4:
--   - Sözleşme görüntüleme    → yonetici, partner (scoped), operasyon,
--                                 muhasebe (firma context only). ik / goruntuleyici hayır.
--   - Sözleşme oluşturma      → yonetici, partner (scoped), operasyon "Sınırlı".
--                                 Faz 2 minimal: "Sınırlı" ↦ deferred (see unresolved).
--   - Sözleşme durum değiştirme → yonetici, partner (scoped) only.
--
-- Per ROLE_MATRIX.md §5.2:
--   "Sözleşme, ürün içindeki en hassas iş alanlarından biridir. Görüntüleme
--    geniş olabilir; durum değiştirme sınırlı tutulmalıdır. İmza / aktif /
--    feshedildi gibi kararlar yönetsel kontrol altında olmalıdır."
--
-- Per user rules for this slice:
--   - Company Detail stays central
--   - Contracts are lifecycle records, not archive files
--   - kalan gün / approaching signals stay DERIVED (NOT stored)
--   - authorization = role capability + assigned scope
--   - partner is scoped, not global admin
--
-- Schema notes:
--   - `last_action_label` is the denormalized list-row text that the existing
--     UI displays (e.g. "İmza için gönderildi"). It is updated by callers
--     when they perform meaningful lifecycle actions; it is NOT a full
--     status history table (out of scope for Faz 2).
--   - `critical_clauses` is a Postgres text[] — the existing UI presents
--     them as a flat bulleted list with no per-clause metadata. A future
--     phase can promote this to a junction table if richer behavior is
--     needed.
--   - The four `renewal_*` columns are the bounded renewal-tracking truth
--     mentioned in the user's scope item 5. They mirror the existing
--     RenewalTrackingCard four-signal model EXACTLY (yenileme görüşmesi
--     açıldı / sorumlu var / görev üretildi + bitiş tarihi).
--   - `kalan_gun` is NOT a column. It is derived in the service layer
--     (`computeRemainingDays`) and in the UI from `end_date`. This honors
--     the rule "do not create a second truth for kalan gün / approaching
--     signals".
--
-- Dependencies:
--   Must run after 20260407000200_create_companies_anchor.sql (company FK
--   and the current_user_role / current_user_has_company_scope helpers).
-- =============================================================================

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

comment on table public.contracts is
  'BPS Sözleşmeleri. Lifecycle records of firma-scoped service contracts. '
  'Not an archive of files. kalan gün and approaching signals are DERIVED '
  'in the service layer from end_date — they are never stored. See '
  'REAL_DATA_MIGRATION_MASTER_PLAN.md FAZ 2 + ROLE_MATRIX.md §5.2.';

comment on column public.contracts.status is
  'Lifecycle status. Whitelist enforced at the DB; the service layer is '
  'the sanctioned writer for status transitions. Per ROLE_MATRIX.md §4 '
  'row "Sözleşme durum değiştirme", only yonetici and partner-scoped '
  'users may change this column.';

comment on column public.contracts.last_action_label is
  'Denormalized "Son İşlem" string for the list-row column. Updated by '
  'the service layer at status / content mutation time. NOT a full '
  'audit log — that is out of scope for Faz 2.';

comment on column public.contracts.critical_clauses is
  'Flat array of critical clause strings rendered in the Sözleşme Detay '
  'Kritik Maddeler section. Future phases may promote this to a junction '
  'table if per-clause metadata becomes necessary.';

comment on column public.contracts.renewal_target_date is
  'Bounded renewal tracking truth (scope item 5). Mirrors '
  'RenewalTrackingCard.bitisTarihi. Defaults to NULL until a renewal '
  'cycle is opened.';

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
-- Hot read paths:
--   1. /firmalar/[id] Sözleşmeler tab + Genel Bakış kart: filter by
--      company_id; nice-to-have: order by status active first then end_date.
--   2. /firmalar list active-contract count: aggregate by company_id where
--      status = 'aktif'.
--   3. /sozlesmeler list: fetch all visible contracts, sorted by name; the
--      page's own filter logic narrows down further.
-- ---------------------------------------------------------------------------

create index if not exists contracts_company_id_idx
  on public.contracts (company_id);

-- Compound index supporting the "active contracts per firma, end-date asc"
-- read pattern used by both Firma Detay tab and Aktif Sözleşmeler card.
create index if not exists contracts_company_active_idx
  on public.contracts (company_id, status, end_date);

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------

create or replace function public.contracts_set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists contracts_set_updated_at on public.contracts;
create trigger contracts_set_updated_at
  before update on public.contracts
  for each row
  execute function public.contracts_set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS — contracts
-- ---------------------------------------------------------------------------
-- Read rules per ROLE_MATRIX.md §4 row "Sözleşme görüntüleme":
--   - yonetici  → all rows
--   - partner   → scoped
--   - operasyon → all rows
--   - muhasebe  → all rows at the DB layer; the global Sözleşmeler list
--                 page is gated to muhasebe at the UI layer (firma context
--                 only per §3.5). The DB cannot differentiate access
--                 surface; "firma context only" is enforced by which UI
--                 surfaces render the rows. This matches ROLE_MATRIX line
--                 291 "Firma bağlamında salt okunur".
--   - ik, goruntuleyici → no read
--
-- Write rules per ROLE_MATRIX.md §4 rows "Sözleşme oluşturma" + "Sözleşme
-- durum değiştirme":
--
--   INSERT (sözleşme oluşturma):
--     yonetici  Evet
--     partner   Portföyünde Evet
--     operasyon "Sınırlı" → not granted at the DB level in this slice
--                            (see unresolved items in the cutover report)
--     others    Hayır
--
--   UPDATE (content + status):
--     yonetici  Evet
--     partner   Portföyünde Evet
--     others    Hayır
--
--   The §5.2 rule "İmza / aktif / feshedildi gibi kararlar yönetsel
--   kontrol altında olmalıdır" is honored at the SERVICE layer
--   (services/contracts.ts narrows status transitions to yonetici +
--   partner-scoped only — the same set as the broader UPDATE policy).
--
--   DELETE:
--     yonetici only. Contracts are lifecycle records — terminations are
--     status changes (feshedildi), not row deletions. Direct deletion is
--     reserved for the yonetici cleanup path.
-- ---------------------------------------------------------------------------

alter table public.contracts enable row level security;

drop policy if exists contracts_select_role_or_scope on public.contracts;
create policy contracts_select_role_or_scope
  on public.contracts
  for select
  to authenticated
  using (
    case public.current_user_role()
      when 'yonetici'  then true
      when 'operasyon' then true
      when 'muhasebe'  then true
      when 'partner'   then public.current_user_has_company_scope(company_id)
      else false
    end
  );

drop policy if exists contracts_insert_role_or_scope on public.contracts;
create policy contracts_insert_role_or_scope
  on public.contracts
  for insert
  to authenticated
  with check (
    case public.current_user_role()
      when 'yonetici' then true
      when 'partner'  then public.current_user_has_company_scope(company_id)
      else false
    end
  );

drop policy if exists contracts_update_role_or_scope on public.contracts;
create policy contracts_update_role_or_scope
  on public.contracts
  for update
  to authenticated
  using (
    case public.current_user_role()
      when 'yonetici' then true
      when 'partner'  then public.current_user_has_company_scope(company_id)
      else false
    end
  )
  with check (
    case public.current_user_role()
      when 'yonetici' then true
      when 'partner'  then public.current_user_has_company_scope(company_id)
      else false
    end
  );

drop policy if exists contracts_delete_admin on public.contracts;
create policy contracts_delete_admin
  on public.contracts
  for delete
  to authenticated
  using (public.current_user_role() = 'yonetici');

grant select, insert, update, delete on public.contracts to authenticated;
