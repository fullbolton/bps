import test from 'node:test';
import assert from 'node:assert/strict';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
const {assertWorkbookZipBounds:check}=await importActualTypeScript(new URL('../src/lib/files/workbook-zip.ts',import.meta.url));
// Directory-only fixture: exercises metadata inspection, not decompression.
function directory(lengths){const bytes=new ArrayBuffer(lengths.length*46+22),view=new DataView(bytes);lengths.forEach((size,i)=>{view.setUint32(i*46,0x02014b50,true);view.setUint32(i*46+24,size,true);});const end=lengths.length*46;view.setUint32(end,0x06054b50,true);view.setUint16(end+8,lengths.length,true);view.setUint16(end+10,lengths.length,true);view.setUint32(end+12,end,true);return bytes;}
test('declared per-entry and aggregate expansion are bounded',()=>{
 check(directory([64*1024*1024,64*1024*1024]));
 assert.throws(()=>check(directory([64*1024*1024+1])));
 assert.throws(()=>check(directory([64*1024*1024,64*1024*1024,1])));
});
test('malformed directories, encryption, volume split and entry-count overflow fail',()=>{
 for(const size of [0,10,21])assert.throws(()=>check(new ArrayBuffer(size)));
 const encrypted=directory([1]);new DataView(encrypted).setUint16(8,1,true);assert.throws(()=>check(encrypted));
 const split=directory([1]);new DataView(split).setUint16(46+4,1,true);assert.throws(()=>check(split));
 assert.throws(()=>check(directory(Array(2001).fill(0))));
 const mismatch=directory([1]);new DataView(mismatch).setUint16(46+8,0,true);assert.throws(()=>check(mismatch));
 const corrupt=directory([1]);new DataView(corrupt).setUint32(0,0,true);assert.throws(()=>check(corrupt));
});
