'use client';
import {useEffect,useRef,useState} from 'react';
import WorkspaceCreateForm from './WorkspaceCreateForm';
import type {AdminTenantRow} from '@/lib/services/platform-admin';
import type {ManagedMembership,MembershipCommand} from '@/lib/workspace-memberships';
import type {WorkspaceAdminPage,WorkspaceAdminUser} from '@/lib/workspace-admin';
import type {WorkspaceRole} from '@/lib/auth-workspace';
import {workspaceAdminUsersAction,workspaceAdminMembershipsAction,workspaceAdminMutationAction} from './membership-actions';
const roles:Record<WorkspaceRole,string>={yonetici:'Yönetici',operasyon:'Operasyon',ik:'İnsan kaynakları',muhasebe:'Muhasebe',goruntuleyici:'Görüntüleyici',partner:'Partner'};
const field='min-h-11 rounded-xl border bg-white px-3 text-sm';
const button=field+' disabled:opacity-50';
export default function WorkspaceAdminClient({tenants:initialTenants,loadError}:{tenants:AdminTenantRow[];loadError:string|null}){
 const [tenants,setTenants]=useState(initialTenants);
 const [page,setPage]=useState<WorkspaceAdminPage|null>(null),[query,setQuery]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[selected,setSelected]=useState<WorkspaceAdminUser|null>(null);
 const flight=useRef(false),alive=useRef(true);
 async function load(offset=0,search=query){
  if(flight.current)return;flight.current=true;setBusy(true);setError('');setPage(null);
  try{const r=await workspaceAdminUsersAction(offset,search);if(!alive.current)return;if(!r.ok)setError(r.error);else setPage(r.data);}
  catch{if(alive.current)setError('Kullanıcılar yüklenemedi. Yeniden deneyin.');}
  finally{flight.current=false;if(alive.current)setBusy(false);}
 }
 useEffect(()=>{alive.current=true;if(!loadError)void load();return()=>{alive.current=false;};},[]);
 if(loadError)return <p role="alert">{loadError} Sayfayı yeniden yükleyin.</p>;
 if(selected)return <MembershipEditor key={selected.id} user={selected} tenants={tenants} onClose={()=>{setSelected(null);void load(page?.offset??0,page?.query??query);}}/>;
 return <section className="space-y-4"><h1 className="text-xl font-semibold">Şirket erişimleri</h1><p className="text-sm text-slate-600">Kişilerin hangi şirketlerde çalışabileceğini ve her şirketteki rolünü yönetin.</p>
 <WorkspaceCreateForm onTenants={setTenants}/>
 <form className="flex flex-wrap gap-2" onSubmit={e=>{e.preventDefault();void load();}}><label className="flex flex-col gap-1 text-sm">İsim veya e-posta<input className={field} value={query} maxLength={160} onChange={e=>setQuery(e.target.value)}/></label><button className={button} disabled={busy}>Kullanıcıları göster</button></form>
 {busy&&<p role="status">Kullanıcılar yükleniyor…</p>}{error&&<p role="alert">{error}</p>}
 {page&&<><p className="text-sm">{page.total} kullanıcı · Sayfa {Math.floor(page.offset/50)+1}</p><ul className="space-y-3">{page.users.map(u=><li key={u.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4"><div><h2 className="font-medium">{u.name||u.email||'İsimsiz kullanıcı'}</h2><p className="break-all text-sm">{u.email}</p><p className="text-xs text-slate-600">{u.membershipCount} şirket üyeliği{u.platformAdmin?' · Platform yöneticisi':''}</p></div><button className={button} onClick={()=>setSelected(u)}>Şirket erişimlerini düzenle</button></li>)}</ul>{!page.users.length&&<p>Bu aramaya uyan kullanıcı yok.</p>}<div className="flex gap-2"><button className={button} disabled={busy||!page.offset} onClick={()=>void load(Math.max(0,page.offset-50),page.query)}>Önceki</button><button className={button} disabled={busy||page.offset+50>=page.total||page.offset>=1000000} onClick={()=>void load(page.offset+50,page.query)}>Sonraki</button></div></>}
 </section>;
}
function MembershipEditor({user,tenants,onClose}:{user:WorkspaceAdminUser;tenants:AdminTenantRow[];onClose:()=>void}){
 const [memberships,setMemberships]=useState<ManagedMembership[]|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[tenantId,setTenantId]=useState(''),[role,setRole]=useState<WorkspaceRole>('goruntuleyici'),[proposal,setProposal]=useState<MembershipCommand|null>(null);
 const flight=useRef(false),alive=useRef(true);
 async function load(){
  if(flight.current)return;flight.current=true;setBusy(true);setError('');setProposal(null);setMemberships(null);
  try{const r=await workspaceAdminMembershipsAction(user.id);if(!alive.current)return;if(!r.ok)setError(r.error);else setMemberships(r.data);}
  catch{if(alive.current)setError('Üyelikler yüklenemedi. Yeniden deneyin.');}
  finally{flight.current=false;if(alive.current)setBusy(false);}
 }
 useEffect(()=>{alive.current=true;void load();return()=>{alive.current=false;};},[]);
 async function save(){
  if(!proposal||flight.current||!memberships)return;flight.current=true;setBusy(true);setError('');setNotice('');
  const command=proposal;
  // Never keep writable rows after a result whose receipt may have been lost.
  setMemberships(null);setProposal(null);
  try{
   const r=await workspaceAdminMutationAction(command);if(!alive.current)return;
   if(!r.ok)setError(r.error);
   else{
    setNotice('Şirket erişimi güncellendi.');
    try{const fresh=await workspaceAdminMembershipsAction(user.id);if(!alive.current)return;if(fresh.ok){setMemberships(fresh.data);setTenantId('');}else setError('Değişiklik kaydedildi ancak güncel üyelikler yüklenemedi. Üyelikleri yeniden yükleyin.');}
    catch{if(alive.current)setError('Değişiklik kaydedildi ancak güncel üyelikler yüklenemedi. Üyelikleri yeniden yükleyin.');}
   }
  }
  catch{if(alive.current)setError('Yanıt alınamadı; değişiklik kaydedilmiş olabilir. Yeni işlemden önce üyelikleri yeniden yükleyin.');}
  finally{flight.current=false;if(alive.current)setBusy(false);}
 }
 const available=tenants.filter(t=>!memberships?.some(m=>m.tenantId===t.tenant_id));
 const selectedName=tenants.find(t=>t.tenant_id===proposal?.tenantId)?.name??memberships?.find(m=>m.tenantId===proposal?.tenantId)?.name;
 return <section className="space-y-4"><button className={button} disabled={busy} onClick={onClose}>Kullanıcılara dön</button><h1 className="text-xl font-semibold">{user.name||user.email} · Şirket erişimleri</h1><p className="text-sm text-slate-600">Her şirketin rolü ayrıdır. Bir üyeliği değiştirmek diğer şirketlerdeki erişimi değiştirmez. Platform yöneticiliği bu ekrandan değiştirilmez.</p>
 {error&&<p role="alert" className="rounded-xl bg-amber-50 p-3">{error}</p>}{notice&&<p role="status" className="rounded-xl bg-green-50 p-3">{notice}</p>}{busy&&<p role="status">İşlem sürüyor…</p>}
 <button className={button} disabled={busy} onClick={()=>void load()}>Üyelikleri yeniden yükle</button>
 {memberships&&<><ul className="space-y-3">{memberships.map(m=><li key={m.tenantId} className="space-y-2 rounded-xl border p-4"><h2 className="font-semibold">{m.name}</h2><p className="text-sm">Şu anki rol: {roles[m.role]}</p><label className="block text-sm">Yeni rol<select className={field+' ml-2'} disabled={busy||!!proposal} value={m.role} onChange={e=>setProposal({action:'change_role',userId:user.id,tenantId:m.tenantId,role:e.target.value as WorkspaceRole,expectedRole:m.role,expectedVersion:m.version})}>{Object.entries(roles).map(([v,label])=><option key={v} value={v}>{label}</option>)}</select></label><button className={button+' text-red-700'} disabled={busy||!!proposal} onClick={()=>setProposal({action:'remove',userId:user.id,tenantId:m.tenantId,expectedRole:m.role,expectedVersion:m.version})}>Bu şirketteki erişimi kaldır</button></li>)}</ul>
 {!memberships.length&&<p>Bu kişinin henüz şirket üyeliği yok.</p>}
 {available.length>0&&<form className="space-y-3 rounded-xl border p-4" onSubmit={e=>{e.preventDefault();if(available.some(t=>t.tenant_id===tenantId))setProposal({action:'add',userId:user.id,tenantId,role});}}><h2 className="font-semibold">Başka bir şirkete erişim ekle</h2><fieldset disabled={busy||!!proposal} className="flex flex-wrap gap-3"><label className="text-sm">Şirket<select required className={field+' ml-2'} value={tenantId} onChange={e=>setTenantId(e.target.value)}><option value="">Şirket seçin</option>{available.map(t=><option key={t.tenant_id} value={t.tenant_id}>{t.name}</option>)}</select></label><label className="text-sm">Rol<select className={field+' ml-2'} value={role} onChange={e=>setRole(e.target.value as WorkspaceRole)}>{Object.entries(roles).map(([v,label])=><option key={v} value={v}>{label}</option>)}</select></label><button className={button} disabled={!available.some(t=>t.tenant_id===tenantId)}>Erişimi gözden geçir</button></fieldset></form>}
 </>}
 {proposal&&<section aria-label="Üyelik değişikliği onayı" className="space-y-3 rounded-xl border border-blue-200 bg-blue-50 p-4"><h2 className="font-semibold">{selectedName}</h2><p>{proposal.action==='remove'?'Bu kişinin seçili şirkete erişimi kaldırılacak. Diğer şirket üyelikleri korunacak.':`Bu şirketteki rolü ${roles[proposal.role]} olacak.`}</p>{proposal.action==='remove'&&<p className="text-sm">Kişiye atanmış açık görevler varsa önce o şirketin görevlerini devredin.</p>}<div className="flex gap-2"><button className={button} disabled={busy} onClick={()=>setProposal(null)}>Vazgeç</button><button className={button+' bg-blue-700 text-white'} disabled={busy} onClick={()=>void save()}>Değişikliği kaydet</button></div></section>}
 </section>;
}
