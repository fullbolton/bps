import {withReleasedHotfix} from './helpers/released-hotfix-history.mjs';
import {withOperationsHistory} from './helpers/operations-function-history.mjs';
import {readFileSync,writeFileSync} from 'node:fs';
import {source} from './talent-module-gates.mjs';
// Explicit reviewed entrypoints; legacy unscoped RPCs are a separate rollout block.
export const targets = [
  [
    "ops_execute_scoped",
    "20260909000300_scoped_operation_command.sql",
    "write"
  ],
  [
    "ops_reconcile_commands",
    "20260909000400_command_reconciliation.sql",
    "write"
  ],
  [
    "ops_create_request_batch",
    "20260910000100_candidate_company_operations.sql",
    "write"
  ],
  [
    "ops_resize_request",
    "20260910000100_candidate_company_operations.sql",
    "write"
  ],
  [
    "ops_record_attendance",
    "20260909000800_attendance.sql",
    "write"
  ],
  [
    "ops_replace_assignment",
    "20260909002700_start_tracking.sql",
    "write"
  ],
  [
    "ops_set_directory_active",
    "20260910000100_candidate_company_operations.sql",
    "write"
  ],
  [
    "ops_start_execute",
    "20260909002900_start_event_validation.sql",
    "write"
  ],
  [
    "ops_start_board",
    "20260909002700_start_tracking.sql",
    "read"
  ],
  [
    "ops_start_board_filtered",
    "20260909002800_start_board_filters.sql",
    "read"
  ],
  [
    "ops_replace_assignment_before_start",
    "20260910000100_candidate_company_operations.sql",
    "write"
  ],
  [
    "ops_comment_send",
    "20260910000400_comment_command_recovery.sql",
    "write"
  ],
  [
    "ops_comment_list",
    "20260910000200_request_conversation.sql",
    "read"
  ],
  [
    "ops_comment_inbox",
    "20260910000200_request_conversation.sql",
    "read"
  ],
  [
    "ops_comment_read",
    "20260910000200_request_conversation.sql",
    "write"
  ],
  [
    "ops_comment_people",
    "20260910000300_conversation_read_surfaces.sql",
    "read"
  ],
  [
    "ops_comment_inbox_page",
    "20260910000300_conversation_read_surfaces.sql",
    "read"
  ],
  [
    "ops_comment_resolve",
    "20260910000400_comment_command_recovery.sql",
    "write"
  ],
  [
    "ops_update_location",
    "20260914000100_location_metadata_update.sql",
    "write"
  ],
  [
    "ops_record_replacement_outreach",
    "20260915000800_replacement_outreach.sql",
    "write"
  ],
  [
    "ops_replacement_outreach_history",
    "20260915000800_replacement_outreach.sql",
    "read"
  ],
  [
    "ops_replacement_outreach_latest",
    "20260915000800_replacement_outreach.sql",
    "read"
  ],
  [
    "ops_work_record_execute",
    "20260915000900_work_approval.sql",
    "write"
  ],
  [
    "ops_work_record_read",
    "20260915000900_work_approval.sql",
    "read"
  ],
  [
    "ops_work_record_list",
    "20260915000900_work_approval.sql",
    "read"
  ],
  [
    "ops_idp_read",
    "20260924000300_idp_request_context.sql",
    "read"
  ],
  [
    "ops_idp_save",
    "20260924000300_idp_request_context.sql",
    "write"
  ],
  [
    "ops_idp_period_create",
    "20260924000500_idp_period_management.sql",
    "write"
  ],
  [
    "ops_idp_period_read",
    "20260926000200_fixed_roster.sql",
    "read"
  ],
  [
    "ops_idp_period_manage",
    "20260924000500_idp_period_management.sql",
    "write"
  ],
  [
    "ops_idp_period_history",
    "20260925000100_idp_period_history.sql",
    "read"
  ],
  [
    "ops_fixed_roster_save",
    "20260926000200_fixed_roster.sql",
    "write"
  ],
  [
    "ops_fixed_roster_list",
    "20260926000200_fixed_roster.sql",
    "read"
  ],
  [
    "ops_fixed_roster_history",
    "20260926000200_fixed_roster.sql",
    "read"
  ],
  [
    "ops_fixed_roster_idp_create",
    "20260926000200_fixed_roster.sql",
    "write"
  ],
  [
    "ops_create_timed_requests",
    "20260927000100_shift_scheduling.sql",
    "write"
  ],
  [
    "ops_schedule_save",
    "20260927000200_recurring_schedules.sql",
    "write"
  ],
  [
    "ops_schedule_list",
    "20260927000200_recurring_schedules.sql",
    "write"
  ],
  [
    "ops_schedule_preview",
    "20260927000200_recurring_schedules.sql",
    "write"
  ],
  [
    "ops_schedule_generate",
    "20260927000200_recurring_schedules.sql",
    "write"
  ]
];
export const entries=targets.map(t=>{
 const e=withReleasedHotfix(withOperationsHistory(source(...t))); // Use declared argument names, not client-controlled SQL.
 const names=e.declaration.match(/\((.*?)\)/s)[1].replaceAll('"','').split(',').map(a=>a.trim().split(/\s+/)[0]);
 const [actor,tenant]=names;
 return {...e,guard:`\n IF auth.uid() IS NULL OR ${actor} IS DISTINCT FROM auth.uid() OR ${tenant} IS NULL OR ${tenant} IS DISTINCT FROM public.current_user_verified_tenant() THEN RAISE EXCEPTION 'OPS_SCOPE_CHANGED' USING ERRCODE='42501';END IF;\n PERFORM public.workspace_require_module_${e.mode}_v1(${tenant},ARRAY['staffing']);\n`};
});
const q=s=>"'"+s.replaceAll("'","''")+"'";
export const migrationUrl=new URL('../supabase/migrations/20261005002300_operations_module_rpc_gates.sql',import.meta.url);
export function render(){return `-- Generated, exact-source operations entry gates. Legacy unscoped APIs and direct table reads remain a separate block.
BEGIN;
SET LOCAL lock_timeout='15s';
DO $patch$
DECLARE item record;target regprocedure;original text;definition text;updated text;
BEGIN
 IF EXISTS(SELECT FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname LIKE 'ops_%'
  AND p.proargnames[1] IN ('p_actor','p_actor_id') AND has_function_privilege('authenticated',p.oid,'EXECUTE')
  AND NOT p.oid=ANY(ARRAY[${entries.map(e=>`to_regprocedure(${q(e.signature)})::oid`).join(',')}])) THEN RAISE EXCEPTION 'OPS_MODULE_UNREVIEWED_ENDPOINT';END IF;
 FOR item IN SELECT * FROM (VALUES
${entries.map(e=>` (${q(e.signature)},${q(e.hash)},${q(e.guard)},${q(e.mode)},${q(e.anchor)})`).join(',\n')}
 ) AS entries(signature,hash,guard,mode,anchor) LOOP
  target:=to_regprocedure(item.signature);
  IF target IS NULL OR NOT EXISTS(SELECT FROM pg_proc p JOIN pg_language l ON l.oid=p.prolang WHERE p.oid=target AND p.prosecdef AND l.lanname='plpgsql' AND (item.mode<>'write' OR p.provolatile='v')) THEN RAISE EXCEPTION 'OPS_MODULE_SIGNATURE_DRIFT: %',item.signature;END IF;
  SELECT prosrc INTO original FROM pg_proc WHERE oid=target;
  IF encode(sha256(convert_to(original,'UTF8')),'hex')<>item.hash THEN RAISE EXCEPTION 'OPS_MODULE_BODY_DRIFT: %',item.signature;END IF;
  IF NOT has_function_privilege('authenticated',target,'EXECUTE') THEN RAISE EXCEPTION 'OPS_MODULE_ACL_DRIFT: %',item.signature;END IF;
  definition:=pg_get_functiondef(target);
  IF strpos(original,item.anchor)=0 OR strpos(definition,original)=0 THEN RAISE EXCEPTION 'OPS_MODULE_ANCHOR_DRIFT';END IF;
  updated:=overlay(original placing item.anchor||item.guard from strpos(original,item.anchor) for length(item.anchor));
  EXECUTE replace(definition,original,updated);
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,service_role',target);
  IF has_function_privilege('anon',target,'EXECUTE') OR has_function_privilege('service_role',target,'EXECUTE') THEN RAISE EXCEPTION 'OPS_MODULE_INHERITED_ACL';END IF;
 END LOOP;
END $patch$;
COMMIT;
`;}
if(process.argv[1]&&new URL('file://'+process.argv[1]).href===import.meta.url){
 if(process.argv.includes('--check')){if(readFileSync(migrationUrl,'utf8')!==render())throw Error('Generated operations migration drift');}
 else writeFileSync(migrationUrl,render());
}
