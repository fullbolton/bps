import test from 'node:test';
import assert from 'node:assert/strict';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
import {compile,driver,nodes,settle} from './helpers/component-driver.mjs';
const selection=await importActualTypeScript(new URL('../src/lib/workspace-selection.ts',import.meta.url));
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const member=n=>({tenantId:id(n),version:id(n+10),name:`Company ${n}`,role:'yonetici'});
const choices=(memberships,activeTenantId=null)=>({userId:id(1),selectionVersion:id(20),activeTenantId,memberships});
test('single company resolution preserves current binding and never selects arbitrary legacy membership',()=>{
 assert.equal(selection.resolveAccountCompany(choices([])).status,'missing');
 assert.equal(selection.resolveAccountCompany(choices([member(2)])).membership.tenantId,id(2));
 assert.equal(selection.resolveAccountCompany(choices([member(2),member(3)])).status,'ambiguous');
 assert.equal(selection.resolveAccountCompany(choices([member(2),member(3)],id(3))).membership.tenantId,id(3));
 assert.throws(()=>selection.resolveAccountCompany(choices([member(2)],id(3))));
});
test('company recovery offers only current company; ambiguous account has no continue action',async()=>{
 for(const active of [null,id(3)]){
  const d=driver(); const value=choices([member(2),member(3)],active);
  const client={auth:{getUser:async()=>({data:{user:{id:id(1)}}})},rpc:()=>({abortSignal:async()=>({data:value})})};
  const Component=compile('src/app/sirket-sec/WorkspacePicker.tsx',d.hooks,{'@/lib/supabase/client':{createClient:()=>client},'@/lib/workspace-selection':selection},'default',{AbortSignal});
  d.render(Component,{});d.flush();await settle();const tree=d.render(Component,{});
  const content=nodes(tree).flatMap(n=>[n.props?.children].flat()).filter(v=>typeof v==='string').join(' ');
  assert.doesNotMatch(content,/Company 2/);
  if(active){assert.match(content,/Company 3/);assert.match(content,/Şirketime devam et/);}
  else{assert.match(content,/birden fazla eski şirket/);assert.doesNotMatch(content,/Şirketime devam et/);}
  d.dispose();
 }
});
