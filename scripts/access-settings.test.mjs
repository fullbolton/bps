import test from 'node:test';import assert from 'node:assert/strict';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
const {parseAccessSettings:parse}=await importActualTypeScript(new URL('../src/lib/services/access-settings.ts',import.meta.url));
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const settings=()=>({schemaVersion:1,actorId:id(1),tenantId:id(2),enforcement:'preview_only',revision:2,roles:[{id:id(3),tenant_id:id(2),name:'Reader',archived:false,rules:[]}],assignments:[],recentHistory:[]});
const options=()=>({schemaVersion:1,actorId:id(1),tenantId:id(2),people:[],departments:[],locations:[]});
test('settings rejects foreign scope, non-preview responses and broken role references',()=>{
 assert.equal(parse(settings(),options(),id(1),id(2)).roles[0].name,'Reader');
 for(const mutate of [s=>s.actorId=id(9),s=>s.enforcement='active',s=>s.revision=0,s=>s.roles[0].tenant_id=id(9),s=>s.roles.push(s.roles[0]),s=>s.assignments=[{tenant_id:id(2),account_id:id(4),role_id:id(9)}]]){const s=settings();mutate(s);assert.throws(()=>parse(s,options(),id(1),id(2)));}
 const o=options();o.tenantId=id(9);assert.throws(()=>parse(settings(),o,id(1),id(2)));
});
test('settings rejects partial option data and inconsistent history while allowing empty company',()=>{
 for(const change of [{people:null},{locations:[{id:id(8),name:'Office'}]},{departments:[{id:id(8),name:'',closed:false}]}])assert.throws(()=>parse(settings(),{...options(),...change},id(1),id(2)));
 const s=settings();s.recentHistory=[{tenant_id:id(2),revision:3,created_at:'2026-10-19T00:00:00Z'}];assert.throws(()=>parse(s,options(),id(1),id(2)));
 s.recentHistory=[];s.roles=[];assert.equal(parse(s,options(),id(1),id(2)).roles.length,0);
});
