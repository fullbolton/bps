-- Extended working-copy fields; old persisted import plans remain valid.
BEGIN;
SET LOCAL lock_timeout='5s';
CREATE FUNCTION public.talent_import_list(p_value text) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE parts text[];
BEGIN
 IF p_value IS NULL OR btrim(p_value)='' THEN RETURN '[]'::jsonb; END IF;
 parts:=string_to_array(p_value,';');
 IF cardinality(parts)>20 OR EXISTS(SELECT 1 FROM unnest(parts) x WHERE length(btrim(x)) NOT BETWEEN 1 AND 80 OR x ~ '[[:cntrl:]]') THEN RAISE EXCEPTION 'TALENT_IMPORT_VALIDATION'; END IF;
 RETURN (SELECT jsonb_agg(x ORDER BY x) FROM (SELECT DISTINCT btrim(v) x FROM unnest(parts) v) q);
END $$;
REVOKE ALL ON FUNCTION public.talent_import_list(text) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION "public"."talent_import_validate_row"("p" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql" IMMUTABLE
    SET "search_path" TO ''
    AS $_$
DECLARE s jsonb; k text;
BEGIN
 IF jsonb_typeof(p) IS DISTINCT FROM 'object' OR (p-ARRAY['number','kind','source','targetId','expectedRevision','fields'])<>'{}'
 OR jsonb_typeof(p->'number') IS DISTINCT FROM 'number' OR (p->>'number') !~ '^[0-9]+$'
 OR (p->>'number')::bigint NOT BETWEEN 1 AND 50001 OR coalesce(p->>'kind','') NOT IN ('new','existing','hold') THEN RAISE EXCEPTION 'TALENT_IMPORT_VALIDATION'; END IF;
 IF p->>'kind'='hold' THEN
  IF (p-ARRAY['number','kind'])<>'{}' THEN RAISE EXCEPTION 'TALENT_IMPORT_VALIDATION'; END IF;
  RETURN;
 END IF;
 s:=p->'source';
 IF jsonb_typeof(s) IS DISTINCT FROM 'object' OR (s-ARRAY['name','city','phone','email','district','skills','regions'])<>'{}' THEN RAISE EXCEPTION 'TALENT_IMPORT_VALIDATION'; END IF;
 FOREACH k IN ARRAY ARRAY['name','city','phone','email'] LOOP
  IF jsonb_typeof(s->k) IS DISTINCT FROM 'string' OR s->>k ~ '[[:cntrl:]]' THEN RAISE EXCEPTION 'TALENT_IMPORT_VALIDATION'; END IF;
 END LOOP;
 IF length(btrim(s->>'name')) NOT BETWEEN 1 AND 160 OR public.talent_import_name_key(s->>'name')=''
 OR length(s->>'city')>80
 OR (s->>'phone'<>'' AND (s->>'phone' !~ '^\+?[0-9][0-9 ()-]{5,29}$'))
 OR (s->>'email'<>'' AND (length(s->>'email')>254 OR s->>'email' !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'))
 THEN RAISE EXCEPTION 'TALENT_IMPORT_VALIDATION'; END IF;
 FOREACH k IN ARRAY ARRAY['district','skills','regions'] LOOP
  IF s ? k AND (jsonb_typeof(s->k) IS DISTINCT FROM 'string' OR s->>k ~ '[[:cntrl:]]') THEN RAISE EXCEPTION 'TALENT_IMPORT_VALIDATION'; END IF;
 END LOOP;
 IF length(s->>'district')>80 THEN RAISE EXCEPTION 'TALENT_IMPORT_VALIDATION'; END IF;
 PERFORM public.talent_import_list(s->>'skills');
 PERFORM public.talent_import_list(s->>'regions');
 IF p->>'kind'='new' THEN
  IF (p-ARRAY['number','kind','source'])<>'{}' THEN RAISE EXCEPTION 'TALENT_IMPORT_VALIDATION'; END IF;
 ELSE
  IF jsonb_typeof(p->'targetId') IS DISTINCT FROM 'string' OR (p->>'targetId')::uuid IS NULL
   OR jsonb_typeof(p->'expectedRevision') IS DISTINCT FROM 'number' OR (p->>'expectedRevision') !~ '^[0-9]+$'
   OR (p->>'expectedRevision')::bigint NOT BETWEEN 0 AND 2147483646 OR jsonb_typeof(p->'fields') IS DISTINCT FROM 'array'
  THEN RAISE EXCEPTION 'TALENT_IMPORT_VALIDATION'; END IF;
  IF jsonb_array_length(p->'fields')>7 OR EXISTS(SELECT 1 FROM jsonb_array_elements(p->'fields') f WHERE jsonb_typeof(f)<>'string' OR (f#>>'{}') NOT IN ('name','city','phone','email','district','skills','regions'))
   OR (SELECT count(*)<>count(DISTINCT f) FROM jsonb_array_elements(p->'fields') f)
  THEN RAISE EXCEPTION 'TALENT_IMPORT_VALIDATION'; END IF;
  FOR k IN SELECT jsonb_array_elements_text(p->'fields') LOOP
   IF coalesce(btrim(s->>k),'')='' THEN RAISE EXCEPTION 'TALENT_IMPORT_VALIDATION'; END IF;
  END LOOP;
 END IF;
END $_$;
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
    (public.talent_import_name_key(candidate.name)=public.talent_import_name_key(s->>'name') OR EXISTS(
     SELECT 1 FROM jsonb_array_elements(candidate.contacts) c WHERE
      (s->>'phone'<>'' AND public.talent_import_contact_key(c->>'kind',c->>'value')=public.talent_import_contact_key('phone',s->>'phone')) OR
      (s->>'email'<>'' AND public.talent_import_contact_key(c->>'kind',c->>'value')=public.talent_import_contact_key('email',s->>'email')))))
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
  WHERE tenant_id=p_tenant_id ORDER BY id LIMIT 10001) p;
 IF v_total>10000 THEN RAISE EXCEPTION 'TALENT_COMPARE_TOO_LARGE';END IF;
 v_result:=jsonb_build_object('actorId',p_actor_id,'tenantId',p_tenant_id,'total',v_total,
  'generatedAt',statement_timestamp(),'rows',v_rows);
 IF octet_length(v_result::text)>5242880 THEN RAISE EXCEPTION 'TALENT_COMPARE_TOO_LARGE';END IF;
 RETURN v_result;
END $$;
COMMIT;
