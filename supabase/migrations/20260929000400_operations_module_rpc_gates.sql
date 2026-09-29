-- Generated, exact-source operations entry gates. Legacy unscoped APIs and direct table reads remain a separate block.
BEGIN;
SET LOCAL lock_timeout='15s';
DO $patch$
DECLARE item record;target regprocedure;original text;definition text;updated text;
BEGIN
 IF EXISTS(SELECT FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname LIKE 'ops_%'
  AND p.proargnames[1] IN ('p_actor','p_actor_id') AND has_function_privilege('authenticated',p.oid,'EXECUTE')
  AND NOT p.oid=ANY(ARRAY[to_regprocedure('public.ops_execute_scoped(uuid,uuid,uuid,text,jsonb)')::oid,to_regprocedure('public.ops_reconcile_commands(uuid,uuid,uuid[],boolean)')::oid,to_regprocedure('public.ops_create_request_batch(uuid,uuid,uuid,jsonb)')::oid,to_regprocedure('public.ops_resize_request(uuid,uuid,uuid,uuid,integer,integer)')::oid,to_regprocedure('public.ops_record_attendance(uuid,uuid,uuid,uuid,integer,text)')::oid,to_regprocedure('public.ops_replace_assignment(uuid,uuid,uuid,uuid,uuid,integer)')::oid,to_regprocedure('public.ops_set_directory_active(uuid,uuid,uuid,text,uuid,integer,boolean)')::oid,to_regprocedure('public.ops_start_execute(uuid,uuid,uuid,uuid,integer,text,jsonb)')::oid,to_regprocedure('public.ops_start_board(uuid,uuid,date,integer)')::oid,to_regprocedure('public.ops_start_board_filtered(uuid,uuid,date,integer,text,boolean,boolean)')::oid,to_regprocedure('public.ops_replace_assignment_before_start(uuid,uuid,uuid,uuid,uuid,integer)')::oid,to_regprocedure('public.ops_comment_send(uuid,uuid,uuid,uuid,text,uuid,uuid[])')::oid,to_regprocedure('public.ops_comment_list(uuid,uuid,uuid,uuid)')::oid,to_regprocedure('public.ops_comment_inbox(uuid,uuid)')::oid,to_regprocedure('public.ops_comment_read(uuid,uuid,uuid)')::oid,to_regprocedure('public.ops_comment_people(uuid,uuid,uuid)')::oid,to_regprocedure('public.ops_comment_inbox_page(uuid,uuid,uuid)')::oid,to_regprocedure('public.ops_comment_resolve(uuid,uuid,uuid,uuid,text,uuid,uuid[])')::oid,to_regprocedure('public.ops_update_location(uuid,uuid,uuid,uuid,uuid,integer,text,text)')::oid,to_regprocedure('public.ops_record_replacement_outreach(uuid,uuid,uuid,uuid,uuid,integer,text,text)')::oid,to_regprocedure('public.ops_replacement_outreach_history(uuid,uuid,uuid,integer)')::oid,to_regprocedure('public.ops_replacement_outreach_latest(uuid,uuid,uuid,uuid)')::oid,to_regprocedure('public.ops_work_record_execute(uuid,uuid,uuid,uuid,integer,text,jsonb)')::oid,to_regprocedure('public.ops_work_record_read(uuid,uuid,uuid)')::oid,to_regprocedure('public.ops_work_record_list(uuid,uuid,uuid,date)')::oid,to_regprocedure('public.ops_idp_read(uuid,uuid,uuid)')::oid,to_regprocedure('public.ops_idp_save(uuid,uuid,uuid,uuid,integer,text,date,date)')::oid,to_regprocedure('public.ops_idp_period_create(uuid,uuid,uuid,jsonb)')::oid,to_regprocedure('public.ops_idp_period_read(uuid,uuid,uuid)')::oid,to_regprocedure('public.ops_idp_period_manage(uuid,uuid,uuid,uuid,integer,jsonb)')::oid,to_regprocedure('public.ops_idp_period_history(uuid,uuid,uuid,integer)')::oid,to_regprocedure('public.ops_fixed_roster_save(uuid,uuid,uuid,uuid,integer,uuid,uuid,uuid,text,text,date,date,text,boolean)')::oid,to_regprocedure('public.ops_fixed_roster_list(uuid,uuid,uuid,uuid,date,integer,boolean)')::oid,to_regprocedure('public.ops_fixed_roster_history(uuid,uuid,uuid,integer)')::oid,to_regprocedure('public.ops_fixed_roster_idp_create(uuid,uuid,uuid,uuid,integer,date,date,jsonb)')::oid,to_regprocedure('public.ops_create_timed_requests(uuid,uuid,uuid,jsonb)')::oid,to_regprocedure('public.ops_schedule_save(uuid,uuid,uuid,uuid,integer,jsonb,boolean)')::oid,to_regprocedure('public.ops_schedule_list(uuid,uuid,uuid,integer)')::oid,to_regprocedure('public.ops_schedule_preview(uuid,uuid,uuid,integer,date,date)')::oid,to_regprocedure('public.ops_schedule_generate(uuid,uuid,uuid,uuid,integer,date,date)')::oid])) THEN RAISE EXCEPTION 'OPS_MODULE_UNREVIEWED_ENDPOINT';END IF;
 FOR item IN SELECT * FROM (VALUES
 ('public.ops_execute_scoped(uuid,uuid,uuid,text,jsonb)','8e2e9d7f2e04997fb7b4382b032e9c7d6359411890a1a2d85cad1d82080beef7','
 IF auth.uid() IS NULL OR p_actor_id IS DISTINCT FROM auth.uid() OR p_tenant_id IS NULL OR p_tenant_id IS DISTINCT FROM public.current_user_verified_tenant() THEN RAISE EXCEPTION ''OPS_SCOPE_CHANGED'' USING ERRCODE=''42501'';END IF;
 PERFORM public.workspace_require_module_write_v1(p_tenant_id,ARRAY[''staffing'']);
','write','
BEGIN
'),
 ('public.ops_reconcile_commands(uuid,uuid,uuid[],boolean)','da5e183bddaee0a883443199234675f041d150f98506e477ae3a2db877b496ea','
 IF auth.uid() IS NULL OR p_actor_id IS DISTINCT FROM auth.uid() OR p_tenant_id IS NULL OR p_tenant_id IS DISTINCT FROM public.current_user_verified_tenant() THEN RAISE EXCEPTION ''OPS_SCOPE_CHANGED'' USING ERRCODE=''42501'';END IF;
 PERFORM public.workspace_require_module_write_v1(p_tenant_id,ARRAY[''staffing'']);
','write','
BEGIN
'),
 ('public.ops_create_request_batch(uuid,uuid,uuid,jsonb)','c357d35a43f893cdea6041694707ff406e2987ac411102ba06b297bd4a838fde','
 IF auth.uid() IS NULL OR p_actor_id IS DISTINCT FROM auth.uid() OR p_tenant_id IS NULL OR p_tenant_id IS DISTINCT FROM public.current_user_verified_tenant() THEN RAISE EXCEPTION ''OPS_SCOPE_CHANGED'' USING ERRCODE=''42501'';END IF;
 PERFORM public.workspace_require_module_write_v1(p_tenant_id,ARRAY[''staffing'']);
','write','
BEGIN
'),
 ('public.ops_resize_request(uuid,uuid,uuid,uuid,integer,integer)','f779c58c30421580d85d615eb4ea3dff892b731a542605cfa9c584a333767f47','
 IF auth.uid() IS NULL OR p_actor_id IS DISTINCT FROM auth.uid() OR p_tenant_id IS NULL OR p_tenant_id IS DISTINCT FROM public.current_user_verified_tenant() THEN RAISE EXCEPTION ''OPS_SCOPE_CHANGED'' USING ERRCODE=''42501'';END IF;
 PERFORM public.workspace_require_module_write_v1(p_tenant_id,ARRAY[''staffing'']);
','write','
BEGIN
'),
 ('public.ops_record_attendance(uuid,uuid,uuid,uuid,integer,text)','d52c70c2c5b4059db1762a92cd4afca4450a66e1f26c5555401bcc09a82b8a63','
 IF auth.uid() IS NULL OR p_actor_id IS DISTINCT FROM auth.uid() OR p_tenant_id IS NULL OR p_tenant_id IS DISTINCT FROM public.current_user_verified_tenant() THEN RAISE EXCEPTION ''OPS_SCOPE_CHANGED'' USING ERRCODE=''42501'';END IF;
 PERFORM public.workspace_require_module_write_v1(p_tenant_id,ARRAY[''staffing'']);
','write','
BEGIN
'),
 ('public.ops_replace_assignment(uuid,uuid,uuid,uuid,uuid,integer)','627d566cb649398863493ae35858e284ed73bdf4a85a7d9e82c27f4a42d09dea','
 IF auth.uid() IS NULL OR p_actor_id IS DISTINCT FROM auth.uid() OR p_tenant_id IS NULL OR p_tenant_id IS DISTINCT FROM public.current_user_verified_tenant() THEN RAISE EXCEPTION ''OPS_SCOPE_CHANGED'' USING ERRCODE=''42501'';END IF;
 PERFORM public.workspace_require_module_write_v1(p_tenant_id,ARRAY[''staffing'']);
','write','
BEGIN
'),
 ('public.ops_set_directory_active(uuid,uuid,uuid,text,uuid,integer,boolean)','8c431f32f4d702a2551b0382658cf28730c74c97fb22f834299a56812e0d1006','
 IF auth.uid() IS NULL OR p_actor_id IS DISTINCT FROM auth.uid() OR p_tenant_id IS NULL OR p_tenant_id IS DISTINCT FROM public.current_user_verified_tenant() THEN RAISE EXCEPTION ''OPS_SCOPE_CHANGED'' USING ERRCODE=''42501'';END IF;
 PERFORM public.workspace_require_module_write_v1(p_tenant_id,ARRAY[''staffing'']);
','write','
BEGIN
'),
 ('public.ops_start_execute(uuid,uuid,uuid,uuid,integer,text,jsonb)','78d7ac27f055eb4ed49769c89fce52644f56482c302a6748dc48d479990f4655','
 IF auth.uid() IS NULL OR p_actor_id IS DISTINCT FROM auth.uid() OR p_tenant_id IS NULL OR p_tenant_id IS DISTINCT FROM public.current_user_verified_tenant() THEN RAISE EXCEPTION ''OPS_SCOPE_CHANGED'' USING ERRCODE=''42501'';END IF;
 PERFORM public.workspace_require_module_write_v1(p_tenant_id,ARRAY[''staffing'']);
','write','
BEGIN
'),
 ('public.ops_start_board(uuid,uuid,date,integer)','d164bf1bcf870a0205adc94644efb3a6cb8adc7def1310887229ec42f87d100d','
 IF auth.uid() IS NULL OR p_actor_id IS DISTINCT FROM auth.uid() OR p_tenant_id IS NULL OR p_tenant_id IS DISTINCT FROM public.current_user_verified_tenant() THEN RAISE EXCEPTION ''OPS_SCOPE_CHANGED'' USING ERRCODE=''42501'';END IF;
 PERFORM public.workspace_require_module_read_v1(p_tenant_id,ARRAY[''staffing'']);
','read','
BEGIN
'),
 ('public.ops_start_board_filtered(uuid,uuid,date,integer,text,boolean,boolean)','563b156e3c4d1f07d43e6763fec3ae273a545a5dd15b781cc511f31b33a51194','
 IF auth.uid() IS NULL OR p_actor_id IS DISTINCT FROM auth.uid() OR p_tenant_id IS NULL OR p_tenant_id IS DISTINCT FROM public.current_user_verified_tenant() THEN RAISE EXCEPTION ''OPS_SCOPE_CHANGED'' USING ERRCODE=''42501'';END IF;
 PERFORM public.workspace_require_module_read_v1(p_tenant_id,ARRAY[''staffing'']);
','read','
BEGIN
'),
 ('public.ops_replace_assignment_before_start(uuid,uuid,uuid,uuid,uuid,integer)','4b57c170a8062add123141a62c7dafb620fa6741c61535f14bc676ade8c23d7b','
 IF auth.uid() IS NULL OR p_actor_id IS DISTINCT FROM auth.uid() OR p_tenant_id IS NULL OR p_tenant_id IS DISTINCT FROM public.current_user_verified_tenant() THEN RAISE EXCEPTION ''OPS_SCOPE_CHANGED'' USING ERRCODE=''42501'';END IF;
 PERFORM public.workspace_require_module_write_v1(p_tenant_id,ARRAY[''staffing'']);
','write','
BEGIN
'),
 ('public.ops_comment_send(uuid,uuid,uuid,uuid,text,uuid,uuid[])','a27f5553f7507400e93ba17e38ae0f3373f90b04bea693048bcfdc2c158ab78f','
 IF auth.uid() IS NULL OR p_actor_id IS DISTINCT FROM auth.uid() OR p_tenant_id IS NULL OR p_tenant_id IS DISTINCT FROM public.current_user_verified_tenant() THEN RAISE EXCEPTION ''OPS_SCOPE_CHANGED'' USING ERRCODE=''42501'';END IF;
 PERFORM public.workspace_require_module_write_v1(p_tenant_id,ARRAY[''staffing'']);
','write','
BEGIN
'),
 ('public.ops_comment_list(uuid,uuid,uuid,uuid)','bcd464eb36b641f989b49e65dbcb20665964ab79d1aea96ad0566b31f4fc809a','
 IF auth.uid() IS NULL OR p_actor_id IS DISTINCT FROM auth.uid() OR p_tenant_id IS NULL OR p_tenant_id IS DISTINCT FROM public.current_user_verified_tenant() THEN RAISE EXCEPTION ''OPS_SCOPE_CHANGED'' USING ERRCODE=''42501'';END IF;
 PERFORM public.workspace_require_module_read_v1(p_tenant_id,ARRAY[''staffing'']);
','read','
BEGIN
'),
 ('public.ops_comment_inbox(uuid,uuid)','ef6656ed9f27f4a007986a6bceebefa97eea39d80600bebbbe806810277dd88f','
 IF auth.uid() IS NULL OR p_actor_id IS DISTINCT FROM auth.uid() OR p_tenant_id IS NULL OR p_tenant_id IS DISTINCT FROM public.current_user_verified_tenant() THEN RAISE EXCEPTION ''OPS_SCOPE_CHANGED'' USING ERRCODE=''42501'';END IF;
 PERFORM public.workspace_require_module_read_v1(p_tenant_id,ARRAY[''staffing'']);
','read','
BEGIN
'),
 ('public.ops_comment_read(uuid,uuid,uuid)','80ee830db5e2c44d7c0399bd2b38b4b800072a3174e1485839f14228445ad572','
 IF auth.uid() IS NULL OR p_actor_id IS DISTINCT FROM auth.uid() OR p_tenant_id IS NULL OR p_tenant_id IS DISTINCT FROM public.current_user_verified_tenant() THEN RAISE EXCEPTION ''OPS_SCOPE_CHANGED'' USING ERRCODE=''42501'';END IF;
 PERFORM public.workspace_require_module_write_v1(p_tenant_id,ARRAY[''staffing'']);
','write','
BEGIN
'),
 ('public.ops_comment_people(uuid,uuid,uuid)','8c6680fe26095270315d24fdec87b11a2f85ec6896b91ddbd8fa6e9465ab8bbf','
 IF auth.uid() IS NULL OR p_actor_id IS DISTINCT FROM auth.uid() OR p_tenant_id IS NULL OR p_tenant_id IS DISTINCT FROM public.current_user_verified_tenant() THEN RAISE EXCEPTION ''OPS_SCOPE_CHANGED'' USING ERRCODE=''42501'';END IF;
 PERFORM public.workspace_require_module_read_v1(p_tenant_id,ARRAY[''staffing'']);
','read','
BEGIN
'),
 ('public.ops_comment_inbox_page(uuid,uuid,uuid)','ebf16d1f0b21d0578d2532845d5b197441ccea0b3bc764b43a117bf955aed3c5','
 IF auth.uid() IS NULL OR p_actor_id IS DISTINCT FROM auth.uid() OR p_tenant_id IS NULL OR p_tenant_id IS DISTINCT FROM public.current_user_verified_tenant() THEN RAISE EXCEPTION ''OPS_SCOPE_CHANGED'' USING ERRCODE=''42501'';END IF;
 PERFORM public.workspace_require_module_read_v1(p_tenant_id,ARRAY[''staffing'']);
','read','
BEGIN
'),
 ('public.ops_comment_resolve(uuid,uuid,uuid,uuid,text,uuid,uuid[])','c3028c3c9dc0de2bdc77780a4c312ad938cb86e4d2cd44415a058da589acba54','
 IF auth.uid() IS NULL OR p_actor_id IS DISTINCT FROM auth.uid() OR p_tenant_id IS NULL OR p_tenant_id IS DISTINCT FROM public.current_user_verified_tenant() THEN RAISE EXCEPTION ''OPS_SCOPE_CHANGED'' USING ERRCODE=''42501'';END IF;
 PERFORM public.workspace_require_module_write_v1(p_tenant_id,ARRAY[''staffing'']);
','write','
BEGIN
'),
 ('public.ops_update_location(uuid,uuid,uuid,uuid,uuid,integer,text,text)','5121fd404b24b30fc3794d7429cbceb4709e9051e0ed43bb77993f39ce711b2d','
 IF auth.uid() IS NULL OR p_actor_id IS DISTINCT FROM auth.uid() OR p_tenant_id IS NULL OR p_tenant_id IS DISTINCT FROM public.current_user_verified_tenant() THEN RAISE EXCEPTION ''OPS_SCOPE_CHANGED'' USING ERRCODE=''42501'';END IF;
 PERFORM public.workspace_require_module_write_v1(p_tenant_id,ARRAY[''staffing'']);
','write','
BEGIN
'),
 ('public.ops_record_replacement_outreach(uuid,uuid,uuid,uuid,uuid,integer,text,text)','9d8ac19ca26a0e2dfb22ec8440e132debc92645114b6f28e6b87df0d9423c30b','
 IF auth.uid() IS NULL OR p_actor_id IS DISTINCT FROM auth.uid() OR p_tenant_id IS NULL OR p_tenant_id IS DISTINCT FROM public.current_user_verified_tenant() THEN RAISE EXCEPTION ''OPS_SCOPE_CHANGED'' USING ERRCODE=''42501'';END IF;
 PERFORM public.workspace_require_module_write_v1(p_tenant_id,ARRAY[''staffing'']);
','write','
BEGIN
'),
 ('public.ops_replacement_outreach_history(uuid,uuid,uuid,integer)','091b835af2126a11398d336f1b79b0bd87cc56b9d258d78797527eedc8db3793','
 IF auth.uid() IS NULL OR p_actor_id IS DISTINCT FROM auth.uid() OR p_tenant_id IS NULL OR p_tenant_id IS DISTINCT FROM public.current_user_verified_tenant() THEN RAISE EXCEPTION ''OPS_SCOPE_CHANGED'' USING ERRCODE=''42501'';END IF;
 PERFORM public.workspace_require_module_read_v1(p_tenant_id,ARRAY[''staffing'']);
','read','
BEGIN
'),
 ('public.ops_replacement_outreach_latest(uuid,uuid,uuid,uuid)','e156312b4da76cb01f81dc2a7d48b13bce821861969b3e009ceae40482c23399','
 IF auth.uid() IS NULL OR p_actor_id IS DISTINCT FROM auth.uid() OR p_tenant_id IS NULL OR p_tenant_id IS DISTINCT FROM public.current_user_verified_tenant() THEN RAISE EXCEPTION ''OPS_SCOPE_CHANGED'' USING ERRCODE=''42501'';END IF;
 PERFORM public.workspace_require_module_read_v1(p_tenant_id,ARRAY[''staffing'']);
','read','
BEGIN
'),
 ('public.ops_work_record_execute(uuid,uuid,uuid,uuid,integer,text,jsonb)','f5c3987690063ee051ac4d8216efe63dad448b477ef60eacfa4fcbb5c64cfe48','
 IF auth.uid() IS NULL OR p_actor_id IS DISTINCT FROM auth.uid() OR p_tenant_id IS NULL OR p_tenant_id IS DISTINCT FROM public.current_user_verified_tenant() THEN RAISE EXCEPTION ''OPS_SCOPE_CHANGED'' USING ERRCODE=''42501'';END IF;
 PERFORM public.workspace_require_module_write_v1(p_tenant_id,ARRAY[''staffing'']);
','write','
BEGIN
'),
 ('public.ops_work_record_read(uuid,uuid,uuid)','7897c45aab830bdc0b676802ceaa469938d89d375554e87d8c9940c64506e369','
 IF auth.uid() IS NULL OR p_actor_id IS DISTINCT FROM auth.uid() OR p_tenant_id IS NULL OR p_tenant_id IS DISTINCT FROM public.current_user_verified_tenant() THEN RAISE EXCEPTION ''OPS_SCOPE_CHANGED'' USING ERRCODE=''42501'';END IF;
 PERFORM public.workspace_require_module_read_v1(p_tenant_id,ARRAY[''staffing'']);
','read','
BEGIN
'),
 ('public.ops_work_record_list(uuid,uuid,uuid,date)','a91d31410ba5be40ad1862d1f5510f3db99041b058ccdcf3075aec43e5ec7808','
 IF auth.uid() IS NULL OR p_actor_id IS DISTINCT FROM auth.uid() OR p_tenant_id IS NULL OR p_tenant_id IS DISTINCT FROM public.current_user_verified_tenant() THEN RAISE EXCEPTION ''OPS_SCOPE_CHANGED'' USING ERRCODE=''42501'';END IF;
 PERFORM public.workspace_require_module_read_v1(p_tenant_id,ARRAY[''staffing'']);
','read','
BEGIN
'),
 ('public.ops_idp_read(uuid,uuid,uuid)','1553819777002cec32ca0a94eafa118b2fec48b9e72d47b55721ce49f7dac881','
 IF auth.uid() IS NULL OR p_actor_id IS DISTINCT FROM auth.uid() OR p_tenant_id IS NULL OR p_tenant_id IS DISTINCT FROM public.current_user_verified_tenant() THEN RAISE EXCEPTION ''OPS_SCOPE_CHANGED'' USING ERRCODE=''42501'';END IF;
 PERFORM public.workspace_require_module_read_v1(p_tenant_id,ARRAY[''staffing'']);
','read','
BEGIN
'),
 ('public.ops_idp_save(uuid,uuid,uuid,uuid,integer,text,date,date)','af921df4cb78de47681a21c6889295a010e5cd3b60f055f564080878a33e0aef','
 IF auth.uid() IS NULL OR p_actor_id IS DISTINCT FROM auth.uid() OR p_tenant_id IS NULL OR p_tenant_id IS DISTINCT FROM public.current_user_verified_tenant() THEN RAISE EXCEPTION ''OPS_SCOPE_CHANGED'' USING ERRCODE=''42501'';END IF;
 PERFORM public.workspace_require_module_write_v1(p_tenant_id,ARRAY[''staffing'']);
','write','
BEGIN
'),
 ('public.ops_idp_period_create(uuid,uuid,uuid,jsonb)','4808f94487175dcaeffc74846a08b203fb44e8558310898ab198704122d3e4b7','
 IF auth.uid() IS NULL OR p_actor_id IS DISTINCT FROM auth.uid() OR p_tenant_id IS NULL OR p_tenant_id IS DISTINCT FROM public.current_user_verified_tenant() THEN RAISE EXCEPTION ''OPS_SCOPE_CHANGED'' USING ERRCODE=''42501'';END IF;
 PERFORM public.workspace_require_module_write_v1(p_tenant_id,ARRAY[''staffing'']);
','write','
BEGIN
'),
 ('public.ops_idp_period_read(uuid,uuid,uuid)','74b36d35c5941ca309f5891c5668f3462c64880bc2f13560c2ad8e576af30b7c','
 IF auth.uid() IS NULL OR p_actor_id IS DISTINCT FROM auth.uid() OR p_tenant_id IS NULL OR p_tenant_id IS DISTINCT FROM public.current_user_verified_tenant() THEN RAISE EXCEPTION ''OPS_SCOPE_CHANGED'' USING ERRCODE=''42501'';END IF;
 PERFORM public.workspace_require_module_read_v1(p_tenant_id,ARRAY[''staffing'']);
','read','
BEGIN
'),
 ('public.ops_idp_period_manage(uuid,uuid,uuid,uuid,integer,jsonb)','44a04b9dd43825d082556b3ad94358a9147d246b32f4358d6c71484761889e2a','
 IF auth.uid() IS NULL OR p_actor_id IS DISTINCT FROM auth.uid() OR p_tenant_id IS NULL OR p_tenant_id IS DISTINCT FROM public.current_user_verified_tenant() THEN RAISE EXCEPTION ''OPS_SCOPE_CHANGED'' USING ERRCODE=''42501'';END IF;
 PERFORM public.workspace_require_module_write_v1(p_tenant_id,ARRAY[''staffing'']);
','write','
BEGIN
'),
 ('public.ops_idp_period_history(uuid,uuid,uuid,integer)','81af77f02fa3c474b35451db6a483e6e7ac7c6f8ebdaf5d116f4b664732e9017','
 IF auth.uid() IS NULL OR p_actor_id IS DISTINCT FROM auth.uid() OR p_tenant_id IS NULL OR p_tenant_id IS DISTINCT FROM public.current_user_verified_tenant() THEN RAISE EXCEPTION ''OPS_SCOPE_CHANGED'' USING ERRCODE=''42501'';END IF;
 PERFORM public.workspace_require_module_read_v1(p_tenant_id,ARRAY[''staffing'']);
','read','
BEGIN
'),
 ('public.ops_fixed_roster_save(uuid,uuid,uuid,uuid,integer,uuid,uuid,uuid,text,text,date,date,text,boolean)','b22cda47ac3c438a44589cd3ebb8d4077fb4b0a12506473f018a373766eba90f','
 IF auth.uid() IS NULL OR p_actor_id IS DISTINCT FROM auth.uid() OR p_tenant_id IS NULL OR p_tenant_id IS DISTINCT FROM public.current_user_verified_tenant() THEN RAISE EXCEPTION ''OPS_SCOPE_CHANGED'' USING ERRCODE=''42501'';END IF;
 PERFORM public.workspace_require_module_write_v1(p_tenant_id,ARRAY[''staffing'']);
','write','
BEGIN
'),
 ('public.ops_fixed_roster_list(uuid,uuid,uuid,uuid,date,integer,boolean)','a9ec84dd8ffb12b2d93f9a55a3472a5721ff2a5856fa205c449697f634808ded','
 IF auth.uid() IS NULL OR p_actor_id IS DISTINCT FROM auth.uid() OR p_tenant_id IS NULL OR p_tenant_id IS DISTINCT FROM public.current_user_verified_tenant() THEN RAISE EXCEPTION ''OPS_SCOPE_CHANGED'' USING ERRCODE=''42501'';END IF;
 PERFORM public.workspace_require_module_read_v1(p_tenant_id,ARRAY[''staffing'']);
','read','
BEGIN
'),
 ('public.ops_fixed_roster_history(uuid,uuid,uuid,integer)','98d9bf4bc4b62d6fc54ac71e2bdc121cdb7b0f8b5e419c8523cb892cfc53ae57','
 IF auth.uid() IS NULL OR p_actor_id IS DISTINCT FROM auth.uid() OR p_tenant_id IS NULL OR p_tenant_id IS DISTINCT FROM public.current_user_verified_tenant() THEN RAISE EXCEPTION ''OPS_SCOPE_CHANGED'' USING ERRCODE=''42501'';END IF;
 PERFORM public.workspace_require_module_read_v1(p_tenant_id,ARRAY[''staffing'']);
','read','
BEGIN
'),
 ('public.ops_fixed_roster_idp_create(uuid,uuid,uuid,uuid,integer,date,date,jsonb)','6b51cf4664ca29698d11090810ed135d2234cd6a66f1b9ceed0df7e99e3e01d6','
 IF auth.uid() IS NULL OR p_actor_id IS DISTINCT FROM auth.uid() OR p_tenant_id IS NULL OR p_tenant_id IS DISTINCT FROM public.current_user_verified_tenant() THEN RAISE EXCEPTION ''OPS_SCOPE_CHANGED'' USING ERRCODE=''42501'';END IF;
 PERFORM public.workspace_require_module_write_v1(p_tenant_id,ARRAY[''staffing'']);
','write','
BEGIN
'),
 ('public.ops_create_timed_requests(uuid,uuid,uuid,jsonb)','d24e0f1daf1ef459732921bee7b5c3715a9d2efb78188fa1c5a7eabf44d9511b','
 IF auth.uid() IS NULL OR p_actor_id IS DISTINCT FROM auth.uid() OR p_tenant_id IS NULL OR p_tenant_id IS DISTINCT FROM public.current_user_verified_tenant() THEN RAISE EXCEPTION ''OPS_SCOPE_CHANGED'' USING ERRCODE=''42501'';END IF;
 PERFORM public.workspace_require_module_write_v1(p_tenant_id,ARRAY[''staffing'']);
','write','
BEGIN
'),
 ('public.ops_schedule_save(uuid,uuid,uuid,uuid,integer,jsonb,boolean)','459bef90b8c45551dbef1f06c6c11211a9a5325c656f76e50e0d06fc92a10d7d','
 IF auth.uid() IS NULL OR p_actor IS DISTINCT FROM auth.uid() OR p_tenant IS NULL OR p_tenant IS DISTINCT FROM public.current_user_verified_tenant() THEN RAISE EXCEPTION ''OPS_SCOPE_CHANGED'' USING ERRCODE=''42501'';END IF;
 PERFORM public.workspace_require_module_write_v1(p_tenant,ARRAY[''staffing'']);
','write','
BEGIN
'),
 ('public.ops_schedule_list(uuid,uuid,uuid,integer)','13918905e8a61d2405f1a0ea3228cf238cd528b4d4dbb7735ea07ef739978dc0','
 IF auth.uid() IS NULL OR p_actor IS DISTINCT FROM auth.uid() OR p_tenant IS NULL OR p_tenant IS DISTINCT FROM public.current_user_verified_tenant() THEN RAISE EXCEPTION ''OPS_SCOPE_CHANGED'' USING ERRCODE=''42501'';END IF;
 PERFORM public.workspace_require_module_write_v1(p_tenant,ARRAY[''staffing'']);
','write','
BEGIN
'),
 ('public.ops_schedule_preview(uuid,uuid,uuid,integer,date,date)','7e73c6a348a27826f38d4707c9cf564acbdf46901aba1bb8566a2b3ecf03f450','
 IF auth.uid() IS NULL OR p_actor IS DISTINCT FROM auth.uid() OR p_tenant IS NULL OR p_tenant IS DISTINCT FROM public.current_user_verified_tenant() THEN RAISE EXCEPTION ''OPS_SCOPE_CHANGED'' USING ERRCODE=''42501'';END IF;
 PERFORM public.workspace_require_module_write_v1(p_tenant,ARRAY[''staffing'']);
','write','
BEGIN '),
 ('public.ops_schedule_generate(uuid,uuid,uuid,uuid,integer,date,date)','3b57d0dda86fc161be69a5baba45e58e7af171dc436a89aee9dfe24ba3338773','
 IF auth.uid() IS NULL OR p_actor IS DISTINCT FROM auth.uid() OR p_tenant IS NULL OR p_tenant IS DISTINCT FROM public.current_user_verified_tenant() THEN RAISE EXCEPTION ''OPS_SCOPE_CHANGED'' USING ERRCODE=''42501'';END IF;
 PERFORM public.workspace_require_module_write_v1(p_tenant,ARRAY[''staffing'']);
','write','
BEGIN
')
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
