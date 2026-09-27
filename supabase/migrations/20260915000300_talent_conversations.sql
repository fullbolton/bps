-- Person conversation log: recorded facts, not availability or placement decisions.
BEGIN;
SET LOCAL lock_timeout='5s';
CREATE TABLE public.talent_conversations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL REFERENCES public.tenants(id),
 person_id uuid NOT NULL,
 request_id uuid,
 actor_id uuid NOT NULL REFERENCES public.profiles(id),
 command_id uuid NOT NULL,
 channel text NOT NULL CHECK(channel IN ('phone','message','in_person')),
 outcome text NOT NULL CHECK(outcome IN ('reached','no_answer','call_back','declined')),
 note text NOT NULL CHECK(length(note)<=2000),
 recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(tenant_id,actor_id,command_id),
 FOREIGN KEY(tenant_id,person_id) REFERENCES public.talent_people(tenant_id,id),
 FOREIGN KEY(tenant_id,request_id) REFERENCES public.ops_daily_requests(tenant_id,id),
 CHECK(outcome<>'declined' OR request_id IS NOT NULL)
);
ALTER TABLE public.talent_conversations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.talent_conversations FROM PUBLIC,anon,authenticated;
CREATE INDEX talent_conversations_person_recent ON public.talent_conversations(tenant_id,person_id,recorded_at DESC,id DESC);

CREATE FUNCTION public.talent_conversation_save(p_actor_id uuid,p_tenant_id uuid,p_input jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v public.talent_conversations; v_person uuid; v_request uuid; v_command uuid;
BEGIN
 PERFORM public.talent_assert_scope(p_actor_id,p_tenant_id);
 IF jsonb_typeof(p_input) IS DISTINCT FROM 'object' OR
 (SELECT count(*) FROM jsonb_object_keys(p_input))<>6 OR
 NOT(p_input ?& ARRAY['commandId','personId','requestId','channel','outcome','note']) OR
 jsonb_typeof(p_input->'commandId') IS DISTINCT FROM 'string' OR
 jsonb_typeof(p_input->'personId') IS DISTINCT FROM 'string' OR
 jsonb_typeof(p_input->'requestId') NOT IN ('string','null') OR
 jsonb_typeof(p_input->'note') IS DISTINCT FROM 'string' OR
 coalesce(p_input->>'channel','') NOT IN ('phone','message','in_person') OR
 coalesce(p_input->>'outcome','') NOT IN ('reached','no_answer','call_back','declined') OR
 length(p_input->>'note')>2000 OR translate(p_input->>'note',E'\n\r\t','') ~ '[[:cntrl:]]' THEN RAISE EXCEPTION 'CONVERSATION_VALIDATION'; END IF;
 v_person:=(p_input->>'personId')::uuid;v_request:=(p_input->>'requestId')::uuid;v_command:=(p_input->>'commandId')::uuid;
 IF p_input->>'outcome'='declined' AND v_request IS NULL THEN RAISE EXCEPTION 'CONVERSATION_REQUEST_REQUIRED'; END IF;
 PERFORM 1 FROM public.talent_people WHERE tenant_id=p_tenant_id AND id=v_person;
 IF NOT FOUND THEN RAISE EXCEPTION 'TALENT_NOT_FOUND'; END IF;
 IF v_request IS NOT NULL THEN
  PERFORM 1 FROM public.ops_daily_requests WHERE tenant_id=p_tenant_id AND id=v_request;
  IF NOT FOUND THEN RAISE EXCEPTION 'CONVERSATION_REQUEST_NOT_FOUND'; END IF;
 END IF;
 INSERT INTO public.talent_conversations(tenant_id,person_id,request_id,actor_id,command_id,channel,outcome,note)
 VALUES(p_tenant_id,v_person,v_request,p_actor_id,v_command,p_input->>'channel',p_input->>'outcome',btrim(p_input->>'note'))
 ON CONFLICT(tenant_id,actor_id,command_id) DO NOTHING;
 SELECT * INTO STRICT v FROM public.talent_conversations WHERE tenant_id=p_tenant_id AND actor_id=p_actor_id AND command_id=v_command;
 IF v.person_id<>v_person OR v.request_id IS DISTINCT FROM v_request OR v.channel<>p_input->>'channel' OR v.outcome<>p_input->>'outcome' OR v.note<>btrim(p_input->>'note') THEN RAISE EXCEPTION 'TALENT_COMMAND'; END IF;
 RETURN jsonb_build_object('id',v.id,'tenantId',v.tenant_id,'personId',v.person_id,'requestId',v.request_id,'actorId',v.actor_id,'commandId',v.command_id,'channel',v.channel,'outcome',v.outcome,'note',v.note,'recordedAt',v.recorded_at);
END $$;
REVOKE ALL ON FUNCTION public.talent_conversation_save(uuid,uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.talent_conversation_save(uuid,uuid,jsonb) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
