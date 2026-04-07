-- =============================================================================
-- BPS Faz 1A — Contacts (Yetkililer) primary truth
-- =============================================================================
--
-- Per REAL_DATA_MIGRATION_MASTER_PLAN.md §1 (Faz 1 Batch 1B):
--   "Firma bazlı kontakt truth'u. CRM veya global people directory DEĞİL."
--
-- Per ROLE_MATRIX.md §5.1.1:
--   - Yetkili kişiler firma bağlamında tutulan iletişim kayıtlarıdır.
--   - Her firma en fazla 5 yetkili taşıyabilir.
--   - Tam olarak biri ana yetkili olarak işaretlenmelidir.
--   - Telefon veya e-posta alanlarından en az biri zorunludur.
--   - Operasyon yalnızca telefon/eposta düzenleyebilir; isim/unvan/ana
--     yetkili değiştiremez; yeni yetkili ekleyemez.
--   - İK ve görüntüleyici Yetkililer sekmesine erişemez.
--
-- Architecture (per ARCHITECTURE.md):
--   This file is the schema layer. The invariants are enforced at TWO sites:
--     1. Database — CHECK constraints (phone-or-email, max-5-per-firma,
--        single-ana-yetkili) for hard truth.
--     2. Service layer — same invariants re-checked in
--        `src/lib/services/contacts.ts` so the UI can show clean error
--        messages and so partner scope is re-verified before mutating.
--
-- Dependencies:
--   Must run after 20260407000200_create_companies_anchor.sql.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- contacts
-- ---------------------------------------------------------------------------
-- Field choices match the existing MOCK_YETKILILER shape so the UI cutover
-- is a near-mechanical replacement:
--   - full_name        ← MockYetkili.adSoyad
--   - title            ← MockYetkili.unvan
--   - phone            ← MockYetkili.telefon
--   - email            ← MockYetkili.eposta
--   - is_primary       ← MockYetkili.anaYetkili
--   - context_note     ← MockYetkili.kisaNotlar
--
-- The "max 5 per firma" and "exactly 1 ana yetkili per firma" rules are
-- enforced via partial unique indexes + a constraint trigger (because a
-- pure CHECK can't count rows in another table). See below.
-- ---------------------------------------------------------------------------

create table if not exists public.contacts (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies(id) on delete cascade,
  full_name       text not null,
  title           text,
  phone           text,
  email           text,
  is_primary      boolean not null default false,
  context_note    text,
  created_by      uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  -- Hard invariant: name must not be blank.
  constraint contacts_full_name_not_blank
    check (length(btrim(full_name)) > 0),
  -- Hard invariant: at least one of phone or email must be present
  -- (matches WORKFLOW_RULES + ROLE_MATRIX §5.1.1 + Faz 1B schema niyet).
  constraint contacts_phone_or_email_required
    check (
      (phone is not null and length(btrim(phone)) > 0)
      or (email is not null and length(btrim(email)) > 0)
    )
);

comment on table public.contacts is
  'BPS Yetkili Kişiler. Firma-scoped contact records. Not a CRM. Not a '
  'people directory. Max 5 per company. Exactly one is_primary per company. '
  'See ROLE_MATRIX.md §5.1.1 and REAL_DATA_MIGRATION_MASTER_PLAN.md Faz 1B.';

comment on column public.contacts.is_primary is
  'Marks the firma''s ana yetkili. Exactly one row per company_id may have '
  'is_primary = true (enforced by the partial unique index '
  'contacts_one_primary_per_company).';

-- ---------------------------------------------------------------------------
-- Lookup index: nearly every read filters by company_id
-- ---------------------------------------------------------------------------

create index if not exists contacts_company_id_idx
  on public.contacts (company_id);

-- ---------------------------------------------------------------------------
-- Invariant 1: at most ONE is_primary contact per company
-- ---------------------------------------------------------------------------
-- Implemented as a partial unique index on company_id where is_primary,
-- which is the standard Postgres pattern for a "single flagged row" rule.
--
-- Note this enforces "at most 1", not "exactly 1". Phase 1A allows a firma
-- to have zero contacts (an empty Yetkililer tab is a valid state). The
-- "exactly 1 when at least 1 contact exists" rule is enforced by the
-- service layer (which always promotes the new contact to primary if the
-- firma had no primary before).
-- ---------------------------------------------------------------------------

create unique index if not exists contacts_one_primary_per_company
  on public.contacts (company_id)
  where is_primary;

-- ---------------------------------------------------------------------------
-- Invariant 2: max 5 contacts per company
-- ---------------------------------------------------------------------------
-- Cannot be expressed as a CHECK constraint (it would need to count other
-- rows). Implemented as a constraint trigger that fires AFTER INSERT.
--
-- The service layer also enforces this; the trigger is the database-level
-- safety net so direct SQL inserts cannot bypass it.
-- ---------------------------------------------------------------------------

create or replace function public.contacts_enforce_max_per_company()
returns trigger
language plpgsql
as $$
declare
  contact_count integer;
begin
  select count(*) into contact_count
    from public.contacts
   where company_id = new.company_id;

  if contact_count > 5 then
    raise exception
      'Bir firmaya en fazla 5 yetkili kişi eklenebilir (firma_id=%, mevcut=%)',
      new.company_id, contact_count
      using errcode = 'check_violation';
  end if;

  return null;
end;
$$;

drop trigger if exists contacts_enforce_max_per_company on public.contacts;
create constraint trigger contacts_enforce_max_per_company
  after insert on public.contacts
  deferrable initially immediate
  for each row
  execute function public.contacts_enforce_max_per_company();

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------

create or replace function public.contacts_set_updated_at()
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

drop trigger if exists contacts_set_updated_at on public.contacts;
create trigger contacts_set_updated_at
  before update on public.contacts
  for each row
  execute function public.contacts_set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS — contacts
-- ---------------------------------------------------------------------------
-- Read rules per ROLE_MATRIX.md §4 row "Yetkililer sekmesi görüntüleme":
--   - yonetici → all contacts
--   - partner  → only contacts whose firma is in the partner's scope
--   - operasyon → all contacts (for cross-firma operational coordination)
--   - ik, muhasebe, goruntuleyici → no read access (they have no
--     Yetkililer tab access at all)
--
-- Write rules per ROLE_MATRIX.md §4 rows "Yetkili kişi ekleme/düzenleme":
--   - yonetici  → INSERT/UPDATE/DELETE all
--   - partner   → INSERT/UPDATE/DELETE only within their scope
--   - operasyon → UPDATE only (and only phone/email — enforced at the
--                 service layer; RLS allows the row update because RLS
--                 cannot column-gate without security-definer wrappers).
--   - ik, muhasebe, goruntuleyici → no write
--
-- The "operasyon may only edit phone/email" rule is intentionally NOT
-- enforced at the database level in Phase 1A. The service layer narrows
-- the update payload before sending it. This matches the same approach
-- used by Phase 0 profiles (see profiles_update_own grant on display_name).
-- ---------------------------------------------------------------------------

alter table public.contacts enable row level security;

drop policy if exists contacts_select_role_or_scope on public.contacts;
create policy contacts_select_role_or_scope
  on public.contacts
  for select
  to authenticated
  using (
    case public.current_user_role()
      when 'yonetici'  then true
      when 'operasyon' then true
      when 'partner'   then public.current_user_has_company_scope(company_id)
      else false
    end
  );

drop policy if exists contacts_insert_role_or_scope on public.contacts;
create policy contacts_insert_role_or_scope
  on public.contacts
  for insert
  to authenticated
  with check (
    case public.current_user_role()
      when 'yonetici' then true
      when 'partner'  then public.current_user_has_company_scope(company_id)
      else false
    end
  );

drop policy if exists contacts_update_role_or_scope on public.contacts;
create policy contacts_update_role_or_scope
  on public.contacts
  for update
  to authenticated
  using (
    case public.current_user_role()
      when 'yonetici'  then true
      when 'operasyon' then true
      when 'partner'   then public.current_user_has_company_scope(company_id)
      else false
    end
  )
  with check (
    case public.current_user_role()
      when 'yonetici'  then true
      when 'operasyon' then true
      when 'partner'   then public.current_user_has_company_scope(company_id)
      else false
    end
  );

drop policy if exists contacts_delete_role_or_scope on public.contacts;
create policy contacts_delete_role_or_scope
  on public.contacts
  for delete
  to authenticated
  using (
    case public.current_user_role()
      when 'yonetici' then true
      when 'partner'  then public.current_user_has_company_scope(company_id)
      else false
    end
  );

grant select, insert, update, delete on public.contacts to authenticated;
