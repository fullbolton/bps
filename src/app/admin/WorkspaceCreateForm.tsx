'use client';
import {useRef,useState} from 'react';
import type {AdminTenantRow} from '@/lib/services/platform-admin';
import {createTenantAction} from './actions';
import {workspaceAdminTenantsAction} from './membership-actions';
const field='min-h-11 rounded-xl border bg-white px-3 text-sm';
export default function WorkspaceCreateForm({onTenants}:{onTenants:(rows:AdminTenantRow[])=>void}){
 const [name,setName]=useState(''),[slug,setSlug]=useState(''),[review,setReview]=useState(false),[busy,setBusy]=useState(false),[needsCheck,setNeedsCheck]=useState(false),[message,setMessage]=useState('');
 const flight=useRef(false);
 async function reload(){
  if(flight.current)return;flight.current=true;setBusy(true);
  try{
   const r=await workspaceAdminTenantsAction();
   if(!r.ok){setMessage(r.error);return;}
   onTenants(r.data);setNeedsCheck(false);setReview(false);
   const found=r.data.find(t=>t.slug===slug.trim().toLowerCase());
   setMessage(found?`Bu kodla şirket listede bulunuyor: ${found.name}. Kullanıcı listesinden şirket erişimi ekleyebilirsiniz.`:'Şirket listesi yenilendi. Girdiğiniz kodla şirket bulunamadı; bilgileri kontrol edip yeniden deneyebilirsiniz.');
  }catch{setMessage('Şirketler okunamadı. Oluşturmayı tekrarlamadan önce listeyi yeniden doğrulayın.');}
  finally{flight.current=false;setBusy(false);}
 }
 async function create(){
  if(flight.current||needsCheck||!review)return;flight.current=true;setBusy(true);setMessage('');
  // Even a transport failure can follow a committed create. Require a fresh list before another write.
  setNeedsCheck(true);
  try{
   const r=await createTenantAction({slug,name});
   if(!r.ok){setMessage(r.error+' Oluşturmayı tekrarlamadan önce şirket listesini doğrulayın.');return;}
   setMessage('Şirket oluşturuldu. Kullanıcı listesinden bu şirkete erişim ekleyebilirsiniz.');
   const fresh=await workspaceAdminTenantsAction();
   if(!fresh.ok||!fresh.data.some(t=>t.slug===slug.trim().toLowerCase()&&t.name===name.trim())){setMessage('Şirket oluşturuldu ancak güncel listede doğrulanamadı. Şirket listesini doğrulayın.');return;}
   onTenants(fresh.data);setNeedsCheck(false);setReview(false);setName('');setSlug('');
  }catch{setMessage('Yanıt alınamadı; şirket oluşturulmuş olabilir. Oluşturmayı tekrarlamadan önce şirket listesini doğrulayın.');}
  finally{flight.current=false;setBusy(false);}
 }
 return <details className="rounded-xl border bg-white p-4"><summary className="cursor-pointer font-semibold">Yeni şirket oluştur</summary><div className="mt-4 space-y-3"><p className="text-sm text-slate-600">Mek ve Partner gibi ayrı çalışma alanları oluşturun. Bu işlem kişilere otomatik erişim vermez.</p>
 <form onSubmit={e=>{e.preventDefault();setReview(true);setMessage('');}} className="space-y-3"><fieldset disabled={busy||review||needsCheck} className="flex flex-wrap gap-3"><label className="flex flex-col gap-1 text-sm">Şirket adı<input required maxLength={200} className={field} value={name} onChange={e=>setName(e.target.value)}/></label><label className="flex flex-col gap-1 text-sm">Şirket kodu<input required maxLength={80} pattern="[a-z0-9-]+" placeholder="partner-staff" className={field} value={slug} onChange={e=>setSlug(e.target.value.toLowerCase())}/><span className="text-xs text-slate-500">Küçük harf, rakam ve tire. Her şirketin kodu farklı olmalı.</span></label><button className={field+' disabled:opacity-50'} disabled={!name.trim()||!slug.trim()}>Bilgileri gözden geçir</button></fieldset></form>
 {review&&!needsCheck&&<section aria-label="Yeni şirket onayı" className="space-y-2 rounded-xl bg-blue-50 p-3"><p><strong>{name.trim()}</strong> · {slug.trim()}</p><p className="text-sm">Ayrı bir şirket çalışma alanı oluşturulacak.</p><div className="flex gap-2"><button disabled={busy} className={field} onClick={()=>setReview(false)}>Düzenle</button><button disabled={busy} className={field+' bg-blue-700 text-white'} onClick={()=>void create()}>Şirketi oluştur</button></div></section>}
 {message&&<p role="status" className="rounded-xl bg-slate-50 p-3 text-sm">{message}</p>}{busy&&<p role="status">İşlem sürüyor…</p>}
 {needsCheck&&<button disabled={busy} className={field} onClick={()=>void reload()}>Şirket listesini doğrula</button>}
 </div></details>;
}
