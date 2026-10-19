'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {useAuth} from '@/context/AuthContext';
import {useVerifiedTenant} from '@/hooks/useVerifiedTenant';
import {useScopedResource} from '@/components/ui/useScopedResource';
import {useNavigationGuard} from '@/context/NavigationGuardContext';
import {createClient} from '@/lib/supabase/client';
import {loadHrDirectory,prepareHrRecord,saveHrRecord} from '@/lib/services/hr-directory';
const button='min-h-11 rounded-lg border px-4 py-2 disabled:opacity-50';
const input='mt-1 block min-h-11 w-full rounded-lg border px-3';
function Directory({actor,tenant}:{actor:string;tenant:string}){
 const [cursor,setCursor]=useState<string|null>(null);
 const read=useCallback(()=>loadHrDirectory(createClient(),actor,tenant,cursor),[actor,tenant,cursor]);
 const resource=useScopedResource(`${actor}:${tenant}:${cursor??'first'}`,read);
 const [kind,setKind]=useState<'employee'|'department'|null>(null);
 const [name,setName]=useState(''),[code,setCode]=useState(''),[startsOn,setStartsOn]=useState(''),[department,setDepartment]=useState(''),[position,setPosition]=useState('');
 const [intent,setIntent]=useState<ReturnType<typeof prepareHrRecord>|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const flight=useRef(false),alive=useRef(true);const guard=useNavigationGuard();
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 useEffect(()=>{if(!kind)return;const off=guard.register(event=>{event.preventDefault();setMessage('Önce formu kaydedin veya kapatın.');});const block=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';};window.addEventListener('beforeunload',block);return()=>{off();window.removeEventListener('beforeunload',block);};},[kind,guard]);
 function clear(){setKind(null);setName('');setCode('');setStartsOn('');setDepartment('');setPosition('');setIntent(null);}
 async function save(){
  if(flight.current||!kind)return;
  let command=intent;
  try{command??=prepareHrRecord(actor,tenant,crypto.randomUUID(),kind==='department'?{kind,name:name.trim()}:{kind,name:name.trim(),code:code.trim(),startsOn,...(department?{departmentId:department,position:position.trim()}:{})});}
  catch{setMessage('Ad, personel kodu, başlangıç tarihi ve seçili departmanın pozisyonunu kontrol edin.');return;}
  setIntent(command);flight.current=true;setBusy(true);setMessage('');
  try{await saveHrRecord(createClient(),command);if(!alive.current)return;clear();setMessage('Kayıt oluşturuldu.');if(cursor)setCursor(null);else await resource.reload();}
  catch{if(alive.current)setMessage('Kayıt doğrulanamadı. Aynı işlemi yeniden deneyin. Kod veya departman zaten kayıtlıysa formu kapatıp listeyi yenileyin.');}
  finally{flight.current=false;if(alive.current)setBusy(false);}
 }
 return <div className="mx-auto max-w-6xl space-y-5">
 <header><h1 className="text-2xl font-semibold">Çalışanlar</h1><p className="mt-1 text-slate-600">Personel kayıtları, işe giriş dönemleri ve organizasyon bilgileri.</p></header>
 {message&&<p role="status" className="rounded-lg bg-blue-50 p-3">{message}</p>}
 {resource.loading&&<p role="status">Çalışanlar yükleniyor…</p>}
 {resource.error&&<p role="alert">Çalışanlar alınamadı. İK modülünün açık olduğunu ve erişiminizi kontrol edin.</p>}
 <div className="flex flex-wrap gap-2"><button className={button} disabled={busy||!!kind} onClick={()=>void resource.reload()}>Yenile</button>
 {resource.data&&!kind&&<><button className={button} onClick={()=>setKind('employee')}>Yeni çalışan</button><button className={button} onClick={()=>setKind('department')}>Yeni departman</button></>}</div>
 {kind&&<form className="max-w-xl space-y-3 rounded-xl border p-5" onSubmit={event=>{event.preventDefault();void save();}}>
 <h2 className="font-semibold">{kind==='employee'?'Yeni çalışan':'Yeni departman'}</h2>
 <fieldset disabled={busy||!!intent} className="space-y-3">
 <label className="block">{kind==='employee'?'Ad soyad':'Departman adı'}<input required maxLength={kind==='employee'?160:120} className={input} value={name} onChange={e=>setName(e.target.value)}/></label>
 {kind==='employee'&&<><label className="block">Personel kodu<input required maxLength={40} className={input} value={code} onChange={e=>setCode(e.target.value)}/></label>
 <label className="block">İşe giriş tarihi<input required type="date" min="1900-01-01" max="2199-12-31" className={input} value={startsOn} onChange={e=>setStartsOn(e.target.value)}/></label>
 <label className="block">Departman (isteğe bağlı)<select className={input} value={department} onChange={e=>setDepartment(e.target.value)}><option value="">Daha sonra belirle</option>{resource.data?.departments.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
 {department&&<label className="block">Pozisyon<input required maxLength={120} className={input} value={position} onChange={e=>setPosition(e.target.value)}/></label>}</>}
 </fieldset><div className="flex gap-2"><button className={button} disabled={busy}>{busy?'Kaydediliyor…':intent?'Aynı işlemi yeniden dene':'Kaydet'}</button><button type="button" className={button} disabled={busy} onClick={clear}>Formu kapat</button></div></form>}
 {resource.data&&<><div className="overflow-x-auto rounded-xl border"><table className="w-full text-left text-sm"><caption className="sr-only">Çalışan listesi</caption><thead><tr>{['Kod','Ad soyad','İşe giriş','İşten ayrılış','Departman','Pozisyon'].map(title=><th className="p-3" key={title}>{title}</th>)}</tr></thead><tbody>{resource.data.employees.map(e=><tr key={e.id} className="border-t">{[e.code,e.name,e.startsOn,e.endsOn??'—',e.department??'Belirlenmedi',e.position??'Belirlenmedi'].map((value,index)=><td className="p-3" key={index}>{value}</td>)}</tr>)}</tbody></table></div>
 {!resource.data.employees.length&&<p>Bu sayfada çalışan kaydı yok.</p>}
 <div className="flex gap-2"><button className={button} disabled={!cursor||!!kind} onClick={()=>setCursor(null)}>İlk sayfa</button><button className={button} disabled={!resource.data.hasMore||!!kind} onClick={()=>setCursor(resource.data!.employees.at(-1)!.id)}>Sonraki 50 kayıt</button></div>
 <section><h2 className="font-semibold">Departmanlar</h2><p className="mt-2 text-sm">{resource.data.departments.map(d=>d.name).join(' · ')||'Henüz departman yok.'}</p></section></>}
 </div>;
}
export default function HrDirectory(){
 const {user,role}=useAuth();const {tenantId,loading}=useVerifiedTenant();
 if(loading)return <p role="status">Şirket erişimi doğrulanıyor…</p>;
 if(!user||!tenantId||!['yonetici','ik'].includes(role??''))return <p role="alert">Bu alan için İK veya yönetici erişimi gerekiyor.</p>;
 return <Directory key={`${user.id}:${tenantId}:${role}`} actor={user.id} tenant={tenantId}/>;
}
