'use client';
import {useEffect,useRef,useState} from 'react';
import {useAuth} from '@/context/AuthContext';
import {createClient} from '@/lib/supabase/client';
import {invitationError} from '@/lib/workspace-invitations';
import {PageHeader} from '@/components/ui';
export default function InvitationPage(){
 const {user}=useAuth();const [code,setCode]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[accepted,setAccepted]=useState(false);const pending=useRef(false);const currentActor=useRef(user?.id);currentActor.current=user?.id;
 useEffect(()=>{setAccepted(false);setCode('');setError('');},[user?.id]);
 async function accept(){if(pending.current||!user)return;const actorId=user.id;pending.current=true;setBusy(true);setError('');try{
  const m=/^([0-9a-f-]{36})\.([0-9a-f]{64})$/.exec(code.trim());if(!m){setError('Davet kodunu eksiksiz yapıştırın.');return;}
  const prepared=await createClient().rpc('prepare_invited_profile',{p_id:m[1],p_token:m[2]});if(prepared.error)throw prepared.error;
  const r=await createClient().rpc('accept_workspace_invitation',{p_actor_id:user.id,p_id:m[1],p_token:m[2]});if(r.error)throw r.error;
  if(!r.data||typeof r.data!=='object'||Array.isArray(r.data)||r.data.accepted!==true||typeof r.data.tenantId!=='string')throw Error('receipt');
  if(currentActor.current!==actorId)return;
  setAccepted(true);setCode('');
 }catch(e){if(currentActor.current===actorId)setError(invitationError(e));}finally{pending.current=false;setBusy(false);}}
 return <><PageHeader title="Çalışma alanı daveti" subtitle="Yöneticinizin paylaştığı kodu kendi hesabınızla kabul edin."/><section className="rounded-lg border bg-white p-5 space-y-4">
 <p className="text-sm text-slate-600">Giriş yapılan hesap: {user?.email??'Doğrulanıyor…'}</p>
 {accepted?<><p role="status">Davet kabul edildi. Çalışma alanınızın oturuma yansıması için yeniden giriş yapın. Daveti tekrar kabul etmeniz gerekmez.</p><button className="text-blue-700" onClick={()=>void createClient().auth.signOut({scope:'local'}).then(r=>{if(r.error)setError('Çıkış yapılamadı. Yeniden deneyin.');else window.location.assign('/login');})}>Çıkış yap ve yeniden giriş yap</button></>:<form onSubmit={e=>{e.preventDefault();void accept();}} className="space-y-3"><label className="block text-sm">Davet kodu<input required autoComplete="off" maxLength={101} value={code} onChange={e=>setCode(e.target.value)} className="mt-1 block w-full rounded border p-2 font-mono text-sm"/></label><button disabled={busy||!user} className="rounded bg-blue-700 px-4 py-2 text-sm text-white">{busy?'Kontrol ediliyor…':'Daveti kabul et'}</button></form>}
 {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
 <p className="text-sm text-slate-500">Başka bir çalışma alanına bağlı hesap bu işlemle taşınmaz. Yeni BPS hesabı için davet kodunuzla /kayit ekranını kullanın.</p>
 </section></>;
}
