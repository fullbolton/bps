-- Read-only, source-key matching. Never return an unrelated full tenant pool.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
CREATE FUNCTION public.talent_match_contact_keys(p_tenant uuid,p_contacts jsonb) RETURNS text[]
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT coalesce(array_agg(DISTINCT p_tenant::text||'|'||public.talent_import_contact_key(c->>'kind',c->>'value')),ARRAY[]::text[]) FROM jsonb_array_elements(p_contacts) c
$$;
REVOKE ALL ON FUNCTION public.talent_match_contact_keys(uuid,jsonb) FROM PUBLIC,anon,authenticated;
CREATE INDEX talent_people_match_name ON public.talent_people(tenant_id,public.talent_import_name_key(name),id);
CREATE INDEX talent_people_match_contacts ON public.talent_people USING gin(public.talent_match_contact_keys(tenant_id,contacts));
CREATE FUNCTION public.talent_match_source(p_actor_id uuid,p_tenant_id uuid,p_rows jsonb) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' SET statement_timeout='10s' AS $$
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
   OR jsonb_typeof(q->'phone') IS DISTINCT FROM 'string' OR length(q->>'phone')>30
   OR jsonb_typeof(q->'email') IS DISTINCT FROM 'string' OR length(q->>'email')>254
   OR ((q->>'name')||(q->>'phone')||(q->>'email')) ~ '[[:cntrl:]]'
  THEN RAISE EXCEPTION 'TALENT_MATCH_VALIDATION';END IF;
  person_id:=NULL;
  IF q ? 'personId' THEN
   IF jsonb_typeof(q->'personId') IS DISTINCT FROM 'string' THEN RAISE EXCEPTION 'TALENT_MATCH_VALIDATION';END IF;
   BEGIN person_id:=(q->>'personId')::uuid;EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION 'TALENT_MATCH_VALIDATION';END;
  END IF;
  key_name:=public.talent_import_name_key(q->>'name');
  keys:=ARRAY[]::text[];
  IF q->>'phone'<>'' THEN keys:=array_append(keys,p_tenant_id::text||'|'||public.talent_import_contact_key('phone',q->>'phone'));END IF;
  IF q->>'email'<>'' THEN keys:=array_append(keys,p_tenant_id::text||'|'||public.talent_import_contact_key('email',q->>'email'));END IF;
  IF person_id IS NOT NULL THEN
   SELECT array_agg(id) INTO ids FROM public.talent_people WHERE tenant_id=p_tenant_id AND id=person_id;
  ELSE
   -- Each index branch is bounded before the union; 21st result is overflow evidence.
   SELECT array_agg(id ORDER BY id) INTO ids FROM (
    (SELECT id FROM public.talent_people WHERE tenant_id=p_tenant_id AND public.talent_import_name_key(name)=key_name ORDER BY id LIMIT 21)
    UNION
    (SELECT id FROM public.talent_people WHERE tenant_id=p_tenant_id AND public.talent_match_contact_keys(tenant_id,contacts) && keys ORDER BY id LIMIT 21)
    ORDER BY id LIMIT 21
   ) matches;
  END IF;
  n:=coalesce(cardinality(ids),0);
  SELECT coalesce(jsonb_agg(jsonb_build_object('person',jsonb_build_object('id',p.id,'revision',p.revision,'name',p.name,'city',p.city,'district',p.district,'skills',p.skills,'regions',p.regions,'contacts',p.contacts),
   'reasons',to_jsonb(array_remove(ARRAY[
    CASE WHEN person_id IS NOT NULL THEN 'BPS kişi kimliği' END,
    CASE WHEN person_id IS NULL AND public.talent_import_name_key(p.name)=key_name THEN 'İsim benzerliği' END,
    CASE WHEN person_id IS NULL AND q->>'phone'<>'' AND public.talent_match_contact_keys(p_tenant_id,p.contacts) && ARRAY[p_tenant_id::text||'|'||public.talent_import_contact_key('phone',q->>'phone')] THEN 'Telefon eşleşmesi' END,
    CASE WHEN person_id IS NULL AND q->>'email'<>'' AND public.talent_match_contact_keys(p_tenant_id,p.contacts) && ARRAY[p_tenant_id::text||'|'||public.talent_import_contact_key('email',q->>'email')] THEN 'E-posta eşleşmesi' END
   ],NULL))) ORDER BY p.id),'[]') INTO people FROM public.talent_people p WHERE p.tenant_id=p_tenant_id AND p.id=ANY(ids[1:20]);
  results:=results||jsonb_build_array(jsonb_build_object('number',q->'number','candidates',people,'more',n>20));
 END LOOP;
 result:=jsonb_build_object('actorId',p_actor_id,'tenantId',p_tenant_id,'generatedAt',statement_timestamp(),'rows',results);
 IF octet_length(result::text)>5242880 THEN RAISE EXCEPTION 'TALENT_MATCH_LIMIT';END IF;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.talent_match_source(uuid,uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.talent_match_source(uuid,uuid,jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION "public"."talent_import_apply_row"("p_actor" "uuid", "p_tenant" "uuid", "p_batch" "uuid", "p_number" integer) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    SET "lock_timeout" TO '3s'
    AS $$
DECLARE b public.talent_import_batches; r public.talent_import_rows; v_person public.talent_people;
 s jsonb; input jsonb; contacts jsonb; f text;  receipt jsonb; w uuid; outcome text; problem text;
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
   IF EXISTS(SELECT 1 FROM public.talent_people candidate WHERE candidate.tenant_id=p_tenant AND
    (public.talent_import_name_key(candidate.name)=public.talent_import_name_key(s->>'name')
     OR public.talent_match_contact_keys(candidate.tenant_id,candidate.contacts) && array_remove(ARRAY[
      CASE WHEN s->>'phone'<>'' THEN p_tenant::text||'|'||public.talent_import_contact_key('phone',s->>'phone') END,
      CASE WHEN s->>'email'<>'' THEN p_tenant::text||'|'||public.talent_import_contact_key('email',s->>'email') END
     ],NULL)))
   THEN RAISE EXCEPTION 'TALENT_IMPORT_MATCH'; END IF;
   input:=jsonb_build_object('name',btrim(s->>'name'),'city',nullif(btrim(s->>'city'),''),'district',nullif(btrim(s->>'district'),''),'contacts','[]'::jsonb,'skills',public.talent_import_list(s->>'skills'),'regions',public.talent_import_list(s->>'regions'),'workTypes','[]'::jsonb);
   contacts:='[]';
   FOREACH f IN ARRAY ARRAY['phone','email'] LOOP
    IF s->>f<>'' THEN contacts:=contacts||jsonb_build_array(jsonb_build_object('kind',f,'value',s->>f)); END IF;
   END LOOP;
   input:=jsonb_set(input,'{contacts}',contacts);
   receipt:=public.talent_save_person(p_actor,p_tenant,r.command_id,NULL,NULL,input);
   UPDATE public.talent_people SET source='import' WHERE id=(receipt->>'id')::uuid AND tenant_id=p_tenant;outcome:='created';
  ELSE
   SELECT worker_id INTO w FROM public.talent_people WHERE tenant_id=p_tenant AND id=(r.payload->>'targetId')::uuid;
   IF w IS NOT NULL THEN PERFORM 1 FROM public.ops_workers WHERE tenant_id=p_tenant AND id=w FOR UPDATE; END IF;
   SELECT * INTO v_person FROM public.talent_people WHERE tenant_id=p_tenant AND id=(r.payload->>'targetId')::uuid FOR UPDATE;
   IF NOT FOUND THEN RAISE EXCEPTION 'TALENT_NOT_FOUND'; END IF;
   IF v_person.revision<>(r.payload->>'expectedRevision')::integer THEN RAISE EXCEPTION 'TALENT_CONFLICT'; END IF;
   input:=jsonb_build_object('name',v_person.name,'city',v_person.city,'district',v_person.district,'contacts',v_person.contacts,'skills',to_jsonb(v_person.skills),'regions',to_jsonb(v_person.regions),'workTypes',to_jsonb(v_person.work_types));contacts:=v_person.contacts;
   FOR f IN SELECT jsonb_array_elements_text(r.payload->'fields') LOOP
    IF f IN ('name','city','district') THEN input:=jsonb_set(input,ARRAY[f],to_jsonb(btrim(s->>f)));
    ELSIF f IN ('skills','regions') THEN
     input:=jsonb_set(input,ARRAY[f],(SELECT jsonb_agg(v ORDER BY v) FROM (SELECT DISTINCT value v FROM jsonb_array_elements_text((input->f)||public.talent_import_list(s->>f))) q));
     IF jsonb_array_length(input->f)>20 THEN RAISE EXCEPTION 'TALENT_IMPORT_VALIDATION'; END IF;
    ELSE
     IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(contacts) c WHERE public.talent_import_contact_key(c->>'kind',c->>'value')=public.talent_import_contact_key(f,s->>f)) THEN contacts:=contacts||jsonb_build_array(jsonb_build_object('kind',f,'value',s->>f)); END IF;
    END IF;
   END LOOP;
   input:=jsonb_set(input,'{contacts}',contacts);
   IF input=jsonb_build_object('name',v_person.name,'city',v_person.city,'district',v_person.district,'contacts',v_person.contacts,'skills',to_jsonb(v_person.skills),'regions',to_jsonb(v_person.regions),'workTypes',to_jsonb(v_person.work_types)) THEN
    receipt:=jsonb_build_object('id',v_person.id,'revision',v_person.revision);outcome:='unchanged';
   ELSE receipt:=public.talent_save_person(p_actor,p_tenant,r.command_id,v_person.id,v_person.revision,input);outcome:='updated'; END IF;
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
COMMIT;
