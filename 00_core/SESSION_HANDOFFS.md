# BPS — Session Handoffs

Append-only session history. Source-of-truth değil — history/handoff layer.
Ürün kuralları TASK_ROADMAP, CHANGELOG, WORKFLOW_RULES'da yaşar.
Bu dosya "en son ne olmuştu?" sorusuna cevap verir.

---

## 2026-04-14 — Evre 1 Tamamlama + Finansal Özet Parity

### Session amacı
Evre 1'i operasyonel olarak kapatmak, Luca downstream zincirini tamamlamak, rehearsal'ı koşmak, Finansal Özet parity'yi çözmek.

### Tamamlanan işler
1. Luca downstream RPC (confirm → financial_summaries.open_receivable)
2. Luca source signal trust patch (last_source kolonu + Ticari Özet caption)
3. Evre 1 closeout docs (TASK_ROADMAP + CHANGELOG)
4. Demo preview deployment fix (Vercel auth off + demo-preview branch)
5. Demo user setup (yönetici, partner, viewer şifreleri)
6. Finansal Özet reader parity (mock → real financial_summaries)
7. Finansal Özet writer parity (confirm → real confirm_financial_data RPC)
8. Full migration push (7 migration × 2 ortam, legacy repair dahil)
9. B–G rehearsal rerun: 6/7 PASS + 1 WARN (sector setup butonu)
10. Firma Detay + Finansal Özet parity smoke: verified

### Ortam durumu
- Production (bpsys.net, dffdzbmnmnokbftbujsy): 23 migration aligned, son commit eaf697b
- Demo (demo-preview branch, tiqemcsjuyudahgmqksw): 23 migration aligned, aynı commit
- Vercel Authentication: kapalı (BPS own auth yeterli)
- Demo credentials: repo dışı tutulur

### Bilinen WARN / later-decision
1. Sector setup — yeni firma butonu görünmüyor (UX, defer)
2. Luca is_overdue / risk badge tutarsızlığı (observe first)
3. Luca stale carryover (defer)
4. Finansal Özet Portföy Sağlık Özeti top block — cross-domain mock'lar (ayrı batch)
5. Upload modal "Mevcut" comparison — mock-seeded (minor refinement)

### Sonraki en doğru adım
Evre 2 planning veya kalan WARN item'lardan küçük bounded batch. Decision memo'dan devam et.

---

## 2026-04-14 (Devam) — Mock Audit + Ofis İçi Kullanım Hazırlığı

### Session amacı
Ofis içi kullanım öncesi mock audit ve pre-launch sorun tespiti.

### Bulgular
- 17 mock dosyası, 11 sayfa, 84 mock referansı hâlâ aktif
- Dashboard neredeyse tamamen mock-backed
- Ayarlar kullanıcı listesi mock — BLOCKER
- Global arama çalışmıyor
- Sözleşme tutarı formatsız (380000 vs ₺380.000)
- Erişim talebi formunda gereksiz "Birim" dropdown'ı
- Sözleşme ek alanları eksik (fatura tutarı, periyod, ödeme vadesi) — ürün kararı

### Kararlar
- Sıfır mock teslim hedefi: şirket içi kullanım için tüm mock'lar temizlenecek
- Ekip kendisi erişim talebi gönderecek, yönetici içeriden rol atayacak
- Para birimi sadece TL
- Erişim talebi formundan Birim dropdown kaldırılacak

### Planlanan faz sırası
- Faz 1A: Ayarlar truth restoration (BLOCKER)
- Faz 1B: Arama honesty fix
- Faz 1C: Sözleşme tutarı formatlama + erişim talebi sadeleştirme
- Faz 2A: Dashboard truth correction
- Faz 2B: Raporlar truth correction
- Faz 3: Preserved surfaces audit (duyurular, inisiyatifler, yönlendirmeler)
- Faz 4: Helper reader cleanup (6 sayfa filtre dropdown)
- Faz 5: Product decision layer (sözleşme ek alanları, profil, Luca refinements)

### Sonraki en doğru adım
Faz 1A: Ayarlar kullanıcı listesi → real profiles tablosuna bağla

---

## 2026-04-15 — Pre-Launch Mock Audit Pushdown + Dashboard Truth Correction

### Session amacı
Mock audit'inde planlanan Faz 1A-1C trust patchlerini ve Faz 2A Dashboard truth correction alt fazlarını ofis-içi kullanım öncesi sırayla temizlemek.

### Tamamlanan işler
1. Faz 1A — Ayarlar > Kullanıcılar → real `profiles`; Login Erişim Talebi Birim dropdown'ı kaldırıldı (schema değişmedi; "diger" neutral default)
2. Faz 1B — Topbar global arama input'u kaldırıldı (honest absence, no real search built)
3. Faz 1C — Sözleşme tutarları `₺X.XXX,XX` formatında gösteriliyor (`src/lib/format-currency.ts` helper); storage hala free-text
4. Faz 2A — Dashboard top 6 KPI card real Supabase truth'a bağlandı: `companies`, `contracts`, `staffing_demands`, `workforce_summary`, `tasks`, `appointments`; loading "—", honest 0, errors fall to "—"
5. Faz 2A.1 — Bugünün Görevleri + Açık Personel Talepleri real `tasks` / `staffing_demands` + company-name resolution
6. Faz 2A.2 — Yaklaşan Sözleşme Bitişleri + Eksik / Süresi Dolan Evraklar real `contracts` / `documents` via existing service readers (`listAllContracts`, `listAllDocuments`, `computeRemainingDays`)

### Ortam durumu
- `main` pushed through `0ab1b11`; all six batches deployed to production
- Demo preview unchanged
- RLS + partner scope enforced automatically on all new reads — no application-level scoping added

### Kalan Dashboard mock yüzeyleri (later-decision)
1. Riskli Firmalar — composite risk signal; needs product-definition
2. Kurumsal Kritik Tarihler card (Dashboard side; `critical_dates` table exists)
3. HotelEmailDraftHelper utility overlay
4. YöneticiInisiyatifleriSection / DuyurularSection / ActivityFeed

### Sonraki en doğru adım
Sonraki en doğru adım: Riskli Firmalar truth-correction planning
