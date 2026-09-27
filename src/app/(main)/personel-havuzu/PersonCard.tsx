'use client';
import Link from 'next/link';
import {useCallback,useEffect,useState} from 'react';
import {Phone,Mail} from 'lucide-react';
import {placementReturnHref} from '@/lib/operations/pool-placement-link';
import type {PoolPlacementContext} from '@/lib/operations/pool-placement-context';
import {Button} from '@/components/ui/button';
import PersonDetailPanel from './PersonDetailPanel';
import {useScopedResource} from '@/components/ui/useScopedResource';
import {useNavigationGuard} from '@/context/NavigationGuardContext';
import {workTypeLabels,type TalentScope,type Person} from '@/lib/talent/people';
import {talentPersonAction} from './actions';
import PersonAttachments from './PersonAttachments';
import PersonConversations from './PersonConversations';
import MergedAvailability from './MergedAvailability';
import PersonAvailability from './PersonAvailability';
import PersonMergeReview from './PersonMergeReview';
import type {MergeCommand} from '@/lib/talent/merge-review';
import PrepareWorker from './PrepareWorker';
const time=(v:string)=>new Intl.DateTimeFormat('tr-TR',{dateStyle:'short',timeStyle:'short',timeZone:'Europe/Istanbul'}).format(new Date(v));
const fields:Record<string,string>={workerId:'Operasyon personeli bağlantısı',name:'Ad soyad',city:'İl',district:'İlçe',contacts:'İletişim',skills:'İşler',regions:'Bölgeler',workTypes:'Çalışma tercihleri',gender:'Cinsiyet',birthDate:'Doğum tarihi'};
export default function PersonCard({onMerge,onConversationSaved,section,onSectionChange,pageIds,onSelect,onDirty,id,scope,notice,canEdit,onClose,onEdit,placement,canPrepare,onPrepared}:{onMerge:(command:MergeCommand)=>Promise<void>;onConversationSaved:()=>void;section:string;onSectionChange:(section:string)=>void;onDirty:(dirty:boolean)=>void;pageIds:string[];onSelect:(id:string)=>void;onPrepared:()=>void;canPrepare:boolean;placement:PoolPlacementContext|null;id:string;scope:TalentScope;notice:string;canEdit:boolean;onClose:()=>void;onEdit:(p:Person)=>void}){
 const navigationGuard=useNavigationGuard();
 const reader=useCallback(async()=>{const r=await talentPersonAction(scope,id);if(!r.ok)throw Error(r.message);return r.data;},[scope,id]);
 const [conversationDirty,setConversationDirty]=useState(false),[availabilityDirty,setAvailabilityDirty]=useState(false),[preparationDirty,setPreparationDirty]=useState(false),[attachmentDirty,setAttachmentDirty]=useState(false),[mergeDirty,setMergeDirty]=useState(false);
 const dirty=conversationDirty||availabilityDirty||preparationDirty||attachmentDirty||mergeDirty;
 useEffect(()=>{onDirty(dirty);return()=>onDirty(false);},[dirty,onDirty]);
 const [visited,setVisited]=useState<string[]>([section]);
 const sections=[["summary","Genel bilgiler"],["conversations","Görüşmeler"],["availability","Müsaitlik"],["attachments","Fotoğraf ve ekler"],["history","Geçmiş"]];
 const position=pageIds.indexOf(id);
 const resource=useScopedResource(`${scope.actorId}:${scope.tenantId}:${id}`,reader),p=resource.data?.person;
 return <PersonDetailPanel onClose={onClose} closeDisabled={dirty}>
  <div className="mb-4 flex flex-wrap items-center justify-between gap-2" aria-label="Listedeki kişiler arasında geçiş">
   <Button variant="outline" disabled={dirty||position<=0} onClick={()=>onSelect(pageIds[position-1])}>Önceki kişi</Button>
   <span className="text-xs text-slate-500">{position>=0?`Bu sayfada ${position+1} / ${pageIds.length}`:'Açık kişi bu sonuçlarda yer almıyor'}</span>
   <Button variant="outline" disabled={dirty||position<0||position>=pageIds.length-1} onClick={()=>onSelect(pageIds[position+1])}>Sonraki kişi</Button>
  </div>
  {dirty&&<p role="status" className="mb-3 rounded-xl bg-amber-50 p-3 text-sm">Kişi veya bölüm değiştirmeden önce açık işlemi kaydedin ya da vazgeçin.</p>}
  {notice&&<p role="status" className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">{notice}</p>}
  {resource.loading?<p role="status">Kişi bilgileri yükleniyor…</p>:resource.error?<div role="alert"><p>Kişi kartı yüklenemedi veya bu kayda erişiminiz yok.</p><Button variant="outline" className="mt-3" onClick={()=>void resource.reload()}>Yeniden dene</Button></div>:p&&resource.data&&<div className="space-y-6">
   {resource.data.redirectedFromId&&<p role="status" className="rounded-xl bg-blue-50 p-3 text-sm">Bu kayıt başka bir kişi kartıyla birleştirildi. Güncel ana kartı görüntülüyorsunuz.</p>}
   {resource.data.mergedSourceCount>0&&<p className="text-sm text-slate-600">Bu kartta {resource.data.mergedSourceCount} eski kartın geçmişi de bulunuyor.</p>}
   <div><h3 className="break-words text-2xl font-semibold">{p.name}</h3><p className="mt-2 text-sm text-slate-600">{[p.city,p.district].filter(Boolean).join(' / ')||'Konum belirtilmedi'}</p><Button variant="outline" className="mt-4" disabled={!canEdit||dirty} onClick={()=>onEdit(p)}>Bilgileri düzenle</Button></div>
   <nav aria-label="Kişi kartı bölümleri" className="flex flex-wrap gap-2">{sections.map(([value,label])=><button type="button" key={value} aria-current={section===value?'page':undefined} disabled={dirty&&section!==value} onClick={()=>{onSectionChange(value);setVisited(items=>items.includes(value)?items:[...items,value]);}} className={`min-h-11 rounded-xl px-3 text-sm focus-visible:outline-2 focus-visible:outline-blue-600 disabled:opacity-40 ${section===value?'bg-blue-700 text-white':'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>{label}</button>)}</nav>
   <div hidden={section!=='summary'} className="space-y-6">
   {canPrepare&&<PersonMergeReview scope={scope} person={p} disabled={!canEdit||conversationDirty||availabilityDirty||preparationDirty||attachmentDirty} onDirty={setMergeDirty} onApply={onMerge}/>}
   {!p.workerId&&canPrepare&&<PrepareWorker person={p} scope={scope} disabled={!canEdit||mergeDirty||conversationDirty||availabilityDirty} onDirty={setPreparationDirty} onComplete={()=>{void resource.reload();onPrepared();}}/>}
   {placement&&<section className="rounded-xl bg-blue-50 p-4"><p className="text-sm">Seçim sizi talebe götürür. Personeli atamak için günlük planda ayrıca onay verin.</p>{p.workerId&&p.workerActive&&canEdit&&!conversationDirty&&!availabilityDirty?<Link className="mt-2 inline-flex min-h-11 items-center rounded-xl bg-blue-600 px-4 text-white" onClick={navigationGuard.handle} href={placementReturnHref(placement,p.workerId)}>Talepte bu personeli seç</Link>:<p className="mt-2 text-sm text-amber-900">{!p.workerId?(canPrepare?'Önce Operasyona hazırla alanını tamamlayın.':'Yöneticinizden bu kişiyi operasyona hazırlamasını isteyin.'):!p.workerActive?'Operasyon personeli pasif.':'Devam etmeden önce açık işlemleri tamamlayın.'}</p>}</section>}
   <section><h3 className="mb-3 font-semibold">İletişim</h3>{!p.contacts.length?<p className="text-sm text-amber-800">Henüz iletişim bilgisi eklenmedi.</p>:<ul className="space-y-2">{p.contacts.map((c,i)=><li key={i}><a className="flex min-h-11 items-center gap-3 break-all rounded-xl bg-slate-50 px-3 py-2 text-sm text-blue-700 underline" href={c.kind==='phone'?`tel:${c.value.replace(/[^+0-9]/g,'')}`:`mailto:${encodeURIComponent(c.value)}`}>{c.kind==='phone'?<Phone size={16} className="shrink-0"/>:<Mail size={16} className="shrink-0"/>}{c.value}</a></li>)}</ul>}</section>
   <section className="rounded-xl border p-4 text-sm"><h3 className="font-semibold">Kişisel bilgiler</h3><p className="mt-2">Cinsiyet: {p.gender?({female:'Kadın',male:'Erkek',other:'Diğer'}[p.gender]):'Belirtilmedi'}</p><p className="mt-1">Doğum tarihi: {p.birthDate?p.birthDate.split('-').reverse().join('.'):'Belirtilmedi'}</p></section>
   <section className="grid gap-4 rounded-xl border p-4"><div><h3 className="text-sm font-semibold">Yapabileceği işler</h3><p className="mt-1 break-words text-sm text-slate-600">{p.skills.join(' · ')||'Belirtilmedi'}</p></div><div><h3 className="text-sm font-semibold">Çalışabileceği bölgeler</h3><p className="mt-1 break-words text-sm text-slate-600">{p.regions.join(' · ')||'Belirtilmedi'}</p></div><div><h3 className="text-sm font-semibold">Çalışma tercihleri</h3><p className="mt-1 text-sm text-slate-600">{p.workTypes.map(t=>workTypeLabels[t]).join(' · ')||'Henüz bilinmiyor'}</p></div></section>
   <details className="rounded-xl border border-slate-200 p-4"><summary className="min-h-11 cursor-pointer font-semibold focus-visible:outline-2 focus-visible:outline-blue-600">Operasyon bağlantısı ve atamalar</summary><p className="mt-2 text-sm text-slate-600">{p.workerId?`Personel kodu: ${p.workerCode} · ${p.workerActive?'Aktif':'Pasif'}`:'Bu kişi henüz operasyon personeline bağlanmadı.'}</p>{resource.data.assignments.length>0&&<><p className="mt-3 text-xs text-slate-500">Son 10 görevlendirme gösterilir. Personelin işe gelip gelmediğini günlük yoklamadan kontrol edin.</p><ul className="mt-2 divide-y">{resource.data.assignments.map(a=><li key={a.id} className="py-3 text-sm"><p className="font-medium">{a.companyName} · {a.locationName}</p><p className="mt-1 text-slate-600">{a.workDate.split('-').reverse().join('.')} · {a.position}{a.removed?' · Kaldırılmış':''}</p></li>)}</ul></>}</details>
   </div>
   {visited.includes('availability')&&<div hidden={section!=='availability'} className="space-y-6">
   <PersonAvailability scope={scope} personId={p.id} canWrite={canEdit&&!conversationDirty&&!preparationDirty} onDirty={setAvailabilityDirty}/>
   {resource.data.mergedSourceCount>0&&<MergedAvailability key={p.id} scope={scope} personId={p.id}/>}
   </div>}
   {visited.includes('conversations')&&<div hidden={section!=='conversations'}>
   <PersonConversations key={`${p.id}:${placement?.requestId??'general'}`} request={placement?{id:placement.requestId,label:`${placement.companyName} · ${placement.locationName} · ${placement.day.split('-').reverse().join('.')} · ${placement.hours} · ${placement.skill}`}:null} onSaved={onConversationSaved} scope={scope} personId={p.id} canWrite={canEdit&&!availabilityDirty&&!preparationDirty} onDirty={setConversationDirty}/>
   </div>}
   {visited.includes('attachments')&&<div hidden={section!=='attachments'}><PersonAttachments scope={scope} personId={p.id} onDirty={setAttachmentDirty}/></div>}
   <div hidden={section!=='history'}>
   <details className="rounded-xl border border-slate-200 p-4"><summary className="min-h-11 cursor-pointer font-semibold focus-visible:outline-2 focus-visible:outline-blue-600">Kayıt geçmişi · Son 20 işlem</summary><p className="mt-2 text-xs text-slate-500">Kaynak: {p.source==='operations'?'Mevcut BPS personeli':p.source==='import'?'Excel / CSV aktarımı':'Manuel kayıt'} · İlk kayıt: {time(p.createdAt)}</p>{resource.data.events.length===0?<p className="mt-2 text-sm text-slate-600">Havuza aktarım sonrası değişiklik yok.</p>:<ul className="mt-3 space-y-3">{resource.data.events.map(e=><li key={e.id} className="rounded-xl bg-slate-50 p-3 text-sm"><p>{e.kind==='created'?'Kişi eklendi':e.kind==='worker_synced'?(e.changedFields.includes('workerId')?'Operasyon personeline bağlandı':'Personel adı güncellendi'):'Kişi bilgileri güncellendi'}</p><p className="mt-1 text-xs text-slate-500">{time(e.occurredAt)} · {e.actorName||'Sistem / önceki kullanıcı'}</p>{e.changedFields.length>0&&<p className="mt-1 text-xs text-slate-600">{e.changedFields.map(k=>({mergedIntoId:'Ana karta birleştirildi',mergedFromId:'Eski kartın geçmişi eklendi'} as Record<string,string>)[k]??fields[k]??k).join(', ')}</p>}</li>)}</ul>}</details>
   </div>
  </div>}
 </PersonDetailPanel>;
}
