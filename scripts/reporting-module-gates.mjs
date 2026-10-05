import {internalAcl} from './helpers/module-internal-acl.mjs';
import {withReleasedHotfix} from './helpers/released-hotfix-history.mjs';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {source} from './talent-module-gates.mjs';
const foundation='20260928000100_project_reporting_foundation.sql',imports='20260928000200_project_reporting_actual_import.sql',files='20260928000500_project_reporting_source_files.sql';
export const targets=[['reporting_project_execute',foundation,'write'],['reporting_project_list',foundation,'read'],['reporting_project_detail',foundation,'read'],['reporting_person_code_set',imports,'write'],['reporting_import_prepare',imports,'write'],['reporting_import_finish',imports,'write'],['reporting_import_list',imports,'read'],['reporting_import_people',imports,'read'],['reporting_import_read',imports,'read'],['reporting_monthly_report','20260928000300_project_reporting_monthly_report.sql','read'],['reporting_work_details','20260928000400_project_reporting_work_details.sql','read'],['reporting_source_file',files,'write']];
export const entries=targets.map(t=>{const e=withReleasedHotfix(source(...t));return {...e,guard:`\n PERFORM public.reporting_assert_scope(p_actor,p_tenant,${e.mode==='write'});\n PERFORM public.workspace_require_module_${e.mode}_v1(p_tenant,ARRAY['reporting']);\n`};});
const fileSql=readFileSync(new URL('../supabase/migrations/'+files,import.meta.url),'utf8');
export const storageOriginal=fileSql.split("LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$")[1].split('$$;')[0];
export const storageBody=`
DECLARE context jsonb;
BEGIN
 context:=public.current_workspace_modules_v1();
 IF NOT (context->'modules'->>'reporting')::boolean THEN RETURN false;END IF;
 IF p_write THEN PERFORM public.workspace_require_module_write_v1((context->>'tenantId')::uuid,ARRAY['reporting']);END IF;
 RETURN (${storageOriginal.trim()});
END
`;
const q=s=>"'"+s.replaceAll("'","''")+"'";
export const migrationUrl=new URL('../supabase/migrations/20261005002800_reporting_module_gates.sql',import.meta.url);
export function render(){return `-- Reporting RPC and project-sources Storage gates. Not the module-toggle release.
BEGIN;
SET LOCAL lock_timeout='15s';
DO $patch$
DECLARE item record;target regprocedure;original text;definition text;role_name text;
BEGIN
${internalAcl(['public.reporting_assert_scope(uuid,uuid,boolean)', 'public.reporting_import_validate(uuid,uuid,date,text,jsonb)'],'REPORT')}
 IF EXISTS(SELECT FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname LIKE 'reporting_%' AND p.proargnames[1] IN ('p_actor','p_actor_id') AND has_function_privilege('authenticated',p.oid,'EXECUTE') AND p.oid NOT IN (${entries.map(e=>`coalesce(to_regprocedure(${q(e.signature)}),0::oid)`).join(',')})) THEN RAISE EXCEPTION 'REPORT_MODULE_UNREVIEWED_ENDPOINT';END IF;
 FOR item IN SELECT * FROM (VALUES
${entries.map(e=>`(${q(e.signature)},${q(e.hash)},${q(e.anchor)},${q(e.guard)})`).join(',\n')}
 ) AS entries(signature,hash,anchor,guard) LOOP
  target:=to_regprocedure(item.signature);
  IF target IS NULL OR NOT EXISTS(SELECT FROM pg_proc p JOIN pg_language l ON l.oid=p.prolang WHERE p.oid=target AND p.prosecdef AND l.lanname='plpgsql') THEN RAISE EXCEPTION 'REPORT_MODULE_SIGNATURE_DRIFT';END IF;
  SELECT prosrc INTO original FROM pg_proc WHERE oid=target;
  IF encode(sha256(convert_to(original,'UTF8')),'hex')<>item.hash THEN RAISE EXCEPTION 'REPORT_MODULE_BODY_DRIFT: %',item.signature;END IF;
  IF NOT has_function_privilege('authenticated',target,'EXECUTE') THEN RAISE EXCEPTION 'REPORT_MODULE_ACL_DRIFT';END IF;
  definition:=pg_get_functiondef(target);
  IF strpos(original,item.anchor)=0 OR strpos(definition,original)=0 THEN RAISE EXCEPTION 'REPORT_MODULE_ANCHOR_DRIFT';END IF;
  EXECUTE replace(definition,original,overlay(original placing item.anchor||item.guard from strpos(original,item.anchor) for length(item.anchor)));
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,service_role',target);
  FOREACH role_name IN ARRAY ARRAY['anon','service_role'] LOOP
   IF has_function_privilege(role_name,target,'EXECUTE') THEN RAISE EXCEPTION 'REPORT_MODULE_INHERITED_ACL';END IF;
  END LOOP;
 END LOOP;
 target:=to_regprocedure('public.reporting_source_access(text,boolean)');
 IF target IS NULL OR NOT EXISTS(SELECT FROM pg_proc p JOIN pg_language l ON l.oid=p.prolang WHERE p.oid=target AND p.prosecdef AND p.provolatile='s' AND l.lanname='sql') THEN RAISE EXCEPTION 'REPORT_STORAGE_SIGNATURE_DRIFT';END IF;
 SELECT prosrc INTO original FROM pg_proc WHERE oid=target;
 IF encode(sha256(convert_to(original,'UTF8')),'hex')<>${q(createHash('sha256').update(storageOriginal).digest('hex'))} THEN RAISE EXCEPTION 'REPORT_STORAGE_BODY_DRIFT';END IF;
END $patch$;
CREATE OR REPLACE FUNCTION public.reporting_source_access(p_name text,p_write boolean) RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $storage$${storageBody}$storage$;
REVOKE ALL ON FUNCTION public.reporting_source_access(text,boolean) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.reporting_source_access(text,boolean) TO authenticated;
COMMIT;
`;}
if(process.argv[1]&&new URL('file://'+process.argv[1]).href===import.meta.url){if(process.argv.includes('--check')){if(readFileSync(migrationUrl,'utf8')!==render())throw Error('Reporting gate migration drift');}else writeFileSync(migrationUrl,render());}
