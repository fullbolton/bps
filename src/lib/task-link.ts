import { isUuid } from "./operations/pilot-validation";

export function taskLinkHref(id: string): string {
  if (!isUuid(id)) throw new Error("Invalid task id");
  return `/gorevler?${new URLSearchParams({ gorev: id })}`;
}
export function parseTaskLink(search: Pick<URLSearchParams, "getAll">): string | null {
  const ids = search.getAll("gorev");
  if (!ids.length) return null;
  if (ids.length !== 1 || !isUuid(ids[0])) throw new Error("Invalid task link");
  return ids[0].toLowerCase();
}
