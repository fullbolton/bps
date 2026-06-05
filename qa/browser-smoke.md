# BPS QA Mini Harness V1 — qa:browser-smoke

A manual checklist. No Playwright, no automation. Walk it by hand, or via
the Chrome MCP with an **authenticated yonetici session** on the target
deployment. Render-only — do **not** click destructive confirms
(native `confirm()` delete/passivate flows are out of V1 scope).

Mark each row **PASS / FAIL** + a short note. Any FAIL → stop and report.

---

## Pre-conditions
- Logged in as **yonetici**.
- Canonical state holds (see `qa/state.sql` / `qa/state.expected.json`):
  Ege = aktif, BPS_SMOKE_IMPORT = pasif.

## A. Route loads (page renders, no error boundary)

| # | Check | PASS/FAIL | Note |
|---|---|---|---|
| A1 | `/firmalar` opens | | |
| A2 | `/sozlesmeler` opens | | |
| A3 | `/evraklar` opens | | |
| A4 | Ege (aktif) detail opens | | |
| A5 | BPS_SMOKE_IMPORT (pasif) detail opens | | |

## B. UI guard matrix — ACTIVE firma (Ege)

| # | Check | PASS/FAIL | Note |
|---|---|---|---|
| B1 | "Yetkili Ekle" **enabled** | | |
| B2 | "Belge Yükle" **enabled** | | |
| B3 | "Not Ekle" / "Not Önerisi" visible & open | | |
| B4 | "Pasife Al" shown; "Aktife Al" NOT shown | | |

## C. UI guard matrix — PASSIVE firma (BPS_SMOKE_IMPORT)

| # | Check | PASS/FAIL | Note |
|---|---|---|---|
| C1 | "Yetkili Ekle" **disabled** + tooltip "Firma pasif olduğu için yeni işlem oluşturulamaz." | | |
| C2 | "Belge Yükle" **disabled** + same tooltip | | |
| C3 | "Not Ekle" / "Not Önerisi" still **open** | | |
| C4 | "Aktife Al" shown; "Pasife Al" NOT shown | | |
| C5 | Existing contacts / documents / contracts still **viewable** (read open) | | |

## D. Console

Open devtools console on each route above. Apply the policy below.

| # | Check | PASS/FAIL | Note |
|---|---|---|---|
| D1 | No **denylist** console errors on any route | | |

### Console policy

**Allowlist — IGNORE (never FAIL):**
- `message channel closed`
- `asynchronous response … channel closed`
- generic Chrome-extension artifacts (extension-id origins)
- `favicon.ico` 404

**Denylist — FAIL:**
- `BPS`-prefixed application errors
- `RLS` / row-level-security rejections surfaced to console
- HTTP `500`
- `PGRST` (PostgREST) errors
- `TypeError` / `ReferenceError`
- React error-boundary messages
- any `Uncaught` application error

**Logic:** first remove every message matching the allowlist; evaluate the
remainder against the denylist. A clean route = nothing left after the
allowlist subtraction matches the denylist.

---

## Result
- Date / deployment hash:
- Walked by:
- Overall: PASS / FAIL
- FAIL details (if any):
