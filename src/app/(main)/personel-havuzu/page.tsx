import Link from 'next/link';
import {talentScopeAction,talentPlacementContextAction} from './actions';
import {parsePoolPlacement} from '@/lib/operations/pool-placement-link';
import PersonPool from './PersonPool';
import {isUuid} from '@/lib/operations/pilot-validation';
export const dynamic='force-dynamic';
export default async function PersonPoolPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const scope=await talentScopeAction(),params=await searchParams;
 if(!scope.ok)return <section className="rounded-2xl border bg-white p-6"><h1 className="text-2xl font-semibold">Personel havuzu</h1><p role="alert" className="mt-3">{scope.message}</p></section>;
 const parsed=parsePoolPlacement(params);
 const hasContext=['sirket','firma','talep','gun','meslek'].some(key=>params[key]!==undefined);
 const result=parsed&&parsed.tenantId===scope.data.tenantId?await talentPlacementContextAction(scope.data,parsed):null;
 if(hasContext&&(!result||!result.ok))return <section className="space-y-3 rounded-2xl border bg-white p-6"><h1 className="text-2xl font-semibold">Talep için personel seçimi</h1><p role="alert">{result&&!result.ok?result.message:'Talep bağlantısı geçersiz veya başka bir şirkete ait.'}</p><Link className="inline-flex min-h-11 items-center underline" href="/talepler/gunluk">Günlük taleplere dön</Link></section>;
 const placement=result?.ok?result.data:null;
 return <PersonPool placement={placement} key={`${scope.data.actorId}:${scope.data.tenantId}:${placement?.requestId??''}:${placement?.day??''}`} scope={scope.data} initialId={isUuid(params.kisi)?params.kisi:null}/>;
}
