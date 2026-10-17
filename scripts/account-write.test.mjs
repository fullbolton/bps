import test from 'node:test';import assert from 'node:assert/strict';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
import {compile,driver,nodes,settle} from './helpers/component-driver.mjs';
const {updateOwnDisplayName}=await importActualTypeScript(new URL('../src/lib/services/profiles.ts',import.meta.url));
test('profile write validates name, binds authenticated identity and compares previous name',async()=>{
 const filters=[];let writes=0;const chain={update(v){writes++;assert.deepEqual(v,{display_name:'Yeni'});return this;},eq(k,v){filters.push([k,v]);return this;},select(){return this;},abortSignal(){return this;},async single(){return {data:{id:'a',display_name:'Yeni'},error:null};}};
 let actor='a';const client={auth:{getUser:async()=>({data:{user:{id:actor}},error:null})},from:()=>chain};
 for(const invalid of ['','  ','x'.repeat(81)])await assert.rejects(updateOwnDisplayName(client,invalid,{actorId:'a',displayName:'Eski'}));
 actor='b';await assert.rejects(updateOwnDisplayName(client,'Yeni',{actorId:'a',displayName:'Eski'}));assert.equal(writes,0);
 actor='a';await updateOwnDisplayName(client,' Yeni ',{actorId:'a',displayName:'Eski'});assert.deepEqual(filters,[['id','a'],['display_name','Eski']]);
 chain.single=async()=>({data:null,error:{message:'conflict'}});await assert.rejects(updateOwnDisplayName(client,'Yeni',{actorId:'a',displayName:'Eski'}));
 chain.single=async()=>({data:{id:'b',display_name:'Yeni'},error:null});await assert.rejects(updateOwnDisplayName(client,'Yeni',{actorId:'a',displayName:'Eski'}));
});
function setup(write,read=async()=>({id:'a',display_name:'Yeni'})){
 const d=driver();let refreshes=0;const listeners=new Map();const guard={register(fn){listeners.set('guard',fn);return()=>listeners.delete('guard');}};
 const c=compile('src/app/(main)/hesabim/DisplayNameEditor.tsx',d.hooks,{'@/context/NavigationGuardContext':{useNavigationGuard:()=>guard},'@/lib/supabase/client':{createClient:()=>({})},'@/lib/services/profiles':{updateOwnDisplayName:write,getCurrentProfile:read}},'default',{window:{addEventListener:(k,v)=>listeners.set(k,v),removeEventListener:k=>listeners.delete(k)}});
 return {render(){const t=d.render(c,{actorId:'a',initialName:'Eski',onSaved:async()=>{refreshes++;}});d.flush();return t;},change(t,value){nodes(t).find(n=>n.type==='input').props.onChange({target:{value}});},submit(t){return t.props.onSubmit({preventDefault(){}});},get refreshes(){return refreshes;},listeners,close:()=>d.dispose()};
}
const button=(t,label)=>nodes(t).find(n=>n.type==='button'&&n.props.children===label);
const text=t=>nodes(t).map(n=>n.props?.children).filter(x=>typeof x==='string').join(' ');
test('double submit sends once, guards draft, updates verified name and clears guard',async()=>{
 let done,calls=0;const x=setup(()=>{calls++;return new Promise(r=>done=r);});let t=x.render();x.change(t,'Yeni');t=x.render();assert.ok(x.listeners.has('beforeunload'));x.submit(t);x.submit(t);assert.equal(calls,1);done({id:'a',display_name:'Yeni'});await settle();t=x.render();assert.match(text(t),/kaydedildi/);assert.equal(x.refreshes,1);assert.ok(!x.listeners.has('beforeunload'));x.close();
});
test('uncertain save keeps draft, forbids another write, reconciles conflict before retry',async()=>{
 let calls=0;const x=setup(async()=>{calls++;throw Error('network');},async()=>({id:'a',display_name:'Başka sekme'}));let t=x.render();x.change(t,'Yeni');t=x.render();x.submit(t);await settle();t=x.render();assert.ok(button(t,'Güncel adı kontrol et'));x.submit(t);assert.equal(calls,1);button(t,'Güncel adı kontrol et').props.onClick();await settle();t=x.render();assert.equal(nodes(t).find(n=>n.type==='input').props.value,'Yeni');assert.match(text(t),/Başka sekme/);button(t,'Vazgeç').props.onClick();t=x.render();assert.equal(nodes(t).find(n=>n.type==='input').props.value,'Başka sekme');x.close();
});
test('late response after account editor unmount cannot refresh next account',async()=>{
 let done;const x=setup(()=>new Promise(r=>done=r));let t=x.render();x.change(t,'Yeni');t=x.render();x.submit(t);x.close();done({id:'a',display_name:'Yeni'});await settle();assert.equal(x.refreshes,0);
});
const tokens=await importActualTypeScript(new URL('../src/styles/tokens.ts',import.meta.url));
test('account menu honors draft guard before signing out and preserves normal exit',()=>{
 const d=driver();let exits=0,block=true;const icon=()=>null;
 const c=compile('src/components/shell/Topbar.tsx',d.hooks,{'@/components/communication/ConversationInbox':{default:icon},'lucide-react':{User:icon,LogOut:icon,ChevronDown:icon,LayoutGrid:icon},'next/navigation':{usePathname:()=>'/hesabim'},'@/context/AuthContext':{useAuth:()=>({displayName:'Test',signOut:()=>{exits++;}})},'next/link':{default:'a'},'@/context/NavigationGuardContext':{useNavigationGuard:()=>({handle:e=>{if(block)e.preventDefault();}})},'@/context/WorkspaceContext':{useWorkspace:()=>({workspace:{name:'Şirket'},loading:false})},'@/styles/tokens':tokens},'default',{process:{env:{}}});
 let tree=d.render(c,{});nodes(tree).find(n=>n.props?.['aria-label']==='Kullanıcı menüsü').props.onClick();tree=d.render(c,{});const exit=nodes(tree).find(n=>n.props?.href==='/login');
 const event=()=>({button:0,defaultPrevented:false,preventDefault(){this.defaultPrevented=true;}});exit.props.onClick(event());assert.equal(exits,0);block=false;exit.props.onClick(event());assert.equal(exits,1);
});
