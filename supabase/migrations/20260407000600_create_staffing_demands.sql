-- =============================================================================
-- BPS Faz 3A — Staffing Demands (Personel Talepleri) primary truth
-- =============================================================================
-- Per REAL_DATA_MIGRATION_MASTER_PLAN.md §Batch 3A + ROLE_MATRIX.md §4.
-- `open_count` is DERIVED (requested_count - provided_count), never stored.
-- =============================================================================

create table if not exists public.staffing_demands (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid not null references public.companies(id) on delete cascade,
  position          text not null,
  requested_count   integer not null default 1,
  provided_count    integer not null default 0,
  location          text,
  start_date        text,
  priority          text not null default 'normal',
  status            text not null default 'yeni',
  responsible       text,
  created_by        uuid references public.profiles(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint staffing_demands_position_not_blank check (length(btrim(position)) > 0),
  constraint staffing_demands_counts_non_negative check (
    requested_count >= 0 and provided_count >= 0
  ),
  constraint staffing_demands_provided_lte_requested check (
    provided_count <= requested_count
  ),
  constraint staffing_demands_priority_whitelist check (
    priority in ('dusuk', 'normal', 'yuksek', 'kritik')
  ),
  constraint staffing_demands_status_whitelist check (
    status in ('yeni', 'degerlendiriliyor', 'kismi_doldu', 'tamamen_doldu', 'beklemede', 'iptal')
  )
);

create index if not exists staffing_demands_company_id_idx
  on public.staffing_demands (company_id);

create or replace function public.staffing_demands_set_updated_at()
returns trigger language plpgsql security definer set search_path = public as $$
begin new.updated_at := now(); return new; end; $$;
drop trigger if exists staffing_demands_set_updated_at on public.staffing_demands;
create trigger staffing_demands_set_updated_at
  before update on public.staffing_demands for each row
  execute function public.staffing_demands_set_updated_at();

-- RLS: yonetici + operasyon full, partner scoped, ik read in firma context
alter table public.staffing_demands enable row level security;

create policy staffing_demands_select on public.staffing_demands for select to authenticated using (
  case public.current_user_role()
    when 'yonetici'  then true
    when 'operasyon' then true
    when 'ik'        then true
    when 'partner'   then public.current_user_has_company_scope(company_id)
    else false
  end
);
create policy staffing_demands_insert on public.staffing_demands for insert to authenticated with check (
  case public.current_user_role()
    when 'yonetici'  then true
    when 'operasyon' then true
    when 'partner'   then public.current_user_has_company_scope(company_id)
    else false
  end
);
create policy staffing_demands_update on public.staffing_demands for update to authenticated
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
create policy staffing_demands_delete on public.staffing_demands for delete to authenticated using (
  public.current_user_role() = 'yonetici'
);

grant select, insert, update, delete on public.staffing_demands to authenticated;
