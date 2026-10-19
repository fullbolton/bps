// Disposable Linux sidecar. Credentials exist only in its temporary environment.
import http from 'node:http';
import {createHash} from 'node:crypto';import {readFileSync} from 'node:fs';
import {createHrScanAdapters} from '/worker/storage.mjs';
import {createEngineReader} from '/worker/config.mjs';
import {runHrScan} from '/worker/job.mjs';
import {scanBytes} from '/worker/clamd.mjs';
const env=process.env;
const client=token=>({rpc:(name,args)=>({abortSignal:async signal=>{const r=await fetch(env.REST+'/rpc/'+name,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(args),signal});const text=await r.text();return {data:r.ok&&text?JSON.parse(text):null,error:r.ok?null:{code:'RPC_FAILED'}};}})});
// The disposable harness exposes Storage's usual /storage/v1 route locally.
const proxy=http.createServer(async(req,res)=>{try{if(!req.url.startsWith('/storage/v1/')){res.writeHead(404).end();return;}const r=await fetch(env.STORAGE+req.url.slice('/storage/v1'.length),{headers:{authorization:req.headers.authorization,apikey:req.headers.apikey},redirect:'error',signal:AbortSignal.timeout(10000)});res.writeHead(r.status,{'content-type':r.headers.get('content-type')||'application/octet-stream'});for await(const chunk of r.body)res.write(chunk);res.end();}catch{res.writeHead(502).end();}});
await new Promise(r=>proxy.listen(0,'127.0.0.1',r));
try{
 const adapters=await createHrScanAdapters({actor:env.ACTOR,tenant:env.TENANT,upload:env.UPLOAD,user:client(env.USER_TOKEN),verifier:client(env.SERVICE_TOKEN),storageOrigin:`http://127.0.0.1:${proxy.address().port}`,serviceKey:env.SERVICE_TOKEN});
 const readEngineState=createEngineReader({expectedDigest:createHash('sha256').update(readFileSync('/evidence/clamd.conf')).digest('hex'),acceptanceOnly:true});
 const report=await runHrScan({...adapters,readEngineState,scan:bytes=>scanBytes(bytes,{socketPath:'/run/bps-clam/clamd.sock'})});
 console.log(JSON.stringify({verdict:report.verdict,complete:report.complete,sha256:report.sha256,signatureVersion:report.signatureVersion}));
}finally{proxy.closeAllConnections();await new Promise(r=>proxy.close(r));}
