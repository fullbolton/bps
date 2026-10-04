-- Reporting RPC and project-sources Storage gates. Not the module-toggle release.
BEGIN;
SET LOCAL lock_timeout='15s';
DO $patch$
DECLARE item record;target regprocedure;original text;definition text;role_name text;hidden text;
BEGIN
 FOREACH hidden IN ARRAY ARRAY['public.reporting_assert_scope(uuid,uuid,boolean)','public.reporting_import_validate(uuid,uuid,date,text,jsonb)'] LOOP
  target:=to_regprocedure(hidden);
  IF target IS NULL THEN RAISE EXCEPTION 'REPORT_MODULE_INTERNAL_MISSING';END IF;
  FOREACH role_name IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
   IF has_function_privilege(role_name,target,'EXECUTE') THEN RAISE EXCEPTION 'REPORT_MODULE_INTERNAL_ACL';END IF;
  END LOOP;
 END LOOP;
 IF EXISTS(SELECT FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname LIKE 'reporting_%' AND p.proargnames[1] IN ('p_actor','p_actor_id') AND has_function_privilege('authenticated',p.oid,'EXECUTE') AND p.oid NOT IN (coalesce(to_regprocedure('public.reporting_project_execute(uuid,uuid,uuid,jsonb)'),0::oid),coalesce(to_regprocedure('public.reporting_project_list(uuid,uuid,integer)'),0::oid),coalesce(to_regprocedure('public.reporting_project_detail(uuid,uuid,uuid,integer,integer)'),0::oid),coalesce(to_regprocedure('public.reporting_person_code_set(uuid,uuid,uuid,integer,text,text,uuid)'),0::oid),coalesce(to_regprocedure('public.reporting_import_prepare(uuid,uuid,uuid,uuid,text,text,jsonb)'),0::oid),coalesce(to_regprocedure('public.reporting_import_finish(uuid,uuid,uuid,boolean)'),0::oid),coalesce(to_regprocedure('public.reporting_import_list(uuid,uuid,uuid,integer)'),0::oid),coalesce(to_regprocedure('public.reporting_import_people(uuid,uuid,uuid,text,text[],text)'),0::oid),coalesce(to_regprocedure('public.reporting_import_read(uuid,uuid,uuid)'),0::oid),coalesce(to_regprocedure('public.reporting_monthly_report(uuid,uuid,uuid,text,integer)'),0::oid),coalesce(to_regprocedure('public.reporting_work_details(uuid,uuid,uuid,text,uuid,integer)'),0::oid),coalesce(to_regprocedure('public.reporting_source_file(uuid,uuid,uuid,text,text,integer,text)'),0::oid))) THEN RAISE EXCEPTION 'REPORT_MODULE_UNREVIEWED_ENDPOINT';END IF;
 FOR item IN SELECT * FROM (VALUES
('public.reporting_project_execute(uuid,uuid,uuid,jsonb)','a83cfd594a2dac81ec2c48049e577ecf9ec59cee59dee246caad81c7d38dd038','
BEGIN
','
 PERFORM public.reporting_assert_scope(p_actor,p_tenant,true);
 PERFORM public.workspace_require_module_write_v1(p_tenant,ARRAY[''reporting'']);
'),
('public.reporting_project_list(uuid,uuid,integer)','a7cf4b7546962fbb6e537971d9bc26c2a98ce84fd3efa1420962953341a152f5','
BEGIN
','
 PERFORM public.reporting_assert_scope(p_actor,p_tenant,false);
 PERFORM public.workspace_require_module_read_v1(p_tenant,ARRAY[''reporting'']);
'),
('public.reporting_project_detail(uuid,uuid,uuid,integer,integer)','59610887992e3f76c28e8785b422592b291209173b252af43275c8ada6c3f7bc','
BEGIN
','
 PERFORM public.reporting_assert_scope(p_actor,p_tenant,false);
 PERFORM public.workspace_require_module_read_v1(p_tenant,ARRAY[''reporting'']);
'),
('public.reporting_person_code_set(uuid,uuid,uuid,integer,text,text,uuid)','c961f80a7dd4537add84337d1f8d83d54c5ff3d876c99e92370ebcfbcdd99e6d','
BEGIN
','
 PERFORM public.reporting_assert_scope(p_actor,p_tenant,true);
 PERFORM public.workspace_require_module_write_v1(p_tenant,ARRAY[''reporting'']);
'),
('public.reporting_import_prepare(uuid,uuid,uuid,uuid,text,text,jsonb)','19a94edfee092bc88b37a846be74704eae60eeee4de03c150cea781c4630b31b','
BEGIN
','
 PERFORM public.reporting_assert_scope(p_actor,p_tenant,true);
 PERFORM public.workspace_require_module_write_v1(p_tenant,ARRAY[''reporting'']);
'),
('public.reporting_import_finish(uuid,uuid,uuid,boolean)','70d451f454801363318ecedd05f07a13605aaec3de28028bb8fb46b136e8d804','
BEGIN
','
 PERFORM public.reporting_assert_scope(p_actor,p_tenant,true);
 PERFORM public.workspace_require_module_write_v1(p_tenant,ARRAY[''reporting'']);
'),
('public.reporting_import_list(uuid,uuid,uuid,integer)','dc9f630b48760099da5c2d5acb4ce1d4f2b5049a11a5cc7f7f057fcde0615cf5','
BEGIN
','
 PERFORM public.reporting_assert_scope(p_actor,p_tenant,false);
 PERFORM public.workspace_require_module_read_v1(p_tenant,ARRAY[''reporting'']);
'),
('public.reporting_import_people(uuid,uuid,uuid,text,text[],text)','fa58742e9ecae413b12e35505556405f0a97ff9e0e64fafe1959c60a380625fa','
BEGIN
','
 PERFORM public.reporting_assert_scope(p_actor,p_tenant,false);
 PERFORM public.workspace_require_module_read_v1(p_tenant,ARRAY[''reporting'']);
'),
('public.reporting_import_read(uuid,uuid,uuid)','44092002f1df3df3381692d2bc9f24ac1839cceb50071bfbf72150d73c82eebb','
BEGIN
','
 PERFORM public.reporting_assert_scope(p_actor,p_tenant,false);
 PERFORM public.workspace_require_module_read_v1(p_tenant,ARRAY[''reporting'']);
'),
('public.reporting_monthly_report(uuid,uuid,uuid,text,integer)','df9b67e0c79f96694768a95fb60fe9af933ea27bd61045e7211e216d9cb494f2','
BEGIN
','
 PERFORM public.reporting_assert_scope(p_actor,p_tenant,false);
 PERFORM public.workspace_require_module_read_v1(p_tenant,ARRAY[''reporting'']);
'),
('public.reporting_work_details(uuid,uuid,uuid,text,uuid,integer)','73cfd0689798792f30534d1bae71ba0302380a0b5b75edaf90aaac3db7def748','
BEGIN
','
 PERFORM public.reporting_assert_scope(p_actor,p_tenant,false);
 PERFORM public.workspace_require_module_read_v1(p_tenant,ARRAY[''reporting'']);
'),
('public.reporting_source_file(uuid,uuid,uuid,text,text,integer,text)','7148538b2cbc159ff0b2f12913cf6b6238bca0ebe98f7dfd45432b3c2f302cca','
BEGIN
','
 PERFORM public.reporting_assert_scope(p_actor,p_tenant,true);
 PERFORM public.workspace_require_module_write_v1(p_tenant,ARRAY[''reporting'']);
')
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
 IF encode(sha256(convert_to(original,'UTF8')),'hex')<>'fe8481d6b2b08bda65c21eebfa5ea8a344adb145cb6682a36af19be94c5ac3b1' THEN RAISE EXCEPTION 'REPORT_STORAGE_BODY_DRIFT';END IF;
END $patch$;
CREATE OR REPLACE FUNCTION public.reporting_source_access(p_name text,p_write boolean) RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $storage$
DECLARE context jsonb;
BEGIN
 context:=public.current_workspace_modules_v1();
 IF NOT (context->'modules'->>'reporting')::boolean THEN RETURN false;END IF;
 IF p_write THEN PERFORM public.workspace_require_module_write_v1((context->>'tenantId')::uuid,ARRAY['reporting']);END IF;
 RETURN (SELECT p_name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f]{64}\.(csv|xlsx)$'
 AND EXISTS(SELECT 1 FROM public.reporting_imports i WHERE i.tenant_id=public.current_user_verified_tenant()
 AND i.tenant_id::text=split_part(p_name,'/',1) AND i.id::text=split_part(p_name,'/',2)
 AND public.current_user_role() IN ('yonetici','operasyon')
 AND (i.actor_id=auth.uid() OR public.current_user_role()='yonetici')
 AND (NOT p_write OR (i.status='pending' AND NOT EXISTS(SELECT 1 FROM public.reporting_import_files f WHERE f.tenant_id=i.tenant_id AND f.batch_id=i.id)))));
END
$storage$;
REVOKE ALL ON FUNCTION public.reporting_source_access(text,boolean) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.reporting_source_access(text,boolean) TO authenticated;
COMMIT;
