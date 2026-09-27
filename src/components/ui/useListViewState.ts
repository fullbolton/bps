"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { listViewKey, normalizeListView, readListView, type ListViewState } from "@/lib/list-view-state";

/** Tab-local preferences only: never an authorization or data-query scope. */
export function useListViewState(list: string, scope: string | null, defaults: Record<string, string>) {
  const key = scope === null ? null : listViewKey(list, scope);
  const liveKey = useRef(key);
  liveKey.current = key;
  const [snapshot, setSnapshot] = useState<{ key: string | null; value: ListViewState } | null>(null);
  const latest = useRef(snapshot);
  useEffect(() => {
    let raw: string | null = null;
    if (key) { try { raw = sessionStorage.getItem(key); } catch { /* Private/blocked storage: use memory. */ } }
    const next = { key, value: readListView(raw, defaults) };
    latest.current = next;
    setSnapshot(next);
  }, [key, defaults]);

  const update = useCallback((change: (value: ListViewState) => ListViewState) => {
    // Ignore a delayed input callback from a previous identity/tenant.
    if (!key || liveKey.current !== key || latest.current?.key !== key) return;
    const value = normalizeListView(change(latest.current.value), defaults);
    const next = { key, value };
    latest.current = next;
    setSnapshot(next);
    try { sessionStorage.setItem(key, JSON.stringify(value)); } catch { /* The visible filter still works. */ }
  }, [key, defaults]);
  const setSearch = useCallback((search: string) => update(value => ({ ...value, search })), [update]);
  const setFilters = useCallback((change: Record<string, string> | ((filters: Record<string, string>) => Record<string, string>)) => {
    update(value => ({ ...value, filters: typeof change === "function" ? change(value.filters) : change }));
  }, [update]);
  const value = snapshot?.key === key && snapshot ? snapshot.value : normalizeListView(null, defaults);
  return { ...value, setSearch, setFilters, ready: key !== null && snapshot?.key === key };
}
