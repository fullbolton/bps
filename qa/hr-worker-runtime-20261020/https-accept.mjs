import https from 'node:https';import {execFileSync,execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';import assert from 'node:assert/strict';
const dir=mkdtempSync(join(tmpdir(),'bps-scanner-tls-')),run=promisify(execFile);let server;let count=0;
try{
 execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',join(dir,'key.pem'),'-out',join(dir,'cert.pem'),'-days','1','-subj','/CN=localhost','-addext','subjectAltName=IP:127.0.0.1'],{stdio:'ignore'});
 server=https.createServer({key:readFileSync(join(dir,'key.pem')),cert:readFileSync(join(dir,'cert.pem'))},async(req,res)=>{
  count++;assert.equal(req.headers.authorization,'Bearer synthetic-key');assert.equal(req.headers.apikey,'synthetic-key');
  let body='';for await(const chunk of req)body+=chunk;const command=JSON.parse(body);
  if(command.test==='redirect'){res.writeHead(302,{location:'/must-not-follow'});res.end();return;}
  res.setHeader('content-type','application/json');res.end(command.test==='large'?JSON.stringify('x'.repeat(17000)):command.test==='bad'?'{':'null');
 });await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const origin=`https://127.0.0.1:${server.address().port}`,module=new URL('../../workers/hr-malware/service.mjs',import.meta.url).href;
 const code=`import {createScannerService} from ${JSON.stringify(module)};const client=createScannerService({origin:${JSON.stringify(origin)},key:'synthetic-key'});const results=[];for(const test of ['valid','redirect','large','bad'])results.push(await client.rpc('hr_malware_claim_v1',{test}).abortSignal());console.log(JSON.stringify(results));`;
 const {stdout}=await run(process.execPath,['--input-type=module','-e',code],{env:{...process.env,NODE_EXTRA_CA_CERTS:join(dir,'cert.pem'),NODE_TLS_REJECT_UNAUTHORIZED:'1'},timeout:30000});
 const results=JSON.parse(stdout);assert.equal(results[0].error,null);for(const result of results.slice(1))assert.equal(result.error.code,'HR_WORKER_RPC_UNAVAILABLE');assert.equal(count,4);
 const rejected=await run(process.execPath,['--input-type=module','-e',code],{env:{...process.env,NODE_EXTRA_CA_CERTS:'',NODE_TLS_REJECT_UNAUTHORIZED:'1'},timeout:30000});assert.ok(JSON.parse(rejected.stdout).every(r=>r.error?.code==='HR_WORKER_RPC_UNAVAILABLE'));assert.equal(count,4);
 const evidence={syntheticOnly:true,realHttps:true,certificateVerification:true,redirectNotFollowed:true,oversizedAndMalformedRejected:true,untrustedCertificateRejected:true,realDatabase:false,productionReady:false};writeFileSync(new URL('./https-result.json',import.meta.url),JSON.stringify(evidence,null,2)+'\n');console.log(evidence);
}finally{if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}rmSync(dir,{recursive:true,force:true});}
