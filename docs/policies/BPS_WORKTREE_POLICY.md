# BPS Worktree Policy v1

> **BPS operating principle:** one clean writing lane, parallel thinking lanes, and one clean integration lane.

> This document does not override BPS governance or product source-of-truth files.
> For project/product authority, see `README.md`, `CODEX.md`, and active product/rule docs.
> For technical setup details and commands, see `docs/runbooks/git-worktree-setup.md`.

## Purpose

BPS development may use multiple Git worktrees, but only in a controlled way.

The goal is:
- reduce context bleed
- isolate parallel sessions
- keep governance docs shared
- avoid merge chaos
- preserve one clean integration path

This is an engineering operations policy, not a product source-of-truth document.

---

## 1. Core Rule

**Plan in parallel. Implement serially.**

BPS should not run multiple parallel writing sessions on overlapping product domains.

**Allowed:**
- one active implementation session
- one or two planning/review sessions
- one low-risk chore session

**Not allowed:**
- multiple parallel feature-writing sessions touching adjacent product truth
- parallel schema-changing sessions
- parallel role/workflow-changing implementation

---

## 2. Recommended Worktree Set

### bps-main
**Role:** clean integration worktree

Use for: protected mainline view, final integration checks, merge target, release confidence.

Rules:
- do not do exploratory implementation here
- keep it clean
- only bring in reviewed work

### bps-feature-*
**Role:** active implementation worktree

Use for: one approved feature or bounded fix, the current write session, real code changes.

Rules:
- only one active feature-writing worktree at a time
- must use its own branch
- must follow approved plan

### bps-planning
**Role:** planning/spec/research worktree

Use for: planning-only work, prompt drafting, architecture/risk review, acceptance criteria definition.

Rules:
- no production-intent code changes
- detached HEAD is acceptable
- output should be specs, notes, or planning docs only

### bps-chores
**Role:** low-risk maintenance worktree

Use for: docs sync, tests, lint/type cleanup, narrow refactors, small consistency fixes.

Rules:
- no hidden feature work
- no schema expansion
- no product-logic drift

### bps-hotfix
**Role:** urgent bounded fix worktree

Use for: urgent production bug fix, narrow corrective patch.

Rules:
- branch from main cleanly
- fix only the stated issue
- merge back fast
- do not turn into a side feature branch

---

## 3. Session Model

### Preferred operating shape
- 1 writer
- 1–2 planners/reviewers
- 1 chore helper
- 1 clean integration worktree

This is the maximum healthy default.

### Sustainable limit

Do not exceed:
- 1 implementation session
- 2 planning/review sessions
- 1 chore session

More sessions create review overload and merge tax.

---

## 4. Branch Policy

### Required
Each implementation or chore worktree must use its own branch.

**Reason:** Git does not allow the same branch to be checked out in multiple worktrees, and this is a feature, not a limitation. It prevents two sessions from silently overwriting each other.

### Rules
- `bps-main` tracks `main`
- `bps-feature-*` uses `feature/...`
- `bps-hotfix` uses `hotfix/...`
- `bps-chores` uses `chore/...`
- `bps-planning` may use detached HEAD or a temporary planning branch

### Never do
- two worktrees on the same active branch
- feature work directly in main
- planning notes mixed into active implementation branch unless intentionally approved

---

## 5. Merge Policy

### Core merge rule
`bps-main` is the integration surface.

Other worktrees do not need to "know" which one is main in any technical sense. The team knows it by policy: reviewed work merges into main, and `bps-main` is the clean reference worktree for that integration.

### Rules
- only merge reviewed branches into main
- do not merge one feature worktree into another feature worktree as a habit
- do not stack hidden dependencies across feature branches unless explicitly planned
- if a branch depends on another unfinished branch, stop and reframe

### Practical implication
The cost of conflict resolution must stay lower than the value of parallelism. If not, parallelism is being overused.

---

## 6. Environment Isolation Policy

### Allowed
Each worktree may have its own `.env.local`.

### Recommended pattern
- `bps-main` → production-aligned env
- `bps-hotfix` → production-aligned env
- `bps-feature-*` → usually demo or safe test env
- `bps-planning` → no live env required
- `bps-chores` → whichever env is appropriate for the task, default safest option

### Critical rule
**Environment isolation must never create truth confusion.**

Always know:
- which Supabase project the worktree points to
- whether writes are safe
- whether the session is allowed to mutate real data

---

## 7. Governance Policy

### Shared governance
Repo-level governance files remain shared across all worktrees:
- `README.md`
- `CODEX.md`
- `SKILLS.md`
- active product/rule docs
- `CLAUDE.md`

This is a major reason to prefer worktrees over multiple loose clones for BPS.

### Local context
Worktree-specific session notes may live in local context files such as `.claude/` or temporary planning notes.

### Hard rule
**Local worktree context may specialize the session. It may not override BPS governance.**

**Allowed variation:** autonomy level, review strictness, exploration tone, session-specific instructions.

**Not allowed variation:** role/access rules, workflow meaning, source-of-truth hierarchy, schema discipline, product boundary rules.

---

## 8. Per-Worktree Settings Policy

Per-worktree agent settings can be useful, but only within limits.

**Good uses:** tighter behavior for refactoring, more exploratory behavior for planning, stricter confirmation for hotfix work, lower-autonomy for production-adjacent changes.

**Bad uses:** weakening product guardrails, changing role/scope interpretation, loosening migration discipline, allowing schema invention in one worktree but not another.

**Agent behavior can vary. Governance cannot.**

---

## 9. When Worktrees Are the Right Tool

Use worktrees when:
- multiple sessions need the same repo truth
- governance docs should stay shared
- planning and implementation should be isolated
- low-risk chores can run separately
- you want lighter isolation than full extra clones

---

## 10. When Worktrees Are the Wrong Tool

Do not force worktrees when:
- the work is purely planning and does not need repo context
- two sessions would touch the same files heavily
- the task is schema-sensitive and needs one controlled path
- the added parallelism only creates merge complexity
- a single writer with planner handoff is cleaner

---

## 11. BPS Default Recommendation

For BPS, the default operating mode should be:
- one active writer
- parallel planning/review allowed
- clean main integration worktree
- parallel chores only when low risk
- no overlapping multi-writer feature implementation

This is the best tradeoff between speed and control.

---

## 12. Decision Rule

Before opening a new worktree, ask:
1. Is this writing or planning?
2. Does it touch active product truth?
3. Could it overlap with the current writer?
4. Does it need a separate environment?
5. Will the merge cost be worth it?

If the answer to #3 is yes, do not open a parallel writer.
If the answer to #5 is no, do not open the worktree.

---

## 13. Final Policy Statement

BPS does not use worktrees to maximize agent count.

BPS uses worktrees to preserve:
- isolation
- governance consistency
- controlled integration
- low-conflict execution

The correct mental model is not: *"more worktrees = more output"*

The correct mental model is: **"one clean writing lane, parallel thinking lanes, and one clean integration lane."**

---

## Tooling Note — workmux

`workmux` may be evaluated later as an optional helper for worktree/session setup and orchestration.

Current status:
- not adopted as standard BPS workflow tooling
- not a replacement for this policy
- evaluate only after manual worktree flow is used long enough to establish a baseline
- if piloted, start with add/setup convenience only
- do not use automated merge/cleanup as a default path in early adoption
