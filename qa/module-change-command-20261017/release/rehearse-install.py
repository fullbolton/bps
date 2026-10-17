"""Local disposable acceptance of the fixed install transaction and ledger rollback."""
from pathlib import Path
import subprocess,sys,json,hashlib,os,datetime
HERE=Path(__file__).resolve().parent
plan=json.loads((HERE/'preflight-plan.json').read_text())
snapshot=Path(sys.argv[1]);assert hashlib.sha256(snapshot.read_bytes()).hexdigest()==plan['schemaSha256']
bundle=(HERE/'install.sql').read_text();db='bps_module_install_'+str(os.getpid());container='supabase_db_bps-supabase-acceptance'
def sql(s,database=db,user='postgres',check=True):
 r=subprocess.run(['docker','exec','-i',container,'sh','-c','PGPASSWORD="$POSTGRES_PASSWORD" exec psql "$@"','sh','-XqAt','-v','ON_ERROR_STOP=1','-U',user,'-d',database],input=s,text=True,capture_output=True,timeout=180)
 if check and r.returncode:raise RuntimeError(r.stderr[-1200:])
 return r
sig='public.change_workspace_modules_v1(uuid,uuid,uuid,uuid,text,uuid,jsonb)'
report={'measuredAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'scope':'local synthetic dependencies + pinned production public schema','installSha256':hashlib.sha256(bundle.encode()).hexdigest(),'checks':[],'success':False,'cleaned':False};created=False
try:
 sql('CREATE DATABASE '+db+' OWNER postgres TEMPLATE bps_module_chain_20261005;','postgres','supabase_admin');created=True
 sql('DROP SCHEMA public CASCADE;',user='supabase_admin');sql(snapshot.read_text(),user='supabase_admin')
 sql('DROP SCHEMA IF EXISTS supabase_migrations CASCADE; CREATE SCHEMA supabase_migrations; CREATE TABLE supabase_migrations.schema_migrations(version text PRIMARY KEY,name text,statements text[]); ALTER TABLE supabase_migrations.schema_migrations OWNER TO postgres;'+''.join("INSERT INTO supabase_migrations.schema_migrations(version) VALUES ('"+v+"');" for v in plan['versions']),user='supabase_admin')
 # All DDL and ledger inserts must roll back together if the last step fails.
 failed=bundle.removesuffix('COMMIT;\n')+"SELECT 1/0; COMMIT;\n"
 failure=sql(failed,check=False);assert failure.returncode!=0 and 'division by zero' in failure.stderr, failure.stderr[-1600:]
 assert sql("SELECT count(*) FROM supabase_migrations.schema_migrations;").stdout.strip()=='182'
 assert sql("SELECT to_regprocedure('"+sig+"') IS NULL;").stdout.strip()=='t'
 assert sql("SELECT to_regprocedure('public.legacy_staffing_write_barrier_v1()') IS NULL;").stdout.strip()=='t'
 report['checks'].append('injected final error rolls back all three migrations and ledger entries')
 sql(bundle)
 assert sql('SELECT count(*) FROM supabase_migrations.schema_migrations;').stdout.strip()=='185'
 assert sql("SELECT has_function_privilege('authenticated','"+sig+"','EXECUTE');").stdout.strip()=='f'
 report['checks'].append('three migration installs commit with ledger 185 and no client grant')
 drift=sql(bundle,check=False);assert drift.returncode and 'MODULE_RELEASE_LEDGER_DRIFT' in drift.stderr
 report['checks'].append('reapplication rejected by exact ledger prefix')
 sql((HERE/'enable.sql').read_text());assert sql("SELECT has_function_privilege('authenticated','"+sig+"','EXECUTE');").stdout.strip()=='t'
 sql((HERE/'disable.sql').read_text());assert sql("SELECT has_function_privilege('authenticated','"+sig+"','EXECUTE');").stdout.strip()=='f'
 report['checks'].append('activation and revocation work on schema rehearsal')
 report['success']=True
finally:
 if created:sql('DROP DATABASE '+db+' WITH (FORCE);','postgres','supabase_admin');report['cleaned']=True
 (HERE/'atomic-install-result.json').write_text(json.dumps(report,indent=2)+'\n')
 print(json.dumps(report))
