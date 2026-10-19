import test from 'node:test';import assert from 'node:assert/strict';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
const {parseModuleHistory}=await importActualTypeScript(new URL('../src/lib/modules/change-history.ts',import.meta.url));
const {MODULE_CATALOG}=await importActualTypeScript(new URL('../src/lib/modules/catalog.ts',import.meta.url));
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const all=Object.fromEntries(MODULE_CATALOG.map(m=>[m.key,true]));
const ctx={actorId:id(1),tenantId:id(2),membershipVersion:id(3),selectionVersion:null,name:'Synthetic',role:'yonetici',schemaVersion:1,catalogVersion:1,configRevision:'2',modules:{...all,finance:false}};
const make=()=>({context:ctx,entries:[{kind:'settings',revision:'2',createdAt:'2026-10-18T01:00:00+03:00',actorName:'Yönetici',before:all,after:ctx.modules},{kind:'bootstrap',revision:'1',createdAt:'2026-10-17T01:00:00+03:00',actorName:null,before:{},after:all}]});
test('history displays actual state differences and bootstrap separately',()=>{
 const rows=parseModuleHistory(make(),ctx);assert.deepEqual(rows[0].changes,[{key:'finance',enabled:false}]);assert.deepEqual(rows[1].changes,[]);
});
test('history rejects other tenant, stale revision, incomplete and repeated audit rows',()=>{
 for(const change of [v=>v.context={...ctx,tenantId:id(9)},v=>v.context={...ctx,configRevision:'3'},v=>v.entries.pop(),v=>v.entries[1]=v.entries[0],v=>v.entries.reverse(),v=>v.entries[0].createdAt='broken',v=>v.entries[0].after={...all,finance:'false'},v=>v.entries[0].after=all,v=>v.entries[1].before=all,v=>v.entries[1].after={...all,tasks:false},v=>v.context={...ctx,modules:all}]){const v=make();change(v);assert.throws(()=>parseModuleHistory(v,ctx));}
 assert.throws(()=>parseModuleHistory(make(),{...ctx,role:'operasyon'}));
});
import {compile,driver,nodes,settle} from './helpers/component-driver.mjs';
function setup(loader){const d=driver();const useScopedResource=compile('src/components/ui/useScopedResource.ts',d.hooks,{},'useScopedResource');const component=compile('src/app/(main)/ayarlar/ModuleChangeHistory.tsx',d.hooks,{
 '@/components/ui/useScopedResource':{useScopedResource},'@/lib/supabase/client':{createClient:()=>({})},'@/lib/services/workspace-modules':{loadModuleHistory:loader},'@/lib/modules/catalog':{MODULE_CATALOG}
 });return {render(context=ctx){const tree=d.render(component,{context});d.flush();return tree;},dispose:()=>d.dispose()};}
test('collapsed history makes no request; failure clears loaded entries',async()=>{
 let calls=0,fail=false;const x=setup(async()=>{calls++;if(fail)throw Error('offline');return parseModuleHistory(make(),ctx);});let tree=x.render();await settle();assert.equal(calls,0);
 nodes(tree).find(n=>n.type==='button').props.onClick();x.render();await settle();tree=x.render();assert.equal(calls,1);assert.ok(nodes(tree).some(n=>n.type==='time'));
 fail=true;nodes(tree).find(n=>n.props.children==='Geçmişi yenile').props.onClick();x.render();await settle();tree=x.render();assert.ok(nodes(tree).some(n=>n.props.role==='alert'));assert.equal(nodes(tree).filter(n=>n.type==='time').length,0);x.dispose();
});
test('late previous-company history is discarded',async()=>{
 let resolve;const x=setup(async(_,c)=>c.tenantId===ctx.tenantId?new Promise(r=>resolve=r):[]);let tree=x.render();nodes(tree).find(n=>n.type==='button').props.onClick();x.render();
 const next={...ctx,tenantId:id(8)};x.render(next);await settle();resolve(parseModuleHistory(make(),ctx));await settle();tree=x.render(next);assert.equal(nodes(tree).filter(n=>n.type==='time').length,0);x.dispose();
});

test('new catalog requires explicit refresh without projecting incomplete history',async()=>{
 const future={...ctx,catalogVersion:2,modules:{...ctx.modules,hr:true}};
 assert.throws(()=>parseModuleHistory({context:future,entries:[]},ctx),/MODULE_CLIENT_UPDATE_REQUIRED/);
 assert.throws(()=>parseModuleHistory({context:{...future,tenantId:id(9)},entries:[]},ctx),error=>!String(error).includes('MODULE_CLIENT_UPDATE_REQUIRED'));
 const x=setup(async()=>{throw Error('MODULE_CLIENT_UPDATE_REQUIRED');});let tree=x.render();
 nodes(tree).find(n=>n.type==='button').props.onClick();x.render();await settle();tree=x.render();
 assert.ok(nodes(tree).some(n=>n.props.role==='alert'));
 assert.ok(nodes(tree).some(n=>n.type==='button'&&n.props.children==='Sayfayı yenile'));
 assert.equal(nodes(tree).filter(n=>n.type==='time').length,0);x.dispose();
});

test('new catalog on refresh removes previously displayed audit entries',async()=>{
 let upgraded=false;const x=setup(async()=>{if(upgraded)throw Error('MODULE_CLIENT_UPDATE_REQUIRED');return parseModuleHistory(make(),ctx);});
 let tree=x.render();nodes(tree).find(n=>n.type==='button').props.onClick();x.render();await settle();tree=x.render();
 assert.equal(nodes(tree).filter(n=>n.type==='time').length,2);
 upgraded=true;nodes(tree).find(n=>n.props.children==='Geçmişi yenile').props.onClick();
 tree=x.render();assert.equal(nodes(tree).filter(n=>n.type==='time').length,0);
 await settle();tree=x.render();assert.equal(nodes(tree).filter(n=>n.type==='time').length,0);
 assert.ok(nodes(tree).some(n=>n.type==='button'&&n.props.children==='Sayfayı yenile'));x.dispose();
});

const {parseVersionedModuleHistory}=await importActualTypeScript(new URL('../src/lib/modules/change-history.ts',import.meta.url));
const {loadModuleHistory}=await importActualTypeScript(new URL('../src/lib/services/workspace-modules.ts',import.meta.url));
const versioned=()=>{const v=make();return {...v,historySchemaVersion:2,entries:v.entries.map(row=>({...row,beforeCatalogVersion:1,afterCatalogVersion:1}))};};
test('versioned history preserves validated legacy events without inferred metadata',()=>{
 assert.deepEqual(parseVersionedModuleHistory(versioned(),ctx),parseModuleHistory(make(),ctx));
 for(const mutate of [v=>delete v.historySchemaVersion,v=>v.historySchemaVersion=1,v=>delete v.entries[0].beforeCatalogVersion,v=>v.entries[0].afterCatalogVersion='1',v=>v.entries[0].afterCatalogVersion=2,v=>v.entries.pop(),v=>v.entries[0].after=all,v=>v.context={...ctx,tenantId:id(9)}]){
  const v=versioned();mutate(v);assert.throws(()=>parseVersionedModuleHistory(v,ctx));
 }
});
test('history service uses only versioned RPC and never falls back after failure',async()=>{
 const calls=[];let failure=null,payload=versioned();
 const client={rpc(name,args){calls.push({name,args});return {abortSignal:async()=>({data:payload,error:failure})};}};
 assert.deepEqual(await loadModuleHistory(client,ctx),parseModuleHistory(make(),ctx));
 assert.deepEqual(calls,[{name:'workspace_module_history_v2',args:{p_actor:ctx.actorId,p_tenant:ctx.tenantId}}]);
 failure={code:'PGRST202'};await assert.rejects(loadModuleHistory(client,ctx),e=>e===failure);assert.equal(calls.length,2);
 failure=null;payload=make();await assert.rejects(loadModuleHistory(client,ctx),/MODULE_HISTORY_VERSION/);assert.equal(calls.length,3);
});

const mixed=()=>{
 const first={...all,hr:false},last={...first,hr:true};
 return {historySchemaVersion:2,context:{...ctx,configRevision:'3',catalogVersion:2,modules:last},entries:[
 {kind:'settings',revision:'3',createdAt:'2026-10-19T01:00:00Z',actorName:'Yönetici',before:first,after:last,beforeCatalogVersion:2,afterCatalogVersion:2},
 {kind:'catalog_upgrade',revision:'2',createdAt:'2026-10-18T01:00:00Z',actorName:null,before:all,after:first,beforeCatalogVersion:1,afterCatalogVersion:2},
 {kind:'bootstrap',revision:'1',createdAt:'2026-10-17T01:00:00Z',actorName:null,before:{},after:all,beforeCatalogVersion:1,afterCatalogVersion:1}]};
};
const mixedExpected={...ctx,configRevision:'3',modules:all};
test('mixed history preserves upgrade and HR-only changes with original revisions',()=>{
 const rows=parseVersionedModuleHistory(mixed(),mixedExpected);
 assert.deepEqual(rows.map(r=>[r.revision,r.kind]),[['3','settings'],['2','catalog_upgrade'],['1','bootstrap']]);
 assert.deepEqual(rows[0].changes,[{key:'hr',enabled:true}]);assert.deepEqual(rows[1].changes,[]);
});
test('mixed history rejects fake upgrades, version gaps, incomplete snapshots and wrong scopes',()=>{
 for(const mutate of [v=>v.entries[1].actorName='Someone',v=>v.entries[1].kind='settings',v=>v.entries[1].beforeCatalogVersion=2,
 v=>v.entries[1].before={...all,finance:false},v=>v.entries[1].after.hr=true,v=>v.entries[0].before.hr=true,
 v=>delete v.context.modules.hr,v=>v.entries.splice(1,1),v=>v.context.tenantId=id(9),v=>v.entries[0].after.hr=false,
 v=>v.entries[2].beforeCatalogVersion=2,v=>v.context.modules.finance=false]){
 const value=mixed();mutate(value);assert.throws(()=>parseVersionedModuleHistory(value,mixedExpected));
 }
 const future=mixed();future.context.catalogVersion=3;
 assert.throws(()=>parseVersionedModuleHistory(future,mixedExpected),/MODULE_CLIENT_UPDATE_REQUIRED/);
});
test('new-company catalog-2 bootstrap and bounded recent history validate without a synthetic upgrade',()=>{
 const value=mixed();value.context.configRevision='1';value.context.modules.hr=false;
 value.entries=[{...value.entries[2],after:{...all,hr:false},beforeCatalogVersion:2,afterCatalogVersion:2}];
 assert.equal(parseVersionedModuleHistory(value,{...mixedExpected,configRevision:'1'})[0].kind,'bootstrap');
 const entries=[];let after={...all,hr:false};
 for(let revision=25;revision>5;revision--){const before={...after,hr:!after.hr};entries.push({kind:'settings',revision:String(revision),createdAt:'2026-10-19T00:00:00Z',actorName:'Manager',before,after,beforeCatalogVersion:2,afterCatalogVersion:2});after=before;}
 const window={historySchemaVersion:2,context:{...value.context,configRevision:'25'},entries};
 assert.equal(parseVersionedModuleHistory(window,{...mixedExpected,configRevision:'25'}).length,20);
});
test('history UI labels the system upgrade and HR changes without unknown catalog crashes',async()=>{
 const x=setup(async()=>parseVersionedModuleHistory(mixed(),mixedExpected));let tree=x.render(mixedExpected);
 nodes(tree).find(n=>n.type==='button').props.onClick();x.render(mixedExpected);await settle();tree=x.render(mixedExpected);
 assert.equal(nodes(tree).filter(n=>n.type==='time').length,3);
 assert.ok(nodes(tree).some(n=>n.props.children==='Modül altyapısı güncellendi'));x.dispose();
});
