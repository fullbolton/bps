"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { taskLinkHref } from "@/lib/task-link";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, TaskRow } from "@/types/database.types";
import type { GorevDurumu } from "@/types/ui";
import { selectTasksByAppointmentId } from "@/lib/supabase/tasks";
import AsyncSection from "@/components/ui/AsyncSection";
import StatusBadge from "@/components/ui/StatusBadge";

/** The parent keys this reader by identity scope and appointment. */
export default function AppointmentTasks({ client, appointmentId }: { client: SupabaseClient<Database>; appointmentId: string }) {
  const [state, setState] = useState<{ status: "loading" | "error" | "ready"; rows: TaskRow[] }>({ status: "loading", rows: [] });
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setState({ status: "loading", rows: [] });
    void selectTasksByAppointmentId(client, appointmentId).then(rows => {
      if (active) setState({ status: "ready", rows });
    }).catch(() => {
      if (active) setState({ status: "error", rows: [] });
    });
    return () => { active = false; };
  }, [client, appointmentId, retry]);

  return <section aria-label="Bağlı görevler">
    <AsyncSection isLoading={state.status === "loading"} hasError={state.status === "error"}
      isEmpty={state.rows.length === 0} emptyText="Bu randevuya bağlı görev yok."
      onRetry={() => setRetry(value => value + 1)}>
      <ul className="space-y-2">
        {state.rows.map(task => <li key={task.id} className="rounded-xl border border-slate-200 p-3">
          <Link href={taskLinkHref(task.id)} className="mb-2 block min-h-11 break-words py-2 text-sm text-blue-700 underline underline-offset-4">{task.title}</Link>
          <StatusBadge status={task.status as GorevDurumu} />
        </li>)}
      </ul>
    </AsyncSection>
  </section>;
}
