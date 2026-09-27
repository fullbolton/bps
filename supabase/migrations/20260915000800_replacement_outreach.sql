-- DRAFT: replacement conversations only. Acceptance is not a booking or reservation.
BEGIN;
SET LOCAL lock_timeout='15s';
LOCK TABLE public.ops_assignments IN ACCESS EXCLUSIVE MODE;
CREATE UNIQUE INDEX ops_assignments_tenant_identity ON public.ops_assignments(tenant_id,id);
CREATE TABLE public.ops_replacement_outreach (
 tenant_id uuid NOT NULL, actor_id uuid NOT NULL, command_id uuid NOT NULL,
 assignment_id uuid NOT NULL, worker_id uuid NOT NULL,
 revision integer NOT NULL CHECK(revision>0),
 outcome text NOT NULL CHECK(outcome IN ('unreachable','considering','declined','accepted','withdrawn')),
 note text NOT NULL CHECK(length(note)<=1000), recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(tenant_id,actor_id,command_id),
 UNIQUE(tenant_id,assignment_id,worker_id,revision),
 FOREIGN KEY(tenant_id,actor_id,command_id) REFERENCES public.ops_commands(tenant_id,actor_id,id),
 FOREIGN KEY(tenant_id,assignment_id) REFERENCES public.ops_assignments(tenant_id,id),
 FOREIGN KEY(tenant_id,worker_id) REFERENCES public.ops_workers(tenant_id,id)
);
ALTER TABLE public.ops_replacement_outreach ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ops_replacement_outreach FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.ops_record_replacement_outreach(
 p_actor_id uuid,p_tenant_id uuid,p_command_id uuid,p_assignment_id uuid,p_worker_id uuid,
 p_expected_revision integer,p_outcome text,p_note text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='3s' AS $$
DECLARE v_actor uuid:=auth.uid(); v_cmd public.ops_commands%ROWTYPE; a public.ops_assignments%ROWTYPE;
 r public.ops_daily_requests%ROWTYPE; v_request uuid; v_company uuid; v_revision integer;
 v_payload jsonb; v_result jsonb;
BEGIN
 IF current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION 'OUTREACH_ISOLATION'; END IF;
 IF v_actor IS NULL OR v_actor IS DISTINCT FROM p_actor_id THEN RAISE EXCEPTION 'OUTREACH_SCOPE'; END IF;
 PERFORM 1 FROM public.profiles WHERE id=v_actor FOR SHARE;
 IF p_tenant_id IS NULL OR p_tenant_id IS DISTINCT FROM public.current_user_verified_tenant() THEN RAISE EXCEPTION 'OUTREACH_SCOPE'; END IF;
 IF coalesce(public.current_user_role(),'') NOT IN ('yonetici','operasyon') THEN RAISE EXCEPTION 'OUTREACH_FORBIDDEN'; END IF;
 IF p_command_id IS NULL OR p_assignment_id IS NULL OR p_worker_id IS NULL OR p_expected_revision IS NULL
 OR p_expected_revision NOT BETWEEN 0 AND 2147483646 OR p_outcome IS NULL
 OR p_outcome NOT IN ('unreachable','considering','declined','accepted','withdrawn') OR p_note IS NULL OR length(p_note)>1000
 THEN RAISE EXCEPTION 'OUTREACH_INPUT'; END IF;
 v_payload:=jsonb_build_object('assignmentId',p_assignment_id,'workerId',p_worker_id,'revision',p_expected_revision,'outcome',p_outcome,'note',p_note);
 INSERT INTO public.ops_commands(tenant_id,actor_id,id,kind,payload) VALUES(p_tenant_id,v_actor,p_command_id,'replacement_outreach',v_payload) ON CONFLICT DO NOTHING;
 SELECT * INTO v_cmd FROM public.ops_commands WHERE tenant_id=p_tenant_id AND actor_id=v_actor AND id=p_command_id FOR UPDATE;
 IF v_cmd.kind IS DISTINCT FROM 'replacement_outreach' OR v_cmd.payload IS DISTINCT FROM v_payload THEN RAISE EXCEPTION 'OUTREACH_REPLAY'; END IF;
 IF v_cmd.result IS NOT NULL THEN RETURN v_cmd.result; END IF;
 SELECT a0.request_id,r0.company_id INTO v_request,v_company FROM public.ops_assignments a0
 JOIN public.ops_daily_requests r0 ON r0.id=a0.request_id AND r0.tenant_id=a0.tenant_id WHERE a0.id=p_assignment_id AND a0.tenant_id=p_tenant_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'OUTREACH_SCOPE'; END IF;
 -- Match replacement writer lock order: profile, command, company, request, location, assignment, worker.
 PERFORM 1 FROM public.companies WHERE id=v_company AND tenant_id=p_tenant_id AND status='aktif' FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'OUTREACH_CLOSED'; END IF;
 SELECT * INTO r FROM public.ops_daily_requests WHERE id=v_request AND tenant_id=p_tenant_id FOR UPDATE;
 IF r.lifecycle IS DISTINCT FROM 'active' THEN RAISE EXCEPTION 'OUTREACH_CLOSED'; END IF;
 PERFORM 1 FROM public.ops_locations WHERE id=r.location_id AND tenant_id=p_tenant_id AND active FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'OUTREACH_CLOSED'; END IF;
 SELECT * INTO a FROM public.ops_assignments WHERE id=p_assignment_id AND tenant_id=p_tenant_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'OUTREACH_SCOPE'; END IF;
 IF a.removed_at IS NOT NULL OR a.attendance='present' THEN RAISE EXCEPTION 'OUTREACH_CLOSED'; END IF;
 IF a.worker_id=p_worker_id THEN RAISE EXCEPTION 'OUTREACH_SAME_WORKER'; END IF;
 PERFORM 1 FROM public.ops_workers WHERE id=p_worker_id AND tenant_id=p_tenant_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'OUTREACH_SCOPE'; END IF;
 -- Historical negative outcomes remain recordable even if candidate availability changed.
 IF p_outcome='accepted' AND (NOT EXISTS(SELECT 1 FROM public.ops_workers WHERE id=p_worker_id AND active)
 OR EXISTS(SELECT 1 FROM public.ops_assignments WHERE tenant_id=p_tenant_id AND worker_id=p_worker_id AND work_date=r.work_date AND (removed_at IS NULL OR attendance='present')))
 THEN RAISE EXCEPTION 'OUTREACH_UNAVAILABLE'; END IF;
 SELECT coalesce(max(revision),0) INTO v_revision FROM public.ops_replacement_outreach WHERE tenant_id=p_tenant_id AND assignment_id=p_assignment_id AND worker_id=p_worker_id;
 IF v_revision<>p_expected_revision THEN RAISE EXCEPTION 'OUTREACH_STALE'; END IF;
 IF p_outcome='withdrawn' AND NOT EXISTS(SELECT 1 FROM public.ops_replacement_outreach WHERE tenant_id=p_tenant_id AND assignment_id=p_assignment_id AND worker_id=p_worker_id AND revision=v_revision AND outcome='accepted') THEN RAISE EXCEPTION 'OUTREACH_NOT_ACCEPTED'; END IF;
 INSERT INTO public.ops_replacement_outreach(tenant_id,actor_id,command_id,assignment_id,worker_id,revision,outcome,note)
 VALUES(p_tenant_id,v_actor,p_command_id,p_assignment_id,p_worker_id,v_revision+1,p_outcome,btrim(p_note));
 v_result:=jsonb_build_object('commandId',p_command_id,'revision',v_revision+1,'outcome',p_outcome);
 UPDATE public.ops_commands SET result=v_result WHERE tenant_id=p_tenant_id AND actor_id=v_actor AND id=p_command_id;
 RETURN v_result;
END $$;
REVOKE ALL ON FUNCTION public.ops_record_replacement_outreach(uuid,uuid,uuid,uuid,uuid,integer,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ops_record_replacement_outreach(uuid,uuid,uuid,uuid,uuid,integer,text,text) TO authenticated;

CREATE FUNCTION public.ops_replacement_outreach_history(p_actor_id uuid,p_tenant_id uuid,p_assignment_id uuid,p_offset integer DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 IF auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM p_actor_id OR p_tenant_id IS NULL OR p_tenant_id IS DISTINCT FROM public.current_user_verified_tenant() THEN RAISE EXCEPTION 'OUTREACH_SCOPE'; END IF;
 IF coalesce(public.current_user_role(),'') NOT IN ('yonetici','operasyon') THEN RAISE EXCEPTION 'OUTREACH_FORBIDDEN'; END IF;
 IF p_offset IS NULL OR p_offset NOT BETWEEN 0 AND 1000000 THEN RAISE EXCEPTION 'OUTREACH_INPUT'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.ops_assignments WHERE id=p_assignment_id AND tenant_id=p_tenant_id) THEN RAISE EXCEPTION 'OUTREACH_SCOPE'; END IF;
 SELECT jsonb_build_object('total',(SELECT count(*) FROM public.ops_replacement_outreach WHERE tenant_id=p_tenant_id AND assignment_id=p_assignment_id),
 'rows',coalesce((SELECT jsonb_agg(to_jsonb(e) ORDER BY e.recorded_at DESC,e.command_id) FROM
 (SELECT actor_id,command_id,worker_id,revision,outcome,note,recorded_at FROM public.ops_replacement_outreach
 WHERE tenant_id=p_tenant_id AND assignment_id=p_assignment_id ORDER BY recorded_at DESC,command_id LIMIT 50 OFFSET p_offset) e),'[]'::jsonb)) INTO result;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.ops_replacement_outreach_history(uuid,uuid,uuid,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ops_replacement_outreach_history(uuid,uuid,uuid,integer) TO authenticated;
-- Exact candidate snapshot: a missing history page must never imply revision zero.
CREATE FUNCTION public.ops_replacement_outreach_latest(p_actor_id uuid,p_tenant_id uuid,p_assignment_id uuid,p_worker_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_latest jsonb;
BEGIN
 IF auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM p_actor_id OR p_tenant_id IS NULL OR p_tenant_id IS DISTINCT FROM public.current_user_verified_tenant() THEN RAISE EXCEPTION 'OUTREACH_SCOPE'; END IF;
 IF coalesce(public.current_user_role(),'') NOT IN ('yonetici','operasyon') THEN RAISE EXCEPTION 'OUTREACH_FORBIDDEN'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.ops_assignments WHERE id=p_assignment_id AND tenant_id=p_tenant_id)
 OR NOT EXISTS(SELECT 1 FROM public.ops_workers WHERE id=p_worker_id AND tenant_id=p_tenant_id) THEN RAISE EXCEPTION 'OUTREACH_SCOPE'; END IF;
 SELECT jsonb_build_object('revision',revision,'outcome',outcome,'note',note,'recordedAt',recorded_at,'actorId',actor_id)
 INTO v_latest FROM public.ops_replacement_outreach WHERE tenant_id=p_tenant_id AND assignment_id=p_assignment_id AND worker_id=p_worker_id ORDER BY revision DESC LIMIT 1;
 RETURN jsonb_build_object('assignmentId',p_assignment_id,'workerId',p_worker_id,'latest',v_latest);
END $$;
REVOKE ALL ON FUNCTION public.ops_replacement_outreach_latest(uuid,uuid,uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ops_replacement_outreach_latest(uuid,uuid,uuid,uuid) TO authenticated;
COMMIT;
