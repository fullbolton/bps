// Explicit endpoint manifest. Source extraction is deliberately bounded, not a SQL parser.
// Catalog/body drift makes the generated migration fail before changing any endpoint.
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
export const targets = [
 ['talent_people_page','20260927000600_pool_query_performance.sql','read'],
 ['talent_person_detail','20260927000500_pool_merge_and_contacts.sql','read'],
 ['talent_save_person','20260915000500_talent_filters.sql','write'],
 ['talent_resolve_person_command','20260914000200_talent_people.sql','write'],
 ['talent_compare_snapshot','20260927000500_pool_merge_and_contacts.sql','read'],
 ['talent_import_status','20260914000500_talent_import_batches.sql','read'],
 ['talent_import_prepare','20260914000600_talent_import_recovery.sql','write'],
 ['talent_import_apply_row','20260927000500_pool_merge_and_contacts.sql','write'],
 ['talent_import_cancel','20260914000500_talent_import_batches.sql','write'],
 ['talent_import_recover','20260914000600_talent_import_recovery.sql','read'],
 ['talent_import_close','20260914000600_talent_import_recovery.sql','write'],
 ['talent_import_history','20260914000700_talent_import_history.sql','read'],
 ['talent_conversation_save','20260915000300_talent_conversations.sql','write'],
 ['talent_attachment_reserve','20260915000400_talent_attachments.sql','write'],
 ['talent_attachment_finish','20260915000400_talent_attachments.sql','write'],
 ['talent_attachment_list','20260927000500_pool_merge_and_contacts.sql','read'],
 ['talent_attachment_pending','20260923000300_talent_attachment_cancellation.sql','read'],
 ['talent_attachment_cancel','20260923000300_talent_attachment_cancellation.sql','write'],
 ['talent_availability_read','20260923000400_talent_availability.sql','read'],
 ['talent_availability_save','20260923000400_talent_availability.sql','write'],
 ['talent_prepare_worker','20260924000200_talent_worker_prepare.sql','write'],
 ['talent_match_source','20260927000500_pool_merge_and_contacts.sql','read'],
 ['talent_work_copy_page','20260927000500_pool_merge_and_contacts.sql','read'],
 ['talent_import_change_review','20260927000400_talent_import_undo.sql','read'],
 ['talent_import_undo_update','20260927000400_talent_import_undo.sql','write'],
 ['talent_merge_review','20260927000500_pool_merge_and_contacts.sql','read'],
 ['talent_merge_apply','20260927000500_pool_merge_and_contacts.sql','write'],
 ['talent_merge_resolve','20260927000500_pool_merge_and_contacts.sql','write'],
 ['talent_merged_availability','20260927000500_pool_merge_and_contacts.sql','read'],
 ['talent_contact_summaries','20260927000500_pool_merge_and_contacts.sql','read'],
 ['talent_shared_views_read','20260927000700_talent_shared_views.sql','read'],
 ['talent_shared_view_create','20260927000700_talent_shared_views.sql','write'],
 ['talent_shared_view_archive','20260927000700_talent_shared_views.sql','write'],
 ['talent_call_lists_read','20260927000800_talent_call_lists.sql','read'],
 ['talent_call_list_create','20260927000800_talent_call_lists.sql','write'],
 ['talent_call_list_archive','20260927000800_talent_call_lists.sql','write'],
 ['talent_call_list_edit','20260927000900_call_list_edit_and_conversation_context.sql','write'],
 ['talent_conversation_list','20260927000900_call_list_edit_and_conversation_context.sql','read'],
 ['talent_call_list_people','20260927000900_call_list_edit_and_conversation_context.sql','read'],
];
export function source(name,file,mode){
 const sql=readFileSync(new URL('../supabase/migrations/'+file,import.meta.url),'utf8');
 const pattern=new RegExp('CREATE\\s+(?:OR\\s+REPLACE\\s+)?FUNCTION\\s+"?public"?\\."?'+name+'"?\\s*\\((.*?)\\)(.*?)\\bAS\\s+(\\$[\\w]*\\$)','gis');
 const matches=[...sql.matchAll(pattern)];if(matches.length!==(name==='talent_merge_review'?2:1))throw Error('Ambiguous source '+name);
 const m=matches.at(-1),start=m.index+m[0].length,end=sql.indexOf(m[3],start);if(end<0)throw Error('Missing body '+name);
 const body=sql.slice(start,end),args=m[1].replaceAll('"','').split(',').map(a=>a.trim().split(/\s+/));
 if(args.some(a=>!['uuid','integer','jsonb','text','boolean','date','uuid[]','text[]'].includes(a[1]))||!body.includes('\nBEGIN\n'))throw Error('Unsupported source '+name);
 const signature='public.'+name+'('+args.map(a=>a[1]).join(',')+')';
 const modules=name==='talent_prepare_worker'?['talent','staffing']:['talent'];
 const guard=`\n PERFORM public.talent_assert_scope(${args[0][0]},${args[1][0]});\n PERFORM public.workspace_require_module_${mode}_v1(${args[1][0]},ARRAY[${modules.map(k=>"'"+k+"'").join(',')}]);\n`;
 return {name,file,mode,signature,body,guard,hash:createHash('sha256').update(body).digest('hex'),declaration:sql.slice(m.index,end+m[3].length)+';'};
}
export const entries=targets.map(t=>source(...t));
export const migrationUrl=new URL('../supabase/migrations/20260929000300_talent_module_rpc_gates.sql',import.meta.url);
const quote=s=>"'"+s.replaceAll("'","''")+"'";
const attachmentSql=readFileSync(new URL('../supabase/migrations/20260915000400_talent_attachments.sql',import.meta.url),'utf8');
export const attachmentBody=attachmentSql.split("RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$")[1].split('$$;')[0];
export function render(){return `-- Generated by scripts/talent-module-gates.mjs. Explicit 39 RPC entries; no module-disable rollout.
BEGIN;
SET LOCAL lock_timeout='15s';
CREATE FUNCTION public.workspace_require_module_read_v1(p_tenant uuid,p_modules text[]) RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $read$
DECLARE context jsonb; item text;
BEGIN
 context:=public.current_workspace_modules_v1();
 IF p_tenant IS NULL OR context->>'tenantId' IS DISTINCT FROM p_tenant::text THEN RAISE EXCEPTION 'MODULE_SCOPE' USING ERRCODE='42501';END IF;
 IF p_modules IS NULL OR cardinality(p_modules) NOT BETWEEN 1 AND 10 OR EXISTS(SELECT FROM unnest(p_modules) k WHERE k IS NULL OR NOT EXISTS(SELECT FROM public.workspace_module_catalog_v1() c WHERE c.module_key=k)) THEN RAISE EXCEPTION 'MODULE_UNKNOWN' USING ERRCODE='22023';END IF;
 FOREACH item IN ARRAY p_modules LOOP
  IF NOT (context->'modules'->>item)::boolean THEN RAISE EXCEPTION 'MODULE_DISABLED' USING ERRCODE='BM001';END IF;
 END LOOP;
END $read$;
REVOKE ALL ON FUNCTION public.workspace_require_module_read_v1(uuid,text[]) FROM PUBLIC,anon,authenticated,service_role;
DO $patch$
DECLARE item record; target regprocedure; original text; definition text; updated text; hidden text; client_role text;
BEGIN
 -- Renamed implementation functions must remain inaccessible to clients.
 FOREACH hidden IN ARRAY ARRAY['public.talent_import_prepare_v1(uuid,uuid,uuid,text,jsonb)','public.talent_call_list_people_base(uuid,uuid,uuid)','public.talent_conversation_list_base(uuid,uuid,uuid,integer)'] LOOP
  target:=to_regprocedure(hidden);
  IF target IS NULL THEN RAISE EXCEPTION 'TALENT_MODULE_INTERNAL_MISSING: %',hidden;END IF;
  FOREACH client_role IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
   IF has_function_privilege(client_role,target,'EXECUTE') THEN RAISE EXCEPTION 'TALENT_MODULE_INTERNAL_ACL: %',hidden;END IF;
  END LOOP;
 END LOOP;
 IF EXISTS(SELECT FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname LIKE 'talent_%' AND p.proargnames[1] IN ('p_actor','p_actor_id')
  AND has_function_privilege('authenticated',p.oid,'EXECUTE')
  AND NOT p.oid=ANY(ARRAY[${entries.map(e=>`to_regprocedure(${quote(e.signature)})::oid`).join(',')}])) THEN
  RAISE EXCEPTION 'TALENT_MODULE_UNREVIEWED_ENDPOINT';
 END IF;
 FOR item IN SELECT * FROM (VALUES
${entries.map(e=>` (${quote(e.signature)},${quote(e.hash)},${quote(e.guard)},${quote(e.mode)})`).join(',\n')}
 ) AS entries(signature,hash,guard,mode) LOOP
  target:=to_regprocedure(item.signature);
  IF target IS NULL OR NOT EXISTS(SELECT FROM pg_proc p JOIN pg_language l ON l.oid=p.prolang WHERE p.oid=target AND p.prosecdef AND l.lanname='plpgsql' AND (item.mode<>'write' OR p.provolatile='v')) THEN RAISE EXCEPTION 'TALENT_MODULE_SIGNATURE_DRIFT: %',item.signature;END IF;
  SELECT prosrc INTO original FROM pg_proc WHERE oid=target;
  IF encode(sha256(convert_to(original,'UTF8')),'hex')<>item.hash THEN RAISE EXCEPTION 'TALENT_MODULE_BODY_DRIFT: %',item.signature;END IF;
  IF NOT has_function_privilege('authenticated',target,'EXECUTE') THEN RAISE EXCEPTION 'TALENT_MODULE_ACL_DRIFT: %',item.signature;END IF;
  definition:=pg_get_functiondef(target);
  -- Change only the outer BEGIN. Inner exception blocks and every original statement remain byte-for-byte.
  updated:=overlay(original placing E'\\nBEGIN\\n'||item.guard from strpos(original,E'\\nBEGIN\\n') for length(E'\\nBEGIN\\n'));
  IF strpos(original,E'\\nBEGIN\\n')=0 OR strpos(definition,original)=0 THEN RAISE EXCEPTION 'TALENT_MODULE_ANCHOR_DRIFT';END IF;
  EXECUTE replace(definition,original,updated);
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,service_role',target);
  IF has_function_privilege('anon',target,'EXECUTE') OR has_function_privilege('service_role',target,'EXECUTE') THEN RAISE EXCEPTION 'TALENT_MODULE_INHERITED_ACL';END IF;
 END LOOP;
END $patch$;
DO $storage$
BEGIN
 IF (SELECT prosrc FROM pg_proc WHERE oid=to_regprocedure('public.talent_attachment_access(uuid,boolean)')) IS DISTINCT FROM ${quote(attachmentBody)} THEN RAISE EXCEPTION 'TALENT_STORAGE_BODY_DRIFT';END IF;
END $storage$;
CREATE OR REPLACE FUNCTION public.talent_attachment_access(p_id uuid,p_upload boolean DEFAULT false)
RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $access$
DECLARE context jsonb; allowed boolean;
BEGIN
 context:=public.current_workspace_modules_v1();
 IF NOT (context->'modules'->>'talent')::boolean THEN RETURN false;END IF;
 IF p_upload THEN
  PERFORM public.workspace_require_module_write_v1((context->>'tenantId')::uuid,ARRAY['talent']);
 END IF;
 ${attachmentBody.trim().replace('SELECT EXISTS','SELECT EXISTS').replace(/\)\s*$/,' ) INTO allowed;')}
 RETURN allowed;
END $access$;
REVOKE ALL ON FUNCTION public.talent_attachment_access(uuid,boolean) FROM PUBLIC,anon,service_role;
COMMIT;
`;}
if(process.argv[1]&&new URL('file://'+process.argv[1]).href===import.meta.url){
 if(process.argv.includes('--check')){if(readFileSync(migrationUrl,'utf8')!==render())throw Error('Generated talent migration drift');}
 else writeFileSync(migrationUrl,render());
}
