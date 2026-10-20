import assert from 'node:assert/strict';import {createServerClient} from '@supabase/ssr';import {writeFileSync,mkdirSync,existsSync,rmSync} from 'node:fs';
import {accept} from './storage-accept.mjs';
export async function acceptNextRoutes({hrContext,authBase,anon,loginPassword}){
 const origin='http://127.0.0.1:3060';let ready=false;
 for(let i=0;i<120;i++){try{const r=await fetch(origin+'/login',{signal:AbortSignal.timeout(1500)});if(r.ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}
 assert.ok(ready,'Next startup');
 const initialBrowser=process.env.BPS_HR_INITIAL_BROWSER==='1';
 const checks=[];const browser=process.env.BPS_HR_SCAN_BROWSER==='1',page='src/app/qa-hr-scan';let pageCreated=false;
 try{
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
  let latestStatus;
  const hold=async(command,phase=latestStatus)=>{
   if(!pageCreated){if(existsSync(page))throw Error('QA_PAGE_EXISTS');mkdirSync(page);pageCreated=true;}
   const props=JSON.stringify({actor:context.actor,tenant:context.tenant,employee:context.employee,...(initialBrowser?{}:{recovery:command})});
   if(!initialBrowser||phase==='upload')writeFileSync(page+'/page.tsx',`'use client';import {useState} from 'react';import HrDocumentUpload from '@/app/(main)/insan-kaynaklari/HrDocumentUpload';import {NavigationGuardProvider} from '@/context/NavigationGuardContext';export default function Page(){const [saved,setSaved]=useState(false);return <NavigationGuardProvider><main style={{maxWidth:720,margin:'32px auto',padding:24}}><h1>Sentetik tarama kabulü</h1>{saved?<p role="status">Kaydedildi</p>:<HrDocumentUpload key="${command.id}" {...${props}} onClose={()=>setSaved(true)} onSaved={async()=>setSaved(true)}/>}</main></NavigationGuardProvider>}`);
   const marker='/tmp/bps-hr-ui-'+process.pid+'-'+phase;console.log('HR_BROWSER_CHECK '+phase+' http://127.0.0.1:3060/qa-hr-scan '+marker);
   for(let i=0;i<600;i++){if(existsSync(marker)){rmSync(marker);return;}await new Promise(r=>setTimeout(r,1000));}throw Error('UI_ACCEPTANCE_TIMEOUT');
  };
  return {
   async upload(command,bytes){
    if(initialBrowser){
     await hold(command,'upload');
     const rows=JSON.parse(hrContext.sql(`SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'employmentId',employment_id,'title',title,'size',file_size,'sha256',content_sha256,'validityDate',validity_date,'state',state)),'[]'::jsonb) FROM hr_document_uploads WHERE tenant_id='${context.tenant}' AND employee_id='${context.employee}' AND content_sha256='${command.sha256}'`));
     assert.equal(rows.length,1,'exactly one browser upload');const row=rows[0];assert.equal(row.size,command.size);assert.equal(row.title,command.title);assert.equal(row.employmentId,command.employmentId);assert.equal(row.state,'pending');
     command.id=row.id;checks.push('browser file chooser and upload; exact hash/size/title/employment matched');return row;
    }

    const form=new FormData();form.set('actorId',context.actor);form.set('tenantId',context.tenant);form.set('employeeId',context.employee);form.set('command',JSON.stringify(command));form.set('file',new Blob([bytes],{type:'application/pdf'}),'synthetic.pdf');
    const r=await post('/api/hr/documents/upload',form);assert.equal(r.status,202,'Next upload');assert.equal(r.headers.get('cache-control'),'no-store');const data=await r.json();assert.equal(data.ok,true);checks.push('multipart route queued upload');return data.receipt;
   },
   async action(command,action){
    if(browser&&action==='finalize'&&['ready','blocked'].includes(latestStatus))await hold(command);
    const body={actorId:context.actor,tenantId:context.tenant,employeeId:context.employee,command,action};
    if(action==='status'){const bad=await post('/api/hr/documents/scan',{...body,actorId:hrContext.id(12)});assert.equal(bad.status,409,'forged actor rejected');}
    const r=await post('/api/hr/documents/scan',body);assert.equal(r.headers.get('cache-control'),'no-store');const data=await r.json();if(!r.ok)throw Error('NEXT_SCAN_REJECTED');assert.equal(data.ok,true);if(data.scan)latestStatus=data.scan.status;checks.push('scan route '+action);return data;
   }
  };
 }});
 const result={realNextRoutes:true,realPasswordSession:true,realAuth:true,realStorage:true,realDatabase:true,realClamav:true,browserFormInteraction:browser,browserRecoveryInteraction:browser&&!initialBrowser,browserInitialFileUpload:initialBrowser,browserEvidenceMode:browser?'manual-cua-with-checkpoint':null,productionReady:false,syntheticOnly:true,checks};
 writeFileSync(new URL(initialBrowser?'./browser-initial-result.json':browser?'./browser-recovery-result.json':'./next-route-result.json',import.meta.url),JSON.stringify(result,null,2)+'\n');console.log('NEXT_HR_ROUTE_ACCEPTANCE '+JSON.stringify(result));
 }finally{if(pageCreated)rmSync(page,{recursive:true});}
}
