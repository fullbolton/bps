// Local Rosetta-only acceptance entry. Production reader has no bypass.
import {readFileSync} from 'node:fs';
import {createEngineReader,verifyClamdConfig} from '/worker/config.mjs';
import {verifyProcessIsolation} from '/worker/isolation.mjs';
const expectedDigest=process.env.BPS_SCAN_CONFIG_SHA256;
verifyProcessIsolation(readFileSync('/proc/1/status','utf8'),readFileSync('/proc/self/status','utf8'));
verifyClamdConfig(readFileSync('/qa/clamd.conf','utf8'),{expectedDigest,socketPath:'/run/bps-clam/clamd.sock'});
console.log(JSON.stringify(await createEngineReader({expectedDigest,acceptanceOnly:true})()));
