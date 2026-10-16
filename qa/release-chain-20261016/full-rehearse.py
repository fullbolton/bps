"""Fresh schema-only snapshot -> all 53 candidates. LOCAL Docker only."""
from pathlib import Path
import subprocess, json, hashlib, os, datetime, time, importlib.util
ROOT=Path(__file__).resolve().parents[2]
BASE=Path(__file__).resolve().parent
BARRIER=os.environ.get('BPS_RELEASE_BARRIER')=='1'
ATOMIC=os.environ.get('BPS_RELEASE_ATOMIC')=='1'
if ATOMIC and not BARRIER: raise ValueError('Atomic rehearsal requires barrier')
if ATOMIC:
 spec=importlib.util.spec_from_file_location('atomic_package',BASE/'atomic-package.py')
 package=importlib.util.module_from_spec(spec);spec.loader.exec_module(package)
OUT=BASE/('full-atomic' if ATOMIC else ('full-barrier' if BARRIER else 'full'));OUT.mkdir(exist_ok=True)
CONTAINER='supabase_db_bps-supabase-acceptance';DB='bps_full_rehearsal_'+str(os.getpid())
SNAPSHOT=Path('/private/tmp/bps-prod-schema-20261016.sql')
def sql(query,database=DB,user='postgres'):
 return subprocess.run(['docker','exec','-i',CONTAINER,'sh','-c','PGPASSWORD="$POSTGRES_PASSWORD" exec psql "$@"','sh','-X','-qAt','-v','ON_ERROR_STOP=1','-U',user,'-d',database],input=query,text=True,capture_output=True,timeout=180)
def check(query,database=DB,user='postgres'):
 r=sql(query,database,user)
 if r.returncode:raise RuntimeError(r.stderr)
 return r.stdout.strip()
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
report={'measuredAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'scope':'fresh production schema only; synthetic rows; local full rehearsal','applied':[],'success':False,'cleaned':False}
created=False
try:
 manifest=json.loads((BASE/'result.json').read_text())
 files=sorted(p for p in (ROOT/'supabase/migrations').glob('*.sql') if p.name[:14]>'20261004001400')
 if [{'file':p.name,'sha256':sha(p)} for p in files]!=manifest['candidates'] or len(files)!=53:raise ValueError('Candidate manifest drift')
 expected=json.loads((BASE/'full/snapshot-manifest.json').read_text())
 if sha(SNAPSHOT)!=expected['sha256']:raise ValueError('Snapshot checksum differs from captured manifest')
 raw=SNAPSHOT.read_text()
 if len(raw)<100000 or raw.count('CREATE SCHEMA IF NOT EXISTS "extensions";')+raw.count('CREATE SCHEMA extensions;')!=1:raise ValueError('Missing or unexpected snapshot schema anchor')
 report['snapshot']={'sha256':sha(SNAPSHOT),'bytes':SNAPSHOT.stat().st_size,'schemaOnly':True}
 check('CREATE DATABASE '+DB+' OWNER postgres TEMPLATE template0;','postgres','supabase_admin');created=True
 check('DROP SCHEMA public CASCADE;',user='supabase_admin')
 anchor='CREATE SCHEMA extensions;' if 'CREATE SCHEMA extensions;' in raw else 'CREATE SCHEMA IF NOT EXISTS "extensions";'
 raw=raw.replace(anchor,anchor+'\nCREATE EXTENSION btree_gist WITH SCHEMA extensions;\nCREATE EXTENSION pgcrypto WITH SCHEMA extensions;\nCREATE EXTENSION "uuid-ossp" WITH SCHEMA extensions;',1)
 r=sql(raw,user='supabase_admin')
 (OUT/'restore.log').write_text(r.stdout+'\n'+r.stderr)
 if r.returncode:raise RuntimeError(r.stderr[-3000:])
 check((ROOT/'qa/module-chain-20261005/reproduce/bps-module-chain-seed.sql').read_text())
 report['emptySnapshotVerified']=True
 if ATOMIC:
  baseline=json.loads((BASE/'production-ledger.json').read_text())['migrations']
  check('CREATE SCHEMA supabase_migrations; CREATE TABLE supabase_migrations.schema_migrations(version text PRIMARY KEY,name text,statements text[],created_by text,idempotency_key text UNIQUE,rollback text[]);')
  check('INSERT INTO supabase_migrations.schema_migrations(version) VALUES '+','.join("('"+v+"')" for v in baseline)+';')
 if BARRIER:check((BASE/'barrier/install.sql').read_text(),user='postgres')
 if ATOMIC:
  first=package.compose(files[0])
  targets_before=check('SELECT count(*) FROM bps_release_guard.targets;')
  # Fail after schema, barrier extension and ledger INSERT, before COMMIT.
  broken=first.rsplit('COMMIT;',1)[0]+"SELECT 1/0;\nCOMMIT;\n"
  rejected=sql(broken)
  if rejected.returncode==0:raise ValueError('Injected failure unexpectedly succeeded')
  if int(check('SELECT count(*) FROM supabase_migrations.schema_migrations;'))!=len(baseline):raise ValueError('Failed transaction changed ledger')
  if check("SELECT to_regprocedure('public.workspace_module_catalog_v1()') IS NULL;")!='t':raise ValueError('Failed transaction left schema changes')
  if check('SELECT count(*) FROM bps_release_guard.targets;')!=targets_before:raise ValueError('Failed transaction left barrier targets')
  check((BASE/'barrier/verify.sql').read_text(),user='postgres')
  report['injectedFailureRolledBackSchemaLedgerBarrier']=True
  # Out-of-order application must fail before changing schema.
  out_of_order=sql(package.compose(files[1]))
  if out_of_order.returncode==0 or 'RELEASE_LEDGER_PREFIX_CHANGED' not in out_of_order.stderr:raise ValueError('Out-of-order migration not rejected')
  report['outOfOrderRejected']=True
 for p in files:
  start=time.monotonic();payload=package.compose(p) if ATOMIC else p.read_text();r=sql(payload)
  (OUT/(p.stem+'.log')).write_text(r.stdout+'\n'+r.stderr)
  report['applied'].append({'file':p.name,'sha256':sha(p),'executedSha256':hashlib.sha256(payload.encode()).hexdigest(),'exit':r.returncode,'seconds':round(time.monotonic()-start,3)})
  print(p.name,r.returncode,flush=True)
  if r.returncode:raise RuntimeError(r.stderr)
  if BARRIER and not ATOMIC:
   check((BASE/'barrier/extend.sql').read_text(),user='postgres')
   check((BASE/'barrier/verify.sql').read_text(),user='supabase_admin')
 if ATOMIC:
  report['ledgerCount']=int(check('SELECT count(*) FROM supabase_migrations.schema_migrations;'))
  if report['ledgerCount']!=182:raise ValueError('Unexpected final ledger count')
  check((BASE/'barrier/verify.sql').read_text(),user='postgres')
  report['atomicLedgerAndBarrier']=True
 report['integratedSmoke']=check((BASE/'integrated-smoke.sql').read_text())
 if BARRIER:
  check((BASE/'barrier/remove.sql').read_text(),user='postgres')
  report['barrierRemoved']=True
 report['success']=True
except Exception as e:
 report['error']=str(e);print(str(e),flush=True)
finally:
 if created:
  r=sql('DROP DATABASE '+DB+' WITH (FORCE);','postgres','supabase_admin');report['cleaned']=r.returncode==0
  if r.returncode:report['cleanupError']=r.stderr
 (OUT/'result.json').write_text(json.dumps(report,indent=2)+'\n')
raise SystemExit(0 if report['success'] and report['cleaned'] else 1)
