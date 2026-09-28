'use client';
import {useState} from 'react';
import type {ProjectScope} from '@/lib/project-reporting/server';
import {sourceFile} from './source-actions';
export default function SourceFile({scope,batch,pending,file}:{scope:ProjectScope;batch:string;pending:boolean;file:File|null}){
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[link,setLink]=useState<{name:string;url:string}|null>(null);
 async function run(save:boolean){if(busy)return;setBusy(true);setLink(null);setMessage('');try{const form=save&&file?new FormData():undefined;if(form&&file)form.set('file',file);const r=await sourceFile(scope,batch,form);if(!r.ok)setMessage(r.message);else if(r.file){setLink(r.file);setMessage(save?'Kaynak dosyası saklandı.':'İndirme bağlantısı 60 saniye geçerli.');}else setMessage('Bu aktarıma kaynak dosyası eklenmemiş.');}catch{setMessage('İşlem tamamlanamadı. Yeniden deneyin.');}finally{setBusy(false);}}
 return <section className="space-y-2 rounded-lg border p-3"><h3 className="font-medium">Kaynak dosyası</h3><p className="text-sm text-slate-600">Dosya yalnız bu aktarıma erişimi olan kullanıcılarca açılır. Eklenen kopya değiştirilemez.</p><div className="flex flex-wrap gap-2">{pending&&file&&<button disabled={busy} onClick={()=>void run(true)} className="min-h-11 rounded border px-3 text-sm">Seçtiğim dosyayı sakla</button>}<button disabled={busy} onClick={()=>void run(false)} className="min-h-11 rounded border px-3 text-sm">Saklanan dosyayı getir</button>{link&&<a href={link.url} className="inline-flex min-h-11 items-center break-all underline">{link.name} — indir</a>}</div>{message&&<p role="status" className="text-sm">{message}</p>}</section>;
}
