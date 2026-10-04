-- Salt okunur; bu tur üretimde ÇALIŞTIRILMADI.
SELECT table_name,column_name,data_type FROM information_schema.columns
WHERE table_schema='public' AND (table_name='contracts' AND column_name='end_date' OR table_name='documents' AND column_name='validity_date');
SELECT conname,convalidated,pg_get_constraintdef(oid) FROM pg_constraint
WHERE conrelid='public.notification_log'::regclass;
SELECT kind, CASE WHEN threshold_key='30d' THEN 'legacy' ELSE 'dated_or_other' END AS key_type, count(*)
FROM public.notification_log GROUP BY 1,2 ORDER BY 1,2;
