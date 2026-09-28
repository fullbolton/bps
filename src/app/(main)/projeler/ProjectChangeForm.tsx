'use client';
import {useRef,useState} from 'react';
import {useRouter} from 'next/navigation';
import {saveProject} from './actions';
import type {ProjectScope} from '@/lib/project-reporting/server';
import type {Json} from '@/types/database.types';
import {projectKinds} from '@/lib/project-reporting/view';
export type ProjectChange =
 | {action:'edit_project';name:string;kind:keyof typeof projectKinds}
 | {action:'edit_location';locationId:string;from:string;until:string|null}
 | {action:'close_period'|'reopen_period';month:string};
export default function ProjectChangeForm({scope,projectId,revision,change}:{scope:ProjectScope;projectId:string;revision:number;change:ProjectChange}){
 const router=useRouter(),original=useRef({revision,change}),busy=useRef(false),attempt=useRef<{id:string;input:Record<string,Json>}|null>(null);
 const [pending,setPending]=useState(false),[locked,setLocked]=useState(false),[saved,setSaved]=useState(false),[message,setMessage]=useState('');
 const css='mt-1 block min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2';
 const label=change.action==='edit_project'?'Proje bilgilerini kaydet':change.action==='edit_location'?'Tarihleri kaydet':change.action==='close_period'?'Dönemi kapat':'Dönemi yeniden aç';
 async function submit(e:React.FormEvent<HTMLFormElement>){
  e.preventDefault();if(busy.current||saved)return;busy.current=true;setPending(true);setMessage('');
  if(!attempt.current){
   const f=new FormData(e.currentTarget),text=(name:string)=>String(f.get(name)??'').trim(),initial=original.current.change;
   const input:Record<string,Json>={action:initial.action,projectId,revision:original.current.revision,reason:text('reason')};
   if(initial.action==='edit_project')Object.assign(input,{name:text('name'),kind:text('kind')});
   else if(initial.action==='edit_location')Object.assign(input,{locationId:initial.locationId,originalFrom:initial.from,from:text('from'),until:text('until')||null});
   else input.month=initial.month;
   attempt.current={id:crypto.randomUUID(),input};setLocked(true);
  }
  try{
   const r=await saveProject(scope,attempt.current.id,attempt.current.input);
   if(!r.ok){setMessage(r.message);if('rejected' in r&&r.rejected){attempt.current=null;setLocked(false);}return;}
   setSaved(true);setMessage('Değişiklik kaydedildi.');
  }catch{setMessage('Bağlantı kesildi. Aynı işlemi yeniden deneyebilirsiniz.');}
  finally{busy.current=false;setPending(false);}
 }
 return <form onSubmit={submit} className="space-y-4 rounded-lg bg-slate-50 p-3">
  {change.action==='close_period'&&<p className="text-sm text-slate-600">Bu dönemdeki şube bağlantılarını değişikliğe kapatır. Çalışma veya ücret onayı vermez.</p>}
  {change.action==='reopen_period'&&<p className="text-sm text-slate-600">Dönemi düzeltmelere açar. Gerekçeniz işlem kaydında saklanır.</p>}
  <fieldset disabled={pending||locked||saved} className="grid min-w-0 gap-3 sm:grid-cols-2">
   {change.action==='edit_project'&&<><label className="text-sm">Proje adı<input className={css} name="name" defaultValue={change.name} required maxLength={160}/></label><label className="text-sm">Hizmet türü<select className={css} name="kind" defaultValue={change.kind}>{Object.entries(projectKinds).map(([key,value])=><option value={key} key={key}>{value}</option>)}</select></label></>}
   {change.action==='edit_location'&&<><label className="text-sm">Başlangıç<input className={css} name="from" type="date" min="2000-01-01" max="2099-12-31" defaultValue={change.from} required/></label><label className="text-sm">Bitiş (isteğe bağlı)<input className={css} name="until" type="date" min="2000-01-01" max="2099-12-31" defaultValue={change.until??''}/></label></>}
   <label className="text-sm sm:col-span-2">Gerekçe<input className={css} name="reason" minLength={5} maxLength={500} required placeholder="Neyi, neden değiştiriyorsunuz?"/></label>
  </fieldset>
  {!saved&&<button className="min-h-11 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50" disabled={pending}>{pending?'Kaydediliyor…':locked?'Aynı işlemi yeniden dene':label}</button>}
  {message&&<p className="text-sm" role={saved?'status':'alert'}>{message}</p>}
  {saved&&<button type="button" className="min-h-11 rounded-lg border px-4 text-sm" onClick={()=>{router.refresh();}}>Güncel kaydı göster</button>}
  {!saved&&message&&!locked&&<a href={`/projeler/${projectId}`} className="inline-flex min-h-11 items-center text-sm underline">Güncel bilgilerle yeniden aç</a>}
  {!saved&&message&&locked&&<p className="text-sm">Sonuç doğrulanana kadar aynı işlemi yeniden deneyin.</p>}
 </form>;
}
