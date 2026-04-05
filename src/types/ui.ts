import type { ReactNode } from "react";

// --- Status & Badge Types ---

export type FirmaDurumu = "aday" | "aktif" | "pasif";
export type SozlesmeDurumu = "taslak" | "imza_bekliyor" | "aktif" | "suresi_doldu" | "feshedildi";
export type TalepDurumu = "yeni" | "degerlendiriliyor" | "kismi_doldu" | "tamamen_doldu" | "beklemede" | "iptal";
export type GorevDurumu = "acik" | "devam_ediyor" | "tamamlandi" | "gecikti" | "iptal";
export type EvrakDurumu = "tam" | "eksik" | "suresi_yaklsiyor" | "suresi_doldu";
export type RandevuDurumu = "planlandi" | "tamamlandi" | "iptal" | "ertelendi";

export type StatusType =
  | FirmaDurumu
  | SozlesmeDurumu
  | TalepDurumu
  | GorevDurumu
  | EvrakDurumu
  | RandevuDurumu;

export type RiskSeviyesi = "dusuk" | "orta" | "yuksek";

export type OncelikSeviyesi = "dusuk" | "normal" | "yuksek" | "kritik";

// --- DataTable Types ---

export interface ColumnDef<T> {
  key: keyof T & string;
  header: string;
  sortable?: boolean;
  render?: (value: T[keyof T], row: T) => ReactNode;
  width?: string;
}

export type SortDirection = "asc" | "desc";

export interface SortState {
  key: string;
  direction: SortDirection;
}

export interface RowAction<T> {
  label: string;
  onClick: (row: T) => void;
  icon?: ReactNode;
  isDisabled?: (row: T) => boolean;
}

// --- FilterBar Types ---

export type FilterType = "select" | "date" | "daterange";

export interface FilterOption {
  label: string;
  value: string;
}

export interface FilterConfig {
  key: string;
  label: string;
  type: FilterType;
  options?: FilterOption[];
  placeholder?: string;
}

export type FilterValues = Record<string, string>;

// --- TabNavigation Types ---

export interface TabItem {
  key: string;
  label: string;
  disabled?: boolean;
}

// --- PageHeader Types ---

export interface PageHeaderAction {
  label: string;
  onClick: () => void;
  variant?: "primary" | "secondary";
  icon?: ReactNode;
}

// --- Sidebar Types ---

export interface SidebarItem {
  key: string;
  label: string;
  href: string;
  icon: string;
}

// --- EmptyState Types ---

export type EmptyStateSize = "page" | "card" | "tab";
