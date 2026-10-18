// Independent real GoTrue password sessions against disposable local PostgREST.
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
export async function acceptRoles({sql,id,authBase,restBase,service,loginPassword,syncAuthScope}){
 for(const base of [authBase,restBase])assert.match(base,/^http:\/\/127\.0\.0\.1:\d+$/);
 const roles=[[11,'yonetici'],[9511,'operasyon'],[9512,'ik'],[9513,'muhasebe'],[9514,'goruntuleyici']];
 const sessions=new Map(),checks=[];let sequence=9600;
 for(const [actor,role] of roles){
  const email=actor===11?'document-qa@example.test':`ops-${role}@example.test`;
  if(actor!==11){
   const response=await fetch(authBase+'/admin/users',{method:'POST',headers:{Authorization:'Bearer '+service,'Content-Type':'application/json'},body:JSON.stringify({id:id(actor),email,password:loginPassword,email_confirm:true})});
   assert.equal(response.ok,true,`Auth fixture ${role}`);
   // Application and GoTrue use separate disposable DBs; mirror identity only.
   sql(`INSERT INTO auth.users(id,email) VALUES('${id(actor)}','${email}');INSERT INTO profiles(id,email,display_name,role) VALUES('${id(actor)}','${email}','Synthetic ${role}','${role}') ON CONFLICT(id) DO UPDATE SET role=EXCLUDED.role,display_name=EXCLUDED.display_name;INSERT INTO tenant_memberships(user_id,tenant_id,role) VALUES('${id(actor)}','${id(1)}','${role}');`);
  }
  syncAuthScope();
  const response=await fetch(authBase+'/token?grant_type=password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password:loginPassword})});
  assert.equal(response.ok,true,`Password login ${role}`);const session=await response.json();
  const claims=JSON.parse(Buffer.from(session.access_token.split('.')[1],'base64url'));
  assert.equal(claims.sub,id(actor));assert.equal(claims.active_tenant_id,id(1));sessions.set(role,{actor,token:session.access_token});
 }
 async function rpc(role,name,body,error){
  const session=sessions.get(role);const command=id(sequence++);
  const response=await fetch(restBase+'/rpc/'+name,{method:'POST',headers:{Authorization:'Bearer '+session.token,'Content-Type':'application/json'},body:JSON.stringify({p_actor_id:id(session.actor),p_tenant_id:id(1),p_command_id:command,...body})});
  const value=await response.json();
  if(error){assert.equal(response.ok,false);assert.ok(JSON.stringify(value).includes(error),`${role}: expected ${error}, received ${JSON.stringify(value)}`);assert.equal(sql(`SELECT count(*) FROM ops_commands WHERE id='${command}'`),'0');return;}
  assert.equal(response.ok,true,`${role}/${name}: ${JSON.stringify(value)}`);return {value,command};
 }
 const mutate=(role,kind,payload)=>rpc(role,'ops_execute_scoped',{p_kind:kind,p_payload:payload});
 const location=await mutate('yonetici','location',{companyId:id(991),name:'HTTP role branch',city:'İstanbul'});
 const worker=await mutate('yonetici','worker',{name:'HTTP role worker',code:'HTTP-ROLE',kind:'idp'});
 const request=await mutate('operasyon','request',{companyId:id(991),locationId:location.command,workDate:'2026-01-04',serviceLine:'Test',position:'Test',requiredCount:1});
 const assignment=await mutate('operasyon','assign',{requestId:request.command,workerId:worker.command});
 await rpc('operasyon','ops_record_attendance',{p_assignment_id:assignment.command,p_expected_revision:0,p_status:'present'});
 const work=(role,revision,action,payload={},error)=>rpc(role,'ops_work_record_execute',{p_assignment_id:assignment.command,p_expected_revision:revision,p_action:action,p_payload:payload},error);
 assert.equal((await work('operasyon',0,'save',{startTime:'08:00',endTime:'17:00',nextDay:false,breakMinutes:60,note:'Synthetic independent HTTP roles'})).value.status,'draft');
 assert.equal((await work('operasyon',1,'submit')).value.status,'submitted');
 await work('operasyon',2,'approve',{},'WORK_FORBIDDEN');
 checks.push('Independent operations password session creates/assigns/records attendance/saves/submits; approval denied without receipt');
 for(const role of ['ik','muhasebe','goruntuleyici']){
  await rpc(role,'ops_execute_scoped',{p_kind:'request',p_payload:{companyId:id(991),locationId:location.command,workDate:'2026-01-05',serviceLine:'Test',position:'Test',requiredCount:1}},'OPS_FORBIDDEN');
  await rpc(role,'ops_start_execute',{p_assignment_id:assignment.command,p_expected_revision:0,p_action:'call',p_payload:{outcome:'on_way',offset:0,occurredAt:new Date().toISOString()}},'START_FORBIDDEN');
  await work(role,2,'approve',{},'WORK_FORBIDDEN');
  checks.push(`Independent ${role} password session denied request/start/work writes without receipt`);
 }
 assert.equal((await work('yonetici',2,'approve')).value.status,'approved');
 await work('operasyon',3,'reopen',{reason:'Synthetic'},'WORK_FORBIDDEN');
 assert.equal(sql(`SELECT net_minutes FROM ops_work_records WHERE assignment_id='${assignment.command}'`),'480');
 checks.push('Manager independent session approves submitted work; 480 minutes, operations reopen denied');
 writeFileSync(new URL('./role-http-result.json',import.meta.url),JSON.stringify({source:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),measuredAt:new Date().toISOString(),checks,limits:['Local synthetic GoTrue + PostgREST; not production','Role-specific visual button states not tested; manager UI chain tested separately','No tokens or personal data retained']},null,2)+'\n');
 console.log(`PASS ${checks.length} independent authenticated HTTP role groups`);
}
