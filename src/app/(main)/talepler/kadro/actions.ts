'use server';
import {createServerSupabaseClient} from '@/lib/supabase/server';
import {saveFixedRoster,loadFixedRoster,createRosterLeave,loadRosterHistory} from '@/lib/services/fixed-roster';
import {rosterRejectionIsFinal} from '@/lib/operations/roster-pending';
import {fixedRosterError} from '@/lib/operations/fixed-roster';
import {pilotError} from '@/lib/services/daily-operations';
import type {CommandScope} from '@/lib/operations/pending-commands';
import type {PilotResult} from '@/lib/operations/pilot-types';
type MutationResult<T>={ok:true;data:T}|{ok:false;message:string;rejected:boolean};
async function context(){
  if(process.env.BPS_FIXED_ROSTER_ENABLED!=='true'||process.env.BPS_DAILY_OPERATIONS_ENABLED!=='true')throw Error('OPS_FORBIDDEN');
  const client=await createServerSupabaseClient(12000);
  const {data,error}=await client.auth.getUser();if(error)throw error;if(!data.user)throw Error('OPS_UNAUTHENTICATED');
  return client;
}
function message(e:unknown){return pilotError(e,fixedRosterError(e));}
export async function rosterListAction(scope:CommandScope,query:unknown):Promise<PilotResult<Awaited<ReturnType<typeof loadFixedRoster>>>>{
  try{return {ok:true,data:await loadFixedRoster(await context(),scope,query)};}catch(e){return {ok:false,message:message(e)};}
}
export async function rosterSaveAction(scope:CommandScope,commandId:string,input:unknown):Promise<MutationResult<Awaited<ReturnType<typeof saveFixedRoster>>>>{
  try{return {ok:true,data:await saveFixedRoster(await context(),scope,commandId,input)};}catch(e){return {ok:false,message:message(e),rejected:rosterRejectionIsFinal(e)};}
}
export async function rosterLeaveAction(scope:CommandScope,commandId:string,input:unknown):Promise<MutationResult<Awaited<ReturnType<typeof createRosterLeave>>>>{
  try{return {ok:true,data:await createRosterLeave(await context(),scope,commandId,input)};}catch(e){return {ok:false,message:message(e),rejected:rosterRejectionIsFinal(e)};}
}
export async function rosterHistoryAction(scope:CommandScope,id:string,offset:number):Promise<PilotResult<Awaited<ReturnType<typeof loadRosterHistory>>>>{
  try{return {ok:true,data:await loadRosterHistory(await context(),scope,id,offset)};}catch(e){return {ok:false,message:message(e)};}
}
