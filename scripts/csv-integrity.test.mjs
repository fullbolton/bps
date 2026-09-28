import {pathToFileURL} from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
const {parseCSV,decodeCSV,CSV_LIMITS}=await importActualTypeScript(process.env.BPS_TEST_SOURCE?pathToFileURL(process.env.BPS_TEST_SOURCE+'/src/lib/import/csv-parser.ts'):new URL('../src/lib/import/csv-parser.ts',import.meta.url));
test('malformed headers, widths and quotes never produce writable rows',()=>{
 for(const text of ['name,name\nfirst,second','name,city\nA,Istanbul,discarded','name,city\nA','name,city\n"Acme,Istanbul','name,\nA,B','name\nA"B"','name\n"A"suffix'])assert.throws(()=>parseCSV(text));
});
test('valid BOM CRLF multiline escaped quotes and semicolon fields survive',()=>{
 assert.deepEqual(parseCSV('\ufeffname;city\r\n"A; ""B""\nC";Ankara\r\n').rows,[{name:'A; "B"\nC',city:'Ankara'}]);
 assert.deepEqual(parseCSV('name,city\nA,\n\n').rows,[{name:'A',city:''}]);
 assert.equal(parseCSV('name\n""').rows[0].name,'');
});
test('invalid encodings and resource limits fail before preview',()=>{
 for(const bytes of [new Uint8Array([0xff,0xfe,65,0]),new Uint8Array([0xc3,0x28])])assert.throws(()=>decodeCSV(bytes.buffer));
 assert.throws(()=>parseCSV('name\n'+ 'x'.repeat(CSV_LIMITS.field+1)));
 assert.throws(()=>parseCSV('name\n'+'A\n'.repeat(CSV_LIMITS.rows+1)));
 assert.equal(parseCSV('name\n'+'A\n'.repeat(CSV_LIMITS.rows)).rows.length,CSV_LIMITS.rows);
 assert.throws(()=>parseCSV('name\nA\0'));
});
