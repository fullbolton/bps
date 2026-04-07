# SCREEN_MOCK_DEPENDENCY_MAP.md

## Purpose

Phase 0 discovery artifact. Maps every screen and shared component to the
mock files it imports today. Used during phased migration to determine which
mocks must be replaced when a domain is migrated to real Supabase truth.

This map is descriptive of current state — not a structural commitment.
It will be updated each time a domain is cut over (Prensip 1.3).

Source-of-truth scan: `import ... from "@/mocks/*"` across `src/`.

---

## 1. Screen → Mock import matrix

### Operational backbone screens

| Screen | File | Mocks Imported |
|---|---|---|
| Dashboard | `src/app/(main)/dashboard/page.tsx` | `dashboard`, `evraklar`, `firmalar`, `sozlesmeler`, `talepler`, `aktif-isgucu`, `randevular`, `gorevler`, `finansal-ozet`, `ayarlar` (FIRMA_PARTNER_MAP), `duyurular`, `inisiyatifler`, `kurumsal-belgeler` |
| Firmalar Listesi | `src/app/(main)/firmalar/page.tsx` | `firmalar`, `sozlesmeler`, `aktif-isgucu`, `randevular`, `yetkililer`, `ayarlar` (FIRMA_PARTNER_MAP) |
| Firma Detay | `src/app/(main)/firmalar/[id]/page.tsx` | `bahsetmeler`, `ayarlar` (FIRMA_PARTNER_MAP), `firmalar`, `sozlesmeler`, `randevular`, `talepler`, `aktif-isgucu`, `evraklar`, `finansal-ozet`, `ticari-kalite`, `inisiyatifler`, `yonlendirmeler`, `yetkililer`, `notlar` |
| Sozlesmeler Listesi | `src/app/(main)/sozlesmeler/page.tsx` | `sozlesmeler` |
| Sozlesme Detay | `src/app/(main)/sozlesmeler/[id]/page.tsx` | `sozlesmeler`, `gorevler`, `randevular` |
| Personel Talepleri | `src/app/(main)/talepler/page.tsx` | `talepler`, `firmalar` |
| Aktif Is Gucu | `src/app/(main)/aktif-isgucu/page.tsx` | `aktif-isgucu` |
| Randevular | `src/app/(main)/randevular/page.tsx` | `randevular`, `gorevler`, `firmalar` |
| Gorevler | `src/app/(main)/gorevler/page.tsx` | `gorevler`, `firmalar` |
| Evraklar | `src/app/(main)/evraklar/page.tsx` | `evraklar`, `firmalar` |
| Kurumsal Tarihler | `src/app/(main)/kurumsal-tarihler/page.tsx` | `kurumsal-belgeler` |

### Management visibility screens

| Screen | File | Mocks Imported |
|---|---|---|
| Finansal Ozet | `src/app/(main)/finansal-ozet/page.tsx` | `finansal-ozet`, `firmalar`, `aktif-isgucu`, `talepler`, `ayarlar` (FIRMA_PARTNER_MAP) |
| Raporlar | `src/app/(main)/raporlar/page.tsx` | `raporlar` |
| Ayarlar | `src/app/(main)/ayarlar/page.tsx` | `ayarlar` |

### Shared components / utilities

| Component | File | Mocks Imported |
|---|---|---|
| AddContactModal | `src/components/modals/AddContactModal.tsx` | `yetkililer` (type only) |
| NewAppointmentModal | `src/components/modals/NewAppointmentModal.tsx` | `randevular` (type + labels) |
| QuickNoteModal | `src/components/modals/QuickNoteModal.tsx` | `notlar` (labels + type) |
| NewTaskModal | `src/components/modals/NewTaskModal.tsx` | `gorevler` (type + labels) |
| DemandTrendChart | `src/components/ui/DemandTrendChart.tsx` | `talepler` (type) |
| TaskSourceBadge | `src/components/ui/TaskSourceBadge.tsx` | `gorevler` (type) |
| draft-hotel-email | `src/lib/draft-hotel-email.ts` | `firmalar` (mock) |
| badge styles | `src/styles/badge.ts` | `ticari-kalite` (type) |

---

## 2. Mock file → consumer count

| Mock File | Consumer Count | First Migration Phase |
|---|---:|---|
| `firmalar.ts` | 9 | Faz 1A |
| `sozlesmeler.ts` | 5 | Faz 2 |
| `aktif-isgucu.ts` | 5 | Faz 3D |
| `talepler.ts` | 5 | Faz 3A |
| `randevular.ts` | 5 | Faz 3B |
| `gorevler.ts` | 5 | Faz 3C |
| `evraklar.ts` | 3 | Faz 4A |
| `ayarlar.ts` | 4 | (Faz 7 — dictionary truth review) |
| `finansal-ozet.ts` | 3 | Faz 5 |
| `yetkililer.ts` | 3 | Faz 1B |
| `kurumsal-belgeler.ts` | 2 | Faz 4B |
| `bahsetmeler.ts` | 1 | Sonraya (Gözlemlenebilirlik) |
| `dashboard.ts` | 1 | Faz 6 (derived reader) |
| `duyurular.ts` | 1 | Sonraya |
| `inisiyatifler.ts` | 2 | Sonraya |
| `notlar.ts` | 2 | Faz 1C |
| `raporlar.ts` | 1 | Faz 6 (derived reader) |
| `ticari-kalite.ts` | 2 | Faz 5 (assumption layer) |
| `yonlendirmeler.ts` | 1 | Faz 3 / Faz 4 (independent) |

Total: 84 import sites across 22 files.

---

## 3. Cutover ordering implications

### Faz 1 (Firmalar + Yetkililer + Notlar)
Touches the highest-fanout mocks. Migration of `firmalar.ts` alone affects
9 files, including Dashboard, Firmalar Listesi, Firma Detay, and Finansal
Ozet. Expect coordinated change across these consumers in a single batch.

### Faz 2 (Sozlesmeler)
`sozlesmeler.ts` is consumed by 5 files. Sozlesmeler Listesi and Detay are
local; the cross-cutting consumers are Dashboard, Firmalar Listesi, and
Firma Detay.

### Faz 3 (Talepler + Randevular + Gorevler + Is Gucu)
The four operational mocks each have 5 consumers; Dashboard and Firma Detay
are common downstream of all of them. This justifies the migration plan's
"coordinated batch" framing for Faz 3.

### Faz 4 (Evraklar + Kritik Tarihler)
Lower fanout. `evraklar.ts` consumed by 3 files; `kurumsal-belgeler.ts` by
2 files (one of which is Dashboard).

### Faz 5 (Finansal Ozet)
`finansal-ozet.ts` is consumed by 3 files including Dashboard and Firma
Detay. `ticari-kalite.ts` is closely related and lives next to it.

### Faz 6 (Dashboard + Raporlar)
`dashboard.ts` and `raporlar.ts` are leaf mocks — they read from the
primary domain mocks above. Per Prensip 1.6, these become derived readers
once their upstream domains are real.

### Faz 7 (Cutover)
Remaining mock files (`bahsetmeler`, `duyurular`, `inisiyatifler`,
`ayarlar` dictionary data) get final review. `bahsetmeler` and
`inisiyatifler` are explicitly deferred to Gözlemlenebilirlik workstream.

---

## 4. Notes on `FIRMA_PARTNER_MAP`

`ayarlar.ts` exports `FIRMA_PARTNER_MAP` (city/operasyon-partner ownership
data from the completed city-partner workstream). This is consumed by 4
files: Dashboard, Firmalar Listesi, Firma Detay, Finansal Ozet.

This map is **organizational ownership data**, not the new `partner` role
authorization model. It must not be conflated with `rol === "partner"`
during migration. Phase 1A schema work for `companies` should preserve a
clear semantic boundary between:

- The **partner role** (a user authorization role with portfolio scope),
- The **operasyon partneri** dictionary (city-level operational ownership label).

The two may eventually align under a single `partner_assignments` table
(per migration plan §3.3), but Phase 0 keeps them separate.

---

## 5. Update protocol

When a domain is migrated:
1. Replace mock imports with service-layer imports in each consumer.
2. Update this map to remove the migrated mock file row.
3. Verify the `Mock file → consumer count` table reaches 0 for the migrated mock.
4. Per Prensip 1.3, the mock file is removed from `src/mocks/` no later than Faz 7.
