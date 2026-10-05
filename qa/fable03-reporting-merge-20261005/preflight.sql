-- Salt-okunur; üretimde bu tur ÇALIŞTIRILMADI. Kişisel içerik döndürmez.
SELECT oid::regprocedure AS signature,
 encode(sha256(convert_to(prosrc,'UTF8')),'hex') AS body_sha256,
 pg_get_userbyid(proowner) AS owner
FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN
('reporting_import_validate','reporting_person_code_set','reporting_import_prepare','reporting_import_finish','reporting_import_people','reporting_monthly_report','reporting_work_details','talent_merge_apply');
SELECT count(*) AS unresolved_mappings FROM public.reporting_person_codes
WHERE public.talent_canonical_person(tenant_id,person_id) IS NULL;
SELECT count(*) AS historical_collision_groups FROM (
 SELECT tenant_id,project_id,location_id,public.talent_canonical_person(tenant_id,person_id),day,slot
 FROM public.reporting_actuals GROUP BY 1,2,3,4,5,6 HAVING count(*)>1
) collisions;
