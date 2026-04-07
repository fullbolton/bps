# PARTNER_SCOPE_TOUCHPOINTS.md

## Purpose

Phase 0 discovery artifact. Inventory of every surface where the
**partner role** scope filter must be enforced.

This is the touchpoint list referenced by Migration Anayasası §1.10:
"Scope filtreleme yalnizca ana sayfalarda degil, su yuzeylerde de
zorunludur..."

This file does **not** define the partner-scope schema. It only enumerates
where enforcement is required so that no surface is accidentally left
open during Faz 1+ migration. The actual `partner_assignments` table
shape is defined in the Faz 1A implementation batch.

---

## 1. Critical clarification — terminology

There are **two unrelated concepts** in this codebase that both use the
word "partner". They must not be conflated.

| Concept | What it is | Where it lives |
|---|---|---|
| **`partner` role** | A user authorization role with portfolio scope (one of the 6 BPS roles) | `ROLE_MATRIX.md` §3.3, AuthContext UserRole, role gates |
| **Operasyon Partneri / `partnerAdi`** | A city-level operational ownership label (city + partner-name dictionary entry) | `OPERASYON_PARTNERLERI` and `FIRMA_PARTNER_MAP` in `src/mocks/ayarlar.ts`; `partnerAdi` field in firma display |

The **role** is identity + capability + scope. The **operasyon partneri**
is org-chart metadata.

These two **may** converge in the future when partner-assignment schema is
designed (a partner-role user could be linked to an operasyon-partneri
record), but Phase 0 keeps them separate. No new schema is invented here.

---

## 2. Surfaces where partner-scope filtering is required

Source: ROLE_MATRIX.md §4 (`Partner` column = `Portfoyunde Evet` or
`Portfoyunde Sinirli`) plus the operational backbone listed in
REAL_DATA_MIGRATION_MASTER_PLAN.md §1.10.

### 2.1 Primary domain reads (must be filtered at service layer)

| Domain | Touchpoint screens | Filter rule |
|---|---|---|
| `companies` | Firmalar Listesi, Firma Detay, Dashboard Toplam Firma KPI | only firms in partner's portfolio |
| `contacts` (yetkililer) | Firma Detay > Yetkililer tab | only contacts of in-portfolio firms |
| `notes` | Firma Detay > Notlar tab, Dashboard Son Notlar | only notes attached to in-portfolio firms |
| `contracts` | Sozlesmeler Listesi, Sozlesme Detay, Firma Detay > Sozlesmeler tab, Dashboard Yaklasan Bitisler | only contracts of in-portfolio firms |
| `staffing_demands` | Personel Talepleri sayfasi, Firma Detay > Talepler tab, Dashboard Acik Talep KPI | only demands of in-portfolio firms |
| `appointments` | Randevular sayfasi, Firma Detay > Randevular tab | only appointments of in-portfolio firms |
| `tasks` | Gorevler sayfasi, Firma Detay > Gorevler tab, Dashboard Geciken Gorevler | only tasks of in-portfolio firms |
| `documents` | Evraklar sayfasi, Firma Detay > Evraklar tab, Dashboard Eksik Evrak | only documents of in-portfolio firms |
| `workforce_summary` | Aktif Is Gucu sayfasi, Firma Detay > Is Gucu tab | only workforce of in-portfolio firms |
| `routings` | Firma Detay > Bekleyen Yonlendirmeler | only routings of in-portfolio firms |
| `financial_summaries` | Firma Detay > Ticari Ozet, Finansal Ozet (limited to portfolio) | only financials of in-portfolio firms |

### 2.2 Derived reader surfaces (must apply filter before aggregating)

| Surface | What it aggregates | Filter rule |
|---|---|---|
| Dashboard KPI cards (count/sum) | counts across companies, contracts, demands, tasks, etc. | aggregate over in-portfolio rows only |
| Dashboard Riskli Firmalar | filter on companies + financials | in-portfolio only |
| Dashboard Sehir/Partner Yogunluk | aggregate by city/partner ownership | in-portfolio only (and only the partner's own ownership cell) |
| Raporlar — Riskli Firma | filter on companies + financials | in-portfolio only |
| Raporlar — Sozlesme Bitis | filter on contracts.end_date | in-portfolio only |
| Raporlar — Talep Analizi | aggregate on demands | in-portfolio only |
| Raporlar — Randevu Hacmi | aggregate on appointments | in-portfolio only |
| Raporlar — Sehir/Partner Operasyon Ozeti | hierarchy aggregate | in-portfolio only — partner sees only own slice |
| Raporlar — Is Gucu | aggregate on workforce | in-portfolio only |
| Finansal Ozet — Portfoy Saglik Ozeti | aggregate | in-portfolio only |
| Finansal Ozet — Firma Bazli Acik Alacak | per-company list | in-portfolio only |

### 2.3 Visibility-only labels and dictionaries

| Surface | Filter rule |
|---|---|
| Ayarlar > Sehirler dictionary | NOT filtered — read-only dictionary, all users can see (but partner cannot reach Ayarlar at all per ROLE_MATRIX) |
| Ayarlar > Operasyon Partnerleri dictionary | NOT filtered — read-only dictionary, all users can see (but partner cannot reach Ayarlar) |
| `OPERASYON_PARTNERLERI` lookup label on firma row | NOT filtered — display label on a row that is already scope-filtered by company |

The dictionary tables themselves are **not** scope-filtered because
partners do not have Ayarlar access at all.

---

## 3. CTA / write-side touchpoints

Read-side filtering is necessary but not sufficient. Every write path that
takes a `firma_id` (or any record id that resolves to a firma) must
**re-verify** that the resolved firma is in the partner's portfolio
before mutating. This guards against direct API calls that bypass the
scoped read.

| Action | Re-verification rule |
|---|---|
| Firma create | New firma must be created with partner ownership; non-yonetici partners can only create within their portfolio context |
| Firma update / pasife alma | Re-verify firma is in portfolio |
| Yetkili create / update | Re-verify firma is in portfolio |
| Not create / update / pin | Re-verify firma is in portfolio |
| Sozlesme create / status change | Re-verify firma is in portfolio |
| Talep create / update | Re-verify firma is in portfolio |
| Randevu create / result entry | Re-verify firma is in portfolio |
| Gorev create / assign / status change | Re-verify firma is in portfolio |
| Evrak upload / status update | Re-verify firma is in portfolio |
| Yonlendirme create / resolve | Re-verify firma is in portfolio |
| Ticari Temas draft generation | Re-verify firma is in portfolio |

This is the §1.10 "DB/service katmaninda da scope filtresi zorunludur"
guarantee. UI hiding alone is not sufficient.

---

## 4. Enforcement layers

Per Migration Anayasasi §3.4 and §7.8, partner scope must be enforced at
all three layers, **not just one**:

| Layer | Enforcement mechanism |
|---|---|
| **UI** | Conditional rendering — partner sees only in-portfolio rows in lists, only in-portfolio entities in search results, no out-of-portfolio CTAs |
| **Service** (`src/lib/services/*`) | Every read path applies `partner_assignments` filter; every write path re-verifies firma membership |
| **Database** (RLS) | Row-level policies on every table that contains a `company_id` (or transitive owner) — partner can only read rows where the linked firma is in their assignments |

UI-only filtering is treated as a defect. The migration plan §7.8
explicitly forbids relying on UI hiding alone.

---

## 5. Phase responsibility

| Phase | Partner-scope work |
|---|---|
| Faz 0 (current) | Discovery only — document touchpoints, keep AuthContext role model in sync. Do NOT lock partner_assignments schema yet. |
| Faz 1A | Define `partner_assignments` (or equivalent) table. Apply scope filter to `companies` reads and writes. Apply RLS to `companies`. |
| Faz 1B | Apply scope filter to `contacts` reads and writes (transitively via company). |
| Faz 1C | Apply scope filter to `notes` reads and writes (transitively via company). |
| Faz 2 | Apply scope filter to `contracts`. |
| Faz 3 | Apply scope filter to `staffing_demands`, `appointments`, `tasks`, `workforce_summary`. |
| Faz 4 | Apply scope filter to `documents` and (where applicable) `critical_dates`. Note: `critical_dates` is company-wide and does not need scope filter. |
| Faz 5 | Apply scope filter to `financial_summaries` — partner sees only in-portfolio financials. **No global Finansal Ozet for partner.** |
| Faz 6 | Apply scope filter to all derived dashboard / report readers. |
| Faz 7 | Final scope audit per §7 of REAL_DATA_MIGRATION_MASTER_PLAN.md acceptance criteria. |

---

## 6. Open questions (DECISION REQUIRED before Faz 1A)

These are not blockers for Phase 0 but must be answered before partner
scope is implemented in Faz 1A:

1. **Multi-partner per firma**: A firma can be assigned to multiple
   partners (per migration plan §3.3). What is the visibility rule when
   two partners share a firma? Both see it; neither's view is restricted
   relative to the other. Confirm.

2. **Yonetici creating a firma**: When yonetici creates a new firma,
   which partner(s) is it assigned to by default? (Suggested: none —
   yonetici must explicitly assign before partners can see it.)

3. **`OPERASYON_PARTNERLERI` linkage**: Is there a 1:1 link between a
   `partner` role user and a `OPERASYON_PARTNERLERI` dictionary row, or
   are the two completely independent? Suggested: keep independent for
   Faz 1A; revisit later.

4. **Notlar visibility (`muhasebe`, `goruntuleyici`)**: Per migration
   plan Faz 1C "DECISION REQUIRED" note, the role matrix is unclear on
   notlar access for `muhasebe` and `goruntuleyici`. Resolve before Faz 1C.

5. **Documents visibility (`goruntuleyici`)**: Per migration plan Faz 4A
   "DECISION REQUIRED" note, role matrix is unclear on document access
   for `goruntuleyici`. Resolve before Faz 4A.

These are forwarded to the Phase 1A planning batch and **not** answered
in Phase 0.

---

## 7. Update protocol

When a domain is migrated:
1. Verify the implementation enforces scope at all three layers (UI / service / RLS).
2. Update §5 — change "Apply scope filter" to "Done" for the migrated row.
3. If a new derived reader is added, append it to §2.2.
