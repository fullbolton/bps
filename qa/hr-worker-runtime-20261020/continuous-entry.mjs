// Test-only Rosetta accommodation; production main has no such bypass.
import {readFileSync} from 'node:fs';import {runManagedWorker} from '/worker/runtime.mjs';import {createEngineReader,verifyClamdConfig} from '/worker/config.mjs';import {verifyProcessIsolation} from '/worker/isolation.mjs';
const stop=new AbortController();process.on('SIGTERM',()=>stop.abort());
const result=await runManagedWorker({env:process.env,signal:stop.signal,makeEngine:options=>{
 verifyClamdConfig(readFileSync('/qa/clamd.conf','utf8'),{...options,socketPath:'/run/bps-clam/clamd.sock'});
 const reader=createEngineReader({...options,acceptanceOnly:true});return async()=>{verifyProcessIsolation(readFileSync('/proc/1/status','utf8'),readFileSync('/proc/self/status','utf8'));return reader();};
}});if(result.state==='halted')process.exitCode=1;
