-- Bounded shape screening for operational notes, not general PII detection.
-- Existing values are never rewritten. Any pre-existing match cancels this migration.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
LOCK TABLE public.talent_conversations, public.ops_messages, public.ops_replacement_outreach,
 public.ops_work_records, public.ops_work_record_events IN SHARE ROW EXCLUSIVE MODE;
CREATE FUNCTION public.operational_text_is_private(value text) RETURNS boolean
LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path='' AS $$
 SELECT EXISTS (
  SELECT 1 FROM regexp_matches(normalize(value,NFKC),'[0-9][0-9 .()-]*[0-9]|[0-9]','g') m
  CROSS JOIN LATERAL (SELECT regexp_replace(m[1],'[^0-9]','','g') AS digits) d
  WHERE length(digits)=11 OR digits ~ '^5[0-9]{9}$' OR digits ~ '^905[0-9]{9}$'
 )
$$;
CREATE FUNCTION public.operational_row_is_private(value jsonb) RETURNS boolean
LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path='' AS $$
 SELECT public.operational_text_is_private(value->>'body')
 OR public.operational_text_is_private(value->>'note')
 OR public.operational_text_is_private(value->>'reason')
 OR public.operational_text_is_private(value->'snapshot'->>'note')
$$;
DO $$ DECLARE violations bigint; BEGIN
 SELECT (SELECT count(*) FROM public.talent_conversations r WHERE public.operational_row_is_private(to_jsonb(r)))
 +(SELECT count(*) FROM public.ops_messages r WHERE public.operational_row_is_private(to_jsonb(r)))
 +(SELECT count(*) FROM public.ops_replacement_outreach r WHERE public.operational_row_is_private(to_jsonb(r)))
 +(SELECT count(*) FROM public.ops_work_records r WHERE public.operational_row_is_private(to_jsonb(r)))
 +(SELECT count(*) FROM public.ops_work_record_events r WHERE public.operational_row_is_private(to_jsonb(r))) INTO violations;
 IF violations<>0 THEN RAISE EXCEPTION 'OPERATION_TEXT_EXISTING: % records; migration cancelled',violations;END IF;
 RAISE NOTICE 'OPERATION_TEXT_PREFLIGHT: 0';
END $$;
CREATE FUNCTION public.operational_text_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF public.operational_row_is_private(to_jsonb(NEW)) THEN RAISE EXCEPTION 'OPERATION_TEXT_PRIVATE';END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER talent_conversations_private_guard BEFORE INSERT OR UPDATE ON public.talent_conversations FOR EACH ROW EXECUTE FUNCTION public.operational_text_guard();
CREATE TRIGGER ops_messages_private_guard BEFORE INSERT OR UPDATE ON public.ops_messages FOR EACH ROW EXECUTE FUNCTION public.operational_text_guard();
CREATE TRIGGER ops_replacement_outreach_private_guard BEFORE INSERT OR UPDATE ON public.ops_replacement_outreach FOR EACH ROW EXECUTE FUNCTION public.operational_text_guard();
CREATE TRIGGER ops_work_records_private_guard BEFORE INSERT OR UPDATE ON public.ops_work_records FOR EACH ROW EXECUTE FUNCTION public.operational_text_guard();
CREATE TRIGGER ops_work_record_events_private_guard BEFORE INSERT OR UPDATE ON public.ops_work_record_events FOR EACH ROW EXECUTE FUNCTION public.operational_text_guard();
REVOKE ALL ON FUNCTION public.operational_text_is_private(text),public.operational_row_is_private(jsonb),public.operational_text_guard() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.operational_text_is_private(text),public.operational_row_is_private(jsonb) TO authenticated,service_role;
COMMIT;
