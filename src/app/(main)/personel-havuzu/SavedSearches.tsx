'use client';
import {useEffect,useState} from 'react';
import {Button} from '@/components/ui/button';
import {appendSavedSearch,parseSavedSearches,type SavedSearch} from '@/lib/talent/saved-searches';
import type {PeopleQuery,TalentScope} from '@/lib/talent/people';
export default function SavedSearches({scope,query,onApply}:{scope:TalentScope;query:PeopleQuery;onApply:(query:PeopleQuery)=>void}){
 const key=`bps:saved-searches:v1:${scope.actorId}:${scope.tenantId}`;
 const [rows,setRows]=useState<SavedSearch[]>([]),[name,setName]=useState(''),[selected,setSelected]=useState(''),[notice,setNotice]=useState(''),[ready,setReady]=useState(false),[open,setOpen]=useState(false);
 useEffect(()=>{let alive=true;function load(){try{const next=parseSavedSearches(localStorage.getItem(key));if(alive){setRows(next);setReady(true);}}catch{if(alive){setRows([]);setReady(false);setNotice('Kayıtlı aramalar okunamadı. Normal aramayı kullanabilirsiniz; bozuk kayıt otomatik silinmez.');}}}load();const changed=(e:StorageEvent)=>{if(e.key===key||e.key===null)load();};window.addEventListener('storage',changed);return()=>{alive=false;window.removeEventListener('storage',changed);};},[key]);
 function mutate(remove=false){
  try{
   // Read at mutation time so another tab's additions are not overwritten by a stale render.
   const current=parseSavedSearches(localStorage.getItem(key));
   const next=remove?current.filter(r=>r.id!==selected):appendSavedSearch(current,name,query,crypto.randomUUID());
   localStorage.setItem(key,JSON.stringify(next));setRows(next);setName('');setSelected('');setNotice(remove?'Kayıtlı arama kaldırıldı. Kişi kayıtları değişmedi.':'Uygulanmış filtreler bu tarayıcıya kaydedildi.');
  }catch(e){setNotice(e instanceof Error&&e.message.startsWith('Bu isimde')||e instanceof Error&&e.message.startsWith('En fazla')?e.message:'Arama kaydedilemedi. İsim ve tarayıcı depolama izinlerini kontrol edin.');}
 }
 return <div className="mt-4 border-t border-slate-100 pt-3">
  <button type="button" aria-expanded={open} onClick={()=>setOpen(!open)} className="min-h-11 text-sm font-medium text-blue-700">Kayıtlı aramalar{rows.length?` (${rows.length})`:''}</button>
  {open&&<div className="space-y-3"><p className="text-xs text-slate-500">Yalnız bu kullanıcı, şirket ve tarayıcı için saklanır. Kişi listesi saklanmaz; seçince güncel veriler aranır.</p>
   <div className="flex flex-wrap gap-2"><label className="sr-only" htmlFor="saved-person-search">Kayıtlı arama seç</label><select id="saved-person-search" disabled={!ready} value={selected} onChange={e=>setSelected(e.target.value)} className="min-h-11 max-w-full rounded-xl border px-3 text-sm"><option value="">Arama seçin</option>{rows.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select><Button type="button" variant="outline" disabled={!ready||!rows.some(r=>r.id===selected)} onClick={()=>{const row=rows.find(r=>r.id===selected);if(row){onApply(row.query);setNotice(`${row.name} uygulanıyor.`);}}}>Uygula</Button><Button type="button" variant="ghost" disabled={!ready||!selected} onClick={()=>mutate(true)}>Kaldır</Button></div>
   <form className="flex flex-wrap gap-2" onSubmit={e=>{e.preventDefault();mutate();}}><label className="sr-only" htmlFor="saved-person-search-name">Arama adı</label><input id="saved-person-search-name" value={name} maxLength={60} onChange={e=>setName(e.target.value)} placeholder="Örn. İstanbul İDP havuzu" className="min-h-11 max-w-full rounded-xl border px-3 text-sm"/><Button type="submit" variant="outline" disabled={!ready||!name.trim()}>Uygulanan filtreleri kaydet</Button></form>
  </div>}
  {notice&&<p role="status" className="mt-2 text-sm text-slate-600">{notice}</p>}
 </div>;
}
