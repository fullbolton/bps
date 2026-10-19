-- Private HR foundation. No client writer or HR activation is released here.
BEGIN;
SET LOCAL lock_timeout='5s';
CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA extensions;
SET LOCAL search_path=public,extensions;
CREATE TABLE public.hr_people (
 id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES public.tenants(id),
 talent_person_id uuid, name text,
 revision bigint NOT NULL DEFAULT 1 CHECK(revision>0),
 UNIQUE(tenant_id,id), UNIQUE(tenant_id,talent_person_id),
 FOREIGN KEY(tenant_id,talent_person_id) REFERENCES public.talent_people(tenant_id,id),
 CHECK((talent_person_id IS NULL AND name IS NOT NULL AND length(btrim(name)) BETWEEN 1 AND 160)
 OR (talent_person_id IS NOT NULL AND name IS NULL))
);
COMMENT ON TABLE public.hr_people IS 'Identity bridge: linked names read from talent_people; HR-only identities have no candidate/worker row. No bulk backfill.';
CREATE TABLE public.hr_departments (
 id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES public.tenants(id),
 name text NOT NULL CHECK(length(btrim(name)) BETWEEN 1 AND 120),
 closed_on date, revision bigint NOT NULL DEFAULT 1 CHECK(revision>0),
 UNIQUE(tenant_id,id)
);
CREATE UNIQUE INDEX hr_department_active_name ON public.hr_departments(tenant_id,lower(btrim(name))) WHERE closed_on IS NULL;
CREATE TABLE public.hr_employees (
 id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES public.tenants(id),person_id uuid NOT NULL,
 code text NOT NULL CHECK(length(btrim(code)) BETWEEN 1 AND 40 AND code=btrim(code)),
 revision bigint NOT NULL DEFAULT 1 CHECK(revision>0),
 UNIQUE(tenant_id,id), UNIQUE(tenant_id,person_id),
 FOREIGN KEY(tenant_id,person_id) REFERENCES public.hr_people(tenant_id,id)
);
CREATE UNIQUE INDEX hr_employee_code ON public.hr_employees(tenant_id,lower(code));
CREATE TABLE public.hr_employment_periods (
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,employee_id uuid NOT NULL,
 starts_on date NOT NULL CHECK(starts_on BETWEEN DATE '1900-01-01' AND DATE '2199-12-31'),
 ends_on date CHECK(ends_on BETWEEN starts_on AND DATE '2199-12-31'),
 revision bigint NOT NULL DEFAULT 1 CHECK(revision>0),
 UNIQUE(tenant_id,id), UNIQUE(tenant_id,id,employee_id),
 FOREIGN KEY(tenant_id,employee_id) REFERENCES public.hr_employees(tenant_id,id),
 EXCLUDE USING gist(tenant_id WITH =,employee_id WITH =,daterange(starts_on,ends_on,'[]') WITH &&)
);
CREATE TABLE public.hr_assignments (
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,employment_id uuid NOT NULL,employee_id uuid NOT NULL,
 department_id uuid NOT NULL,position text NOT NULL CHECK(length(btrim(position)) BETWEEN 1 AND 120),
 manager_employment_id uuid,
 starts_on date NOT NULL CHECK(starts_on BETWEEN DATE '1900-01-01' AND DATE '2199-12-31'),
 ends_on date CHECK(ends_on BETWEEN starts_on AND DATE '2199-12-31'),
 revision bigint NOT NULL DEFAULT 1 CHECK(revision>0),
 UNIQUE(tenant_id,id),
 FOREIGN KEY(tenant_id,employment_id,employee_id) REFERENCES public.hr_employment_periods(tenant_id,id,employee_id),
 FOREIGN KEY(tenant_id,manager_employment_id) REFERENCES public.hr_employment_periods(tenant_id,id),
 FOREIGN KEY(tenant_id,department_id) REFERENCES public.hr_departments(tenant_id,id),
 CHECK(manager_employment_id IS DISTINCT FROM employment_id),
 EXCLUDE USING gist(tenant_id WITH =,employee_id WITH =,daterange(starts_on,ends_on,'[]') WITH &&)
);
CREATE INDEX hr_assignments_manager ON public.hr_assignments(tenant_id,manager_employment_id);
CREATE INDEX hr_assignments_department ON public.hr_assignments(tenant_id,department_id);
-- Lock a company before changing any organization row. Future writers must take this
-- same lock before reading revisions; triggers also serialize direct maintenance writes.
CREATE FUNCTION public.hr_organization_guard() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE company uuid; span daterange; manager_employee uuid; linked_merge uuid;
BEGIN
 company:=coalesce(NEW.tenant_id,OLD.tenant_id);
 IF TG_OP='UPDATE' AND (NEW.tenant_id<>OLD.tenant_id OR NEW.id<>OLD.id) THEN RAISE EXCEPTION 'HR_IDENTITY_IMMUTABLE';END IF;
 PERFORM 1 FROM public.tenants WHERE id=company FOR UPDATE;
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'HR_HISTORY_DELETE_FORBIDDEN';END IF;
 IF TG_TABLE_NAME IN ('hr_assignments','hr_employment_periods') THEN
  IF NEW.ends_on<NEW.starts_on THEN RAISE EXCEPTION 'HR_DATE_RANGE';END IF;
 END IF;
 IF TG_TABLE_NAME='hr_people' THEN
  IF TG_OP='UPDATE' AND NEW.talent_person_id IS DISTINCT FROM OLD.talent_person_id THEN RAISE EXCEPTION 'HR_IDENTITY_IMMUTABLE';END IF;
  IF NEW.talent_person_id IS NOT NULL THEN
   SELECT merged_into_id INTO linked_merge FROM public.talent_people WHERE tenant_id=company AND id=NEW.talent_person_id FOR UPDATE;
   IF NOT FOUND OR linked_merge IS NOT NULL THEN RAISE EXCEPTION 'HR_PERSON_LINK_INVALID';END IF;
  END IF;
 ELSIF TG_TABLE_NAME='hr_employees' THEN
  IF TG_OP='UPDATE' AND NEW.person_id<>OLD.person_id THEN RAISE EXCEPTION 'HR_IDENTITY_IMMUTABLE';END IF;
 ELSIF TG_TABLE_NAME='hr_assignments' THEN
  IF TG_OP='UPDATE' AND (NEW.employment_id<>OLD.employment_id OR NEW.employee_id<>OLD.employee_id) THEN RAISE EXCEPTION 'HR_IDENTITY_IMMUTABLE';END IF;
  span:=daterange(NEW.starts_on,NEW.ends_on,'[]');
  IF NOT EXISTS(SELECT FROM public.hr_employment_periods p WHERE p.tenant_id=company AND p.id=NEW.employment_id AND daterange(p.starts_on,p.ends_on,'[]') @> span) THEN RAISE EXCEPTION 'HR_ASSIGNMENT_OUTSIDE_EMPLOYMENT';END IF;
  IF NOT EXISTS(SELECT FROM public.hr_departments d WHERE d.tenant_id=company AND d.id=NEW.department_id AND (d.closed_on IS NULL OR (NEW.ends_on IS NOT NULL AND NEW.ends_on<=d.closed_on))) THEN RAISE EXCEPTION 'HR_DEPARTMENT_CLOSED';END IF;
  IF NEW.manager_employment_id IS NOT NULL THEN
   SELECT p.employee_id INTO manager_employee FROM public.hr_employment_periods p WHERE p.tenant_id=company AND p.id=NEW.manager_employment_id AND daterange(p.starts_on,p.ends_on,'[]') @> span;
   IF manager_employee IS NULL THEN RAISE EXCEPTION 'HR_MANAGER_OUTSIDE_EMPLOYMENT';END IF;
   IF manager_employee=NEW.employee_id THEN RAISE EXCEPTION 'HR_MANAGER_CYCLE';END IF;
   IF EXISTS(WITH RECURSIVE chain(employee_id,period,path) AS (
    SELECT manager_employee,span,ARRAY[NEW.employee_id,manager_employee]
    UNION ALL
    SELECT p.employee_id,c.period*daterange(a.starts_on,a.ends_on,'[]'),c.path||p.employee_id
    FROM chain c JOIN public.hr_assignments a ON a.tenant_id=company AND a.employee_id=c.employee_id AND a.id<>NEW.id
    JOIN public.hr_employment_periods p ON p.tenant_id=company AND p.id=a.manager_employment_id
    WHERE c.period && daterange(a.starts_on,a.ends_on,'[]') AND NOT c.employee_id=NEW.employee_id AND cardinality(c.path)<=100
   ) SELECT FROM chain WHERE employee_id=NEW.employee_id OR cardinality(path)>100) THEN RAISE EXCEPTION 'HR_MANAGER_CYCLE';END IF;
  END IF;
 ELSIF TG_TABLE_NAME='hr_employment_periods' THEN
  IF TG_OP='UPDATE' AND NEW.employee_id<>OLD.employee_id THEN RAISE EXCEPTION 'HR_IDENTITY_IMMUTABLE';END IF;
  IF EXISTS(SELECT FROM public.hr_assignments a WHERE a.tenant_id=company AND (a.employment_id=NEW.id OR a.manager_employment_id=NEW.id) AND NOT daterange(NEW.starts_on,NEW.ends_on,'[]') @> daterange(a.starts_on,a.ends_on,'[]')) THEN RAISE EXCEPTION 'HR_PERIOD_HAS_ASSIGNMENTS';END IF;
 ELSIF TG_TABLE_NAME='hr_departments' THEN
  IF NEW.closed_on IS NOT NULL AND EXISTS(SELECT FROM public.hr_assignments a WHERE a.tenant_id=company AND a.department_id=NEW.id AND (a.ends_on IS NULL OR a.ends_on>NEW.closed_on)) THEN RAISE EXCEPTION 'HR_DEPARTMENT_HAS_ASSIGNMENTS';END IF;
 END IF;
 RETURN NEW;
END $$;
ALTER TABLE public.hr_people ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_employment_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_assignments ENABLE ROW LEVEL SECURITY;

DO $$ DECLARE t text;BEGIN
 FOREACH t IN ARRAY ARRAY['hr_people','hr_departments','hr_employees','hr_employment_periods','hr_assignments'] LOOP
 -- RLS is enabled explicitly above for static auditability.
 EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated,service_role',t);
 EXECUTE format('CREATE TRIGGER hr_organization_guard BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.hr_organization_guard()',t);
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.hr_organization_guard() FROM PUBLIC,anon,authenticated,service_role;
-- A linked identity cannot be silently merged until the HR-aware merge command exists.
CREATE FUNCTION public.hr_linked_talent_merge_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.merged_into_id IS DISTINCT FROM OLD.merged_into_id AND EXISTS(SELECT FROM public.hr_people WHERE tenant_id=OLD.tenant_id AND talent_person_id=OLD.id) THEN RAISE EXCEPTION 'HR_LINKED_PERSON_MERGE_REQUIRED';END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.hr_linked_talent_merge_guard() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER hr_linked_talent_merge_guard BEFORE UPDATE OF merged_into_id ON public.talent_people FOR EACH ROW EXECUTE FUNCTION public.hr_linked_talent_merge_guard();
COMMIT;
