-- 038: manual event timing and narrow input-cast errors. Local only until released.
-- CREATE OR REPLACE preserves the existing exact-signature owner and ACL.
BEGIN;
SET LOCAL lock_timeout='15s';
DO $$ BEGIN
 IF to_regprocedure('public.ops_start_execute(uuid,uuid,uuid,uuid,integer,text,jsonb)') IS NULL THEN
  RAISE EXCEPTION 'START_VALIDATION_BASELINE_REQUIRED';
 END IF;
END $$;
CREATE OR REPLACE FUNCTION public.ops_start_execute(p_actor_id uuid,p_tenant_id uuid,p_command_id uuid,p_assignment_id uuid,p_expected_revision integer,p_action text,p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='3s' AS $$
DECLARE v_actor uuid:=auth.uid(); v_cmd public.ops_commands%ROWTYPE; a public.ops_assignments%ROWTYPE;
 r public.ops_daily_requests%ROWTYPE; p public.ops_start_plans%ROWTYPE; v_request uuid;
 v_payload jsonb; v_result jsonb; v_now timestamptz; v_occurred timestamptz; v_eta timestamptz; v_start timestamptz;
 v_offsets integer[]; v_owner uuid; v_reason text; v_offset integer; v_plan_exists boolean;
BEGIN
 IF current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION 'START_ISOLATION'; END IF;
 IF v_actor IS NULL OR p_actor_id IS DISTINCT FROM v_actor THEN RAISE EXCEPTION 'START_SCOPE'; END IF;
 -- Lock all candidate profile rows in UUID order before computing membership.
 IF p_action='plan' THEN
  BEGIN v_owner:=(p_payload->>'responsibleId')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION 'START_INPUT'; END;
 END IF;
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
  BEGIN
   SELECT array_agg(x::text::integer ORDER BY x::text::integer) INTO v_offsets FROM jsonb_array_elements(p_payload->'offsets') x;
  EXCEPTION WHEN numeric_value_out_of_range THEN RAISE EXCEPTION 'START_INPUT'; END;
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
    BEGIN v_occurred:=(p_payload->>'occurredAt')::timestamptz;
    EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN RAISE EXCEPTION 'START_INPUT'; END;
    -- Manual events may precede plan entry. The form records seconds, not microseconds.
    IF v_occurred IS NULL OR NOT isfinite(v_occurred) OR v_occurred>v_now OR v_occurred<date_trunc('second',a.created_at)
      OR (v_occurred AT TIME ZONE 'Europe/Istanbul')::date>r.work_date THEN RAISE EXCEPTION 'START_TIME'; END IF;
    IF p_action='call' THEN
     BEGIN v_offset:=(p_payload->>'offset')::integer;
     EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN RAISE EXCEPTION 'START_INPUT'; END;
     -- Offset zero is an immediate/extra follow-up; past scheduled slots are not retroactively fabricated.
     IF v_offset IS NULL OR (v_offset<>0 AND (NOT v_offset=ANY(p.offsets) OR p.start_at+make_interval(mins=>v_offset)<greatest(a.created_at,p.planned_at)
       OR p.start_at+make_interval(mins=>v_offset)>v_occurred)) THEN RAISE EXCEPTION 'START_CHECK_TIME'; END IF;
     IF coalesce(p_payload->>'outcome','') NOT IN ('preparing','on_way','claimed_arrival','unreachable','cannot_attend') THEN RAISE EXCEPTION 'START_INPUT'; END IF;
     IF EXISTS(SELECT 1 FROM public.ops_start_events WHERE assignment_id=a.id AND plan_version=p.plan_version AND kind='call' AND (payload->>'offset')::int=v_offset)
       AND coalesce(length(v_reason),0)<3 THEN RAISE EXCEPTION 'START_REASON'; END IF;
     BEGIN v_eta:=(p_payload->>'eta')::timestamptz;
     EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN RAISE EXCEPTION 'START_INPUT'; END;
     IF v_eta IS NOT NULL AND (NOT isfinite(v_eta) OR v_eta<v_occurred OR v_eta>v_occurred+interval '24 hours') THEN RAISE EXCEPTION 'START_TIME'; END IF;
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

COMMIT;
