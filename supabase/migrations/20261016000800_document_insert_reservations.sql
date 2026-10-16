BEGIN;
SET LOCAL lock_timeout='15s';
-- Metadata may only be published by the authenticated finalize commands.
CREATE POLICY documents_command_insert_only ON public.documents AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK(false);

-- Adds no permissive grant. Existing tenant policies, cancelled-path trigger,
-- reserved-object immutability and finalizer metadata checks remain in force.
CREATE FUNCTION public.document_storage_insert_allowed_v1(p_bucket text,p_path text,p_owner text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=auth.uid();tenant uuid:=public.current_user_verified_tenant();r text:=public.current_user_role();
BEGIN
 IF p_bucket<>'documents' THEN RETURN true;END IF;
 IF actor IS NULL OR tenant IS NULL OR p_owner IS DISTINCT FROM actor::text
 OR r IS NULL OR r NOT IN ('yonetici','operasyon','ik') OR NOT public.workspace_module_enabled_v1('documents') THEN RETURN false;END IF;
 IF EXISTS(SELECT FROM public.document_cleanup_jobs WHERE storage_path=p_path) THEN RETURN false;END IF;
 RETURN EXISTS(
  SELECT FROM public.document_upload_attempts a JOIN public.companies c ON c.id=a.company_id AND c.tenant_id=a.tenant_id
  WHERE a.storage_path=p_path AND a.actor_id=actor AND a.tenant_id=tenant AND a.published_at IS NULL AND c.status IS DISTINCT FROM 'pasif'
 ) OR (r='yonetici' AND public.workspace_module_enabled_v1('contracts') AND EXISTS(
  SELECT FROM public.contract_pdf_upload_commands u
  JOIN public.companies c ON c.id=u.company_id AND c.tenant_id=u.tenant_id
  JOIN public.contracts k ON k.id=u.contract_id AND k.company_id=u.company_id AND k.tenant_id=u.tenant_id
  WHERE u.storage_path=p_path AND u.actor_id=actor AND u.tenant_id=tenant AND u.state='pending' AND c.status IN ('aktif','aday')
 ));
END $$;
REVOKE ALL ON FUNCTION public.document_storage_insert_allowed_v1(text,text,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.document_storage_insert_allowed_v1(text,text,text) TO authenticated;
CREATE POLICY document_storage_reserved_insert ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated
 WITH CHECK(public.document_storage_insert_allowed_v1(bucket_id,name,owner_id));
NOTIFY pgrst,'reload schema';
COMMIT;
