import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {importActualTypeScript} from './helpers/import-typescript.mjs';

// Real batch, readers, identity filtering, template and stamp code. Only the
// database and email transport are synthetic. No environment/key/network use.
const sourceUrl=new URL('../src/lib/email/notification-batches.ts',import.meta.url);
const compiled=ts.transpileModule(readFileSync(sourceUrl,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
const modules=new Map();
for(const [,spec] of compiled.matchAll(/require\("([^"]+)"\)/g)){
 if(spec.endsWith('/resend-transport'))continue;
 const url=spec.startsWith('@/')?new URL('../src/'+spec.slice(2)+'.ts',import.meta.url):new URL(spec+'.ts',sourceUrl);
 modules.set(spec,await importActualTypeScript(url));
}
function batch(sent,multi=false){const exports={};vm.runInNewContext(compiled,{exports,require:spec=>spec.endsWith('/resend-transport')?{sendEmail:async input=>{sent.push(input);return {ok:true,id:'synthetic'};}}:modules.get(spec),Date,Map,Set,process:{env:{NEXT_PUBLIC_BPS_MULTI_WORKSPACE_ENABLED:String(multi)}}});return exports.runNotificationBatch;}
function fixture({failTable=null,missingStamp=false,tasks=[],appointments=[],companies=[],failOwners=false,moduleStates={A:true,B:true},moduleFailure=false,contractStates={A:true,B:true},afterStamp=null}={}){
 const documents=Array.from({length:601},(_,i)=>({id:'d'+String(i).padStart(4,'0'),name:'A-DOC-'+i,validity_date:'2026-09-20',tenant_id:'A'}));
 documents.push({id:'z-document',name:'B-PRIVATE-DOC',validity_date:'2026-09-20',tenant_id:'B'});
 const profiles=[{id:'z-alice',email:'alice@example.invalid',display_name:'Alice',role:'yonetici'},{id:'z-bob',email:'bob@example.invalid',display_name:'Bob',role:'ik'}];
 const memberships=Array.from({length:601},(_,i)=>({tenant_id:'A',user_id:'dummy'+String(i).padStart(4,'0')}));
 memberships.push({tenant_id:'A',user_id:'z-alice'},{tenant_id:'B',user_id:'z-bob'});
 const tables={documents,profiles,tasks,appointments,companies,tenant_memberships:memberships},stamps=[],ranges=[];
 const client={rpc(name,args,opts){
  if(name==='document_notification_candidates_v1')return this.from('documents').select('id',opts).not('validity_date','is',null).lte('validity_date',args.p_upper).in('tenant_id',Object.keys(moduleStates).filter(k=>moduleStates[k]===true));
  if(name==='appointment_notification_candidates_v1')return this.from('appointments').select('id',opts).eq('status','planlandi').eq('meeting_date',args.p_target).in('tenant_id',Object.keys(moduleStates).filter(k=>moduleStates[k]===true));
  if(name==='document_notification_state_v1')return Promise.resolve(moduleFailure?{data:null,error:{code:'55000'}}:{data:args.p_ids.map((id,i)=>{const doc=documents.find(d=>d.id===id&&d.tenant_id===args.p_tenant_ids[i]);return {id,tenant_id:args.p_tenant_ids[i],enabled:moduleStates[args.p_tenant_ids[i]]===undefined?null:!!doc&&moduleStates[doc.tenant_id]&&(!doc.contract_id||contractStates[doc.tenant_id])};}),error:null});
  if(name==='task_notification_candidates_v1')return this.from('tasks').select('id',opts).in('status',['acik','devam_ediyor','gecikti']).in('tenant_id',Object.keys(moduleStates).filter(k=>moduleStates[k]===true));
  if(name==='notification_company_names_v1')return Promise.resolve({data:companies.filter(c=>args.p_company_ids.includes(c.id)).map(c=>({...c,tenant_id:c.tenant_id??'A'})),error:null});
  assert.ok(['task_notification_modules_v1','customer_notification_modules_v1'].includes(name));
  return Promise.resolve(moduleFailure?{data:null,error:{code:'55000'}}:{data:args.p_tenant_ids.map(tenant_id=>({tenant_id,enabled:moduleStates[tenant_id]})),error:null});
 },from(table){let filters=[],orders=[],payload;
  const q={select(_fields,opts){if(table!=='notification_log')assert.equal(opts.count,'exact');return q;},eq(k,value){filters.push(r=>r[k]===value);return q;},in(k,values){filters.push(r=>values.includes(r[k]));return q;},not(k,_op,v){filters.push(r=>r[k]!==v);return q;},lte(k,v){filters.push(r=>r[k]<=v);return q;},order(k){orders.push(k);return q;},range:async(from,to)=>{
   ranges.push([table,from]);assert.equal(to-from,499);
   if(table===failTable&&from>0)return {data:null,count:null,error:{code:'42501'}};
   const all=tables[table].filter(r=>filters.every(f=>f(r))).sort((a,b)=>{for(const k of orders){const n=a[k].localeCompare(b[k]);if(n)return n;}return 0;});
   return {data:all.slice(from,from+200),count:all.length,error:null};
  },delete(){payload='delete';return q;},then(resolve,reject){if(table==='notification_log'&&payload==='delete')return Promise.resolve({data:null,error:null}).then(resolve,reject);const data=tables[table].filter(r=>filters.every(f=>f(r)));return Promise.resolve(failOwners?{data:null,count:null,error:{code:'42501'}}:{data,count:data.length,error:null}).then(resolve,reject);},insert(value){assert.equal(table,'notification_log');payload=value;return q;},maybeSingle:async()=>{stamps.push(payload);afterStamp?.(moduleStates);return {data:missingStamp?null:{kind:payload.kind},error:null};}};
  return q;
 }};
 return {client,stamps,ranges,tables};
}
const config={fromAddress:'synthetic@example.invalid',appUrl:'https://example.invalid'};
test('document batch reaches last source/membership rows and keeps tenant contents out of the other email',async()=>{
 const sent=[],f=fixture();const result=await batch(sent)(f.client,'document_expiry',new Date('2026-09-15T09:00:00Z'),config);
 assert.equal(result.itemsFound,602);assert.equal(result.mailsSent,2);assert.equal(result.errors.length,0);assert.equal(f.stamps.length,602);
 const alice=sent.find(m=>m.to==='alice@example.invalid'),bob=sent.find(m=>m.to==='bob@example.invalid');
 assert.match(alice.text,/A-DOC-600/);assert.doesNotMatch(alice.text,/B-PRIVATE-DOC/);assert.match(bob.text,/B-PRIVATE-DOC/);assert.doesNotMatch(bob.text,/A-DOC-/);
 assert.ok(f.ranges.some(([t,o])=>t==='documents'&&o===600));assert.ok(f.ranges.some(([t,o])=>t==='tenant_memberships'&&o===600));
});
for(const failTable of ['documents','tenant_memberships'])test(`late ${failTable} error produces no sends or reservation writes`,async()=>{
 const sent=[],f=fixture({failTable});const result=await batch(sent)(f.client,'document_expiry',new Date('2026-09-15T09:00:00Z'),config);
 assert.equal(sent.length,0);assert.equal(f.stamps.length,0);assert.ok(result.errors.length);
});
test('unacknowledged notification stamps are errors, never sent or counted as already sent',async()=>{
 const sent=[],f=fixture({missingStamp:true});const result=await batch(sent)(f.client,'document_expiry',new Date('2026-09-15T09:00:00Z'),config);
 assert.equal(sent.length,0);assert.equal(result.itemsSkippedIdempotent,0);assert.equal(result.errors.length,602);
});

test('unverifiable task owner is not treated as unassigned or sent to the manager fallback',async()=>{
 const task={id:'task1',title:'ASSIGNED-TASK',status:'gecikti',due_date:'2026-09-14',assigned_to_user_id:'z-alice',tenant_id:'A',company_id:'company'};
 const sent=[],f=fixture({tasks:[task],failOwners:true});
 const result=await batch(sent)(f.client,'task_overdue',new Date('2026-09-15T09:00:00Z'),config);
 assert.equal(result.itemsFound,1);assert.ok(result.errors.length);assert.equal(sent.length,0);assert.equal(f.stamps.length,0);
});
test('verified task owner receives the task while a truly unassigned task goes to its tenant manager',async()=>{
 const tasks=[{id:'task1',title:'BOB-ASSIGNED',status:'gecikti',due_date:'2026-09-14',assigned_to_user_id:'z-bob',tenant_id:'B',company_id:'company'}, {id:'task2',title:'A-UNASSIGNED',status:'gecikti',due_date:null,assigned_to_user_id:null,tenant_id:'A',company_id:'company'}];
 const sent=[],f=fixture({tasks});const result=await batch(sent)(f.client,'task_overdue',new Date('2026-09-15T09:00:00Z'),config);
 assert.equal(result.errors.length,0);assert.equal(sent.length,2);
 const bob=sent.find(m=>m.to==='bob@example.invalid'),alice=sent.find(m=>m.to==='alice@example.invalid');
 assert.match(bob.text,/BOB-ASSIGNED/);assert.doesNotMatch(bob.text,/A-UNASSIGNED/);assert.match(alice.text,/A-UNASSIGNED/);assert.doesNotMatch(alice.text,/BOB-ASSIGNED/);
});

test('overdue tasks change day at Istanbul midnight, not three hours later at UTC midnight',async()=>{
 const task={id:'task-boundary',title:'MIDNIGHT-TASK',status:'acik',due_date:'2026-09-14',assigned_to_user_id:'z-alice',tenant_id:'A',company_id:'company'};
 for(const [now,expected]of [['2026-09-14T20:59:59Z',0],['2026-09-14T21:00:00Z',1]]){
  const sent=[],f=fixture({tasks:[task]});const result=await batch(sent)(f.client,'task_overdue',new Date(now),config);
  assert.equal(result.errors.length,0);assert.equal(result.itemsFound,expected);assert.equal(sent.length,expected);
 }
});
test('appointment reminders use tomorrow in Istanbul when UTC is still on the previous day',async()=>{
 const appointments=[{id:'appt-old',meeting_type:'ziyaret',attendee:'TODAY-ONLY',meeting_date:'2026-09-16',company_id:'c1',tenant_id:'A',status:'planlandi'}, {id:'appt-next',meeting_type:'ziyaret',attendee:'ISTANBUL-TOMORROW',meeting_date:'2026-09-17',company_id:'c1',tenant_id:'A',status:'planlandi'}];
 const sent=[],f=fixture({appointments,companies:[{id:'c1',name:'Sentetik Firma'}]});
 const result=await batch(sent)(f.client,'appointment_reminder',new Date('2026-09-15T21:30:00Z'),config);
 assert.equal(result.errors.length,0);assert.equal(result.itemsFound,1);assert.equal(sent.length,1);assert.match(sent[0].text,/ISTANBUL-TOMORROW/);assert.doesNotMatch(sent[0].text,/TODAY-ONLY/);
});

// Feature-enabled acceptance executes the real collector with a synthetic transport.
test('tenant roles override global roles for document recipients',async()=>{
 const sent=[],f=fixture();
 f.tables.tenant_memberships=[{tenant_id:'A',user_id:'z-alice',role:'yonetici',version:'1'},{tenant_id:'B',user_id:'z-alice',role:'goruntuleyici',version:'2'},{tenant_id:'B',user_id:'z-bob',role:'yonetici',version:'3'}];
 f.tables.profiles[0].role='goruntuleyici';
 const result=await batch(sent,true)(f.client,'document_expiry',new Date('2026-09-15T09:00:00Z'),config);
 assert.equal(result.errors.length,0);assert.equal(sent.length,2);
 assert.doesNotMatch(sent.find(m=>m.to==='alice@example.invalid').text,/B-PRIVATE-DOC/);
 assert.match(sent.find(m=>m.to==='bob@example.invalid').text,/B-PRIVATE-DOC/);
});
test('missing membership role fails closed before any transport or stamp',async()=>{
 const sent=[],f=fixture();
 const result=await batch(sent,true)(f.client,'document_expiry',new Date('2026-09-15T09:00:00Z'),config);
 assert.ok(result.errors.length);assert.equal(sent.length,0);assert.equal(f.stamps.length,0);
});

const moduleTask={id:'module-task',title:'MODULE-TASK',status:'gecikti',due_date:null,assigned_to_user_id:'z-alice',tenant_id:'A',company_id:null};
test('disabled task tenant never produces an email or a reservation',async()=>{
 const sent=[],f=fixture({tasks:[moduleTask],moduleStates:{A:false,B:true}});
 const result=await batch(sent)(f.client,'task_overdue',new Date('2026-09-15T09:00:00Z'),config);
 assert.equal(result.errors.length,0);assert.equal(result.itemsFound,0);assert.equal(sent.length,0);assert.equal(f.stamps.length,0);
});
test('unverifiable task module before stamping stops the email without consuming a reservation',async()=>{
 const sent=[],f=fixture({tasks:[moduleTask],moduleFailure:true});
 const result=await batch(sent)(f.client,'task_overdue',new Date('2026-09-15T09:00:00Z'),config);
 assert.ok(result.errors.some(e=>e.includes('modules unavailable')));assert.equal(sent.length,0);assert.equal(f.stamps.length,0);
});
test('task module disabled after reservation is rechecked and reservation is rolled back before send',async()=>{
 const sent=[],f=fixture({tasks:[moduleTask],afterStamp:states=>{states.A=false;}}),deletes=[];
 const original=f.client.from.bind(f.client);
 f.client.from=table=>{const q=original(table),remove=q.delete;q.delete=()=>{deletes.push(table);return remove();};return q;};
 const result=await batch(sent)(f.client,'task_overdue',new Date('2026-09-15T09:00:00Z'),config);
 assert.equal(result.errors.length,0);assert.equal(sent.length,0);assert.equal(f.stamps.length,1);assert.deepEqual(deletes,['notification_log']);
});
test('unverifiable post-stamp module state releases the reservation and sends nothing',async()=>{
 const sent=[],f=fixture({tasks:[moduleTask],afterStamp:states=>{delete states.A;}}),deletes=[];
 const original=f.client.from.bind(f.client);
 f.client.from=table=>{const q=original(table),remove=q.delete;q.delete=()=>{deletes.push(table);return remove();};return q;};
 const result=await batch(sent)(f.client,'task_overdue',new Date('2026-09-15T09:00:00Z'),config);
 assert.ok(result.errors.some(e=>e.includes('before send')));assert.equal(sent.length,0);assert.deepEqual(deletes,['notification_log']);
});

for(const after of [false,true])test(`calendar off ${after?'after stamp':'before collection'} prevents sends`,async()=>{
 const appointments=[{id:'appt',meeting_type:'ziyaret',meeting_date:'2026-09-16',company_id:'c1',tenant_id:'A',status:'planlandi'}];
 const sent=[],f=fixture({appointments,companies:[{id:'c1',name:'Synthetic'}],moduleStates:{A:!after?false:true,B:true},afterStamp:after?states=>{states.A=false;}:null});
 const result=await batch(sent)(f.client,'appointment_reminder',new Date('2026-09-15T09:00:00Z'),config);
 assert.equal(result.errors.length,0);assert.equal(sent.length,0);assert.equal(f.stamps.length,after?1:0);
});

test('document pre-send gate removes contract-linked documents while retaining company documents',async()=>{
 const sent=[],f=fixture({contractStates:{A:false,B:true}});f.tables.documents[0].contract_id='contract';
 const result=await batch(sent)(f.client,'document_expiry',new Date('2026-09-15T09:00:00Z'),config);
 assert.equal(result.errors.length,0);const alice=sent.find(m=>m.to==='alice@example.invalid');assert.doesNotMatch(alice.text,/A-DOC-0(?:\n|<)/);assert.match(alice.text,/A-DOC-1/);assert.equal(f.stamps.some(s=>s.entity_id==='d0000'),false);
});
test('document module closure after reservation prevents send and releases every reservation',async()=>{
 const sent=[],f=fixture({afterStamp:states=>{states.A=false;states.B=false;}}),deletes=[];
 const original=f.client.from.bind(f.client);f.client.from=t=>{const q=original(t),remove=q.delete;q.delete=()=>{deletes.push(t);return remove();};return q;};
 const result=await batch(sent)(f.client,'document_expiry',new Date('2026-09-15T09:00:00Z'),config);
 assert.equal(result.errors.length,0);assert.equal(sent.length,0);assert.equal(f.stamps.length,601);assert.equal(deletes.length,601);
});
test('unverifiable document state before stamping sends nothing',async()=>{
 const sent=[],f=fixture({moduleFailure:true});const result=await batch(sent)(f.client,'document_expiry',new Date('2026-09-15T09:00:00Z'),config);
 assert.ok(result.errors.length);assert.equal(sent.length,0);assert.equal(f.stamps.length,0);
});
