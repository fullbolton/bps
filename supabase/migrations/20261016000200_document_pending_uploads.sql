-- Read-only recovery inventory. Storage presence is not content validation.
BEGIN;
SET LOCAL lock_timeout='15s';
CREATE FUNCTION public.document_pending_uploads_v1(p_tenant uuid,p_offset integer DEFAULT 0)
RETURNS TABLE(document_id uuid,tenant_id uuid,document_name text,company_name text,created_at timestamptz,file_present boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=auth.uid();role_name text:=public.current_user_role();
BEGIN
 IF actor IS NULL OR p_tenant IS NULL OR p_tenant IS DISTINCT FROM public.current_user_verified_tenant()
 OR role_name IS NULL OR role_name NOT IN ('yonetici','operasyon','ik') THEN
  RAISE EXCEPTION 'UPLOAD_LIST_SCOPE' USING ERRCODE='42501';END IF;
 IF NOT public.workspace_module_enabled_v1('documents') THEN RAISE EXCEPTION 'UPLOAD_MODULE_CLOSED' USING ERRCODE='BM001';END IF;
 IF p_offset IS NULL OR p_offset<0 OR p_offset>10000000 OR p_offset%50<>0 THEN RAISE EXCEPTION 'UPLOAD_LIST_OFFSET' USING ERRCODE='22023';END IF;
 RETURN QUERY SELECT a.document_id,a.tenant_id,a.name,c.name,a.created_at,
  EXISTS(SELECT FROM storage.objects o WHERE o.bucket_id='documents' AND o.name=a.storage_path)
 FROM public.document_upload_attempts a
 LEFT JOIN public.companies c ON c.id=a.company_id AND c.tenant_id=a.tenant_id
 WHERE a.tenant_id=p_tenant AND a.published_at IS NULL AND (role_name='yonetici' OR a.actor_id=actor)
 ORDER BY a.created_at DESC,a.document_id LIMIT 51 OFFSET p_offset;
END $$;
REVOKE ALL ON FUNCTION public.document_pending_uploads_v1(uuid,integer) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.document_pending_uploads_v1(uuid,integer) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
