import {stageSignatures} from '../../workers/hr-malware/signature-stage.mjs';
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {writeFile} from 'node:fs/promises';
const exec=promisify(execFile);
let staged;
try{
 staged=await stageSignatures({seedVolume:'bps-clam-signatures-20261020'});
 const probe=await exec(process.execPath,['qa/hr-worker-isolation-20261020/clamd-accept.mjs'],{env:{...process.env,BPS_TEST_SIGNATURE_VOLUME:staged.volume},timeout:180000,maxBuffer:1048576});
 const measured=JSON.parse(probe.stdout);
 const result={realFreshclam:true,isolatedStaging:true,seedReadOnly:true,newDaemonWithStagedSignatures:measured.realClamav,checks:measured.checks,emulatedDaemon:true,productionReady:false,liveDaemonRestart:false};
 await writeFile(new URL('./signature-stage-result.json',import.meta.url),JSON.stringify(result,null,2)+'\n');console.log(result);
}finally{if(staged)await exec('docker',['volume','rm',staged.volume]);}
