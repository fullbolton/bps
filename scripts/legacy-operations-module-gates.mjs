import {readFileSync,writeFileSync} from 'node:fs';
import {source} from './talent-module-gates.mjs';
import {withOperationsHistory} from './helpers/operations-function-history.mjs';
export const targets=[
 ['ops_mutate','20260910000100_candidate_company_operations.sql','write',true],
 ['ops_import_locations','20260910000100_candidate_company_operations.sql','write',true],
 ['ops_board','20260909000800_attendance.sql','read',true],
 ['ops_week','20260909000500_weekly_operations.sql','read',false],
 ['ops_attendance_week','20260909001000_attendance_week.sql','read',false],
 ['ops_directory','20260909001200_directory_activation.sql','read',false],
 ['ops_idp_list','20260924000300_idp_request_context.sql','read',true],
];
export const entries=targets.map(([name,file,mode,definer])=>{
 const e=withOperationsHistory(source(name,file,mode));
 return {...e,definer,guard:mode==='write'?"\n PERFORM public.workspace_require_module_write_v1(public.current_user_verified_tenant(),ARRAY['staffing']);\n":"\n IF NOT public.workspace_module_enabled_v1('staffing') THEN RAISE EXCEPTION 'MODULE_DISABLED' USING ERRCODE='BM001';END IF;\n"};
});
export const tables=['ops_locations','ops_workers','ops_daily_requests','ops_assignments'];
const q=s=>"'"+s.replaceAll("'","''")+"'";
export const migrationUrl=new URL('../supabase/migrations/20261005002400_legacy_operations_module_gates.sql',import.meta.url);
export function render(){return `-- Existing invoker/definer identities and business scopes remain unchanged.
BEGIN;
SET LOCAL lock_timeout='15s';
LOCK TABLE public.ops_locations,public.ops_workers,public.ops_daily_requests,public.ops_assignments IN ACCESS EXCLUSIVE MODE;
DO $patch$
DECLARE item record;target regprocedure;original text;definition text;updated text;table_name text;
BEGIN
 FOREACH table_name IN ARRAY ARRAY['ops_locations','ops_workers','ops_daily_requests','ops_assignments'] LOOP
  IF NOT EXISTS(SELECT FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_attribute a ON a.attrelid=c.oid WHERE n.nspname='public' AND c.relname=table_name AND c.relkind='r' AND c.relrowsecurity AND a.attname='tenant_id' AND a.atttypid='uuid'::regtype AND a.attnotnull AND NOT a.attisdropped) THEN RAISE EXCEPTION 'OPS_MODULE_TABLE_DRIFT: %',table_name;END IF;
 END LOOP;
 FOR item IN SELECT * FROM (VALUES
${entries.map(e=>` (${q(e.signature)},${q(e.hash)},${q(e.guard)},${q(e.anchor)},${e.definer})`).join(',\n')}
 ) AS entries(signature,hash,guard,anchor,definer) LOOP
  target:=to_regprocedure(item.signature);
  IF target IS NULL OR NOT EXISTS(SELECT FROM pg_proc p JOIN pg_language l ON l.oid=p.prolang WHERE p.oid=target AND p.prosecdef=item.definer AND l.lanname='plpgsql') THEN RAISE EXCEPTION 'OPS_LEGACY_SIGNATURE_DRIFT: %',item.signature;END IF;
  SELECT prosrc INTO original FROM pg_proc WHERE oid=target;
  IF encode(sha256(convert_to(original,'UTF8')),'hex')<>item.hash THEN RAISE EXCEPTION 'OPS_LEGACY_BODY_DRIFT: %',item.signature;END IF;
  IF NOT has_function_privilege('authenticated',target,'EXECUTE') THEN RAISE EXCEPTION 'OPS_LEGACY_ACL_DRIFT';END IF;
  definition:=pg_get_functiondef(target);
  IF strpos(original,item.anchor)=0 OR strpos(definition,original)=0 THEN RAISE EXCEPTION 'OPS_LEGACY_ANCHOR_DRIFT';END IF;
  updated:=overlay(original placing item.anchor||item.guard from strpos(original,item.anchor) for length(item.anchor));
  EXECUTE replace(definition,original,updated);
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,service_role',target);
  IF has_function_privilege('anon',target,'EXECUTE') OR has_function_privilege('service_role',target,'EXECUTE') THEN RAISE EXCEPTION 'OPS_LEGACY_INHERITED_ACL';END IF;
 END LOOP;
END $patch$;
${tables.map(t=>`CREATE POLICY ${t}_module_read_v1 ON public.${t} AS RESTRICTIVE FOR SELECT TO authenticated
USING(tenant_id=public.current_user_verified_tenant() AND (SELECT public.workspace_module_enabled_v1('staffing')));`).join('\n')}
COMMIT;
`;}
if(process.argv[1]&&new URL('file://'+process.argv[1]).href===import.meta.url){
 if(process.argv.includes('--check')){if(readFileSync(migrationUrl,'utf8')!==render())throw Error('Legacy operations migration drift');}
 else writeFileSync(migrationUrl,render());
}
