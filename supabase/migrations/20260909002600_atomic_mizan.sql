BEGIN;
SET LOCAL lock_timeout='15s';
ALTER TABLE public.mizan_uploads ADD COLUMN tenant_id uuid REFERENCES public.tenants(id), ADD COLUMN request_payload jsonb;
-- Legacy uploads remain intact and invisible until their scope is reconciled separately.
CREATE POLICY mizan_upload_tenant_guard ON public.mizan_uploads AS RESTRICTIVE FOR SELECT TO authenticated
 USING(tenant_id=public.current_user_verified_tenant());
CREATE POLICY mizan_row_tenant_guard ON public.mizan_upload_rows AS RESTRICTIVE FOR SELECT TO authenticated
 USING(EXISTS(SELECT 1 FROM public.mizan_uploads u WHERE u.id=upload_id AND u.tenant_id=public.current_user_verified_tenant()));
REVOKE INSERT,UPDATE,DELETE ON public.mizan_uploads,public.mizan_upload_rows FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.derive_financial_summaries_from_mizan(uuid) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.confirm_mizan_atomic(p_id uuid,p_tenant_id uuid,p_payload jsonb) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_actor uuid:=auth.uid();v_old public.mizan_uploads%ROWTYPE;v_row jsonb;v_code text;v_company uuid;v_name text;v_status text;v_count int;v_matched int:=0;v_unmatched int:=0;v_ambiguous int:=0;v_key text;
BEGIN
 IF v_actor IS NULL OR p_tenant_id IS NULL OR p_tenant_id IS DISTINCT FROM public.current_user_verified_tenant() THEN RAISE EXCEPTION 'MIZAN_SCOPE';END IF;
 PERFORM 1 FROM public.profiles WHERE id=v_actor FOR UPDATE;
 IF p_tenant_id IS DISTINCT FROM public.current_user_verified_tenant() THEN RAISE EXCEPTION 'MIZAN_SCOPE';END IF;
 IF public.current_user_role() IS DISTINCT FROM 'yonetici' THEN RAISE EXCEPTION 'MIZAN_FORBIDDEN';END IF;
 IF p_id IS NULL OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object' OR octet_length(p_payload::text)>8000000 THEN RAISE EXCEPTION 'MIZAN_INPUT';END IF;
 -- Serialize repeated identities across actors as well as within one session.
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_id::text,2600));
 SELECT * INTO v_old FROM public.mizan_uploads WHERE id=p_id;
 IF FOUND THEN
  IF v_old.tenant_id IS DISTINCT FROM p_tenant_id OR v_old.uploaded_by IS DISTINCT FROM v_actor THEN RAISE EXCEPTION 'MIZAN_SCOPE';END IF;
  IF v_old.request_payload IS DISTINCT FROM p_payload THEN RAISE EXCEPTION 'MIZAN_REPLAY_MISMATCH';END IF;
  RETURN p_id;
 END IF;
 IF jsonb_typeof(p_payload->'rows') IS DISTINCT FROM 'array' OR jsonb_typeof(p_payload->'fileName') IS DISTINCT FROM 'string' OR length(btrim(p_payload->>'fileName')) NOT BETWEEN 1 AND 255 THEN RAISE EXCEPTION 'MIZAN_INPUT';END IF;
 v_count:=jsonb_array_length(p_payload->'rows');
 IF v_count NOT BETWEEN 1 AND 10000 THEN RAISE EXCEPTION 'MIZAN_INPUT';END IF;
 FOREACH v_key IN ARRAY ARRAY['reportPeriod','reportDateRange'] LOOP
  IF p_payload?v_key AND jsonb_typeof(p_payload->v_key) NOT IN ('null','string') THEN RAISE EXCEPTION 'MIZAN_INPUT';END IF;
  IF length(p_payload->>v_key)>255 THEN RAISE EXCEPTION 'MIZAN_INPUT';END IF;
 END LOOP;
 INSERT INTO public.mizan_uploads(id,tenant_id,request_payload,file_name,report_period,report_date_range,uploaded_by,total_rows)
 VALUES(p_id,p_tenant_id,p_payload,p_payload->>'fileName',p_payload->>'reportPeriod',p_payload->>'reportDateRange',v_actor,v_count);
 FOR v_row IN SELECT value FROM jsonb_array_elements(p_payload->'rows') LOOP
  v_code:=v_row->>'accountCode';v_status:=v_row->>'matchStatus';
  IF jsonb_typeof(v_row) IS DISTINCT FROM 'object' OR v_code IS NULL OR v_code!~'^120[.][0-9]+[.][0-9]+[.][0-9]+([.][0-9]+)*$' OR length(v_code)>100
   OR jsonb_typeof(v_row->'accountName') IS DISTINCT FROM 'string' OR length(btrim(v_row->>'accountName')) NOT BETWEEN 1 AND 255
   OR v_status IS NULL OR v_status NOT IN ('matched','unmatched','ambiguous') THEN RAISE EXCEPTION 'MIZAN_INPUT';END IF;
  FOREACH v_key IN ARRAY ARRAY['borcTotal','alacakTotal','borcBakiyesi','alacakBakiyesi'] LOOP
   IF jsonb_typeof(v_row->v_key) IS DISTINCT FROM 'number' THEN RAISE EXCEPTION 'MIZAN_INPUT';END IF;
   IF abs((v_row->>v_key)::numeric)>=10000000000000 OR (v_row->>v_key)::numeric<>round((v_row->>v_key)::numeric,2) THEN RAISE EXCEPTION 'MIZAN_AMOUNT';END IF;
  END LOOP;
  v_company:=NULL;v_name:=NULL;
  IF v_status='matched' THEN
   v_company:=(v_row->>'matchedCompanyId')::uuid;
   SELECT name INTO v_name FROM public.companies WHERE id=v_company AND tenant_id=p_tenant_id;
   IF NOT FOUND THEN RAISE EXCEPTION 'MIZAN_COMPANY_SCOPE';END IF;
   v_matched:=v_matched+1;
  ELSE
   IF v_row->>'matchedCompanyId' IS NOT NULL THEN RAISE EXCEPTION 'MIZAN_INPUT';END IF;
   IF v_status='unmatched' THEN v_unmatched:=v_unmatched+1;ELSE v_ambiguous:=v_ambiguous+1;END IF;
  END IF;
  INSERT INTO public.mizan_upload_rows(upload_id,account_code,account_name,borc_total,alacak_total,borc_bakiyesi,alacak_bakiyesi,matched_company_id,matched_company_name,match_status)
  VALUES(p_id,v_code,v_row->>'accountName',(v_row->>'borcTotal')::numeric,(v_row->>'alacakTotal')::numeric,(v_row->>'borcBakiyesi')::numeric,(v_row->>'alacakBakiyesi')::numeric,v_company,v_name,v_status);
 END LOOP;
 IF EXISTS(SELECT 1 FROM public.mizan_upload_rows WHERE upload_id=p_id GROUP BY account_code HAVING count(*)>1) THEN RAISE EXCEPTION 'MIZAN_DUPLICATE_ACCOUNT';END IF;
 UPDATE public.mizan_uploads SET matched_count=v_matched,unmatched_count=v_unmatched,ambiguous_count=v_ambiguous WHERE id=p_id;
 INSERT INTO public.financial_summaries(tenant_id,company_id,open_receivable,is_overdue,last_source,confirmed_by,confirmed_at,created_by,updated_at)
 SELECT p_tenant_id,matched_company_id,sum(borc_bakiyesi),false,'mizan',v_actor,now(),v_actor,now()
 FROM public.mizan_upload_rows WHERE upload_id=p_id AND match_status='matched' GROUP BY matched_company_id ORDER BY matched_company_id
 ON CONFLICT(tenant_id,company_id) WHERE company_id IS NOT NULL DO UPDATE SET open_receivable=excluded.open_receivable,last_source=excluded.last_source,confirmed_by=excluded.confirmed_by,confirmed_at=excluded.confirmed_at,updated_at=excluded.updated_at;
 RETURN p_id;
END $$;
REVOKE ALL ON FUNCTION public.confirm_mizan_atomic(uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_mizan_atomic(uuid,uuid,jsonb) TO authenticated;
COMMIT;
