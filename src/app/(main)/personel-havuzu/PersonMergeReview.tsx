"use client";
import {useEffect,useRef,useState} from 'react';
import {useNavigationGuard} from '@/context/NavigationGuardContext';
import {Button} from '@/components/ui/button';
import {initialQuery,workTypeLabels,type Person,type PeoplePage,type TalentScope} from '@/lib/talent/people';
import {mergeScalarFields,planMergeFields,type MergeChoices,type MergeReview,type MergeScalarField,type MergeCommand} from '@/lib/talent/merge-review';
import {talentPeopleAction,talentMergeReviewAction} from './actions';
const labels:Record<MergeScalarField,string>={name:'Ad soyad',city:'İl',district:'İlçe',gender:'Cinsiyet',birthDate:'Doğum tarihi'};
const value=(p:Person,k:MergeScalarField)=>{const v=p[k];return v==null?'Belirtilmedi':k==='gender'?({female:'Kadın',male:'Erkek',other:'Diğer'}[v as 'female'|'male'|'other']):k==='birthDate'?v.split('-').reverse().join('.'):v;};
const inputClass='min-h-11 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm';
export default function PersonMergeReview({scope,person,disabled,onApply,onDirty}:{scope:TalentScope;person:Person;disabled:boolean;onApply?:(command:MergeCommand)=>Promise<void>;onDirty?:(dirty:boolean)=>void}){
 const [open,setOpen]=useState(false),[search,setSearch]=useState(''),[page,setPage]=useState<PeoplePage|null>(null),[review,setReview]=useState<MergeReview|null>(null),[choices,setChoices]=useState<Partial<MergeChoices['fields']>>({}),[primary,setPrimary]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const guard=useNavigationGuard();
 useEffect(()=>{if(!open)return;const unload=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};window.addEventListener('beforeunload',unload);const off=guard.register(e=>{e.preventDefault();setError('Önce mükerrer kayıt incelemesini kapatın.');});return()=>{off();window.removeEventListener('beforeunload',unload);};},[open,guard]);
 const [samePerson,setSamePerson]=useState(false),[keepAvailability,setKeepAvailability]=useState(false);
 useEffect(()=>{onDirty?.(open);return()=>onDirty?.(false);},[open,onDirty]);
 useEffect(()=>{setSamePerson(false);setKeepAvailability(false);},[review,primary,choices]);
 const serial=useRef(0),mounted=useRef(true),flight=useRef(false);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;serial.current++;};},[]);
 useEffect(()=>{if(disabled){serial.current++;flight.current=false;setBusy(false);setReview(null);setPage(null);setOpen(false);}},[disabled]);
 const valid=(token:number)=>mounted.current&&serial.current===token;
 async function find(offset=0){
  if(disabled||flight.current)return;flight.current=true;const token=++serial.current;setBusy(true);setError('');setPage(null);setReview(null);
  try{const r=await talentPeopleAction(scope,{...initialQuery,search:search.trim(),offset});if(!valid(token))return;if(!r.ok){setError(r.message);return;}setPage(r.data);}
  catch{if(valid(token))setError('Kişi listesi yüklenemedi. Yeniden deneyin.');}finally{if(valid(token)){flight.current=false;setBusy(false);}}
 }
 async function compare(id:string){
  if(disabled||flight.current)return;flight.current=true;const token=++serial.current;setBusy(true);setError('');setReview(null);setChoices({});setPrimary('');
  try{const r=await talentMergeReviewAction(scope,person.id,id);if(!valid(token))return;if(!r.ok){setError(r.message);return;}setReview(r.data);setPrimary(r.data.requiredPrimaryId??'');setChoices(Object.fromEntries(mergeScalarFields.filter(k=>r.data.left.person[k]===r.data.right.person[k]).map(k=>[k,'left'])));}
  catch{if(valid(token))setError('Karşılaştırma yüklenemedi. Yeniden deneyin.');}finally{if(valid(token)){flight.current=false;setBusy(false);}}
 }
 let proposal=null,proposalError='';
 if(review&&primary&&mergeScalarFields.every(k=>choices[k])){
  try{proposal=planMergeFields(review,{primaryId:primary,fields:choices as MergeChoices['fields']});}
  catch{proposalError=review.restriction==='two_workers'?'İki kart da operasyon personeline bağlı. Bu kayıtlar için operasyon bağlantıları ayrıca incelenmeli.':'Birleşik bilgi sınırı aşılıyor. Kişi kartlarındaki iletişim ve iş listelerini gözden geçirin; hiçbir bilgi kesilmedi.';}
 }
 return <section className="rounded-xl border border-slate-200 p-4">
  <Button variant="outline" disabled={disabled||busy} aria-expanded={open} onClick={()=>{setOpen(!open);setReview(null);setPage(null);setError('');}}>Mükerrer kaydı incele</Button>
  {open&&<div className="mt-4 space-y-4">
   <p className="text-sm text-slate-600">Aynı kişiye ait olabilecek ikinci kartı seçin. Alanları karşılaştırın ve ana kartı seçin. Birleştirme ancak aşağıdaki son onayla yapılır.</p>
   <form onSubmit={e=>{e.preventDefault();void find();}} className="space-y-2"><label className="block text-sm font-medium">İkinci kişiyi ara<input className={inputClass} value={search} maxLength={160} disabled={busy||disabled} placeholder="Ad, telefon veya e-posta" onChange={e=>{setSearch(e.target.value);setPage(null);setReview(null);}}/></label><Button variant="outline" disabled={busy||disabled||!search.trim()} type="submit">Kişi ara</Button></form>
   {busy&&<p role="status" className="text-sm">Kayıtlar okunuyor…</p>}
   {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
   {page&&!review&&<div><p className="text-sm text-slate-600">{page.total} arama sonucu. Açık kart bu listede seçilemez.</p><ul className="mt-2 divide-y">{page.rows.filter(p=>p.id!==person.id).map(p=><li key={p.id}><button type="button" className="min-h-11 w-full rounded-lg p-3 text-left text-sm hover:bg-slate-50 focus-visible:outline-blue-600" disabled={busy||disabled} onClick={()=>void compare(p.id)}><strong>{p.name}</strong><span className="block text-slate-600">{[p.city,p.district,p.workerCode].filter(Boolean).join(' · ')||'Konum ve personel kodu belirtilmedi'}</span></button></li>)}</ul>{page.rows.every(p=>p.id===person.id)&&<p className="mt-2 text-sm">Bu sayfada seçilecek başka kayıt yok.</p>}<div className="mt-2 flex gap-2"><Button variant="outline" disabled={busy||page.query.offset===0} onClick={()=>void find(page.query.offset-50)}>Önceki</Button><Button variant="outline" disabled={busy||page.query.offset+50>=page.total} onClick={()=>void find(page.query.offset+50)}>Sonraki</Button></div></div>}
   {review&&<div className="space-y-4">
    <p className="text-sm text-amber-900">Aynı isim veya ortak telefon, iki kaydın aynı kişi olduğunu tek başına kanıtlamaz.</p>
    <div className="grid gap-3 sm:grid-cols-2">{(['left','right'] as const).map(side=>{const s=review[side];return <div key={side} className="rounded-xl bg-slate-50 p-3 text-sm"><h4 className="font-semibold">{side==='left'?'Açık kart':'Seçilen kart'}: {s.person.name}</h4><p className="mt-2">{s.counts.conversations} görüşme · {s.counts.attachments} hazır evrak</p><p>{s.counts.pendingAttachments} tamamlanmamış dosya işlemi · {s.counts.availability} müsaitlik kaydı</p><p>{s.counts.assignments} görevlendirme (kaldırılanlar dahil)</p><p className="mt-2">{s.person.workerId?`Personel kodu: ${s.person.workerCode}`:'Operasyon personeline bağlı değil'}</p><details className="mt-2"><summary className="min-h-11 cursor-pointer py-2 font-medium">İletişim ve çalışma bilgileri</summary><p className="break-all">{s.person.contacts.map(c=>c.value).join(' · ')||'İletişim belirtilmedi'}</p><p className="mt-2 break-words">İşler: {s.person.skills.join(' · ')||'Belirtilmedi'}</p><p className="mt-2 break-words">Bölgeler: {s.person.regions.join(' · ')||'Belirtilmedi'}</p><p className="mt-2">Çalışma tercihleri: {s.person.workTypes.map(t=>workTypeLabels[t]).join(' · ')||'Belirtilmedi'}</p></details></div>;})}</div>
    {review.restriction==='two_workers'?<p role="status" className="rounded-xl bg-amber-50 p-3 text-sm">İki kart da ayrı operasyon personeline bağlı. Atamaları korumak için bu kayıtlar birleştirme kapsamı dışında.</p>:<>
     <fieldset className="space-y-2"><legend className="text-sm font-semibold">Ana kart olarak hangisi kalmalı?</legend>{(['left','right'] as const).map(side=><label key={side} className="flex min-h-11 items-center gap-2 text-sm"><input type="radio" name={`merge-primary-${person.id}`} checked={primary===review[side].person.id} disabled={!!review.requiredPrimaryId||busy||disabled} onChange={()=>setPrimary(review[side].person.id)}/>{review[side].person.name}</label>)}{review.requiredPrimaryId&&<p className="text-xs text-slate-600">Operasyona bağlı kartın korunması gerekiyor.</p>}</fieldset>
     <div className="space-y-3">{mergeScalarFields.map(k=>review.left.person[k]===review.right.person[k]?<div key={k} className="flex flex-wrap justify-between gap-2 rounded-lg bg-slate-50 p-3 text-sm"><span className="font-medium">{labels[k]}</span><span>{value(review.left.person,k)} · İki kartta aynı</span></div>:<fieldset key={k} className="rounded-xl border p-3"><legend className="px-1 text-sm font-semibold">{labels[k]}</legend>{(['left','right'] as const).map(side=><label key={side} className="flex min-h-11 items-center gap-2 break-words text-sm"><input type="radio" name={`merge-${person.id}-${k}`} checked={choices[k]===side} disabled={busy||disabled} onChange={()=>setChoices({...choices,[k]:side})}/><span>{side==='left'?'Açık kart':'Seçilen kart'}: {value(review[side].person,k)}</span></label>)}</fieldset>)}</div>
     {proposal?<div role="status" className="rounded-xl bg-blue-50 p-3 text-sm"><p className="font-semibold">Seçim önizlemesi: {proposal.name}</p><p className="mt-1">{proposal.contacts.length} farklı iletişim · {proposal.skills.length} iş · {proposal.regions.length} bölge</p><p className="mt-2">Seçimler henüz kaydedilmedi. Eski kart ana karta bağlanacak; görüşme ve dosya geçmişi korunacak.</p></div>:<p role="status" className="text-sm text-slate-600">{proposalError||'Önizleme için ana kartı ve farklı alanlarda korunacak bilgiyi seçin.'}</p>}
    </>}
    {proposal&&onApply&&<fieldset disabled={busy||disabled} className="space-y-3 rounded-xl border border-amber-200 p-4">
     <legend className="px-1 font-semibold">Birleştirmeyi onayla</legend>
     <p className="text-sm">Bu işlem için uygulamada geri alma yok. İki ayrı operasyon personeline bağlı kartlar birleştirilemez.</p>
     {review.left.counts.pendingAttachments+review.right.counts.pendingAttachments>0?<p role="alert" className="text-sm text-amber-900">Önce iki karttaki bekleyen dosya işlemlerini tamamlayın veya temizleyin.</p>:<>
      <label className="flex min-h-11 items-start gap-2 text-sm"><input className="mt-1" type="checkbox" checked={samePerson} onChange={e=>setSamePerson(e.target.checked)}/>İki kartın aynı kişiye ait olduğunu doğruladım.</label>
      <label className="flex min-h-11 items-start gap-2 text-sm"><input className="mt-1" type="checkbox" checked={keepAvailability} onChange={e=>setKeepAvailability(e.target.checked)}/>Ana kartın güncel müsaitliği korunacak; diğer kartın müsaitliği yalnız geçmişte görülecek.</label>
      <Button type="button" disabled={!samePerson||!keepAvailability||busy||disabled} onClick={()=>void onApply({commandId:crypto.randomUUID(),leftId:review.left.person.id,rightId:review.right.person.id,primaryId:primary,reviewToken:review.reviewToken,fields:choices as MergeChoices['fields'],confirmSamePerson:true,keepPrimaryAvailability:true})}>Onayla ve birleştir</Button>
     </>}
    </fieldset>}
    <Button variant="outline" disabled={busy||disabled} onClick={()=>void compare(review.right.person.id)}>İki kaydı yeniden oku</Button><p className="text-xs text-slate-500">Yeniden okuma alan seçimlerini sıfırlar.</p>
   </div>}
  </div>}
 </section>;
}
