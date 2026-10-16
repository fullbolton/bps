// Local-only, disposable clone of the documented synthetic acceptance database.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
const {Client}=createRequire(import.meta.url)('pg');
const container='supabase_db_bps-supabase-acceptance';
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const files=['20261015000500_document_cleanup_queue.sql','20261015000600_document_cleanup_retry.sql','20261015000700_document_cleanup_module_preview.sql','20261015000800_document_upload_attempts.sql','20261016000100_document_upload_module_preview.sql','20261016000200_document_pending_uploads.sql','20261016000300_document_finalize_upload.sql','20261016000400_document_upload_recovery.sql','20261016000500_document_upload_cancellation.sql','20261016000600_document_metadata_command.sql','20261016000700_document_delete_command.sql','20261016000800_document_insert_reservations.sql','20261016000900_document_storage_legacy_write_fences.sql'];
function admin(sql){return execFileSync('docker',['exec','-i',container,'psql','-X','-qAt','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1'],{input:sql,encoding:'utf8',timeout:20000});}
async function blocked(observer,pid){
 for(let i=0;i<100;i++){
  const result=await observer.query('select wait_event_type from pg_stat_activity where pid=$1',[pid]);
  if(result.rows[0]?.wait_event_type==='Lock')return;
  await new Promise(resolve=>setTimeout(resolve,20));
 }
 assert.fail('Concurrent command did not wait on a lock');
}
for(const deleteFirst of [true,false])test(deleteFirst?'delete wins: waiting edit cannot revive the document':'edit wins: stale delete cannot remove the new revision',async()=>{
 const database=`bps_delete_race_${process.pid}_${deleteFirst?1:2}`;const clients=[];
 const password=execFileSync('docker',['exec',container,'printenv','POSTGRES_PASSWORD'],{encoding:'utf8',timeout:5000}).trim();
 admin(`CREATE DATABASE ${database} TEMPLATE bps_module_chain_20261005;`);
 try {
  for(let i=0;i<3;i++){const c=new Client({host:'127.0.0.1',port:54322,user:'postgres',password,database,statement_timeout:8000});await c.connect();clients.push(c);}
  const [a,b,observer]=clients;
  for(const file of files)await a.query(readFileSync(new URL('../../supabase/migrations/'+file,import.meta.url),'utf8'));
  for(const c of clients)await c.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:id(11),active_tenant_id:id(1)})]);
  await a.query(`INSERT INTO companies(id,name,tenant_id) VALUES($1,'Synthetic edit/delete',$2)`,[id(981),id(1)]);
  await a.query(`INSERT INTO documents(id,company_id,tenant_id,name,category,status) VALUES($1,$2,$3,'Synthetic','diger','eksik')`,[id(982),id(981),id(1)]);
  const edit=c=>c.query("SELECT document_edit_metadata_v1($1,$2,$3,0,'category','yetki_belgesi')",[id(1),id(982),id(981)]);
  const remove=c=>c.query('SELECT document_delete_v1($1,$2,$3,0)',[id(1),id(982),id(981)]);
  await a.query('BEGIN');await b.query('BEGIN');
  if(deleteFirst)await remove(a);else await edit(a);
  const waiting=(deleteFirst?edit(b):remove(b)).then(()=>({ok:true}),error=>({ok:false,code:error.code}));
  await blocked(observer,b.processID);await a.query('COMMIT');const result=await waiting;
  assert.equal(result.ok,false);assert.equal(result.code,'PT409');await b.query('ROLLBACK');
  const state=await observer.query('SELECT revision,category FROM documents WHERE id=$1',[id(982)]);
  assert.equal(state.rows.length,deleteFirst?0:1);if(!deleteFirst){assert.equal(Number(state.rows[0].revision),1);assert.equal(state.rows[0].category,'yetki_belgesi');}
 } finally {await Promise.all(clients.map(c=>c.end()));admin(`DROP DATABASE ${database} WITH (FORCE);`);}
});
