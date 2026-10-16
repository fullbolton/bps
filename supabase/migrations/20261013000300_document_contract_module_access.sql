-- Partial module rollout: reads and contract-file commands. Raw document/contract
-- DML gateways and all closing blockers must land before module disabling opens.
BEGIN;
SET LOCAL lock_timeout='15s';
LOCK TABLE public.contracts,public.documents,public.contract_document_versions,storage.objects IN ACCESS EXCLUSIVE MODE;
DO $$ BEGIN
 IF EXISTS(SELECT FROM pg_class WHERE oid IN ('public.contracts'::regclass,'public.documents'::regclass,
  'public.contract_document_versions'::regclass,'storage.objects'::regclass) AND NOT relrowsecurity) THEN
  RAISE EXCEPTION 'DOCUMENT_MODULE_RLS_REQUIRED'; END IF;
END $$;
-- The other two path lookups already have unique indexes. General documents
-- did not; avoid scanning the whole document table for every Storage object.
CREATE INDEX documents_module_storage_path_idx ON public.documents(storage_path) WHERE storage_path IS NOT NULL;
CREATE POLICY contracts_module_read_v1 ON public.contracts AS RESTRICTIVE FOR SELECT TO authenticated
 USING(tenant_id=public.current_user_verified_tenant() AND (SELECT public.workspace_module_enabled_v1('contracts')));
CREATE POLICY documents_module_read_v1 ON public.documents AS RESTRICTIVE FOR SELECT TO authenticated
 USING(tenant_id=public.current_user_verified_tenant() AND (SELECT public.workspace_module_enabled_v1('documents'))
 AND (contract_id IS NULL OR (SELECT public.workspace_module_enabled_v1('contracts'))));
CREATE POLICY contract_versions_module_read_v1 ON public.contract_document_versions AS RESTRICTIVE FOR SELECT TO authenticated
 USING(tenant_id=public.current_user_verified_tenant() AND (SELECT public.workspace_module_enabled_v1('contracts')));

-- Stable, no write locks: Storage SELECT may run in a read-only transaction.
-- Existing permissive role/record policies still apply; this only restricts.
CREATE FUNCTION public.document_object_module_read_v1(p_bucket text,p_path text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT CASE WHEN p_bucket IS DISTINCT FROM 'documents' THEN true ELSE
  public.workspace_module_enabled_v1('documents')
  AND CASE WHEN p_path ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[^/]+$'
   THEN EXISTS(SELECT FROM public.companies c WHERE c.id=split_part(p_path,'/',1)::uuid
    AND c.tenant_id=public.current_user_verified_tenant()) ELSE false END
  AND NOT EXISTS(
   SELECT FROM public.documents d WHERE d.storage_path=p_path
    AND (d.tenant_id IS DISTINCT FROM public.current_user_verified_tenant()
      OR (d.contract_id IS NOT NULL AND NOT public.workspace_module_enabled_v1('contracts')))
  )
  AND NOT EXISTS(
   SELECT FROM public.contract_document_versions v WHERE v.storage_path=p_path
    AND (v.tenant_id IS DISTINCT FROM public.current_user_verified_tenant() OR NOT public.workspace_module_enabled_v1('contracts'))
  )
  AND NOT EXISTS(
   SELECT FROM public.contract_pdf_upload_commands u WHERE u.storage_path=p_path
    AND (u.tenant_id IS DISTINCT FROM public.current_user_verified_tenant() OR NOT public.workspace_module_enabled_v1('contracts'))
  ) END
$$;
REVOKE ALL ON FUNCTION public.document_object_module_read_v1(text,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.document_object_module_read_v1(text,text) TO authenticated;
CREATE POLICY documents_object_module_read_v1 ON storage.objects AS RESTRICTIVE FOR SELECT TO authenticated
 USING(public.document_object_module_read_v1(bucket_id,name));

-- Preserve ownership, ACL, volatility and the complete existing business body.
-- Hashes were measured on the local production-schema snapshot, not guessed.
DO $patch$
DECLARE item record; target oid; source text; definition text; replacement text;
BEGIN
 FOR item IN SELECT * FROM (VALUES
 ('public.contract_appendices(uuid,uuid,uuid,uuid)','0fab20b095b6772b912b9d6121af5fe115edac52255efb6711c163b9e75aa757','sql'),
 ('public.contract_document_history(uuid,uuid,uuid,uuid)','a6eee57ff3be65cbec62e0ec72717fc3399905c4802773f85074f13ed608160f','sql'),
 ('public.contract_document_version_path(uuid,uuid,uuid,uuid,uuid)','4975d7847188f6491d106a056162034d5d33e6ae3d629a41e5ef4e3402890012','sql'),
 ('public.contract_pdf_version_path(uuid,uuid,uuid)','0e702028ea6d6556327c4cb0452b52a03fcb94da9e597c24f4f02e8702efde7f','sql'),
 ('public.contract_pdf_versions(uuid,uuid,uuid)','7d8d30cd6921cca7610036c5d496a8ddae1071ff5f913e896003cbc6d45a4a3c','sql'),
 ('public.get_contract_pdf_upload(uuid,uuid,uuid,uuid)','97fff766c400aceffee4749fea601347652c28fd72a7ad5684ffbcddbae407cd','read'),
 ('public.prepare_contract_document_upload(uuid,uuid,uuid,uuid,uuid,bigint,text,integer,text,boolean,text,text)','a3c4b88de0d8376ee5bfea497fdb17875cd7715d6df5fd54cfbbf210a1e65d2c','write'),
 ('public.finish_contract_pdf_upload(uuid,uuid,uuid,uuid)','8562d53cb41d06d9b0ca69c4fcc4ea99c0047626acf177fa39f345f2ad9eb144','write')
 ) AS edits(signature,hash,kind) LOOP
  target:=to_regprocedure(item.signature);
  SELECT prosrc,pg_get_functiondef(oid) INTO source,definition FROM pg_proc WHERE oid=target;
  IF source IS NULL OR encode(sha256(convert_to(source,'UTF8')),'hex')<>item.hash THEN
   RAISE EXCEPTION 'DOCUMENT_MODULE_BODY_DRIFT: %',item.signature; END IF;
  IF item.kind='sql' THEN
   replacement:='SELECT CASE WHEN public.workspace_module_enabled_v1(''contracts'') THEN (' || rtrim(source,E' \n\r\t;') || ') END';
  ELSIF item.kind='read' THEN
   replacement:=regexp_replace(source,'\mBEGIN\M',E'BEGIN\n IF NOT public.workspace_module_enabled_v1(''contracts'') THEN RAISE EXCEPTION ''MODULE_DISABLED'' USING ERRCODE=''BM001''; END IF;');
  ELSE
   replacement:=regexp_replace(source,'\mBEGIN\M',E'BEGIN\n PERFORM public.workspace_require_module_write_v1(p_tenant_id,ARRAY[''contracts'']);');
  END IF;
  IF replacement=source OR (length(definition)-length(replace(definition,source,'')))/length(source)<>1 THEN
   RAISE EXCEPTION 'DOCUMENT_MODULE_PATCH_DRIFT: %',item.signature; END IF;
  EXECUTE replace(definition,source,replacement);
 END LOOP;
END $patch$;
NOTIFY pgrst,'reload schema';
COMMIT;
