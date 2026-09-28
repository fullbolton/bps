'use server';
import {createHash} from 'node:crypto';
import {projectContext,type ProjectScope} from '@/lib/project-reporting/server';
import {isUuid} from '@/lib/operations/pilot-validation';
const bucket='project-sources';
export async function sourceFile(scope:ProjectScope,batch:string,form?:FormData){
 try{
  const {c,canWrite}=await projectContext(scope);if(!canWrite||!isUuid(batch))throw Error();
  const args={p_actor:scope.actorId,p_tenant:scope.tenantId,p_batch:batch};
  let r=await c.rpc('reporting_source_file',args);if(r.error)throw r.error;
  if(form){
   const file=form.get('file');if(!(file instanceof File)||!file.size||file.size>2097152||file.name.length>200||/[\u0000-\u001f\u007f]/.test(file.name)||!(/\.(csv|xlsx)$/i.test(file.name)))throw Error();
   const extension=file.name.toLowerCase().endsWith('.xlsx')?'xlsx':'csv',bytes=Buffer.from(await file.arrayBuffer()),hash=createHash('sha256').update(bytes).digest('hex');
   const path=`${scope.tenantId}/${batch}/${hash}.${extension}`;
   if(r.data&&(r.data as {path?:unknown}).path!==path)return {ok:false as const,message:'Bu aktarıma farklı bir kaynak dosyası zaten eklenmiş.'};
   if(!r.data){const upload=await c.storage.from(bucket).upload(path,bytes,{upsert:false,contentType:extension==='csv'?'text/csv':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});if(upload.error){if(String(upload.error.statusCode)!=='409')throw upload.error;const existing=await c.storage.from(bucket).download(path);if(existing.error||!existing.data||createHash('sha256').update(Buffer.from(await existing.data.arrayBuffer())).digest('hex')!==hash)throw Error('Source mismatch');}}
   r=await c.rpc('reporting_source_file',{...args,p_name:file.name,p_hash:hash,p_size:file.size,p_extension:extension});if(r.error)throw r.error;
  }
  if(r.data===null)return {ok:true as const,file:null};
  const f=r.data as {name?:unknown;path?:unknown;sha256?:unknown;size?:unknown};
  if(typeof f.name!=='string'||typeof f.path!=='string'||typeof f.sha256!=='string'||!Number.isInteger(f.size)||!f.path.startsWith(`${scope.tenantId}/${batch}/`))throw Error();
  const signed=await c.storage.from(bucket).createSignedUrl(f.path,60,{download:f.name});if(signed.error||!signed.data?.signedUrl)throw Error();
  return {ok:true as const,file:{name:f.name,url:signed.data.signedUrl}};
 }catch{return {ok:false as const,message:'Kaynak dosyası doğrulanamadı. Bağlantıyı kontrol edip tekrar deneyin. Onaylanmış aktarıma yeni dosya eklenemez.'};}
}
