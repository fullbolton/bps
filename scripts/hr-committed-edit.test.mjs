import test from 'node:test';
import assert from 'node:assert/strict';
import {compile,driver,nodes,settle} from './helpers/component-driver.mjs';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
const failure=await importActualTypeScript(new URL('../src/lib/services/hr-write-failure.ts',import.meta.url));
const text=n=>typeof n==='string'?n:Array.isArray(n)?n.map(text).join(''):n?.props?text(n.props.children):'';
for(const kind of ['EmployeeEdit','EmploymentChange'])for(const callbackError of [new Error('network'),{code:'P0001',message:'HR_FORBIDDEN'}]){
 test(`${kind}: callback ${callbackError.message} cannot turn a committed write into retry`,async()=>{
  const d=driver();let writes=0,callbacks=0,guards=0;
  const context={name:'Synthetic',code:'S1',nameEditable:true,startsOn:'2026-01-01',endsOn:null};
  const save=async()=>{writes++;};
  const deps={
   '@/lib/supabase/client':{createClient:()=>({})},
   '@/context/NavigationGuardContext':{useNavigationGuard:()=>({register:()=>{guards++;return()=>{guards--;};}})},
   '@/lib/services/hr-write-failure':failure,
   '@/lib/services/hr-employee-edit':{loadHrEdit:async()=>context,prepareHrEdit:()=>({command:'frozen'}),saveHrEdit:save},
   '@/lib/services/hr-employment':{loadHrEmployment:async()=>context,hrEmploymentImpact:()=>({kind:'end',blockers:[],departments:0,locations:0}),prepareHrEmployment:()=>({command:'frozen'}),saveHrEmployment:save},
  };
  const Component=compile(`src/app/(main)/insan-kaynaklari/${kind}.tsx`,d.hooks,deps,'default',{crypto:{randomUUID:()=> 'synthetic'},window:{addEventListener(){},removeEventListener(){}}});
  const props={actor:'a',tenant:'t',employee:kind==='EmployeeEdit'?'e':{id:'e',name:'Synthetic'},onClose(){},onSaved:async()=>{callbacks++;throw callbackError;}};
  let tree;const render=()=>{tree=d.render(Component,props);d.flush();};
  try{
   render();await settle();render();assert.equal(guards,1);
   if(kind==='EmploymentChange'){nodes(tree).find(n=>n.type==='input'&&n.props.type==='checkbox').props.onChange({target:{checked:true}});render();}
   const submit=()=>nodes(tree).find(n=>n.type==='form').props.onSubmit({preventDefault(){}});
   submit();await settle();render();
   assert.equal(writes,1);assert.equal(callbacks,1);assert.equal(guards,0);
   assert.ok(text(tree).includes('kaydedildi; liste yenilenemedi'));
   assert.equal(nodes(tree).find(n=>n.type==='button'&&text(n)==='Formu kapat').props.disabled,false);
   assert.equal(nodes(tree).find(n=>n.type==='button'&&text(n)==='Kaydedildi').props.disabled,true);
   submit();await settle();assert.equal(writes,1);
  }finally{d.dispose();}
 });
}
