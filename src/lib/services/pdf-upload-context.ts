import {createServerSupabaseClient} from '@/lib/supabase/server';
export async function pdfUploadContext(actorId:string,tenantId:string){
 const client=await createServerSupabaseClient(18_000),auth=await client.auth.getUser();
 if(auth.error||!auth.data.user||auth.data.user.id!==actorId)throw Error('PDF_UPLOAD_SCOPE');
 const tenant=await client.rpc('current_user_verified_tenant');
 if(tenant.error)throw tenant.error;
 if(typeof tenant.data!=='string'||tenant.data!==tenantId)throw Error('PDF_UPLOAD_SCOPE');
 return {client,scope:{actorId:auth.data.user.id,tenantId:tenant.data}};
}
