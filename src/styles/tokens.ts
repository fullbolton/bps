/**
 * BPS Design Tokens
 *
 * Semantic token constants derived from docs/design/design-tokens.md.
 * Each value is a full Tailwind class string for parity-safe consumption.
 * No runtime logic — plain exported strings.
 */

// ---------------------------------------------------------------------------
// Semantic Colors — badge color groups (background + text + ring)
// ---------------------------------------------------------------------------

export const COLOR_POSITIVE = "bg-green-50 text-green-700 ring-green-600/20";
export const COLOR_INTERACTIVE = "bg-blue-50 text-blue-700 ring-blue-600/20";
export const COLOR_WARNING = "bg-amber-50 text-amber-700 ring-amber-600/20";
export const COLOR_DANGER = "bg-red-50 text-red-700 ring-red-600/20";
export const COLOR_NEUTRAL = "bg-slate-100 text-slate-600 ring-slate-500/20";
export const COLOR_ACCENT = "bg-purple-50 text-purple-700 ring-purple-500/20";

// Dot indicator colors (for badges with dot)
export const DOT_POSITIVE = "bg-green-500";
export const DOT_WARNING = "bg-amber-500";
export const DOT_DANGER = "bg-red-500";

// ---------------------------------------------------------------------------
// Surfaces
// ---------------------------------------------------------------------------

export const SURFACE_CANVAS = "bg-slate-50";
export const SURFACE_PRIMARY = "bg-white";
export const SURFACE_HEADER = "bg-slate-50";
export const SURFACE_OVERLAY_LIGHT = "bg-black/20";
export const SURFACE_OVERLAY_DARK = "bg-black/30";

// ---------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------

export const TEXT_PRIMARY = "text-slate-900";
export const TEXT_BODY = "text-slate-700";
export const TEXT_SECONDARY = "text-slate-500";
export const TEXT_MUTED = "text-slate-400";
export const TEXT_DISABLED = "text-slate-300";
export const TEXT_INVERSE = "text-white";
export const TEXT_LINK = "text-blue-600";

// ---------------------------------------------------------------------------
// Borders
// ---------------------------------------------------------------------------

export const BORDER_DEFAULT = "border-slate-200";
export const BORDER_SUBTLE = "border-slate-100";

// ---------------------------------------------------------------------------
// Typography composites
// ---------------------------------------------------------------------------

export const TYPE_PAGE_TITLE = "text-xl font-semibold";
export const TYPE_SECTION_TITLE = "text-base font-semibold";
export const TYPE_CARD_TITLE = "text-sm font-medium";
export const TYPE_BODY = "text-sm";
export const TYPE_LABEL = "text-xs font-medium";
export const TYPE_CAPTION = "text-xs";
export const TYPE_KPI_VALUE = "text-2xl font-semibold";
export const TYPE_TABLE_HEADER = "text-xs font-medium uppercase tracking-wider";

// ---------------------------------------------------------------------------
// Radius
// ---------------------------------------------------------------------------

export const RADIUS_SM = "rounded-md";
export const RADIUS_DEFAULT = "rounded-lg";
export const RADIUS_FULL = "rounded-full";

// ---------------------------------------------------------------------------
// Elevation / Shadow
// ---------------------------------------------------------------------------

export const SHADOW_NONE = "";
export const SHADOW_HOVER = "shadow-sm";
export const SHADOW_DROPDOWN = "shadow-lg";
export const SHADOW_OVERLAY = "shadow-xl";

// ---------------------------------------------------------------------------
// Z-Index
// ---------------------------------------------------------------------------

export const Z_TOPBAR = "z-20";
export const Z_SIDEBAR = "z-30";
export const Z_DROPDOWN = "z-40";
export const Z_OVERLAY = "z-50";

// ---------------------------------------------------------------------------
// Buttons
// ---------------------------------------------------------------------------

export const BUTTON_BASE = `flex items-center gap-1.5 px-3 py-2 ${TYPE_BODY} font-medium ${RADIUS_SM} transition-colors`;
export const BUTTON_PRIMARY = `${TEXT_INVERSE} bg-blue-600 hover:bg-blue-700`;
export const BUTTON_SECONDARY = `${TEXT_BODY} ${SURFACE_PRIMARY} border ${BORDER_DEFAULT} hover:bg-slate-50`;

// ---------------------------------------------------------------------------
// Right side panel
// ---------------------------------------------------------------------------

export const PANEL_OVERLAY = `fixed inset-0 ${SURFACE_OVERLAY_LIGHT} ${Z_DROPDOWN}`;
export const PANEL_CONTAINER = `fixed right-0 top-0 bottom-0 w-full max-w-md ${SURFACE_PRIMARY} ${SHADOW_OVERLAY} ${Z_OVERLAY} flex flex-col`;
export const PANEL_HEADER = `flex items-center justify-between px-5 h-14 border-b ${BORDER_DEFAULT} flex-shrink-0`;
export const PANEL_BODY = "flex-1 overflow-y-auto p-5";

// ---------------------------------------------------------------------------
// Table density
// ---------------------------------------------------------------------------

export const TABLE_CELL_PX = "px-4";
export const TABLE_CELL_PY = "py-3";
export const TABLE_HEADER_BG = SURFACE_HEADER;
export const TABLE_HEADER_TEXT = `${TABLE_CELL_PX} ${TABLE_CELL_PY} text-left ${TYPE_TABLE_HEADER} ${TEXT_SECONDARY}`;
export const TABLE_BODY_TEXT = `${TABLE_CELL_PX} ${TABLE_CELL_PY} ${TYPE_BODY} ${TEXT_BODY} whitespace-nowrap`;
export const TABLE_DIVIDER_HEAD = "divide-y divide-slate-200";
export const TABLE_DIVIDER_BODY = "divide-y divide-slate-100";
export const TABLE_ROW_HOVER = "hover:bg-slate-50";
export const TABLE_WRAPPER = `border ${BORDER_DEFAULT} ${RADIUS_DEFAULT}`;
export const TABLE_PAGE_SIZE = 20;

// ---------------------------------------------------------------------------
// Form density
// ---------------------------------------------------------------------------

export const INPUT_BASE = `w-full px-3 py-2 ${TYPE_BODY} border ${BORDER_DEFAULT} ${RADIUS_SM} focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent`;

// ---------------------------------------------------------------------------
// Modal
// ---------------------------------------------------------------------------

export const MODAL_OVERLAY = `fixed inset-0 ${SURFACE_OVERLAY_DARK} flex items-center justify-center ${Z_OVERLAY}`;
export const MODAL_CONTAINER = `${SURFACE_PRIMARY} ${RADIUS_DEFAULT} ${SHADOW_OVERLAY} w-full max-w-lg mx-4 flex flex-col max-h-[85vh]`;
export const MODAL_HEADER = `flex items-center justify-between px-5 py-4 border-b ${BORDER_DEFAULT} flex-shrink-0`;
export const MODAL_BODY = "flex-1 overflow-y-auto px-5 py-4";
export const MODAL_FOOTER = `px-5 py-3 border-t ${BORDER_DEFAULT} flex justify-end gap-2 flex-shrink-0`;

// ---------------------------------------------------------------------------
// Tab navigation
// ---------------------------------------------------------------------------

export const TAB_BASE = `px-4 py-2.5 ${TYPE_BODY} font-medium border-b-2 transition-colors whitespace-nowrap`;
export const TAB_ACTIVE = "border-blue-600 text-blue-600";
export const TAB_INACTIVE = `border-transparent ${TEXT_SECONDARY} hover:${TEXT_BODY} hover:border-slate-300`;
export const TAB_DISABLED = `border-transparent ${TEXT_DISABLED} cursor-not-allowed`;

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

export const EMPTY_SIZES = {
  page: "py-20",
  tab: "py-14",
  card: "py-8",
} as const;

export const EMPTY_ICON_SIZE = {
  page: "w-14 h-14",
  tab: "w-14 h-14",
  card: "w-10 h-10",
} as const;

export const EMPTY_ICON_PIXEL = {
  page: 28,
  tab: 28,
  card: 20,
} as const;

export const EMPTY_TITLE_SIZE = {
  page: "text-base",
  tab: "text-base",
  card: "text-sm",
} as const;

export const EMPTY_DESC_SIZE = {
  page: "text-sm",
  tab: "text-sm",
  card: "text-xs",
} as const;

export const EMPTY_ACTION_BUTTON = `mt-4 px-4 py-2 ${TYPE_BODY} font-medium ${TEXT_INVERSE} bg-blue-600 ${RADIUS_SM} hover:bg-blue-700 transition-colors`;
