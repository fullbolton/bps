"use client";
import {useCallback,useEffect,useRef,useState} from 'react';
import LocationEditor from "./LocationEditor";
import DirectoryActivation,{type ActivationTarget} from "./DirectoryActivation";
import Link from 'next/link';
import {useSearchParams} from 'next/navigation';
import {useAuth} from '@/context/AuthContext';
import {PageHeader,EmptyState} from '@/components/ui';
import type {DirectoryQuery,DirectoryPage,DirectoryRow} from '@/lib/operations/operations-directory';
import type {PilotCompany} from '@/lib/operations/pilot-types';
import {pilotDirectoryAction,pilotCompaniesAction} from '../gunluk/actions';
const field='w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm';
const button='rounded-lg border bg-white px-3 py-2 text-sm disabled:opacity-40';
export default function OperationsDirectory({rosterEnabled=false}:{rosterEnabled?:boolean}){
  const search=useSearchParams();
  // A new directory link resets filters; ordinary edits retain their local state.
  return <DirectoryContent rosterEnabled={rosterEnabled} key={JSON.stringify([search.get('firma'),search.get('ara')])} />;
}
function DirectoryContent({rosterEnabled}:{rosterEnabled:boolean}){
  const {user,role,loading:authLoading}=useAuth(),search=useSearchParams();
  const allowed=role==='yonetici'||role==='operasyon';
  const [companies,setCompanies]=useState<PilotCompany[]>([]),[companyId,setCompanyId]=useState(search.get('firma')??'');
  const [kind,setKind]=useState<DirectoryQuery['kind']>('locations'),[status,setStatus]=useState<DirectoryQuery['status']>('all');
  const rawTerm=search.get('ara')??'';
  const initialTerm=rawTerm.length<=160&&!/[\u0000-\u001f\u007f]/.test(rawTerm)?rawTerm.trim():'';
  const [draft,setDraft]=useState(initialTerm),[term,setTerm]=useState(initialTerm),[offset,setOffset]=useState(0);
  const [data,setData]=useState<DirectoryPage|null>(null),[loading,setLoading]=useState(false),[error,setError]=useState('');
  const sequence=useRef(0);
  const [editing,setEditing]=useState<DirectoryRow|null>(null),[recoveryKey,setRecoveryKey]=useState(0),[saved,setSaved]=useState('');
  function closeEditor(){setEditing(null);setRecoveryKey(k=>k+1);}
  const [target,setTarget]=useState<ActivationTarget|null>(null),[changing,setChanging]=useState(false);
  useEffect(()=>{setTarget(null);setEditing(null);},[kind,companyId,status,term,offset,user?.id]);
  const load=useCallback(async()=>{
    const ticket=++sequence.current;setData(null);setError('');
    if(authLoading||!allowed||(kind==='locations'&&!companyId)){setLoading(false);return;}
    setLoading(true);
    try{const r=await pilotDirectoryAction({kind,companyId:kind==='locations'?companyId:null,search:term,status,offset});if(ticket!==sequence.current)return;if(r.ok)setData(r.data);else setError(r.message);}
    catch{if(ticket===sequence.current)setError('Şube ve personel kayıtları yüklenemedi. Yeniden deneyin.');}
    finally{if(ticket===sequence.current)setLoading(false);}
  },[authLoading,allowed,kind,companyId,term,status,offset,user?.id]);
  useEffect(()=>{void load();return()=>{sequence.current++;};},[load]);
  useEffect(()=>{
    setCompanies([]);if(authLoading||!allowed)return;
    let current=true;
    pilotCompaniesAction().then(r=>{if(!current)return;if(r.ok){setCompanies(r.data);setCompanyId(old=>r.data.some(c=>c.id===old)?old:r.data[0]?.id??'');}else setError(r.message);}).catch(()=>{if(current)setError('Firmalar yüklenemedi.');});
    return()=>{current=false;};
  },[authLoading,allowed,user?.id]);
  if(authLoading)return <p role="status">Oturum yükleniyor…</p>;
  if(!allowed)return <EmptyState title="Bu çalışma alanına erişiminiz yok" />;
  const current=data?.kind===kind&&data.companyId===(kind==='locations'?companyId:null)&&data.search===term&&data.status===status&&data.offset===offset?data:null;
  return <>
    <PageHeader title="Şube ve personel kayıtları" subtitle="Şubeleri ve operasyon personelini bulun, bilgilerini düzenleyin veya kullanıma açıp kapatın." />
    <Link className="mb-4 mr-5 inline-flex min-h-11 items-center text-sm text-blue-700 underline" href="/personel-havuzu">Personel havuzu ve kişi kartları</Link>
    <Link className="mb-4 mr-5 inline-block text-sm underline" href={`/talepler/gunluk?firma=${companyId}`}>Günlük plan ve kayıt ekleme</Link>
    <Link className="mb-4 inline-block text-sm underline" href={`/talepler/kontrol?firma=${companyId}`}>Operasyon kontrol listesi</Link>
    {role==='yonetici'&&<DirectoryActivation key={`${user?.id}:${recoveryKey}`} target={target} onClose={()=>setTarget(null)} onBusy={setChanging} onChanged={load} />}
    {saved&&<p role="status" className="mb-4 rounded-lg bg-emerald-50 p-3 text-sm">{saved}</p>}
    {role==='yonetici'&&editing&&<LocationEditor key={`${user?.id}:${companyId}:${editing.id}`} row={editing} companyId={companyId} onClose={closeEditor} onSaved={()=>{setSaved('Şube bilgileri kaydedildi.');closeEditor();void load();}} />}
    <fieldset disabled={changing||!!target||!!editing} className="mb-4 grid gap-3 rounded-xl border bg-white p-4 sm:grid-cols-3">
      <label className="text-sm">Kayıt türü<select className={field} value={kind} onChange={e=>{setKind(e.target.value as DirectoryQuery['kind']);setOffset(0);setTerm('');setDraft('');}}><option value="locations">Şubeler</option><option value="workers">Personel</option></select></label>
      {kind==='locations'?<label className="text-sm">Firma<select className={field} value={companyId} onChange={e=>{setCompanyId(e.target.value);setOffset(0);}}><option value="">Firma seçin</option>{companies.map(c=><option key={c.id} value={c.id}>{c.name}{c.active?'':' (operasyona kapalı)'}</option>)}</select></label>:<p className="self-center text-sm text-slate-600">Bu liste şirketinizin tüm operasyon personelini gösterir. Personeli farklı müşteri firmalarda görevlendirebilirsiniz.</p>}
      <label className="text-sm">Durum<select className={field} value={status} onChange={e=>{setStatus(e.target.value as DirectoryQuery['status']);setOffset(0);}}><option value="all">Tümü</option><option value="active">Aktif</option><option value="inactive">Pasif</option></select></label>
      <form className="flex flex-wrap items-end gap-2 sm:col-span-3" onSubmit={e=>{e.preventDefault();const next=draft.trim();if(next===term&&offset===0)void load();else{setTerm(next);setOffset(0);}}}><label className="min-w-0 flex-1 text-sm">{kind==='locations'?'Şube adı, kodu veya il':'Personel adı veya kodu'}<input className={field} type="search" value={draft} maxLength={160} onChange={e=>setDraft(e.target.value)} /></label><button className={button} disabled={loading||(kind==='locations'&&!companyId)}>Ara</button><button type="button" className={button} disabled={loading} onClick={()=>void load()}>Yenile</button></form>
    </fieldset>
    {error&&<p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-red-800">{error}</p>}
    {loading?<p role="status">Şube ve personel kayıtları yükleniyor…</p>:!current?<p role="status">{kind==='locations'&&!companyId?'Önce firma seçin.':'Kayıtlar alınamadı. Yenile düğmesiyle tekrar deneyin.'}</p>:<section aria-label="Şube ve personel listesi">
      <h2 className="font-semibold">{kind==='locations'?`${companies.find(c=>c.id===companyId)?.name??'Seçili firma'} · Şubeler`:'Çalışma alanındaki personel'}</h2>
      <p className="mt-1 text-sm">{current.total} eşleşen kayıt{current.search?` · Arama: ${current.search}`:''}</p>
      <p className="mt-1 text-xs text-slate-600">Veri: {new Intl.DateTimeFormat('tr-TR',{dateStyle:'short',timeStyle:'medium',timeZone:'Europe/Istanbul'}).format(new Date(current.generatedAt))} (İstanbul). Her sayfa yenilendiği andaki kayıtları gösterir.</p>
      {!current.total?<EmptyState title="Seçtiğiniz filtrelere uygun kayıt yok" description="Aramayı veya durum filtresini değiştirebilirsiniz." />:!current.rows.length?<div className="mt-4 rounded-lg border bg-white p-4"><p>Liste değişmiş; bu sayfada kayıt kalmamış.</p><button className={`${button} mt-2`} onClick={()=>setOffset(0)}>İlk sayfaya dön</button></div>:<>
        <div className="my-4 flex flex-wrap items-center justify-between gap-3"><p className="text-sm">{offset+1}–{offset+current.rows.length} / {current.total}</p><div className="flex gap-2"><button className={button} disabled={changing||offset===0} onClick={()=>setOffset(n=>Math.max(0,n-50))}>Önceki sayfa</button><button className={button} disabled={changing||offset+50>=current.total} onClick={()=>setOffset(n=>n+50)}>Sonraki sayfa</button></div></div>
        <ul className="grid gap-3 md:grid-cols-2">{current.rows.map(r=><li key={r.id} className="min-w-0 rounded-xl border bg-white p-4"><div className="flex flex-wrap items-start justify-between gap-2"><h3 className="min-w-0 break-words font-semibold">{r.name}</h3><span className={`rounded px-2 py-1 text-xs ${r.active?'bg-emerald-50 text-emerald-800':'bg-slate-100 text-slate-700'}`}>{r.active?'Aktif':'Pasif'}</span></div><p className="mt-2 break-all text-sm">Kod: <span className="font-mono">{r.code??'Kod yok'}</span></p><p className="mt-1 text-sm text-slate-600">{kind==='locations'?r.city:r.workerKind==='idp'?'İDP':'Sabit'}</p>{rosterEnabled&&kind==='locations'&&<Link className={`${button} mt-3 mr-2 inline-flex min-h-11 items-center`} href={`/talepler/kadro?firma=${companyId}&sube=${r.id}`}>Şube kadrosu</Link>}{role==='yonetici'&&kind==='locations'&&<button className={`${button} mt-3 mr-2`} disabled={changing||!!target||!!editing} onClick={()=>{setSaved('');setEditing(r);}}>Bilgileri düzenle</button>}{role==='yonetici'&&<button className={`${button} mt-3`} disabled={changing} onClick={()=>setTarget({kind,row:r})}>{r.active?'Pasife al':'Aktifleştir'}</button>}</li>)}</ul>
      </>}
    </section>}
  </>;
}
