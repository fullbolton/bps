-- Atomic timed-shift cutover; legacy requests retain whole-day occupancy.
BEGIN;
SET LOCAL lock_timeout='15s';
LOCK TABLE public.ops_daily_requests,public.ops_assignments IN ACCESS EXCLUSIVE MODE;

-- 01_shift_range
-- Internal interval contract only. Does not replace daily constraints or enable timed assignments.

CREATE FUNCTION public.ops_shift_range(p_day date,p_start text,p_end text,p_next_day boolean)
RETURNS tsrange LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE v_start integer;v_end integer;v_duration integer;
BEGIN
 IF p_day IS NULL OR p_day NOT BETWEEN DATE '2000-01-01' AND DATE '2100-12-31' THEN RAISE EXCEPTION 'OPS_SHIFT_DATE';END IF;
 -- Legacy unknown times block the entire local day; partial values are invalid.
 IF p_start IS NULL AND p_end IS NULL AND p_next_day IS NULL THEN
  RETURN pg_catalog.tsrange(p_day::timestamp,(p_day+1)::timestamp,'[)');
 END IF;
 IF p_start IS NULL OR p_end IS NULL OR p_next_day IS NULL OR p_start !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' OR p_end !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' THEN RAISE EXCEPTION 'OPS_SHIFT_CLOCK';END IF;
 v_start:=split_part(p_start,':',1)::integer*60+split_part(p_start,':',2)::integer;
 v_end:=split_part(p_end,':',1)::integer*60+split_part(p_end,':',2)::integer;
 v_duration:=v_end-v_start+CASE WHEN p_next_day THEN 1440 ELSE 0 END;
 IF v_duration<=0 OR v_duration>1440 THEN RAISE EXCEPTION 'OPS_SHIFT_DURATION';END IF;
 RETURN pg_catalog.tsrange(p_day::timestamp+v_start*INTERVAL '1 minute',p_day::timestamp+(v_start+v_duration)*INTERVAL '1 minute','[)');
END;
$$;
REVOKE ALL ON FUNCTION public.ops_shift_range(date,text,text,boolean) FROM PUBLIC,anon,authenticated;


-- 02_assignment_ranges
-- Additive foundation only. Keep day-based constraints until every writer/reader is migrated.

SET LOCAL lock_timeout='15s';
LOCK TABLE public.ops_daily_requests,public.ops_assignments IN ACCESS EXCLUSIVE MODE;
CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA extensions;
SET LOCAL search_path=pg_catalog,public,extensions;
ALTER TABLE public.ops_daily_requests
 ADD COLUMN shift_start text,
 ADD COLUMN shift_end text,
 ADD COLUMN shift_next_day boolean,
 ADD COLUMN shift_range tsrange GENERATED ALWAYS AS (public.ops_shift_range(work_date,shift_start,shift_end,shift_next_day)) STORED;
ALTER TABLE public.ops_assignments ADD COLUMN occupied_range tsrange;
UPDATE public.ops_assignments a SET occupied_range=r.shift_range FROM public.ops_daily_requests r
 WHERE r.tenant_id=a.tenant_id AND r.id=a.request_id AND r.work_date=a.work_date;
ALTER TABLE public.ops_assignments ALTER COLUMN occupied_range SET NOT NULL;
-- A removed assignment with a historical present record still reserves its original interval.
-- Existing contradictions intentionally abort the migration; do not erase attendance to pass it.
ALTER TABLE public.ops_assignments ADD CONSTRAINT ops_assignment_interval_exclusion
 EXCLUDE USING gist (tenant_id WITH =,worker_id WITH =,occupied_range WITH &&)
 WHERE (removed_at IS NULL OR attendance='present');

CREATE FUNCTION public.ops_assignment_shift_snapshot()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_range tsrange;
BEGIN
 IF current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION 'OPS_SHIFT_ISOLATION';END IF;
 IF TG_OP='UPDATE' THEN
  IF ROW(NEW.tenant_id,NEW.request_id,NEW.work_date,NEW.worker_id,NEW.occupied_range)
    IS DISTINCT FROM ROW(OLD.tenant_id,OLD.request_id,OLD.work_date,OLD.worker_id,OLD.occupied_range) THEN
   RAISE EXCEPTION 'OPS_SHIFT_ASSIGNMENT_IMMUTABLE';
  END IF;
  RETURN NEW;
 END IF;
 -- Serialize with a concurrent request time edit. Never trust a caller-supplied range.
 SELECT shift_range INTO v_range FROM public.ops_daily_requests
 WHERE tenant_id=NEW.tenant_id AND id=NEW.request_id AND work_date=NEW.work_date FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'OPS_OUT_OF_SCOPE';END IF;
 NEW.occupied_range:=v_range;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.ops_assignment_shift_snapshot() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER ops_assignment_shift_snapshot BEFORE INSERT OR UPDATE ON public.ops_assignments
 FOR EACH ROW EXECUTE FUNCTION public.ops_assignment_shift_snapshot();

CREATE FUNCTION public.ops_request_shift_history_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION 'OPS_SHIFT_ISOLATION';END IF;
 IF ROW(NEW.work_date,NEW.shift_start,NEW.shift_end,NEW.shift_next_day)
  IS DISTINCT FROM ROW(OLD.work_date,OLD.shift_start,OLD.shift_end,OLD.shift_next_day)
  AND EXISTS(SELECT 1 FROM public.ops_assignments WHERE tenant_id=OLD.tenant_id AND request_id=OLD.id) THEN
  RAISE EXCEPTION 'OPS_SHIFT_HAS_ASSIGNMENTS';
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.ops_request_shift_history_guard() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER ops_request_shift_history_guard BEFORE UPDATE ON public.ops_daily_requests
 FOR EACH ROW EXECUTE FUNCTION public.ops_request_shift_history_guard();


-- 03_timed_requests
-- Not a standalone production migration. Requires complete timed readers and assignment cutover.

SET LOCAL lock_timeout='15s';
ALTER TABLE public.ops_daily_requests ADD COLUMN shift_meeting_note text NOT NULL DEFAULT ''
 CHECK(length(shift_meeting_note)<=500 AND shift_meeting_note!~'[[:cntrl:]]');
CREATE UNIQUE INDEX ops_timed_request_identity ON public.ops_daily_requests
 (tenant_id,company_id,location_id,work_date,service_line,position,shift_start,shift_end,shift_next_day)
 WHERE lifecycle='active' AND shift_start IS NOT NULL;
CREATE FUNCTION public.ops_create_timed_requests(p_actor_id uuid,p_tenant_id uuid,p_command_id uuid,p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='3s' AS $$
DECLARE v_company uuid;v_location uuid;v_service text;v_position text;v_count integer;v_note text;
 v_shifts jsonb;v_shift jsonb;v_payload jsonb;v_command public.ops_commands;v_id uuid;v_rows jsonb:='[]';v_result jsonb;
BEGIN
 IF current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION 'OPS_SHIFT_ISOLATION';END IF;
 IF auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM p_actor_id THEN RAISE EXCEPTION 'OPS_SCOPE_CHANGED';END IF;
 PERFORM 1 FROM public.profiles WHERE id=p_actor_id FOR SHARE;
 PERFORM 1 FROM public.tenant_memberships WHERE user_id=p_actor_id AND tenant_id=p_tenant_id FOR SHARE;
 PERFORM public.talent_assert_scope(p_actor_id,p_tenant_id);
 IF coalesce(public.current_user_role(),'') NOT IN ('yonetici','operasyon') THEN RAISE EXCEPTION 'OPS_FORBIDDEN';END IF;
 IF p_command_id IS NULL OR p_payload IS NULL OR jsonb_typeof(p_payload)<>'object' OR octet_length(p_payload::text)>16384 THEN RAISE EXCEPTION 'OPS_VALIDATION';END IF;
 IF EXISTS(SELECT 1 FROM jsonb_object_keys(p_payload) k WHERE k NOT IN ('companyId','locationId','serviceLine','position','requiredCount','meetingNote','shifts')) THEN RAISE EXCEPTION 'OPS_VALIDATION';END IF;
 IF jsonb_typeof(p_payload->'companyId') IS DISTINCT FROM 'string' OR jsonb_typeof(p_payload->'locationId') IS DISTINCT FROM 'string'
 OR jsonb_typeof(p_payload->'serviceLine') IS DISTINCT FROM 'string' OR jsonb_typeof(p_payload->'position') IS DISTINCT FROM 'string'
 OR jsonb_typeof(p_payload->'meetingNote') IS DISTINCT FROM 'string' OR jsonb_typeof(p_payload->'requiredCount') IS DISTINCT FROM 'number'
 OR (p_payload->>'requiredCount')!~'^[0-9]+$' OR jsonb_typeof(p_payload->'shifts') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'OPS_VALIDATION';END IF;
 v_company:=(p_payload->>'companyId')::uuid;v_location:=(p_payload->>'locationId')::uuid;
 v_service:=btrim(p_payload->>'serviceLine');v_position:=btrim(p_payload->>'position');v_count:=(p_payload->>'requiredCount')::integer;v_note:=btrim(p_payload->>'meetingNote');
 IF length(v_service) NOT BETWEEN 1 AND 80 OR length(v_position) NOT BETWEEN 1 AND 80 OR v_service~'[[:cntrl:]]' OR v_position~'[[:cntrl:]]'
 OR v_count NOT BETWEEN 1 AND 100 OR length(v_note)>500 OR v_note~'[[:cntrl:]]' OR jsonb_array_length(p_payload->'shifts') NOT BETWEEN 1 AND 31 THEN RAISE EXCEPTION 'OPS_VALIDATION';END IF;
 FOR v_shift IN SELECT value FROM jsonb_array_elements(p_payload->'shifts') LOOP
  IF jsonb_typeof(v_shift)<>'object' THEN RAISE EXCEPTION 'OPS_VALIDATION';END IF;
  IF EXISTS(SELECT 1 FROM jsonb_object_keys(v_shift) k WHERE k NOT IN ('workDate','startTime','endTime','nextDay'))
  OR jsonb_typeof(v_shift->'workDate') IS DISTINCT FROM 'string' OR (v_shift->>'workDate')!~'^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
  OR jsonb_typeof(v_shift->'startTime') IS DISTINCT FROM 'string' OR jsonb_typeof(v_shift->'endTime') IS DISTINCT FROM 'string'
  OR jsonb_typeof(v_shift->'nextDay') IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'OPS_VALIDATION';END IF;
  PERFORM public.ops_shift_range((v_shift->>'workDate')::date,v_shift->>'startTime',v_shift->>'endTime',(v_shift->>'nextDay')::boolean);
 END LOOP;
 IF (SELECT count(*)<>count(DISTINCT value) FROM jsonb_array_elements(p_payload->'shifts')) OR
 (SELECT max((value->>'workDate')::date)-min((value->>'workDate')::date)>30 FROM jsonb_array_elements(p_payload->'shifts')) THEN RAISE EXCEPTION 'OPS_VALIDATION';END IF;
 SELECT jsonb_agg(value ORDER BY value->>'workDate',value->>'startTime',value->>'endTime',value->>'nextDay') INTO v_shifts FROM jsonb_array_elements(p_payload->'shifts');
 v_payload:=jsonb_build_object('companyId',v_company,'locationId',v_location,'serviceLine',v_service,'position',v_position,'requiredCount',v_count,'meetingNote',v_note,'shifts',v_shifts);
 INSERT INTO public.ops_commands(tenant_id,actor_id,id,kind,payload) VALUES(p_tenant_id,p_actor_id,p_command_id,'timed_requests',v_payload) ON CONFLICT DO NOTHING;
 SELECT * INTO STRICT v_command FROM public.ops_commands WHERE tenant_id=p_tenant_id AND actor_id=p_actor_id AND id=p_command_id FOR UPDATE;
 IF v_command.kind<>'timed_requests' OR v_command.payload IS DISTINCT FROM v_payload THEN RAISE EXCEPTION 'OPS_IDEMPOTENCY_MISMATCH';END IF;
 IF v_command.result IS NOT NULL THEN RETURN v_command.result;END IF;
 -- Serializes this RPC and legacy batch creation. Legacy single-create still needs
 -- a reverse mixed-mode guard in the full cutover; do not expose this RPC separately.
 PERFORM 1 FROM public.companies WHERE tenant_id=p_tenant_id AND id=v_company AND status IN ('aktif','aday') FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'OPS_INACTIVE_COMPANY';END IF;
 PERFORM 1 FROM public.ops_locations WHERE tenant_id=p_tenant_id AND company_id=v_company AND id=v_location AND active FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'OPS_INACTIVE_LOCATION';END IF;
 FOR v_shift IN SELECT value FROM jsonb_array_elements(v_shifts) LOOP
  IF EXISTS(SELECT 1 FROM public.ops_daily_requests WHERE tenant_id=p_tenant_id AND company_id=v_company AND location_id=v_location
   AND work_date=(v_shift->>'workDate')::date AND service_line=v_service AND position=v_position AND lifecycle='active' AND shift_start IS NULL) THEN RAISE EXCEPTION 'OPS_SHIFT_LEGACY_REQUEST';END IF;
  INSERT INTO public.ops_daily_requests(id,tenant_id,company_id,location_id,work_date,service_line,position,required_count,created_by,shift_start,shift_end,shift_next_day,shift_meeting_note)
   VALUES(gen_random_uuid(),p_tenant_id,v_company,v_location,(v_shift->>'workDate')::date,v_service,v_position,v_count,p_actor_id,v_shift->>'startTime',v_shift->>'endTime',(v_shift->>'nextDay')::boolean,v_note) RETURNING id INTO v_id;
  INSERT INTO public.ops_events(tenant_id,actor_id,command_id,kind,entity_id) VALUES(p_tenant_id,p_actor_id,p_command_id,'timed_requests',v_id);
  v_rows:=v_rows||jsonb_build_array(v_shift||jsonb_build_object('id',v_id));
 END LOOP;
 v_result:=jsonb_build_object('commandId',p_command_id,'tenantId',p_tenant_id,'payload',v_payload,'rows',v_rows);
 UPDATE public.ops_commands SET result=v_result WHERE tenant_id=p_tenant_id AND actor_id=p_actor_id AND id=p_command_id;
 RETURN v_result;
END $$;
REVOKE ALL ON FUNCTION public.ops_create_timed_requests(uuid,uuid,uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ops_create_timed_requests(uuid,uuid,uuid,jsonb) TO authenticated;


-- 04_writer_cutover
-- Integrated cutover only: preserve current function bodies/role locks, fail on unexpected baseline.

SET LOCAL lock_timeout='15s';
LOCK TABLE public.ops_daily_requests,public.ops_assignments IN ACCESS EXCLUSIVE MODE;
CREATE FUNCTION pg_temp.shift_patch(signature text,old_text text,new_text text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE d text;
BEGIN
 SELECT pg_get_functiondef(to_regprocedure(signature)) INTO d;
 IF d IS NULL OR (length(d)-length(replace(d,old_text,'')))/length(old_text)<>1 THEN RAISE EXCEPTION 'SHIFT_BASELINE_MISMATCH: %',signature;END IF;
 EXECUTE replace(d,old_text,new_text);
END $$;
SELECT pg_temp.shift_patch('public.ops_mutate(uuid,text,jsonb)',
 'work_date=v_request.work_date AND removed_at IS NULL)',
 'occupied_range && v_request.shift_range AND (removed_at IS NULL OR attendance=''present''))');
SELECT pg_temp.shift_patch('public.ops_replace_assignment_before_start(uuid,uuid,uuid,uuid,uuid,integer)',
 'work_date=v_request.work_date AND (removed_at IS NULL OR attendance=''present'')',
 'occupied_range && v_request.shift_range AND (removed_at IS NULL OR attendance=''present'')');
SELECT pg_temp.shift_patch('public.ops_record_attendance(uuid,uuid,uuid,uuid,integer,text)',
 'work_date=v_assignment.work_date AND attendance=''present'' AND id<>p_assignment_id',
 'occupied_range && v_assignment.occupied_range AND (removed_at IS NULL OR attendance=''present'') AND id<>p_assignment_id');
SELECT pg_temp.shift_patch('public.ops_fixed_roster_idp_create(uuid,uuid,uuid,uuid,integer,date,date,jsonb)',
 'work_date BETWEEN p_start AND p_end',
 'occupied_range && tsrange(p_start::timestamp,(p_end+1)::timestamp,''[)'')');
SELECT pg_temp.shift_patch('public.ops_fixed_roster_period_guard()',
 'work_date BETWEEN NEW.leave_start AND NEW.leave_end',
 'occupied_range && tsrange(NEW.leave_start::timestamp,(NEW.leave_end+1)::timestamp,''[)'')');
SELECT pg_temp.shift_patch('public.ops_fixed_roster_assignment_guard()',
 'NEW.work_date BETWEEN p.leave_start AND p.leave_end',
 'NEW.occupied_range && tsrange(p.leave_start::timestamp,(p.leave_end+1)::timestamp,''[)'')');
SELECT pg_temp.shift_patch('public.ops_start_execute(uuid,uuid,uuid,uuid,integer,text,jsonb)',
 'v_start:=(r.work_date+(p_payload->>''time'')::time) AT TIME ZONE ''Europe/Istanbul'';',
 'IF r.shift_start IS NOT NULL AND p_payload->>''time'' IS DISTINCT FROM r.shift_start THEN RAISE EXCEPTION ''START_SHIFT_TIME'';END IF;
  v_start:=(r.work_date+(p_payload->>''time'')::time) AT TIME ZONE ''Europe/Istanbul'';');

-- Both old and new request writers must reject a mixed timed/unknown duplicate.
CREATE FUNCTION public.ops_request_mode_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION 'OPS_SHIFT_ISOLATION';END IF;
 IF NEW.lifecycle<>'active' THEN RETURN NEW;END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(jsonb_build_array(NEW.tenant_id,NEW.company_id,NEW.location_id,NEW.work_date,NEW.service_line,NEW.position)::text,0));
 IF EXISTS(SELECT 1 FROM public.ops_daily_requests r WHERE r.tenant_id=NEW.tenant_id AND r.company_id=NEW.company_id AND r.location_id=NEW.location_id
 AND r.work_date=NEW.work_date AND r.service_line=NEW.service_line AND r.position=NEW.position AND r.lifecycle='active' AND r.id<>NEW.id AND (r.shift_start IS NULL)<>(NEW.shift_start IS NULL)) THEN RAISE EXCEPTION 'OPS_SHIFT_LEGACY_REQUEST';END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.ops_request_mode_guard() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER ops_request_mode_guard BEFORE INSERT OR UPDATE ON public.ops_daily_requests FOR EACH ROW EXECUTE FUNCTION public.ops_request_mode_guard();
-- Interval exclusion is now the shared active/history boundary, including legacy full-day rows.
DROP INDEX public.ops_one_worker_per_day;
DROP INDEX public.ops_worker_present_day;


-- 05_board

DO $migration$
DECLARE d text;old_text text;new_text text;
BEGIN
 d:=pg_get_functiondef('public.ops_board(uuid,date)'::regprocedure);
 old_text:='''locations'',(SELECT';new_text:='''shiftVersion'',1,''locations'',(SELECT';
 IF (length(d)-length(replace(d,old_text,'')))/length(old_text)<>1 THEN RAISE EXCEPTION 'SHIFT_BOARD_BASELINE';END IF;d:=replace(d,old_text,new_text);
 old_text:='''lifecycle'',r.lifecycle,';
 new_text:=$fragment$'lifecycle',r.lifecycle,
 'shift',CASE WHEN r.shift_start IS NULL THEN NULL ELSE jsonb_build_object('startTime',r.shift_start,'endTime',r.shift_end,'nextDay',r.shift_next_day) END,
 'meetingNote',r.shift_meeting_note,
 'blockedWorkerIds',(SELECT coalesce(jsonb_agg(w.id),'[]') FROM public.ops_workers w WHERE w.tenant_id=v_tenant AND (
 EXISTS(SELECT 1 FROM public.ops_assignments x WHERE x.tenant_id=v_tenant AND x.worker_id=w.id AND (x.removed_at IS NULL OR x.attendance='present') AND x.occupied_range && r.shift_range)
 OR EXISTS(SELECT 1 FROM public.ops_fixed_roster fr JOIN public.ops_fixed_roster_idp i ON i.tenant_id=fr.tenant_id AND i.roster_id=fr.id JOIN public.ops_idp_periods p ON p.tenant_id=i.tenant_id AND p.id=i.period_id
 WHERE fr.tenant_id=v_tenant AND fr.worker_id=w.id AND NOT p.cancelled AND r.shift_range && tsrange(p.leave_start::timestamp,(p.leave_end+1)::timestamp,'[)')))), $fragment$;
 IF (length(d)-length(replace(d,old_text,'')))/length(old_text)<>1 THEN RAISE EXCEPTION 'SHIFT_BOARD_BASELINE';END IF;d:=replace(d,old_text,new_text);
 EXECUTE d;
END $migration$;
-- Existing explicit role/company/tenant checks remain; roster tables are private.
ALTER FUNCTION public.ops_board(uuid,date) SECURITY DEFINER;
REVOKE ALL ON FUNCTION public.ops_board(uuid,date) FROM PUBLIC,anon;


-- 06_week

DO $$DECLARE signature text;d text;old_text text;new_text text;
BEGIN
 FOREACH signature IN ARRAY ARRAY['public.ops_week(uuid,date)','public.ops_attendance_week(uuid,date)'] LOOP
  d:=pg_get_functiondef(to_regprocedure(signature));old_text:='''companyId'',p_company_id,''companyName''';
  IF (length(d)-length(replace(d,old_text,'')))/length(old_text)<>1 THEN RAISE EXCEPTION 'SHIFT_WEEK_BASELINE';END IF;
  d:=replace(d,old_text,'''shiftVersion'',1,''companyId'',p_company_id,''companyName''');
  old_text:='''lifecycle'',r.lifecycle,';
  new_text:='''lifecycle'',r.lifecycle,''shift'',CASE WHEN r.shift_start IS NULL THEN NULL ELSE jsonb_build_object(''startTime'',r.shift_start,''endTime'',r.shift_end,''nextDay'',r.shift_next_day) END,';
  IF (length(d)-length(replace(d,old_text,'')))/length(old_text)<>1 THEN RAISE EXCEPTION 'SHIFT_WEEK_BASELINE';END IF;EXECUTE replace(d,old_text,new_text);
 END LOOP;
END $$;


-- 07_start_times

DO $$DECLARE d text;signature text;old_text text;new_text text;
BEGIN
 FOREACH signature IN ARRAY ARRAY['public.ops_start_board(uuid,uuid,date,integer)','public.ops_start_board_filtered(uuid,uuid,date,integer,text,boolean,boolean)'] LOOP
  d:=pg_get_functiondef(to_regprocedure(signature));
  IF signature LIKE '%filtered%' THEN
   old_text:='r.position,';new_text:='r.position,r.shift_start scheduled_time,';
   IF (length(d)-length(replace(d,old_text,'')))/length(old_text)<>1 THEN RAISE EXCEPTION 'SHIFT_START_BASELINE';END IF;d:=replace(d,old_text,new_text);
   old_text:='''position'',b.position,';new_text:='''position'',b.position,''scheduledTime'',b.scheduled_time,';
  ELSE
   old_text:='''position'',r.position,';new_text:='''position'',r.position,''scheduledTime'',r.shift_start,';
  END IF;
  IF (length(d)-length(replace(d,old_text,'')))/length(old_text)<>1 THEN RAISE EXCEPTION 'SHIFT_START_BASELINE';END IF;
  EXECUTE replace(d,old_text,new_text);
 END LOOP;
END $$;

COMMIT;
