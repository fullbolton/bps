-- Candidate filters. Apply before the matching UI release; no guessed demographic backfill.
BEGIN;
SET LOCAL lock_timeout='5s';
ALTER TABLE public.talent_people ADD COLUMN gender text CHECK(gender IN ('female','male','other')),
 ADD COLUMN birth_date date CHECK(birth_date>=date '1900-01-01');
CREATE OR REPLACE FUNCTION public.talent_person_json(p public.talent_people) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('id',p.id,'tenantId',p.tenant_id,'name',p.name,'city',p.city,'district',p.district,
  'gender',p.gender,'birthDate',p.birth_date,'contacts',p.contacts,'skills',p.skills,'regions',p.regions,'workTypes',p.work_types,'revision',p.revision,
  'workerId',p.worker_id,'workerCode',w.code,'workerActive',w.active,'source',p.source,
  'createdAt',p.created_at,'updatedAt',p.updated_at)
 FROM (VALUES(1)) dummy(n) LEFT JOIN public.ops_workers w ON w.tenant_id=p.tenant_id AND w.id=p.worker_id
$$;

CREATE OR REPLACE FUNCTION public.talent_save_person(p_actor_id uuid,p_tenant_id uuid,p_command_id uuid,p_person_id uuid,p_expected_revision integer,p_input jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='3s' AS $$
DECLARE v_cmd public.talent_person_commands; v_old public.talent_people; v_row public.talent_people;
 v_payload jsonb; v_result jsonb; v_contact jsonb; v_key text; v_worker uuid; v_changed text[]:='{}';
 v_gender text; v_birth date;
 v_name text; v_city text; v_district text; v_contacts jsonb; v_skills text[]; v_regions text[]; v_types text[];
BEGIN
 -- Match existing admin/operation lock order: actor profile, membership, worker, person.
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'TALENT_SCOPE'; END IF;
 PERFORM 1 FROM public.profiles WHERE id=auth.uid() FOR SHARE;
 PERFORM 1 FROM public.tenant_memberships WHERE user_id=auth.uid() AND tenant_id=p_tenant_id FOR SHARE;
 PERFORM public.talent_assert_scope(p_actor_id,p_tenant_id);
 IF p_command_id IS NULL OR (p_person_id IS NULL AND p_expected_revision IS NOT NULL)
  OR (p_person_id IS NOT NULL AND (p_expected_revision IS NULL OR p_expected_revision NOT BETWEEN 0 AND 2147483646))
  OR p_input IS NULL OR jsonb_typeof(p_input)<>'object' OR octet_length(p_input::text)>16384
  OR (p_input - ARRAY['name','city','district','contacts','skills','regions','workTypes','gender','birthDate'])<>'{}'
  OR jsonb_typeof(p_input->'name') IS DISTINCT FROM 'string' OR length(btrim(p_input->>'name')) NOT BETWEEN 1 AND 160
  OR p_input->>'name' ~ '[[:cntrl:]]' THEN RAISE EXCEPTION 'TALENT_VALIDATION'; END IF;
 FOREACH v_key IN ARRAY ARRAY['city','district'] LOOP
  IF NOT (p_input ? v_key) OR jsonb_typeof(p_input->v_key) NOT IN ('string','null')
   OR (p_input->v_key<>'null'::jsonb AND (length(btrim(p_input->>v_key)) NOT BETWEEN 1 AND 80 OR p_input->>v_key ~ '[[:cntrl:]]'))
  THEN RAISE EXCEPTION 'TALENT_VALIDATION'; END IF;
 END LOOP;
 IF jsonb_typeof(p_input->'contacts') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'TALENT_VALIDATION'; END IF;
 IF jsonb_array_length(p_input->'contacts')>10 THEN RAISE EXCEPTION 'TALENT_VALIDATION'; END IF;
 FOR v_contact IN SELECT value FROM jsonb_array_elements(p_input->'contacts') LOOP
  IF jsonb_typeof(v_contact)<>'object' OR (v_contact-ARRAY['kind','value'])<>'{}'
   OR coalesce(v_contact->>'kind','') NOT IN ('phone','email') OR jsonb_typeof(v_contact->'value') IS DISTINCT FROM 'string'
   OR v_contact->>'value' ~ '[[:cntrl:]]'
   OR (v_contact->>'kind'='phone' AND btrim(v_contact->>'value') !~ '^\+?[0-9][0-9 ()-]{5,29}$')
   OR (v_contact->>'kind'='email' AND (length(v_contact->>'value')>254 OR btrim(v_contact->>'value') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'))
  THEN RAISE EXCEPTION 'TALENT_VALIDATION'; END IF;
 END LOOP;
 FOREACH v_key IN ARRAY ARRAY['skills','regions','workTypes'] LOOP
  IF jsonb_typeof(p_input->v_key) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'TALENT_VALIDATION'; END IF;
  IF jsonb_array_length(p_input->v_key)>20 OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_input->v_key) x
   WHERE jsonb_typeof(x)<>'string' OR length(btrim(x#>>'{}')) NOT BETWEEN 1 AND 80 OR x#>>'{}' ~ '[[:cntrl:]]') THEN RAISE EXCEPTION 'TALENT_VALIDATION'; END IF;
 END LOOP;
 IF p_input ? 'gender' AND (jsonb_typeof(p_input->'gender') NOT IN ('string','null') OR coalesce(p_input->>'gender','female') NOT IN ('female','male','other')) THEN RAISE EXCEPTION 'TALENT_VALIDATION'; END IF;
 IF p_input ? 'birthDate' AND p_input->'birthDate'<>'null'::jsonb THEN
  IF jsonb_typeof(p_input->'birthDate')<>'string' OR (p_input->>'birthDate') !~ '^\d{4}-\d{2}-\d{2}$' THEN RAISE EXCEPTION 'TALENT_VALIDATION'; END IF;
  BEGIN v_birth:=(p_input->>'birthDate')::date; EXCEPTION WHEN datetime_field_overflow OR invalid_datetime_format THEN RAISE EXCEPTION 'TALENT_VALIDATION'; END;
  IF v_birth<date '1900-01-01' OR v_birth>(now() AT TIME ZONE 'Europe/Istanbul')::date THEN RAISE EXCEPTION 'TALENT_VALIDATION'; END IF;
 END IF;
 v_gender:=p_input->>'gender';
 v_name:=btrim(p_input->>'name');v_city:=p_input->>'city';v_district:=p_input->>'district';
 SELECT coalesce(jsonb_agg(jsonb_build_object('kind',x->>'kind','value',btrim(x->>'value'))),'[]') INTO v_contacts FROM jsonb_array_elements(p_input->'contacts') x;
 SELECT coalesce(array_agg(DISTINCT btrim(x)),'{}') INTO v_skills FROM jsonb_array_elements_text(p_input->'skills') x;
 SELECT coalesce(array_agg(DISTINCT btrim(x)),'{}') INTO v_regions FROM jsonb_array_elements_text(p_input->'regions') x;
 SELECT coalesce(array_agg(DISTINCT x),'{}') INTO v_types FROM jsonb_array_elements_text(p_input->'workTypes') x;
 IF NOT v_types <@ ARRAY['idp','sabit','donemsel']::text[] THEN RAISE EXCEPTION 'TALENT_VALIDATION'; END IF;
 v_payload:=jsonb_build_object('personId',p_person_id,'revision',p_expected_revision,'input',p_input);
 INSERT INTO public.talent_person_commands(tenant_id,actor_id,command_id,payload) VALUES(p_tenant_id,p_actor_id,p_command_id,v_payload) ON CONFLICT DO NOTHING;
 SELECT * INTO v_cmd FROM public.talent_person_commands WHERE tenant_id=p_tenant_id AND actor_id=p_actor_id AND command_id=p_command_id FOR UPDATE;
 IF v_cmd.payload<>v_payload THEN RAISE EXCEPTION 'TALENT_COMMAND'; END IF;
 IF v_cmd.result IS NOT NULL THEN RETURN v_cmd.result; END IF;
 IF p_person_id IS NULL THEN
  INSERT INTO public.talent_people(id,tenant_id,name,city,district,contacts,skills,regions,work_types,gender,birth_date,source)
   VALUES(p_command_id,p_tenant_id,v_name,btrim(v_city),btrim(v_district),v_contacts,v_skills,v_regions,v_types,v_gender,v_birth,'manual') RETURNING * INTO v_row;
  v_changed:=ARRAY['name','contacts','city','district','skills','regions','workTypes','gender','birthDate'];
 ELSE
  SELECT worker_id INTO v_worker FROM public.talent_people WHERE tenant_id=p_tenant_id AND id=p_person_id;
  IF v_worker IS NOT NULL THEN PERFORM 1 FROM public.ops_workers WHERE tenant_id=p_tenant_id AND id=v_worker FOR UPDATE; END IF;
  SELECT * INTO v_old FROM public.talent_people WHERE tenant_id=p_tenant_id AND id=p_person_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'TALENT_NOT_FOUND'; END IF;
  IF v_old.revision<>p_expected_revision THEN RAISE EXCEPTION 'TALENT_CONFLICT'; END IF;
  -- Old clients and import payloads omit these fields: preserve stored values under the person lock.
  IF NOT (p_input ? 'gender') THEN v_gender:=v_old.gender; END IF;
  IF NOT (p_input ? 'birthDate') THEN v_birth:=v_old.birth_date; END IF;
  IF v_old.gender IS DISTINCT FROM v_gender THEN v_changed:=array_append(v_changed,'gender'); END IF;
  IF v_old.birth_date IS DISTINCT FROM v_birth THEN v_changed:=array_append(v_changed,'birthDate'); END IF;
  IF v_old.name IS DISTINCT FROM v_name THEN v_changed:=array_append(v_changed,'name'); END IF;
  IF v_old.city IS DISTINCT FROM btrim(v_city) THEN v_changed:=array_append(v_changed,'city'); END IF;
  IF v_old.district IS DISTINCT FROM btrim(v_district) THEN v_changed:=array_append(v_changed,'district'); END IF;
  IF v_old.contacts IS DISTINCT FROM v_contacts THEN v_changed:=array_append(v_changed,'contacts'); END IF;
  IF v_old.skills IS DISTINCT FROM v_skills THEN v_changed:=array_append(v_changed,'skills'); END IF;
  IF v_old.regions IS DISTINCT FROM v_regions THEN v_changed:=array_append(v_changed,'regions'); END IF;
  IF v_old.work_types IS DISTINCT FROM v_types THEN v_changed:=array_append(v_changed,'workTypes'); END IF;
  UPDATE public.talent_people SET name=v_name,city=btrim(v_city),district=btrim(v_district),contacts=v_contacts,
   skills=v_skills,regions=v_regions,work_types=v_types,gender=v_gender,birth_date=v_birth,revision=revision+1,updated_at=now()
   WHERE tenant_id=p_tenant_id AND id=p_person_id RETURNING * INTO v_row;
  IF v_worker IS NOT NULL AND v_old.name IS DISTINCT FROM v_name THEN
   UPDATE public.ops_workers SET name=v_name,directory_revision=directory_revision+1 WHERE tenant_id=p_tenant_id AND id=v_worker;
  END IF;
 END IF;
 INSERT INTO public.talent_person_events(tenant_id,person_id,actor_id,kind,revision,changed_fields)
  VALUES(p_tenant_id,v_row.id,p_actor_id,CASE WHEN p_person_id IS NULL THEN 'created' ELSE 'updated' END,v_row.revision,v_changed);
 v_result:=jsonb_build_object('id',v_row.id,'commandId',p_command_id,'revision',v_row.revision);
 UPDATE public.talent_person_commands SET result=v_result WHERE tenant_id=p_tenant_id AND actor_id=p_actor_id AND command_id=p_command_id;
 RETURN v_result;
END $$;

CREATE OR REPLACE FUNCTION public.talent_people_page(p_actor_id uuid,p_tenant_id uuid,p_query jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_district text; v_gender text; v_age_min integer; v_age_max integer; v_type text; v_today date:=(now() AT TIME ZONE 'Europe/Istanbul')::date; v_search text; v_city text; v_skill text; v_view text; v_offset integer; v_total bigint; v_rows jsonb;
BEGIN
 PERFORM public.talent_assert_scope(p_actor_id,p_tenant_id);
 IF p_query IS NULL OR jsonb_typeof(p_query)<>'object' OR (p_query - ARRAY['search','city','skill','view','offset','district','gender','ageMin','ageMax','workType'])<>'{}'
  OR jsonb_typeof(p_query->'search') IS DISTINCT FROM 'string' OR length(p_query->>'search')>160
  OR jsonb_typeof(p_query->'city') IS DISTINCT FROM 'string' OR length(p_query->>'city')>80
  OR jsonb_typeof(p_query->'skill') IS DISTINCT FROM 'string' OR length(p_query->>'skill')>80
  OR coalesce(p_query->>'view','') NOT IN ('all','contact_missing','linked')
  OR jsonb_typeof(p_query->'offset') IS DISTINCT FROM 'number' OR (p_query->>'offset')!~'^[0-9]{1,7}$'
 THEN RAISE EXCEPTION 'TALENT_VALIDATION'; END IF;
 IF (p_query ? 'district' AND (jsonb_typeof(p_query->'district') IS DISTINCT FROM 'string' OR length(p_query->>'district')>80))
 OR (p_query ? 'gender' AND (jsonb_typeof(p_query->'gender') IS DISTINCT FROM 'string' OR p_query->>'gender' NOT IN ('','female','male','other','unknown')))
 OR (p_query ? 'workType' AND (jsonb_typeof(p_query->'workType') IS DISTINCT FROM 'string' OR p_query->>'workType' NOT IN ('','idp','sabit','donemsel')))
 OR (p_query ? 'ageMin' AND (jsonb_typeof(p_query->'ageMin') IS DISTINCT FROM 'string' OR p_query->>'ageMin' !~ '^([0-9]{1,3})?$'))
 OR (p_query ? 'ageMax' AND (jsonb_typeof(p_query->'ageMax') IS DISTINCT FROM 'string' OR p_query->>'ageMax' !~ '^([0-9]{1,3})?$')) THEN RAISE EXCEPTION 'TALENT_VALIDATION'; END IF;
 v_district:=public.talent_fold(btrim(coalesce(p_query->>'district','')));v_gender:=coalesce(p_query->>'gender','');v_type:=coalesce(p_query->>'workType','');
 v_age_min:=nullif(p_query->>'ageMin','')::integer;v_age_max:=nullif(p_query->>'ageMax','')::integer;
 IF v_age_min>120 OR v_age_max>120 OR v_age_min>v_age_max THEN RAISE EXCEPTION 'TALENT_VALIDATION'; END IF;
 v_offset:=(p_query->>'offset')::integer;
 IF v_offset>1000000 OR v_offset%50<>0 THEN RAISE EXCEPTION 'TALENT_VALIDATION'; END IF;
 v_search:=public.talent_fold(btrim(p_query->>'search'));v_city:=public.talent_fold(btrim(p_query->>'city'));
 v_skill:=public.talent_fold(btrim(p_query->>'skill'));v_view:=p_query->>'view';
 WITH filtered AS MATERIALIZED (
  SELECT p.* FROM public.talent_people p
  WHERE p.tenant_id=p_tenant_id AND (v_view<>'contact_missing' OR jsonb_array_length(p.contacts)=0)
   AND (v_view<>'linked' OR p.worker_id IS NOT NULL)
   AND strpos(public.talent_fold(p.city),v_city)>0
   AND strpos(public.talent_fold(p.district),v_district)>0
   AND (v_gender='' OR (v_gender='unknown' AND p.gender IS NULL) OR p.gender=v_gender)
   AND (v_type='' OR v_type=ANY(p.work_types))
   AND (v_age_min IS NULL OR extract(year FROM age(v_today,p.birth_date))>=v_age_min)
   AND (v_age_max IS NULL OR extract(year FROM age(v_today,p.birth_date))<=v_age_max)
   AND (v_skill='' OR EXISTS(SELECT 1 FROM unnest(p.skills) s WHERE strpos(public.talent_fold(s),v_skill)>0))
   AND strpos(public.talent_fold(concat_ws(' ',p.name,p.city,p.district,array_to_string(p.skills,' '),
    array_to_string(p.regions,' '),(SELECT string_agg(c->>'value',' ') FROM jsonb_array_elements(p.contacts) c),
    (SELECT w.code FROM public.ops_workers w WHERE w.tenant_id=p.tenant_id AND w.id=p.worker_id))),v_search)>0
 ), page AS (SELECT * FROM filtered ORDER BY name,id LIMIT 50 OFFSET v_offset)
 SELECT (SELECT count(*) FROM filtered),coalesce(jsonb_agg(public.talent_person_json(page::public.talent_people) ORDER BY name,id),'[]') INTO v_total,v_rows FROM page;
 IF v_total>1000050 THEN RAISE EXCEPTION 'TALENT_TOO_LARGE'; END IF;
 RETURN jsonb_build_object('tenantId',p_tenant_id,'query',p_query,'total',v_total,'rows',v_rows,'generatedAt',statement_timestamp());
END $$;

-- CREATE OR REPLACE preserves the existing RPC grants and owner.
COMMIT;
