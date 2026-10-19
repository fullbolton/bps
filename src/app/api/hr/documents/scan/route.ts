import {NextResponse} from 'next/server';
import {createServerSupabaseClient} from '@/lib/supabase/server';
import {isUuid} from '@/lib/operations/pilot-validation';
import {actOnHrDocumentScan} from '@/lib/services/hr-document-scan';
export const runtime='nodejs';
export async function POST(request:Request){
 const headers={'Cache-Control':'no-store'};
 if(process.env.BPS_HR_PREVIEW_ENABLED!=='true'||process.env.BPS_HR_MALWARE_ENABLED!=='true')return NextResponse.json({ok:false},{status:404,headers});
 try{
  const origin=new URL(request.headers.get('origin')??'');
  if(origin.host!==request.headers.get('host')||origin.protocol!==new URL(request.url).protocol)return NextResponse.json({ok:false},{status:403,headers});
 }catch{return NextResponse.json({ok:false},{status:403,headers});}
 try{
  const user=await createServerSupabaseClient(18000),auth=await user.auth.getUser();
  if(auth.error||!auth.data.user)return NextResponse.json({ok:false},{status:401,headers});
  // Bound the streaming body even when Content-Length is missing or dishonest.
  const reader=request.body?.getReader();if(!reader)throw Error('HR_INPUT');
  let text='',size=0;const decoder=new TextDecoder();
  try{for(;;){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>4096)throw Error('HR_INPUT');text+=decoder.decode(part.value,{stream:true});}text+=decoder.decode();}finally{await reader.cancel();}
  const body=JSON.parse(text),tenant=await user.rpc('current_user_verified_tenant');
  if(tenant.error||!isUuid(tenant.data)||body.tenantId!==tenant.data||body.actorId!==auth.data.user.id||!isUuid(body.employeeId)||!['status','finalize','rescan'].includes(body.action))throw Error('HR_SCOPE');
  const result=await actOnHrDocumentScan(user,{actor:auth.data.user.id,tenant:tenant.data,employee:body.employeeId},body.command,body.action,body.requestId);
  return NextResponse.json({ok:true,...result},{headers});
 }catch{return NextResponse.json({ok:false,error:'Tarama durumu doğrulanamadı. Durumu yeniden kontrol edin.'},{status:409,headers});}
}
