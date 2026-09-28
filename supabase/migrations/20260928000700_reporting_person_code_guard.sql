-- Person-code shape guard only; does not inspect raw source documents or other text fields.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
LOCK TABLE public.reporting_person_codes, public.reporting_person_code_events, public.reporting_imports IN SHARE ROW EXCLUSIVE MODE;
CREATE FUNCTION public.reporting_person_code_is_private(value text) RETURNS boolean
LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path='' AS $$
 SELECT coalesce(translate(normalize(value,NFKC),' .()-'||chr(9)||chr(10)||chr(11)||chr(12)||chr(13)||chr(5760)||chr(8232)||chr(8233)||chr(65279),'') ~ '^[0-9]{11}$',false)
$$;
CREATE FUNCTION public.reporting_json_has_private_person_code(value jsonb) RETURNS boolean
LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM jsonb_path_query(value,'$.**.personCode') code
 WHERE public.reporting_person_code_is_private(code #>> '{}'))
$$;
-- Aggregate-only preflight. No existing records are changed or printed.
DO $$ DECLARE violations bigint; BEGIN
 SELECT (SELECT count(*) FROM public.reporting_person_codes WHERE public.reporting_person_code_is_private(code))
 +(SELECT count(*) FROM public.reporting_person_code_events WHERE public.reporting_person_code_is_private(code))
 +(SELECT count(*) FROM public.reporting_imports WHERE public.reporting_json_has_private_person_code(rows)
 OR public.reporting_json_has_private_person_code(resolved) OR public.reporting_json_has_private_person_code(previous_rows)) INTO violations;
 IF violations<>0 THEN RAISE EXCEPTION 'REPORT_PERSON_CODE_EXISTING: % records; migration cancelled',violations; END IF;
 RAISE NOTICE 'REPORT_PERSON_CODE_PREFLIGHT: 0';
END $$;
CREATE FUNCTION public.reporting_person_code_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF TG_TABLE_NAME IN ('reporting_person_codes','reporting_person_code_events') THEN
  IF public.reporting_person_code_is_private(NEW.code) THEN RAISE EXCEPTION 'REPORT_PERSON_CODE_PRIVATE';END IF;
 ELSIF public.reporting_json_has_private_person_code(NEW.rows)
 OR public.reporting_json_has_private_person_code(NEW.resolved)
 OR public.reporting_json_has_private_person_code(NEW.previous_rows) THEN
  RAISE EXCEPTION 'REPORT_PERSON_CODE_PRIVATE';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER reporting_person_codes_private_guard BEFORE INSERT OR UPDATE ON public.reporting_person_codes FOR EACH ROW EXECUTE FUNCTION public.reporting_person_code_guard();
CREATE TRIGGER reporting_person_code_events_private_guard BEFORE INSERT OR UPDATE ON public.reporting_person_code_events FOR EACH ROW EXECUTE FUNCTION public.reporting_person_code_guard();
CREATE TRIGGER reporting_imports_private_guard BEFORE INSERT OR UPDATE ON public.reporting_imports FOR EACH ROW EXECUTE FUNCTION public.reporting_person_code_guard();
REVOKE ALL ON FUNCTION public.reporting_person_code_is_private(text),public.reporting_json_has_private_person_code(jsonb),public.reporting_person_code_guard() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.reporting_person_code_is_private(text),public.reporting_json_has_private_person_code(jsonb) TO authenticated,service_role;
COMMIT;
