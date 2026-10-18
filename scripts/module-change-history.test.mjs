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
