"use client";

import { useState, useMemo, useEffect } from "react";
import type { ColumnDef, SortState, RowAction } from "@/types/ui";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { clsx } from "clsx";
import EmptyState from "./EmptyState";
import TableRowActions from "./TableRowActions";
import {
  TABLE_WRAPPER,
  TABLE_HEADER_BG,
  TABLE_HEADER_TEXT,
  TABLE_BODY_TEXT,
  TABLE_DIVIDER_HEAD,
  TABLE_DIVIDER_BODY,
  TABLE_ROW_HOVER,
  TABLE_PAGE_SIZE,
  TYPE_BODY,
  SURFACE_PRIMARY,
  BORDER_DEFAULT,
  RADIUS_SM,
  TEXT_BODY,
  TEXT_DISABLED,
} from "@/styles/tokens";

interface DataTableProps<T extends object> {
  columns: ColumnDef<T>[];
  data: T[];
  rowKey: keyof T & string;
  onRowClick?: (row: T) => void;
  rowActions?: RowAction<T>[];
  emptyTitle?: string;
  emptyDescription?: string;
  pageSize?: number;
  /** Opt-in loading state. When true, shows a loading skeleton instead of data. */
  loading?: boolean;
}

export default function DataTable<T extends object>({
  columns,
  data,
  rowKey,
  onRowClick,
  rowActions,
  emptyTitle = "Veri bulunamadı",
  emptyDescription,
  pageSize = TABLE_PAGE_SIZE,
  loading = false,
}: DataTableProps<T>) {
  const [sort, setSort] = useState<SortState | null>(null);
  const dataKey = JSON.stringify([pageSize, data.map(row => String(row[rowKey]))]);
  const [pagination, setPagination] = useState({key: dataKey, page: 0});
  useEffect(() => { setPagination({key:dataKey,page:0}); }, [dataKey]);
  const setPage = (update: (page:number)=>number) => setPagination(previous => ({key:dataKey,page:update(previous.key===dataKey?previous.page:0)}));

  const sortedData = useMemo(() => {
    if (!sort) return data;
    return [...data].sort((a, b) => {
      const aVal = (a as Record<string, unknown>)[sort.key];
      const bVal = (b as Record<string, unknown>)[sort.key];
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      const cmp = typeof aVal === "number" && typeof bVal === "number" ? aVal - bVal : String(aVal).localeCompare(String(bVal), "tr");
      return sort.direction === "asc" ? cmp : -cmp;
    });
  }, [data, sort]);

  const totalPages = Math.max(1, Math.ceil(sortedData.length / pageSize));
  const page = pagination.key === dataKey ? Math.min(pagination.page,totalPages-1) : 0;
  const pagedData = sortedData.slice(page * pageSize, (page + 1) * pageSize);

  function handleSort(key: string) {
    setPage(() => 0);
    setSort((prev) => {
      if (prev?.key !== key) return { key, direction: "asc" };
      if (prev.direction === "asc") return { key, direction: "desc" };
      return null;
    });
  }

  if (loading) {
    return (
      <div role="status" aria-label="Liste yükleniyor" className={`${TABLE_WRAPPER} overflow-hidden`}>
        <div className={`${TABLE_HEADER_BG} h-10`} />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex gap-4 px-4 py-3 border-t border-slate-100">
            {columns.map((col) => (
              <div
                key={col.key}
                className="h-4 bg-slate-100 rounded animate-pulse flex-1"
              />
            ))}
          </div>
        ))}
      </div>
    );
  }

  if (data.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} size="page" />;
  }

  return (
    <div>
      <div tabIndex={0} role="region" aria-label="Kayıt tablosu, yatay kaydırılabilir" className={`overflow-x-auto ${TABLE_WRAPPER}`}>
        <table className={`min-w-full ${TABLE_DIVIDER_HEAD}`}>
          <thead className={TABLE_HEADER_BG}>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={clsx(
                    TABLE_HEADER_TEXT,
                    col.sortable && "cursor-pointer select-none hover:text-slate-700"
                  )}
                  style={col.width ? { width: col.width } : undefined}
                  scope="col"
                  aria-sort={col.sortable ? sort?.key === col.key ? sort.direction === "asc" ? "ascending" : "descending" : "none" : undefined}
                >
                  <button type="button" disabled={!col.sortable} onClick={()=>handleSort(col.key)}
                    className="flex min-h-11 items-center gap-1 text-left disabled:cursor-default">
                    {col.header}
                    {col.sortable && (
                      <>
                        {sort?.key === col.key ? (
                          sort.direction === "asc" ? (
                            <ArrowUp size={14} />
                          ) : (
                            <ArrowDown size={14} />
                          )
                        ) : (
                          <ArrowUpDown size={14} className={TEXT_DISABLED} />
                        )}
                      </>
                    )}
                  </button>
                </th>
              ))}
              {onRowClick && <th scope="col" className="w-16"><span className="sr-only">Detay</span></th>}
              {rowActions && rowActions.length > 0 && (
                <th scope="col" className="w-14 px-2 py-3"><span className="sr-only">İşlemler</span></th>
              )}
            </tr>
          </thead>
          <tbody className={`${SURFACE_PRIMARY} ${TABLE_DIVIDER_BODY}`}>
            {pagedData.map((row) => {
              const rec = row as Record<string, unknown>;
              const key = String(rec[rowKey]);
              return (
                <tr
                  key={key}
                  onClick={() => onRowClick?.(row)}
                  className={clsx(
                    "transition-colors",
                    onRowClick && `cursor-pointer ${TABLE_ROW_HOVER}`
                  )}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={TABLE_BODY_TEXT}
                    >
                      {col.render
                        ? col.render(rec[col.key] as T[keyof T], row)
                        : (rec[col.key] as React.ReactNode) ?? "—"}
                    </td>
                  ))}
                  {onRowClick && <td className="px-2 py-2"><button type="button" onClick={e=>{e.stopPropagation();onRowClick(row);}} className="min-h-11 rounded-lg px-3 text-sm font-medium text-blue-700 hover:bg-blue-50">Detay</button></td>}
                  {rowActions && rowActions.length > 0 && <td className="px-2 py-2"><TableRowActions row={row} actions={rowActions}/></td>}

                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {sortedData.length > 0 && (
        <div className={`flex flex-wrap items-center justify-between gap-3 mt-4 ${TYPE_BODY} ${TEXT_BODY}`}>
          <span>
            {sortedData.length} kayıttan {page * pageSize + 1}–
            {Math.min((page + 1) * pageSize, sortedData.length)} gösteriliyor
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className={`min-h-11 px-3 py-2 border ${BORDER_DEFAULT} ${RADIUS_SM} hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              Önceki
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className={`min-h-11 px-3 py-2 border ${BORDER_DEFAULT} ${RADIUS_SM} hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              Sonraki
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
