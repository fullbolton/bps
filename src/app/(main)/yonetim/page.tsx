import ManagementBoard from './ManagementBoard';
import {managementScopeAction} from './actions';
export const dynamic='force-dynamic';
export default async function ManagementPage(){
 const result=await managementScopeAction();
 if(!result.ok)return <section><h1 className="text-2xl font-semibold">Şirket yönetimi</h1><p role="alert" className="mt-4">{result.message}</p></section>;
 return <ManagementBoard key={`${result.data.actorId}:${result.data.tenantId}`} scope={result.data}/>;
}
