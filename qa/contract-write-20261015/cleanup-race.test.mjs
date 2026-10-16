// Local-only, disposable clone of the documented synthetic acceptance database.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
const {Client}=createRequire(import.meta.url)('pg');
const container='supabase_db_bps-supabase-acceptance';
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const files=['20261015000500_document_cleanup_queue.sql','20261015000600_document_cleanup_retry.sql'];
function admin(sql){return execFileSync('docker',['exec','-i',container,'psql','-X','-qAt','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1'],{input:sql,encoding:'utf8',timeout:20000});}
async function blocked(observer,pid){
 for(let i=0;i<100;i++){
  const result=await observer.query('select wait_event_type from pg_stat_activity where pid=$1',[pid]);
  if(result.rows[0]?.wait_event_type==='Lock')return;
  await new Promise(resolve=>setTimeout(resolve,20));
 }
 assert.fail('Concurrent command did not wait on a lock');
}
for(const deletionFirst of [true,false])test(deletionFirst?'delete first rejects a concurrent new reference':'reference first keeps the queued file protected',async()=>{
 const database=`bps_cleanup_race_${process.pid}_${deletionFirst?1:2}`;
 const clients=[];
 // Password stays in process memory; neither the URL nor credentials are logged.
 const password=execFileSync('docker',['exec',container,'printenv','POSTGRES_PASSWORD'],{encoding:'utf8',timeout:5000}).trim();
 admin(`CREATE DATABASE ${database} TEMPLATE bps_module_chain_20261005;`);
 try {
  for(let i=0;i<3;i++){
   const c=new Client({host:'127.0.0.1',port:54322,user:'postgres',password,database,statement_timeout:8000});
   await c.connect();clients.push(c);
  }
  const [a,b,observer]=clients;
  for(const file of files)await a.query(readFileSync(new URL('../../supabase/migrations/'+file,import.meta.url),'utf8'));
  const path=`${id(981)}/${id(982)}.pdf`;
  await a.query(`INSERT INTO companies(id,name,tenant_id) VALUES($1,'Synthetic race',$2)`,[id(981),id(1)]);
  await a.query(`INSERT INTO documents(id,company_id,tenant_id,name,category,status,storage_path) VALUES($1,$2,$3,'Original','diger','tam',$4)`,[id(982),id(981),id(1),path]);
  const insert=c=>c.query(`INSERT INTO documents(id,company_id,tenant_id,name,category,status,storage_path) VALUES($1,$2,$3,'Concurrent','diger','tam',$4)`,[id(983),id(981),id(1),path]);
  const remove=c=>c.query('DELETE FROM documents WHERE id=$1',[id(982)]);
  await a.query('BEGIN');await b.query('BEGIN');
  if(deletionFirst)await remove(a);else await insert(a);
  const waiting=(deletionFirst?insert(b):remove(b)).then(()=>({ok:true}),error=>({ok:false,code:error.code}));
  await blocked(observer,b.processID);
  await a.query('COMMIT');
  const result=await waiting;
  if(deletionFirst){assert.equal(result.ok,false);assert.equal(result.code,'23514');await b.query('ROLLBACK');}
  else {assert.equal(result.ok,true);await b.query('COMMIT');}
  await observer.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:id(11),active_tenant_id:id(1)})]);
  const state=await observer.query("select document_cleanup_delete_allowed_v1('documents',$1) as allowed, (select count(*)::int from documents where storage_path=$1) as references",[path]);
  assert.equal(state.rows[0].references,deletionFirst?0:1);
  assert.equal(state.rows[0].allowed,deletionFirst);
 } finally {
  await Promise.all(clients.map(c=>c.end()));
  admin(`DROP DATABASE ${database} WITH (FORCE);`);
 }
});
