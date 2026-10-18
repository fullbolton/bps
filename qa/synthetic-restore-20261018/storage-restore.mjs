import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {writeFileSync} from 'node:fs';

// Called only by the fixed local, synthetic Storage HTTP fixture after one
// authenticated upload and finalize. Outer harness owns cleanup on any failure.
export async function restoreStorageFixture({source,database,storage,rest,startStorage,docker,sql,token,path,pdf}){
 assert.equal(source,'supabase_db_bps-supabase-acceptance');
 assert.match(database,/^bps_storage_http_\d+$/);
 assert.match(storage,/^bps-storage-http-\d+$/);assert.match(rest,/^bps-storage-rest-\d+$/);
 const exec=(args,input)=>{
  try{return execFileSync('docker',args,{input,timeout:120000,maxBuffer:64*1024*1024,stdio:['pipe','pipe','pipe']});}
  catch{throw Error('Synthetic restore command failed; credentials and archive withheld');}
 };
 const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
 // No active requests remain. Stop HTTP writers before taking DB and file snapshots.
 docker(['stop',rest]);
 const attributes=exec(['exec',storage,'node','-e',`
 const fs=require('node:fs/promises'),path=require('node:path'),x=require('fs-xattr');
 (async()=>{const out=[];async function walk(dir){for(const e of await fs.readdir(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())await walk(p);else if(e.isFile()){const attrs={};for(const k of await x.list(p))attrs[k]=(await x.get(p,k)).toString('base64');out.push({path:path.relative('/tmp/storage',p),attrs});}else throw Error('Unexpected file type');}}await walk('/tmp/storage');process.stdout.write(JSON.stringify(out));})().catch(()=>process.exit(1));
 `]);
 docker(['stop',storage]);
 // docker cp works on stopped containers; stream tar directly into memory.
 const files=exec(['cp',`${storage}:/tmp/storage/.`,'-']);
 const dump=exec(['exec',source,'pg_dump','-U','postgres','-d',database]);
 const grants=sql("SELECT format('GRANT CONNECT,CREATE ON DATABASE %I TO supabase_storage_admin;',current_database());");
 sql(`DROP DATABASE ${database} WITH (FORCE);`,'postgres');
 sql(`CREATE DATABASE ${database} TEMPLATE template0;`,'postgres');
 exec(['exec','-i',source,'sh','-c','PGPASSWORD="$POSTGRES_PASSWORD" exec psql -w -XqAt -U supabase_admin -d "$1" -v ON_ERROR_STOP=1','restore',database],dump);
 sql(grants);
 docker(['rm',storage]);startStorage();docker(['start',rest]);
 const restBase=`http://127.0.0.1:${docker(['port',rest,'3000/tcp']).split(':').at(-1)}`;
 const base=`http://127.0.0.1:${docker(['port',storage,'5000/tcp']).split(':').at(-1)}`;
 let ready=false;
 for(let i=0;i<100;i++){
  try{if((await fetch(base+'/status',{signal:AbortSignal.timeout(500)})).ok){ready=true;break;}}catch{}
  await new Promise(resolve=>setTimeout(resolve,200));
 }
 assert.ok(ready,'Restored Storage did not become ready');
 let rpcReady=false;
 for(let i=0;i<50;i++){
  try{const r=await fetch(restBase+'/',{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(500)});if(r.ok&&(await r.text()).includes('document_finalize_upload_v1')){rpcReady=true;break;}}catch{}
  await new Promise(resolve=>setTimeout(resolve,100));
 }
 assert.ok(rpcReady,'Restored RPC schema cache unavailable');
 const get=()=>fetch(base+'/object/authenticated/documents/'+path,{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(10000)});
 const missing=await get();assert.equal(missing.ok,false,'DB-only restore unexpectedly supplied file bytes');await missing.arrayBuffer();
 // A fresh container has no original file layer. Restore exactly the archived tree.
 exec(['exec','-i',storage,'tar','xf','-','-C','/tmp/storage'],files);
 // docker cp/tar does not preserve the file backend's required extended attributes.
 exec(['exec','-i',storage,'node','-e',`
 const fs=require('node:fs'),path=require('node:path'),x=require('fs-xattr');
 (async()=>{for(const row of JSON.parse(fs.readFileSync(0,'utf8'))){const p=path.resolve('/tmp/storage',row.path);if(!p.startsWith('/tmp/storage/'))throw Error('Unsafe path');for(const [k,v] of Object.entries(row.attrs))await x.set(p,k,Buffer.from(v,'base64'));}})().catch(()=>process.exit(1));
 `],attributes);
 const response=await get();assert.ok(response.ok,`Restored download: ${response.status}`);
 const bytes=Buffer.from(await response.arrayBuffer());assert.equal(sha(bytes),sha(pdf));
 const checks=['database restored into template0 with existing local platform roles','fresh Storage container cannot download DB-only object','file archive and extended attributes restored into fresh Storage container; authenticated bytes match SHA-256'];
 writeFileSync(new URL('./storage-result.json',import.meta.url),JSON.stringify({syntheticOnly:true,dumpBytes:dump.length,fileArchiveBytes:files.length,extendedAttributeFiles:JSON.parse(attributes.toString()).length,pdfSha256:sha(pdf),dbOnlyDownloadStatus:missing.status,restoredDownloadStatus:response.status,checks,limits:['same local server and existing roles/extensions','synthetic file backend; not cloud S3 or provider restore','no production data','HTTP acceptance, not Auth login or browser acceptance']},null,2)+'\n');
 return {base,restBase,checks};
}
