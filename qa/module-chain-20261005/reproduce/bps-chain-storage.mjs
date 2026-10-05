import {fileURLToPath} from 'node:url';
import{spawnSync}from'node:child_process';import{writeFileSync}from'node:fs';import assert from'node:assert/strict';
const base=fileURLToPath(new URL('../../../',import.meta.url)).replace(/\/$/,''),id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const sql=text=>spawnSync('docker',['exec','-i','supabase_db_bps-supabase-acceptance','psql','-X','-qAt','-v','ON_ERROR_STOP=1','-v','VERBOSITY=verbose','-U','postgres','-d','bps_module_chain_20261005'],{input:text,encoding:'utf8'});
const ok=q=>{const r=sql(q);assert.equal(r.status,0,r.stderr);return r.stdout.trim().split('\n').at(-1)};
const claim=(actor=11,tenant=1)=>`SELECT set_config('request.jwt.claims','${JSON.stringify({sub:id(actor),active_tenant_id:id(tenant)})}',true);`;
const path=`${id(1)}/${id(83)}/${'a'.repeat(64)}.csv`;
ok(`BEGIN;${claim()}
INSERT INTO storage.buckets(id,name,public) VALUES('person-files','person-files',false),('project-sources','project-sources',false);
INSERT INTO talent_people(id,tenant_id,name,source) VALUES('${id(60)}','${id(1)}','Synthetic Person','manual');
INSERT INTO talent_attachments(id,tenant_id,person_id,actor_id,category,filename,mime,size,sha256,ready) VALUES('${id(70)}','${id(1)}','${id(60)}','${id(11)}','photo','synthetic.jpg','image/jpeg',10,'${'a'.repeat(64)}',true),('${id(71)}','${id(1)}','${id(60)}','${id(11)}','photo','pending.jpg','image/jpeg',10,'${'b'.repeat(64)}',false);
INSERT INTO companies(id,tenant_id,name) VALUES('${id(80)}','${id(1)}','Synthetic Company');
INSERT INTO reporting_projects(tenant_id,id,company_id,code,name,kind,created_by) VALUES('${id(1)}','${id(81)}','${id(80)}','SYN','Synthetic Project','other','${id(11)}');
INSERT INTO reporting_periods(tenant_id,project_id,month,created_by) VALUES('${id(1)}','${id(81)}','2026-10-01','${id(11)}');
INSERT INTO reporting_imports(tenant_id,id,project_id,month,actor_id,command_id,source,rows,resolved,base_revision) VALUES('${id(1)}','${id(83)}','${id(81)}','2026-10-01','${id(11)}','${id(84)}','synthetic','[]','[]',1);
INSERT INTO storage.objects(bucket_id,name) VALUES('person-files','${id(70)}'),('project-sources','${path}');COMMIT;`);
const checks=[];function check(n,fn){fn();checks.push(n);console.log('PASS',n)}
for(const [bucket,module]of[['person-files','talent'],['project-sources','reporting']]){
 check(bucket+' visible with module on',()=>assert.equal(ok(`BEGIN;${claim()}SET LOCAL ROLE authenticated;SELECT count(*) FROM storage.objects WHERE bucket_id='${bucket}';ROLLBACK;`),'1'));
 check(bucket+' hidden with module off',()=>assert.equal(ok(`BEGIN;UPDATE tenant_module_settings SET enabled=false WHERE tenant_id='${id(1)}' AND module_key='${module}';${claim()}SET LOCAL ROLE authenticated;SELECT count(*) FROM storage.objects WHERE bucket_id='${bucket}';ROLLBACK;`),'0'));
 check(bucket+' hidden from another tenant',()=>assert.equal(ok(`BEGIN;${claim(12,2)}SET LOCAL ROLE authenticated;SELECT count(*) FROM storage.objects WHERE bucket_id='${bucket}';ROLLBACK;`),'0'));
 check(bucket+' hidden from anonymous role',()=>assert.equal(ok(`BEGIN;SET LOCAL ROLE anon;SELECT count(*) FROM storage.objects WHERE bucket_id='${bucket}';ROLLBACK;`),'0'));
 const name=bucket==='person-files'?id(71):path.replace('a'.repeat(64),'b'.repeat(64));
 check(bucket+' upload allowed with module on',()=>ok(`BEGIN;${claim()}SET LOCAL ROLE authenticated;INSERT INTO storage.objects(bucket_id,name) VALUES('${bucket}','${name}');ROLLBACK;`));
 check(bucket+' upload denied with module off',()=>{const r=sql(`BEGIN;UPDATE tenant_module_settings SET enabled=false WHERE tenant_id='${id(1)}' AND module_key='${module}';${claim()}SET LOCAL ROLE authenticated;INSERT INTO storage.objects(bucket_id,name) VALUES('${bucket}','${name}');`);assert.notEqual(r.status,0);assert.match(r.stderr,/42501|BM001/)});
}
writeFileSync(base+'/qa/module-chain-20261005/storage-smoke.json',JSON.stringify({checks,passed:checks.length,scope:'actual storage.objects policies and database operations; no Storage HTTP upload or signed URL'},null,2)+'\n');
