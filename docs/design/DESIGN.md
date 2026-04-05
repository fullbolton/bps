# BPS Design System

## Visual Direction Summary

### External References Used

| Reference | What We Borrowed | What We Rejected |
|-----------|-----------------|------------------|
| **Linear** | Density discipline, restrained color usage, typography precision, semi-transparent border system, weight hierarchy (not 700), information-first surfaces | Dark mode as default, marketing-style hero text, indigo-only accent, near-black canvas |
| **Supabase** | Border-defined elevation (no heavy shadows), neutral grayscale progression, sparse accent color, card border hierarchy, no-shadow philosophy | Dark-mode-native assumption, pill-shaped CTAs, 9999px radius language, green brand saturation |
| **Sentry** | Dense operational tables, status-indicator hierarchy, uppercase label system for technical badges, inset depth for tactile quality | Purple-tinted UI chrome, decorative glass effects, hero display fonts, lime-green accent |
| **Apple/macOS** (tone only) | Calm surface hierarchy, premium restraint, high typography discipline, refined input styling, consistent radius system | Large-card-first layout, consumer-product spaciousness, photo-driven surfaces, visual minimalism at the cost of data density |

### Why These Fit BPS

BPS is a dense, desktop-first internal operations interface where Company Detail is the visual center and Dashboard is a decision surface. The product manages contracts, staffing demand, workforce capacity, appointments, tasks, and documents — all connected to the company lifecycle chain.

The borrowed traits serve this identity:
- **Linear's density** fits BPS's table-heavy, data-first screens
- **Supabase's border hierarchy** gives structure without shadow noise
- **Sentry's operational aesthetics** match BPS's status-badge and indicator density
- **Apple's calm restraint** prevents BPS from becoming a busy, generic CRM panel

### What BPS Is Not

BPS is not a marketing dashboard, not a finance analytics platform, not a chat-first tool, not a consumer SaaS product. The visual system must serve **operational readability** above all other concerns.

---

## 1. Design Principles

### P1 — Operational Readability First
Every visual decision must improve the operator's ability to scan, decide, and act. If a style choice looks better but slows comprehension, reject it.

### P2 — Company Detail Is the Visual Center
Firma Detay is the most-visited, most-composed surface. All component, card, and layout decisions should be validated against how they perform inside Company Detail.

### P3 — Density Over Spaciousness
BPS operators process many records per session. Tables should be tight but readable. Cards should be compact but scannable. White space serves separation, not decoration.

### P4 — Calm Surfaces, Clear Signals
The default surface state must be visually quiet. Color and emphasis are reserved for signals: status, risk, priority, expiry, delay, missing data. If everything is emphasized, nothing is.

### P5 — One Badge, One Meaning, Everywhere
A status value must have the same visual treatment on every screen. StatusBadge for "aktif" in Firmalar Liste must look identical to "aktif" in Sözleşme Detay. No per-screen badge variants.

### P6 — Shared Before Custom
Before creating a screen-specific visual element, check whether an existing shared component solves the need. Component reuse is a design constraint, not just a code constraint.

---

## 2. Visual Tone

### Surface Character
- **Light mode, neutral canvas** — BPS uses a light `slate-50` background
- Surfaces are white cards on a subtle gray canvas
- Borders define structure; shadows are minimal and functional
- The overall feel is **calm, professional, and institutional** — not startup-bright, not enterprise-gray

### Color Restraint
- The palette is predominantly neutral (slate scale)
- Color appears almost exclusively in semantic roles: status badges, risk indicators, priority levels, interactive accents
- Blue is the sole interactive accent. It must not be decorative
- Green, amber, red appear only as semantic status/risk/priority signals

### Typography Character
- System font stack with Inter-like quality
- Controlled weight usage: regular (400) for content, medium (500) for labels and emphasis, semibold (600) for titles — never bold (700) in UI chrome
- Small text sizes dominate: `text-xs` and `text-sm` are the workhorse sizes
- Display sizes are reserved for page titles only

---

## 3. Density Rules

### Table Density
- Row height: compact but tappable (`py-3` cell padding)
- Header: smaller, uppercase-friendly, muted (`text-xs`, `text-slate-500`)
- Body: standard readable size (`text-sm`, `text-slate-700`)
- Column spacing: `px-4` horizontal padding
- No zebra striping — use subtle dividers (`border-slate-100`)
- Page size: 20 rows default

### Card Density
- Standard card padding: `p-4` (compact) or `p-5` (detail sections)
- Internal list items: `py-2` to `py-2.5` with bottom borders
- Definition lists: `space-y-2.5` between rows
- KPI cards: compact — value + label + optional icon, no decorative padding
- Overview cards in Company Detail: tight grid (`gap-4`), 2-column on desktop

### Form Density
- Label above input, tight spacing (`mb-1` between label and input)
- Input padding: `px-3 py-2`
- Grid layout for paired fields (`grid-cols-2 gap-3`)
- No full-width single fields unless semantically necessary
- Modal forms use `space-y-4` between field groups

---

## 4. Typography Rules

### Font Stack
```
font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
```
No custom web fonts in the initial system. System fonts provide native rendering quality and zero load time — appropriate for a dense internal tool.

### Scale

| Role | Size | Weight | Line Height | Usage |
|------|------|--------|-------------|-------|
| Page Title | text-xl (20px) | 600 (semibold) | 1.4 | PageHeader title |
| Section Title | text-base (16px) | 600 (semibold) | 1.5 | ModalShell title, panel title |
| Card Title | text-sm (14px) | 500 (medium) | 1.4 | Card headers, section labels |
| Body | text-sm (14px) | 400 (normal) | 1.5 | Table cells, descriptions, form values |
| Label | text-xs (12px) | 500 (medium) | 1.3 | Form labels, definition terms, metadata |
| Caption | text-xs (12px) | 400 (normal) | 1.3 | Timestamps, secondary metadata |
| Badge | text-xs (12px) | 500 (medium) | 1.0 | StatusBadge, RiskBadge, PriorityBadge |

### Weight Discipline
- **400 (normal)**: All body text, descriptions, table cell content
- **500 (medium)**: Labels, card titles, badge text, emphasis within body
- **600 (semibold)**: Page titles, modal titles, KPI values — used sparingly
- **700 (bold)**: Never used in UI chrome. Reserved only for extreme inline emphasis if unavoidable

### Do Not
- Do not use `font-bold` on table headers — use `font-medium` with `uppercase` and `text-xs`
- Do not use display sizes (text-2xl+) except for KPI stat values
- Do not mix font families within the UI — monospace is only for code snippets if ever needed

---

## 5. Spacing System

### Base Unit
4px (Tailwind's default). The practical scale used in BPS:

| Token | Value | Common Usage |
|-------|-------|-------------|
| space-0.5 | 2px | Micro adjustments |
| space-1 | 4px | Icon-to-text gap in badges |
| space-1.5 | 6px | Badge internal padding, tight gaps |
| space-2 | 8px | List item vertical padding, small gaps |
| space-2.5 | 10px | Definition list row spacing |
| space-3 | 12px | Card title bottom margin, filter gaps |
| space-4 | 16px | Standard card padding, section gaps, form field spacing |
| space-5 | 20px | Detail section padding |
| space-6 | 24px | Page header bottom margin |

### Section Spacing
- Between page header and content: `mb-6`
- Between content sections: `space-y-4` (tight) or `space-y-6` (loose)
- Between cards in a grid: `gap-3` (KPIs) or `gap-4` (overview cards)
- Tab content top margin: `mt-4`

---

## 6. Color Roles

### Semantic Color Groups

| Role | Color Family | Usage |
|------|-------------|-------|
| **Interactive** | Blue (blue-500, blue-600, blue-700) | Links, focus rings, primary buttons, active tab indicator |
| **Positive / Complete** | Green (green-50, green-500, green-600, green-700) | aktif, tamamlandı, tam, stabil, fulfilled counts |
| **Warning / Attention** | Amber (amber-50, amber-500, amber-600, amber-700) | yaklaşıyor, takip_gerekli, kısmi_doldu, expiry ≤30 days |
| **Danger / Critical** | Red (red-50, red-400, red-500, red-600, red-700) | süresi_doldu, feshedildi, gecikti, kritik_acik, expiry ≤15 days |
| **Neutral / Inactive** | Slate (slate-100, slate-500, slate-600) | pasif, default badges, placeholder text |
| **Accent** | Purple (purple-50, purple-500, purple-700) | TaskSourceBadge "manuel" — the only non-semantic color |

### Surface Colors

| Surface | Color | Usage |
|---------|-------|-------|
| Page background | slate-50 | Layout canvas |
| Card / Panel | white | All cards, modals, panels, table wrapper |
| Table header | slate-50 | DataTable thead |
| Sidebar | slate-900 | Navigation frame |
| Overlay | black/20–black/30 | Modal and panel backdrops |

### Text Colors

| Role | Color | Usage |
|------|-------|-------|
| Primary | slate-900 | Titles, KPI values, firm names |
| Body | slate-700 | Table cells, descriptions, form values |
| Secondary | slate-500 | Subtitles, metadata labels, definition terms |
| Muted | slate-400 | Placeholders, timestamps, disabled text |
| Disabled | slate-300 | Disabled tab labels, disabled actions |

---

## 7. Border / Radius / Shadow Rules

### Borders
- **Standard**: `border border-slate-200` — all cards, inputs, table wrapper
- **Subtle divider**: `border-b border-slate-100` — between list items, table rows
- **Section divider**: `border-b border-slate-200` — tab navigation underline, major sections
- **Badge ring**: `ring-1 ring-inset ring-{color}-600/20` — all badge components

### Radius Scale

| Token | Value | Usage |
|-------|-------|-------|
| radius-sm | rounded-md (6px) | Buttons, inputs, action menus |
| radius-default | rounded-lg (8px) | Cards, table wrapper, modals |
| radius-full | rounded-full (9999px) | Badges, filter chips, avatar placeholders |

### Shadow Rules
- **No decorative shadows.** BPS uses border-defined elevation, not shadow-driven depth
- `shadow-sm`: Only on interactive card hover (`hover:shadow-sm`)
- `shadow-lg`: Only on dropdown menus and action menus
- `shadow-xl`: Only on modals and slide-in panels
- Default card state: **no shadow** — border only

---

## 8. Table Style Rules

- Table wrapper: `border border-slate-200 rounded-lg overflow-hidden`
- Header row: `bg-slate-50` with `text-xs font-medium text-slate-500 uppercase tracking-wider`
- Body rows: `bg-white` with `text-sm text-slate-700`
- Row dividers: `divide-y divide-slate-100`
- Hover on clickable rows: `hover:bg-slate-50` — subtle, not dramatic
- Sort indicators: muted by default (`text-slate-300`), active state matches header text
- Action column: narrow (`w-10`), right-aligned, MoreVertical icon
- Pagination: below table, `text-sm text-slate-600`, Önceki/Sonraki buttons with `border border-slate-200 rounded-md`
- Empty state: centered EmptyState component, not raw text
- Loading state: skeleton rows with `animate-pulse` on `bg-slate-100` bars

### Do Not
- Do not add zebra striping
- Do not use colored row backgrounds for status indication — use StatusBadge in a column
- Do not wrap tables in shadow-heavy containers
- Do not introduce horizontal scrolling for standard column counts (≤10)

---

## 9. Card Style Rules

- All cards: `bg-white border border-slate-200 rounded-lg p-4`
- Card title: `text-sm font-medium text-slate-900 mb-3` — optionally with a lucide icon (14px, `text-slate-400`)
- Internal lists: items separated by `border-b border-slate-100 last:border-0`
- Definition lists: `<dl>` with `text-xs text-slate-500` labels and `text-sm text-slate-700` values
- KPI value in cards: `text-2xl font-semibold text-slate-900`
- Action link in card header: `text-xs text-blue-600 hover:underline` — aligned right

### Card Identity Rule
Each card must have a clear identity tied to a product concept (Aktif Sözleşmeler, Açık Talepler, Risk Sinyalleri, Ticari Özet). Cards must not be generic "info boxes." If a card doesn't answer "what operational question does this resolve?", it should not exist.

### Do Not
- Do not over-card the UI — if content fits in a list row, don't wrap it in a card
- Do not nest cards inside cards
- Do not add decorative borders or gradient backgrounds to cards
- Do not make all cards the same height — let content determine height

---

## 10. Badge Style Rules

### Badge Anatomy
All badges share: `inline-flex items-center rounded-full font-medium ring-1 ring-inset text-xs`

### Size Variants
- **sm** (default): `px-2 py-0.5 text-xs`
- **md**: `px-2.5 py-1 text-sm`

### Color Assignment
Color is dictated by the semantic role, not the screen context:
- Status values → StatusBadge colors (green/blue/amber/red/slate based on value)
- Risk levels → RiskBadge colors (green/amber/red with dot indicator)
- Priority levels → PriorityBadge colors (slate/blue/amber/red, no dot)
- Task sources → TaskSourceBadge colors (purple/blue/slate with icon)
- Workforce risk → WorkforceRiskBadge colors (green/amber/red with dot)

### Do Not
- Do not create new badge color combinations for screen-specific needs
- Do not use badges for decoration — every badge must convey a workflow-meaningful value
- Do not mix badge styles (e.g., dot indicator on a priority badge)
- Do not inflate badge count per row — 1-2 badges per table row is ideal, 3 is the max

---

## 11. Section Layout Rules

### List Page Layout
```
PageHeader (title + subtitle + primary action button)
  ↓
KPI Summary Row (optional, 2-4 cards in grid)
  ↓
Status Filter Chips (optional, clickable)
  ↓
Search + FilterBar row
  ↓
DataTable (full width)
  ↓
Modals (rendered at page level)
Side Panel (rendered at page level)
```

### Detail Page Layout
```
Back Navigation (← Parent list name)
  ↓
Summary Header (entity name + status + key metadata)
  ↓
TabNavigation (horizontal underline tabs)
  ↓
Tab Content (changes per active tab)
  ↓
Modals (rendered at page level)
```

### Detail Page Sections (Non-Tabbed)
For simpler detail pages (e.g., Sözleşme Detay), use stacked sections — not a second tab system:
```
Summary Header
  ↓
Section 1 (white card with title)
  ↓
Section 2 (white card with title)
  ↓
...
```
Sections are `space-y-6` apart, each in `bg-white border rounded-lg p-5`.

---

## 12. Detail-Page Composition Rules

### Company Detail (Firma Detay) — The Benchmark
- **FirmaSummaryHeader** at top: firma name, status badge, risk badge, metadata, quick actions
- **TabNavigation** below header with 9 tabs
- **Genel Bakış** tab: 2-column grid of 8 overview cards, each tied to a documented product concept
- **Other tabs**: filtered data from their domain (contracts, requests, workforce, appointments, documents)
- **Disabled tabs**: show contextual EmptyState with neutral "henüz kapsam dışı" copy

### Every detail page must:
1. Show a back-navigation link to the parent list
2. Have a summary header with entity name + status
3. Present content in clearly separated sections or tabs
4. Link back to the parent company where applicable (e.g., contract detail links to firma)

---

## 13. Dashboard Composition Rules

### Dashboard Is a Decision Surface
- It must answer: "What needs my attention right now?"
- Every card must link to a real actionable destination
- Dead-end cards (display-only with no navigation) are not acceptable

### Structure
```
PageHeader
  ↓
KPI Row (6 cards, clickable where destination exists)
  ↓
Signal Cards Grid (3-column, each with title + list + optional "Tümünü Gör" link)
  ↓
Activity Feed (recent events, chronological)
```

### Signal Card Rules
- Each signal card must be a self-contained decision prompt
- Title must describe the signal, not just the entity ("Bugünün Görevleri", not "Görevler")
- Items within should show enough context to decide without clicking (firma name, count, time, severity)
- "Tümünü Gör" link routes to the full list page

### Do Not
- Do not add charts to Dashboard — it's not an analytics platform
- Do not make Dashboard a KPI wall — signals > metrics
- Do not add cards that don't drive action
- Do not repeat full list tables inside Dashboard — use compact signal lists

---

## 14. Form-Field Rules

- Label: `text-sm font-medium text-slate-700 mb-1` above input
- Required marker: `<span className="text-red-500">*</span>` after label text
- Input: `w-full px-3 py-2 text-sm border border-slate-200 rounded-md` with `focus:ring-2 focus:ring-blue-500 focus:border-transparent`
- Select: same styling as input
- Textarea: same base styling, `resize-none`, explicit `rows` attribute
- Date/time: native browser inputs with same styling
- Validation warning: `text-xs text-amber-600 mt-1` below the field
- Field groups: `space-y-4` between groups, `grid-cols-2 gap-3` for paired fields

### Do Not
- Do not use floating labels
- Do not use placeholder text as the only label
- Do not style required fields differently (only the `*` marker)
- Do not add icons inside input fields unless semantically necessary (SearchInput is the exception)

---

## 15. Modal Rules

- Overlay: `bg-black/30` fixed fullscreen
- Modal: `bg-white rounded-lg shadow-xl max-w-lg` centered
- Three zones: header (title + close), scrollable body, footer (actions)
- Close: X button top-right + overlay click + Escape key
- Footer actions: İptal (secondary, left) + Primary action (right)
- Primary button: `bg-blue-600 text-white` with disabled state (`opacity-40 cursor-not-allowed`)
- Max height: `max-h-[85vh]` with internal scroll

### Do Not
- Do not nest modals
- Do not use modals for content that should be a page or panel
- Do not add tabs inside modals
- Do not make modals wider than `max-w-lg` unless absolutely necessary

---

## 16. Empty-State Rules

- Three sizes: `page` (py-20), `tab` (py-14), `card` (py-8)
- Always centered, icon above title
- Icon: lucide icon in `bg-slate-100 rounded-full` circle
- Title: `font-medium text-slate-900`
- Description: `text-slate-500 max-w-sm`
- Optional action button: `bg-blue-600 text-white rounded-md` below description
- Use `card` size inside cards and inline containers
- Use `tab` size for empty tab content
- Use `page` size for full-page empty states (e.g., 404, no-data)

---

## 17. Do-Not-Do Rules

### Product Identity
- **Do not drift into generic CRM visuals** — BPS is an internal operations tool, not a contact management system
- **Do not make Dashboard chart-first** — no pie charts, no bar graphs, no sparklines in the initial system
- **Do not over-card the UI** — cards must represent product concepts, not decoration
- **Do not sacrifice operational readability for style** — if operators can't scan a table quickly, the design has failed
- **Company Detail remains the visual center** — all design decisions should be validated against Firma Detay

### Visual Discipline
- Do not use gradients on surfaces
- Do not use colored backgrounds for sections (white cards on slate-50 canvas only)
- Do not add icons to every label — icons should aid recognition, not decorate
- Do not use animation except for loading states (`animate-pulse` skeleton only)
- Do not introduce new colors outside the defined semantic palette
- Do not use `font-bold` (700) in UI chrome
- Do not add box-shadow to default card state
- Do not make borders thicker than 1px

### Component Discipline
- Do not create screen-specific badge variants
- Do not create screen-specific table variants
- Do not introduce inline styles — all styling through Tailwind classes
- Do not add new shared components without proving 2-3 place reuse
- Do not confuse information-architecture problems with component problems
