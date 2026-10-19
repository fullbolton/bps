import {readFileSync, readdirSync, writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {loadFixtureMigrations} from '../module-change-command-20261017/fixture-migrations.mjs';

// Historical metadata only: this never connects to production or approves release.
const root = new URL('../../', import.meta.url);
const baseline = JSON.parse(readFileSync(new URL('../contract-write-20261015/review-help-production-preflight.json', import.meta.url)));
const versions = baseline.state.versions;
const files = readdirSync(new URL('supabase/migrations/', root)).filter(f => f.endsWith('.sql')).sort();
assert.equal(new Set(files.map(f => f.slice(0,14))).size, files.length, 'Duplicate migration version');
for (const version of versions) assert.ok(files.some(f => f.startsWith(version + '_')), `Missing historical migration ${version}`);
const excluded = ['20260722000200'];
const pending = files.filter(f => !versions.includes(f.slice(0,14)) && !excluded.includes(f.slice(0,14)));
assert.ok(pending.length > 0);
assert.ok(pending.every(f => f.slice(0,14) > versions.at(-1)), 'Backdated migration requires explicit reconciliation');
const fixture = loadFixtureMigrations();
assert.deepEqual(fixture.filter(f => !versions.includes(f.slice(0,14))), pending);
const server = 'supabase_db_bps-supabase-acceptance';
const db = `bps_release_${process.pid}`;
const sql = (q, database = db) => execFileSync('docker', ['exec','-i',server,'psql','-X','-qAt','-U','postgres','-d',database,'-v','ON_ERROR_STOP=1'], {input:q,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();
let created = false;
try {
  sql(`CREATE DATABASE ${db} TEMPLATE bps_module_chain_20261005`, 'postgres'); created = true;
  for (const f of fixture.filter(f => versions.includes(f.slice(0,14)))) sql(readFileSync(new URL('supabase/migrations/' + f, root),'utf8'));
  const liveLedger = JSON.parse(readFileSync(new URL('./live-ledger.json', import.meta.url)));
  assert.deepEqual(liveLedger.rows.map(r => r.version), versions, 'Live ledger changed: reconcile baseline before rehearsal');
  const liveCatalog = JSON.parse(readFileSync(new URL('./live-catalog.json', import.meta.url)));
  // Historical staged fixture intentionally retained the pre-activation ACL.
  // Match the freshly measured production grant, only in the disposable DB.
  const writer = liveCatalog.rows[0].catalog.functions.find(r => r.signature === 'change_workspace_modules_v1(uuid,uuid,uuid,uuid,text,uuid,jsonb)');
  assert.equal(writer?.acl, '{postgres=X/postgres,authenticated=X/postgres}', 'Production writer ACL changed; review before rehearsal');
  sql('GRANT EXECUTE ON FUNCTION public.change_workspace_modules_v1(uuid,uuid,uuid,uuid,text,uuid,jsonb) TO authenticated');
  const localCatalog = JSON.parse(sql(readFileSync(new URL('./catalog.sql', import.meta.url),'utf8')));
  const drift = [];
  for (const [kind, liveRows] of Object.entries(liveCatalog.rows[0].catalog)) {
    const key = row => kind === 'functions' ? row.signature : kind === 'columns' ? `${row.table}.${row.column}` : kind === 'policies' ? `${row.table}.${row.name}` : row.table;
    const local = new Map(localCatalog[kind].map(row => [key(row), row]));
    for (const row of liveRows) {
      const candidate = local.get(key(row));
      if (!candidate || JSON.stringify(candidate) !== JSON.stringify(row)) drift.push({kind,key:key(row),reason:candidate?'definition differs':'missing locally',fields:candidate?Object.keys(row).filter(k=>JSON.stringify(row[k])!==JSON.stringify(candidate[k])).map(k=>({name:k,live:row[k],local:candidate[k]})):[]} );
      local.delete(key(row));
    }
    for (const name of local.keys()) drift.push({kind,key:name,reason:'only local'});
  }
  writeFileSync(new URL('./catalog-comparison.json',import.meta.url),JSON.stringify({measuredAt:new Date().toISOString(),liveMeasuredAt:liveCatalog.measuredAt,drift,matched:drift.length===0},null,2)+'\n');
  assert.equal(drift.length,0,'Production public catalog differs; reconcile before applying candidate');
  const migrations = [];
  for (const name of pending) {
    const body = readFileSync(new URL('supabase/migrations/' + name, root),'utf8');
    sql(body);
    migrations.push({name,sha256:createHash('sha256').update(body).digest('hex')});
  }
  assert.equal(sql('SELECT count(*) FROM hr_access_release_gates WHERE approved'), '0');
  assert.equal(sql("SELECT count(*) FROM company_hr_access_modes WHERE mode='scoped'"), '0');
  const vercel = JSON.parse(readFileSync(new URL('vercel.json', root)));
  assert.equal(vercel.git.deploymentEnabled['codex/tenant-modules-foundation-20260928'], false);
  const result = {
    measuredAt:new Date().toISOString(), candidate:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),
    historicalBaseline:{measuredAt:baseline.measuredAt,migrationCount:versions.length,lastVersion:versions.at(-1)},
    currentProductionLedgerVerified:true,productionLedgerMeasuredAt:liveLedger.measuredAt,catalogDriftCount:drift.length,syntheticOnly:true,migrations,
    checks:['All historical ledger versions present','No duplicate or backdated candidate version','Strict fixture manifest matches candidate','Sequential candidate installation passed','No approved HR release gates','No scoped company activation','Development Git deployment disabled'],
    limits:['Synthetic template reconciled against measured public catalog subset; indexes, constraints, triggers, non-public schemas and production data not compared','No production SQL, deployment, data export or company activation','Application rollback and production lock duration not measured']
  };
  writeFileSync(new URL('./result.json', import.meta.url),JSON.stringify(result,null,2)+'\n');
  console.log(`PASS: ${migrations.length} sequential migrations; HR activation closed; historical baseline ${versions.length}`);
} finally { if(created) sql(`DROP DATABASE ${db} WITH (FORCE)`, 'postgres'); }
