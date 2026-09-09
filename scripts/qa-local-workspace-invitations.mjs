// Only guarded dedicated local Supabase, synthetic identities and files. Never reads .env.local.
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';
import {validateLocalStatus,acquireLock} from './helpers/acceptance-runner.mjs';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
import {id} from './fixtures/daily-operations.mjs';
const run=(cmd,args,input)=>{try{return execFileSync(cmd,args,{input,encoding:'utf8',stdio:['pipe','pipe','pipe'],timeout:20000});}catch{throw Error(cmd+' local command failed');}};
let release;
try{
 const s=JSON.parse(run('supabase',['status','--workdir','/private/tmp/bps-supabase-acceptance','-o','json']));
 const [db,gateway]=JSON.parse(run('docker',['inspect','supabase_db_bps-supabase-acceptance','supabase_kong_bps-supabase-acceptance']));
 validateLocalStatus(s,readFileSync('/private/tmp/bps-supabase-acceptance/supabase/config.toml','utf8'),db,gateway);
 release=acquireLock();const sql=q=>run('docker',['exec','-i','supabase_db_bps-supabase-acceptance','psql','-U','postgres','-d','postgres','-At','-v','ON_ERROR_STOP=1'],q).trim();
 assert.equal(sql("SELECT obj_description(to_regclass('public.documents'))='BPS synthetic documents fixture v1' AND to_regclass('public.contract_document_versions') IS NOT NULL"),'t');
 sql(readFileSync(new URL('./fixtures/local-workspace-setup.sql',import.meta.url),'utf8'));
 const migration=readFileSync(new URL('../supabase/migrations/20260909002300_workspace_invitations.sql',import.meta.url),'utf8');
 assert.equal(sql("SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='is_platform_admin'"),'1');
 if(sql("SELECT to_regclass('public.workspace_invitations') IS NULL")==='t')sql(migration);
 else{const bodies=[...migration.matchAll(/CREATE FUNCTION [\s\S]*?\$\$;/g)].map(m=>m[0].replace('CREATE FUNCTION','CREATE OR REPLACE FUNCTION'));assert.equal(bodies.length,3);sql('BEGIN;'+bodies.join('\n')+'COMMIT;');}
 sql("NOTIFY pgrst,'reload schema';");
 const options={auth:{persistSession:false,autoRefreshToken:false}},root=createClient(s.API_URL,s.SERVICE_ROLE_KEY,options),manager=createClient(s.API_URL,s.ANON_KEY,options),recipient=createClient(s.API_URL,s.ANON_KEY,options);
 const users=[];let invitationId;
 try{
  for(const [client,role] of [[manager,'yonetici'],[recipient,'goruntuleyici']]){
   const email=`invite-${randomUUID()}@example.test`,password=randomUUID()+'aA1!';const r=await root.auth.admin.createUser({email,password,email_confirm:true,app_metadata:role==='yonetici'?{active_tenant:id(1)}:{}});assert.ifError(r.error);const uid=r.data.user.id;users.push({id:uid,email});
   sql(`INSERT INTO profiles(id,role,display_name) VALUES('${uid}','${role}','Davet kabul testi')`);if(role==='yonetici')sql(`INSERT INTO tenant_memberships VALUES('${uid}','${id(1)}')`);
   assert.ifError((await client.auth.signInWithPassword({email,password})).error);
  }
  const token=randomUUID().replaceAll('-','')+randomUUID().replaceAll('-','');invitationId=randomUUID();
  const args={p_actor_id:users[0].id,p_tenant_id:id(1),p_id:invitationId,p_action:'create',p_email:users[1].email,p_role:'operasyon',p_token:token};let r;
  for(let i=0;i<20;i++){r=await manager.rpc('manage_workspace_invitation',args);if(!r.error)break;await new Promise(r=>setTimeout(r,150));}assert.ifError(r.error);assert.equal(r.data.state,'pending');
  const accepted=await recipient.rpc('accept_workspace_invitation',{p_actor_id:users[1].id,p_id:invitationId,p_token:token});assert.ifError(accepted.error);assert.equal(accepted.data.accepted,true);
  const retry=await recipient.rpc('accept_workspace_invitation',{p_actor_id:users[1].id,p_id:invitationId,p_token:token});assert.ifError(retry.error);assert.deepEqual(retry.data,accepted.data);
  assert.equal(sql(`SELECT count(*) FROM tenant_memberships WHERE user_id='${users[1].id}'`),'1');assert.equal(sql(`SELECT role FROM profiles WHERE id='${users[1].id}'`),'operasyon');console.log('PASS actual verified Auth identity accepts once; repeat returns same receipt');
  const listed=await manager.rpc('list_workspace_invitations',{p_actor_id:users[0].id,p_tenant_id:id(1)});assert.ifError(listed.error);assert.equal(listed.data.find(v=>v.id===invitationId).state,'accepted');assert.ok(!JSON.stringify(listed.data).includes(token));console.log('PASS real manager list records acceptance without exposing token');
  assert.ok((await recipient.rpc('list_workspace_invitations',{p_actor_id:users[1].id,p_tenant_id:id(1)})).error);console.log('PASS recipient cannot list manager invitations');
 }finally{
  if(invitationId)sql(`DELETE FROM workspace_invitations WHERE id='${invitationId}'`);
  for(const u of users){sql(`DELETE FROM tenant_memberships WHERE user_id='${u.id}'; DELETE FROM profiles WHERE id='${u.id}'`);assert.ifError((await root.auth.admin.deleteUser(u.id)).error);}
 }
}catch(e){console.error('Local invitation acceptance failed: '+e.message);process.exitCode=1;}
finally{release?.();}
