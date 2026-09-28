import {test} from 'node:test';import assert from 'node:assert/strict';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
const {listPilotCompanies}=await importActualTypeScript(new URL('../src/lib/services/daily-operations.ts',import.meta.url));
const statuses=['aday','aktif','pasif',null,'unknown'];
test('actual company service enables candidate and active only, preserves input CRM statuses',async()=>{
 const rows=statuses.map((status,i)=>({id:String(i),name:'Company '+i,status}));const snapshot=structuredClone(rows);
 const chain={select:()=>chain,eq:()=>chain,order:async()=>({data:rows,error:null})};
 const c={rpc:async()=>({data:'tenant',error:null}),from:()=>chain};
 const result=await listPilotCompanies(c);assert.deepEqual(result.map(r=>r.active),[true,true,false,false,false]);assert.deepEqual(rows,snapshot);
});
test('company directory failures are not presented as empty success',async()=>{
 await assert.rejects(()=>listPilotCompanies({rpc:async()=>({data:null,error:Error('transport')})}),/transport/);
 const chain={select:()=>chain,eq:()=>chain,order:async()=>({data:null,error:null})};
 await assert.rejects(()=>listPilotCompanies({rpc:async()=>({data:'tenant',error:null}),from:()=>chain}),/Firma listesi/);
});
