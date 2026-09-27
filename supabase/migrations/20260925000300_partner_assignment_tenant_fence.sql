BEGIN;
SET LOCAL lock_timeout='15s';
CREATE POLICY partner_assignments_tenant_fence ON public.partner_company_assignments AS RESTRICTIVE FOR ALL TO authenticated
 USING (tenant_id=public.current_user_verified_tenant())
 WITH CHECK (tenant_id=public.current_user_verified_tenant()
 AND public.is_active_tenant_member(partner_user_id)
 AND EXISTS(SELECT 1 FROM public.companies c WHERE c.id=partner_company_assignments.company_id AND c.tenant_id=partner_company_assignments.tenant_id));
COMMENT ON POLICY partner_assignments_tenant_fence ON public.partner_company_assignments IS 'Existing manager/self permissions are additionally fenced to live tenant membership. New assignments require a same-tenant company and member. No grants expanded.';
COMMIT;
