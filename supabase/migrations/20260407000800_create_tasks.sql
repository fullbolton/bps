-- =============================================================================
-- BPS Faz 3C — Tasks (Görevler) primary truth
-- =============================================================================
-- Per REAL_DATA_MIGRATION_MASTER_PLAN.md §Batch 3C + ROLE_MATRIX.md §4.
-- Tasks are contextual — they reference a source (manuel, randevu, sozlesme)
-- and optionally link back to the originating record. They are NOT a
-- standalone work-management product.
-- =============================================================================

create table if not exists public.tasks (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid not null references public.companies(id) on delete cascade,
  contract_id       uuid references public.contracts(id) on delete set null,
  appointment_id    uuid references public.appointments(id) on delete set null,
  title             text not null,
  assigned_to       text,
  due_date          text,
  source_type       text not null default 'manuel',
  source_ref        text,
  priority          text not null default 'normal',
  status            text not null default 'acik',
  created_by        uuid references public.profiles(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint tasks_title_not_blank check (length(btrim(title)) > 0),
  constraint tasks_source_type_whitelist check (
    source_type in ('manuel', 'randevu', 'sozlesme')
  ),
  constraint tasks_priority_whitelist check (
    priority in ('dusuk', 'normal', 'yuksek', 'kritik')
  ),
  constraint tasks_status_whitelist check (
    status in ('acik', 'devam_ediyor', 'tamamlandi', 'gecikti', 'iptal')
  )
);

create index if not exists tasks_company_id_idx on public.tasks (company_id);
create index if not exists tasks_contract_id_idx on public.tasks (contract_id);
create index if not exists tasks_appointment_id_idx on public.tasks (appointment_id);
create index if not exists tasks_status_idx on public.tasks (status);

create or replace function public.tasks_set_updated_at()
returns trigger language plpgsql security definer set search_path = public as $$
begin new.updated_at := now(); return new; end; $$;
drop trigger if exists tasks_set_updated_at on public.tasks;
create trigger tasks_set_updated_at
  before update on public.tasks for each row
  execute function public.tasks_set_updated_at();

-- RLS: yonetici + operasyon + ik full, partner scoped.
-- ik CAN create tasks + change status but CANNOT reassign (service layer).
-- goruntuleyici CAN view + create + status but CANNOT reassign (service layer).
alter table public.tasks enable row level security;

create policy tasks_select on public.tasks for select to authenticated using (
  case public.current_user_role()
    when 'yonetici'      then true
    when 'operasyon'     then true
    when 'ik'            then true
    when 'goruntuleyici' then true
    when 'partner'       then public.current_user_has_company_scope(company_id)
    else false
  end
);
create policy tasks_insert on public.tasks for insert to authenticated with check (
  case public.current_user_role()
    when 'yonetici'      then true
    when 'operasyon'     then true
    when 'ik'            then true
    when 'goruntuleyici' then true
    when 'partner'       then public.current_user_has_company_scope(company_id)
    else false
  end
);
create policy tasks_update on public.tasks for update to authenticated
  using (
    case public.current_user_role()
      when 'yonetici'      then true
      when 'operasyon'     then true
      when 'ik'            then true
      when 'goruntuleyici' then true
      when 'partner'       then public.current_user_has_company_scope(company_id)
      else false
    end
  )
  with check (
    case public.current_user_role()
      when 'yonetici'      then true
      when 'operasyon'     then true
      when 'ik'            then true
      when 'goruntuleyici' then true
      when 'partner'       then public.current_user_has_company_scope(company_id)
      else false
    end
  );
create policy tasks_delete on public.tasks for delete to authenticated using (
  public.current_user_role() = 'yonetici'
);

grant select, insert, update, delete on public.tasks to authenticated;
