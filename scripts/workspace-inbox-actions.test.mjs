import test from 'node:test';
import assert from 'node:assert/strict';
import {compile,driver,nodes,settle} from './helpers/component-driver.mjs';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
const state=await importActualTypeScript(new URL('../src/lib/notifications/inbox-state.ts',import.meta.url));
const contract=await importActualTypeScript(new URL('../src/lib/notifications/workspace-inbox.ts',import.meta.url));
const validation=await importActualTypeScript(new URL('../src/lib/operations/pilot-validation.ts',import.meta.url));
const presentation=await importActualTypeScript(new URL('../src/lib/notifications/inbox-presentation.ts',import.meta.url));
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const scope={actorId:id(1),tenantId:id(2)};
function setup({enabled=true,actor=id(1),tenant=id(2),data=true,error=null}={}){
 const calls=[];
 const client={auth:{getUser:async()=>({data:{user:actor?{id:actor}:null},error:null})},rpc:async(name,args)=>{calls.push({name,args});return name==='current_user_verified_tenant'?{data:tenant,error:null}:{data,error};}};
 const deps={'@/lib/supabase/server':{createServerSupabaseClient:async()=>client},'@/lib/notifications/inbox-state':state,'@/lib/notifications/workspace-inbox':contract,'@/lib/operations/pilot-validation':validation};
 const load=name=>compile('src/app/(main)/bildirimler/actions.ts',{},deps,name,{process:{env:{NEXT_PUBLIC_BPS_WORKSPACE_INBOX_ENABLED:enabled?'true':'false'}}});
 return {page:load('workspaceInbox'),read:load('workspaceInboxRead'),calls};
}
test('disabled flag and mismatched account/company never reach inbox RPC',async()=>{
 for(const config of [{enabled:false},{actor:null},{actor:id(3)},{tenant:id(3)},{tenant:null}]){
  const x=setup(config);assert.equal((await x.page(scope)).ok,false);assert.equal((await x.read(scope,{kind:'announcement',id:id(4)})).ok,false);assert.ok(x.calls.every(c=>c.name==='current_user_verified_tenant'));
 }
});
test('malformed cursor and empty read cannot be treated as successful writes',async()=>{
 for(const value of [{kind:'bad',id:id(4)},{kind:'announcement',id:'bad'},undefined]){const x=setup();assert.equal((await x.read(scope,value)).ok,false);assert.equal(x.calls.length,0);}
 const x=setup();assert.equal((await x.page(scope,{id:id(4)})).ok,false);assert.equal(x.calls.length,0);
});
test('page validates response scope and exact cursor forwarding',async()=>{
 const data={...scope,items:[],unread:0,nextCursor:null};const x=setup({data});const cursor={kind:'task_assignment',id:id(4)};
 assert.equal((await x.page(scope,cursor)).ok,true);assert.deepEqual(JSON.parse(JSON.stringify(x.calls[1])),{name:'workspace_inbox_page_v1',args:{p_actor:scope.actorId,p_tenant:scope.tenantId,p_before_kind:cursor.kind,p_before_id:cursor.id}});
 for(const bad of [{...data,tenantId:id(9)},{...data,unread:null},null])assert.equal((await setup({data:bad}).page(scope)).ok,false);
});
test('acknowledgement requires strict true and returns verified scope; internal errors stay private',async()=>{
 const cursor={kind:'announcement',id:id(4)};
 assert.deepEqual(JSON.parse(JSON.stringify(await setup().read(scope,cursor))),{ok:true,...scope});
 for(const data of [null,'true',false,1])assert.equal((await setup({data}).read(scope,cursor)).ok,false);
 const failure=await setup({error:{message:'SECRET SQL DETAIL'}}).read(scope,cursor);assert.equal(failure.ok,false);assert.doesNotMatch(failure.message,/SECRET/);
});
test('each source opens its existing destination or a complete inline announcement',()=>{
 const base={id:id(4),createdAt:'2026-10-18T01:00:00Z',readAt:null};
 assert.equal(presentation.inboxPresentation({...base,kind:'task_assignment',payload:{taskId:id(5),title:'Task'}}).href,`/gorevler?gorev=${id(5)}`);
 const body='Long announcement\n'.repeat(100);const a=presentation.inboxPresentation({...base,kind:'announcement',payload:{announcementId:id(6),body}});assert.equal(a.href,null);assert.equal(a.body,body);
 assert.match(presentation.inboxPresentation({...base,kind:'conversation',payload:{companyId:id(7),requestId:id(8),workDate:'2026-10-18',companyName:'Company',body:'Message'}}).href,/gun=2026-10-18&talep=/);
});
test('unified roles do not broaden legacy conversation inbox access',()=>{
 for(const role of ['yonetici','operasyon','ik','muhasebe','goruntuleyici']){assert.equal(presentation.canUseInbox(role,true,false),true);assert.equal(presentation.canUseInbox(role,false,true),['yonetici','operasyon'].includes(role));assert.equal(presentation.canUseInbox(role,false,false),false);}
 assert.equal(presentation.canUseInbox('partner',true,true),false);assert.equal(presentation.canUseInbox('partner',false,true),false);assert.equal(presentation.canUseInbox(null,true,true),false);assert.equal(presentation.canUseInbox('unknown',true,true),false);
});

test('actual inbox shell hides unauthorized/loading scopes and remounts on role or company changes',()=>{
 let auth={user:{},role:'yonetici',loading:false};let currentScope={...scope};
 const deps={
  'next/link':{default:()=>null},'lucide-react':{Bell:()=>null,X:()=>null,RefreshCw:()=>null},
  '@/context/AuthContext':{useAuth:()=>auth},'@/context/NavigationGuardContext':{},
  '@/lib/workspace-context':{workspaceScope:()=>currentScope},
  '@/app/(main)/iletisim/actions':{},'@/app/(main)/bildirimler/actions':{},
  '@/lib/notifications/workspace-inbox':contract,'@/lib/notifications/inbox-presentation':presentation,
  '@/lib/notifications/inbox-state':state,'@/context/NotificationSoundContext':{},
  './NotificationSoundControls':{default:()=>null},
 };
 const render=compile('src/components/communication/ConversationInbox.tsx',{},deps,'default',{process:{env:{NEXT_PUBLIC_BPS_WORKSPACE_INBOX_ENABLED:'true'}}});
 const keys=new Set();
 for(const role of ['yonetici','operasyon','ik','muhasebe','goruntuleyici']){auth.role=role;const node=render();assert.ok(node);keys.add(node.key);assert.equal(node.props.actorId,scope.actorId);assert.equal(node.props.tenantId,scope.tenantId);}
 assert.equal(keys.size,5,'role change must discard old source list and pending callbacks');
 const before=render().key;currentScope={...scope,tenantId:id(9)};assert.notEqual(render().key,before);
 for(const role of ['partner','unknown',null]){auth.role=role;assert.equal(render(),null);}
 auth.role='yonetici';auth.loading=true;assert.equal(render(),null);
 auth.loading=false;currentScope=null;assert.equal(render(),null);
});

const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
const inboxItem=n=>({kind:'announcement',id:id(n),createdAt:'2026-10-18T01:00:00Z',readAt:null,payload:{announcementId:id(n+100),body:'Synthetic '+n}});
const inboxPage=(items=[inboxItem(10)],extra={})=>({ok:true,...scope,items,unread:items.length,nextCursor:null,...extra});
function panelHarness(){
 const d=driver(),events=new Map(),timers=new Set(),calls=[],replies=[];const nav={onLine:true};let ack=async()=>({ok:true,...scope});let reads=0;
 const eventTarget={addEventListener:(name,fn)=>events.set(name,fn),removeEventListener:(name)=>events.delete(name)};
 const deps={
  'next/link':{default:'a'},'lucide-react':{Bell:()=>null,X:()=>null,RefreshCw:()=>null},
  '@/context/AuthContext':{useAuth:()=>({user:{},role:'yonetici',loading:false})},
  '@/context/NavigationGuardContext':{useNavigationGuard:()=>({handle:()=>{}})},
  '@/lib/workspace-context':{workspaceScope:()=>scope},'@/app/(main)/iletisim/actions':{},
  '@/app/(main)/bildirimler/actions':{workspaceInbox:async(s,c)=>{calls.push({s,c});return replies.length?await replies.shift():inboxPage();},workspaceInboxRead:async()=>{reads++;return ack();}},
  '@/lib/notifications/workspace-inbox':contract,'@/lib/notifications/inbox-presentation':presentation,'@/lib/notifications/inbox-state':state,
  '@/context/NotificationSoundContext':{useNotificationSound:()=>({active:false})},'./NotificationSoundControls':{default:()=>null},
 };
 const shell=compile('src/components/communication/ConversationInbox.tsx',d.hooks,deps,'default',{
  process:{env:{NEXT_PUBLIC_BPS_WORKSPACE_INBOX_ENABLED:'true'}},navigator:nav,
  document:{...eventTarget,visibilityState:'visible'},window:{...eventTarget,setInterval:fn=>{timers.add(fn);return fn;}},clearInterval:fn=>timers.delete(fn),
 });
 const scoped=shell();let tree;
 const render=()=>{tree=d.render(scoped.type,scoped.props);d.flush();return tree;};
 const button=label=>nodes(tree).find(n=>n.type==='button'&&(n.props['aria-label']?.startsWith(label)||nodes(n.props.children).length===0&&n.props.children===label||Array.isArray(n.props.children)&&n.props.children.includes(label)));
 return {calls,replies,nav,render,button,elements:()=>nodes(tree),rows:()=>nodes(tree).filter(n=>n.type==='li'),alerts:()=>nodes(tree).filter(n=>n.props?.role==='alert'),get reads(){return reads;},ack:fn=>{ack=fn;},event:name=>events.get(name)?.(),poll:()=>{for(const fn of timers)fn();},dispose:()=>d.dispose()};
}
async function openPanel(x){x.render();await settle();x.render();x.button('Bildirimler').props.onClick();await settle();x.render();}

test('panel drops stale rows and unread count after refresh or read failures',async()=>{
 for(const action of ['refresh','read']){
  const x=panelHarness();await openPanel(x);assert.equal(x.rows().length,1);
  if(action==='refresh'){x.replies.push({ok:false,message:'Could not verify'});x.button('Yenile').props.onClick();}
  else{x.ack(async()=>({ok:false,message:'Could not verify'}));x.button('Okundu işaretle').props.onClick();}
  await settle();x.render();assert.equal(x.rows().length,0,action);assert.equal(x.alerts().length,1);assert.match(x.button('Bildirimler').props['aria-label'],/Kontrol edilemedi/);x.dispose();
 }
});
test('panel suppresses double acknowledgement and refreshes only after confirmed success',async()=>{
 const x=panelHarness();await openPanel(x);const pending=deferred();x.ack(()=>pending.promise);const callback=x.button('Okundu işaretle').props.onClick;callback();callback();assert.equal(x.reads,1);const before=x.calls.length;
 x.replies.push(inboxPage([{...inboxItem(10),readAt:'2026-10-18T02:00:00Z'}],{unread:0}));pending.resolve({ok:true,...scope});await settle();x.render();assert.equal(x.calls.length,before+1);assert.match(x.button('Bildirimler').props['aria-label'],/0 okunmamış/);x.dispose();
});
test('expanded history pauses polling, but reconnect discards cached rows until fresh verification',async()=>{
 const x=panelHarness();x.replies.push(inboxPage(),inboxPage([inboxItem(10)],{nextCursor:{kind:'announcement',id:id(10)}}));await openPanel(x);
 x.replies.push(inboxPage([inboxItem(9)]));x.button('Önceki bildirimler').props.onClick();await settle();x.render();assert.equal(x.rows().length,2);const before=x.calls.length;x.poll();assert.equal(x.calls.length,before);
 x.nav.onLine=false;x.event('offline');x.render();assert.equal(x.rows().length,0);
 const pending=deferred();x.replies.push(pending.promise);x.nav.onLine=true;x.event('online');x.render();assert.equal(x.calls.length,before+1);assert.equal(x.rows().length,0);
 pending.resolve(inboxPage([inboxItem(20)]));await settle();x.render();assert.equal(x.rows().length,1);x.dispose();
});
test('wrong-company response clears the panel; response after unmount is ignored',async()=>{
 const x=panelHarness();await openPanel(x);x.replies.push(inboxPage([inboxItem(20)],{tenantId:id(99)}));x.button('Yenile').props.onClick();await settle();x.render();assert.equal(x.rows().length,0);assert.equal(x.alerts().length,1);
 const pending=deferred();x.replies.push(pending.promise);x.button('Yenile').props.onClick();x.dispose();pending.resolve(inboxPage([inboxItem(30)]));await settle();assert.equal(x.rows().length,0);
});
test('reconnect during a pending request ignores its old result and schedules one fresh read',async()=>{
 for(const operation of ['page','ack']){
  const x=panelHarness();await openPanel(x);const pending=deferred();
  if(operation==='page'){x.replies.push(pending.promise);x.button('Yenile').props.onClick();}
  else{x.ack(()=>pending.promise);x.button('Okundu işaretle').props.onClick();}
  const before=x.calls.length;x.nav.onLine=false;x.event('offline');x.render();
  x.replies.push(inboxPage([inboxItem(40)]));x.nav.onLine=true;x.event('online');x.event('online');x.render();assert.equal(x.rows().length,0);
  pending.resolve(operation==='page'?inboxPage([inboxItem(99)]):{ok:true,...scope});await settle();x.render();
  assert.equal(x.calls.length,before+1);assert.equal(x.rows().length,1);assert.equal(x.rows()[0].key,'announcement:'+id(40));x.dispose();
 }
});
test('offline clicks send no reads or acknowledgements and late responses do not repopulate cache',async()=>{
 const x=panelHarness();await openPanel(x);const refresh=x.button('Yenile').props.onClick,ack=x.button('Okundu işaretle').props.onClick;
 const pending=deferred();x.replies.push(pending.promise);refresh();const before=x.calls.length;
 x.nav.onLine=false;x.event('offline');refresh();ack();pending.resolve(inboxPage([inboxItem(99)]));await settle();x.render();assert.equal(x.calls.length,before);assert.equal(x.reads,0);assert.equal(x.rows().length,0);x.dispose();
});


test('inbox filters compose over loaded pages without changing global unread or pagination',async()=>{
 const x=panelHarness();const task={...inboxItem(11),kind:'task_assignment',payload:{taskId:id(111),title:'İZMİR şubesi'}};
 const read={...inboxItem(12),readAt:'2026-10-18T02:00:00Z'};
 x.replies.push(inboxPage(),inboxPage([inboxItem(10),task,read],{unread:8,nextCursor:{kind:'announcement',id:id(12)}}));await openPanel(x);
 x.elements().find(n=>n.type==='input'&&n.props.type==='search').props.onChange({target:{value:'izmir'}});x.render();assert.equal(x.rows().length,1);assert.equal(x.rows()[0].key,'task_assignment:'+id(11));assert.match(x.button('Bildirimler').props['aria-label'],/8 okunmamış/);assert.ok(x.button('Önceki bildirimler'));
 x.elements().find(n=>n.type==='select').props.onChange({target:{value:'announcement'}});x.render();assert.equal(x.rows().length,0);assert.ok(x.button('Önceki bildirimler'));
 x.button('Filtreleri temizle').props.onClick();x.render();assert.equal(x.rows().length,3);
 x.elements().find(n=>n.type==='input'&&n.props.type==='checkbox').props.onChange({target:{checked:true}});x.render();assert.equal(x.rows().length,2);
 x.replies.push(inboxPage([inboxItem(9)],{unread:8}));x.button('Önceki bildirimler').props.onClick();await settle();x.render();assert.equal(x.rows().length,3);assert.match(x.button('Bildirimler').props['aria-label'],/8 okunmamış/);x.dispose();
});
