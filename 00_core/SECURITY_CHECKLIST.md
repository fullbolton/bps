# BPS — Güvenlik Kontrol Listesi

> **Disposition:** Bu dosya **ops review aracı**dır; source-of-truth değildir.
> Active rules `WORKFLOW_RULES.md` ve `ROLE_MATRIX.md` içinde yaşar.
> Bu liste mevcut yüzeyi doğrulamak ve açıkları önceliklendirmek içindir.
>
> **Öneri yeri:** `00_core/SECURITY_CHECKLIST.md` veya `05_ops/SECURITY_CHECKLIST.md`.
> CODEX'e eklenmemeli; README doc map'e "ops review aracı" notuyla girmeli.

---

## Kullanım Kuralı

Her madde için şu alanlar doldurulur:

- **Durum:** GREEN / YELLOW / RED
- **Owner:**
- **Son kontrol tarihi:**
- **Kanıt:**
- **Sonraki aksiyon:**

### Durum anlamları

- **GREEN** → doğrulandı / kabul edilebilir
- **YELLOW** → açık risk yok ama eksik doğrulama veya zayıf nokta var
- **RED** → gerçek açık, yanlış yapılandırma veya kabul edilemez risk var

---

# 1. Auth giriş noktaları

## 1.1 Provider-level signup kontrolü
**Durum:** GREEN
**Owner:** Furkan
**Son kontrol tarihi:** 2026-04-16
**Kanıt:** Her iki proje (`dffdzbmnmnokbftbujsy`, `tiqemcsjuyudahgmqksw`) signup toggle OFF; negatif test: doğrudan signup `HTTP 422 signup_disabled`.
**Sonraki aksiyon:** Yeni major rollout öncesi re-doğrula.

## 1.2 Pozitif login testi
**Durum:** GREEN
**Owner:** Furkan
**Son kontrol tarihi:** 2026-04-20
**Kanıt:** `bpsys.net/login` mevcut user ile 200; 20 Nisan'da same-origin browser check pass.
**Sonraki aksiyon:** —

## 1.3 Access request yüzeyi
**Durum:** YELLOW
**Owner:** Furkan
**Son kontrol tarihi:** —
**Kanıt:** İncelenmedi.
**Sonraki aksiyon:** P1 — ofis içi rollout öncesi honeypot + rate limit spot-check.

## 1.4 Auth trigger / profile yaratımı
**Durum:** YELLOW
**Owner:** Furkan
**Son kontrol tarihi:** —
**Kanıt:** Signup provider-level kapalı olduğu için pratik risk sıfır, ama trigger davranışı doğrulanmadı.
**Sonraki aksiyon:** P2 — signup açılırsa zorunlu.

---

# 2. Yetkilendirme ve veri görünürlüğü

## 2.1 RLS kapsaması
**Durum:** YELLOW
**Owner:** Furkan
**Son kontrol tarihi:** 2026-04-12
**Kanıt:** Apr 12 demo rehearsal PASS (yonetici 9 firma, Partner A 3, Partner B 4, Viewer 3 menü). O tarihten sonra schema değişimi audit edilmedi.
**Sonraki aksiyon:** Katman 3 — 3 tablo spot-check.

## 2.2 Rol modeli sızıntısı
**Durum:** YELLOW (2.1 ile aynı)
**Sonraki aksiyon:** Katman 3 ile aynı batch.

## 2.3 Public surface sızıntısı
**Durum:** YELLOW
**Sonraki aksiyon:** Katman 3.

---

# 3. Email / cron / automation güvenliği

## 3.1 Cron auth
**Durum:** GREEN
**Owner:** Furkan
**Son kontrol tarihi:** 2026-04-16
**Kanıt:** Handler kodu `if (authHeader !== 'Bearer ${secret}') return 401`; middleware fix `eff8f42`; testler 200 OK.
**Sonraki aksiyon:** —

## 3.2 Service role kullanımı
**Durum:** GREEN
**Owner:** Furkan
**Son kontrol tarihi:** 2026-04-20
**Kanıt:**
- Server-side: yalnız `src/app/api/cron/contract-expiry/route.ts`.
- Client sızma: NEXT_PUBLIC_ prefix yok.
- Scope: Production.
- **Value-tipi:** JWT decode `role:"service_role"`, `ref:"dffdzbmnmnokbftbujsy"`, last8 `Y87Ys3cc`. Eski anon-key-in-slot bug'ı 20 Nisan incident'ıyla fixlendi.
**Sonraki aksiyon:** 3.5 healthz endpoint Katman 2'de implementasyon.

## 3.3 Email sending posture
**Durum:** YELLOW
**Owner:** Furkan
**Son kontrol tarihi:** 2026-04-20
**Kanıt:** Resend API key Production+Preview scope. `bildirim@bpsys.net` 20 Nisan testinde 2 email delivered. DKIM/SPF/DMARC formal re-check yapılmadı.
**Sonraki aksiyon:** Resend dashboard delivered count + DNS record spot-check. Katman 2.

## 3.4 Idempotency / replay safety
**Durum:** GREEN
**Owner:** Furkan
**Son kontrol tarihi:** 2026-04-20
**Kanıt:**
- Unique constraint `(contract_id, recipient_profile_id, threshold_days)`.
- Write-first-then-send pattern (kod review).
- Canlı test: 1. call 2 sent + 2 row insert; 2. call `23505` skip.
**Sonraki aksiyon:** —

## 3.5 Env var value-correctness runtime self-check (YENİ — incident dersi)
> Vercel env var "secret" UI affordance, değerin doğru tipte olduğunu garanti etmez — sadece display'i gizler. Anon JWT'nin service_role slot'una konulması 4 gün silent failure üretti.

- Deploy sonrası 1-shot diagnostic endpoint var mı? (`/api/healthz?check=service_role_jwt`)
- JWT payload `role:"service_role"` döndüğünü + tiny RLS-bypass query'yi doğrular mı?
- CRON_SECRET bearer auth ile kapalı tutulur.

**Durum:** RED (yok)
**Owner:** Furkan
**Son kontrol tarihi:** —
**Kanıt:** Endpoint implement edilmedi.
**Sonraki aksiyon:** Katman 2 — Claude Code 30 dk turn'ü. ~30 satır route handler.

---

# 4. Secret ve environment hijyeni

## 4.1 Env scope kontrolü + value-tipi
**Durum:** GREEN (full sweep complete)
**Owner:** Furkan
**Son kontrol tarihi:** 2026-04-20

**Kanıt — full env var sweep tablosu:**

| Env var | Scope | Tip | Decode | Doğru |
|---|---|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Production | JWT | role=`service_role`, ref=`dffdzbmnmnokbftbujsy`, last8=`Y87Ys3cc`, length 219 | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Production | JWT | role=`anon`, ref=`dffdzbmnmnokbftbujsy`, last8=`pYl7uVA`, length 209 ⚠️ trailing `\n` | ✅ (newline cosmetic) |
| `NEXT_PUBLIC_SUPABASE_URL` | Production | URL | `https://dffdzbmnmnokbftbujsy.supabase.co` | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Preview | JWT | role=`anon`, ref=`tiqemcsjuyudahgmqksw`, last8=`Ua3juPYs`, length 208 | ✅ |
| `NEXT_PUBLIC_SUPABASE_URL` | Preview | URL | `https://tiqemcsjuyudahgmqksw.supabase.co` | ✅ |
| `RESEND_API_KEY` | Prod+Preview | `re_...` | format-only | ✅ ama 🚨 **Need To Rotate** badge |
| `CRON_SECRET` | All | hex | format-only | ✅ ama 🚨 **Need To Rotate** badge |
| `BPS_CONTRACT_EXPIRY_EMAIL_ENABLED` | All | boolean-string | `true` | ✅ |

**Yan bulgular:**
- Production anon key sonunda trailing newline (`\n`) — Vercel build process trim ediyor olmalı (çalışıyor), ama hijyenik değil. Re-paste edilmeli (1 dk) veya rotation turunda doğal olarak temizlenir.

**Sonraki aksiyon:** P0 — Need To Rotate badge'leri için 4.4 maddesine bak.

## 4.2 Secret exposure
**Durum:** YELLOW
**Owner:** Furkan
**Son kontrol tarihi:** 2026-04-16
**Kanıt:** `.gitignore` `.claude/` kapsar; `~/.claude.json` 0600. Formal `gitleaks` tarama yapılmadı.
**Sonraki aksiyon:** P2 — `gitleaks` tarama. **Ek bulgu (4.4):** Vercel/GitHub Secret Scanning iki secret tespit etti (`RESEND_API_KEY`, `CRON_SECRET`) → muhtemelen handoff dokümanlarında plain-text geçtiği için. İleride dokümanlarda secret asla plain-text yer almasın.

## 4.3 Local tooling güvenliği
**Durum:** GREEN
**Kanıt:** MCP demo-only, read-only.

## 4.4 Need To Rotate badges (TAMAMLANDI 2026-04-21)
> Vercel/GitHub Secret Scanning otomatik tespit etmişti — 21 Nisan rotation batch ile çözüldü.

**Durum:** GREEN
**Owner:** Furkan
**Son kontrol tarihi:** 2026-04-21

**Kanıt — rotation batch sonuçları:**

| Secret | Eski (silindi/invalidated) | Yeni | Deployment |
|---|---|---|---|
| `CRON_SECRET` | hex (handoff'larda plain-text leak'lemiş, son4 `4d74`) — invalidated | Yeni 32-byte hex (Web Crypto, browser-side üretim) | `GHNSpxsfo` Ready+Current 2026-04-21 |
| `RESEND_API_KEY` | `re_13RmBSJp...` (7 gün önce yaratılmış) — Resend dashboard'dan delete edildi 2026-04-21 13:00 TR | `re_VmCUwHi3...` (yeni v2 key, "BPS Contract Expiry Email v2", Sending access, All Domains) | `AQLmAHw96` Ready+Current 2026-04-21 |

Vercel env vars listesindeki "Need To Rotate" badge'leri ikisi için de kayboldu.

**Yan disiplin (kalıcı):** [[karar-secret-hijiyeni]] — secret değerleri hiçbir markdown/handoff/commit message'da plain-text yer almaz.

**Service_role JWT rotate (opsiyonel, yapılmadı):** Bu turn'de yapılmadı. Yapılırsa Supabase Settings → JWT Keys → regenerate, ama bu tüm browser session'ları kopartacağı için (anon JWT de yenilenir) sadece gerçek leak şüphesi durumunda yapılır. Şu an gereksiz.

**Sensitive toggle (opsiyonel):** Rotation tamamlandığı için artık yeni değerlerle Sensitive ON yapılabilir (Vercel "Unchanged Value" uyarısı çıkmaz). P2 olarak takvime alınabilir.

**Sonraki aksiyon:** —

## 4.5 Sensitive toggle disposition (NOT — bu turn deferred)
**Durum:** YELLOW
**Owner:** Furkan
**Kanıt:** 20 Nisan'da `SUPABASE_SERVICE_ROLE_KEY` için Sensitive toggle açıldı; Vercel "Unchanged Value" uyarısı çıktı çünkü değer recently okunmuştu (decode için). Cancel edildi. Sensitive toggle, key rotation ile birlikte doğal olarak yapılmalı (rotation sonrası yeni değer = uyarı yok).
**Sonraki aksiyon:** 4.4 rotation batch'inin parçası.

---

# 5. Public form ve abuse resistance

## 5.1 / 5.2 / 5.3
**Durum:** YELLOW (form canlı mı, anti-bot var mı, abuse görünürlüğü — incelenmedi)
**Sonraki aksiyon:** Katman 3.

---

# 6. Deployment ve environment parity

## 6.1 Demo vs production parity
**Durum:** YELLOW (yan-bulgu suspected)
**Owner:** Furkan
**Son kontrol tarihi:** 2026-04-20
**Kanıt:** İncident yan-bulgusu: demo schema'da `bitis_tarihi` (TR) iddia ediliyor; production `end_date` (EN) doğrulandı. Tek tarafı kanıtlı, audit edilmedi.
**Sonraki aksiyon:** Katman 2 — 20 dk SQL karşılaştırma.

## 6.2 Preview vs production behavior
**Durum:** GREEN
**Owner:** Furkan
**Son kontrol tarihi:** 2026-04-20
**Kanıt:**
- Vercel Cron Jobs: Enabled, `30 5 * * *` (UTC).
- Cron only runs in Production deploy.
- `BPS_APP_URL` handler default `https://bpsys.net`.
- Preview env vars demo'yu gösteriyor (sweep doğruladı): `tiqemcsjuyudahgmqksw`.
**Sonraki aksiyon:** —

## 6.3 Rollout doğrulaması
**Durum:** YELLOW
**Sonraki aksiyon:** Katman 4 — runbook.

---

# 7. Logging, audit ve gözlemlenebilirlik

## 7.1 Auth olayları
**Durum:** YELLOW
**Sonraki aksiyon:** P1.

## 7.2 Cron / automation logs
**Durum:** YELLOW
**Owner:** Furkan
**Son kontrol tarihi:** 2026-04-20
**Kanıt:** Handler aggregate log var; per-contract hatalar console.error'a düşer; **AMA** `evaluated=0` ambiguous. Hobby plan log retention 1 saat.
**Sonraki aksiyon:** 7.4 Katman 2.

## 7.3 Security-relevant history
**Durum:** GREEN
**Kanıt:** CHANGELOG + SESSION_HANDOFFS disiplinli.

## 7.4 Silent zero-condition disambiguation (YENİ — incident dersi)
> `evaluated=0 errors=[]` her iki durumda da üretilebilir: (a) pencerede veri yok (b) handler veriyi göremiyor.

- Handler companion `SELECT count(*)` atıp `expected_in_window` log'lar mı?
- `evaluated != expected_in_window` otomatik anomaly?

**Durum:** RED (yok)
**Owner:** Furkan
**Sonraki aksiyon:** Katman 2 — Claude Code 15 dk turn'ü.

---

# 8. Operasyonel süreç güvenliği

## 8.1 Kullanıcı oluşturma süreci
**Durum:** YELLOW — Katman 3 SOP yazımı.

## 8.2 Offboarding
**Durum:** YELLOW (henüz N/A) — P2.

## 8.3 Demo hesaplar
**Durum:** YELLOW
**Sonraki aksiyon:** Katman 4.

---

# 9. Tooling ve agent güvenliği

## 9.1, 9.2, 9.3
**Durum:** GREEN (önceki turnlerde doğrulandı; bu turn'de değişmedi).

---

# 10. Henüz konuşmadığımız ama izlenmesi gereken başlıklar

## 10.1 — 10.5
**Durum:** YELLOW (her biri).
**Sonraki aksiyon:** P2 / Katman 4 dağıtık.

---

# Önceliklendirme Matrisi (updated 2026-04-21)

## P0 — hemen
- 🔴 **3.5 healthz runtime self-check** (yeni) — Katman 2
- 🔴 **7.4 expected_in_window companion log** (yeni) — Katman 2
- ✅ ~~Provider-level signup kapalı~~ (1.1)
- ✅ ~~Cron/auth secrets value-correctness~~ (3.2, 4.1)
- ✅ ~~Need To Rotate batch~~ (4.4 — 21 Nisan tamamlandı)

## P1 — yakın
- 🟡 6.1 demo vs prod schema parity — Katman 2
- 🟡 1.3 access request anti-bot — Katman 3
- 🟡 3.3 email DKIM/SPF/DMARC re-check — Katman 2
- 🟡 2.1, 2.2 RLS spot-check — Katman 3

## P2 — sonra
- dependency audit
- backup/recovery drill
- broader abuse dashboards
- storage hardening review
- gitleaks taraması (4.2)
- Production anon key trailing newline temizliği (rotation turunda doğal)

---

# Cadence (tetikleyici-tabanlı)

| Tetikleyici | Zorunlu check |
|---|---|
| Yeni env var ekleme/güncelleme | 4.1 + 3.5 (healthz runtime check) |
| Yeni feature flag flip | 6.3 deployed vs enabled |
| Yeni RLS policy / migration | 2.1 spot-check |
| Yeni dış kullanıcı (gerçek müşteri) | 1.x + 8.x re-pass |
| Major milestone | Katman 3-4 full pass |
| Aylık review günü (~30 dk) | Liste gözden geçirme |
| **Her handoff/CHANGELOG yazımı** | **Secret değer ASLA plain-text yazılmaz** (CRON_SECRET incident dersi) |

---

# Her review sonunda yazılacak 4 satır

## 2026-04-22 smoke test (rotation production validation)

- **Bugün neyi kontrol ettik?** Rotation batch'inin production'da çalıştığını doğrula. Üç surface: Supabase `contract_expiry_emails_sent` tablosu, Resend v2 key "Last Used", Vercel Cron Jobs panel Run butonu ile manuel tetikleme.
- **Ne GREEN kaldı?** 🟢 Tüm mevcut GREEN'ler. **Rotation production'da doğrulandı** (manual Run `POST /api/v1/.../crons/run` → 200 OK, yeni CRON_SECRET ile handler authenticated, idempotency doğru skip etti). Yeni RESEND_API_KEY value format Vercel'de live (prefix `re_Vm`, length 36) ama end-to-end send doğrulaması yok (pencere dolu, idempotency skip) — transport zaten çalıştığı biliniyor (pazar 2 email başarıyla gönderildi).
- **Ne YELLOW/RED kaldı?** 🔴 3.5 (healthz endpoint yok), 🔴 7.4 (companion log yok), 🟡 6.1 (schema parity), 🟡 4.5 (Sensitive toggle, P2). Ayrıca 🟡 Vercel Hobby plan log retention 1 saat — observability boşluğu (3.5 maddesi bunu doldurur).
- **Tek sonraki aksiyon ne?** Katman 2: **3.5 healthz endpoint** (Claude Code ~30 dk) + **7.4 expected_in_window companion log** (Claude Code ~15 dk). Bu ikisi tamamlanınca burn-in observation süresi daha az guesswork'lü hale gelir.

## 2026-04-21 review (rotation batch closeout)

- **Bugün neyi kontrol ettik?** Sabah burn-in spot-check (sağlıklı). Sonra Katman 1.5 paranoia rotation: CRON_SECRET + RESEND_API_KEY rotate edildi, eski Resend key Resend dashboard'dan delete edildi.
- **Ne GREEN oldu?** 🟢 4.4 (Need To Rotate batch tamamen kapandı, iki yeni deployment Ready). Önceki GREEN'ler korundu.
- **Ne YELLOW/RED kaldı?** 🔴 3.5 (healthz endpoint yok), 🔴 7.4 (companion log yok), 🟡 6.1 (schema parity suspected), 🟡 4.5 (Sensitive toggle hâlâ açılmadı, P2).
- **Tek sonraki aksiyon ne?** Katman 2: 3.5 + 7.4 implementasyonu (Claude Code turn'leri, ~45 dk toplam). Yarın sabahki cron'da Resend dashboard'da v2 key'in "Last Used" sütunu güncellenirse rotation tamamen başarılı sayılır (final smoke test).

## 2026-04-20 review

- **Bugün neyi kontrol ettik?** Cron handler silent failure root-cause + bounded fix (4 gün → 15 dk). Sonra Katman 1: full env scope sweep (8 env var decode), 2 yeni checklist maddesi (3.5, 7.4), incident closeout dokümanları.
- **Ne GREEN oldu?** 3.1, 3.2 (incl. value-tipi), 3.4, 4.1 (full sweep), 4.3, 6.2. Önceki GREEN'ler korundu (1.1, 1.2, 7.3, 9.x).
- **Ne YELLOW/RED kaldı?** 🔴 4.4 (Need To Rotate badges, P0 acil), 🔴 3.5 (healthz endpoint yok), 🔴 7.4 (companion log yok), 🟡 6.1 (schema parity suspected), 🟡 4.5 (Sensitive toggle deferred to rotation).
- **Tek sonraki aksiyon ne?** Katman 1.5: 4.4 paranoia rotation batch (CRON_SECRET + RESEND_API_KEY rotate, 30 dk). Sonra Katman 2: 3.5 + 7.4 implementasyonu (Claude Code, ~45 dk). Burn-in clock sıfırlanmaz çünkü trigger/threshold/template/recipient/sender/cron-time'a dokunulmuyor.
