-- Resolve reporting identities without rewriting approved source records.
BEGIN;
SET LOCAL lock_timeout='15s';
DO $patch$
DECLARE r record;target regprocedure;original text;definition text;
BEGIN
 IF to_regprocedure('public.talent_canonical_person(uuid,uuid)') IS NULL THEN RAISE EXCEPTION 'REPORT_CANONICAL_MISSING';END IF;
 FOR r IN SELECT * FROM (VALUES
('public.reporting_import_validate(uuid,uuid,date,text,jsonb)','5e5d2746a9e61e72ece3e78d3a1974ffbdce2c1872058ae35b882582bea7c9ad','
DECLARE r jsonb;result jsonb:=''[]'';location uuid;person uuid;location_name text;person_name text;work_day date;item public.reporting_actuals;
BEGIN
 IF p_source IS NULL OR p_source !~ ''^[A-Za-z0-9_-]{1,40}$'' OR p_rows IS NULL OR jsonb_typeof(p_rows)<>''array'' OR jsonb_array_length(p_rows) NOT BETWEEN 1 AND 1000 OR octet_length(p_rows::text)>1048576 THEN RAISE EXCEPTION ''REPORT_IMPORT_INPUT'';END IF;
 FOR r IN SELECT value FROM jsonb_array_elements(p_rows) LOOP
  IF jsonb_typeof(r)<>''object'' OR r-ARRAY[''sourceId'',''locationCode'',''personCode'',''day'',''slotCode'',''minutes'']<>''{}''::jsonb THEN RAISE EXCEPTION ''REPORT_IMPORT_INPUT'';END IF;
  IF EXISTS(SELECT 1 FROM unnest(ARRAY[''sourceId'',''locationCode'',''personCode'',''slotCode'']) k WHERE jsonb_typeof(r->k) IS DISTINCT FROM ''string'' OR length(r->>k) NOT BETWEEN 1 AND 160 OR r->>k<>btrim(r->>k) OR r->>k ~ ''[[:cntrl:]]'') THEN RAISE EXCEPTION ''REPORT_IMPORT_INPUT'';END IF;
  IF jsonb_typeof(r->''minutes'') IS DISTINCT FROM ''number'' OR (r->>''minutes'') !~ ''^[0-9]{1,4}$'' OR (r->>''minutes'')::integer>1440 OR coalesce(r->>''day'','''') !~ ''^20[0-9]{2}-[0-9]{2}-[0-9]{2}$'' THEN RAISE EXCEPTION ''REPORT_IMPORT_INPUT'';END IF;
  work_day:=(r->>''day'')::date;
  IF work_day<p_month OR work_day>=(p_month+interval ''1 month'')::date THEN RAISE EXCEPTION ''REPORT_IMPORT_MONTH'';END IF;
  SELECT l.id,l.name INTO location,location_name FROM public.ops_locations l JOIN public.reporting_projects p ON p.tenant_id=l.tenant_id AND p.company_id=l.company_id
   WHERE p.tenant_id=p_tenant AND p.id=p_project AND l.external_code=r->>''locationCode'';
  IF location IS NULL OR NOT EXISTS(SELECT 1 FROM public.reporting_project_locations WHERE tenant_id=p_tenant AND project_id=p_project AND location_id=location AND work_day>=valid_from AND (valid_until IS NULL OR work_day<=valid_until)) THEN RAISE EXCEPTION ''REPORT_LOCATION_UNMAPPED'';END IF;
  SELECT p.id,p.name INTO person,person_name FROM public.reporting_person_codes m JOIN public.talent_people p ON p.tenant_id=m.tenant_id AND p.id=public.talent_canonical_person(p_tenant,m.person_id) WHERE m.tenant_id=p_tenant AND m.project_id=p_project AND m.source=p_source AND m.code=r->>''personCode'' AND to_jsonb(p)->>''merged_into_id'' IS NULL;
  IF person IS NULL THEN RAISE EXCEPTION ''REPORT_PERSON_UNMAPPED'';END IF;
  SELECT * INTO item FROM public.reporting_actuals WHERE tenant_id=p_tenant AND project_id=p_project AND source=p_source AND source_id=r->>''sourceId'';
  IF FOUND AND (item.location_id<>location OR public.talent_canonical_person(p_tenant,item.person_id) IS DISTINCT FROM person OR item.day<>work_day OR item.slot<>r->>''slotCode'') THEN RAISE EXCEPTION ''REPORT_SOURCE_ID_CHANGED'';END IF;
  IF EXISTS(SELECT 1 FROM public.reporting_actuals WHERE tenant_id=p_tenant AND project_id=p_project AND location_id=location AND public.talent_canonical_person(p_tenant,person_id)=person AND day=work_day AND slot=r->>''slotCode'' AND (source<>p_source OR source_id<>r->>''sourceId'')) THEN RAISE EXCEPTION ''REPORT_WORK_DUPLICATE'';END IF;
  result:=result||jsonb_build_array(r||jsonb_build_object(''locationId'',location,''personId'',person,''locationName'',location_name,''personName'',person_name,''previousMinutes'',item.minutes,''status'',CASE WHEN item.source_id IS NULL THEN ''new'' WHEN item.minutes=(r->>''minutes'')::integer THEN ''unchanged'' ELSE ''changed'' END));
 END LOOP;
 IF (SELECT count(DISTINCT x->>''sourceId'') FROM jsonb_array_elements(result)x)<>jsonb_array_length(result)
 OR (SELECT count(DISTINCT (x->>''locationId'',x->>''personId'',x->>''day'',x->>''slotCode'')) FROM jsonb_array_elements(result)x)<>jsonb_array_length(result) THEN RAISE EXCEPTION ''REPORT_WORK_DUPLICATE'';END IF;
 RETURN result;
END '),
('public.reporting_person_code_set(uuid,uuid,uuid,integer,text,text,uuid)','c961f80a7dd4537add84337d1f8d83d54c5ff3d876c99e92370ebcfbcdd99e6d','
DECLARE item public.reporting_projects;old_person uuid;
BEGIN
 PERFORM 1 FROM public.profiles WHERE id=auth.uid() FOR SHARE;
 PERFORM 1 FROM public.tenant_memberships WHERE user_id=auth.uid() AND tenant_id=p_tenant FOR SHARE;
 PERFORM public.reporting_assert_scope(p_actor,p_tenant,true);
 IF current_setting(''transaction_isolation'')<>''read committed'' THEN RAISE EXCEPTION ''REPORT_CONFLICT'';END IF;
 -- Serialize identity resolution against merge before taking project/person locks.
 PERFORM pg_advisory_xact_lock_shared(hashtextextended(''bps:reporting-merge:''||p_tenant::text,0));
 SELECT * INTO item FROM public.reporting_projects WHERE tenant_id=p_tenant AND id=p_project FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION ''REPORT_NOT_FOUND'';END IF;
 IF p_source IS NULL OR p_source !~ ''^[A-Za-z0-9_-]{1,40}$'' OR p_code IS NULL OR length(p_code) NOT BETWEEN 1 AND 160 OR p_code<>btrim(p_code) OR p_code ~ ''[[:cntrl:]]'' THEN RAISE EXCEPTION ''REPORT_IMPORT_INPUT'';END IF;
 p_person:=public.talent_canonical_person(p_tenant,p_person);
 PERFORM 1 FROM public.talent_people p WHERE tenant_id=p_tenant AND id=p_person AND to_jsonb(p)->>''merged_into_id'' IS NULL FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION ''REPORT_PERSON_UNMAPPED'';END IF;
 IF EXISTS(SELECT 1 FROM public.reporting_person_codes WHERE tenant_id=p_tenant AND project_id=p_project AND source=p_source AND code=p_code AND public.talent_canonical_person(p_tenant,person_id)=p_person) THEN RETURN item.revision;END IF;
 IF p_revision IS DISTINCT FROM item.revision THEN RAISE EXCEPTION ''REPORT_CONFLICT'';END IF;
 SELECT person_id INTO old_person FROM public.reporting_person_codes WHERE tenant_id=p_tenant AND project_id=p_project AND source=p_source AND code=p_code;
 IF old_person IS NOT NULL AND EXISTS(SELECT 1 FROM public.reporting_imports b WHERE b.tenant_id=p_tenant AND b.project_id=p_project AND b.source=p_source AND b.status IN (''pending'',''approved'') AND EXISTS(SELECT 1 FROM jsonb_array_elements(b.rows) r WHERE r->>''personCode''=p_code)) THEN RAISE EXCEPTION ''REPORT_MAPPING_USED'';END IF;
 INSERT INTO public.reporting_person_codes(tenant_id,project_id,source,code,person_id,created_by) VALUES(p_tenant,p_project,p_source,p_code,p_person,p_actor)
 ON CONFLICT(tenant_id,project_id,source,code) DO UPDATE SET person_id=excluded.person_id,created_by=excluded.created_by,created_at=now();
 INSERT INTO public.reporting_person_code_events(tenant_id,project_id,source,code,old_person_id,new_person_id,actor_id) VALUES(p_tenant,p_project,p_source,p_code,old_person,p_person,p_actor);
 UPDATE public.reporting_projects SET revision=revision+1 WHERE tenant_id=p_tenant AND id=p_project RETURNING revision INTO p_revision;
 RETURN p_revision;
END '),
('public.reporting_import_prepare(uuid,uuid,uuid,uuid,text,text,jsonb)','19a94edfee092bc88b37a846be74704eae60eeee4de03c150cea781c4630b31b','
DECLARE item public.reporting_projects;batch public.reporting_imports;month_day date;resolved jsonb;
BEGIN
 PERFORM 1 FROM public.profiles WHERE id=auth.uid() FOR SHARE;
 PERFORM 1 FROM public.tenant_memberships WHERE user_id=auth.uid() AND tenant_id=p_tenant FOR SHARE;
 PERFORM public.reporting_assert_scope(p_actor,p_tenant,true);
 IF current_setting(''transaction_isolation'')<>''read committed'' THEN RAISE EXCEPTION ''REPORT_CONFLICT'';END IF;
 -- Serialize identity resolution against merge before taking project/person locks.
 PERFORM pg_advisory_xact_lock_shared(hashtextextended(''bps:reporting-merge:''||p_tenant::text,0));
 IF p_command IS NULL OR coalesce(p_month,'''') !~ ''^20[0-9]{2}-(0[1-9]|1[0-2])$'' THEN RAISE EXCEPTION ''REPORT_IMPORT_INPUT'';END IF;
 month_day:=(p_month||''-01'')::date;
 SELECT * INTO item FROM public.reporting_projects WHERE tenant_id=p_tenant AND id=p_project FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION ''REPORT_NOT_FOUND'';END IF;
 SELECT * INTO batch FROM public.reporting_imports WHERE tenant_id=p_tenant AND actor_id=p_actor AND command_id=p_command;
 IF FOUND THEN
  IF batch.project_id<>p_project OR batch.month<>month_day OR batch.source IS DISTINCT FROM p_source OR batch.rows IS DISTINCT FROM p_rows THEN RAISE EXCEPTION ''REPORT_COMMAND_MISMATCH'';END IF;
  RETURN jsonb_build_object(''batchId'',batch.id,''status'',batch.status,''rows'',batch.resolved);
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.reporting_periods WHERE tenant_id=p_tenant AND project_id=p_project AND month=month_day AND status=''open'') THEN RAISE EXCEPTION ''REPORT_PERIOD_CLOSED'';END IF;
 resolved:=public.reporting_import_validate(p_tenant,p_project,month_day,p_source,p_rows);
 INSERT INTO public.reporting_imports(tenant_id,project_id,month,actor_id,command_id,source,rows,resolved,base_revision)
 VALUES(p_tenant,p_project,month_day,p_actor,p_command,p_source,p_rows,resolved,item.revision) RETURNING * INTO batch;
 RETURN jsonb_build_object(''batchId'',batch.id,''status'',batch.status,''rows'',batch.resolved);
END '),
('public.reporting_import_finish(uuid,uuid,uuid,boolean)','70d451f454801363318ecedd05f07a13605aaec3de28028bb8fb46b136e8d804','
DECLARE batch public.reporting_imports;item public.reporting_projects;resolved jsonb;r jsonb;previous jsonb;
BEGIN
 PERFORM 1 FROM public.profiles WHERE id=auth.uid() FOR SHARE;
 PERFORM 1 FROM public.tenant_memberships WHERE user_id=auth.uid() AND tenant_id=p_tenant FOR SHARE;
 PERFORM public.reporting_assert_scope(p_actor,p_tenant,true);
 IF current_setting(''transaction_isolation'')<>''read committed'' THEN RAISE EXCEPTION ''REPORT_CONFLICT'';END IF;
 -- Serialize identity resolution against merge before taking project/person locks.
 PERFORM pg_advisory_xact_lock_shared(hashtextextended(''bps:reporting-merge:''||p_tenant::text,0));
 IF p_approve IS NULL THEN RAISE EXCEPTION ''REPORT_IMPORT_INPUT'';END IF;
 SELECT * INTO batch FROM public.reporting_imports WHERE tenant_id=p_tenant AND id=p_batch;
 IF NOT FOUND THEN RAISE EXCEPTION ''REPORT_NOT_FOUND'';END IF;
 SELECT * INTO item FROM public.reporting_projects WHERE tenant_id=p_tenant AND id=batch.project_id FOR UPDATE;
 SELECT * INTO batch FROM public.reporting_imports WHERE tenant_id=p_tenant AND id=p_batch FOR UPDATE;
 IF batch.actor_id<>p_actor AND public.current_user_role()<>''yonetici'' THEN RAISE EXCEPTION ''REPORT_FORBIDDEN'';END IF;
 IF batch.status=(CASE WHEN p_approve THEN ''approved'' ELSE ''cancelled'' END) THEN RETURN batch.status;END IF;
 IF batch.status<>''pending'' THEN RAISE EXCEPTION ''REPORT_IMPORT_STATE'';END IF;
 IF NOT p_approve THEN UPDATE public.reporting_imports SET status=''cancelled'' WHERE tenant_id=p_tenant AND id=p_batch;RETURN ''cancelled'';END IF;
 IF item.revision<>batch.base_revision THEN RAISE EXCEPTION ''REPORT_CONFLICT'';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.reporting_periods WHERE tenant_id=p_tenant AND project_id=item.id AND month=batch.month AND status=''open'') THEN RAISE EXCEPTION ''REPORT_PERIOD_CLOSED'';END IF;
 resolved:=public.reporting_import_validate(p_tenant,item.id,batch.month,batch.source,batch.rows);
 IF resolved<>batch.resolved THEN RAISE EXCEPTION ''REPORT_CONFLICT'';END IF;
 SELECT coalesce(jsonb_agg(to_jsonb(a)),''[]'') INTO previous FROM public.reporting_actuals a WHERE tenant_id=p_tenant AND project_id=item.id AND source=batch.source AND source_id IN (SELECT x->>''sourceId'' FROM jsonb_array_elements(batch.rows)x);
 FOR r IN SELECT value FROM jsonb_array_elements(resolved) LOOP
  IF r->>''status''=''unchanged'' THEN CONTINUE;END IF;
  INSERT INTO public.reporting_actuals(tenant_id,project_id,month,source,source_id,location_id,person_id,day,slot,minutes,batch_id)
   VALUES(p_tenant,item.id,batch.month,batch.source,r->>''sourceId'',(r->>''locationId'')::uuid,(r->>''personId'')::uuid,(r->>''day'')::date,r->>''slotCode'',(r->>''minutes'')::integer,p_batch)
  ON CONFLICT(tenant_id,project_id,source,source_id) DO UPDATE SET minutes=excluded.minutes,batch_id=excluded.batch_id,revision=reporting_actuals.revision+1;
 END LOOP;
 UPDATE public.reporting_imports SET status=''approved'',approved_by=p_actor,approved_at=now(),previous_rows=previous WHERE tenant_id=p_tenant AND id=p_batch;
 UPDATE public.reporting_projects SET revision=revision+1 WHERE tenant_id=p_tenant AND id=item.id;
 RETURN ''approved'';
END '),
('public.reporting_import_people(uuid,uuid,uuid,text,text[],text)','fa58742e9ecae413b12e35505556405f0a97ff9e0e64fafe1959c60a380625fa','
DECLARE rev integer;mappings jsonb;candidates jsonb;
BEGIN
 PERFORM public.reporting_assert_scope(p_actor,p_tenant,true);
 IF p_codes IS NULL OR cardinality(p_codes)>1000 OR p_search IS NULL OR length(p_search)>100 OR p_source IS NULL OR p_source !~ ''^[A-Za-z0-9_-]{1,40}$'' THEN RAISE EXCEPTION ''REPORT_IMPORT_INPUT'';END IF;
 SELECT revision INTO rev FROM public.reporting_projects WHERE tenant_id=p_tenant AND id=p_project;
 IF NOT FOUND THEN RAISE EXCEPTION ''REPORT_NOT_FOUND'';END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object(''code'',m.code,''personId'',p.id,''name'',p.name) ORDER BY m.code),''[]'') INTO mappings FROM public.reporting_person_codes m JOIN public.talent_people p ON p.tenant_id=m.tenant_id AND p.id=public.talent_canonical_person(p_tenant,m.person_id) WHERE m.tenant_id=p_tenant AND m.project_id=p_project AND m.source=p_source AND m.code=ANY(p_codes);
 SELECT coalesce(jsonb_agg(to_jsonb(q) ORDER BY q.name,q.id),''[]'') INTO candidates FROM (
 SELECT id,name,city FROM public.talent_people p WHERE tenant_id=p_tenant AND to_jsonb(p)->>''merged_into_id'' IS NULL AND length(btrim(p_search))>=2 AND strpos(lower(name),lower(btrim(p_search)))>0 ORDER BY name,id LIMIT 20
 )q;
 RETURN jsonb_build_object(''revision'',rev,''mappings'',mappings,''candidates'',candidates);
END '),
('public.reporting_monthly_report(uuid,uuid,uuid,text,integer)','df9b67e0c79f96694768a95fb60fe9af933ea27bd61045e7211e216d9cb494f2','
DECLARE m date; period_state text; project_name text; totals jsonb; branches jsonb; pending bigint;
BEGIN
 PERFORM public.reporting_assert_scope(p_actor,p_tenant,false);
 IF p_month IS NULL OR p_month !~ ''^20[0-9]{2}-(0[1-9]|1[0-2])$'' OR p_offset IS NULL OR p_offset<0 OR p_offset>1000000 OR p_offset%50<>0 THEN RAISE EXCEPTION ''REPORT_INPUT'';END IF;
 m:=(p_month||''-01'')::date;
 SELECT name INTO project_name FROM public.reporting_projects WHERE tenant_id=p_tenant AND id=p_project;
 IF NOT FOUND THEN RAISE EXCEPTION ''REPORT_NOT_FOUND'';END IF;
 SELECT status INTO period_state FROM public.reporting_periods WHERE tenant_id=p_tenant AND project_id=p_project AND month=m;
 IF NOT FOUND THEN RAISE EXCEPTION ''REPORT_PERIOD_NOT_FOUND'';END IF;
 SELECT count(*) INTO pending FROM public.reporting_imports WHERE tenant_id=p_tenant AND project_id=p_project AND month=m AND status=''pending'';
 -- One statement snapshot. Counts are distinct over the whole month, never sums of branch counts.
 SELECT jsonb_build_object(''records'',count(*),''minutes'',coalesce(sum(minutes),0),''people'',count(DISTINCT public.talent_canonical_person(p_tenant,person_id)),''days'',count(DISTINCT day),''branches'',count(DISTINCT location_id)) INTO totals
 FROM public.reporting_actuals WHERE tenant_id=p_tenant AND project_id=p_project AND month=m;
 SELECT coalesce(jsonb_agg(to_jsonb(q) ORDER BY q.name,q.id),''[]''::jsonb) INTO branches FROM (
 SELECT l.id,l.name,count(*) AS records,sum(a.minutes) AS minutes,count(DISTINCT public.talent_canonical_person(p_tenant,a.person_id)) AS people,count(DISTINCT a.day) AS days
 FROM public.reporting_actuals a JOIN public.ops_locations l ON l.tenant_id=a.tenant_id AND l.id=a.location_id
 WHERE a.tenant_id=p_tenant AND a.project_id=p_project AND a.month=m
 GROUP BY l.id,l.name ORDER BY l.name,l.id LIMIT 50 OFFSET p_offset
 )q;
 RETURN jsonb_build_object(''tenantId'',p_tenant,''projectId'',p_project,''name'',project_name,''month'',p_month,''status'',period_state,''pending'',pending,''totals'',totals,''offset'',p_offset,''rows'',branches);
END '),
('public.reporting_work_details(uuid,uuid,uuid,text,uuid,integer)','73cfd0689798792f30534d1bae71ba0302380a0b5b75edaf90aaac3db7def748','
DECLARE m date;total bigint;rows jsonb;
BEGIN
 PERFORM public.reporting_assert_scope(p_actor,p_tenant,false);
 IF p_month IS NULL OR p_month !~ ''^20[0-9]{2}-(0[1-9]|1[0-2])$'' OR p_offset IS NULL OR p_offset<0 OR p_offset>1000000 OR p_offset%50<>0 THEN RAISE EXCEPTION ''REPORT_INPUT'';END IF;
 m:=(p_month||''-01'')::date;
 IF NOT EXISTS(SELECT 1 FROM public.reporting_periods WHERE tenant_id=p_tenant AND project_id=p_project AND month=m) THEN RAISE EXCEPTION ''REPORT_PERIOD_NOT_FOUND'';END IF;
 SELECT count(*) INTO total FROM public.reporting_actuals WHERE tenant_id=p_tenant AND project_id=p_project AND month=m AND (p_location IS NULL OR location_id=p_location);
 SELECT coalesce(jsonb_agg(to_jsonb(q) ORDER BY q.day DESC,q."personId",q."locationId",q.slot,q.source,q."sourceId"),''[]''::jsonb) INTO rows FROM (
 SELECT a.day,p.id AS "personId",p.name AS "personName",a.location_id AS "locationId",l.name AS "locationName",a.slot,a.minutes,a.source,a.source_id AS "sourceId",a.batch_id AS "batchId"
 FROM public.reporting_actuals a JOIN public.talent_people p ON p.tenant_id=a.tenant_id AND p.id=public.talent_canonical_person(p_tenant,a.person_id) JOIN public.ops_locations l ON l.tenant_id=a.tenant_id AND l.id=a.location_id
 WHERE a.tenant_id=p_tenant AND a.project_id=p_project AND a.month=m AND (p_location IS NULL OR a.location_id=p_location)
 ORDER BY a.day DESC,p.id,a.location_id,a.slot,a.source,a.source_id LIMIT 50 OFFSET p_offset
 )q;
 RETURN jsonb_build_object(''tenantId'',p_tenant,''projectId'',p_project,''month'',p_month,''locationId'',p_location,''total'',total,''offset'',p_offset,''rows'',rows);
END '),
('public.talent_merge_apply(uuid,uuid,uuid,uuid,uuid,uuid,text,jsonb,boolean,boolean)','09a605a9136da745cfe92e3b5a76e49cfcc592e371255ecd89a627ac425fc465','
DECLARE cmd public.talent_merge_commands;l public.talent_people;r public.talent_people;main public.talent_people;donor public.talent_people;
 payload jsonb;state jsonb;input jsonb:=''{}'';contacts jsonb;item jsonb;k text;receipt jsonb;ids uuid[];
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION ''TALENT_SCOPE'';END IF;
 PERFORM 1 FROM public.profiles WHERE id=auth.uid() FOR SHARE;
 PERFORM 1 FROM public.tenant_memberships WHERE user_id=auth.uid() AND tenant_id=p_tenant FOR SHARE;
 PERFORM public.talent_assert_scope(p_actor,p_tenant);
 IF public.current_user_role() IS DISTINCT FROM ''yonetici'' THEN RAISE EXCEPTION ''TALENT_FORBIDDEN'';END IF;
 IF p_command IS NULL OR p_left IS NULL OR p_right IS NULL OR p_left=p_right OR p_primary IS NULL OR p_primary NOT IN(p_left,p_right)
  OR p_review_token IS NULL OR p_review_token !~ ''^[a-f0-9]{32}$'' OR p_confirm_same_person IS DISTINCT FROM true OR p_keep_primary_availability IS DISTINCT FROM true
  OR jsonb_typeof(p_fields) IS DISTINCT FROM ''object'' OR NOT(p_fields ?& ARRAY[''name'',''city'',''district'',''gender'',''birthDate''])
  OR (p_fields-ARRAY[''name'',''city'',''district'',''gender'',''birthDate''])<>''{}''
 THEN RAISE EXCEPTION ''TALENT_VALIDATION'';END IF;
 FOREACH k IN ARRAY ARRAY[''name'',''city'',''district'',''gender'',''birthDate''] LOOP
  IF jsonb_typeof(p_fields->k) IS DISTINCT FROM ''string'' OR (p_fields->>k) NOT IN(''left'',''right'') THEN RAISE EXCEPTION ''TALENT_VALIDATION'';END IF;
 END LOOP;
 payload:=jsonb_build_object(''left'',p_left,''right'',p_right,''primary'',p_primary,''token'',p_review_token,''fields'',p_fields);
 INSERT INTO public.talent_merge_commands(tenant_id,actor_id,command_id,payload)VALUES(p_tenant,p_actor,p_command,payload) ON CONFLICT DO NOTHING;
 SELECT * INTO STRICT cmd FROM public.talent_merge_commands WHERE tenant_id=p_tenant AND actor_id=p_actor AND command_id=p_command FOR UPDATE;
 IF cmd.payload IS DISTINCT FROM payload THEN RAISE EXCEPTION ''TALENT_COMMAND'';END IF;
 IF cmd.result IS NOT NULL THEN RETURN cmd.result;END IF;
 -- Do not wait while a reporting writer may need a person row held by this transaction.
 IF NOT pg_try_advisory_xact_lock(hashtextextended(''bps:reporting-merge:''||p_tenant::text,0)) THEN RAISE EXCEPTION ''TALENT_MERGE_BUSY'';END IF;
 -- Worker before person, matching existing edits/sync. Re-read revisions after locks.
 PERFORM 1 FROM public.ops_workers WHERE tenant_id=p_tenant AND id IN(SELECT worker_id FROM public.talent_people WHERE tenant_id=p_tenant AND id IN(p_left,p_right)) ORDER BY id FOR UPDATE;
 PERFORM 1 FROM public.talent_people WHERE tenant_id=p_tenant AND id IN(p_left,p_right) ORDER BY id FOR UPDATE;
 SELECT * INTO l FROM public.talent_people WHERE tenant_id=p_tenant AND id=p_left;
 IF NOT FOUND THEN RAISE EXCEPTION ''TALENT_NOT_FOUND'';END IF;
 SELECT * INTO r FROM public.talent_people WHERE tenant_id=p_tenant AND id=p_right;
 IF NOT FOUND THEN RAISE EXCEPTION ''TALENT_NOT_FOUND'';END IF;
 IF l.merged_into_id IS NOT NULL OR r.merged_into_id IS NOT NULL THEN RAISE EXCEPTION ''TALENT_MERGED'';END IF;
 state:=public.talent_merge_snapshot(p_tenant,p_left,p_right);
 IF md5(state::text)<>p_review_token THEN RAISE EXCEPTION ''TALENT_MERGE_CHANGED'';END IF;
 IF l.worker_id IS NOT NULL AND r.worker_id IS NOT NULL THEN RAISE EXCEPTION ''TALENT_MERGE_TWO_WORKERS'';END IF;
 IF p_primary=p_left THEN main:=l;donor:=r;ELSE main:=r;donor:=l;END IF;
 IF donor.worker_id IS NOT NULL THEN RAISE EXCEPTION ''TALENT_MERGE_PRIMARY'';END IF;
 -- Never strand a reserved upload, including cancellation awaiting Storage cleanup.
 IF (state->0->''counts''->>''pendingAttachments'')::bigint>0 OR (state->1->''counts''->>''pendingAttachments'')::bigint>0 THEN RAISE EXCEPTION ''TALENT_MERGE_PENDING_FILES'';END IF;
 -- Existing writers acquire the import fence inside triggers. Never wait on it
 -- while holding person locks: a competing import may already need those locks.
 IF NOT pg_try_advisory_xact_lock(hashtextextended(''bps:talent-import:''||p_tenant::text,0)) THEN RAISE EXCEPTION ''TALENT_MERGE_BUSY'';END IF;
 FOREACH k IN ARRAY ARRAY[''name'',''city'',''district'',''gender'',''birthDate''] LOOP
  item:=CASE WHEN p_fields->>k=''left'' THEN public.talent_person_json(l) ELSE public.talent_person_json(r) END;
  input:=input||jsonb_build_object(k,item->k);
 END LOOP;
 SELECT coalesce(jsonb_agg(c ORDER BY ord),''[]'') INTO contacts FROM(
  SELECT DISTINCT ON(public.talent_import_contact_key(c->>''kind'',c->>''value'')) c,ord
  FROM jsonb_array_elements(main.contacts||donor.contacts) WITH ORDINALITY x(c,ord)
  ORDER BY public.talent_import_contact_key(c->>''kind'',c->>''value''),ord
 ) unique_contacts;
 input:=input||jsonb_build_object(''contacts'',contacts,
  ''skills'',(SELECT coalesce(jsonb_agg(v ORDER BY v),''[]'') FROM(SELECT DISTINCT unnest(main.skills||donor.skills) v)s),
  ''regions'',(SELECT coalesce(jsonb_agg(v ORDER BY v),''[]'') FROM(SELECT DISTINCT unnest(main.regions||donor.regions) v)s),
  ''workTypes'',(SELECT coalesce(jsonb_agg(v ORDER BY v),''[]'') FROM(SELECT DISTINCT unnest(main.work_types||donor.work_types) v)s));
 -- Existing validator, history, worker-name sync and revision handling stay authoritative.
 receipt:=public.talent_save_person(p_actor,p_tenant,cmd.save_command,main.id,main.revision,input);
 UPDATE public.talent_people SET merged_into_id=main.id,revision=revision+1,updated_at=clock_timestamp() WHERE tenant_id=p_tenant AND id=donor.id;
 INSERT INTO public.talent_person_events(tenant_id,person_id,actor_id,kind,revision,changed_fields)
 VALUES(p_tenant,donor.id,p_actor,''updated'',donor.revision+1,ARRAY[''mergedIntoId'']),
 (p_tenant,main.id,p_actor,''updated'',(receipt->>''revision'')::integer,ARRAY[''mergedFromId'']);
 receipt:=jsonb_build_object(''actorId'',p_actor,''tenantId'',p_tenant,''commandId'',p_command,''primaryId'',main.id,''sourceId'',donor.id,''revision'',receipt->''revision'',''mergedAt'',clock_timestamp());
 UPDATE public.talent_merge_commands SET result=receipt WHERE tenant_id=p_tenant AND actor_id=p_actor AND command_id=p_command;
 RETURN receipt;
END ')
 ) AS changes(signature,expected_hash,new_body) LOOP
  target:=to_regprocedure(r.signature);
  IF target IS NULL THEN RAISE EXCEPTION 'REPORT_MERGE_SIGNATURE_MISSING: %',r.signature;END IF;
  SELECT prosrc INTO original FROM pg_proc WHERE oid=target;
  IF encode(sha256(convert_to(original,'UTF8')),'hex')<>r.expected_hash THEN RAISE EXCEPTION 'REPORT_MERGE_SOURCE_DRIFT: %',r.signature;END IF;
  definition:=pg_get_functiondef(target);
  IF strpos(definition,original)=0 THEN RAISE EXCEPTION 'REPORT_MERGE_DEFINITION_DRIFT';END IF;
  EXECUTE replace(definition,original,r.new_body);
 END LOOP;
END $patch$;
NOTIFY pgrst,'reload schema';
COMMIT;
