-- Assignment-based start tracking. No synthetic data or assumed times are inserted.
BEGIN;
SET LOCAL lock_timeout='5s';
CREATE UNIQUE INDEX ops_assignment_tenant_id_key ON public.ops_assignments(tenant_id,id);
CREATE TABLE public.ops_start_plans (
 assignment_id uuid PRIMARY KEY, tenant_id uuid NOT NULL, start_at timestamptz NOT NULL,
 responsible_id uuid NOT NULL REFERENCES public.profiles(id), offsets integer[] NOT NULL,
 revision integer NOT NULL CHECK(revision>0), plan_version integer NOT NULL DEFAULT 1,
 created_at timestamptz NOT NULL DEFAULT now(), planned_at timestamptz NOT NULL DEFAULT now(),
 confirmed_at timestamptz, confirmation_source text, witness text,
 claimed_by uuid REFERENCES public.profiles(id), claim_until timestamptz,
 UNIQUE(tenant_id,assignment_id),
 FOREIGN KEY(tenant_id,assignment_id) REFERENCES public.ops_assignments(tenant_id,id),
 CHECK(cardinality(offsets) BETWEEN 1 AND 12),
 CHECK((confirmed_at IS NULL AND confirmation_source IS NULL AND witness IS NULL) OR
 (confirmed_at IS NOT NULL AND confirmation_source IN ('branch','field') AND length(btrim(witness)) BETWEEN 1 AND 160))
);
CREATE TABLE public.ops_start_events (
 id uuid PRIMARY KEY, tenant_id uuid NOT NULL, assignment_id uuid NOT NULL,
 actor_id uuid NOT NULL REFERENCES public.profiles(id), revision integer NOT NULL,
 plan_version integer NOT NULL, kind text NOT NULL, payload jsonb NOT NULL,
 occurred_at timestamptz NOT NULL, recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 FOREIGN KEY(tenant_id,assignment_id) REFERENCES public.ops_start_plans(tenant_id,assignment_id),
 UNIQUE(assignment_id,revision)
);
CREATE INDEX ops_start_events_assignment ON public.ops_start_events(tenant_id,assignment_id,revision DESC);
ALTER TABLE public.ops_start_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ops_start_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ops_start_plans,public.ops_start_events FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.ops_start_execute(p_actor_id uuid,p_tenant_id uuid,p_command_id uuid,p_assignment_id uuid,p_expected_revision integer,p_action text,p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='3s' AS $$
DECLARE v_actor uuid:=auth.uid(); v_cmd public.ops_commands%ROWTYPE; a public.ops_assignments%ROWTYPE;
 r public.ops_daily_requests%ROWTYPE; p public.ops_start_plans%ROWTYPE; v_request uuid;
 v_payload jsonb; v_result jsonb; v_now timestamptz; v_occurred timestamptz; v_start timestamptz;
 v_offsets integer[]; v_owner uuid; v_reason text; v_offset integer; v_plan_exists boolean;
BEGIN
 IF current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION 'START_ISOLATION'; END IF;
 IF v_actor IS NULL OR p_actor_id IS DISTINCT FROM v_actor THEN RAISE EXCEPTION 'START_SCOPE'; END IF;
 -- Lock all candidate profile rows in UUID order before computing membership.
 IF p_action='plan' THEN v_owner:=(p_payload->>'responsibleId')::uuid; END IF;
 PERFORM 1 FROM public.profiles WHERE id IN (v_actor,v_owner) ORDER BY id FOR SHARE;
 IF p_tenant_id IS NULL OR p_tenant_id IS DISTINCT FROM public.current_user_verified_tenant() THEN RAISE EXCEPTION 'START_SCOPE'; END IF;
 IF coalesce(public.current_user_role(),'') NOT IN ('yonetici','operasyon') THEN RAISE EXCEPTION 'START_FORBIDDEN'; END IF;
 IF p_command_id IS NULL OR p_assignment_id IS NULL OR p_expected_revision IS NULL OR p_expected_revision NOT BETWEEN 0 AND 2147483646
 OR p_action IS NULL OR p_action NOT IN ('plan','call','confirm','reopen','claim','release')
 OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object' OR octet_length(p_payload::text)>4096 THEN RAISE EXCEPTION 'START_INPUT'; END IF;
 v_payload:=jsonb_build_object('assignmentId',p_assignment_id,'expectedRevision',p_expected_revision,'action',p_action,'data',p_payload);
 INSERT INTO public.ops_commands(tenant_id,actor_id,id,kind,payload) VALUES(p_tenant_id,v_actor,p_command_id,'start',v_payload) ON CONFLICT DO NOTHING;
 SELECT * INTO v_cmd FROM public.ops_commands WHERE tenant_id=p_tenant_id AND actor_id=v_actor AND id=p_command_id FOR UPDATE;
 IF v_cmd.kind<>'start' OR v_cmd.payload IS DISTINCT FROM v_payload THEN RAISE EXCEPTION 'START_REPLAY'; END IF;
 IF v_cmd.result IS NOT NULL THEN RETURN v_cmd.result; END IF;
 SELECT request_id INTO v_request FROM public.ops_assignments WHERE id=p_assignment_id AND tenant_id=p_tenant_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'START_SCOPE'; END IF;
 SELECT * INTO r FROM public.ops_daily_requests WHERE id=v_request AND tenant_id=p_tenant_id FOR UPDATE;
 SELECT * INTO a FROM public.ops_assignments WHERE id=p_assignment_id AND tenant_id=p_tenant_id FOR UPDATE;
 IF a.removed_at IS NOT NULL OR r.lifecycle<>'active' THEN RAISE EXCEPTION 'START_CLOSED'; END IF;
 SELECT * INTO p FROM public.ops_start_plans WHERE assignment_id=a.id AND tenant_id=p_tenant_id FOR UPDATE;
 v_plan_exists:=FOUND;
 IF coalesce(p.revision,0)<>p_expected_revision THEN RAISE EXCEPTION 'START_STALE'; END IF;
 v_now:=clock_timestamp(); v_occurred:=v_now;
 v_reason:=btrim(p_payload->>'reason');
 IF length(coalesce(p_payload->>'note',''))>1000 OR length(coalesce(v_reason,''))>1000 THEN RAISE EXCEPTION 'START_INPUT'; END IF;
 IF p_action='plan' THEN
  IF p.confirmed_at IS NOT NULL THEN RAISE EXCEPTION 'START_CONFIRMED'; END IF;
  IF v_owner IS NULL OR NOT EXISTS(SELECT 1 FROM public.profiles pr JOIN public.tenant_memberships m ON m.user_id=pr.id
    WHERE pr.id=v_owner AND m.tenant_id=p_tenant_id AND pr.role IN ('yonetici','operasyon')) THEN RAISE EXCEPTION 'START_OWNER'; END IF;
  IF coalesce(p_payload->>'time','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' THEN RAISE EXCEPTION 'START_INPUT'; END IF;
  v_start:=(r.work_date+(p_payload->>'time')::time) AT TIME ZONE 'Europe/Istanbul';
  IF jsonb_typeof(p_payload->'offsets') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'START_INPUT'; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_payload->'offsets') e WHERE jsonb_typeof(e)<>'number' OR e::text !~ '^-[0-9]+$') THEN RAISE EXCEPTION 'START_INPUT'; END IF;
  SELECT array_agg(x::text::integer ORDER BY x::text::integer) INTO v_offsets FROM jsonb_array_elements(p_payload->'offsets') x;
  IF coalesce(cardinality(v_offsets),0) NOT BETWEEN 1 AND 12 OR EXISTS(SELECT 1 FROM unnest(v_offsets) x WHERE x NOT BETWEEN -1440 AND -1)
    OR cardinality(v_offsets)<>(SELECT count(DISTINCT x) FROM unnest(v_offsets) x) THEN RAISE EXCEPTION 'START_INPUT'; END IF;
  IF v_plan_exists AND coalesce(length(v_reason),0)<3 THEN RAISE EXCEPTION 'START_REASON'; END IF;
  INSERT INTO public.ops_start_plans(assignment_id,tenant_id,start_at,responsible_id,offsets,revision)
    VALUES(a.id,p_tenant_id,v_start,v_owner,v_offsets,1)
  ON CONFLICT(assignment_id) DO UPDATE SET start_at=v_start,responsible_id=v_owner,offsets=v_offsets,
    revision=ops_start_plans.revision+1,plan_version=ops_start_plans.plan_version+1,planned_at=v_now,claimed_by=NULL,claim_until=NULL;
 ELSE
  IF NOT v_plan_exists THEN RAISE EXCEPTION 'START_NO_PLAN'; END IF;
  IF p_action='reopen' THEN
   IF p.confirmed_at IS NULL OR coalesce(length(v_reason),0)<3 THEN RAISE EXCEPTION 'START_REASON'; END IF;
   UPDATE public.ops_start_plans SET confirmed_at=NULL,confirmation_source=NULL,witness=NULL WHERE assignment_id=a.id;
   UPDATE public.ops_assignments SET attendance='unreported',attendance_revision=attendance_revision+1,
     attendance_recorded_at=v_now,attendance_recorded_by=v_actor WHERE id=a.id;
  ELSE
   IF p.confirmed_at IS NOT NULL THEN RAISE EXCEPTION 'START_CONFIRMED'; END IF;
   IF p_action IN ('claim','call') AND p.claim_until>v_now AND p.claimed_by IS DISTINCT FROM v_actor THEN RAISE EXCEPTION 'START_CLAIMED'; END IF;
   IF p_action='claim' THEN
    UPDATE public.ops_start_plans SET claimed_by=v_actor,claim_until=v_now+interval '3 minutes' WHERE assignment_id=a.id;
   ELSIF p_action='release' THEN
    IF p.claimed_by IS DISTINCT FROM v_actor AND p.claim_until>v_now THEN RAISE EXCEPTION 'START_CLAIMED'; END IF;
    UPDATE public.ops_start_plans SET claimed_by=NULL,claim_until=NULL WHERE assignment_id=a.id;
   ELSE
    v_occurred:=(p_payload->>'occurredAt')::timestamptz;
    IF v_occurred IS NULL OR NOT isfinite(v_occurred) OR v_occurred>v_now OR v_occurred<greatest(a.created_at,p.created_at)
      OR (v_occurred AT TIME ZONE 'Europe/Istanbul')::date>r.work_date THEN RAISE EXCEPTION 'START_TIME'; END IF;
    IF p_action='call' THEN
     v_offset:=(p_payload->>'offset')::integer;
     -- Offset zero is an immediate/extra follow-up; past scheduled slots are not retroactively fabricated.
     IF v_offset IS NULL OR (v_offset<>0 AND (NOT v_offset=ANY(p.offsets) OR p.start_at+make_interval(mins=>v_offset)<greatest(a.created_at,p.planned_at)
       OR p.start_at+make_interval(mins=>v_offset)>v_occurred)) THEN RAISE EXCEPTION 'START_CHECK_TIME'; END IF;
     IF coalesce(p_payload->>'outcome','') NOT IN ('preparing','on_way','claimed_arrival','unreachable','cannot_attend') THEN RAISE EXCEPTION 'START_INPUT'; END IF;
     IF EXISTS(SELECT 1 FROM public.ops_start_events WHERE assignment_id=a.id AND plan_version=p.plan_version AND kind='call' AND (payload->>'offset')::int=v_offset)
       AND coalesce(length(v_reason),0)<3 THEN RAISE EXCEPTION 'START_REASON'; END IF;
     IF p_payload->>'eta' IS NOT NULL AND ((p_payload->>'eta')::timestamptz<v_occurred OR (p_payload->>'eta')::timestamptz>v_occurred+interval '24 hours') THEN RAISE EXCEPTION 'START_TIME'; END IF;
    ELSE
     IF coalesce(p_payload->>'source','') NOT IN ('branch','field') OR coalesce(length(btrim(p_payload->>'witness')),0) NOT BETWEEN 1 AND 160 THEN RAISE EXCEPTION 'START_WITNESS'; END IF;
     IF (v_occurred AT TIME ZONE 'Europe/Istanbul')::date<>r.work_date OR a.attendance='absent' THEN RAISE EXCEPTION 'START_ATTENDANCE_CONFLICT'; END IF;
     PERFORM 1 FROM public.ops_workers WHERE id=a.worker_id AND tenant_id=p_tenant_id FOR UPDATE;
     IF EXISTS(SELECT 1 FROM public.ops_assignments WHERE tenant_id=p_tenant_id AND worker_id=a.worker_id AND work_date=a.work_date AND attendance='present' AND id<>a.id) THEN RAISE EXCEPTION 'START_ATTENDANCE_CONFLICT'; END IF;
     UPDATE public.ops_start_plans SET confirmed_at=v_occurred,confirmation_source=p_payload->>'source',witness=btrim(p_payload->>'witness') WHERE assignment_id=a.id;
     UPDATE public.ops_assignments SET attendance='present',attendance_revision=attendance_revision+1,attendance_recorded_at=v_now,attendance_recorded_by=v_actor WHERE id=a.id;
    END IF;
    UPDATE public.ops_start_plans SET claimed_by=NULL,claim_until=NULL WHERE assignment_id=a.id;
   END IF;
  END IF;
  UPDATE public.ops_start_plans SET revision=revision+1 WHERE assignment_id=a.id;
 END IF;
 SELECT * INTO p FROM public.ops_start_plans WHERE assignment_id=a.id;
 INSERT INTO public.ops_start_events(id,tenant_id,assignment_id,actor_id,revision,plan_version,kind,payload,occurred_at)
 VALUES(p_command_id,p_tenant_id,a.id,v_actor,p.revision,p.plan_version,p_action,
   CASE WHEN p_action='plan' THEN p_payload||jsonb_build_object('startAt',p.start_at,'offsets',p.offsets) ELSE p_payload END,v_occurred);
 INSERT INTO public.ops_events(tenant_id,actor_id,command_id,kind,entity_id) VALUES(p_tenant_id,v_actor,p_command_id,'start_'||p_action,a.id);
 v_result:=jsonb_build_object('id',a.id,'revision',p.revision,'commandId',p_command_id);
 UPDATE public.ops_commands SET result=v_result WHERE tenant_id=p_tenant_id AND actor_id=v_actor AND id=p_command_id;
 RETURN v_result;
END $$;

-- Existing attendance UI cannot silently contradict independent confirmation.
CREATE FUNCTION public.ops_guard_confirmed_start() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.attendance IS DISTINCT FROM 'present' AND EXISTS(SELECT 1 FROM public.ops_start_plans WHERE assignment_id=NEW.id AND confirmed_at IS NOT NULL) THEN
 RAISE EXCEPTION 'START_CONFIRMED'; END IF; RETURN NEW;
END $$;
CREATE TRIGGER ops_guard_confirmed_start BEFORE UPDATE OF attendance ON public.ops_assignments FOR EACH ROW EXECUTE FUNCTION public.ops_guard_confirmed_start();

CREATE FUNCTION public.ops_start_board(p_actor_id uuid,p_tenant_id uuid,p_day date,p_offset integer DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_rows jsonb; v_total integer;
BEGIN
 IF auth.uid() IS NULL OR p_actor_id IS DISTINCT FROM auth.uid() OR p_tenant_id IS NULL OR p_tenant_id IS DISTINCT FROM public.current_user_verified_tenant() THEN RAISE EXCEPTION 'START_SCOPE'; END IF;
 IF coalesce(public.current_user_role(),'') NOT IN ('yonetici','operasyon') THEN RAISE EXCEPTION 'START_FORBIDDEN'; END IF;
 IF p_day IS NULL OR p_day NOT BETWEEN DATE '2000-01-01' AND DATE '2100-12-31' OR p_offset IS NULL OR p_offset<0 THEN RAISE EXCEPTION 'START_INPUT'; END IF;
 SELECT count(*) INTO v_total FROM public.ops_assignments WHERE tenant_id=p_tenant_id AND work_date=p_day;
 SELECT coalesce(jsonb_agg(x.data ORDER BY x.start_at NULLS FIRST,x.id),'[]') INTO v_rows FROM (
 SELECT a.id,p.start_at,jsonb_build_object('id',a.id,'requestId',a.request_id,'companyId',r.company_id,'company',c.name,'location',l.name,'worker',w.name,'position',r.position,
 'createdAt',a.created_at,'closed',a.removed_at IS NOT NULL OR r.lifecycle<>'active','attendance',a.attendance,
 'startAt',p.start_at,'plannedAt',p.planned_at,'responsibleId',p.responsible_id,'responsible',owner.display_name,
 'ownerAvailable',EXISTS(SELECT 1 FROM public.tenant_memberships m JOIN public.profiles pr ON pr.id=m.user_id WHERE m.tenant_id=p_tenant_id AND m.user_id=p.responsible_id AND pr.role IN ('yonetici','operasyon')),
 'revision',coalesce(p.revision,0),'planVersion',coalesce(p.plan_version,0),'offsets',coalesce(to_jsonb(p.offsets),'[]'),
 'confirmedAt',p.confirmed_at,'source',p.confirmation_source,'witness',p.witness,'claimedBy',p.claimed_by,'claimUntil',p.claim_until,
 'events',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',e.id,'revision',e.revision,'planVersion',e.plan_version,'kind',e.kind,'payload',e.payload,'occurredAt',e.occurred_at,'recordedAt',e.recorded_at,'actor',pr.display_name) ORDER BY e.revision),'[]') FROM public.ops_start_events e JOIN public.profiles pr ON pr.id=e.actor_id WHERE e.assignment_id=a.id AND e.tenant_id=p_tenant_id)) data
 FROM public.ops_assignments a JOIN public.ops_daily_requests r ON r.id=a.request_id AND r.tenant_id=a.tenant_id
 JOIN public.companies c ON c.id=r.company_id AND c.tenant_id=r.tenant_id
 JOIN public.ops_locations l ON l.id=r.location_id AND l.tenant_id=r.tenant_id
 JOIN public.ops_workers w ON w.id=a.worker_id AND w.tenant_id=a.tenant_id
 LEFT JOIN public.ops_start_plans p ON p.assignment_id=a.id AND p.tenant_id=a.tenant_id
 LEFT JOIN public.profiles owner ON owner.id=p.responsible_id
 WHERE a.tenant_id=p_tenant_id AND a.work_date=p_day ORDER BY p.start_at NULLS FIRST,a.id LIMIT 50 OFFSET p_offset) x;
 RETURN jsonb_build_object('serverNow',statement_timestamp(),'day',p_day,'total',v_total,'rows',v_rows,
 'members',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',pr.id,'name',pr.display_name) ORDER BY pr.display_name,pr.id),'[]') FROM public.profiles pr JOIN public.tenant_memberships m ON m.user_id=pr.id WHERE m.tenant_id=p_tenant_id AND pr.role IN ('yonetici','operasyon')));
END $$;
REVOKE ALL ON FUNCTION public.ops_start_execute(uuid,uuid,uuid,uuid,integer,text,jsonb),public.ops_start_board(uuid,uuid,date,integer),public.ops_guard_confirmed_start() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ops_start_execute(uuid,uuid,uuid,uuid,integer,text,jsonb),public.ops_start_board(uuid,uuid,date,integer) TO authenticated;
-- Preserve the exact replaced assignment's plan; never copy another worker's history.
ALTER FUNCTION public.ops_replace_assignment(uuid,uuid,uuid,uuid,uuid,integer) RENAME TO ops_replace_assignment_before_start;
REVOKE ALL ON FUNCTION public.ops_replace_assignment_before_start(uuid,uuid,uuid,uuid,uuid,integer) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.ops_replace_assignment(p_actor_id uuid,p_tenant_id uuid,p_command_id uuid,p_assignment_id uuid,p_worker_id uuid,p_expected_revision integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_result jsonb; p public.ops_start_plans%ROWTYPE;
BEGIN
 v_result:=public.ops_replace_assignment_before_start(p_actor_id,p_tenant_id,p_command_id,p_assignment_id,p_worker_id,p_expected_revision);
 SELECT * INTO p FROM public.ops_start_plans WHERE assignment_id=p_assignment_id AND tenant_id=p_tenant_id;
 IF FOUND THEN
  INSERT INTO public.ops_start_plans(assignment_id,tenant_id,start_at,responsible_id,offsets,revision)
   VALUES(p_command_id,p_tenant_id,p.start_at,p.responsible_id,p.offsets,1) ON CONFLICT DO NOTHING;
  IF FOUND THEN INSERT INTO public.ops_start_events(id,tenant_id,assignment_id,actor_id,revision,plan_version,kind,payload,occurred_at)
   VALUES(gen_random_uuid(),p_tenant_id,p_command_id,p_actor_id,1,1,'inherited',jsonb_build_object('previousAssignmentId',p_assignment_id,'startAt',p.start_at,'offsets',p.offsets),clock_timestamp()); END IF;
 END IF;
 RETURN v_result;
END $$;
REVOKE ALL ON FUNCTION public.ops_replace_assignment(uuid,uuid,uuid,uuid,uuid,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ops_replace_assignment(uuid,uuid,uuid,uuid,uuid,integer) TO authenticated;
COMMIT;
