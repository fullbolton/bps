import { istanbulDay } from "./istanbul-day";
import type { EvrakDurumu } from "@/types/ui";

export function isDocumentValidityDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000-")) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** Calendar validity uses the Istanbul civil day, with an inclusive 30-day warning. */
export function documentStatusForFile(validityDate: string | null, now = new Date()): EvrakDurumu {
  if (!validityDate) return "tam";
  if (!isDocumentValidityDate(validityDate)) throw new Error("Geçersiz belge tarihi.");
  const day = istanbulDay(now);
  const today = new Date(`${day}T00:00:00Z`).getTime();
  const days = (new Date(`${validityDate}T00:00:00Z`).getTime() - today) / 86400000;
  return days < 0 ? "suresi_doldu" : days <= 30 ? "suresi_yaklsiyor" : "tam";
}

/** Stored missing status is an explicit operator decision. Calendar states for
 * existing dated files are derived on read; no database update is necessary. */
export function currentDocumentStatus(document: {status: EvrakDurumu; storage_path: string | null; validity_date: string | null}, now = new Date()): EvrakDurumu {
  if (document.status === "eksik" || !document.storage_path) return "eksik";
  if (!document.validity_date) return document.status;
  return documentStatusForFile(document.validity_date, now);
}

export function withCurrentDocumentStatus<T extends {status: EvrakDurumu; storage_path: string | null; validity_date: string | null}>(document: T, now = new Date()): T {
  return {...document, status: currentDocumentStatus(document, now)};
}
