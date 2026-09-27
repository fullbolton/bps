-- Pool merge, general contact summary and callback filter. No business rows are merged.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';

-- Source: person-merge/01_review.sql
-- Read-only groundwork. No person is merged and no existing RPC is replaced.
CREATE FUNCTION public.talent_merge_review(p_actor uuid,p_tenant uuid,p_left uuid,p_right uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE l public.talent_people; r public.talent_people; sides jsonb;
BEGIN
 PERFORM public.talent_assert_scope(p_actor,p_tenant);
 IF public.current_user_role() IS DISTINCT FROM 'yonetici' THEN RAISE EXCEPTION 'TALENT_FORBIDDEN'; END IF;
 IF p_left IS NULL OR p_right IS NULL OR p_left=p_right THEN RAISE EXCEPTION 'TALENT_VALIDATION'; END IF;
 SELECT * INTO l FROM public.talent_people WHERE tenant_id=p_tenant AND id=p_left;
 IF NOT FOUND THEN RAISE EXCEPTION 'TALENT_NOT_FOUND'; END IF;
 SELECT * INTO r FROM public.talent_people WHERE tenant_id=p_tenant AND id=p_right;
 IF NOT FOUND THEN RAISE EXCEPTION 'TALENT_NOT_FOUND'; END IF;
 -- STABLE uses a single statement snapshot, not independently fetched person cards.
 SELECT jsonb_agg(jsonb_build_object('person',public.talent_person_json(p),'counts',jsonb_build_object(
  'conversations',(SELECT count(*) FROM public.talent_conversations c WHERE c.tenant_id=p_tenant AND c.person_id=p.id),
  'attachments',(SELECT count(*) FROM public.talent_attachments a WHERE a.tenant_id=p_tenant AND a.person_id=p.id AND a.ready AND NOT a.cancelled),
  'pendingAttachments',(SELECT count(*) FROM public.talent_attachments a WHERE a.tenant_id=p_tenant AND a.person_id=p.id AND NOT a.ready AND NOT a.cleaned),
  'availability',(SELECT count(*) FROM public.talent_availability a WHERE a.tenant_id=p_tenant AND a.person_id=p.id),
  'assignments',(SELECT count(*) FROM public.ops_assignments a WHERE a.tenant_id=p_tenant AND a.worker_id=p.worker_id)
 )) ORDER BY p.id=p_left DESC) INTO sides
 FROM public.talent_people p WHERE p.tenant_id=p_tenant AND p.id IN(p_left,p_right);
 RETURN jsonb_build_object('actorId',p_actor,'tenantId',p_tenant,'left',sides->0,'right',sides->1,
  'restriction',CASE WHEN l.worker_id IS NOT NULL AND r.worker_id IS NOT NULL THEN 'two_workers' ELSE 'none' END,
  'requiredPrimaryId',CASE WHEN l.worker_id IS NOT NULL AND r.worker_id IS NULL THEN l.id WHEN r.worker_id IS NOT NULL AND l.worker_id IS NULL THEN r.id ELSE NULL END,
  'observedAt',statement_timestamp());
END $$;
REVOKE ALL ON FUNCTION public.talent_merge_review(uuid,uuid,uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.talent_merge_review(uuid,uuid,uuid,uuid) TO authenticated;


-- Source: person-merge/02_atomic.sql
-- Local candidate only. Read projections/UI cutover required before production.
ALTER TABLE public.talent_people ADD COLUMN merged_into_id uuid,
 ADD CONSTRAINT talent_merge_target_fk FOREIGN KEY(tenant_id,merged_into_id) REFERENCES public.talent_people(tenant_id,id),
 ADD CONSTRAINT talent_merge_not_self CHECK(merged_into_id IS NULL OR (merged_into_id<>id AND worker_id IS NULL));
CREATE INDEX talent_merge_children ON public.talent_people(tenant_id,merged_into_id) WHERE merged_into_id IS NOT NULL;
CREATE TABLE public.talent_merge_commands(
 tenant_id uuid NOT NULL REFERENCES public.tenants(id),actor_id uuid NOT NULL REFERENCES public.profiles(id),command_id uuid NOT NULL,
 payload jsonb NOT NULL,result jsonb,save_command uuid NOT NULL DEFAULT gen_random_uuid(),created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(tenant_id,actor_id,command_id),UNIQUE(save_command)
);
ALTER TABLE public.talent_merge_commands ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.talent_merge_commands FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.talent_person_family(p_tenant uuid,p_person uuid) RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 WITH RECURSIVE family(id) AS(
  SELECT id FROM public.talent_people WHERE tenant_id=p_tenant AND id=p_person
  UNION
  SELECT p.id FROM public.talent_people p JOIN family f ON p.merged_into_id=f.id WHERE p.tenant_id=p_tenant
 ) SELECT id FROM family
$$;
REVOKE ALL ON FUNCTION public.talent_person_family(uuid,uuid) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.talent_guard_closed_person() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF OLD.merged_into_id IS NOT NULL THEN RAISE EXCEPTION 'TALENT_MERGED'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD;END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.talent_guard_closed_person() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER talent_closed_person_guard BEFORE UPDATE OR DELETE ON public.talent_people FOR EACH ROW EXECUTE FUNCTION public.talent_guard_closed_person();

CREATE FUNCTION public.talent_guard_person_child() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE closed uuid;
BEGIN
 -- Parent SHARE lock fences inserts that started before the merge committed.
 SELECT merged_into_id INTO closed FROM public.talent_people WHERE tenant_id=NEW.tenant_id AND id=NEW.person_id FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'TALENT_NOT_FOUND';END IF;
 IF closed IS NOT NULL THEN RAISE EXCEPTION 'TALENT_MERGED';END IF;
 IF TG_OP='UPDATE' AND (OLD.person_id<>NEW.person_id OR OLD.tenant_id<>NEW.tenant_id) THEN RAISE EXCEPTION 'TALENT_MERGE_HISTORY';END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.talent_guard_person_child() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER talent_conversation_person_guard BEFORE INSERT OR UPDATE ON public.talent_conversations FOR EACH ROW EXECUTE FUNCTION public.talent_guard_person_child();
CREATE TRIGGER talent_attachment_person_guard BEFORE INSERT OR UPDATE ON public.talent_attachments FOR EACH ROW EXECUTE FUNCTION public.talent_guard_person_child();
CREATE TRIGGER talent_availability_person_guard BEFORE INSERT OR UPDATE ON public.talent_availability FOR EACH ROW EXECUTE FUNCTION public.talent_guard_person_child();

CREATE FUNCTION public.talent_merge_snapshot(p_tenant uuid,p_left uuid,p_right uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_agg(jsonb_build_object('person',to_jsonb(p),'workerRevision',w.directory_revision,
  'counts',jsonb_build_object(
   'conversations',(SELECT count(*) FROM public.talent_conversations c WHERE c.tenant_id=p_tenant AND c.person_id IN(SELECT public.talent_person_family(p_tenant,p.id))),
   'attachments',(SELECT count(*) FROM public.talent_attachments a WHERE a.tenant_id=p_tenant AND a.person_id IN(SELECT public.talent_person_family(p_tenant,p.id)) AND a.ready AND NOT a.cancelled),
   'pendingAttachments',(SELECT count(*) FROM public.talent_attachments a WHERE a.tenant_id=p_tenant AND a.person_id IN(SELECT public.talent_person_family(p_tenant,p.id)) AND NOT a.ready AND NOT a.cleaned),
   'availability',(SELECT count(*) FROM public.talent_availability a WHERE a.tenant_id=p_tenant AND a.person_id IN(SELECT public.talent_person_family(p_tenant,p.id))),
   'assignments',(SELECT count(*) FROM public.ops_assignments a WHERE a.tenant_id=p_tenant AND a.worker_id=p.worker_id)
  )) ORDER BY p.id=p_left DESC)
 FROM public.talent_people p LEFT JOIN public.ops_workers w ON w.tenant_id=p.tenant_id AND w.id=p.worker_id
 WHERE p.tenant_id=p_tenant AND p.id IN(p_left,p_right)
$$;
REVOKE ALL ON FUNCTION public.talent_merge_snapshot(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.talent_merge_review(p_actor uuid,p_tenant uuid,p_left uuid,p_right uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE l public.talent_people;r public.talent_people;s jsonb;
BEGIN
 PERFORM public.talent_assert_scope(p_actor,p_tenant);
 IF public.current_user_role() IS DISTINCT FROM 'yonetici' THEN RAISE EXCEPTION 'TALENT_FORBIDDEN';END IF;
 IF p_left IS NULL OR p_right IS NULL OR p_left=p_right THEN RAISE EXCEPTION 'TALENT_VALIDATION';END IF;
 SELECT * INTO l FROM public.talent_people WHERE tenant_id=p_tenant AND id=p_left;
 IF NOT FOUND THEN RAISE EXCEPTION 'TALENT_NOT_FOUND';END IF;
 SELECT * INTO r FROM public.talent_people WHERE tenant_id=p_tenant AND id=p_right;
 IF NOT FOUND THEN RAISE EXCEPTION 'TALENT_NOT_FOUND';END IF;
 IF l.merged_into_id IS NOT NULL OR r.merged_into_id IS NOT NULL THEN RAISE EXCEPTION 'TALENT_MERGED';END IF;
 s:=public.talent_merge_snapshot(p_tenant,p_left,p_right);
 RETURN jsonb_build_object('actorId',p_actor,'tenantId',p_tenant,
 'left',jsonb_build_object('person',public.talent_person_json(l),'counts',s->0->'counts'),
 'right',jsonb_build_object('person',public.talent_person_json(r),'counts',s->1->'counts'),
 'restriction',CASE WHEN l.worker_id IS NOT NULL AND r.worker_id IS NOT NULL THEN 'two_workers' ELSE 'none' END,
 'requiredPrimaryId',CASE WHEN l.worker_id IS NOT NULL AND r.worker_id IS NULL THEN l.id WHEN r.worker_id IS NOT NULL AND l.worker_id IS NULL THEN r.id ELSE NULL END,
 'reviewToken',md5(s::text),'observedAt',statement_timestamp());
END $$;

CREATE FUNCTION public.talent_merge_apply(p_actor uuid,p_tenant uuid,p_command uuid,p_left uuid,p_right uuid,p_primary uuid,p_review_token text,p_fields jsonb,p_confirm_same_person boolean,p_keep_primary_availability boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='3s' AS $$
DECLARE cmd public.talent_merge_commands;l public.talent_people;r public.talent_people;main public.talent_people;donor public.talent_people;
 payload jsonb;state jsonb;input jsonb:='{}';contacts jsonb;item jsonb;k text;receipt jsonb;ids uuid[];
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'TALENT_SCOPE';END IF;
 PERFORM 1 FROM public.profiles WHERE id=auth.uid() FOR SHARE;
 PERFORM 1 FROM public.tenant_memberships WHERE user_id=auth.uid() AND tenant_id=p_tenant FOR SHARE;
 PERFORM public.talent_assert_scope(p_actor,p_tenant);
 IF public.current_user_role() IS DISTINCT FROM 'yonetici' THEN RAISE EXCEPTION 'TALENT_FORBIDDEN';END IF;
 IF p_command IS NULL OR p_left IS NULL OR p_right IS NULL OR p_left=p_right OR p_primary IS NULL OR p_primary NOT IN(p_left,p_right)
  OR p_review_token IS NULL OR p_review_token !~ '^[a-f0-9]{32}$' OR p_confirm_same_person IS DISTINCT FROM true OR p_keep_primary_availability IS DISTINCT FROM true
  OR jsonb_typeof(p_fields) IS DISTINCT FROM 'object' OR NOT(p_fields ?& ARRAY['name','city','district','gender','birthDate'])
  OR (p_fields-ARRAY['name','city','district','gender','birthDate'])<>'{}'
 THEN RAISE EXCEPTION 'TALENT_VALIDATION';END IF;
 FOREACH k IN ARRAY ARRAY['name','city','district','gender','birthDate'] LOOP
  IF jsonb_typeof(p_fields->k) IS DISTINCT FROM 'string' OR (p_fields->>k) NOT IN('left','right') THEN RAISE EXCEPTION 'TALENT_VALIDATION';END IF;
 END LOOP;
 payload:=jsonb_build_object('left',p_left,'right',p_right,'primary',p_primary,'token',p_review_token,'fields',p_fields);
 INSERT INTO public.talent_merge_commands(tenant_id,actor_id,command_id,payload)VALUES(p_tenant,p_actor,p_command,payload) ON CONFLICT DO NOTHING;
 SELECT * INTO STRICT cmd FROM public.talent_merge_commands WHERE tenant_id=p_tenant AND actor_id=p_actor AND command_id=p_command FOR UPDATE;
 IF cmd.payload IS DISTINCT FROM payload THEN RAISE EXCEPTION 'TALENT_COMMAND';END IF;
 IF cmd.result IS NOT NULL THEN RETURN cmd.result;END IF;
 -- Worker before person, matching existing edits/sync. Re-read revisions after locks.
 PERFORM 1 FROM public.ops_workers WHERE tenant_id=p_tenant AND id IN(SELECT worker_id FROM public.talent_people WHERE tenant_id=p_tenant AND id IN(p_left,p_right)) ORDER BY id FOR UPDATE;
 PERFORM 1 FROM public.talent_people WHERE tenant_id=p_tenant AND id IN(p_left,p_right) ORDER BY id FOR UPDATE;
 SELECT * INTO l FROM public.talent_people WHERE tenant_id=p_tenant AND id=p_left;
 IF NOT FOUND THEN RAISE EXCEPTION 'TALENT_NOT_FOUND';END IF;
 SELECT * INTO r FROM public.talent_people WHERE tenant_id=p_tenant AND id=p_right;
 IF NOT FOUND THEN RAISE EXCEPTION 'TALENT_NOT_FOUND';END IF;
 IF l.merged_into_id IS NOT NULL OR r.merged_into_id IS NOT NULL THEN RAISE EXCEPTION 'TALENT_MERGED';END IF;
 state:=public.talent_merge_snapshot(p_tenant,p_left,p_right);
 IF md5(state::text)<>p_review_token THEN RAISE EXCEPTION 'TALENT_MERGE_CHANGED';END IF;
 IF l.worker_id IS NOT NULL AND r.worker_id IS NOT NULL THEN RAISE EXCEPTION 'TALENT_MERGE_TWO_WORKERS';END IF;
 IF p_primary=p_left THEN main:=l;donor:=r;ELSE main:=r;donor:=l;END IF;
 IF donor.worker_id IS NOT NULL THEN RAISE EXCEPTION 'TALENT_MERGE_PRIMARY';END IF;
 -- Never strand a reserved upload, including cancellation awaiting Storage cleanup.
 IF (state->0->'counts'->>'pendingAttachments')::bigint>0 OR (state->1->'counts'->>'pendingAttachments')::bigint>0 THEN RAISE EXCEPTION 'TALENT_MERGE_PENDING_FILES';END IF;
 -- Existing writers acquire the import fence inside triggers. Never wait on it
 -- while holding person locks: a competing import may already need those locks.
 IF NOT pg_try_advisory_xact_lock(hashtextextended('bps:talent-import:'||p_tenant::text,0)) THEN RAISE EXCEPTION 'TALENT_MERGE_BUSY';END IF;
 FOREACH k IN ARRAY ARRAY['name','city','district','gender','birthDate'] LOOP
  item:=CASE WHEN p_fields->>k='left' THEN public.talent_person_json(l) ELSE public.talent_person_json(r) END;
  input:=input||jsonb_build_object(k,item->k);
 END LOOP;
 SELECT coalesce(jsonb_agg(c ORDER BY ord),'[]') INTO contacts FROM(
  SELECT DISTINCT ON(public.talent_import_contact_key(c->>'kind',c->>'value')) c,ord
  FROM jsonb_array_elements(main.contacts||donor.contacts) WITH ORDINALITY x(c,ord)
  ORDER BY public.talent_import_contact_key(c->>'kind',c->>'value'),ord
 ) unique_contacts;
 input:=input||jsonb_build_object('contacts',contacts,
  'skills',(SELECT coalesce(jsonb_agg(v ORDER BY v),'[]') FROM(SELECT DISTINCT unnest(main.skills||donor.skills) v)s),
  'regions',(SELECT coalesce(jsonb_agg(v ORDER BY v),'[]') FROM(SELECT DISTINCT unnest(main.regions||donor.regions) v)s),
  'workTypes',(SELECT coalesce(jsonb_agg(v ORDER BY v),'[]') FROM(SELECT DISTINCT unnest(main.work_types||donor.work_types) v)s));
 -- Existing validator, history, worker-name sync and revision handling stay authoritative.
 receipt:=public.talent_save_person(p_actor,p_tenant,cmd.save_command,main.id,main.revision,input);
 UPDATE public.talent_people SET merged_into_id=main.id,revision=revision+1,updated_at=clock_timestamp() WHERE tenant_id=p_tenant AND id=donor.id;
 INSERT INTO public.talent_person_events(tenant_id,person_id,actor_id,kind,revision,changed_fields)
 VALUES(p_tenant,donor.id,p_actor,'updated',donor.revision+1,ARRAY['mergedIntoId']),
 (p_tenant,main.id,p_actor,'updated',(receipt->>'revision')::integer,ARRAY['mergedFromId']);
 receipt:=jsonb_build_object('actorId',p_actor,'tenantId',p_tenant,'commandId',p_command,'primaryId',main.id,'sourceId',donor.id,'revision',receipt->'revision','mergedAt',clock_timestamp());
 UPDATE public.talent_merge_commands SET result=receipt WHERE tenant_id=p_tenant AND actor_id=p_actor AND command_id=p_command;
 RETURN receipt;
END $$;
REVOKE ALL ON FUNCTION public.talent_merge_apply(uuid,uuid,uuid,uuid,uuid,uuid,text,jsonb,boolean,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.talent_merge_apply(uuid,uuid,uuid,uuid,uuid,uuid,text,jsonb,boolean,boolean) TO authenticated;
CREATE FUNCTION public.talent_merge_resolve(p_actor uuid,p_tenant uuid,p_command uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='3s' AS $$
DECLARE cmd public.talent_merge_commands;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'TALENT_SCOPE';END IF;
 PERFORM 1 FROM public.profiles WHERE id=auth.uid() FOR SHARE;
 PERFORM 1 FROM public.tenant_memberships WHERE user_id=auth.uid() AND tenant_id=p_tenant FOR SHARE;
 PERFORM public.talent_assert_scope(p_actor,p_tenant);
 IF public.current_user_role() IS DISTINCT FROM 'yonetici' THEN RAISE EXCEPTION 'TALENT_FORBIDDEN';END IF;
 IF p_command IS NULL THEN RAISE EXCEPTION 'TALENT_VALIDATION';END IF;
 INSERT INTO public.talent_merge_commands(tenant_id,actor_id,command_id,payload)VALUES(p_tenant,p_actor,p_command,'{"cancelled":true}') ON CONFLICT DO NOTHING;
 SELECT * INTO STRICT cmd FROM public.talent_merge_commands WHERE tenant_id=p_tenant AND actor_id=p_actor AND command_id=p_command FOR UPDATE;
 IF cmd.result IS NOT NULL THEN RETURN jsonb_build_object('status','confirmed','receipt',cmd.result);END IF;
 IF cmd.payload IS DISTINCT FROM '{"cancelled":true}'::jsonb THEN RAISE EXCEPTION 'TALENT_COMMAND';END IF;
 RETURN jsonb_build_object('status','closed','commandId',p_command);
END $$;
REVOKE ALL ON FUNCTION public.talent_merge_resolve(uuid,uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.talent_merge_resolve(uuid,uuid,uuid) TO authenticated;


-- Source: person-merge/03_read_cutover.sql
-- Read cutover. Source rows and original foreign keys remain intact.
CREATE FUNCTION public.talent_canonical_person(p_tenant uuid,p_person uuid) RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 WITH RECURSIVE chain(id,merged_into_id) AS(
 SELECT id,merged_into_id FROM public.talent_people WHERE tenant_id=p_tenant AND id=p_person
 UNION
 SELECT p.id,p.merged_into_id FROM public.talent_people p JOIN chain c ON c.merged_into_id=p.id WHERE p.tenant_id=p_tenant
 ) SELECT id FROM chain WHERE merged_into_id IS NULL
$$;
REVOKE ALL ON FUNCTION public.talent_canonical_person(uuid,uuid) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION "public"."talent_people_page"("p_actor_id" "uuid", "p_tenant_id" "uuid", "p_query" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
DECLARE v_availability_day date; v_availability_state text; v_district text; v_gender text; v_age_min integer; v_age_max integer; v_type text; v_today date:=(now() AT TIME ZONE 'Europe/Istanbul')::date; v_search text; v_city text; v_skill text; v_view text; v_offset integer; v_total bigint; v_rows jsonb;
BEGIN
 PERFORM public.talent_assert_scope(p_actor_id,p_tenant_id);
 IF p_query IS NULL OR jsonb_typeof(p_query)<>'object' OR (p_query - ARRAY['search','city','skill','view','offset','district','gender','ageMin','ageMax','workType','availabilityDay','availabilityState'])<>'{}'
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
 WITH filtered AS MATERIALIZED (
  SELECT p.* FROM public.talent_people p
  WHERE p.tenant_id=p_tenant_id AND p.merged_into_id IS NULL AND (v_view<>'contact_missing' OR jsonb_array_length(p.contacts)=0)
   AND (v_view<>'linked' OR p.worker_id IS NOT NULL)
   AND strpos(public.talent_fold(p.city),v_city)>0
   AND strpos(public.talent_fold(p.district),v_district)>0
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
   AND strpos(public.talent_fold(concat_ws(' ',p.name,p.city,p.district,array_to_string(p.skills,' '),
    array_to_string(p.regions,' '),(SELECT string_agg(c->>'value',' ') FROM jsonb_array_elements(p.contacts) c),
    (SELECT w.code FROM public.ops_workers w WHERE w.tenant_id=p.tenant_id AND w.id=p.worker_id))),v_search)>0
 ), page AS (SELECT * FROM filtered ORDER BY name,id LIMIT 50 OFFSET v_offset)
 SELECT (SELECT count(*) FROM filtered),coalesce(jsonb_agg(public.talent_person_json(page::public.talent_people) ORDER BY name,id),'[]') INTO v_total,v_rows FROM page;
 IF v_total>1000050 THEN RAISE EXCEPTION 'TALENT_TOO_LARGE'; END IF;
 RETURN jsonb_build_object('tenantId',p_tenant_id,'query',p_query,'total',v_total,'rows',v_rows,'generatedAt',statement_timestamp());
END $_$;

CREATE OR REPLACE FUNCTION "public"."talent_compare_snapshot"("p_actor_id" "uuid", "p_tenant_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE v_rows jsonb;v_total integer;v_result jsonb;
BEGIN
 PERFORM public.talent_assert_scope(p_actor_id,p_tenant_id);
 -- STABLE: the scope checks and all rows use the calling statement's snapshot.
 SELECT count(*),coalesce(jsonb_agg(jsonb_build_object('id',p.id,'revision',p.revision,
  'name',p.name,'city',p.city,'district',p.district,'skills',to_jsonb(p.skills),'regions',to_jsonb(p.regions),'contacts',p.contacts) ORDER BY p.id),'[]')
 INTO v_total,v_rows FROM (SELECT id,revision,name,city,district,skills,regions,contacts FROM public.talent_people
  WHERE tenant_id=p_tenant_id AND merged_into_id IS NULL ORDER BY id LIMIT 10001) p;
 IF v_total>10000 THEN RAISE EXCEPTION 'TALENT_COMPARE_TOO_LARGE';END IF;
 v_result:=jsonb_build_object('actorId',p_actor_id,'tenantId',p_tenant_id,'total',v_total,
  'generatedAt',statement_timestamp(),'rows',v_rows);
 IF octet_length(v_result::text)>5242880 THEN RAISE EXCEPTION 'TALENT_COMPARE_TOO_LARGE';END IF;
 RETURN v_result;
END $$;

CREATE OR REPLACE FUNCTION "public"."talent_work_copy_page"("p_actor_id" "uuid", "p_tenant_id" "uuid", "p_after" "uuid" DEFAULT NULL::"uuid", "p_version" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
DECLARE v text;n integer;items jsonb;result jsonb;more boolean;last_id uuid;
BEGIN
 PERFORM public.talent_assert_scope(p_actor_id,p_tenant_id);
 IF (p_after IS NULL)<>(p_version IS NULL) OR (p_version IS NOT NULL AND p_version !~ '^[0-9]{1,19}$') THEN RAISE EXCEPTION 'TALENT_EXPORT_CURSOR';END IF;
 SELECT coalesce((SELECT version::text FROM public.talent_pool_versions WHERE tenant_id=p_tenant_id),'0') INTO v;
 IF p_version IS NOT NULL AND p_version<>v THEN RAISE EXCEPTION 'TALENT_EXPORT_CHANGED';END IF;
 SELECT count(*) INTO n FROM (SELECT id FROM public.talent_people WHERE tenant_id=p_tenant_id AND merged_into_id IS NULL LIMIT 50001) bounded;
 IF n>50000 THEN RAISE EXCEPTION 'TALENT_EXPORT_LIMIT';END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',p.id,'revision',p.revision,'name',p.name,'city',p.city,'district',p.district,'skills',p.skills,'regions',p.regions,'contacts',p.contacts) ORDER BY p.id),'[]') INTO items
 FROM (SELECT id,revision,name,city,district,skills,regions,contacts FROM public.talent_people WHERE tenant_id=p_tenant_id AND merged_into_id IS NULL AND (p_after IS NULL OR id>p_after) ORDER BY id LIMIT 501) p;
 more:=jsonb_array_length(items)>500;
 IF more THEN items:=items-500; END IF;
 IF jsonb_array_length(items)>0 THEN last_id:=(items->(jsonb_array_length(items)-1)->>'id')::uuid;END IF;
 result:=jsonb_build_object('actorId',p_actor_id,'tenantId',p_tenant_id,'generatedAt',statement_timestamp(),'version',v,'after',p_after,'total',n,'rows',items,'more',more,'next',CASE WHEN more THEN last_id ELSE NULL END);
 IF octet_length(result::text)>5242880 THEN RAISE EXCEPTION 'TALENT_EXPORT_LIMIT';END IF;
 RETURN result;
END $_$;

CREATE OR REPLACE FUNCTION "public"."talent_match_source"("p_actor_id" "uuid", "p_tenant_id" "uuid", "p_rows" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    SET "statement_timeout" TO '10s'
    AS $_$
DECLARE q jsonb;results jsonb:='[]';people jsonb;result jsonb;n integer;ids uuid[];key_name text;keys text[];person_id uuid;
BEGIN
 PERFORM public.talent_assert_scope(p_actor_id,p_tenant_id);
 IF jsonb_typeof(p_rows) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'TALENT_MATCH_VALIDATION';END IF;
 IF jsonb_array_length(p_rows) NOT BETWEEN 1 AND 100 OR octet_length(p_rows::text)>262144 THEN RAISE EXCEPTION 'TALENT_MATCH_LIMIT';END IF;
 IF (SELECT count(*)<>count(DISTINCT x->>'number') FROM jsonb_array_elements(p_rows) x) THEN RAISE EXCEPTION 'TALENT_MATCH_VALIDATION';END IF;
 FOR q IN SELECT value FROM jsonb_array_elements(p_rows) LOOP
  IF jsonb_typeof(q) IS DISTINCT FROM 'object' OR (q-ARRAY['number','name','phone','email','personId'])<>'{}'
   OR jsonb_typeof(q->'number') IS DISTINCT FROM 'number' OR (q->>'number') !~ '^[0-9]+$' OR (q->>'number')::bigint NOT BETWEEN 1 AND 50001
   OR jsonb_typeof(q->'name') IS DISTINCT FROM 'string' OR length(q->>'name') NOT BETWEEN 1 AND 160
   OR jsonb_typeof(q->'phone') IS DISTINCT FROM 'string' OR length(q->>'phone')>320
   OR jsonb_typeof(q->'email') IS DISTINCT FROM 'string' OR length(q->>'email')>2560
   OR ((q->>'name')||(q->>'phone')||(q->>'email')) ~ '[[:cntrl:]]'
  THEN RAISE EXCEPTION 'TALENT_MATCH_VALIDATION';END IF;
  person_id:=NULL;
  IF q ? 'personId' THEN
   IF jsonb_typeof(q->'personId') IS DISTINCT FROM 'string' THEN RAISE EXCEPTION 'TALENT_MATCH_VALIDATION';END IF;
   BEGIN person_id:=(q->>'personId')::uuid;EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION 'TALENT_MATCH_VALIDATION';END;
  END IF;
  key_name:=public.talent_import_name_key(q->>'name');
  keys:=public.talent_match_contact_keys(p_tenant_id,public.talent_import_contacts(q->>'phone',q->>'email'));
  IF person_id IS NOT NULL THEN
   SELECT array_agg(id) INTO ids FROM public.talent_people WHERE tenant_id=p_tenant_id AND merged_into_id IS NULL AND id=person_id;
  ELSE
   -- Each index branch is bounded before the union; 21st result is overflow evidence.
   SELECT array_agg(id ORDER BY id) INTO ids FROM (
    (SELECT id FROM public.talent_people WHERE tenant_id=p_tenant_id AND merged_into_id IS NULL AND public.talent_import_name_key(name)=key_name ORDER BY id LIMIT 21)
    UNION
    (SELECT id FROM public.talent_people WHERE tenant_id=p_tenant_id AND merged_into_id IS NULL AND public.talent_match_contact_keys(tenant_id,contacts) && keys ORDER BY id LIMIT 21)
    ORDER BY id LIMIT 21
   ) matches;
  END IF;
  n:=coalesce(cardinality(ids),0);
  SELECT coalesce(jsonb_agg(jsonb_build_object('person',jsonb_build_object('id',p.id,'revision',p.revision,'name',p.name,'city',p.city,'district',p.district,'skills',p.skills,'regions',p.regions,'contacts',p.contacts),
   'reasons',to_jsonb(array_remove(ARRAY[
    CASE WHEN person_id IS NOT NULL THEN 'BPS kişi kimliği' END,
    CASE WHEN person_id IS NULL AND public.talent_import_name_key(p.name)=key_name THEN 'İsim benzerliği' END,
    CASE WHEN person_id IS NULL AND q->>'phone'<>'' AND public.talent_match_contact_keys(p_tenant_id,p.contacts) && public.talent_match_contact_keys(p_tenant_id,public.talent_import_contacts(q->>'phone','')) THEN 'Telefon eşleşmesi' END,
    CASE WHEN person_id IS NULL AND q->>'email'<>'' AND public.talent_match_contact_keys(p_tenant_id,p.contacts) && public.talent_match_contact_keys(p_tenant_id,public.talent_import_contacts('',q->>'email')) THEN 'E-posta eşleşmesi' END
   ],NULL))) ORDER BY p.id),'[]') INTO people FROM public.talent_people p WHERE p.tenant_id=p_tenant_id AND p.id=ANY(ids[1:20]);
  results:=results||jsonb_build_array(jsonb_build_object('number',q->'number','candidates',people,'more',n>20));
 END LOOP;
 result:=jsonb_build_object('actorId',p_actor_id,'tenantId',p_tenant_id,'generatedAt',statement_timestamp(),'rows',results);
 IF octet_length(result::text)>5242880 THEN RAISE EXCEPTION 'TALENT_MATCH_LIMIT';END IF;
 RETURN result;
END $_$;

CREATE OR REPLACE FUNCTION "public"."talent_import_apply_row"("p_actor" "uuid", "p_tenant" "uuid", "p_batch" "uuid", "p_number" integer) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    SET "lock_timeout" TO '3s'
    AS $$
DECLARE b public.talent_import_batches; r public.talent_import_rows; v_person public.talent_people;
 s jsonb; input jsonb; contacts jsonb; f text;  receipt jsonb; w uuid; outcome text; problem text; c_new jsonb;
BEGIN
 PERFORM 1 FROM public.profiles WHERE id=auth.uid() FOR SHARE;
 PERFORM 1 FROM public.tenant_memberships WHERE user_id=auth.uid() AND tenant_id=p_tenant FOR SHARE;
 PERFORM public.talent_assert_scope(p_actor,p_tenant);
 SELECT * INTO b FROM public.talent_import_batches WHERE id=p_batch AND tenant_id=p_tenant AND actor_id=p_actor FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'TALENT_IMPORT_NOT_FOUND'; END IF;
 SELECT * INTO r FROM public.talent_import_rows WHERE batch_id=p_batch AND tenant_id=p_tenant AND row_number=p_number FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'TALENT_IMPORT_NOT_FOUND'; END IF;
 IF r.status<>'pending' THEN RETURN jsonb_build_object('number',r.row_number,'status',r.status,'result',r.result); END IF;
 BEGIN
  PERFORM public.talent_import_validate_row(r.payload);s:=r.payload->'source';
  IF r.payload->>'kind'='new' THEN
   PERFORM public.talent_import_fence(p_tenant);
   -- VOLATILE statement after the fence observes committed writes we waited for.
   IF EXISTS(SELECT 1 FROM public.talent_people candidate WHERE candidate.tenant_id=p_tenant AND candidate.merged_into_id IS NULL AND
    (public.talent_import_name_key(candidate.name)=public.talent_import_name_key(s->>'name')
     OR public.talent_match_contact_keys(candidate.tenant_id,candidate.contacts) && public.talent_match_contact_keys(p_tenant,public.talent_import_contacts(s->>'phone',s->>'email'))))
   THEN RAISE EXCEPTION 'TALENT_IMPORT_MATCH'; END IF;
   input:=jsonb_build_object('name',btrim(s->>'name'),'city',nullif(btrim(s->>'city'),''),'district',nullif(btrim(s->>'district'),''),'contacts','[]'::jsonb,'skills',public.talent_import_list(s->>'skills'),'regions',public.talent_import_list(s->>'regions'),'workTypes','[]'::jsonb);
   contacts:=public.talent_import_contacts(s->>'phone',s->>'email');
   input:=jsonb_set(input,'{contacts}',contacts);
   receipt:=public.talent_save_person(p_actor,p_tenant,r.command_id,NULL,NULL,input);
   UPDATE public.talent_people SET source='import' WHERE id=(receipt->>'id')::uuid AND tenant_id=p_tenant;outcome:='created';
  ELSE
   SELECT worker_id INTO w FROM public.talent_people WHERE tenant_id=p_tenant AND id=(r.payload->>'targetId')::uuid;
   IF w IS NOT NULL THEN PERFORM 1 FROM public.ops_workers WHERE tenant_id=p_tenant AND id=w FOR UPDATE; END IF;
   SELECT * INTO v_person FROM public.talent_people WHERE tenant_id=p_tenant AND id=(r.payload->>'targetId')::uuid FOR UPDATE;
   IF NOT FOUND THEN RAISE EXCEPTION 'TALENT_NOT_FOUND'; END IF;
   IF v_person.merged_into_id IS NOT NULL OR v_person.revision<>(r.payload->>'expectedRevision')::integer THEN RAISE EXCEPTION 'TALENT_CONFLICT'; END IF;
   input:=jsonb_build_object('name',v_person.name,'city',v_person.city,'district',v_person.district,'contacts',v_person.contacts,'skills',to_jsonb(v_person.skills),'regions',to_jsonb(v_person.regions),'workTypes',to_jsonb(v_person.work_types));contacts:=v_person.contacts;
   FOR f IN SELECT jsonb_array_elements_text(r.payload->'fields') LOOP
    IF f IN ('name','city','district') THEN input:=jsonb_set(input,ARRAY[f],to_jsonb(btrim(s->>f)));
    ELSIF f IN ('skills','regions') THEN
     input:=jsonb_set(input,ARRAY[f],(SELECT jsonb_agg(v ORDER BY v) FROM (SELECT DISTINCT value v FROM jsonb_array_elements_text((input->f)||public.talent_import_list(s->>f))) q));
     IF jsonb_array_length(input->f)>20 THEN RAISE EXCEPTION 'TALENT_IMPORT_VALIDATION'; END IF;
    ELSE
     FOR c_new IN SELECT value FROM jsonb_array_elements(public.talent_import_contacts(CASE WHEN f='phone' THEN s->>f ELSE '' END,CASE WHEN f='email' THEN s->>f ELSE '' END)) LOOP
      IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(contacts) c WHERE public.talent_import_contact_key(c->>'kind',c->>'value')=public.talent_import_contact_key(c_new->>'kind',c_new->>'value')) THEN contacts:=contacts||jsonb_build_array(c_new); END IF;
     END LOOP;
    END IF;
   END LOOP;
   input:=jsonb_set(input,'{contacts}',contacts);
   IF input=jsonb_build_object('name',v_person.name,'city',v_person.city,'district',v_person.district,'contacts',v_person.contacts,'skills',to_jsonb(v_person.skills),'regions',to_jsonb(v_person.regions),'workTypes',to_jsonb(v_person.work_types)) THEN
    receipt:=jsonb_build_object('id',v_person.id,'revision',v_person.revision);outcome:='unchanged';
   ELSE receipt:=public.talent_save_person(p_actor,p_tenant,r.command_id,v_person.id,v_person.revision,input);outcome:='updated'; END IF;
  END IF;
  IF outcome='updated' THEN
   INSERT INTO public.talent_import_changes(tenant_id,batch_id,row_number,person_id,before_fields,after_fields,after_revision,worker_id,worker_revision)
   SELECT p_tenant,p_batch,p_number,p.id,public.talent_import_person_fields(v_person),public.talent_import_person_fields(p),p.revision,p.worker_id,w.directory_revision
   FROM public.talent_people p LEFT JOIN public.ops_workers w ON w.tenant_id=p.tenant_id AND w.id=p.worker_id
   WHERE p.tenant_id=p_tenant AND p.id=(receipt->>'id')::uuid;
  END IF;
  UPDATE public.talent_import_rows SET status=outcome,result=jsonb_build_object('personId',receipt->'id','revision',receipt->'revision') WHERE batch_id=p_batch AND row_number=p_number;
 EXCEPTION WHEN raise_exception THEN
  GET STACKED DIAGNOSTICS problem=MESSAGE_TEXT;
  IF problem NOT IN ('TALENT_IMPORT_MATCH','TALENT_CONFLICT','TALENT_NOT_FOUND','TALENT_VALIDATION','TALENT_IMPORT_VALIDATION') THEN RAISE; END IF;
  UPDATE public.talent_import_rows SET status='blocked',result=jsonb_build_object('code',problem) WHERE batch_id=p_batch AND row_number=p_number;
 END;
 SELECT * INTO r FROM public.talent_import_rows WHERE batch_id=p_batch AND row_number=p_number;
 RETURN jsonb_build_object('number',r.row_number,'status',r.status,'result',r.result);
END $$;

CREATE OR REPLACE FUNCTION "public"."talent_person_detail"("p_actor_id" "uuid", "p_tenant_id" "uuid", "p_person_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE v_requested uuid:=p_person_id; v_person public.talent_people; v_events jsonb; v_assignments jsonb;
BEGIN
 PERFORM public.talent_assert_scope(p_actor_id,p_tenant_id);
 p_person_id:=public.talent_canonical_person(p_tenant_id,p_person_id);
 SELECT * INTO v_person FROM public.talent_people WHERE tenant_id=p_tenant_id AND id=p_person_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'TALENT_NOT_FOUND'; END IF;
 SELECT coalesce(jsonb_agg(to_jsonb(e) ORDER BY e.id::bigint DESC),'[]') INTO v_events FROM (
  SELECT e.id::text,e.kind,e.revision,e.changed_fields AS "changedFields",e.occurred_at AS "occurredAt",
   (SELECT p.display_name FROM public.profiles p JOIN public.tenant_memberships m ON m.user_id=p.id
    WHERE p.id=e.actor_id AND m.tenant_id=p_tenant_id) AS "actorName"
  FROM public.talent_person_events e WHERE e.tenant_id=p_tenant_id AND e.person_id IN(SELECT public.talent_person_family(p_tenant_id,p_person_id)) ORDER BY e.id DESC LIMIT 20
 ) e;
 SELECT coalesce(jsonb_agg(to_jsonb(a) ORDER BY a."workDate" DESC,a.id),'[]') INTO v_assignments FROM (
  SELECT a.id,a.work_date AS "workDate",c.name AS "companyName",l.name AS "locationName",r.position,
   (a.removed_at IS NOT NULL OR r.lifecycle='cancelled') AS removed
  FROM public.ops_assignments a JOIN public.ops_daily_requests r ON r.tenant_id=a.tenant_id AND r.id=a.request_id
   JOIN public.companies c ON c.tenant_id=r.tenant_id AND c.id=r.company_id
   JOIN public.ops_locations l ON l.tenant_id=r.tenant_id AND l.company_id=r.company_id AND l.id=r.location_id
  WHERE a.tenant_id=p_tenant_id AND a.worker_id=v_person.worker_id ORDER BY a.work_date DESC,a.id LIMIT 10
 ) a;
 RETURN jsonb_build_object('person',public.talent_person_json(v_person),'events',v_events,'assignments',v_assignments,'redirectedFromId',CASE WHEN v_requested<>p_person_id THEN v_requested ELSE NULL END,'mergedSourceCount',(SELECT count(*)-1 FROM public.talent_person_family(p_tenant_id,p_person_id)));
END $$;

CREATE OR REPLACE FUNCTION "public"."talent_conversation_list"("p_actor_id" "uuid", "p_tenant_id" "uuid", "p_person_id" "uuid", "p_offset" integer DEFAULT 0) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE result jsonb;
BEGIN
 PERFORM public.talent_assert_scope(p_actor_id,p_tenant_id);
 IF p_offset IS NULL OR p_offset<0 OR p_offset>100000 THEN RAISE EXCEPTION 'CONVERSATION_VALIDATION'; END IF;
 PERFORM 1 FROM public.talent_people WHERE tenant_id=p_tenant_id AND id=p_person_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'TALENT_NOT_FOUND'; END IF;
 SELECT coalesce(jsonb_agg(x.payload ORDER BY x.recorded_at DESC,x.id DESC),'[]'::jsonb) INTO result FROM (
  SELECT c.id,c.recorded_at,jsonb_build_object('id',c.id,'tenantId',c.tenant_id,'personId',p_person_id,'sourcePersonId',c.person_id,'requestId',c.request_id,'actorId',c.actor_id,'commandId',c.command_id,'channel',c.channel,'outcome',c.outcome,'note',c.note,'recordedAt',c.recorded_at) AS payload
  FROM public.talent_conversations c WHERE c.tenant_id=p_tenant_id AND c.person_id IN(SELECT public.talent_person_family(p_tenant_id,p_person_id))
  ORDER BY c.recorded_at DESC,c.id DESC LIMIT 21 OFFSET p_offset
 ) x;
 RETURN result;
END $$;

CREATE OR REPLACE FUNCTION "public"."talent_attachment_list"("p_actor_id" "uuid", "p_tenant_id" "uuid", "p_person_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE result jsonb;
BEGIN
 PERFORM public.talent_assert_scope(p_actor_id,p_tenant_id);
 PERFORM 1 FROM public.talent_people WHERE id=p_person_id AND tenant_id=p_tenant_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'TALENT_NOT_FOUND'; END IF;
 SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.created_at DESC,t.id DESC),'[]') INTO result FROM (
 SELECT a.id,p_person_id AS person_id,a.person_id AS source_person_id,a.category,a.filename,a.mime,a.size,a.created_at FROM public.talent_attachments a
 WHERE a.tenant_id=p_tenant_id AND a.person_id IN(SELECT public.talent_person_family(p_tenant_id,p_person_id)) AND a.ready
 AND (public.current_user_role() IN ('yonetici','ik') OR a.category<>'onboarding')
 ORDER BY a.created_at DESC,a.id DESC LIMIT 51) t;
 RETURN result;
END $$;

CREATE FUNCTION public.talent_merged_availability(p_actor uuid,p_tenant uuid,p_person uuid,p_offset integer DEFAULT 0) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 PERFORM public.talent_assert_scope(p_actor,p_tenant);
 IF p_person IS NULL OR p_offset IS NULL OR p_offset<0 OR p_offset>100000 OR p_offset%20<>0 THEN RAISE EXCEPTION 'TALENT_VALIDATION';END IF;
 PERFORM 1 FROM public.talent_people WHERE tenant_id=p_tenant AND id=p_person;
 IF NOT FOUND THEN RAISE EXCEPTION 'TALENT_NOT_FOUND';END IF;
 SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.recorded_at DESC,x.id),'[]') INTO result FROM(
 SELECT a.*,p.name AS source_name FROM public.talent_availability a JOIN public.talent_people p ON p.tenant_id=a.tenant_id AND p.id=a.person_id
 WHERE a.tenant_id=p_tenant AND a.person_id<>p_person AND a.person_id IN(SELECT public.talent_person_family(p_tenant,p_person))
 ORDER BY a.recorded_at DESC,a.id LIMIT 21 OFFSET p_offset)x;
 RETURN jsonb_build_object('actorId',p_actor,'tenantId',p_tenant,'personId',p_person,'offset',p_offset,'rows',result);
END $$;
REVOKE ALL ON FUNCTION public.talent_merged_availability(uuid,uuid,uuid,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.talent_merged_availability(uuid,uuid,uuid,integer) TO authenticated;


-- Source: pool-contact-summary/01_summary.sql
-- Local candidate. Requires person-merge 01/02/03, so closed-card history stays visible.
CREATE INDEX IF NOT EXISTS talent_conversations_general_recent
 ON public.talent_conversations(tenant_id,person_id,recorded_at DESC,id DESC)
 WHERE request_id IS NULL;
-- Private shared definition: general contact semantics must match list filtering.
CREATE OR REPLACE FUNCTION public.talent_latest_general_contact(p_tenant uuid,p_person uuid)
RETURNS TABLE(id uuid,person_id uuid,recorded_at timestamptz,channel text,outcome text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT c.* FROM public.talent_person_family(p_tenant,p_person) family(id)
 JOIN LATERAL (SELECT c.id,c.person_id,c.recorded_at,c.channel,c.outcome FROM public.talent_conversations c
  WHERE c.tenant_id=p_tenant AND c.person_id=family.id AND c.request_id IS NULL
  ORDER BY c.recorded_at DESC,c.id DESC LIMIT 1) c ON true
 ORDER BY c.recorded_at DESC,c.id DESC LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.talent_latest_general_contact(uuid,uuid) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.talent_contact_summaries(p_actor uuid,p_tenant uuid,p_people uuid[])
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' SET statement_timeout='10s' AS $$
DECLARE rows jsonb;
BEGIN
 PERFORM public.talent_assert_scope(p_actor,p_tenant);
 IF p_people IS NULL OR cardinality(p_people)>50 OR array_position(p_people,NULL) IS NOT NULL
 OR cardinality(p_people)<>(SELECT count(DISTINCT id) FROM unnest(p_people) id)
 THEN RAISE EXCEPTION 'TALENT_VALIDATION';END IF;
 IF EXISTS(SELECT 1 FROM unnest(p_people) requested(id) WHERE NOT EXISTS(
  SELECT 1 FROM public.talent_people p WHERE p.id=requested.id AND p.tenant_id=p_tenant AND p.merged_into_id IS NULL
 )) THEN RAISE EXCEPTION 'TALENT_NOT_FOUND';END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('personId',p.id,'last',c.summary) ORDER BY p.ord),'[]') INTO rows
 FROM unnest(p_people) WITH ORDINALITY p(id,ord)
 LEFT JOIN LATERAL (
  SELECT jsonb_build_object('id',c.id,'sourcePersonId',c.person_id,'recordedAt',c.recorded_at,'channel',c.channel,'outcome',c.outcome) summary
  FROM public.talent_latest_general_contact(p_tenant,p.id) c
 ) c ON true;
 RETURN jsonb_build_object('actorId',p_actor,'tenantId',p_tenant,'rows',rows,'generatedAt',statement_timestamp());
END $$;
REVOKE ALL ON FUNCTION public.talent_contact_summaries(uuid,uuid,uuid[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.talent_contact_summaries(uuid,uuid,uuid[]) TO authenticated;


-- Source: pool-contact-summary/02_callback_filter.sql
-- Depends on summary 01. Filter before count and pagination.
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
 WITH filtered AS MATERIALIZED (
  SELECT p.* FROM public.talent_people p
  WHERE p.tenant_id=p_tenant_id AND p.merged_into_id IS NULL AND (v_view<>'contact_missing' OR jsonb_array_length(p.contacts)=0)
   AND (v_view<>'linked' OR p.worker_id IS NOT NULL)
   AND (v_view<>'call_back' OR (SELECT c.outcome FROM public.talent_latest_general_contact(p.tenant_id,p.id) c)='call_back')
   AND strpos(public.talent_fold(p.city),v_city)>0
   AND strpos(public.talent_fold(p.district),v_district)>0
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
   AND strpos(public.talent_fold(concat_ws(' ',p.name,p.city,p.district,array_to_string(p.skills,' '),
    array_to_string(p.regions,' '),(SELECT string_agg(c->>'value',' ') FROM jsonb_array_elements(p.contacts) c),
    (SELECT w.code FROM public.ops_workers w WHERE w.tenant_id=p.tenant_id AND w.id=p.worker_id))),v_search)>0
 ), page AS (SELECT * FROM filtered ORDER BY name,id LIMIT 50 OFFSET v_offset)
 SELECT (SELECT count(*) FROM filtered),coalesce(jsonb_agg(public.talent_person_json(page::public.talent_people) ORDER BY name,id),'[]') INTO v_total,v_rows FROM page;
 IF v_total>1000050 THEN RAISE EXCEPTION 'TALENT_TOO_LARGE'; END IF;
 RETURN jsonb_build_object('tenantId',p_tenant_id,'query',p_query,'total',v_total,'rows',v_rows,'generatedAt',statement_timestamp());
END $_$;


COMMIT;
