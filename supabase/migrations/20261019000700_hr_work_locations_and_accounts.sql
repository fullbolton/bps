-- Company-owned offices are distinct from customer branches. No automatic linking.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL search_path=public,extensions;
CREATE TABLE public.hr_work_locations (
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES public.tenants(id),
 name text NOT NULL CHECK(length(btrim(name)) BETWEEN 1 AND 120),closed_on date CHECK(closed_on BETWEEN DATE '1900-01-01' AND DATE '2199-12-31'),
 revision bigint NOT NULL DEFAULT 1 CHECK(revision>0),UNIQUE(tenant_id,id)
);
CREATE UNIQUE INDEX hr_work_location_active_name ON public.hr_work_locations(tenant_id,lower(btrim(name))) WHERE closed_on IS NULL;
CREATE TABLE public.hr_location_assignments (
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,employee_id uuid NOT NULL,employment_id uuid NOT NULL,location_id uuid NOT NULL,
 starts_on date NOT NULL CHECK(starts_on BETWEEN DATE '1900-01-01' AND DATE '2199-12-31'),
 ends_on date CHECK(ends_on BETWEEN starts_on AND DATE '2199-12-31'),revision bigint NOT NULL DEFAULT 1 CHECK(revision>0),
 UNIQUE(tenant_id,id),
 FOREIGN KEY(tenant_id,employment_id,employee_id) REFERENCES public.hr_employment_periods(tenant_id,id,employee_id),
 FOREIGN KEY(tenant_id,location_id) REFERENCES public.hr_work_locations(tenant_id,id),
 EXCLUDE USING gist(tenant_id WITH =,employee_id WITH =,daterange(starts_on,ends_on,'[]') WITH &&)
);
CREATE INDEX hr_location_assignments_location ON public.hr_location_assignments(tenant_id,location_id);
CREATE TABLE public.hr_account_links (
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,employee_id uuid NOT NULL,account_id uuid NOT NULL REFERENCES public.profiles(id),
 membership_id uuid NOT NULL,linked_at timestamptz NOT NULL DEFAULT statement_timestamp(),unlinked_at timestamptz,
 revision bigint NOT NULL DEFAULT 1 CHECK(revision>0),UNIQUE(tenant_id,id),
 FOREIGN KEY(tenant_id,employee_id) REFERENCES public.hr_employees(tenant_id,id),
 CHECK(unlinked_at IS NULL OR unlinked_at>=linked_at)
);
CREATE UNIQUE INDEX hr_account_link_employee ON public.hr_account_links(tenant_id,employee_id) WHERE unlinked_at IS NULL;
CREATE UNIQUE INDEX hr_account_link_account ON public.hr_account_links(tenant_id,account_id) WHERE unlinked_at IS NULL;
CREATE FUNCTION public.hr_workplace_guard() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 PERFORM 1 FROM public.tenants WHERE id=coalesce(NEW.tenant_id,OLD.tenant_id) FOR UPDATE;
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'HR_HISTORY_DELETE_FORBIDDEN';END IF;
 IF TG_OP='UPDATE' AND (NEW.id<>OLD.id OR NEW.tenant_id<>OLD.tenant_id OR NEW.revision<>OLD.revision+1) THEN RAISE EXCEPTION 'HR_REVISION_OR_IDENTITY';END IF;
 IF TG_TABLE_NAME='hr_location_assignments' THEN
  IF TG_OP='UPDATE' AND (NEW.employee_id<>OLD.employee_id OR NEW.employment_id<>OLD.employment_id OR NEW.location_id<>OLD.location_id OR NEW.starts_on<>OLD.starts_on) THEN RAISE EXCEPTION 'HR_IDENTITY_IMMUTABLE';END IF;
  IF NEW.ends_on<NEW.starts_on THEN RAISE EXCEPTION 'HR_DATE_RANGE';END IF;
  IF NOT EXISTS(SELECT FROM public.hr_employment_periods p WHERE p.tenant_id=NEW.tenant_id AND p.id=NEW.employment_id AND p.employee_id=NEW.employee_id AND daterange(p.starts_on,p.ends_on,'[]') @> daterange(NEW.starts_on,NEW.ends_on,'[]')) THEN RAISE EXCEPTION 'HR_ASSIGNMENT_OUTSIDE_EMPLOYMENT';END IF;
  IF NOT EXISTS(SELECT FROM public.hr_work_locations l WHERE l.tenant_id=NEW.tenant_id AND l.id=NEW.location_id AND (l.closed_on IS NULL OR NEW.ends_on<=l.closed_on)) THEN RAISE EXCEPTION 'HR_LOCATION_CLOSED';END IF;
 ELSIF TG_TABLE_NAME='hr_work_locations' THEN
  IF NEW.closed_on IS NOT NULL AND EXISTS(SELECT FROM public.hr_location_assignments a WHERE a.tenant_id=NEW.tenant_id AND a.location_id=NEW.id AND (a.ends_on IS NULL OR a.ends_on>NEW.closed_on)) THEN RAISE EXCEPTION 'HR_LOCATION_HAS_ASSIGNMENTS';END IF;
 ELSIF TG_TABLE_NAME='hr_account_links' THEN
  IF TG_OP='INSERT' THEN
   SELECT m.id INTO NEW.membership_id FROM public.tenant_memberships m WHERE m.tenant_id=NEW.tenant_id AND m.user_id=NEW.account_id FOR SHARE;
   IF NOT FOUND THEN RAISE EXCEPTION 'HR_ACCOUNT_NOT_MEMBER';END IF;
  END IF;
  IF TG_OP='UPDATE' AND (NEW.employee_id<>OLD.employee_id OR NEW.account_id<>OLD.account_id OR NEW.linked_at<>OLD.linked_at OR NEW.membership_id<>OLD.membership_id OR OLD.unlinked_at IS NOT NULL OR NEW.unlinked_at IS NULL) THEN RAISE EXCEPTION 'HR_IDENTITY_IMMUTABLE';END IF;
 END IF;
 RETURN NEW;
END $$;
-- Preserve location history if an employment period is shortened by existing/future commands.
CREATE FUNCTION public.hr_period_location_guard() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 PERFORM 1 FROM public.tenants WHERE id=NEW.tenant_id FOR UPDATE;
 IF NEW.ends_on<NEW.starts_on THEN RAISE EXCEPTION 'HR_DATE_RANGE';END IF;
 IF EXISTS(SELECT FROM public.hr_location_assignments a WHERE a.tenant_id=NEW.tenant_id AND a.employment_id=NEW.id AND NOT daterange(NEW.starts_on,NEW.ends_on,'[]') @> daterange(a.starts_on,a.ends_on,'[]')) THEN RAISE EXCEPTION 'HR_PERIOD_HAS_LOCATIONS';END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER hr_period_location_guard BEFORE UPDATE ON public.hr_employment_periods FOR EACH ROW EXECUTE FUNCTION public.hr_period_location_guard();
ALTER TABLE public.hr_work_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_location_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_account_links ENABLE ROW LEVEL SECURITY;

DO $$ DECLARE t text;BEGIN
 FOREACH t IN ARRAY ARRAY['hr_work_locations','hr_location_assignments','hr_account_links'] LOOP
  -- RLS is enabled explicitly above for static auditability.
  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated,service_role',t);
  EXECUTE format('CREATE TRIGGER hr_workplace_guard BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.hr_workplace_guard()',t);
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.hr_workplace_guard(),public.hr_period_location_guard() FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.hr_workplace_command_v1(p_actor uuid,p_tenant uuid,p_command uuid,p_payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='5s' AS $$
DECLARE previous public.hr_commands; result jsonb;record_id uuid;kind text; expected bigint; changed bigint;
BEGIN
 IF current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION 'HR_ISOLATION_UNSUPPORTED';END IF;
 PERFORM public.hr_assert_access(p_actor,p_tenant);
 PERFORM 1 FROM public.tenant_module_config WHERE tenant_id=p_tenant FOR UPDATE;
 PERFORM 1 FROM public.profiles WHERE id=p_actor FOR SHARE;
 PERFORM 1 FROM public.tenants WHERE id=p_tenant FOR UPDATE;
 PERFORM public.hr_assert_access(p_actor,p_tenant);
 IF p_command IS NULL OR p_payload IS NULL OR jsonb_typeof(p_payload)<>'object' THEN RAISE EXCEPTION 'HR_INPUT';END IF;
 kind:=p_payload->>'kind';
 -- Account linking affects the meaning of self access; HR role alone cannot grant it.
 IF kind IN ('link_account','unlink_account') AND public.current_user_role()<>'yonetici' THEN RAISE EXCEPTION 'HR_ACCOUNT_ADMIN_REQUIRED';END IF;
 SELECT * INTO previous FROM public.hr_commands WHERE tenant_id=p_tenant AND actor_id=p_actor AND command_id=p_command;
 IF FOUND THEN
  IF previous.payload IS DISTINCT FROM p_payload THEN RAISE EXCEPTION 'HR_COMMAND_REUSED';END IF;
  RETURN previous.result;
 END IF;
 record_id:=gen_random_uuid();changed:=1;
 IF kind='create_location' THEN
  IF p_payload-ARRAY['kind','name']<>'{}' OR jsonb_typeof(p_payload->'name') IS DISTINCT FROM 'string' OR length(btrim(p_payload->>'name')) NOT BETWEEN 1 AND 120 THEN RAISE EXCEPTION 'HR_INPUT';END IF;
  INSERT INTO public.hr_work_locations(id,tenant_id,name) VALUES(record_id,p_tenant,btrim(p_payload->>'name'));
 ELSIF kind='assign_location' THEN
  IF p_payload-ARRAY['kind','employeeId','employmentId','locationId','startsOn','endsOn']<>'{}' OR NOT p_payload ?& ARRAY['employeeId','employmentId','locationId','startsOn'] THEN RAISE EXCEPTION 'HR_INPUT';END IF;
  IF (p_payload->>'startsOn') !~ '^\d{4}-\d{2}-\d{2}$' OR (p_payload ? 'endsOn' AND (jsonb_typeof(p_payload->'endsOn') IS DISTINCT FROM 'string' OR (p_payload->>'endsOn') !~ '^\d{4}-\d{2}-\d{2}$')) THEN RAISE EXCEPTION 'HR_INPUT';END IF;
  INSERT INTO public.hr_location_assignments(id,tenant_id,employee_id,employment_id,location_id,starts_on,ends_on)
  VALUES(record_id,p_tenant,(p_payload->>'employeeId')::uuid,(p_payload->>'employmentId')::uuid,(p_payload->>'locationId')::uuid,(p_payload->>'startsOn')::date,(p_payload->>'endsOn')::date);
 ELSIF kind='link_account' THEN
  IF p_payload-ARRAY['kind','employeeId','accountId']<>'{}' OR NOT p_payload ?& ARRAY['employeeId','accountId'] THEN RAISE EXCEPTION 'HR_INPUT';END IF;
  -- Membership lock prevents a concurrent deletion during link creation.
  PERFORM 1 FROM public.tenant_memberships WHERE tenant_id=p_tenant AND user_id=(p_payload->>'accountId')::uuid FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'HR_ACCOUNT_NOT_MEMBER';END IF;
  INSERT INTO public.hr_account_links(id,tenant_id,employee_id,account_id) VALUES(record_id,p_tenant,(p_payload->>'employeeId')::uuid,(p_payload->>'accountId')::uuid);
 ELSIF kind IN ('unlink_account','end_location','close_location') THEN
  IF p_payload-ARRAY['kind','id','expectedRevision','endsOn']<>'{}' OR jsonb_typeof(p_payload->'expectedRevision') IS DISTINCT FROM 'number' OR (p_payload->>'expectedRevision') !~ '^[1-9][0-9]*$' THEN RAISE EXCEPTION 'HR_INPUT';END IF;
  record_id:=(p_payload->>'id')::uuid;expected:=(p_payload->>'expectedRevision')::bigint;
  IF kind='unlink_account' THEN
   IF p_payload ? 'endsOn' THEN RAISE EXCEPTION 'HR_INPUT';END IF;
   UPDATE public.hr_account_links SET unlinked_at=statement_timestamp(),revision=revision+1 WHERE tenant_id=p_tenant AND id=record_id AND revision=expected AND unlinked_at IS NULL RETURNING revision INTO changed;
  ELSE
   IF jsonb_typeof(p_payload->'endsOn') IS DISTINCT FROM 'string' OR (p_payload->>'endsOn') !~ '^\d{4}-\d{2}-\d{2}$' THEN RAISE EXCEPTION 'HR_INPUT';END IF;
   IF kind='end_location' THEN
    UPDATE public.hr_location_assignments SET ends_on=(p_payload->>'endsOn')::date,revision=revision+1 WHERE tenant_id=p_tenant AND id=record_id AND revision=expected AND ends_on IS NULL RETURNING revision INTO changed;
   ELSE
    UPDATE public.hr_work_locations SET closed_on=(p_payload->>'endsOn')::date,revision=revision+1 WHERE tenant_id=p_tenant AND id=record_id AND revision=expected AND closed_on IS NULL RETURNING revision INTO changed;
   END IF;
  END IF;
  IF NOT FOUND THEN RAISE EXCEPTION 'HR_STALE_OR_MISSING';END IF;
 ELSE RAISE EXCEPTION 'HR_INPUT';END IF;
 result:=jsonb_build_object('schemaVersion',1,'actorId',p_actor,'tenantId',p_tenant,'commandId',p_command,'kind',kind,'id',record_id,'revision',changed);
 INSERT INTO public.hr_commands(tenant_id,actor_id,command_id,payload,result) VALUES(p_tenant,p_actor,p_command,p_payload,result);
 RETURN result;
END $$;
-- Internal helper only. A stale historical link never grants self access after membership removal.
CREATE FUNCTION public.hr_employee_account_v1(p_tenant uuid,p_employee uuid) RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT l.account_id FROM public.hr_account_links l JOIN public.tenant_memberships m ON m.tenant_id=l.tenant_id AND m.user_id=l.account_id AND m.id=l.membership_id
 WHERE l.tenant_id=p_tenant AND l.employee_id=p_employee AND l.unlinked_at IS NULL
$$;
REVOKE ALL ON FUNCTION public.hr_employee_account_v1(uuid,uuid),public.hr_workplace_command_v1(uuid,uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.hr_workplace_command_v1(uuid,uuid,uuid,jsonb) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
