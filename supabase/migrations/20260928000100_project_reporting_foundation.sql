-- Project reporting; deployment status is recorded in the release manifest.
BEGIN;
SET LOCAL lock_timeout='5s';
CREATE TABLE public.reporting_projects (
 tenant_id uuid NOT NULL REFERENCES public.tenants(id), id uuid NOT NULL DEFAULT gen_random_uuid(),
 company_id uuid NOT NULL, code text NOT NULL CHECK(code ~ '^[A-Za-z0-9_-]{1,40}$'),
 name text NOT NULL CHECK(length(btrim(name)) BETWEEN 1 AND 160 AND name !~ '[[:cntrl:]]'),
 kind text NOT NULL CHECK(kind IN ('idp','fixed','hospitality','other')),
 revision integer NOT NULL DEFAULT 1 CHECK(revision>0), created_by uuid NOT NULL REFERENCES public.profiles(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,id), UNIQUE(tenant_id,company_id,id), UNIQUE(tenant_id,code),
 FOREIGN KEY(tenant_id,company_id) REFERENCES public.companies(tenant_id,id)
);
CREATE TABLE public.reporting_project_locations (
 tenant_id uuid NOT NULL, project_id uuid NOT NULL, company_id uuid NOT NULL, location_id uuid NOT NULL,
 valid_from date NOT NULL CHECK(valid_from BETWEEN DATE '2000-01-01' AND DATE '2099-12-31'),
 valid_until date CHECK(valid_until BETWEEN valid_from AND DATE '2099-12-31'),
 PRIMARY KEY(tenant_id,project_id,location_id,valid_from),
 FOREIGN KEY(tenant_id,company_id,project_id) REFERENCES public.reporting_projects(tenant_id,company_id,id),
 FOREIGN KEY(tenant_id,company_id,location_id) REFERENCES public.ops_locations(tenant_id,company_id,id)
);
CREATE TABLE public.reporting_periods (
 tenant_id uuid NOT NULL, project_id uuid NOT NULL, month date NOT NULL,
 status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','closed')), revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
 created_by uuid NOT NULL REFERENCES public.profiles(id),created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,project_id,month), FOREIGN KEY(tenant_id,project_id) REFERENCES public.reporting_projects(tenant_id,id),
 CHECK(month BETWEEN DATE '2000-01-01' AND DATE '2099-12-01' AND extract(day FROM month)=1)
);
CREATE TABLE public.reporting_commands (
 tenant_id uuid NOT NULL REFERENCES public.tenants(id),actor_id uuid NOT NULL REFERENCES public.profiles(id),command_id uuid NOT NULL,
 payload jsonb NOT NULL,result jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(tenant_id,actor_id,command_id)
);
CREATE TABLE public.reporting_period_events (
 tenant_id uuid NOT NULL,project_id uuid NOT NULL,month date NOT NULL,revision integer NOT NULL,
 status text NOT NULL CHECK(status IN ('open','closed')),reason text NOT NULL CHECK(length(btrim(reason)) BETWEEN 5 AND 500 AND reason !~ '[[:cntrl:]]'),
 actor_id uuid NOT NULL REFERENCES public.profiles(id),created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,project_id,month,revision),
 FOREIGN KEY(tenant_id,project_id,month) REFERENCES public.reporting_periods(tenant_id,project_id,month)
);
ALTER TABLE public.reporting_period_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.reporting_period_events FROM PUBLIC,anon,authenticated;
ALTER TABLE public.reporting_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reporting_project_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reporting_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reporting_commands ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.reporting_projects,public.reporting_project_locations,public.reporting_periods,public.reporting_commands FROM PUBLIC,anon,authenticated;
CREATE INDEX reporting_projects_customer ON public.reporting_projects(tenant_id,company_id);
CREATE INDEX reporting_locations_location ON public.reporting_project_locations(tenant_id,company_id,location_id);

CREATE FUNCTION public.reporting_assert_scope(p_actor uuid,p_tenant uuid,p_write boolean) RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL OR p_actor IS DISTINCT FROM auth.uid() OR p_tenant IS NULL OR p_tenant IS DISTINCT FROM public.current_user_verified_tenant()
 OR public.current_user_role() IS NULL THEN RAISE EXCEPTION 'REPORT_SCOPE';END IF;
 IF public.current_user_role() NOT IN ('yonetici','operasyon','ik','muhasebe') THEN RAISE EXCEPTION 'REPORT_FORBIDDEN';END IF;
 IF p_write AND public.current_user_role() NOT IN ('yonetici','operasyon') THEN RAISE EXCEPTION 'REPORT_FORBIDDEN';END IF;
END $$;
REVOKE ALL ON FUNCTION public.reporting_assert_scope(uuid,uuid,boolean) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.reporting_project_execute(p_actor uuid,p_tenant uuid,p_command uuid,p_input jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='5s' AS $$
DECLARE receipt public.reporting_commands; item public.reporting_projects; action text; result jsonb;
 pid uuid; cid uuid; lid uuid; start_day date; end_day date; month_day date; old_link public.reporting_project_locations; old_period public.reporting_periods; reason text; before_state jsonb;
BEGIN
 IF current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION 'REPORT_ISOLATION';END IF;
 PERFORM 1 FROM public.profiles WHERE id=auth.uid() FOR SHARE;
 PERFORM 1 FROM public.tenant_memberships WHERE user_id=auth.uid() AND tenant_id=p_tenant FOR SHARE;
 PERFORM public.reporting_assert_scope(p_actor,p_tenant,true);
 IF p_command IS NULL OR p_input IS NULL OR jsonb_typeof(p_input)<>'object' OR octet_length(p_input::text)>4096 THEN RAISE EXCEPTION 'REPORT_INPUT';END IF;
 -- Serializes commands per tenant, including retries with the same command ID.
 PERFORM pg_advisory_xact_lock(hashtextextended(p_tenant::text,928101));
 SELECT * INTO receipt FROM public.reporting_commands WHERE tenant_id=p_tenant AND actor_id=p_actor AND command_id=p_command;
 IF FOUND THEN
  IF receipt.payload IS DISTINCT FROM p_input THEN RAISE EXCEPTION 'REPORT_COMMAND_MISMATCH';END IF;
  RETURN receipt.result;
 END IF;
 action:=p_input->>'action';
 IF action='create' THEN
  IF p_input - ARRAY['action','companyId','code','name','kind'] <> '{}'::jsonb
   OR jsonb_typeof(p_input->'code') IS DISTINCT FROM 'string' OR coalesce(p_input->>'code','') !~ '^[A-Za-z0-9_-]{1,40}$'
   OR jsonb_typeof(p_input->'name') IS DISTINCT FROM 'string' OR length(btrim(p_input->>'name')) NOT BETWEEN 1 AND 160
   OR p_input->>'name' ~ '[[:cntrl:]]' OR coalesce(p_input->>'kind','') NOT IN ('idp','fixed','hospitality','other') THEN RAISE EXCEPTION 'REPORT_INPUT';END IF;
  cid:=(p_input->>'companyId')::uuid;
  PERFORM 1 FROM public.companies WHERE tenant_id=p_tenant AND id=cid FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'REPORT_COMPANY';END IF;
  INSERT INTO public.reporting_projects(tenant_id,company_id,code,name,kind,created_by)
   VALUES(p_tenant,cid,p_input->>'code',btrim(p_input->>'name'),p_input->>'kind',p_actor) RETURNING * INTO item;
 ELSE
  pid:=(p_input->>'projectId')::uuid;
  SELECT * INTO item FROM public.reporting_projects WHERE tenant_id=p_tenant AND id=pid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'REPORT_NOT_FOUND';END IF;
  IF jsonb_typeof(p_input->'revision') IS DISTINCT FROM 'number' OR (p_input->>'revision')::integer IS DISTINCT FROM item.revision THEN RAISE EXCEPTION 'REPORT_CONFLICT';END IF;
  IF action IN ('edit_project','edit_location','close_period','reopen_period') THEN
   reason:=btrim(p_input->>'reason');
   IF jsonb_typeof(p_input->'reason') IS DISTINCT FROM 'string' OR length(reason) NOT BETWEEN 5 AND 500 OR reason ~ '[[:cntrl:]]' THEN RAISE EXCEPTION 'REPORT_REASON';END IF;
  END IF;
  IF action='edit_project' THEN
   IF p_input - ARRAY['action','projectId','revision','name','kind','reason'] <> '{}'::jsonb
    OR jsonb_typeof(p_input->'name') IS DISTINCT FROM 'string' OR length(btrim(p_input->>'name')) NOT BETWEEN 1 AND 160
    OR p_input->>'name' ~ '[[:cntrl:]]' OR coalesce(p_input->>'kind','') NOT IN ('idp','fixed','hospitality','other') THEN RAISE EXCEPTION 'REPORT_INPUT';END IF;
   before_state:=jsonb_build_object('name',item.name,'kind',item.kind);
   UPDATE public.reporting_projects SET name=btrim(p_input->>'name'),kind=p_input->>'kind' WHERE tenant_id=p_tenant AND id=pid;
  ELSIF action IN ('link_location','edit_location') THEN
   IF p_input - ARRAY['action','projectId','revision','locationId','from','until','originalFrom','reason'] <> '{}'::jsonb
    OR coalesce(p_input->>'from','') !~ '^20[0-9]{2}-[0-9]{2}-[0-9]{2}$'
    OR NOT (p_input ? 'until') OR (p_input->'until'<>'null'::jsonb AND coalesce(p_input->>'until','') !~ '^20[0-9]{2}-[0-9]{2}-[0-9]{2}$') THEN RAISE EXCEPTION 'REPORT_INPUT';END IF;
   lid:=(p_input->>'locationId')::uuid;start_day:=(p_input->>'from')::date;end_day:=(p_input->>'until')::date;
   IF start_day NOT BETWEEN DATE '2000-01-01' AND DATE '2099-12-31' OR (end_day IS NOT NULL AND (end_day<start_day OR end_day>DATE '2099-12-31')) THEN RAISE EXCEPTION 'REPORT_INPUT';END IF;
   PERFORM 1 FROM public.ops_locations WHERE tenant_id=p_tenant AND company_id=item.company_id AND id=lid AND (active OR action='edit_location') FOR SHARE;
   IF NOT FOUND THEN RAISE EXCEPTION 'REPORT_LOCATION';END IF;
   IF action='edit_location' THEN
    IF coalesce(p_input->>'originalFrom','') !~ '^20[0-9]{2}-[0-9]{2}-[0-9]{2}$' THEN RAISE EXCEPTION 'REPORT_INPUT';END IF;
    SELECT * INTO old_link FROM public.reporting_project_locations WHERE tenant_id=p_tenant AND project_id=pid AND location_id=lid AND valid_from=(p_input->>'originalFrom')::date;
    IF NOT FOUND THEN RAISE EXCEPTION 'REPORT_LOCATION';END IF;
    before_state:=to_jsonb(old_link);
   ELSIF p_input ? 'originalFrom' OR p_input ? 'reason' THEN RAISE EXCEPTION 'REPORT_INPUT';END IF;
   IF EXISTS(SELECT 1 FROM public.reporting_periods WHERE tenant_id=p_tenant AND project_id=pid AND status='closed'
    AND (daterange(month,(month+interval '1 month')::date,'[)') && daterange(start_day,end_day,'[]')
     OR (action='edit_location' AND daterange(month,(month+interval '1 month')::date,'[)') && daterange(old_link.valid_from,old_link.valid_until,'[]')))) THEN RAISE EXCEPTION 'REPORT_PERIOD_CLOSED';END IF;
   IF EXISTS(SELECT 1 FROM public.reporting_project_locations WHERE tenant_id=p_tenant AND project_id=pid AND location_id=lid
    AND (action<>'edit_location' OR valid_from<>old_link.valid_from) AND daterange(valid_from,valid_until,'[]') && daterange(start_day,end_day,'[]')) THEN RAISE EXCEPTION 'REPORT_LOCATION_OVERLAP';END IF;
   IF action='edit_location' THEN
    UPDATE public.reporting_project_locations SET valid_from=start_day,valid_until=end_day WHERE tenant_id=p_tenant AND project_id=pid AND location_id=lid AND valid_from=old_link.valid_from;
   ELSE
    INSERT INTO public.reporting_project_locations VALUES(p_tenant,pid,item.company_id,lid,start_day,end_day);
   END IF;
  ELSIF action='open_period' THEN
   IF p_input - ARRAY['action','projectId','revision','month'] <> '{}'::jsonb OR coalesce(p_input->>'month','') !~ '^20[0-9]{2}-(0[1-9]|1[0-2])$' THEN RAISE EXCEPTION 'REPORT_INPUT';END IF;
   month_day:=((p_input->>'month')||'-01')::date;
   INSERT INTO public.reporting_periods(tenant_id,project_id,month,created_by) VALUES(p_tenant,pid,month_day,p_actor);
  ELSIF action IN ('close_period','reopen_period') THEN
   IF public.current_user_role()<>'yonetici' THEN RAISE EXCEPTION 'REPORT_FORBIDDEN';END IF;
   IF p_input - ARRAY['action','projectId','revision','month','reason'] <> '{}'::jsonb OR coalesce(p_input->>'month','') !~ '^20[0-9]{2}-(0[1-9]|1[0-2])$' THEN RAISE EXCEPTION 'REPORT_INPUT';END IF;
   month_day:=((p_input->>'month')||'-01')::date;
   SELECT * INTO old_period FROM public.reporting_periods WHERE tenant_id=p_tenant AND project_id=pid AND month=month_day FOR UPDATE;
   IF NOT FOUND THEN RAISE EXCEPTION 'REPORT_PERIOD_NOT_FOUND';END IF;
   IF old_period.status<>(CASE WHEN action='close_period' THEN 'open' ELSE 'closed' END) THEN RAISE EXCEPTION 'REPORT_PERIOD_STATE';END IF;
   before_state:=to_jsonb(old_period);
   UPDATE public.reporting_periods SET status=CASE WHEN action='close_period' THEN 'closed' ELSE 'open' END,revision=revision+1 WHERE tenant_id=p_tenant AND project_id=pid AND month=month_day;
   INSERT INTO public.reporting_period_events(tenant_id,project_id,month,revision,status,reason,actor_id)
    VALUES(p_tenant,pid,month_day,old_period.revision+1,CASE WHEN action='close_period' THEN 'closed' ELSE 'open' END,reason,p_actor);
  ELSE RAISE EXCEPTION 'REPORT_ACTION';END IF;
  UPDATE public.reporting_projects SET revision=revision+1 WHERE tenant_id=p_tenant AND id=pid RETURNING * INTO item;
 END IF;
 result:=jsonb_build_object('commandId',p_command,'projectId',item.id,'revision',item.revision,'action',action,'before',before_state);
 INSERT INTO public.reporting_commands(tenant_id,actor_id,command_id,payload,result) VALUES(p_tenant,p_actor,p_command,p_input,result);
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.reporting_project_execute(uuid,uuid,uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.reporting_project_execute(uuid,uuid,uuid,jsonb) TO authenticated;

CREATE FUNCTION public.reporting_project_list(p_actor uuid,p_tenant uuid,p_offset integer DEFAULT 0) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE total bigint; rows jsonb;
BEGIN
 PERFORM public.reporting_assert_scope(p_actor,p_tenant,false);
 IF p_offset IS NULL OR p_offset<0 OR p_offset>1000000 OR p_offset%50<>0 THEN RAISE EXCEPTION 'REPORT_INPUT';END IF;
 SELECT count(*) INTO total FROM public.reporting_projects WHERE tenant_id=p_tenant;
 SELECT coalesce(jsonb_agg(to_jsonb(q) ORDER BY q."createdAt" DESC,q.id),'[]'::jsonb) INTO rows FROM (
  SELECT p.id,p.company_id AS "companyId",c.name AS "companyName",p.code,p.name,p.kind,p.revision,p.created_at AS "createdAt",
   (SELECT max(month) FROM public.reporting_periods WHERE tenant_id=p_tenant AND project_id=p.id) AS "latestPeriod"
  FROM public.reporting_projects p JOIN public.companies c ON c.tenant_id=p.tenant_id AND c.id=p.company_id
  WHERE p.tenant_id=p_tenant ORDER BY p.created_at DESC,p.id LIMIT 50 OFFSET p_offset
 )q;
 RETURN jsonb_build_object('tenantId',p_tenant,'offset',p_offset,'total',total,'rows',rows);
END $$;
REVOKE ALL ON FUNCTION public.reporting_project_list(uuid,uuid,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.reporting_project_list(uuid,uuid,integer) TO authenticated;
CREATE FUNCTION public.reporting_project_detail(p_actor uuid,p_tenant uuid,p_project uuid,p_locations_offset integer DEFAULT 0,p_periods_offset integer DEFAULT 0) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE item public.reporting_projects; locations jsonb; periods jsonb; location_count bigint; period_count bigint;
BEGIN
 PERFORM public.reporting_assert_scope(p_actor,p_tenant,false);
 IF p_locations_offset IS NULL OR p_periods_offset IS NULL OR p_locations_offset<0 OR p_periods_offset<0
 OR p_locations_offset>1000000 OR p_periods_offset>1000000 OR p_locations_offset%50<>0 OR p_periods_offset%50<>0 THEN RAISE EXCEPTION 'REPORT_INPUT';END IF;
 SELECT * INTO item FROM public.reporting_projects WHERE tenant_id=p_tenant AND id=p_project;
 IF NOT FOUND THEN RAISE EXCEPTION 'REPORT_NOT_FOUND';END IF;
 SELECT count(*) INTO location_count FROM public.reporting_project_locations WHERE tenant_id=p_tenant AND project_id=p_project;
 SELECT count(*) INTO period_count FROM public.reporting_periods WHERE tenant_id=p_tenant AND project_id=p_project;
 SELECT coalesce(jsonb_agg(to_jsonb(q) ORDER BY q."validFrom" DESC,q."locationId"),'[]'::jsonb) INTO locations FROM (
  SELECT l.location_id AS "locationId",d.name,d.external_code AS code,l.valid_from AS "validFrom",l.valid_until AS "validUntil"
  FROM public.reporting_project_locations l JOIN public.ops_locations d ON d.tenant_id=l.tenant_id AND d.company_id=l.company_id AND d.id=l.location_id
  WHERE l.tenant_id=p_tenant AND l.project_id=p_project ORDER BY l.valid_from DESC,l.location_id LIMIT 50 OFFSET p_locations_offset
 )q;
 SELECT coalesce(jsonb_agg(to_jsonb(q) ORDER BY q.month DESC),'[]'::jsonb) INTO periods FROM (
  SELECT p.month,p.status,p.revision,(SELECT e.reason FROM public.reporting_period_events e WHERE e.tenant_id=p.tenant_id AND e.project_id=p.project_id AND e.month=p.month ORDER BY e.revision DESC LIMIT 1) AS "lastReason"
  FROM public.reporting_periods p WHERE p.tenant_id=p_tenant AND p.project_id=p_project ORDER BY p.month DESC LIMIT 50 OFFSET p_periods_offset
 )q;
 RETURN jsonb_build_object('tenantId',p_tenant,'projectId',p_project,'companyId',item.company_id,'code',item.code,'name',item.name,'kind',item.kind,'revision',item.revision,
 'locations',jsonb_build_object('offset',p_locations_offset,'total',location_count,'rows',locations),
 'periods',jsonb_build_object('offset',p_periods_offset,'total',period_count,'rows',periods));
END $$;
REVOKE ALL ON FUNCTION public.reporting_project_detail(uuid,uuid,uuid,integer,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.reporting_project_detail(uuid,uuid,uuid,integer,integer) TO authenticated;
COMMIT;
