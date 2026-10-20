import test from 'node:test';import assert from 'node:assert/strict';
import {compile,driver,nodes,settle} from './helpers/component-driver.mjs';
const text=n=>typeof n==='string'?n:Array.isArray(n)?n.map(text).join(''):n?.props?text(n.props.children):'';
test('period read retry preserves draft and file; concurrent retry is blocked until read settles',async()=>{
 const d=driver();let calls=0,resolve;const pending=new Promise(r=>{resolve=r;});
 const deps={'@/lib/supabase/client':{createClient:()=>({})},'@/lib/services/hr-employment':{loadHrEmployment:async()=>{calls++;if(calls===1)throw Error('offline');return pending;}},'@/lib/pdf-upload':{},'@/lib/services/hr-document-upload':{},'@/context/NavigationGuardContext':{useNavigationGuard:()=>({register:()=>()=>{}})}};
 const Component=compile('src/app/(main)/insan-kaynaklari/HrDocumentUpload.tsx',d.hooks,deps,'default',{window:{addEventListener(){},removeEventListener(){}}});let tree;
 const render=()=>{tree=d.render(Component,{actor:'a',tenant:'t',employee:'e',onClose(){},onSaved:async()=>{}});d.flush();};
 const button=label=>nodes(tree).find(n=>n.type==='button'&&text(n)===label);
 try{render();await settle();render();const inputs=nodes(tree).filter(n=>n.type==='input');inputs[0].props.onChange({target:{value:'Draft title'}});inputs[1].props.onChange({target:{value:'2027-01-01'}});inputs[2].props.onChange({target:{files:[new Blob(['%PDF-1.7 synthetic'])]}});render();assert.equal(button('Yükle').props.disabled,true);
 const retry=button('İstihdam dönemini yeniden getir');retry.props.onClick();retry.props.onClick();render();assert.equal(calls,2);assert.equal(button('İstihdam dönemini yeniden getir').props.disabled,true);assert.equal(button('Dosya doğrulanıyor…').props.disabled,true);
 resolve({periodId:'p',startsOn:'2026-01-01',endsOn:null});await settle();render();assert.equal(button('Yükle').props.disabled,false);assert.ok(!button('İstihdam dönemini yeniden getir'));assert.deepEqual(nodes(tree).filter(n=>n.type==='input').slice(0,2).map(n=>n.props.value),['Draft title','2027-01-01']);
 }finally{d.dispose();}
});
test('period retries continue to fail closed without exposing upload',async()=>{
 const d=driver();let reads=0;const deps={'@/lib/supabase/client':{createClient:()=>({})},'@/lib/services/hr-employment':{loadHrEmployment:async()=>{reads++;throw Error('denied');}},'@/lib/pdf-upload':{},'@/lib/services/hr-document-upload':{},'@/context/NavigationGuardContext':{useNavigationGuard:()=>({register:()=>()=>{}})}};
 const Component=compile('src/app/(main)/insan-kaynaklari/HrDocumentUpload.tsx',d.hooks,deps,'default',{window:{addEventListener(){},removeEventListener(){}}});let tree;const render=()=>{tree=d.render(Component,{actor:'a',tenant:'t',employee:'e',onClose(){},onSaved:async()=>{}});d.flush();};
 try{render();await settle();render();for(let i=0;i<2;i++){nodes(tree).find(n=>n.type==='button'&&text(n)==='İstihdam dönemini yeniden getir').props.onClick();await settle();render();assert.ok(nodes(tree).find(n=>n.type==='button'&&text(n)==='Yükle').props.disabled);}assert.equal(reads,3);}finally{d.dispose();}
});

for(const oldFails of [false,true])test(`effect restart ignores obsolete period ${oldFails?'failure':'success'}`,async()=>{
 const d=driver();let resolveOld,rejectOld,reads=0,restart;
 const old=new Promise((resolve,reject)=>{resolveOld=resolve;rejectOld=reject;});
 // Replay the first mount effect as React Strict Mode does, preserving hook state.
 let firstEffect=true;
 const hooks={...d.hooks,useEffect(callback,deps){if(firstEffect){firstEffect=false;d.hooks.useEffect(()=>{let cleanup=callback();restart=()=>{cleanup?.();cleanup=callback();};return()=>cleanup?.();},deps);}else d.hooks.useEffect(callback,deps);}};
 const deps={'@/lib/supabase/client':{createClient:()=>({})},'@/lib/services/hr-employment':{loadHrEmployment:async()=>++reads===1?old:{periodId:'new',startsOn:'2026-02-01',endsOn:null}},'@/lib/pdf-upload':{},'@/lib/services/hr-document-upload':{},'@/context/NavigationGuardContext':{useNavigationGuard:()=>({register:()=>()=>{}})}};
 const Component=compile('src/app/(main)/insan-kaynaklari/HrDocumentUpload.tsx',hooks,deps,'default',{window:{addEventListener(){},removeEventListener(){}}});let tree;
 const render=()=>{tree=d.render(Component,{actor:'a',tenant:'t',employee:'e',onClose(){},onSaved:async()=>{}});d.flush();};
 try{render();restart();await settle();render();assert.ok(text(tree).includes('2026-02-01'));const before=text(tree);if(oldFails)rejectOld(Error('obsolete'));else resolveOld({periodId:'old',startsOn:'2025-01-01',endsOn:null});await settle();render();assert.equal(text(tree),before);assert.ok(!text(tree).includes('2025-01-01'));assert.equal(reads,2);}finally{d.dispose();}
});
