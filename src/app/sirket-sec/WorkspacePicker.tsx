'use client';
import {useEffect,useRef,useState} from 'react';
import {createClient} from '@/lib/supabase/client';
import {completeWorkspaceSwitch,parseWorkspaceChoices,resolveAccountCompany,type WorkspaceChoices,type SelectionCommand} from '@/lib/workspace-selection';
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
  }catch{if(alive.current)setError('Şirket bağlantınız doğrulanamadı. Oturumunuzu kontrol edip yeniden deneyin.');}
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
  }catch{if(alive.current)setError('Şirket bağlantınız doğrulanamadı. İşlem kaydedilmiş olabilir. Aynı işlemi yeniden deneyin veya şirket bilgisini yenileyin.');}
  finally{flight.current=false;if(alive.current)setBusy(false);}
 }
 const company=choices?resolveAccountCompany(choices):null;
 return <main className="mx-auto max-w-xl space-y-5 px-4 py-10">
 <h1 className="text-2xl font-semibold">Şirket bağlantınızı doğrulayın</h1>
 <p className="text-sm text-slate-600">Hesabınıza bağlı şirketi ve erişiminizi doğrulayarak devam edin.</p>
 {error&&<p role="alert" className="rounded-xl bg-amber-50 p-4">{error}</p>}
 {busy&&<p role="status">Şirket ve yetkileriniz doğrulanıyor…</p>}
 {!busy&&pending&&<button className="min-h-11 rounded-xl bg-blue-700 px-4 text-white" onClick={()=>void choose(pending)}>Doğrulamayı yeniden dene</button>}
 {!busy&&<button className="min-h-11 rounded-xl border px-4" onClick={()=>void load()}>Şirket bilgisini yenile</button>}
 {choices&&company?.status==='ready'&&!pending&&<section className="rounded-xl border p-4">
 <h2 className="font-semibold">{company.membership.name}</h2>
 <p className="mt-1 text-sm text-slate-600">{roles[company.membership.role]}</p>
 <button disabled={busy} className="mt-4 min-h-11 rounded-xl bg-blue-700 px-4 text-white disabled:opacity-50" onClick={()=>void choose({userId:choices.userId,tenantId:company.membership.tenantId,membershipVersion:company.membership.version,commandId:crypto.randomUUID(),expectedVersion:choices.selectionVersion})}>Şirketime devam et</button>
 </section>}
 {company?.status==='missing'&&<p>Hesabınıza bağlı şirket bulunamadı. Şirket yöneticinizden davet isteyin.</p>}
 {company?.status==='ambiguous'&&<p role="alert">Hesabınızda birden fazla eski şirket bağlantısı var ve kullanılacak şirket belirli değil. Şirket bağlantınızı düzenlemesi için platform yöneticinize başvurun.</p>}
 </main>;
}
