import { isWorkDate } from "./daily-demand";
import { isUuid } from "./pilot-validation";
import type { PilotBoard, PilotCompany } from "./pilot-types";

export type TaskPrefillQuery = { companyId: string; requestId: string; date: string };
export type TaskPrefill = TaskPrefillQuery & { companyName: string; title: string; returnHref: string };

export function validateTaskPrefillQuery(raw: unknown): TaskPrefillQuery {
  const q = raw as Partial<TaskPrefillQuery> | null;
  if (!q || !isUuid(q.companyId) || !isUuid(q.requestId) || !isWorkDate(q.date) ||
      q.date < "2000-01-01" || q.date > "2100-12-31") throw new Error("OPS_VALIDATION");
  return { companyId: q.companyId, requestId: q.requestId, date: q.date };
}

/** The URL carries identifiers only. Names are resolved from scoped server reads. */
export function taskPrefillHref(raw: TaskPrefillQuery): string {
  const q = validateTaskPrefillQuery(raw);
  return `/gorevler?${new URLSearchParams({ firma: q.companyId, talep: q.requestId, gun: q.date })}`;
}

export function parseTaskPrefillSearch(search: Pick<URLSearchParams, "getAll">): TaskPrefillQuery | null {
  const keys = ["firma", "talep", "gun"];
  if (keys.every(key => search.getAll(key).length === 0)) return null;
  if (keys.some(key => search.getAll(key).length !== 1)) throw new Error("OPS_VALIDATION");
  return validateTaskPrefillQuery({ companyId: search.getAll("firma")[0], requestId: search.getAll("talep")[0], date: search.getAll("gun")[0] });
}

/** A form prefill, not an operations FK or an authorization boundary. */
export function buildTaskPrefill(raw: TaskPrefillQuery, companies: PilotCompany[], board: PilotBoard): TaskPrefill {
  const q = validateTaskPrefillQuery(raw);
  const company = companies.find(c => c.id === q.companyId);
  const request = board.requests.find(r => r.id === q.requestId && r.workDate === q.date);
  const location = board.locations.find(l => l.id === request?.locationId);
  if (!company || !request || !location) throw new Error("OPS_OUT_OF_SCOPE");
  if (!company.active) throw new Error("OPS_INACTIVE_COMPANY");
  if (request.lifecycle !== "active") throw new Error("OPS_REQUEST_NOT_ACTIVE");
  return {
    ...q, companyName: company.name,
    title: `${location.name} · ${q.date} · ${request.serviceLine} / ${request.position} — takip`,
    returnHref: `/talepler/gunluk?${new URLSearchParams({ firma: q.companyId, gun: q.date, talep: q.requestId })}#talep-${q.requestId}`,
  };
}
