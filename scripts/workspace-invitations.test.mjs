import test from 'node:test';import assert from 'node:assert/strict';import {importActualTypeScript} from './helpers/import-typescript.mjs';
const b=await importActualTypeScript(new URL('../src/lib/workspace-invitations.ts',import.meta.url));
const row={id:'00000000-0000-4000-8000-000000000600',email:'person@example.test',role:'operasyon',expiresAt:'2026-09-16T10:00:00Z',state:'pending'};
test('invitation parsing fails closed and excludes server extras',()=>{
 assert.deepEqual(b.parseInvitations([{...row,token_hash:'private'}]),[row]);assert.deepEqual(b.parseInvitations([]),[]);
 for(const r of [null,{},[row,row],[{...row,role:'yonetici'}],[{...row,state:'bad'}],[{...row,expiresAt:'bad'}]])assert.throws(()=>b.parseInvitations(r));
});
test('token has 256 random bits and transport failure is not labelled invalid invitation',()=>{
 const a=b.newInvitationToken(),c=b.newInvitationToken();assert.match(a,/^[a-f0-9]{64}$/);assert.notEqual(a,c);
 assert.match(b.invitationError(Error('network')),/doğrulanamadı/);assert.match(b.invitationError(Error('INVITE_EXISTING_MEMBER')),/mevcut üyelik değiştirilmedi/);
});
