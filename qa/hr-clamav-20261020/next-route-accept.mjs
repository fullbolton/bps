import assert from 'node:assert/strict';import {createServerClient} from '@supabase/ssr';import {writeFileSync} from 'node:fs';
import {accept} from './storage-accept.mjs';
export async function acceptNextRoutes({hrContext,authBase,anon,loginPassword}){
 const origin='http://127.0.0.1:3060';let ready=false;
 for(let i=0;i<120;i++){try{const r=await fetch(origin+'/login',{signal:AbortSignal.timeout(1500)});if(r.ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}
 assert.ok(ready,'Next startup');
 const checks=[];
 await accept({...hrContext,routeFactory:async context=>{
  // Login through the proxy to synchronize the real Auth custom-token hook.
  const auth=await fetch('http://127.0.0.1:3061/auth/v1/token?grant_type=password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'document-qa@example.test',password:loginPassword})});assert.ok(auth.ok,'password sign-in');
  const session=await auth.json(),jar=new Map();
  const client=createServerClient('http://127.0.0.1:3061',anon,{cookies:{getAll:()=>[...jar].map(([name,value])=>({name,value})),setAll:entries=>entries.forEach(({name,value})=>jar.set(name,value))}});
  const installed=await client.auth.setSession(session);assert.equal(installed.error,null);
  const cookie=()=>[...jar].map(([name,value])=>name+'='+value).join('; ');
  const post=async(path,body,{authenticated=true,requestOrigin=origin}={})=>fetch(origin+path,{method:'POST',redirect:'manual',headers:{Origin:requestOrigin,...(authenticated?{Cookie:cookie()}:{}),...(body instanceof FormData?{}:{'Content-Type':'application/json'})},body:body instanceof FormData?body:JSON.stringify(body),signal:AbortSignal.timeout(30000)});
  assert.equal((await post('/api/hr/documents/scan',{}, {authenticated:false})).status,401);
  assert.equal((await post('/api/hr/documents/scan',{}, {requestOrigin:'https://foreign.example'})).status,403);
  checks.push('real password session cookies; anonymous and cross-origin rejected');
  return {
   async upload(command,bytes){
    const form=new FormData();form.set('actorId',context.actor);form.set('tenantId',context.tenant);form.set('employeeId',context.employee);form.set('command',JSON.stringify(command));form.set('file',new Blob([bytes],{type:'application/pdf'}),'synthetic.pdf');
    const r=await post('/api/hr/documents/upload',form);assert.equal(r.status,202,'Next upload');assert.equal(r.headers.get('cache-control'),'no-store');const data=await r.json();assert.equal(data.ok,true);checks.push('multipart route queued upload');return data.receipt;
   },
   async action(command,action){
    const body={actorId:context.actor,tenantId:context.tenant,employeeId:context.employee,command,action};
    if(action==='status'){const bad=await post('/api/hr/documents/scan',{...body,actorId:hrContext.id(12)});assert.equal(bad.status,409,'forged actor rejected');}
    const r=await post('/api/hr/documents/scan',body);assert.equal(r.headers.get('cache-control'),'no-store');const data=await r.json();if(!r.ok)throw Error('NEXT_SCAN_REJECTED');assert.equal(data.ok,true);checks.push('scan route '+action);return data;
   }
  };
 }});
 const result={realNextRoutes:true,realPasswordSession:true,realAuth:true,realStorage:true,realDatabase:true,realClamav:true,browserFormInteraction:false,productionReady:false,syntheticOnly:true,checks};
 writeFileSync(new URL('./next-route-result.json',import.meta.url),JSON.stringify(result,null,2)+'\n');console.log('NEXT_HR_ROUTE_ACCEPTANCE '+JSON.stringify(result));
}
