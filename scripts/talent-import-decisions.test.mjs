import test from 'node:test';
import assert from 'node:assert/strict';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
const {reviewImportDecisions}=await importActualTypeScript(new URL('../src/lib/talent/import-decisions.ts',import.meta.url));
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const person={id:id(3),revision:4,name:'Ali Örnek',city:'İstanbul',contacts:[{kind:'phone',value:'05550000001'}]};
const pool=(rows=[person])=>({actorId:id(1),tenantId:id(2),total:rows.length,rows,generatedAt:'2026-09-14T10:00:00Z'});
const row=(number,extra={})=>({number,name:'Ali Örnek',phone:'',email:'',city:'',branch:'',original:'',start:'',end:'',status:'',reply:'',issues:[],...extra});
test('every source row is accounted for; no decision is guessed',()=>{
 const rows=[row(2),row(4,{name:'Yeni Kişi'}),row(8,{issues:['Sorun']})];
 const plan=reviewImportDecisions(rows,pool(),{4:{kind:'new'},8:{kind:'hold'}});
 assert.deepEqual(plan.counts,{unresolved:1,hold:1,new:1,update:0,unchanged:0});assert.equal(plan.ready,false);
 assert.throws(()=>reviewImportDecisions(rows,pool(),{99:{kind:'hold'}}));
 assert.throws(()=>reviewImportDecisions([row(2),row(2)],pool(),{}));
});
test('existing identity selection never accepts field changes by default',()=>{
 const rows=[row(2,{city:'Ankara',email:'yeni@example.test'})];
 const same=reviewImportDecisions(rows,pool(),{2:{kind:'existing',personId:id(3),changes:[]}});
 assert.equal(same.counts.unchanged,1);assert.deepEqual(same.rows[0].patch,{});assert.equal(same.rows[0].expectedRevision,4);
 const changed=reviewImportDecisions(rows,pool(),{2:{kind:'existing',personId:id(3),changes:[1]}});
 assert.deepEqual(changed.rows[0].patch,{addContacts:[{kind:'email',value:'yeni@example.test'}]});assert.equal(person.city,'İstanbul');assert.equal(person.contacts.length,1);
});
test('source issues, unknown targets, illegal changes and matches cannot become new writes',()=>{
 for(const [source,decision]of [[row(2,{issues:['Eksik']}),{kind:'new'}],[row(2),{kind:'new'}],[row(2),{kind:'existing',personId:id(9),changes:[]}],[row(2),{kind:'existing',personId:id(3),changes:[0]}],[row(2,{city:'Ankara'}),{kind:'existing',personId:id(3),changes:[0,0]}]]){
  const plan=reviewImportDecisions([source],pool(),{2:decision});assert.equal(plan.ready,false);assert.equal(plan.rows[0].kind,'unresolved');
 }
 assert.equal(reviewImportDecisions([row(2,{issues:['Eksik']})],pool(),{2:{kind:'hold'}}).ready,true);
});
test('two source rows targeting one person require resolution even for unchanged rows',()=>{
 const rows=[row(2),row(3)],d={kind:'existing',personId:id(3),changes:[]};
 const conflict=reviewImportDecisions(rows,pool(),{2:d,3:d});assert.equal(conflict.conflicts,2);assert.equal(conflict.ready,false);
 assert.equal(reviewImportDecisions(rows,pool(),{2:d,3:{kind:'hold'}}).ready,true);
});
test('new rows with normalized shared identity do not silently create duplicates',()=>{
 for(const rows of [[row(2,{name:'Yeni Kişi'}),row(3,{name:'YENİ KİŞİ'})],[row(2,{name:'Bir',phone:'05550000009'}),row(3,{name:'İki',phone:'+905550000009'})]]){
  const p=reviewImportDecisions(rows,pool([]),{2:{kind:'new'},3:{kind:'new'}});assert.equal(p.conflicts,2);assert.equal(p.ready,false);
 }
});
test('new row conflicting with another row resulting contact is also blocked',()=>{
 const rows=[row(2,{phone:'05550000009'}),row(3,{name:'Yeni Kişi',phone:'+905550000009'})];
 const p=reviewImportDecisions(rows,pool(),{2:{kind:'existing',personId:id(3),changes:[0]},3:{kind:'new'}});
 assert.equal(p.conflicts,2);assert.equal(p.ready,false);
});
test('contact capacity and revision overflow cannot be hidden by review',()=>{
 const full={...person,contacts:Array.from({length:10},(_,i)=>({kind:'phone',value:'055500000'+String(i).padStart(2,'0')}))};
 const p=reviewImportDecisions([row(2,{email:'yeni@example.test'})],pool([full]),{2:{kind:'existing',personId:id(3),changes:[0]}});assert.equal(p.ready,false);
 const limit=reviewImportDecisions([row(2,{city:'Ankara'})],pool([{...person,revision:2147483647}]),{2:{kind:'existing',personId:id(3),changes:[0]}});assert.equal(limit.ready,false);
});
