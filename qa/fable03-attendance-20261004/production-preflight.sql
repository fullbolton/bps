BEGIN READ ONLY;
SELECT pg_get_functiondef(to_regprocedure('public.ops_record_attendance(uuid,uuid,uuid,uuid,integer,text)'));
-- Aggregate only. Do not silently rewrite historical attendance.
SELECT count(*) AS closed_present_rows
FROM public.ops_assignments a
JOIN public.ops_daily_requests r ON r.tenant_id=a.tenant_id AND r.id=a.request_id
WHERE a.attendance='present' AND (a.removed_at IS NOT NULL OR r.lifecycle IS DISTINCT FROM 'active');
COMMIT;
