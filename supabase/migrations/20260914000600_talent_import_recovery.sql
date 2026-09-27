BEGIN;
SET LOCAL lock_timeout='5s';
CREATE TABLE public.talent_import_closures (
 batch_id uuid PRIMARY KEY, actor_id uuid NOT NULL REFERENCES public.profiles(id),
 tenant_id uuid NOT NULL REFERENCES public.tenants(id), source_hash text NOT NULL CHECK(source_hash ~ '^[a-f0-9]{64}$'),
 total integer NOT NULL CHECK(total BETWEEN 1 AND 500), created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.talent_import_closures ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.talent_import_closures FROM PUBLIC,anon,authenticated;
ALTER FUNCTION public.talent_import_prepare(uuid,uuid,uuid,text,jsonb) RENAME TO talent_import_prepare_v1;
REVOKE ALL ON FUNCTION public.talent_import_prepare_v1(uuid,uuid,uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.talent_import_prepare(p_actor uuid,p_tenant uuid,p_batch uuid,p_source_hash text,p_rows jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='3s' AS $$
BEGIN
 PERFORM 1 FROM public.profiles WHERE id=auth.uid() FOR SHARE;
 PERFORM 1 FROM public.tenant_memberships WHERE user_id=auth.uid() AND tenant_id=p_tenant FOR SHARE;
 PERFORM public.talent_assert_scope(p_actor,p_tenant);
 IF p_batch IS NULL THEN RAISE EXCEPTION 'TALENT_IMPORT_VALIDATION'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('bps:talent-prepare:'||p_batch::text,0));
 IF EXISTS(SELECT 1 FROM public.talent_import_closures WHERE batch_id=p_batch) THEN RAISE EXCEPTION 'TALENT_IMPORT_CLOSED'; END IF;
 RETURN public.talent_import_prepare_v1(p_actor,p_tenant,p_batch,p_source_hash,p_rows);
END $$;
CREATE FUNCTION public.talent_import_recover(p_actor uuid,p_tenant uuid,p_batch uuid,p_source_hash text,p_total integer) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE b public.talent_import_batches; c public.talent_import_closures;
BEGIN
 PERFORM public.talent_assert_scope(p_actor,p_tenant);
 IF p_batch IS NULL OR p_source_hash IS NULL OR p_source_hash !~ '^[a-f0-9]{64}$' OR p_total IS NULL OR p_total NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION 'TALENT_IMPORT_VALIDATION'; END IF;
 SELECT * INTO c FROM public.talent_import_closures WHERE batch_id=p_batch;
 IF FOUND THEN
  IF c.actor_id<>p_actor OR c.tenant_id<>p_tenant OR c.source_hash<>p_source_hash OR c.total<>p_total THEN RAISE EXCEPTION 'TALENT_IMPORT_NOT_FOUND'; END IF;
  RETURN jsonb_build_object('kind','closed','batchId',p_batch,'actorId',p_actor,'tenantId',p_tenant,'sourceHash',p_source_hash,'total',p_total);
 END IF;
 SELECT * INTO b FROM public.talent_import_batches WHERE id=p_batch;
 IF NOT FOUND THEN RETURN jsonb_build_object('kind','unknown','batchId',p_batch,'actorId',p_actor,'tenantId',p_tenant,'sourceHash',p_source_hash,'total',p_total); END IF;
 IF b.actor_id<>p_actor OR b.tenant_id<>p_tenant OR b.source_hash<>p_source_hash OR jsonb_array_length(b.plan)<>p_total THEN RAISE EXCEPTION 'TALENT_IMPORT_NOT_FOUND'; END IF;
 RETURN jsonb_build_object('kind','batch','data',public.talent_import_status(p_actor,p_tenant,p_batch));
END $$;
CREATE FUNCTION public.talent_import_close(p_actor uuid,p_tenant uuid,p_batch uuid,p_source_hash text,p_total integer) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='3s' AS $$
DECLARE v jsonb;
BEGIN
 PERFORM 1 FROM public.profiles WHERE id=auth.uid() FOR SHARE;
 PERFORM 1 FROM public.tenant_memberships WHERE user_id=auth.uid() AND tenant_id=p_tenant FOR SHARE;
 PERFORM public.talent_assert_scope(p_actor,p_tenant);
 IF p_batch IS NULL THEN RAISE EXCEPTION 'TALENT_IMPORT_VALIDATION'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('bps:talent-prepare:'||p_batch::text,0));
 v:=public.talent_import_recover(p_actor,p_tenant,p_batch,p_source_hash,p_total);
 IF v->>'kind'='batch' THEN
  RETURN jsonb_build_object('kind','batch','data',public.talent_import_cancel(p_actor,p_tenant,p_batch));
 ELSIF v->>'kind'='unknown' THEN
  INSERT INTO public.talent_import_closures(batch_id,actor_id,tenant_id,source_hash,total) VALUES(p_batch,p_actor,p_tenant,p_source_hash,p_total);
 END IF;
 RETURN public.talent_import_recover(p_actor,p_tenant,p_batch,p_source_hash,p_total);
END $$;
REVOKE ALL ON FUNCTION public.talent_import_prepare(uuid,uuid,uuid,text,jsonb),public.talent_import_recover(uuid,uuid,uuid,text,integer),public.talent_import_close(uuid,uuid,uuid,text,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.talent_import_prepare(uuid,uuid,uuid,text,jsonb),public.talent_import_recover(uuid,uuid,uuid,text,integer),public.talent_import_close(uuid,uuid,uuid,text,integer) TO authenticated;

ALTER TABLE public.talent_people DROP CONSTRAINT talent_people_source_check;
ALTER TABLE public.talent_people ADD CONSTRAINT talent_people_source_check CHECK(source IN ('manual','operations','import'));
UPDATE public.talent_people p SET source='import' WHERE EXISTS(SELECT 1 FROM public.talent_import_rows r WHERE r.tenant_id=p.tenant_id AND r.status='created' AND r.result->>'personId'=p.id::text);

CREATE OR REPLACE FUNCTION public.talent_import_apply_row(p_actor uuid,p_tenant uuid,p_batch uuid,p_number integer) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='3s' AS $$
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
   input:=jsonb_build_object('name',btrim(s->>'name'),'city',nullif(btrim(s->>'city'),''),'district',NULL,'contacts','[]'::jsonb,'skills','[]'::jsonb,'regions','[]'::jsonb,'workTypes','[]'::jsonb);
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
    IF f IN ('name','city') THEN input:=jsonb_set(input,ARRAY[f],to_jsonb(btrim(s->>f)));
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
