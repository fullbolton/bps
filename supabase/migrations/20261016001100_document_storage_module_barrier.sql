-- Authenticated object INSERT shares the tenant configuration write barrier.
-- This does not enable module disabling; the eventual closer must take config
-- FOR UPDATE and recheck blockers in that transaction before changing settings.
BEGIN;
SET LOCAL lock_timeout='15s';
DO $guard$ BEGIN
 IF (SELECT md5(prosrc) FROM pg_proc WHERE oid=to_regprocedure('public.document_storage_retired_path_v1()')) IS DISTINCT FROM 'c1aa60dc750f0a5632fd420c7b67191d' THEN
  RAISE EXCEPTION 'STORAGE_BARRIER_BODY_DRIFT';
 END IF;
END $guard$;
CREATE OR REPLACE FUNCTION public.document_storage_retired_path_v1() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='5s' AS $$
DECLARE tenant uuid;modules text[]:=ARRAY['documents'];
BEGIN
 IF NEW.bucket_id<>'documents' THEN RETURN NEW;END IF;
 -- Storage's authenticated JWT path joins the same config barrier as RPC writes.
 -- Service/admin maintenance retains its existing policy bypass, but not tombstones.
 IF auth.role()='authenticated' THEN
  tenant:=public.current_user_verified_tenant();
  IF EXISTS(SELECT FROM public.contract_pdf_upload_commands WHERE storage_path=NEW.name AND tenant_id=tenant) THEN
   modules:=ARRAY['documents','contracts'];
  END IF;
  PERFORM public.workspace_require_module_write_v1(tenant,modules);
  PERFORM 1 FROM public.profiles WHERE id=auth.uid() FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'UPLOAD_SCOPE' USING ERRCODE='42501';END IF;
  -- Fresh snapshot after any wait; RLS alone uses the outer INSERT snapshot.
  PERFORM public.workspace_require_module_write_v1(tenant,modules);
  IF NOT public.document_storage_insert_allowed_v1(NEW.bucket_id,NEW.name,NEW.owner_id) THEN
   RAISE EXCEPTION 'UPLOAD_RESERVATION_SCOPE' USING ERRCODE='42501';
  END IF;
 END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(NEW.name,716));
 IF EXISTS(SELECT FROM public.document_cleanup_jobs WHERE storage_path=NEW.name) THEN
  RAISE EXCEPTION 'DOCUMENT_PATH_RETIRED' USING ERRCODE='23514';END IF;
 RETURN NEW;
END $$;
COMMIT;
