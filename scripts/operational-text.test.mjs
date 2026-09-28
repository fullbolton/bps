import test from 'node:test';import assert from 'node:assert/strict';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
const load=p=>importActualTypeScript(new URL('../src/'+p,import.meta.url));
const {hasPrivateOperationalText,privateTextError,PRIVATE_TEXT_MESSAGE}=await load('lib/privacy/operational-text.ts');
const {validateConversation,parseConversation}=await load('lib/talent/conversations.ts');
const {validateCommentCommand,parseCommentCommand,parseCommentResolution}=await load('lib/operations/conversation-command.ts');
const {validateOutreachInput}=await load('lib/operations/replacement-outreach.ts');
const {validateWorkAction,workError}=await load('lib/operations/work-approval.ts');
const id='00000000-0000-4000-8000-000000000001';
const note='Görüşme: 0500 000 00 00';
const conversation={commandId:id,personId:id,requestId:null,channel:'phone',outcome:'reached',note};
const command={commandId:id,actorId:id,tenantId:id,requestId:id,body:note,parentId:null,mentionIds:[]};
test('bounded matcher catches identity-like and Turkish mobile forms',()=>{
 for(const v of ['00000000000','Aranacak: (0500) 000-00-00','+90 (500) 000 00 00','500.000.00.00','０００００００００００','0500\u00a0000 00 00'])assert.equal(hasPrivateOperationalText(v),true,v);
});
test('ordinary dates, times, amounts and long identifiers remain usable; limits explicit',()=>{
 for(const v of ['',null,'28.09.2026 14:30 görüşme','480 dakika; 2 kişi','1.500,00 TL',id,'123456789012345','Tel: beş yüz ...','500/000/00/00','500\n000\n00\n00'])assert.equal(hasPrivateOperationalText(v),false,String(v));
});
test('all four submission validators reject before calling a service',()=>{
 for(const run of [()=>validateConversation(conversation),()=>validateCommentCommand(command),()=>validateOutreachInput({assignmentId:id,workerId:id,expectedRevision:0,outcome:'considering',note}),()=>validateWorkAction('save',{startTime:'08:00',endTime:'17:00',nextDay:false,breakMinutes:60,note}),()=>validateWorkAction('return',{reason:note}),()=>validateWorkAction('reopen',{reason:note})])assert.throws(run,/OPERATION_TEXT_PRIVATE/);
});
test('historical conversation and pending command resolution remain readable',()=>{
 assert.equal(parseConversation({...conversation,id,tenantId:id,actorId:id,recordedAt:'2026-09-28T08:00:00Z'},{tenantId:id,actorId:id},id).note,note);
 assert.equal(parseCommentCommand(command).body,note);
 assert.deepEqual(parseCommentResolution({...command,status:'closed'},command),{status:'closed'});
});
test('validation errors are actionable without echoing private text',()=>{
 assert.equal(privateTextError(Error('OPERATION_TEXT_PRIVATE')),PRIVATE_TEXT_MESSAGE);
 assert.equal(workError({message:'OPERATION_TEXT_PRIVATE'}),PRIVATE_TEXT_MESSAGE);
 assert.equal(privateTextError(Error('network')),null);
 assert.ok(!PRIVATE_TEXT_MESSAGE.includes('0500'));
});
