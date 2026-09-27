'use client';
import {useCallback,useRef,useState} from 'react';
import {Button} from '@/components/ui/button';
import {useScopedResource} from '@/components/ui/useScopedResource';
import type {PeopleQuery,TalentScope} from '@/lib/talent/people';
import {talentSharedViewsAction,talentSharedViewCreateAction,talentSharedViewArchiveAction} from './actions';

export default function SharedViews({scope,query,onApply}:{scope:TalentScope;query:PeopleQuery;onApply:(q:PeopleQuery)=>void}){
 const [open,setOpen]=useState(false),[name,setName]=useState(''),[busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[removing,setRemoving]=useState<string|null>(null);
 // Same payload keeps its command ID after a lost response. DB also rejects duplicate names.
 const pending=useRef<{id:string;payload:string}|null>(null);
 const reader=useCallback(async()=>{const r=await talentSharedViewsAction(scope);if(!r.ok)throw Error(r.message);return r.data;},[scope]);
 const resource=useScopedResource(open?`${scope.actorId}:${scope.tenantId}`:null,reader);
 async function save(){
  if(busy)return;setBusy(true);setNotice('');
  const payload=JSON.stringify({name:name.trim(),query:{...query,offset:0}});
  if(pending.current?.payload!==payload)pending.current={id:crypto.randomUUID(),payload};
  try{const r=await talentSharedViewCreateAction(scope,pending.current.id,name,query);
   if(!r.ok){setNotice(r.message);return;}
   pending.current=null;setName('');setNotice('Görünüm kaydedildi. Bu şirkette havuza erişen ekip arkadaşlarınız da kullanabilir.');await resource.reload();
  }catch{setNotice('Kayıt sonucu alınamadı. Aynı adla yeniden deneyin.');}finally{setBusy(false);}
 }
 async function remove(id:string){
  if(busy)return;setBusy(true);setNotice('');
  try{const r=await talentSharedViewArchiveAction(scope,id);if(!r.ok){setNotice(r.message);return;}
   setRemoving(null);setNotice('Ekip görünümü kaldırıldı. Personel kayıtları değişmedi.');await resource.reload();
  }catch{setNotice('Kaldırma sonucu alınamadı. Yeniden deneyin.');}finally{setBusy(false);}
 }
 return <section className="mt-4 border-t border-slate-100 pt-3" aria-label="Ekip görünümleri">
  <button type="button" className="min-h-11 text-sm font-medium text-blue-700" aria-expanded={open} onClick={()=>setOpen(v=>!v)}>Ekip görünümleri</button>
  {open&&<div className="space-y-3">
   <p className="text-sm text-slate-600">Sık kullandığınız filtreleri ekibinizle paylaşın. Her açılışta güncel kişiler listelenir.</p>
   {resource.error?<div role="alert" className="text-sm text-red-700">Ekip görünümleri yüklenemedi. <Button type="button" variant="outline" onClick={()=>void resource.reload()}>Yeniden dene</Button></div>:resource.loading?<p role="status" className="text-sm text-slate-500">Görünümler yükleniyor…</p>:<>
    {!resource.data?.length&&<p className="text-sm text-slate-500">Henüz ekip görünümü yok. Uyguladığınız filtrelere bir ad vererek başlayın.</p>}
    <ul className="flex flex-wrap gap-2">{resource.data?.map(row=><li key={row.id} className="flex max-w-full items-center gap-1 rounded-xl border border-slate-200 bg-white p-1">
     <button type="button" disabled={busy} className="min-h-11 min-w-0 break-words px-3 text-left text-sm text-blue-800" onClick={()=>{onApply(row.query);setNotice(`${row.name} filtreleri uygulandı.`);}}>{row.name}</button>
     {row.canRemove&&<button type="button" disabled={busy} aria-label={`${row.name} görünümünü kaldır`} className="min-h-11 px-3 text-sm text-slate-500" onClick={()=>setRemoving(row.id)}>Kaldır</button>}
    </li>)}</ul>
    {removing&&resource.data?.some(r=>r.id===removing)&&<div role="group" aria-label="Görünümü kaldırma onayı" className="break-words rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm"><p>“{resource.data.find(r=>r.id===removing)?.name}” tüm ekipten kaldırılacak. Personel kayıtları korunur.</p><div className="mt-2 flex gap-2"><Button type="button" disabled={busy} variant="outline" onClick={()=>void remove(removing)}>Görünümü kaldır</Button><Button type="button" disabled={busy} variant="ghost" onClick={()=>setRemoving(null)}>Vazgeç</Button></div></div>}
    <form onSubmit={e=>{e.preventDefault();void save();}} className="flex flex-wrap items-end gap-2">
     <label className="min-w-0 text-sm text-slate-700">Görünüm adı<input value={name} maxLength={60} disabled={busy} onChange={e=>setName(e.target.value)} placeholder="Örn. İstanbul güvenlik" className="mt-1 block min-h-11 w-full rounded-xl border px-3"/></label>
     <Button type="submit" variant="outline" disabled={busy||!name.trim()}>{busy?'İşlem sürüyor…':'Bu filtreleri ekiple paylaş'}</Button>
     <Button type="button" variant="ghost" disabled={busy} onClick={()=>void resource.reload()}>Yenile</Button>
    </form>
    {query.availabilityDay&&<p className="text-sm text-amber-800">Müsaitlik tarihi ({query.availabilityDay}) de kaydedilir; görünümü açtığınızda kendiliğinden bugüne değişmez.</p>}
   </>}
  </div>}
  {notice&&<p role="status" className="mt-2 break-words text-sm text-slate-600">{notice}</p>}
 </section>;
}
