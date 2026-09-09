-- Local acceptance first. A renewal task is explicit; legacy flags are not evidence.
BEGIN;
SET LOCAL lock_timeout='15s';
LOCK TABLE public.contracts,public.tasks IN ACCESS EXCLUSIVE MODE;
ALTER TABLE public.contracts ADD COLUMN revision bigint NOT NULL DEFAULT 0
  CHECK(revision BETWEEN 0 AND 9007199254740991);

CREATE TABLE public.contract_renewal_tasks (
  contract_id uuid PRIMARY KEY REFERENCES public.contracts(id) ON DELETE RESTRICT,
  task_id uuid NOT NULL UNIQUE REFERENCES public.tasks(id) ON DELETE RESTRICT,
  command_id uuid NOT NULL UNIQUE,
  tenant_id uuid NOT NULL,
  actor_id uuid NOT NULL,
  source_revision bigint NOT NULL,
  initial_assignee_id uuid NOT NULL,
  initial_due_date date NOT NULL,
  basis text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE public.contract_renewal_tasks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.contract_renewal_tasks FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.contracts_advance_revision() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF TG_OP='INSERT' THEN NEW.revision:=0;
  ELSE
    IF (NEW.id IS DISTINCT FROM OLD.id OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
        OR NEW.company_id IS DISTINCT FROM OLD.company_id)
       AND EXISTS(SELECT 1 FROM public.contract_renewal_tasks WHERE contract_id=OLD.id)
    THEN RAISE EXCEPTION 'RENEWAL_CONTEXT_IMMUTABLE'; END IF;
    NEW.revision:=OLD.revision+1;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER contracts_advance_revision BEFORE INSERT OR UPDATE ON public.contracts
FOR EACH ROW EXECUTE FUNCTION public.contracts_advance_revision();

CREATE FUNCTION public.tasks_guard_renewal_context() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF NEW.contract_id IS DISTINCT FROM OLD.contract_id
     AND EXISTS(SELECT 1 FROM public.contract_renewal_tasks WHERE task_id=OLD.id)
  THEN RAISE EXCEPTION 'RENEWAL_CONTEXT_IMMUTABLE'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER tasks_guard_renewal_context BEFORE UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.tasks_guard_renewal_context();

-- One statement snapshot. NULL means unavailable, never an empty renewal card.
CREATE FUNCTION public.contract_renewal_snapshot(p_actor_id uuid,p_tenant_id uuid,p_contract_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object(
   'contractId',c.id,'revision',c.revision,'companyStatus',co.status,
   'suggestedDate',coalesce(c.renewal_target_date,c.end_date),
   'task',CASE WHEN r.task_id IS NULL THEN NULL ELSE jsonb_build_object(
     'id',t.id,'title',t.title,'status',t.status,'dueDate',t.due_date,
     'assigneeId',t.assigned_to_user_id,'assigneeName',p.display_name,'basis',r.basis) END)
 FROM public.contracts c
 JOIN public.companies co ON co.id=c.company_id AND co.tenant_id=c.tenant_id
 LEFT JOIN public.contract_renewal_tasks r ON r.contract_id=c.id AND r.tenant_id=c.tenant_id
 LEFT JOIN public.tasks t ON t.id=r.task_id AND t.tenant_id=c.tenant_id AND t.company_id=c.company_id AND t.contract_id=c.id
 LEFT JOIN public.profiles p ON p.id=t.assigned_to_user_id
   AND EXISTS(SELECT 1 FROM public.tenant_memberships m WHERE m.user_id=p.id AND m.tenant_id=c.tenant_id)
 WHERE c.id=p_contract_id AND c.tenant_id=p_tenant_id
   AND p_actor_id=auth.uid() AND p_tenant_id=public.current_user_verified_tenant()
   AND public.current_user_role() IN ('yonetici','operasyon')
$$;

CREATE FUNCTION public.create_contract_renewal_task(
  p_actor_id uuid,p_tenant_id uuid,p_contract_id uuid,p_command_id uuid,
  p_revision bigint,p_assignee_id uuid,p_due_date date,p_basis text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET lock_timeout='5s' AS $$
DECLARE
  v_actor uuid:=auth.uid(); v_company uuid; v_company_status text;
  v_contract public.contracts%ROWTYPE; v_receipt public.contract_renewal_tasks%ROWTYPE;
  v_task uuid; v_name text;
  v_basis text:=btrim(p_basis,U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF');
BEGIN
  IF current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION 'RENEWAL_ISOLATION'; END IF;
  IF v_actor IS NULL OR p_actor_id IS DISTINCT FROM v_actor THEN RAISE EXCEPTION 'RENEWAL_SCOPE'; END IF;
  -- Cooperates with transfer/admin locks. Recheck live membership after waiting.
  PERFORM id FROM public.profiles WHERE id IN (v_actor,p_assignee_id) ORDER BY id FOR SHARE;
  IF p_tenant_id IS NULL OR p_tenant_id IS DISTINCT FROM public.current_user_verified_tenant() THEN RAISE EXCEPTION 'RENEWAL_SCOPE'; END IF;
  IF public.current_user_role() IS DISTINCT FROM 'yonetici' THEN RAISE EXCEPTION 'RENEWAL_FORBIDDEN'; END IF;
  IF p_contract_id IS NULL OR p_command_id IS NULL OR p_assignee_id IS NULL
    OR p_revision IS NULL OR p_revision NOT BETWEEN 0 AND 9007199254740990
    OR p_due_date IS NULL OR p_due_date NOT BETWEEN DATE '1900-01-01' AND DATE '9999-12-31'
    OR v_basis IS NULL OR length(v_basis) NOT BETWEEN 1 AND 2000 THEN RAISE EXCEPTION 'RENEWAL_VALIDATION'; END IF;

  SELECT company_id INTO v_company FROM public.contracts WHERE id=p_contract_id AND tenant_id=p_tenant_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'RENEWAL_SCOPE'; END IF;
  SELECT status INTO v_company_status FROM public.companies WHERE id=v_company AND tenant_id=p_tenant_id FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'RENEWAL_SCOPE'; END IF;
  SELECT * INTO v_contract FROM public.contracts WHERE id=p_contract_id AND tenant_id=p_tenant_id FOR UPDATE;
  IF NOT FOUND OR v_contract.company_id IS DISTINCT FROM v_company THEN RAISE EXCEPTION 'RENEWAL_CONFLICT'; END IF;

  SELECT * INTO v_receipt FROM public.contract_renewal_tasks WHERE contract_id=p_contract_id;
  IF FOUND THEN
    IF v_receipt.command_id IS DISTINCT FROM p_command_id OR v_receipt.actor_id IS DISTINCT FROM v_actor
       OR v_receipt.tenant_id IS DISTINCT FROM p_tenant_id OR v_receipt.source_revision IS DISTINCT FROM p_revision
       OR v_receipt.initial_assignee_id IS DISTINCT FROM p_assignee_id OR v_receipt.initial_due_date IS DISTINCT FROM p_due_date
       OR v_receipt.basis IS DISTINCT FROM v_basis THEN RAISE EXCEPTION 'RENEWAL_EXISTS'; END IF;
    -- Historical creation receipt remains valid after task transfer/closure or company deactivation.
    RETURN jsonb_build_object('commandId',p_command_id,'contractId',p_contract_id,'taskId',v_receipt.task_id);
  END IF;
  IF v_contract.revision<>p_revision THEN RAISE EXCEPTION 'RENEWAL_CONFLICT'; END IF;
  IF v_company_status IS NULL OR v_company_status NOT IN ('aday','aktif') THEN RAISE EXCEPTION 'RENEWAL_PASSIVE'; END IF;
  SELECT p.display_name INTO v_name FROM public.profiles p WHERE p.id=p_assignee_id
    AND p.role IN ('yonetici','operasyon','ik')
    AND EXISTS(SELECT 1 FROM public.tenant_memberships m WHERE m.user_id=p.id AND m.tenant_id=p_tenant_id);
  IF NOT FOUND THEN RAISE EXCEPTION 'RENEWAL_TARGET'; END IF;
  INSERT INTO public.tasks(tenant_id,company_id,contract_id,title,source_type,status,assigned_to_user_id,assigned_to,due_date,created_by)
  VALUES(p_tenant_id,v_company,p_contract_id,'Sözleşme yenileme: '||v_contract.name,'sozlesme','acik',p_assignee_id,v_name,to_char(p_due_date,'YYYY-MM-DD'),v_actor)
  RETURNING id INTO v_task;
  INSERT INTO public.contract_renewal_tasks(contract_id,task_id,command_id,tenant_id,actor_id,source_revision,initial_assignee_id,initial_due_date,basis)
  VALUES(p_contract_id,v_task,p_command_id,p_tenant_id,v_actor,p_revision,p_assignee_id,p_due_date,v_basis);
  RETURN jsonb_build_object('commandId',p_command_id,'contractId',p_contract_id,'taskId',v_task);
END $$;
REVOKE ALL ON FUNCTION public.contracts_advance_revision(),public.tasks_guard_renewal_context(),public.contract_renewal_snapshot(uuid,uuid,uuid),public.create_contract_renewal_task(uuid,uuid,uuid,uuid,bigint,uuid,date,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.contract_renewal_snapshot(uuid,uuid,uuid),public.create_contract_renewal_task(uuid,uuid,uuid,uuid,bigint,uuid,date,text) TO authenticated;
COMMIT;
