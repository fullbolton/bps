"use client";

import {Pencil, Check, X} from 'lucide-react';
import type {ContactSummary} from '@/lib/talent/contact-summary';
import {conversationChannels,conversationOutcomes} from '@/lib/talent/conversations';
import type {Person,PersonInput} from '@/lib/talent/people';
export type QuickPersonDraft={person:Person;input:PersonInput};
const inputClass='min-h-10 w-full min-w-24 rounded-md border border-blue-300 bg-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';
const actionClass='inline-flex min-h-11 items-center justify-center gap-1 rounded-lg px-2 text-sm text-blue-700 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-blue-600 disabled:opacity-40';

/** One server page, one active edit. No client-side sorting of a partial dataset. */
export default function PersonList({checkedIds=[],onCheck,summaries,summaryError,onConversations,selectedId,selectionDisabled=false,people,onSelect,edit,onEdit,onChange,onCancel,onSave,canEdit,busy,offset=0}:{
 checkedIds?:string[];onCheck?:(id:string,checked:boolean)=>void;
 summaries:Record<string,ContactSummary|null>|null;summaryError:boolean;onConversations:(id:string)=>void;selectedId?:string|null;selectionDisabled?:boolean;people:Person[];onSelect:(id:string)=>void;edit:QuickPersonDraft|null;onEdit:(person:Person)=>void;
 onChange:(field:'name'|'city'|'district',value:string)=>void;onCancel:()=>void;onSave:()=>void;canEdit:boolean;busy:boolean;offset?:number;
}){
 return <div>
  <p className="mb-2 text-xs text-slate-500">Kişi adına dokunarak detayları açın. Kalemle ad ve konumu hızlıca düzenleyin.</p>
  <div tabIndex={0} role="region" aria-label="Personel listesi" className="md:max-h-[65vh] md:overflow-auto rounded-xl border border-slate-200 bg-white focus-visible:outline-2 focus-visible:outline-blue-600">
   <table className="block w-full md:table md:min-w-[950px] border-separate border-spacing-0 text-left text-sm">
    <caption className="sr-only">Personel kayıtları. Yalnız mevcut sayfa gösterilir.</caption>
    <thead className="hidden md:table-header-group sticky top-0 z-20 bg-slate-100 text-xs text-slate-600"><tr>
     <th scope="col" className="border-b px-3 py-3">#</th><th scope="col" className="sticky left-0 z-20 min-w-56 border-b bg-slate-100 px-3 py-3">Ad soyad</th>
     {['İl','İlçe','İletişim','Yapabileceği işler','Son genel görüşme','Personel kodu','İşlem'].map(label=><th scope="col" key={label} className={`whitespace-nowrap border-b px-3 py-3 ${label==='İşlem'?'sticky right-0 z-20 bg-slate-100':''}`}>{label}</th>)}
    </tr></thead>
    <tbody className="grid gap-3 bg-slate-50 p-2 md:table-row-group md:bg-white md:p-0">{people.map((person,index)=>{
     const active=edit?.person.id===person.id,contact=person.contacts.find(c=>c.kind==='phone')??person.contacts[0];
     return <tr key={person.id} className={`grid min-w-0 grid-cols-2 rounded-xl border bg-white p-2 md:table-row md:rounded-none md:border-0 md:p-0 ${active?'bg-blue-50':'group md:even:bg-slate-50 hover:bg-blue-50/50'}`} onKeyDown={e=>{if(!active||busy)return;if(e.key==='Escape'){e.preventDefault();onCancel();}if(e.key==='Enter'&&e.target instanceof HTMLInputElement){e.preventDefault();onSave();}}}>
      <td className="hidden md:table-cell border-b border-slate-100 px-3 text-xs tabular-nums text-slate-400">{offset+index+1}</td>
      <th scope="row" className={`col-span-2 min-w-0 md:sticky left-0 z-10 border-b md:border-r border-slate-100 px-3 py-1 font-medium ${active?'bg-blue-50':'bg-white group-even:bg-slate-50 group-hover:bg-blue-50'}`}>
       {onCheck&&<label className="inline-flex min-h-11 items-center gap-2 pr-2 text-xs font-normal"><input type="checkbox" className="size-4" aria-label={`${person.name} kişisini arama listesi için seç`} checked={checkedIds.includes(person.id)} disabled={!!edit||selectionDisabled||busy} onChange={e=>onCheck(person.id,e.target.checked)}/><span className="md:sr-only">Listeye seç</span></label>}
       {active?<input autoFocus aria-label="Ad soyad" className={inputClass} maxLength={160} value={edit.input.name} disabled={busy} onChange={e=>onChange('name',e.target.value)}/>:<button type="button" className={`${actionClass} max-w-full md:max-w-72 justify-start text-left aria-[current=true]:bg-blue-100 aria-[current=true]:font-semibold aria-[current=true]:ring-1 aria-[current=true]:ring-blue-300`} aria-current={selectedId===person.id?true:undefined} disabled={!!edit||selectionDisabled} onClick={()=>onSelect(person.id)}><span className="truncate" title={person.name}>{person.name}</span></button>}
      </th>
      {(['city','district']as const).map(field=><td key={field} className="min-w-0 md:min-w-32 border-b border-slate-100 px-3 py-1"><span className="block text-xs text-slate-500 md:hidden">{field==='city'?'İl':'İlçe'}</span>{active?<input aria-label={field==='city'?'İkamet ili':'İkamet ilçesi'} className={inputClass} maxLength={80} value={edit.input[field]??''} disabled={busy} onChange={e=>onChange(field,e.target.value)}/>:<span className="block max-w-40 truncate" title={person[field]??undefined}>{person[field]||'—'}</span>}</td>)}
      <td className="col-span-2 min-w-0 border-b border-slate-100 px-3 py-1"><span className="block text-xs text-slate-500 md:hidden">İletişim</span>{contact?<a className={`${actionClass} max-w-full break-all text-left md:whitespace-nowrap`} href={contact.kind==='phone'?`tel:${contact.value.replace(/[^+0-9]/g,'')}`:`mailto:${encodeURIComponent(contact.value)}`}>{contact.value}</a>:<span className="whitespace-nowrap text-xs text-amber-700">İletişim eksik</span>}</td>
      <td className="col-span-2 min-w-0 md:max-w-56 border-b border-slate-100 px-3 py-1"><span className="block text-xs text-slate-500 md:hidden">Yapabileceği işler</span><span className="block truncate" title={person.skills.join(', ')}>{person.skills.join(', ')||'—'}</span></td>
      <td className="col-span-2 min-w-0 border-b border-slate-100 px-3 py-1"><span className="block text-xs text-slate-500 md:hidden">Son genel görüşme</span>{summaryError?<span className="text-xs text-amber-800">Okunamadı</span>:!summaries||!(person.id in summaries)?<span className="text-xs text-slate-500">Yükleniyor…</span>:<button type="button" disabled={!!edit||selectionDisabled} onClick={()=>onConversations(person.id)} className={`${actionClass} flex-col items-start gap-0 text-left`} aria-label={`${person.name} görüşmelerini aç`}>{summaries[person.id]?<><span className={summaries[person.id]!.outcome==='call_back'?'text-amber-800 font-medium':''}>{conversationOutcomes[summaries[person.id]!.outcome]}</span><span className="text-xs text-slate-500">{new Intl.DateTimeFormat('tr-TR',{dateStyle:'short',timeStyle:'short',timeZone:'Europe/Istanbul'}).format(new Date(summaries[person.id]!.recordedAt))} · {conversationChannels[summaries[person.id]!.channel]}</span></>:<span className="text-xs">Genel görüşme yok</span>}</button>}</td>
      <td className="hidden md:table-cell border-b border-slate-100 px-3 py-1 text-xs text-slate-500">{person.workerCode||'—'}</td>
      <td className={`col-span-2 md:sticky right-0 z-10 md:border-b md:border-l border-slate-100 px-2 py-1 ${active?'bg-blue-50':'bg-white group-even:bg-slate-50'}`}><div className="flex">{active?<><button type="button" className={actionClass} disabled={busy||!canEdit||!edit.input.name.trim()} onClick={onSave} aria-label={`${person.name} satırını kaydet`}><Check size={16}/>{busy?'Bekleyin':'Kaydet'}</button><button type="button" className={actionClass} disabled={busy} onClick={onCancel} aria-label="Satır düzenlemesinden vazgeç"><X size={16}/></button></>:<button id={`person-edit-${person.id}`} type="button" className={actionClass} disabled={!canEdit||!!edit} onClick={()=>onEdit(person)} aria-label={`${person.name} satırını düzenle`}><Pencil size={15}/><span className="md:hidden">Hızlı düzenle</span></button>}</div></td>
     </tr>;
    })}</tbody>
   </table>
  </div>
 </div>;
}
