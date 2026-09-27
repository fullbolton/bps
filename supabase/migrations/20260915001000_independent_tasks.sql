-- Company-free manual tasks stay inside their verified workspace.
BEGIN;
SET LOCAL lock_timeout='15s';
LOCK TABLE public.tasks IN ACCESS EXCLUSIVE MODE;
ALTER TABLE public.tasks ALTER COLUMN company_id DROP NOT NULL;
ALTER TABLE public.tasks ADD CONSTRAINT tasks_independent_context_check CHECK (
 company_id IS NOT NULL OR (contract_id IS NULL AND appointment_id IS NULL AND source_type='manuel' AND source_ref IS NULL)
);
-- Preserve company-task policies; new null-company rows cannot rely on a stale tenant claim.
CREATE POLICY tasks_independent_scope_fence ON public.tasks AS RESTRICTIVE FOR ALL TO authenticated
USING (company_id IS NOT NULL OR (tenant_id=public.current_user_verified_tenant() AND public.current_user_role() IN ('yonetici','operasyon','ik')))
WITH CHECK (company_id IS NOT NULL OR (tenant_id=public.current_user_verified_tenant() AND public.current_user_role() IN ('yonetici','operasyon','ik')));
NOTIFY pgrst,'reload schema';
COMMIT;
