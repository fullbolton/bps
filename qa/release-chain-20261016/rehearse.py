"""Local-only incremental rehearsal. Does not certify current production or replay baseline."""
from pathlib import Path
import subprocess, json, hashlib, os, datetime, time
ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parent
CONTAINER = 'supabase_db_bps-supabase-acceptance'
DB = 'bps_release_rehearsal_' + str(os.getpid())
def sql(query, database=DB):
    return subprocess.run(['docker','exec','-i',CONTAINER,'psql','-X','-qAt','-U','postgres','-d',database,'-v','ON_ERROR_STOP=1'], input=query, text=True, capture_output=True, timeout=120)
def checked(query, database=DB):
    result = sql(query, database)
    if result.returncode: raise RuntimeError(result.stderr)
    return result.stdout.strip()
def digest(path): return hashlib.sha256(path.read_bytes()).hexdigest()
files = sorted(p for p in (ROOT/'supabase/migrations').glob('*.sql') if p.name[:14] > '20261004001400')
prior = json.loads((ROOT/'qa/module-chain-20261005/migration-results.json').read_text()) + json.loads((ROOT/'qa/announcement-module-20261005/migration-results.json').read_text())
report = {'measuredAt':datetime.datetime.now(datetime.timezone.utc).isoformat(), 'scope':'local incremental clone; historical baseline not replayed; current production not measured', 'baselineDatabase':'bps_module_chain_20261005', 'candidates':[{'file':p.name,'sha256':digest(p)} for p in files], 'historicalEvidenceMatches':False,'applied':[], 'success':False, 'cleaned':False}
created = False
try:
    assert len(prior) == 31 and len(files) == 53, 'Unexpected candidate inventory: inspect before proceeding'
    assert [x['file'] for x in prior] == [p.name for p in files[:31]], 'Baseline ordering changed'
    assert all(x['exit']==0 and x['sha256']==digest(ROOT/'supabase/migrations'/x['file']) for x in prior), 'Historical source evidence differs'
    report['historicalEvidenceMatches'] = True
    checked('CREATE DATABASE '+DB+' TEMPLATE bps_module_chain_20261005;', 'postgres'); created=True
    for path in files[31:]:
        started = time.monotonic()
        result = sql(path.read_text())
        (OUT/(path.stem+'.log')).write_text(result.stdout+'\n'+result.stderr)
        report['applied'].append({'file':path.name,'sha256':digest(path),'exit':result.returncode,'seconds':round(time.monotonic()-started,3)})
        print(path.name, result.returncode, flush=True)
        if result.returncode: raise RuntimeError(result.stderr)
    report['integratedSmoke'] = checked((OUT/'integrated-smoke.sql').read_text())
    report['success'] = len(report['applied']) == 22
except Exception as error:
    report['error'] = str(error)
    print(str(error), flush=True)
finally:
    if created:
        cleanup = sql('DROP DATABASE '+DB+' WITH (FORCE);','postgres')
        report['cleaned'] = cleanup.returncode == 0
        if cleanup.returncode: report['cleanupError']=cleanup.stderr
    (OUT/'result.json').write_text(json.dumps(report,indent=2)+'\n')
raise SystemExit(0 if report['success'] and report['cleaned'] else 1)
