import {talentScopeAction} from '../actions';import CallLists from './CallLists';
export const dynamic='force-dynamic';
export default async function Page(){const s=await talentScopeAction();if(!s.ok)return <p role="alert">{s.message}</p>;return <CallLists key={`${s.data.actorId}:${s.data.tenantId}`} scope={s.data}/>;}
