import {NextResponse} from 'next/server';
import {createServerSupabaseClient} from '@/lib/supabase/server';
import {readPdfUploadForm} from '@/lib/pdf-upload-body';
import {parseUploadCommand,uploadFailure} from '@/lib/pdf-upload';
import {executePdfUpload} from '@/lib/services/pdf-upload';
export const runtime='nodejs';
export async function POST(request:Request){
 try{
  if(request.headers.get('origin')!==new URL(request.url).origin)return NextResponse.json({ok:false,error:'İstek kaynağı doğrulanamadı.',uncertain:false},{status:403});
  const client=await createServerSupabaseClient(18_000),auth=await client.auth.getUser();
  if(auth.error||!auth.data.user)return NextResponse.json({ok:false,error:'Oturum doğrulanamadı.',uncertain:false},{status:401});
  const form=await readPdfUploadForm(request),raw=form.get('command'),file=form.get('file');
  if(typeof raw!=='string'||!(file instanceof File))throw Error('PDF_UPLOAD_VALIDATION');
  const command=parseUploadCommand(JSON.parse(raw));
  const tenant=await client.rpc('current_user_verified_tenant');if(tenant.error)throw tenant.error;
  if(form.get('actorId')!==auth.data.user.id||typeof tenant.data!=='string'||form.get('tenantId')!==tenant.data)throw Error('PDF_UPLOAD_SCOPE');
  const receipt=await executePdfUpload(client,{actorId:auth.data.user.id,tenantId:tenant.data},command,await file.arrayBuffer());
  return NextResponse.json({ok:true,receipt},{headers:{'Cache-Control':'no-store'}});
 }catch(error){return NextResponse.json(uploadFailure(error),{status:400,headers:{'Cache-Control':'no-store'}});}
}
