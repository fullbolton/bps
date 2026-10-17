import test from 'node:test';
import assert from 'node:assert/strict';
import {compile,driver,nodes,settle} from './helpers/component-driver.mjs';
function setup(reader){
 const d=driver();let auth={user:{id:'actor-a',email:'a@example.test',app_metadata:{active_tenant:'tenant-a'}},role:'operasyon',loading:false};
 let workspace={workspace:{actorId:'actor-a',tenantId:'tenant-a',name:'Şirket A'},loading:false,error:false,reload:async()=>{}};
 const useScopedResource=compile('src/components/ui/useScopedResource.ts',d.hooks,{},'useScopedResource');
 const component=compile('src/app/(main)/hesabim/page.tsx',d.hooks,{'next/link':{default:'a'},'@/context/AuthContext':{useAuth:()=>auth},'@/context/WorkspaceContext':{useWorkspace:()=>workspace},'@/context/NavigationGuardContext':{useNavigationGuard:()=>({handle(){}})},'@/components/ui/useScopedResource':{useScopedResource},'@/lib/services/profiles':{getCurrentProfile:reader},'@/lib/supabase/client':{createClient:()=>({})}},'AccountDetails');
 return {render(flags={multiWorkspace:true,conversations:true}){const t=d.render(component,flags);d.flush();return t;},auth(v){auth=v;},workspace(v){workspace=v;},close:()=>d.dispose()};
}
const text=t=>nodes(t).flatMap(n=>[n.props?.children].flat()).filter(x=>typeof x==='string').join(' ');
test('account shows database name and verified company role without manager settings for operations',async()=>{
 const x=setup(async()=>({id:'actor-a',display_name:'Ayşe'}));x.render();await settle();const t=x.render();assert.match(text(t),/Ayşe/);assert.match(text(t),/Şirket A/);assert.match(text(t),/Operasyon/);assert.ok(!nodes(t).some(n=>n.props?.href==='/ayarlar'));assert.match(text(t),/yalnız bu sekme/);x.close();
});
test('failed new-account read removes prior name and offers retry',async()=>{
 let fail=false;const x=setup(async()=>{if(fail)throw Error('offline');return {id:'actor-a',display_name:'Ayşe'};});x.render();await settle();x.workspace({workspace:null,loading:false,error:true,reload:async()=>{}});let t=x.render();assert.doesNotMatch(text(t),/Şirket A/);assert.doesNotMatch(text(t),/Operasyon/);
 x.auth({user:{id:'actor-b',email:'b@example.test',app_metadata:{active_tenant:'tenant-b'}},role:'ik',loading:false});fail=true;x.render();await settle();t=x.render();assert.doesNotMatch(text(t),/Ayşe/);assert.match(text(t),/Ad soyad yüklenemedi/);assert.ok(nodes(t).some(n=>n.props?.children==='Yeniden dene'));x.close();
});
test('late previous account response and mismatched company are not displayed',async()=>{
 let resolve;let count=0;const x=setup(()=>++count===1?new Promise(r=>resolve=r):Promise.resolve({id:'actor-b',display_name:'Yeni kişi'}));x.render();
 x.auth({user:{id:'actor-b',email:'b@example.test',app_metadata:{active_tenant:'tenant-b'}},role:'ik',loading:false});x.render();await settle();resolve({id:'actor-a',display_name:'Eski kişi'});await settle();const t=x.render();assert.match(text(t),/Yeni kişi/);assert.doesNotMatch(text(t),/Eski kişi|Şirket A/);x.close();
});
test('no request before authentication and no disabled feature controls',async()=>{
 let count=0;const x=setup(async()=>{count++;return {id:'actor-a',display_name:'Ayşe'};});x.auth({user:null,role:'goruntuleyici',loading:true});x.render();await settle();assert.equal(count,0);x.auth({user:{id:'actor-a',app_metadata:{active_tenant:'tenant-a'}},role:'yonetici',loading:false});x.render();await settle();const t=x.render({multiWorkspace:false,conversations:false});assert.ok(nodes(t).some(n=>n.props?.href==='/ayarlar'));assert.ok(!nodes(t).some(n=>n.props?.href==='/sirket-sec'));assert.doesNotMatch(text(t),/Bildirim sesi/);x.close();
});
test('missing or other-user profile never falls back to metadata and retry can recover',async()=>{
 for(const invalid of [null,{id:'other',display_name:'Other user'}]){
  let value=invalid;const x=setup(async()=>value);x.render();await settle();let t=x.render();assert.match(text(t),/Ad soyad yüklenemedi/);assert.doesNotMatch(text(t),/Other user/);
  value={id:'actor-a',display_name:'Doğru kişi'};nodes(t).find(n=>n.props?.children==='Yeniden dene').props.onClick();x.render();await settle();t=x.render();assert.match(text(t),/Doğru kişi/);x.close();
 }
});
