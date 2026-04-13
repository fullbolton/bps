# Git Worktree Setup — BPS Technical Runbook

> This is a technical runbook. It explains how to use git worktrees in BPS practice.
> For when and why to use worktrees, see `docs/policies/BPS_WORKTREE_POLICY.md`.
> For product steering, see `CLAUDE.md`. For authoritative rules, see `CODEX.md`.

---

## What Git Worktree Does

A single `.git` repository supports multiple working directories simultaneously. Each worktree has its own `HEAD`, `index`, and working files, but all branch refs, history, and config are shared. This enables parallel Claude Code sessions on different branches without merge conflicts.

---

## Critical Rules

1. **Same branch cannot be checked out in two worktrees.** Git enforces this. Every worktree must use its own branch.
2. **CLAUDE.md lives in repo root — visible to all worktrees automatically.** Governance docs travel with the repo.
3. **`.env.local` is worktree-local.** Each worktree can point to a different Supabase instance.
4. **Never implement in a planning worktree.** Planning worktrees use detached HEAD — no branch, no commits.
5. **Clean up finished worktrees.** Orphaned worktrees waste disk and create confusion.

---

## Naming Convention

```
bps-{purpose}[-{topic}]
```

| Worktree | Purpose | Branch Pattern |
|----------|---------|---------------|
| `bps/` (main) | Production working tree | `main` |
| `bps-hotfix` | Quick fixes | `hotfix/{issue-name}` (new branch each time) |
| `bps-feature-X` | Active feature implementation | `feature/{feature-name}` |
| `bps-planning` | Spec/research only, no code | Detached HEAD |
| `bps-chores` | Docs, tests, lint | `chore/{task-name}` |

---

## Common Commands

### Create worktrees

```bash
# Feature — new branch from main
git worktree add ../bps-feature-X -b feature/finansal-ozet-v2 main

# Hotfix — always a new branch, never bare main
git worktree add ../bps-hotfix -b hotfix/rls-fix main

# Planning — detached HEAD, no branch needed
git worktree add -d ../bps-planning

# Chores — new branch from main
git worktree add ../bps-chores -b chore/docs-sync main
```

> **Warning:** `git worktree add ../bps-hotfix main` (without `-b`) tries to check out the `main` branch directly. If `main` is already checked out in the main worktree, this fails. Always create a new branch with `-b` for hotfix and feature worktrees.

### List active worktrees

```bash
git worktree list
# /home/user/bps              abc1234 [main]
# /home/user/bps-feature-X    def5678 [feature/finansal-ozet-v2]
# /home/user/bps-hotfix       abc1234 [hotfix/rls-fix]
# /home/user/bps-planning     abc1234 (detached HEAD)
```

### Switch branch in a reusable worktree (hotfix pattern)

```bash
cd ../bps-hotfix
git checkout -b hotfix/new-issue main    # create new hotfix branch
# ... fix, commit, push, PR ...
git checkout main                         # or another base
# worktree is ready for next hotfix
```

### Remove a worktree when done

```bash
git worktree remove ../bps-feature-X     # clean removal
git worktree prune                        # clean up orphaned refs
```

### Force remove (if dirty files exist)

```bash
git worktree remove -f ../bps-feature-X
```

---

## Directory Structure

```
~/projects/
├── bps/                        ← main worktree (production)
│   ├── .git/                   ← the actual git repository
│   ├── CLAUDE.md               ← shared across all worktrees
│   ├── .claude/                ← shared agent context
│   ├── .env.local              ← production Supabase URL
│   ├── .env.local.template     ← template for new worktrees
│   └── src/
│
├── bps-feature-X/              ← linked worktree
│   ├── .git                    ← FILE (not directory) — pointer to main .git
│   ├── .claude/                ← worktree-local agent context (optional)
│   ├── .env.local              ← demo Supabase URL
│   └── src/
│
├── bps-hotfix/                 ← linked worktree
│   ├── .git                    ← FILE — pointer to main .git
│   ├── .env.local              ← production Supabase URL
│   └── src/
│
├── bps-planning/               ← linked worktree (detached, spec-only)
│   ├── .git                    ← FILE — pointer to main .git
│   └── (no .env.local needed)
│
└── bps-chores/                 ← linked worktree
    ├── .git                    ← FILE — pointer to main .git
    ├── .env.local              ← demo Supabase URL
    └── src/
```

**Key:** Linked worktrees have a `.git` **file** (not directory) that points back to the main repository. All branches, tags, and refs are shared. Working state (staged files, HEAD position) is isolated.

---

## Environment Isolation

Each worktree gets its own `.env.local` to target a different Supabase instance:

| Worktree | Supabase Target | Reason |
|----------|----------------|--------|
| `bps/` (main) | Production | Live system |
| `bps-hotfix` | Production | Fixes target live data |
| `bps-feature-X` | Demo | Safe to experiment |
| `bps-planning` | None needed | No code runs here |
| `bps-chores` | Demo | Tests run against safe data |

### Setup .env.local for a new worktree

```bash
cp bps/.env.local.template bps-feature-X/.env.local
# Edit to point to demo Supabase:
# NEXT_PUBLIC_SUPABASE_URL=https://tiqemcsjuyudahgmqksw.supabase.co
# NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

---

## Claude Code Session per Worktree

Each worktree runs its own Claude Code terminal session:

```bash
# Terminal 1: implementation
cd ~/projects/bps-feature-X && claude

# Terminal 2: planning (read-only, no code)
cd ~/projects/bps-planning && claude

# Terminal 3: chores
cd ~/projects/bps-chores && claude
```

**CLAUDE.md is automatically loaded** in every session because it lives in repo root and all worktrees share the same repo content.

**Worktree-specific context** goes in `.claude/` inside the worktree directory. Example: a file `.claude/context.md` saying "This session only works on Finansal Özet module" to keep the agent focused.

---

## Worktree-Specific Git Config (optional)

If different worktrees need different git config (rare for BPS):

```bash
git config extensions.worktreeConfig true
# Then per-worktree config goes in .git/worktrees/{name}/config.worktree
```

Not needed for most BPS workflows — shared config is fine.

---

## Cleanup Checklist

After finishing a feature/hotfix:

- [ ] Merge PR and confirm it's on `main`
- [ ] `git worktree remove ../bps-feature-X`
- [ ] `git branch -d feature/finansal-ozet-v2` (delete merged branch)
- [ ] `git worktree prune` (clean orphaned refs)
- [ ] Verify with `git worktree list`

---

## Bootstrap Script (Infrastructure Horizon Step 2)

```bash
#!/bin/bash
# bps-worktree.sh — create a BPS worktree with environment setup
set -e

NAME=$1          # e.g., "feature-X"
BRANCH=$2        # e.g., "feature/finansal-ozet-v2"
ENV=${3:-demo}   # "production" or "demo" (default: demo)

if [ -z "$NAME" ] || [ -z "$BRANCH" ]; then
  echo "Usage: ./bps-worktree.sh <name> <branch> [production|demo]"
  exit 1
fi

WORKTREE_PATH="../bps-${NAME}"

# Create worktree with new branch from main
git worktree add "$WORKTREE_PATH" -b "$BRANCH" main

# Copy environment template
if [ "$ENV" = "production" ]; then
  cp .env.local "$WORKTREE_PATH/.env.local"
else
  cp .env.local.demo "$WORKTREE_PATH/.env.local"
fi

# Install dependencies
cd "$WORKTREE_PATH" && npm install

echo "✓ Worktree ready: $WORKTREE_PATH on branch $BRANCH ($ENV environment)"
echo "  cd $WORKTREE_PATH && claude"
```

---

## Troubleshooting

**"fatal: 'main' is already checked out"**
→ You tried to check out `main` in a second worktree. Always use `-b` to create a new branch.

**Worktree shows as "prunable"**
→ The directory was manually deleted. Run `git worktree prune` to clean the reference.

**"Changes not staged" error on remove**
→ Worktree has uncommitted changes. Either commit/stash them or use `git worktree remove -f`.

**node_modules taking too much space**
→ Each worktree gets its own `node_modules`. For planning worktrees that don't run code, skip `npm install`.
