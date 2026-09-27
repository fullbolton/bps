'use client';
import {useEffect,useState} from 'react';
import {useAuth} from '@/context/AuthContext';
import {createClient} from '@/lib/supabase/client';
/** Resolve membership on the server; local test JWT layout is not the production contract. */
export function useVerifiedTenant(refresh=0){
 const {user,role}=useAuth();
 const [state,setState]=useState<{identity:typeof user;tenantId:string|null;done:boolean}>({identity:null,tenantId:null,done:false});
 useEffect(()=>{let cancelled=false;setState({identity:user,tenantId:null,done:false});
  if(!user){setState({identity:user,tenantId:null,done:true});return;}
  void(async()=>{try{const {data,error}=await createClient().rpc('current_user_verified_tenant');if(!cancelled)setState({identity:user,tenantId:!error&&typeof data==='string'?data:null,done:true});}catch{if(!cancelled)setState({identity:user,tenantId:null,done:true});}})();
  return()=>{cancelled=true;};
 },[user,role,refresh]);
 return {tenantId:state.identity===user?state.tenantId:null,loading:state.identity!==user||!state.done};
}
