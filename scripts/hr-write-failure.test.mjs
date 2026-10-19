import test from 'node:test';import assert from 'node:assert/strict';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
const {hrWriteFailure:classify}=await importActualTypeScript(new URL('../src/lib/services/hr-write-failure.ts',import.meta.url));
test('only explicit database rollback permits replacing a frozen HR command',()=>{
 for(const message of ['ACCESS_STALE','HR_FORBIDDEN','HR_STALE_OR_NOT_TRANSFERABLE','HR_INPUT'])assert.equal(classify({code:'P0001',message}),'rejected');
 for(const e of [null,new Error('ACCESS_STALE'),{code:'500',message:'ACCESS_STALE'},{code:'P0001',message:'unknown'}, {code:'P0001',message:'HR_COMMAND_REUSED'}])assert.equal(classify(e),'uncertain');
});
test('a later rejection never disproves an earlier uncertain commit',()=>{
 assert.equal(classify({code:'P0001',message:'HR_FORBIDDEN'},true),'uncertain');
 assert.equal(classify({code:'P0001',message:'ACCESS_STALE'},true),'uncertain');
});

test('activation rollback is definitive only before any uncertain attempt',()=>{
 for(const message of ['HR_ACTIVATION_STALE','HR_ACTIVATION_BLOCKED','ACCESS_MANAGER_REQUIRED','ACCESS_SCOPE']){
  assert.equal(classify({code:'P0001',message}),'rejected');
  assert.equal(classify({code:'P0001',message},true),'uncertain');
 }
 assert.equal(classify({code:'P0001',message:'HR_ACTIVATION_COMMAND_REUSED'}),'uncertain');
});
