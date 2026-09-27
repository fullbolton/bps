"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { parseAppointmentLink } from "@/lib/appointment-link";

/** Resolves only against the successfully loaded, current-scope list. */
export default function AppointmentLinkOpener({ ready, appointmentIds, onOpen }: {
  ready: boolean; appointmentIds: string[]; onOpen: (id: string) => void;
}) {
  const search = useSearchParams();
  const router = useRouter();
  let id: string | null = null;
  let invalid = false;
  try { id = parseAppointmentLink(search); } catch { invalid = true; }
  const found = id !== null && appointmentIds.includes(id);
  const next = new URLSearchParams(search.toString());
  next.delete("randevu");
  const cleanHref = `/randevular${next.size ? `?${next}` : ""}`;
  useEffect(() => {
    if (id && ready && found) {
      onOpen(id);
      router.replace(cleanHref, { scroll: false });
    }
  }, [id, ready, found, cleanHref, onOpen, router]);
  if (!invalid && (!id || !ready || found)) return null;
  return <div role="alert" className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
    <p>{invalid ? "Randevu bağlantısı geçersiz." : "Randevu bulunamadı veya bu randevu için erişiminiz yok."}</p>
    <button type="button" className="mt-2 min-h-11 rounded-lg border border-amber-300 px-3"
      onClick={() => router.replace(cleanHref, { scroll: false })}>Bağlantıyı kapat</button>
  </div>;
}
