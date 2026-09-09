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
const dir=await mkdtemp(join(tmpdir(),'bps-pdf-'));
const pg=new EmbeddedPostgres({databaseDir:join(dir,'db'),user:'postgres',password:randomUUID(),port:55445,persistent:false,postgresFlags:['-h','127.0.0.1','-k',dir],onLog:()=>{},onError:()=>{}});
const clients=[];let count=0;const pass=label=>{count++;console.log('PASS '+label);};
try{
 await pg.initialise();await pg.start();
 async function connect(){const c=pg.getPgClient('postgres','127.0.0.1');clients.push(c);await c.connect();await c.query("SET statement_timeout='8s'; SET idle_in_transaction_session_timeout='15s'");return c;}
 const m=await connect(),a=await connect(),b=await connect();await m.query(baseline);
 await m.query(`CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT jsonb_build_object('app_metadata',jsonb_build_object('active_tenant',current_setting('test.tenant',true))) $$;
 CREATE SCHEMA storage; CREATE TABLE storage.objects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),bucket_id text,name text,owner_id text,UNIQUE(bucket_id,name));
 GRANT USAGE ON SCHEMA storage TO authenticated;GRANT SELECT,INSERT,UPDATE,DELETE ON storage.objects TO authenticated;
 ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;CREATE POLICY fixture_storage ON storage.objects TO authenticated USING(true) WITH CHECK(true);`);
 for(const f of ['local-task-prefill.sql','local-contracts.sql','local-documents.sql'])await m.query(await readFile(new URL('./fixtures/'+f,import.meta.url),'utf8'));
 await m.query("UPDATE profiles SET display_name='Actual database name' WHERE id=$1",[id(10)]);
 for(let n=100;n<110;n++)await m.query('INSERT INTO contracts(id,tenant_id,company_id,name) VALUES($1,$2,$3,$4)',[id(n),id(n===108?2:1),id(n===108?21:n===109?22:20),'Contract '+n]);
 const path=n=>`${id(20)}/${id(n)}.pdf`;
 async function object(n){await m.query(`INSERT INTO storage.objects(id,bucket_id,name,owner_id) VALUES($1,'documents',$2,'${id(10)}')`,[id(n),path(n)]);}
 for(let n=200;n<220;n++)await object(n);
 await m.query("INSERT INTO documents(id,tenant_id,company_id,contract_id,name,storage_path,uploaded_by,status) VALUES($1,$2,$3,$4,'Old.pdf',$5,'Old label','tam')",[id(300),id(1),id(20),id(100),path(200)]);
 await m.query(await readFile(new URL('../supabase/migrations/20260909001800_contract_document_versions.sql',import.meta.url),'utf8'));
 async function asUser(c,user=10,tenant=1){await c.query('RESET ROLE');await c.query("SELECT set_config('test.user',$1,false),set_config('test.tenant',$2,false)",[id(user),id(tenant)]);await c.query('SET ROLE authenticated');}
 await asUser(a);await asUser(b);
 const history=async(c=a,user=10,contract=100)=>(await c.query('SELECT contract_pdf_versions($1,$2,$3) r',[id(user),id(1),id(contract)])).rows[0].r;
 const replace=(c,n,rev=0,name='New.pdf')=>c.query('UPDATE documents SET storage_path=$1,name=$2,uploaded_by=$3 WHERE id=$4 AND revision=$5 RETURNING revision',[path(n),name,'Forged client label',id(300),rev]);
 const rejects=(fn,msg)=>assert.rejects(fn,new RegExp(msg));
 let versions=(await history()).versions;assert.equal(versions.length,1);assert.equal(versions[0].origin,'baseline');pass('baseline retains prior reference without claiming verified uploader or bytes');
 assert.equal((await replace(a,201)).rowCount,1);versions=(await history()).versions;assert.equal(versions.length,2);assert.equal(versions[0].current,true);assert.equal(versions[1].current,false);assert.equal(versions[0].actorName,'Actual database name');pass('replace preserves old reference and records new version with DB actor label');
 const oldPath=(await a.query('SELECT contract_pdf_version_path($1,$2,$3) p',[id(10),id(1),versions[1].id])).rows[0].p;assert.equal(oldPath,path(200));pass('old version resolves original path through verified scope');
 assert.equal((await replace(b,202)).rowCount,0);assert.equal((await history()).versions.length,2);pass('stale revision updates zero rows and does not fabricate another version');
 await a.query("UPDATE documents SET validity_date='2027-01-01' WHERE id=$1",[id(300)]);assert.equal((await history()).versions.length,2);pass('metadata-only update advances CAS without duplicating file history');
 await rejects(()=>a.query('UPDATE documents SET contract_id=$1 WHERE id=$2',[id(101),id(300)]),'PDF_CONTEXT_IMMUTABLE');await rejects(()=>a.query('UPDATE documents SET storage_path=NULL WHERE id=$1',[id(300)]),'PDF_OBJECT');pass('record cannot silently lose its contract or file');
 await rejects(()=>a.query('UPDATE contracts SET company_id=$1 WHERE id=$2',[id(22),id(100)]),'PDF_CONTEXT_IMMUTABLE');pass('contract context cannot move while retaining PDF history');
 await rejects(()=>a.query('DELETE FROM documents WHERE id=$1',[id(300)]),'foreign key');await rejects(()=>a.query('DELETE FROM contracts WHERE id=$1',[id(100)]),'PDF_CONTEXT_IMMUTABLE|foreign key');pass('document and contract deletion cannot cascade away version history');
 assert.equal((await a.query('DELETE FROM storage.objects WHERE id=$1',[id(200)])).rowCount,0);assert.equal((await a.query('UPDATE storage.objects SET name=$1 WHERE id=$2',['overwritten.pdf',id(201)])).rowCount,0);await rejects(()=>m.query('DELETE FROM storage.objects WHERE id=$1',[id(200)]),'foreign key');pass('restrictive storage policies deny delete/overwrite and FK retains referenced metadata');
 await rejects(()=>a.query('SELECT * FROM contract_document_versions'),'permission denied');pass('private ledger denies direct reads and writes');
 await asUser(b,11);assert.equal((await history(b,11)).versions.length,2);assert.equal((await replace(b,202,2)).rowCount,0);await asUser(b,12);assert.equal(await history(b,12),null);await asUser(b);pass('operations can read history, cannot replace; IK does not gain contract history access');
 assert.equal(await history(a,10,108),null);await rejects(()=>a.query("INSERT INTO documents(tenant_id,company_id,contract_id,name,storage_path) VALUES($1,$2,$3,'wrong.pdf',$4)",[id(1),id(20),id(108),path(203)]),'PDF_SCOPE');pass('foreign contract context does not leak history or accept same-tenant company disguise');
 await rejects(()=>a.query("INSERT INTO documents(tenant_id,company_id,contract_id,name,storage_path) VALUES($1,$2,$3,'passive.pdf',$4)",[id(1),id(22),id(109),path(203)]),'PDF_PASSIVE');await rejects(()=>replace(a,999,2),'PDF_OBJECT');await rejects(()=>replace(a,200,2),'PDF_OBJECT_REUSED');pass('passive upload, missing object and reattachment of archived file rejected');
 await m.query("ALTER TABLE contract_document_versions ADD CONSTRAINT reject_test_name CHECK(name<>'Reject.pdf')");await rejects(()=>replace(a,203,2,'Reject.pdf'),'reject_test_name');assert.equal((await m.query('SELECT revision FROM documents WHERE id=$1',[id(300)])).rows[0].revision,'2');assert.equal((await history()).versions.length,2);pass('late version failure rolls back document change; external uploaded object is intentionally separate');
 await m.query('UPDATE storage.objects SET owner_id=$1 WHERE id=$2',[id(11),id(207)]);await rejects(()=>replace(a,207,2),'PDF_OBJECT');pass('another uploader object cannot be claimed as this actors new upload');
 const pidA=(await a.query('SELECT pg_backend_pid() pid')).rows[0].pid,pidB=(await b.query('SELECT pg_backend_pid() pid')).rows[0].pid;
 await a.query('BEGIN');await replace(a,204,2);const pending=replace(b,205,2).then(value=>({value}),error=>({error}));let blocked=false;for(let i=0;i<300;i++){if((await m.query('SELECT pg_blocking_pids($1) pids',[pidB])).rows[0].pids.includes(pidA)){blocked=true;break;}await delay(10);}assert.ok(blocked);await a.query('COMMIT');assert.equal((await pending).value.rowCount,0);assert.equal((await history()).versions.length,3);pass('real concurrent same-revision replacements have one winner and retain prior files');
 await a.query('BEGIN ISOLATION LEVEL REPEATABLE READ');await rejects(()=>replace(a,206,3),'PDF_ISOLATION');await a.query('ROLLBACK');pass('higher isolation cannot reuse stale scope guard snapshot');
 await m.query('DELETE FROM tenant_memberships WHERE user_id=$1',[id(10)]);assert.equal(await history(),null);assert.equal((await a.query('SELECT id FROM storage.objects WHERE id=$1',[id(200)])).rowCount,0);pass('stale claimed tenant cannot read old version paths or retained Storage metadata');
 console.log(`Contract PDF checks: ${count} passed.`);
}finally{for(const c of clients)await c.end().catch(()=>{});await pg.stop().catch(()=>{});await rm(dir,{recursive:true,force:true});}
