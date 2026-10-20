import test from 'node:test';import assert from 'node:assert/strict';
import {compile,driver,nodes,settle} from './helpers/component-driver.mjs';
const text=n=>typeof n==='string'?n:Array.isArray(n)?n.map(text).join(''):n?.props?text(n.props.children):'';
for(const name of ['EmployeeEdit','EmploymentChange'])for(const oldFails of [false,true])test(`${name}: late initial ${oldFails?'failure':'success'} cannot overwrite a newer refresh`,async()=>{
 const d=driver();let finishOld,rejectOld,guard;const old=new Promise((resolve,reject)=>{finishOld=resolve;rejectOld=reject;});let reads=0;
 const fresh={name:'Fresh',code:'NEW',nameEditable:true,startsOn:'2026-02-01',endsOn:null};
 const read=async()=>++reads===1?old:fresh;
 const deps={'@/lib/supabase/client':{createClient:()=>({})},'@/context/NavigationGuardContext':{useNavigationGuard:()=>({register:callback=>{guard=callback;return()=>{};}})},'@/lib/services/hr-write-failure':{},'@/lib/services/hr-employee-edit':{loadHrEdit:read},'@/lib/services/hr-employment':{loadHrEmployment:read,hrEmploymentImpact:()=>({kind:'end',blockers:[],departments:0,locations:0})}};
 const Component=compile(`src/app/(main)/insan-kaynaklari/${name}.tsx`,d.hooks,deps,'default',{window:{addEventListener(){},removeEventListener(){}}});let tree;
 const render=()=>{tree=d.render(Component,{actor:'a',tenant:'t',employee:name==='EmployeeEdit'?'e':{id:'e',name:'Synthetic'},onClose(){},onSaved:async()=>{}});d.flush();};
 try{render();guard({preventDefault(){}});render();const retry=nodes(tree).find(n=>n.type==='button'&&text(n)==='Bilgileri yeniden getir');assert.ok(retry);retry.props.onClick();await settle();render();const snapshot=text(tree);assert.equal(reads,2);
 if(oldFails)rejectOld(Error('old failure'));else finishOld({...fresh,name:'Old',code:'OLD',startsOn:'2025-01-01'});await settle();render();assert.equal(text(tree),snapshot);
 if(name==='EmployeeEdit')assert.deepEqual(nodes(tree).filter(n=>n.type==='input').map(n=>n.props.value),['Fresh','NEW']);else{assert.ok(text(tree).includes('2026-02-01'));assert.ok(!text(tree).includes('2025-01-01'));}
 }finally{d.dispose();}
});
