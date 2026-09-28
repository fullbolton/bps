import 'server-only';
import {createServerSupabaseClient} from '@/lib/supabase/server';
export type ProjectScope={actorId:string;tenantId:string};
export async function projectContext(expected?:ProjectScope){
 const c=await createServerSupabaseClient(12000);
 const [user,tenant,role]=await Promise.all([c.auth.getUser(),c.rpc('current_user_verified_tenant'),c.rpc('current_user_role')]);
 if(user.error||tenant.error||role.error||!user.data.user||!tenant.data||!role.data)throw Error('REPORT_SCOPE');
 if(!['yonetici','operasyon','ik','muhasebe'].includes(role.data))throw Error('REPORT_FORBIDDEN');
 const scope={actorId:user.data.user.id,tenantId:tenant.data};
 if(expected&&(scope.actorId!==expected.actorId||scope.tenantId!==expected.tenantId))throw Error('REPORT_SCOPE');
 return {c,scope,canClose:role.data==='yonetici',canWrite:['yonetici','operasyon'].includes(role.data)};
}
