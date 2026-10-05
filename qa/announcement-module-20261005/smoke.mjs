// Local, production-schema copy only. Synthetic transactions always roll back.
import {spawnSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const claims=(tenant=1)=>`SELECT set_config('request.jwt.claims','${JSON.stringify({sub:id(11),active_tenant_id:id(tenant)})}',true);SET LOCAL ROLE authenticated;`;
function sql(text){return spawnSync('docker',['exec','-i','supabase_db_bps-supabase-acceptance','psql','-X','-qAt','-v','ON_ERROR_STOP=1','-v','VERBOSITY=verbose','-U','postgres','-d','bps_module_chain_20261005'],{input:'BEGIN;'+text+';ROLLBACK;',encoding:'utf8'});}
const checks=[];
function ok(name,text,expected){const r=sql(text);assert.equal(r.status,0,r.stderr);assert.equal(r.stdout.trim().split('\n').at(-1),expected);checks.push(name);}
function denied(name,text,code){const r=sql(text);assert.notEqual(r.status,0);assert.match(r.stderr,new RegExp(code));checks.push(name);}
const create=`SELECT body FROM announcement_execute_v1('create',NULL,'${id(1)}',' Synthetic ')`;
ok('actual schema manager creates',claims()+create,'Synthetic');
ok('read-only GET predicate',claims()+`SET TRANSACTION READ ONLY;SELECT count(*) FROM announcements`,'0');
const seed=`INSERT INTO announcements(id,tenant_id,body,created_by) VALUES('${id(91)}','${id(1)}','Synthetic','${id(11)}');`;
ok('actual schema manager deletes',seed+claims()+`SELECT id FROM announcement_execute_v1('delete','${id(91)}',NULL,NULL)`,id(91));
const off=`UPDATE tenant_module_settings SET enabled=false WHERE tenant_id='${id(1)}' AND module_key='announcements';`;
ok('disabled read hides existing record',seed+off+claims()+'SELECT count(*) FROM announcements','0');
denied('disabled create',off+claims()+create,'BM001');
denied('disabled delete',seed+off+claims()+`SELECT * FROM announcement_execute_v1('delete','${id(91)}',NULL,NULL)`,'BM001');
denied('stale foreign claim',claims(2)+create,'42501');
for(const role of ['anon','authenticated','service_role'])denied(role+' direct write',`SET LOCAL ROLE ${role};INSERT INTO announcements(tenant_id,body) VALUES('${id(1)}','Synthetic')`,'42501');
for(const role of ['anon','service_role'])denied(role+' command',`SET LOCAL ROLE ${role};`+create,'42501');
writeFileSync(new URL('./smoke.json',import.meta.url),JSON.stringify({passed:checks.length,checks},null,2)+'\n');
console.log(checks.length+' actual-schema checks passed');
