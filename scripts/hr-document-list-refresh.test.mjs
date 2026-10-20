import test from 'node:test';
import assert from 'node:assert/strict';
import {compile,driver,nodes,settle} from './helpers/component-driver.mjs';
const text=n=>typeof n==='string'?n:Array.isArray(n)?n.map(text).join(''):n?.props?text(n.props.children):'';
function setup(){
 const d=driver(),reads=[],cancels=[];let cancelFails=false,readFails=null;
 const resource=compile('src/components/ui/useScopedResource.ts',d.hooks,{},'useScopedResource');
 const deps={
  '@/components/ui/useScopedResource':{useScopedResource:resource},
  '@/context/NavigationGuardContext':{useNavigationGuard:()=>({register:()=>()=>{}})},
  '@/lib/supabase/client':{createClient:()=>({})},
  '@/lib/services/hr-private-documents':{loadHrPrivateDocuments:async(_c,actor,tenant,employee,after)=>{reads.push(['documents',after]);if(readFails==='documents')throw Error('offline');return {documents:[{id:after?'d2':'d1',title:'PDF'}],hasMore:!after};}},
  '@/lib/services/hr-document-upload':{loadHrPendingUploads:async(_c,context,after)=>{reads.push(['pending',after]);if(readFails==='pending')throw Error('offline');return {uploads:[{id:after?'u2':'u1',title:'Pending'}],hasMore:!after};}},
  '@/lib/services/hr-document-verification':{cancelHrDocumentUpload:async(_c,context,id)=>{cancels.push(id);if(cancelFails)throw Error('offline');}},
  './HrDocumentUpload':{default:'Upload'},
 };
 const Component=compile('src/app/(main)/insan-kaynaklari/EmployeeDocuments.tsx',d.hooks,deps,'default',{window:{addEventListener(){},removeEventListener(){}}});
 let tree;const render=()=>{tree=d.render(Component,{actor:'a',tenant:'t',employee:'e',name:'Synthetic',manager:true,onClose(){}});d.flush();};
 const tick=async()=>{await settle();render();};
 const click=async label=>{const b=nodes(tree).find(n=>n.type==='button'&&text(n).startsWith(label));assert.ok(b,label);assert.ok(!b.props.disabled,label);await b.props.onClick();render();await tick();};
 render();return {d,reads,cancels,tick,click,get tree(){return tree;},set readFails(value){readFails=value;},set cancelFails(value){cancelFails=value;},async saved(){const panel=nodes(tree).find(n=>n.type==='Upload');assert.ok(panel);await panel.props.onSaved();render();await tick();}};
}
test('saving from later document and pending pages reads only each first page once',async()=>{
 const h=setup();try{await h.tick();await h.click('Sonraki evraklar');await h.click('Sonraki yüklemeler');await h.click('PDF yükle');h.reads.length=0;await h.saved();assert.deepEqual(h.reads,[['documents',undefined],['pending',undefined]]);assert.ok(!nodes(h.tree).some(n=>n.type==='Upload'));}finally{h.d.dispose();}
});
test('saving on first pages reloads both lists once',async()=>{
 const h=setup();try{await h.tick();await h.click('PDF yükle');h.reads.length=0;await h.saved();assert.deepEqual(h.reads,[['documents',undefined],['pending',undefined]]);}finally{h.d.dispose();}
});
test('confirmed cancellation returns pending list to first page without refreshing documents',async()=>{
 const h=setup();try{await h.tick();await h.click('Sonraki yüklemeler');h.reads.length=0;await h.click('Yüklemeden vazgeç');assert.deepEqual(h.cancels,['u2']);assert.deepEqual(h.reads,[['pending',undefined]]);}finally{h.d.dispose();}
});
test('uncertain cancellation preserves page and retries the same upload before resetting',async()=>{
 const h=setup();try{await h.tick();await h.click('Sonraki yüklemeler');h.reads.length=0;h.cancelFails=true;await h.click('Yüklemeden vazgeç');assert.deepEqual(h.reads,[]);assert.ok(nodes(h.tree).find(n=>n.type==='button'&&text(n)==='Kapat').props.disabled);h.cancelFails=false;await h.click('Aynı iptal işlemini yeniden dene');assert.deepEqual(h.cancels,['u2','u2']);assert.deepEqual(h.reads,[['pending',undefined]]);}finally{h.d.dispose();}
});

for(const [kind,next,back] of [['documents','Sonraki evraklar','Önceki evraklar'],['pending','Sonraki yüklemeler','Önceki yüklemeler']]){
 test(`${kind}: failed page can return to previous page without changing the other list`,async()=>{
  const h=setup();try{await h.tick();h.readFails=kind;await h.click(next);h.readFails=null;h.reads.length=0;await h.click(back);assert.deepEqual(h.reads,[[kind,undefined]]);assert.ok(nodes(h.tree).find(n=>n.type==='button'&&text(n)===back).props.disabled);}finally{h.d.dispose();}
 });
}
test('document and pending paging histories stay independent and upload locks both',async()=>{
 const h=setup();try{await h.tick();await h.click('Sonraki evraklar');await h.click('Sonraki yüklemeler');h.reads.length=0;await h.click('Önceki evraklar');assert.deepEqual(h.reads,[['documents',undefined]]);assert.equal(nodes(h.tree).find(n=>n.type==='button'&&text(n)==='Önceki yüklemeler').props.disabled,false);await h.click('PDF yükle');for(const label of ['Önceki evraklar','Önceki yüklemeler','Sonraki evraklar','Sonraki yüklemeler'])assert.ok(nodes(h.tree).find(n=>n.type==='button'&&text(n)===label).props.disabled);}finally{h.d.dispose();}
});
