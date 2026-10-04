-- Historical talent conversations remain readable; live staffing context is optional.
BEGIN;
SET LOCAL lock_timeout='15s';
DO $patch$
DECLARE item record;target regprocedure;original text;definition text;
BEGIN
 FOR item IN SELECT * FROM (VALUES
('public.talent_conversation_list(uuid,uuid,uuid,integer)','f8a7b2d93c6ef9377ce5ae1087f21bbd704ae916342296fa595c286a01f7175b','
DECLARE rows jsonb;result jsonb;
BEGIN

 PERFORM public.talent_assert_scope(p_actor_id,p_tenant_id);
 PERFORM public.workspace_require_module_read_v1(p_tenant_id,ARRAY[''talent'']);
 rows:=public.talent_conversation_list_base(p_actor_id,p_tenant_id,p_person_id,p_offset);
 IF NOT (public.current_workspace_modules_v1()->''modules''->>''staffing'')::boolean THEN
  SELECT coalesce(jsonb_agg((e.value-''requestContext'')||jsonb_build_object(''requestContext'',NULL,''requestContextHidden'',e.value->>''requestId'' IS NOT NULL) ORDER BY e.n),''[]'') INTO result
  FROM jsonb_array_elements(rows) WITH ORDINALITY e(value,n);
  RETURN result;
 END IF;
 SELECT coalesce(jsonb_agg(e.value||jsonb_build_object(''requestContextHidden'',false,''requestContext'',CASE WHEN r.id IS NULL THEN NULL ELSE jsonb_build_object(''companyId'',r.company_id,''workDate'',r.work_date,''companyName'',c.name,''locationName'',l.name,''position'',r.position) END) ORDER BY e.n),''[]'') INTO result
 FROM jsonb_array_elements(rows) WITH ORDINALITY e(value,n)
 LEFT JOIN public.ops_daily_requests r ON r.id=(e.value->>''requestId'')::uuid AND r.tenant_id=p_tenant_id
 LEFT JOIN public.companies c ON c.id=r.company_id AND c.tenant_id=p_tenant_id
 LEFT JOIN public.ops_locations l ON l.id=r.location_id AND l.tenant_id=p_tenant_id;
 RETURN result;
END '),
('public.talent_conversation_save(uuid,uuid,jsonb)','72052a5bb6108282df35eab37d59911acc4af7f8846b276e1d02ad79a90e2e85','
DECLARE v public.talent_conversations; v_person uuid; v_request uuid; v_command uuid;
BEGIN

 PERFORM public.talent_assert_scope(p_actor_id,p_tenant_id);
 PERFORM public.workspace_require_module_write_v1(p_tenant_id,ARRAY[''talent'']);
 IF p_input->>''requestId'' IS NOT NULL THEN
  PERFORM public.workspace_require_module_write_v1(p_tenant_id,ARRAY[''staffing'']);
 END IF;
 PERFORM public.talent_assert_scope(p_actor_id,p_tenant_id);
 IF jsonb_typeof(p_input) IS DISTINCT FROM ''object'' OR
 (SELECT count(*) FROM jsonb_object_keys(p_input))<>6 OR
 NOT(p_input ?& ARRAY[''commandId'',''personId'',''requestId'',''channel'',''outcome'',''note'']) OR
 jsonb_typeof(p_input->''commandId'') IS DISTINCT FROM ''string'' OR
 jsonb_typeof(p_input->''personId'') IS DISTINCT FROM ''string'' OR
 jsonb_typeof(p_input->''requestId'') NOT IN (''string'',''null'') OR
 jsonb_typeof(p_input->''note'') IS DISTINCT FROM ''string'' OR
 coalesce(p_input->>''channel'','''') NOT IN (''phone'',''message'',''in_person'') OR
 coalesce(p_input->>''outcome'','''') NOT IN (''reached'',''no_answer'',''call_back'',''declined'') OR
 length(p_input->>''note'')>2000 OR translate(p_input->>''note'',E''\n\r\t'','''') ~ ''[[:cntrl:]]'' THEN RAISE EXCEPTION ''CONVERSATION_VALIDATION''; END IF;
 v_person:=(p_input->>''personId'')::uuid;v_request:=(p_input->>''requestId'')::uuid;v_command:=(p_input->>''commandId'')::uuid;
 IF p_input->>''outcome''=''declined'' AND v_request IS NULL THEN RAISE EXCEPTION ''CONVERSATION_REQUEST_REQUIRED''; END IF;
 PERFORM 1 FROM public.talent_people WHERE tenant_id=p_tenant_id AND id=v_person;
 IF NOT FOUND THEN RAISE EXCEPTION ''TALENT_NOT_FOUND''; END IF;
 IF v_request IS NOT NULL THEN
  PERFORM 1 FROM public.ops_daily_requests WHERE tenant_id=p_tenant_id AND id=v_request;
  IF NOT FOUND THEN RAISE EXCEPTION ''CONVERSATION_REQUEST_NOT_FOUND''; END IF;
 END IF;
 INSERT INTO public.talent_conversations(tenant_id,person_id,request_id,actor_id,command_id,channel,outcome,note)
 VALUES(p_tenant_id,v_person,v_request,p_actor_id,v_command,p_input->>''channel'',p_input->>''outcome'',btrim(p_input->>''note''))
 ON CONFLICT(tenant_id,actor_id,command_id) DO NOTHING;
 SELECT * INTO STRICT v FROM public.talent_conversations WHERE tenant_id=p_tenant_id AND actor_id=p_actor_id AND command_id=v_command;
 IF v.person_id<>v_person OR v.request_id IS DISTINCT FROM v_request OR v.channel<>p_input->>''channel'' OR v.outcome<>p_input->>''outcome'' OR v.note<>btrim(p_input->>''note'') THEN RAISE EXCEPTION ''TALENT_COMMAND''; END IF;
 RETURN jsonb_build_object(''id'',v.id,''tenantId'',v.tenant_id,''personId'',v.person_id,''requestId'',v.request_id,''actorId'',v.actor_id,''commandId'',v.command_id,''channel'',v.channel,''outcome'',v.outcome,''note'',v.note,''recordedAt'',v.recorded_at);
END ')
 ) AS patches(signature,hash,body) LOOP
  target:=to_regprocedure(item.signature);
  IF target IS NULL OR NOT EXISTS(SELECT FROM pg_proc p JOIN pg_language l ON l.oid=p.prolang WHERE p.oid=target AND p.prosecdef AND l.lanname='plpgsql') THEN RAISE EXCEPTION 'CONVERSATION_MODULE_SIGNATURE_DRIFT';END IF;
  SELECT prosrc INTO original FROM pg_proc WHERE oid=target;
  IF encode(sha256(convert_to(original,'UTF8')),'hex')<>item.hash THEN RAISE EXCEPTION 'CONVERSATION_MODULE_BODY_DRIFT';END IF;
  definition:=pg_get_functiondef(target);
  IF strpos(definition,original)=0 THEN RAISE EXCEPTION 'CONVERSATION_MODULE_ANCHOR_DRIFT';END IF;
  EXECUTE replace(definition,original,item.body);
 END LOOP;
END $patch$;
COMMIT;
