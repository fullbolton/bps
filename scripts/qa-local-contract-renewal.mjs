// Guarded dedicated local test. Real local GoTrue sessions, synthetic users only.
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';
import {validateLocalStatus,acquireLock} from './helpers/acceptance-runner.mjs';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
import {id} from './fixtures/daily-operations.mjs';
const run=(cmd,args,input)=>{try{return execFileSync(cmd,args,{input,encoding:'utf8',stdio:['pipe','pipe','pipe'],timeout:20000});}catch{throw new Error(cmd+' local command failed');}};
let release;
try{
 const s=JSON.parse(run('supabase',['status','--workdir','/private/tmp/bps-supabase-acceptance','-o','json']));
 const [db,gateway]=JSON.parse(run('docker',['inspect','supabase_db_bps-supabase-acceptance','supabase_kong_bps-supabase-acceptance']));
 validateLocalStatus(s,readFileSync('/private/tmp/bps-supabase-acceptance/supabase/config.toml','utf8'),db,gateway);
 const sql=q=>run('docker',['exec','-i','supabase_db_bps-supabase-acceptance','psql','-U','postgres','-d','postgres','-At','-v','ON_ERROR_STOP=1'],q).trim();release=acquireLock();
 assert.equal(sql("SELECT obj_description(to_regclass('public.tasks'))='BPS synthetic task-prefill fixture v1' AND to_regclass('public.task_transfer_receipts') IS NOT NULL"),'t');
 sql(readFileSync(new URL('./fixtures/local-contracts.sql',import.meta.url),'utf8'));
 const migration=readFileSync(new URL('../supabase/migrations/20260909001700_contract_renewal_task.sql',import.meta.url),'utf8');
 if(sql("SELECT to_regclass('public.contract_renewal_tasks') IS NULL")==='t')sql(migration);
 else{const bodies=[...migration.matchAll(/CREATE FUNCTION [\s\S]*?\$\$;/g)].map(m=>m[0].replace('CREATE FUNCTION','CREATE OR REPLACE FUNCTION'));assert.equal(bodies.length,4);sql("BEGIN; SET LOCAL lock_timeout='15s';"+bodies.join('\n')+'COMMIT;');}
 sql("NOTIFY pgrst,'reload schema';");
 const options={auth:{persistSession:false,autoRefreshToken:false}},root=createClient(s.API_URL,s.SERVICE_ROLE_KEY,options);
 async function user(name,role){const email=`renewal-${randomUUID()}@example.test`,password=randomUUID()+'aA1!';const created=await root.auth.admin.createUser({email,password,email_confirm:true,app_metadata:{active_tenant:id(1)}});assert.ifError(created.error);const uid=created.data.user.id;assert.match(uid,/^[0-9a-f-]{36}$/);sql(`INSERT INTO profiles(id,role,display_name) VALUES('${uid}','${role}','${name}'); INSERT INTO tenant_memberships VALUES('${uid}','${id(1)}');`);return {uid,email,password};}
 const actor=await user('Yenileme kabul yöneticisi','yonetici'),source=await user('Yenileme kabul sorumlusu','operasyon'),target=await user('Yenileme kabul yeni sorumlu','ik');
 const c=createClient(s.API_URL,s.ANON_KEY,options);assert.ifError((await c.auth.signInWithPassword({email:actor.email,password:actor.password})).error);
 const contractId=randomUUID();sql(`INSERT INTO contracts(id,tenant_id,company_id,name,end_date,renewal_responsible_set,renewal_task_created) VALUES('${contractId}','${id(1)}','${id(20)}','Yerel API yenileme kabulü','2026-10-01',true,true);`);
 const service=await importActualTypeScript(new URL('../src/lib/services/contract-renewal.ts',import.meta.url)),transfer=await importActualTypeScript(new URL('../src/lib/services/task-transfer.ts',import.meta.url));
 const scope={actorId:actor.uid,tenantId:id(1)};let ready=false;for(let i=0;i<20;i++){const r=await c.rpc('contract_renewal_snapshot',{p_actor_id:actor.uid,p_tenant_id:id(1),p_contract_id:contractId});if(!r.error&&r.data){ready=true;break;}await new Promise(resolve=>setTimeout(resolve,200));}assert.ok(ready);
 let count=0;const pass=label=>{count++;console.log('PASS '+label);};
 const preview=await service.loadRenewal(c,scope,contractId);assert.equal(preview.task,null);pass('real Auth sees empty relation despite legacy flags');
 const command={commandId:randomUUID(),contractId,revision:preview.revision,assigneeId:source.uid,dueDate:'2026-10-01',basis:'Yerel kabul: operasyon takip kararı'};
 const rawFetch=globalThis.fetch;let drop=true;
 const lossy=createClient(s.API_URL,s.ANON_KEY,{...options,global:{fetch:async(...args)=>{const response=await rawFetch(...args);if(drop&&String(args[0]).includes('/rpc/create_contract_renewal_task')&&response.ok){drop=false;throw new TypeError('Synthetic lost successful response');}return response;}}});
 assert.ifError((await lossy.auth.signInWithPassword({email:actor.email,password:actor.password})).error);
 await assert.rejects(()=>service.createRenewal(lossy,scope,command));assert.equal(drop,false);
 const result=await service.createRenewal(c,scope,command);assert.equal(sql(`SELECT count(*) FROM tasks WHERE contract_id='${contractId}'`),'1');pass('successful response loss followed by same-command retry creates one task');
 assert.equal((await service.loadRenewal(c,scope,contractId)).task.assigneeId,source.uid);pass('snapshot returns actual owner and explicit renewal task');
 await transfer.submitTransfer(c,scope,{commandId:randomUUID(),sourceId:source.uid,targetId:target.uid,tasks:[{id:result.taskId,revision:0}]});
 assert.equal((await service.loadRenewal(c,scope,contractId)).task.assigneeId,target.uid);pass('existing transfer updates renewal owner without a second owner column');
 await assert.rejects(()=>service.createRenewal(c,scope,{...command,commandId:randomUUID()}));pass('different command cannot create duplicate renewal');
 const changed=randomUUID();sql(`INSERT INTO contracts(id,tenant_id,company_id,name) VALUES('${changed}','${id(1)}','${id(20)}','Stale preview'); UPDATE contracts SET name='Changed' WHERE id='${changed}';`);
 await assert.rejects(()=>service.createRenewal(c,scope,{...command,contractId:changed,commandId:randomUUID()}));assert.equal(sql(`SELECT count(*) FROM tasks WHERE contract_id='${changed}'`),'0');pass('stale contract preview rejected with zero task rows');
 const denied=await c.from('contract_renewal_tasks').select('*');assert.ok(denied.error);pass('private receipt has no direct API read privilege');
 sql(`INSERT INTO contracts(id,tenant_id,company_id,name,start_date,end_date,status,scope,responsible) VALUES('${id(400)}','${id(1)}','${id(20)}','Sentetik şube hizmet sözleşmesi','2026-09-01','2026-10-01','aktif','Yerel tarayıcı kabulü','Eski metin: görev sorumlusu değildir') ON CONFLICT(id) DO NOTHING;`);
 console.log(`Local contract renewal checks: ${count} passed. Browser fixture: /sozlesmeler/${id(400)}`);
}catch(error){console.error('Local renewal acceptance failed: '+error.message);process.exitCode=1;}
finally{release?.();}
