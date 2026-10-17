"""Replay pinned public schema + pending SQL in disposable local PostgreSQL only.
Auth/storage/extensions come from a local synthetic template, not production.
Usage: python3 rehearse-pending.py /path/to/schema-only.sql
"""
from pathlib import Path
import sys, subprocess, hashlib, json, os, datetime
ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parent / 'pending-rehearsal-20261017'
OUT.mkdir(exist_ok=True)
DB = 'bps_pending_rehearsal_' + str(os.getpid())
CONTAINER = 'supabase_db_bps-supabase-acceptance'
def run(query, db=DB, user='postgres'):
    return subprocess.run(['docker','exec','-i',CONTAINER,'sh','-c','PGPASSWORD="$POSTGRES_PASSWORD" exec psql "$@"','sh','-X','-qAt','-v','ON_ERROR_STOP=1','-U',user,'-d',db], input=query,text=True,capture_output=True,timeout=180)
def check(query, db=DB, user='postgres'):
    r=run(query,db,user)
    if r.returncode: raise RuntimeError(r.stderr[-3000:])
    return r.stdout.strip()
def digest(path): return hashlib.sha256(path.read_bytes()).hexdigest()
report={'measuredAt':datetime.datetime.now(datetime.timezone.utc).isoformat(), 'scope':'Pinned production public schema; local synthetic auth/storage/extensions dependencies. No production DDL or business data.', 'success':False,'cleaned':False,'applied':[]}
created=False
try:
    snapshot=Path(sys.argv[1])
    if digest(snapshot)!='706e8399171f68a8cb454c275b933ba653623da6503be0b64884b0d39c288ce2': raise ValueError('Snapshot drift')
    report['snapshotSha256']=digest(snapshot)
    pending=json.loads((OUT.parent/'live-ledger-preflight-20261017.json').read_text())['pending']
    for item in pending:
        if digest(ROOT/'supabase/migrations'/item['file'])!=item['sha256']: raise ValueError('Migration drift')
    check('CREATE DATABASE '+DB+' OWNER postgres TEMPLATE bps_module_chain_20261005;', 'postgres','supabase_admin'); created=True
    check('DROP SCHEMA public CASCADE;', user='supabase_admin')
    r=run(snapshot.read_text(),user='supabase_admin')
    (OUT/'restore.log').write_text(r.stdout+'\n'+r.stderr)
    if r.returncode: raise RuntimeError(r.stderr[-3000:])
    signature="'public.preview_workspace_modules_v1(uuid,uuid,text,jsonb)'::regprocedure"
    before=check('SELECT proowner::regrole::text || COALESCE(proacl::text,\'NULL\') FROM pg_proc WHERE oid='+signature)
    for item in pending:
        r=run((ROOT/'supabase/migrations'/item['file']).read_text())
        (OUT/(item['file']+'.log')).write_text(r.stdout+'\n'+r.stderr)
        report['applied'].append({**item,'exit':r.returncode})
        if r.returncode: raise RuntimeError(r.stderr[-3000:])
    after=check('SELECT proowner::regrole::text || COALESCE(proacl::text,\'NULL\') FROM pg_proc WHERE oid='+signature)
    if before!=after: raise ValueError('Preview ownership/ACL changed')
    report['previewOwnerAclPreserved']=True
    report['catalog']=json.loads(check("""SELECT json_build_object(
      'barrierOwner',(SELECT proowner::regrole::text FROM pg_proc WHERE oid='public.legacy_staffing_write_barrier_v1()'::regprocedure),
      'barrierDefiner',(SELECT prosecdef FROM pg_proc WHERE oid='public.legacy_staffing_write_barrier_v1()'::regprocedure),
      'barrierConfig',(SELECT proconfig FROM pg_proc WHERE oid='public.legacy_staffing_write_barrier_v1()'::regprocedure),
      'clientExecute',(SELECT bool_or(has_function_privilege(r,'public.legacy_staffing_write_barrier_v1()','EXECUTE')) FROM unnest(ARRAY['anon','authenticated','service_role']) r),
      'statementTriggers',(SELECT count(*) FROM pg_trigger WHERE tgname IN ('staffing_demands_module_write','workforce_summary_module_write') AND tgtype=30 AND tgenabled='O'),
      'restrictivePolicies',(SELECT count(*) FROM pg_policy WHERE polname IN ('staffing_demands_module_fence','workforce_summary_module_fence') AND NOT polpermissive AND polcmd='*'),
      'pendingContractCheck',(SELECT position('pending_contract_upload' in prosrc)>0 FROM pg_proc WHERE oid='public.preview_workspace_modules_v1(uuid,uuid,text,jsonb)'::regprocedure));"""))
    c=report['catalog']
    if c['barrierOwner']!='postgres' or not c['barrierDefiner'] or c['clientExecute'] or c['statementTriggers']!=2 or c['restrictivePolicies']!=2 or not c['pendingContractCheck']: raise ValueError('Catalog assertions failed')
    report['success']=True
except Exception as e:
    report['error']=str(e)
finally:
    if created:
        r=run('DROP DATABASE '+DB+' WITH (FORCE);','postgres','supabase_admin')
        report['cleaned']=r.returncode==0
        if r.returncode: report['cleanupError']=r.stderr
    (OUT/'result.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(report,indent=2))
sys.exit(0 if report['success'] and report['cleaned'] else 1)
