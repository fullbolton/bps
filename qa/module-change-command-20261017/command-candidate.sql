-- LOCAL CANDIDATE ONLY. No client EXECUTE grant and not in the migration chain.
-- Enable only after write-boundary acceptance and release preflight.
BEGIN;
CREATE FUNCTION public.change_workspace_modules_v1(
 p_actor uuid,p_tenant uuid,p_membership_version uuid,p_selection_version uuid,
 p_revision text,p_command uuid,p_modules jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path='' SET lock_timeout='5s' AS $$
DECLARE context jsonb; assessment jsonb; fingerprint text;
 receipt public.tenant_module_changes; next_revision bigint;
BEGIN
 IF current_setting('transaction_isolation')<>'read committed' THEN
  RAISE EXCEPTION 'MODULE_ISOLATION' USING ERRCODE='25000';
 END IF;
 IF p_actor IS NULL OR auth.uid() IS DISTINCT FROM p_actor OR p_tenant IS NULL
  OR p_tenant IS DISTINCT FROM public.current_user_verified_tenant()
  OR p_command IS NULL OR p_membership_version IS NULL OR p_revision IS NULL THEN
  RAISE EXCEPTION 'MODULE_CHANGE_SCOPE' USING ERRCODE='42501';
 END IF;
 -- Same order as business commands: config, profile, then live membership snapshot.
 PERFORM 1 FROM public.tenant_module_config WHERE tenant_id=p_tenant FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'MODULE_CONFIG_MISSING' USING ERRCODE='55000';END IF;
 PERFORM 1 FROM public.profiles WHERE id=p_actor FOR SHARE;
 context:=public.current_workspace_modules_v1();
 IF context->>'actorId' IS DISTINCT FROM p_actor::text
  OR context->>'tenantId' IS DISTINCT FROM p_tenant::text
  OR context->>'role' IS DISTINCT FROM 'yonetici'
  OR context->>'membershipVersion' IS DISTINCT FROM p_membership_version::text
  OR context->>'selectionVersion' IS DISTINCT FROM p_selection_version::text THEN
  RAISE EXCEPTION 'MODULE_CHANGE_SCOPE' USING ERRCODE='42501';
 END IF;
 fingerprint:=encode(sha256(convert_to(jsonb_build_object(
  'actor',p_actor,'tenant',p_tenant,'membership',p_membership_version,
  'selection',p_selection_version,'revision',p_revision,'modules',p_modules)::text,'UTF8')),'hex');
 SELECT * INTO receipt FROM public.tenant_module_changes WHERE tenant_id=p_tenant AND command_id=p_command;
 IF FOUND THEN
  IF receipt.kind<>'settings' OR receipt.actor_id IS DISTINCT FROM p_actor OR receipt.request_hash<>fingerprint THEN
   RAISE EXCEPTION 'MODULE_COMMAND_REUSED' USING ERRCODE='22023';
  END IF;
  RETURN jsonb_build_object('commandId',p_command,'revision',receipt.after_revision::text,'replayed',true);
 END IF;
 -- Separate post-lock statement: committed work from a waiting writer is visible.
 assessment:=public.preview_workspace_modules_v1(p_actor,p_tenant,p_revision,p_modules);
 IF jsonb_array_length(assessment->'dependencies')>0 OR EXISTS(
  SELECT FROM jsonb_array_elements(assessment->'checks') c WHERE (c->>'blocking')::boolean
 ) THEN RAISE EXCEPTION 'MODULE_CHANGE_BLOCKED' USING ERRCODE='23514';END IF;
 IF context->'modules'=p_modules THEN RAISE EXCEPTION 'MODULE_CHANGE_EMPTY' USING ERRCODE='22023';END IF;
 UPDATE public.tenant_module_settings s SET enabled=(p_modules->>s.module_key)::boolean WHERE tenant_id=p_tenant;
 UPDATE public.tenant_module_config SET revision=revision+1,updated_at=clock_timestamp(),updated_by=p_actor
 WHERE tenant_id=p_tenant RETURNING revision INTO next_revision;
 INSERT INTO public.tenant_module_changes(tenant_id,command_id,actor_id,kind,request_hash,before_revision,after_revision,before_state,after_state)
 VALUES(p_tenant,p_command,p_actor,'settings',fingerprint,next_revision-1,next_revision,context->'modules',p_modules);
 RETURN jsonb_build_object('commandId',p_command,'revision',next_revision::text,'replayed',false);
END $$;
REVOKE ALL ON FUNCTION public.change_workspace_modules_v1(uuid,uuid,uuid,uuid,text,uuid,jsonb) FROM PUBLIC,anon,authenticated,service_role;
COMMIT;
