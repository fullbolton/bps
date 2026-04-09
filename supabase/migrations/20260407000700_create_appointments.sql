-- =============================================================================
-- BPS Faz 3B — Appointments (Randevular) primary truth
-- =============================================================================
-- Per REAL_DATA_MIGRATION_MASTER_PLAN.md §Batch 3B + ROLE_MATRIX.md §4.
-- Completed appointments MUST have result + next_action (per WORKFLOW_RULES).
-- Last/next appointment per firma is DERIVED, never stored.
-- =============================================================================

create table if not exists public.appointments (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid not null references public.companies(id) on delete cascade,
  contract_id       uuid references public.contracts(id) on delete set null,
  meeting_date      date not null,
  meeting_time      text,
  meeting_type      text not null default 'diger',
  attendee          text,
  status            text not null default 'planlandi',
  result            text,
  next_action       text,
  created_by        uuid references public.profiles(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint appointments_meeting_type_whitelist check (
    meeting_type in ('ziyaret', 'online', 'telefon', 'teklif_sunumu', 'denetim', 'diger')
  ),
  constraint appointments_status_whitelist check (
    status in ('planlandi', 'tamamlandi', 'iptal', 'ertelendi')
  ),
  -- Per WORKFLOW_RULES: completed appointments MUST have result + next_action
  constraint appointments_completion_requires_result check (
    status <> 'tamamlandi'
    or (result is not null and length(btrim(result)) > 0
        and next_action is not null and length(btrim(next_action)) > 0)
  )
);

create index if not exists appointments_company_id_idx on public.appointments (company_id);
create index if not exists appointments_company_date_idx
  on public.appointments (company_id, meeting_date desc);
create index if not exists appointments_contract_id_idx on public.appointments (contract_id);

create or replace function public.appointments_set_updated_at()
returns trigger language plpgsql security definer set search_path = public as $$
begin new.updated_at := now(); return new; end; $$;
drop trigger if exists appointments_set_updated_at on public.appointments;
create trigger appointments_set_updated_at
  before update on public.appointments for each row
  execute function public.appointments_set_updated_at();

-- RLS: yonetici + operasyon full, partner scoped. ik/muhasebe/goruntuleyici no access.
alter table public.appointments enable row level security;

create policy appointments_select on public.appointments for select to authenticated using (
  case public.current_user_role()
    when 'yonetici'  then true
    when 'operasyon' then true
    when 'partner'   then public.current_user_has_company_scope(company_id)
    else false
  end
);
create policy appointments_insert on public.appointments for insert to authenticated with check (
  case public.current_user_role()
    when 'yonetici'  then true
    when 'operasyon' then true
    when 'partner'   then public.current_user_has_company_scope(company_id)
    else false
  end
);
create policy appointments_update on public.appointments for update to authenticated
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
create policy appointments_delete on public.appointments for delete to authenticated using (
  public.current_user_role() = 'yonetici'
);

grant select, insert, update, delete on public.appointments to authenticated;
