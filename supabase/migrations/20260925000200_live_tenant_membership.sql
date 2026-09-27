BEGIN;
SET LOCAL lock_timeout='15s';
-- All callers of the historical raw-claim helper now require current membership.
-- Signature and grants remain unchanged; token generation/role selection is not changed here.
CREATE OR REPLACE FUNCTION public.current_user_active_tenant() RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_claim text;v_tenant uuid;
BEGIN
 IF auth.uid() IS NULL THEN RETURN NULL;END IF;
 v_claim:=auth.jwt()->>'active_tenant_id';
 IF v_claim IS NULL OR v_claim='' THEN RETURN NULL;END IF;
 BEGIN v_tenant:=v_claim::uuid;EXCEPTION WHEN invalid_text_representation THEN RETURN NULL;END;
 IF EXISTS(SELECT 1 FROM public.tenant_memberships WHERE user_id=auth.uid() AND tenant_id=v_tenant) THEN RETURN v_tenant;END IF;
 RETURN NULL;
END $$;
COMMENT ON FUNCTION public.current_user_active_tenant() IS 'Returns the active_tenant_id claim only while the authenticated user has a current membership in that tenant. Missing, malformed and stale claims return NULL. No membership grants or company selection.';
COMMIT;
