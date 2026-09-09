// Dedicated local synthetic Auth/API acceptance. Additive setup, no production env.
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';
import {validateLocalStatus,acquireLock} from './helpers/acceptance-runner.mjs';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
import {id} from './fixtures/daily-operations.mjs';
const run=(cmd,args,input)=>execFileSync(cmd,args,{input,encoding:'utf8',stdio:['pipe','pipe','pipe'],timeout:20000});
const s=JSON.parse(run('supabase',['status','--workdir','/private/tmp/bps-supabase-acceptance','-o','json']));
const [db,gateway]=JSON.parse(run('docker',['inspect','supabase_db_bps-supabase-acceptance','supabase_kong_bps-supabase-acceptance']));
validateLocalStatus(s,readFileSync('/private/tmp/bps-supabase-acceptance/supabase/config.toml','utf8'),db,gateway);
const sql=q=>run('docker',['exec','-i','supabase_db_bps-supabase-acceptance','psql','-U','postgres','-d','postgres','-At','-v','ON_ERROR_STOP=1'],q).trim();
const release=acquireLock();
try {
  assert.equal(sql("SELECT to_regclass('public.task_assignment_history') IS NOT NULL"),'t');
  sql(readFileSync(new URL('./fixtures/local-appointments.sql',import.meta.url),'utf8'));
  const migration=readFileSync(new URL('../supabase/migrations/20260909001400_appointment_completion.sql',import.meta.url),'utf8');
  if(sql("SELECT to_regclass('public.appointment_completion_receipts') IS NULL")==='t')sql(migration);
  else {
    // Local-only fixture iteration must test today's function, not an earlier draft.
    const start=migration.indexOf('CREATE FUNCTION public.complete_appointment_scoped(');
    const end=migration.indexOf('REVOKE ALL ON FUNCTION public.complete_appointment_scoped(',start);
    assert.ok(start>=0&&end>start);
    sql(migration.slice(start,end).replace('CREATE FUNCTION','CREATE OR REPLACE FUNCTION'));
  }
  assert.equal(sql("SELECT to_regprocedure('public.complete_appointment_scoped(uuid,uuid,uuid,text,text,boolean)') IS NOT NULL"),'t');sql("NOTIFY pgrst,'reload schema';");
  const options={auth:{persistSession:false,autoRefreshToken:false}};
  const admin=createClient(s.API_URL,s.SERVICE_ROLE_KEY,options),password=randomUUID()+'aA1!',email=`appointment-${randomUUID()}@example.test`;
  const created=await admin.auth.admin.createUser({email,password,email_confirm:true,app_metadata:{active_tenant:id(1)}});assert.ifError(created.error);
  const uid=created.data.user.id;assert.match(uid,/^[0-9a-f-]{36}$/);
  sql(`INSERT INTO profiles(id,role,display_name) VALUES('${uid}','yonetici','Randevu kabul yöneticisi'); INSERT INTO tenant_memberships VALUES('${uid}','${id(1)}');`);
  let drop=false,dropped=0;
  const c=createClient(s.API_URL,s.ANON_KEY,{...options,global:{fetch:async(input,init)=>{
    const response=await fetch(input,init);
    const url=typeof input==='string'?input:input.url??String(input);
    if(drop&&new URL(url).pathname==='/rest/v1/rpc/complete_appointment_scoped'){
      assert.equal(response.ok,true);await response.arrayBuffer();drop=false;dropped++;throw new TypeError('Test response loss after commit');
    }
    return response;
  }}});
  assert.ifError((await c.auth.signInWithPassword({email,password})).error);
  let ready=false;for(let n=0;n<20;n++){const r=await c.from('appointments').select('id').limit(1);if(!r.error){ready=true;break;}await new Promise(resolve=>setTimeout(resolve,200));}assert.ok(ready);
  const svc=await importActualTypeScript(new URL('../src/lib/services/appointments.ts',import.meta.url));
  const taskSvc=await importActualTypeScript(new URL('../src/lib/services/tasks.ts',import.meta.url));
  let count=0;const pass=label=>{count++;console.log('PASS '+label);};
  const appointment=await svc.createAppointment(c,{legacyCompanyId:id(20),meetingDate:'2026-09-09',attendee:'Yerel randevu kabulü'},{tenantId:id(1)});
  pass('existing appointment creation works on explicit local fixture');
  const payload={result:'Yerel sonuç',nextAction:'Yerel takip görevi',createTask:true},scope={actorId:uid,tenantId:id(1)};
  drop=true;await assert.rejects(()=>svc.completeAppointment(c,appointment.id,payload,scope),e=>e.message.includes('Aynı içerikle'));
  assert.equal(dropped,1);assert.equal(sql(`SELECT status FROM appointments WHERE id='${appointment.id}'`),'tamamlandi');assert.equal(sql(`SELECT count(*) FROM tasks WHERE appointment_id='${appointment.id}'`),'1');pass('lost successful response still commits appointment and one task');
  const replay=await svc.completeAppointment(c,appointment.id,payload,scope);assert.ok(replay.taskId);assert.equal(sql(`SELECT count(*) FROM tasks WHERE appointment_id='${appointment.id}'`),'1');pass('same input retries the durable result without a duplicate');
  assert.equal((await taskSvc.listTaskAssignmentHistory(c,replay.taskId)).rows[0].kind,'created');pass('followup task uses existing revision/history trigger');
  await assert.rejects(()=>svc.completeAppointment(c,appointment.id,{...payload,nextAction:'Changed'},scope),e=>e.message.includes('farklı içerikle'));pass('changed payload cannot reuse completion');
  await assert.rejects(()=>svc.completeAppointment(c,appointment.id,payload,{...scope,actorId:randomUUID()}),e=>e.message.includes('Hesap'));pass('RPC rejects mismatched actor');
  assert.ok((await c.from('appointment_completion_receipts').select('*')).error);pass('client cannot read private completion receipt table');
  const passiveCompany=randomUUID(),passiveAppointment=randomUUID();
  sql(`INSERT INTO companies(id,tenant_id,name,status) VALUES('${passiveCompany}','${id(1)}','Yerel pasif randevu firması','pasif'); INSERT INTO appointments(id,tenant_id,company_id,meeting_date) VALUES('${passiveAppointment}','${id(1)}','${passiveCompany}','2026-09-09');`);
  const skipped=await svc.completeAppointment(c,passiveAppointment,payload,scope);assert.equal(skipped.taskId,null);assert.match(skipped.taskSkippedReason,/pasif/);pass('passive completion returns explicit task skip through real API');
  sql(`UPDATE profiles SET role='ik' WHERE id='${uid}';`);await assert.rejects(()=>svc.completeAppointment(c,appointment.id,payload,scope),e=>e.message.includes('yetkiniz yok'));sql(`UPDATE profiles SET role='yonetici' WHERE id='${uid}';`);pass('fresh role revocation is enforced even on retry');
  console.log(`Local appointment checks: ${count} passed.`);
} finally {release();}
