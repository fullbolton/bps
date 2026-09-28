import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
import {id} from './fixtures/daily-operations.mjs';
const require=createRequire(import.meta.url);
const {dashboardModuleAccess}=await importActualTypeScript(new URL('../src/lib/modules/dashboard-access.ts',import.meta.url));
const {MODULE_CATALOG,parseModuleStates}=await importActualTypeScript(new URL('../src/lib/modules/catalog.ts',import.meta.url));
const {loadCurrentWorkspaceModules}=await importActualTypeScript(new URL('../src/lib/services/workspace-modules.ts',import.meta.url));
const all=Object.fromEntries(MODULE_CATALOG.map(module=>[module.key,true]));
const identity={actorId:id(11),tenantId:id(1),role:'yonetici'};
const workspace={...identity,name:'Synthetic',selectionVersion:null,membershipVersion:id(33),schemaVersion:1,catalogVersion:1,configRevision:'1',modules:all};

// A small deterministic hook driver for executing actual component callbacks/effects.
// This is not a DOM/browser test: child shells, routing and network are injected.
function driver() {
 const slots=[],effects=[]; let cursor=0;
 const depsChanged=(a,b)=>!a||!b||a.length!==b.length||a.some((x,i)=>x!==b[i]);
 const hooks={
  useState(initial){const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return [slots[i],v=>{slots[i]=typeof v==='function'?v(slots[i]):v;}];},
  useRef(initial){const i=cursor++;return slots[i]??(slots[i]={current:initial});},
  useId(){return 'synthetic-id';},
  useMemo(fn,deps){const i=cursor++;if(!slots[i]||depsChanged(slots[i].deps,deps))slots[i]={deps,value:fn()};return slots[i].value;},
  useCallback(fn,deps){return hooks.useMemo(()=>fn,deps);},
  useEffect(fn,deps){const i=cursor++;if(!slots[i]||depsChanged(slots[i].deps,deps)){const old=slots[i];slots[i]={deps};effects.push(()=>{old?.cleanup?.();slots[i].cleanup=fn();});}},
 };
 return {hooks,render(component,props){cursor=0;return component(props);},flush(){for(const effect of effects.splice(0))effect();},dispose(){for(const s of slots)s?.cleanup?.();}};
}
function compile(path,hooks,dependencies={}) {
 const exports={};
 const code=ts.transpileModule(readFileSync(new URL('../'+path,import.meta.url),'utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(code,{exports,console,Date,Map,Set,Intl,Error,require(spec){
  if(spec==='react')return {...require('react'),...hooks};
  if(spec==='react/jsx-runtime')return require(spec);
  if(spec in dependencies)return dependencies[spec];
  throw Error('Unexpected dependency '+spec);
 }});
 return exports.default;
}
function nodes(tree) {
 if(Array.isArray(tree))return tree.flatMap(nodes);
 if(!tree||typeof tree!=='object')return [];
 return [tree,...nodes(tree.props?.children)];
}
const settle=()=>new Promise(resolve=>setImmediate(resolve));

test('all valid module combinations intersect dashboard roles, without enabling dependent sections',()=>{
 let valid=0;
 for(let mask=0;mask<1024;mask++){
  let modules;try{modules=parseModuleStates(Object.fromEntries(MODULE_CATALOG.map((m,i)=>[m.key,!!(mask&(1<<i))])));}catch{continue;}
  valid++;
  for(const role of ['yonetici','operasyon','ik','partner','muhasebe','goruntuleyici']){
   const access=dashboardModuleAccess({modules,role});
   for(const [key,enabled] of Object.entries(access))if(enabled)assert.equal(modules[key],true);
   if(['partner','muhasebe','goruntuleyici'].includes(role))assert.equal(access.tasks,false);
   if(role!=='yonetici'&&role!=='operasyon')assert.equal(access.staffing,false);
  }
 }
 assert.ok(valid>0);
 const independent=dashboardModuleAccess({role:'yonetici',modules:parseModuleStates({...Object.fromEntries(MODULE_CATALOG.map(m=>[m.key,false])),tasks:true})});
 assert.equal(independent.tasks,true);assert.equal(independent.customers,false);
});

test('shared loader rejects malformed/foreign snapshots and transport errors',async()=>{
 const client=value=>({rpc:()=>({abortSignal:async()=>({data:value,error:null})})});
 assert.equal((await loadCurrentWorkspaceModules(client(workspace),identity)).tenantId,identity.tenantId);
 for(const delta of [{actorId:id(12)},{tenantId:id(2)},{role:'ik'},{modules:{}},{membershipVersion:null},{configRevision:1}])await assert.rejects(loadCurrentWorkspaceModules(client({...workspace,...delta}),identity));
 await assert.rejects(loadCurrentWorkspaceModules({rpc:()=>({abortSignal:async()=>{throw Error('offline');}})},identity),/Çalışma alanı ayarları doğrulanamadı/);
});

function boundary(load,{loading=false,user={id:identity.actorId,app_metadata:{active_tenant:identity.tenantId}},role='yonetici'}={}){
 const d=driver();const client={};
 const Component=compile('src/components/modules/WorkspaceModuleBoundary.tsx',d.hooks,{
  '@/context/AuthContext':{useAuth:()=>({loading,user})},'@/context/RoleContext':{useRole:()=>({role})},
  '@/lib/supabase/client':{createClient:()=>client},'@/lib/services/workspace-modules':{loadCurrentWorkspaceModules:load},'@/components/ui':{EmptyState:'EmptyState'},
 });
 return {d,Component};
}
test('page boundary never mounts business readers before validation; off, error and role denial remain distinct',async()=>{
 let reads=0;const child=()=>{reads++;return 'business';};
 for(const [load,expected] of [[async()=>({...workspace,modules:{...all,tasks:false}}),'Bu modül kapalı'],[async()=>{throw Error('offline');},'Çalışma alanı yüklenemedi'],[async()=>workspace,'business']]){
  const {d,Component}=boundary(load);const outer=d.render(Component,{requiredModule:'tasks',children:child});
  const before=reads;assert.equal(d.render(outer.type,outer.props).props.title,'Yükleniyor…');assert.equal(reads,before);
  d.flush();await settle();const result=d.render(outer.type,outer.props);
  assert.equal(typeof result==='string'?result:result.props.title,expected);assert.equal(reads,before+(expected==='business'?1:0));d.dispose();
 }
 const {d,Component}=boundary(async()=>{throw Error('must not load');},{role:'partner'});
 assert.equal(d.render(Component,{allowedRoles:['yonetici'],children:child}).props.title,'Erişim kısıtlı');
});
test('page boundary retries failed settings and ignores a response after unmount',async()=>{
 let resolve,calls=0;
 const {d,Component}=boundary(()=>++calls===1?Promise.reject(Error('offline')):new Promise(r=>{resolve=r;}));
 const outer=d.render(Component,{children:()=>{throw Error('business must not mount');}});
 d.render(outer.type,outer.props);d.flush();await settle();
 d.render(outer.type,outer.props).props.action.onClick();
 d.render(outer.type,outer.props);d.flush();assert.equal(calls,2);
 d.dispose();resolve(workspace);await settle();
 assert.equal(d.render(outer.type,outer.props).props.title,'Yükleniyor…');
});

function completion(allowTaskCreation,onComplete){
 const d=driver();const Component=compile('src/components/modals/AppointmentResultModal.tsx',d.hooks,{
  '@/components/ui':{ModalShell:'ModalShell'},'@/components/ui/ConfirmActionDialog':{default:'ConfirmActionDialog'},
 });
 const props={open:true,onClose(){},actorId:identity.actorId,randevuId:id(101),allowTaskCreation,onComplete};
 const render=()=>d.render(Component,props);
 render();d.flush();let tree=render();
 for(const text of nodes(tree).filter(n=>n.type==='textarea'))text.props.onChange({target:{value:'Synthetic result'}});
 return {d,render};
}
test('actual completion form explicitly sends task true, unchecked false, and unavailable false',async()=>{
 for(const [allowed,uncheck,want] of [[true,false,true],[true,true,false],[false,false,false]]){
  let payload;const {render}=completion(allowed,value=>{payload=value;});let tree=render();
  const checkbox=nodes(tree).find(n=>n.type==='input'&&n.props.type==='checkbox');assert.equal(!!checkbox,allowed);
  if(uncheck){checkbox.props.onChange({target:{checked:false}});tree=render();}
  nodes(tree).find(n=>n.type==='form').props.onSubmit({preventDefault(){}});await settle();
  assert.equal(payload.createTask,want);assert.equal(payload.randevuId,id(101));assert.equal(payload.sonuc,'Synthetic result');
 }
});
test('failed completion preserves both result fields and shows a retryable error',async()=>{
 const {render}=completion(false,async()=>{throw Error('Synthetic network error');});
 nodes(render()).find(n=>n.type==='form').props.onSubmit({preventDefault(){}});await settle();
 const tree=render();assert.deepEqual(nodes(tree).filter(n=>n.type==='textarea').map(n=>n.props.value),['Synthetic result','Synthetic result']);
 assert.ok(nodes(tree).some(n=>n.props?.role==='alert'&&n.props.children==='Synthetic network error'));
});

const counted=await importActualTypeScript(new URL('../src/lib/supabase/complete-result.ts',import.meta.url));
const references=await importActualTypeScript(new URL('../src/lib/supabase/company-references.ts',import.meta.url));
const tokens=await importActualTypeScript(new URL('../src/styles/tokens.ts',import.meta.url));
async function dashboard(modules,role='yonetici'){
 const d=driver(),calls=[];
 const task={id:id(401),title:'Synthetic task',company_id:id(201),status:'acik',due_date:null,assigned_to_user_id:null,assigned_to:null,revision:1};
 const client={auth:{getUser:async()=>({data:{user:{id:identity.actorId}},error:null})},from(table){calls.push(table);const q={select(){return q;},eq(){return q;},in(){return q;},then(resolve){return Promise.resolve({data:table==='tasks'?[task]:[],count:table==='tasks'?1:0,error:null}).then(resolve);}};return q;}};
 const reader=name=>async()=>{calls.push(name);return [];};
 const Component=compile('src/app/(main)/dashboard/DashboardClient.tsx',d.hooks,{
  '@/components/modules/WorkspaceModuleBoundary':{default:'Boundary'},'@/lib/modules/dashboard-access':{dashboardModuleAccess},
  '@/lib/supabase/complete-result':counted,'@/lib/supabase/company-references':references,
  '@/components/ui/useIstanbulDay':{useIstanbulDay:()=>'2026-09-28'},'../gorevler/actions':{claimTaskAction:()=>{throw Error('unexpected write');}},
  'next/link':{default:'Link'},'@/lib/task-link':{taskLinkHref:value=>'/gorevler?id='+value},'@/lib/supabase/client':{createClient:()=>client},
  'lucide-react':Object.fromEntries(['Building2','FileText','ListChecks','CalendarCheck','AlertTriangle','Megaphone','ArrowUpRight','CalendarDays','UserCheck','Clock','Trash2'].map(name=>[name,name])),
  '@/components/ui':{PageHeader:'PageHeader',KPIStatCard:'KPIStatCard',ContractExpiryCard:'ContractExpiryCard',EmptyState:'EmptyState',ModalShell:'ModalShell'},
  '@/components/ui/AsyncSection':{default:'AsyncSection'},
  '@/lib/supabase/dashboard-cards':{selectDashboardContracts:reader('contract-card'),selectDashboardDocuments:reader('document-card'),selectDashboardDeadlines:reader('deadlines'),selectDashboardCompanyNames:async()=>{calls.push('company-names');return new Map([[id(201),'Synthetic company']]);},dashboardRemainingDays:()=>1},
  clsx:{clsx:()=>''},'@/lib/format-date':{formatDateTR:v=>v},'@/context/RoleContext':{useRole:()=>({role})},
  '@/lib/services/announcements':{listRecentAnnouncements:reader('announcements'),ANNOUNCEMENT_MAX_LENGTH:4000},
  './actions':{createAnnouncementAction:()=>{throw Error('unexpected write');},deleteAnnouncementAction:()=>{throw Error('unexpected write');}},
  '@/lib/critical-date-types':{CRITICAL_DATE_TYPE_LABELS:{}},'./DailyOverview':{default:'DailyOverview'},'./RecentActivities':{default:'RecentActivities'},'@/styles/tokens':tokens,
 });
 const outer=Component({operationsEnabled:true});const inner=outer.props.children({...workspace,modules,role});
 d.render(inner.type,inner.props);d.flush();await settle();const tree=d.render(inner.type,inner.props);d.dispose();
 return {tree,calls};
}
test('actual dashboard skips disabled queries/cards; independent tasks work without company lookup',async()=>{
 const off=Object.fromEntries(MODULE_CATALOG.map(m=>[m.key,false]));
 const closed=await dashboard(off);assert.deepEqual(closed.calls,['deadlines']);
 assert.equal(nodes(closed.tree).filter(n=>n.type==='KPIStatCard').length,0);
 assert.ok(!nodes(closed.tree).some(n=>n.type==='DailyOverview'));
 const independent=await dashboard({...off,tasks:true});assert.deepEqual(independent.calls,['tasks','deadlines']);
 const stats=nodes(independent.tree).filter(n=>n.type==='KPIStatCard');assert.equal(stats.length,1);assert.equal(stats[0].props.value,1);
 assert.ok(nodes(independent.tree).some(n=>n.props?.children==='Firma modülü kapalı'));
 assert.ok(!nodes(independent.tree).some(n=>n.props?.children==='Firma dışı görev'));
});
test('actual dashboard fetches enabled sections but never offers partner task access',async()=>{
 const manager=await dashboard(all);
 assert.deepEqual(manager.calls,['companies','contracts','tasks','appointments','contract-card','document-card','deadlines','announcements','company-names']);
 const partner=await dashboard(all,'partner');assert.ok(!partner.calls.includes('tasks'));
 assert.ok(!nodes(partner.tree).some(n=>n.props?.href==='/gorevler'));
});
