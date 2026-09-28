'use client';
import {useRef,useState} from 'react';
import {useRouter} from 'next/navigation';
import {saveProject} from './actions';
import type {ProjectScope} from '@/lib/project-reporting/server';
import type {Json} from '@/types/database.types';
import {projectKinds} from '@/lib/project-reporting/view';
export type Choice={id:string;name:string};
export default function ProjectForm({scope,action,projectId,revision,choices=[]}:{scope:ProjectScope;action:'create'|'link_location'|'open_period';projectId?:string;revision?:number;choices?:Choice[]}){
 const form=useRef<HTMLFormElement>(null);
 const router=useRouter(),attempt=useRef<{id:string;input:Record<string,Json>}|null>(null),busy=useRef(false);
 const [pending,setPending]=useState(false),[locked,setLocked]=useState(false),[message,setMessage]=useState(''),[done,setDone]=useState(false);
 const control='mt-1 block min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2';
 async function submit(e:React.FormEvent<HTMLFormElement>){
  e.preventDefault();if(busy.current||done)return;busy.current=true;setPending(true);setMessage('');
  const f=new FormData(e.currentTarget);const value=(key:string)=>String(f.get(key)??'').trim();
  if(!attempt.current){
   const input:Record<string,Json>=action==='create'?{action,companyId:value('choice'),name:value('name'),code:value('code'),kind:value('kind')}:
    action==='link_location'?{action,projectId:projectId!,revision:revision!,locationId:value('choice'),from:value('from'),until:value('until')||null}:
    {action,projectId:projectId!,revision:revision!,month:value('month')};
   attempt.current={id:crypto.randomUUID(),input};setLocked(true);
  }
  try{const result=await saveProject(scope,attempt.current.id,attempt.current.input);
   if(!result.ok){setMessage(result.message);if('rejected' in result&&result.rejected){attempt.current=null;setLocked(false);}return;}
   setDone(true);setMessage(action==='create'?'Proje oluşturuldu.':action==='link_location'?'Şube projeye bağlandı.':'Rapor dönemi açıldı.');
   if(action==='create')router.push('/projeler/'+result.id);router.refresh();
  }catch{setMessage('Bağlantı kesildi. Aynı işlemi yeniden deneyebilirsiniz.');}
  finally{busy.current=false;setPending(false);}
 }
 return <form ref={form} onSubmit={submit} className="space-y-4">
  <fieldset disabled={locked||pending||done} className="grid min-w-0 gap-4 sm:grid-cols-2">
   {action!=='open_period'&&<label className="text-sm sm:col-span-2">{action==='create'?'Müşteri':'Şube'}<select className={control} name="choice" required defaultValue=""><option value="">Seçin</option>{choices.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>}
   {action==='create'&&<><label className="text-sm">Proje adı<input className={control} name="name" required maxLength={160}/></label><label className="text-sm">Proje kodu<input className={control} name="code" required pattern="[A-Za-z0-9_-]{1,40}" maxLength={40}/><span className="text-xs text-slate-500">Örnek: MEK-IDP-01</span></label><label className="text-sm">Hizmet türü<select className={control} name="kind">{Object.entries(projectKinds).map(([k,v])=><option value={k} key={k}>{v}</option>)}</select></label></>}
   {action==='link_location'&&<><label className="text-sm">Başlangıç<input className={control} name="from" type="date" min="2000-01-01" max="2099-12-31" required/></label><label className="text-sm">Bitiş (isteğe bağlı)<input className={control} name="until" type="date" min="2000-01-01" max="2099-12-31"/></label></>}
   {action==='open_period'&&<label className="text-sm">Rapor ayı<input className={control} name="month" type="month" min="2000-01" max="2099-12" required/></label>}
  </fieldset>
  <button disabled={pending||done||(action!=='open_period'&&!choices.length)} className="min-h-11 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{pending?'Kaydediliyor…':done?'Kaydedildi':locked?'Aynı işlemi yeniden dene':action==='create'?'Proje oluştur':action==='link_location'?'Şubeyi bağla':'Dönem aç'}</button>
  {done&&action!=='create'&&<button type="button" className="ml-2 min-h-11 rounded-lg border px-4 text-sm" onClick={()=>{attempt.current=null;form.current?.reset();setLocked(false);setDone(false);setMessage('');}}>Başka {action==='open_period'?'dönem aç':'şube bağla'}</button>}
  {message&&<p role={done?'status':'alert'} className="text-sm">{message}</p>}
  {locked&&!done&&!pending&&<p className="text-sm text-slate-600">Bilgileri değiştirmek için sayfayı yenileyin ve kaydın oluşup oluşmadığını kontrol edin.</p>}
 </form>;
}
