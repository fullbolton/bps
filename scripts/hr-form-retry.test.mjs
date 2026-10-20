import test from 'node:test';
import assert from 'node:assert/strict';
import {compile,driver,nodes,settle} from './helpers/component-driver.mjs';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
const failure=await importActualTypeScript(new URL('../src/lib/services/hr-write-failure.ts',import.meta.url));
const create=await importActualTypeScript(new URL('../src/lib/services/hr-scoped-create.ts',import.meta.url));
const transfer=await importActualTypeScript(new URL('../src/lib/services/hr-scoped-transfer.ts',import.meta.url));
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const text=node=>typeof node==='string'?node:Array.isArray(node)?node.map(text).join(''):node?.props?text(node.props.children):'';
for(const kind of ['create','transfer']){
 function setup(outcomes){
  const d=driver(),commands=[];let uuidCount=0,saved=0,closed=0,reloads=0;
  const option={key:`${id(3)}:00000000-0000-0000-0000-000000000000`,departmentId:id(3),departmentName:'Test',locationId:null,locationName:null};
  const data=kind==='create'?{policyRevision:1,options:[option],hasMore:false,canCreateFuture:true}:{policyRevision:1,assignmentId:id(4),assignmentRevision:1,sourceLocationName:'A',effectiveOn:'2026-10-20',locations:[{id:id(5),name:'B'}],hasMore:false};
  const write=async(_client,command)=>{commands.push(command);const error=outcomes.shift();if(error)throw error;};
  const deps={
   '@/lib/supabase/client':{createClient:()=>({})},
   '@/lib/services/hr-write-failure':failure,
   '@/components/ui/useScopedResource':{useScopedResource:()=>({data,loading:false,error:false,reload:async()=>{reloads++;}})},
   '@/context/NavigationGuardContext':{useNavigationGuard:()=>({register:()=>()=>{}})},
   '@/lib/services/hr-scoped-create':create,
   '@/lib/services/hr-screen':{loadScopedHrOptions:async()=>data,saveScopedHrEmployee:write},
   '@/lib/services/hr-scoped-transfer':transfer,
   '@/lib/services/hr-transfer-client':{loadHrTransferOptions:async()=>data,saveHrTransfer:write},
  };
  const Component=compile(`src/app/(main)/insan-kaynaklari/${kind==='create'?'ScopedEmployeeForm':'LocationTransfer'}.tsx`,d.hooks,deps,'default',{crypto:{randomUUID:()=>{uuidCount++;return id(10+uuidCount);}},window:{addEventListener(){},removeEventListener(){}}});
  const props={actor:id(1),tenant:id(2),employee:{id:id(6),name:'Synthetic'},onOpenChange(){},onSaved:async()=>{saved++;},onClose:()=>{closed++;}};
  let tree;const render=()=>{tree=d.render(Component,props);d.flush();return tree;};
  const button=label=>nodes(tree).find(n=>n.type==='button'&&text(n)===label);
  const change=(type,index,value)=>{nodes(tree).filter(n=>n.type===type)[index].props.onChange({target:{value}});render();};
  const click=async label=>{const b=button(label);assert.ok(b, label);assert.ok(!b.props.disabled,label+' enabled');await b.props.onClick?.();await settle();render();};
  const submit=async()=>{if(kind==='create'){nodes(tree).find(n=>n.type==='form').props.onSubmit({preventDefault(){}});await settle();render();}else await click(commands.length?'Aynı işlemi yeniden dene':'Onayla ve kaydet');};
  render();
  return {d,render,button,change,click,submit,commands,async open(){if(kind==='create'){await click('Yeni çalışan');change('input',0,'Synthetic');change('input',1,'SYN-1');change('input',2,'2026-01-01');change('select',0,option.key);change('input',3,'Test');}else{change('select',0,id(5));await click('Değişikliği gözden geçir');}},get saved(){return saved;},get uuidCount(){return uuidCount;},get tree(){return tree;}};
 }
 test(`${kind}: uncertain response and later denial preserve the frozen command until success`,async()=>{
  const h=setup([new Error('network'),{code:'P0001',message:'HR_FORBIDDEN'},null]);
  try{
   await h.open();await h.submit();
   const close=kind==='create'?'Formu kapat':'Paneli kapat';
   assert.equal(h.button(close).props.disabled,true);
   await h.submit();assert.equal(h.button(close).props.disabled,true);
   assert.ok(!text(h.tree).includes('Güncel atamayı ve seçenekleri getir'));
   assert.ok(!text(h.tree).includes('Yazdıklarımı koruyarak seçenekleri kontrol et'));
   await h.submit();assert.equal(h.saved,1);assert.equal(h.uuidCount,1);
   assert.equal(h.commands.length,3);assert.strictEqual(h.commands[0],h.commands[1]);assert.strictEqual(h.commands[1],h.commands[2]);
  }finally{h.d.dispose();}
 });
 test(`${kind}: definitive first rollback permits closing and reviewing options`,async()=>{
  const h=setup([{code:'P0001',message:'HR_FORBIDDEN'}]);
  try{await h.open();await h.submit();assert.equal(h.button(kind==='create'?'Formu kapat':'Paneli kapat').props.disabled,false);assert.ok(h.button(kind==='create'?'Yazdıklarımı koruyarak seçenekleri kontrol et':'Güncel atamayı ve seçenekleri getir'));assert.equal(h.saved,0);}finally{h.d.dispose();}
 });
}
