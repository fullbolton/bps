import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {entries} from './talent-module-gates.mjs';
const entry=entries.find(e=>e.name==='talent_save_person');
export const signature=entry.signature;
// Include the preceding, unapplied module guard in the expected body.
export const previous=entry.body.replace(entry.anchor,()=>entry.anchor+entry.guard);
const replaceOnce=(text,from,to)=>{if(text.split(from).length!==2)throw Error('Projection anchor drift');return text.replace(from,()=>to);};
export const body=replaceOnce(previous,
 "  IF v_old.revision<>p_expected_revision THEN RAISE EXCEPTION 'TALENT_CONFLICT'; END IF;",
 `  IF v_old.revision<>p_expected_revision THEN RAISE EXCEPTION 'TALENT_CONFLICT'; END IF;
  -- The existing talent write barrier already holds the tenant config FOR SHARE.
  -- Read under that fence: do not acquire config after profile/person locks.
  IF v_worker IS NOT NULL AND v_old.name IS DISTINCT FROM v_name
   AND NOT (public.current_workspace_modules_v1()->'modules'->>'staffing')::boolean THEN
   RAISE EXCEPTION 'TALENT_LINKED_NAME_MODULE_DISABLED' USING ERRCODE='BM001';
  END IF;`);
const q=s=>"'"+s.replaceAll("'","''")+"'";
export const migrationUrl=new URL('../supabase/migrations/20261004000200_talent_linked_name_gate.sql',import.meta.url);
export function render(){return `-- Linked names cannot mutate disabled staffing through talent. Other fields remain editable.
BEGIN;
SET LOCAL lock_timeout='15s';
DO $patch$
DECLARE target regprocedure:=to_regprocedure(${q(signature)});original text;definition text;
BEGIN
 IF target IS NULL OR NOT EXISTS(SELECT FROM pg_proc WHERE oid=target AND prosecdef AND provolatile='v') THEN RAISE EXCEPTION 'TALENT_LINKED_NAME_SIGNATURE_DRIFT';END IF;
 SELECT prosrc INTO original FROM pg_proc WHERE oid=target;
 IF encode(sha256(convert_to(original,'UTF8')),'hex')<>${q(createHash('sha256').update(previous).digest('hex'))} THEN RAISE EXCEPTION 'TALENT_LINKED_NAME_BODY_DRIFT';END IF;
 definition:=pg_get_functiondef(target);
 IF strpos(definition,original)=0 THEN RAISE EXCEPTION 'TALENT_LINKED_NAME_ANCHOR_DRIFT';END IF;
 EXECUTE replace(definition,original,${q(body)});
END $patch$;
COMMIT;
`;}
if(process.argv[1]&&new URL('file://'+process.argv[1]).href===import.meta.url){if(process.argv.includes('--check')){if(readFileSync(migrationUrl,'utf8')!==render())throw Error('Talent linked-name migration drift');}else writeFileSync(migrationUrl,render());}
