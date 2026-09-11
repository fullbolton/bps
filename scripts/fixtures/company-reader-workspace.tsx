'use client';
// Disposable acceptance snapshot only; the real services run with the signed-in caller.
import {useState} from 'react';
import {createClient} from '@/lib/supabase/client';
import {getCompanyDisplayMapByIds,getCompanyIdMapByLegacyMockIds} from '@/lib/services/companies';
export default function CompanyReaderWorkspace(){
 const [input,setInput]=useState(''),[result,setResult]=useState('idle');
 async function read(){setResult('loading');try{const {kind,ids}=JSON.parse(input) as {kind:string;ids:string[]};const map=kind==='legacy'?await getCompanyIdMapByLegacyMockIds(createClient(),ids):(await getCompanyDisplayMapByIds(createClient(),ids)).nameById;const requested=new Set(ids);setResult(JSON.stringify({count:Object.keys(map).length,covered:ids.filter(id=>Object.hasOwn(map,id)).length,unexpected:Object.keys(map).filter(id=>!requested.has(id)).length}));}catch{setResult('error');}}
 return <><textarea aria-label="Test firma kimlikleri" value={input} onChange={e=>setInput(e.target.value)}/><button onClick={()=>void read()}>Firmaları oku</button><output data-testid="company-reader-result">{result}</output></>;
}
