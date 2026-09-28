import test from 'node:test';
import assert from 'node:assert/strict';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
const {normalizeTurkishNumber:parse}=await importActualTypeScript(new URL('../src/lib/luca/numeric-cell.ts',import.meta.url));
test('non-finite numeric cells and overflowing numeric text cannot be confirmed',()=>{
 for(const input of [NaN,Infinity,-Infinity,'9'.repeat(400)])assert.ok(parse(input,'BORC').error);
});
test('Turkish grouped and signed amounts preserve their numeric value',()=>{
 for(const [input,value] of [['1.234,56',1234.56],['-1.234,56',-1234.56],['1234,56',1234.56],[1250,1250],[0,0]])assert.deepEqual(parse(input,'BORC'),{value,error:null});
});
test('blank remains intentional zero, while ambiguous and partial text remain errors',()=>{
 for(const input of [null,undefined,'',' '])assert.deepEqual(parse(input,'BORC'),{value:0,error:null});
 for(const input of ['12abc','1,234.56','Infinity','NaN'])assert.ok(parse(input,'BORC').error);
});
