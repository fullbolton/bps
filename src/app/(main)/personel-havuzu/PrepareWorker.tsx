'use client';
import {useEffect,useRef,useState} from 'react';
import {Button} from '@/components/ui/button';
import type {Person,TalentScope} from '@/lib/talent/people';
import type {WorkerPreparation} from '@/lib/talent/worker-prepare';
import {talentPrepareWorkerAction} from './actions';
import {useNavigationGuard} from '@/context/NavigationGuardContext';
export default function PrepareWorker({person,scope,disabled,onComplete,onDirty}:{person:Person;scope:TalentScope;disabled:boolean;onComplete:()=>void;onDirty:(value:boolean)=>void}){
 const [code,setCode]=useState(''),[kind,setKind]=useState<''|'idp'|'sabit'>(''),[pending,setPending]=useState<WorkerPreparation|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const flight=useRef(false),guard=useNavigationGuard(),dirty=!!code||!!kind||!!pending;
 useEffect(()=>{onDirty(dirty);return()=>onDirty(false);},[dirty,onDirty]);
 useEffect(()=>{if(!dirty)return;const remove=guard.register(e=>{e.preventDefault();setMessage('Önce hazırlık formunu tamamlayın veya Vazgeç ile kapatın.');});const unload=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};window.addEventListener('beforeunload',unload);return()=>{remove();window.removeEventListener('beforeunload',unload);};},[dirty,guard]);
 async function save(){
  if(flight.current||disabled||!kind||!code.trim())return;
  const command=pending??{personId:person.id,commandId:crypto.randomUUID(),expectedRevision:person.revision,code:code.trim(),kind};
  setPending(command);flight.current=true;setBusy(true);setMessage('');
  try{const r=await talentPrepareWorkerAction(scope,command);if(!r.ok){setMessage(r.message);return;}setPending(null);setCode('');setKind('');onDirty(false);onComplete();}catch{setMessage('Yanıt alınamadı. Aynı işlemle yeniden deneyin.');}finally{flight.current=false;setBusy(false);}
 }
 return <details className="rounded-xl border border-blue-200 bg-blue-50 p-4"><summary className="min-h-11 cursor-pointer font-semibold">Operasyona hazırla</summary><p className="my-3 text-sm">Bu kişi kartı korunur; atamalar için personel kodu ve çalışma türü eklenir. Henüz herhangi bir işe atanmaz. Daha önce personel kaydı varsa ikinci kayıt açmayın.</p><form onSubmit={e=>{e.preventDefault();void save();}} className="space-y-3"><fieldset disabled={disabled||busy||!!pending} className="space-y-3"><label className="block text-sm">Personel kodu<input required maxLength={40} value={code} onChange={e=>setCode(e.target.value)} className="mt-1 min-h-11 w-full rounded-lg border p-2 text-base"/></label><label className="block text-sm">Çalışma türü<select required value={kind} onChange={e=>setKind(e.target.value as typeof kind)} className="mt-1 min-h-11 w-full rounded-lg border p-2 text-base"><option value="">Tür seçin</option><option value="idp">İDP — izin değiştirici</option><option value="sabit">Sabit personel</option></select></label></fieldset><p className="text-xs text-slate-600">Dönemsel otel personeli için ayrı tür desteği bu hazırlık akışında henüz yok; farklı bir türle kaydetmeyin.</p>{message&&<p role="status" className="text-sm">{message}</p>}<div className="flex flex-wrap gap-2"><Button disabled={disabled||busy||!kind||!code.trim()} type="submit">{busy?'Hazırlanıyor…':pending?'Aynı işlemi yeniden dene':'Personel kaydını hazırla'}</Button><Button type="button" variant="outline" disabled={busy} onClick={()=>{setCode('');setKind('');setPending(null);setMessage('');}}>Vazgeç</Button></div>{pending&&<p className="text-xs">Vazgeç sunucudaki işlemi geri almaz. Yeniden hazırlamadan önce kişi kartını güncelleyin.</p>}</form></details>;
}
