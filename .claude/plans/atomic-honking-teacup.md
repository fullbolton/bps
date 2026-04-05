# Proje Ticari Kalite / Tahmini Karlilik Gorunurlugu — Phase 1

## Context
BPS currently shows receivables pressure (acik alacak, kesilmemis bekleyen, ticari risk) and operational gaps (open demands, workforce capacity), but cannot show whether the pricing on active work is commercially adequate relative to estimated cost. Phase 1 delivers a simple assumption-driven margin-band visibility layer inside Company Detail only.

## Goal
Make estimated commercial quality of active contracts visible per firm — as a management signal, not accounting truth. Both sides of the equation are flat management assumptions per position type. No raw numbers are exposed. Only the band label (`saglikli` / `dar` / `riskli`) reaches the user.

---

## Files to Change (7 files)

### New files (4):
| # | File | Purpose |
|---|------|---------|
| 1 | `src/types/ticari-kalite.ts` | MarjBandi type + MARJ_BANDI_LABELS + position-type assumption interface |
| 2 | `src/mocks/ticari-kalite.ts` | Flat position-type assumption table + contract-to-band lookup + firma-level summary helper |
| 3 | `src/components/ui/MarginBandBadge.tsx` | Dot + label badge for saglikli/dar/riskli (follows WorkforceRiskBadge pattern) |
| 4 | `src/styles/badge.ts` | MARGIN_BAND_CONFIG export (additive — no existing code changes) |

### Modified files (3):
| # | File | Change |
|---|------|--------|
| 5 | `src/components/ui/index.ts` | Add MarginBandBadge export |
| 6 | `src/app/(main)/firmalar/[id]/page.tsx` | Genel Bakis: add Tahmini Ticari Kalite card; Sozlesmeler tab: add per-contract margin-band badge |
| 7 | `src/styles/badge.ts` | Add MARGIN_BAND_CONFIG (same file as #4 — additive only) |

---

## Design Decisions

### Position-type assumption model
A flat lookup table mapping position types to { estimated cost band, estimated billed band, resulting margin band }. The 10 position types from MOCK_TALEPLER:
- Guvenlik Gorevlisi
- Forklift Operatoru
- Saha Teknisyeni
- Temizlik Personeli
- Paketleme Operatoru
- Depo Iscisi
- Kamera Operatoru
- Elektrik Teknisyeni
- Kalite Kontrol
- Garson

Each gets a pre-computed `marjBandi: MarjBandi` value. The raw cost/billed numbers are **internal to the mock only** — they never reach any UI surface.

### Contract-to-band mapping
Contracts do NOT have position-type metadata. The mapping uses `firmaId` to find the firm's demands (MOCK_TALEPLER), collects position types, looks up each position's margin band, and returns the **worst band** across all positions linked to that firm. This is the "smallest safe logic" specified in the planning baseline.

Why worst-band: if one position type in a firm's portfolio is `riskli`, the contract-level signal should surface that risk rather than hide it behind a blended average. This is conservative and visibility-first.

For contracts where the firm has no demands (aday, pasif, feshedildi), the band is `null` (no signal shown).

### Firma-level summary
Derived by counting the firm's active contracts by margin band. The Genel Bakis card shows: count of contracts per band + a compact flag if any contract is `riskli`.

### Badge anatomy
Follows the exact WorkforceRiskBadge pattern: dot + label pill.
- `saglikli` → positive (green dot, green pill)
- `dar` → warning (amber dot, amber pill)
- `riskli` → danger (red dot, red pill)

### Role visibility
- `yonetici`: full visibility (Genel Bakis card + Sozlesmeler tab badges)
- `satis`: Sozlesmeler tab badges only (bounded read-only), Genel Bakis card visible
- `operasyon`: no access (consistent with Ticari Ozet access pattern from ROLE_MATRIX.md — operasyon sees Ticari Ozet as "sinirli" but commercial quality is a deeper commercial signal)
- `goruntuleyici`: no access

### Framing language
- Card title: "Tahmini Ticari Kalite"
- Subtitle: "Yonetim varsayimi"
- Band labels: "Saglikli", "Dar Marj", "Riskli"
- No mention of karlilik, gercek maliyet, muhasebe, fiyatlama motoru

---

## Implementation Steps

### Step 1: Types (`src/types/ticari-kalite.ts`)
```
MarjBandi = "saglikli" | "dar" | "riskli"
MARJ_BANDI_LABELS: Record<MarjBandi, string>
```
Small, focused type file. Same pattern as batch4.ts.

### Step 2: Badge config (`src/styles/badge.ts`)
Add MARGIN_BAND_CONFIG at the bottom:
```
MARGIN_BAND_CONFIG: Record<MarjBandi, { label, color, dot }>
  saglikli → positive
  dar → warning
  riskli → danger
```

### Step 3: Badge component (`src/components/ui/MarginBandBadge.tsx`)
Copy WorkforceRiskBadge pattern exactly. Import MARGIN_BAND_CONFIG. Render dot + label.

### Step 4: Barrel export (`src/components/ui/index.ts`)
Add `export { default as MarginBandBadge } from "./MarginBandBadge";`

### Step 5: Mock data + helpers (`src/mocks/ticari-kalite.ts`)
- Position-type assumption table (internal, never exported to UI)
- `getContractMarjBandi(sozlesmeId: string): MarjBandi | null` — lookup via firmaId → demands → position types → worst band
- `getFirmaTicariKaliteOzeti(firmaId: string): { saglikli: number; dar: number; riskli: number; enKotuBant: MarjBandi | null }` — counts active contracts by band

### Step 6: Firma Detay page changes (`src/app/(main)/firmalar/[id]/page.tsx`)
**Genel Bakis** — new card #9 (after Risk Sinyalleri, within the same grid):
- Title: "Tahmini Ticari Kalite" with caption "Yonetim varsayimi"
- Shows per-band contract count (e.g., "2 saglikli, 1 dar marj")
- If any contract is riskli, shows a compact amber/red cue
- Role-gated: only yonetici and satis

**Sozlesmeler tab** — add MarginBandBadge to each contract row:
- In the right section, before StatusBadge
- Only shown for active contracts where band is non-null
- Role-gated: only yonetici and satis

---

## Data Coherence Plan

Position-type to band assignments (internal only — based on typical BPS sector margins):
- Guvenlik Gorevlisi → saglikli (security staffing typically well-priced)
- Forklift Operatoru → saglikli (specialized, good margin)
- Saha Teknisyeni → saglikli (technical, strong margin)
- Elektrik Teknisyeni → saglikli (technical, strong margin)
- Kamera Operatoru → saglikli (specialized security)
- Temizlik Personeli → dar (high competition, thin margins)
- Paketleme Operatoru → dar (commodity labor, thin margins)
- Depo Iscisi → dar (commodity labor, thin margins)
- Kalite Kontrol → saglikli (semi-technical, reasonable margin)
- Garson → riskli (hospitality, very thin margins, high turnover cost)

This produces a coherent portfolio picture:
- f1 (Anadolu Lojistik): mixed — forklift=saglikli, depo=dar → firm shows "dar" (worst)
- f2 (Ege Temizlik): temizlik=dar → firm shows "dar"
- f3 (Baskent Guvenlik): guvenlik=saglikli, kamera=saglikli → firm shows "saglikli"
- f5 (Marmara Gida): paketleme=dar, kalite=saglikli → firm shows "dar"
- f7 (Trakya Tekstil): no demands in mock → null (no signal)
- f8 (Ic Anadolu Enerji): saha teknisyen=saglikli, elektrik teknisyen=saglikli → firm shows "saglikli"
- f6 (Akdeniz Turizm): garson=riskli → firm shows "riskli" (but firm is pasif, contract feshedildi — no active contracts, so no signal)

---

## Verification
- `export PATH="/usr/local/bin:$PATH" && npx next build` must pass with zero errors
- Genel Bakis shows Tahmini Ticari Kalite card for yonetici/satis, hidden for operasyon/goruntuleyici
- Sozlesmeler tab shows MarginBandBadge per active contract for yonetici/satis
- No raw assumption numbers appear in any UI surface
- Badge anatomy matches existing WorkforceRiskBadge exactly
- No new route, no sidebar change, no Dashboard change
- Company Detail remains central; new card is additive, not overpowering
