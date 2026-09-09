'use client';
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {useSearchParams} from 'next/navigation';
import {useAuth} from '@/context/AuthContext';
import {useVerifiedTenant} from '@/hooks/useVerifiedTenant';
import {createClient} from '@/lib/supabase/client';
import type {Json} from '@/types/database.types';
import {parseStartBoard,startRowState,startStatusLabels,startOutcomes,startError,type StartBoard,type StartRow} from '@/lib/operations/start-board';
import {reserveCommand,acknowledgeCommand,pendingCommandIds,reconcilePending} from '@/lib/operations/pending-commands';
const input='block w-full rounded border border-slate-300 p-2 mt-1 text-sm';
const button='rounded border border-slate-300 px-3 py-2 text-sm disabled:opacity-40';
const dayNow=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Istanbul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const time=(v:string|number)=>new Date(v).toLocaleTimeString('tr-TR',{timeZone:'Europe/Istanbul',hour:'2-digit',minute:'2-digit'});
const localTime=(v:number)=>new Date(v+3*3600000).toISOString().slice(0,19);
export default function StartBoardClient(){
 const query=useSearchParams(),{user,role,loading:authLoading}=useAuth(),[refresh,setRefresh]=useState(0),{tenantId,loading}=useVerifiedTenant();
 const [day,setDay]=useState(()=>/^\d{4}-\d{2}-\d{2}$/.test(query.get('gun')??'')?query.get('gun')!:dayNow()),[offset,setOffset]=useState(0),[search,setSearch]=useState(''),[onlyUrgent,setOnlyUrgent]=useState(false),[onlyMine,setOnlyMine]=useState(false);
 const [result,setResult]=useState<{scope:string;data:StartBoard;received:number}|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[fetching,setFetching]=useState(false),[tick,setTick]=useState(Date.now()),[pending,setPending]=useState(0);
 const [edit,setEdit]=useState<{row:StartRow;action:string;check?:number;occurred:string}|null>(null),[notice,setNotice]=useState('');
 const actorId=user?.id,allowed=role==='yonetici'||role==='operasyon',scope=`${actorId}:${tenantId}:${role}:${day}:${offset}`,scopeRef=useRef(scope);scopeRef.current=scope;
 const data=result?.scope===scope?result.data:null;
 const now=result?Date.parse(result.data.serverNow)+(tick-result.received):Date.now();
 useEffect(()=>{const t=setInterval(()=>setTick(Date.now()),15000);return()=>clearInterval(t);},[]);
 useEffect(()=>{setEdit(null);setNotice('');},[scope]);
 useEffect(()=>{let cancelled=false;setError('');setResult(null);if(loading||!allowed||!actorId||!tenantId)return;setFetching(true);
  void(async()=>{try{const r=await createClient().rpc('ops_start_board',{p_actor_id:actorId,p_tenant_id:tenantId,p_day:day,p_offset:offset});if(r.error)throw r.error;const value=parseStartBoard(r.data);if(!cancelled){const received=Date.now();setResult({scope,data:value,received});setTick(received);setPending(pendingCommandIds({actorId,tenantId},localStorage).length);}}catch{if(!cancelled)setError('Takip listesi yüklenemedi. Bağlantıyı kontrol edip yenileyin.');}finally{if(!cancelled)setFetching(false);}})();return()=>{cancelled=true;};
 },[actorId,tenantId,allowed,loading,day,offset,refresh,scope]);
 // Refresh between actions; never discard an open form or an uncertain command.
 useEffect(()=>{const t=setInterval(()=>{if(!edit&&!busy)setRefresh(n=>n+1);},60000);return()=>clearInterval(t);},[edit,busy]);
 async function save(row:StartRow,action:string,payload:Json){
  if(!actorId||!tenantId||busy||!data)return;const captured=scope;setBusy(true);setError('');
  const identity={actorId,tenantId};let id:string|undefined;
  try{
   id=await reserveCommand(identity,'start',{assignmentId:row.id,expectedRevision:row.revision,action,data:payload},localStorage,navigator.locks);
   const r=await createClient().rpc('ops_start_execute',{p_actor_id:actorId,p_tenant_id:tenantId,p_command_id:id,p_assignment_id:row.id,p_expected_revision:row.revision,p_action:action,p_payload:payload});
   if(r.error)throw r.error;
   const receipt=r.data as {id?:string;commandId?:string;revision?:number}|null;
   if(receipt?.id!==row.id||receipt.commandId!==id||!Number.isInteger(receipt.revision))throw Error('receipt');
   await acknowledgeCommand(identity,id,localStorage,navigator.locks);
   if(scopeRef.current===captured){setEdit(null);setNotice('Kaydedildi.');setRefresh(n=>n+1);}
  }catch(e){if(scopeRef.current===captured)setError(startError(e));}
  finally{if(scopeRef.current===captured){try{setPending(pendingCommandIds(identity,localStorage).length);}catch{setError('Kurtarma kaydı okunamadı.');}}setBusy(false);}
 }
 async function recover(){if(!actorId||!tenantId||busy)return;setBusy(true);setError('');const captured=scope;
  try{const identity={actorId,tenantId},ids=pendingCommandIds(identity,localStorage);const r=await createClient().rpc('ops_reconcile_commands',{p_actor_id:actorId,p_tenant_id:tenantId,p_command_ids:ids,p_close:true});if(r.error)throw r.error;
   const summary=await reconcilePending(identity,ids,r.data,localStorage,navigator.locks);if(scopeRef.current===captured){setNotice(`${summary.confirmed} işlem kaydedilmiş, ${summary.closed} uygulanmamış işlem kapatıldı. Liste güncellendi.`);setEdit(null);setRefresh(n=>n+1);}
  }catch{if(scopeRef.current===captured)setError('Bekleyen işlemler doğrulanamadı; tekrar deneyin.');}finally{setBusy(false);}
 }
 function open(row:StartRow,action:string,check?:number){setEdit({row,action,check,occurred:localTime(Math.min(now,Date.now()))});setError('');setNotice('');}
 if(authLoading||loading)return <p role="status">Çalışma alanı doğrulanıyor…</p>;
 if(!allowed)return <p>Bu ekran yönetici ve operasyon ekibi içindir.</p>;
 if(!actorId||!tenantId)return <p role="alert">Çalışma alanı doğrulanamadı. Oturumunuzu yenileyin.</p>;
 const rows=data?.rows.filter(r=>(!onlyUrgent||startRowState(r,now).urgent)&&(!onlyMine||r.responsibleId===actorId)&&`${r.company} ${r.location} ${r.worker}`.toLocaleLowerCase('tr').includes(search.toLocaleLowerCase('tr')))??[];
 return <section className="space-y-5 max-w-6xl"><header className="flex flex-wrap justify-between gap-3"><div><h1 className="text-2xl font-semibold">İşe Başlama Takibi</h1><p className="mt-2 text-sm text-slate-600">Arama sonuçlarını kaydedin; işe başlamayı şube veya saha sorumlusuyla ayrıca teyit edin.</p></div><button className={button} disabled={busy||fetching} onClick={()=>{setEdit(null);setRefresh(n=>n+1);}}>Listeyi yenile</button></header>
 <Link className="inline-block text-blue-700 underline" href={`/talepler/gunluk?gun=${day}`}>Günlük personel planı</Link>
 <div className="flex flex-wrap items-end gap-4 rounded border bg-white p-4"><label className="text-sm">İş günü<input aria-label="İş günü" className={input} type="date" value={day} onChange={e=>{if(e.target.value){setDay(e.target.value);setOffset(0);}}}/></label><label className="text-sm">Firma, şube veya personel<input className={input} value={search} onChange={e=>setSearch(e.target.value)}/></label><label className="text-sm"><input type="checkbox" checked={onlyUrgent} onChange={e=>setOnlyUrgent(e.target.checked)}/> Aksiyon gerekenler</label><label className="text-sm"><input type="checkbox" checked={onlyMine} onChange={e=>setOnlyMine(e.target.checked)}/> Sorumlu olduklarım</label></div>
 {day!==dayNow()&&<p className="text-sm text-amber-800">{day>dayNow()?'Gelecek günün planını inceliyorsunuz.':'Geçmiş günün kayıtlarını inceliyorsunuz.'} Saatler İstanbul saatidir.</p>}
 {pending>0&&<div className="rounded border border-amber-300 p-3 text-sm">{pending} operasyon işleminin sonucu kontrol edilmeli. Kontrol, kaydedilenleri doğrular ve uygulanmamış denemeleri kapatır. <button disabled={busy} className={button} onClick={()=>void recover()}>Bekleyen işlemleri kontrol et</button></div>}
 {error&&<p role="alert" className="rounded bg-red-50 p-3 text-red-800">{error}</p>}{notice&&<p role="status" className="text-green-800">{notice}</p>}
 {fetching?<p role="status">Atamalar yükleniyor…</p>:data&&rows.length===0?<p className="rounded border bg-white p-6">{data.total===0?'Bu gün için personel ataması yok. Günlük plandan personel atayın.':'Bu sayfada filtreye uygun atama yok.'}</p>:null}
 {rows.map(r=>{const model=startRowState(r,now),locked=busy||r.closed||Boolean(r.confirmedAt),claimActive=r.claimUntil&&Date.parse(r.claimUntil)>now&&r.claimedBy!==actorId;
 return <article key={r.id} className="rounded-xl border bg-white p-5 space-y-3"><div className="flex flex-wrap justify-between gap-3"><div><h2 className="font-semibold">{r.worker} · {r.location}</h2><p className="text-sm text-slate-600">{r.company} · {r.position}</p><p className="text-sm">Başlangıç: {r.startAt?time(r.startAt):'Belirlenmedi'} · Sorumlu: {r.responsible??'Belirlenmedi'}</p></div><strong className={model.status==='confirmed'?'text-green-700':model.urgent?'text-red-700':'text-slate-600'}>{startStatusLabels[model.status]}</strong></div>
 {r.startAt&&!r.ownerAvailable&&!r.closed&&!r.confirmedAt&&<p className="text-sm text-amber-800">Takip sorumlusu artık yetkili değil. Planı düzenleyip sorumlu atayın.</p>}
 {r.startAt&&<div className="flex flex-wrap gap-2">{model.steps.map(s=><button className={`${button} ${s.state==='overdue'?'border-red-400 bg-red-50 text-red-800':s.state==='due'?'border-blue-400 bg-blue-50':'bg-slate-50'}`} key={s.offset} disabled={locked||Boolean(claimActive)||['upcoming','not_applicable','not_required'].includes(s.state)} onClick={()=>open(r,'call',s.offset)}>{time(s.dueAt)} · {s.event?startOutcomes[s.event.payload.outcome as keyof typeof startOutcomes]:({upcoming:'Planlı',due:'Şimdi ara',overdue:'Arama gecikti',not_required:'Kapandı',not_applicable:'Plan öncesi · uygulanmaz'}[s.state]??s.state)}</button>)}</div>}
 {model.latest&&<p className="text-sm text-slate-600">Son görüşme {time(model.latest.occurredAt)} · {startOutcomes[model.latest.payload.outcome as keyof typeof startOutcomes]}{typeof model.latest.payload.eta==='string'?` · Beklenen varış ${time(model.latest.payload.eta)}`:''}</p>}
 {claimActive&&<p className="text-sm text-blue-700">Bir ekip arkadaşınız aramayı üstlendi · {time(r.claimUntil!)} saatine kadar.</p>}
 <div className="flex flex-wrap gap-2">{!r.closed&&!r.confirmedAt&&<><button className={button} disabled={busy} onClick={()=>open(r,'plan')}>{r.startAt?'Saat / sorumluyu düzenle':'Saat ve sorumlu belirle'}</button>{r.startAt&&<><button className={button} disabled={locked||Boolean(claimActive)} onClick={()=>void save(r,r.claimedBy===actorId&&r.claimUntil&&Date.parse(r.claimUntil)>now?'release':'claim',{})}>{r.claimedBy===actorId&&r.claimUntil&&Date.parse(r.claimUntil)>now?'Aramayı bırak':'Aramayı üstlen · 3 dk'}</button><button className={button} disabled={locked||Boolean(claimActive)} onClick={()=>open(r,'call',0)}>Ek / ilk arama</button><button className={`${button} border-green-600 text-green-800`} disabled={locked||day>dayNow()} onClick={()=>open(r,'confirm')}>İşe başlamayı teyit et</button></>}</>}
 {!r.closed&&r.confirmedAt&&<button className={button} disabled={busy} onClick={()=>open(r,'reopen')}>Teyidi gerekçeyle geri al</button>}
 <Link className={`${button} text-blue-700`} href={`/talepler/gunluk?firma=${r.companyId}&gun=${day}&talep=${r.requestId}#talep-${r.requestId}`}>Atama / yedek personel</Link></div>
 {r.confirmedAt&&<p className="text-sm text-green-800">{time(r.confirmedAt)} · {r.witness} ({r.source==='branch'?'şube yetkilisi':'saha sorumlusu'}) teyidi kaydedildi.</p>}
 {edit?.row.id===r.id&&<form key={`${r.id}:${edit.action}:${edit.check}`} onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);let payload:Json;
 if(edit.action==='plan')payload={time:String(f.get('time')),responsibleId:String(f.get('responsible')),offsets:String(f.get('offsets')).split(',').map(s=>-Math.abs(Number(s.trim()))),reason:String(f.get('reason')??'')};
 else if(edit.action==='reopen')payload={reason:String(f.get('reason'))};
 else{const occurredAt=new Date(String(f.get('occurred'))+'+03:00').toISOString();payload=edit.action==='call'?{offset:edit.check!,outcome:String(f.get('outcome')),note:String(f.get('note')??''),reason:String(f.get('reason')??''),occurredAt,eta:f.get('eta')?new Date(String(f.get('eta'))+'+03:00').toISOString():null}:{source:String(f.get('source')),witness:String(f.get('witness')),occurredAt};}
 void save(edit.row,edit.action,payload);
 }} className="rounded border border-blue-200 bg-blue-50 p-4"><fieldset disabled={busy} className="grid gap-3 sm:grid-cols-2"><legend className="font-semibold mb-3">{edit.action==='plan'?'Takip planı':edit.action==='call'?'Görüşme sonucu':edit.action==='confirm'?'Bağımsız işe başlama teyidi':'Teyidi geri alma'}</legend>
 {edit.action==='plan'?<><label>Başlangıç saati<input className={input} name="time" type="time" defaultValue={r.startAt?time(r.startAt):''} required/></label><label>Takip sorumlusu<select name="responsible" className={input} defaultValue={r.responsibleId??actorId} required>{data?.members.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></label><label className="sm:col-span-2">Başlangıçtan kaç dakika önce aransın? (virgülle ayırın)<input className={input} name="offsets" defaultValue={r.offsets.length?r.offsets.map(Math.abs).join(', '):'60, 30, 15'} pattern="\s*\d+\s*(,\s*\d+\s*)*" required/></label></>:null}
 {['call','confirm'].includes(edit.action)&&<label>Görüşme / teyit zamanı<input className={input} name="occurred" type="datetime-local" step="1" defaultValue={edit.occurred} max={localTime(now)} required/></label>}
 {edit.action==='call'&&<><label>Sonuç<select className={input} name="outcome" required>{Object.entries(startOutcomes).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label><label>Beklenen varış (isteğe bağlı)<input className={input} type="datetime-local" name="eta"/></label><label>Not<input className={input} name="note" maxLength={1000}/></label></>}
 {edit.action==='confirm'&&<><p className="text-sm sm:col-span-2">Personelin kendi beyanı yeterli değildir. Şube yetkilisinden veya saha sorumlusundan aldığınız teyidi kaydedin. Günlük gerçekleşme de “geldi” olarak güncellenecek.</p><label>Kaynak<select name="source" className={input}><option value="branch">Şube yetkilisi</option><option value="field">Saha sorumlusu</option></select></label><label>Teyit eden kişi<input name="witness" className={input} maxLength={160} required/></label></>}
 {((edit.action==='plan'&&r.startAt)||edit.action==='reopen'||edit.action==='call')&&<label className="sm:col-span-2">{edit.action==='call'?'Düzeltme / tekrar arama gerekçesi (aynı adım daha önce kaydedildiyse zorunlu)':'Değişiklik gerekçesi'}<input className={input} name="reason" minLength={3} maxLength={1000} required={edit.action!=='call'||r.events.some(e=>e.kind==='call'&&e.planVersion===r.planVersion&&e.payload.offset===edit.check)}/></label>}
 <div className="flex gap-2"><button className={`${button} bg-blue-700 text-white`}>Kaydet</button><button type="button" className={button} onClick={()=>setEdit(null)}>Vazgeç</button></div></fieldset></form>}
 <details className="text-sm"><summary className="cursor-pointer text-slate-600">Takip geçmişi · {r.events.length} kayıt</summary><ol className="mt-2 space-y-2">{r.events.map(e=><li key={e.id} className="border-l-2 pl-3">{({plan:'Plan kaydedildi',inherited:'Yedek atama planı devraldı',call:'Arama',confirm:'Teyit',reopen:'Teyit geri alındı',claim:'Arama üstlenildi',release:'Arama bırakıldı'}[e.kind]??e.kind)} · {e.actor} · {new Date(e.recordedAt).toLocaleString('tr-TR',{timeZone:'Europe/Istanbul'})}{e.kind==='call'&&` · ${startOutcomes[e.payload.outcome as keyof typeof startOutcomes]}`}{typeof e.payload.reason==='string'&&e.payload.reason&&<span className="block">Gerekçe: {e.payload.reason}</span>}{typeof e.payload.note==='string'&&e.payload.note&&<span className="block">Not: {e.payload.note}</span>}</li>)}</ol></details>
 </article>;})}
 {data&&<footer className="flex flex-wrap justify-between gap-3 text-sm"><span>{data.total} atama · Sayfa {Math.floor(offset/50)+1}. Filtreler bu sayfaya uygulanır.</span><div className="flex gap-2"><button className={button} disabled={offset===0||busy} onClick={()=>setOffset(n=>Math.max(0,n-50))}>Önceki</button><button className={button} disabled={offset+50>=data.total||busy} onClick={()=>setOffset(n=>n+50)}>Sonraki</button></div></footer>}
 </section>;
}
