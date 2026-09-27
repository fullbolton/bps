-- Requires 20260927000500. Skip empty filter work without changing search semantics.
BEGIN;
SET LOCAL lock_timeout='5s';
CREATE OR REPLACE FUNCTION "public"."talent_people_page"("p_actor_id" "uuid", "p_tenant_id" "uuid", "p_query" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    SET "statement_timeout" TO '10s'
    AS $_$
DECLARE v_availability_day date; v_availability_state text; v_district text; v_gender text; v_age_min integer; v_age_max integer; v_type text; v_today date:=(now() AT TIME ZONE 'Europe/Istanbul')::date; v_search text; v_city text; v_skill text; v_view text; v_offset integer; v_total bigint; v_rows jsonb;
BEGIN
 PERFORM public.talent_assert_scope(p_actor_id,p_tenant_id);
 IF p_query IS NULL OR jsonb_typeof(p_query)<>'object' OR (p_query - ARRAY['search','city','skill','view','offset','district','gender','ageMin','ageMax','workType','availabilityDay','availabilityState'])<>'{}'
  OR jsonb_typeof(p_query->'search') IS DISTINCT FROM 'string' OR length(p_query->>'search')>160
  OR jsonb_typeof(p_query->'city') IS DISTINCT FROM 'string' OR length(p_query->>'city')>80
  OR jsonb_typeof(p_query->'skill') IS DISTINCT FROM 'string' OR length(p_query->>'skill')>80
  OR coalesce(p_query->>'view','') NOT IN ('all','contact_missing','linked','call_back')
  OR jsonb_typeof(p_query->'offset') IS DISTINCT FROM 'number' OR (p_query->>'offset')!~'^[0-9]{1,7}$'
 THEN RAISE EXCEPTION 'TALENT_VALIDATION'; END IF;
 IF (p_query ? 'district' AND (jsonb_typeof(p_query->'district') IS DISTINCT FROM 'string' OR length(p_query->>'district')>80))
 OR (p_query ? 'gender' AND (jsonb_typeof(p_query->'gender') IS DISTINCT FROM 'string' OR p_query->>'gender' NOT IN ('','female','male','other','unknown')))
 OR (p_query ? 'workType' AND (jsonb_typeof(p_query->'workType') IS DISTINCT FROM 'string' OR p_query->>'workType' NOT IN ('','idp','sabit','donemsel')))
 OR (p_query ? 'ageMin' AND (jsonb_typeof(p_query->'ageMin') IS DISTINCT FROM 'string' OR p_query->>'ageMin' !~ '^([0-9]{1,3})?$'))
 OR (p_query ? 'ageMax' AND (jsonb_typeof(p_query->'ageMax') IS DISTINCT FROM 'string' OR p_query->>'ageMax' !~ '^([0-9]{1,3})?$')) THEN RAISE EXCEPTION 'TALENT_VALIDATION'; END IF;
 IF (p_query ? 'availabilityDay' AND jsonb_typeof(p_query->'availabilityDay') IS DISTINCT FROM 'string')
 OR (p_query ? 'availabilityState' AND (jsonb_typeof(p_query->'availabilityState') IS DISTINCT FROM 'string' OR p_query->>'availabilityState' NOT IN ('','available','unavailable','unknown')))
 THEN RAISE EXCEPTION 'TALENT_VALIDATION'; END IF;
 v_availability_state:=coalesce(p_query->>'availabilityState','');
 IF (coalesce(p_query->>'availabilityDay','')='')<>(v_availability_state='') THEN RAISE EXCEPTION 'TALENT_VALIDATION'; END IF;
 IF v_availability_state<>'' THEN
  IF (p_query->>'availabilityDay') !~ '^\d{4}-\d{2}-\d{2}$' THEN RAISE EXCEPTION 'TALENT_VALIDATION'; END IF;
  BEGIN v_availability_day:=(p_query->>'availabilityDay')::date;
  EXCEPTION WHEN datetime_field_overflow OR invalid_datetime_format THEN RAISE EXCEPTION 'TALENT_VALIDATION'; END;
  IF v_availability_day<date '2000-01-01' OR v_availability_day>date '2100-12-31' THEN RAISE EXCEPTION 'TALENT_VALIDATION'; END IF;
 END IF;
 v_district:=public.talent_fold(btrim(coalesce(p_query->>'district','')));v_gender:=coalesce(p_query->>'gender','');v_type:=coalesce(p_query->>'workType','');
 v_age_min:=nullif(p_query->>'ageMin','')::integer;v_age_max:=nullif(p_query->>'ageMax','')::integer;
 IF v_age_min>120 OR v_age_max>120 OR v_age_min>v_age_max THEN RAISE EXCEPTION 'TALENT_VALIDATION'; END IF;
 v_offset:=(p_query->>'offset')::integer;
 IF v_offset>1000000 OR v_offset%50<>0 THEN RAISE EXCEPTION 'TALENT_VALIDATION'; END IF;
 v_search:=public.talent_fold(btrim(p_query->>'search'));v_city:=public.talent_fold(btrim(p_query->>'city'));
 v_skill:=public.talent_fold(btrim(p_query->>'skill'));v_view:=p_query->>'view';
 -- Only callback view constructs the tenant family map. Latest general outcome
 -- uses the same recorded_at/id order as talent_latest_general_contact.
 WITH RECURSIVE family(root_id,id) AS (
  SELECT id,id FROM public.talent_people WHERE v_view='call_back' AND tenant_id=p_tenant_id AND merged_into_id IS NULL
  UNION
  SELECT f.root_id,p.id FROM family f JOIN public.talent_people p ON p.merged_into_id=f.id AND p.tenant_id=p_tenant_id
 ), latest AS MATERIALIZED (
  SELECT DISTINCT ON(f.root_id) f.root_id,c.outcome
  FROM family f JOIN public.talent_conversations c ON c.tenant_id=p_tenant_id AND c.person_id=f.id AND c.request_id IS NULL
  ORDER BY f.root_id,c.recorded_at DESC,c.id DESC
 ), filtered AS MATERIALIZED (
  SELECT p.* FROM public.talent_people p
  WHERE p.tenant_id=p_tenant_id AND p.merged_into_id IS NULL AND (v_view<>'contact_missing' OR jsonb_array_length(p.contacts)=0)
   AND (v_view<>'linked' OR p.worker_id IS NOT NULL)
   AND (v_view<>'call_back' OR p.id IN (SELECT root_id FROM latest WHERE outcome='call_back'))
   AND (v_city='' OR strpos(public.talent_fold(p.city),v_city)>0)
   AND (v_district='' OR strpos(public.talent_fold(p.district),v_district)>0)
   AND (v_gender='' OR (v_gender='unknown' AND p.gender IS NULL) OR p.gender=v_gender)
   AND (v_availability_state='' OR coalesce((
    SELECT CASE WHEN v_availability_day BETWEEN a.starts_on AND a.ends_on THEN a.state ELSE 'unknown' END
    FROM public.talent_availability a WHERE a.tenant_id=p.tenant_id AND a.person_id=p.id
    ORDER BY a.revision DESC LIMIT 1
   ),'unknown')=v_availability_state)
   AND (v_type='' OR v_type=ANY(p.work_types))
   AND (v_age_min IS NULL OR extract(year FROM age(v_today,p.birth_date))>=v_age_min)
   AND (v_age_max IS NULL OR extract(year FROM age(v_today,p.birth_date))<=v_age_max)
   AND (v_skill='' OR EXISTS(SELECT 1 FROM unnest(p.skills) s WHERE strpos(public.talent_fold(s),v_skill)>0))
   AND (v_search='' OR strpos(public.talent_fold(concat_ws(' ',p.name,p.city,p.district,array_to_string(p.skills,' '),
    array_to_string(p.regions,' '),(SELECT string_agg(c->>'value',' ') FROM jsonb_array_elements(p.contacts) c),
    (SELECT w.code FROM public.ops_workers w WHERE w.tenant_id=p.tenant_id AND w.id=p.worker_id))),v_search)>0)
 ), page AS (SELECT * FROM filtered ORDER BY name,id LIMIT 50 OFFSET v_offset)
 SELECT (SELECT count(*) FROM filtered),coalesce(jsonb_agg(public.talent_person_json(page::public.talent_people) ORDER BY name,id),'[]') INTO v_total,v_rows FROM page;
 IF v_total>1000050 THEN RAISE EXCEPTION 'TALENT_TOO_LARGE'; END IF;
 RETURN jsonb_build_object('tenantId',p_tenant_id,'query',p_query,'total',v_total,'rows',v_rows,'generatedAt',statement_timestamp());
END $_$;

COMMIT;
