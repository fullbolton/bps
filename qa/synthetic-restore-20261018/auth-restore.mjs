import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';

export async function restoreAuthFixture({source,auth,authDatabase,authBase,sql,docker,loginPassword,userId,tenantId}){
 assert.equal(source,'supabase_db_bps-supabase-acceptance');
 assert.match(auth,/^bps-browser-auth-\d+$/);assert.match(authDatabase,/^bps_browser_auth_\d+$/);
 const exec=(args,input)=>{try{return execFileSync('docker',args,{input,timeout:120000,maxBuffer:64*1024*1024,stdio:['pipe','pipe','pipe']});}catch{throw Error('Local synthetic Auth restore failed; credentials withheld');}};
 const login=async(base,password=loginPassword)=>fetch(base+'/token?grant_type=password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'document-qa@example.test',password}),signal:AbortSignal.timeout(10000)});
 const before=await login(authBase);assert.ok(before.ok,'Pre-restore password login failed');const original=await before.json();
 assert.equal(original.user.id,userId);
 const closing=await login(authBase);assert.ok(closing.ok,'Second session login failed');const closed=await closing.json();
 const sessionId=value=>JSON.parse(Buffer.from(value.access_token.split('.')[1],'base64url')).session_id;
 assert.notEqual(sessionId(original),sessionId(closed),'Expected independent sessions');
 const signout=await fetch(authBase+'/logout?scope=local',{method:'POST',headers:{Authorization:'Bearer '+closed.access_token},signal:AbortSignal.timeout(10000)});
 assert.ok(signout.ok,'Pre-backup session sign-out failed');
 const refreshSession=(base,token)=>fetch(base+'/token?grant_type=refresh_token',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({refresh_token:token}),signal:AbortSignal.timeout(10000)});
 const rejectedBefore=await refreshSession(authBase,closed.refresh_token);assert.equal(rejectedBefore.status,400,'Signed-out session still refreshes before backup');await rejectedBefore.arrayBuffer();
 docker(['stop',auth]);
 const dump=exec(['exec',source,'pg_dump','-U','postgres','-d',authDatabase]);
 sql(`DROP DATABASE ${authDatabase} WITH (FORCE);`,'postgres');
 sql(`CREATE DATABASE ${authDatabase} TEMPLATE template0; GRANT CREATE ON DATABASE ${authDatabase} TO supabase_auth_admin;`,'postgres');
 exec(['exec','-i',source,'sh','-c','PGPASSWORD="$POSTGRES_PASSWORD" exec psql -w -XqAt -U supabase_admin -d "$1" -v ON_ERROR_STOP=1','restore',authDatabase],dump);
 docker(['start',auth]);
 const base='http://127.0.0.1:'+docker(['port',auth,'9999/tcp']).split(':').at(-1);
 let ready=false;for(let i=0;i<60;i++){try{if((await fetch(base+'/health',{signal:AbortSignal.timeout(500)})).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,250));}assert.ok(ready,'Restored Auth not ready');
 const oldAccess=await fetch(base+'/user',{headers:{Authorization:'Bearer '+original.access_token},signal:AbortSignal.timeout(10000)});
 assert.ok(oldAccess.ok,'Old access token rejected');assert.equal((await oldAccess.json()).id,userId);
 const refresh=await fetch(base+'/token?grant_type=refresh_token',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({refresh_token:original.refresh_token}),signal:AbortSignal.timeout(10000)});
 assert.ok(refresh.ok,'Restored refresh session rejected');const refreshed=await refresh.json();assert.equal(refreshed.user.id,userId);
 const claims=JSON.parse(Buffer.from(refreshed.access_token.split('.')[1],'base64url'));assert.equal(claims.active_tenant_id,tenantId);
 const rejectedAfter=await refreshSession(base,closed.refresh_token);assert.equal(rejectedAfter.status,400,'Restore resurrected signed-out refresh session');await rejectedAfter.arrayBuffer();
 const after=await login(base);assert.ok(after.ok,'Password not preserved');assert.equal((await after.json()).user.id,userId);
 const wrong=await login(base,'Wrong-Synthetic-Password!');assert.equal(wrong.status,400,'Wrong password not rejected');
 const checks=['pre-restore real password sign-in','Auth database restored into template0','existing access token resolves same user','existing refresh token creates valid same-user session','refreshed token retains tenant hook claim','same password works after restore','wrong password rejected','independent session signed out before backup','signed-out refresh token rejected before backup','signed-out refresh token still rejected after restore'];
 writeFileSync(new URL('./auth-result.json',import.meta.url),JSON.stringify({syntheticOnly:true,dumpBytes:dump.length,passed:checks.length,checks,limits:['same local platform roles and signing secret','no production account or backup','Auth fixture is separate from restored business DB','no signing-key rotation, email/MFA or cloud disaster recovery tested','revocations after the snapshot and JWT expiry semantics are not covered']},null,2)+'\n');
 console.log('LOCAL_AUTH_RESTORE_PASS '+checks.length);
 return base;
}
