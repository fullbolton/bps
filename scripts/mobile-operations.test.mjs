import test from 'node:test';
import assert from 'node:assert/strict';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
const {operationDay,mobileTaskMatches,orderMobileTasks,taskDueLabel,unassignedTask}=await importActualTypeScript(new URL('../src/lib/mobile-operations.ts',import.meta.url));
const {completeScopedTask}=await importActualTypeScript(new URL('../src/lib/supabase/tasks.ts',import.meta.url));
const task=(extra={})=>({id:'a',status:'acik',due_date:'2026-09-14',assigned_to_user_id:null,assigned_to:null,...extra});
test('operation day rolls over at Istanbul midnight regardless of device timezone',()=>{
 assert.equal(operationDay(new Date('2026-09-13T20:59:59Z')),'2026-09-13');
 assert.equal(operationDay(new Date('2026-09-13T21:00:00Z')),'2026-09-14');
});
test('quick views distinguish current owner, truly unassigned, and closed work',()=>{
 const matches=(t,v,actor='me')=>mobileTaskMatches(t,v,actor,'2026-09-14');
 assert.equal(matches(task(),'mine',null),false);
 assert.equal(matches(task({assigned_to_user_id:'me'}),'mine'),true);
 assert.equal(matches(task({assigned_to_user_id:'other'}),'mine'),false);
 assert.equal(matches(task(),'unassigned'),true);
 for(const assigned_to of ['Legacy name',''])assert.equal(unassignedTask(task({assigned_to})),false);
 for(const status of ['tamamlandi','iptal']){
  for(const v of ['open','today','mine','unassigned'])assert.equal(matches(task({status,assigned_to_user_id:'me'}),v),false);
  assert.equal(matches(task({status}),'all'),true);
 }
 assert.equal(matches(task({due_date:null}),'today'),false);
 assert.equal(matches(task({due_date:'2026-09-14T08:00:00'}),'today'),true);
});
test('active tasks sort by due day with stable ties without mutating input',()=>{
 const rows=[task({id:'done',status:'tamamlandi',due_date:'2026-01-01'}),task({id:'none',due_date:null}),task({id:'b'}),task({id:'a'}),task({id:'late',due_date:'2026-09-13'})];
 const original=structuredClone(rows);
 assert.deepEqual(orderMobileTasks(rows).map(r=>r.id),['late','a','b','none','done']);assert.deepEqual(rows,original);
 assert.equal(taskDueLabel(task(),'2026-09-14'),'Bugün');
 assert.equal(taskDueLabel(task({status:'tamamlandi'}),'2026-09-15'),'Bitiş: 14.09.2026');
 assert.equal(taskDueLabel(task({due_date:null}),'2026-09-15'),'Tarih belirlenmedi');
});
function mock(reply){const calls=[],q={};for(const m of ['rpc'])q[m]=(...args)=>{calls.push([m,...args]);return q;};q.single=async()=>reply;return {calls,q};}
test('completion sends scope and revision to the gateway; server resolves actual privileges',async()=>{
 const {calls,q}=mock({data:task(),error:null});await completeScopedTask(q,'task','tenant',4,'actor');
 assert.deepEqual(calls,[['rpc','task_execute_v1',{p_action:'complete',p_task_id:'task',p_expected_tenant:'tenant',p_revision:4,p_expected_actor:'actor'}]]);
 const manager=mock({data:task(),error:null});await completeScopedTask(manager.q,'task','tenant',4,null);
 assert.equal(manager.calls[0][2].p_expected_actor,undefined); // The database still verifies the actual role.
});
test('lost race, inaccessible task, transport error and invalid revision never succeed',async()=>{
 await assert.rejects(completeScopedTask(mock({data:null,error:null}).q,'a','t',1,'me'),e=>e.name==='TaskConflictError');
 await assert.rejects(completeScopedTask(mock({data:null,error:{message:'offline'}}).q,'a','t',1,'me'),/doğrulanamadı/);
 const m=mock({});await assert.rejects(completeScopedTask(m.q,'a','t',-1,'me'));assert.equal(m.calls.length,0);
});

const {taskActionPermissions}=await importActualTypeScript(new URL('../src/lib/mobile-operations.ts',import.meta.url));
test('overdue view derives lateness from date and excludes completed, future and undated tasks',()=>{
 for(const status of ['acik','devam_ediyor','gecikti'])assert.equal(mobileTaskMatches(task({status}),'overdue','me','2026-09-15'),true);
 for(const extra of [{status:'tamamlandi'},{status:'iptal'},{due_date:null},{due_date:'2026-09-15'},{due_date:'2026-09-16'}])assert.equal(mobileTaskMatches(task(extra),'overdue','me','2026-09-15'),false);
});
test('desktop and mobile action availability preserves ownership and legacy assignee boundaries',()=>{
 assert.deepEqual(taskActionPermissions(task(),'yonetici','me'),{claim:true,complete:true});
 assert.deepEqual(taskActionPermissions(task(),'operasyon','me'),{claim:true,complete:false});
 assert.deepEqual(taskActionPermissions(task({assigned_to:'Legacy'}),'operasyon','me'),{claim:false,complete:false});
 assert.deepEqual(taskActionPermissions(task({assigned_to_user_id:'me'}),'ik','me'),{claim:false,complete:true});
 for(const role of ['partner','muhasebe','goruntuleyici'])assert.deepEqual(taskActionPermissions(task({assigned_to_user_id:'me'}),role,'me'),{claim:false,complete:false});
 assert.equal(taskActionPermissions(task({assigned_to_user_id:'other'}),'operasyon','me').complete,false);
 assert.deepEqual(taskActionPermissions(task({status:'tamamlandi'}),'yonetici','me'),{claim:false,complete:false});
});
