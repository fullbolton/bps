import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
const parser=await importActualTypeScript(new URL('../src/lib/import/csv-parser.ts',import.meta.url));
const code=ts.transpileModule(readFileSync(new URL('../src/lib/import/csv-reader.worker.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
function parse(text,type='companies',companies=[]){let result;const self={postMessage:value=>result=value};vm.runInNewContext(code,{self,exports:{},require:name=>{assert.equal(name,'./csv-parser');return parser;},Map,Error});self.onmessage({data:{bytes:new TextEncoder().encode(text).buffer,type,companies}});return result;}
test('real CSV worker keeps full row validation and explicit company matching',()=>{
 const companies=parse('name\nSentetik Firma');assert.equal(companies.ok,true);assert.equal(companies.result.validCount,1);
 const contact=parse('company_name,full_name,email\nSentetik Firma,Test Kişi,test@example.invalid','contacts',[['Sentetik Firma','company-id']]);assert.equal(contact.ok,true);assert.equal(contact.result.validCount,1);
 const unmatched=parse('company_name,full_name,email\nBaşka Firma,Test Kişi,test@example.invalid','contacts',[['Sentetik Firma','company-id']]);assert.equal(unmatched.result.invalidCount,1);
});
test('malformed CSV and empty data do not produce a successful worker result',()=>{
 for(const text of ['name,name\na,b','name\n"broken','name'])assert.equal(parse(text).ok,false);
});
