// Disposable local PostgreSQL chain; never reads production credentials or data.
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {loadFixtureMigrations} from '../module-change-command-20261017/fixture-migrations.mjs';
const server='supabase_db_bps-supabase-acceptance',db=`bps_ops_chain_${process.pid}`;
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const sql=(q,d=db)=>execFileSync('docker',['exec','-i',server,'psql','-X','-qAt','-U','postgres','-d',d,'-v','ON_ERROR_STOP=1'],{input:q,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();
const lit=x=>`'${JSON.stringify(x).replaceAll("'","''")}'::jsonb`;
const claims={sub:id(11),active_tenant_id:id(1)};
const call=q=>sql(`BEGIN;SELECT set_config('request.jwt.claims',${lit(claims)}::text,true);SET LOCAL ROLE authenticated;${q};COMMIT;`).split('\n').at(-1);
const mutate=(n,kind,data)=>JSON.parse(call(`SELECT ops_execute_scoped('${id(11)}','${id(1)}','${id(n)}','${kind}',${lit(data)})`));
const checks=[];let created=false;
function rejected(fn,message,command){
 assert.throws(fn,e=>String(e.stderr).includes(message));
 assert.equal(sql(`SELECT count(*) FROM ops_commands WHERE id='${id(command)}'`),'0','Rejected command left a receipt');
}
try{
 sql(`CREATE DATABASE ${db} TEMPLATE bps_module_chain_20261005`,'postgres');created=true;
 for(const f of loadFixtureMigrations())sql(readFileSync(new URL('../../supabase/migrations/'+f,import.meta.url),'utf8'));
 sql(`INSERT INTO companies(id,tenant_id,name,status) VALUES('${id(8800)}','${id(1)}','Sentetik operasyon kabulü','aktif')`);
 mutate(8801,'location',{companyId:id(8800),name:'Sentetik şube',city:'İstanbul'});
 mutate(8802,'worker',{name:'Sentetik personel',code:'OPS-QA-1',kind:'idp'});
 mutate(8803,'request',{companyId:id(8800),locationId:id(8801),workDate:'2026-01-01',serviceLine:'Güvenlik',position:'Güvenlik',requiredCount:1});
 const payload={requestId:id(8803),workerId:id(8802)};
 const first=mutate(8804,'assign',payload);assert.deepEqual(mutate(8804,'assign',payload),first);
 assert.equal(sql(`SELECT count(*) FROM ops_assignments WHERE request_id='${id(8803)}'`),'1');checks.push('Request/location/worker/assignment through scoped commands; exact replay creates one assignment');
 mutate(8810,'worker',{name:'Sentetik yedek',code:'OPS-QA-2',kind:'idp'});
 rejected(()=>mutate(8811,'assign',{requestId:id(8803),workerId:id(8810)}),'OPS_CAPACITY_FULL',8811);
 assert.equal(sql(`SELECT count(*) FROM ops_assignments WHERE request_id='${id(8803)}' AND removed_at IS NULL`),'1');
 checks.push('Capacity overflow rejected atomically without a command receipt');
 const attendance=JSON.parse(call(`SELECT ops_record_attendance('${id(11)}','${id(1)}','${id(8805)}','${id(8804)}',0,'present')`));assert.equal(attendance.status,'present');checks.push('Attendance declared through guarded command');
 const work=(n,rev,action,data={})=>JSON.parse(call(`SELECT ops_work_record_execute('${id(11)}','${id(1)}','${id(n)}','${id(8804)}',${rev},'${action}',${lit(data)})`));
 assert.equal(work(8806,0,'save',{startTime:'08:00',endTime:'17:00',nextDay:false,breakMinutes:60,note:'Sentetik kabul'}).status,'draft');
 rejected(()=>work(8812,0,'save',{startTime:'08:00',endTime:'17:00',nextDay:false,breakMinutes:60,note:'Eski ekran'}),'WORK_STALE',8812);
 rejected(()=>work(8813,1,'approve'),'WORK_STATE',8813);
 assert.equal(work(8807,1,'submit').status,'submitted');
 checks.push('Stale revision and approve-before-submit rejected without receipts');
 assert.equal(work(8808,2,'approve').status,'approved');
 assert.equal(work(8808,2,'approve').revision,3);
 assert.equal(sql(`SELECT net_minutes FROM ops_work_records WHERE assignment_id='${id(8804)}'`),'480');
 assert.equal(sql(`SELECT count(*) FROM ops_work_record_events WHERE assignment_id='${id(8804)}'`),'3');checks.push('Save → submit → approve yields 480 net minutes; approval replay leaves 3 audit events');
 writeFileSync(new URL('./result.json',import.meta.url),JSON.stringify({source:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),measuredAt:new Date().toISOString(),checks,limits:['SQL chain, not browser acceptance','Manager synthetic actor; no role matrix','Independent arrival confirmation and replacement branch not covered','Historical synthetic template plus manifest migrations; no production data']},null,2)+'\n');
 console.log(`PASS ${checks.length} integrated groups`);
} finally {if(created)sql(`DROP DATABASE ${db} WITH(FORCE)`,'postgres');}
