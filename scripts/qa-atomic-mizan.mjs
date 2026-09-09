import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join} from 'node:path';import {pathToFileURL} from 'node:url';import {randomUUID} from 'node:crypto';import assert from 'node:assert/strict';
import {baseline,id} from './fixtures/daily-operations.mjs';
const modulePath=process.env.BPS_EMBEDDED_PG_MODULE;if(!modulePath?.startsWith('/'))throw Error('Absolute BPS_EMBEDDED_PG_MODULE required');
const {default:EmbeddedPostgres}=await import(pathToFileURL(modulePath).href);
const dir=await mkdtemp(join(tmpdir(),'bps-dashboard-'));
const pg=new EmbeddedPostgres({databaseDir:join(dir,'db'),user:'postgres',password:randomUUID(),port:55453,persistent:false,postgresFlags:['-h','127.0.0.1','-k',dir],onLog:()=>{},onError:()=>{}});
let c;let count=0;const pass=s=>{count++;console.log('PASS '+s);};
try{
 await pg.initialise();await pg.start();c=pg.getPgClient('postgres','127.0.0.1');await c.connect();await c.query(baseline);
 await c.query(`CREATE TABLE financial_summaries(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid,company_id uuid,open_receivable numeric,is_overdue boolean,unbilled_amount numeric,last_source text,confirmed_by uuid,confirmed_at timestamptz,created_by uuid,updated_at timestamptz); CREATE UNIQUE INDEX finance_company ON financial_summaries(tenant_id,company_id) WHERE company_id IS NOT NULL;CREATE FUNCTION derive_financial_summaries_from_mizan(uuid) RETURNS int LANGUAGE sql AS 'SELECT 0';`);
 for(const f of ['20260415000100_create_mizan_tables.sql','20260415000200_mizan_match_status_consistency.sql','20260909002600_atomic_mizan.sql'])await c.query(await readFile(new URL('../supabase/migrations/'+f,import.meta.url),'utf8'));
 const as=async(user=10,tenant=1)=>{await c.query('RESET ROLE');await c.query("SELECT set_config('test.user',$1,false),set_config('test.tenant',$2,false)",[id(user),id(tenant)]);await c.query('SET ROLE authenticated');};
 const row={accountCode:'120.01.01.001',accountName:'A',borcTotal:100,alacakTotal:0,borcBakiyesi:100,alacakBakiyesi:0,matchStatus:'matched',matchedCompanyId:id(20)};
 const payload={fileName:'synthetic.xlsx',rows:[row]};
 const run=async(n=100,p=payload,tenant=1)=>(await c.query('SELECT confirm_mizan_atomic($1,$2,$3) id',[id(n),id(tenant),p])).rows[0].id;
 await as();assert.equal(await run(),id(100));assert.equal(await run(),id(100));pass('atomic confirmation and identical retry');
 await assert.rejects(()=>run(100,{...payload,fileName:'different.xlsx'}),/MIZAN_REPLAY_MISMATCH/);pass('changed replay rejected');
 await assert.rejects(()=>run(101,{...payload,rows:[{...row,matchedCompanyId:id(21)}]}),/MIZAN_COMPANY_SCOPE/);assert.equal((await c.query('SELECT count(*) n FROM mizan_uploads WHERE id=$1',[id(101)])).rows[0].n,'0');pass('foreign company rejected with no orphan upload');
 await assert.rejects(()=>run(102,{...payload,rows:[row,row]}),/MIZAN_DUPLICATE_ACCOUNT/);pass('duplicate account cannot double balance');
 for(const value of [null,'100',0.001])await assert.rejects(()=>run(103,{...payload,rows:[{...row,borcBakiyesi:value}]}),/MIZAN_INPUT|MIZAN_AMOUNT/);pass('missing/coerced/subcent money rejected');
 await assert.rejects(()=>c.query("INSERT INTO mizan_uploads(file_name) VALUES('bad')"),/permission denied/);await assert.rejects(()=>c.query('SELECT derive_financial_summaries_from_mizan($1)',[id(100)]),/permission denied/);pass('legacy write and derive bypass closed');
 await as(11);await assert.rejects(()=>run(),/MIZAN_FORBIDDEN/);await as(13,2);await assert.rejects(()=>run(100,payload,2),/MIZAN_SCOPE/);assert.equal((await c.query('SELECT count(*) n FROM mizan_uploads')).rows[0].n,'0');pass('role and tenant boundaries');
 await c.query('RESET ROLE');assert.equal((await c.query('SELECT open_receivable FROM financial_summaries')).rows[0].open_receivable,'100.00');assert.equal((await c.query('SELECT count(*) n FROM mizan_upload_rows')).rows[0].n,'1');pass('one durable balance and one row after retry/failures');
 await c.query("CREATE FUNCTION reject_finance() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic finance failure'; END $$; CREATE TRIGGER fail_finance BEFORE INSERT OR UPDATE ON financial_summaries FOR EACH ROW EXECUTE FUNCTION reject_finance()");
 await as();await assert.rejects(()=>run(104),/synthetic finance failure/);assert.equal((await c.query('SELECT count(*) n FROM mizan_uploads WHERE id=$1',[id(104)])).rows[0].n,'0');pass('downstream failure rolls back header and rows');
 console.log(`Atomic mizan PostgreSQL checks: ${count} passed.`);
}finally{await c?.end();await pg.stop();await rm(dir,{recursive:true,force:true});}
