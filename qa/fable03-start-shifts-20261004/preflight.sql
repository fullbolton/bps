-- Salt-okunur; üretimde henüz çalıştırılmadı.
SELECT p.oid::regprocedure AS signature,
 encode(sha256(convert_to(p.prosrc,'UTF8')),'hex') AS body_sha256,
 pg_get_userbyid(p.proowner) AS owner,p.proacl
FROM pg_proc p WHERE p.oid=to_regprocedure('public.ops_start_execute(uuid,uuid,uuid,uuid,integer,text,jsonb)');
SELECT count(*) FILTER (WHERE occupied_range IS NULL OR isempty(occupied_range) OR upper_inf(occupied_range)) AS invalid_ranges,
 count(*) FILTER (WHERE upper(occupied_range)::date>work_date) AS ranges_crossing_midnight
FROM public.ops_assignments;
