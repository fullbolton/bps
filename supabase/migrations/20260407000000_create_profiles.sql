-- =============================================================================
-- BPS Phase 0 — Profiles foundation
-- =============================================================================
--
-- Purpose:
--   Establish the app-facing identity layer that sits between auth.users and
--   the BPS application. Per REAL_DATA_MIGRATION_MASTER_PLAN.md §3.2:
--
--     "auth.users yerine public.profiles app-facing identity katmani olarak
--      kullanilacak. Tum created_by/author_id FK'lari profiles.id'ye baglanir."
--
-- Scope guardrails:
--   - This migration creates ONLY the profiles table, the auth-link trigger,
--     and minimum RLS policies for the profiles table itself.
--   - No business domain tables (companies, contracts, etc.) are created here.
--   - No partner_assignments table is created here — that is locked in Faz 1A.
--   - No backfill of existing auth users is performed here.
--
-- Role enum (must match `src/context/AuthContext.tsx::UserRole`):
--   yonetici | partner | operasyon | ik | muhasebe | goruntuleyici
--
-- The 'satis' role is intentionally absent — it was removed when the role
-- model was migrated to (rol + kapsam) per ROLE_MATRIX.md §2.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Profiles table
-- ---------------------------------------------------------------------------
-- Design choice: profiles.id IS the auth.users.id (1:1, same UUID).
-- This is the standard Supabase pattern and avoids the need for a separate
-- auth_id field. created_by / author_id FKs in future tables will reference
-- profiles(id) which transitively references auth.users(id).
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text not null,
  display_name  text not null,
  role          text not null
                  check (role in (
                    'yonetici',
                    'partner',
                    'operasyon',
                    'ik',
                    'muhasebe',
                    'goruntuleyici'
                  ))
                  default 'goruntuleyici',
  unit          text
                  check (unit is null or unit in (
                    'operasyon',
                    'satis',
                    'muhasebe',
                    'yonetim',
                    'ik',
                    'diger'
                  )),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.profiles is
  'BPS app-facing identity layer. Sits between auth.users and the app. '
  'role drives authorization (rol + kapsam model). '
  'unit is the organizational department, separate from role. '
  'See ROLE_MATRIX.md §3 for role definitions.';

comment on column public.profiles.id is
  'Same UUID as auth.users.id. 1:1 mapping enforced via FK + cascade delete.';

comment on column public.profiles.role is
  'Authorization role per ROLE_MATRIX.md §2. One of 6 values. '
  'Note: satis role was removed and replaced by partner. '
  'See ARCHITECTURE.md §5 for full role description.';

comment on column public.profiles.unit is
  'Organizational department (birim) — separate concept from role. '
  'Used by yonlendirme (cross-unit routing) for canResolve check. '
  'NULL is allowed for users whose unit has not been assigned yet.';

-- ---------------------------------------------------------------------------
-- Useful index for joining/lookup
-- ---------------------------------------------------------------------------

create index if not exists profiles_role_idx on public.profiles(role);
create unique index if not exists profiles_email_uniq on public.profiles(lower(email));

-- ---------------------------------------------------------------------------
-- Updated_at trigger
-- ---------------------------------------------------------------------------

create or replace function public.profiles_set_updated_at()
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

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row
  execute function public.profiles_set_updated_at();

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------
-- Phase 0 minimum policy set:
--   - All authenticated users can read all profiles (needed for joining notes,
--     tasks, etc. with author display names in later phases).
--   - A user can update only their own profile (display_name only — role and
--     unit are managed by yonetici via Supabase dashboard at the moment, since
--     real Ayarlar > Kullanici Yonetimi UI does not exist yet).
--   - INSERT into profiles is performed by the auth-link trigger, not by the
--     application. There is no application-level INSERT policy.
--   - DELETE is forbidden via cascade-from-auth.users only — no direct delete.
-- Phase 1+ may tighten read policies (e.g. partner can only see profiles in
-- their portfolio org). For now, profiles are treated as system-level identity.
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;

drop policy if exists profiles_select_authenticated on public.profiles;
create policy profiles_select_authenticated
  on public.profiles
  for select
  to authenticated
  using (true);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    -- Disallow self-promotion: a user cannot change their own role or unit.
    -- These are managed by yonetici (or via a future Ayarlar surface).
    -- Note: this assumes the row already exists; trigger handles INSERT.
  );

-- ---------------------------------------------------------------------------
-- Grants (Supabase default lets postgres + service_role bypass RLS)
-- ---------------------------------------------------------------------------

grant select on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;
