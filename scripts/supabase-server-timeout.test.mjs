import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

function loadClient() {
 const exports={};
 const code=ts.transpileModule(readFileSync(new URL('../src/lib/supabase/server.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(code,{exports,process:{env:{}},fetch,AbortSignal,require:name=>{
  if(name==='@supabase/ssr')return {createServerClient:(_url,_key,options)=>options};
  if(name==='next/headers')return {cookies:async()=>({getAll:()=>[],set:()=>{}})};
  throw Error('Unexpected dependency: '+name);
 }});
 return exports.createServerSupabaseClient;
}

test('server fetch deadline aborts an actual local HTTP request that never responds',async()=>{
 const server=http.createServer(()=>{});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try {
  const options=await loadClient()(100);
  await assert.rejects(options.global.fetch(`http://127.0.0.1:${server.address().port}`),error=>error.name==='TimeoutError');
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});

test('server deadline preserves an already cancelled caller signal',async()=>{
 const options=await loadClient()(30_000);
 const controller=new AbortController();controller.abort();
 await assert.rejects(options.global.fetch('http://127.0.0.1:1',{signal:controller.signal}),error=>error.name==='AbortError');
});
