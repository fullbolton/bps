import test from 'node:test';
import assert from 'node:assert/strict';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
const {assertMizanWorkbookBounds:check,MIZAN_LIMITS:limits}=await importActualTypeScript(new URL('../src/lib/luca/workbook-limits.ts',import.meta.url));
const book=sheet=>({SheetNames:['mizan'],Sheets:{mizan:sheet}});
test('huge sparse references are rejected before iterating any row',()=>{
 for(const ref of ['A1:XFD1048576','A1:A10001','A1:BM1','A0','B2:A1','A1:A99999999999999999999'])assert.throws(()=>check(book({'!ref':ref})));
 check(book({'!ref':'A1:BL10000',A1:{v:'HESAP KODU'}}));
});
test('long raw, formatted and formula cell contents reject the workbook',()=>{
 for(const key of ['v','w','f'])assert.throws(()=>check(book({'!ref':'A1',A1:{[key]:'a'.repeat(limits.text+1)}})));
 check(book({'!ref':'A1',A1:{v:'a'.repeat(limits.text)}}));
});
test('sheet count, missing sheet and aggregate cells are bounded',()=>{
 assert.throws(()=>check({SheetNames:Array(17).fill('a'),Sheets:{}}));
 assert.throws(()=>check({SheetNames:['missing'],Sheets:{}}));
 const sheet=Object.fromEntries(Array.from({length:limits.cells+1},(_,i)=>['A'+(i+1),{v:0}]));
 assert.throws(()=>check(book(sheet)));
 check({SheetNames:[],Sheets:{}});
});
