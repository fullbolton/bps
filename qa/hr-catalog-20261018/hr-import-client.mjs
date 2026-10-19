import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {importActualTypeScript} from '../../scripts/helpers/import-typescript.mjs';
const {prepareHrImportRows}=await importActualTypeScript(new URL('../../src/lib/hr/import-preview.ts',import.meta.url));
const row=(number,...values)=>({number,cells:values.map(value=>typeof value==='string'?{value}:value)});
const sheet=rows=>({name:'People',hidden:false,rows:[row(1,'Kod','Ad','Giriş'),...rows]});
const map={code:0,name:1,startsOn:2};const prepare=rows=>prepareHrImportRows(sheet(rows),1,map);
const valid=prepare([row(2,'001','Synthetic','01.02.2026'),row(3,'EXIST','','')]);assert.equal(valid.canCompare,true);assert.equal(valid.rows[0].code,'001');assert.equal(valid.rows[0].startsOn,'2026-02-01');assert.equal(valid.rows[1].name,'');
assert.equal(prepare([row(2,'A','',''),row(3,'a','','')]).canCompare,false);
for(const cells of [['A','Synthetic','30.02.2026'],['12345678901','',''],['A',{value:'cached',issue:'formula'},''],['A','','01/02/2026']])assert.equal(prepare([row(2,...cells)]).canCompare,false);
assert.throws(()=>prepareHrImportRows({...sheet([]),hidden:true},1,map));assert.throws(()=>prepareHrImportRows(sheet([]),1,{...map,name:0}));assert.throws(()=>prepare(Array.from({length:201},(_,i)=>row(i+2,`A${i}`,'',''))));
assert.equal(prepare([row(2,'','','')]).canCompare,false);

const {parseHrImport}=await importActualTypeScript(new URL('../../src/lib/services/hr-import.ts',import.meta.url));
const response={schemaVersion:1,actorId:'actor',tenantId:'tenant',rows:valid.rows.map(r=>({row:r.row,code:r.code,status:'new'}))};
assert.equal(parseHrImport(response,'actor','tenant',valid.rows).length,2);
for(const patch of [{tenantId:'other'},{rows:[]},{rows:[...response.rows].reverse()},{rows:response.rows.map(r=>({...r,status:'unknown'}))}])assert.throws(()=>parseHrImport({...response,...patch},'actor','tenant',valid.rows));
console.log('PASS HR comparison identity and row binding');

writeFileSync(new URL('./hr-import-client-result.json',import.meta.url),JSON.stringify({passed:5,actualSource:true,checks:['Leading zero codes and explicit Turkish/ISO date normalization','Blank cells remain blank; duplicates block full comparison','Formula/error/identity-like data and ambiguous dates rejected','Hidden sheet/duplicate mapping/row limits/empty selection rejected','Response company and ordered row identity binding']},null,2)+'\n');console.log('PASS 5 HR import client groups');
