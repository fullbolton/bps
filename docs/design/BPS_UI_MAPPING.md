# BPS UI Component Mapping

Maps each current BPS component to the design system tokens, defines its visual role, density expectations, what should change, what must not change, and what product logic it must not absorb.

---

## PageHeader

**Visual Role**: Page-level title bar with optional action buttons.

**Layout Behavior**: Flex row — title/subtitle left, actions right. Bottom margin `mb-6` separates from content.

**Density**: Compact. Title `text-xl font-semibold`, subtitle `text-sm text-slate-500`. No padding — relies on page-level spacing.

**What Should Change**:
- Consider adding a subtle bottom border to separate from content visually
- Action button gap should be standardized to `gap-2`

**What Must Not Change**:
- Two-variant button system (primary blue, secondary white/border)
- Subtitle as `text-sm text-slate-500` — not heavier

**Must Not Absorb**: Breadcrumbs, search, filters, or tab navigation. Those are separate components below it.

---

## StatusBadge

**Visual Role**: Inline status indicator for any entity status value.

**Layout Behavior**: Inline-flex pill. Appears in table cells, headers, card lists.

**Density**: Compact. `text-xs` (sm) or `text-sm` (md). `px-2 py-0.5` (sm).

**What Should Change**:
- Centralize the STATUS_LABELS map so it's shared across screens instead of duplicated in each page file
- Consider extracting the color-lookup into a token-driven utility

**What Must Not Change**:
- One status value = one visual treatment everywhere
- `ring-1 ring-inset` border treatment
- `rounded-full` shape
- 5-color-group system (green/blue/amber/red/slate)

**Must Not Absorb**: Click handlers, tooltips, or contextual menus. A badge is read-only.

---

## RiskBadge

**Visual Role**: 3-level risk indicator with colored dot.

**Layout Behavior**: Inline-flex pill with dot + label. Appears in table cells, summary headers.

**Density**: Same as StatusBadge. Dot adds `w-1.5 h-1.5 rounded-full` with `gap-1.5`.

**What Should Change**:
- Extract shared badge anatomy (ring, radius, sizing) into a base utility or CSS class

**What Must Not Change**:
- 3-level system only (düşük/orta/yüksek)
- Dot indicator as distinguishing feature from StatusBadge
- green/amber/red color mapping

**Must Not Absorb**: Risk explanation, popup detail, or editable risk level. It's display-only.

---

## PriorityBadge

**Visual Role**: 4-level priority indicator (no dot).

**Layout Behavior**: Inline-flex pill. Same anatomy as StatusBadge minus the dot.

**Density**: Same `text-xs` sizing.

**What Should Change**:
- Slate for "düşük" is correct but could benefit from slightly more visual weight to distinguish from generic neutral badges

**What Must Not Change**:
- 4-level system (düşük/normal/yüksek/kritik)
- No dot — differentiates from RiskBadge
- Shared across talep + görev

**Must Not Absorb**: Priority editing or level explanation.

---

## TaskSourceBadge

**Visual Role**: Task origin identifier with icon + label.

**Layout Behavior**: Inline-flex pill with 12px icon. Slightly wider than other badges due to icon.

**Density**: `text-xs`, `px-2 py-0.5`.

**What Should Change**:
- Purple for "manuel" is the only non-semantic color in the system — acceptable but should remain the only exception

**What Must Not Change**:
- 3-source system (manuel/randevu/sözleşme) in Batch 4; talep/evrak later
- Icon as distinguishing feature
- Purple/blue/slate color mapping

**Must Not Absorb**: Source record linking or navigation.

---

## WorkforceRiskBadge

**Visual Role**: Workforce capacity risk indicator with colored dot.

**Layout Behavior**: Same anatomy as RiskBadge — dot + label pill.

**Density**: Same sizing.

**What Should Change**:
- Nothing currently — correctly mirrors RiskBadge pattern with domain-specific semantics

**What Must Not Change**:
- 3-level system (stabil/takip_gerekli/kritik_acik)
- Separate component from RiskBadge — different domain, different type
- green/amber/red mapping

**Must Not Absorb**: Workforce detail or capacity calculations.

---

## DataTable

**Visual Role**: Primary data grid for all list screens.

**Layout Behavior**: Full-width table with rounded border wrapper. Fixed table header, scrollable body.

**Density**: Tight. `px-4 py-3` cells. `text-xs uppercase` headers. 20 rows per page.

**What Should Change**:
- Loading skeleton could use consistent token-driven heights
- Action menu dropdown positioning should be consistent (currently right-aligned with `z-40`)
- Consider extracting pagination as a sub-component for reuse

**What Must Not Change**:
- Generic `<T extends object>` typing — no screen-specific table variants
- Sort → 3-state cycle (asc/desc/none)
- Row actions via MoreVertical dropdown
- EmptyState fallback when data is empty
- `pageSize = 20` default
- `hover:bg-slate-50` on clickable rows

**Must Not Absorb**: Inline editing, cell-level actions, column resizing, drag-and-drop reordering, expandable rows as built-in feature (handled at page level).

---

## EmptyState

**Visual Role**: Placeholder for empty data containers.

**Layout Behavior**: Centered column with icon circle, title, description, optional CTA.

**Density**: Three sizes — `page` (py-20), `tab` (py-14), `card` (py-8).

**What Should Change**:
- Nothing currently — well-structured with three clear size tiers

**What Must Not Change**:
- `card` size for inline/card usage
- Icon circle in `bg-slate-100 rounded-full`
- Consistent text hierarchy (`font-medium` title, `text-slate-500` description)

**Must Not Absorb**: Error states, loading states, or onboarding flows.

---

## TabNavigation

**Visual Role**: Horizontal tab switcher for detail pages.

**Layout Behavior**: Horizontal flex row with bottom-border indicator. Sits below summary header.

**Density**: Compact. `px-4 py-2.5` per tab. `text-sm font-medium`.

**What Should Change**:
- Active tab could use a slightly thicker border (`border-b-2` is correct, keep it)
- Consider adding subtle scroll behavior for many tabs on smaller screens

**What Must Not Change**:
- Bottom-border indicator (not pill, not background-fill)
- `border-blue-600 text-blue-600` active state
- `text-slate-300 cursor-not-allowed` disabled state
- No gap between tabs (`gap-0`)

**Must Not Absorb**: Tab content rendering. TabNavigation controls the indicator; the parent page renders content.

---

## ModalShell

**Visual Role**: Centered dialog frame.

**Layout Behavior**: Fixed overlay + centered white box. Three zones: header, body, footer.

**Density**: Generous for readability. `px-5 py-4` header/body, `px-5 py-3` footer.

**What Should Change**:
- Consider adding subtle `border-t border-slate-100` above footer for visual separation

**What Must Not Change**:
- Overlay click + Escape to close
- `max-w-lg` constraint
- `max-h-[85vh]` with internal scroll
- `shadow-xl` (the one permitted heavy shadow)
- Three-zone layout (header/body/footer)

**Must Not Absorb**: Tab navigation, nested modals, full-page content. If it needs tabs, it's not a modal.

---

## KPIStatCard

**Visual Role**: Single metric display card.

**Layout Behavior**: Flex column — label + value + optional trend. Wrapper is div/a/button depending on interactivity.

**Density**: Compact. `p-4 gap-2`. Value at `text-2xl font-semibold`.

**What Should Change**:
- Hover state (`hover:border-slate-300 hover:shadow-sm`) is good — should remain interactive-only
- Trend prop exists but is unused — fine as forward-compatible

**What Must Not Change**:
- Simple label + value structure
- Interactive variants via `href` or `onClick` only
- No decorative icons dominating the card

**Must Not Absorb**: Charts, sparklines, or inline data tables. A KPI card shows one number.

---

## FirmaSummaryHeader

**Visual Role**: Company detail page header.

**Layout Behavior**: White card with title, badges, metadata, and quick-action buttons. `p-5 mb-4`.

**Density**: Moderate — needs to show status, risk, sector, city, and actions clearly.

**What Should Change**:
- Quick action buttons could use consistent icon sizing (currently 16px, appropriate)

**What Must Not Change**:
- Composes StatusBadge + RiskBadge (doesn't reinvent them)
- Disabled action buttons with `opacity-40 cursor-not-allowed`
- Metadata row (sektor, şehir) as `text-sm text-slate-500`

**Must Not Absorb**: Tab navigation, overview cards, or commercial summary data.

---

## ContractSummaryHeader

**Visual Role**: Contract detail page header.

**Layout Behavior**: Similar to FirmaSummaryHeader — white card with entity metadata.

**Density**: Moderate. Shows name, status, firma link, dates, kalanGun, sorumlu, optional tutar.

**What Should Change**:
- Confirm that firma link uses `text-blue-600 hover:underline` consistently

**What Must Not Change**:
- Expiry color coding: red ≤15 days, amber ≤30 days, slate >30 days
- `tutar` is optional (not a required structural field)
- Links back to parent company

**Must Not Absorb**: Renewal tracking, action buttons, or tab navigation.

---

## CommercialSummaryCard

**Visual Role**: Read-only commercial visibility card for Company Detail.

**Layout Behavior**: White card with `<dl>` definition list. Shows 4 financial metrics + ticari risk badge.

**Density**: Compact. `p-4`, `space-y-2.5`. `text-xs` labels, `text-sm` values.

**What Should Change**:
- Nothing currently — correctly implements the read-only, visibility-first contract

**What Must Not Change**:
- Strictly read-only — no edit affordance for any role
- Visibility gated at screen level (hidden for görüntüleyici)
- Labels follow STATUS_DICTIONARY: "Açık Bakiye" (not "Açık Alacak") in firma context
- RiskBadge at bottom with border-top separator

**Must Not Absorb**: Invoice detail, payment editing, accounting actions, or financial data entry.

---

## RenewalTrackingCard

**Visual Role**: Contract renewal readiness checklist.

**Layout Behavior**: White card with 4 signal rows — each with check/X icon + label. Progress counter in header.

**Density**: Compact. `p-4`, `space-y-2.5`.

**What Should Change**:
- Nothing currently — correctly implements WORKFLOW_RULES §3.4 four signals

**What Must Not Change**:
- 4 signals per WORKFLOW_RULES: bitiş tarihi, görüşme açıldı mı, sorumlu var mı, görev üretildi mi
- CheckCircle2 (green) / XCircle (slate-300) icon states
- "X/4 tamamlandı" counter

**Must Not Absorb**: Renewal action triggers, contract editing, or status changes.

---

## CapacityRiskCard

**Visual Role**: Workforce capacity metrics for Company Detail İş Gücü context.

**Layout Behavior**: White card with `<dl>` definition list showing 5 metrics + risk badge.

**Density**: Same as CommercialSummaryCard. `p-4`, `space-y-2.5`.

**What Should Change**:
- Color-coded values (amber for gap, green for inflows, red for outflows) are correct

**What Must Not Change**:
- Metrics: aktifKisi, hedefKisi, acikFark, son30GunGiris, son30GunCikis
- WorkforceRiskBadge at bottom
- Read-only — no editing

**Must Not Absorb**: Employee detail, payroll data, HRIS depth.

---

## DocumentsChecklistCard

**Visual Role**: Document status overview with 4 color-coded counts.

**Layout Behavior**: White card with 2x2 grid of dot + label + count.

**Density**: Compact. `p-4`, `grid-cols-2 gap-3`.

**What Should Change**:
- Consider making the total count in header more prominent

**What Must Not Change**:
- 4-status system: tam (green), eksik (red), süresi yaklaşıyor (amber), süresi doldu (red-400)
- Dot indicators matching status colors
- Read-only summary — no document actions

**Must Not Absorb**: Document list, upload actions, or validity editing.

---

## RightSidePanel

**Visual Role**: Right slide-in panel for detail previews.

**Layout Behavior**: Fixed full-height panel from right edge with overlay backdrop.

**Density**: Generous for detail reading. `p-5` body padding.

**What Should Change**:
- Consider adding a subtle left border instead of relying on shadow alone

**What Must Not Change**:
- `max-w-md` width constraint
- Overlay click to close
- Generic: `open`, `onClose`, `title`, `children` — no domain props
- Content is composed at page level, not in the component

**Must Not Absorb**: Domain-specific fields, status editing, or form logic. It's a frame.

---

## Rollout Recommendation

### Phase 1 — Token Extraction
**Scope**: Create a shared token layer without changing any visual output.
- Extract hardcoded Tailwind classes into documented token constants
- Create a `tokens.ts` or CSS custom property layer mapping DESIGN.md tokens
- No visual changes — purely structural preparation

### Phase 2 — Primitive Refresh
**Scope**: Apply token system to base components.
- StatusBadge, RiskBadge, PriorityBadge, TaskSourceBadge, WorkforceRiskBadge
- EmptyState
- ModalShell
- DataTable (header, cell, border, hover)
- SearchInput, FilterBar
- TabNavigation

### Phase 3 — Pilot Surface: Firma Detay
**Why**: Company Detail is the visual center. It composes the most shared components. A refresh here validates every primitive.
- FirmaSummaryHeader
- Genel Bakış 8-card grid
- All activated tabs (Sözleşmeler, Talepler, Aktif İş Gücü, Randevular, Evraklar)
- Zaman Çizgisi (ActivityFeed + TimelineList)

### Phase 4 — Controlled Rollout (Recommended Order)

| Order | Surface | Rationale |
|-------|---------|-----------|
| 1 | Dashboard | Second most-visited; composes KPIStatCard + signal cards + ActivityFeed |
| 2 | Firmalar Listesi | Primary navigation target; validates DataTable refresh |
| 3 | Sözleşmeler Listesi | Second major list; validates DataTable + RightSidePanel |
| 4 | Sözleşme Detay | Validates ContractSummaryHeader + section layout |
| 5 | Görevler | Validates PriorityBadge + TaskSourceBadge in table context |
| 6 | Randevular | Validates appointment-specific patterns |
| 7 | Personel Talepleri | Validates request-specific patterns |
| 8 | Aktif İş Gücü | Validates WorkforceRiskBadge + CapacityRiskCard |
| 9 | Evraklar | Validates DocumentsChecklistCard + billing-risk signal |
| 10 | Shell (Sidebar + Topbar) | Last — highest risk of regression, lowest visual-refresh priority |

### Rules for Rollout
- Each phase must pass `next build` before proceeding
- No product logic changes during visual refresh
- No workflow/status/role rule changes
- No new components unless justified by 2-3 place reuse
- Firma Detay is the validation benchmark — if it looks right, the system works
