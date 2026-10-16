"""Fresh schema-only snapshot -> all 53 candidates. LOCAL Docker only."""
from pathlib import Path
import subprocess, json, hashlib, os, datetime, time
ROOT=Path(__file__).resolve().parents[2]
OUT=Path(__file__).resolve().parent/'full';OUT.mkdir(exist_ok=True)
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
 manifest=json.loads((OUT.parent/'result.json').read_text())
 files=sorted(p for p in (ROOT/'supabase/migrations').glob('*.sql') if p.name[:14]>'20261004001400')
 if [{'file':p.name,'sha256':sha(p)} for p in files]!=manifest['candidates'] or len(files)!=53:raise ValueError('Candidate manifest drift')
 expected=json.loads((OUT/'snapshot-manifest.json').read_text())
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
 for p in files:
  start=time.monotonic();r=sql(p.read_text())
  (OUT/(p.stem+'.log')).write_text(r.stdout+'\n'+r.stderr)
  report['applied'].append({'file':p.name,'sha256':sha(p),'exit':r.returncode,'seconds':round(time.monotonic()-start,3)})
  print(p.name,r.returncode,flush=True)
  if r.returncode:raise RuntimeError(r.stderr)
 report['integratedSmoke']=check((OUT.parent/'integrated-smoke.sql').read_text())
 report['success']=True
except Exception as e:
 report['error']=str(e);print(str(e),flush=True)
finally:
 if created:
  r=sql('DROP DATABASE '+DB+' WITH (FORCE);','postgres','supabase_admin');report['cleaned']=r.returncode==0
  if r.returncode:report['cleanupError']=r.stderr
 (OUT/'result.json').write_text(json.dumps(report,indent=2)+'\n')
raise SystemExit(0 if report['success'] and report['cleaned'] else 1)
