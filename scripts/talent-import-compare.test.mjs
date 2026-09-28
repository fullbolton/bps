import test from 'node:test';
import assert from 'node:assert/strict';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
const {parseCompareSnapshot,contactKey,compareSourcePeople}=await importActualTypeScript(new URL('../src/lib/talent/import-compare.ts',import.meta.url));
const {loadTalentCompareSnapshot}=await importActualTypeScript(new URL('../src/lib/services/talent.ts',import.meta.url));
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const scope={actorId:id(1),tenantId:id(2)},person={id:id(3),revision:4,name:'Ali Örnek',city:'İstanbul',district:null,skills:[],regions:[],contacts:[{kind:'phone',value:'0555 000 00 01'},{kind:'email',value:'ali@example.test'}]};
const snapshot=(rows=[person])=>({...scope,total:rows.length,generatedAt:'2026-09-14T10:00:00Z',rows});
const source=(extra={})=>({number:2,name:'Ali Örnek',phone:'',email:'',city:'',branch:'',original:'',start:'',end:'',status:'',reply:'',issues:[],...extra});
test('comparison snapshot distinguishes measured empty from incomplete, malformed and foreign results',()=>{
 assert.equal(parseCompareSnapshot(snapshot([]),scope).total,0);
 for(const r of [null,{...snapshot(),total:2},{...snapshot(),tenantId:id(9)},{...snapshot(),actorId:id(9)},snapshot([person,person]),snapshot([{...person,revision:'4'}]),snapshot([{...person,contacts:null}]),snapshot([{...person,skills:undefined}]),snapshot([{...person,district:undefined}]),snapshot([{...person,regions:null}])])assert.throws(()=>parseCompareSnapshot(r,scope));
});
test('read service sends only verified scope, not spreadsheet content, and validates response',async()=>{
 const calls=[],c={rpc:async(...args)=>{calls.push(args);return {data:snapshot(),error:null};}};
 await loadTalentCompareSnapshot(c,scope);assert.deepEqual(calls,[['talent_compare_snapshot',{p_actor_id:scope.actorId,p_tenant_id:scope.tenantId}]]);
 await assert.rejects(loadTalentCompareSnapshot({rpc:async()=>({data:null,error:null})},scope));
 await assert.rejects(loadTalentCompareSnapshot({rpc:async()=>({data:snapshot([]),error:Error('offline')})},scope));
});
test('Turkish phone formats match but do not imply identity',()=>{
 assert.equal(contactKey({kind:'phone',value:'+90 555 000 00 01'}),contactKey(person.contacts[0]));
 assert.equal(contactKey({kind:'phone',value:'00905550000001'}),contactKey(person.contacts[0]));
 const r=compareSourcePeople([source({name:'Başka Kişi',phone:'+905550000001'})],snapshot())[0];assert.equal(r.status,'match');assert.deepEqual(r.candidates[0].reasons,['Telefon eşleşmesi']);assert.equal(r.candidates[0].differences[0].field,'name');
});
test('blank fields preserve existing data; new contacts are additive and old city conflicts visible',()=>{
 const [blank,changed]=compareSourcePeople([source(),source({number:3,city:'Ankara',phone:'05550000002'})],snapshot());
 assert.deepEqual(blank.candidates[0].differences,[]);assert.equal(blank.status,'match');
 assert.deepEqual(changed.candidates[0].differences.map(d=>[d.field,d.kind]),[['city','replace'],['contacts','add']]);assert.equal(changed.candidates[0].differences[1].contactKind,'phone');assert.equal(changed.candidates[0].differences[1].before,person.contacts[0].value);assert.equal(person.contacts[1].value,'ali@example.test');assert.equal(person.revision,4);
});
test('name and contact matching different people requires review; never prefer one silently',()=>{
 const second={...person,id:id(4),name:'Ayşe Örnek',contacts:[{kind:'phone',value:'05550000002'}]};
 const r=compareSourcePeople([source({phone:'05550000002'})],snapshot([person,second]))[0];assert.equal(r.status,'review');assert.equal(r.candidates.length,2);
});
test('source issues remain blocking review even when no current match exists',()=>{
 const r=compareSourcePeople([source({name:'Yeni Kişi',issues:['Hatalı telefon']})],snapshot())[0];assert.equal(r.status,'review');assert.equal(r.candidates.length,0);
 const n=compareSourcePeople([source({name:'Yeni Kişi'})],snapshot())[0];assert.equal(n.status,'new');
});
test('many ambiguous matches are bounded and explicitly labelled; file rows are never merged',()=>{
 const pool=snapshot(Array.from({length:25},(_,i)=>({...person,id:id(i+100)})));
 const r=compareSourcePeople([source(),source({number:3})],pool);assert.equal(r.length,2);assert.equal(r[0].candidates.length,20);assert.equal(r[0].moreCandidates,true);assert.equal(r[0].status,'review');
});
