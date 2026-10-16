import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
const {maintenanceResponse}=await importActualTypeScript(new URL('../src/lib/maintenance.ts',import.meta.url));
test('maintenance is explicitly opt-in and off does not consume the request',async()=>{
 const r=new Request('https://example.invalid/api/write',{method:'POST',body:'draft'});
 for(const value of [undefined,'','0','false'])assert.equal(maintenanceResponse(r,value),null);
 assert.equal(await r.text(),'draft');
});
test('all methods and cron/extension paths stop without redirects or cached success',async()=>{
 for(const path of ['/api/cron/notifications','/api/demo-request','/api/write.png','/evraklar','/_next/static/test.js']){
  for(const method of ['GET','POST','PUT','PATCH','DELETE','OPTIONS','HEAD']){
   const r=maintenanceResponse(new Request('https://example.invalid'+path,{method,headers:{'Next-Action':'old-action',accept:'text/html'}}),'1');
   assert.equal(r.status,503);assert.equal(r.headers.get('location'),null);
   assert.match(r.headers.get('cache-control'),/no-store/);assert.equal(r.headers.get('retry-after'),'120');
   if(method==='HEAD')assert.equal(await r.text(),'');
   else if(method!=='GET')assert.equal((await r.json()).code,'MAINTENANCE');
  }
 }
});
test('browser page is Turkish and does not echo request input',async()=>{
 const r=maintenanceResponse(new Request('https://example.invalid/?x=SECRET',{headers:{accept:'text/html'}}),'1');
 const html=await r.text();assert.match(html,/lang="tr"/);assert.match(html,/BPS güncelleniyor/);assert.doesNotMatch(html,/SECRET/);
});
test('maintenance runs before session refresh and covers every path',()=>{
 const src=readFileSync(new URL('../src/middleware.ts',import.meta.url),'utf8');
 assert.ok(src.indexOf('if (paused) return paused')<src.indexOf('return await updateSession'));
 assert.match(src,/matcher: \["\/:path\*"\]/);
});
