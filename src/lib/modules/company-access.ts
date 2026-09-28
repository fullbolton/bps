import type { WorkspaceModuleContext } from './context';

// Matches repository SELECT policies (20260827000300); does not grant access.
export function companyModuleAccess({modules, role}: Pick<WorkspaceModuleContext, 'modules' | 'role'>) {
  const operations = ['yonetici', 'operasyon'].includes(role);
  const people = operations || role === 'ik';
  return {
    contacts: modules.customers && operations,
    notes: modules.customers && people,
    contracts: modules.contracts && operations,
    calendar: modules.calendar && operations,
    demands: modules.staffing && operations,
    workforce: modules.staffing && people,
    documents: modules.documents && people,
    finance: modules.finance && ['yonetici', 'muhasebe'].includes(role),
    dailyPlan: modules.staffing && operations,
  };
}

export function companyModuleTabs(access: ReturnType<typeof companyModuleAccess>) {
  return [
    {key:'genel',label:'Genel Bakış'},
    ...(access.contacts ? [{key:'yetkililer',label:'Yetkililer'}] : []),
    ...(access.contracts ? [{key:'sozlesmeler',label:'Sözleşmeler'}] : []),
    ...(access.demands ? [{key:'talepler',label:'Talepler'}] : []),
    ...(access.workforce ? [{key:'aktif-isgucu',label:'Aktif İş Gücü'}] : []),
    ...(access.calendar ? [{key:'randevular',label:'Randevular'}] : []),
    ...(access.documents ? [{key:'evraklar',label:'Evraklar'}] : []),
    ...(access.notes ? [{key:'notlar',label:'Notlar'}] : []),
  ];
}
