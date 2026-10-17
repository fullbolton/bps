"use client";
// Synthetic local acceptance route, installed temporarily by the browser harness.
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { loadCurrentWorkspaceModules } from '@/lib/services/workspace-modules';
import { createModuleChangeAttempt, type ModuleChangePayload } from '@/lib/modules/change-attempt';
import type { WorkspaceModuleContext } from '@/lib/modules/context';
import ModuleChangePreview from '@/app/(main)/ayarlar/ModuleChangePreview';
export default function BrowserModuleAcceptance() {
 const [context,setContext]=useState<WorkspaceModuleContext|null>(null);
 const [error,setError]=useState('');
 async function refresh() {
  const client=createClient();const {data,error}=await client.auth.getUser();
  if(error||!data.user)throw Error('LOCAL_AUTH_REQUIRED');
  const value=await loadCurrentWorkspaceModules(client,{actorId:data.user.id,tenantId:'00000000-0000-4000-8000-000000000001',role:'yonetici'});
  setContext(value);
 }
 useEffect(()=>{void refresh().catch(e=>setError(e instanceof Error?e.message:'LOCAL_ERROR'));},[]);
 async function transport(payload:ModuleChangePayload) {
  if(window.location.hostname!=='127.0.0.1'||process.env.NEXT_PUBLIC_SUPABASE_URL!=='http://127.0.0.1:3061')throw Error('LOCAL_ONLY');
  const {data,error}=await createClient().auth.getSession();
  if(error||!data.session)throw Error('LOCAL_AUTH_REQUIRED');
  const response=await fetch('http://127.0.0.1:3061/rest/v1/rpc/change_workspace_modules_v1',{method:'POST',headers:{Authorization:`Bearer ${data.session.access_token}`,'Content-Type':'application/json'},body:JSON.stringify(payload)});
  if(!response.ok)throw Error('LOCAL_COMMAND_FAILED');return response.json();
 }
 return <main className="mx-auto max-w-3xl space-y-4 p-6"><h1>Yerel modül kayıt kabulü</h1>
  {error&&<p role="alert">Yerel oturum açılamadı: {error}</p>}
  {context?<><p>Güncel sürüm: {context.configRevision}</p><ModuleChangePreview key={`${context.actorId}:${context.tenantId}:${context.membershipVersion}:${context.selectionVersion}:${context.configRevision}`} context={context} commit={{prepare:(ctx,modules)=>createModuleChangeAttempt(ctx,crypto.randomUUID(),modules),transport,refresh}} /></>:<p>Yerel ayarlar yükleniyor…</p>}
 </main>;
}
