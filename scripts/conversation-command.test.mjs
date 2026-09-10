import test from 'node:test';
import assert from 'node:assert/strict';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
import {id} from './fixtures/daily-operations.mjs';
const {validateCommentCommand:validate,commentCommandIdentity:identity,parseCommentReceipt:receipt}=await importActualTypeScript(new URL('../src/lib/operations/conversation-command.ts',import.meta.url));
const base={commandId:id(100),actorId:id(10),tenantId:id(1),requestId:id(30),body:'Şubeye giriş kartı gerekiyor.',parentId:null,mentionIds:[id(11)]};
test('strict command rejects forged identity/display/routing fields and missing fields',()=>{
 for(const raw of [null,[],true,{...base,authorName:'forged'},{...base,href:'https://external'},{...base,role:'yonetici'},{...base,tenantId:'bad'}])assert.throws(()=>validate(raw));
 for(const key of Object.keys(base)){const raw={...base};delete raw[key];assert.throws(()=>validate(raw));}
});
test('unicode PostgreSQL character boundary, Turkish text, line endings, NUL and broken UTF-16',()=>{
 assert.equal(validate({...base,body:'  İstanbul\r\nŞube  '}).body,'İstanbul\nŞube');
 assert.equal([...validate({...base,body:'😀'.repeat(4000)}).body].length,4000);
 for(const body of ['', ' \n\t ', '😀'.repeat(4001),'a\0b','\uD800','\uDC00'])assert.throws(()=>validate({...base,body}));
});
test('mentions are selected identifiers, canonical order, detached from caller array',()=>{
 const raw={...base,body:'@Mehmet yalnız metin',mentionIds:[id(12),id(11),id(12)]};
 const result=validate(raw);assert.deepEqual(result.mentionIds,[id(11),id(12)]);assert.equal(raw.mentionIds.length,3);
 assert.deepEqual(validate({...raw,mentionIds:[]}).mentionIds,[]);
 for(const mentionIds of [null,'@Mehmet',['@Mehmet'],Array(11).fill(id(11))])assert.throws(()=>validate({...base,mentionIds}));
});
test('retry comparison is stable but every scope/content change differs',()=>{
 assert.equal(identity({...base,mentionIds:[id(12),id(11)]}),identity({...base,mentionIds:[id(11),id(12),id(11)]}));
 for(const patch of [{actorId:id(11)},{tenantId:id(2)},{requestId:id(31)},{commandId:id(101)},{body:'Değişti'},{parentId:id(200)},{mentionIds:[]}])assert.notEqual(identity(base),identity({...base,...patch}));
});
test('null/string/mismatched receipt cannot acknowledge pending command',()=>{
 const good={commandId:base.commandId,actorId:base.actorId,tenantId:base.tenantId,requestId:base.requestId,messageId:id(200)};
 assert.deepEqual(receipt(good,base),{messageId:id(200)});
 for(const raw of [null,'true',true,{}, {...good,messageId:null}])assert.throws(()=>receipt(raw,base),/COMM_RESPONSE/);
 for(const key of ['commandId','actorId','tenantId','requestId'])assert.throws(()=>receipt({...good,[key]:id(999)},base),/COMM_RESPONSE/);
});

test('resolution requires matching scope and a recognized terminal result',async()=>{
 const {parseCommentResolution:resolve}=await importActualTypeScript(new URL('../src/lib/operations/conversation-command.ts',import.meta.url));
 const scope={commandId:base.commandId,actorId:base.actorId,tenantId:base.tenantId,requestId:base.requestId};
 assert.deepEqual(resolve({...scope,status:'closed'},base),{status:'closed'});
 assert.deepEqual(resolve({...scope,status:'sent',messageId:id(200)},base),{status:'sent',messageId:id(200)});
 for(const r of [null,{...scope,status:'missing'},{...scope,status:'sent'},{...scope,status:'closed',tenantId:id(2)}])assert.throws(()=>resolve(r,base),/COMM_RESPONSE/);
});
