-- General company document metadata creation events. No historical backfill.
-- Deploy the document:created frontend parser before applying this migration.
-- Metadata + event commit together; this is not verification of Storage bytes.
BEGIN;
SET LOCAL lock_timeout='15s';
CREATE TABLE public.company_document_events (
 document_id uuid PRIMARY KEY,
 tenant_id uuid NOT NULL,
 company_id uuid NOT NULL,
 actor_id uuid NOT NULL,
 name text NOT NULL,
 recorded_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX company_document_events_recent_idx ON public.company_document_events(tenant_id,recorded_at DESC,document_id DESC);
ALTER TABLE public.company_document_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.company_document_events FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.record_company_document_event() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 -- Sözleşme belgeleri kendi immutable version olaylarını kullanır.
 -- Dosyasız kayıtlar ve servis/import işlemleri yükleme olayı sayılmaz.
 IF NEW.contract_id IS NOT NULL OR NEW.storage_path IS NULL OR auth.uid() IS NULL THEN RETURN NEW; END IF;
 IF NEW.tenant_id IS DISTINCT FROM public.current_user_verified_tenant()
 OR NOT EXISTS(SELECT 1 FROM public.companies c WHERE c.id=NEW.company_id AND c.tenant_id=NEW.tenant_id)
 THEN RAISE EXCEPTION 'DOCUMENT_ACTIVITY_SCOPE'; END IF;
 INSERT INTO public.company_document_events(document_id,tenant_id,company_id,actor_id,name)
 VALUES(NEW.id,NEW.tenant_id,NEW.company_id,auth.uid(),NEW.name);
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.record_company_document_event() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER record_company_document_event AFTER INSERT ON public.documents
 FOR EACH ROW EXECUTE FUNCTION public.record_company_document_event();
CREATE OR REPLACE FUNCTION public.dashboard_activity(p_actor_id uuid,p_tenant_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_result jsonb;
BEGIN
 IF auth.uid() IS NULL OR p_actor_id IS DISTINCT FROM auth.uid()
 OR p_tenant_id IS NULL OR p_tenant_id IS DISTINCT FROM public.current_user_verified_tenant()
 THEN RAISE EXCEPTION 'ACTIVITY_SCOPE'; END IF;
 IF coalesce(public.current_user_role(),'') NOT IN ('yonetici','operasyon') THEN RAISE EXCEPTION 'ACTIVITY_FORBIDDEN'; END IF;
 -- Each source is bounded before merging. Baseline imports are not user actions.
 WITH operations AS (
 SELECT 'ops:'||e.id::text AS id,e.created_at AS at,'ops:'||e.kind AS kind,
 coalesce(
  (SELECT l.name FROM public.ops_locations l WHERE l.id=e.entity_id AND l.tenant_id=e.tenant_id AND e.kind IN ('location','location_import','directory_active')),
  (SELECT w.name FROM public.ops_workers w WHERE w.id=e.entity_id AND w.tenant_id=e.tenant_id AND e.kind IN ('worker','directory_active')),
  (SELECT r.position||' · '||r.work_date::text FROM public.ops_daily_requests r WHERE r.id=e.entity_id AND r.tenant_id=e.tenant_id AND e.kind IN ('request','request_batch','resize','cancel')),
  (SELECT w.name||' · '||a.work_date::text FROM public.ops_assignments a JOIN public.ops_workers w ON w.id=a.worker_id AND w.tenant_id=a.tenant_id WHERE a.id=e.entity_id AND a.tenant_id=e.tenant_id AND e.kind IN ('assign','remove','attendance'))
 ) AS title,
 CASE WHEN e.kind IN ('location','location_import','worker','directory_active') THEN '/talepler/dizin' ELSE '/talepler/gunluk' END AS href
 FROM public.ops_events e WHERE e.tenant_id=p_tenant_id ORDER BY e.created_at DESC,id DESC LIMIT 20
 ), task_events AS (
 SELECT 'task:'||h.task_id::text||':'||h.revision::text AS id,h.recorded_at AS at,'task:'||h.kind AS kind,
 t.title,'/gorevler'::text AS href
 FROM public.task_assignment_history h JOIN public.tasks t ON t.id=h.task_id AND t.tenant_id=h.tenant_id
 WHERE h.tenant_id=p_tenant_id AND h.kind<>'baseline' ORDER BY h.recorded_at DESC,id DESC LIMIT 20
 ), document_events AS (
 SELECT 'pdf:'||v.id::text AS id,v.recorded_at AS at,'pdf:upload'::text AS kind,
 v.name AS title,'/sozlesmeler/'||v.contract_id::text AS href
 FROM public.contract_document_versions v JOIN public.contracts c ON c.id=v.contract_id AND c.tenant_id=v.tenant_id AND c.company_id=v.company_id
 WHERE v.tenant_id=p_tenant_id AND v.origin='upload' ORDER BY v.recorded_at DESC,v.id DESC LIMIT 20
 ), company_document_events AS (
 SELECT 'document:'||e.document_id::text AS id,e.recorded_at AS at,'document:created'::text AS kind,
 e.name AS title,'/evraklar'::text AS href
 FROM public.company_document_events e
 JOIN public.documents d ON d.id=e.document_id AND d.tenant_id=e.tenant_id AND d.company_id=e.company_id
 JOIN public.companies c ON c.id=e.company_id AND c.tenant_id=e.tenant_id
 WHERE e.tenant_id=p_tenant_id
 ORDER BY e.recorded_at DESC,e.document_id DESC LIMIT 20
 ), recent AS (
 SELECT * FROM operations UNION ALL SELECT * FROM task_events UNION ALL SELECT * FROM document_events UNION ALL SELECT * FROM company_document_events
 ), limited AS (SELECT * FROM recent ORDER BY at DESC,id DESC LIMIT 20)
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'at',at,'kind',kind,'title',title,'href',href) ORDER BY at DESC,id DESC),'[]'::jsonb) INTO v_result FROM limited;
 RETURN v_result;
END $$;
REVOKE ALL ON FUNCTION public.dashboard_activity(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.dashboard_activity(uuid,uuid) TO authenticated;
COMMIT;
