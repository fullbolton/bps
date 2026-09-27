'use server';
import {createServerSupabaseClient} from '@/lib/supabase/server';
import {isUuid} from '@/lib/operations/pilot-validation';
import {validateManagementQuery,applyManagementFilters,istanbulToday,MANAGEMENT_PAGE_SIZE} from '@/lib/management-board';
import type {WorkspaceScope} from '@/lib/workspace-context';
async function context(expected?:WorkspaceScope){
 const c=await createServerSupabaseClient(12000);
 const [auth,tenant,role]=await Promise.all([c.auth.getUser(),c.rpc('current_user_verified_tenant'),c.rpc('current_user_role')]);
 if(auth.error||tenant.error||role.error||!auth.data.user||!isUuid(tenant.data)||role.data!=='yonetici')throw Error('SCOPE');
 const scope={actorId:auth.data.user.id,tenantId:tenant.data};
 if(expected&&(expected.actorId!==scope.actorId||expected.tenantId!==scope.tenantId))throw Error('SCOPE');
 return {c,scope};
}
export async function managementScopeAction(){try{return {ok:true as const,data:(await context()).scope};}catch{return {ok:false as const,message:'Bu bölüm doğrulanmış şirket yöneticisine açıktır.'};}}
export async function managementBoardAction(expected:WorkspaceScope,input:unknown){
 try{
  const {c,scope}=await context(expected),q=validateManagementQuery(input),today=istanbulToday();
  const base=c.from('tasks').select('id,title,status,priority,due_date,assigned_to_user_id,assigned_to,company_id',{count:'exact'}).eq('tenant_id',scope.tenantId).in('status',['acik','devam_ediyor','gecikti']);
  const [tasks,profiles]=await Promise.all([
   applyManagementFilters(base,q,today).order('due_date',{ascending:true,nullsFirst:false}).order('id',{ascending:true}).range(q.offset,q.offset+MANAGEMENT_PAGE_SIZE-1),
   c.rpc('active_tenant_profiles')
  ]);
  if(tasks.error||profiles.error||!Array.isArray(tasks.data)||!Array.isArray(profiles.data)||!Number.isSafeInteger(tasks.count)||tasks.count!<0)throw Error('READ');
  if(tasks.data.length!==Math.min(MANAGEMENT_PAGE_SIZE,Math.max(0,tasks.count!-q.offset)))throw Error('INCOMPLETE');
  const members=profiles.data.map(p=>{
   if(!isUuid(p.id)||typeof p.display_name!=='string')throw Error('PROFILE');
   return {id:p.id,name:p.display_name||'İsimsiz üye'};
  });
  if(new Set(members.map(p=>p.id)).size!==members.length)throw Error('PROFILE');
  return {ok:true as const,data:{scope,query:q,rows:tasks.data,members,total:tasks.count!,today,readAt:new Date().toISOString()}};
 }catch{return {ok:false as const,message:'İş dağılımı okunamadı. Yetkinizi ve bağlantınızı kontrol edip yeniden deneyin.'};}
}
