-- Backend cutover candidate. Mode has no client writer; UI/readiness acceptance must precede activation.
BEGIN;
SET LOCAL lock_timeout='5s';
CREATE TABLE public.company_hr_access_modes (
 tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id),
 mode text NOT NULL CHECK(mode IN ('legacy','scoped')),
 changed_at timestamptz NOT NULL DEFAULT statement_timestamp()
);
ALTER TABLE public.company_hr_access_modes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.company_hr_access_modes FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.hr_access_mode_v1(p_actor uuid,p_tenant uuid) RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF p_actor IS NULL OR p_actor IS DISTINCT FROM auth.uid() OR p_tenant IS NULL OR p_tenant IS DISTINCT FROM public.current_user_verified_tenant() THEN RAISE EXCEPTION 'HR_SCOPE';END IF;
 RETURN coalesce((SELECT mode FROM public.company_hr_access_modes WHERE tenant_id=p_tenant),'legacy');
END $$;
REVOKE ALL ON FUNCTION public.hr_access_mode_v1(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
-- Same tenant serialization boundary as HR writes and role management.
CREATE FUNCTION public.hr_access_mode_guard() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'HR_MODE_DELETE_FORBIDDEN';END IF;
 IF TG_OP='UPDATE' AND NEW.tenant_id<>OLD.tenant_id THEN RAISE EXCEPTION 'HR_MODE_TENANT_IMMUTABLE';END IF;
 PERFORM 1 FROM public.tenant_module_config WHERE tenant_id=NEW.tenant_id FOR UPDATE;
 PERFORM 1 FROM public.tenants WHERE id=NEW.tenant_id FOR UPDATE;
 NEW.changed_at:=statement_timestamp();RETURN NEW;
END $$;
CREATE TRIGGER hr_access_mode_guard BEFORE INSERT OR UPDATE OR DELETE ON public.company_hr_access_modes FOR EACH ROW EXECUTE FUNCTION public.hr_access_mode_guard();
REVOKE ALL ON FUNCTION public.hr_access_mode_guard() FROM PUBLIC,anon,authenticated,service_role;

ALTER FUNCTION public.hr_directory_v1(uuid,uuid,uuid) RENAME TO hr_legacy_directory_internal_v1;
ALTER FUNCTION public.hr_create_record_v1(uuid,uuid,uuid,jsonb) RENAME TO hr_legacy_create_internal_v1;
ALTER FUNCTION public.hr_workplace_command_v1(uuid,uuid,uuid,jsonb) RENAME TO hr_legacy_workplace_internal_v1;
REVOKE ALL ON FUNCTION public.hr_legacy_directory_internal_v1(uuid,uuid,uuid),public.hr_legacy_create_internal_v1(uuid,uuid,uuid,jsonb),public.hr_legacy_workplace_internal_v1(uuid,uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.hr_directory_v1(p_actor uuid,p_tenant uuid,p_after uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE mode text:=public.hr_access_mode_v1(p_actor,p_tenant);
BEGIN
 -- Company managers retain explicit administrative access. Nonmanagers never OR legacy roles with custom grants.
 IF mode='legacy' OR public.current_user_role()='yonetici' THEN RETURN public.hr_legacy_directory_internal_v1(p_actor,p_tenant,p_after);END IF;
 RETURN public.hr_scoped_directory_v1(p_actor,p_tenant,p_after);
END $$;
CREATE FUNCTION public.hr_create_record_v1(p_actor uuid,p_tenant uuid,p_command uuid,p_payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='5s' AS $$
BEGIN
 IF current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION 'ACCESS_ISOLATION';END IF;
 PERFORM public.hr_access_mode_v1(p_actor,p_tenant);
 PERFORM 1 FROM public.tenant_module_config WHERE tenant_id=p_tenant FOR UPDATE;
 PERFORM 1 FROM public.profiles WHERE id=p_actor FOR SHARE;
 PERFORM 1 FROM public.tenants WHERE id=p_tenant FOR UPDATE;
 IF public.hr_access_mode_v1(p_actor,p_tenant)='scoped' AND public.current_user_role()<>'yonetici' THEN RAISE EXCEPTION 'HR_SCOPED_API_REQUIRED';END IF;
 RETURN public.hr_legacy_create_internal_v1(p_actor,p_tenant,p_command,p_payload);
END $$;
CREATE FUNCTION public.hr_workplace_command_v1(p_actor uuid,p_tenant uuid,p_command uuid,p_payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='5s' AS $$
BEGIN
 IF current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION 'HR_ISOLATION_UNSUPPORTED';END IF;
 PERFORM public.hr_access_mode_v1(p_actor,p_tenant);
 PERFORM 1 FROM public.tenant_module_config WHERE tenant_id=p_tenant FOR UPDATE;
 PERFORM 1 FROM public.profiles WHERE id=p_actor FOR SHARE;
 PERFORM 1 FROM public.tenants WHERE id=p_tenant FOR UPDATE;
 IF public.hr_access_mode_v1(p_actor,p_tenant)='scoped' AND public.current_user_role()<>'yonetici' THEN RAISE EXCEPTION 'HR_SCOPED_API_REQUIRED';END IF;
 RETURN public.hr_legacy_workplace_internal_v1(p_actor,p_tenant,p_command,p_payload);
END $$;
REVOKE ALL ON FUNCTION public.hr_directory_v1(uuid,uuid,uuid),public.hr_create_record_v1(uuid,uuid,uuid,jsonb),public.hr_workplace_command_v1(uuid,uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.hr_directory_v1(uuid,uuid,uuid),public.hr_create_record_v1(uuid,uuid,uuid,jsonb),public.hr_workplace_command_v1(uuid,uuid,uuid,jsonb) TO authenticated;

-- Expose one mode-guarded entry point per new operation; implementation bodies remain private.
ALTER FUNCTION public.hr_scoped_employee_create_v1(uuid,uuid,uuid,bigint,jsonb) RENAME TO hr_scoped_employee_create_internal_v1;
ALTER FUNCTION public.hr_scoped_location_transfer_v1(uuid,uuid,uuid,bigint,jsonb) RENAME TO hr_scoped_location_transfer_internal_v1;
ALTER FUNCTION public.hr_scoped_create_options_v1(uuid,uuid,text) RENAME TO hr_scoped_create_options_internal_v1;
CREATE FUNCTION public.hr_scoped_employee_create_v1(p_actor uuid,p_tenant uuid,p_command uuid,p_revision bigint,p_payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='5s' AS $$
BEGIN
 IF current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION 'ACCESS_ISOLATION';END IF;
 PERFORM public.hr_access_mode_v1(p_actor,p_tenant);
 PERFORM 1 FROM public.tenant_module_config WHERE tenant_id=p_tenant FOR UPDATE;
 PERFORM 1 FROM public.profiles WHERE id=p_actor FOR SHARE;
 PERFORM 1 FROM public.tenants WHERE id=p_tenant FOR UPDATE;
 IF public.hr_access_mode_v1(p_actor,p_tenant)<>'scoped' THEN RAISE EXCEPTION 'HR_SCOPED_MODE_REQUIRED';END IF;
 RETURN public.hr_scoped_employee_create_internal_v1(p_actor,p_tenant,p_command,p_revision,p_payload);
END $$;
CREATE FUNCTION public.hr_scoped_location_transfer_v1(p_actor uuid,p_tenant uuid,p_command uuid,p_revision bigint,p_payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='5s' AS $$
BEGIN
 IF current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION 'ACCESS_ISOLATION';END IF;
 PERFORM public.hr_access_mode_v1(p_actor,p_tenant);
 PERFORM 1 FROM public.tenant_module_config WHERE tenant_id=p_tenant FOR UPDATE;
 PERFORM 1 FROM public.profiles WHERE id=p_actor FOR SHARE;
 PERFORM 1 FROM public.tenants WHERE id=p_tenant FOR UPDATE;
 IF public.hr_access_mode_v1(p_actor,p_tenant)<>'scoped' THEN RAISE EXCEPTION 'HR_SCOPED_MODE_REQUIRED';END IF;
 RETURN public.hr_scoped_location_transfer_internal_v1(p_actor,p_tenant,p_command,p_revision,p_payload);
END $$;
CREATE FUNCTION public.hr_scoped_create_options_v1(p_actor uuid,p_tenant uuid,p_after text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF public.hr_access_mode_v1(p_actor,p_tenant)<>'scoped' THEN RAISE EXCEPTION 'HR_SCOPED_MODE_REQUIRED';END IF;
 RETURN public.hr_scoped_create_options_internal_v1(p_actor,p_tenant,p_after);
END $$;
REVOKE ALL ON FUNCTION public.hr_scoped_employee_create_v1(uuid,uuid,uuid,bigint,jsonb),public.hr_scoped_location_transfer_v1(uuid,uuid,uuid,bigint,jsonb),public.hr_scoped_create_options_v1(uuid,uuid,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.hr_scoped_employee_create_v1(uuid,uuid,uuid,bigint,jsonb),public.hr_scoped_location_transfer_v1(uuid,uuid,uuid,bigint,jsonb),public.hr_scoped_create_options_v1(uuid,uuid,text) TO authenticated;
-- Settings consumers must not continue calling an enforced HR configuration preview-only.
ALTER FUNCTION public.company_access_settings_v1(uuid,uuid) RENAME TO company_access_settings_internal_v1;
REVOKE ALL ON FUNCTION public.company_access_settings_internal_v1(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.company_access_settings_v1(p_actor uuid,p_tenant uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 result:=public.company_access_settings_internal_v1(p_actor,p_tenant);
 IF public.hr_access_mode_v1(p_actor,p_tenant)='scoped' THEN result:=jsonb_set(result,'{enforcement}','"hr_scoped"');END IF;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.company_access_settings_v1(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.company_access_settings_v1(uuid,uuid) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
