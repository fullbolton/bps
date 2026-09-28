import type { WorkspaceModuleContext } from './context';

/** Display/query plan only; record access remains enforced by database policies. */
export function dashboardModuleAccess({modules, role}: Pick<WorkspaceModuleContext, 'modules' | 'role'>) {
  const commercial = ['yonetici', 'partner', 'operasyon'].includes(role);
  return {
    customers: modules.customers,
    tasks: modules.tasks && ['yonetici', 'operasyon', 'ik'].includes(role),
    contracts: modules.contracts && commercial,
    calendar: modules.calendar && commercial,
    documents: modules.documents && !['muhasebe', 'goruntuleyici'].includes(role),
    staffing: modules.staffing && ['yonetici', 'operasyon'].includes(role),
    finance: modules.finance && role === 'muhasebe',
    reporting: modules.reporting && role === 'goruntuleyici',
    announcements: modules.announcements && role !== 'muhasebe',
  };
}
