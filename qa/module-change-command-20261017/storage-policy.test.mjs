import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {loadFixtureMigrations} from './fixture-migrations.mjs';
const {Client}=createRequire(import.meta.url)('pg');
const container='supabase_db_bps-supabase-acceptance',database=`bps_storage_policy_${process.pid}`;
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const admin=sql=>execFileSync('docker',['exec','-i',container,'psql','-XqAt','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1'],{input:sql,encoding:'utf8',timeout:20000});
test('real local Storage policies enforce module closure',async t=>{
 const clients=[];admin(`CREATE DATABASE ${database} TEMPLATE bps_module_chain_20261005;`);
 try{
  const password=execFileSync('docker',['exec',container,'printenv','POSTGRES_PASSWORD'],{encoding:'utf8'}).trim();
  for(let i=0;i<2;i++){const c=new Client({host:'127.0.0.1',port:54322,user:'postgres',password,database,statement_timeout:8000});await c.connect();clients.push(c);}
  const [a,w]=clients;
  for(const f of loadFixtureMigrations())await a.query(readFileSync(new URL('../../supabase/migrations/'+f,import.meta.url),'utf8'));
  await a.query(`INSERT INTO talent_people(id,tenant_id,name,source) VALUES('${id(9801)}','${id(1)}','Synthetic policy','manual');
   INSERT INTO talent_attachments(id,tenant_id,person_id,actor_id,category,filename,mime,size,sha256) VALUES('${id(9802)}','${id(1)}','${id(9801)}','${id(11)}','cv','synthetic.pdf','application/pdf',10,repeat('a',64));
   INSERT INTO companies(id,tenant_id,name) VALUES('${id(9803)}','${id(1)}','Synthetic policy');
   INSERT INTO reporting_projects(tenant_id,id,company_id,code,name,kind,created_by) VALUES('${id(1)}','${id(9804)}','${id(9803)}','POLICY_QA','Synthetic policy','other','${id(11)}');
   INSERT INTO reporting_periods(tenant_id,project_id,month,created_by) VALUES('${id(1)}','${id(9804)}','2026-10-01','${id(11)}');
   INSERT INTO reporting_imports(tenant_id,id,project_id,month,actor_id,command_id,source,rows,resolved,base_revision) VALUES('${id(1)}','${id(9805)}','${id(9804)}','2026-10-01','${id(11)}','${id(9806)}','synthetic','[]','[]',1);`);
  await w.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:id(11),active_tenant_id:id(1),role:'authenticated'})]);
  await w.query('SET ROLE authenticated');
  for(const [bucket,module,readPath] of [['person-files','talent',id(9802)],['project-sources','reporting',`${id(1)}/${id(9805)}/${'a'.repeat(64)}.csv`]]){
   let path=readPath;
   const insert=()=>w.query('INSERT INTO storage.objects(bucket_id,name,owner_id) VALUES($1,$2,$3)',[bucket,path,id(11)]);
   await t.test(`${bucket}: enabled upload succeeds; closed read/upload is denied`,async()=>{
    await insert();
    if(module==='talent')await a.query('UPDATE talent_attachments SET ready=true WHERE id=$1',[id(9802)]);
    assert.equal((await w.query('SELECT name FROM storage.objects WHERE bucket_id=$1 AND name=$2',[bucket,path])).rowCount,1);
    await a.query('UPDATE tenant_module_settings SET enabled=false WHERE tenant_id=$1 AND module_key=$2',[id(1),module]);
    assert.equal((await w.query('SELECT name FROM storage.objects WHERE bucket_id=$1 AND name=$2',[bucket,path])).rowCount,0);
    // Use another reservation/path; never bypass Storage's deletion protection.
    if(module==='talent'){
     path=id(9807);
     await a.query(`INSERT INTO talent_attachments(id,tenant_id,person_id,actor_id,category,filename,mime,size,sha256) VALUES('${id(9807)}','${id(1)}','${id(9801)}','${id(11)}','cv','second.pdf','application/pdf',10,repeat('b',64))`);
    }else path=`${id(1)}/${id(9805)}/${'b'.repeat(64)}.csv`;
    await assert.rejects(insert(),{code:'42501'});
   });
   await t.test(`${bucket}: waiting upload sees committed closure and leaves no metadata`,async()=>{
    await a.query('UPDATE tenant_module_settings SET enabled=true WHERE tenant_id=$1 AND module_key=$2',[id(1),module]);
    await a.query('BEGIN');
    await a.query('SELECT 1 FROM tenant_module_config WHERE tenant_id=$1 FOR UPDATE',[id(1)]);
    const outcome=insert().then(()=>null,e=>e);
    const pid=(await a.query("SELECT pid FROM pg_stat_activity WHERE datname=$1 AND pid<>pg_backend_pid()",[database])).rows[0].pid;
    let blocked=false;
    for(let i=0;i<100;i++){if((await a.query('SELECT wait_event_type FROM pg_stat_activity WHERE pid=$1',[pid])).rows[0]?.wait_event_type==='Lock'){blocked=true;break;}await new Promise(r=>setTimeout(r,20));}
    assert.ok(blocked,'upload must wait on config lock');
    await a.query('UPDATE tenant_module_settings SET enabled=false WHERE tenant_id=$1 AND module_key=$2',[id(1),module]);
    await a.query('COMMIT');
    assert.equal((await outcome)?.code,'BM001');
    assert.equal((await a.query('SELECT name FROM storage.objects WHERE bucket_id=$1 AND name=$2',[bucket,path])).rowCount,0);
    await a.query('UPDATE tenant_module_settings SET enabled=true WHERE tenant_id=$1 AND module_key=$2',[id(1),module]);
    await insert();
    assert.equal((await a.query('SELECT name FROM storage.objects WHERE bucket_id=$1 AND name=$2',[bucket,path])).rowCount,1);
   });
  }
 }finally{for(const c of clients){await c.query('ROLLBACK').catch(()=>{});await c.end();}admin(`DROP DATABASE ${database} WITH (FORCE);`);}
});
