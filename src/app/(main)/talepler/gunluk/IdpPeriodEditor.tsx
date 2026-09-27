'use client';
import {useEffect,useRef,useState} from 'react';
import {useNavigationGuard} from '@/context/NavigationGuardContext';
import {addDays} from '@/lib/operations/weekly-plan';
import {reserveCommand,acknowledgeCommand,type CommandScope} from '@/lib/operations/pending-commands';
import type {IdpPeriodDay} from '@/lib/operations/idp-period';
import {validatePeriodCommand,type PeriodCommand,type PeriodChange} from '@/lib/operations/idp-period-management';
import {idpPeriodManageAction} from './actions';
const field='mt-1 min-h-11 w-full rounded-xl border p-3 text-base';
export default function IdpPeriodEditor({scope,periodId,days,mode,onDone,onCancel,onBusy}:{scope:CommandScope;periodId:string;days:IdpPeriodDay[];mode:'update'|'cancel';onDone:()=>void;onCancel:()=>void;onBusy:(v:boolean)=>void}){
 const [preview,setPreview]=useState<PeriodChange|null>(null),[pending,setPending]=useState<PeriodCommand|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const flight=useRef(false),guard=useNavigationGuard(),first=days[0];
 useEffect(()=>{const remove=guard.register(e=>{e.preventDefault();setError('Önce dönem düzenlemesini tamamlayın veya kapatın.');});const block=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};window.addEventListener('beforeunload',block);return()=>{remove();window.removeEventListener('beforeunload',block);};},[guard]);
 function prepare(form:HTMLFormElement){setError('');try{const d=new FormData(form),reason=String(d.get('reason')??'');const change:PeriodChange=mode==='cancel'?{action:'cancel',reason}:{action:'update',reason,originalName:String(d.get('name')),leaveStart:String(d.get('start')),leaveEnd:String(d.get('end')),dates:[]};
 const v=validatePeriodCommand({commandId:crypto.randomUUID(),periodId,expectedRevision:first.periodRevision,change});
 const clean=v.change;if(clean.action==='update'&&days.some(day=>day.day<clean.leaveStart||day.day>clean.leaveEnd))throw Error('Mevcut çalışma günlerinin tamamı yeni izin aralığında kalmalı.');
 setPreview(v.change);
 }catch(e){setError(e instanceof Error?e.message:'Bilgileri kontrol edin.');}}
 async function save(){if(flight.current||!preview)return;flight.current=true;setBusy(true);onBusy(true);setError('');try{
 const command=pending??validatePeriodCommand({commandId:await reserveCommand(scope,'idp_manage',{periodId,revision:first.periodRevision,change:preview},localStorage,navigator.locks),periodId,expectedRevision:first.periodRevision,change:preview});setPending(command);
 const result=await idpPeriodManageAction(scope,command);if(!result.ok){setError(result.message);return;}
 await acknowledgeCommand(scope,command.commandId,localStorage,navigator.locks);onDone();
 }catch{setError('İşlem sonucu kesinleştirilemedi. Aynı işlemi tekrar deneyin; kapatmak sunucudaki işlemi geri almaz.');}finally{flight.current=false;setBusy(false);onBusy(false);}}
 const newDays:string[]=[];if(preview?.action==='update')for(let day=preview.leaveStart;day<=preview.leaveEnd;day=addDays(day,1))if(!days.some(d=>d.day===day))newDays.push(day);
 return <section className="mt-4 space-y-3 rounded-xl border p-3"><h3 className="font-semibold">{mode==='cancel'?'Dönemi iptal et':'Dönem bilgisini düzelt / gün ekle'}</h3>
 <p className="text-sm text-slate-600">{mode==='cancel'?`${days.filter(d=>d.lifecycle==='active').length} aktif günlük talep iptal edilecek. Kayıtlar silinmez. Atanmış personel varsa işlem yapılmaz.`:'Mevcut gün ve atamalar korunur. Tarih aralığını değiştirmek tek başına yeni talep oluşturmaz.'}</p>
 {!preview?<form onSubmit={e=>{e.preventDefault();prepare(e.currentTarget);}} className="space-y-3">{mode==='update'&&<><label className="block text-sm">İzinli personel<input className={field} name="name" readOnly={!!first.sourceRosterId} defaultValue={first.originalName} maxLength={160} required/>{first.sourceRosterId&&<span className="mt-1 block text-xs text-slate-600">Bu dönem kadrodaki personele bağlıdır; burada başka bir kişiyle değiştirilemez.</span>}</label><label className="block text-sm">Dönem başlangıcı<input className={field} name="start" type="date" defaultValue={first.leaveStart} required/></label><label className="block text-sm">Dönem bitişi<input className={field} name="end" type="date" defaultValue={first.leaveEnd} required/></label></>}
 <label className="block text-sm">Değişiklik gerekçesi<textarea name="reason" className={field} minLength={3} maxLength={500} required/></label><button className="min-h-11 rounded-xl border px-4" type="submit">Değişikliği önizle</button></form>:<div className="space-y-3">
 {preview.action==='update'&&<><p className="text-sm">{preview.originalName} · {preview.leaveStart} – {preview.leaveEnd}</p><fieldset disabled={busy||!!pending}><legend className="text-sm font-medium">Eklenecek yeni çalışma günlerini seçin</legend>{newDays.length?newDays.map(day=><label key={day} className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={preview.dates.includes(day)} onChange={e=>setPreview({...preview,dates:e.target.checked?[...preview.dates,day].sort():preview.dates.filter(d=>d!==day)})}/>{day}</label>):<p className="text-sm">Aralıkta yeni gün yok; yalnız bilgi düzeltilecek.</p>}</fieldset><p className="text-sm">{preview.dates.length} yeni gün eklenecek; {days.length} mevcut gün korunacak.</p></>}
 <p className="text-sm">Gerekçe: {preview.reason}</p><button type="button" disabled={busy} onClick={()=>void save()} className="min-h-11 rounded-xl bg-blue-600 px-4 text-white disabled:opacity-50">{busy?'Kaydediliyor…':pending?'Aynı işlemi tekrar dene':mode==='cancel'?'Dönem iptalini onayla':'Değişikliği kaydet'}</button>{!pending&&<button type="button" className="ml-2 min-h-11 underline" onClick={()=>setPreview(null)}>Düzelt</button>}</div>}
 {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
 <button type="button" disabled={busy} onClick={onCancel} className="min-h-11 underline">Düzenlemeyi kapat</button>{pending&&<p className="text-xs">Kapatmak gönderilen işlemi geri almaz. Yeni işlemden önce dönem listesini yenileyin.</p>}</section>;
}
