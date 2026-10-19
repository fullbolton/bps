BEGIN;
CREATE FUNCTION public.hr_import_review_v1(p_actor uuid,p_tenant uuid,p_rows jsonb) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE review jsonb;
BEGIN
 review:=public.hr_import_preview_v1(p_actor,p_tenant,p_rows);
 RETURN review||jsonb_build_object('token',md5(jsonb_build_object('input',p_rows,'review',review)::text));
END $$;
CREATE FUNCTION public.hr_import_commit_v1(p_actor uuid,p_tenant uuid,p_command uuid,p_source text,p_rows jsonb,p_token text,p_selected jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='5s' AS $$
DECLARE review jsonb;previous public.hr_commands;envelope jsonb;receipt jsonb;item jsonb;matched jsonb;row_no integer;employee_id uuid;person_id uuid;results jsonb:='[]';seen integer[]:='{}';
BEGIN
 IF current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION 'ACCESS_ISOLATION';END IF;
 PERFORM public.hr_access_mode_v1(p_actor,p_tenant);
 PERFORM 1 FROM public.tenant_module_config WHERE tenant_id=p_tenant FOR UPDATE;
 PERFORM 1 FROM public.profiles WHERE id=p_actor FOR SHARE;
 PERFORM 1 FROM public.tenants WHERE id=p_tenant FOR UPDATE;
 PERFORM 1 FROM public.tenant_memberships WHERE tenant_id=p_tenant AND user_id=p_actor FOR SHARE;
 review:=public.hr_import_review_v1(p_actor,p_tenant,p_rows);
 IF p_command IS NULL OR p_source IS NULL OR p_source!~'^[a-f0-9]{64}$' OR p_token IS NULL OR p_token!~'^[a-f0-9]{32}$'
 OR jsonb_typeof(p_selected) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'HR_INPUT';END IF;
 IF jsonb_array_length(p_selected) NOT BETWEEN 1 AND 200 THEN RAISE EXCEPTION 'HR_INPUT';END IF;
 envelope:=jsonb_build_object('operation','hr_import','source',p_source,'rows',p_rows,'token',p_token,'selected',p_selected);
 SELECT * INTO previous FROM public.hr_commands WHERE tenant_id=p_tenant AND actor_id=p_actor AND command_id=p_command;
 IF FOUND THEN
  IF previous.payload IS DISTINCT FROM envelope THEN RAISE EXCEPTION 'HR_COMMAND_REUSED';END IF;
  RETURN previous.result;
 END IF;
 IF review->>'token' IS DISTINCT FROM p_token THEN RAISE EXCEPTION 'HR_IMPORT_STALE';END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(p_selected) LOOP
  IF jsonb_typeof(item) IS DISTINCT FROM 'number' OR item::text!~'^[1-9][0-9]{0,5}$' THEN RAISE EXCEPTION 'HR_INPUT';END IF;
  row_no:=(item::text)::integer;
  IF row_no=ANY(seen) THEN RAISE EXCEPTION 'HR_INPUT';END IF;seen:=array_append(seen,row_no);
  SELECT value INTO matched FROM jsonb_array_elements(review->'rows') WHERE (value->>'row')::integer=row_no;
  IF NOT FOUND OR matched->>'status' NOT IN('new','changed') THEN RAISE EXCEPTION 'HR_IMPORT_DECISION';END IF;
 END LOOP;
 FOR item IN SELECT value FROM jsonb_array_elements(p_rows) LOOP
  row_no:=(item->>'row')::integer;
  IF NOT(row_no=ANY(seen)) THEN CONTINUE;END IF;
  SELECT value INTO matched FROM jsonb_array_elements(review->'rows') WHERE (value->>'row')::integer=row_no;
  IF matched->>'status'='new' THEN
   person_id:=gen_random_uuid();employee_id:=gen_random_uuid();
   INSERT INTO public.hr_people(id,tenant_id,name) VALUES(person_id,p_tenant,btrim(item->>'name'));
   INSERT INTO public.hr_employees(id,tenant_id,person_id,code) VALUES(employee_id,p_tenant,person_id,btrim(item->>'code'));
   INSERT INTO public.hr_employment_periods(id,tenant_id,employee_id,starts_on) VALUES(gen_random_uuid(),p_tenant,employee_id,(item->>'startsOn')::date);
  ELSE
   employee_id:=(matched->'existing'->>'employeeId')::uuid;
   SELECT e.person_id INTO person_id FROM public.hr_employees e WHERE e.tenant_id=p_tenant AND e.id=employee_id;
   UPDATE public.hr_people SET name=btrim(item->>'name'),revision=revision+1 WHERE tenant_id=p_tenant AND id=person_id;
   UPDATE public.hr_employees SET revision=revision+1 WHERE tenant_id=p_tenant AND id=employee_id;
  END IF;
  results:=results||jsonb_build_array(jsonb_build_object('row',row_no,'employeeId',employee_id,'action',CASE WHEN matched->>'status'='new' THEN 'created' ELSE 'updated' END));
 END LOOP;
 receipt:=jsonb_build_object('schemaVersion',1,'actorId',p_actor,'tenantId',p_tenant,'commandId',p_command,'source',p_source,'rows',results);
 INSERT INTO public.hr_commands(tenant_id,actor_id,command_id,payload,result) VALUES(p_tenant,p_actor,p_command,envelope,receipt||jsonb_build_object('before',review));
 RETURN receipt||jsonb_build_object('before',review);
END $$;
REVOKE ALL ON FUNCTION public.hr_import_review_v1(uuid,uuid,jsonb),public.hr_import_commit_v1(uuid,uuid,uuid,text,jsonb,text,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.hr_import_review_v1(uuid,uuid,jsonb),public.hr_import_commit_v1(uuid,uuid,uuid,text,jsonb,text,jsonb) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
