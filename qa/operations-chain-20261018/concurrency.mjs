import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
// Two real psql sessions; the observer waits for an actual database lock, not a timing guess.
export async function capacityRace({server,db,sql,id,claims}){
 const sessions=[];
 function session(name){
  const child=spawn('docker',['exec','-i',server,'psql','-X','-qAt','-U','postgres','-d',db,'-v','ON_ERROR_STOP=1'],{stdio:['pipe','pipe','pipe']});
  let out='',err='';child.stdout.on('data',b=>out+=b);child.stderr.on('data',b=>err+=b);
  const done=new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',code=>resolve({code,out,err}));});
  child.stdin.on('error',()=>{});
  child.stdin.write(`SET application_name='${name}';BEGIN;SELECT set_config('request.jwt.claims','${JSON.stringify(claims)}',true);SET LOCAL ROLE authenticated;\n`);
  const s={child,done};sessions.push(s);return s;
 }
 async function until(query){
  for(let i=0;i<50;i++){if(sql(query)==='t')return;await new Promise(r=>setTimeout(r,50));}
  throw Error('Expected transaction/lock state was not observed');
 }
 const assign=(command,worker)=>`SELECT ops_execute_scoped('${id(11)}','${id(1)}','${id(command)}','assign','${JSON.stringify({requestId:id(8840),workerId:id(worker)})}'::jsonb);\n`;
 try{
  const a=session('bps_capacity_a');a.child.stdin.write(assign(8841,8802));
  await until("SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND application_name='bps_capacity_a' AND state='idle in transaction')");
  const b=session('bps_capacity_b');b.child.stdin.end(assign(8842,8810)+'COMMIT;\n');
  await until("SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND application_name='bps_capacity_b' AND wait_event_type='Lock')");
  a.child.stdin.end('COMMIT;\n');
  const [ra,rb]=await Promise.all([a.done,b.done]);
  assert.equal(ra.code,0,ra.err);assert.notEqual(rb.code,0);assert.match(rb.err,/OPS_CAPACITY_FULL/);
  assert.equal(sql(`SELECT count(*) FROM ops_assignments WHERE request_id='${id(8840)}' AND removed_at IS NULL`),'1');
  assert.equal(sql(`SELECT worker_id FROM ops_assignments WHERE request_id='${id(8840)}' AND removed_at IS NULL`),id(8802));
  assert.equal(sql(`SELECT count(*) FROM ops_commands WHERE id='${id(8842)}'`),'0');
 }finally{
  // Only this isolated rehearsal database; release sessions even after failed assertions.
  sql("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=current_database() AND application_name IN ('bps_capacity_a','bps_capacity_b') AND pid<>pg_backend_pid()");
  for(const s of sessions){s.child.stdin.destroy();await s.done;}
 }
}
