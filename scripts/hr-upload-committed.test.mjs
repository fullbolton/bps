import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {compile,driver,nodes,settle} from './helpers/component-driver.mjs';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
const receiptParser=await importActualTypeScript(new URL('../src/lib/services/hr-document-upload.ts',import.meta.url));
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const text=n=>typeof n==='string'?n:Array.isArray(n)?n.map(text).join(''):n?.props?text(n.props.children):'';
const file=new Blob(['%PDF-1.7 synthetic'],{type:'application/pdf'}),sha256=createHash('sha256').update(Buffer.from(await file.arrayBuffer())).digest('hex');
const input={id:id(4),employmentId:id(5),title:'Synthetic',size:file.size,sha256,validityDate:null};
for(const path of ['upload','finalize'])for(const valid of [true,false])test(`${path}: ${valid?'published receipt survives callback failure':'wrong receipt never completes'}`,async()=>{
 const d=driver();let calls=0,saved=0,guards=0;
 const deps={
  '@/lib/supabase/client':{createClient:()=>({})},'@/lib/services/hr-employment':{},
  '@/lib/pdf-upload':{pdfDigest:async()=>sha256},'@/lib/services/hr-document-upload':receiptParser,
  '@/context/NavigationGuardContext':{useNavigationGuard:()=>({register:()=>{guards++;return()=>guards--;}})},
 };
 const Component=compile('src/app/(main)/insan-kaynaklari/HrDocumentUpload.tsx',d.hooks,deps,'default',{
  window:{addEventListener(){},removeEventListener(){}},AbortSignal,
  fetch:async(_url,options)=>{calls++;const action=path==='finalize'?JSON.parse(options.body).action:null;
   return {ok:true,json:async()=>action==='status'?{ok:true,scan:{status:'ready',label:'Hazır',canFinalize:true,canRescan:false}}:{ok:true,receipt:{schemaVersion:1,actorId:id(1),tenantId:id(2),employeeId:id(3),...input,id:valid?input.id:id(9),state:'published'}}};},
 });
 let tree;const props={actor:id(1),tenant:id(2),employee:id(3),recovery:input,onClose(){},onSaved:async()=>{saved++;throw Error('list refresh failed');}};
 const render=()=>{tree=d.render(Component,props);d.flush();};
 const click=async label=>{const b=nodes(tree).find(n=>n.type==='button'&&text(n)===label);assert.ok(b,label);b.props.onClick();await settle();render();};
 try{
  render();if(path==='upload'){nodes(tree).find(n=>n.type==='input'&&n.props.type==='file').props.onChange({target:{files:[file]}});render();nodes(tree).find(n=>n.type==='form').props.onSubmit({preventDefault(){}});await settle();render();}else{await click('Tarama durumunu kontrol et');await click('Evrakı kaydet');}
  assert.equal(saved,valid?1:0);
  if(valid){assert.ok(text(tree).includes('Evrak kaydedildi; liste yenilenemedi'));assert.equal(guards,0);assert.equal(nodes(tree).find(n=>n.type==='button'&&text(n)==='Formu kapat').props.disabled,false);assert.ok(nodes(tree).find(n=>n.type==='button'&&text(n)==='Kaydedildi').props.disabled);assert.ok(!text(tree).includes('Tarama durumunu kontrol et'));const before=calls;nodes(tree).find(n=>n.type==='form').props.onSubmit({preventDefault(){}});await settle();assert.equal(calls,before);}else{assert.ok(!text(tree).includes('Evrak kaydedildi'));assert.equal(guards,1);}
 }finally{d.dispose();}
});
