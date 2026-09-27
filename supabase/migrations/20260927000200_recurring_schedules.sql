BEGIN;
SET LOCAL lock_timeout='15s';
CREATE TABLE public.ops_schedules(
 tenant_id uuid NOT NULL REFERENCES public.tenants(id),id uuid NOT NULL,company_id uuid NOT NULL,location_id uuid NOT NULL,
 revision integer NOT NULL DEFAULT 1 CHECK(revision>0),plan jsonb NOT NULL,created_by uuid NOT NULL REFERENCES auth.users(id),updated_by uuid NOT NULL REFERENCES auth.users(id),updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,id),FOREIGN KEY(tenant_id,company_id,location_id) REFERENCES public.ops_locations(tenant_id,company_id,id)
);
CREATE UNIQUE INDEX ops_schedule_name ON public.ops_schedules(tenant_id,company_id,location_id,lower(plan->>'title')) WHERE NOT (plan->>'archived')::boolean;
CREATE INDEX ops_schedule_company ON public.ops_schedules(tenant_id,company_id,id);
CREATE TABLE public.ops_schedule_dates(
 tenant_id uuid NOT NULL,schedule_id uuid NOT NULL,work_date date NOT NULL,request_id uuid NOT NULL,revision integer NOT NULL,
 PRIMARY KEY(tenant_id,schedule_id,work_date),UNIQUE(tenant_id,request_id),
 FOREIGN KEY(tenant_id,schedule_id) REFERENCES public.ops_schedules(tenant_id,id),
 FOREIGN KEY(tenant_id,request_id,work_date) REFERENCES public.ops_daily_requests(tenant_id,id,work_date)
);
ALTER TABLE public.ops_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ops_schedule_dates ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ops_schedules,public.ops_schedule_dates FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.ops_schedule_scope(a uuid,t uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION 'OPS_SHIFT_ISOLATION';END IF;
 IF auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM a THEN RAISE EXCEPTION 'OPS_SCOPE_CHANGED';END IF;
 PERFORM 1 FROM public.profiles WHERE id=a FOR SHARE;
 PERFORM 1 FROM public.tenant_memberships WHERE user_id=a AND tenant_id=t FOR SHARE;
 PERFORM public.talent_assert_scope(a,t);
 IF coalesce(public.current_user_role(),'') NOT IN ('yonetici','operasyon') THEN RAISE EXCEPTION 'OPS_FORBIDDEN';END IF;
END $$;
CREATE FUNCTION public.ops_schedule_validate(p jsonb) RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE d date;e date;x jsonb;w jsonb;exc jsonb;clock jsonb;prev tsrange;curr tsrange;day date;
BEGIN
 IF p IS NULL OR jsonb_typeof(p)<>'object' OR octet_length(p::text)>20000 THEN RAISE EXCEPTION 'SCHEDULE_INPUT';END IF;
 IF (SELECT count(*) FROM jsonb_object_keys(p))<>12 OR EXISTS(SELECT 1 FROM jsonb_object_keys(p) k WHERE k NOT IN('companyId','locationId','title','serviceLine','position','requiredCount','meetingNote','start','end','weekdays','clock','exceptions')) THEN RAISE EXCEPTION 'SCHEDULE_INPUT';END IF;
 FOREACH w IN ARRAY ARRAY[p->'companyId',p->'locationId',p->'title',p->'serviceLine',p->'position',p->'meetingNote',p->'start',p->'end'] LOOP
  IF jsonb_typeof(w) IS DISTINCT FROM 'string' OR w#>>'{}' ~ '[[:cntrl:]]' THEN RAISE EXCEPTION 'SCHEDULE_INPUT';END IF;
 END LOOP;
 PERFORM (p->>'companyId')::uuid,(p->>'locationId')::uuid;
 IF length(btrim(p->>'title')) NOT BETWEEN 1 AND 120 OR length(btrim(p->>'serviceLine')) NOT BETWEEN 1 AND 80 OR length(btrim(p->>'position')) NOT BETWEEN 1 AND 80 OR length(btrim(p->>'meetingNote'))>500
 OR jsonb_typeof(p->'requiredCount') IS DISTINCT FROM 'number' OR (p->>'requiredCount')!~'^[0-9]+$' OR (p->>'requiredCount')::integer NOT BETWEEN 1 AND 100
 OR (p->>'start')!~'^[0-9]{4}-[0-9]{2}-[0-9]{2}$' OR (p->>'end')!~'^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN RAISE EXCEPTION 'SCHEDULE_INPUT';END IF;
 d:=(p->>'start')::date;e:=(p->>'end')::date;
 IF d<'2000-01-01' OR e>'2100-12-31' OR e<d OR e-d>365 THEN RAISE EXCEPTION 'SCHEDULE_INPUT';END IF;
 IF jsonb_typeof(p->'weekdays') IS DISTINCT FROM 'array' OR jsonb_array_length(p->'weekdays') NOT BETWEEN 1 AND 7 OR EXISTS(SELECT 1 FROM jsonb_array_elements(p->'weekdays') z WHERE jsonb_typeof(z)<>'number' OR z::text!~'^[1-7]$') OR (SELECT count(*)<>count(DISTINCT z) FROM jsonb_array_elements(p->'weekdays') z) THEN RAISE EXCEPTION 'SCHEDULE_INPUT';END IF;
 IF jsonb_typeof(p->'exceptions') IS DISTINCT FROM 'array' OR jsonb_array_length(p->'exceptions')>31 THEN RAISE EXCEPTION 'SCHEDULE_INPUT';END IF;
 IF (SELECT count(*)<>count(DISTINCT z->>'day') FROM jsonb_array_elements(p->'exceptions') z) THEN RAISE EXCEPTION 'SCHEDULE_INPUT';END IF;
 FOR x IN SELECT value FROM jsonb_array_elements(p->'exceptions') LOOP
  IF jsonb_typeof(x)<>'object' OR (SELECT count(*) FROM jsonb_object_keys(x))<>2 OR NOT x ?& ARRAY['day','clock'] OR jsonb_typeof(x->'day') IS DISTINCT FROM 'string' OR (x->>'day')!~'^[0-9]{4}-[0-9]{2}-[0-9]{2}$' OR (x->>'day')::date NOT BETWEEN d AND e THEN RAISE EXCEPTION 'SCHEDULE_INPUT';END IF;
 END LOOP;
 FOR clock IN SELECT p->'clock' UNION ALL SELECT value->'clock' FROM jsonb_array_elements(p->'exceptions') WHERE value->'clock'<>'null'::jsonb LOOP
  IF jsonb_typeof(clock) IS DISTINCT FROM 'object' OR (SELECT count(*) FROM jsonb_object_keys(clock))<>3 OR NOT clock ?& ARRAY['startTime','endTime','nextDay'] OR jsonb_typeof(clock->'startTime') IS DISTINCT FROM 'string' OR jsonb_typeof(clock->'endTime') IS DISTINCT FROM 'string' OR jsonb_typeof(clock->'nextDay') IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'SCHEDULE_INPUT';END IF;
  PERFORM public.ops_shift_range(d,clock->>'startTime',clock->>'endTime',(clock->>'nextDay')::boolean);
 END LOOP;
 -- Validate the entire validity window, including overlap across preview month boundaries.
 FOR day IN SELECT d+n FROM generate_series(0,e-d) n LOOP
  SELECT value INTO exc FROM jsonb_array_elements(p->'exceptions') WHERE value->>'day'=day::text;
  clock:=CASE WHEN exc IS NOT NULL THEN exc->'clock' WHEN p->'weekdays' @> to_jsonb(ARRAY[extract(isodow FROM day)::integer]) THEN p->'clock' ELSE 'null'::jsonb END;
  IF clock<>'null'::jsonb THEN
   curr:=public.ops_shift_range(day,clock->>'startTime',clock->>'endTime',(clock->>'nextDay')::boolean);
   IF prev && curr THEN RAISE EXCEPTION 'SCHEDULE_OVERLAP';END IF;prev:=curr;
  END IF;
 END LOOP;
 RETURN p||jsonb_build_object('companyId',(p->>'companyId')::uuid,'locationId',(p->>'locationId')::uuid,'title',btrim(p->>'title'),'serviceLine',btrim(p->>'serviceLine'),'position',btrim(p->>'position'),'meetingNote',btrim(p->>'meetingNote'),'weekdays',(SELECT jsonb_agg(z ORDER BY z) FROM jsonb_array_elements(p->'weekdays') z),'exceptions',(SELECT coalesce(jsonb_agg(z ORDER BY z->>'day'),'[]') FROM jsonb_array_elements(p->'exceptions') z));
END $$;
CREATE FUNCTION public.ops_schedule_save(p_actor uuid,p_tenant uuid,p_command uuid,p_id uuid,p_revision integer,p_plan jsonb,p_archived boolean) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='3s' AS $$
DECLARE p jsonb;intent jsonb;cmd public.ops_commands;s public.ops_schedules;v_result jsonb;target uuid:=coalesce(p_id,p_command);
BEGIN
 PERFORM public.ops_schedule_scope(p_actor,p_tenant);p:=public.ops_schedule_validate(p_plan);
 IF p_command IS NULL OR p_revision IS NULL OR p_revision<0 OR p_archived IS NULL OR (p_id IS NULL AND (p_revision<>0 OR p_archived)) THEN RAISE EXCEPTION 'SCHEDULE_INPUT';END IF;
 intent:=jsonb_build_object('id',p_id,'revision',p_revision,'plan',p,'archived',p_archived);
 INSERT INTO public.ops_commands(tenant_id,actor_id,id,kind,payload) VALUES(p_tenant,p_actor,p_command,'schedule_save',intent) ON CONFLICT DO NOTHING;
 SELECT * INTO STRICT cmd FROM public.ops_commands WHERE tenant_id=p_tenant AND actor_id=p_actor AND id=p_command FOR UPDATE;
 IF cmd.kind<>'schedule_save' OR cmd.payload IS DISTINCT FROM intent THEN RAISE EXCEPTION 'OPS_IDEMPOTENCY_MISMATCH';END IF;
 IF cmd.result IS NOT NULL THEN RETURN cmd.result;END IF;
 PERFORM 1 FROM public.companies WHERE tenant_id=p_tenant AND id=(p->>'companyId')::uuid AND status IN('aktif','aday') FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'OPS_INACTIVE_COMPANY';END IF;
 PERFORM 1 FROM public.ops_locations WHERE tenant_id=p_tenant AND company_id=(p->>'companyId')::uuid AND id=(p->>'locationId')::uuid AND active FOR SHARE;IF NOT FOUND THEN RAISE EXCEPTION 'OPS_INACTIVE_LOCATION';END IF;
 SELECT * INTO s FROM public.ops_schedules WHERE tenant_id=p_tenant AND id=target FOR UPDATE;
 IF (s.id IS NULL AND p_revision<>0) OR (s.id IS NOT NULL AND (s.revision<>p_revision OR p_id IS NULL)) THEN RAISE EXCEPTION 'OPS_STALE_VERSION';END IF;
 IF s.id IS NOT NULL AND (s.company_id<>(p->>'companyId')::uuid OR s.location_id<>(p->>'locationId')::uuid) THEN RAISE EXCEPTION 'SCHEDULE_IDENTITY';END IF;
 IF EXISTS(SELECT 1 FROM public.ops_schedules q WHERE q.tenant_id=p_tenant AND q.company_id=(p->>'companyId')::uuid AND q.location_id=(p->>'locationId')::uuid AND q.id<>target AND NOT (q.plan->>'archived')::boolean AND lower(q.plan->>'title')=lower(p->>'title')) AND NOT p_archived THEN RAISE EXCEPTION 'SCHEDULE_NAME';END IF;
 INSERT INTO public.ops_schedules(tenant_id,id,company_id,location_id,plan,created_by,updated_by) VALUES(p_tenant,target,(p->>'companyId')::uuid,(p->>'locationId')::uuid,p||jsonb_build_object('archived',p_archived),p_actor,p_actor)
 ON CONFLICT(tenant_id,id) DO UPDATE SET plan=EXCLUDED.plan,revision=ops_schedules.revision+1,updated_by=p_actor,updated_at=now() RETURNING * INTO s;
 v_result:=jsonb_build_object('tenantId',p_tenant,'commandId',p_command,'intent',intent,'id',s.id,'revision',s.revision);
 UPDATE public.ops_commands c SET result=v_result WHERE c.tenant_id=p_tenant AND c.actor_id=p_actor AND c.id=p_command;
 RETURN v_result;
END $$;
CREATE FUNCTION public.ops_schedule_list(p_actor uuid,p_tenant uuid,p_company uuid,p_offset integer DEFAULT 0) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE rows jsonb;
BEGIN
 PERFORM public.ops_schedule_scope(p_actor,p_tenant);
 IF p_company IS NULL OR p_offset IS NULL OR p_offset<0 OR p_offset>100000 OR NOT EXISTS(SELECT 1 FROM public.companies WHERE tenant_id=p_tenant AND id=p_company) THEN RAISE EXCEPTION 'OPS_FORBIDDEN';END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',q.id,'revision',q.revision,'plan',q.plan-'archived','archived',(q.plan->>'archived')::boolean,'updatedAt',q.updated_at) ORDER BY q.id),'[]') INTO rows FROM(SELECT * FROM public.ops_schedules WHERE tenant_id=p_tenant AND company_id=p_company ORDER BY id LIMIT 26 OFFSET p_offset) q;
 RETURN jsonb_build_object('tenantId',p_tenant,'companyId',p_company,'offset',p_offset,'rows',rows);
END $$;
CREATE FUNCTION public.ops_schedule_window(t uuid,sid uuid,rev integer,first_day date,last_day date) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s public.ops_schedules;d date;exc jsonb;clock jsonb;r public.ops_daily_requests;rows jsonb:='[]';
BEGIN
 SELECT * INTO s FROM public.ops_schedules WHERE tenant_id=t AND id=sid;
 IF s.id IS NULL OR s.revision IS DISTINCT FROM rev THEN RAISE EXCEPTION 'OPS_STALE_VERSION';END IF;
 IF (s.plan->>'archived')::boolean THEN RAISE EXCEPTION 'SCHEDULE_ARCHIVED';END IF;
 IF first_day IS NULL OR last_day IS NULL OR last_day<first_day OR last_day-first_day>30 OR first_day<(s.plan->>'start')::date OR last_day>(s.plan->>'end')::date THEN RAISE EXCEPTION 'SCHEDULE_WINDOW';END IF;
 FOR d IN SELECT first_day+n FROM generate_series(0,last_day-first_day) n LOOP
  SELECT value INTO exc FROM jsonb_array_elements(s.plan->'exceptions') WHERE value->>'day'=d::text;
  clock:=CASE WHEN exc IS NOT NULL THEN exc->'clock' WHEN s.plan->'weekdays' @> to_jsonb(ARRAY[extract(isodow FROM d)::integer]) THEN s.plan->'clock' ELSE 'null'::jsonb END;
  SELECT req.* INTO r FROM public.ops_schedule_dates link JOIN public.ops_daily_requests req ON req.tenant_id=link.tenant_id AND req.id=link.request_id WHERE link.tenant_id=t AND link.schedule_id=sid AND link.work_date=d;
  IF r.id IS NOT NULL THEN
   rows:=rows||jsonb_build_array(jsonb_build_object('workDate',d,'requestId',r.id,'lifecycle',r.lifecycle,'clock',jsonb_build_object('startTime',r.shift_start,'endTime',r.shift_end,'nextDay',r.shift_next_day),'requiredCount',r.required_count,'position',r.position));
  ELSIF clock<>'null'::jsonb THEN
   rows:=rows||jsonb_build_array(jsonb_build_object('workDate',d,'requestId',NULL,'lifecycle','new','clock',clock,'requiredCount',(s.plan->>'requiredCount')::integer,'position',s.plan->>'position'));
  END IF;
 END LOOP;
 RETURN jsonb_build_object('tenantId',t,'scheduleId',sid,'revision',rev,'start',first_day,'end',last_day,'rows',rows);
END $$;
CREATE FUNCTION public.ops_schedule_preview(p_actor uuid,p_tenant uuid,p_id uuid,p_revision integer,p_start date,p_end date) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN PERFORM public.ops_schedule_scope(p_actor,p_tenant);RETURN public.ops_schedule_window(p_tenant,p_id,p_revision,p_start,p_end);END $$;
CREATE FUNCTION public.ops_schedule_generate(p_actor uuid,p_tenant uuid,p_command uuid,p_id uuid,p_revision integer,p_start date,p_end date) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='3s' AS $$
DECLARE cmd public.ops_commands;s public.ops_schedules;intent jsonb;preview jsonb;shifts jsonb;created jsonb;row jsonb;v_result jsonb;
BEGIN
 PERFORM public.ops_schedule_scope(p_actor,p_tenant);
 IF p_command IS NULL OR p_id IS NULL OR p_revision IS NULL OR p_start IS NULL OR p_end IS NULL THEN RAISE EXCEPTION 'SCHEDULE_INPUT';END IF;
 intent:=jsonb_build_object('id',p_id,'revision',p_revision,'start',p_start,'end',p_end);
 INSERT INTO public.ops_commands(tenant_id,actor_id,id,kind,payload) VALUES(p_tenant,p_actor,p_command,'schedule_generate',intent) ON CONFLICT DO NOTHING;
 SELECT * INTO STRICT cmd FROM public.ops_commands WHERE tenant_id=p_tenant AND actor_id=p_actor AND id=p_command FOR UPDATE;
 IF cmd.kind<>'schedule_generate' OR cmd.payload IS DISTINCT FROM intent THEN RAISE EXCEPTION 'OPS_IDEMPOTENCY_MISMATCH';END IF;
 IF cmd.result IS NOT NULL THEN RETURN cmd.result;END IF;
 SELECT * INTO s FROM public.ops_schedules WHERE tenant_id=p_tenant AND id=p_id;
 IF s.id IS NULL THEN RAISE EXCEPTION 'OPS_STALE_VERSION';END IF;
 -- Same order as save and existing timed batch: company before schedule.
 PERFORM 1 FROM public.companies WHERE tenant_id=p_tenant AND id=s.company_id AND status IN('aktif','aday') FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'OPS_INACTIVE_COMPANY';END IF;
 SELECT * INTO s FROM public.ops_schedules WHERE tenant_id=p_tenant AND id=p_id FOR UPDATE;
 preview:=public.ops_schedule_window(p_tenant,p_id,p_revision,p_start,p_end);
 SELECT coalesce(jsonb_agg((r->'clock')||jsonb_build_object('workDate',r->>'workDate') ORDER BY r->>'workDate'),'[]') INTO shifts FROM jsonb_array_elements(preview->'rows') r WHERE r->>'lifecycle'='new';
 IF jsonb_array_length(shifts)>0 THEN
  created:=public.ops_create_timed_requests(p_actor,p_tenant,gen_random_uuid(),(s.plan-'archived'-'title'-'start'-'end'-'weekdays'-'clock'-'exceptions')||jsonb_build_object('shifts',shifts));
  FOR row IN SELECT value FROM jsonb_array_elements(created->'rows') LOOP
   INSERT INTO public.ops_schedule_dates(tenant_id,schedule_id,work_date,request_id,revision) VALUES(p_tenant,p_id,(row->>'workDate')::date,(row->>'id')::uuid,p_revision);
  END LOOP;
 END IF;
 v_result:=jsonb_build_object('tenantId',p_tenant,'commandId',p_command,'intent',intent,'created',jsonb_array_length(shifts),'kept',jsonb_array_length(preview->'rows')-jsonb_array_length(shifts),'window',public.ops_schedule_window(p_tenant,p_id,p_revision,p_start,p_end));
 UPDATE public.ops_commands c SET result=v_result WHERE c.tenant_id=p_tenant AND c.actor_id=p_actor AND c.id=p_command;
 RETURN v_result;
END $$;
REVOKE ALL ON FUNCTION public.ops_schedule_scope(uuid,uuid),public.ops_schedule_validate(jsonb),public.ops_schedule_window(uuid,uuid,integer,date,date) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.ops_schedule_save(uuid,uuid,uuid,uuid,integer,jsonb,boolean),public.ops_schedule_list(uuid,uuid,uuid,integer),public.ops_schedule_preview(uuid,uuid,uuid,integer,date,date),public.ops_schedule_generate(uuid,uuid,uuid,uuid,integer,date,date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ops_schedule_save(uuid,uuid,uuid,uuid,integer,jsonb,boolean),public.ops_schedule_list(uuid,uuid,uuid,integer),public.ops_schedule_preview(uuid,uuid,uuid,integer,date,date),public.ops_schedule_generate(uuid,uuid,uuid,uuid,integer,date,date) TO authenticated;
COMMIT;
