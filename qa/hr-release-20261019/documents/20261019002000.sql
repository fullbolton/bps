BEGIN; SET LOCAL statement_timeout='60s'; SET LOCAL lock_timeout='5s';
LOCK TABLE supabase_migrations.schema_migrations IN EXCLUSIVE MODE;
DO $guard$ BEGIN
IF (SELECT array_agg(version ORDER BY version) FROM supabase_migrations.schema_migrations) IS DISTINCT FROM ARRAY['20260407000000','20260407000100','20260407000200','20260407000300','20260407000400','20260407000500','20260407000600','20260407000700','20260407000800','20260407000900','20260407001000','20260407001100','20260407001600','20260407001700','20260407001800','20260413000100','20260414000100','20260414000200','20260415000100','20260415000200','20260415000300','20260415000400','20260415000500','20260423000100','20260425000100','20260425000200','20260713000100','20260713000200','20260722000100','20260810000100','20260810000200','20260827000100','20260827000200','20260827000300','20260827000400','20260904000100','20260904000200','20260909000100','20260909000200','20260909000300','20260909000400','20260909000500','20260909000600','20260909000700','20260909000800','20260909000900','20260909001000','20260909001100','20260909001200','20260909001300','20260909001400','20260909001500','20260909001600','20260909001700','20260909001800','20260909001900','20260909002000','20260909002100','20260909002200','20260909002300','20260909002400','20260909002500','20260909002600','20260909002700','20260909002800','20260909002900','20260910000100','20260910000200','20260910000300','20260910000400','20260911000100','20260913000100','20260914000100','20260914000200','20260914000300','20260914000400','20260914000500','20260914000600','20260914000700','20260915000100','20260915000200','20260915000300','20260915000400','20260915000500','20260915000600','20260915000700','20260915000800','20260915000900','20260915001000','20260923000100','20260923000200','20260923000300','20260923000400','20260924000100','20260924000200','20260924000300','20260924000400','20260924000500','20260925000100','20260925000200','20260925000300','20260925000400','20260925000500','20260925000600','20260925000700','20260926000100','20260926000200','20260927000100','20260927000200','20260927000300','20260927000400','20260927000500','20260927000600','20260927000700','20260927000800','20260927000900','20260928000100','20260928000200','20260928000300','20260928000400','20260928000500','20260928000600','20260928000700','20260928000800','20261004001000','20261004001100','20261004001200','20261004001300','20261004001400','20261005000100','20261005000200','20261005000300','20261005000400','20261005000500','20261005000600','20261005000700','20261005000800','20261005000900','20261005001000','20261005001100','20261005001200','20261005001300','20261005001400','20261005001500','20261005001600','20261005001700','20261005001800','20261005001900','20261005002000','20261005002100','20261005002200','20261005002300','20261005002400','20261005002500','20261005002600','20261005002700','20261005002800','20261005002900','20261005003000','20261005003100','20261013000100','20261013000200','20261013000300','20261015000100','20261015000200','20261015000300','20261015000400','20261015000500','20261015000600','20261015000700','20261015000800','20261016000100','20261016000200','20261016000300','20261016000400','20261016000500','20261016000600','20261016000700','20261016000800','20261016000900','20261016001000','20261016001100','20261017000100','20261017000200','20261018000100','20261018000200','20261018000300','20261018000400','20261018000500','20261018000600','20261019000100','20261019000200','20261019000300','20261019000400','20261019000500','20261019000600','20261019000700','20261019000800','20261019000900','20261019001000','20261019001100','20261019001200','20261019001300','20261019001400','20261019001500','20261019001600','20261019001700','20261019001800','20261019001900']::text[] THEN RAISE EXCEPTION 'LIVE_LEDGER_CHANGED'; END IF;
IF to_regnamespace('bps_release_guard') IS NOT NULL THEN RAISE EXCEPTION 'RELEASE_BARRIER_PRESENT'; END IF;
END $guard$;
-- Bounded, read-only comparison. Does not import, merge, or rehire employees.

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

INSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES('20261019002000','hr_import_preview',ARRAY[$bps_source$-- Bounded, read-only comparison. Does not import, merge, or rehire employees.
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
$bps_source$]);
COMMIT;
