import test from 'node:test';
import assert from 'node:assert/strict';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
const {hesaplaTeklifBedeli:calculate,MIN_MODEL_NET_GUNLUK:min,parseTeklifAmount:parse}=await importActualTypeScript(new URL('../src/lib/teklif-hesaplayici.ts',import.meta.url));
const base={netUcretGunluk:1000,hedefKarOrani:16.5};
test('reverse formula rejects the historical negative-price case and below-baseline amounts',()=>{
 for(const net of [1,0,-1,min-0.01])assert.equal(calculate({...base,netUcretGunluk:net}),null);
 assert.ok(calculate({...base,netUcretGunluk:min}).tahminiIsverenMaliyeti>0);
});
test('every numeric input rejects negative and non-finite values',()=>{
 for(const field of ['netUcretGunluk','hedefKarOrani','ekOdeme','yemek','servis','kiyafet'])
  for(const value of [-1,NaN,Infinity,-Infinity])assert.equal(calculate({...base,[field]:value}),null,field);
 assert.equal(calculate({...base,yemek:-10000}),null);
 assert.equal(calculate({...base,netUcretGunluk:Number.MAX_VALUE}),null);
});
test('zero markup is valid and markup is applied to cost, not sales margin',()=>{
 const zero=calculate({...base,hedefKarOrani:0});assert.equal(zero.karTutari,0);assert.equal(zero.onerilenTeklifBedeli,zero.tahminiIsverenMaliyeti);
 const marked=calculate(base);assert.ok(Math.abs(marked.onerilenTeklifBedeli-marked.tahminiIsverenMaliyeti*1.165)<0.02);
});
test('form parser distinguishes missing required input from optional zero and rejects partial numeric strings',()=>{
 assert.ok(Number.isNaN(parse('')));assert.equal(parse('',true),0);
 assert.ok(Number.isNaN(parse('100abc',true)));assert.ok(Number.isNaN(parse('abc')));
 assert.equal(parse('0'),0);assert.equal(parse('16.5'),16.5);
});
