-- Implemented and tested on dedicated local acceptance only; not permanently applied.
-- Actual work approval, not payroll or automatic attendance approval.
-- Requires 20260915000800 (assignment tenant identity).
BEGIN;
SET LOCAL lock_timeout='15s';
CREATE TABLE public.ops_work_records (
 assignment_id uuid PRIMARY KEY, tenant_id uuid NOT NULL,
 revision integer NOT NULL CHECK(revision>0),
 status text NOT NULL CHECK(status IN ('draft','submitted','approved','returned')),
 started_at timestamptz NOT NULL, ended_at timestamptz NOT NULL,
 break_minutes integer NOT NULL CHECK(break_minutes>=0),
 net_minutes integer NOT NULL CHECK(net_minutes BETWEEN 1 AND 1440),
 note text NOT NULL CHECK(length(note)<=1000),
 updated_by uuid NOT NULL REFERENCES public.profiles(id), updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 FOREIGN KEY(tenant_id,assignment_id) REFERENCES public.ops_assignments(tenant_id,id),
 CHECK(ended_at>started_at AND ended_at<=started_at+interval '24 hours'),
 CHECK(net_minutes=extract(epoch FROM ended_at-started_at)/60-break_minutes)
);
CREATE TABLE public.ops_work_record_events (
 tenant_id uuid NOT NULL, actor_id uuid NOT NULL, command_id uuid NOT NULL,
 assignment_id uuid NOT NULL REFERENCES public.ops_work_records(assignment_id), revision integer NOT NULL,
 action text NOT NULL, reason text NOT NULL, snapshot jsonb NOT NULL, recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(tenant_id,actor_id,command_id), UNIQUE(assignment_id,revision),
 FOREIGN KEY(tenant_id,actor_id,command_id) REFERENCES public.ops_commands(tenant_id,actor_id,id)
);
ALTER TABLE public.ops_work_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ops_work_record_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ops_work_records,public.ops_work_record_events FROM PUBLIC,anon,authenticated;
CREATE INDEX ops_work_records_status ON public.ops_work_records(tenant_id,status,updated_at);

CREATE FUNCTION public.ops_work_record_execute(p_actor_id uuid,p_tenant_id uuid,p_command_id uuid,p_assignment_id uuid,p_expected_revision integer,p_action text,p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='3s' AS $$
DECLARE actor uuid:=auth.uid(); role_name text; cmd public.ops_commands%ROWTYPE; a public.ops_assignments%ROWTYPE;
 req public.ops_daily_requests%ROWTYPE; rec public.ops_work_records%ROWTYPE; request_id uuid;
 payload jsonb; v_result jsonb; start_time timestamptz; end_time timestamptz; break_mins integer; reason text; new_status text;
BEGIN
 IF current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION 'WORK_ISOLATION'; END IF;
 IF actor IS NULL OR actor IS DISTINCT FROM p_actor_id THEN RAISE EXCEPTION 'WORK_SCOPE'; END IF;
 PERFORM 1 FROM public.profiles WHERE id=actor FOR SHARE;
 IF p_tenant_id IS NULL OR p_tenant_id IS DISTINCT FROM public.current_user_verified_tenant() THEN RAISE EXCEPTION 'WORK_SCOPE'; END IF;
 role_name:=public.current_user_role();
 IF coalesce(role_name,'') NOT IN ('yonetici','operasyon') THEN RAISE EXCEPTION 'WORK_FORBIDDEN'; END IF;
 IF p_command_id IS NULL OR p_assignment_id IS NULL OR p_expected_revision IS NULL OR p_expected_revision NOT BETWEEN 0 AND 2147483646
 OR p_action IS NULL OR p_action NOT IN ('save','submit','approve','return','reopen') OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object' OR octet_length(p_payload::text)>8192 THEN RAISE EXCEPTION 'WORK_INPUT'; END IF;
 IF p_action IN ('approve','return','reopen') AND role_name<>'yonetici' THEN RAISE EXCEPTION 'WORK_FORBIDDEN'; END IF;
 payload:=jsonb_build_object('assignmentId',p_assignment_id,'expectedRevision',p_expected_revision,'action',p_action,'data',p_payload);
 INSERT INTO public.ops_commands(tenant_id,actor_id,id,kind,payload) VALUES(p_tenant_id,actor,p_command_id,'work_approval',payload) ON CONFLICT DO NOTHING;
 SELECT * INTO cmd FROM public.ops_commands WHERE tenant_id=p_tenant_id AND actor_id=actor AND id=p_command_id FOR UPDATE;
 IF cmd.kind IS DISTINCT FROM 'work_approval' OR cmd.payload IS DISTINCT FROM payload THEN RAISE EXCEPTION 'WORK_REPLAY'; END IF;
 IF cmd.result IS NOT NULL THEN RETURN cmd.result; END IF;
 SELECT x.request_id INTO request_id FROM public.ops_assignments x WHERE x.id=p_assignment_id AND x.tenant_id=p_tenant_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'WORK_SCOPE'; END IF;
 SELECT * INTO req FROM public.ops_daily_requests WHERE id=request_id AND tenant_id=p_tenant_id FOR UPDATE;
 SELECT * INTO a FROM public.ops_assignments WHERE id=p_assignment_id AND tenant_id=p_tenant_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'WORK_SCOPE'; END IF;
 SELECT * INTO rec FROM public.ops_work_records WHERE assignment_id=p_assignment_id AND tenant_id=p_tenant_id FOR UPDATE;
 IF coalesce(rec.revision,0)<>p_expected_revision THEN RAISE EXCEPTION 'WORK_STALE'; END IF;
 reason:=btrim(coalesce(p_payload->>'reason',''));
 IF length(reason)>1000 THEN RAISE EXCEPTION 'WORK_INPUT'; END IF;
 IF p_action='save' THEN
  IF a.removed_at IS NOT NULL OR req.lifecycle<>'active' THEN RAISE EXCEPTION 'WORK_CLOSED'; END IF;
  IF rec.status IN ('submitted','approved') THEN RAISE EXCEPTION 'WORK_LOCKED'; END IF;
  IF coalesce(p_payload->>'startTime','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' OR coalesce(p_payload->>'endTime','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
  OR jsonb_typeof(p_payload->'nextDay') IS DISTINCT FROM 'boolean' OR jsonb_typeof(p_payload->'breakMinutes') IS DISTINCT FROM 'number'
  OR (p_payload->>'breakMinutes') !~ '^[0-9]{1,4}$' OR jsonb_typeof(p_payload->'note') IS DISTINCT FROM 'string' OR length(p_payload->>'note')>1000 THEN RAISE EXCEPTION 'WORK_INPUT'; END IF;
  start_time:=(req.work_date+(p_payload->>'startTime')::time) AT TIME ZONE 'Europe/Istanbul';
  end_time:=(req.work_date+CASE WHEN (p_payload->>'nextDay')::boolean THEN 1 ELSE 0 END+(p_payload->>'endTime')::time) AT TIME ZONE 'Europe/Istanbul';
  break_mins:=(p_payload->>'breakMinutes')::integer;
  IF end_time<=start_time OR end_time>start_time+interval '24 hours' OR extract(epoch FROM end_time-start_time)/60<=break_mins THEN RAISE EXCEPTION 'WORK_TIME'; END IF;
  INSERT INTO public.ops_work_records(assignment_id,tenant_id,revision,status,started_at,ended_at,break_minutes,net_minutes,note,updated_by)
  VALUES(a.id,p_tenant_id,1,'draft',start_time,end_time,break_mins,(extract(epoch FROM end_time-start_time)/60)::integer-break_mins,btrim(p_payload->>'note'),actor)
  ON CONFLICT(assignment_id) DO UPDATE SET revision=ops_work_records.revision+1,status='draft',started_at=excluded.started_at,ended_at=excluded.ended_at,break_minutes=excluded.break_minutes,net_minutes=excluded.net_minutes,note=excluded.note,updated_by=actor,updated_at=clock_timestamp();
 ELSE
  IF rec.assignment_id IS NULL THEN RAISE EXCEPTION 'WORK_NO_RECORD'; END IF;
  IF p_action='submit' THEN
   IF rec.status NOT IN ('draft','returned') THEN RAISE EXCEPTION 'WORK_STATE'; END IF;
   IF a.removed_at IS NOT NULL OR req.lifecycle<>'active' THEN RAISE EXCEPTION 'WORK_CLOSED'; END IF;
   IF a.attendance<>'present' THEN RAISE EXCEPTION 'WORK_ATTENDANCE'; END IF;
   IF rec.ended_at>clock_timestamp() THEN RAISE EXCEPTION 'WORK_NOT_FINISHED'; END IF;
   new_status:='submitted';
  ELSIF p_action='approve' THEN
   IF rec.status<>'submitted' THEN RAISE EXCEPTION 'WORK_STATE'; END IF;
   IF req.lifecycle<>'active' THEN RAISE EXCEPTION 'WORK_CLOSED'; END IF;
   IF a.attendance<>'present' OR a.removed_at IS NOT NULL THEN RAISE EXCEPTION 'WORK_ATTENDANCE'; END IF;
   new_status:='approved';
  ELSE
   IF (p_action='return' AND rec.status<>'submitted') OR (p_action='reopen' AND rec.status<>'approved') THEN RAISE EXCEPTION 'WORK_STATE'; END IF;
   IF jsonb_typeof(p_payload->'reason') IS DISTINCT FROM 'string' OR length(reason)<3 THEN RAISE EXCEPTION 'WORK_REASON'; END IF;
   new_status:='returned';
  END IF;
  UPDATE public.ops_work_records SET status=new_status,revision=revision+1,updated_by=actor,updated_at=clock_timestamp() WHERE assignment_id=a.id;
 END IF;
 SELECT * INTO rec FROM public.ops_work_records WHERE assignment_id=a.id;
 v_result:=jsonb_build_object('commandId',p_command_id,'assignmentId',a.id,'revision',rec.revision,'status',rec.status);
 INSERT INTO public.ops_work_record_events(tenant_id,actor_id,command_id,assignment_id,revision,action,reason,snapshot)
 VALUES(p_tenant_id,actor,p_command_id,a.id,rec.revision,p_action,reason,to_jsonb(rec));
 UPDATE public.ops_commands SET result=v_result WHERE tenant_id=p_tenant_id AND actor_id=actor AND id=p_command_id;
 RETURN v_result;
END $$;
REVOKE ALL ON FUNCTION public.ops_work_record_execute(uuid,uuid,uuid,uuid,integer,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ops_work_record_execute(uuid,uuid,uuid,uuid,integer,text,jsonb) TO authenticated;

CREATE FUNCTION public.ops_work_record_read(p_actor_id uuid,p_tenant_id uuid,p_assignment_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_result jsonb;
BEGIN
 IF auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM p_actor_id OR p_tenant_id IS NULL OR p_tenant_id IS DISTINCT FROM public.current_user_verified_tenant() THEN RAISE EXCEPTION 'WORK_SCOPE'; END IF;
 IF coalesce(public.current_user_role(),'') NOT IN ('yonetici','operasyon') THEN RAISE EXCEPTION 'WORK_FORBIDDEN'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.ops_assignments WHERE id=p_assignment_id AND tenant_id=p_tenant_id) THEN RAISE EXCEPTION 'WORK_SCOPE'; END IF;
 SELECT jsonb_build_object('revision',revision,'status',status,'startTime',to_char(started_at AT TIME ZONE 'Europe/Istanbul','HH24:MI'),'endTime',to_char(ended_at AT TIME ZONE 'Europe/Istanbul','HH24:MI'),'nextDay',(ended_at AT TIME ZONE 'Europe/Istanbul')::date>(started_at AT TIME ZONE 'Europe/Istanbul')::date,'breakMinutes',break_minutes,'netMinutes',net_minutes,'note',note,'updatedAt',updated_at,'history',(SELECT jsonb_agg(h.entry ORDER BY h.revision DESC) FROM (SELECT e.revision,jsonb_build_object('revision',e.revision,'action',e.action,'reason',e.reason,'recordedAt',e.recorded_at,'netMinutes',(e.snapshot->>'net_minutes')::integer) AS entry FROM public.ops_work_record_events e WHERE e.assignment_id=p_assignment_id AND e.tenant_id=p_tenant_id ORDER BY e.revision DESC LIMIT 20) h)) INTO v_result FROM public.ops_work_records WHERE assignment_id=p_assignment_id AND tenant_id=p_tenant_id;
 RETURN jsonb_build_object('assignmentId',p_assignment_id,'record',v_result);
END $$;
REVOKE ALL ON FUNCTION public.ops_work_record_read(uuid,uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ops_work_record_read(uuid,uuid,uuid) TO authenticated;

CREATE FUNCTION public.ops_guard_approved_attendance() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM public.ops_work_records WHERE assignment_id=OLD.id AND status IN ('submitted','approved'))
 AND (NEW.attendance IS DISTINCT FROM OLD.attendance OR NEW.removed_at IS DISTINCT FROM OLD.removed_at) THEN RAISE EXCEPTION 'WORK_APPROVAL_LOCKED'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.ops_guard_approved_attendance() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER ops_guard_approved_attendance BEFORE UPDATE ON public.ops_assignments FOR EACH ROW EXECUTE FUNCTION public.ops_guard_approved_attendance();

-- One bounded company/day query, including historical assignments with work records.
CREATE FUNCTION public.ops_work_record_list(p_actor_id uuid,p_tenant_id uuid,p_company_id uuid,p_work_date date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE rows_json jsonb;
BEGIN
 IF auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM p_actor_id OR p_tenant_id IS NULL OR p_tenant_id IS DISTINCT FROM public.current_user_verified_tenant() THEN RAISE EXCEPTION 'WORK_SCOPE'; END IF;
 IF coalesce(public.current_user_role(),'') NOT IN ('yonetici','operasyon') THEN RAISE EXCEPTION 'WORK_FORBIDDEN'; END IF;
 IF p_work_date IS NULL OR p_work_date NOT BETWEEN DATE '2000-01-01' AND DATE '2100-12-31' THEN RAISE EXCEPTION 'WORK_INPUT'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.companies WHERE id=p_company_id AND tenant_id=p_tenant_id) THEN RAISE EXCEPTION 'WORK_SCOPE'; END IF;
 SELECT coalesce(jsonb_agg(x.entry ORDER BY x.waiting,x.worker_name,x.assignment_id),'[]'::jsonb) INTO rows_json FROM (
  SELECT rec.assignment_id,w.name AS worker_name,CASE WHEN rec.status='submitted' THEN 0 ELSE 1 END AS waiting,
   jsonb_build_object('assignmentId',rec.assignment_id,'workerName',w.name,'locationName',l.name,'status',rec.status,'revision',rec.revision,'netMinutes',rec.net_minutes,'closed',a.removed_at IS NOT NULL OR r.lifecycle<>'active') AS entry
  FROM public.ops_work_records rec
  JOIN public.ops_assignments a ON a.id=rec.assignment_id AND a.tenant_id=rec.tenant_id
  JOIN public.ops_daily_requests r ON r.id=a.request_id AND r.tenant_id=a.tenant_id
  JOIN public.ops_workers w ON w.id=a.worker_id AND w.tenant_id=a.tenant_id
  JOIN public.ops_locations l ON l.id=r.location_id AND l.tenant_id=r.tenant_id
  WHERE rec.tenant_id=p_tenant_id AND r.company_id=p_company_id AND r.work_date=p_work_date
  ORDER BY waiting,w.name,rec.assignment_id LIMIT 1001
 ) x;
 IF jsonb_array_length(rows_json)>1000 THEN RAISE EXCEPTION 'WORK_LIST_LIMIT'; END IF;
 RETURN jsonb_build_object('companyId',p_company_id,'workDate',p_work_date,'records',rows_json);
END $$;
REVOKE ALL ON FUNCTION public.ops_work_record_list(uuid,uuid,uuid,date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ops_work_record_list(uuid,uuid,uuid,date) TO authenticated;

COMMIT;
