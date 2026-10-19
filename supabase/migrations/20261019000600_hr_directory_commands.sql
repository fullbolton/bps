-- HR remains disabled by catalog readiness. These APIs require explicit HR activation.
BEGIN;
CREATE TABLE public.hr_commands (
 tenant_id uuid NOT NULL REFERENCES public.tenants(id),actor_id uuid NOT NULL REFERENCES public.profiles(id),
 command_id uuid NOT NULL,payload jsonb NOT NULL,result jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,actor_id,command_id)
);
ALTER TABLE public.hr_commands ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.hr_commands FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.hr_assert_access(p_actor uuid,p_tenant uuid) RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF p_actor IS NULL OR p_actor IS DISTINCT FROM auth.uid() OR p_tenant IS NULL OR p_tenant IS DISTINCT FROM public.current_user_verified_tenant() THEN RAISE EXCEPTION 'HR_SCOPE';END IF;
 IF coalesce(public.current_user_role(),'') NOT IN ('yonetici','ik') THEN RAISE EXCEPTION 'HR_FORBIDDEN';END IF;
 IF NOT EXISTS(SELECT FROM public.tenant_module_settings s JOIN public.tenant_module_entitlements e USING(tenant_id,module_key) WHERE s.tenant_id=p_tenant AND s.module_key='hr' AND s.enabled AND e.granted) THEN RAISE EXCEPTION 'HR_MODULE_CLOSED';END IF;
END $$;
REVOKE ALL ON FUNCTION public.hr_assert_access(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.hr_create_record_v1(p_actor uuid,p_tenant uuid,p_command uuid,p_payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE previous public.hr_commands;result jsonb;record_id uuid;person_id uuid;period_id uuid;department uuid;start_date date;kind text;
BEGIN
 PERFORM public.hr_assert_access(p_actor,p_tenant);
 -- Same config/profile order as module changes; organization writes then share the tenant lock.
 PERFORM 1 FROM public.tenant_module_config WHERE tenant_id=p_tenant FOR UPDATE;
 PERFORM 1 FROM public.profiles WHERE id=p_actor FOR SHARE;
 PERFORM 1 FROM public.tenants WHERE id=p_tenant FOR UPDATE;
 PERFORM public.hr_assert_access(p_actor,p_tenant);
 IF p_command IS NULL OR p_payload IS NULL OR jsonb_typeof(p_payload)<>'object' THEN RAISE EXCEPTION 'HR_INPUT';END IF;
 SELECT * INTO previous FROM public.hr_commands WHERE tenant_id=p_tenant AND actor_id=p_actor AND command_id=p_command;
 IF FOUND THEN
  IF previous.payload IS DISTINCT FROM p_payload THEN RAISE EXCEPTION 'HR_COMMAND_REUSED';END IF;
  RETURN previous.result;
 END IF;
 kind:=p_payload->>'kind';
 IF jsonb_typeof(p_payload->'name') IS DISTINCT FROM 'string' OR length(btrim(p_payload->>'name')) NOT BETWEEN 1 AND 160 THEN RAISE EXCEPTION 'HR_INPUT';END IF;
 record_id:=gen_random_uuid();
 IF kind='department' THEN
  IF p_payload-ARRAY['kind','name'] <> '{}'::jsonb OR length(btrim(p_payload->>'name'))>120 THEN RAISE EXCEPTION 'HR_INPUT';END IF;
  INSERT INTO public.hr_departments(id,tenant_id,name) VALUES(record_id,p_tenant,btrim(p_payload->>'name'));
 ELSIF kind='employee' THEN
  IF p_payload-ARRAY['kind','name','code','startsOn','departmentId','position'] <> '{}'::jsonb
   OR jsonb_typeof(p_payload->'code') IS DISTINCT FROM 'string' OR length(btrim(p_payload->>'code')) NOT BETWEEN 1 AND 40
   OR jsonb_typeof(p_payload->'startsOn') IS DISTINCT FROM 'string' OR (p_payload->>'startsOn') !~ '^\d{4}-\d{2}-\d{2}$'
  THEN RAISE EXCEPTION 'HR_INPUT';END IF;
  start_date:=(p_payload->>'startsOn')::date;
  IF p_payload ? 'departmentId' THEN
   IF jsonb_typeof(p_payload->'departmentId') IS DISTINCT FROM 'string' OR jsonb_typeof(p_payload->'position') IS DISTINCT FROM 'string' OR length(btrim(p_payload->>'position')) NOT BETWEEN 1 AND 120 THEN RAISE EXCEPTION 'HR_INPUT';END IF;
   department:=(p_payload->>'departmentId')::uuid;
  ELSIF p_payload ? 'position' THEN RAISE EXCEPTION 'HR_INPUT';END IF;
  person_id:=gen_random_uuid();period_id:=gen_random_uuid();
  INSERT INTO public.hr_people(id,tenant_id,name) VALUES(person_id,p_tenant,btrim(p_payload->>'name'));
  INSERT INTO public.hr_employees(id,tenant_id,person_id,code) VALUES(record_id,p_tenant,person_id,btrim(p_payload->>'code'));
  INSERT INTO public.hr_employment_periods(id,tenant_id,employee_id,starts_on) VALUES(period_id,p_tenant,record_id,start_date);
  IF department IS NOT NULL THEN
   INSERT INTO public.hr_assignments(id,tenant_id,employment_id,employee_id,department_id,position,starts_on)
   VALUES(gen_random_uuid(),p_tenant,period_id,record_id,department,btrim(p_payload->>'position'),start_date);
  END IF;
 ELSE RAISE EXCEPTION 'HR_INPUT';END IF;
 result:=jsonb_build_object('schemaVersion',1,'actorId',p_actor,'tenantId',p_tenant,'commandId',p_command,'kind',kind,'id',record_id);
 INSERT INTO public.hr_commands(tenant_id,actor_id,command_id,payload,result) VALUES(p_tenant,p_actor,p_command,p_payload,result);
 RETURN result;
END $$;
CREATE FUNCTION public.hr_directory_v1(p_actor uuid,p_tenant uuid,p_after uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE rows jsonb;departments jsonb;more boolean;today date:=(statement_timestamp() AT TIME ZONE 'Europe/Istanbul')::date;
BEGIN
 PERFORM public.hr_assert_access(p_actor,p_tenant);
 IF (SELECT count(*) FROM (SELECT id FROM public.hr_departments WHERE tenant_id=p_tenant AND closed_on IS NULL LIMIT 1001) d)>1000 THEN RAISE EXCEPTION 'HR_DEPARTMENT_LIMIT';END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',d.id,'name',d.name) ORDER BY d.name,d.id),'[]') INTO departments FROM public.hr_departments d WHERE d.tenant_id=p_tenant AND d.closed_on IS NULL;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',e.id,'code',e.code,'name',coalesce(p.name,t.name),'startsOn',period.starts_on,'endsOn',period.ends_on,'department',d.name,'position',a.position) ORDER BY e.id),'[]') INTO rows
 FROM (SELECT * FROM public.hr_employees WHERE tenant_id=p_tenant AND (p_after IS NULL OR id>p_after) ORDER BY id LIMIT 50) e
 JOIN public.hr_people p ON p.tenant_id=e.tenant_id AND p.id=e.person_id
 LEFT JOIN public.talent_people t ON t.tenant_id=p.tenant_id AND t.id=p.talent_person_id
 LEFT JOIN LATERAL (SELECT * FROM public.hr_employment_periods x WHERE x.tenant_id=e.tenant_id AND x.employee_id=e.id ORDER BY (x.starts_on<=today) DESC,x.starts_on DESC LIMIT 1) period ON true
 LEFT JOIN public.hr_assignments a ON a.tenant_id=e.tenant_id AND a.employment_id=period.id AND daterange(a.starts_on,a.ends_on,'[]') @> today
 LEFT JOIN public.hr_departments d ON d.tenant_id=a.tenant_id AND d.id=a.department_id;
 SELECT EXISTS(SELECT FROM public.hr_employees WHERE tenant_id=p_tenant AND (p_after IS NULL OR id>p_after) OFFSET 50 LIMIT 1) INTO more;
 RETURN jsonb_build_object('schemaVersion',1,'actorId',p_actor,'tenantId',p_tenant,'employees',rows,'departments',departments,'hasMore',more);
END $$;
REVOKE ALL ON FUNCTION public.hr_create_record_v1(uuid,uuid,uuid,jsonb),public.hr_directory_v1(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.hr_create_record_v1(uuid,uuid,uuid,jsonb),public.hr_directory_v1(uuid,uuid,uuid) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
