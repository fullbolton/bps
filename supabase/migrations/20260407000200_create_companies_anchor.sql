-- =============================================================================
-- BPS Faz 1A — Companies anchor + Partner-company assignments
-- =============================================================================
--
-- Scope (intentionally minimal — Phase 1A "Yetkililer" slice):
--   - Create the `companies` table as the FK target for `contacts`.
--   - Create the `partner_company_assignments` table that turns the `partner`
--     role from "metadata label" into "rol + kapsam" per Migration Anayasası
--     §1.9 and PARTNER_SCOPE_TOUCHPOINTS.md §5.
--   - Install the helper functions used by RLS policies on this slice
--     (current_user_role, current_user_has_company_scope).
--   - Apply the Faz 1A subset of RLS policies to companies + assignments.
--   - Seed the 8 demo companies that the mock UI expects so contacts can
--     reference them by their existing legacy mock ids (f1..f8) during the
--     Yetkililer cutover.
--
-- Out of scope for this migration (handled by full Faz 1A in a later batch):
--   - Full company CRUD (create / update / pasife alma)
--   - Holding/group (parent_company_id) modeling
--   - Risk + status fields with their full STATUS_DICTIONARY tie-in
--   - Sector / city / address / vergi_no / phone / email
--   - Firmalar list cutover (only the Ana Yetkili column is cut over now)
--   - Operasyon-partneri ↔ partner-role linkage (kept independent per
--     PARTNER_SCOPE_TOUCHPOINTS.md §6 question 3)
--
-- Per CODEX.md "Core Product Rules", Company Detail is the center of the
-- product, but the *full* Firmalar migration is sequenced separately. This
-- file deliberately establishes only the columns that the Yetkililer slice
-- needs to function, plus the bare-minimum row identity needed by other
-- screens that still read from MOCK_FIRMALAR.
--
-- Dependencies:
--   Must run after 20260407000100_profiles_auth_trigger.sql.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- pgcrypto for gen_random_uuid()
-- ---------------------------------------------------------------------------
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- companies — minimal anchor (Faz 1A slice)
-- ---------------------------------------------------------------------------
-- Design notes:
--   - id is a UUID. The full Firmalar migration will keep the same PK shape;
--     no schema break is needed when more columns are added.
--   - `legacy_mock_id` is a transition shim that lets the contacts service
--     resolve "f1".."f8" (the ids hard-coded in MOCK_FIRMALAR) to a real
--     companies.id without requiring the rest of the codebase to migrate
--     yet. It is unique, nullable, and will be DROPPED when the full
--     Firmalar reads cut over (planned: end of Faz 1A full batch).
--   - `name` is required so the seeded demo rows are recognizable when
--     reviewed via the Supabase dashboard.
--   - All other firma fields (sektor, sehir, risk, status, ...) are
--     deliberately omitted — adding them now would expand scope into "full
--     Firmalar migration", which Phase 1A excludes.
-- ---------------------------------------------------------------------------

create table if not exists public.companies (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  legacy_mock_id  text unique,
  created_by      uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint companies_name_not_blank check (length(btrim(name)) > 0)
);

comment on table public.companies is
  'BPS firma anchor. Faz 1A minimal slice — only the columns needed to '
  'support the Yetkililer (contacts) cutover. Full schema (sektor, sehir, '
  'risk, status, group hierarchy, etc.) is added by the full Faz 1A batch.';

comment on column public.companies.legacy_mock_id is
  'Transition shim for the Yetkililer slice. Maps legacy MOCK_FIRMALAR ids '
  '(f1..f8) to real companies.id rows so contacts can be associated with '
  'the firms shown in the still-mock-backed Firmalar list. Will be dropped '
  'by the full Firmalar cutover migration.';

create index if not exists companies_legacy_mock_id_idx
  on public.companies (legacy_mock_id);

-- updated_at trigger (mirrors profiles trigger pattern)
create or replace function public.companies_set_updated_at()
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

drop trigger if exists companies_set_updated_at on public.companies;
create trigger companies_set_updated_at
  before update on public.companies
  for each row
  execute function public.companies_set_updated_at();

-- ---------------------------------------------------------------------------
-- partner_company_assignments — partner role scope
-- ---------------------------------------------------------------------------
-- Per Migration Anayasası §1.9: "partner global admin DEĞİLDİR".
-- A partner sees only firms in their assigned scope.
--
-- Decisions taken from PARTNER_SCOPE_TOUCHPOINTS.md §6:
--   1. Multi-partner per firma is allowed (composite unique on the pair).
--   2. When yonetici creates a firma, no partner is auto-assigned. The
--      yonetici must explicitly add a row here.
--   3. Operasyon-partneri dictionary stays independent of this table.
--
-- This table is yonetici-managed today. Phase 1A does not ship a UI for
-- managing assignments — yonetici writes directly via Supabase dashboard
-- or via a future Ayarlar > Erişim Yönetimi screen.
-- ---------------------------------------------------------------------------

create table if not exists public.partner_company_assignments (
  id                uuid primary key default gen_random_uuid(),
  partner_user_id   uuid not null references public.profiles(id) on delete cascade,
  company_id        uuid not null references public.companies(id) on delete cascade,
  assigned_by       uuid references public.profiles(id) on delete set null,
  assigned_at       timestamptz not null default now(),
  constraint partner_company_assignments_unique unique (partner_user_id, company_id)
);

comment on table public.partner_company_assignments is
  'Partner role scope. A row here means the partner-role user can see and '
  'mutate the linked firma and its dependent records (contacts, contracts, '
  'etc.) per ROLE_MATRIX.md §3.3 + Migration Anayasası §1.9. Not used by '
  'yonetici (global) or any other role.';

create index if not exists partner_company_assignments_partner_idx
  on public.partner_company_assignments (partner_user_id);

create index if not exists partner_company_assignments_company_idx
  on public.partner_company_assignments (company_id);

-- ---------------------------------------------------------------------------
-- Helper: current_user_role()
-- ---------------------------------------------------------------------------
-- Reads the role of the calling user from public.profiles. Used by RLS
-- policies on companies, contacts, and (in later phases) every other
-- domain table. Wrapped in a function so the policy expressions stay
-- short and readable.
--
-- security definer: this function reads profiles.role on behalf of the
-- caller. profiles already grants authenticated SELECT on all rows
-- (Phase 0 policy `profiles_select_authenticated`), so security definer
-- adds no extra read surface — but it does let the function be inlined
-- inside RLS policies without recursive privilege checks.
-- ---------------------------------------------------------------------------

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

comment on function public.current_user_role() is
  'Returns the BPS role of the calling auth user. Used by RLS policies '
  'across the application to express role-based access. Returns NULL when '
  'the user is unauthenticated.';

-- ---------------------------------------------------------------------------
-- Helper: current_user_has_company_scope(uuid)
-- ---------------------------------------------------------------------------
-- The single source of truth for "is this firma in the partner's scope?".
--
-- Behavior:
--   - yonetici → always true (global access)
--   - partner  → true iff there is a row in partner_company_assignments
--                where partner_user_id = auth.uid() and company_id = $1
--   - operasyon, ik, muhasebe, goruntuleyici → role-decided per the
--     specific policy. This helper does NOT auto-grant for them; the
--     calling policy combines it with the role check it cares about.
--
-- Returns false when the user is unauthenticated.
-- ---------------------------------------------------------------------------

create or replace function public.current_user_has_company_scope(target_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    case
      when auth.uid() is null then false
      when public.current_user_role() = 'yonetici' then true
      when public.current_user_role() = 'partner' then exists (
        select 1
          from public.partner_company_assignments pca
         where pca.partner_user_id = auth.uid()
           and pca.company_id = target_company_id
      )
      else false
    end;
$$;

comment on function public.current_user_has_company_scope(uuid) is
  'Returns true when the calling user has scope over the given firma. '
  'yonetici → always true. partner → only assigned firms. All other '
  'roles → false (callers must combine with their own role check).';

-- ---------------------------------------------------------------------------
-- RLS — companies (Faz 1A subset)
-- ---------------------------------------------------------------------------
-- Phase 1A read rules for companies:
--   - yonetici, operasyon, ik, muhasebe, goruntuleyici → can SELECT all
--     (matches the unscoped Firmalar list visibility for these roles per
--      ROLE_MATRIX.md §4)
--   - partner → can SELECT only firms in their assigned scope
--
-- Phase 1A write rules:
--   - INSERT/UPDATE/DELETE are NOT enabled in this slice. Full company
--     CRUD lands in the full Faz 1A batch. Until then, the seed migration
--     is the only writer of companies rows; service_role bypasses RLS for
--     the seed insert.
--
-- The unscoped read for non-partner roles is a Phase 1A choice: it keeps
-- the still-mock-backed Firmalar list working without forcing every
-- non-partner role to wait on partner-scope wiring.
-- ---------------------------------------------------------------------------

alter table public.companies enable row level security;

drop policy if exists companies_select_role_or_scope on public.companies;
create policy companies_select_role_or_scope
  on public.companies
  for select
  to authenticated
  using (
    case public.current_user_role()
      when 'yonetici'      then true
      when 'operasyon'     then true
      when 'ik'            then true
      when 'muhasebe'      then true
      when 'goruntuleyici' then true
      when 'partner'       then public.current_user_has_company_scope(id)
      else false
    end
  );

-- Explicitly leave INSERT/UPDATE/DELETE policies *unset* — Phase 1A locks
-- writes at the application service layer; the seed below uses service_role
-- which bypasses RLS. Future Faz 1A full batch will add policies for the
-- yonetici and partner write paths.

grant select on public.companies to authenticated;

-- ---------------------------------------------------------------------------
-- RLS — partner_company_assignments
-- ---------------------------------------------------------------------------
-- Read rules:
--   - yonetici → all rows
--   - partner  → only their own assignment rows (so the UI can later show
--                a partner which firms are in their scope without leaking
--                other partners' assignments)
--   - everyone else → no rows
--
-- Write rules:
--   - Only yonetici may INSERT, UPDATE, DELETE. Phase 1A does not ship a
--     management UI; yonetici writes via Supabase dashboard or via a
--     future scoped Ayarlar surface.
-- ---------------------------------------------------------------------------

alter table public.partner_company_assignments enable row level security;

drop policy if exists partner_company_assignments_select_self_or_admin
  on public.partner_company_assignments;
create policy partner_company_assignments_select_self_or_admin
  on public.partner_company_assignments
  for select
  to authenticated
  using (
    public.current_user_role() = 'yonetici'
    or partner_user_id = auth.uid()
  );

drop policy if exists partner_company_assignments_insert_admin
  on public.partner_company_assignments;
create policy partner_company_assignments_insert_admin
  on public.partner_company_assignments
  for insert
  to authenticated
  with check (public.current_user_role() = 'yonetici');

drop policy if exists partner_company_assignments_update_admin
  on public.partner_company_assignments;
create policy partner_company_assignments_update_admin
  on public.partner_company_assignments
  for update
  to authenticated
  using (public.current_user_role() = 'yonetici')
  with check (public.current_user_role() = 'yonetici');

drop policy if exists partner_company_assignments_delete_admin
  on public.partner_company_assignments;
create policy partner_company_assignments_delete_admin
  on public.partner_company_assignments
  for delete
  to authenticated
  using (public.current_user_role() = 'yonetici');

grant select, insert, update, delete on public.partner_company_assignments to authenticated;

-- ---------------------------------------------------------------------------
-- Seed: the 8 demo companies referenced by MOCK_FIRMALAR (f1..f8)
-- ---------------------------------------------------------------------------
-- Per REAL_DATA_MIGRATION_MASTER_PLAN.md §3.5 production must start empty —
-- this seed is intended for development / staging environments only. It is
-- guarded by ON CONFLICT so re-running the migration is a no-op, and it is
-- written through service_role which bypasses RLS.
--
-- The set of legacy ids must match `MOCK_FIRMALAR` in
-- `src/mocks/firmalar.ts`. Adding a new mock firma later requires a
-- companion seed entry here so the contacts service can resolve it.
-- ---------------------------------------------------------------------------

insert into public.companies (legacy_mock_id, name)
values
  ('f1', 'Anadolu Lojistik A.Ş.'),
  ('f2', 'Ege Temizlik Hizmetleri'),
  ('f3', 'Başkent Güvenlik Ltd.'),
  ('f4', 'Karadeniz İnşaat'),
  ('f5', 'Marmara Gıda San. Tic.'),
  ('f6', 'Akdeniz Turizm Otelcilik'),
  ('f7', 'Trakya Tekstil A.Ş.'),
  ('f8', 'İç Anadolu Enerji')
on conflict (legacy_mock_id) do nothing;
