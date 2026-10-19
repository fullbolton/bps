import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {scanBytes} from '/worker/clamd.mjs';
const checks=[];
for(const [file,expected] of [['clean.pdf','clean'],['eicar.txt','infected'],['encrypted.pdf','infected'],['limit.pdf','infected']]){
 const result=await scanBytes(readFileSync('/fixtures/'+file),{socketPath:'/run/bps-clam/clamd.sock',timeoutMs:60000});
 assert.equal(result.verdict,expected,file);checks.push({file,verdict:result.verdict});console.log('PASS',file,result.verdict);
}
writeFileSync('/evidence/result.json',JSON.stringify({...JSON.parse(readFileSync('/evidence/engine.json','utf8')),realEngine:true,realUnixTransport:true,syntheticOnly:true,productionReady:false,checks},null,2)+'\n');
