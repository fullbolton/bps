'use client';
// Installed only in the disposable acceptance snapshot, never a product route.
import {useEffect} from 'react';
import RandevularPage from '@/app/(main)/randevular/page';
import {createClient} from '@/lib/supabase/client';
import {useAuth} from '@/context/AuthContext';
export default function AppointmentScopeWorkspace(){
 const {role}=useAuth();
 useEffect(()=>{
  const refresh=()=>{void createClient().auth.refreshSession();};
  window.addEventListener('bps-qa-refresh-auth',refresh);
  return ()=>window.removeEventListener('bps-qa-refresh-auth',refresh);
 },[]);
 return <><p data-testid="acceptance-role">{role}</p><RandevularPage/></>;
}
