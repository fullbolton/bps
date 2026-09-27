'use server';
import {createServerSupabaseClient} from '@/lib/supabase/server';
import {listSchedules,saveSchedule,previewSchedule,generateSchedule} from '@/lib/services/recurring-schedules';
import {scheduleError} from '@/lib/operations/recurring-schedules';
import type {CommandScope} from '@/lib/operations/pending-commands';
async function context(){if(process.env.BPS_RECURRING_SCHEDULES_ENABLED!=='true'||process.env.BPS_DAILY_OPERATIONS_ENABLED!=='true')throw Error('OPS_FORBIDDEN');return createServerSupabaseClient(12000);}
function failure(e:unknown){const m=e&&typeof e==='object'&&'message'in e?String(e.message):'';return{ok:false as const,message:scheduleError(e),rejected:['SCHEDULE_WINDOW','SCHEDULE_ARCHIVED','SCHEDULE_IDENTITY','SCHEDULE_NAME','OPS_STALE_VERSION','OPS_INACTIVE_COMPANY','OPS_INACTIVE_LOCATION','OPS_SHIFT_LEGACY_REQUEST'].includes(m)||m.includes('ops_timed_request_identity')};}
export async function schedulesAction(s:CommandScope,company:string,offset:number){try{return{ok:true as const,data:await listSchedules(await context(),s,company,offset)};}catch(e){return failure(e);}}
export async function scheduleSaveAction(s:CommandScope,id:string,p:unknown){try{return{ok:true as const,data:await saveSchedule(await context(),s,id,p)};}catch(e){return failure(e);}}
export async function schedulePreviewAction(s:CommandScope,p:unknown){try{return{ok:true as const,data:await previewSchedule(await context(),s,p)};}catch(e){return failure(e);}}
export async function scheduleGenerateAction(s:CommandScope,id:string,p:unknown){try{return{ok:true as const,data:await generateSchedule(await context(),s,id,p)};}catch(e){return failure(e);}}
