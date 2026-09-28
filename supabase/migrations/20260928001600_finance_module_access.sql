-- M2f local candidate. Requires 000900 + shared guards from 001000.
-- No module-disable UI. Review live grants/owners and finance parent-FK effects before apply.
BEGIN;
SET LOCAL lock_timeout='15s';
SET LOCAL statement_timeout='60s';
LOCK TABLE public.financial_summaries,public.mizan_uploads,public.mizan_upload_rows IN ACCESS EXCLUSIVE MODE;

DO $patch$
DECLARE target regprocedure; definition text;
 anchor constant text:=' PERFORM 1 FROM public.profiles WHERE id=v_actor FOR UPDATE;';
BEGIN
 target:=to_regprocedure('public.confirm_mizan_atomic(uuid,uuid,jsonb)');
 IF target IS NULL OR NOT EXISTS(SELECT FROM pg_proc WHERE oid=target AND prosecdef) THEN
  RAISE EXCEPTION 'FINANCE_FUNCTION_MISSING_OR_CHANGED';
 END IF;
 definition:=pg_get_functiondef(target);
 IF (length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1 THEN
  RAISE EXCEPTION 'FINANCE_FUNCTION_DRIFT';
 END IF;
 -- Config SHARE precedes profile UPDATE, advisory identity and business row locks.
 -- Replays pass this gate too. The original post-profile membership/role checks remain.
 EXECUTE replace(definition,anchor,
  ' PERFORM public.workspace_require_module_write_v1(p_tenant_id,ARRAY[''finance'',''customers'']);'||E'\n'||anchor);
END $patch$;
ALTER FUNCTION public.confirm_mizan_atomic(uuid,uuid,jsonb) SET lock_timeout='5s';

-- These are AND fences. Existing role policies still decide who may read.
CREATE POLICY financial_summaries_module_read_v1 ON public.financial_summaries AS RESTRICTIVE FOR SELECT TO authenticated
 USING(tenant_id=public.current_user_verified_tenant() AND (SELECT public.workspace_module_enabled_v1('finance')));
CREATE POLICY mizan_uploads_module_read_v1 ON public.mizan_uploads AS RESTRICTIVE FOR SELECT TO authenticated
 USING(tenant_id=public.current_user_verified_tenant() AND (SELECT public.workspace_module_enabled_v1('finance')));
CREATE POLICY mizan_rows_module_read_v1 ON public.mizan_upload_rows AS RESTRICTIVE FOR SELECT TO authenticated
 USING((SELECT public.workspace_module_enabled_v1('finance')) AND EXISTS(
  SELECT FROM public.mizan_uploads u WHERE u.id=upload_id AND u.tenant_id=public.current_user_verified_tenant()));

-- Only the scoped atomic command writes finance data. Retired RPCs are not gateways.
-- No repository cron/service consumer reads these tables; do not introduce a bypass client.
REVOKE INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON public.financial_summaries,public.mizan_uploads,public.mizan_upload_rows FROM PUBLIC,anon,authenticated,service_role;
REVOKE SELECT ON public.financial_summaries,public.mizan_uploads,public.mizan_upload_rows FROM PUBLIC,anon,service_role;
REVOKE ALL ON FUNCTION public.confirm_financial_data(jsonb,jsonb),public.derive_financial_summaries_from_mizan(uuid) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.confirm_mizan_atomic(uuid,uuid,jsonb) FROM PUBLIC,anon,service_role;

DO $verify$
DECLARE relation regclass; role_name text; proc regprocedure;
BEGIN
 FOREACH relation IN ARRAY ARRAY['public.financial_summaries'::regclass,'public.mizan_uploads'::regclass,'public.mizan_upload_rows'::regclass] LOOP
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid=relation) OR NOT has_table_privilege('authenticated',relation,'SELECT') THEN
   RAISE EXCEPTION 'FINANCE_READ_PRIVILEGE_DRIFT: %',relation;
  END IF;
  FOREACH role_name IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
   IF has_table_privilege(role_name,relation,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
    OR has_any_column_privilege(role_name,relation,'INSERT,UPDATE,REFERENCES') THEN
    RAISE EXCEPTION 'FINANCE_WRITE_PRIVILEGE_DRIFT: % %',role_name,relation;
   END IF;
   IF role_name<>'authenticated' AND (has_table_privilege(role_name,relation,'SELECT') OR has_any_column_privilege(role_name,relation,'SELECT')) THEN
    RAISE EXCEPTION 'FINANCE_READ_PRIVILEGE_DRIFT: % %',role_name,relation;
   END IF;
  END LOOP;
 END LOOP;
 FOREACH proc IN ARRAY ARRAY['public.confirm_financial_data(jsonb,jsonb)'::regprocedure,'public.derive_financial_summaries_from_mizan(uuid)'::regprocedure] LOOP
  FOREACH role_name IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
   IF has_function_privilege(role_name,proc,'EXECUTE') THEN RAISE EXCEPTION 'FINANCE_LEGACY_PRIVILEGE_DRIFT: % %',role_name,proc;END IF;
  END LOOP;
 END LOOP;
 -- A callable same-name overload is a separate entry point; require explicit review.
 FOR proc IN SELECT p.oid::regprocedure FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname IN('confirm_mizan_atomic','confirm_financial_data','derive_financial_summaries_from_mizan')
   AND p.oid NOT IN('public.confirm_mizan_atomic(uuid,uuid,jsonb)'::regprocedure,
    'public.confirm_financial_data(jsonb,jsonb)'::regprocedure,'public.derive_financial_summaries_from_mizan(uuid)'::regprocedure)
 LOOP
  FOREACH role_name IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
   IF has_function_privilege(role_name,proc,'EXECUTE') THEN RAISE EXCEPTION 'FINANCE_OVERLOAD_PRIVILEGE_DRIFT: % %',role_name,proc; END IF;
  END LOOP;
 END LOOP;
 IF NOT has_function_privilege('authenticated','public.confirm_mizan_atomic(uuid,uuid,jsonb)','EXECUTE')
  OR has_function_privilege('anon','public.confirm_mizan_atomic(uuid,uuid,jsonb)','EXECUTE')
  OR has_function_privilege('service_role','public.confirm_mizan_atomic(uuid,uuid,jsonb)','EXECUTE') THEN RAISE EXCEPTION 'FINANCE_COMMAND_PRIVILEGE_DRIFT';END IF;
END $verify$;
COMMIT;
