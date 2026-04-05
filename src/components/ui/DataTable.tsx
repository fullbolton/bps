"use client";

import { useState, useMemo } from "react";
import type { ColumnDef, SortState, RowAction } from "@/types/ui";
import { ArrowUpDown, ArrowUp, ArrowDown, MoreVertical } from "lucide-react";
import { clsx } from "clsx";
import EmptyState from "./EmptyState";
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
  TEXT_MUTED,
  TEXT_DISABLED,
  Z_DROPDOWN,
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
  const [page, setPage] = useState(0);
  const [openActionRow, setOpenActionRow] = useState<string | null>(null);

  const sortedData = useMemo(() => {
    if (!sort) return data;
    return [...data].sort((a, b) => {
      const aVal = (a as Record<string, unknown>)[sort.key];
      const bVal = (b as Record<string, unknown>)[sort.key];
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      const cmp = String(aVal).localeCompare(String(bVal), "tr");
      return sort.direction === "asc" ? cmp : -cmp;
    });
  }, [data, sort]);

  const totalPages = Math.max(1, Math.ceil(sortedData.length / pageSize));
  const pagedData = sortedData.slice(page * pageSize, (page + 1) * pageSize);

  function handleSort(key: string) {
    setSort((prev) => {
      if (prev?.key !== key) return { key, direction: "asc" };
      if (prev.direction === "asc") return { key, direction: "desc" };
      return null;
    });
  }

  if (loading) {
    return (
      <div className={`${TABLE_WRAPPER} overflow-hidden`}>
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
      <div className={`overflow-x-auto ${TABLE_WRAPPER}`}>
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
                  onClick={() => col.sortable && handleSort(col.key)}
                >
                  <span className="flex items-center gap-1">
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
                  </span>
                </th>
              ))}
              {rowActions && rowActions.length > 0 && (
                <th className="w-10 px-2 py-3" />
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
                  {rowActions && rowActions.length > 0 && (
                    <td className="px-2 py-3 relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenActionRow(openActionRow === key ? null : key);
                        }}
                        className={`p-1 rounded hover:bg-slate-100 ${TEXT_MUTED} hover:text-slate-600`}
                      >
                        <MoreVertical size={16} />
                      </button>
                      {openActionRow === key && (
                        <div className={`absolute right-2 top-full mt-1 w-44 ${SURFACE_PRIMARY} border ${BORDER_DEFAULT} ${RADIUS_SM} shadow-lg py-1 ${Z_DROPDOWN}`}>
                          {rowActions.map((action) => {
                            const isDisabled = action.isDisabled?.(row) ?? false;
                            return (
                              <button
                                key={action.label}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (isDisabled) return;
                                  action.onClick(row);
                                  setOpenActionRow(null);
                                }}
                                disabled={isDisabled}
                                className={clsx(
                                  `w-full text-left px-3 py-2 ${TEXT_BODY} flex items-center gap-2`,
                                  isDisabled
                                    ? `${TEXT_DISABLED} cursor-not-allowed`
                                    : `${TEXT_BODY} hover:bg-slate-50`
                                )}
                              >
                                {action.icon}
                                {action.label}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className={`flex items-center justify-between mt-4 ${TYPE_BODY} ${TEXT_BODY}`}>
          <span>
            {sortedData.length} kayıttan {page * pageSize + 1}–
            {Math.min((page + 1) * pageSize, sortedData.length)} gösteriliyor
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className={`px-3 py-1.5 border ${BORDER_DEFAULT} ${RADIUS_SM} hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              Önceki
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className={`px-3 py-1.5 border ${BORDER_DEFAULT} ${RADIUS_SM} hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              Sonraki
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
