/** Real local Auth/RPC acceptance. Applies only to the validated dedicated synthetic database. */
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {randomUUID,createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';
import {createServerClient} from '@supabase/ssr';
import {validateLocalStatus,acquireLock} from './helpers/acceptance-runner.mjs';
import {id} from './fixtures/daily-operations.mjs';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
const run=(cmd,args,input)=>execFileSync(cmd,args,{input,encoding:'utf8',stdio:['pipe','pipe','pipe'],timeout:20000});
const container='supabase_db_bps-supabase-acceptance',users=[],company=randomUUID(),location=randomUUID(),request=randomUUID();
let release,admin,sql;
try{
 const s=JSON.parse(run('supabase',['status','--workdir','/private/tmp/bps-supabase-acceptance','-o','json']));
 const [db,gateway]=JSON.parse(run('docker',['inspect',container,'supabase_kong_bps-supabase-acceptance']));
 validateLocalStatus(s,readFileSync('/private/tmp/bps-supabase-acceptance/supabase/config.toml','utf8'),db,gateway);release=acquireLock();
 sql=q=>run('docker',['exec','-i',container,'psql','-X','-qAt','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1'],q).trim();
 assert.equal(sql("SELECT obj_description(to_regclass('public.documents'))='BPS synthetic documents fixture v1'"),'t');
 const migration=readFileSync('supabase/migrations/20260910000200_request_conversation.sql','utf8');
 const marker='BPS local conversation source '+createHash('sha256').update(migration).digest('hex');
 if(sql("SELECT to_regclass('public.ops_messages') IS NULL")==='t'){
  // Include the provenance marker in the same transaction as the DDL.
  sql(migration.replace(/COMMIT;\s*$/,`COMMENT ON TABLE public.ops_messages IS '${marker}';COMMIT;`));
  sql("NOTIFY pgrst, 'reload schema'");
 }else assert.equal(sql("SELECT obj_description('public.ops_messages'::regclass)"),marker,'Existing local schema has different provenance; refusing overwrite');
 const readSql=readFileSync('supabase/migrations/20260910000300_conversation_read_surfaces.sql','utf8');
 const readMarker='BPS local conversation reads '+createHash('sha256').update(readSql).digest('hex');
 if(sql("SELECT to_regprocedure('public.ops_comment_people(uuid,uuid,uuid)') IS NULL")==='t'){
  sql(readSql.replace(/COMMIT;\s*$/,`COMMENT ON TABLE public.ops_message_notifications IS '${readMarker}';COMMIT;`));sql("NOTIFY pgrst, 'reload schema'");
 }else assert.equal(sql("SELECT obj_description('public.ops_message_notifications'::regclass)"),readMarker);
 const recoverySql=readFileSync('supabase/migrations/20260910000400_comment_command_recovery.sql','utf8');
 const recoveryMarker='BPS local conversation recovery '+createHash('sha256').update(recoverySql).digest('hex');
 if(sql("SELECT to_regclass('public.ops_closed_comment_commands') IS NULL")==='t'){
  sql(recoverySql.replace(/COMMIT;\s*$/,`COMMENT ON TABLE public.ops_closed_comment_commands IS '${recoveryMarker}';COMMIT;`));sql("NOTIFY pgrst, 'reload schema'");
 }else assert.equal(sql("SELECT obj_description('public.ops_closed_comment_commands'::regclass)"),recoveryMarker);
 admin=createClient(s.API_URL,s.SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 const clients=[],jars=[];
 for(let i=0;i<2;i++){
  const email=`comm-${randomUUID()}@example.test`,password=randomUUID()+'Aa1!';
  const a=await admin.auth.admin.createUser({email,password,email_confirm:true,app_metadata:{active_tenant:id(1)}});assert.ifError(a.error);users.push(a.data.user.id);
  sql(`INSERT INTO profiles(id,role,display_name) VALUES('${users[i]}','${i?'operasyon':'yonetici'}','Synthetic communication ${i}');INSERT INTO tenant_memberships(user_id,tenant_id) VALUES('${users[i]}','${id(1)}');`);
  const jar=new Map();jars.push(jar);const c=createServerClient(s.API_URL,s.ANON_KEY,{cookies:{getAll:()=>[...jar].map(([name,value])=>({name,value})),setAll:items=>items.forEach(({name,value})=>jar.set(name,value))}});assert.ifError((await c.auth.signInWithPassword({email,password})).error);clients.push(c);
 }
 sql(`INSERT INTO companies(id,tenant_id,name,status) VALUES('${company}','${id(1)}','Synthetic communication acceptance','aktif');
 INSERT INTO ops_locations(id,tenant_id,company_id,name,city) VALUES('${location}','${id(1)}','${company}','Synthetic branch','Test');
 INSERT INTO ops_daily_requests(id,tenant_id,company_id,location_id,work_date,service_line,position,required_count,created_by) VALUES('${request}','${id(1)}','${company}','${location}','2026-09-10','Test','Test',1,'${users[0]}');`);
 const args=i=>({p_actor_id:users[i],p_tenant_id:id(1)});
 const rpc=async(i,name,payload)=>{const r=await clients[i].rpc(name,{...args(i),...payload});assert.ifError(r.error);return r.data;};
 // Reload is asynchronous; retry only the schema-cache miss, never a mutation/authorization error.
 let available=false;
 for(let i=0;i<30;i++){
  const r=await clients[0].rpc('ops_comment_inbox',args(0));
  if(!r.error){available=true;break;}
  if(r.error.code!=='PGRST202')throw Error('Unexpected RPC readiness failure: '+r.error.code);
  await new Promise(resolve=>setTimeout(resolve,200));
 }
 assert.ok(available,'RPC schema cache not ready');
 const payload={p_command_id:randomUUID(),p_request_id:request,p_body:'Şube giriş kartını hazırlayalım.',p_parent_id:null,p_mentions:[users[1]]};
 const {sendRequestComment}=await importActualTypeScript(new URL('../src/lib/services/conversation.ts',import.meta.url));
 const command={commandId:payload.p_command_id,actorId:users[0],tenantId:id(1),requestId:request,body:payload.p_body,parentId:null,mentionIds:[users[1]]};
 const [a,b]=await Promise.all([sendRequestComment(clients[0],command),sendRequestComment(clients[0],command)]);assert.deepEqual(a,b);
 const inbox=await rpc(1,'ops_comment_inbox',{});assert.equal(inbox.unread,1);assert.equal(inbox.items.length,1);assert.equal(inbox.items[0].request_id,request);assert.equal(inbox.items[0].company_id,company);
 assert.equal((await rpc(0,'ops_comment_inbox',{})).items.length,0);
 console.log('PASS real Auth concurrent send: one message, recipient-only notification and correct source');
 const denied=await clients[0].rpc('ops_comment_read',{...args(0),p_message_id:a.messageId});assert.ok(denied.error);
 await rpc(1,'ops_comment_read',{p_message_id:a.messageId});await rpc(1,'ops_comment_read',{p_message_id:a.messageId});assert.equal((await rpc(1,'ops_comment_inbox',{})).unread,0);
 console.log('PASS real Auth read ownership and persistent idempotent read state');
 await rpc(1,'ops_comment_send',{p_command_id:randomUUID(),p_request_id:request,p_body:'Hazırlandı.',p_parent_id:a.messageId,p_mentions:[users[0],users[1]]});
 assert.equal((await rpc(0,'ops_comment_inbox',{})).unread,1);assert.equal((await rpc(1,'ops_comment_inbox',{})).items.length,1);
 assert.equal((await rpc(0,'ops_comment_list',{p_request_id:request,p_before:null})).length,2);
 console.log('PASS real Auth reply notification deduplication and shared conversation read');
 const people=await rpc(0,'ops_comment_people',{p_request_id:request});assert.ok(people.some(p=>p.id===users[1]));
 assert.equal((await rpc(1,'ops_comment_inbox_page',{p_before:null})).items[0].company_name,'Synthetic communication acceptance');
 let messageCount=2;
 if(process.env.BPS_CONVERSATION_BROWSER==='1'){const {checkConversationBrowser}=await import('./qa-local-conversation-browser.mjs');await checkConversationBrowser({jars,company,request,setRecipientAllowed:async allowed=>{sql(`UPDATE profiles SET role='${allowed?'operasyon':'ik'}' WHERE id='${users[1]}'`);}});messageCount=7;}
 sql(`UPDATE profiles SET role='ik' WHERE id='${users[1]}'`);
 assert.ok((await clients[1].rpc('ops_comment_inbox',args(1))).error);
 assert.ok((await clients[0].rpc('ops_comment_send',{...args(0),...payload,p_command_id:randomUUID()})).error);
 assert.equal(sql(`SELECT count(*) FROM ops_messages WHERE request_id='${request}'`),String(messageCount));
 console.log('PASS current role loss hides inbox and rejects new mention without partial message');
 console.log('Real Auth conversation: 4 groups passed; browser acceptance '+(process.env.BPS_CONVERSATION_BROWSER==='1'?'passed':'not run'));
}catch(e){console.error('Conversation Auth failed: '+e.message);process.exitCode=1;}
finally{
 if(sql&&users.length){
  try{
   sql(`BEGIN;DELETE FROM ops_closed_comment_commands WHERE request_id='${request}';DELETE FROM ops_message_notifications WHERE request_id='${request}';DELETE FROM ops_messages WHERE request_id='${request}';DELETE FROM ops_daily_requests WHERE id='${request}';DELETE FROM ops_locations WHERE id='${location}';DELETE FROM companies WHERE id='${company}';${users.map(u=>`DELETE FROM tenant_memberships WHERE user_id='${u}';DELETE FROM profiles WHERE id='${u}';`).join('')}COMMIT;`);
   for(const u of users)assert.ifError((await admin.auth.admin.deleteUser(u)).error);
   console.log('Owned synthetic records and Auth accounts removed');
  }catch(e){console.error('Owned fixture cleanup failed: '+e.message);process.exitCode=1;}
 }
 release?.();
}
