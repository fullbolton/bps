'use client';
import {useEffect,useRef,useState} from 'react';
import {createClient} from '@/lib/supabase/client';
import {parseInvitation,parseInvitations,newInvitationToken,invitationError,type Invitation} from '@/lib/workspace-invitations';
const labels={pending:'Bekliyor',accepted:'Kabul edildi',cancelled:'İptal edildi',expired:'Süresi doldu'};
export default function Invitations({actorId,tenantId}:{actorId:string;tenantId:string}){
 const [rows,setRows]=useState<Invitation[]|null>(null),[email,setEmail]=useState(''),[role,setRole]=useState('operasyon'),[error,setError]=useState(''),[busy,setBusy]=useState(false),[code,setCode]=useState(''),[copied,setCopied]=useState(false);
 const mounted=useRef(true),pending=useRef(false),command=useRef<{id:string;token:string;email:string;role:string}|null>(null);
 async function reload(){const r=await createClient().rpc('list_workspace_invitations',{p_actor_id:actorId,p_tenant_id:tenantId});if(r.error)throw r.error;const list=parseInvitations(r.data);if(mounted.current)setRows(list);}
 useEffect(()=>{mounted.current=true;void reload().catch(()=>{if(mounted.current)setError('Davetler yüklenemedi. Yeniden deneyin.');});return()=>{mounted.current=false;};},[actorId,tenantId]);
 async function execute(action:'create'|'cancel'|'refresh',id?:string){
  if(pending.current)return;pending.current=true;setBusy(true);setError('');
  try{
   if(action==='create'){
    const c=command.current??{id:crypto.randomUUID(),token:newInvitationToken(),email:email.trim().toLowerCase(),role};command.current=c;
    const r=await createClient().rpc('manage_workspace_invitation',{p_actor_id:actorId,p_tenant_id:tenantId,p_id:c.id,p_action:'create',p_email:c.email,p_role:c.role,p_token:c.token});if(r.error)throw r.error;
    const result=parseInvitation(r.data);if(result.id!==c.id)throw Error('response');
    if(mounted.current){setCode(result.state==='pending'?`${c.id}.${c.token}`:'');setCopied(false);setEmail('');}command.current=null;
   }else if(action==='cancel'&&id){const r=await createClient().rpc('manage_workspace_invitation',{p_actor_id:actorId,p_tenant_id:tenantId,p_id:id,p_action:'cancel'});if(r.error)throw r.error;parseInvitation(r.data);if(mounted.current)setCode(old=>old.startsWith(id+'.')?'':old);}
   await reload();
  }catch(e){if(mounted.current)setError(invitationError(e));}finally{pending.current=false;if(mounted.current)setBusy(false);}
 }
 return <section aria-label="Kullanıcı davetleri" className="mt-5 rounded-lg border border-slate-200 bg-white p-5 space-y-4">
 <div className="flex justify-between gap-3"><h2 className="font-semibold">Kullanıcı davetleri</h2><button disabled={busy} onClick={()=>void execute('refresh')} className="text-sm text-blue-700">Davetleri yenile</button></div>
 <p className="text-sm text-slate-600">Bir kişiyi çalışma alanınıza davet edin. Kod 7 gün geçerlidir; kabul için aynı e-postayla doğrulanmış hesap gerekir. Davet e-postası otomatik gönderilmez.</p>
 <form onSubmit={e=>{e.preventDefault();void execute('create');}} className="flex flex-wrap gap-3 items-end">
 <label className="text-sm">E-posta<input type="email" required maxLength={254} disabled={busy||!!command.current} value={email} onChange={e=>setEmail(e.target.value)} className="block rounded border p-2"/></label>
 <label className="text-sm">Rol<select value={role} disabled={busy||!!command.current} onChange={e=>setRole(e.target.value)} className="block rounded border p-2"><option value="operasyon">Operasyon</option><option value="ik">İK</option><option value="muhasebe">Muhasebe</option><option value="goruntuleyici">Görüntüleyici</option></select></label>
 <button disabled={busy} className="rounded bg-blue-700 px-3 py-2 text-sm text-white">{command.current?'Aynı daveti yeniden dene':'Davet kodu oluştur'}</button></form>
 {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
 {code&&<div className="rounded bg-blue-50 p-3 space-y-2"><label className="block text-sm">Davet kodu<input readOnly value={code} className="block w-full rounded border p-2 font-mono text-xs"/></label><button className="text-sm text-blue-700" onClick={()=>void navigator.clipboard.writeText(code).then(()=>setCopied(true)).catch(()=>setError('Kod kopyalanamadı; alandan seçip kopyalayın.'))}>{copied?'Kopyalandı':'Kodu kopyala'}</button><p className="text-xs text-slate-600">Alıcı hesabı yoksa /kayit ekranında hesap açar; giriş yaptıktan sonra /davet ekranına bu kodu yapıştırır. Kodu kaybettiğinizde daveti iptal edip yenisini oluşturun.</p></div>}
 {rows===null?<p className="text-sm">Davet listesi henüz yüklenmedi.</p>:rows.length===0?<p className="text-sm text-slate-500">Henüz davet yok.</p>:<ul className="divide-y max-h-80 overflow-auto">{rows.map(r=><li key={r.id} className="py-3 flex justify-between gap-3 text-sm"><div><p className="break-all">{r.email}</p><p className="text-slate-500">{r.role} · {labels[r.state]} · Son tarih: {new Intl.DateTimeFormat('tr-TR',{dateStyle:'short',timeStyle:'short',timeZone:'Europe/Istanbul'}).format(new Date(r.expiresAt))}</p></div>{r.state==='pending'&&<button disabled={busy} onClick={()=>void execute('cancel',r.id)} className="text-red-700">İptal et</button>}</li>)}</ul>}
 <p className="text-xs text-slate-500">Son 50 davet gösterilir. Kabul edilmiş bir daveti iptal etmek kullanıcı erişimini kaldırmaz; erişim yönetimi ayrı bir işlemdir.</p>
 </section>;
}
