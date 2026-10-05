// Historical Supabase default grants included service_role on private helpers.
// Remove that known grant, but stop on unexpected browser exposure or inherited access.
export function internalAcl(signatures,prefix){
 return signatures.map(signature=>` target:=to_regprocedure('${signature}');
 IF target IS NULL THEN RAISE EXCEPTION '${prefix}_MODULE_INTERNAL_MISSING';END IF;
 IF has_function_privilege('anon',target,'EXECUTE') OR has_function_privilege('authenticated',target,'EXECUTE') THEN
  RAISE EXCEPTION '${prefix}_MODULE_INTERNAL_ACL';
 END IF;
 EXECUTE format('REVOKE ALL ON FUNCTION %s FROM service_role',target);
 IF has_function_privilege('service_role',target,'EXECUTE') THEN RAISE EXCEPTION '${prefix}_MODULE_INTERNAL_INHERITED_ACL';END IF;`).join('\n');
}
