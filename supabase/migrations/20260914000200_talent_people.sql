-- Person pool H1a. Production apply is a separate verified release step.
BEGIN;
SET LOCAL lock_timeout='5s';
-- Prevent a worker insert between the initial backfill and trigger installation.
LOCK TABLE public.ops_workers IN SHARE ROW EXCLUSIVE MODE;

CREATE TABLE public.talent_people (
 id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES public.tenants(id),
 name text NOT NULL CHECK(length(btrim(name)) BETWEEN 1 AND 160),
 city text CHECK(city IS NULL OR length(btrim(city)) BETWEEN 1 AND 80),
 district text CHECK(district IS NULL OR length(btrim(district)) BETWEEN 1 AND 80),
 contacts jsonb NOT NULL DEFAULT '[]' CHECK(jsonb_typeof(contacts)='array' AND jsonb_array_length(contacts)<=10),
 skills text[] NOT NULL DEFAULT '{}', regions text[] NOT NULL DEFAULT '{}', work_types text[] NOT NULL DEFAULT '{}',
 worker_id uuid, source text NOT NULL CHECK(source IN ('manual','operations')),
 revision integer NOT NULL DEFAULT 0 CHECK(revision>=0),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,id), UNIQUE(tenant_id,worker_id),
 FOREIGN KEY(tenant_id,worker_id) REFERENCES public.ops_workers(tenant_id,id),
 CHECK(cardinality(skills)<=20 AND cardinality(regions)<=20 AND cardinality(work_types)<=3),
 CHECK(work_types <@ ARRAY['idp','sabit','donemsel']::text[])
);
ALTER TABLE public.talent_people ENABLE ROW LEVEL SECURITY;
CREATE INDEX talent_people_name_page ON public.talent_people(tenant_id,name,id);

CREATE TABLE public.talent_person_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 tenant_id uuid NOT NULL, person_id uuid NOT NULL, actor_id uuid REFERENCES public.profiles(id),
 kind text NOT NULL CHECK(kind IN ('created','updated','worker_synced')), revision integer NOT NULL,
 changed_fields text[] NOT NULL DEFAULT '{}', occurred_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(tenant_id,person_id) REFERENCES public.talent_people(tenant_id,id)
);
ALTER TABLE public.talent_person_events ENABLE ROW LEVEL SECURITY;
CREATE INDEX talent_person_events_recent ON public.talent_person_events(tenant_id,person_id,id DESC);

CREATE TABLE public.talent_person_commands (
 tenant_id uuid NOT NULL REFERENCES public.tenants(id), actor_id uuid NOT NULL REFERENCES public.profiles(id),
 command_id uuid NOT NULL, payload jsonb NOT NULL, result jsonb,
 created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(tenant_id,actor_id,command_id)
);
ALTER TABLE public.talent_person_commands ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.talent_people,public.talent_person_events,public.talent_person_commands FROM PUBLIC,anon,authenticated;
REVOKE ALL ON SEQUENCE public.talent_person_events_id_seq FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.talent_assert_scope(p_actor_id uuid,p_tenant_id uuid)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL OR p_actor_id IS DISTINCT FROM auth.uid() OR p_tenant_id IS NULL
  OR p_tenant_id IS DISTINCT FROM public.current_user_verified_tenant() THEN RAISE EXCEPTION 'TALENT_SCOPE'; END IF;
 IF coalesce(public.current_user_role(),'') NOT IN ('yonetici','operasyon','ik') THEN RAISE EXCEPTION 'TALENT_FORBIDDEN'; END IF;
END $$;

CREATE FUNCTION public.talent_fold(p_text text) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path='' AS $$ SELECT lower(translate(coalesce(p_text,''),'İIıĞğÜüŞşÖöÇç','iiiGgUuSsOoCc')) $$;

CREATE FUNCTION public.talent_person_json(p public.talent_people) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('id',p.id,'tenantId',p.tenant_id,'name',p.name,'city',p.city,'district',p.district,
  'contacts',p.contacts,'skills',p.skills,'regions',p.regions,'workTypes',p.work_types,'revision',p.revision,
  'workerId',p.worker_id,'workerCode',w.code,'workerActive',w.active,'source',p.source,
  'createdAt',p.created_at,'updatedAt',p.updated_at)
 FROM (VALUES(1)) dummy(n) LEFT JOIN public.ops_workers w ON w.tenant_id=p.tenant_id AND w.id=p.worker_id
$$;

CREATE FUNCTION public.talent_people_page(p_actor_id uuid,p_tenant_id uuid,p_query jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_search text; v_city text; v_skill text; v_view text; v_offset integer; v_total bigint; v_rows jsonb;
BEGIN
 PERFORM public.talent_assert_scope(p_actor_id,p_tenant_id);
 IF p_query IS NULL OR jsonb_typeof(p_query)<>'object' OR (p_query - ARRAY['search','city','skill','view','offset'])<>'{}'
  OR jsonb_typeof(p_query->'search') IS DISTINCT FROM 'string' OR length(p_query->>'search')>160
  OR jsonb_typeof(p_query->'city') IS DISTINCT FROM 'string' OR length(p_query->>'city')>80
  OR jsonb_typeof(p_query->'skill') IS DISTINCT FROM 'string' OR length(p_query->>'skill')>80
  OR coalesce(p_query->>'view','') NOT IN ('all','contact_missing','linked')
  OR jsonb_typeof(p_query->'offset') IS DISTINCT FROM 'number' OR (p_query->>'offset')!~'^[0-9]{1,7}$'
 THEN RAISE EXCEPTION 'TALENT_VALIDATION'; END IF;
 v_offset:=(p_query->>'offset')::integer;
 IF v_offset>1000000 OR v_offset%50<>0 THEN RAISE EXCEPTION 'TALENT_VALIDATION'; END IF;
 v_search:=public.talent_fold(btrim(p_query->>'search'));v_city:=public.talent_fold(btrim(p_query->>'city'));
 v_skill:=public.talent_fold(btrim(p_query->>'skill'));v_view:=p_query->>'view';
 WITH filtered AS MATERIALIZED (
  SELECT p.* FROM public.talent_people p
  WHERE p.tenant_id=p_tenant_id AND (v_view<>'contact_missing' OR jsonb_array_length(p.contacts)=0)
   AND (v_view<>'linked' OR p.worker_id IS NOT NULL)
   AND strpos(public.talent_fold(p.city),v_city)>0
   AND (v_skill='' OR EXISTS(SELECT 1 FROM unnest(p.skills) s WHERE strpos(public.talent_fold(s),v_skill)>0))
   AND strpos(public.talent_fold(concat_ws(' ',p.name,p.city,p.district,array_to_string(p.skills,' '),
    array_to_string(p.regions,' '),(SELECT string_agg(c->>'value',' ') FROM jsonb_array_elements(p.contacts) c),
    (SELECT w.code FROM public.ops_workers w WHERE w.tenant_id=p.tenant_id AND w.id=p.worker_id))),v_search)>0
 ), page AS (SELECT * FROM filtered ORDER BY name,id LIMIT 50 OFFSET v_offset)
 SELECT (SELECT count(*) FROM filtered),coalesce(jsonb_agg(public.talent_person_json(page::public.talent_people) ORDER BY name,id),'[]') INTO v_total,v_rows FROM page;
 IF v_total>1000050 THEN RAISE EXCEPTION 'TALENT_TOO_LARGE'; END IF;
 RETURN jsonb_build_object('tenantId',p_tenant_id,'query',p_query,'total',v_total,'rows',v_rows,'generatedAt',statement_timestamp());
END $$;

CREATE FUNCTION public.talent_person_detail(p_actor_id uuid,p_tenant_id uuid,p_person_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_person public.talent_people; v_events jsonb; v_assignments jsonb;
BEGIN
 PERFORM public.talent_assert_scope(p_actor_id,p_tenant_id);
 SELECT * INTO v_person FROM public.talent_people WHERE tenant_id=p_tenant_id AND id=p_person_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'TALENT_NOT_FOUND'; END IF;
 SELECT coalesce(jsonb_agg(to_jsonb(e) ORDER BY e.id::bigint DESC),'[]') INTO v_events FROM (
  SELECT e.id::text,e.kind,e.revision,e.changed_fields AS "changedFields",e.occurred_at AS "occurredAt",
   (SELECT p.display_name FROM public.profiles p JOIN public.tenant_memberships m ON m.user_id=p.id
    WHERE p.id=e.actor_id AND m.tenant_id=p_tenant_id) AS "actorName"
  FROM public.talent_person_events e WHERE e.tenant_id=p_tenant_id AND e.person_id=p_person_id ORDER BY e.id DESC LIMIT 20
 ) e;
 SELECT coalesce(jsonb_agg(to_jsonb(a) ORDER BY a."workDate" DESC,a.id),'[]') INTO v_assignments FROM (
  SELECT a.id,a.work_date AS "workDate",c.name AS "companyName",l.name AS "locationName",r.position,
   (a.removed_at IS NOT NULL OR r.lifecycle='cancelled') AS removed
  FROM public.ops_assignments a JOIN public.ops_daily_requests r ON r.tenant_id=a.tenant_id AND r.id=a.request_id
   JOIN public.companies c ON c.tenant_id=r.tenant_id AND c.id=r.company_id
   JOIN public.ops_locations l ON l.tenant_id=r.tenant_id AND l.company_id=r.company_id AND l.id=r.location_id
  WHERE a.tenant_id=p_tenant_id AND a.worker_id=v_person.worker_id ORDER BY a.work_date DESC,a.id LIMIT 10
 ) a;
 RETURN jsonb_build_object('person',public.talent_person_json(v_person),'events',v_events,'assignments',v_assignments);
END $$;

CREATE FUNCTION public.talent_save_person(p_actor_id uuid,p_tenant_id uuid,p_command_id uuid,p_person_id uuid,p_expected_revision integer,p_input jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='3s' AS $$
DECLARE v_cmd public.talent_person_commands; v_old public.talent_people; v_row public.talent_people;
 v_payload jsonb; v_result jsonb; v_contact jsonb; v_key text; v_worker uuid; v_changed text[]:='{}';
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
  OR (p_input - ARRAY['name','city','district','contacts','skills','regions','workTypes'])<>'{}'
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
  INSERT INTO public.talent_people(id,tenant_id,name,city,district,contacts,skills,regions,work_types,source)
   VALUES(p_command_id,p_tenant_id,v_name,btrim(v_city),btrim(v_district),v_contacts,v_skills,v_regions,v_types,'manual') RETURNING * INTO v_row;
  v_changed:=ARRAY['name','contacts','city','district','skills','regions','workTypes'];
 ELSE
  SELECT worker_id INTO v_worker FROM public.talent_people WHERE tenant_id=p_tenant_id AND id=p_person_id;
  IF v_worker IS NOT NULL THEN PERFORM 1 FROM public.ops_workers WHERE tenant_id=p_tenant_id AND id=v_worker FOR UPDATE; END IF;
  SELECT * INTO v_old FROM public.talent_people WHERE tenant_id=p_tenant_id AND id=p_person_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'TALENT_NOT_FOUND'; END IF;
  IF v_old.revision<>p_expected_revision THEN RAISE EXCEPTION 'TALENT_CONFLICT'; END IF;
  IF v_old.name IS DISTINCT FROM v_name THEN v_changed:=array_append(v_changed,'name'); END IF;
  IF v_old.city IS DISTINCT FROM btrim(v_city) THEN v_changed:=array_append(v_changed,'city'); END IF;
  IF v_old.district IS DISTINCT FROM btrim(v_district) THEN v_changed:=array_append(v_changed,'district'); END IF;
  IF v_old.contacts IS DISTINCT FROM v_contacts THEN v_changed:=array_append(v_changed,'contacts'); END IF;
  IF v_old.skills IS DISTINCT FROM v_skills THEN v_changed:=array_append(v_changed,'skills'); END IF;
  IF v_old.regions IS DISTINCT FROM v_regions THEN v_changed:=array_append(v_changed,'regions'); END IF;
  IF v_old.work_types IS DISTINCT FROM v_types THEN v_changed:=array_append(v_changed,'workTypes'); END IF;
  UPDATE public.talent_people SET name=v_name,city=btrim(v_city),district=btrim(v_district),contacts=v_contacts,
   skills=v_skills,regions=v_regions,work_types=v_types,revision=revision+1,updated_at=now()
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

-- Closing an uncertain request either observes its committed receipt or wins the
-- same command lock and prevents a delayed request from creating a second person.
CREATE FUNCTION public.talent_resolve_person_command(p_actor_id uuid,p_tenant_id uuid,p_command_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='3s' AS $$
DECLARE v_cmd public.talent_person_commands;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'TALENT_SCOPE'; END IF;
 PERFORM 1 FROM public.profiles WHERE id=auth.uid() FOR SHARE;
 PERFORM 1 FROM public.tenant_memberships WHERE user_id=auth.uid() AND tenant_id=p_tenant_id FOR SHARE;
 PERFORM public.talent_assert_scope(p_actor_id,p_tenant_id);
 IF p_command_id IS NULL THEN RAISE EXCEPTION 'TALENT_VALIDATION'; END IF;
 INSERT INTO public.talent_person_commands(tenant_id,actor_id,command_id,payload)
  VALUES(p_tenant_id,p_actor_id,p_command_id,'{"cancelled":true}') ON CONFLICT DO NOTHING;
 SELECT * INTO v_cmd FROM public.talent_person_commands WHERE tenant_id=p_tenant_id AND actor_id=p_actor_id AND command_id=p_command_id FOR UPDATE;
 IF v_cmd.result IS NOT NULL THEN RETURN jsonb_build_object('status','confirmed','receipt',v_cmd.result); END IF;
 IF v_cmd.payload IS DISTINCT FROM '{"cancelled":true}'::jsonb THEN RAISE EXCEPTION 'TALENT_COMMAND'; END IF;
 RETURN jsonb_build_object('status','closed','commandId',p_command_id);
END $$;

INSERT INTO public.talent_people(id,tenant_id,name,worker_id,source,work_types,created_at)
 SELECT id,tenant_id,name,id,'operations',ARRAY[kind],created_at FROM public.ops_workers;
CREATE FUNCTION public.talent_sync_worker() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_person uuid; v_revision integer;
BEGIN
 IF TG_OP='INSERT' THEN
  INSERT INTO public.talent_people(id,tenant_id,name,worker_id,source,work_types) VALUES(NEW.id,NEW.tenant_id,NEW.name,NEW.id,'operations',ARRAY[NEW.kind]);
 ELSE
  UPDATE public.talent_people SET name=NEW.name,revision=revision+1,updated_at=now()
   WHERE tenant_id=NEW.tenant_id AND worker_id=NEW.id AND name IS DISTINCT FROM NEW.name RETURNING id,revision INTO v_person,v_revision;
  IF v_person IS NOT NULL THEN INSERT INTO public.talent_person_events(tenant_id,person_id,actor_id,kind,revision,changed_fields)
   VALUES(NEW.tenant_id,v_person,auth.uid(),'worker_synced',v_revision,ARRAY['name']); END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER talent_worker_sync AFTER INSERT OR UPDATE OF name ON public.ops_workers FOR EACH ROW EXECUTE FUNCTION public.talent_sync_worker();

REVOKE ALL ON FUNCTION public.talent_assert_scope(uuid,uuid),public.talent_fold(text),public.talent_person_json(public.talent_people),public.talent_sync_worker() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.talent_people_page(uuid,uuid,jsonb),public.talent_person_detail(uuid,uuid,uuid),public.talent_save_person(uuid,uuid,uuid,uuid,integer,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.talent_people_page(uuid,uuid,jsonb),public.talent_person_detail(uuid,uuid,uuid),public.talent_save_person(uuid,uuid,uuid,uuid,integer,jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.talent_resolve_person_command(uuid,uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.talent_resolve_person_command(uuid,uuid,uuid) TO authenticated;
COMMIT;
