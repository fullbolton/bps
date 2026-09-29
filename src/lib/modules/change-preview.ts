import { MODULE_CATALOG, isModuleKey, type ModuleKey } from '@/lib/modules/catalog';
import { parseWorkspaceModuleContext, type ModuleContextExpectation } from '@/lib/modules/context';

/** Known blockers only: no result from this preview authorizes a settings write. */
export const MODULE_CHANGE_CHECKS = [
  { module: 'tasks', code: 'unfinished_tasks', label: 'Tamamlanmamış görevler var.', href: '/gorevler' },
  { module: 'calendar', code: 'unfinished_appointments', label: 'Tamamlanmamış veya ertelenmiş randevular var.', href: '/randevular' },
  { module: 'contracts', code: 'unfinished_contracts', label: 'Aktif, taslak veya imza bekleyen sözleşmeler var.', href: '/sozlesmeler' },
  { module: 'talent', code: 'pending_talent_import', label: 'İşlenmeyi bekleyen personel aktarım satırları var.', href: '/personel-havuzu/aktarim' },
  { module: 'staffing', code: 'open_staffing_demands', label: 'Karşılanmamış personel talepleri var.', href: '/talepler' },
  { module: 'staffing', code: 'upcoming_requests', label: 'Bugün veya sonrası için personel talepleri var.', href: '/talepler/gunluk' },
  { module: 'staffing', code: 'upcoming_assignments', label: 'Bugün veya sonrası için görevlendirmeler var.', href: '/talepler/gunluk' },
  { module: 'staffing', code: 'unapproved_work', label: 'Onayı tamamlanmamış çalışma kayıtları var.', href: '/talepler' },
  { module: 'staffing', code: 'active_roster', label: 'Devam eden veya başlayacak sabit kadro kayıtları var.', href: '/talepler/kadro' },
  { module: 'staffing', code: 'active_schedules', label: 'Devam eden veya başlayacak tekrarlı planlar var.', href: '/talepler/planlar' },
  { module: 'reporting', code: 'open_reporting_periods', label: 'Kapatılmamış proje raporlama dönemleri var.', href: '/projeler' },
  { module: 'reporting', code: 'pending_reporting_imports', label: 'Onay bekleyen proje raporu aktarımları var.', href: '/projeler' },
  { module: 'customers', code: 'customer_linked_tasks', label: 'Firmalara bağlı tamamlanmamış görevler var.', href: '/gorevler' },
  { module: 'calendar', code: 'appointment_linked_tasks', label: 'Randevulara bağlı tamamlanmamış görevler var.', href: '/gorevler' },
  { module: 'contracts', code: 'contract_linked_tasks', label: 'Sözleşmelere bağlı tamamlanmamış görevler var.', href: '/gorevler' },
] as const;

export function parseModuleChangePreview(value: unknown, expected: ModuleContextExpectation, revision: string, requested: unknown) {
  const input = parseRequestedModules(requested);
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('MODULE_PREVIEW_RESPONSE');
  const data = value as Record<string, unknown>;
  const context = parseWorkspaceModuleContext(data.context, expected);
  if (context.role !== 'yonetici' || context.configRevision !== revision || data.schemaVersion !== 1
    || data.advisoryOnly !== true || data.mutationAvailable !== false
    || typeof data.assessmentDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(data.assessmentDate)) throw Error('MODULE_PREVIEW_RESPONSE');
  const actual = parseRequestedModules(data.requested);
  if (MODULE_CATALOG.some(m => actual[m.key] !== input[m.key])) throw Error('MODULE_PREVIEW_RESPONSE');
  const disabled = MODULE_CATALOG.filter(m => context.modules[m.key] && !input[m.key]).map(m => m.key).sort();
  if (!Array.isArray(data.disabled) || JSON.stringify(data.disabled) !== JSON.stringify(disabled)) throw Error('MODULE_PREVIEW_RESPONSE');
  const dependencies = MODULE_CATALOG.flatMap(m => input[m.key]
    ? m.requires.filter(key => !input[key]).map(key => ({ module: m.key, requires: key })) : [])
    .sort((a,b) => a.module.localeCompare(b.module) || a.requires.localeCompare(b.requires));
  if (!Array.isArray(data.dependencies) || data.dependencies.length !== dependencies.length
    || data.dependencies.some((v,i) => !v || v.module !== dependencies[i].module || v.requires !== dependencies[i].requires)) throw Error('MODULE_PREVIEW_RESPONSE');
  const definitions = MODULE_CHANGE_CHECKS.filter(check => disabled.includes(check.module));
  if (!Array.isArray(data.checks) || data.checks.length !== definitions.length) throw Error('MODULE_PREVIEW_RESPONSE');
  const checks = data.checks.map((item: unknown, index: number) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw Error('MODULE_PREVIEW_RESPONSE');
    const check = item as Record<string,unknown>, definition = definitions[index];
    if (check.code !== definition.code || check.module !== definition.module || typeof check.blocking !== 'boolean') throw Error('MODULE_PREVIEW_RESPONSE');
    return Object.freeze({...definition, blocking: check.blocking});
  });
  return Object.freeze({context, requested: input, disabled, dependencies, checks,
    assessmentDate: data.assessmentDate, advisoryOnly: true as const, mutationAvailable: false as const});
}

/** Unlike stored configuration, a draft may contain dependency violations to explain in the UI. */
export function parseRequestedModules(value: unknown): Readonly<Record<ModuleKey,boolean>> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('MODULE_PREVIEW_INPUT');
  const input = value as Record<string, unknown>;
  if (Object.keys(input).length !== MODULE_CATALOG.length || Object.keys(input).some(k => !isModuleKey(k))
    || MODULE_CATALOG.some(m => !Object.hasOwn(input,m.key) || typeof input[m.key] !== 'boolean')) throw Error('MODULE_PREVIEW_INPUT');
  return Object.freeze(Object.fromEntries(MODULE_CATALOG.map(m => [m.key,input[m.key]]))) as Readonly<Record<ModuleKey,boolean>>;
}
