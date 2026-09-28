import test from 'node:test';import assert from 'node:assert/strict';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
const {validateWorkerPreparation,parseWorkerPreparation}=await importActualTypeScript(new URL('../src/lib/talent/worker-prepare.ts',import.meta.url));
const input={personId:'00000000-0000-4000-8000-000000000001',commandId:'00000000-0000-4000-8000-000000000002',expectedRevision:4,code:'  P001  ',kind:'idp'};
test('preparation preserves identity and explicit work kind; normalizes code',()=>assert.deepEqual(validateWorkerPreparation(input),{...input,code:'P001'}));
test('rejects malformed identities, revisions and unsupported work types',()=>{for(const patch of [{personId:'x'},{commandId:null},{expectedRevision:-1},{expectedRevision:2147483647},{expectedRevision:1.5},{code:''},{code:'x'.repeat(41)},{code:'a\nb'},{kind:'donemsel'},{kind:null}])assert.throws(()=>validateWorkerPreparation({...input,...patch}));});
test('receipt must match command, person, next revision and real worker id',()=>{
 const receipt={id:input.personId,commandId:input.commandId,revision:5,workerId:'00000000-0000-4000-8000-000000000003'};assert.deepEqual(parseWorkerPreparation(receipt,input),receipt);
 for(const value of [null,true,{...receipt,id:input.commandId},{...receipt,commandId:input.personId},{...receipt,revision:4},{...receipt,workerId:null}])assert.throws(()=>parseWorkerPreparation(value,input));
});
