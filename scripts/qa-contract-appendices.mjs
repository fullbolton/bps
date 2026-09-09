import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import assert from 'node:assert/strict';
import {baseline,id} from './fixtures/daily-operations.mjs';
const modulePath=process.env.BPS_EMBEDDED_PG_MODULE;if(!modulePath?.startsWith('/'))throw Error('Absolute BPS_EMBEDDED_PG_MODULE required');
const {default:EmbeddedPostgres}=await import(pathToFileURL(modulePath).href);
const dir=await mkdtemp(join(tmpdir(),'bps-appendices-'));
const pg=new EmbeddedPostgres({databaseDir:join(dir,'db'),user:'postgres',password:randomUUID(),port:55447,persistent:false,postgresFlags:['-h','127.0.0.1','-k',dir],onLog:()=>{},onError:()=>{}});
const clients=[];let count=0;const pass=label=>{count++;console.log('PASS '+label);};
try{
 await pg.initialise();await pg.start();
 async function connect(){const c=pg.getPgClient('postgres','127.0.0.1');clients.push(c);await c.connect();await c.query("SET statement_timeout='8s'; SET idle_in_transaction_session_timeout='15s'");return c;}
 const m=await connect(),a=await connect(),b=await connect();await m.query(baseline);
 await m.query(`CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT jsonb_build_object('app_metadata',jsonb_build_object('active_tenant',current_setting('test.tenant',true))) $$;
 CREATE SCHEMA storage; CREATE TABLE storage.objects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),bucket_id text,name text,owner_id text,metadata jsonb,UNIQUE(bucket_id,name));
 GRANT USAGE ON SCHEMA storage TO authenticated;GRANT SELECT,INSERT,UPDATE,DELETE ON storage.objects TO authenticated;
 ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;CREATE POLICY fixture_storage ON storage.objects TO authenticated USING(true) WITH CHECK(true);`);
 for(const f of ['local-task-prefill.sql','local-contracts.sql','local-documents.sql'])await m.query(await readFile(new URL('./fixtures/'+f,import.meta.url),'utf8'));
 for(let n=100;n<120;n++)await m.query('INSERT INTO contracts(id,tenant_id,company_id,name) VALUES($1,$2,$3,$4)',[id(n),id(1),id(20),'Upload '+n]);
 let beforeMigration;
 for(const f of ['20260909001800_contract_document_versions.sql','20260909001900_contract_pdf_upload_commands.sql','20260909002000_contract_appendices.sql']){
  if(f.includes('02000')){
   const readFileSyncMigration=await readFile(new URL('../supabase/migrations/'+f,import.meta.url),'utf8');
   await m.query("SELECT set_config('test.user',$1,false),set_config('test.tenant',$2,false)",[id(10),id(1)]);await m.query('SET ROLE authenticated');
   const legacyArgs=[id(10),id(1),id(118),id(980),null,null,'Legacy.pdf',10,'a'.repeat(64)];
   const legacy=(await m.query('SELECT prepare_contract_pdf_upload($1,$2,$3,$4,$5,$6,$7,$8,$9) r',legacyArgs)).rows[0].r;
   await m.query('RESET ROLE');await m.query("INSERT INTO storage.objects(bucket_id,name,owner_id,metadata) VALUES('documents',$1,$2,$3)",[legacy.path,id(10),{mimetype:'application/pdf',size:10}]);await m.query('SET ROLE authenticated');
   beforeMigration=(await m.query('SELECT finish_contract_pdf_upload($1,$2,$3,$4) r',[id(10),id(1),id(118),id(980)])).rows[0].r;
   await m.query('SELECT prepare_contract_pdf_upload($1,$2,$3,$4,$5,$6,$7,$8,$9)',[id(10),id(1),id(117),id(982),null,null,'Legacy.pdf',10,'a'.repeat(64)]);
   await m.query('SELECT prepare_contract_pdf_upload($1,$2,$3,$4,$5,$6,$7,$8,$9,true)',[id(10),id(1),id(119),id(981),null,null,'Legacy.pdf',10,'a'.repeat(64)]);
   await m.query('RESET ROLE');
   await m.query("UPDATE documents SET category='diger' WHERE id=$1",[beforeMigration.documentId]);
   await assert.rejects(()=>m.query(readFileSyncMigration),/PDF_ROLE_BASELINE_REVIEW_REQUIRED/);
   await m.query('ROLLBACK');
   assert.equal((await m.query("SELECT count(*) FROM information_schema.columns WHERE table_name='documents' AND column_name='contract_document_role'")).rows[0].count,'0');
   await m.query("UPDATE documents SET category='cerceve_sozlesme' WHERE id=$1",[beforeMigration.documentId]);pass('inconsistent legacy category aborts migration before role backfill; requires explicit review');
  }
  await m.query(await readFile(new URL('../supabase/migrations/'+f,import.meta.url),'utf8'));
 }

 async function asUser(c,user=10,tenant=1){await c.query('RESET ROLE');await c.query("SELECT set_config('test.user',$1,false),set_config('test.tenant',$2,false)",[id(user),id(tenant)]);await c.query('SET ROLE authenticated');}
 await asUser(a);await asUser(b);
 const prepare=async(c,n,contract=100,doc=null,revision=null,cancel=false,hash='a'.repeat(64))=>(await c.query('SELECT prepare_contract_pdf_upload($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) r',[id(10),id(1),id(contract),id(n),doc,revision,'Test.pdf',10,hash,cancel])).rows[0].r;
 const finish=async(c,n,contract=100)=>(await c.query('SELECT finish_contract_pdf_upload($1,$2,$3,$4) r',[id(10),id(1),id(contract),id(n)])).rows[0].r;
 const object=async(p,owner=10,metadata={mimetype:'application/pdf',size:10})=>m.query("INSERT INTO storage.objects(bucket_id,name,owner_id,metadata) VALUES('documents',$1,$2,$3)",[p,id(owner),metadata]);
 const get=async(n,contract=100)=>(await a.query('SELECT get_contract_pdf_upload($1,$2,$3,$4) r',[id(10),id(1),id(contract),id(n)])).rows[0].r;
 const fails=(fn,code)=>assert.rejects(fn,new RegExp(code));
 const rawInsert=(path,contract=100)=>a.query("INSERT INTO documents(tenant_id,company_id,contract_id,name,storage_path) VALUES($1,$2,$3,'Raw.pdf',$4)",[id(1),id(20),id(contract),path]);
 const legacyAfter=await finish(a,980,118);assert.equal(legacyAfter.documentId,beforeMigration.documentId);assert.equal(legacyAfter.versionId,beforeMigration.versionId);assert.equal((await m.query('SELECT revision FROM documents WHERE id=$1',[beforeMigration.documentId])).rows[0].revision,'2');
 assert.equal((await get(981,119)).state,'cancelled');const oldPending=await get(982,117);assert.equal(oldPending.state,'pending');await object(oldPending.path);assert.equal((await finish(a,982,117)).state,'published');pass('actual pre-02000 published, cancelled and pending commands survive migration without rewriting revisions');
 let r=await prepare(a,200);assert.equal(r.state,'pending');assert.deepEqual(await prepare(b,200),r);pass('prepare replay reserves one stable random path');
 await fails(()=>a.query('UPDATE contracts SET company_id=$1 WHERE id=$2',[id(22),id(100)]),'PDF_UPLOAD_CONTEXT');pass('pending upload fixes contract context so cancellation remains reachable');
 await fails(()=>prepare(a,200,100,null,null,false,'b'.repeat(64)),'PDF_UPLOAD_COMMAND');await fails(()=>a.query('SELECT * FROM contract_pdf_upload_commands'),'permission denied');pass('immutable command identity and private ledger');
 await fails(()=>finish(a,200),'PDF_UPLOAD_OBJECT');await object(r.path,11);await fails(()=>finish(a,200),'PDF_UPLOAD_OBJECT');await m.query('UPDATE storage.objects SET owner_id=$1,metadata=$2 WHERE name=$3',[id(10),{mimetype:'application/pdf',size:11},r.path]);await fails(()=>finish(a,200),'PDF_UPLOAD_OBJECT');await m.query('UPDATE storage.objects SET metadata=$1 WHERE name=$2',[{mimetype:'application/pdf',size:10},r.path]);pass('missing object, foreign owner and wrong size rejected');
 await fails(()=>rawInsert(r.path),'PDF_UPLOAD_RESERVED');pass('reserved pending path cannot be published through raw documents insert');
 assert.equal((await a.query("DELETE FROM storage.objects WHERE name=$1",[r.path])).rowCount,0);assert.equal((await a.query("UPDATE storage.objects SET metadata='{}' WHERE name=$1",[r.path])).rowCount,0);pass('pending bytes cannot be deleted or overwritten by authenticated clients');
 const published=await finish(a,200);assert.equal(published.state,'published');assert.deepEqual(await finish(b,200),published);assert.deepEqual(await prepare(a,200),published);assert.deepEqual(await get(200),published);assert.equal((await m.query('SELECT count(*) FROM contract_document_versions WHERE contract_id=$1',[id(100)])).rows[0].count,'1');pass('finish response loss and prepare replay produce one version and stable receipt');
 r=await prepare(a,201,100,published.documentId,0);await object(r.path);const v2=await finish(a,201);assert.notEqual(v2.versionId,published.versionId);assert.deepEqual(await finish(a,200),published);pass('replacement preserves prior receipt after later version exists');
 await fails(()=>prepare(a,202,100,published.documentId,0),'PDF_UPLOAD_CONFLICT');pass('stale document revision cannot reserve a new upload');
 const cancelled=await prepare(a,203,101,null,null,true);assert.equal(cancelled.state,'cancelled');assert.deepEqual(await prepare(b,203,101),cancelled);await fails(()=>finish(a,203,101),'PDF_UPLOAD_CANCELLED');await object(cancelled.path);await fails(()=>rawInsert(cancelled.path,101),'PDF_UPLOAD_RESERVED');pass('cancel before delayed first request leaves tombstone; raw write and finish cannot revive it');
 await fails(()=>a.query('DELETE FROM contracts WHERE id=$1',[id(101)]),'foreign key');pass('contract deletion cannot erase cancellation tombstone and allow command reuse');
 assert.deepEqual(await prepare(a,200,100,null,null,true),published);pass('cancel after publication reports published receipt without undoing it');
 r=await prepare(a,204,102);await object(r.path);await m.query("UPDATE companies SET status='pasif' WHERE id=$1",[id(20)]);await fails(()=>finish(a,204,102),'PDF_UPLOAD_PASSIVE');assert.equal((await prepare(a,204,102,null,null,true)).state,'cancelled');await m.query("UPDATE companies SET status='aktif' WHERE id=$1",[id(20)]);pass('passive transition prevents finish but permits cancellation');
 assert.equal(await get(999),null);await asUser(b,11);await fails(()=>prepare(b,205),'PDF_UPLOAD_SCOPE');await fails(()=>b.query('SELECT get_contract_pdf_upload($1,$2,$3,$4)',[id(11),id(1),id(100),id(200)]),'PDF_UPLOAD_FORBIDDEN');await asUser(b);pass('confirmed missing is distinct from scope and role failure');
 const pidA=(await a.query('SELECT pg_backend_pid() pid')).rows[0].pid,pidB=(await b.query('SELECT pg_backend_pid() pid')).rows[0].pid;
 async function blocked(){for(let i=0;i<250;i++){if((await m.query('SELECT pg_blocking_pids($1) pids',[pidB])).rows[0].pids.includes(pidA))return;await delay(10);}throw Error('Expected observed lock wait');}
 const x=await prepare(a,206,103),y=await prepare(b,207,103);await object(x.path);await object(y.path);
 await a.query('BEGIN');await finish(a,206,103);let wait=finish(b,207,103).then(value=>({value}),error=>({error}));await blocked();await a.query('COMMIT');assert.match((await wait).error.message,/PDF_UPLOAD_CONFLICT/);pass('two first uploads serialize on contract; second sees committed document and conflicts');
 r=await prepare(a,208,104);await object(r.path);await a.query('BEGIN');await prepare(a,208,104,null,null,true);wait=finish(b,208,104).then(value=>({value}),error=>({error}));await blocked();await a.query('COMMIT');assert.match((await wait).error.message,/PDF_UPLOAD_CANCELLED/);pass('cancel wins concurrent finish and leaves no published document');
 r=await prepare(a,209,105);await object(r.path);await a.query('BEGIN');const winner=await finish(a,209,105);wait=prepare(b,209,105,null,null,true);await blocked();await a.query('COMMIT');assert.deepEqual(await wait,winner);pass('finish wins concurrent cancel; cancellation reports published result');
 await m.query("ALTER TABLE contract_document_versions ADD CONSTRAINT reject_upload_test CHECK(contract_id<>'"+id(106)+"')");r=await prepare(a,210,106);await object(r.path);await fails(()=>finish(a,210,106),'reject_upload_test');assert.equal((await get(210,106)).state,'pending');assert.equal((await m.query('SELECT count(*) FROM documents WHERE contract_id=$1',[id(106)])).rows[0].count,'0');pass('late failure rolls back transient publishing state, document and version together');
 const metaFirst=await prepare(a,220,110);await object(metaFirst.path);const metaDoc=await finish(a,220,110);
 const metaNext=await prepare(a,221,110,metaDoc.documentId,0);await object(metaNext.path);
 await b.query('BEGIN');await b.query('SELECT id FROM documents WHERE id=$1 FOR UPDATE',[metaDoc.documentId]);
 const metaFinish=finish(a,221,110).then(value=>({value}),error=>({error}));let metaBlocked=false;
 for(let i=0;i<250;i++){if((await m.query('SELECT pg_blocking_pids($1) pids',[pidA])).rows[0].pids.includes(pidB)){metaBlocked=true;break;}await delay(10);}assert.ok(metaBlocked);
 await b.query("UPDATE documents SET validity_date='2027-02-01' WHERE id=$1",[metaDoc.documentId]);await b.query('COMMIT');
 assert.match((await metaFinish).error.message,/PDF_UPLOAD_CONFLICT/);pass('legacy metadata writer completes while finish waits; fresh revision conflicts without a contract/document deadlock');
 const appendix=async(c,n,doc=null,revision=null,title='Same title')=>(await c.query('SELECT prepare_contract_document_upload($1,$2,$3,$4,$5,$6,$7,$8,$9,false,$10,$11) r',[id(10),id(1),id(100),id(n),doc,revision,'Appendix.pdf',10,'a'.repeat(64),'appendix',title])).rows[0].r;
 const ax=await appendix(a,230),ay=await appendix(b,231);assert.notEqual(ax.targetDocumentId,ay.targetDocumentId);await object(ax.path);await object(ay.path);
 const [ap1,ap2]=await Promise.all([finish(a,230),finish(b,231)]);assert.notEqual(ap1.documentId,ap2.documentId);pass('two independent same-title appendices coexist beside one main PDF');
 const readMain=async()=>(await a.query('SELECT contract_pdf_versions($1,$2,$3) r',[id(10),id(1),id(100)])).rows[0].r;
 const mainBefore=await readMain();assert.equal(mainBefore.versions.length,2);assert.ok(mainBefore.versions.every(v=>v.documentId===published.documentId));pass('legacy history remains main-only with multiple current appendices');
 const ax2=await appendix(a,232,ap1.documentId,0);await object(ax2.path);const ap1New=await finish(a,232);
 assert.deepEqual(await readMain(),mainBefore);assert.equal((await m.query('SELECT revision FROM documents WHERE id=$1',[ap2.documentId])).rows[0].revision,'0');pass('replacing one appendix changes neither main nor other appendix');
 const history=(await a.query('SELECT contract_document_history($1,$2,$3,$4) r',[id(10),id(1),id(100),ap1.documentId])).rows[0].r;assert.equal(history.versions.length,2);assert.equal(history.versions[0].current,true);assert.equal(history.versions[1].current,false);assert.equal(history.documentId,ap1.documentId);pass('each appendix has its own scoped current and old versions');
 const paths=await a.query('SELECT contract_document_version_path($1,$2,$3,$4,$5) good,contract_document_version_path($1,$2,$3,$6,$5) wrong',[id(10),id(1),id(100),ap1.documentId,ap1.versionId,ap2.documentId]);assert.equal(paths.rows[0].good,ax.path);assert.equal(paths.rows[0].wrong,null);pass('version path cannot be borrowed from another appendix');
 await fails(()=>a.query("UPDATE documents SET contract_document_role='main',contract_document_title=NULL,category='cerceve_sozlesme' WHERE id=$1",[ap1.documentId]),'PDF_ROLE_IMMUTABLE');await fails(()=>a.query("UPDATE documents SET contract_document_title='Renamed' WHERE id=$1",[ap1.documentId]),'PDF_ROLE_IMMUTABLE');pass('generic document updates cannot change appendix identity, role or title');
 await fails(()=>prepare(a,233,100,ap1.documentId,1),'PDF_UPLOAD_CONFLICT');await fails(()=>appendix(a,234,published.documentId,1),'PDF_UPLOAD_CONFLICT');await fails(()=>prepare(a,230),'PDF_UPLOAD_COMMAND');pass('main and appendix commands cannot be interchanged or borrow expected document');
 await fails(()=>appendix(a,235,ap1.documentId,0),'PDF_UPLOAD_CONFLICT');assert.deepEqual(await prepare(a,200),published);assert.equal((await prepare(a,203,101)).state,'cancelled');pass('appendix CAS rejects stale revision; old main receipt and cancellation still replay');
 for(let n=240;n<262;n++){const r=await appendix(a,n);await object(r.path);await finish(a,n);}
 const first=(await a.query('SELECT contract_appendices($1,$2,$3) r',[id(10),id(1),id(100)])).rows[0].r;assert.equal(first.documents.length,21);
 const second=(await a.query('SELECT contract_appendices($1,$2,$3,$4) r',[id(10),id(1),id(100),first.documents[19].id])).rows[0].r;assert.equal(second.documents.length,4);assert.equal(new Set([...first.documents.slice(0,20),...second.documents].map(d=>d.id)).size,24);pass('keyset pagination includes every appendix without main or duplicates');
 await asUser(b,11);assert.ok((await b.query('SELECT contract_appendices($1,$2,$3) r',[id(11),id(1),id(100)])).rows[0].r);await asUser(b,12);assert.equal((await b.query('SELECT contract_appendices($1,$2,$3) r',[id(12),id(1),id(100)])).rows[0].r,null);await asUser(b);pass('operations reads appendices; IK does not gain contract read access');
 await a.query('BEGIN ISOLATION LEVEL REPEATABLE READ');await fails(()=>prepare(a,211,107),'PDF_UPLOAD_ISOLATION');await a.query('ROLLBACK');await m.query('DELETE FROM tenant_memberships WHERE user_id=$1',[id(10)]);await fails(()=>get(200),'PDF_UPLOAD_SCOPE');pass('higher isolation and stale tenant claim fail closed');
 console.log(`Contract appendices checks: ${count} passed.`);
}finally{for(const c of clients)await c.end().catch(()=>{});await pg.stop().catch(()=>{});await rm(dir,{recursive:true,force:true});}
