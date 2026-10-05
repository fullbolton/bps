import {renderPatches} from './helpers/hotfix-module-compatibility.mjs';
import {readFileSync,writeFileSync} from 'node:fs';
import {withOperationsHistory} from './helpers/operations-function-history.mjs';
const sql=readFileSync(new URL('../supabase/migrations/20260909000800_attendance.sql',import.meta.url),'utf8');
const start=sql.indexOf('CREATE FUNCTION public.ops_record_attendance('),bodyStart=sql.indexOf('AS $$',start)+5,end=sql.indexOf('$$;',bodyStart);
if(start<0||bodyStart<5||end<bodyStart)throw Error('Attendance source drift');
export const entry=withOperationsHistory({signature:'public.ops_record_attendance(uuid,uuid,uuid,uuid,integer,text)',body:sql.slice(bodyStart,end),declaration:sql.slice(start,end+3)});
const once=(text,from,to)=>{if(text.split(from).length!==2)throw Error('Attendance patch anchor drift');return text.replace(from,()=>to);};
export let body=once(entry.body,'v_request uuid;','v_request uuid; v_lifecycle text;');
body=once(body,'PERFORM 1 FROM public.ops_daily_requests WHERE id=v_request AND tenant_id=p_tenant_id FOR UPDATE;','SELECT lifecycle INTO v_lifecycle FROM public.ops_daily_requests WHERE id=v_request AND tenant_id=p_tenant_id FOR UPDATE;');
body=once(body,'  IF v_assignment.work_date>',`  IF v_assignment.removed_at IS NOT NULL OR v_lifecycle IS DISTINCT FROM 'active' THEN
   RAISE EXCEPTION 'OPS_ATTENDANCE_CLOSED';
  END IF;
  IF v_assignment.work_date>`);
export const migrationUrl=new URL('../supabase/migrations/20261004001100_attendance_lifecycle_guard.sql',import.meta.url);
export function render(){return "-- Reject removed and cancelled attendance without removing module guards.\n"+renderPatches([{...entry,next:body}]);}

if(process.argv[1]&&new URL('file://'+process.argv[1]).href===import.meta.url){if(process.argv.includes('--check')){if(readFileSync(migrationUrl,'utf8')!==render())throw Error('Attendance migration drift');}else writeFileSync(migrationUrl,render());}
