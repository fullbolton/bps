'use client';
import {useEffect,useRef,useState} from 'react';import Link from 'next/link';
import {useNavigationGuard} from '@/context/NavigationGuardContext';
import {Button} from '@/components/ui/button';import type {TalentScope} from '@/lib/talent/people';
import {talentCallListCreateAction} from './actions';
export default function CallListCreate({scope,ids,onClear,disabled,onBusy,onSelectPage,pageCount}:{scope:TalentScope;ids:string[];onClear:()=>void;disabled:boolean;onBusy:(busy:boolean)=>void;onSelectPage:()=>void;pageCount:number}){
 const [name,setName]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const guard=useNavigationGuard();
 useEffect(()=>{onBusy(busy);return()=>onBusy(false);},[busy,onBusy]);
 useEffect(()=>{if(!busy)return;return guard.register(e=>{e.preventDefault();setMessage('Liste kaydının sonucunu bekleyin.');});},[busy,guard]);
 const command=useRef<{payload:string;id:string}|null>(null);
 async function save(){if(busy||disabled||!ids.length)return;setBusy(true);setMessage('');const payload=JSON.stringify({name:name.trim(),ids});if(command.current?.payload!==payload)command.current={payload,id:crypto.randomUUID()};
 try{const r=await talentCallListCreateAction(scope,command.current.id,name,ids);if(!r.ok){setMessage(r.message);return;}command.current=null;setName('');onClear();setMessage('Arama listesi kaydedildi. Arama listelerinden açabilirsiniz.');}catch{setMessage('Kayıt sonucu alınamadı. Aynı ad ve seçimle yeniden deneyin.');}finally{setBusy(false);}}
 return <section className="mb-4 rounded-xl border border-slate-200 bg-white p-3" aria-label="Arama listesine seçim">
  <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm">{ids.length?`${ids.length} kişi seçildi`:'Arama listesi için kişilerin yanındaki kutuları seçin.'}</p><Link className="inline-flex min-h-11 items-center text-sm text-blue-700 underline" onClick={guard.handle} href="/personel-havuzu/listeler">Arama listeleri</Link></div>
  <Button type="button" variant="ghost" disabled={busy||disabled||pageCount===0} onClick={onSelectPage}>Bu sayfadaki {pageCount} kişiyi seç</Button>
  {ids.length>0&&<form onSubmit={e=>{e.preventDefault();void save();}} className="flex flex-wrap items-end gap-2"><label className="min-w-0 text-sm">Liste adı<input maxLength={60} value={name} disabled={busy||disabled} onChange={e=>setName(e.target.value)} placeholder="Örn. Pazartesi aranacaklar" className="mt-1 block min-h-11 w-full rounded-xl border px-3"/></label><Button disabled={busy||disabled||!name.trim()} type="submit">{busy?'Kaydediliyor…':'Seçilenlerden liste oluştur'}</Button><Button type="button" variant="ghost" disabled={busy||disabled} onClick={onClear}>Seçimi temizle</Button><p className="w-full text-xs text-slate-500">Yalnız bu sayfada seçtiğiniz kişiler kaydedilir; filtre veya sayfa değişince seçim temizlenir. Liste şirket ekibinizle paylaşılır.</p></form>}
  {message&&<p role="status" className="mt-2 text-sm text-slate-700">{message}</p>}
 </section>;
}
