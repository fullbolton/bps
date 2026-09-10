-- 036: day-wide filters. Local only until a separate production release.
-- Additive read API; the deployed board and all writers retain their signatures.
BEGIN;
SET LOCAL lock_timeout = '15s';
CREATE FUNCTION public.ops_start_board_filtered(
 p_actor_id uuid,p_tenant_id uuid,p_day date,p_offset integer DEFAULT 0,
 p_search text DEFAULT '',p_only_mine boolean DEFAULT false,p_only_urgent boolean DEFAULT false
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_result jsonb;
BEGIN
 IF auth.uid() IS NULL OR p_actor_id IS DISTINCT FROM auth.uid() OR p_tenant_id IS NULL OR p_tenant_id IS DISTINCT FROM public.current_user_verified_tenant() THEN RAISE EXCEPTION 'START_SCOPE'; END IF;
 IF coalesce(public.current_user_role(),'') NOT IN ('yonetici','operasyon') THEN RAISE EXCEPTION 'START_FORBIDDEN'; END IF;
 IF p_day IS NULL OR p_day NOT BETWEEN DATE '2000-01-01' AND DATE '2100-12-31'
 OR p_offset IS NULL OR p_offset<0 OR p_offset>1000000 OR p_search IS NULL OR char_length(p_search)>200
 OR p_only_mine IS NULL OR p_only_urgent IS NULL THEN RAISE EXCEPTION 'START_INPUT'; END IF;
 WITH base AS MATERIALIZED (
  SELECT a.id,a.request_id,r.company_id,c.name company,l.name location,w.name worker,r.position,
   a.created_at,a.removed_at IS NOT NULL OR r.lifecycle<>'active' closed,a.attendance,
   p.start_at,p.planned_at,p.responsible_id,owner.display_name responsible,
   EXISTS(SELECT 1 FROM public.tenant_memberships m JOIN public.profiles pr ON pr.id=m.user_id
    WHERE m.tenant_id=p_tenant_id AND m.user_id=p.responsible_id AND pr.role IN ('yonetici','operasyon')) owner_available,
   coalesce(p.revision,0) revision,coalesce(p.plan_version,0) plan_version,coalesce(p.offsets,'{}'::integer[]) offsets,
   p.confirmed_at,p.confirmation_source,p.witness,p.claimed_by,p.claim_until,
   last_call.payload->>'outcome' outcome,last_call.id last_call_id
  FROM public.ops_assignments a JOIN public.ops_daily_requests r ON r.id=a.request_id AND r.tenant_id=a.tenant_id
  JOIN public.companies c ON c.id=r.company_id AND c.tenant_id=r.tenant_id
  JOIN public.ops_locations l ON l.id=r.location_id AND l.tenant_id=r.tenant_id
  JOIN public.ops_workers w ON w.id=a.worker_id AND w.tenant_id=a.tenant_id
  LEFT JOIN public.ops_start_plans p ON p.assignment_id=a.id AND p.tenant_id=a.tenant_id
  LEFT JOIN public.profiles owner ON owner.id=p.responsible_id
  LEFT JOIN LATERAL (SELECT e.id,e.payload FROM public.ops_start_events e
   WHERE e.assignment_id=a.id AND e.tenant_id=a.tenant_id AND e.plan_version=p.plan_version AND e.kind='call'
   ORDER BY e.revision DESC LIMIT 1) last_call ON true
  WHERE a.tenant_id=p_tenant_id AND a.work_date=p_day
 ), filtered AS MATERIALIZED (
  SELECT b.* FROM base b
  WHERE strpos(lower(concat_ws(' ',b.company,b.location,b.worker)),lower(btrim(p_search)))>0
   AND (NOT p_only_mine OR b.responsible_id=p_actor_id)
   AND (NOT p_only_urgent OR (NOT b.closed AND b.confirmed_at IS NULL AND (
    b.start_at IS NULL OR NOT b.owner_available OR b.start_at<=statement_timestamp()
    OR b.outcome IN ('cannot_attend','claimed_arrival','unreachable')
    OR EXISTS(SELECT 1 FROM unnest(b.offsets) AS checkpoint(minutes)
     WHERE b.start_at+checkpoint.minutes*interval '1 minute'>=greatest(b.created_at,b.planned_at)
      AND b.start_at+checkpoint.minutes*interval '1 minute'<=statement_timestamp()
      AND NOT EXISTS(SELECT 1 FROM public.ops_start_events e WHERE e.assignment_id=b.id AND e.tenant_id=p_tenant_id
       AND e.plan_version=b.plan_version AND e.kind='call' AND e.payload->'offset'=to_jsonb(checkpoint.minutes)))
    OR (b.last_call_id IS NULL AND EXISTS(SELECT 1 FROM unnest(b.offsets) AS checkpoint(minutes)
     WHERE b.start_at+checkpoint.minutes*interval '1 minute'<greatest(b.created_at,b.planned_at)))
   )))
 ), page AS (
  SELECT * FROM filtered ORDER BY start_at NULLS FIRST,id LIMIT 50 OFFSET p_offset
 )
 SELECT jsonb_build_object('serverNow',statement_timestamp(),'day',p_day,'total',(SELECT count(*) FROM filtered),
 'dayTotal',(SELECT count(*) FROM base),'filterScope','day',
 'rows',coalesce((SELECT jsonb_agg(jsonb_build_object(
  'id',b.id,'requestId',b.request_id,'companyId',b.company_id,'company',b.company,'location',b.location,'worker',b.worker,'position',b.position,
  'createdAt',b.created_at,'closed',b.closed,'attendance',b.attendance,'startAt',b.start_at,'plannedAt',b.planned_at,
  'responsibleId',b.responsible_id,'responsible',b.responsible,'ownerAvailable',b.owner_available,
  'revision',b.revision,'planVersion',b.plan_version,'offsets',to_jsonb(b.offsets),
  'confirmedAt',b.confirmed_at,'source',b.confirmation_source,'witness',b.witness,'claimedBy',b.claimed_by,'claimUntil',b.claim_until,
  'events',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',e.id,'revision',e.revision,'planVersion',e.plan_version,'kind',e.kind,
   'payload',e.payload,'occurredAt',e.occurred_at,'recordedAt',e.recorded_at,'actor',pr.display_name) ORDER BY e.revision),'[]')
   FROM public.ops_start_events e JOIN public.profiles pr ON pr.id=e.actor_id WHERE e.assignment_id=b.id AND e.tenant_id=p_tenant_id)
 ) ORDER BY b.start_at NULLS FIRST,b.id) FROM page b),'[]'),
 'members',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',pr.id,'name',pr.display_name) ORDER BY pr.display_name,pr.id),'[]')
  FROM public.profiles pr JOIN public.tenant_memberships m ON m.user_id=pr.id WHERE m.tenant_id=p_tenant_id AND pr.role IN ('yonetici','operasyon')))
 INTO v_result;
 RETURN v_result;
END $$;
REVOKE ALL ON FUNCTION public.ops_start_board_filtered(uuid,uuid,date,integer,text,boolean,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ops_start_board_filtered(uuid,uuid,date,integer,text,boolean,boolean) TO authenticated;
COMMIT;
