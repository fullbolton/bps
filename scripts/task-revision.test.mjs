import test from 'node:test';
import assert from 'node:assert/strict';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
const {updateTask,selectTaskAssignmentHistory}=await importActualTypeScript(new URL('../src/lib/supabase/tasks.ts',import.meta.url));
const {requireTaskRevision}=await importActualTypeScript(new URL('../src/lib/task-revision.ts',import.meta.url));
function client(answer){const calls=[];const chain={};for(const method of ['from','rpc','eq','select','order','limit'])chain[method]=(...args)=>{calls.push([method,...args]);return chain;};chain.single=async()=>answer;chain.maybeSingle=async()=>answer;chain.then=(yes,no)=>Promise.resolve(answer).then(yes,no);return {chain,calls};}
test('invalid or missing revision fails before any raw request',async()=>{
  for(const v of [null,undefined,-1,NaN,1.1,'0',Number.MAX_SAFE_INTEGER+1]){const {chain,calls}=client({});await assert.rejects(()=>updateTask(chain,'task',{status:'acik'},v));assert.equal(calls.length,0);}
  assert.equal(requireTaskRevision(0),0);
});
test('update filters exact loaded revision and returns new row',async()=>{
  const {chain,calls}=client({data:{id:'task',revision:5},error:null});assert.equal((await updateTask(chain,'task',{status:'acik'},4)).revision,5);
  assert.deepEqual(calls.find(c=>c[0]==='rpc'),['rpc','task_execute_v1',{p_action:'update',p_task_id:'task',p_revision:4,p_input:{status:'acik'}}]);
});
test('zero rows is a conflict, transport/database error stays different',async()=>{
  await assert.rejects(()=>updateTask(client({data:null,error:null}).chain,'task',{},0),e=>e.name==='TaskConflictError');
  await assert.rejects(()=>updateTask(client({data:null,error:{message:'offline'}}).chain,'task',{},0),e=>e.name!=='TaskConflictError'&&e.message.includes('doğrulanamadı'));
});
test('history has an honest twenty-row limit and extra-row indicator',async()=>{
  const {chain,calls}=client({data:Array.from({length:21},(_,revision)=>({revision})),error:null});
  const result=await selectTaskAssignmentHistory(chain,'task');assert.equal(result.rows.length,20);assert.equal(result.hasMore,true);assert.ok(calls.some(c=>c[0]==='limit'&&c[1]===21));
});
