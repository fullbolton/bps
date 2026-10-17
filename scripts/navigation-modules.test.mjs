import test from 'node:test';
import assert from 'node:assert/strict';
import {compile,driver,settle,nodes} from './helpers/component-driver.mjs';
function setup(load){
 const d=driver(),client={};let auth={user:{id:'actor',app_metadata:{active_tenant:'A'}},role:'yonetici',loading:false};
 const useScopedResource=compile('src/components/ui/useScopedResource.ts',d.hooks,{},'useScopedResource');
 const hook=compile('src/components/modules/useNavigationModules.ts',d.hooks,{
  '@/context/AuthContext':{useAuth:()=>auth},'@/components/ui/useScopedResource':{useScopedResource},
  '@/lib/supabase/client':{createClient:()=>client},'@/lib/services/workspace-modules':{loadCurrentWorkspaceModules:load},
 },'useNavigationModules');
 return {render(){const v=d.render(hook,{});d.flush();return v;},auth(v){auth=v;},dispose:()=>d.dispose()};
}
test('navigation keeps closed modules false and failed reload discards old visibility',async()=>{
 let fail=false;const x=setup(async()=>{if(fail)throw Error('offline');return {modules:{finance:false,talent:true}};});
 assert.equal(x.render().modules,null);await settle();let state=x.render();assert.deepEqual(state.modules,{finance:false,talent:true});
 fail=true;await state.reload();state=x.render();assert.equal(state.modules,null);assert.equal(state.error,true);x.dispose();
});
test('navigation never shows the previous company while a new scope loads',async()=>{
 let finish;const x=setup(async(_,scope)=>scope.tenantId==='A'?new Promise(r=>finish=r):{modules:{finance:false}});
 x.render();x.auth({user:{id:'actor',app_metadata:{active_tenant:'B'}},role:'yonetici',loading:false});assert.equal(x.render().modules,null);
 await settle();assert.deepEqual(x.render().modules,{finance:false});finish({modules:{finance:true}});await settle();assert.deepEqual(x.render().modules,{finance:false});x.dispose();
});
test('navigation makes no request before identity is resolved',async()=>{
 let calls=0;const x=setup(async()=>{calls++;});x.auth({user:null,role:'goruntuleyici',loading:true});assert.equal(x.render().modules,null);await settle();assert.equal(calls,0);x.dispose();
});

test('desktop and mobile navigation intersect role and module visibility; core settings stay reachable',()=>{
 const d=driver();let modules=null,role='yonetici';
 const sidebar=compile('src/components/shell/Sidebar.tsx',d.hooks,{
  'next/link':{default:'a'},'next/navigation':{usePathname:()=>'/ayarlar'},
  'lucide-react':new Proxy({},{get:()=>()=>null}),'clsx':{clsx:()=>''},
  '@/context/RoleContext':{useRole:()=>({role})},
  '@/context/NavigationGuardContext':{useNavigationGuard:()=>({handle(){}})},
  '@/context/WorkspaceContext':{useWorkspace:()=>({workspace:{name:'Synthetic'},loading:false,error:false,reload:async()=>{}})},
  '@/components/modules/useNavigationModules':{useNavigationModules:()=>({modules,loading:modules===null,error:false,reload:async()=>{}})},
  '@/styles/tokens':{Z_SIDEBAR:''},
 });
 const links=()=>nodes(d.render(sidebar,{})).filter(n=>n.type==='a').map(n=>n.props.href);
 assert.equal(links().includes('/finansal-ozet'),false);assert.ok(links().includes('/ayarlar'));
 modules={finance:false,talent:true};assert.equal(links().includes('/finansal-ozet'),false);assert.equal(links().filter(x=>x==='/personel-havuzu').length,2);
 modules={finance:true};assert.equal(links().filter(x=>x==='/finansal-ozet').length,2);
 role='operasyon';assert.equal(links().includes('/finansal-ozet'),false);
});
