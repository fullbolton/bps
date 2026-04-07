# SUMMARY_SOURCE_OF_TRUTH_MAP.md

## Purpose

Phase 0 discovery artifact. Maps every summary surface (Dashboard cards,
Genel Bakis cards, Raporlar rows, Finansal Ozet KPIs) to the **primary
domain truth** it must derive from after migration.

This enforces Migration Anayasası §1.6: derived readers do not become
independent migrations — they are built on top of primary domain truth.

This is not a schema. It is a per-surface intent statement.

---

## 1. Dashboard summary surfaces

| Surface | Type | Source-of-truth domain | Phase |
|---|---|---|---|
| Toplam Firma KPI | count | `companies` | Faz 6 (derived from Faz 1A) |
| Aktif Sozlesme KPI | count + filter | `contracts` (status = aktif) | Faz 6 (derived from Faz 2) |
| Acik Talep KPI | count + filter | `staffing_demands` (open_count > 0) | Faz 6 (derived from Faz 3A) |
| Yaklasan Sozlesme Bitisleri | filter + sort | `contracts` (end_date proximity) | Faz 6 (derived from Faz 2) |
| Riskli Firmalar | filter + ticari rollup | `companies` + `financial_summaries` | Faz 6 (derived from Faz 1A + Faz 5) |
| Geciken Gorevler | filter | `tasks` (due_date < now AND status != tamamlandi) | Faz 6 (derived from Faz 3C) |
| Acik Demand Trend | aggregate | `staffing_demands` | Faz 6 (derived from Faz 3A) |
| Eksik Evrak Sinyali | filter | `documents` (status in [eksik, suresi_doldu, suresi_yaklasiyor]) | Faz 6 (derived from Faz 4A) |
| Kurumsal Kritik Tarih sinyali | filter | `critical_dates` (deadline proximity) | Faz 6 (derived from Faz 4B) |
| Bugünkü Randevular | filter | `appointments` (date = today) | Faz 6 (derived from Faz 3B) |
| Gorev Yuku | aggregate | `tasks` | Faz 6 (derived from Faz 3C) |
| Sehir/Partner Yogunluk Sinyali | aggregate | `companies` + partner ownership | Faz 6 (derived from Faz 1A + partner-assignment model) |
| Yonetici Inisiyatifleri | independent | (deferred — bookmark layer, not core domain) | Sonraya |
| Duyurular | independent | (deferred — local demo state) | Sonraya |
| Gunluk Otel Email helper | helper | `companies` (read context) | Faz 1A (consumes companies, no truth of its own) |

---

## 2. Firma Detay (Genel Bakis) summary cards

| Card | Type | Source-of-truth domain | Phase |
|---|---|---|---|
| Aktif Sozlesmeler kart | filter on company | `contracts` (company_id = X, status = aktif) | Derived from Faz 2 |
| Aktif Talepler kart | filter on company | `staffing_demands` (company_id = X) | Derived from Faz 3A |
| Aktif Is Gucu kart | aggregate per company | `workforce_summary` (company_id = X) | Derived from Faz 3D |
| Son Randevu kart | latest record | `appointments` (company_id = X order by date desc) | Derived from Faz 3B |
| Son Gorev kart | latest record | `tasks` (company_id = X order by created_at desc) | Derived from Faz 3C |
| Son Notlar kart | latest records | `notes` (company_id = X order by created_at desc) | Derived from Faz 1C |
| Bahsetmeler kart | latest records | (deferred — Gözlemlenebilirlik) | Sonraya |
| Risk Sinyalleri kart | aggregate | `companies.risk_level` + signal sources | Derived from Faz 1A onward |
| Tahmini Ticari Kalite kart | per-position assumption table | `staffing_demands.position` (lookup) | Faz 1A consumer / Faz 5 assumption refresh |
| Ticari Ozet kart | per-firm financials | `financial_summaries` (company_id = X) | Derived from Faz 5 |
| Bekleyen Yonlendirmeler | per-firm filter | `routings` (company_id = X, status = bekliyor) | Derived from Faz 3 / 4 (independent) |
| Ticari Temas action strip | derived signal | `companies.last_contact` + `financial_summaries` | Derived from Faz 1A + Faz 5 |
| Teklif Hesaplayici | stateless utility | (none — input-only calculator) | No migration |

---

## 3. Finansal Ozet headline KPIs

| KPI | Type | Source-of-truth domain | Phase |
|---|---|---|---|
| Toplam Acik Alacak | sum | `financial_summaries.open_receivables` | Faz 5 |
| Gecikmis Alacak Yogunlugu | aggregate + risk | `financial_summaries` (overdue threshold) | Faz 5 |
| Kesilmemis Bekleyen Toplam | sum | `financial_summaries.uninvoiced_amount` | Faz 5 |
| Maas Giderleri | sum | `financial_summaries` (extended schema) | Faz 5 |
| Sabit Giderler | sum | `financial_summaries` (extended schema) | Faz 5 |
| Kisa Vadeli Net Gorunum | derived | `financial_summaries` (composite) | Faz 5 |
| Portfoy Saglik Ozeti card | aggregate | `companies` + `financial_summaries` + `workforce_summary` | Faz 5 + Faz 1 + Faz 3 |
| Firma Bazli Acik Alacak Listesi | filter + sort | `financial_summaries` per company | Faz 5 |

---

## 4. Raporlar (read-only reports)

| Report | Type | Source-of-truth domain | Phase |
|---|---|---|---|
| Is Gucu Raporu | aggregate | `workforce_summary` + `companies` | Derived from Faz 1A + Faz 3D |
| Sozlesme Bitis Raporu | filter + sort | `contracts` (end_date proximity) | Derived from Faz 2 |
| Talep Analizi Raporu | aggregate | `staffing_demands` | Derived from Faz 3A |
| Randevu Hacmi ve Sonuclar | aggregate | `appointments` + `appointments.result` | Derived from Faz 3B |
| Riskli Firma Listesi | filter | `companies` + `financial_summaries` | Derived from Faz 1A + Faz 5 |
| Sehir ve Partner Operasyon Ozeti | hierarchy aggregate | `companies` + partner-assignment + `contracts` + `financial_summaries` | Derived from Faz 1A + partner model + Faz 2 + Faz 5 |

---

## 5. Cross-surface truth parity rules

These rules are absolute. No two surfaces may show different values for
the same fact about the same entity:

| Fact | Authoritative source | Surfaces that must agree |
|---|---|---|
| Firma adi | `companies.name` | Dashboard, Firmalar Listesi, Firma Detay, Sozlesmeler Listesi, Raporlar |
| Aktif Sozlesme sayisi (firma) | `contracts where company_id=X and status=aktif` | Firmalar Listesi sayac, Firma Detay header, Genel Bakis kart |
| Aktif Personel sayisi (firma) | `workforce_summary.current_count` | Firmalar Listesi, Firma Detay, Aktif Is Gucu sayfasi |
| Open receivables (firma) | `financial_summaries.open_receivables` | Firma Detay Ticari Ozet, Finansal Ozet listesi, Riskli Firma raporu |
| Risk seviyesi (firma) | `companies.risk_level` | Dashboard Riskli Firma kart, Firmalar Listesi badge, Firma Detay header |
| Sozlesme bitis tarihi | `contracts.end_date` | Sozlesmeler Listesi, Sozlesme Detay, Firma Detay Sozlesmeler tab, Yaklasan Bitisler |
| Talep doluluk acigi | `staffing_demands.requested_count - provided_count` | Talepler sayfasi, Firma Detay Talepler tab, Dashboard Acik Talep KPI |
| Evrak gecerlilik durumu | `documents.status` (with expiry derivation) | Evraklar sayfasi, Firma Detay Evraklar tab, Dashboard Eksik Evrak sinyali |

---

## 6. Migration ordering rule

Per Anayasa §1.6, every entry in this map must follow the ordering:

1. The primary domain table is created and stable.
2. The single source-of-truth read path is exposed via `src/lib/services/[domain].ts`.
3. The summary surface is rewritten to read via the service layer (no direct mock).
4. Cross-surface parity is verified during batch acceptance.

A summary surface migration must never run ahead of its source-of-truth
domain migration.

---

## 7. Update protocol

When a domain is migrated:
1. Confirm every summary surface that depends on it is rewritten in the
   same batch (or explicitly deferred to Faz 6 derived readers).
2. Update this map: change `Phase` column to "Done" for migrated rows.
3. Revisit Cross-surface truth parity rules — add any new derived facts.
