import test from 'node:test';
import assert from 'node:assert/strict';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
const {readLocalReference}=await importActualTypeScript(new URL('../src/lib/talent/local-reference.ts',import.meta.url));
const {importReference}=await importActualTypeScript(new URL('../src/lib/talent/import-batches.ts',import.meta.url));
const reference={batchId:'00000000-0000-4000-8000-000000000001',sourceHash:'a'.repeat(64),total:1};
test('local import receipt distinguishes absent, valid, malformed JSON and old shape',()=>{
 assert.deepEqual(readLocalReference(()=>null,importReference),{kind:'empty'});
 assert.deepEqual(readLocalReference(()=>JSON.stringify(reference),importReference),{kind:'valid',value:reference});
 for(const value of ['','{','{}',JSON.stringify({...reference,total:0}),JSON.stringify({batchId:reference.batchId})])assert.deepEqual(readLocalReference(()=>value,importReference),{kind:'invalid'});
});
test('blocked storage stays unavailable, is never treated as an empty receipt, and leaks no raw contents',()=>{
 const error=new Error('private@example.invalid');error.name='SecurityError';
 assert.deepEqual(readLocalReference(()=>{throw error;},importReference),{kind:'unavailable'});
 const result=readLocalReference(()=>'{"private":"private@example.invalid"}',importReference);
 assert.equal(JSON.stringify(result).includes('private'),false);
});
const {parsePendingPerson}=await importActualTypeScript(new URL('../src/lib/talent/people.ts',import.meta.url));
test('person receipt retry preserves command identity and distinguishes malformed and blocked storage',()=>{
 const receipt={commandId:reference.batchId,personId:null,expectedRevision:null};
 let stored='{';
 const read=()=>readLocalReference(()=>stored,parsePendingPerson);
 assert.deepEqual(read(),{kind:'invalid'});
 stored=JSON.stringify(receipt);
 assert.deepEqual(read(),{kind:'valid',value:receipt});
 for(const value of ['', '{}', JSON.stringify({...receipt,expectedRevision:1})])assert.deepEqual(readLocalReference(()=>value,parsePendingPerson),{kind:'invalid'});
 assert.deepEqual(readLocalReference(()=>{throw new Error('blocked');},parsePendingPerson),{kind:'unavailable'});
 assert.deepEqual(readLocalReference(()=>null,parsePendingPerson),{kind:'empty'});
});
const {clearResolvedLocalReference}=await importActualTypeScript(new URL('../src/lib/talent/local-reference.ts',import.meta.url));
test('resolved receipt removal failure preserves receipt and allows retry without leaking storage error',()=>{
 let stored=JSON.stringify(reference),blocked=true;
 const remove=()=>{if(blocked)throw new Error('private storage error');stored=null;};
 assert.equal(clearResolvedLocalReference(remove),false);
 assert.equal(stored,JSON.stringify(reference));
 blocked=false;
 assert.equal(clearResolvedLocalReference(remove),true);
 assert.equal(stored,null);
 assert.equal(clearResolvedLocalReference(remove),true);
});
