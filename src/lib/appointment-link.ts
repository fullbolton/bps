import { isUuid } from "./operations/pilot-validation";

export function appointmentLinkHref(id: string): string {
  if (!isUuid(id)) throw new Error("Invalid appointment id");
  return `/randevular?${new URLSearchParams({ randevu: id })}`;
}
export function parseAppointmentLink(search: Pick<URLSearchParams, "getAll">): string | null {
  const ids = search.getAll("randevu");
  if (!ids.length) return null;
  if (ids.length !== 1 || !isUuid(ids[0])) throw new Error("Invalid appointment link");
  return ids[0].toLowerCase();
}
