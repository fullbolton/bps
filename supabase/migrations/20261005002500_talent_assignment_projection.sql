-- Talent remains usable when staffing is disabled; assignment data is withheld explicitly.
-- Link identity on the talent card is retained, not misrepresented as an unlinked person.
BEGIN;
SET LOCAL lock_timeout='15s';
DO $patch$
DECLARE target regprocedure:=to_regprocedure('public.talent_person_detail(uuid,uuid,uuid)');original text;definition text;
BEGIN
 IF target IS NULL OR NOT EXISTS(SELECT FROM pg_proc WHERE oid=target AND prosecdef AND provolatile='s') THEN RAISE EXCEPTION 'TALENT_PROJECTION_SIGNATURE_DRIFT';END IF;
 SELECT prosrc INTO original FROM pg_proc WHERE oid=target;
 IF encode(sha256(convert_to(original,'UTF8')),'hex')<>'a1361c4a420f37fd0303f90e7c71eb98245684d881f3c4f4ed8f425e8319e98c' THEN RAISE EXCEPTION 'TALENT_PROJECTION_BODY_DRIFT';END IF;
 definition:=pg_get_functiondef(target);
 IF strpos(definition,original)=0 THEN RAISE EXCEPTION 'TALENT_PROJECTION_ANCHOR_DRIFT';END IF;
 EXECUTE replace(definition,original,'
DECLARE v_requested uuid:=p_person_id; v_person public.talent_people; v_events jsonb; v_assignments jsonb; v_staffing boolean;
BEGIN

 PERFORM public.talent_assert_scope(p_actor_id,p_tenant_id);
 PERFORM public.workspace_require_module_read_v1(p_tenant_id,ARRAY[''talent'']);
 PERFORM public.talent_assert_scope(p_actor_id,p_tenant_id);
 p_person_id:=public.talent_canonical_person(p_tenant_id,p_person_id);
 SELECT * INTO v_person FROM public.talent_people WHERE tenant_id=p_tenant_id AND id=p_person_id;
 IF NOT FOUND THEN RAISE EXCEPTION ''TALENT_NOT_FOUND''; END IF;
 SELECT coalesce(jsonb_agg(to_jsonb(e) ORDER BY e.id::bigint DESC),''[]'') INTO v_events FROM (
  SELECT e.id::text,e.kind,e.revision,e.changed_fields AS "changedFields",e.occurred_at AS "occurredAt",
   (SELECT p.display_name FROM public.profiles p JOIN public.tenant_memberships m ON m.user_id=p.id
    WHERE p.id=e.actor_id AND m.tenant_id=p_tenant_id) AS "actorName"
  FROM public.talent_person_events e WHERE e.tenant_id=p_tenant_id AND e.person_id IN(SELECT public.talent_person_family(p_tenant_id,p_person_id)) ORDER BY e.id DESC LIMIT 20
 ) e;
 v_staffing:=(public.current_workspace_modules_v1()->''modules''->>''staffing'')::boolean;
 IF v_staffing IS NULL THEN RAISE EXCEPTION ''MODULE_CONFIG_MISSING'' USING ERRCODE=''55000'';END IF;
 v_assignments:=''[]''::jsonb;
 IF v_staffing THEN
 SELECT coalesce(jsonb_agg(to_jsonb(a) ORDER BY a."workDate" DESC,a.id),''[]'') INTO v_assignments FROM (
  SELECT a.id,a.work_date AS "workDate",c.name AS "companyName",l.name AS "locationName",r.position,
   (a.removed_at IS NOT NULL OR r.lifecycle=''cancelled'') AS removed
  FROM public.ops_assignments a JOIN public.ops_daily_requests r ON r.tenant_id=a.tenant_id AND r.id=a.request_id
   JOIN public.companies c ON c.tenant_id=r.tenant_id AND c.id=r.company_id
   JOIN public.ops_locations l ON l.tenant_id=r.tenant_id AND l.company_id=r.company_id AND l.id=r.location_id
  WHERE a.tenant_id=p_tenant_id AND a.worker_id=v_person.worker_id ORDER BY a.work_date DESC,a.id LIMIT 10
 ) a;
 END IF;
 RETURN jsonb_build_object(''person'',public.talent_person_json(v_person),''events'',v_events,''assignments'',v_assignments,''staffingAvailable'',v_staffing,''redirectedFromId'',CASE WHEN v_requested<>p_person_id THEN v_requested ELSE NULL END,''mergedSourceCount'',(SELECT count(*)-1 FROM public.talent_person_family(p_tenant_id,p_person_id)));
END ');
END $patch$;
COMMIT;
