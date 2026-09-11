'use client';
// Disposable snapshot only. Real raw reader with the signed-in Supabase client.
import {useState} from 'react';
import {createClient} from '@/lib/supabase/client';
import {selectDocumentsByCompanyIds} from '@/lib/supabase/documents';
export default function DocumentBatchWorkspace(){
 const [input,setInput]=useState(''),[result,setResult]=useState('idle');
 async function read(){setResult('loading');try{const ids=JSON.parse(input) as string[];const rows=await selectDocumentsByCompanyIds(createClient(),ids);setResult(JSON.stringify({count:rows.length,unique:new Set(rows.map(r=>r.id)).size,companies:rows.reduce<Record<string,number>>((map,row)=>{map[row.company_id]=(map[row.company_id]??0)+1;return map;},{}),first:rows[0]?.name??null,last:rows.at(-1)?.name??null}));}catch{setResult('error');}}
 return <><textarea aria-label="Test evrak firma kimlikleri" value={input} onChange={e=>setInput(e.target.value)}/><button onClick={()=>void read()}>Evrakları oku</button><output data-testid="document-batch-result">{result}</output></>;
}
