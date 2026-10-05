import {renderPatches} from './helpers/hotfix-module-compatibility.mjs';
import {readFileSync,writeFileSync} from 'node:fs';
import {withOperationsHistory} from './helpers/operations-function-history.mjs';
const sql=readFileSync(new URL('../supabase/migrations/20260909002900_start_event_validation.sql',import.meta.url),'utf8');
const start=sql.indexOf('CREATE OR REPLACE FUNCTION public.ops_start_execute('),bodyStart=sql.indexOf('AS $$',start)+5,end=sql.indexOf('$$;',bodyStart);
if(start<0||bodyStart<5||end<bodyStart)throw Error('Start source drift');
export const entry=withOperationsHistory({signature:'public.ops_start_execute(uuid,uuid,uuid,uuid,integer,text,jsonb)',body:sql.slice(bodyStart,end),declaration:sql.slice(start,end+3)});
const once=(s,a,b)=>{if(s.split(a).length!==2)throw Error('Start shift anchor drift');return s.replace(a,()=>b);};
// Preserve early arrival on the work date; the actual shift end is exclusive.
export let body=once(entry.body,"OR (v_occurred AT TIME ZONE 'Europe/Istanbul')::date>r.work_date", "OR a.occupied_range IS NULL OR upper_inf(a.occupied_range) OR isempty(a.occupied_range)\n      OR (v_occurred AT TIME ZONE 'Europe/Istanbul')>=upper(a.occupied_range)");
body=once(body,"(v_occurred AT TIME ZONE 'Europe/Istanbul')::date<>r.work_date", "(v_occurred AT TIME ZONE 'Europe/Istanbul')::date<r.work_date");
body=once(body,"work_date=a.work_date AND attendance='present' AND id<>a.id", "occupied_range && a.occupied_range AND (removed_at IS NULL OR attendance='present') AND id<>a.id");
export const migrationUrl=new URL('../supabase/migrations/20261004001300_start_confirmation_shift_window.sql',import.meta.url);
export function render(){return "-- Preserve module guards while fixing overnight and disjoint shifts.\n"+renderPatches([{...entry,next:body}]);}

if(process.argv[1]&&new URL('file://'+process.argv[1]).href===import.meta.url){if(process.argv.includes('--check')){if(readFileSync(migrationUrl,'utf8')!==render())throw Error('Start shift migration drift');}else writeFileSync(migrationUrl,render());}
