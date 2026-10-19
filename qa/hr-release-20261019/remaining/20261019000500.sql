BEGIN; SET LOCAL statement_timeout='60s'; SET LOCAL lock_timeout='5s';
LOCK TABLE supabase_migrations.schema_migrations IN EXCLUSIVE MODE;
DO $guard$ BEGIN
IF (SELECT array_agg(version ORDER BY version) FROM supabase_migrations.schema_migrations) IS DISTINCT FROM ARRAY['20260407000000','20260407000100','20260407000200','20260407000300','20260407000400','20260407000500','20260407000600','20260407000700','20260407000800','20260407000900','20260407001000','20260407001100','20260407001600','20260407001700','20260407001800','20260413000100','20260414000100','20260414000200','20260415000100','20260415000200','20260415000300','20260415000400','20260415000500','20260423000100','20260425000100','20260425000200','20260713000100','20260713000200','20260722000100','20260810000100','20260810000200','20260827000100','20260827000200','20260827000300','20260827000400','20260904000100','20260904000200','20260909000100','20260909000200','20260909000300','20260909000400','20260909000500','20260909000600','20260909000700','20260909000800','20260909000900','20260909001000','20260909001100','20260909001200','20260909001300','20260909001400','20260909001500','20260909001600','20260909001700','20260909001800','20260909001900','20260909002000','20260909002100','20260909002200','20260909002300','20260909002400','20260909002500','20260909002600','20260909002700','20260909002800','20260909002900','20260910000100','20260910000200','20260910000300','20260910000400','20260911000100','20260913000100','20260914000100','20260914000200','20260914000300','20260914000400','20260914000500','20260914000600','20260914000700','20260915000100','20260915000200','20260915000300','20260915000400','20260915000500','20260915000600','20260915000700','20260915000800','20260915000900','20260915001000','20260923000100','20260923000200','20260923000300','20260923000400','20260924000100','20260924000200','20260924000300','20260924000400','20260924000500','20260925000100','20260925000200','20260925000300','20260925000400','20260925000500','20260925000600','20260925000700','20260926000100','20260926000200','20260927000100','20260927000200','20260927000300','20260927000400','20260927000500','20260927000600','20260927000700','20260927000800','20260927000900','20260928000100','20260928000200','20260928000300','20260928000400','20260928000500','20260928000600','20260928000700','20260928000800','20261004001000','20261004001100','20261004001200','20261004001300','20261004001400','20261005000100','20261005000200','20261005000300','20261005000400','20261005000500','20261005000600','20261005000700','20261005000800','20261005000900','20261005001000','20261005001100','20261005001200','20261005001300','20261005001400','20261005001500','20261005001600','20261005001700','20261005001800','20261005001900','20261005002000','20261005002100','20261005002200','20261005002300','20261005002400','20261005002500','20261005002600','20261005002700','20261005002800','20261005002900','20261005003000','20261005003100','20261013000100','20261013000200','20261013000300','20261015000100','20261015000200','20261015000300','20261015000400','20261015000500','20261015000600','20261015000700','20261015000800','20261016000100','20261016000200','20261016000300','20261016000400','20261016000500','20261016000600','20261016000700','20261016000800','20261016000900','20261016001000','20261016001100','20261017000100','20261017000200','20261018000100','20261018000200','20261018000300','20261018000400','20261018000500','20261018000600','20261019000100','20261019000200','20261019000300','20261019000400']::text[] THEN RAISE EXCEPTION 'LIVE_LEDGER_CHANGED'; END IF;
IF to_regnamespace('bps_release_guard') IS NOT NULL THEN RAISE EXCEPTION 'RELEASE_BARRIER_PRESENT'; END IF;
END $guard$;
-- Private HR foundation. No client writer or HR activation is released here.

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

INSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES('20261019000500','hr_organization_foundation',ARRAY[$bps_source$-- Private HR foundation. No client writer or HR activation is released here.
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
$bps_source$]);
COMMIT;
