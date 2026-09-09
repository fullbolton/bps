/** Offline SQL generator. Never connects to a database. Default output rolls back.
 * Input: reviewed MCP backup { project_ref, tables: { table: [complete rows] } }.
 * Keep both the backup and generated SQL outside Git: they contain business data.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const PROJECT = 'dffdzbmnmnokbftbujsy';
// Children first, so removing a parent cannot rewrite a later target row.
export const TARGETS = ['tasks', 'appointments', 'staffing_demands', 'notes',
  'critical_dates', 'contracts', 'companies'];
const COUNTS = { companies: 5, contracts: 2, tasks: 4, appointments: 2,
  notes: 1, staffing_demands: 1, critical_dates: 1 };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const literal = value => "'" + value.replaceAll("'", "''") + "'";

export function validateBackup(backup) {
  if (backup?.project_ref !== PROJECT) throw new Error('Wrong project');
  if (!backup.tables || Object.keys(backup.tables).sort().join(',') !== [...TARGETS].sort().join(',')) {
    throw new Error('Backup must contain exactly the seven reviewed tables');
  }
  for (const table of TARGETS) {
    const rows = backup.tables[table];
    if (!Array.isArray(rows) || rows.length !== COUNTS[table]) throw new Error(`Count changed: ${table}`);
    if (rows.some(r => !r || !UUID.test(r.id) || Object.keys(r).length < 2)) {
      throw new Error(`Invalid or incomplete row: ${table}`);
    }
    if (new Set(rows.map(r => r.id.toLowerCase())).size !== rows.length) {
      throw new Error(`Duplicate id: ${table}`);
    }
  }
}

export function generateReset(backup, { commit = false } = {}) {
  validateBackup(backup);
  const expected = literal(JSON.stringify(backup.tables));
  const names = TARGETS.map(literal).join(',');
  // The outer DO dollar-quote must not occur anywhere in the embedded data,
  // even within an inner SQL string literal.
  let delimiter = '$bps_reset$';
  for (let i=1; expected.includes(delimiter); i++) delimiter = `$bps_reset_${i}$`;
  return `-- BPS test-data reset; project ${PROJECT}; ${commit ? 'COMMIT' : 'ROLLBACK rehearsal'}.
-- Confirm MCP project URL separately. This script does not infer project from DB name.
-- Backup and Storage file recovery must be verified before COMMIT.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
SET LOCAL standard_conforming_strings = on;
DO ${delimiter}
DECLARE
  expected jsonb := ${expected}::jsonb;
  targets text[] := ARRAY[${names}];
  protected_before jsonb := '{}'::jsonb;
  actual jsonb;
  wanted jsonb;
  relation record;
  t text;
  n bigint;
BEGIN
  -- Lock all public ordinary tables in name order. No permanent DDL or trigger disabling.
  -- Readers can continue; writers wait until transaction end or timeout.
  FOR relation IN
    SELECT c.relname FROM pg_class c JOIN pg_namespace ns ON ns.oid=c.relnamespace
    WHERE ns.nspname='public' AND c.relkind='r' ORDER BY c.relname
  LOOP
    EXECUTE format('LOCK TABLE public.%I IN SHARE ROW EXCLUSIVE MODE', relation.relname);
  END LOOP;

  -- Any new external incoming FK or DELETE trigger/rule needs a new review.
  IF EXISTS (
    SELECT 1 FROM pg_constraint fk JOIN pg_class parent ON parent.oid=fk.confrelid
    JOIN pg_namespace pn ON pn.oid=parent.relnamespace
    JOIN pg_class child ON child.oid=fk.conrelid
    JOIN pg_namespace cn ON cn.oid=child.relnamespace
    WHERE fk.contype='f' AND pn.nspname='public' AND parent.relname=ANY(targets)
      AND (cn.nspname <> 'public' OR child.relkind <> 'r')
  ) THEN RAISE EXCEPTION 'Unreviewed external/partitioned dependency'; END IF;

  IF EXISTS (
    SELECT 1 FROM pg_trigger tr JOIN pg_class c ON c.oid=tr.tgrelid
    JOIN pg_namespace ns ON ns.oid=c.relnamespace
    WHERE ns.nspname='public' AND c.relname=ANY(targets)
      AND NOT tr.tgisinternal AND (tr.tgtype::integer & 8) <> 0
  ) OR EXISTS (
    SELECT 1 FROM pg_rewrite rw JOIN pg_class c ON c.oid=rw.ev_class
    JOIN pg_namespace ns ON ns.oid=c.relnamespace
    WHERE ns.nspname='public' AND c.relname=ANY(targets) AND rw.rulename <> '_RETURN'
  ) THEN RAISE EXCEPTION 'Unreviewed DELETE trigger/rule'; END IF;

  FOREACH t IN ARRAY targets LOOP
    EXECUTE format('SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY id), ''[]''::jsonb) FROM public.%I r',t) INTO actual;
    SELECT jsonb_agg(value ORDER BY value->>'id') INTO wanted FROM jsonb_array_elements(expected->t);
    IF actual IS DISTINCT FROM wanted THEN RAISE EXCEPTION 'Backup mismatch: %', t; END IF;
  END LOOP;

  -- Preserve every other public table, including identities, memberships, configuration and logs.
  FOR relation IN
    SELECT c.relname FROM pg_class c JOIN pg_namespace ns ON ns.oid=c.relnamespace
    WHERE ns.nspname='public' AND c.relkind='r' AND NOT(c.relname=ANY(targets)) ORDER BY c.relname
  LOOP
    EXECUTE format('SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY to_jsonb(r)::text), ''[]''::jsonb) FROM public.%I r',relation.relname) INTO actual;
    protected_before := protected_before || jsonb_build_object(relation.relname,actual);
  END LOOP;

  -- Non-target child rows would be changed by CASCADE/SET NULL or would block deletion.
  -- Reject them before deleting anything (conservative: the entire child must be empty).
  FOR relation IN
    SELECT DISTINCT child.relname FROM pg_constraint fk
    JOIN pg_class parent ON parent.oid=fk.confrelid JOIN pg_namespace pn ON pn.oid=parent.relnamespace
    JOIN pg_class child ON child.oid=fk.conrelid JOIN pg_namespace cn ON cn.oid=child.relnamespace
    WHERE fk.contype='f' AND pn.nspname='public' AND parent.relname=ANY(targets)
      AND cn.nspname='public' AND NOT(child.relname=ANY(targets))
  LOOP
    EXECUTE format('SELECT count(*) FROM public.%I',relation.relname) INTO n;
    IF n <> 0 THEN RAISE EXCEPTION 'Nonempty dependent table: %',relation.relname; END IF;
  END LOOP;

  FOREACH t IN ARRAY targets LOOP
    EXECUTE format('DELETE FROM public.%I WHERE id IN (SELECT (value->>''id'')::uuid FROM jsonb_array_elements($1))',t) USING expected->t;
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n <> jsonb_array_length(expected->t) THEN RAISE EXCEPTION 'Delete count mismatch: %',t; END IF;
    EXECUTE format('SELECT count(*) FROM public.%I',t) INTO n;
    IF n <> 0 THEN RAISE EXCEPTION 'Residual rows: %',t; END IF;
  END LOOP;
  FOR t IN SELECT jsonb_object_keys(protected_before) LOOP
    EXECUTE format('SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY to_jsonb(r)::text), ''[]''::jsonb) FROM public.%I r',t) INTO actual;
    IF actual IS DISTINCT FROM protected_before->t THEN RAISE EXCEPTION 'Protected table changed: %',t; END IF;
  END LOOP;
END;
${delimiter};
${commit ? 'COMMIT' : 'ROLLBACK'};
`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [input, output, mode, ...extra] = process.argv.slice(2);
  if (!input || !output || extra.length || (mode && mode !== '--commit')) {
    throw new Error('Usage: node scripts/prepare-test-data-reset.mjs BACKUP.json OUTPUT.sql [--commit]');
  }
  // Exclusive create prevents accidental overwrite of a previous reviewed artifact.
  writeFileSync(output, generateReset(JSON.parse(readFileSync(input,'utf8')), {commit:mode==='--commit'}), {flag:'wx',mode:0o600});
  console.log(`SQL prepared (${mode ? 'commit' : 'rollback'}); no database connection made.`);
}
