import test from 'node:test';
import assert from 'node:assert/strict';
import {compile} from './helpers/component-driver.mjs';
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
