// Disposable local PostgreSQL chain; never reads production credentials or data.
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {capacityRace} from './concurrency.mjs';
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
 // Today's second request exercises live-time confirmation without backdating records.
 const day=sql("SELECT (clock_timestamp() AT TIME ZONE 'Europe/Istanbul')::date");
 const occurred=()=>sql('SELECT clock_timestamp()');
 mutate(8820,'request',{companyId:id(8800),locationId:id(8801),workDate:day,serviceLine:'Güvenlik',position:'Güvenlik',requiredCount:1});
 mutate(8821,'assign',{requestId:id(8820),workerId:id(8802)});
 const start=(n,assignment,rev,action,data)=>JSON.parse(call(`SELECT ops_start_execute('${id(11)}','${id(1)}','${id(n)}','${id(assignment)}',${rev},'${action}',${lit(data)})`));
 start(8822,8821,0,'plan',{time:'08:00',responsibleId:id(11),offsets:[-30,-15]});
 start(8823,8821,1,'call',{occurredAt:occurred(),offset:0,outcome:'cannot_attend'});
 const outreach=()=>JSON.parse(call(`SELECT ops_record_replacement_outreach('${id(11)}','${id(1)}','${id(8824)}','${id(8821)}','${id(8810)}',0,'accepted','Sentetik görüşme')`));
 assert.equal(outreach().outcome,'accepted');assert.equal(outreach().revision,1);
 assert.equal(sql(`SELECT worker_id FROM ops_assignments WHERE request_id='${id(8820)}' AND removed_at IS NULL`),id(8802),'Conversation acceptance must not assign a worker');
 checks.push('Cannot-attend call and accepted replacement conversation do not silently change assignment');
 const replace=()=>JSON.parse(call(`SELECT ops_replace_assignment('${id(11)}','${id(1)}','${id(8825)}','${id(8821)}','${id(8810)}',0)`));
 assert.equal(replace().id,id(8825));assert.equal(replace().id,id(8825));
 assert.equal(sql(`SELECT count(*) FROM ops_assignments WHERE request_id='${id(8820)}' AND removed_at IS NULL`),'1');
 assert.equal(sql(`SELECT revision FROM ops_start_plans WHERE assignment_id='${id(8825)}'`),'1');
 rejected(()=>start(8826,8821,2,'call',{occurredAt:occurred(),offset:0,outcome:'on_way'}),'START_CLOSED',8826);
 checks.push('Replacement replay leaves one active assignment and inherited plan; old assignment rejects calls');
 start(8827,8825,1,'call',{occurredAt:occurred(),offset:0,outcome:'claimed_arrival'});
 assert.equal(sql(`SELECT attendance FROM ops_assignments WHERE id='${id(8825)}'`),'unreported');
 assert.equal(sql(`SELECT confirmed_at IS NULL FROM ops_start_plans WHERE assignment_id='${id(8825)}'`),'t');
 rejected(()=>start(8828,8825,2,'confirm',{occurredAt:occurred(),source:'worker',witness:'Sentetik kişi'}),'START_WITNESS',8828);
 const confirmation={occurredAt:occurred(),source:'branch',witness:'Sentetik şube yetkilisi'};
 start(8829,8825,2,'confirm',confirmation);start(8829,8825,2,'confirm',confirmation);
 assert.equal(sql(`SELECT attendance FROM ops_assignments WHERE id='${id(8825)}'`),'present');
 assert.equal(sql(`SELECT count(*) FROM ops_start_events WHERE assignment_id='${id(8825)}' AND kind='confirm'`),'1');
 assert.equal(sql(`SELECT count(*) FROM ops_work_records WHERE assignment_id='${id(8825)}'`),'0','Arrival confirmation must not approve working hours');
 checks.push('Claimed arrival stays unverified; branch confirmation marks present exactly once without work approval');
 mutate(8840,'request',{companyId:id(8800),locationId:id(8801),workDate:'2026-01-02',serviceLine:'Güvenlik',position:'Güvenlik',requiredCount:1});
 await capacityRace({server,db,sql,id,claims});
 checks.push('Two real transactions contend for last slot: observed lock wait, one committed assignment, loser has no receipt');
 // Exercise actual policy roles, not a client-side role mock.
 const setRole=role=>sql(`UPDATE tenant_memberships SET role='${role}' WHERE user_id='${id(11)}' AND tenant_id='${id(1)}';UPDATE profiles SET role='${role}' WHERE id='${id(11)}';`);
 try{
  for(const [index,role] of ['ik','muhasebe','goruntuleyici'].entries()){
   setRole(role);
   const n=8900+index*10;
   rejected(()=>mutate(n,'request',{companyId:id(8800),locationId:id(8801),workDate:day,serviceLine:'Test',position:'Test',requiredCount:1}),'OPS_FORBIDDEN',n);
   rejected(()=>start(n+1,8825,3,'call',{occurredAt:occurred(),offset:0,outcome:'on_way'}),'START_FORBIDDEN',n+1);
   rejected(()=>work(n+2,3,'reopen',{reason:'Sentetik düzeltme'}),'WORK_FORBIDDEN',n+2);
  }
  setRole('operasyon');
  mutate(8930,'request',{companyId:id(8800),locationId:id(8801),workDate:'2026-01-03',serviceLine:'Test',position:'Test',requiredCount:1});
  mutate(8931,'assign',{requestId:id(8930),workerId:id(8802)});
  rejected(()=>work(8932,3,'reopen',{reason:'Sentetik düzeltme'}),'WORK_FORBIDDEN',8932);
  const opWork=(n,rev,action,data={})=>JSON.parse(call(`SELECT ops_work_record_execute('${id(11)}','${id(1)}','${id(n)}','${id(8931)}',${rev},'${action}',${lit(data)})`));
  call(`SELECT ops_record_attendance('${id(11)}','${id(1)}','${id(8933)}','${id(8931)}',0,'present')`);
  assert.equal(opWork(8934,0,'save',{startTime:'08:00',endTime:'17:00',nextDay:false,breakMinutes:60,note:'Operasyon kaydı'}).status,'draft');
  assert.equal(opWork(8935,1,'submit').status,'submitted');
  rejected(()=>opWork(8936,2,'approve'),'WORK_FORBIDDEN',8936);
  checks.push('HR/accounting/viewer cannot mutate staffing; operations creates/submits work but cannot approve or reopen');
 } finally {setRole('yonetici');}
 writeFileSync(new URL('./result.json',import.meta.url),JSON.stringify({source:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),measuredAt:new Date().toISOString(),checks,limits:['SQL chain, not browser acceptance','Role matrix uses one synthetic actor with sequential membership/profile role changes; not multi-account UI','Confirmation/replacement and last-slot concurrency covered in SQL; UI remains open','Historical synthetic template plus manifest migrations; no production data']},null,2)+'\n');
 console.log(`PASS ${checks.length} integrated groups`);
} finally {if(created)sql(`DROP DATABASE ${db} WITH(FORCE)`,'postgres');}
