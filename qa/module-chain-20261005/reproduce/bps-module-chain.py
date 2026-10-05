from pathlib import Path
import subprocess,json,datetime,hashlib,sys
b=Path(__file__).resolve().parents[3];q=b/'qa/module-chain-20261005';q.mkdir(exist_ok=True)
container='supabase_db_bps-supabase-acceptance';db='bps_module_chain_20261005'
def sql(text, database=db,user='supabase_admin'):
 return subprocess.run(['docker','exec','-i',container,'sh','-c','PGPASSWORD="$POSTGRES_PASSWORD" exec psql "$@"','sh','-X','-v','ON_ERROR_STOP=1','-U',user,'-d',database],input=text,capture_output=True,text=True)
if sys.argv[1]=='restore':
 r=sql('CREATE DATABASE '+db+' OWNER postgres TEMPLATE template0;',database='postgres')
 if r.returncode:raise RuntimeError(r.stderr)
 r=sql('DROP SCHEMA public CASCADE;');assert r.returncode==0,r.stderr
 snapshot=Path('/private/tmp/bps-prod-schema-20261005.sql').read_text();assert hashlib.sha256(snapshot.encode()).hexdigest()==json.loads((q/'snapshot-manifest.json').read_text())['sha256']
 snapshot=snapshot.replace('CREATE SCHEMA extensions;', 'CREATE SCHEMA extensions;\nCREATE EXTENSION btree_gist WITH SCHEMA extensions;\nCREATE EXTENSION pgcrypto WITH SCHEMA extensions;\nCREATE EXTENSION "uuid-ossp" WITH SCHEMA extensions;',1)
 r=sql(snapshot);(q/'restore.log').write_text(r.stdout+'\n'+r.stderr)
 print('Restore exit:',r.returncode);print(r.stderr[-1400:]);sys.exit(r.returncode)
if sys.argv[1]=='apply':
 out=[]
 for file in sorted((b/'supabase/migrations').glob('20261005*.sql')):
  if len(sys.argv)>2 and file.name[:14]<sys.argv[2]:continue
  r=sql(file.read_text(),user='postgres');(q/(file.stem+'.log')).write_text(r.stdout+'\n'+r.stderr)
  out.append({'file':file.name,'sha256':hashlib.sha256(file.read_bytes()).hexdigest(),'exit':r.returncode});print(file.name, r.returncode,flush=True)
  if r.returncode:print(r.stderr[-2000:]);break
 (q/'migration-results.json').write_text(json.dumps(out,indent=2)+'\n');sys.exit(0 if len(out)==(len(list((b/'supabase/migrations').glob('20261005*.sql'))) if len(sys.argv)==2 else len(out)) and all(x['exit']==0 for x in out) else 1)
