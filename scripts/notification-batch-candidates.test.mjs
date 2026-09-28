import test from 'node:test';
import assert from 'node:assert/strict';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
const m=await importActualTypeScript(new URL('../src/lib/email/batch-candidates.ts',import.meta.url));
const cases=[['tasks',m.readTaskNotificationCandidates,[['in','status',['acik','devam_ediyor','gecikti']]],undefined],['documents',m.readDocumentNotificationCandidates,[['not','validity_date','is',null],['lte','validity_date','2026-10-15']],'2026-10-15'],['appointments',m.readAppointmentNotificationCandidates,[['eq','status','planlandi'],['eq','meeting_date','2026-09-16']],'2026-09-16']];
function client(table,filters,page){return {from(name){assert.equal(name,table);return {select(fields,opts){assert.equal(opts.count,'exact');assert.ok(!fields.includes('*'));const calls=[];const q={in(...a){calls.push(['in',...a]);return q;},not(...a){calls.push(['not',...a]);return q;},lte(...a){calls.push(['lte',...a]);return q;},eq(...a){calls.push(['eq',...a]);return q;},order(key){assert.equal(key,'id');return q;},range(from,to){assert.deepEqual(calls,filters);assert.equal(to-from,499);return page(from);}};return q;}};}};}
for(const [table,read,filters,arg]of cases)test(`${table} candidate pages keep filters and never expose a partial source list`,async()=>{
 const data=Array.from({length:1001},(_,i)=>({id:'id'+i})),offsets=[];
 const rows=await read(client(table,filters,async offset=>{offsets.push(offset);return {data:data.slice(offset,offset+400),count:1001,error:null};}),arg);
 assert.equal(rows.length,1001);assert.equal(rows.at(-1).id,'id1000');assert.deepEqual(offsets,[0,400,800]);
 await assert.rejects(read(client(table,filters,async offset=>offset?{data:[],count:1001,error:null}:{data:data.slice(0,400),count:1001,error:null}),arg));
 assert.deepEqual(await read(client(table,filters,async()=>({data:[],count:0,error:null})),arg),[]);
});
