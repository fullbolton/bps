// Only guarded dedicated local Supabase, synthetic identities and files. Never reads .env.local.
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';
import {validateLocalStatus,acquireLock} from './helpers/acceptance-runner.mjs';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
import {id} from './fixtures/daily-operations.mjs';
const run=(cmd,args,input)=>{try{return execFileSync(cmd,args,{input,encoding:'utf8',stdio:['pipe','pipe','pipe'],timeout:20000});}catch{throw Error(cmd+' local command failed');}};
let release;
try{
 const s=JSON.parse(run('supabase',['status','--workdir','/private/tmp/bps-supabase-acceptance','-o','json']));
 const [db,gateway]=JSON.parse(run('docker',['inspect','supabase_db_bps-supabase-acceptance','supabase_kong_bps-supabase-acceptance']));
 validateLocalStatus(s,readFileSync('/private/tmp/bps-supabase-acceptance/supabase/config.toml','utf8'),db,gateway);
 release=acquireLock();const sql=q=>run('docker',['exec','-i','supabase_db_bps-supabase-acceptance','psql','-U','postgres','-d','postgres','-At','-v','ON_ERROR_STOP=1'],q).trim();
 const mode=process.argv[2];if(!['empty','filled','company-only','clean'].includes(mode))throw Error('Expected empty, filled or clean');
 sql(readFileSync(new URL('./fixtures/local-financial-summary.sql',import.meta.url),'utf8'));
 // Only these two owned synthetic records can be replaced or removed.
 sql("DELETE FROM public.financial_summaries WHERE id IN ('00000000-0000-4000-8000-000000009701','00000000-0000-4000-8000-000000009702')");
 if(mode==='empty')assert.equal(sql('SELECT count(*) FROM public.financial_summaries'),'0');
 if(mode==='filled'||mode==='company-only')sql(`INSERT INTO public.financial_summaries(id,tenant_id,total_open_receivable,invoiced_this_month,total_unbilled,total_overdue,overdue_company_count,salary_costs,fixed_costs) VALUES ('00000000-0000-4000-8000-000000009701','${id(1)}','12.500 TL','8.000 TL','2.500 TL','1.000 TL',1,'3.000 TL','500 TL');
 INSERT INTO public.financial_summaries(id,tenant_id,company_id,open_receivable,unbilled_amount,is_overdue) VALUES ('00000000-0000-4000-8000-000000009702','${id(1)}','${id(20)}','12.500 TL','2.500 TL',true);`);
 if(mode==='company-only')sql("DELETE FROM public.financial_summaries WHERE id='00000000-0000-4000-8000-000000009701'");
 sql("NOTIFY pgrst,'reload schema';");console.log('PASS guarded local financial fixture: '+mode);

}catch(error){console.error('Financial fixture failed: '+error.message);process.exitCode=1;}
finally{release?.();}
