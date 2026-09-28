import test from 'node:test';
import assert from 'node:assert/strict';
import { importActualTypeScript } from './helpers/import-typescript.mjs';
const { createTask } = await importActualTypeScript(new URL('../src/lib/services/tasks.ts', import.meta.url));
const { createAppointment } = await importActualTypeScript(new URL('../src/lib/services/appointments.ts', import.meta.url));
const company = {id:'company-a',tenant_id:'tenant-a'};
function client(reply, companyRow=company) {
  const writes=[],reads=[];
  return {writes,reads,auth:{getUser:async()=>({data:{user:{id:'actor'}},error:null})},from(table){
    const conditions=[];let payload;
    const q={select(){return q;},eq(...args){conditions.push(args);return q;},insert(value){payload=value;writes.push([table,value]);return q;},
      async maybeSingle(){reads.push([table,conditions]);return table==='companies'?{data:companyRow,error:null}:reply;},
      async single(){return {data:{id:'new',...payload},error:null};}};
    return q;
  }};
}
const task=(c)=>createTask(c,{legacyCompanyId:'a',title:'Test',contractId:'linked'}, {tenantId:'tenant-a'});
const appointment=(c)=>createAppointment(c,{legacyCompanyId:'a',meetingDate:'2026-09-15',contractId:'linked'}, {tenantId:'tenant-a'});
for(const [label,create] of [['task',task],['appointment',appointment]]) {
 test(`${label} rejects wrong company, tenant, invisible relation and read failure before insert`,async()=>{
  for(const reply of [{data:null,error:null},{data:{id:'linked',company_id:'company-b',tenant_id:'tenant-a'},error:null},{data:{id:'linked',company_id:'company-a',tenant_id:'tenant-b'},error:null},{data:null,error:{message:'offline'}}]){
   const c=client(reply);await assert.rejects(create(c));assert.equal(c.writes.length,0);
  }
 });
 test(`${label} accepts same company/tenant relation and queries explicit scope`,async()=>{
  const c=client({data:{id:'linked',company_id:'company-a',tenant_id:'tenant-a'},error:null});
  await create(c);assert.equal(c.writes.length,1);assert.equal(c.writes[0][1].contract_id,'linked');
  assert.deepEqual(c.reads.find(([table])=>table==='contracts')[1],[['id','linked'],['company_id','company-a'],['tenant_id','tenant-a']]);
 });
 test(`${label} rejects company belonging to another tenant`,async()=>{
  const c=client({}, {...company,tenant_id:'tenant-b'});await assert.rejects(create(c));assert.equal(c.writes.length,0);
 });
}
test('task appointment relation is independently validated before insert',async()=>{
 const c=client({data:null,error:null});
 await assert.rejects(createTask(c,{legacyCompanyId:'a',title:'Test',appointmentId:'linked'},{tenantId:'tenant-a'}));
 assert.equal(c.writes.length,0);assert.equal(c.reads.at(-1)[0],'appointments');
});
test('no relation requires no extra relation reads and preserves nullable IDs',async()=>{
 for(const kind of ['task','appointment']){
  const c=client({});
  await (kind==='task'?createTask(c,{legacyCompanyId:'a',title:'Test'},{tenantId:'tenant-a'}):createAppointment(c,{legacyCompanyId:'a',meetingDate:'2026-09-15'},{tenantId:'tenant-a'}));
  assert.equal(c.reads.length,1);assert.equal(c.writes[0][1].contract_id,null);
 }
});
