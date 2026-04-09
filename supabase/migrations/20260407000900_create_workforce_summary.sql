-- =============================================================================
-- BPS Faz 3D — Workforce Summary (Aktif İş Gücü) aggregate-only truth
-- =============================================================================
-- Per REAL_DATA_MIGRATION_MASTER_PLAN.md §Batch 3D.
-- GUARDRAIL: aggregate-only. No person-level employee records. No HRIS drift.
-- Risk level is DERIVED in the service layer, never stored.
-- acikFark = target_count - current_count is DERIVED, never stored.
-- =============================================================================

create table if not exists public.workforce_summary (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid not null references public.companies(id) on delete cascade,
  location          text,
  target_count      integer not null default 0,
  current_count     integer not null default 0,
  hires_last_30d    integer not null default 0,
  exits_last_30d    integer not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint workforce_summary_counts_non_negative check (
    target_count >= 0 and current_count >= 0
    and hires_last_30d >= 0 and exits_last_30d >= 0
  ),
  -- One summary row per company (aggregate-only, NOT employee registry)
  constraint workforce_summary_one_per_company unique (company_id)
);

create index if not exists workforce_summary_company_id_idx
  on public.workforce_summary (company_id);

create or replace function public.workforce_summary_set_updated_at()
returns trigger language plpgsql security definer set search_path = public as $$
begin new.updated_at := now(); return new; end; $$;
drop trigger if exists workforce_summary_set_updated_at on public.workforce_summary;
create trigger workforce_summary_set_updated_at
  before update on public.workforce_summary for each row
  execute function public.workforce_summary_set_updated_at();

-- RLS: yonetici + operasyon + partner(scoped) full write.
-- ik read-only. goruntuleyici read-only.
alter table public.workforce_summary enable row level security;

create policy workforce_summary_select on public.workforce_summary for select to authenticated using (
  case public.current_user_role()
    when 'yonetici'      then true
    when 'operasyon'     then true
    when 'ik'            then true
    when 'goruntuleyici' then true
    when 'partner'       then public.current_user_has_company_scope(company_id)
    else false
  end
);
create policy workforce_summary_insert on public.workforce_summary for insert to authenticated with check (
  case public.current_user_role()
    when 'yonetici'  then true
    when 'operasyon' then true
    when 'partner'   then public.current_user_has_company_scope(company_id)
    else false
  end
);
create policy workforce_summary_update on public.workforce_summary for update to authenticated
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
create policy workforce_summary_delete on public.workforce_summary for delete to authenticated using (
  public.current_user_role() = 'yonetici'
);

grant select, insert, update, delete on public.workforce_summary to authenticated;
