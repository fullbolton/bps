-- Fixed branch roster and linked IDP: reviewed local SQL assembled atomically.
BEGIN;

-- 01_roster
-- NOT APPLIED. Fixed branch roster foundation; no automatic attendance or pay records.

SET LOCAL lock_timeout='15s';
CREATE TABLE public.ops_fixed_roster (
 tenant_id uuid NOT NULL REFERENCES public.tenants(id), id uuid NOT NULL,
 company_id uuid NOT NULL, location_id uuid NOT NULL, worker_id uuid NOT NULL,
 service_line text NOT NULL CHECK(length(btrim(service_line)) BETWEEN 1 AND 80),
 position text NOT NULL CHECK(length(btrim(position)) BETWEEN 1 AND 80),
 starts_on date NOT NULL CHECK(starts_on BETWEEN DATE '2000-01-01' AND DATE '2100-12-31'),
 ends_on date CHECK(ends_on BETWEEN starts_on AND DATE '2100-12-31'),
 cancelled boolean NOT NULL DEFAULT false,
 revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
 created_by uuid NOT NULL REFERENCES public.profiles(id), updated_by uuid NOT NULL REFERENCES public.profiles(id),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,id),
 FOREIGN KEY(tenant_id,company_id,location_id) REFERENCES public.ops_locations(tenant_id,company_id,id),
 FOREIGN KEY(tenant_id,worker_id) REFERENCES public.ops_workers(tenant_id,id)
);
CREATE INDEX ops_fixed_roster_worker ON public.ops_fixed_roster(tenant_id,worker_id,starts_on);
CREATE INDEX ops_fixed_roster_branch ON public.ops_fixed_roster(tenant_id,company_id,location_id,starts_on,id);
CREATE TABLE public.ops_fixed_roster_commands (
 tenant_id uuid NOT NULL REFERENCES public.tenants(id), actor_id uuid NOT NULL REFERENCES public.profiles(id),
 command_id uuid NOT NULL, payload jsonb NOT NULL, result jsonb,
 roster_id uuid GENERATED ALWAYS AS ((coalesce(payload->>'id',payload->>'rosterId'))::uuid) STORED,
 created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(tenant_id,actor_id,command_id)
);
CREATE INDEX ops_fixed_roster_command_history ON public.ops_fixed_roster_commands(tenant_id,roster_id,created_at DESC,command_id);
ALTER TABLE public.ops_fixed_roster ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ops_fixed_roster_commands ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ops_fixed_roster,public.ops_fixed_roster_commands FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.ops_fixed_roster_save(
 p_actor_id uuid,p_tenant_id uuid,p_command_id uuid,p_id uuid,p_expected_revision integer,
 p_company_id uuid,p_location_id uuid,p_worker_id uuid,p_service_line text,p_position text,
 p_starts_on date,p_ends_on date,p_reason text,p_cancelled boolean DEFAULT false
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='3s' AS $$
DECLARE v_payload jsonb;v_command public.ops_fixed_roster_commands;v_old public.ops_fixed_roster;v_new public.ops_fixed_roster;v_result jsonb;
BEGIN
 IF current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION 'ROSTER_ISOLATION';END IF;
 IF auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM p_actor_id THEN RAISE EXCEPTION 'OPS_SCOPE_CHANGED';END IF;
 PERFORM 1 FROM public.profiles WHERE id=p_actor_id FOR SHARE;
 PERFORM 1 FROM public.tenant_memberships WHERE user_id=p_actor_id AND tenant_id=p_tenant_id FOR SHARE;
 PERFORM public.talent_assert_scope(p_actor_id,p_tenant_id);
 IF coalesce(public.current_user_role(),'') NOT IN ('yonetici','operasyon') THEN RAISE EXCEPTION 'OPS_FORBIDDEN';END IF;
 IF p_cancelled IS NULL OR (p_expected_revision=0 AND p_cancelled) THEN RAISE EXCEPTION 'OPS_VALIDATION';END IF;
 IF p_command_id IS NULL OR p_id IS NULL OR p_company_id IS NULL OR p_location_id IS NULL OR p_worker_id IS NULL
 OR p_expected_revision IS NULL OR p_expected_revision<0 OR p_expected_revision>=2147483647
 OR p_service_line IS NULL OR length(btrim(p_service_line)) NOT BETWEEN 1 AND 80 OR p_service_line~'[[:cntrl:]]'
 OR p_position IS NULL OR length(btrim(p_position)) NOT BETWEEN 1 AND 80 OR p_position~'[[:cntrl:]]'
 OR p_reason IS NULL OR length(btrim(p_reason)) NOT BETWEEN 3 AND 500 OR p_reason~'[[:cntrl:]]'
 OR p_starts_on IS NULL OR p_starts_on NOT BETWEEN DATE '2000-01-01' AND DATE '2100-12-31'
 OR (p_ends_on IS NOT NULL AND (p_ends_on<p_starts_on OR p_ends_on>DATE '2100-12-31')) THEN RAISE EXCEPTION 'OPS_VALIDATION';END IF;
 v_payload:=jsonb_build_object('id',p_id,'revision',p_expected_revision,'companyId',p_company_id,'locationId',p_location_id,'workerId',p_worker_id,'serviceLine',btrim(p_service_line),'position',btrim(p_position),'startsOn',p_starts_on,'endsOn',p_ends_on,'reason',btrim(p_reason),'cancelled',p_cancelled);
 INSERT INTO public.ops_fixed_roster_commands(tenant_id,actor_id,command_id,payload) VALUES(p_tenant_id,p_actor_id,p_command_id,v_payload) ON CONFLICT DO NOTHING;
 SELECT * INTO STRICT v_command FROM public.ops_fixed_roster_commands WHERE tenant_id=p_tenant_id AND actor_id=p_actor_id AND command_id=p_command_id FOR UPDATE;
 IF v_command.payload IS DISTINCT FROM v_payload THEN RAISE EXCEPTION 'OPS_IDEMPOTENCY_MISMATCH';END IF;
 IF v_command.result IS NOT NULL THEN RETURN v_command.result;END IF;
 -- Serializes all writes for this worker, including disjoint branch rows. The following
 -- statements get fresh READ COMMITTED snapshots after a concurrent writer commits.
 PERFORM 1 FROM public.ops_workers WHERE tenant_id=p_tenant_id AND id=p_worker_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'OPS_OUT_OF_SCOPE';END IF;
 SELECT * INTO v_old FROM public.ops_fixed_roster WHERE tenant_id=p_tenant_id AND id=p_id FOR UPDATE;
 IF (p_expected_revision=0 AND FOUND) OR (p_expected_revision>0 AND (NOT FOUND OR v_old.revision<>p_expected_revision)) THEN RAISE EXCEPTION 'OPS_STALE_VERSION';END IF;
 IF p_expected_revision>0 AND (v_old.company_id<>p_company_id OR v_old.location_id<>p_location_id OR v_old.worker_id<>p_worker_id) THEN RAISE EXCEPTION 'ROSTER_IDENTITY_LOCKED';END IF;
 IF p_expected_revision>0 AND v_old.cancelled THEN RAISE EXCEPTION 'ROSTER_CANCELLED';END IF;
 -- Closing/correcting historical rows is allowed after a branch/person is deactivated.
 IF p_expected_revision=0 THEN
  PERFORM 1 FROM public.companies WHERE tenant_id=p_tenant_id AND id=p_company_id AND status IN ('aktif','aday') FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'OPS_INACTIVE_COMPANY';END IF;
  PERFORM 1 FROM public.ops_locations WHERE tenant_id=p_tenant_id AND company_id=p_company_id AND id=p_location_id AND active FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'OPS_INACTIVE_LOCATION';END IF;
  IF NOT EXISTS(SELECT 1 FROM public.ops_workers WHERE tenant_id=p_tenant_id AND id=p_worker_id AND active AND kind='sabit') THEN RAISE EXCEPTION 'ROSTER_FIXED_WORKER_REQUIRED';END IF;
 END IF;
 IF NOT p_cancelled AND EXISTS(SELECT 1 FROM public.ops_fixed_roster r WHERE r.tenant_id=p_tenant_id AND r.worker_id=p_worker_id AND r.id<>p_id AND NOT r.cancelled
 AND r.starts_on<=coalesce(p_ends_on,DATE '2100-12-31') AND coalesce(r.ends_on,DATE '2100-12-31')>=p_starts_on) THEN RAISE EXCEPTION 'ROSTER_DATE_CONFLICT';END IF;
 IF p_expected_revision=0 THEN
  INSERT INTO public.ops_fixed_roster(tenant_id,id,company_id,location_id,worker_id,service_line,position,starts_on,ends_on,created_by,updated_by)
   VALUES(p_tenant_id,p_id,p_company_id,p_location_id,p_worker_id,btrim(p_service_line),btrim(p_position),p_starts_on,p_ends_on,p_actor_id,p_actor_id) RETURNING * INTO v_new;
 ELSE
  UPDATE public.ops_fixed_roster SET cancelled=p_cancelled,service_line=btrim(p_service_line),position=btrim(p_position),starts_on=p_starts_on,ends_on=p_ends_on,revision=revision+1,updated_by=p_actor_id,updated_at=now() WHERE tenant_id=p_tenant_id AND id=p_id RETURNING * INTO v_new;
 END IF;
 v_result:=jsonb_build_object('commandId',p_command_id,'previous',CASE WHEN p_expected_revision=0 THEN NULL ELSE to_jsonb(v_old) END,'record',to_jsonb(v_new));
 UPDATE public.ops_fixed_roster_commands SET result=v_result WHERE tenant_id=p_tenant_id AND actor_id=p_actor_id AND command_id=p_command_id;
 RETURN v_result;
END $$;
REVOKE ALL ON FUNCTION public.ops_fixed_roster_save(uuid,uuid,uuid,uuid,integer,uuid,uuid,uuid,text,text,date,date,text,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ops_fixed_roster_save(uuid,uuid,uuid,uuid,integer,uuid,uuid,uuid,text,text,date,date,text,boolean) TO authenticated;

CREATE FUNCTION public.ops_fixed_roster_list(p_actor_id uuid,p_tenant_id uuid,p_company_id uuid,p_location_id uuid,p_day date,p_offset integer DEFAULT 0,p_history boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_rows jsonb;
BEGIN
 PERFORM public.talent_assert_scope(p_actor_id,p_tenant_id);
 IF coalesce(public.current_user_role(),'') NOT IN ('yonetici','operasyon') THEN RAISE EXCEPTION 'OPS_FORBIDDEN';END IF;
 IF p_history IS NULL OR p_company_id IS NULL OR p_location_id IS NULL OR p_day IS NULL OR p_day NOT BETWEEN DATE '2000-01-01' AND DATE '2100-12-31' OR p_offset IS NULL OR p_offset<0 OR p_offset>100000 THEN RAISE EXCEPTION 'OPS_VALIDATION';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.ops_locations WHERE tenant_id=p_tenant_id AND company_id=p_company_id AND id=p_location_id) THEN RAISE EXCEPTION 'OPS_OUT_OF_SCOPE';END IF;
 SELECT coalesce(jsonb_agg(to_jsonb(q) ORDER BY q.starts_on,q.id),'[]'::jsonb) INTO v_rows FROM (
 SELECT r.*,w.name AS worker_name,w.active AS worker_active FROM public.ops_fixed_roster r JOIN public.ops_workers w ON w.tenant_id=r.tenant_id AND w.id=r.worker_id
 WHERE r.tenant_id=p_tenant_id AND r.company_id=p_company_id AND r.location_id=p_location_id AND (p_history OR (NOT r.cancelled AND r.starts_on<=p_day AND (r.ends_on IS NULL OR r.ends_on>=p_day)))
 ORDER BY r.starts_on,r.id LIMIT 51 OFFSET p_offset) q;
 RETURN jsonb_build_object('rows',v_rows,'offset',p_offset,'companyName',(SELECT name FROM public.companies WHERE tenant_id=p_tenant_id AND id=p_company_id),'locationName',(SELECT name FROM public.ops_locations WHERE tenant_id=p_tenant_id AND company_id=p_company_id AND id=p_location_id));
END $$;
REVOKE ALL ON FUNCTION public.ops_fixed_roster_list(uuid,uuid,uuid,uuid,date,integer,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ops_fixed_roster_list(uuid,uuid,uuid,uuid,date,integer,boolean) TO authenticated;
CREATE FUNCTION public.ops_fixed_roster_history(p_actor_id uuid,p_tenant_id uuid,p_id uuid,p_offset integer DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE rows jsonb;
BEGIN
 PERFORM public.talent_assert_scope(p_actor_id,p_tenant_id);
 IF coalesce(public.current_user_role(),'') NOT IN ('yonetici','operasyon') THEN RAISE EXCEPTION 'OPS_FORBIDDEN';END IF;
 IF p_id IS NULL OR p_offset IS NULL OR p_offset<0 OR p_offset>100000 THEN RAISE EXCEPTION 'OPS_VALIDATION';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.ops_fixed_roster WHERE tenant_id=p_tenant_id AND id=p_id) THEN RAISE EXCEPTION 'OPS_OUT_OF_SCOPE';END IF;
 SELECT coalesce(jsonb_agg(to_jsonb(q) ORDER BY q.created_at DESC,q.command_id),'[]'::jsonb) INTO rows FROM (
 SELECT command_id,created_at,actor_id,payload,result FROM public.ops_fixed_roster_commands WHERE tenant_id=p_tenant_id AND roster_id=p_id AND result IS NOT NULL ORDER BY created_at DESC,command_id LIMIT 51 OFFSET p_offset) q;
 RETURN rows;
END $$;
REVOKE ALL ON FUNCTION public.ops_fixed_roster_history(uuid,uuid,uuid,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ops_fixed_roster_history(uuid,uuid,uuid,integer) TO authenticated;


-- 02_idp_link
-- Requires 01_roster.sql and the applied IDP period management schema. NOT APPLIED.

SET LOCAL lock_timeout='15s';
CREATE TABLE public.ops_fixed_roster_idp (
 tenant_id uuid NOT NULL, period_id uuid NOT NULL, roster_id uuid NOT NULL,
 snapshot jsonb NOT NULL, PRIMARY KEY(tenant_id,period_id),
 FOREIGN KEY(tenant_id,period_id) REFERENCES public.ops_idp_periods(tenant_id,id),
 FOREIGN KEY(tenant_id,roster_id) REFERENCES public.ops_fixed_roster(tenant_id,id)
);
CREATE INDEX ops_fixed_roster_idp_source ON public.ops_fixed_roster_idp(tenant_id,roster_id);
ALTER TABLE public.ops_fixed_roster_idp ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ops_fixed_roster_idp FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.ops_fixed_roster_idp_create(p_actor_id uuid,p_tenant_id uuid,p_command_id uuid,p_roster_id uuid,p_expected_revision integer,p_start date,p_end date,p_dates jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='3s' AS $$
DECLARE r public.ops_fixed_roster;w public.ops_workers;c public.ops_fixed_roster_commands;payload jsonb;v_result jsonb;
BEGIN
 IF current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION 'ROSTER_ISOLATION';END IF;
 IF auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM p_actor_id THEN RAISE EXCEPTION 'OPS_SCOPE_CHANGED';END IF;
 PERFORM 1 FROM public.profiles WHERE id=p_actor_id FOR SHARE;
 PERFORM 1 FROM public.tenant_memberships WHERE user_id=p_actor_id AND tenant_id=p_tenant_id FOR SHARE;
 PERFORM public.talent_assert_scope(p_actor_id,p_tenant_id);
 IF coalesce(public.current_user_role(),'') NOT IN ('yonetici','operasyon') THEN RAISE EXCEPTION 'OPS_FORBIDDEN';END IF;
 IF p_command_id IS NULL OR p_roster_id IS NULL OR p_expected_revision IS NULL OR p_expected_revision<1
 OR p_start IS NULL OR p_end IS NULL OR p_start<DATE '2000-01-01' OR p_end>DATE '2100-12-31' OR p_end<p_start OR p_end-p_start>30
 OR p_dates IS NULL OR jsonb_typeof(p_dates)<>'array' THEN RAISE EXCEPTION 'OPS_VALIDATION';END IF;
 payload:=jsonb_build_object('kind','idp','rosterId',p_roster_id,'revision',p_expected_revision,'start',p_start,'end',p_end,'dates',p_dates);
 INSERT INTO public.ops_fixed_roster_commands(tenant_id,actor_id,command_id,payload) VALUES(p_tenant_id,p_actor_id,p_command_id,payload) ON CONFLICT DO NOTHING;
 SELECT * INTO STRICT c FROM public.ops_fixed_roster_commands WHERE tenant_id=p_tenant_id AND actor_id=p_actor_id AND command_id=p_command_id FOR UPDATE;
 IF c.payload IS DISTINCT FROM payload THEN RAISE EXCEPTION 'OPS_IDEMPOTENCY_MISMATCH';END IF;
 IF c.result IS NOT NULL THEN RETURN c.result;END IF;
 SELECT * INTO r FROM public.ops_fixed_roster WHERE tenant_id=p_tenant_id AND id=p_roster_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'OPS_OUT_OF_SCOPE';END IF;
 -- Same lock order as roster changes; prevents name/source changes during snapshot creation.
 SELECT * INTO w FROM public.ops_workers WHERE tenant_id=p_tenant_id AND id=r.worker_id FOR UPDATE;
 SELECT * INTO r FROM public.ops_fixed_roster WHERE tenant_id=p_tenant_id AND id=p_roster_id FOR UPDATE;
 IF r.revision<>p_expected_revision THEN RAISE EXCEPTION 'OPS_STALE_VERSION';END IF;
 IF r.cancelled OR NOT w.active THEN RAISE EXCEPTION 'ROSTER_CANCELLED';END IF;
 IF p_start<r.starts_on OR (r.ends_on IS NOT NULL AND p_end>r.ends_on) THEN RAISE EXCEPTION 'ROSTER_LEAVE_RANGE';END IF;
 IF EXISTS(SELECT 1 FROM public.ops_assignments WHERE tenant_id=p_tenant_id AND worker_id=r.worker_id AND work_date BETWEEN p_start AND p_end AND (removed_at IS NULL OR attendance='present')) THEN RAISE EXCEPTION 'ROSTER_LEAVE_ASSIGNED';END IF;
 IF EXISTS(SELECT 1 FROM public.ops_fixed_roster_idp i JOIN public.ops_idp_periods p ON p.tenant_id=i.tenant_id AND p.id=i.period_id
 WHERE i.tenant_id=p_tenant_id AND i.roster_id=p_roster_id AND NOT p.cancelled AND p.leave_start<=p_end AND p.leave_end>=p_start) THEN RAISE EXCEPTION 'ROSTER_LEAVE_CONFLICT';END IF;
 v_result:=public.ops_idp_period_create(p_actor_id,p_tenant_id,p_command_id,jsonb_build_object('companyId',r.company_id,'locationId',r.location_id,'serviceLine',r.service_line,'position',r.position,'requiredCount',1,'dates',p_dates,'idp',jsonb_build_object('originalName',w.name,'leaveStart',p_start,'leaveEnd',p_end)));
 INSERT INTO public.ops_fixed_roster_idp(tenant_id,period_id,roster_id,snapshot) VALUES(p_tenant_id,(v_result->>'periodId')::uuid,r.id,to_jsonb(r)||jsonb_build_object('worker_name',w.name));
 UPDATE public.ops_fixed_roster_commands SET result=v_result WHERE tenant_id=p_tenant_id AND actor_id=p_actor_id AND command_id=p_command_id;
 RETURN v_result;
END $$;
REVOKE ALL ON FUNCTION public.ops_fixed_roster_idp_create(uuid,uuid,uuid,uuid,integer,date,date,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ops_fixed_roster_idp_create(uuid,uuid,uuid,uuid,integer,date,date,jsonb) TO authenticated;

-- Linked periods remain compatible with their source; edits cannot bypass create checks.
CREATE FUNCTION public.ops_fixed_roster_period_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE source uuid;r public.ops_fixed_roster;
BEGIN
 SELECT roster_id INTO source FROM public.ops_fixed_roster_idp WHERE tenant_id=NEW.tenant_id AND period_id=NEW.id;
 IF source IS NULL OR NEW.cancelled THEN RETURN NEW;END IF;
 IF NEW.original_name IS DISTINCT FROM (SELECT snapshot->>'worker_name' FROM public.ops_fixed_roster_idp WHERE tenant_id=NEW.tenant_id AND period_id=NEW.id) THEN RAISE EXCEPTION 'ROSTER_SOURCE_NAME';END IF;
 IF current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION 'ROSTER_ISOLATION';END IF;
 PERFORM 1 FROM public.ops_workers WHERE tenant_id=NEW.tenant_id AND id=(SELECT worker_id FROM public.ops_fixed_roster WHERE tenant_id=NEW.tenant_id AND id=source) FOR UPDATE;
 SELECT * INTO r FROM public.ops_fixed_roster WHERE tenant_id=NEW.tenant_id AND id=source FOR UPDATE;
 IF r.cancelled OR NEW.leave_start<r.starts_on OR (r.ends_on IS NOT NULL AND NEW.leave_end>r.ends_on) THEN RAISE EXCEPTION 'ROSTER_LEAVE_RANGE';END IF;
 IF EXISTS(SELECT 1 FROM public.ops_assignments WHERE tenant_id=NEW.tenant_id AND worker_id=r.worker_id AND work_date BETWEEN NEW.leave_start AND NEW.leave_end AND (removed_at IS NULL OR attendance='present')) THEN RAISE EXCEPTION 'ROSTER_LEAVE_ASSIGNED';END IF;
 IF EXISTS(SELECT 1 FROM public.ops_fixed_roster_idp i JOIN public.ops_idp_periods p ON p.tenant_id=i.tenant_id AND p.id=i.period_id WHERE i.tenant_id=NEW.tenant_id AND i.roster_id=source AND p.id<>NEW.id AND NOT p.cancelled AND p.leave_start<=NEW.leave_end AND p.leave_end>=NEW.leave_start) THEN RAISE EXCEPTION 'ROSTER_LEAVE_CONFLICT';END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER ops_fixed_roster_period_guard BEFORE UPDATE ON public.ops_idp_periods FOR EACH ROW EXECUTE FUNCTION public.ops_fixed_roster_period_guard();
CREATE FUNCTION public.ops_fixed_roster_source_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM public.ops_fixed_roster_idp i JOIN public.ops_idp_periods p ON p.tenant_id=i.tenant_id AND p.id=i.period_id WHERE i.tenant_id=NEW.tenant_id AND i.roster_id=NEW.id AND NOT p.cancelled AND (NEW.cancelled OR p.leave_start<NEW.starts_on OR (NEW.ends_on IS NOT NULL AND p.leave_end>NEW.ends_on))) THEN RAISE EXCEPTION 'ROSTER_LINKED_PERIOD';END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER ops_fixed_roster_source_guard BEFORE UPDATE ON public.ops_fixed_roster FOR EACH ROW EXECUTE FUNCTION public.ops_fixed_roster_source_guard();
REVOKE ALL ON FUNCTION public.ops_fixed_roster_period_guard(),public.ops_fixed_roster_source_guard() FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.ops_fixed_roster_assignment_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.removed_at IS NOT NULL AND NEW.attendance<>'present' THEN RETURN NEW;END IF;
 IF current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION 'ROSTER_ISOLATION';END IF;
 PERFORM 1 FROM public.ops_workers WHERE tenant_id=NEW.tenant_id AND id=NEW.worker_id FOR UPDATE;
 IF EXISTS(SELECT 1 FROM public.ops_fixed_roster r JOIN public.ops_fixed_roster_idp i ON i.tenant_id=r.tenant_id AND i.roster_id=r.id JOIN public.ops_idp_periods p ON p.tenant_id=i.tenant_id AND p.id=i.period_id WHERE r.tenant_id=NEW.tenant_id AND r.worker_id=NEW.worker_id AND NOT p.cancelled AND NEW.work_date BETWEEN p.leave_start AND p.leave_end) THEN RAISE EXCEPTION 'ROSTER_WORKER_ON_LEAVE';END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER ops_fixed_roster_assignment_guard BEFORE INSERT OR UPDATE ON public.ops_assignments FOR EACH ROW EXECUTE FUNCTION public.ops_fixed_roster_assignment_guard();
REVOKE ALL ON FUNCTION public.ops_fixed_roster_assignment_guard() FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.ops_idp_period_read(p_actor_id uuid,p_tenant_id uuid,p_period_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_result jsonb;
BEGIN
 PERFORM public.talent_assert_scope(p_actor_id,p_tenant_id);
 IF coalesce(public.current_user_role(),'') NOT IN ('yonetici','operasyon') THEN RAISE EXCEPTION 'OPS_FORBIDDEN';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.ops_idp_periods WHERE tenant_id=p_tenant_id AND id=p_period_id) THEN RAISE EXCEPTION 'OPS_OUT_OF_SCOPE';END IF;
 SELECT jsonb_agg(jsonb_build_object('sourceRosterId',(SELECT roster_id FROM public.ops_fixed_roster_idp WHERE tenant_id=p.tenant_id AND period_id=p.id),'periodRevision',p.revision,'periodCancelled',p.cancelled,'requestId',r.id,'companyId',r.company_id,'day',r.work_date,'lifecycle',r.lifecycle,'originalName',c.original_name,'leaveStart',c.leave_start,'leaveEnd',c.leave_end,
 'assignedNames',(SELECT coalesce(jsonb_agg(w.name ORDER BY w.name),'[]') FROM public.ops_assignments a JOIN public.ops_workers w ON w.tenant_id=a.tenant_id AND w.id=a.worker_id WHERE a.tenant_id=r.tenant_id AND a.request_id=r.id AND a.removed_at IS NULL)) ORDER BY r.work_date,r.id)
 INTO v_result FROM public.ops_idp_context c JOIN public.ops_idp_periods p ON p.tenant_id=c.tenant_id AND p.id=c.period_id JOIN public.ops_daily_requests r ON r.tenant_id=c.tenant_id AND r.id=c.request_id WHERE c.tenant_id=p_tenant_id AND c.period_id=p_period_id;
 RETURN coalesce(v_result,'[]');
END $$;

COMMIT;
