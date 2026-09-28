import test from 'node:test';import assert from 'node:assert/strict';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
const {startRowState,parseStartBoard}=await importActualTypeScript(new URL('../src/lib/operations/start-board.ts',import.meta.url));
const start=Date.parse('2026-09-09T08:00:00+03:00');
const row={closed:false,startAt:new Date(start).toISOString(),createdAt:new Date(start-7200000).toISOString(),plannedAt:new Date(start-7200000).toISOString(),offsets:[-60,-30,-15],planVersion:1,ownerAvailable:true,confirmedAt:null,events:[]};
const event=(revision,offset,outcome,version=1)=>({kind:'call',revision,planVersion:version,payload:{offset,outcome}});
test('late assignment skips prior checks and requires immediate call',()=>{const r={...row,createdAt:new Date(start-600000).toISOString()};const m=startRowState(r,start-600000);assert.ok(m.steps.every(s=>s.state==='not_applicable'));assert.equal(m.status,'due');});
test('last recorded event wins, not scheduled offset',()=>{const m=startRowState({...row,events:[event(1,-15,'cannot_attend'),event(2,-60,'claimed_arrival')]},start-1000);assert.equal(m.status,'pending');});
test('past plan events cannot colour new plan',()=>{const m=startRowState({...row,planVersion:2,events:[event(1,-15,'claimed_arrival')]},start);assert.equal(m.status,'unverified');assert.equal(m.steps[2].event,undefined);});
test('claimed arrival remains unverified at start even if all calls recorded',()=>{assert.equal(startRowState({...row,events:row.offsets.map((x,i)=>event(i,x,'claimed_arrival'))},start).status,'unverified');});
test('confirmation closes remaining calls without fabricating events; removal closes writes',()=>{const m=startRowState({...row,confirmedAt:new Date(start).toISOString()},start);assert.equal(m.status,'confirmed');assert.ok(m.steps.every(x=>x.state==='not_required'&&!x.event));assert.equal(startRowState({...row,closed:true},start).status,'closed');});

const id='00000000-0000-4000-8000-000000000001';
const timestamp=new Date(start).toISOString();
function boardWithCall(payload){return {serverNow:timestamp,day:'2026-09-09',total:1,members:[],rows:[{...row,id,requestId:id,companyId:id,company:'Sentetik',location:'Şube',worker:'Personel',position:'Görev',revision:1,attendance:'unreported',responsibleId:id,responsible:'Operasyon',claimedBy:null,claimUntil:null,source:null,witness:null,events:[{id,revision:1,planVersion:1,kind:'call',payload,occurredAt:timestamp,recordedAt:timestamp,actor:'Operasyon'}]}]};}
test('unknown or malformed call outcome fails closed instead of hiding required action',()=>{
 for(const outcome of ['cannot_atend','',null,{},1,'toString'])assert.throws(()=>parseStartBoard(boardWithCall({offset:-15,outcome})),/Görüşme sonucu/);
 for(const offset of [undefined,'-15',-1441,1,-0.5])assert.throws(()=>parseStartBoard(boardWithCall({offset,outcome:'unreachable'})),/Görüşme sonucu/);
});
test('all supported call results and extra call offset remain accepted',()=>{
 for(const outcome of ['preparing','on_way','claimed_arrival','unreachable','cannot_attend'])for(const offset of [-1440,-15,0])assert.equal(parseStartBoard(boardWithCall({offset,outcome})).rows[0].events[0].payload.outcome,outcome);
});

const {pilotError}=await importActualTypeScript(new URL('../src/lib/services/daily-operations.ts',import.meta.url));
test('daily attendance conflict directs the operator to reopen independent confirmation',()=>{
 assert.match(pilotError({code:'P0001',message:'START_CONFIRMED'}),/İşe Başlama Takibi/);
 assert.match(pilotError({code:'P0001',message:'START_CONFIRMED'}),/gerekçeyle geri/);
});

const {nextStartCallOffset}=await importActualTypeScript(new URL('../src/lib/operations/start-board.ts',import.meta.url));
test('mobile next call suggests earliest due unrecorded step regardless of offset order',()=>{
 assert.equal(nextStartCallOffset({...row,offsets:[-15,-60,-30]},start-600000),-60);
 assert.equal(nextStartCallOffset({...row,events:[event(1,-60,'on_way')]},start-600000),-30);
 assert.equal(nextStartCallOffset(row,start-7200000),null);
});
test('mobile next call never reopens closed/confirmed work or fabricates scheduled checks',()=>{
 assert.equal(nextStartCallOffset({...row,closed:true},start),null);
 assert.equal(nextStartCallOffset({...row,confirmedAt:new Date(start).toISOString()},start),null);
 assert.equal(nextStartCallOffset({...row,startAt:null},start),null);
 assert.equal(nextStartCallOffset({...row,events:[event(1,-60,'cannot_attend')]},start-600000),null);
 assert.equal(nextStartCallOffset({...row,events:row.offsets.map((offset,i)=>event(i,offset,'on_way'))},start),null);
 assert.equal(nextStartCallOffset({...row,createdAt:new Date(start-600000).toISOString()},start-600000),0);
});
