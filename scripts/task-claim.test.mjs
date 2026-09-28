import test from 'node:test';
import assert from 'node:assert/strict';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
const {claimUnassignedTask}=await importActualTypeScript(new URL('../src/lib/supabase/tasks.ts',import.meta.url));
function client(reply){const calls=[],q={};for(const m of ['from','update','eq','is','in','select'])q[m]=(...args)=>{calls.push([m,...args]);return q;};q.maybeSingle=async()=>reply;return {q,calls};}
test('claim predicates atomically require same tenant/revision, no identity or legacy name, and open status',async()=>{
 const {q,calls}=client({data:{id:'task'},error:null});await claimUnassignedTask(q,'task','tenant',4,'actor','Name');
 assert.deepEqual(calls.filter(c=>['eq','is','in'].includes(c[0])),[['eq','id','task'],['eq','tenant_id','tenant'],['eq','revision',4],['is','assigned_to_user_id',null],['is','assigned_to',null],['in','status',['acik','devam_ediyor','gecikti']]]);
 assert.deepEqual(calls.find(c=>c[0]==='update'),['update',{assigned_to_user_id:'actor',assigned_to:'Name'}]);
});
test('losing claim, inaccessible record and transport failure cannot report success',async()=>{
 await assert.rejects(claimUnassignedTask(client({data:null,error:null}).q,'task','tenant',1,'actor','Name'),e=>e.name==='TaskConflictError');
 await assert.rejects(claimUnassignedTask(client({data:null,error:{message:'offline'}}).q,'task','tenant',1,'actor','Name'));
 await assert.rejects(claimUnassignedTask(client({}).q,'task','tenant',-1,'actor','Name'));
});
