-- ==========================================================================
-- BPS — tasks.assigned_to_user_id (real assignee identity)
-- ==========================================================================
-- `tasks.assigned_to` is free text typed by hand (20260407000800). A name
-- string cannot carry an authorization decision: two people can share a name,
-- spelling drifts, and renames silently break the link. The upcoming
-- `operasyon` role ("sees the tasks assigned to them") therefore cannot be
-- expressed in RLS against it.
--
-- This adds the identity column the policy will key on. It does NOT change any
-- policy yet — the role/RLS rewrite lands as one migration once the target role
-- set is applied (see the role-simplification plan).
--
-- `assigned_to` (text) is deliberately KEPT as a display denormalization:
--   - legacy rows keep rendering an assignee even with no user match,
--   - list/table code that reads the name needs no change,
--   - the app writes BOTH from the user picker (id + display_name).
-- Once every row carries an id and readers switch to a join, the text column
-- can be dropped in a later contract step.
--
-- ON DELETE SET NULL: removing a profile must not delete work history; the task
-- survives and simply becomes unassigned.
--
-- ⚠ WRITTEN BUT NOT APPLIED. Additive and safe on its own (nullable column
--    plus an index, no policy or constraint change).
--
-- ⚠⚠ DEPLOY ORDER IS NOT OPTIONAL: APPLY THIS *BEFORE* DEPLOYING THE CODE.
--    The assignee-carrying paths — `createTask` (Yeni Görev + the Randevular
--    "Görev Oluştur" flow) and the assignee edit in `updateTask` — always send
--    `assigned_to_user_id`. If the code ships first, PostgREST has no such
--    column in its schema cache and those calls fail with PGRST204 ("column
--    does not exist"). `completeAppointment` builds its handoff TaskInsert
--    directly and sends neither assignee field, so it would survive — a
--    narrower blast radius, not a reason to skip the gate.
--    Correct order: apply this migration → verify the column exists → deploy.
--
-- ⚠⚠ SECOND DEPLOY GATE — TENANT TOPOLOGY. The assignee picker cannot be
--    tenant-scoped (profiles has no tenant_id), so on a multi-tenant deployment
--    it would allow a cross-tenant assignee. Both gates — this one and the
--    apply-before-deploy order above — must be RUN AND RECORDED in
--    `supabase/manual/README.md` (§PRE-DEPLOY GATES) before shipping. A gate
--    that lives only as a comment here is not enforcement: this file is applied
--    at one moment and the deploy decision is made at another.
--
-- BACKFILL: intentionally not automated. Matching free text to users is a
-- judgement call (nicknames, initials, ex-employees). After applying, map the
-- existing rows by hand, e.g.:
--    select distinct assigned_to from tasks where assigned_to is not null;
--    update tasks set assigned_to_user_id = '<profile-uuid>'
--     where assigned_to = '<exact text>' and assigned_to_user_id is null;
-- Rows left unmatched stay display-only until someone re-assigns them in the UI.
-- ==========================================================================

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS assigned_to_user_id uuid NULL
    REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Supports the "my tasks" filter and the future ownership branch in
-- tasks_select / tasks_update.
CREATE INDEX IF NOT EXISTS tasks_assigned_to_user_id_idx
  ON public.tasks(assigned_to_user_id);

COMMENT ON COLUMN public.tasks.assigned_to_user_id IS
  'Assignee identity (profiles.id). Intended to carry FUTURE ownership '
  'authorization — no policy reads it yet; the operasyon ownership branch '
  'arrives with the role/RLS rewrite. Authorization must never key on the '
  'free-text assigned_to, which is only a display denormalization.';
