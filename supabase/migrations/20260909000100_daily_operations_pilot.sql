-- Daily operations pilot. NOT APPLIED. Requires the measured tenant/auth baseline.
-- Additive: no old demands, accounts, grants or policies are replaced.
BEGIN;
SET LOCAL lock_timeout = '5s';
DO $$ BEGIN
  IF to_regprocedure('public.current_user_verified_tenant()') IS NULL
     OR to_regprocedure('public.current_user_role()') IS NULL THEN
    RAISE EXCEPTION 'Missing tenant/auth baseline';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS companies_daily_ops_tenant_id_key ON public.companies(tenant_id,id);
CREATE TABLE public.ops_locations (
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  company_id uuid NOT NULL, name text NOT NULL CHECK(length(btrim(name)) BETWEEN 1 AND 160),
  city text NOT NULL CHECK(length(btrim(city)) BETWEEN 1 AND 80), active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id,company_id,id), FOREIGN KEY(tenant_id,company_id) REFERENCES public.companies(tenant_id,id)
);
ALTER TABLE public.ops_locations ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.ops_workers (
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  name text NOT NULL CHECK(length(btrim(name)) BETWEEN 1 AND 160),
  code text NOT NULL CHECK(length(btrim(code)) BETWEEN 1 AND 40),
  kind text NOT NULL CHECK(kind IN ('idp','sabit')), active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(tenant_id,id), UNIQUE(tenant_id,code)
);
ALTER TABLE public.ops_workers ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.ops_daily_requests (
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES public.tenants(id), company_id uuid NOT NULL,
  location_id uuid NOT NULL, work_date date NOT NULL CHECK(work_date BETWEEN DATE '2000-01-01' AND DATE '2100-12-31'),
  service_line text NOT NULL CHECK(length(btrim(service_line)) BETWEEN 1 AND 80),
  position text NOT NULL CHECK(length(btrim(position)) BETWEEN 1 AND 80),
  required_count integer NOT NULL CHECK(required_count BETWEEN 1 AND 100),
  lifecycle text NOT NULL DEFAULT 'active' CHECK(lifecycle IN ('active','cancelled')),
  created_by uuid NOT NULL REFERENCES public.profiles(id), created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id,id,work_date),
  FOREIGN KEY(tenant_id,company_id,location_id) REFERENCES public.ops_locations(tenant_id,company_id,id)
);
ALTER TABLE public.ops_daily_requests ENABLE ROW LEVEL SECURITY;
CREATE INDEX ops_daily_requests_date ON public.ops_daily_requests(tenant_id,company_id,work_date);
CREATE TABLE public.ops_assignments (
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL, request_id uuid NOT NULL, work_date date NOT NULL,
  worker_id uuid NOT NULL, created_by uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(), removed_at timestamptz,
  FOREIGN KEY(tenant_id,request_id,work_date) REFERENCES public.ops_daily_requests(tenant_id,id,work_date),
  FOREIGN KEY(tenant_id,worker_id) REFERENCES public.ops_workers(tenant_id,id)
);
ALTER TABLE public.ops_assignments ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX ops_one_worker_per_day ON public.ops_assignments(tenant_id,worker_id,work_date) WHERE removed_at IS NULL;
CREATE INDEX ops_assignments_request ON public.ops_assignments(tenant_id,request_id) WHERE removed_at IS NULL;
CREATE TABLE public.ops_commands (
  tenant_id uuid NOT NULL REFERENCES public.tenants(id), actor_id uuid NOT NULL REFERENCES public.profiles(id),
  id uuid NOT NULL, kind text NOT NULL, payload jsonb NOT NULL, result jsonb,
  created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(tenant_id,actor_id,id)
);
ALTER TABLE public.ops_commands ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.ops_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id), actor_id uuid NOT NULL REFERENCES public.profiles(id),
  command_id uuid NOT NULL, kind text NOT NULL, entity_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ops_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.ops_locations,public.ops_workers,public.ops_daily_requests,
  public.ops_assignments,public.ops_commands,public.ops_events FROM PUBLIC,anon,authenticated;
REVOKE ALL ON SEQUENCE public.ops_events_id_seq FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.ops_locations,public.ops_workers,public.ops_daily_requests,public.ops_assignments TO authenticated;
CREATE POLICY ops_locations_read ON public.ops_locations FOR SELECT TO authenticated USING
 (tenant_id=public.current_user_verified_tenant() AND public.current_user_role() IN ('yonetici','operasyon'));
CREATE POLICY ops_workers_read ON public.ops_workers FOR SELECT TO authenticated USING
 (tenant_id=public.current_user_verified_tenant() AND public.current_user_role() IN ('yonetici','operasyon'));
CREATE POLICY ops_requests_read ON public.ops_daily_requests FOR SELECT TO authenticated USING
 (tenant_id=public.current_user_verified_tenant() AND public.current_user_role() IN ('yonetici','operasyon'));
CREATE POLICY ops_assignments_read ON public.ops_assignments FOR SELECT TO authenticated USING
 (tenant_id=public.current_user_verified_tenant() AND public.current_user_role() IN ('yonetici','operasyon'));

CREATE FUNCTION public.ops_mutate(p_command_id uuid,p_kind text,p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_actor uuid := auth.uid(); v_tenant uuid; v_role text; v_existing public.ops_commands%ROWTYPE;
  v_company uuid; v_request public.ops_daily_requests%ROWTYPE; v_id uuid; v_worker uuid;
  v_count integer; v_result jsonb; v_active boolean;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'OPS_UNAUTHENTICATED'; END IF;
  -- Same profile lock used by admin role/membership moves; checks follow the lock.
  PERFORM 1 FROM public.profiles WHERE id=v_actor FOR SHARE;
  v_tenant := public.current_user_verified_tenant(); v_role := public.current_user_role();
  IF v_tenant IS NULL OR v_role NOT IN ('yonetici','operasyon') OR v_role IS NULL THEN RAISE EXCEPTION 'OPS_FORBIDDEN'; END IF;
  IF p_command_id IS NULL OR p_kind IS NULL OR p_kind NOT IN ('location','worker','request','assign','remove','cancel')
    OR p_payload IS NULL OR jsonb_typeof(p_payload)<>'object' OR octet_length(p_payload::text)>8192 THEN RAISE EXCEPTION 'OPS_VALIDATION'; END IF;
  IF p_kind IN ('location','worker') AND v_role<>'yonetici' THEN RAISE EXCEPTION 'OPS_FORBIDDEN'; END IF;
  INSERT INTO public.ops_commands(tenant_id,actor_id,id,kind,payload)
    VALUES(v_tenant,v_actor,p_command_id,p_kind,p_payload) ON CONFLICT DO NOTHING;
  SELECT * INTO v_existing FROM public.ops_commands WHERE tenant_id=v_tenant AND actor_id=v_actor AND id=p_command_id FOR UPDATE;
  IF v_existing.kind<>p_kind OR v_existing.payload<>p_payload THEN RAISE EXCEPTION 'OPS_IDEMPOTENCY_MISMATCH'; END IF;
  IF v_existing.result IS NOT NULL THEN RETURN v_existing.result; END IF;

  IF p_kind='worker' THEN
    INSERT INTO public.ops_workers(id,tenant_id,name,code,kind)
      VALUES(p_command_id,v_tenant,btrim(p_payload->>'name'),btrim(p_payload->>'code'),p_payload->>'kind');
    v_id:=p_command_id;
  ELSE
    IF p_kind IN ('assign','remove','cancel') THEN
      SELECT company_id INTO v_company FROM public.ops_daily_requests
        WHERE id=(p_payload->>'requestId')::uuid AND tenant_id=v_tenant;
    ELSE v_company:=(p_payload->>'companyId')::uuid; END IF;
    SELECT status='aktif' INTO v_active FROM public.companies WHERE id=v_company AND tenant_id=v_tenant FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'OPS_OUT_OF_SCOPE'; END IF;
    IF v_active IS DISTINCT FROM true AND p_kind NOT IN ('remove','cancel') THEN RAISE EXCEPTION 'OPS_INACTIVE_COMPANY'; END IF;

    IF p_kind='location' THEN
      INSERT INTO public.ops_locations(id,tenant_id,company_id,name,city)
        VALUES(p_command_id,v_tenant,v_company,btrim(p_payload->>'name'),btrim(p_payload->>'city'));
      v_id:=p_command_id;
    ELSIF p_kind='request' THEN
      PERFORM 1 FROM public.ops_locations WHERE id=(p_payload->>'locationId')::uuid AND company_id=v_company AND tenant_id=v_tenant AND active FOR SHARE;
      IF NOT FOUND THEN RAISE EXCEPTION 'OPS_INACTIVE_LOCATION'; END IF;
      INSERT INTO public.ops_daily_requests(id,tenant_id,company_id,location_id,work_date,service_line,position,required_count,created_by)
        VALUES(p_command_id,v_tenant,v_company,(p_payload->>'locationId')::uuid,(p_payload->>'workDate')::date,
          btrim(p_payload->>'serviceLine'),btrim(p_payload->>'position'),(p_payload->>'requiredCount')::integer,v_actor);
      v_id:=p_command_id;
    ELSE
      SELECT * INTO v_request FROM public.ops_daily_requests WHERE id=(p_payload->>'requestId')::uuid AND tenant_id=v_tenant FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'OPS_OUT_OF_SCOPE'; END IF;
      v_id:=v_request.id;
      IF p_kind='assign' THEN
        IF v_request.lifecycle<>'active' THEN RAISE EXCEPTION 'OPS_REQUEST_NOT_ACTIVE'; END IF;
        PERFORM 1 FROM public.ops_locations WHERE id=v_request.location_id AND tenant_id=v_tenant AND active;
        IF NOT FOUND THEN RAISE EXCEPTION 'OPS_INACTIVE_LOCATION'; END IF;
        v_worker:=(p_payload->>'workerId')::uuid;
        PERFORM 1 FROM public.ops_workers WHERE id=v_worker AND tenant_id=v_tenant AND active FOR UPDATE;
        IF NOT FOUND THEN RAISE EXCEPTION 'OPS_INACTIVE_WORKER'; END IF;
        IF EXISTS(SELECT 1 FROM public.ops_assignments WHERE tenant_id=v_tenant AND worker_id=v_worker AND work_date=v_request.work_date AND removed_at IS NULL)
          THEN RAISE EXCEPTION 'OPS_WORKER_CONFLICT'; END IF;
        SELECT count(*) INTO v_count FROM public.ops_assignments WHERE tenant_id=v_tenant AND request_id=v_request.id AND removed_at IS NULL;
        IF v_count>=v_request.required_count THEN RAISE EXCEPTION 'OPS_CAPACITY_FULL'; END IF;
        INSERT INTO public.ops_assignments(id,tenant_id,request_id,work_date,worker_id,created_by)
          VALUES(p_command_id,v_tenant,v_request.id,v_request.work_date,v_worker,v_actor);
        v_id:=p_command_id;
      ELSIF p_kind='remove' THEN
        UPDATE public.ops_assignments SET removed_at=now() WHERE id=(p_payload->>'assignmentId')::uuid
          AND tenant_id=v_tenant AND request_id=v_request.id AND removed_at IS NULL;
        IF NOT FOUND THEN RAISE EXCEPTION 'OPS_STALE_VERSION'; END IF;
      ELSE
        UPDATE public.ops_assignments SET removed_at=now() WHERE request_id=v_request.id AND tenant_id=v_tenant AND removed_at IS NULL;
        UPDATE public.ops_daily_requests SET lifecycle='cancelled' WHERE id=v_request.id;
      END IF;
    END IF;
  END IF;
  v_result:=jsonb_build_object('id',v_id,'commandId',p_command_id);
  INSERT INTO public.ops_events(tenant_id,actor_id,command_id,kind,entity_id) VALUES(v_tenant,v_actor,p_command_id,p_kind,v_id);
  UPDATE public.ops_commands SET result=v_result WHERE tenant_id=v_tenant AND actor_id=v_actor AND id=p_command_id;
  RETURN v_result;
END $$;
REVOKE ALL ON FUNCTION public.ops_mutate(uuid,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ops_mutate(uuid,text,jsonb) TO authenticated;

CREATE FUNCTION public.ops_board(p_company_id uuid,p_work_date date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE v_tenant uuid:=public.current_user_verified_tenant();
BEGIN
  IF v_tenant IS NULL OR coalesce(public.current_user_role(),'') NOT IN ('yonetici','operasyon') THEN RAISE EXCEPTION 'OPS_FORBIDDEN'; END IF;
  IF p_work_date IS NULL THEN RAISE EXCEPTION 'OPS_VALIDATION'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.companies WHERE id=p_company_id AND tenant_id=v_tenant) THEN RAISE EXCEPTION 'OPS_OUT_OF_SCOPE'; END IF;
  RETURN jsonb_build_object(
    'locations',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'city',city,'active',active) ORDER BY name),'[]') FROM public.ops_locations WHERE company_id=p_company_id AND tenant_id=v_tenant),
    'workers',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',w.id,'name',w.name,'code',w.code,'active',w.active,'booked',EXISTS(SELECT 1 FROM public.ops_assignments a WHERE a.worker_id=w.id AND a.tenant_id=v_tenant AND a.work_date=p_work_date AND a.removed_at IS NULL)) ORDER BY w.name),'[]') FROM public.ops_workers w WHERE w.tenant_id=v_tenant),
    'requests',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',r.id,'locationId',r.location_id,'workDate',r.work_date,'serviceLine',r.service_line,'position',r.position,'requiredCount',r.required_count,'lifecycle',r.lifecycle,
      'assignments',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',a.id,'workerId',a.worker_id) ORDER BY a.created_at),'[]') FROM public.ops_assignments a WHERE a.request_id=r.id AND a.tenant_id=v_tenant AND a.removed_at IS NULL)) ORDER BY r.created_at),'[]') FROM public.ops_daily_requests r WHERE r.company_id=p_company_id AND r.tenant_id=v_tenant AND r.work_date=p_work_date)
  );
END $$;
REVOKE ALL ON FUNCTION public.ops_board(uuid,date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ops_board(uuid,date) TO authenticated;
COMMIT;
