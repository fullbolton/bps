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

---

## 2026-04-15 (Devam 2) — Yapılanma Paketi + Docs Hizalama + Stratejik Yön Netleşmesi

### Session amacı
Pazar taraması, benchmark değerlendirmesi ve ürün içi stratejik tartışmalar sonucunda BPS'in yeni yönünü belgelemek; ana governance docs'u bu yönle hizalamak.

### Tamamlanan işler
1. BPS'in yeni ürün çerçevesi netleştirildi: firma-merkezli veri omurgası + kişi-merkezli günlük deneyim
2. `03_strategy/BPS_YAPILANMA_PAKETI.md` repo'ya eklendi
3. Yapılanma Paketi içinde şu stratejik eksenler belgelendi:
   - güncellenmiş ürün tanımı
   - 5 katmanlı roadmap iskeleti
   - mock cleanup karar matrisi
   - preserved surfaces yaklaşımı
   - "Benim Günüm" tasarım prensibi
4. `00_core/README.md` yeni ürün tanımıyla hizalandı
5. `00_core/CODEX.md` yeni ürün tanımı, doğal genişleme alanları ve strateji-doc okuma sırasıyla hizalandı
6. `CLAUDE.md` yeni ürün tanımı ve guardrail yorumlarıyla hizalandı
7. `01_product/TASK_ROADMAP.md` 5 katmanlı stratejik yön ile hizalandı
8. `CLAUDE.md` agent operating-mode refinement yapıldı:
   - core principles
   - anti-patterns
   - closeout adımı
   - drift-detection güçlendirmesi

### Ana kararlar
- BPS artık dar biçimde "iç operasyon görünürlüğü aracı" olarak değil, firma-merkezli service operations platform olarak tanımlanır
- Çekirdek tasarım ilkesi: firma-merkezli veri + kişi-merkezli günlük deneyim
- Guardrail yorumu güncellendi:
  - firma-merkezli time tracking doğal büyüme alanıdır
  - firma-bazlı ekonomik görünürlük doğal büyüme alanıdır
  - dar pipeline (aday → aktif firma aktivasyonu) doğal büyüme alanıdır
- Keskin sınırlar korundu:
  - pipeline ≠ generic CRM
  - time tracking ≠ İK puantajı / vardiya
  - ekonomik görünürlük ≠ muhasebe yazılımı
- Mock cleanup çerçevesi netleştirildi:
  - sıfır mock kutsal değil
  - sıfır güven-kırıcı mock zorunlu
- "Benim Günüm" yaklaşımı kabul edildi:
  - üst katman = bugün ne yapmalıyım
  - alt katman = benim alanım ne durumda

### 5 katmanlı yön iskeleti
1. Geçiş ve Güven — geçiş, güven, truth, pilot
2. Geri Çağırma ve Çıktı — bildirim, digest, PDF/export
3. Ekonomik Görünürlük — time tracking, firma kârlılığı, utilization
4. Saha ve Büyüme — dar pipeline, mobil, API/webhook
5. Predictive / Platform — tahminleme, otomasyon 2.0, tenantization

### Belgelerdeki net sonuç
- `BPS_YAPILANMA_PAKETI.md` artık stratejik yön belgesidir
- `README.md`, `CODEX.md`, `CLAUDE.md`, `TASK_ROADMAP.md` bu yönle hizalanmıştır
- Strateji belgesi execution source-of-truth'u override etmez; execution anında aktif source-of-truth docs geçerlidir

### Sonraki en doğru adım
Katman 1 — Geçiş ve Güven execution planını açmak:
- kalan güven-kırıcı mock / preserved surface kararlarını netleştirmek
- ofis içi pilot başlangıç planını oluşturmak
- çıktı hattı (PDF / Excel export) ve temel geri çağırma hattını (özellikle email bildirim temeli) önceliklendirmek

---

## 2026-04-15 (Akşam) — Katman 1 Mock Cleanup Tamamlandı + Paralel Worktree Milat

### Session amacı
Katman 1 Geçiş ve Güven kapsamında kalan tüm mock/preserved yüzeyleri temizlemek. İlk paralel Claude Code development session'ını gerçekleştirmek.

### Tamamlanan işler
1. Track 1 (BPS 7 Katman 1): Firma filter dropdown'ları 6 sayfa → zaten real (önceki batch'lerde yapılmış). Finansal Özet top block → real aggregate. Raporlar 5 (Riskli Firma) → real companies.risk. Raporlar 6 (Partner Özet) → honest absence. Ayarlar dictionary tab'ları → inline statik config, @/mocks import kaldırıldı.
2. Track 2 (BPS 7 Katman 2): Dashboard preserved bloklar → honest absence (Kurumsal Kritik Tarihler, Duyurular, İnisiyatifler, ActivityFeed). Firma Detay preserved surfaces → honest absence (Bahsetmeler, Zaman Çizgisi, Yönlendirmeler).
3. İlk paralel Claude Code session gerçekleştirildi — iki session yan yana, aynı anda çalıştı.
4. Worktree Policy + Runbook güncellendi (native -w flag, multi-session, Katman 1 exception).
5. BPS Yapılanma Paketi repo'ya eklendi ve tüm docs hizalandı (README, CODEX, CLAUDE.md, TASK_ROADMAP).

### Mock cleanup sonucu
- src/app/ altında 0 runtime @/mocks import — tamamen temiz
- Tek kalan: src/lib/draft-hotel-email.ts (izole demo helper, pilot blocker değil)
- Session zinciri başında 84 mock referansı vardı → şimdi app yüzeyinde sıfır

### Kararlar
- BPS tanımı güncellendi: "firma-merkezli service operations platform"
- Çekirdek prensip: firma-merkezli veri + kişi-merkezli deneyim
- Paralel development: sonraki turda claude -w ile worktree izolasyonu zorunlu
- 3+ session açılacaksa: sadece planning/review, üçüncü coding writer yok

### Main commit zinciri
- ad6eb04 — Track 1: mock readers → real truth (filters, finansal özet, raporlar, ayarlar)
- 7368d71 — Track 2: preserved surfaces → honest absence (dashboard, firma detay)
- b64487c — worktree docs güncelleme
- cccbc65 — Yapılanma Paketi + docs hizalama

### Sonraki en doğru adım
Ofis içi pilot readiness: kullanıcı hesapları oluştur, ekibi davet et, ilk hafta gözlem planı yap. Paralelde export/PDF ve bildirim motoru planning başlatılabilir.

---

## 2026-04-15 (Gece) — Katman 1 Residual Closeout + Katman 2 İlk Slice'lar

### Session amacı
Katman 1 Geçiş ve Güven kalan residual'ı kapatmak ve Katman 2 — Geri Çağırma ve Çıktı'nın ilk pratik slice'larını açmak. Çıktı tarafı (PDF export) ve recall tarafı (email) birer bounded slice olarak shipped.

### Tamamlanan işler
1. Katman 1 residual: `draft-hotel-email.ts` mock dependency kaldırıldı, dashboard'da gerçek workforce verisi fetch ediliyor. `src/app/` altında runtime @/mocks import effectively sıfır.
2. Finansal Özet PDF Export V1: yonetici-only "PDF Olarak İndir" butonu, snapshot-of-screen disiplini, print-only timestamp, `@media print` mekanizması.
3. Finansal Özet WARN fix: authorized-role-gated reads — sayfa fetch'i rol doğrulanmadan başlatılmıyor, unauthorized roller için erişim kısıtlama ekranı render ediliyor (review verdict: WARN → PASS).
4. Kurumsal Kritik Tarihler PDF Export V1: aynı pattern, narrow ikinci surface. +42/-3 tek dosya.
5. Shared print infrastructure: `globals.css` `@media print` bloğu, `Layout.tsx` shell chrome print:hidden wrapping, `PageHeader.tsx` actions print:hidden — iki PDF slice'ın ortak bağımlılığı olarak main'e landed.
6. Contract Expiry Email Recall V1 (Katman 2 recall slice): yaklaşan sözleşme bitişi 30-gün eşiği, yönetici + partner-scoped routing, `contracts.responsible` display-only, idempotency `contract_expiry_emails_sent` tablosu, Vercel Cron + Resend REST, feature flag default-disabled.

### Kararlar
- **Recipient model**: `contracts.responsible` free-text routing için kullanılmaz. V1 kuralı = yonetici globally + partner via `partner_company_assignments`. Body'de `responsible` display-only context olarak görünebilir (recall wording neutralize edildi: "Bu bildirim, yaklaşan bitiş tarihi nedeniyle BPS tarafından gönderildi.").
- **Weekly Digest**: framed ve 3-block V1 yönüne yakın (4-block değil, staffing-demand anchor zayıfsa eliminate). Implementation opened DEĞİL — event-triggered email'in pilot burn-in'i gerekli.
- **PDF pattern**: ilk iki slice aynı mekanizmayı (window.print + print CSS + tek tek UI chrome hide) paylaştı. Yeni print mechanism tanıtılmadı.
- **Commit hijyeni**: Katman 1 residual, her PDF slice, shared print infra ve email recall V1 ayrı ayrı commit'lendi. Closeout push'ları her slice için ayrı yapıldı.

### Canlıya alınmayan / ops-gated
- Contract Expiry Email V1 **kod olarak shipped ama ops-gated**. Enable koşulları:
  1. `RESEND_API_KEY` Vercel env (Production + Preview)
  2. `CRON_SECRET` Vercel env
  3. `bpsys.net` için DKIM/SPF/DMARC records
  4. Resend sending domain verification
  5. Migration `20260415000500_contract_expiry_emails_sent.sql` Supabase production + demo'ya apply
  6. `BPS_CONTRACT_EXPIRY_EMAIL_ENABLED=true` flip
- Weekly Digest: design'ı kabul edilmiş ama implementation opened değil. Blocker: event email'in canlı burn-in'i.

### Main commit zinciri
- f6bcc30 — Katman 1 residual: draft-hotel-email mock removed + dashboard real workforce
- 0063552 — Finansal Özet role-gate WARN fix (PDF export öncesi auth hardening)
- 45359d9 — Contract Expiry Email Recall V1 (Katman 2 first recall slice)
- 24796b2 — Contract Expiry email neutral recall wording
- c184c34 — Kurumsal Kritik Tarihler PDF Export V1
- 38146bc — Shared print infrastructure for PDF export slices

### Sonraki en doğru adım
Contract Expiry Email Recall V1 için ops enablement (env + DNS + migration apply + flag flip). Canlı pilot burn-in başladıktan sonra Weekly Digest implementation batch'i 3-block V1 kapsamında açılabilir. Paralelde Firma Detay PDF (üçüncü PDF slice) ve Raporlar Excel planlama açılabilir.

---

## 2026-04-16 — Yerel Tooling + Contract Expiry Email V1 Ops Enablement

### Session amacı
Ürün implementation batch'i değil, yerel tooling kurulumu + shipped-ama-dormant Contract Expiry Email Recall V1'in ops enablement turu. Bu session yerel geliştirici disiplinini toparladı ve daha önce kod olarak shipped kapasitenin ops kapılarını kapattı.

### Tamamlanan yerel tooling (local-only, repo'ya taşınmaz)
1. **Pre-commit TypeScript guard** — `.git/hooks/pre-commit` executable, `npx tsc --noEmit` çalıştırır; type hatasında commit blokelenir. Git hook'u doğası gereği track edilmez.
2. **Slash command seti** — `.claude/commands/` altında `/bps-review`, `/bps-mock-audit`, `/bps-batch-close`. Proje dizini içinde ama `.gitignore:.claude/` kuralıyla kapsanır, commit edilmez.
3. **Paralel session koordinasyonu** — `.claude/track-status.md` yerel koordinasyon dosyası oluşturuldu; her paralel Claude Code session'ı STARTING / DONE / BLOCKED kayıtlarını buraya yazar. Local-only.
4. **MCP kullanım disiplini notu** — `.claude/mcp-usage.md` dosyası yerel çalışma prensiplerini sabitler (demo-only, read-only, docs yerine geçmez, scope açmaz). Source-of-truth değil, yerel rehber.

### Supabase MCP setup (yalnız demo, yalnız read-only)
- Scope: Claude Code `local` (proje bazlı, kullanıcıya özel, shared değil). `~/.claude.json` altında yaşar.
- Target: `--project-ref=tiqemcsjuyudahgmqksw` (yalnız demo projesi). Production (`dffdzbmnmnokbftbujsy`) MCP olarak bağlı değildir.
- Mode: `--read-only` spawn argümanı. Write / migration / mutation yolu yoktur.
- Repo'da `.mcp.json` yoktur; `git ls-files` MCP ile ilgili hiçbir şey içermez. Shared/team konfigürasyonu yaratılmamıştır.
- PAT `~/.claude.json` içinde (0600 mode) tutulur; secret repo'ya sızmaz.
- Amaç: schema / table / constraint / parity inspection. Docs yerine geçmez; çelişki olursa çelişki açıkça bildirilir.

### Contract Expiry Email Recall V1 — ops enablement durumu
Kod-seviyesi slice bu session'dan ÖNCE shipped idi (commit zinciri: `45359d9` slice, `24796b2` neutral wording). Bu session'da ops tarafındaki kapılar kapatıldı:
- Feature flag (`BPS_CONTRACT_EXPIRY_EMAIL_ENABLED`) enable edildi.
- Redeploy tetiklendi / build süreci başladı.
- İlk beklenen cron çalıştırması ertesi sabah **~08:30 TR** (`30 5 * * *` UTC). Bu ilk çalıştırma henüz gerçekleşmedi; başarı canlı olarak henüz doğrulanmamıştır.
- İlk çalıştırma, aktif ve `end_date - today ∈ [0, 30]` olan her sözleşme için **catch-up burst** üretecek şekilde tasarlanmıştır. Bu beklenen V1 davranışıdır, bug değildir. İdempotency tablosu (`contract_expiry_emails_sent`) aynı sözleşme × alıcı × 30-gün üçlüsünün tekrar mail almasını yapısal olarak engeller.

### Burn-in gözlem planı (ilk cron sonrası operatörün izleyeceği yüzeyler)
- **Resend dashboard** — delivery rate, bounce, spam complaints, DKIM/SPF/DMARC alignment.
- **Vercel function / cron logs** — `/api/cron/contract-expiry` invocation kaydı, aggregate summary satırı (`evaluated= attempted= sent= skipped= failed=`), herhangi bir per-contract hata log'u.
- **Demo Supabase `contract_expiry_emails_sent`** — idempotency kaydı oluştuğunun doğrulanması; satır sayısı beklenen burst boyutuna uymalı (aktif + end_date 0–30 gün içinde olan sözleşme sayısı × alıcı sayısı).
- Değişiklik tetikleyicileri (herhangi biri burn-in sayacını sıfırlar): threshold, template / copy, recipient kuralı, sender adresi, cron zamanı.

### Scope guardrail'leri korundu
Bu session **AÇMAMIŞTIR / GENİŞLETMEMİŞTİR**:
- Weekly Digest implementation (framed-ama-not-opened durumunda kalır; event email burn-in'i sequencing-blocker)
- In-app notification merkezi / badge / bell / sidebar item
- Recipient rule (yonetici global + partner via `partner_company_assignments`; `contracts.responsible` display-only) — değişiklik yok
- Ürün yüzey redesign'ı — hiçbir page/component/service dokunulmadı
- Roadmap sıralaması — TASK_ROADMAP sequencing olduğu gibi

### Ortam durumu
- Kod tarafı: `main` son commit `38146bc` (shared print infra); `45359d9` ve `24796b2` arada. `demo-preview` aynı baş commit.
- Supabase demo (`tiqemcsjuyudahgmqksw`): MCP son kontrolünde `contract_expiry_emails_sent` tablosu public şemada henüz **GÖRÜLMEMİŞTİ** — ops, migration apply'ını enablement kapısı olarak listelemişti; bu session sonunda migration'ın uygulanıp uygulanmadığı lokal MCP'den doğrulanmadı. İlk cron sonrası Supabase tarafında tabloda kayıt oluşup oluşmadığı birincil doğrulama noktasıdır.
- Yerel working tree: pre-existing uncommitted notlar (ör. `00_core/CHANGELOG.md`, `00_core/SESSION_HANDOFFS.md` önceki turnlerden) ve `.DS_Store` / `.claude/settings.local.json` / `ayik-adam-mvp-preview/` silinmeleri var; bunlar bu session'da dokunulmadı.

### Sonraki en doğru adım
Ertesi sabah 08:30 TR cron çalıştırmasının ardından **post-cron burn-in incelemesi**: (1) Vercel function log'unda aggregate satır ve per-contract hata yoğunluğu, (2) Resend dashboard'da delivered/bounce/complaint, (3) demo Supabase `contract_expiry_emails_sent` satır sayısı beklenen burst boyutuyla uyumlu mu. Clean gözlem pencereleri Weekly Digest batch'inin açılma önkoşuludur; kirli sinyaller implementation sırasını değiştirmez, sadece sürenin uzamasına yol açar.
