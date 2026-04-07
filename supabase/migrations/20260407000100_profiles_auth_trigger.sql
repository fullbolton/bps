-- =============================================================================
-- BPS Phase 0 — Auth → Profile linkage trigger
-- =============================================================================
--
-- Purpose:
--   Whenever a new auth.users row is created (Supabase signup or admin create),
--   automatically materialize a matching public.profiles row with default
--   role 'goruntuleyici' (least-privileged). The yonetici then promotes the
--   user to the correct role via the Supabase dashboard (or, in a future
--   phase, via Ayarlar > Kullanici Yonetimi).
--
-- This trigger is the only sanctioned writer of the initial profile row.
-- The application does not insert into profiles directly.
--
-- Dependencies:
--   This migration MUST run after 20260407000000_create_profiles.sql.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- handle_new_user function
-- ---------------------------------------------------------------------------
-- Picks up display_name and role hints from raw_user_meta_data if the
-- yonetici filled them in when creating the user via Supabase dashboard.
-- Falls back to safe defaults otherwise:
--   - display_name = email local-part
--   - role = 'goruntuleyici' (least privilege; yonetici must promote)
--   - unit = NULL (yonetici assigns later)
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_display_name text;
  v_role text;
  v_unit text;
begin
  -- Display name: prefer explicit metadata, then full_name, then email local-part
  v_display_name := coalesce(
    nullif(trim(new.raw_user_meta_data->>'display_name'), ''),
    nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
    split_part(coalesce(new.email, ''), '@', 1),
    'Kullanici'
  );

  -- Role: only accept the role hint if it is one of the 6 valid values.
  -- Anything else (including the deprecated 'satis') falls back to goruntuleyici.
  v_role := lower(coalesce(new.raw_user_meta_data->>'role', ''));
  if v_role not in ('yonetici', 'partner', 'operasyon', 'ik', 'muhasebe', 'goruntuleyici') then
    v_role := 'goruntuleyici';
  end if;

  -- Unit: only accept if it matches one of the BirimKodu values.
  v_unit := lower(coalesce(new.raw_user_meta_data->>'unit', ''));
  if v_unit not in ('operasyon', 'satis', 'muhasebe', 'yonetim', 'ik', 'diger') then
    v_unit := null;
  end if;

  insert into public.profiles (id, email, display_name, role, unit)
  values (
    new.id,
    coalesce(new.email, ''),
    v_display_name,
    v_role,
    v_unit
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

comment on function public.handle_new_user() is
  'Auth-to-profile linkage. Fired by trigger on auth.users insert. '
  'Materializes a profiles row with safe defaults. '
  'Role and unit may be hinted via raw_user_meta_data; invalid hints '
  'fall back to goruntuleyici / NULL respectively. '
  'See REAL_DATA_MIGRATION_MASTER_PLAN.md §3.2.';

-- ---------------------------------------------------------------------------
-- Trigger on auth.users
-- ---------------------------------------------------------------------------

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();
