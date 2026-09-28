/** Product configuration, never a replacement for membership or record authorization. */
export const MODULE_CATALOG_VERSION = 1;
export const MODULE_CATALOG = [
  { key: 'customers', name: 'Müşteriler', description: 'Firma, yetkili ve şube bilgileri.', requires: [], enhances: [] },
  { key: 'tasks', name: 'Görevler', description: 'Ekip işleri, sorumlular ve tamamlanma takibi.', requires: [], enhances: ['customers'] },
  { key: 'calendar', name: 'Takvim ve görüşmeler', description: 'Firma randevuları ve görüşme takvimi.', requires: ['customers'], enhances: ['tasks'] },
  { key: 'documents', name: 'Belgeler', description: 'Firma belgeleri, klasörler ve evrak takibi.', requires: ['customers'], enhances: [] },
  { key: 'contracts', name: 'Sözleşmeler', description: 'Sözleşmeler, ekleri ve yenileme takibi.', requires: ['customers', 'documents'], enhances: ['tasks'] },
  { key: 'talent', name: 'Personel havuzu', description: 'Adaylar, görüşmeler, listeler ve dosya aktarımı.', requires: [], enhances: ['staffing'] },
  { key: 'staffing', name: 'Personel operasyonu', description: 'Personel talepleri, görevlendirme ve işe başlama takibi.', requires: ['customers'], enhances: ['talent'] },
  { key: 'reporting', name: 'Proje raporlama', description: 'Dışarıda yürütülen projelerin çalışma raporları.', requires: ['customers'], enhances: ['staffing'] },
  { key: 'finance', name: 'Finansal özet', description: 'Firma finansal verileri ve Luca aktarımları.', requires: ['customers'], enhances: ['contracts'] },
  { key: 'announcements', name: 'Duyurular', description: 'Şirket içi duyurular ve paylaşımlar.', requires: [], enhances: [] },
] as const;

export type ModuleKey = typeof MODULE_CATALOG[number]['key'];
export type ModuleStates = Readonly<Record<ModuleKey, boolean>>;
export type ModuleDefinition = {
  readonly key: string;
  readonly requires: readonly string[];
  readonly enhances: readonly string[];
};

export function isModuleKey(value: unknown): value is ModuleKey {
  return typeof value === 'string' && MODULE_CATALOG.some(module => module.key === value);
}

/** CI/generation guard: optional enhancements may cycle; hard dependencies may not. */
export function validateModuleCatalog(catalog: readonly ModuleDefinition[]): void {
  const byKey = new Map(catalog.map(module => [module.key, module]));
  if (!catalog.length || byKey.size !== catalog.length) throw Error('MODULE_CATALOG_KEYS');
  for (const module of catalog) {
    if (!/^[a-z][a-z0-9_]*$/.test(module.key)) throw Error('MODULE_CATALOG_KEYS');
    for (const edges of [module.requires, module.enhances]) {
      if (new Set(edges).size !== edges.length || edges.some(key => key === module.key || !byKey.has(key))) throw Error('MODULE_CATALOG_EDGE');
    }
    if (module.requires.some(key => module.enhances.includes(key))) throw Error('MODULE_CATALOG_EDGE');
  }
  const visiting = new Set<string>(), visited = new Set<string>();
  function visit(key: string) {
    if (visiting.has(key)) throw Error('MODULE_CATALOG_CYCLE');
    if (visited.has(key)) return;
    visiting.add(key);
    for (const dependency of byKey.get(key)!.requires) visit(dependency);
    visiting.delete(key);
    visited.add(key);
  }
  for (const key of byKey.keys()) visit(key);
}

/** A complete state is required. Missing/unknown/non-boolean keys are not defaults. */
export function parseModuleStates(value: unknown): ModuleStates {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('MODULE_CONFIG_RESPONSE');
  const record = value as Record<string, unknown>;
  if (Object.keys(record).length !== MODULE_CATALOG.length || Object.keys(record).some(key => !isModuleKey(key))) throw Error('MODULE_CONFIG_RESPONSE');
  const result: Partial<Record<ModuleKey, boolean>> = {};
  for (const module of MODULE_CATALOG) {
    if (!Object.hasOwn(record, module.key) || typeof record[module.key] !== 'boolean') throw Error('MODULE_CONFIG_RESPONSE');
    result[module.key] = record[module.key] as boolean;
  }
  const states = result as ModuleStates;
  if (missingModuleDependencies(states).length) throw Error('MODULE_CONFIG_DEPENDENCY');
  return Object.freeze(states);
}

export function missingModuleDependencies(states: ModuleStates): { module: ModuleKey; requires: ModuleKey }[] {
  return MODULE_CATALOG.flatMap(module => !states[module.key] ? [] :
    module.requires.filter(key => !states[key]).map(key => ({ module: module.key, requires: key })));
}

/** Preview only. This neither changes stored settings nor checks open business work. */
export function requiredModuleClosure(selected: readonly ModuleKey[]): ModuleKey[] {
  const required = new Set<ModuleKey>();
  function visit(key: ModuleKey) {
    if (!isModuleKey(key)) throw Error('MODULE_UNKNOWN');
    if (required.has(key)) return;
    required.add(key);
    for (const dependency of MODULE_CATALOG.find(module => module.key === key)!.requires) visit(dependency);
  }
  selected.forEach(visit);
  return MODULE_CATALOG.filter(module => required.has(module.key)).map(module => module.key);
}
