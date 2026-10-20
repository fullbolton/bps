import test from 'node:test';
import assert from 'node:assert/strict';
import {driver,compile,nodes,settle} from './helpers/component-driver.mjs';
const text=n=>typeof n==='string'||typeof n==='number'?String(n):Array.isArray(n)?n.map(text).join(''):n?.props?text(n.props.children):'';
function setup(){
 const d=driver(),reads=[];let fail=false;
 const resource=compile('src/components/ui/useScopedResource.ts',d.hooks,{},'useScopedResource');
 const dependencies={
  '@/context/AuthContext':{},'@/hooks/useVerifiedTenant':{},
  '@/components/ui/useScopedResource':{useScopedResource:resource},
  '@/context/NavigationGuardContext':{useNavigationGuard:()=>({register:()=>()=>{}})},
  '@/lib/supabase/client':{createClient:()=>({})},
  '@/lib/services/hr-directory':{loadHrDirectory:async(_client,actor,tenant,cursor)=>{reads.push({actor,tenant,cursor});if(fail)throw Error('offline');return {employees:[{id:cursor==='first'?'second':cursor==='second'?'third':'first',name:'Synthetic',code:'S1',startsOn:'2026-01-01'}],departments:[],hasMore:cursor!=='second'};}},
  '@/lib/services/hr-screen':{},
 };
 for(const name of ['HrImportPreview','EmploymentChange','EmployeeDocuments','EmployeeEdit','LocationTransfer','ScopedEmployeeForm'])dependencies['./'+name]={default:name};
 const Directory=compile('src/app/(main)/insan-kaynaklari/HrDirectory.tsx',d.hooks,dependencies,'Directory');
 const props={actor:'actor',tenant:'tenant',writeMode:'scoped',manager:true};let tree;
 const render=()=>{tree=d.render(Directory,props);d.flush();};
 const tick=async()=>{await settle();render();};
 const button=label=>nodes(tree).find(n=>n.type==='button'&&text(n)===label);
 const click=async label=>{const b=button(label);assert.ok(b);assert.ok(!b.props.disabled);b.props.onClick();render();await tick();};
 render();
 return {d,reads,tick,click,get tree(){return tree;},set fail(value){fail=value;},async close(saved){const panel=nodes(tree).find(n=>n.type==='HrImportPreview');assert.ok(panel);panel.props.onClose(saved);render();await tick();}};
}
test('successful import closes panel and reloads first page with the same actor and tenant',async()=>{
 const h=setup();try{await h.tick();await h.click('Excel ön kontrolü');await h.close(true);assert.equal(h.reads.length,2);assert.deepEqual(h.reads.at(-1),{actor:'actor',tenant:'tenant',cursor:null});assert.ok(!nodes(h.tree).some(n=>n.type==='HrImportPreview'));}finally{h.d.dispose();}
});
test('cancel preserves current page; successful import returns from later page to first',async()=>{
 const h=setup();try{await h.tick();await h.click('Sonraki 50 kayıt');assert.equal(h.reads.at(-1).cursor,'first');await h.click('Excel ön kontrolü');await h.close(false);assert.equal(h.reads.length,2);await h.click('Excel ön kontrolü');await h.close(true);assert.equal(h.reads.length,3);assert.equal(h.reads.at(-1).cursor,null);}finally{h.d.dispose();}
});
test('list reload failure after committed import shows a read error without reopening import',async()=>{
 const h=setup();try{await h.tick();await h.click('Excel ön kontrolü');h.fail=true;await h.close(true);assert.ok(text(h.tree).includes('Çalışanlar alınamadı'));assert.ok(text(h.tree).includes('Aktarım tamamlandı'));assert.ok(!nodes(h.tree).some(n=>n.type==='HrImportPreview'));assert.ok(!text(h.tree).includes('Synthetic'));}finally{h.d.dispose();}
});

test('directory walks three pages back and forward without losing cursor history',async()=>{
 const h=setup();try{await h.tick();await h.click('Sonraki 50 kayıt');await h.click('Sonraki 50 kayıt');assert.ok(text(h.tree).includes('Sayfa 3'));await h.click('Önceki 50 kayıt');assert.equal(h.reads.at(-1).cursor,'first');await h.click('Önceki 50 kayıt');assert.equal(h.reads.at(-1).cursor,null);assert.ok(nodes(h.tree).find(n=>n.type==='button'&&text(n)==='Önceki 50 kayıt').props.disabled);await h.click('Sonraki 50 kayıt');assert.equal(h.reads.at(-1).cursor,'first');await h.click('İlk sayfa');assert.ok(text(h.tree).includes('Sayfa 1'));}finally{h.d.dispose();}
});
test('failed next page keeps backward navigation available and open import locks paging',async()=>{
 const h=setup();try{await h.tick();h.fail=true;await h.click('Sonraki 50 kayıt');assert.ok(text(h.tree).includes('Çalışanlar alınamadı'));assert.ok(nodes(h.tree).find(n=>n.type==='button'&&text(n)==='Sonraki 50 kayıt').props.disabled);h.fail=false;await h.click('Önceki 50 kayıt');assert.equal(h.reads.at(-1).cursor,null);await h.click('Sonraki 50 kayıt');await h.click('Excel ön kontrolü');for(const label of ['İlk sayfa','Önceki 50 kayıt','Sonraki 50 kayıt'])assert.ok(nodes(h.tree).find(n=>n.type==='button'&&text(n)===label).props.disabled);}finally{h.d.dispose();}
});
