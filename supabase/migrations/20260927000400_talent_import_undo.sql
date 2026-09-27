-- Future import updates retain exact before/after fields; historical values are never inferred.
BEGIN;
SET LOCAL lock_timeout='5s';
ALTER TABLE public.talent_import_rows DROP CONSTRAINT talent_import_rows_status_check;
ALTER TABLE public.talent_import_rows ADD CONSTRAINT talent_import_rows_status_check CHECK(status IN ('pending','created','updated','unchanged','held','blocked','cancelled','reverted'));
CREATE TABLE public.talent_import_changes(
 tenant_id uuid NOT NULL,batch_id uuid NOT NULL,row_number integer NOT NULL,person_id uuid NOT NULL,
 before_fields jsonb NOT NULL,after_fields jsonb NOT NULL,after_revision integer NOT NULL,
 worker_id uuid,worker_revision integer,undo_command uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
 undone_at timestamptz,undo_revision integer,
 PRIMARY KEY(batch_id,row_number),
 FOREIGN KEY(tenant_id,batch_id) REFERENCES public.talent_import_batches(tenant_id,id),
 FOREIGN KEY(batch_id,row_number) REFERENCES public.talent_import_rows(batch_id,row_number),
 CHECK((undone_at IS NULL)=(undo_revision IS NULL))
);
ALTER TABLE public.talent_import_changes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.talent_import_changes FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.talent_import_person_fields(p public.talent_people) RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT jsonb_build_object('name',p.name,'city',p.city,'district',p.district,'contacts',p.contacts,'skills',p.skills,'regions',p.regions)
$$;
REVOKE ALL ON FUNCTION public.talent_import_person_fields(public.talent_people) FROM PUBLIC,anon,authenticated;
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
   IF EXISTS(SELECT 1 FROM public.talent_people candidate WHERE candidate.tenant_id=p_tenant AND
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
   IF v_person.revision<>(r.payload->>'expectedRevision')::integer THEN RAISE EXCEPTION 'TALENT_CONFLICT'; END IF;
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
CREATE FUNCTION public.talent_import_change_review(p_actor uuid,p_tenant uuid,p_batch uuid,p_number integer) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.talent_import_rows;j public.talent_import_changes;p public.talent_people;v_state text;diffs jsonb:='[]';current_worker_revision integer;
BEGIN
 PERFORM public.talent_assert_scope(p_actor,p_tenant);
 SELECT row.* INTO r FROM public.talent_import_rows row JOIN public.talent_import_batches b ON b.id=row.batch_id AND b.tenant_id=row.tenant_id
 WHERE row.tenant_id=p_tenant AND row.batch_id=p_batch AND row.row_number=p_number AND b.actor_id=p_actor;
 IF NOT FOUND THEN RAISE EXCEPTION 'TALENT_IMPORT_NOT_FOUND';END IF;
 SELECT * INTO j FROM public.talent_import_changes WHERE tenant_id=p_tenant AND batch_id=p_batch AND row_number=p_number;
 IF NOT FOUND THEN v_state:=CASE WHEN r.status='updated' THEN 'legacy' ELSE 'not_updated' END;
 ELSE
  SELECT * INTO p FROM public.talent_people WHERE tenant_id=p_tenant AND id=j.person_id;
  IF p.worker_id IS NOT NULL THEN SELECT directory_revision INTO current_worker_revision FROM public.ops_workers WHERE tenant_id=p_tenant AND id=p.worker_id;END IF;
  v_state:=CASE WHEN j.undone_at IS NOT NULL THEN 'undone'
   WHEN p.id IS NULL OR p.revision<>j.after_revision OR p.revision>=2147483647 OR p.worker_id IS DISTINCT FROM j.worker_id
    OR current_worker_revision IS DISTINCT FROM j.worker_revision OR public.talent_import_person_fields(p) IS DISTINCT FROM j.after_fields THEN 'changed'
   ELSE 'ready' END;
  SELECT coalesce(jsonb_agg(jsonb_build_object('field',x.key,'before',x.value,'after',j.after_fields->x.key) ORDER BY x.key),'[]') INTO diffs
  FROM jsonb_each(j.before_fields) x WHERE x.value IS DISTINCT FROM j.after_fields->x.key;
 END IF;
 RETURN jsonb_build_object('actorId',p_actor,'tenantId',p_tenant,'batchId',p_batch,'number',p_number,'state',v_state,
  'personId',coalesce(j.person_id,(r.result->>'personId')::uuid),'changes',diffs,'undoneAt',j.undone_at);
END $$;
REVOKE ALL ON FUNCTION public.talent_import_change_review(uuid,uuid,uuid,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.talent_import_change_review(uuid,uuid,uuid,integer) TO authenticated;

CREATE FUNCTION public.talent_import_undo_update(p_actor uuid,p_tenant uuid,p_batch uuid,p_number integer) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' SET lock_timeout='3s' AS $$
DECLARE j public.talent_import_changes;p public.talent_people;worker uuid;worker_revision integer;receipt jsonb;
BEGIN
 PERFORM 1 FROM public.profiles WHERE id=auth.uid() FOR SHARE;
 PERFORM 1 FROM public.tenant_memberships WHERE user_id=auth.uid() AND tenant_id=p_tenant FOR SHARE;
 PERFORM public.talent_assert_scope(p_actor,p_tenant);
 PERFORM 1 FROM public.talent_import_batches WHERE tenant_id=p_tenant AND id=p_batch AND actor_id=p_actor FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'TALENT_IMPORT_NOT_FOUND';END IF;
 PERFORM 1 FROM public.talent_import_rows WHERE tenant_id=p_tenant AND batch_id=p_batch AND row_number=p_number FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'TALENT_IMPORT_NOT_FOUND';END IF;
 SELECT * INTO j FROM public.talent_import_changes WHERE tenant_id=p_tenant AND batch_id=p_batch AND row_number=p_number FOR UPDATE;
 IF NOT FOUND OR j.undone_at IS NOT NULL THEN RETURN public.talent_import_change_review(p_actor,p_tenant,p_batch,p_number);END IF;
 SELECT worker_id INTO worker FROM public.talent_people WHERE tenant_id=p_tenant AND id=j.person_id;
 IF worker IS NOT NULL THEN SELECT directory_revision INTO worker_revision FROM public.ops_workers WHERE tenant_id=p_tenant AND id=worker FOR UPDATE;END IF;
 SELECT * INTO p FROM public.talent_people WHERE tenant_id=p_tenant AND id=j.person_id FOR UPDATE;
 IF NOT FOUND OR p.revision<>j.after_revision OR p.revision>=2147483647 OR p.worker_id IS DISTINCT FROM j.worker_id
  OR worker_revision IS DISTINCT FROM j.worker_revision OR public.talent_import_person_fields(p) IS DISTINCT FROM j.after_fields
 THEN RETURN public.talent_import_change_review(p_actor,p_tenant,p_batch,p_number);END IF;
 receipt:=public.talent_save_person(p_actor,p_tenant,j.undo_command,p.id,p.revision,j.before_fields||jsonb_build_object('workTypes',p.work_types));
 UPDATE public.talent_import_rows SET status='reverted',result=jsonb_build_object('personId',p.id,'revision',(receipt->>'revision')::integer) WHERE tenant_id=p_tenant AND batch_id=p_batch AND row_number=p_number;
 UPDATE public.talent_import_changes SET undone_at=clock_timestamp(),undo_revision=(receipt->>'revision')::integer WHERE batch_id=p_batch AND row_number=p_number;
 RETURN public.talent_import_change_review(p_actor,p_tenant,p_batch,p_number);
END $$;
REVOKE ALL ON FUNCTION public.talent_import_undo_update(uuid,uuid,uuid,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.talent_import_undo_update(uuid,uuid,uuid,integer) TO authenticated;
COMMIT;
