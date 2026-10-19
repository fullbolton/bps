import {NextResponse} from 'next/server';
import {createClient} from '@supabase/supabase-js';
import type {Database} from '@/types/database.types';
import {createServerSupabaseClient} from '@/lib/supabase/server';
import {readPdfUploadForm} from '@/lib/pdf-upload-body';
import {isUuid} from '@/lib/operations/pilot-validation';
import {executeHrDocumentUpload} from '@/lib/services/hr-document-verification';
import type {HrUploadInput} from '@/lib/services/hr-document-upload';
import {enqueueHrDocumentUpload} from '@/lib/services/hr-document-scan';
export const runtime='nodejs';
export async function POST(request:Request){
 const headers={'Cache-Control':'no-store'};
 if(process.env.BPS_HR_PREVIEW_ENABLED!=='true')return NextResponse.json({ok:false},{status:404,headers});
 const origin=request.headers.get('origin');
 let sameOrigin=false;
 try{const source=new URL(origin??'');sameOrigin=source.host===request.headers.get('host')&&source.protocol===new URL(request.url).protocol;}catch{/* Invalid or missing origin is rejected. */}
 if(!sameOrigin)return NextResponse.json({ok:false},{status:403,headers});
 try{
  const user=await createServerSupabaseClient(18000),auth=await user.auth.getUser();
  if(auth.error||!auth.data.user)return NextResponse.json({ok:false},{status:401,headers});
  const form=await readPdfUploadForm(request),file=form.get('file'),raw=form.get('command');
  if(!(file instanceof File)||typeof raw!=='string')throw Error('HR_UPLOAD_INPUT');
  const input=JSON.parse(raw) as HrUploadInput;
  const employee=form.get('employeeId'),expectedTenant=form.get('tenantId');
  const tenant=await user.rpc('current_user_verified_tenant');
  if(tenant.error||!isUuid(tenant.data)||tenant.data!==expectedTenant||!isUuid(employee)||form.get('actorId')!==auth.data.user.id)throw Error('HR_SCOPE');
  if(process.env.BPS_HR_MALWARE_ENABLED==='true'){
   const receipt=await enqueueHrDocumentUpload(user,{actor:auth.data.user.id,tenant:tenant.data,employee},input,await file.arrayBuffer());
   return NextResponse.json({ok:true,receipt:{schemaVersion:1,actorId:auth.data.user.id,tenantId:tenant.data,employeeId:employee,...receipt}},{status:receipt.state==='pending'?202:200,headers});
  }
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key)throw Error('HR_VERIFIER_UNAVAILABLE');
  // Narrow verifier: used solely for attest RPC after user-scoped readback.
  // Never used for Storage, employee reads, or the final metadata write.
  const verifier=createClient<Database>(url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(input,init)=>fetch(input,{...init,signal:AbortSignal.timeout(18000)})}});
  const receipt=await executeHrDocumentUpload(user,verifier,{actor:auth.data.user.id,tenant:tenant.data,employee},input,await file.arrayBuffer());
  return NextResponse.json({ok:true,receipt:{schemaVersion:1,actorId:auth.data.user.id,tenantId:tenant.data,employeeId:employee,...receipt}},{headers});
 }catch(error){
  if((error as {message?:string})?.message==='HR_UPLOAD_CANCELLED')return NextResponse.json({ok:false,uncertain:false,code:'HR_UPLOAD_CANCELLED'},{status:409,headers});
  return NextResponse.json({ok:false,uncertain:true,error:'Yükleme sonucu doğrulanamadı. Aynı dosyayla yeniden deneyin veya bekleyen yüklemeyi iptal edin.'},{status:400,headers});
 }
}
