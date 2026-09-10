/** Native PostgreSQL test in a disposable database inside the validated dedicated local container.
 * Auth helpers are fixture models, not real Auth login. Never reads production or env files. */
import {execFileSync,execFile} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {baseline,id} from './fixtures/daily-operations.mjs';
import {validateLocalStatus,acquireLock} from './helpers/acceptance-runner.mjs';
const run=(cmd,args,input)=>execFileSync(cmd,args,{input,encoding:'utf8',stdio:['pipe','pipe','pipe'],timeout:20000});
const container='supabase_db_bps-supabase-acceptance',db='comm_'+randomUUID().replaceAll('-','');
let release,created=false,count=0;
try{
 const s=JSON.parse(run('supabase',['status','--workdir','/private/tmp/bps-supabase-acceptance','-o','json']));
 const [database,gateway]=JSON.parse(run('docker',['inspect',container,'supabase_kong_bps-supabase-acceptance']));
 validateLocalStatus(s,readFileSync('/private/tmp/bps-supabase-acceptance/supabase/config.toml','utf8'),database,gateway);release=acquireLock();
 run('docker',['exec',container,'createdb','-U','postgres',db]);created=true;
 const sql=q=>run('docker',['exec','-i',container,'psql','-X','-qAt','-U','postgres','-d',db,'-v','ON_ERROR_STOP=1'],q).trim();
 sql(baseline.replace('CREATE ROLE anon; CREATE ROLE authenticated;',''));
 sql(readFileSync('supabase/migrations/20260909000100_daily_operations_pilot.sql','utf8'));
 sql(readFileSync('supabase/migrations/20260910000200_request_conversation.sql','utf8'));
 sql(readFileSync('supabase/migrations/20260910000400_comment_command_recovery.sql','utf8'));
 sql(`INSERT INTO ops_locations(id,tenant_id,company_id,name,city) VALUES('${id(40)}','${id(1)}','${id(20)}','Branch','City');
 INSERT INTO ops_daily_requests(id,tenant_id,company_id,location_id,work_date,service_line,position,required_count,created_by)
 SELECT x,'${id(1)}','${id(20)}','${id(40)}','2026-09-10','Cleaning','Worker',1,'${id(10)}' FROM unnest(ARRAY['${id(30)}'::uuid,'${id(31)}'::uuid]) x;`);
 const sqlAsync=q=>new Promise((resolve,reject)=>{const child=execFile('docker',['exec','-i',container,'psql','-X','-qAt','-U','postgres','-d',db,'-v','ON_ERROR_STOP=1'],{encoding:'utf8',timeout:20000},(error,stdout,stderr)=>error?reject(Object.assign(error,{stderr})):resolve(stdout.trim()));child.stdin.end(q);});
 const as=(actor,q,tenant=id(1))=>sql(`SET ROLE authenticated;SET "test.user"='${actor}';SET "test.tenant"='${tenant}';${q}`);
 const send=(actor,command,body='Hello',mentions=[id(11)],parent=null,request=id(30),tenant=id(1))=>as(actor,`SELECT ops_comment_send('${actor}','${tenant}','${command}','${request}','${body}',${parent?`'${parent}'`:'NULL'},ARRAY[${mentions.map(x=>`'${x}'::uuid`).join(',')}]::uuid[]);`,tenant);
 const good=(name,fn)=>{fn();count++;console.log('PASS '+name);};
 const fails=(fn,code)=>assert.throws(fn,e=>e.stderr?.toString().includes(code));
 const first=JSON.parse(send(id(10),id(100)));
 good('canonical replay is one message and one notification',()=>{
  assert.deepEqual(JSON.parse(send(id(10),id(100),'Hello',[id(11),id(11)])),first);
  assert.equal(sql('SELECT count(*) FROM ops_messages'),'1');assert.equal(sql('SELECT count(*) FROM ops_message_notifications'),'1');
  fails(()=>send(id(10),id(100),'Changed'),'COMM_COMMAND_CONFLICT');
 });
 good('recipient-only inbox and read ownership',()=>{
  assert.equal(JSON.parse(as(id(10),`SELECT ops_comment_inbox('${id(10)}','${id(1)}')`)).unread,0);
  assert.equal(JSON.parse(as(id(11),`SELECT ops_comment_inbox('${id(11)}','${id(1)}')`)).unread,1);
  fails(()=>as(id(10),`SELECT ops_comment_read('${id(10)}','${id(1)}','${first.messageId}')`),'COMM_NOTIFICATION');
  assert.equal(as(id(11),`SELECT ops_comment_read('${id(11)}','${id(1)}','${first.messageId}')`),'t');
  assert.equal(JSON.parse(as(id(11),`SELECT ops_comment_inbox('${id(11)}','${id(1)}')`)).unread,0);
 });
 good('reply plus mention deduplicates, self mention is silent',()=>{
  send(id(11),id(101),'Reply',[id(10),id(11)],first.messageId);
  assert.equal(sql(`SELECT count(*) FROM ops_message_notifications WHERE recipient_id='${id(10)}'`),'1');
  assert.equal(sql(`SELECT count(*) FROM ops_message_notifications WHERE recipient_id='${id(11)}'`),'1');
 });
 good('invalid recipient and cross-source parent roll back entirely',()=>{
  for(const recipient of [id(12),id(13),id(999)])fails(()=>send(id(10),id(102),'Bad',[recipient]),'COMM_RECIPIENT');
  fails(()=>send(id(10),id(102),'Bad',[],first.messageId,id(31)),'COMM_PARENT');
  assert.equal(sql('SELECT count(*) FROM ops_messages'),'2');
 });
 good('tenant spoof, role loss and stale membership fail closed',()=>{
  fails(()=>send(id(10),id(102),'Bad',[],null,id(30),id(2)),'COMM_FORBIDDEN');
  fails(()=>send(id(12),id(102)),'COMM_FORBIDDEN');
  sql(`UPDATE profiles SET role='ik' WHERE id='${id(11)}'`);
  fails(()=>as(id(11),`SELECT ops_comment_inbox('${id(11)}','${id(1)}')`),'COMM_FORBIDDEN');
  sql(`UPDATE profiles SET role='operasyon' WHERE id='${id(11)}'; DELETE FROM tenant_memberships WHERE user_id='${id(11)}'`);
  fails(()=>as(id(11),`SELECT ops_comment_list('${id(11)}','${id(1)}','${id(30)}')`),'COMM_FORBIDDEN');
  sql(`INSERT INTO tenant_memberships VALUES('${id(11)}','${id(1)}')`);
 });
 good('direct table reads/writes and anonymous RPC denied',()=>{
  fails(()=>as(id(10),'SELECT * FROM ops_messages'),'permission denied');
  fails(()=>as(id(10),'DELETE FROM ops_message_notifications'),'permission denied');
  fails(()=>sql(`SET ROLE anon;SELECT ops_comment_inbox('${id(10)}','${id(1)}')`),'permission denied');
 });
 good('server validates limits and blank body',()=>{
  for(const body of ['','   ','x'.repeat(4001)])fails(()=>send(id(10),id(102),body),'COMM_INPUT');
  fails(()=>send(id(10),id(102),'Hello',Array(11).fill(id(11))),'COMM_INPUT');
 });
 good('pagination reads older records without overlap and rejects foreign cursor',()=>{
  for(let i=0;i<31;i++)send(id(10),id(200+i),'Page',[]);
  const page=JSON.parse(as(id(10),`SELECT ops_comment_list('${id(10)}','${id(1)}','${id(30)}')`));assert.equal(page.length,30);
  const next=JSON.parse(as(id(10),`SELECT ops_comment_list('${id(10)}','${id(1)}','${id(30)}','${page.at(-1).id}')`));assert.equal(next.length,3);
  assert.equal(new Set([...page,...next].map(m=>m.id)).size,33);
  fails(()=>as(id(10),`SELECT ops_comment_list('${id(10)}','${id(1)}','${id(31)}','${first.messageId}')`),'COMM_CURSOR');
 });
 good('resolution distinguishes committed message from absent command and fences late delivery',()=>{
  const resolved=JSON.parse(as(id(10),`SELECT ops_comment_resolve('${id(10)}','${id(1)}','${id(100)}','${id(30)}','Hello',NULL,ARRAY['${id(11)}'::uuid])`));assert.equal(resolved.status,'sent');assert.equal(resolved.messageId,first.messageId);
  const closed=JSON.parse(as(id(10),`SELECT ops_comment_resolve('${id(10)}','${id(1)}','${id(600)}','${id(30)}','Late',NULL,ARRAY[]::uuid[])`));assert.equal(closed.status,'closed');
  fails(()=>send(id(10),id(600),'Late',[]),'COMM_CLOSED');
  assert.equal(sql(`SELECT count(*) FROM ops_messages WHERE command_id='${id(600)}'`),'0');
 });
 const authPrefix=`SET ROLE authenticated;SET "test.user"='${id(10)}';SET "test.tenant"='${id(1)}';`;
 const concurrentSend=command=>authPrefix+`SELECT ops_comment_send('${id(10)}','${id(1)}','${command}','${id(30)}','Concurrent',NULL,ARRAY['${id(11)}'::uuid]);`;
 const results=await Promise.all([sqlAsync(concurrentSend(id(500))),sqlAsync(concurrentSend(id(500)))]);
 assert.deepEqual(JSON.parse(results[0]),JSON.parse(results[1]));
 assert.equal(sql(`SELECT count(*) FROM ops_messages WHERE command_id='${id(500)}'`),'1');
 assert.equal(sql(`SELECT count(*) FROM ops_message_notifications WHERE message_id=(SELECT id FROM ops_messages WHERE command_id='${id(500)}')`),'1');
 count++;console.log('PASS concurrent same command creates one message and one notification');
 const race=await Promise.allSettled([sqlAsync(concurrentSend(id(700))),sqlAsync(concurrentSend(id(700)).replace('ops_comment_send','ops_comment_resolve'))]);
 assert.equal(race[1].status,'fulfilled');const resolution=JSON.parse(race[1].value);
 if(race[0].status==='fulfilled'){assert.equal(resolution.status,'sent');assert.equal(JSON.parse(race[0].value).messageId,resolution.messageId);}
 else {assert.ok(race[0].reason.stderr.includes('COMM_CLOSED'));assert.equal(resolution.status,'closed');}
 assert.equal(sql(`SELECT count(*) FROM ops_messages WHERE command_id='${id(700)}'`),resolution.status==='sent'?'1':'0');
 count++;console.log('PASS concurrent send versus resolution yields exactly one committed or fenced outcome');
 // Hold an administrative role change uncommitted. The sender first sees the old role,
 // waits for the profile lock, then must re-check against the committed new role.
 const marker=db+'_role';
 const change=sqlAsync(`SET application_name='${marker}';BEGIN;UPDATE profiles SET role='ik' WHERE id='${id(10)}';SELECT pg_sleep(3);COMMIT;`);
 let ready=false;
 for(let i=0;i<50;i++){
  if(sql(`SELECT count(*) FROM pg_stat_activity WHERE datname='${db}' AND application_name='${marker}' AND wait_event='PgSleep'`)==='1'){ready=true;break;}
  await new Promise(r=>setTimeout(r,50));
 }
 if(!ready){await change;throw Error('Role race did not reach controlled barrier');}
 const attempted=sqlAsync(concurrentSend(id(501)));
 await assert.rejects(attempted,e=>e.stderr?.includes('COMM_FORBIDDEN'));await change;
 assert.equal(sql(`SELECT count(*) FROM ops_messages WHERE command_id='${id(501)}'`),'0');
 count++;console.log('PASS concurrent role revocation is rechecked after profile lock');
 console.log(`Native conversation SQL: ${count} groups passed (fixture Auth; no real Auth login)`);
}catch(e){console.error('Conversation SQL failed: '+(e.stderr?.toString()??e.message));process.exitCode=1;}
finally{
 if(created)try{run('docker',['exec',container,'dropdb','-U','postgres',db]);console.log('Disposable database removed');}catch{process.exitCode=1;console.error('Disposable database cleanup failed: '+db);}
 release?.();
}
