'use client';
import {useCallback,useState} from 'react';import Link from 'next/link';
import {Button} from '@/components/ui/button';import {useScopedResource} from '@/components/ui/useScopedResource';
import {useWorkspace} from '@/context/WorkspaceContext';import {matchesWorkspace} from '@/lib/workspace-context';
import {useNavigationGuard} from '@/context/NavigationGuardContext';import type {TalentScope} from '@/lib/talent/people';
import CallListEditor from './CallListEditor';
import PersonConversations from '../PersonConversations';
import {talentCallListsAction,talentCallListPeopleAction,talentCallListArchiveAction} from '../actions';
export default function CallLists({scope}:{scope:TalentScope}){
 const {workspace}=useWorkspace(),guard=useNavigationGuard();const confirmed=matchesWorkspace(workspace,scope);
 const [active,setActive]=useState<string|null>(null),[index,setIndex]=useState(0),[conversationDirty,setDirty]=useState(false),[editDirty,setEditDirty]=useState(false),[remove,setRemove]=useState<string|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const dirty=conversationDirty||editDirty;
 const read=useCallback(async()=>{const r=await talentCallListsAction(scope);if(!r.ok)throw Error(r.message);return r.data;},[scope]);
 const catalog=useScopedResource(confirmed?`${scope.actorId}:${scope.tenantId}`:null,read);
 const readPeople=useCallback(async()=>{if(!active)throw Error('NO_LIST');const r=await talentCallListPeopleAction(scope,active);if(!r.ok)throw Error(r.message);return r.data;},[scope,active]);
 const contents=useScopedResource(confirmed&&active?`${scope.actorId}:${scope.tenantId}:${active}`:null,readPeople);
 const person=contents.data?.people[index];
 async function archive(id:string){if(busy||dirty||!confirmed)return;setBusy(true);try{const r=await talentCallListArchiveAction(scope,id);if(!r.ok){setMessage(r.message);return;}if(active===id)setActive(null);setRemove(null);setMessage('Liste kaldırıldı. Kişiler ve görüşmeleri korunuyor.');await catalog.reload();}catch{setMessage('Sonuç alınamadı. Yeniden deneyin.');}finally{setBusy(false);}}
 return <div className="space-y-5">
  <div><Link href="/personel-havuzu" onClick={guard.handle} className="inline-flex min-h-11 items-center text-sm text-blue-700 underline">Personel havuzuna dön</Link><h1 className="text-2xl font-semibold">Arama listeleri</h1><p className="mt-2 text-sm text-slate-600">Havuzdan seçilen kişiler. Yeni liste için havuzdaki kişi kutularını işaretleyin. Listeler şirket ekibiyle paylaşılır.</p></div>
  {message&&<p role="status">{message}</p>}
  {!confirmed?<p role="status">Şirket yetkisi doğrulanıyor…</p>:catalog.error?<div role="alert">Listeler okunamadı. <Button onClick={()=>void catalog.reload()}>Yeniden dene</Button></div>:catalog.loading?<p role="status">Listeler yükleniyor…</p>:<section aria-label="Kayıtlı arama listeleri" className="space-y-3">
   {!catalog.data?.length&&<p>Henüz arama listesi yok.</p>}
   <ul className="flex flex-wrap gap-2">{catalog.data?.map(row=><li key={row.id} className="flex max-w-full items-center rounded-xl border bg-white p-1"><button disabled={dirty||busy} className="min-h-11 min-w-0 break-words px-3 text-left text-sm aria-pressed:bg-blue-50" aria-pressed={active===row.id} onClick={()=>{setActive(row.id);setIndex(0);setMessage('');}}>{row.name}<span className="block text-xs text-slate-500">{row.selectedCount} kişi seçilmiş</span></button>{row.canRemove&&<button disabled={dirty||busy} className="min-h-11 shrink-0 px-3 text-sm text-slate-500" aria-label={`${row.name} listesini kaldır`} onClick={()=>setRemove(row.id)}>Kaldır</button>}</li>)}</ul>
   <Button variant="outline" disabled={dirty||busy} onClick={()=>{void catalog.reload();if(active){setIndex(0);void contents.reload();}}}>Listeleri yenile</Button>
   {remove&&<div className="rounded-xl border border-amber-200 p-3" role="group" aria-label="Listeyi kaldırma onayı"><p>Bu liste tüm ekipten kaldırılacak. Kişiler ve görüşmeleri korunur.</p><Button disabled={busy||dirty} onClick={()=>void archive(remove)}>Listeyi kaldır</Button><Button variant="ghost" disabled={busy} onClick={()=>setRemove(null)}>Vazgeç</Button></div>}
  </section>}
  {confirmed&&active&&(contents.error?<div role="alert">Liste açılamadı. Kaldırılmış veya kişi kayıtları değişmiş olabilir. <Button onClick={()=>{setIndex(0);void contents.reload();}}>Yeniden dene</Button></div>:contents.loading?<p role="status">Listedeki kişiler yükleniyor…</p>:contents.data&&person&&<section className="rounded-2xl border bg-white p-4 sm:p-6" aria-label="Arama turu">
   {!conversationDirty&&<CallListEditor key={`${contents.data.id}:${contents.data.revision}`} scope={scope} list={contents.data} onDirty={setEditDirty} onSaved={()=>{setIndex(0);void contents.reload();void catalog.reload();}}/>}
   <h2 className="break-words text-xl font-semibold">{contents.data.name}</h2>
   {contents.data.people.length<contents.data.selectedCount&&<p className="mt-2 text-sm text-slate-600">Birleştirilmiş kişi kartları bir kez gösteriliyor: {contents.data.people.length} kişi.</p>}
   <div className="my-4 flex flex-wrap items-center justify-between gap-2"><Button variant="outline" disabled={dirty||index===0} onClick={()=>setIndex(i=>i-1)}>Önceki kişi</Button><span className="text-sm">{index+1} / {contents.data.people.length}</span><Button variant="outline" disabled={dirty||index===contents.data.people.length-1} onClick={()=>setIndex(i=>i+1)}>Sonraki kişi</Button></div>
   <h3 className="break-words text-lg font-semibold">{person.name}</h3><p className="text-sm text-slate-600">{[person.city,person.district,...person.skills].filter(Boolean).join(' · ')||'Konum ve meslek bilgisi yok'}</p>
   <div className="my-3 flex flex-wrap gap-2">{person.contacts.filter(c=>c.kind==='phone').map(c=><a key={c.value} className="inline-flex min-h-11 items-center break-all rounded-xl border px-3 text-blue-700" href={`tel:${c.value.replace(/[^+0-9]/g,'')}`}>Ara: {c.value}</a>)}{!person.contacts.some(c=>c.kind==='phone')&&<p className="text-sm text-amber-800">Telefon bilgisi yok.</p>}<Link className="inline-flex min-h-11 items-center px-3 text-blue-700 underline" href={`/personel-havuzu?kisi=${person.id}`} onClick={guard.handle}>Kişi kartı</Link></div>
   <p className="mb-4 text-xs text-slate-500">Telefonu açmak görüşme kaydı oluşturmaz. Sonucu aşağıdan kaydedin; ardından sonraki kişiye geçin.</p>
   <PersonConversations key={person.id} scope={scope} personId={person.id} canWrite={confirmed&&!editDirty} onDirty={setDirty}/>
  </section>)}
 </div>;
}
