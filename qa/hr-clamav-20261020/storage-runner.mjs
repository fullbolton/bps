// Disposable Linux sidecar. Credentials exist only in its temporary environment.
import http from 'node:http';
import {createHash} from 'node:crypto';import {readFileSync} from 'node:fs';
import {createLeasedHrScanAdapters} from '/worker/leased-storage.mjs';
import {verifyProcessIsolation} from '/worker/isolation.mjs';
import {createEngineReader,verifyClamdConfig} from '/worker/config.mjs';
import {runWorkerCycle} from '/worker/coordinator.mjs';
import {runHrScan} from '/worker/job.mjs';
import {scanBytes} from '/worker/clamd.mjs';
const env=process.env;
const client=token=>({rpc:(name,args)=>({abortSignal:async signal=>{const r=await fetch(env.REST+'/rpc/'+name,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(args),signal});const text=await r.text();return {data:r.ok&&text?JSON.parse(text):null,error:r.ok?null:{code:'RPC_FAILED'}};}})});
// The disposable harness exposes Storage's usual /storage/v1 route locally.
const proxy=http.createServer(async(req,res)=>{try{if(!req.url.startsWith('/storage/v1/')){res.writeHead(404).end();return;}const r=await fetch(env.STORAGE+req.url.slice('/storage/v1'.length),{headers:{authorization:req.headers.authorization,apikey:req.headers.apikey},redirect:'error',signal:AbortSignal.timeout(10000)});res.writeHead(r.status,{'content-type':r.headers.get('content-type')||'application/octet-stream'});for await(const chunk of r.body)res.write(chunk);res.end();}catch{res.writeHead(502).end();}});
await new Promise(r=>proxy.listen(0,'127.0.0.1',r));
try{
 const service=client(env.SERVICE_TOKEN);
 const text=readFileSync('/qa/clamd.conf','utf8'),expectedDigest=createHash('sha256').update(text).digest('hex');
 const reader=createEngineReader({expectedDigest,acceptanceOnly:true});
 const readEngineState=async()=>{if(env.STRICT_ISOLATION==='1'){verifyProcessIsolation(readFileSync('/proc/1/status','utf8'),readFileSync('/proc/self/status','utf8'));verifyClamdConfig(text,{expectedDigest,socketPath:'/run/bps-clam/clamd.sock'});}return reader();};
 let report;
 await runWorkerCycle({tenant:env.TENANT,worker:env.WORKER,service,storageOrigin:`http://127.0.0.1:${proxy.address().port}`,serviceKey:env.SERVICE_TOKEN,readEngineState,scan:bytes=>scanBytes(bytes,{socketPath:'/run/bps-clam/clamd.sock'}),makeAdapters:async options=>{if(options.claim.uploadId!==env.UPLOAD)throw Error('HR_SCAN_CLAIM');return createLeasedHrScanAdapters(options);},runScan:async options=>{report=await runHrScan(options);return report;}});
 console.log(JSON.stringify({verdict:report.verdict,complete:report.complete,sha256:report.sha256,signatureVersion:report.signatureVersion}));
}finally{proxy.closeAllConnections();await new Promise(r=>proxy.close(r));}
