import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';
import {importActualTypeScript} from './helpers/import-typescript.mjs';

const {safeLoginReturnTo}=await importActualTypeScript(new URL('../src/lib/login-return-to.ts',import.meta.url));
test('login preserves internal destination, query and hash after normalization',()=>{
  for(const path of ['/dashboard','/davet','/gorevler?gun=2026-09-15#detay','/firmalar/abc','/?q=https://example.invalid']) {
    assert.equal(safeLoginReturnTo(path),path);
  }
  assert.equal(safeLoginReturnTo('/firmalar/../gorevler'),'/gorevler');
});
test('login rejects external, backslash, controls and normalized host prefixes',()=>{
  for(const value of [null,'','dashboard','https://example.invalid','javascript:alert(1)','//example.invalid','/\\example.invalid','/\n/example.invalid','/\t/example.invalid','/x\u007f','/.//example.invalid','/x/..//example.invalid']) {
    assert.equal(safeLoginReturnTo(value),'/dashboard',JSON.stringify(value));
  }
});

// Execute the real middleware with only Auth mocked; real NextRequest/Response
// prove redirect status, Location and rotated-cookie propagation.
const require=createRequire(import.meta.url);
const nextUrl=pathToFileURL(require.resolve('next/server')).href;
const {NextRequest}=await import(nextUrl);
const stubKey=Symbol.for('bps.test.login-boundary.auth');
const stub='data:text/javascript;base64,'+Buffer.from(`export const createServerClient=(...args)=>globalThis[Symbol.for('bps.test.login-boundary.auth')](...args);`).toString('base64');
let compiled=ts.transpileModule(readFileSync(new URL('../src/lib/supabase/middleware.ts',import.meta.url),'utf8'),{
  compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022},
}).outputText;
compiled=compiled.replace('from "@supabase/ssr"','from '+JSON.stringify(stub)).replace('from "next/server"','from '+JSON.stringify(nextUrl));
const {updateSession}=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));
test('anonymous access request reaches handler while adjacent and protected paths redirect',async()=>{
  globalThis[stubKey]=()=>({auth:{getUser:async()=>({data:{user:null}})}});
  try {
    const response=await updateSession(new NextRequest('https://bps.invalid/api/access-request',{method:'POST'}));
    assert.equal(response.status,200);
    assert.equal(response.headers.get('location'),null);
    assert.equal(response.headers.get('x-middleware-next'),'1');
    for(const path of ['/api/access-request-extra','/api/access-request/private','/admin','/gorevler']) {
      const blocked=await updateSession(new NextRequest('https://bps.invalid'+path));
      assert.equal(blocked.status,307);
      const target=new URL(blocked.headers.get('location'));
      assert.equal(target.pathname,'/login');
      assert.equal(target.searchParams.get('returnTo'),path);
    }
  } finally {delete globalThis[stubKey];}
});
test('redirect retains refreshed session cookie options',async()=>{
  globalThis[stubKey]=(_url,_key,{cookies})=>({auth:{getUser:async()=>{
    cookies.setAll([{name:'test-session',value:'rotated',options:{httpOnly:true,secure:true,path:'/',sameSite:'lax'}}]);
    return {data:{user:{id:'test-user'}}};
  }}});
  try {
    const response=await updateSession(new NextRequest('https://bps.invalid/login'));
    assert.equal(response.status,307);
    assert.equal(new URL(response.headers.get('location')).pathname,'/dashboard');
    assert.equal(response.cookies.get('test-session')?.value,'rotated');
    assert.match(response.headers.get('set-cookie'),/HttpOnly/);
    assert.match(response.headers.get('set-cookie'),/Secure/);
  } finally {delete globalThis[stubKey];}
});
