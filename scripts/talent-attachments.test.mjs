import test from 'node:test';
import assert from 'node:assert/strict';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
import {id} from './fixtures/daily-operations.mjs';
const m=await importActualTypeScript(new URL('../src/lib/talent/attachments.ts',import.meta.url));
const input={id:id(1),personId:id(2),category:'cv',filename:'cv.pdf',mime:'application/pdf',size:100,sha256:'a'.repeat(64)};
test('onboarding access excludes operations while ordinary attachments remain available',()=>{
 for(const role of ['yonetici','ik'])assert.equal(m.canAccessAttachment(role,'onboarding'),true);
 assert.equal(m.canAccessAttachment('operasyon','onboarding'),false);assert.equal(m.canAccessAttachment('operasyon','photo'),true);
 for(const role of ['partner','goruntuleyici','muhasebe'])assert.equal(m.canAccessAttachment(role,'cv'),false);
});
test('metadata rejects path names, oversized files, PDF photos and forged properties',()=>{
 assert.equal(m.validateAttachment(input).filename,'cv.pdf');
 for(const patch of [{filename:'../cv.pdf'},{filename:'a\\b'},{filename:'\0'},{size:0},{size:m.ATTACHMENT_MAX_BYTES+1},{category:'photo'},{category:'__proto__'},{mime:'text/html'},{actorId:id(3)},{sha256:''}])assert.throws(()=>m.validateAttachment({...input,...patch}));
});
test('file signature is checked rather than trusting filename or browser MIME',()=>{
 assert.equal(m.attachmentMime(new Uint8Array([137,80,78,71,13,10,26,10])),'image/png');
 assert.equal(m.attachmentMime(new Uint8Array([255,216,255])),'image/jpeg');
 assert.equal(m.attachmentMime(new TextEncoder().encode('%PDF-1.7')),'application/pdf');
 assert.throws(()=>m.attachmentMime(new TextEncoder().encode('<html>')));
});

const commands=await importActualTypeScript(new URL('../src/lib/talent/attachment-command.ts',import.meta.url));
const scope={actorId:id(1),tenantId:id(2)};
function memory(){const map=new Map();return {map,getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};}
test('lost upload response survives reload and reuses its command without storing file contents',()=>{
 const storage=memory();
 const first=commands.attachmentCommand(storage,scope,id(3),'cv','a'.repeat(64),()=>id(4));
 const retry=commands.attachmentCommand(storage,scope,id(3),'cv','a'.repeat(64),()=>{throw Error('must reuse');});
 assert.deepEqual(retry,first);assert.deepEqual([...storage.map.values()],[id(4)]);
 assert.equal(commands.clearAttachmentCommand(storage,retry),true);
 assert.equal(commands.attachmentCommand(storage,scope,id(3),'cv','a'.repeat(64),()=>id(5)).id,id(5));
});
test('upload references are isolated by actor, tenant, person, category and file fingerprint',()=>{
 const storage=memory();const base=[scope,id(3),'cv','a'.repeat(64)];
 const cases=[base,[{...scope,actorId:id(8)},...base.slice(1)],[{...scope,tenantId:id(8)},...base.slice(1)],[scope,id(8),...base.slice(2)],[scope,id(3),'photo',base[3]],[scope,id(3),'cv','b'.repeat(64)]];
 const keys=cases.map(args=>commands.attachmentCommand(storage,...args,()=>id(4)).key);
 assert.equal(new Set(keys).size,cases.length);
});
test('blocked, silently discarded or corrupted browser storage prevents starting a new command',()=>{
 const args=[scope,id(3),'cv','a'.repeat(64),()=>id(4)];
 assert.throws(()=>commands.attachmentCommand({getItem(){throw Error('denied');}},...args));
 assert.throws(()=>commands.attachmentCommand({getItem:()=>null,setItem(){}},...args));
 assert.throws(()=>commands.attachmentCommand({getItem:()=>'{broken}'},...args));
 const storage=memory();assert.throws(()=>commands.attachmentCommand(storage,scope,id(3),'cv','not a hash',()=>id(4)));
 assert.equal(storage.map.size,0);
});
test('confirmation cannot clear a different command written by another tab',()=>{
 const storage=memory();const command=commands.attachmentCommand(storage,scope,id(3),'cv','a'.repeat(64),()=>id(4));
 storage.setItem(command.key,id(5));assert.equal(commands.clearAttachmentCommand(storage,command),false);
 assert.equal(storage.getItem(command.key),id(5));
});

const upload=await importActualTypeScript(new URL('../src/lib/talent/attachment-upload.ts',import.meta.url));
test('upload recovery accepts duplicate status 400 or 409 and lost responses only after database confirmation',async()=>{
 for(const outcome of [400,409,'lost']){
  const calls=[];
  await upload.uploadAttachment({reserve:async()=>({data:{id:input.id,ready:false},error:null}),upload:async()=>{calls.push('upload');if(outcome==='lost')throw Error('response lost');return {error:{statusCode:outcome}};},finish:async()=>{calls.push('finish');return {data:true,error:null};}},input,new Uint8Array());
  assert.deepEqual(calls,['upload','finish']);
 }
});
test('a successful Storage response never substitutes for failed or non-boolean database confirmation',async()=>{
 for(const finished of [{data:false,error:null},{data:null,error:null},{data:'true',error:null},{data:true,error:Error('scope revoked')}]){
  await assert.rejects(upload.uploadAttachment({reserve:async()=>({data:{id:input.id,ready:false},error:null}),upload:async()=>({error:null}),finish:async()=>finished},input,new Uint8Array()));
 }
});
test('confirmed reserve replay avoids uploading twice; malformed reserve never uploads',async()=>{
 const no=async()=>{assert.fail('must not call Storage or finish');};
 await upload.uploadAttachment({reserve:async()=>({data:{id:input.id,ready:true},error:null}),upload:no,finish:no},input,new Uint8Array());
 for(const data of [null,{id:input.id,ready:'true'},{id:id(9),ready:true}]){
  await assert.rejects(upload.uploadAttachment({reserve:async()=>({data,error:null}),upload:no,finish:no},input,new Uint8Array()));
 }
});

test('two tabs reserve one upload command through the same exclusive lock',async()=>{
 const storage=memory(),names=[];let queue=Promise.resolve(),created=0;
 const locks={request(name,fn){names.push(name);const task=queue.then(fn);queue=task.catch(()=>{});return task;}};
 const args=[storage,locks,scope,id(3),'cv','a'.repeat(64),()=>{created++;return id(4);}];
 const [a,b]=await Promise.all([commands.reserveAttachmentCommand(...args),commands.reserveAttachmentCommand(...args)]);
 assert.deepEqual(a,b);assert.equal(created,1);assert.equal(names[0],names[1]);
});
test('missing or rejected cross-tab lock never allocates an upload reference',async()=>{
 const storage=memory();
 for(const locks of [undefined,{request:async()=>{throw Error('locks blocked');}}]){
  await assert.rejects(commands.reserveAttachmentCommand(storage,locks,scope,id(3),'cv','a'.repeat(64),()=>{assert.fail('must not create a command');}));
 }
 assert.equal(storage.map.size,0);
});

const attachmentRow={id:id(4),person_id:id(2),category:'cv',filename:'cv.pdf',mime:'application/pdf',size:100,created_at:'2026-09-15T09:00:00+00:00'};
test('attachment list distinguishes measured empty from missing or corrupt response',()=>{
 assert.deepEqual(m.parseAttachmentRows([],id(2)),[]);
 assert.deepEqual(m.parseAttachmentRows([attachmentRow],id(2)),[attachmentRow]);
 for(const value of [null,undefined,{},[null],[[]]])assert.throws(()=>m.parseAttachmentRows(value,id(2)));
});
test('attachment list rejects wrong person, duplicate IDs and malformed file metadata',()=>{
 for(const patch of [{person_id:id(3)},{id:'bad'},{size:null},{size:'100'},{size:-1},{size:NaN},{size:m.ATTACHMENT_MAX_BYTES+1},{mime:'text/html'},{category:'photo'},{filename:'../cv.pdf'},{created_at:'yesterday'},{created_at:null}]){
  assert.throws(()=>m.parseAttachmentRows([{...attachmentRow,...patch}],id(2)));
 }
 assert.throws(()=>m.parseAttachmentRows([attachmentRow,attachmentRow],id(2)));
});
test('attachment list keeps the 51st pagination sentinel but rejects an unexpected oversized response',()=>{
 const rows=Array.from({length:51},(_,n)=>({...attachmentRow,id:id(n+100)}));
 assert.equal(m.parseAttachmentRows(rows,id(2)).length,51);
 assert.throws(()=>m.parseAttachmentRows([...rows,{...attachmentRow,id:id(200)}],id(2)));
});

test('confirmation and reservation use the same lock; a queued new command survives cleanup',async()=>{
 const storage=memory(),names=[];let queue=Promise.resolve();
 const locks={request(name,fn){names.push(name);const task=queue.then(fn);queue=task.catch(()=>{});return task;}};
 const old=await commands.reserveAttachmentCommand(storage,locks,scope,id(3),'cv','a'.repeat(64),()=>id(4));
 const [cleared,next]=await Promise.all([
  commands.settleAttachmentCommand(storage,locks,old),
  commands.reserveAttachmentCommand(storage,locks,scope,id(3),'cv','a'.repeat(64),()=>id(5)),
 ]);
 assert.equal(cleared,true);assert.equal(next.id,id(5));assert.equal(storage.getItem(next.key),id(5));
 assert.equal(new Set(names).size,1);
 assert.equal(await commands.settleAttachmentCommand(storage,locks,old),false);
 assert.equal(storage.getItem(next.key),id(5));
});
test('confirmation preserves recovery reference if cross-tab lock cannot be acquired',async()=>{
 const storage=memory();const command=commands.attachmentCommand(storage,scope,id(3),'cv','a'.repeat(64),()=>id(4));
 await assert.rejects(commands.settleAttachmentCommand(storage,undefined,command));
 assert.equal(storage.getItem(command.key),command.id);
});

test('cancel cleanup only clears matching command inside the same actor tenant and person',async()=>{
 const base=memory();const storage={...base,get length(){return base.map.size;},key:i=>[...base.map.keys()][i]??null};
 const locks={request:async(_name,fn)=>fn()};
 const own=commands.attachmentCommand(storage,scope,id(3),'cv','a'.repeat(64),()=>id(4));
 const otherPerson=commands.attachmentCommand(storage,scope,id(8),'cv','a'.repeat(64),()=>id(4));
 const newer=commands.attachmentCommand(storage,scope,id(3),'cv','b'.repeat(64),()=>id(9));
 await commands.settleCancelledAttachment(storage,locks,scope,id(3),id(4));
 assert.equal(storage.getItem(own.key),null);assert.equal(storage.getItem(otherPerson.key),id(4));assert.equal(storage.getItem(newer.key),id(9));
});
