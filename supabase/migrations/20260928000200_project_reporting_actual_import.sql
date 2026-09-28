-- Project reporting; deployment status is recorded in the release manifest.
BEGIN;
SET LOCAL lock_timeout='5s';
CREATE TABLE public.reporting_person_codes (
 tenant_id uuid NOT NULL,project_id uuid NOT NULL,source text NOT NULL CHECK(source ~ '^[A-Za-z0-9_-]{1,40}$'),
 code text NOT NULL CHECK(length(code) BETWEEN 1 AND 160 AND code=btrim(code) AND code !~ '[[:cntrl:]]'),person_id uuid NOT NULL,created_by uuid NOT NULL REFERENCES public.profiles(id),created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,project_id,source,code),
 FOREIGN KEY(tenant_id,project_id) REFERENCES public.reporting_projects(tenant_id,id),
 FOREIGN KEY(tenant_id,person_id) REFERENCES public.talent_people(tenant_id,id)
);
CREATE TABLE public.reporting_person_code_events (
 tenant_id uuid NOT NULL,project_id uuid NOT NULL,source text NOT NULL,code text NOT NULL,
 old_person_id uuid,new_person_id uuid NOT NULL,actor_id uuid NOT NULL REFERENCES public.profiles(id),created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(tenant_id,project_id) REFERENCES public.reporting_projects(tenant_id,id)
);
ALTER TABLE public.reporting_person_code_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.reporting_person_code_events FROM PUBLIC,anon,authenticated;
CREATE TABLE public.reporting_imports (
 tenant_id uuid NOT NULL,id uuid NOT NULL DEFAULT gen_random_uuid(),project_id uuid NOT NULL,month date NOT NULL,
 actor_id uuid NOT NULL REFERENCES public.profiles(id),command_id uuid NOT NULL,source text NOT NULL,
 rows jsonb NOT NULL,resolved jsonb NOT NULL,base_revision integer NOT NULL,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','cancelled')),
 approved_by uuid REFERENCES public.profiles(id),approved_at timestamptz,created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,id),UNIQUE(tenant_id,actor_id,command_id),
 FOREIGN KEY(tenant_id,project_id,month) REFERENCES public.reporting_periods(tenant_id,project_id,month)
);
CREATE INDEX reporting_imports_period ON public.reporting_imports(tenant_id,project_id,month,status);
CREATE TABLE public.reporting_actuals (
 tenant_id uuid NOT NULL,project_id uuid NOT NULL,month date NOT NULL,source text NOT NULL,source_id text NOT NULL,
 location_id uuid NOT NULL REFERENCES public.ops_locations(id),person_id uuid NOT NULL,day date NOT NULL,slot text NOT NULL,minutes integer NOT NULL CHECK(minutes BETWEEN 0 AND 1440),
 batch_id uuid NOT NULL,revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
 PRIMARY KEY(tenant_id,project_id,source,source_id),UNIQUE(tenant_id,project_id,location_id,person_id,day,slot),
 FOREIGN KEY(tenant_id,project_id,month) REFERENCES public.reporting_periods(tenant_id,project_id,month),
 FOREIGN KEY(tenant_id,batch_id) REFERENCES public.reporting_imports(tenant_id,id),
 FOREIGN KEY(tenant_id,person_id) REFERENCES public.talent_people(tenant_id,id),
 CHECK(day>=month AND day<(month+interval '1 month')::date)
);
-- Approved batches retain immutable source and previous values for corrections.
ALTER TABLE public.reporting_imports ADD COLUMN previous_rows jsonb;
ALTER TABLE public.reporting_person_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reporting_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reporting_actuals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.reporting_person_codes,public.reporting_imports,public.reporting_actuals FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.reporting_import_validate(p_tenant uuid,p_project uuid,p_month date,p_source text,p_rows jsonb) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE r jsonb;result jsonb:='[]';location uuid;person uuid;location_name text;person_name text;work_day date;item public.reporting_actuals;
BEGIN
 IF p_source IS NULL OR p_source !~ '^[A-Za-z0-9_-]{1,40}$' OR p_rows IS NULL OR jsonb_typeof(p_rows)<>'array' OR jsonb_array_length(p_rows) NOT BETWEEN 1 AND 1000 OR octet_length(p_rows::text)>1048576 THEN RAISE EXCEPTION 'REPORT_IMPORT_INPUT';END IF;
 FOR r IN SELECT value FROM jsonb_array_elements(p_rows) LOOP
  IF jsonb_typeof(r)<>'object' OR r-ARRAY['sourceId','locationCode','personCode','day','slotCode','minutes']<>'{}'::jsonb THEN RAISE EXCEPTION 'REPORT_IMPORT_INPUT';END IF;
  IF EXISTS(SELECT 1 FROM unnest(ARRAY['sourceId','locationCode','personCode','slotCode']) k WHERE jsonb_typeof(r->k) IS DISTINCT FROM 'string' OR length(r->>k) NOT BETWEEN 1 AND 160 OR r->>k<>btrim(r->>k) OR r->>k ~ '[[:cntrl:]]') THEN RAISE EXCEPTION 'REPORT_IMPORT_INPUT';END IF;
  IF jsonb_typeof(r->'minutes') IS DISTINCT FROM 'number' OR (r->>'minutes') !~ '^[0-9]{1,4}$' OR (r->>'minutes')::integer>1440 OR coalesce(r->>'day','') !~ '^20[0-9]{2}-[0-9]{2}-[0-9]{2}$' THEN RAISE EXCEPTION 'REPORT_IMPORT_INPUT';END IF;
  work_day:=(r->>'day')::date;
  IF work_day<p_month OR work_day>=(p_month+interval '1 month')::date THEN RAISE EXCEPTION 'REPORT_IMPORT_MONTH';END IF;
  SELECT l.id,l.name INTO location,location_name FROM public.ops_locations l JOIN public.reporting_projects p ON p.tenant_id=l.tenant_id AND p.company_id=l.company_id
   WHERE p.tenant_id=p_tenant AND p.id=p_project AND l.external_code=r->>'locationCode';
  IF location IS NULL OR NOT EXISTS(SELECT 1 FROM public.reporting_project_locations WHERE tenant_id=p_tenant AND project_id=p_project AND location_id=location AND work_day>=valid_from AND (valid_until IS NULL OR work_day<=valid_until)) THEN RAISE EXCEPTION 'REPORT_LOCATION_UNMAPPED';END IF;
  SELECT m.person_id,p.name INTO person,person_name FROM public.reporting_person_codes m JOIN public.talent_people p ON p.tenant_id=m.tenant_id AND p.id=m.person_id WHERE m.tenant_id=p_tenant AND m.project_id=p_project AND m.source=p_source AND m.code=r->>'personCode' AND to_jsonb(p)->>'merged_into_id' IS NULL;
  IF person IS NULL THEN RAISE EXCEPTION 'REPORT_PERSON_UNMAPPED';END IF;
  SELECT * INTO item FROM public.reporting_actuals WHERE tenant_id=p_tenant AND project_id=p_project AND source=p_source AND source_id=r->>'sourceId';
  IF FOUND AND (item.location_id<>location OR item.person_id<>person OR item.day<>work_day OR item.slot<>r->>'slotCode') THEN RAISE EXCEPTION 'REPORT_SOURCE_ID_CHANGED';END IF;
  IF EXISTS(SELECT 1 FROM public.reporting_actuals WHERE tenant_id=p_tenant AND project_id=p_project AND location_id=location AND person_id=person AND day=work_day AND slot=r->>'slotCode' AND (source<>p_source OR source_id<>r->>'sourceId')) THEN RAISE EXCEPTION 'REPORT_WORK_DUPLICATE';END IF;
  result:=result||jsonb_build_array(r||jsonb_build_object('locationId',location,'personId',person,'locationName',location_name,'personName',person_name,'previousMinutes',item.minutes,'status',CASE WHEN item.source_id IS NULL THEN 'new' WHEN item.minutes=(r->>'minutes')::integer THEN 'unchanged' ELSE 'changed' END));
 END LOOP;
 IF (SELECT count(DISTINCT x->>'sourceId') FROM jsonb_array_elements(result)x)<>jsonb_array_length(result)
 OR (SELECT count(DISTINCT (x->>'locationId',x->>'personId',x->>'day',x->>'slotCode')) FROM jsonb_array_elements(result)x)<>jsonb_array_length(result) THEN RAISE EXCEPTION 'REPORT_WORK_DUPLICATE';END IF;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.reporting_import_validate(uuid,uuid,date,text,jsonb) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.reporting_person_code_set(p_actor uuid,p_tenant uuid,p_project uuid,p_revision integer,p_source text,p_code text,p_person uuid) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='5s' AS $$
DECLARE item public.reporting_projects;old_person uuid;
BEGIN
 PERFORM 1 FROM public.profiles WHERE id=auth.uid() FOR SHARE;
 PERFORM 1 FROM public.tenant_memberships WHERE user_id=auth.uid() AND tenant_id=p_tenant FOR SHARE;
 PERFORM public.reporting_assert_scope(p_actor,p_tenant,true);
 SELECT * INTO item FROM public.reporting_projects WHERE tenant_id=p_tenant AND id=p_project FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'REPORT_NOT_FOUND';END IF;
 IF p_source IS NULL OR p_source !~ '^[A-Za-z0-9_-]{1,40}$' OR p_code IS NULL OR length(p_code) NOT BETWEEN 1 AND 160 OR p_code<>btrim(p_code) OR p_code ~ '[[:cntrl:]]' THEN RAISE EXCEPTION 'REPORT_IMPORT_INPUT';END IF;
 PERFORM 1 FROM public.talent_people p WHERE tenant_id=p_tenant AND id=p_person AND to_jsonb(p)->>'merged_into_id' IS NULL FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'REPORT_PERSON_UNMAPPED';END IF;
 IF EXISTS(SELECT 1 FROM public.reporting_person_codes WHERE tenant_id=p_tenant AND project_id=p_project AND source=p_source AND code=p_code AND person_id=p_person) THEN RETURN item.revision;END IF;
 IF p_revision IS DISTINCT FROM item.revision THEN RAISE EXCEPTION 'REPORT_CONFLICT';END IF;
 SELECT person_id INTO old_person FROM public.reporting_person_codes WHERE tenant_id=p_tenant AND project_id=p_project AND source=p_source AND code=p_code;
 IF old_person IS NOT NULL AND EXISTS(SELECT 1 FROM public.reporting_imports b WHERE b.tenant_id=p_tenant AND b.project_id=p_project AND b.source=p_source AND b.status IN ('pending','approved') AND EXISTS(SELECT 1 FROM jsonb_array_elements(b.rows) r WHERE r->>'personCode'=p_code)) THEN RAISE EXCEPTION 'REPORT_MAPPING_USED';END IF;
 INSERT INTO public.reporting_person_codes(tenant_id,project_id,source,code,person_id,created_by) VALUES(p_tenant,p_project,p_source,p_code,p_person,p_actor)
 ON CONFLICT(tenant_id,project_id,source,code) DO UPDATE SET person_id=excluded.person_id,created_by=excluded.created_by,created_at=now();
 INSERT INTO public.reporting_person_code_events(tenant_id,project_id,source,code,old_person_id,new_person_id,actor_id) VALUES(p_tenant,p_project,p_source,p_code,old_person,p_person,p_actor);
 UPDATE public.reporting_projects SET revision=revision+1 WHERE tenant_id=p_tenant AND id=p_project RETURNING revision INTO p_revision;
 RETURN p_revision;
END $$;
REVOKE ALL ON FUNCTION public.reporting_person_code_set(uuid,uuid,uuid,integer,text,text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.reporting_person_code_set(uuid,uuid,uuid,integer,text,text,uuid) TO authenticated;

CREATE FUNCTION public.reporting_import_prepare(p_actor uuid,p_tenant uuid,p_project uuid,p_command uuid,p_month text,p_source text,p_rows jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='5s' AS $$
DECLARE item public.reporting_projects;batch public.reporting_imports;month_day date;resolved jsonb;
BEGIN
 PERFORM 1 FROM public.profiles WHERE id=auth.uid() FOR SHARE;
 PERFORM 1 FROM public.tenant_memberships WHERE user_id=auth.uid() AND tenant_id=p_tenant FOR SHARE;
 PERFORM public.reporting_assert_scope(p_actor,p_tenant,true);
 IF p_command IS NULL OR coalesce(p_month,'') !~ '^20[0-9]{2}-(0[1-9]|1[0-2])$' THEN RAISE EXCEPTION 'REPORT_IMPORT_INPUT';END IF;
 month_day:=(p_month||'-01')::date;
 SELECT * INTO item FROM public.reporting_projects WHERE tenant_id=p_tenant AND id=p_project FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'REPORT_NOT_FOUND';END IF;
 SELECT * INTO batch FROM public.reporting_imports WHERE tenant_id=p_tenant AND actor_id=p_actor AND command_id=p_command;
 IF FOUND THEN
  IF batch.project_id<>p_project OR batch.month<>month_day OR batch.source IS DISTINCT FROM p_source OR batch.rows IS DISTINCT FROM p_rows THEN RAISE EXCEPTION 'REPORT_COMMAND_MISMATCH';END IF;
  RETURN jsonb_build_object('batchId',batch.id,'status',batch.status,'rows',batch.resolved);
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.reporting_periods WHERE tenant_id=p_tenant AND project_id=p_project AND month=month_day AND status='open') THEN RAISE EXCEPTION 'REPORT_PERIOD_CLOSED';END IF;
 resolved:=public.reporting_import_validate(p_tenant,p_project,month_day,p_source,p_rows);
 INSERT INTO public.reporting_imports(tenant_id,project_id,month,actor_id,command_id,source,rows,resolved,base_revision)
 VALUES(p_tenant,p_project,month_day,p_actor,p_command,p_source,p_rows,resolved,item.revision) RETURNING * INTO batch;
 RETURN jsonb_build_object('batchId',batch.id,'status',batch.status,'rows',batch.resolved);
END $$;
REVOKE ALL ON FUNCTION public.reporting_import_prepare(uuid,uuid,uuid,uuid,text,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.reporting_import_prepare(uuid,uuid,uuid,uuid,text,text,jsonb) TO authenticated;

CREATE FUNCTION public.reporting_import_finish(p_actor uuid,p_tenant uuid,p_batch uuid,p_approve boolean) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='5s' AS $$
DECLARE batch public.reporting_imports;item public.reporting_projects;resolved jsonb;r jsonb;previous jsonb;
BEGIN
 PERFORM 1 FROM public.profiles WHERE id=auth.uid() FOR SHARE;
 PERFORM 1 FROM public.tenant_memberships WHERE user_id=auth.uid() AND tenant_id=p_tenant FOR SHARE;
 PERFORM public.reporting_assert_scope(p_actor,p_tenant,true);
 IF p_approve IS NULL THEN RAISE EXCEPTION 'REPORT_IMPORT_INPUT';END IF;
 SELECT * INTO batch FROM public.reporting_imports WHERE tenant_id=p_tenant AND id=p_batch;
 IF NOT FOUND THEN RAISE EXCEPTION 'REPORT_NOT_FOUND';END IF;
 SELECT * INTO item FROM public.reporting_projects WHERE tenant_id=p_tenant AND id=batch.project_id FOR UPDATE;
 SELECT * INTO batch FROM public.reporting_imports WHERE tenant_id=p_tenant AND id=p_batch FOR UPDATE;
 IF batch.actor_id<>p_actor AND public.current_user_role()<>'yonetici' THEN RAISE EXCEPTION 'REPORT_FORBIDDEN';END IF;
 IF batch.status=(CASE WHEN p_approve THEN 'approved' ELSE 'cancelled' END) THEN RETURN batch.status;END IF;
 IF batch.status<>'pending' THEN RAISE EXCEPTION 'REPORT_IMPORT_STATE';END IF;
 IF NOT p_approve THEN UPDATE public.reporting_imports SET status='cancelled' WHERE tenant_id=p_tenant AND id=p_batch;RETURN 'cancelled';END IF;
 IF item.revision<>batch.base_revision THEN RAISE EXCEPTION 'REPORT_CONFLICT';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.reporting_periods WHERE tenant_id=p_tenant AND project_id=item.id AND month=batch.month AND status='open') THEN RAISE EXCEPTION 'REPORT_PERIOD_CLOSED';END IF;
 resolved:=public.reporting_import_validate(p_tenant,item.id,batch.month,batch.source,batch.rows);
 IF resolved<>batch.resolved THEN RAISE EXCEPTION 'REPORT_CONFLICT';END IF;
 SELECT coalesce(jsonb_agg(to_jsonb(a)),'[]') INTO previous FROM public.reporting_actuals a WHERE tenant_id=p_tenant AND project_id=item.id AND source=batch.source AND source_id IN (SELECT x->>'sourceId' FROM jsonb_array_elements(batch.rows)x);
 FOR r IN SELECT value FROM jsonb_array_elements(resolved) LOOP
  IF r->>'status'='unchanged' THEN CONTINUE;END IF;
  INSERT INTO public.reporting_actuals(tenant_id,project_id,month,source,source_id,location_id,person_id,day,slot,minutes,batch_id)
   VALUES(p_tenant,item.id,batch.month,batch.source,r->>'sourceId',(r->>'locationId')::uuid,(r->>'personId')::uuid,(r->>'day')::date,r->>'slotCode',(r->>'minutes')::integer,p_batch)
  ON CONFLICT(tenant_id,project_id,source,source_id) DO UPDATE SET minutes=excluded.minutes,batch_id=excluded.batch_id,revision=reporting_actuals.revision+1;
 END LOOP;
 UPDATE public.reporting_imports SET status='approved',approved_by=p_actor,approved_at=now(),previous_rows=previous WHERE tenant_id=p_tenant AND id=p_batch;
 UPDATE public.reporting_projects SET revision=revision+1 WHERE tenant_id=p_tenant AND id=item.id;
 RETURN 'approved';
END $$;
REVOKE ALL ON FUNCTION public.reporting_import_finish(uuid,uuid,uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.reporting_import_finish(uuid,uuid,uuid,boolean) TO authenticated;
CREATE FUNCTION public.reporting_period_pending_guard() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF NEW.status='closed' AND OLD.status<>'closed' AND EXISTS(SELECT 1 FROM public.reporting_imports WHERE tenant_id=NEW.tenant_id AND project_id=NEW.project_id AND month=NEW.month AND status='pending') THEN RAISE EXCEPTION 'REPORT_PENDING_IMPORT';END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.reporting_period_pending_guard() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER reporting_period_pending_guard BEFORE UPDATE ON public.reporting_periods FOR EACH ROW EXECUTE FUNCTION public.reporting_period_pending_guard();
CREATE FUNCTION public.reporting_actual_link_guard() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM public.reporting_actuals a WHERE a.tenant_id=OLD.tenant_id AND a.project_id=OLD.project_id AND a.location_id=OLD.location_id
  AND a.day>=OLD.valid_from AND (OLD.valid_until IS NULL OR a.day<=OLD.valid_until)
  AND (a.day<NEW.valid_from OR (NEW.valid_until IS NOT NULL AND a.day>NEW.valid_until))) THEN RAISE EXCEPTION 'REPORT_LINK_HAS_ACTUALS';END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.reporting_actual_link_guard() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER reporting_actual_link_guard BEFORE UPDATE ON public.reporting_project_locations FOR EACH ROW EXECUTE FUNCTION public.reporting_actual_link_guard();

CREATE FUNCTION public.reporting_import_list(p_actor uuid,p_tenant uuid,p_project uuid,p_offset integer DEFAULT 0) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE rows jsonb;total bigint;
BEGIN
 PERFORM public.reporting_assert_scope(p_actor,p_tenant,false);
 IF p_offset IS NULL OR p_offset<0 OR p_offset>1000000 OR p_offset%50<>0 THEN RAISE EXCEPTION 'REPORT_IMPORT_INPUT';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.reporting_projects WHERE tenant_id=p_tenant AND id=p_project) THEN RAISE EXCEPTION 'REPORT_NOT_FOUND';END IF;
 SELECT count(*) INTO total FROM public.reporting_imports WHERE tenant_id=p_tenant AND project_id=p_project AND (actor_id=p_actor OR public.current_user_role()='yonetici');
 SELECT coalesce(jsonb_agg(to_jsonb(q) ORDER BY q."createdAt" DESC,q.id),'[]') INTO rows FROM (
  SELECT id,month,source,status,jsonb_array_length(resolved) AS "rowCount",created_at AS "createdAt",approved_at AS "approvedAt"
  FROM public.reporting_imports WHERE tenant_id=p_tenant AND project_id=p_project AND (actor_id=p_actor OR public.current_user_role()='yonetici') ORDER BY created_at DESC,id LIMIT 50 OFFSET p_offset
 )q;
 RETURN jsonb_build_object('tenantId',p_tenant,'projectId',p_project,'offset',p_offset,'total',total,'rows',rows);
END $$;
REVOKE ALL ON FUNCTION public.reporting_import_list(uuid,uuid,uuid,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.reporting_import_list(uuid,uuid,uuid,integer) TO authenticated;
CREATE FUNCTION public.reporting_import_people(p_actor uuid,p_tenant uuid,p_project uuid,p_source text,p_codes text[],p_search text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE rev integer;mappings jsonb;candidates jsonb;
BEGIN
 PERFORM public.reporting_assert_scope(p_actor,p_tenant,true);
 IF p_codes IS NULL OR cardinality(p_codes)>1000 OR p_search IS NULL OR length(p_search)>100 OR p_source IS NULL OR p_source !~ '^[A-Za-z0-9_-]{1,40}$' THEN RAISE EXCEPTION 'REPORT_IMPORT_INPUT';END IF;
 SELECT revision INTO rev FROM public.reporting_projects WHERE tenant_id=p_tenant AND id=p_project;
 IF NOT FOUND THEN RAISE EXCEPTION 'REPORT_NOT_FOUND';END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('code',m.code,'personId',p.id,'name',p.name) ORDER BY m.code),'[]') INTO mappings FROM public.reporting_person_codes m JOIN public.talent_people p ON p.tenant_id=m.tenant_id AND p.id=m.person_id WHERE m.tenant_id=p_tenant AND m.project_id=p_project AND m.source=p_source AND m.code=ANY(p_codes);
 SELECT coalesce(jsonb_agg(to_jsonb(q) ORDER BY q.name,q.id),'[]') INTO candidates FROM (
 SELECT id,name,city FROM public.talent_people p WHERE tenant_id=p_tenant AND to_jsonb(p)->>'merged_into_id' IS NULL AND length(btrim(p_search))>=2 AND strpos(lower(name),lower(btrim(p_search)))>0 ORDER BY name,id LIMIT 20
 )q;
 RETURN jsonb_build_object('revision',rev,'mappings',mappings,'candidates',candidates);
END $$;
REVOKE ALL ON FUNCTION public.reporting_import_people(uuid,uuid,uuid,text,text[],text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.reporting_import_people(uuid,uuid,uuid,text,text[],text) TO authenticated;
CREATE FUNCTION public.reporting_import_read(p_actor uuid,p_tenant uuid,p_batch uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE b public.reporting_imports;
BEGIN
 PERFORM public.reporting_assert_scope(p_actor,p_tenant,true);
 SELECT * INTO b FROM public.reporting_imports WHERE tenant_id=p_tenant AND id=p_batch;
 IF NOT FOUND THEN RAISE EXCEPTION 'REPORT_NOT_FOUND';END IF;
 IF b.actor_id<>p_actor AND public.current_user_role()<>'yonetici' THEN RAISE EXCEPTION 'REPORT_FORBIDDEN';END IF;
 RETURN jsonb_build_object('batchId',b.id,'projectId',b.project_id,'month',to_char(b.month,'YYYY-MM'),'status',b.status,'rows',b.resolved);
END $$;
REVOKE ALL ON FUNCTION public.reporting_import_read(uuid,uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.reporting_import_read(uuid,uuid,uuid) TO authenticated;
COMMIT;
