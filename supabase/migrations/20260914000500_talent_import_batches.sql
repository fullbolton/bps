-- H1b durable import backend. Each row is its own transaction; no whole-file atomicity claim.
BEGIN;
SET LOCAL lock_timeout='5s';
CREATE TABLE public.talent_import_batches (
 id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES public.tenants(id),
 actor_id uuid NOT NULL REFERENCES public.profiles(id), source_hash text NOT NULL CHECK(source_hash ~ '^[a-f0-9]{64}$'),
 plan jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,id)
);
CREATE TABLE public.talent_import_rows (
 tenant_id uuid NOT NULL, batch_id uuid NOT NULL, row_number integer NOT NULL,
 command_id uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(), payload jsonb NOT NULL,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','created','updated','unchanged','held','blocked','cancelled')),
 result jsonb, PRIMARY KEY(batch_id,row_number),
 FOREIGN KEY(tenant_id,batch_id) REFERENCES public.talent_import_batches(tenant_id,id)
);
ALTER TABLE public.talent_import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.talent_import_rows ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.talent_import_batches,public.talent_import_rows FROM PUBLIC,anon,authenticated;

-- Serialize the new-import identity check with writes, including manual and worker sync.
-- New-row importer takes this before checking; it never locks an existing worker/person.
-- Existing-row importer follows worker -> person order, and reaches this via the trigger.
CREATE FUNCTION public.talent_import_fence(p_tenant uuid) RETURNS void
LANGUAGE sql VOLATILE SET search_path='' AS $$
 SELECT pg_advisory_xact_lock(hashtextextended('bps:talent-import:'||p_tenant::text,0))
$$;
CREATE FUNCTION public.talent_import_write_fence() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM public.talent_import_fence(CASE WHEN TG_OP='DELETE' THEN OLD.tenant_id ELSE NEW.tenant_id END);
 IF TG_OP='UPDATE' AND OLD.tenant_id IS DISTINCT FROM NEW.tenant_id THEN RAISE EXCEPTION 'TALENT_IMPORT_SCOPE'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER talent_import_write_fence BEFORE INSERT OR UPDATE OR DELETE ON public.talent_people
 FOR EACH ROW EXECUTE FUNCTION public.talent_import_write_fence();

CREATE FUNCTION public.talent_import_contact_key(p_kind text,p_value text) RETURNS text
LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE v text;
BEGIN
 IF p_kind='email' THEN RETURN 'email:'||lower(btrim(p_value)); END IF;
 v:=regexp_replace(p_value,'[^0-9]','','g');
 IF v ~ '^0090[0-9]{10}$' THEN v:=substr(v,5);
 ELSIF v ~ '^90[0-9]{10}$' THEN v:=substr(v,3);
 ELSIF v ~ '^0[0-9]{10}$' THEN v:=substr(v,2); END IF;
 RETURN 'phone:'||v;
END $$;
CREATE FUNCTION public.talent_import_name_key(p_value text) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT btrim(regexp_replace(regexp_replace(public.talent_fold(normalize(p_value,NFKD)),U&'[\0300-\036f]','','g'),'[^a-z0-9]+',' ','g'))
$$;

CREATE FUNCTION public.talent_import_validate_row(p jsonb) RETURNS void
LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
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
 IF jsonb_typeof(s) IS DISTINCT FROM 'object' OR (s-ARRAY['name','city','phone','email'])<>'{}' THEN RAISE EXCEPTION 'TALENT_IMPORT_VALIDATION'; END IF;
 FOREACH k IN ARRAY ARRAY['name','city','phone','email'] LOOP
  IF jsonb_typeof(s->k) IS DISTINCT FROM 'string' OR s->>k ~ '[[:cntrl:]]' THEN RAISE EXCEPTION 'TALENT_IMPORT_VALIDATION'; END IF;
 END LOOP;
 IF length(btrim(s->>'name')) NOT BETWEEN 1 AND 160 OR public.talent_import_name_key(s->>'name')=''
 OR length(s->>'city')>80
 OR (s->>'phone'<>'' AND (s->>'phone' !~ '^\+?[0-9][0-9 ()-]{5,29}$'))
 OR (s->>'email'<>'' AND (length(s->>'email')>254 OR s->>'email' !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'))
 THEN RAISE EXCEPTION 'TALENT_IMPORT_VALIDATION'; END IF;
 IF p->>'kind'='new' THEN
  IF (p-ARRAY['number','kind','source'])<>'{}' THEN RAISE EXCEPTION 'TALENT_IMPORT_VALIDATION'; END IF;
 ELSE
  IF jsonb_typeof(p->'targetId') IS DISTINCT FROM 'string' OR (p->>'targetId')::uuid IS NULL
   OR jsonb_typeof(p->'expectedRevision') IS DISTINCT FROM 'number' OR (p->>'expectedRevision') !~ '^[0-9]+$'
   OR (p->>'expectedRevision')::bigint NOT BETWEEN 0 AND 2147483646 OR jsonb_typeof(p->'fields') IS DISTINCT FROM 'array'
  THEN RAISE EXCEPTION 'TALENT_IMPORT_VALIDATION'; END IF;
  IF jsonb_array_length(p->'fields')>4 OR EXISTS(SELECT 1 FROM jsonb_array_elements(p->'fields') f WHERE jsonb_typeof(f)<>'string' OR (f#>>'{}') NOT IN ('name','city','phone','email'))
   OR (SELECT count(*)<>count(DISTINCT f) FROM jsonb_array_elements(p->'fields') f)
  THEN RAISE EXCEPTION 'TALENT_IMPORT_VALIDATION'; END IF;
  FOR k IN SELECT jsonb_array_elements_text(p->'fields') LOOP
   IF btrim(s->>k)='' THEN RAISE EXCEPTION 'TALENT_IMPORT_VALIDATION'; END IF;
  END LOOP;
 END IF;
END $$;

CREATE FUNCTION public.talent_import_status(p_actor uuid,p_tenant uuid,p_batch uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE b public.talent_import_batches; v jsonb;
BEGIN
 PERFORM public.talent_assert_scope(p_actor,p_tenant);
 SELECT * INTO b FROM public.talent_import_batches WHERE id=p_batch AND tenant_id=p_tenant AND actor_id=p_actor;
 IF NOT FOUND THEN RAISE EXCEPTION 'TALENT_IMPORT_NOT_FOUND'; END IF;
 SELECT jsonb_agg(jsonb_build_object('number',row_number,'status',status,'result',result) ORDER BY row_number) INTO v
 FROM public.talent_import_rows WHERE batch_id=p_batch AND tenant_id=p_tenant;
 RETURN jsonb_build_object('batchId',b.id,'tenantId',b.tenant_id,'actorId',b.actor_id,'sourceHash',b.source_hash,'total',jsonb_array_length(b.plan),'rows',v);
END $$;

CREATE FUNCTION public.talent_import_prepare(p_actor uuid,p_tenant uuid,p_batch uuid,p_source_hash text,p_rows jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='3s' AS $$
DECLARE b public.talent_import_batches; r jsonb;
BEGIN
 PERFORM 1 FROM public.profiles WHERE id=auth.uid() FOR SHARE;
 PERFORM 1 FROM public.tenant_memberships WHERE user_id=auth.uid() AND tenant_id=p_tenant FOR SHARE;
 PERFORM public.talent_assert_scope(p_actor,p_tenant);
 IF p_batch IS NULL OR p_source_hash IS NULL OR p_source_hash !~ '^[a-f0-9]{64}$' OR jsonb_typeof(p_rows) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'TALENT_IMPORT_VALIDATION'; END IF;
 IF jsonb_array_length(p_rows) NOT BETWEEN 1 AND 500 OR octet_length(p_rows::text)>1048576 THEN RAISE EXCEPTION 'TALENT_IMPORT_LIMIT'; END IF;
 FOR r IN SELECT value FROM jsonb_array_elements(p_rows) LOOP PERFORM public.talent_import_validate_row(r); END LOOP;
 IF (SELECT count(*)<>count(DISTINCT j->>'number') FROM jsonb_array_elements(p_rows) j)
 OR (SELECT count(*)<>count(DISTINCT j->>'targetId') FROM jsonb_array_elements(p_rows) j WHERE j->>'kind'='existing') THEN RAISE EXCEPTION 'TALENT_IMPORT_DUPLICATE_TARGET'; END IF;
 INSERT INTO public.talent_import_batches(id,tenant_id,actor_id,source_hash,plan) VALUES(p_batch,p_tenant,p_actor,p_source_hash,p_rows) ON CONFLICT DO NOTHING;
 SELECT * INTO b FROM public.talent_import_batches WHERE id=p_batch AND tenant_id=p_tenant AND actor_id=p_actor FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'TALENT_IMPORT_NOT_FOUND'; END IF;
 IF b.source_hash<>p_source_hash OR b.plan<>p_rows THEN RAISE EXCEPTION 'TALENT_IMPORT_COMMAND'; END IF;
 INSERT INTO public.talent_import_rows(tenant_id,batch_id,row_number,payload,status)
 SELECT p_tenant,p_batch,(j->>'number')::integer,j,CASE WHEN j->>'kind'='hold' THEN 'held' ELSE 'pending' END FROM jsonb_array_elements(p_rows) j ON CONFLICT DO NOTHING;
 RETURN public.talent_import_status(p_actor,p_tenant,p_batch);
END $$;

CREATE FUNCTION public.talent_import_apply_row(p_actor uuid,p_tenant uuid,p_batch uuid,p_number integer) RETURNS jsonb
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
   receipt:=public.talent_save_person(p_actor,p_tenant,r.command_id,NULL,NULL,input);outcome:='created';
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

CREATE FUNCTION public.talent_import_cancel(p_actor uuid,p_tenant uuid,p_batch uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='3s' AS $$
BEGIN
 PERFORM 1 FROM public.profiles WHERE id=auth.uid() FOR SHARE;
 PERFORM 1 FROM public.tenant_memberships WHERE user_id=auth.uid() AND tenant_id=p_tenant FOR SHARE;
 PERFORM public.talent_assert_scope(p_actor,p_tenant);
 PERFORM 1 FROM public.talent_import_batches WHERE id=p_batch AND tenant_id=p_tenant AND actor_id=p_actor FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'TALENT_IMPORT_NOT_FOUND'; END IF;
 UPDATE public.talent_import_rows SET status='cancelled' WHERE batch_id=p_batch AND tenant_id=p_tenant AND status='pending';
 RETURN public.talent_import_status(p_actor,p_tenant,p_batch);
END $$;
REVOKE ALL ON FUNCTION public.talent_import_fence(uuid),public.talent_import_write_fence(),public.talent_import_contact_key(text,text),public.talent_import_name_key(text),public.talent_import_validate_row(jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.talent_import_prepare(uuid,uuid,uuid,text,jsonb),public.talent_import_status(uuid,uuid,uuid),public.talent_import_apply_row(uuid,uuid,uuid,integer),public.talent_import_cancel(uuid,uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.talent_import_prepare(uuid,uuid,uuid,text,jsonb),public.talent_import_status(uuid,uuid,uuid),public.talent_import_apply_row(uuid,uuid,uuid,integer),public.talent_import_cancel(uuid,uuid,uuid) TO authenticated;
DO $$
DECLARE owner_id oid; t regclass; role_row record; table_row record;
BEGIN
 SELECT proowner INTO STRICT owner_id FROM pg_proc WHERE oid='public.talent_import_apply_row(uuid,uuid,uuid,integer)'::regprocedure;
 SELECT rolsuper,rolbypassrls INTO STRICT role_row FROM pg_roles WHERE oid=owner_id;
 IF NOT has_schema_privilege(owner_id,'auth','USAGE') THEN RAISE EXCEPTION 'Import owner requires auth usage'; END IF;
 FOREACH t IN ARRAY ARRAY['public.profiles'::regclass,'public.tenant_memberships'::regclass,'public.ops_workers'::regclass,'public.talent_people'::regclass] LOOP
  SELECT relowner,relrowsecurity,relforcerowsecurity INTO STRICT table_row FROM pg_class WHERE oid=t;
  IF NOT has_table_privilege(owner_id,t,'SELECT') OR NOT has_table_privilege(owner_id,t,'UPDATE')
   OR NOT (role_row.rolsuper OR role_row.rolbypassrls OR NOT table_row.relrowsecurity OR (pg_has_role(owner_id,table_row.relowner,'USAGE') AND NOT table_row.relforcerowsecurity))
  THEN RAISE EXCEPTION 'Import owner cannot fully lock/read %',t; END IF;
 END LOOP;
END $$;
COMMIT;
