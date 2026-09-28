import test from 'node:test';import assert from 'node:assert/strict';import {importActualTypeScript} from './helpers/import-typescript.mjs';
const {validateImportRequest,parseImportStatus,parseImportRow}=await importActualTypeScript(new URL('../src/lib/talent/import-batches.ts',import.meta.url));
const {prepareTalentImport,loadTalentImport,applyTalentImportRow}=await importActualTypeScript(new URL('../src/lib/services/talent-import.ts',import.meta.url));
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const scope={actorId:id(1),tenantId:id(2)},ref={batchId:id(3),sourceHash:'a'.repeat(64),total:2};
const source={name:'Sentetik Kişi',phone:'05550000001',email:'',city:'Ankara'};
const request={...ref,rows:[{number:2,kind:'new',source},{number:8,kind:'hold'}]};
const status={...scope,...ref,rows:[{number:2,status:'pending',result:null},{number:8,status:'held',result:null}]};
test('batch request preserves sparse physical row numbers and rejects malformed or duplicate decisions',()=>{
 assert.deepEqual(validateImportRequest(request),request);
 for(const x of [{...request,total:3},{...request,rows:[request.rows[0],request.rows[0]]},{...request,rows:[{...request.rows[0],source:{...source,iban:'private'}},request.rows[1]]},{...request,rows:[{number:2,kind:'existing',source,targetId:id(4),expectedRevision:0,fields:['email']},request.rows[1]]},{...request,total:501}])assert.throws(()=>validateImportRequest(x));
});
test('status must be complete and belong to the expected actor, company, batch and source',()=>{
 assert.deepEqual(parseImportStatus(status,scope,ref),status);
 for(const x of [null,{...status,actorId:id(7)},{...status,sourceHash:'b'.repeat(64)},{...status,rows:status.rows.slice(0,1)},{...status,rows:[status.rows[0],status.rows[0]]},{...status,rows:[{number:2,status:'created',result:null},status.rows[1]]}])assert.throws(()=>parseImportStatus(x,scope,ref));
});
test('terminal receipt and blocked codes cannot be coerced or accepted for another row',()=>{
 assert.equal(parseImportRow({number:2,status:'created',result:{personId:id(4),revision:0}},2).status,'created');
 for(const row of [{number:3,status:'pending',result:null},{number:2,status:'created',result:{personId:id(4),revision:1}},{number:2,status:'blocked',result:{code:'arbitrary SQL error'}},{number:2,status:'cancelled',result:{personId:id(4),revision:0}}])assert.throws(()=>parseImportRow(row,2));
});
test('services use scoped RPCs, validate inputs before calls, and never translate transport failures into success',async()=>{
 const calls=[],client={rpc:async(name,args)=>{calls.push([name,args]);return {data:status,error:null};}};
 await prepareTalentImport(client,scope,request);assert.equal(calls[0][0],'talent_import_prepare');assert.equal(calls[0][1].p_actor,scope.actorId);assert.equal(calls[0][1].p_rows.length,2);
 await assert.rejects(applyTalentImportRow(client,scope,ref,-1));assert.equal(calls.length,1);
 await assert.rejects(loadTalentImport({rpc:async()=>({data:null,error:null})},scope,ref));
 await assert.rejects(loadTalentImport({rpc:async()=>({data:status,error:Error('offline')})},scope,ref));
});

const {parseImportRecovery}=await importActualTypeScript(new URL('../src/lib/talent/import-batches.ts',import.meta.url));
const {buildImportRequest}=await importActualTypeScript(new URL('../src/lib/talent/import-request.ts',import.meta.url));
test('unknown recovery stays distinct from closed and rejects another scope or reference',()=>{
 for(const kind of ['unknown','closed']){
  const receipt={kind,...scope,...ref};assert.deepEqual(parseImportRecovery(receipt,scope,ref),receipt);
  for(const change of [{actorId:id(8)},{tenantId:id(9)},{total:1},{sourceHash:'b'.repeat(64)}])assert.throws(()=>parseImportRecovery({...receipt,...change},scope,ref));
 }
 assert.deepEqual(parseImportRecovery({kind:'batch',data:status},scope,ref),{kind:'batch',data:status});
 assert.throws(()=>parseImportRecovery(null,scope,ref));
});
test('selected plan maps only approved fields and strips all held source information',async()=>{
 const person={id:id(4),revision:3,name:source.name,city:'İstanbul',contacts:[]};
 const snapshot={...scope,total:1,rows:[person],generatedAt:'2026-09-14T10:00:00Z'};
 const row={number:2,...source,branch:'Private branch',original:'Private name',start:'',end:'',status:'DEVAM',reply:'OK',issues:[]};
 const plan=await buildImportRequest([row,{...row,number:8}],snapshot,{2:{kind:'existing',personId:id(4),changes:[1]},8:{kind:'hold'}});
 assert.deepEqual(plan.rows[0].fields,['phone']);assert.equal(plan.rows[0].expectedRevision,3);
 assert.deepEqual(plan.rows[1],{number:8,kind:'hold'});assert.ok(!JSON.stringify(plan).includes('Private'));
 const retry=await buildImportRequest([row,{...row,number:8}],snapshot,{2:{kind:'existing',personId:id(4),changes:[1]},8:{kind:'hold'}});
 assert.equal(retry.sourceHash,plan.sourceHash);assert.notEqual(retry.batchId,plan.batchId);
 await assert.rejects(buildImportRequest([row],snapshot,{}));
 await assert.rejects(buildImportRequest(Array(501).fill(row),snapshot,{}));
});

const {parseImportHistory,historyOffset}=await importActualTypeScript(new URL('../src/lib/talent/import-history.ts',import.meta.url));
test('history requires a complete scoped page and valid pending counts',()=>{
 const item={...ref,createdAt:'2026-09-14T10:00:00Z',pending:1};
 const data={...scope,offset:0,total:1,rows:[item]};assert.deepEqual(parseImportHistory(data,scope,0),data);
 for(const invalid of [{...data,actorId:id(8)},{...data,total:2},{...data,rows:[{...item,pending:3}]},{...data,rows:[{...item,createdAt:'bad'}]},{...data,total:2,rows:[item,item]},{...data,offset:20}])assert.throws(()=>parseImportHistory(invalid,scope,0));
 for(const offset of [null,'0',-20,1,1000020])assert.throws(()=>historyOffset(offset));
});

const {buildImportReport}=await importActualTypeScript(new URL('../src/lib/talent/import-report.ts',import.meta.url));
test('result report includes each physical source row and distinguishes unsettled from saved',()=>{
 const rows=[{number:9,status:'pending',result:null},{number:2,status:'created',result:{personId:id(9),revision:0}},{number:5,status:'blocked',result:{code:'TALENT_CONFLICT'}},{number:6,status:'held',result:null},{number:8,status:'cancelled',result:null},{number:3,status:'updated',result:{personId:id(8),revision:2}},{number:4,status:'unchanged',result:{personId:id(7),revision:0}}];
 const fullRef={...ref,total:7},data={...scope,...fullRef,rows};
 const report=buildImportReport(data,scope,fullRef,'all','2026-09-14T12:00:00Z');assert.equal(report.count,7);assert.equal(report.csv.charCodeAt(0),0xFEFF);assert.equal(report.csv.split('\r\n').length,9);assert.ok(report.csv.indexOf('"2";"created"')<report.csv.indexOf('"9";"pending"'));
 const remaining=buildImportReport(data,scope,fullRef,'remaining','2026-09-14T12:00:00Z');assert.equal(remaining.count,4);assert.ok(!remaining.csv.includes('"created"'));assert.ok(remaining.csv.includes('"cancelled"'));assert.ok(remaining.csv.includes('Henüz kesin sonuç yok'));
 assert.throws(()=>buildImportReport({...data,actorId:id(8)},scope,fullRef,'all','2026-09-14T12:00:00Z'));
 assert.throws(()=>buildImportReport({...data,rows:rows.slice(1)},scope,fullRef,'all','2026-09-14T12:00:00Z'));
 assert.throws(()=>buildImportReport(data,scope,fullRef,'all','not a date'));
});
