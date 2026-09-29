-- Existing invoker/definer identities and business scopes remain unchanged.
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
 ('public.ops_mutate(uuid,text,jsonb)','578a45d9118eecd72a9965742de25ae3151fc303018290797aa558ba80a3e388','
 PERFORM public.workspace_require_module_write_v1(public.current_user_verified_tenant(),ARRAY[''staffing'']);
','
BEGIN
',true),
 ('public.ops_import_locations(uuid,uuid,jsonb)','6db30e877bf6ebafdaea9be405d0c9d561df45dca13133910367bb461ee7430f','
 PERFORM public.workspace_require_module_write_v1(public.current_user_verified_tenant(),ARRAY[''staffing'']);
','
BEGIN
',true),
 ('public.ops_board(uuid,date)','4fe69944deb6340948ec0270dddc1571d769b4b17147c70cb1c221d330612826','
 IF NOT public.workspace_module_enabled_v1(''staffing'') THEN RAISE EXCEPTION ''MODULE_DISABLED'' USING ERRCODE=''BM001'';END IF;
','
BEGIN
',true),
 ('public.ops_week(uuid,date)','5308bed67c6227f9037125cbc772eecd724988ac07f76516bc08d617731968fc','
 IF NOT public.workspace_module_enabled_v1(''staffing'') THEN RAISE EXCEPTION ''MODULE_DISABLED'' USING ERRCODE=''BM001'';END IF;
','
BEGIN
',false),
 ('public.ops_attendance_week(uuid,date)','bb3cd89420f06e561e430da87bef3b5294dbc1d204df5f948afd0b8c602d99b4','
 IF NOT public.workspace_module_enabled_v1(''staffing'') THEN RAISE EXCEPTION ''MODULE_DISABLED'' USING ERRCODE=''BM001'';END IF;
','
BEGIN
',false),
 ('public.ops_directory(text,uuid,text,text,integer)','083ae120bb4aba9836c2374f3f2be41e6d74c7bec8ac60971ac38c7457d1a799','
 IF NOT public.workspace_module_enabled_v1(''staffing'') THEN RAISE EXCEPTION ''MODULE_DISABLED'' USING ERRCODE=''BM001'';END IF;
','
BEGIN
',false),
 ('public.ops_idp_list(uuid,date)','dd6ba4831fe5f418c3d8aa531809769d800560d14251a638d5ac8ea84679caf0','
 IF NOT public.workspace_module_enabled_v1(''staffing'') THEN RAISE EXCEPTION ''MODULE_DISABLED'' USING ERRCODE=''BM001'';END IF;
','
BEGIN
',true)
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
CREATE POLICY ops_locations_module_read_v1 ON public.ops_locations AS RESTRICTIVE FOR SELECT TO authenticated
USING(tenant_id=public.current_user_verified_tenant() AND (SELECT public.workspace_module_enabled_v1('staffing')));
CREATE POLICY ops_workers_module_read_v1 ON public.ops_workers AS RESTRICTIVE FOR SELECT TO authenticated
USING(tenant_id=public.current_user_verified_tenant() AND (SELECT public.workspace_module_enabled_v1('staffing')));
CREATE POLICY ops_daily_requests_module_read_v1 ON public.ops_daily_requests AS RESTRICTIVE FOR SELECT TO authenticated
USING(tenant_id=public.current_user_verified_tenant() AND (SELECT public.workspace_module_enabled_v1('staffing')));
CREATE POLICY ops_assignments_module_read_v1 ON public.ops_assignments AS RESTRICTIVE FOR SELECT TO authenticated
USING(tenant_id=public.current_user_verified_tenant() AND (SELECT public.workspace_module_enabled_v1('staffing')));
COMMIT;
