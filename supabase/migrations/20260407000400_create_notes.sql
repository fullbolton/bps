-- =============================================================================
-- BPS Faz 1B — Notes (Notlar) primary truth
-- =============================================================================
--
-- Per REAL_DATA_MIGRATION_MASTER_PLAN.md §Batch 1C:
--   "Firma bazlı kurumsal hafıza. Chat değil, task sistemi değil, case thread
--    değil."
--
-- Per ROLE_MATRIX.md §4:
--   - "Not ekleme / kendi notunu düzenleme" →
--       yonetici Evet, partner (scoped) Evet, operasyon Evet, ik Evet,
--       muhasebe Hayır, goruntuleyici Hayır
--   - "Başkasının notunu geniş düzenleme" →
--       yonetici Evet, partner (scoped) Evet, everyone else Hayır
--
-- Per user rules for this slice:
--   - Company Detail stays central
--   - Notes remain firm-scoped institutional memory (no replies/threads,
--     no tasks, no CRM/collaboration widening)
--   - Ownership must come from author_id (the DB column), not from any
--     visible author text field
--   - yonetici can pin / unpin
--   - Authorization = role capability + assigned scope
--
-- Architecture:
--   This file is the schema layer. The invariants are enforced at TWO sites:
--     1. Database — RLS policies, CHECK constraints (tag whitelist,
--        content-not-blank) for hard truth.
--     2. Service layer — same rules re-checked in
--        `src/lib/services/notes.ts` so the UI can show clean error
--        messages and so partner scope + ownership are re-verified before
--        mutating.
--
-- Dependencies:
--   Must run after 20260407000200_create_companies_anchor.sql (company FK
--   and the current_user_has_company_scope helper are reused here — no new
--   helper function is introduced in this migration).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- notes
-- ---------------------------------------------------------------------------
-- Field choices match the existing MOCK_NOTLAR shape so the UI cutover is a
-- near-mechanical replacement:
--   - content      ← MockNot.icerik
--   - tag          ← MockNot.etiket (nullable single tag, NOT an array —
--                    the current UI picks at most one per note; the plan's
--                    "tags (array)" note is left as a future extension)
--   - is_pinned    ← MockNot.sabitlendi
--   - author_name  ← MockNot.yazan (DENORMALIZED at write time)
--
-- author_name is intentionally denormalized from profiles.display_name at
-- insert time. Rationale (per REAL_DATA_MIGRATION_MASTER_PLAN §Batch 1C
-- "Ownership: author_id, author_name (denormalized)"):
--   - Display stays stable if the author later renames themselves.
--   - Lists can be rendered without a profiles join.
--   - Ownership decisions NEVER read this column — they read author_id.
-- ---------------------------------------------------------------------------

create table if not exists public.notes (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies(id) on delete cascade,
  author_id       uuid references public.profiles(id) on delete set null,
  author_name     text not null,
  content         text not null,
  tag             text,
  is_pinned       boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  -- Hard invariant: content must not be blank. The service layer rejects
  -- blank content earlier with a friendly Turkish message; this constraint
  -- is the database-level safety net.
  constraint notes_content_not_blank
    check (length(btrim(content)) > 0),
  -- Hard invariant: author_name (the denormalized display) must not be
  -- blank. Callers are expected to source it from profiles.display_name.
  constraint notes_author_name_not_blank
    check (length(btrim(author_name)) > 0),
  -- Hard invariant: tag (when present) must be one of the six
  -- ROLE_MATRIX-sanctioned values. A new tag requires both a schema
  -- migration and a change to `src/lib/note-tags.ts`.
  constraint notes_tag_whitelist
    check (
      tag is null
      or tag in ('genel', 'odeme', 'sozlesme', 'operasyon', 'evrak', 'gorusme')
    )
);

comment on table public.notes is
  'BPS Firma Notları. Firm-scoped institutional memory. Not chat, not a '
  'task system, not a CRM case thread. See ROLE_MATRIX.md §4 rows '
  '"Not ekleme / kendi notunu düzenleme" and "Başkasının notunu geniş '
  'düzenleme", and REAL_DATA_MIGRATION_MASTER_PLAN.md Batch 1C.';

comment on column public.notes.author_id is
  'The AUTHORITATIVE ownership column. Ownership decisions in RLS and the '
  'service layer MUST read this column, not author_name.';

comment on column public.notes.author_name is
  'Denormalized display name captured from profiles.display_name at write '
  'time. Used for rendering only. Never used for authorization.';

comment on column public.notes.is_pinned is
  'Pinned notes surface first in the Notlar tab and in the Son Notlar '
  'overview card. Only yonetici may flip this column (see the service '
  'layer pinNote/unpinNote + the contacts_update_role_or_scope RLS '
  'policy below).';

-- ---------------------------------------------------------------------------
-- Lookup indexes
-- ---------------------------------------------------------------------------
-- Primary read path: "all notes for firma X, pinned first, newest first".
-- The company_id lookup is the hot path; the author_id lookup supports
-- ownership checks at the service layer.
-- ---------------------------------------------------------------------------

create index if not exists notes_company_id_idx
  on public.notes (company_id);

create index if not exists notes_author_id_idx
  on public.notes (author_id);

-- Pinned-first / newest-first compound sort is supported by this index.
create index if not exists notes_company_sort_idx
  on public.notes (company_id, is_pinned desc, created_at desc);

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------

create or replace function public.notes_set_updated_at()
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

drop trigger if exists notes_set_updated_at on public.notes;
create trigger notes_set_updated_at
  before update on public.notes
  for each row
  execute function public.notes_set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS — notes
-- ---------------------------------------------------------------------------
-- Read rules per ROLE_MATRIX.md §4 + §3 role descriptions:
--   - yonetici    → all notes
--   - operasyon   → all notes (cross-firma operational coordination)
--   - ik          → all notes (see §3.4: ik has Notlar tab access and
--                   reads "son notlar" on Genel Bakış)
--   - partner     → only notes whose firma is in the partner's scope
--   - muhasebe    → no access (§3.5 excludes Notlar from their surfaces;
--                   they only see Aktif Sözleşmeler / Ticari Özet on
--                   Firma Detay)
--   - goruntuleyici → no access (§3.6 "bounded read-only"; the tab
--                    navigation already excludes Notlar for this role)
--
-- Write rules per ROLE_MATRIX.md §4 rows "Not ekleme / kendi notunu
-- düzenleme" and "Başkasının notunu geniş düzenleme":
--
--   INSERT (note ekleme):
--     yonetici    Evet
--     partner     Portföyünde Evet
--     operasyon   Evet
--     ik          Evet
--     muhasebe    Hayır
--     goruntuleyici Hayır
--
--   UPDATE own note:
--     Allowed for all roles that may INSERT, bounded to their own rows.
--
--   UPDATE others' note ("broad edit"):
--     yonetici    Evet
--     partner     Portföyünde Evet
--     everyone else Hayır
--
--   DELETE:
--     Not explicitly enumerated in ROLE_MATRIX. Following the same
--     "broad edit" shape: yonetici + partner-scoped only. Narrower than
--     "update own" because deletion is irreversible.
--
-- is_pinned is NOT column-gated at the DB level (RLS cannot express
-- "may update row but not this specific column" without security-definer
-- wrappers). The service layer pinNote/unpinNote functions are the only
-- sanctioned writers of is_pinned, and they enforce "yonetici-only" at
-- the application layer. Out-of-band SQL pin flips are possible only
-- with direct dashboard access, which is a yonetici privilege anyway.
-- ---------------------------------------------------------------------------

alter table public.notes enable row level security;

drop policy if exists notes_select_role_or_scope on public.notes;
create policy notes_select_role_or_scope
  on public.notes
  for select
  to authenticated
  using (
    case public.current_user_role()
      when 'yonetici'  then true
      when 'operasyon' then true
      when 'ik'        then true
      when 'partner'   then public.current_user_has_company_scope(company_id)
      else false
    end
  );

drop policy if exists notes_insert_role_or_scope on public.notes;
create policy notes_insert_role_or_scope
  on public.notes
  for insert
  to authenticated
  with check (
    -- Every insert must claim ownership by the caller. Service-layer
    -- writers always set author_id = auth.uid(); this predicate is the
    -- safety net that rejects any would-be "write in someone else's
    -- name" attempt coming from the raw Supabase client.
    author_id = auth.uid()
    and case public.current_user_role()
          when 'yonetici'  then true
          when 'operasyon' then true
          when 'ik'        then true
          when 'partner'   then public.current_user_has_company_scope(company_id)
          else false
        end
  );

drop policy if exists notes_update_own_or_broad on public.notes;
create policy notes_update_own_or_broad
  on public.notes
  for update
  to authenticated
  using (
    case public.current_user_role()
      -- Broad edit roles: may update any note they can see.
      when 'yonetici' then true
      when 'partner'  then public.current_user_has_company_scope(company_id)
      -- Self edit roles: may update only notes they authored. The
      -- author_id predicate is the authoritative ownership check.
      when 'operasyon' then author_id = auth.uid()
      when 'ik'        then author_id = auth.uid()
      else false
    end
  )
  with check (
    -- Same predicate on WITH CHECK so the post-update row must also
    -- satisfy the rule. This prevents a caller from updating their own
    -- note and simultaneously reassigning author_id to another user.
    case public.current_user_role()
      when 'yonetici' then true
      when 'partner'  then public.current_user_has_company_scope(company_id)
      when 'operasyon' then author_id = auth.uid()
      when 'ik'        then author_id = auth.uid()
      else false
    end
  );

drop policy if exists notes_delete_broad on public.notes;
create policy notes_delete_broad
  on public.notes
  for delete
  to authenticated
  using (
    case public.current_user_role()
      when 'yonetici' then true
      when 'partner'  then public.current_user_has_company_scope(company_id)
      else false
    end
  );

grant select, insert, update, delete on public.notes to authenticated;
