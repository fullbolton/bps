-- SELECT policies must work in PostgREST read-only transactions.
-- DELETE keeps the existing configuration lock; reads use a separate stable predicate.
BEGIN;
SET LOCAL lock_timeout='15s';
SET LOCAL search_path='';
LOCK TABLE storage.objects IN ACCESS EXCLUSIVE MODE;
CREATE FUNCTION public.talent_attachment_cleanup_read_v1(p_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT (public.current_workspace_modules_v1()->'modules'->>'talent')::boolean
 AND EXISTS(SELECT 1 FROM public.talent_attachments a WHERE a.id=p_id AND a.actor_id=auth.uid()
 AND a.tenant_id=public.current_user_verified_tenant() AND a.cancelled AND NOT a.ready
 AND (public.current_user_role() IN ('yonetici','ik') OR (public.current_user_role()='operasyon' AND a.category<>'onboarding')))
$$;
REVOKE ALL ON FUNCTION public.talent_attachment_cleanup_read_v1(uuid) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.talent_attachment_cleanup_read_v1(uuid) TO authenticated;
DO $patch$
DECLARE item record;actual text;definition text;
BEGIN
 FOR item IN SELECT * FROM (VALUES
 ('person_files_cancel_read','0663dffb49aba3b3ed2dc97f7fbe11b87ce4228b16d9cf7c37617dd080690312',true),
 ('person_files_read_fence','39c1dd50b04473b654aa2e6b3741caec8f31a7914d6c2142af3b9ba4a350781d',false)
 ) p(name,hash,permissive) LOOP
  SELECT pg_get_expr(polqual,polrelid) INTO actual FROM pg_policy
   WHERE polrelid='storage.objects'::regclass AND polname=item.name AND polcmd='r'
   AND polpermissive=item.permissive AND polroles=ARRAY['authenticated'::regrole::oid];
  IF actual IS NULL OR encode(sha256(convert_to(actual,'UTF8')),'hex')<>item.hash THEN
   RAISE EXCEPTION 'TALENT_STORAGE_READ_POLICY_DRIFT: %',item.name;
  END IF;
  definition:=replace(actual,'public.talent_attachment_can_cleanup(','public.talent_attachment_cleanup_read_v1(');
  EXECUTE format('ALTER POLICY %I ON storage.objects USING (%s)',item.name,definition);
 END LOOP;
END $patch$;
COMMIT;
