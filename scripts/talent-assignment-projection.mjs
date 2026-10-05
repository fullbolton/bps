import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {entries} from './talent-module-gates.mjs';
const entry=entries.find(e=>e.name==='talent_person_detail');
export const signature=entry.signature;
// Include the preceding, unapplied module guard in the expected body.
export const previous=entry.body.replace(entry.anchor,()=>entry.anchor+entry.guard);
const replaceOnce=(text,from,to)=>{if(text.split(from).length!==2)throw Error('Projection anchor drift');return text.replace(from,()=>to);};
export let body=replaceOnce(previous,'v_assignments jsonb;','v_assignments jsonb; v_staffing boolean;');
body=replaceOnce(body,' SELECT coalesce(jsonb_agg(to_jsonb(a)'," v_staffing:=(public.current_workspace_modules_v1()->'modules'->>'staffing')::boolean;\n IF v_staffing IS NULL THEN RAISE EXCEPTION 'MODULE_CONFIG_MISSING' USING ERRCODE='55000';END IF;\n v_assignments:='[]'::jsonb;\n IF v_staffing THEN\n SELECT coalesce(jsonb_agg(to_jsonb(a)");
body=replaceOnce(body,' ) a;',' ) a;\n END IF;');
body=replaceOnce(body,"'assignments',v_assignments,","'assignments',v_assignments,'staffingAvailable',v_staffing,");
const q=s=>"'"+s.replaceAll("'","''")+"'";
export const migrationUrl=new URL('../supabase/migrations/20261005002500_talent_assignment_projection.sql',import.meta.url);
export function render(){return `-- Talent remains usable when staffing is disabled; assignment data is withheld explicitly.
-- Link identity on the talent card is retained, not misrepresented as an unlinked person.
BEGIN;
SET LOCAL lock_timeout='15s';
DO $patch$
DECLARE target regprocedure:=to_regprocedure(${q(signature)});original text;definition text;
BEGIN
 IF target IS NULL OR NOT EXISTS(SELECT FROM pg_proc WHERE oid=target AND prosecdef AND provolatile='s') THEN RAISE EXCEPTION 'TALENT_PROJECTION_SIGNATURE_DRIFT';END IF;
 SELECT prosrc INTO original FROM pg_proc WHERE oid=target;
 IF encode(sha256(convert_to(original,'UTF8')),'hex')<>${q(createHash('sha256').update(previous).digest('hex'))} THEN RAISE EXCEPTION 'TALENT_PROJECTION_BODY_DRIFT';END IF;
 definition:=pg_get_functiondef(target);
 IF strpos(definition,original)=0 THEN RAISE EXCEPTION 'TALENT_PROJECTION_ANCHOR_DRIFT';END IF;
 EXECUTE replace(definition,original,${q(body)});
END $patch$;
COMMIT;
`;}
if(process.argv[1]&&new URL('file://'+process.argv[1]).href===import.meta.url){if(process.argv.includes('--check')){if(readFileSync(migrationUrl,'utf8')!==render())throw Error('Talent assignment projection drift');}else writeFileSync(migrationUrl,render());}
