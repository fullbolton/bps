import test from 'node:test';
import assert from 'node:assert/strict';
import {compile,driver,nodes,settle} from './helpers/component-driver.mjs';
function setup(loader, changesEnabled=false) {
 const d=driver();let auth={user:{id:'actor',app_metadata:{active_tenant:'A'}},role:'yonetici',loading:false};
 const useScopedResource=compile('src/components/ui/useScopedResource.ts',d.hooks,{},'useScopedResource');
 const panel=compile('src/app/(main)/ayarlar/WorkspaceModules.tsx',d.hooks,{
  './ModuleChangeHistory':{default:()=>null},
  './ModuleChangePreview':{default:()=>null},
  '@/context/AuthContext':{useAuth:()=>auth},
  '@/components/ui/useScopedResource':{useScopedResource},
  '@/lib/supabase/client':{createClient:()=>({})},
  '@/lib/services/module-change':{createModuleChangeCapability:()=>({prepare:()=>{},transport:async()=>{},refresh:async()=>{}})},
  '@/lib/services/workspace-modules':{loadCurrentWorkspaceModules:loader},
  '@/lib/modules/catalog':{MODULE_CATALOG:[{key:'customers',name:'Müşteriler',description:'Firma',requires:[]},{key:'documents',name:'Belgeler',description:'Evrak',requires:['customers']}]},
 });
 return {render(){const tree=d.render(panel,{changesEnabled});d.flush();return tree;},auth(next){auth=next;},dispose:()=>d.dispose()};
}
const data=name=>({name,modules:{customers:true,documents:false}});
test('module panel reads only for a verified manager and never invents default module states',async()=>{
 let calls=0;const x=setup(async()=>{calls++;return data('A');});
 for(const auth of [{loading:true,role:'yonetici',user:null},{loading:false,role:'operasyon',user:{id:'actor',app_metadata:{active_tenant:'A'}}},{loading:false,role:'yonetici',user:null}]){
  x.auth(auth);const tree=x.render();await settle();assert.equal(calls,0);assert.equal(nodes(tree).filter(n=>n.type==='li').length,0);
 }x.dispose();
});
test('module panel shows server states and dependencies without mutation controls',async()=>{
 const x=setup(async()=>data('A'));x.render();await settle();const tree=x.render();
 assert.equal(nodes(tree).filter(n=>n.type==='li').length,2);
 assert.ok(nodes(tree).some(n=>n.props?.children==='Açık'));assert.ok(nodes(tree).some(n=>n.props?.children==='Kapalı'));
 assert.equal(nodes(tree).filter(n=>n.type==='button').length,1);
 assert.equal(nodes(tree).filter(n=>n.type==='input').length,0);x.dispose();
});
test('failed reload clears previous settings instead of showing stale configuration',async()=>{
 let fail=false;const x=setup(async()=>{if(fail)throw Error('offline');return data('A');});
 x.render();await settle();let tree=x.render();fail=true;
 nodes(tree).find(n=>n.type==='button').props.onClick();x.render();await settle();tree=x.render();
 assert.equal(nodes(tree).filter(n=>n.type==='li').length,0);assert.ok(nodes(tree).some(n=>n.props?.role==='alert'));x.dispose();
});
test('late previous-company response never appears in the new company panel',async()=>{
 let finishA;const x=setup(async(_,scope)=>scope.tenantId==='A'?new Promise(r=>{finishA=r;}):data('B'));
 x.render();x.auth({user:{id:'actor',app_metadata:{active_tenant:'B'}},role:'yonetici',loading:false});x.render();await settle();x.render();
 finishA(data('Old company'));await settle();const tree=x.render();
 assert.ok(nodes(tree).some(n=>n.props?.children==='B'));assert.ok(!nodes(tree).some(n=>n.props?.children==='Old company'));x.dispose();
});

test('module editor receives a commit capability only with explicit release opt-in',async()=>{
 for(const enabled of [false,true]){
  const x=setup(async()=>data('A'),enabled);x.render();await settle();const tree=x.render();
  const preview=nodes(tree).find(n=>typeof n.type==='function'&&n.props.context&&'commit' in n.props);
  assert.ok(preview);assert.equal(!!preview.props.commit,enabled);x.dispose();
 }
});

test('new catalog clears editor and asks for full refresh instead of retrying old client',async()=>{
 const x=setup(async()=>{throw Error('MODULE_CLIENT_UPDATE_REQUIRED');},true);
 x.render();await settle();const tree=x.render();
 assert.equal(nodes(tree).filter(n=>n.type==='li').length,0);
 assert.ok(nodes(tree).some(n=>n.type==='button'&&n.props.children==='Sayfayı yenile'));
 assert.equal(nodes(tree).filter(n=>typeof n.type==='function'&&n.props.context).length,0);x.dispose();
});
