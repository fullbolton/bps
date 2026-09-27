import {MAX_PDF_BYTES} from '@/lib/pdf-upload';
// File limit plus bounded multipart overhead. Content-Length alone is not trusted.
export const MAX_UPLOAD_BODY=MAX_PDF_BYTES+64*1024;
export async function readPdfUploadForm(request:Request){
 const type=request.headers.get('content-type')??'';
 if(!type.startsWith('multipart/form-data;')||!request.body)throw Error('PDF_UPLOAD_VALIDATION');
 const length=request.headers.get('content-length');
 if(length!==null&&(!/^\d+$/.test(length)||Number(length)>MAX_UPLOAD_BODY))throw Error('PDF_UPLOAD_VALIDATION');
 const reader=request.body.getReader();const chunks:Uint8Array[]=[];let total=0;
 let timer:ReturnType<typeof setTimeout>|undefined;
 const deadline=new Promise<never>((_,reject)=>{timer=setTimeout(()=>{void reader.cancel().catch(()=>{});reject(Error('PDF_UPLOAD_BODY_TIMEOUT'));},20_000);});
 try{
  return await Promise.race([deadline,(async()=>{
   while(true){const {value,done}=await reader.read();if(done)break;total+=value.byteLength;if(total>MAX_UPLOAD_BODY)throw Error('PDF_UPLOAD_VALIDATION');chunks.push(value);}
   const bytes=new Uint8Array(total);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
   if(length!==null&&Number(length)!==total)throw Error('PDF_UPLOAD_VALIDATION');
   return await new Response(bytes,{headers:{'content-type':type}}).formData();
  })()]);
 }finally{clearTimeout(timer);await reader.cancel().catch(()=>{});}
}
