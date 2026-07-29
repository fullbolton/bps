#!/usr/bin/env node
/**
 * BPS QA Mini Harness V1 — qa:static
 *
 * Custom static guard checks over the repo text. Node built-in only — no
 * dependencies, no DB, no network, no credential reads. Complements (does
 * NOT run) `tsc --noEmit`, `next lint`, `next build`; run those separately.
 *
 * Output: one line per rule — PASS / WARN / FAIL + evidence.
 * Exit code: non-zero ONLY if at least one FAIL. WARN exits 0.
 *
 * Rule severity rationale: deterministic security/decision invariants are
 * FAIL; line-order and comment heuristics are WARN (a reformat must not
 * produce a false FAIL).
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FIRMA_ACTIONS = "src/app/(main)/firmalar/[id]/actions.ts";
const FIRMA_PAGE = "src/app/(main)/firmalar/[id]/page.tsx";
const CONTACTS_SERVICE = "src/lib/services/contacts.ts";

// --- tiny helpers (no deps) ---------------------------------------------

function read(rel) {
  try {
    return readFileSync(join(ROOT, rel), "utf8");
  } catch {
    return null;
  }
}

/** Recursively list files under a dir (relative paths from ROOT). */
function walk(relDir, out = []) {
  const abs = join(ROOT, relDir);
  let entries;
  try {
    entries = readdirSync(abs);
  } catch {
    return out;
  }
  for (const name of entries) {
    const relPath = join(relDir, name);
    const st = statSync(join(ROOT, relPath));
    if (st.isDirectory()) {
      if (name === "node_modules" || name === ".next") continue;
      walk(relPath, out);
    } else {
      out.push(relPath);
    }
  }
  return out;
}

/** Extract a top-level `export async function NAME(...) { ... }` body text. */
function extractFn(src, name) {
  if (!src) return null;
  const start = src.indexOf(`export async function ${name}`);
  if (start === -1) return null;
  // Body ends at the next top-level `export async function` or EOF.
  const rest = src.slice(start + 1);
  const nextIdx = rest.indexOf("\nexport async function ");
  return nextIdx === -1 ? src.slice(start) : src.slice(start, start + 1 + nextIdx);
}

/** Return the `/** ... *​/` docblock immediately preceding an anchor. */
function precedingDocblock(src, anchor) {
  if (!src) return "";
  const idx = src.indexOf(anchor);
  if (idx === -1) return "";
  const before = src.slice(0, idx);
  const open = before.lastIndexOf("/**");
  return open === -1 ? "" : before.slice(open);
}

/** Strip line comments (// and * docblock lines) — keep code lines only. */
function codeLines(text) {
  return text
    .split("\n")
    .filter((l) => {
      const t = l.trim();
      return !(t.startsWith("//") || t.startsWith("*") || t.startsWith("/*"));
    })
    .join("\n");
}

// --- result collection ---------------------------------------------------

const results = [];
function record(severity, rule, status, evidence) {
  results.push({ severity, rule, status, evidence });
}
const PASS = "PASS";
const WARN = "WARN";
const FAIL = "FAIL";

// =========================================================================
// FAIL rules
// =========================================================================

// R1 — service_role confined to sanctioned API routes (cron / healthz /
// demo-request / access-request). The env-var read is the client-
// construction signal; the lowercase `service_role` word also appears in
// comments + healthz role assertions, so we key on
// SUPABASE_SERVICE_ROLE_KEY, not the word. access-request follows the
// demo-request precedent: a public unauthenticated form write moved
// server-side so the anon insert path can be revoked.
(() => {
  const ALLOW = [
    "api/cron/",
    "api/healthz/",
    "api/demo-request/",
    "api/access-request/",
  ];
  const offenders = [];
  for (const f of walk("src")) {
    if (!f.endsWith(".ts") && !f.endsWith(".tsx")) continue;
    const src = read(f);
    if (src && src.includes("SUPABASE_SERVICE_ROLE_KEY")) {
      const norm = f.split("\\").join("/");
      if (!ALLOW.some((a) => norm.includes(a))) offenders.push(norm);
    }
  }
  if (offenders.length === 0) {
    record(FAIL, "service_role-confined", PASS, "service_role only in cron/healthz/demo-request/access-request");
  } else {
    record(FAIL, "service_role-confined", FAIL, `unexpected service_role: ${offenders.join(", ")}`);
  }
})();

// R2 — browser-context createContact path not reintroduced. A direct
// `createContact(` call under src/app is only legitimate inside the
// server action file (actions.ts). Anywhere else in src/app = FAIL.
(() => {
  const offenders = [];
  for (const f of walk("src/app")) {
    if (!f.endsWith(".tsx") && !f.endsWith(".ts")) continue;
    if (f.endsWith("actions.ts")) continue; // server action delegate is fine
    const src = read(f);
    if (!src) continue;
    const lines = src.split("\n");
    lines.forEach((l, i) => {
      // `createContact(` but not `createContactAction(`
      if (/\bcreateContact\(/.test(l) && !/\bcreateContactAction\(/.test(l)) {
        offenders.push(`${f.split("\\").join("/")}:${i + 1}`);
      }
    });
  }
  if (offenders.length === 0) {
    record(FAIL, "browser-createContact-removed", PASS, "no browser-context createContact( in src/app");
  } else {
    record(FAIL, "browser-createContact-removed", FAIL, `browser createContact call: ${offenders.join(", ")}`);
  }
})();

// R3a — contact create action is yonetici-only (Partner HOLD). Anchored
// to createContactAction's code (comments stripped, so the "partner is
// HOLD" note does not false-positive).
(() => {
  const body = extractFn(read(FIRMA_ACTIONS), "createContactAction");
  if (!body) {
    record(FAIL, "contact-create-yonetici-only-action", FAIL, "createContactAction not found");
    return;
  }
  const code = codeLines(body);
  const yoneticiOnly = /roleData !== "yonetici"/.test(code);
  const partnerInCode = /partner/i.test(code);
  if (yoneticiOnly && !partnerInCode) {
    record(FAIL, "contact-create-yonetici-only-action", PASS, "guard: roleData !== \"yonetici\", no partner in code");
  } else {
    record(FAIL, "contact-create-yonetici-only-action", FAIL,
      `yoneticiOnly=${yoneticiOnly} partnerInCode=${partnerInCode}`);
  }
})();

// R3b — Yetkili Ekle UI gate is yonetici-only. Anchored to the add-contact
// gate line; the old `|| "partner"` gate must be gone.
(() => {
  const src = read(FIRMA_PAGE) ?? "";
  const yoneticiGate = src.includes('role === "yonetici" && yetkililer.length < 5');
  const oldPartnerGate = /\(role === "yonetici" \|\| role === "partner"\) && yetkililer\.length < 5/.test(src);
  if (yoneticiGate && !oldPartnerGate) {
    record(FAIL, "contact-create-yonetici-only-ui", PASS, "Yetkili Ekle gate: role === \"yonetici\"");
  } else {
    record(FAIL, "contact-create-yonetici-only-ui", FAIL,
      `yoneticiGate=${yoneticiGate} oldPartnerGate=${oldPartnerGate}`);
  }
})();

// R4 — passivateCompanyAction update payload is exactly { status: "pasif" }.
(() => {
  const body = extractFn(read(FIRMA_ACTIONS), "passivateCompanyAction");
  if (!body) {
    record(FAIL, "passivate-status-only", FAIL, "passivateCompanyAction not found");
    return;
  }
  const m = body.match(/\.update\(\s*\{([^}]*)\}\s*\)/);
  if (!m) {
    record(FAIL, "passivate-status-only", FAIL, "no .update({...}) found");
    return;
  }
  const keys = m[1].split(",").map((s) => s.split(":")[0].trim()).filter(Boolean);
  const statusOnly = keys.length === 1 && keys[0] === "status" && /status:\s*"pasif"/.test(m[1]);
  if (statusOnly) {
    record(FAIL, "passivate-status-only", PASS, 'payload = { status: "pasif" }');
  } else {
    record(FAIL, "passivate-status-only", FAIL, `payload keys: [${keys.join(", ")}]`);
  }
})();

// R5 — package / migration drift visibility (WARN, not FAIL per V1).
(() => {
  let porcelain = "";
  try {
    porcelain = execFileSync("git", ["status", "--porcelain"], { cwd: ROOT, encoding: "utf8" });
  } catch {
    record(WARN, "package-migration-drift", WARN, "git status unavailable");
    return;
  }
  const drift = porcelain
    .split("\n")
    .map((l) => l.slice(3).trim())
    .filter((p) => p && (/^package(-lock)?\.json$/.test(p) || p.startsWith("supabase/migrations/")));
  if (drift.length === 0) {
    record(WARN, "package-migration-drift", PASS, "no package/migration changes in working tree");
  } else {
    record(WARN, "package-migration-drift", WARN, `drift (human decides): ${drift.join(", ")}`);
  }
})();

// =========================================================================
// WARN rules (heuristics — never block)
// =========================================================================

// W1 — document upload passive guard before the storage upload.
(() => {
  const body = extractFn(read(FIRMA_ACTIONS), "uploadCompanyDocumentAction");
  const g = body ? body.indexOf("assertCompanyIsActiveForNewOperation") : -1;
  const u = body ? body.indexOf(".upload(storagePath") : -1;
  if (g !== -1 && u !== -1 && g < u) {
    record(WARN, "upload-guard-before-storage", PASS, "guard precedes storage upload");
  } else {
    record(WARN, "upload-guard-before-storage", WARN, `guardIdx=${g} uploadIdx=${u}`);
  }
})();

// W2 — contact passive guard before the createContact insert.
(() => {
  const body = extractFn(read(FIRMA_ACTIONS), "createContactAction");
  const g = body ? body.indexOf("assertCompanyIsActiveForNewOperation") : -1;
  const i = body ? body.indexOf("await createContact(") : -1;
  if (g !== -1 && i !== -1 && g < i) {
    record(WARN, "contact-guard-before-insert", PASS, "guard precedes createContact insert");
  } else {
    record(WARN, "contact-guard-before-insert", WARN, `guardIdx=${g} insertIdx=${i}`);
  }
})();

// W3 — reactivate update payload status-only (regex heuristic).
(() => {
  const body = extractFn(read(FIRMA_ACTIONS), "reactivateCompanyAction");
  const ok = body && /\.update\(\s*\{\s*status:\s*"aktif"\s*\}\s*\)/.test(body);
  record(WARN, "reactivate-status-only", ok ? PASS : WARN,
    ok ? 'payload = { status: "aktif" }' : "reactivate payload not a clean status-only literal");
})();

// W4 — stale partner-scope CREATE comment reintroduced (comment-grep).
// Anchored to the contact-CREATE path only: createContactAction body +
// the createContact service docblock. Legit partner-scope comments on
// edit/update functions elsewhere in contacts.ts are NOT scanned.
(() => {
  const hay = [
    extractFn(read(FIRMA_ACTIONS), "createContactAction"),
    precedingDocblock(read(CONTACTS_SERVICE), "export async function createContact("),
  ]
    .filter(Boolean)
    .join("\n");
  const stale = /re-verifies partner scope/i.test(hay) || /ROLE_MATRIX[^\n]*partner[^\n]*create/i.test(hay);
  record(WARN, "stale-partner-comment", stale ? WARN : PASS,
    stale ? "stale partner-scope create comment present" : "no stale partner-scope create comment on create path");
})();

// W5 — import-graph: client page must not import createContact from the
// contacts service (browser-context create path).
(() => {
  const src = read(FIRMA_PAGE) ?? "";
  const importsCreateContact =
    /import\s*\{[^}]*\bcreateContact\b[^}]*\}\s*from\s*"@\/lib\/services\/contacts"/s.test(src);
  record(WARN, "import-graph-browser-create", importsCreateContact ? WARN : PASS,
    importsCreateContact ? "page imports createContact from contacts service" : "page does not import browser createContact");
})();

// R12 — pre-deploy gates must be RECORDED before the work they gate ships.
// The gates live in supabase/manual/README.md as a table the operator fills in
// with the query result, the date and who cleared it. A gate written only as
// prose is not enforcement: the migration is applied at one moment and the
// deploy decision is made at another, possibly by someone else.
//
// This is a FAIL rule on purpose. It cannot verify the database — but a WARN
// would leave the harness green (exit 0) while an unverified change was free to
// ship, which is precisely the failure mode the gates exist to prevent. Failing
// forces the evidence to be produced: run the query, write the answer down.
// Expected: 1 FAIL before the gates are cleared, 0 after.
// Each gate is one machine-readable marker line in that file:
//   <!-- gate:G1 status=not_run value=none checked_on=none cleared_by=none -->
// A gate clears ONLY when status=cleared AND value equals the one answer that
// makes shipping safe. Counting prose ("not run") was not enough: writing the
// wrong answer, or deleting the row entirely, would have read as cleared.
(() => {
  const EXPECTED = {
    G1: { value: "1", why: "tenant_count must be exactly 1" },
    G2: { value: "assigned_to_user_id", why: "column must exist on tasks" },
    G3: { value: "attested", why: "profile roster reviewed, all own staff" },
  };

  const gatesDoc = read("supabase/manual/README.md");
  const gatedCodeShipped = (read("src/lib/services/tasks.ts") ?? "").includes(
    "assigned_to_user_id",
  );

  if (!gatedCodeShipped) {
    record(FAIL, "pre-deploy-gates-recorded", PASS, "no gated change in tree");
    return;
  }
  if (!gatesDoc) {
    record(FAIL, "pre-deploy-gates-recorded", FAIL,
      "gated change present but supabase/manual/README.md is missing");
    return;
  }

  const problems = [];
  for (const [id, exp] of Object.entries(EXPECTED)) {
    const markers = [
      ...gatesDoc.matchAll(new RegExp(`<!--\\s*gate:${id}\\s+([^>]*?)-->`, "g")),
    ];
    if (markers.length === 0) { problems.push(`${id}: marker missing`); continue; }
    if (markers.length > 1) { problems.push(`${id}: ${markers.length} markers`); continue; }

    // Parse strictly. Object.fromEntries silently keeps the LAST duplicate, so
    // `status=not_run status=cleared` would have read as cleared; and a shape
    // check alone accepts impossible dates like 2026-99-99.
    const REQUIRED = ["status", "value", "checked_on", "cleared_by"];
    const pairs = markers[0][1].trim().split(/\s+/).filter(Boolean);
    const f = {};
    let malformed = null;
    for (const kv of pairs) {
      const i = kv.indexOf("=");
      if (i === -1) { malformed = `bad field "${kv}"`; break; }
      const k = kv.slice(0, i);
      if (!REQUIRED.includes(k)) { malformed = `unknown key "${k}"`; break; }
      if (k in f) { malformed = `duplicate key "${k}"`; break; }
      f[k] = kv.slice(i + 1);
    }
    if (malformed) { problems.push(`${id}: ${malformed}`); continue; }
    const missing = REQUIRED.filter((k) => !(k in f));
    if (missing.length) { problems.push(`${id}: missing ${missing.join(",")}`); continue; }

    if (f.status !== "cleared") { problems.push(`${id}: status=${f.status}`); continue; }
    if (f.value !== exp.value) { problems.push(`${id}: value=${f.value} (${exp.why})`); continue; }
    // Real calendar date, not just the shape: round-trip through Date.
    const d = f.checked_on;
    const ok = /^\d{4}-\d{2}-\d{2}$/.test(d) &&
      new Date(`${d}T00:00:00Z`).toISOString().slice(0, 10) === d;
    if (!ok) { problems.push(`${id}: checked_on="${d}" is not a real date`); continue; }
    if (!f.cleared_by || f.cleared_by === "none") { problems.push(`${id}: cleared_by empty`); }
  }

  if (problems.length === 0) {
    record(FAIL, "pre-deploy-gates-recorded", PASS,
      `${Object.keys(EXPECTED).join("/")} cleared with accepted values`);
  } else {
    record(FAIL, "pre-deploy-gates-recorded", FAIL,
      `${problems.join(" · ")} — do not deploy the picker/görev code`);
  }
})();

// =========================================================================
// Report + exit
// =========================================================================

const COLORS = { PASS: "\x1b[32m", WARN: "\x1b[33m", FAIL: "\x1b[31m", reset: "\x1b[0m" };
let fails = 0;
let warns = 0;

console.log("BPS QA Mini Harness V1 — qa:static\n");
for (const r of results) {
  if (r.status === FAIL) fails++;
  if (r.status === WARN) warns++;
  const c = COLORS[r.status] ?? "";
  const sev = r.severity === FAIL ? "(FAIL-rule)" : "(WARN-rule)";
  console.log(`${c}${r.status.padEnd(4)}${COLORS.reset} ${r.rule.padEnd(34)} ${sev}  ${r.evidence}`);
}
console.log(`\n${results.length} checks · ${fails} FAIL · ${warns} WARN`);
console.log(relative(process.cwd(), join(ROOT, "scripts/qa-static.mjs")) + " — static only; run tsc/lint/build separately.");

process.exit(fails > 0 ? 1 : 0);
