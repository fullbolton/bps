import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
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
const q=s=>"'"+s.replaceAll("'","''")+"'";
export const migrationUrl=new URL('../supabase/migrations/20261004001100_attendance_lifecycle_guard.sql',import.meta.url);
export function render(){return `-- Preserve deployed shift-overlap logic; reject new attendance on removed/cancelled work.
BEGIN;
SET LOCAL lock_timeout='15s';
DO $patch$
DECLARE target regprocedure:=to_regprocedure(${q(entry.signature)});original text;definition text;
BEGIN
 IF target IS NULL THEN RAISE EXCEPTION 'ATTENDANCE_SIGNATURE_MISSING';END IF;
 SELECT prosrc INTO original FROM pg_proc WHERE oid=target;
 IF encode(sha256(convert_to(original,'UTF8')),'hex')<>${q(createHash('sha256').update(entry.body).digest('hex'))} THEN RAISE EXCEPTION 'ATTENDANCE_SOURCE_DRIFT';END IF;
 definition:=pg_get_functiondef(target);
 IF strpos(definition,original)=0 THEN RAISE EXCEPTION 'ATTENDANCE_DEFINITION_DRIFT';END IF;
 EXECUTE replace(definition,original,${q(body)});
END $patch$;
NOTIFY pgrst,'reload schema';
COMMIT;
`;}
if(process.argv[1]&&new URL('file://'+process.argv[1]).href===import.meta.url){if(process.argv.includes('--check')){if(readFileSync(migrationUrl,'utf8')!==render())throw Error('Attendance migration drift');}else writeFileSync(migrationUrl,render());}
