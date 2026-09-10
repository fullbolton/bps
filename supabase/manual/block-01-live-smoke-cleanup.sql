-- Only the synthetic records created during Block 1 live acceptance.
BEGIN;
SET LOCAL lock_timeout='5s';
DO $$
DECLARE
 c constant uuid := 'f940411a-ae03-42e7-bd77-a4a7a97c3ea5';
 t constant uuid := 'afcdfc7d-257d-459d-b7c0-d15fa4ab36cd';
 a constant uuid := 'b2eb1fcd-8fd6-497c-8971-8fa761b481af';
 w constant uuid := 'a709473d-a486-47ac-9d3d-0a3062c2f8ce';
 l constant uuid := 'ed58e658-89a7-43c1-816d-8756b1dddbcb';
 r constant uuid := '4e039ea6-f22f-4563-9249-60b523aad632';
 actor constant uuid := '7150845f-04d2-4378-a062-62f0d2614aa7';
 n bigint; fk record;
BEGIN
 PERFORM 1 FROM public.companies WHERE id=c AND tenant_id=t AND name='BPS_SMOKE_BLOCK1_20260910' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Smoke company identity mismatch'; END IF;
 PERFORM 1 FROM public.ops_locations WHERE id=l AND company_id=c AND tenant_id=t AND name='BPS_SMOKE_BLOCK1_SUBE' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Smoke location identity mismatch'; END IF;
 PERFORM 1 FROM public.ops_workers WHERE id=w AND tenant_id=t AND code='BPS_BLOCK1_20260910' AND name='BPS_SMOKE_BLOCK1_PERSONEL' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Smoke worker identity mismatch'; END IF;
 PERFORM 1 FROM public.ops_daily_requests WHERE id=r AND company_id=c AND location_id=l AND tenant_id=t AND created_by=actor FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Smoke request identity mismatch'; END IF;
 PERFORM 1 FROM public.ops_assignments WHERE id=a AND request_id=r AND worker_id=w AND tenant_id=t AND created_by=actor FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Smoke assignment identity mismatch'; END IF;
 PERFORM 1 FROM public.ops_start_plans WHERE assignment_id=a AND tenant_id=t AND revision=3 FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Smoke plan mismatch'; END IF;
 IF (SELECT count(*) FROM public.ops_locations WHERE company_id=c)<>1
 OR (SELECT count(*) FROM public.ops_daily_requests WHERE company_id=c OR location_id=l)<>1
 OR (SELECT count(*) FROM public.ops_assignments WHERE request_id=r OR worker_id=w)<>1
 THEN RAISE EXCEPTION 'Unexpected test dependencies'; END IF;
 -- Inspect all company FK references, including cascading references; none may be silently removed.
 FOR fk IN SELECT conrelid::regclass relation,att.attname col
 FROM pg_constraint con JOIN pg_attribute att ON att.attrelid=con.conrelid AND att.attnum=con.conkey[1]
 WHERE con.contype='f' AND con.confrelid='public.companies'::regclass AND con.conrelid<>'public.ops_locations'::regclass
 LOOP
  EXECUTE format('SELECT count(*) FROM %s WHERE %I=$1',fk.relation,fk.col) INTO n USING c;
  IF n<>0 THEN RAISE EXCEPTION 'Unexpected company reference %',fk.relation; END IF;
 END LOOP;
 DELETE FROM public.ops_start_events WHERE assignment_id=a AND tenant_id=t AND actor_id=actor;
 GET DIAGNOSTICS n=ROW_COUNT; IF n<>3 THEN RAISE EXCEPTION 'Unexpected start event count %',n; END IF;
 DELETE FROM public.ops_start_plans WHERE assignment_id=a AND tenant_id=t;
 DELETE FROM public.ops_events WHERE entity_id IN (a,w,l,r) AND tenant_id=t AND actor_id=actor;
 GET DIAGNOSTICS n=ROW_COUNT; IF n<>7 THEN RAISE EXCEPTION 'Unexpected activity count %',n; END IF;
 IF EXISTS(SELECT 1 FROM public.ops_events WHERE entity_id IN (a,w,l,r)) THEN RAISE EXCEPTION 'Unexpected other actor activity'; END IF;
 DELETE FROM public.ops_assignments WHERE id=a AND tenant_id=t;
 DELETE FROM public.ops_daily_requests WHERE id=r AND tenant_id=t;
 DELETE FROM public.ops_locations WHERE id=l AND tenant_id=t;
 DELETE FROM public.ops_workers WHERE id=w AND tenant_id=t;
 DELETE FROM public.companies WHERE id=c AND tenant_id=t;
 -- ops_commands are deliberately retained: committed receipts and closed tombstones prevent replay.
END $$;
COMMIT;
SELECT
 (SELECT count(*) FROM public.companies WHERE id='f940411a-ae03-42e7-bd77-a4a7a97c3ea5') company_remaining,
 (SELECT count(*) FROM public.ops_locations WHERE id='ed58e658-89a7-43c1-816d-8756b1dddbcb') location_remaining,
 (SELECT count(*) FROM public.ops_workers WHERE id='a709473d-a486-47ac-9d3d-0a3062c2f8ce') worker_remaining,
 (SELECT count(*) FROM public.ops_daily_requests WHERE id='4e039ea6-f22f-4563-9249-60b523aad632') request_remaining,
 (SELECT count(*) FROM public.ops_assignments WHERE id='b2eb1fcd-8fd6-497c-8971-8fa761b481af') assignment_remaining,
 (SELECT count(*) FROM public.ops_start_plans WHERE assignment_id='b2eb1fcd-8fd6-497c-8971-8fa761b481af') plan_remaining,
 (SELECT count(*) FROM public.ops_start_events WHERE assignment_id='b2eb1fcd-8fd6-497c-8971-8fa761b481af') start_events_remaining,
 (SELECT count(*) FROM public.companies WHERE name='BPS_SMOKE_MEK_FIRMA_2026_09_08') previous_test_company_count,
 (SELECT count(*) FROM public.ops_workers WHERE code='SMK001') previous_test_worker_count;
