# BPS Design Tokens

This document defines the token vocabulary for the BPS design system. Tokens are semantic names for visual values. No implementation code — only definitions.

---

## 1. Semantic Color Tokens

### Interactive

| Token | Tailwind | Hex | Usage |
|-------|----------|-----|-------|
| interactive-default | blue-600 | #2563eb | Primary buttons, active tab border, links |
| interactive-hover | blue-700 | #1d4ed8 | Button hover, link hover |
| interactive-focus | blue-500 | #3b82f6 | Focus ring (ring-2) |
| interactive-muted | blue-50 | #eff6ff | Badge background for "in-progress" statuses |

### Positive (Green)

| Token | Tailwind | Hex | Usage |
|-------|----------|-----|-------|
| positive-surface | green-50 | #f0fdf4 | Badge background for aktif, tamamlandı, tam, stabil |
| positive-text | green-700 | #15803d | Badge text, fulfilled count text |
| positive-accent | green-500 | #22c55e | Dot indicators, inline +N values |
| positive-ring | green-600/20 | — | Badge ring |

### Warning (Amber)

| Token | Tailwind | Hex | Usage |
|-------|----------|-----|-------|
| warning-surface | amber-50 | #fffbeb | Badge background for yaklaşıyor, takip_gerekli, beklemede |
| warning-text | amber-700 | #b45309 | Badge text, expiry ≤30 days |
| warning-accent | amber-500 | #f59e0b | Dot indicators, alert icons |
| warning-ring | amber-600/20 | — | Badge ring |

### Danger (Red)

| Token | Tailwind | Hex | Usage |
|-------|----------|-----|-------|
| danger-surface | red-50 | #fef2f2 | Badge background for süresi_doldu, feshedildi, gecikti, iptal |
| danger-text | red-700 | #b91c1c | Badge text, expiry ≤15 days, açık kalan > 0 |
| danger-accent | red-500 | #ef4444 | Dot indicators, notification badge |
| danger-secondary | red-400 | #f87171 | Secondary danger (süresi doldu dot in checklist) |
| danger-strong | red-600 | #dc2626 | Emphasis text (gecikmiş, critical gap) |
| danger-ring | red-600/20 | — | Badge ring |

### Neutral

| Token | Tailwind | Hex | Usage |
|-------|----------|-----|-------|
| neutral-surface | slate-100 | #f1f5f9 | Badge background for pasif, default state |
| neutral-text | slate-600 | #475569 | Badge text for neutral states |
| neutral-ring | slate-500/20 | — | Badge ring |

### Accent (Limited Use)

| Token | Tailwind | Hex | Usage |
|-------|----------|-----|-------|
| accent-surface | purple-50 | #faf5ff | TaskSourceBadge "manuel" only |
| accent-text | purple-700 | #7e22ce | TaskSourceBadge "manuel" text |
| accent-ring | purple-500/20 | — | Badge ring |

---

## 2. Surface Tokens

| Token | Tailwind | Usage |
|-------|----------|-------|
| surface-canvas | bg-slate-50 | Page background |
| surface-primary | bg-white | Cards, modals, panels, table body |
| surface-header | bg-slate-50 | Table header, input background (topbar search) |
| surface-sidebar | bg-slate-900 | Sidebar navigation |
| surface-overlay-light | bg-black/20 | Panel backdrop |
| surface-overlay-dark | bg-black/30 | Modal backdrop |

---

## 3. Text Tokens

| Token | Tailwind | Usage |
|-------|----------|-------|
| text-primary | text-slate-900 | Page titles, KPI values, entity names |
| text-body | text-slate-700 | Table cells, descriptions, form values |
| text-secondary | text-slate-500 | Subtitles, labels, metadata |
| text-muted | text-slate-400 | Placeholders, timestamps, captions |
| text-disabled | text-slate-300 | Disabled tabs, disabled actions |
| text-inverse | text-white | Sidebar text, primary button text |
| text-link | text-blue-600 | Clickable links |
| text-link-hover | text-blue-700 | Link hover (or hover:underline) |

---

## 4. Border Tokens

| Token | Tailwind | Usage |
|-------|----------|-------|
| border-default | border-slate-200 | Cards, inputs, table wrapper, tab underline |
| border-subtle | border-slate-100 | List item dividers, table row dividers |
| border-sidebar | border-slate-700 | Sidebar internal dividers |
| border-focus | ring-blue-500 | Focus ring on inputs |

---

## 5. Typography Scale

| Token | Size | Weight | Line Height | Tailwind |
|-------|------|--------|-------------|----------|
| type-page-title | 20px | 600 | 1.4 | text-xl font-semibold |
| type-section-title | 16px | 600 | 1.5 | text-base font-semibold |
| type-card-title | 14px | 500 | 1.4 | text-sm font-medium |
| type-body | 14px | 400 | 1.5 | text-sm |
| type-label | 12px | 500 | 1.3 | text-xs font-medium |
| type-caption | 12px | 400 | 1.3 | text-xs |
| type-badge | 12px | 500 | 1.0 | text-xs font-medium |
| type-kpi-value | 24px | 600 | 1.2 | text-2xl font-semibold |
| type-table-header | 12px | 500 | 1.3 | text-xs font-medium uppercase tracking-wider |

---

## 6. Spacing Scale

| Token | Value | Tailwind | Common Usage |
|-------|-------|----------|-------------|
| space-micro | 2px | 0.5 | Micro adjustments |
| space-xs | 4px | 1 | Icon-text gap in badges |
| space-sm | 6px | 1.5 | Badge padding, tight gaps |
| space-md | 8px | 2 | List item padding, small gaps |
| space-default | 10px | 2.5 | Definition list row spacing |
| space-lg | 12px | 3 | Card title margin, filter gaps |
| space-xl | 16px | 4 | Card padding, section gaps, form spacing |
| space-2xl | 20px | 5 | Detail section padding |
| space-3xl | 24px | 6 | Page header bottom margin |

---

## 7. Radius Scale

| Token | Value | Tailwind | Usage |
|-------|-------|----------|-------|
| radius-sm | 6px | rounded-md | Buttons, inputs, dropdown menus |
| radius-default | 8px | rounded-lg | Cards, table wrapper, modals |
| radius-full | 9999px | rounded-full | Badges, chips, avatar circles |

---

## 8. Elevation / Shadow Rules

| Level | Shadow | Usage |
|-------|--------|-------|
| flat | none | Default card state (border-only) |
| hover | shadow-sm | Interactive card hover only |
| dropdown | shadow-lg | Action menus, dropdown menus |
| overlay | shadow-xl | Modals, slide-in panels |

**Rule**: BPS uses border-defined elevation. Shadows are functional, not decorative.

---

## 9. Z-Index Stack

| Token | Value | Usage |
|-------|-------|-------|
| z-base | 0 | Normal content flow |
| z-topbar | 20 | Topbar (fixed) |
| z-sidebar | 30 | Sidebar (fixed) |
| z-dropdown | 40 | Table action menus, dropdowns |
| z-overlay | 50 | Modal/panel overlays and content |

---

## 10. Table Density Tokens

| Token | Value | Usage |
|-------|-------|-------|
| table-cell-px | px-4 (16px) | Horizontal cell padding |
| table-cell-py | py-3 (12px) | Vertical cell padding |
| table-header-bg | bg-slate-50 | Header row background |
| table-header-text | text-xs font-medium text-slate-500 uppercase | Header text |
| table-body-text | text-sm text-slate-700 | Body cell text |
| table-divider | divide-slate-100 | Row dividers |
| table-hover | hover:bg-slate-50 | Clickable row hover |
| table-page-size | 20 | Default rows per page |

---

## 11. Form Density Tokens

| Token | Value | Usage |
|-------|-------|-------|
| input-px | px-3 (12px) | Horizontal input padding |
| input-py | py-2 (8px) | Vertical input padding |
| input-text | text-sm | Input text size |
| input-border | border border-slate-200 | Input border |
| input-radius | rounded-md | Input border radius |
| input-focus | focus:ring-2 focus:ring-blue-500 focus:border-transparent | Focus state |
| label-text | text-sm font-medium text-slate-700 | Label styling |
| label-gap | mb-1 | Gap between label and input |
| field-gap | space-y-4 | Gap between field groups |
| field-pair-gap | gap-3 | Gap in 2-column field layouts |

---

## 12. Badge Mapping Guidance

### Status Badges (StatusBadge)

| Status Value | Color Family | Background | Text | Ring |
|-------------|-------------|------------|------|------|
| aktif, tamamlandi, tam, tamamen_doldu | positive | green-50 | green-700 | green-600/20 |
| taslak, imza_bekliyor, degerlendiriliyor, devam_ediyor, planlandi, yeni | interactive | blue-50 | blue-700 | blue-600/20 |
| aday, beklemede, kismi_doldu, suresi_yaklsiyor, ertelendi, acik | warning | amber-50 | amber-700 | amber-600/20 |
| suresi_doldu, feshedildi, gecikti, iptal, eksik | danger | red-50 | red-700 | red-600/20 |
| pasif | neutral | slate-100 | slate-600 | slate-500/20 |

### Risk Badges (RiskBadge)

| Risk Value | Color Family | Dot Color |
|-----------|-------------|-----------|
| dusuk | positive | green-500 |
| orta | warning | amber-500 |
| yuksek | danger | red-500 |

### Priority Badges (PriorityBadge)

| Priority Value | Color Family | Notes |
|---------------|-------------|-------|
| dusuk | neutral | slate tones |
| normal | interactive | blue tones |
| yuksek | warning | amber tones |
| kritik | danger | red tones |

No dot indicator — text pill only. Shared across talep and görev.

### Task Source Badges (TaskSourceBadge)

| Source Value | Color Family | Icon |
|-------------|-------------|------|
| manuel | accent (purple) | PenLine |
| randevu | interactive (blue) | CalendarCheck |
| sozlesme | neutral (slate) | FileText |

Icon at 12px, inline with label.

### Workforce Risk Badges (WorkforceRiskBadge)

| Risk Value | Color Family | Dot Color |
|-----------|-------------|-----------|
| stabil | positive | green-500 |
| takip_gerekli | warning | amber-500 |
| kritik_acik | danger | red-500 |

Same visual pattern as RiskBadge — dot + label pill. Different domain semantics.
