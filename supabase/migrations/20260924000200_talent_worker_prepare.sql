-- Prepare one existing pool person for daily operations without a second person row.
BEGIN;
SET LOCAL lock_timeout='15s';
LOCK TABLE public.ops_workers,public.talent_people IN ACCESS EXCLUSIVE MODE;
ALTER TABLE public.ops_workers ADD COLUMN source_person_id uuid;
ALTER TABLE public.ops_workers ADD CONSTRAINT ops_worker_source_person_fk FOREIGN KEY(tenant_id,source_person_id) REFERENCES public.talent_people(tenant_id,id);
ALTER TABLE public.ops_workers ADD CONSTRAINT ops_worker_source_person_unique UNIQUE(tenant_id,source_person_id);
CREATE OR REPLACE FUNCTION public.talent_sync_worker() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_person uuid; v_revision integer;
BEGIN
 IF TG_OP='INSERT' THEN
  IF NEW.source_person_id IS NULL THEN
   INSERT INTO public.talent_people(id,tenant_id,name,worker_id,source,work_types) VALUES(NEW.id,NEW.tenant_id,NEW.name,NEW.id,'operations',ARRAY[NEW.kind]);
  ELSE
   UPDATE public.talent_people SET worker_id=NEW.id,revision=revision+1,updated_at=now()
    WHERE tenant_id=NEW.tenant_id AND id=NEW.source_person_id AND worker_id IS NULL
    RETURNING id,revision INTO v_person,v_revision;
   IF NOT FOUND THEN RAISE EXCEPTION 'TALENT_WORKER_CONFLICT'; END IF;
   INSERT INTO public.talent_person_events(tenant_id,person_id,actor_id,kind,revision,changed_fields)
    VALUES(NEW.tenant_id,v_person,auth.uid(),'worker_synced',v_revision,ARRAY['workerId']);
  END IF;
 ELSE
  UPDATE public.talent_people SET name=NEW.name,revision=revision+1,updated_at=now()
   WHERE tenant_id=NEW.tenant_id AND worker_id=NEW.id AND name IS DISTINCT FROM NEW.name RETURNING id,revision INTO v_person,v_revision;
  IF v_person IS NOT NULL THEN INSERT INTO public.talent_person_events(tenant_id,person_id,actor_id,kind,revision,changed_fields)
   VALUES(NEW.tenant_id,v_person,auth.uid(),'worker_synced',v_revision,ARRAY['name']); END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE FUNCTION public.talent_prepare_worker(p_actor_id uuid,p_tenant_id uuid,p_person_id uuid,p_command_id uuid,p_expected_revision integer,p_code text,p_kind text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE person public.talent_people; prior public.talent_person_commands; payload jsonb; v_result jsonb; worker uuid:=gen_random_uuid();
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'TALENT_SCOPE'; END IF;
 PERFORM 1 FROM public.profiles WHERE id=auth.uid() FOR SHARE;
 PERFORM 1 FROM public.tenant_memberships WHERE user_id=auth.uid() AND tenant_id=p_tenant_id FOR SHARE;
 PERFORM public.talent_assert_scope(p_actor_id,p_tenant_id);
 IF coalesce(public.current_user_role(),'') <>'yonetici' THEN RAISE EXCEPTION 'TALENT_FORBIDDEN'; END IF;
 IF p_person_id IS NULL OR p_command_id IS NULL OR p_expected_revision IS NULL OR p_expected_revision NOT BETWEEN 0 AND 2147483646
  OR p_code IS NULL OR length(btrim(p_code)) NOT BETWEEN 1 AND 40 OR p_code ~ '[[:cntrl:]]'
  OR p_kind IS NULL OR p_kind NOT IN ('idp','sabit') THEN RAISE EXCEPTION 'TALENT_VALIDATION'; END IF;
 payload:=jsonb_build_object('operation','prepare_worker','personId',p_person_id,'revision',p_expected_revision,'code',btrim(p_code),'kind',p_kind);
 INSERT INTO public.talent_person_commands(tenant_id,actor_id,command_id,payload) VALUES(p_tenant_id,p_actor_id,p_command_id,payload) ON CONFLICT DO NOTHING;
 SELECT * INTO STRICT prior FROM public.talent_person_commands WHERE tenant_id=p_tenant_id AND actor_id=p_actor_id AND command_id=p_command_id FOR UPDATE;
 IF prior.payload IS DISTINCT FROM payload THEN RAISE EXCEPTION 'TALENT_COMMAND'; END IF;
 IF prior.result IS NOT NULL THEN RETURN prior.result; END IF;
 -- New worker only: no existing worker is locked after the person. Concurrent attempts serialize here.
 SELECT * INTO person FROM public.talent_people WHERE tenant_id=p_tenant_id AND id=p_person_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'TALENT_NOT_FOUND'; END IF;
 IF person.worker_id IS NOT NULL OR person.revision<>p_expected_revision THEN RAISE EXCEPTION 'TALENT_WORKER_CONFLICT'; END IF;
 INSERT INTO public.ops_workers(id,tenant_id,name,code,kind,source_person_id)
  VALUES(worker,p_tenant_id,person.name,btrim(p_code),p_kind,p_person_id);
 v_result:=jsonb_build_object('id',p_person_id,'commandId',p_command_id,'revision',person.revision+1,'workerId',worker);
 UPDATE public.talent_person_commands SET result=v_result WHERE tenant_id=p_tenant_id AND actor_id=p_actor_id AND command_id=p_command_id;
 RETURN v_result;
END $$;
REVOKE ALL ON FUNCTION public.talent_prepare_worker(uuid,uuid,uuid,uuid,integer,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.talent_prepare_worker(uuid,uuid,uuid,uuid,integer,text,text) TO authenticated;
REVOKE ALL ON FUNCTION public.talent_sync_worker() FROM PUBLIC,anon,authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
