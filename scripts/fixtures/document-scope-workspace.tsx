'use client';
// Disposable acceptance snapshot only; not a product route.
import {useEffect} from 'react';
import DocumentsPage from '@/app/(main)/evraklar/page';
import {createClient} from '@/lib/supabase/client';
import {useAuth} from '@/context/AuthContext';
export default function DocumentScopeWorkspace(){
 const {role}=useAuth();
 useEffect(()=>{const refresh=()=>{void createClient().auth.refreshSession();};window.addEventListener('bps-qa-refresh-auth',refresh);return()=>window.removeEventListener('bps-qa-refresh-auth',refresh);},[]);
 return <><p data-testid="acceptance-role">{role}</p><DocumentsPage/></>;
}
