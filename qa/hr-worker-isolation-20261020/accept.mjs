import {execFileSync} from 'node:child_process';import {writeFileSync} from 'node:fs';import assert from 'node:assert/strict';import {fileURLToPath} from 'node:url';
const image='public.ecr.aws/supabase/storage-api@sha256:5a3ecdc67dbe9e88a56810b5b2f432f2d93708dcb4dc9de34e78e342b390eb4d';
const suffix=process.pid,volume=`bps-isolation-secret-${suffix}`,names=[];
const docker=args=>execFileSync('docker',args,{encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();
const results=[];
try{
 docker(['volume','create',volume]);
 docker(['run','--rm','--network','none','-v',volume+':/secret','--entrypoint','node',image,'-e',"require('fs').writeFileSync('/secret/canary','SYNTHETIC-ONLY-NOT-A-CREDENTIAL',{mode:0o600})"]);
 for(const [label,uid] of [['same_uid_baseline','0'],['separate_daemon_uid','10001']]){
  const daemon=`bps-isolation-daemon-${suffix}-${uid}`,worker=`bps-isolation-worker-${suffix}-${uid}`;names.push(worker,daemon);
  docker(['run','-d','--name',daemon,'--user',uid+':'+uid,'--cap-drop','ALL','--security-opt','no-new-privileges:true','--read-only','--network','none','--entrypoint','node','-e','TZ=UTC',image,'-e','setInterval(()=>{},1000)']);
  docker(['run','-d','--name',worker,'--user','0:0','--group-add','10001','--cap-drop','ALL',...(uid==='0'?[]:['--cap-add','SYS_PTRACE','--cap-add','DAC_READ_SEARCH']),'--security-opt','no-new-privileges:true','--read-only','--network','none','--pid=container:'+daemon,'-v',fileURLToPath(new URL('../../workers/hr-malware/isolation.mjs',import.meta.url))+':/isolation.mjs:ro','-v',volume+':/run/secrets:ro','--entrypoint','node',image,'-e',"console.log(process.pid);setInterval(()=>{},1000)"]);
  let pid;for(let n=0;n<30;n++){pid=docker(['logs',worker]);if(/^\d+$/.test(pid))break;await new Promise(r=>setTimeout(r,100));}assert.match(pid,/^\d+$/);
  const probe=`const fs=require('fs'),p=${Number(pid)};const r={};for(const [k,path] of Object.entries({secret:'/proc/'+p+'/root/run/secrets/canary',environment:'/proc/'+p+'/environ',descriptors:'/proc/'+p+'/fd'})){try{if(k==='descriptors')fs.readdirSync(path);else fs.readFileSync(path);r[k]=true;}catch{r[k]=false;}}try{process.kill(p,0);r.signal=true;}catch{r.signal=false;}console.log(JSON.stringify(r));`;
  const access=JSON.parse(docker(['exec',daemon,'node','-e',probe]));
  const measurement=JSON.parse(docker(['exec',worker,'node','-e',"const fs=require('fs'),r={};for(const p of ['/proc/1/environ','/proc/1/mountinfo','/proc/1/root']){try{p.endsWith('root')?fs.statSync(p):fs.readFileSync(p);r[p]='ok';}catch(e){r[p]=e.code;}}console.log(JSON.stringify({readDaemon:Object.values(r).every(x=>x==='ok'),details:r}));"]));
  if(uid!=='0'){assert.deepEqual(access,{secret:false,environment:false,descriptors:false,signal:false});assert.equal(measurement.readDaemon,true);}
  const guard=docker(['exec',worker,'node','--input-type=module','-e',"import {readFileSync} from 'node:fs';import {verifyProcessIsolation} from '/isolation.mjs';try{verifyProcessIsolation(readFileSync('/proc/1/status','utf8'),readFileSync('/proc/self/status','utf8'));console.log('accepted')}catch{console.log('rejected')}"]);assert.equal(guard,uid==='0'?'rejected':'accepted');
  results.push({label,daemonUid:Number(uid),workerUid:0,workerPtrace:uid!=='0',workerReadSearch:uid!=='0',guard,daemonCanAccessWorker:access,workerCanMeasureDaemon:measurement.readDaemon,measurementDetails:measurement.details});
 }
 writeFileSync(new URL('./result.json',import.meta.url),JSON.stringify({syntheticOnly:true,realDocker:true,realClamav:false,productionReady:false,results},null,2)+'\n');console.log(JSON.stringify(results,null,2));
}finally{for(const name of names)try{docker(['rm','-f',name]);}catch{}try{docker(['volume','rm',volume]);}catch{}}
