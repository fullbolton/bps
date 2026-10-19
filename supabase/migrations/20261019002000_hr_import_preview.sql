-- Bounded, read-only comparison. Does not import, merge, or rehire employees.
BEGIN;
CREATE FUNCTION public.hr_import_preview_v1(p_actor uuid,p_tenant uuid,p_rows jsonb) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE item jsonb;rows jsonb:='[]';seen text[]:='{}';v_code text;v_name text;v_start date;v_row integer;employee public.hr_employees;person public.hr_people;period public.hr_employment_periods;current_name text;status text;
BEGIN
 PERFORM public.hr_assert_access(p_actor,p_tenant);
 IF public.current_user_role() IS DISTINCT FROM 'yonetici' THEN RAISE EXCEPTION 'HR_MANAGER_REQUIRED';END IF;
 IF jsonb_typeof(p_rows) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'HR_INPUT';END IF;
 IF jsonb_array_length(p_rows) NOT BETWEEN 1 AND 200 THEN RAISE EXCEPTION 'HR_INPUT';END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(p_rows) LOOP
  IF jsonb_typeof(item) IS DISTINCT FROM 'object' OR item-ARRAY['row','code','name','startsOn']<>'{}' OR NOT(item ?& ARRAY['row','code','name','startsOn'])
  OR jsonb_typeof(item->'row') IS DISTINCT FROM 'number' OR (item->>'row')!~'^[1-9][0-9]{0,5}$'
  OR jsonb_typeof(item->'code') IS DISTINCT FROM 'string' OR jsonb_typeof(item->'name') IS DISTINCT FROM 'string' OR jsonb_typeof(item->'startsOn') IS DISTINCT FROM 'string' THEN RAISE EXCEPTION 'HR_INPUT';END IF;
  v_row:=(item->>'row')::integer;v_code:=btrim(item->>'code');v_name:=btrim(item->>'name');v_start:=NULL;
  IF length(v_code) NOT BETWEEN 1 AND 40 OR length(v_name)>160 OR (v_code||v_name)~'[0-9]{11}' THEN RAISE EXCEPTION 'HR_INPUT';END IF;
  IF EXISTS(SELECT FROM jsonb_array_elements(rows) r WHERE (r->>'row')::integer=v_row) THEN RAISE EXCEPTION 'HR_INPUT';END IF;
  IF item->>'startsOn'<>'' THEN
   IF item->>'startsOn'!~'^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN RAISE EXCEPTION 'HR_INPUT';END IF;
   BEGIN v_start:=(item->>'startsOn')::date;EXCEPTION WHEN datetime_field_overflow OR invalid_datetime_format THEN RAISE EXCEPTION 'HR_INPUT';END;
   IF v_start NOT BETWEEN DATE '1900-01-01' AND DATE '2199-12-31' THEN RAISE EXCEPTION 'HR_INPUT';END IF;
  END IF;
  IF lower(v_code)=ANY(seen) THEN RAISE EXCEPTION 'HR_IMPORT_DUPLICATE_CODE';END IF;seen:=array_append(seen,lower(v_code));
  SELECT * INTO employee FROM public.hr_employees WHERE tenant_id=p_tenant AND lower(code)=lower(v_code);
  IF NOT FOUND THEN
   status:=CASE WHEN v_name='' OR v_start IS NULL THEN 'incomplete' ELSE 'new' END;
   rows:=rows||jsonb_build_array(jsonb_build_object('row',v_row,'code',v_code,'status',status,'existing',NULL));
  ELSE
   SELECT * INTO person FROM public.hr_people WHERE tenant_id=p_tenant AND id=employee.person_id;
   current_name:=coalesce(person.name,(SELECT name FROM public.talent_people WHERE tenant_id=p_tenant AND id=person.talent_person_id));
   SELECT * INTO period FROM public.hr_employment_periods WHERE tenant_id=p_tenant AND employee_id=employee.id ORDER BY starts_on DESC,id DESC LIMIT 1;
   status:=CASE WHEN period.id IS NULL OR period.ends_on IS NOT NULL OR (v_start IS NOT NULL AND v_start IS DISTINCT FROM period.starts_on) THEN 'review'
    WHEN v_name<>'' AND v_name IS DISTINCT FROM current_name THEN CASE WHEN person.talent_person_id IS NULL THEN 'changed' ELSE 'review' END ELSE 'same' END;
   rows:=rows||jsonb_build_array(jsonb_build_object('row',v_row,'code',v_code,'status',status,'existing',jsonb_build_object('employeeId',employee.id,'name',current_name,'code',employee.code,'startsOn',period.starts_on,'endsOn',period.ends_on,'employeeRevision',employee.revision::text,'personRevision',person.revision::text,'linkedPerson',person.talent_person_id IS NOT NULL)));
  END IF;
 END LOOP;
 RETURN jsonb_build_object('schemaVersion',1,'actorId',p_actor,'tenantId',p_tenant,'rows',rows);
END $$;
REVOKE ALL ON FUNCTION public.hr_import_preview_v1(uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.hr_import_preview_v1(uuid,uuid,jsonb) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
