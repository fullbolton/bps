import test from 'node:test';
import assert from 'node:assert/strict';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
const m=await importActualTypeScript(new URL('../src/lib/email/batch-candidates.ts',import.meta.url));
const cases=[['tasks',m.readTaskNotificationCandidates,[['in','status',['acik','devam_ediyor','gecikti']]],undefined],['documents',m.readDocumentNotificationCandidates,[['not','validity_date','is',null],['lte','validity_date','2026-10-15']],'2026-10-15'],['appointments',m.readAppointmentNotificationCandidates,[['eq','status','planlandi'],['eq','meeting_date','2026-09-16']],'2026-09-16']];
function client(table,filters,page){return {rpc(name,args,opts){assert.equal(name,'task_notification_candidates_v1');assert.deepEqual(args,{});return this.from('tasks').select('id',opts).in('status',['acik','devam_ediyor','gecikti']);},from(name){assert.equal(name,table);return {select(fields,opts){assert.equal(opts.count,'exact');assert.ok(!fields.includes('*'));const calls=[];const q={in(...a){calls.push(['in',...a]);return q;},not(...a){calls.push(['not',...a]);return q;},lte(...a){calls.push(['lte',...a]);return q;},eq(...a){calls.push(['eq',...a]);return q;},order(key){assert.equal(key,'id');return q;},range(from,to){assert.deepEqual(calls,filters);assert.equal(to-from,499);return page(from);}};return q;}};}};}
for(const [table,read,filters,arg]of cases)test(`${table} candidate pages keep filters and never expose a partial source list`,async()=>{
 const data=Array.from({length:1001},(_,i)=>({id:'id'+i})),offsets=[];
 const rows=await read(client(table,filters,async offset=>{offsets.push(offset);return {data:data.slice(offset,offset+400),count:1001,error:null};}),arg);
 assert.equal(rows.length,1001);assert.equal(rows.at(-1).id,'id1000');assert.deepEqual(offsets,[0,400,800]);
 await assert.rejects(read(client(table,filters,async offset=>offset?{data:[],count:1001,error:null}:{data:data.slice(0,400),count:1001,error:null}),arg));
 assert.deepEqual(await read(client(table,filters,async()=>({data:[],count:0,error:null})),arg),[]);
});

const {enabledTaskTenants}=await importActualTypeScript(new URL('../src/lib/email/task-module-access.ts',import.meta.url));
test('task module snapshots require a complete distinct boolean response and propagate transport failure',async()=>{
 const rpc=reply=>({rpc:async(name,args)=>{assert.equal(name,'task_notification_modules_v1');assert.deepEqual(args.p_tenant_ids,['A','B']);return reply;}});
 assert.deepEqual([...await enabledTaskTenants(rpc({data:[{tenant_id:'A',enabled:true},{tenant_id:'B',enabled:false}],error:null}),['A','B','A'])],['A']);
 for(const data of [null,[],[{tenant_id:'A',enabled:true}],[{tenant_id:'A',enabled:true},{tenant_id:'A',enabled:true}],[{tenant_id:'A',enabled:'true'},{tenant_id:'B',enabled:false}],[{tenant_id:'A',enabled:true},{tenant_id:'C',enabled:true}],[null,null]]){
  await assert.rejects(enabledTaskTenants(rpc({data,error:null}),['A','B']));
 }
 await assert.rejects(enabledTaskTenants(rpc({data:null,error:{code:'55000'}}),['A','B']));
 await assert.rejects(enabledTaskTenants({rpc:async()=>{throw Error('network');}},['A']));
});
test('task module snapshot chunks 501 distinct tenants without truncation',async()=>{
 const ids=Array.from({length:501},(_,i)=>String(i)),sizes=[];
 const enabled=await enabledTaskTenants({rpc:async(_,args)=>{sizes.push(args.p_tenant_ids.length);return {data:args.p_tenant_ids.map(tenant_id=>({tenant_id,enabled:true})),error:null};}},ids);
 assert.deepEqual(sizes,[500,1]);assert.equal(enabled.size,501);
});
