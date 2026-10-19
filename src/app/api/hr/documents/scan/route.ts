import {NextResponse} from 'next/server';
import {createServerSupabaseClient} from '@/lib/supabase/server';
import {isUuid} from '@/lib/operations/pilot-validation';
import {actOnHrDocumentScan} from '@/lib/services/hr-document-scan';
import {readHrScanRequest} from '@/lib/hr-scan-request';
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
  const raw=await readHrScanRequest(request);
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('HR_INPUT');
  const body=raw as Record<string,unknown>,tenant=await user.rpc('current_user_verified_tenant');
  if(tenant.error||!isUuid(tenant.data)||body.tenantId!==tenant.data||body.actorId!==auth.data.user.id||!isUuid(body.employeeId)||(body.action!=='status'&&body.action!=='finalize'&&body.action!=='rescan'))throw Error('HR_SCOPE');
  const result=await actOnHrDocumentScan(user,{actor:auth.data.user.id,tenant:tenant.data,employee:body.employeeId},body.command as import('@/lib/services/hr-document-upload').HrUploadInput,body.action,typeof body.requestId==='string'?body.requestId:undefined);
  return NextResponse.json({ok:true,...result},{headers});
 }catch{return NextResponse.json({ok:false,error:'Tarama durumu doğrulanamadı. Durumu yeniden kontrol edin.'},{status:409,headers});}
}
