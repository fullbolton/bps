import { companyModuleAccess } from './company-access';
import type { WorkspaceModuleContext } from './context';

/** Display/query plan only; record access remains enforced by database policies. */
export function dashboardModuleAccess({modules, role}: Pick<WorkspaceModuleContext, 'modules' | 'role'>) {
  const company = companyModuleAccess({modules,role});
  return {
    customers: modules.customers && role !== 'partner',
    tasks: modules.tasks && ['yonetici', 'operasyon', 'ik'].includes(role),
    contracts: company.contracts,
    calendar: company.calendar,
    documents: company.documents,
    staffing: modules.staffing && ['yonetici', 'operasyon'].includes(role),
    finance: modules.finance && role === 'muhasebe',
    reporting: modules.reporting && role === 'goruntuleyici',
    announcements: modules.announcements && role !== 'muhasebe',
  };
}
