import test from 'node:test';
import assert from 'node:assert/strict';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
const {claimUnassignedTask}=await importActualTypeScript(new URL('../src/lib/supabase/tasks.ts',import.meta.url));
function client(reply){const calls=[],q={};for(const m of ['rpc'])q[m]=(...args)=>{calls.push([m,...args]);return q;};q.single=async()=>reply;return {q,calls};}
test('claim sends expected scope and revision to the atomic gateway; display names are not trusted',async()=>{
 const {q,calls}=client({data:{id:'task'},error:null});await claimUnassignedTask(q,'task','tenant',4,'actor','Name');
 assert.deepEqual(calls,[['rpc','task_execute_v1',{p_action:'claim',p_task_id:'task',p_expected_tenant:'tenant',p_expected_actor:'actor',p_revision:4}]]);
});
test('losing claim, inaccessible record and transport failure cannot report success',async()=>{
 await assert.rejects(claimUnassignedTask(client({data:null,error:null}).q,'task','tenant',1,'actor','Name'),e=>e.name==='TaskConflictError');
 await assert.rejects(claimUnassignedTask(client({data:null,error:{message:'offline'}}).q,'task','tenant',1,'actor','Name'));
 await assert.rejects(claimUnassignedTask(client({}).q,'task','tenant',-1,'actor','Name'));
});

const services=await importActualTypeScript(new URL('../src/lib/services/tasks.ts',import.meta.url));
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
test('claim and quick completion use one command rather than separate mutable role and tenant snapshots',async()=>{
 for(const action of ['claimTask','completeOperationTask']){
  const {q,calls}=client({data:{id:id(1)},error:null});
  await services[action](q,id(1),0,id(2),id(3));
  assert.equal(calls.length,1);assert.equal(calls[0][1],'task_execute_v1');
  assert.equal(calls[0][2].p_expected_actor,id(2));assert.equal(calls[0][2].p_expected_tenant,id(3));
 }
});
test('bad scope is rejected before a claim/completion command is sent',async()=>{
 for(const action of ['claimTask','completeOperationTask']){
  const {q,calls}=client({});await assert.rejects(services[action](q,id(1),0,'invalid',id(3)));assert.equal(calls.length,0);
 }
});
test('module disabled, missing configuration and transport failure remain distinct from a lost claim',async()=>{
 for(const [code,fragment] of [['BM001','kapalı'],['55000','ayarları'],['BT403','erişiminiz'],['XX000','doğrulanamadı']]){
  const {q}=client({data:null,error:{code,message:'private server detail'}});
  await assert.rejects(claimUnassignedTask(q,id(1),id(3),0,id(2)),e=>e.name!=='TaskConflictError'&&e.message.includes(fragment)&&!e.message.includes('private'));
 }
});
