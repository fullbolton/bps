import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import * as XLSX from 'xlsx';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
const {previewSource,suggestMapping,sourceDate}=await importActualTypeScript(new URL('../src/lib/talent/import-preview.ts',import.meta.url));
const sheet=values=>({name:'Kaynak',hidden:false,rows:values.map((v,i)=>({number:i+1,cells:v.map(value=>({value}))}))});
test('suggestions are conservative, duplicates and branch city are not guessed',()=>{
 assert.deepEqual(suggestMapping(['AD SOYAD','TELEFON','İL','TCKN','IBAN'],'people'),{name:0,phone:1});
 assert.equal(suggestMapping(['Ad soyad','Ad soyad'],'people').name,undefined);
 assert.equal(suggestMapping(['İkamet ili'],'coverage').city,undefined);
});
test('calendar dates reject impossible days and ambiguous serials',()=>{
 assert.equal(sourceDate('29.02.2024'),'2024-02-29');for(const v of ['29.02.2025','31.04.2026','???','45999','01.01.1900'])assert.equal(sourceDate(v),null);
});
test('repeated names and shared phones retain all physical source rows without merging',()=>{
 const s=sheet([['Ad soyad','Telefon'],['Ali Örnek','05550000001'],['Ayşe Örnek','05550000001'],['Ali Örnek','05550000001']]);
 const r=previewSource(s,1,'people',{name:0,phone:1});assert.equal(r.rows.length,3);assert.equal(r.repeatedNames,1);assert.equal(r.sharedPhones,1);assert.match(r.rows[2].issues.join(' '),/satırı 2/);
});
test('coverage statuses remain source history; invalid ranges and unmapped fields remain visible',()=>{
 const s=sheet([['Kişi','Şube','Başlangıç','Bitiş','Durum','Cevap','IBAN',''],['Ali Örnek','Şube A','14.09.2026','13.09.2026','HAVUZ','OK','private','note'],['Ayşe Örnek','Şube B','14.09.2026','???','DEVAM','','','']]);
 const r=previewSource(s,1,'coverage',{name:0,branch:1,start:2,end:3,status:4,reply:5});assert.equal(r.rows.length,2);assert.match(r.rows[0].issues.join(' '),/Bitiş başlangıçtan önce/);assert.match(r.rows[1].issues.join(' '),/geçersiz/);assert.equal(r.rows[0].status,'Havuza döndü (kaynak)');assert.match(r.rows[0].reply,/kaynak/);assert.equal(r.unmapped.length,2);assert.equal('attendance' in r.rows[0],false);
});
test('missing, overlapping and wrong-scope mappings are rejected',()=>{
 const s=sheet([['Ad','Şube'],['Ali','A']]);assert.throws(()=>previewSource(s,1,'people',{}));assert.throws(()=>previewSource(s,1,'people',{name:0,phone:0}));assert.throws(()=>previewSource(s,1,'coverage',{name:0}));
});
const zipBounds=await importActualTypeScript(new URL('../src/lib/files/workbook-zip.ts',import.meta.url));
const nativeRequire=createRequire(import.meta.url);
const code=ts.transpileModule(readFileSync(new URL('../src/lib/talent/import-reader.worker.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
function parse(bytes,name){let reply;const self={postMessage:r=>reply=r};vm.runInNewContext(code,{self,exports:{},require:name=>name==='../files/workbook-zip'?zipBounds:nativeRequire(name),TextDecoder,DataView,Uint8Array});self.onmessage({data:{bytes:bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),name}});return reply;}
test('real XLSX reader preserves hidden sheet, physical row numbers, dates and formula diagnostics',()=>{
 const wb=XLSX.utils.book_new(),ws=XLSX.utils.aoa_to_sheet([['Ad soyad','Başlangıç','Not'],['Ali Örnek',45914,''],[],['Ayşe Örnek',45915,'']]);ws.B2.z='dd.mm.yyyy';ws.C2={t:'n',v:2,f:'1+1'};XLSX.utils.book_append_sheet(wb,ws,'Ana');XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([['Ad soyad'],['Gizli örnek']]),'Gizli');wb.Workbook={Sheets:[{Hidden:0},{Hidden:1}]};
 const result=parse(XLSX.write(wb,{type:'buffer',bookType:'xlsx'}),'example.xlsx');assert.equal(result.ok,true);assert.equal(result.book.sheets[1].hidden,true);assert.deepEqual(Array.from(result.book.sheets[0].rows,r=>r.number),[1,2,4]);assert.match(result.book.sheets[0].rows[1].cells[1].value,/^\d{2}\.\d{2}\.2025$/);assert.equal(result.book.sheets[0].rows[1].cells[2].issue,'formula');
});
test('CSV supports BOM CRLF quoted delimiters; bad encoding and renamed text fail',()=>{
 const r=parse(Buffer.from('\ufeffAd soyad;Telefon\r\n"Ali; Örnek";05550000001\r\n'),'people.csv');assert.equal(r.ok,true);assert.equal(r.book.sheets[0].rows[1].cells[0].value,'Ali; Örnek');assert.equal(r.book.sheets[0].rows[1].cells[1].value,'05550000001');
 assert.equal(parse(Buffer.from([0xff,0xfe,65,0]),'people.csv').ok,false);assert.equal(parse(Buffer.from('hello'),'fake.xlsx').ok,false);
});
test('worksheet extents cannot silently truncate oversized sources',()=>{
 const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,{'!ref':'A1:BM2',A1:{t:'s',v:'Ad soyad'}},'Wide');assert.equal(parse(XLSX.write(wb,{type:'buffer',bookType:'xlsx'}),'wide.xlsx').ok,false);
});

test('name-only source and unmapped formula can be explicitly prepared as new without merging',async()=>{
 const {reviewImportDecisions}=await importActualTypeScript(new URL('../src/lib/talent/import-decisions.ts',import.meta.url));
 const s=sheet([['Ad soyad','Hesaplama'],['Sentetik Aday','42']]);
 s.rows[1].cells[1].issue='formula';
 const r=previewSource(s,1,'people',{name:0});
 assert.equal(r.rows[0].issues.length,0);
 assert.equal(r.rows[0].warnings.length,2);
 const snapshot={actorId:'00000000-0000-4000-8000-000000000001',tenantId:'00000000-0000-4000-8000-000000000002',total:0,rows:[],generatedAt:new Date().toISOString()};
 const review=reviewImportDecisions(r.rows,snapshot,{2:{kind:'new'}});
 assert.equal(review.ready,true);
 assert.equal(review.counts.new,1);
 assert.equal(reviewImportDecisions(r.rows,snapshot,{}).ready,false);
});
test('mapped formula, error, invalid contact and missing name still block a new-person decision',async()=>{
 const {reviewImportDecisions}=await importActualTypeScript(new URL('../src/lib/talent/import-decisions.ts',import.meta.url));
 const snapshot={rows:[]};
 for(const issue of ['formula','error']){
  const s=sheet([['Ad','Telefon'],['Sentetik Aday','05550000001']]);s.rows[1].cells[1].issue=issue;
  const r=previewSource(s,1,'people',{name:0,phone:1});
  assert.match(r.rows[0].issues.join(' '),/Eşlenen alanda/);
  assert.equal(reviewImportDecisions(r.rows,snapshot,{2:{kind:'new'}}).ready,false);
 }
 for(const values of [['',''],['Sentetik Aday','abc']]){
  const r=previewSource(sheet([['Ad','Telefon'],values]),1,'people',{name:0,phone:1});
  assert.ok(r.rows[0].issues.length);
  assert.equal(reviewImportDecisions(r.rows,snapshot,{2:{kind:'new'}}).ready,false);
 }
});

test('ten long emails fit the workbook cell budget without truncation; over-limit cells fail',()=>{
 const value=Array.from({length:10},(_,i)=>'a'.repeat(230)+i+'@example.test').join('; ');
 const bytes=Buffer.from('Ad soyad,E-posta\nSentetik,'+value+'\n');
 const result=parse(bytes,'people.csv');assert.equal(result.ok,true);assert.equal(result.book.sheets[0].rows[1].cells[1].value,value);
 assert.equal(previewSource(result.book.sheets[0],1,'people',{name:0,email:1}).issueCount,0);
 assert.equal(parse(Buffer.from('Ad soyad,E-posta\nSentetik,'+'x'.repeat(3001)),'people.csv').ok,false);
});
