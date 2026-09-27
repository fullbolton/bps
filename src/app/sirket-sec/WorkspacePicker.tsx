'use client';
import {useEffect,useRef,useState} from 'react';
import {createClient} from '@/lib/supabase/client';
import {completeWorkspaceSwitch,parseWorkspaceChoices,type WorkspaceChoices,type SelectionCommand} from '@/lib/workspace-selection';
const roles={yonetici:'Yönetici',operasyon:'Operasyon',ik:'İnsan kaynakları',muhasebe:'Muhasebe',goruntuleyici:'Görüntüleyici',partner:'Partner'};
export default function WorkspacePicker(){
 const [choices,setChoices]=useState<WorkspaceChoices|null>(null),[pending,setPending]=useState<SelectionCommand|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const flight=useRef(false),alive=useRef(true);const client=createClient();
 async function load(){
  if(flight.current)return;flight.current=true;setBusy(true);setChoices(null);setError('');
  try{
   const {data,error:authError}=await client.auth.getUser();if(authError||!data.user)throw Error('AUTH');
   const result=await client.rpc('my_workspace_choices').abortSignal(AbortSignal.timeout(12000));if(result.error)throw result.error;
   const parsed=parseWorkspaceChoices(result.data,data.user.id);if(alive.current){setChoices(parsed);setPending(null);}
  }catch{if(alive.current)setError('Şirketleriniz yüklenemedi. Oturumunuzu kontrol edip yeniden deneyin.');}
  finally{flight.current=false;if(alive.current)setBusy(false);}
 }
 useEffect(()=>{alive.current=true;void load();return()=>{alive.current=false;};},[]);
 async function choose(command:SelectionCommand){
  if(flight.current)return;flight.current=true;setBusy(true);setPending(command);setError('');
  try{
   await completeWorkspaceSwitch(command,{
    select:async args=>{const r=await client.rpc('select_workspace',args).abortSignal(AbortSignal.timeout(12000));if(r.error)throw r.error;return r.data;},
    refresh:async()=>{const r=await client.auth.refreshSession();if(r.error)throw r.error;return r.data.user;},
    context:async()=>{const r=await client.rpc('current_workspace_context').abortSignal(AbortSignal.timeout(12000));if(r.error)throw r.error;return r.data;}
   });
   if(alive.current)window.location.replace('/dashboard');
  }catch{if(alive.current)setError('Şirket geçişi tamamlanamadı. Seçim kaydedilmiş olabilir. Yeniden deneyin veya güncel şirket listesini yükleyin.');}
  finally{flight.current=false;if(alive.current)setBusy(false);}
 }
 return <main className="mx-auto max-w-xl space-y-5 px-4 py-10"><h1 className="text-2xl font-semibold">Hangi şirkette çalışacaksınız?</h1><p className="text-sm text-slate-600">Her şirketin personeli, işleri ve belgeleri ayrıdır. Geçiş diğer açık sekmelerinizi de etkiler; kaydedilmemiş formlarınızı önce tamamlayın.</p>
 {error&&<p role="alert" className="rounded-xl bg-amber-50 p-4">{error}</p>}
 {busy&&<p role="status">{pending?'Şirket ve yetkileriniz doğrulanıyor…':'Şirketleriniz yükleniyor…'}</p>}
 {!busy&&pending&&<button className="min-h-11 rounded-xl bg-blue-700 px-4 text-white" onClick={()=>void choose(pending)}>Geçişi yeniden dene</button>}
 {!busy&&<button className="min-h-11 rounded-xl border px-4" onClick={()=>void load()}>Şirket listesini yenile</button>}
 {choices&&!pending&&<ul className="space-y-3">{choices.memberships.map(m=><li key={m.tenantId}><button disabled={busy} className="min-h-16 w-full rounded-xl border p-4 text-left disabled:opacity-50" onClick={()=>void choose({userId:choices.userId,tenantId:m.tenantId,membershipVersion:m.version,commandId:crypto.randomUUID(),expectedVersion:choices.selectionVersion})}><strong className="block">{m.name}</strong><span className="text-sm text-slate-600">{roles[m.role]}{choices.activeTenantId===m.tenantId?' · Şu an seçili':''}</span></button></li>)}</ul>}
 {choices&&!choices.memberships.length&&<p>Henüz bir şirkete erişiminiz yok. Şirket yöneticinizden davet isteyin.</p>}
 </main>;
}
