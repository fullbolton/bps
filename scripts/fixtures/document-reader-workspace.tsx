'use client';
// Disposable acceptance snapshot only: exercises actual raw readers with the signed-in caller.
import {useEffect,useState} from 'react';
import {createClient} from '@/lib/supabase/client';
import {selectDocumentsByCompanyId,selectDocumentsByCompanyIds} from '@/lib/supabase/documents';
export default function DocumentReaderWorkspace(){
 const [result,setResult]=useState<string>('loading'),[attempt,setAttempt]=useState(0);
 useEffect(()=>{let active=true;const p=new URL(window.location.href).searchParams,ids=p.getAll('company');const promise=p.get('mode')==='single'?selectDocumentsByCompanyId(createClient(),ids[0]):selectDocumentsByCompanyIds(createClient(),ids);
 promise.then(rows=>{if(active)setResult(JSON.stringify({count:rows.length,companies:rows.reduce<Record<string,number>>((map,row)=>{map[row.company_id]=(map[row.company_id]??0)+1;return map;},{}),last:rows.at(-1)?.name??null}));}).catch(()=>{if(active)setResult('error');});return()=>{active=false;};},[attempt]);
 return <><output data-testid="document-reader-result">{result}</output><button onClick={()=>{setResult('loading');setAttempt(n=>n+1);}}>Yeniden oku</button></>;
}
