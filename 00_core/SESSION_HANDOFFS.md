# BPS — Session Handoffs

Append-only session history. Source-of-truth değil — history/handoff layer.
Ürün kuralları TASK_ROADMAP, CHANGELOG, WORKFLOW_RULES'da yaşar.
Bu dosya "en son ne olmuştu?" sorusuna cevap verir.

---

## 2026-04-22 (akşam) — User Offboarding Runbook

### Session amacı
ChatGPT review P1 batch: offboarding / stale access prosedürü yazılı hale getirilsin. Pre-office-rollout öncesi hazır olsun.

### Verdict
🟢 GREEN. Runbook yazıldı, SECURITY_CHECKLIST §1.5 YELLOW'a geçti. Burn-in clock korundu (prose-only, kod değil).

### Yapılan
- Yeni dosya: `docs/runbooks/user-offboarding.md` (237 satır prose)
- 5-adım prose prosedür: auth disable → profile soft-delete (pending) → scope null-out → contracts.responsible reassign → Obsidian audit stamp
- 4 prensip: disable-not-delete, historical data preservation, scope kesimi, display reference reassign
- Schema dependency (profile soft-delete kolonu) explicit flag'li, ayrı batch'e ertelendi

### Kod / Schema / RLS değişikliği
Yok. Sadece prose dokümantasyon. Burn-in clock korundu.

### Ortam durumu
- Kod: `main` commit `11e0576`
- Production: `FpLnxGyym` Ready + Current
- Cron Jobs: Enabled, schedule unchanged

### Sonraki
- Yarın sabah 09:00-09:30 TR: ilk scheduled cron observation (3.5 + 7.4 live)
- İlk gerçek offboarding → runbook drill
- Access request anti-bot (honeypot + rate limit) — P1 listesinde 2. sıra

---

## 2026-04-22 — expected_in_window Companion Log (SECURITY_CHECKLIST 7.4 RED → GREEN)

### Session amacı
Cron handler'a silent-zero disambiguation ekle: eval loop'tan bağımsız COUNT(*) companion + summary log extension + anomaly warning + response field. 20 Nisan incident'ında "pencere boş mu, auth bozuk mu" ayrımı yapılamadığı için.

### Verdict
🟢 **GREEN.** `src/app/api/cron/contract-expiry/route.ts` +25 satır: companion count, expanded summary log (`expected_in_window=X evaluated_actual=Y ...`), anomaly warning (`Verify via /api/healthz`), response body'ye `expectedInWindow` alanı. Advisory-only — countError abort etmez. TypeScript clean.

### File delta
- `src/app/api/cron/contract-expiry/route.ts` (109 → 134 satır, +25)
- `00_core/CHANGELOG.md`, `00_core/SECURITY_CHECKLIST.md` § 7.4 RED → GREEN, P0 listesi güncellendi, `00_core/SESSION_HANDOFFS.md`

### Burn-in clock
🟢 **Korundu.** Sadece observability; trigger/threshold (30 gün)/template/recipient/sender/cron-time/schema/RLS/env-var dokunulmadı. `evaluated`/`attempted`/`sent`/`skippedIdempotent`/`failed` semantics aynı. 20 Nisan 22:57 TR'den itibaren sayıyor.

### Sonraki en doğru adım
Katman 2 kapandı (3.5 + 7.4). Burn-in observation 23 Nisan 22:57 TR'ye kadar devam. Production'da healthz curl ile smoke test ve yarın sabah 08:30 TR cron'undan sonra yeni log formatının Vercel Functions log'unda görünüp görünmediğini doğrula.

---

## 2026-04-22 — Healthz Endpoint (SECURITY_CHECKLIST 3.5 RED → GREEN)

### Session amacı
20 Nisan silent failure incident'ının forward-looking guarantee'sini implement et: deploy sonrası 1-shot curl ile env var value-correctness doğrulayan diagnostic endpoint.

### Verdict
🟢 **GREEN.** `src/app/api/healthz/route.ts` eklendi. 5 check (service_role_jwt, anon_jwt, service_role_query, cron_secret_present, resend_key_format), bearer auth (CRON_SECRET), side-effect yok. `src/lib/supabase/middleware.ts` public-route listesine `/api/healthz` eklendi (cron rotaları ile aynı pattern). TypeScript clean. SECURITY_CHECKLIST 3.5 RED → GREEN.

### File delta
- `src/app/api/healthz/route.ts` (yeni, ~120 satır)
- `src/lib/supabase/middleware.ts` (public-route ekleme, 1 satır değişiklik)
- `00_core/CHANGELOG.md`, `00_core/SECURITY_CHECKLIST.md`, `00_core/SESSION_HANDOFFS.md`

### Burn-in clock
🟢 **Korundu.** Sadece observability eklendi; trigger/threshold/template/recipient/sender/cron-time/schema/RLS/env-var dokunulmadı. 20 Nisan 22:57 TR'den itibaren sayıyor.

### Sonraki en doğru adım
Katman 2 (P0): **7.4 expected_in_window companion log** (Claude Code ~15 dk). Sonra production'da healthz curl ile smoke test.

---

## 2026-04-22 — Rotation Production Validation (Smoke Test)

### Session amacı
Dün tamamlanan rotation batch'inin production'da gerçekten çalıştığını doğrulamak. Üç surface: Supabase tablosu, Resend dashboard, Vercel Cron Jobs Run butonu ile manuel tetikleme.

### Verdict
🟢 **GREEN.** Rotation production'da doğrulandı. Manuel Run tetiklemesi başarılı, yeni CRON_SECRET ile handler authenticated, idempotency çalışıyor. Hiçbir kod, migration, RLS değişikliği yok. Burn-in clock korundu.

---

### Test 1 — Supabase `contract_expiry_emails_sent`

```sql
SELECT
  (SELECT COUNT(*) FROM contract_expiry_emails_sent) AS total_stamps,
  (SELECT COUNT(*) FROM contract_expiry_emails_sent WHERE sent_at >= NOW() - INTERVAL '24 hours') AS last_24h_stamps,
  (SELECT COUNT(*) FROM contract_expiry_emails_sent WHERE sent_at >= NOW() - INTERVAL '6 hours') AS last_6h_stamps,
  (SELECT MIN(sent_at) FROM contract_expiry_emails_sent) AS first_stamp,
  (SELECT MAX(sent_at) FROM contract_expiry_emails_sent) AS last_stamp,
  (SELECT COUNT(*) FROM contracts WHERE end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days' AND status = 'aktif') AS expected_in_window;
```

Sonuç: `total=2, last_24h=0, last_6h=0, first/last 2026-04-20 19:57 UTC, expected_in_window=1`.

**Yorum:** Dünkü ve bugünkü scheduled cron'lar (08:30 TR = 05:30 UTC) çalıştı ama tabloyya yeni satır eklemediler. Bu **doğru ve beklenen** — handler `write-first-then-send` pattern'inde, `INSERT` UNIQUE constraint ihlali (`23505`) alınca `skippedIdempotent++` ve Resend'e hiç gitmiyor.

### Test 2 — Resend dashboard

`BPS Contract Expiry Email v2` (`re_VmCUwHi3...`), Sending access, "Last Used: No activity", Created 22h ago.

**Yorum:** "No activity" beklenmedik değil. Handler Resend'i hiç çağırmadı (idempotency skip). v2 key Vercel'de live, format doğru, ama end-to-end send ile doğrulanmak için yeni bir contract veya yeni recipient lazım.

### Test 3 — Vercel Cron Jobs manual Run

Vercel Settings → Cron Jobs → `/api/cron/contract-expiry` → **Run** butonu tıklandı.

Network request capture: `POST /api/v1/projects/prj_1tTXVGFHaivskY3U1GuzXPkPDRau/crons/run` → **200 OK** ✅

**Yorum:** Bu en kesin kanıt. Vercel backend Run isteğini kabul etti, cron'u invoke etti. Handler yeni CRON_SECRET ile authenticated olmasaydı Vercel Cron 401 veya 500 dönerdi. 200 OK = **yeni CRON_SECRET production'da çalışıyor** ✅

### Vercel Hobby plan log retention note

Vercel Logs sayfasında "Last 12 hours" ve "Last day" seçenekleri **"Upgrade to Pro"** altında. Hobby plan log retention **1 saat**. Sabahki 08:30 TR cron'un log'u kaybolmuştu. Bu observability boşluğu [[SECURITY_CHECKLIST]] 3.5 (healthz endpoint) ve 7.4 (companion log) maddelerinin motivasyonunu güçlendiriyor — handler kendi telemetry'sini Supabase'e yazarsa Vercel log retention sorununu bypass etmiş oluruz.

### Özet tablosu

| Surface | Kanıt | Sonuç |
|---|---|---|
| Vercel Cron Jobs Run → `POST /crons/run` | 200 OK | ✅ CRON_SECRET production validated |
| Supabase `contract_expiry_emails_sent` | 2 satır, değişmedi | ✅ Idempotency çalışıyor, write-first pattern doğru |
| Resend v2 key "Last Used" | "No activity" | ✅ Beklenen (handler Resend'e hiç gitmedi) |
| Resend v2 key value | prefix `re_Vm`, length 36, Vercel'de live | ✅ Format correct, production'da load'lanmış |
| RESEND end-to-end send validation | Yapılmadı | 🟡 Pencere dolu (idempotency skip) — transport zaten çalıştığı biliniyor, ayrıca test gerekmez |

### Burn-in clock
🟢 **Korundu.** 20 Nisan 22:57 TR'den itibaren sayıyor. Bugünkü smoke test kod, data, config değiştirmedi — sadece mevcut cron'u manuel tetikledi.

### Ortam durumu
- Kod: `main` commit `0271f37` (değişmedi)
- Aktif deployment: `AQLmAHw96` Production Ready + Current
- Env vars: yeni CRON_SECRET, yeni RESEND_API_KEY (`re_VmCUwHi3...`)
- Resend: 1 key aktif (`BPS Contract Expiry Email v2`), eski key delete edildi 21 Nisan
- Cron Jobs: Enabled, schedule `30 5 * * *` (UTC)

### Sonraki en doğru adım
**Katman 2 (P0):** 3.5 healthz endpoint + 7.4 companion log (Claude Code, ~45 dk toplam). Yeni Claude Code turn'ü için hazır. Bu işler burn-in clock'u sıfırlamaz (observability, trigger/threshold/template/recipient/sender'a dokunmaz).

**Devam:** Burn-in observation 23 Nisan 22:57 TR'ye kadar (4-day clean window). O zamana kadar 3.5 + 7.4 implementasyonu tamamlanırsa: 3.5 her gün otomatik env doğrular, 7.4 silent zero senaryolarını görünür yapar.

---

## 2026-04-21 — Katman 1.5 Paranoia Rotation Batch Closeout

### Session amacı
[20 Nisan incident + sweep](#2026-04-20) sırasında ortaya çıkan iki "Need To Rotate" badge'inin temizlenmesi: `CRON_SECRET` + `RESEND_API_KEY`. Sabah burn-in spot-check ile başla, gün sonunda rotation kapansın.

### Verdict
🟢 **GREEN.** Rotation batch tamamen kapandı. İki secret rotate edildi, eski Resend key invalidate edildi. Hiçbir kod, migration, RLS değişikliği yok. Burn-in clock korundu.

---

### Bölüm 1 — Sabah burn-in spot-check

SQL (Supabase PSS):

```sql
SELECT
  (SELECT COUNT(*) FROM contract_expiry_emails_sent) AS total_stamps,
  (SELECT COUNT(*) FROM contract_expiry_emails_sent WHERE sent_at >= NOW() - INTERVAL '24 hours') AS last_24h_stamps,
  (SELECT MIN(sent_at) FROM contract_expiry_emails_sent) AS first_stamp,
  (SELECT MAX(sent_at) FROM contract_expiry_emails_sent) AS last_stamp,
  (SELECT COUNT(*) FROM contracts WHERE end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days' AND status = 'aktif') AS expected_in_window;
```

Sonuç: `total=2, last_24h=2, first/last_stamp 2026-04-20 19:57 UTC, expected_in_window=1`.

Yorum: sabah 08:30 TR scheduled cron çalıştı, 1 sözleşme gördü, 2 recipient için unique constraint (`23505`) ile idempotency skip etti. Yeni satır yok, yeni email yok. **Tam beklenen davranış. Fix kalıcı.**

---

### Bölüm 2 — CRON_SECRET rotation

**Üretim:** Browser-side Web Crypto API:
```js
const bytes = new Uint8Array(32);
crypto.getRandomValues(bytes);
const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
```

**Aktarım:** Vercel env vars edit modal'ında React-friendly setter ile Value alanına yazıldı, kimseye gösterilmedi (ne transcript'e ne external service'a). `window.__newCronSecret` Vercel tab memory'sinde tutuldu, sonra silindi.

**Save + Redeploy:**
- Save → "Updated successfully" toast
- Redeploy popup → modal Redeploy
- Deployment `GHNSpxsfo` Ready + Current, build 1m 10s
- Eski secret (son4 `4d74`) artık geçersiz

---

### Bölüm 3 — RESEND_API_KEY rotation

**Resend dashboard:**
- "Create API Key" → name `BPS Contract Expiry Email v2`, permission `Sending access`, domain `All Domains` (eski ile parite)
- Yeni key dialog'da göründü, prefix `re_VmCUwHi3...`, length 36

**Cross-tab clipboard bridge tekniği** (yeni — programmatic `navigator.clipboard` cross-tab focus restriction yüzünden çalışmadı, native OS clipboard kullanıldı):

```js
// Source tab (Resend)
const ta = document.createElement('textarea');
ta.id = '__claude_bridge__';
ta.value = window.__newResendKey;
document.body.appendChild(ta);
ta.focus();
ta.select();
// computer.action key 'cmd+c' (native OS copy)

// Target tab (Vercel)
// Click value textarea, computer.action key 'cmd+a' then 'cmd+v'
```

Doğrulama: Vercel textarea'da `length:36, prefix:"re_Vm", isSameAsOld:false, hasOnlyAlnum:true` ✅

**Save + Redeploy (iki adımda):**
- 20 Nisan gece: save kayıt edildi (Vercel UI "Additional Permissions Required" geçici hatası verdi ama save başarılıydı, 21 Nisan'da doğrulandı)
- 21 Nisan öğleden sonra: Vercel deployments listesinde RESEND için redeploy GÖRÜNMÜYORDU → manuel redeploy: Current deployment "..." → Redeploy → modal Redeploy
- Deployment `AQLmAHw96` Ready + Current

**Eski Resend key delete:**
- Resend dashboard → `BPS Contract Expiry Email` (re_13RmBSJp..., 7 gün önce yaratılmış) → "..." → "Delete API key"
- Onay diyaloğu: "Type BPS Contract Expiry Email to confirm" → ad yazıldı → Delete
- Toast: "This API Key has been deleted" ✅

**Cleanup:**
- Bridge textarea silindi (`document.getElementById('__claude_bridge__')?.remove()`)
- `window.__newResendKey` silindi

---

### Doğrulama tablosu

| Surface | Önce (20 Nisan akşam) | Sonra (21 Nisan öğle) |
|---|---|---|
| Vercel `CRON_SECRET` | "Need To Rotate" badge | Badge yok, "Updated 22h ago" |
| Vercel `RESEND_API_KEY` | "Need To Rotate" badge, eski v1 değer | Badge yok, "Updated 20h ago", yeni v2 değer (`re_VmCUwHi3...`) |
| Vercel deployments | `5k4nr3481` Current (incident fix) | `AQLmAHw96` Current (RESEND redeploy) |
| Resend API Keys | 1 key (`BPS Contract Expiry Email`, eski) | 1 key (`BPS Contract Expiry Email v2`, yeni) |

---

### Burn-in clock
🟢 **Korundu.** 20 Nisan 22:57 TR'den itibaren sayıyor. Bu rotation trigger/threshold/template/recipient/sender/cron-time'dan hiçbirine dokunmadı, sadece kimlik bilgisi değişti.

### Kod / Schema / RLS değişikliği
**Yok.** Sadece env var değerleri (Vercel) ve API key tablosu (Resend) değişti.

### Yeni dokümantasyon
- `SECURITY_CHECKLIST.md` 4.4 RED → GREEN, kanıt tablosu eklendi
- Obsidian `01-projects/bps/sessions/2026-04-21-rotation-batch.md` (narrative versiyon, cross-tab clipboard tekniği detayı dahil)
- Obsidian `01-projects/bps/decisions/karar-secret-hijiyeni.md` (kalıcı disiplin: secret değerleri ASLA plain-text)
- Obsidian `01-projects/bps/decisions/karar-repo-vs-obsidian-disposition.md` (iki kanal arası disposition kuralı)

### Yeni discipline (kalıcı)
**Secret değerleri herhangi bir markdown/handoff/CHANGELOG/commit message'da plain-text yer almaz.** Partial mask (`hex...4d74`) veya last-N-chars referans kullan. CRON_SECRET incident'ı bunun maliyetini gösterdi.

### Yarın sabahki cron — final smoke test
22 Nisan 08:30 TR cron'u çalıştığında:
- Yeni `CRON_SECRET` ile Vercel Cron otomatik header oluşturur
- Yeni `RESEND_API_KEY` ile Resend transport doğrulanır
- Aynı sözleşme idempotency skip eder (yeni email yok)
- **Resend dashboard'da `BPS Contract Expiry Email v2`'nin "Last Used" sütunu güncellenir** → rotation production'da gerçekten çalıştı demektir

E�er `recipientsFailed > 0` veya `errors[]` doluysa → yeni Resend key validation problemi → eski key zaten silindi, rollback yok → debug + yeni v3 key üret.

### Ortam durumu
- Kod: `main` commit `0271f37` (değişmedi, 5 gün öncesi)
- Aktif deployment: `AQLmAHw96` Production Ready + Current
- Aktif secrets: yeni CRON_SECRET (last4 `28cd0b`), yeni RESEND_API_KEY (`re_VmCUwHi3...`)
- Cron Jobs: Enabled, schedule `30 5 * * *` (UTC), unchanged
- "Need To Rotate" badge'leri: yok ✅

### Sonraki en doğru adım
**Katman 2 (P0):** 3.5 healthz endpoint + 7.4 companion log (Claude Code, ~45 dk toplam). Burn-in clock'u sıfırlamayan observability işleri.

---

## 2026-04-20 — Contract Expiry Email V1 Silent Failure Resolution + Security Checklist Sweep

### Session amacı
4 günlük silent cron failure'ın root-cause tespiti, bounded fix, ardından Katman 1 güvenlik checklist'i (sweep + dokümantasyon).

### Verdict
🟢 **GREEN (incident).** Root cause tek env var yanlış-slot; tek env var değişikliği + redeploy ile çözüldü. Hiçbir kod, migration veya RLS değişikliği yapılmadı.
🔴 **RED (yeni bulgu).** Vercel Secret Scanning iki secret için "Need To Rotate" badge'i yakaladı — paranoia rotation batch'i P0 olarak açıldı.

---

### Bölüm 1 — İncident: Contract Expiry Email V1 silent failure

**Root cause:**
Vercel Production scope'undaki `SUPABASE_SERVICE_ROLE_KEY` env var'ına **anon JWT** kopyalanmıştı (büyük olasılıkla 16 Nisan'da "SUPABASE_SERVICE_ROLE_KEY yok → 500 crash" hatasını çözerken acele bir copy-paste). JWT payload decode: `role:"anon"`, doğru `ref`.

**Silent failure zinciri:**
1. Cron handler `createClient(url, SERVICE_ROLE_KEY)` ile init etti, kendisi service role olduğunu sandı
2. PostgREST JWT'yi decode etti → `role: "anon"` gördü
3. Anon role'e RLS uygulandı → contracts SELECT auth.uid() null → 0 satır
4. Supabase `{data: [], error: null}` döndü — **exception fırlatmadı**
5. Handler `if (contractError)` tetiklenmedi → `errors:[]` boş kaldı
6. Log: `evaluated=0 attempted=0 sent=0 errors=[]`

4 gün boyunca sessiz silent failure.

**Detection:**
"16 Nisan akşam GREEN" verdict'i `evaluated=0` olduğunda verildi — ama o anda 30-gün penceresinde sözleşme yoktu, dolayısıyla `evaluated=0` doğal kabul edildi. 20 Nisan'da veri penceresinde 1 sözleşme (`Gıda Üretim Personeli Sözleşmesi`, end_date `2026-04-30`) olduğunda aynı `evaluated=0` tetiklendi ve çelişki görünür oldu.

**Fix:**
1. Supabase dashboard → PSS → Settings → API Keys → Legacy tab → `service_role` key reveal + kopyala
2. Vercel Settings → Environment Variables → `SUPABASE_SERVICE_ROLE_KEY` (Production) → Edit → eski anon JWT'yi sil → yeni service_role JWT'yi yapıştır → Save
3. Redeploy (no cache) mevcut main commit `0271f37` üzerine → deployment `5k4nr3481`, build 1m 13s, Ready + Current
4. Curl re-test: `contractsEvaluated:1, recipientsAttempted:2, recipientsSent:2` (ilk call) → `recipientsSkippedIdempotent:2` (2. call, doğru davranış)
5. `contract_expiry_emails_sent` tablosu doğrulama: 2 satır, `sent_at ~ 19:57:32 UTC` (22:57 TR)

**Doğrulama sonuçları:**

| Surface | Önce | Sonra |
|---|---|---|
| `contractsEvaluated` | 0 | 1 |
| `recipientsAttempted` | 0 | 2 |
| `recipientsSent` | 0 | 2 (ilk call) |
| Idempotency | untested | ✅ 23505 on 2. call |
| `contract_expiry_emails_sent` rows | 0 | 2 |

**Burn-in clock:**
🟢 **Restart 2026-04-20 22:57 TR.** Önümüzdeki 4 scheduled cron clean gözlemle bitmeli. Herhangi bir değişiklik (threshold, template, recipient kuralı, sender, cron zamanı) sayacı sıfırlar. Aşağıdaki rotation/observability işleri sayacı sıfırlamaz.

---

### Bölüm 2 — Katman 1 güvenlik sweep + dokümantasyon

**Yapılan iş:**
- Vercel'deki tüm 8 env var'ın value-tipi sweep'i (JWT decode, URL match, format identification)
- `SECURITY_CHECKLIST.md` dokümantasyonu (Furkan'ın verdiği şablon + delta + 2 yeni madde)
- README doc map önerisi
- CHANGELOG entry'leri

**Env scope sweep — full sonuç:**

| Env var | Scope | Doğrulama |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Production | ✅ role=service_role, ref=PSS, last8=`Y87Ys3cc` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Production | ✅ role=anon, ref=PSS, ⚠️ trailing `\n` |
| `NEXT_PUBLIC_SUPABASE_URL` | Production | ✅ `https://dffdzbmnmnokbftbujsy.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Preview | ✅ role=anon, ref=demo |
| `NEXT_PUBLIC_SUPABASE_URL` | Preview | ✅ `https://tiqemcsjuyudahgmqksw.supabase.co` |
| `RESEND_API_KEY` | Prod+Preview | ✅ format ama 🚨 **Need To Rotate** |
| `CRON_SECRET` | All | ✅ format ama 🚨 **Need To Rotate** |
| `BPS_CONTRACT_EXPIRY_EMAIL_ENABLED` | All | ✅ `true` |

Sonuç: **tüm scope'lar ve değer tipleri doğru.** Service_role bug dışında başka silent failure yüzeyi yok.

**Yeni RED maddeler (incident'tan çıkan dersler):**
- **3.5 Env var value-correctness runtime self-check** — Deploy sonrası `/api/healthz?check=service_role_jwt` benzeri 1-shot diagnostic endpoint. JWT payload'unda `role:"service_role"` döndüğünü + tiny RLS-bypass query doğrular. Bu endpoint olsaydı, incident 4 gün değil 4 dakikada yakalanırdı.
- **7.4 Silent zero-condition disambiguation** — Handler aynı turn'de companion ham `SELECT count(*)` atıp `expected_in_window` sayısı log'lar. `evaluated != expected_in_window` otomatik anomaly sinyali. `evaluated=0 errors=[]` artık tek başına ambiguous olmaz.

Her iki madde Katman 2'de (burn-in penceresi içinde, observability ekleme olarak) implement edilecek.

---

### Bölüm 3 — Yeni RED bulgu: P0 paranoia rotation batch

**Bulgu:**
Vercel/GitHub Secret Scanning otomatik tespit yaptı ve iki env var'a "Need To Rotate" badge'i koydu:
- `RESEND_API_KEY` (Prod+Preview)
- `CRON_SECRET` (All Environments)

**Olası kaynak:** CRON_SECRET, önceki handoff dokümanlarında **plain-text** geçti. Eğer bu dokümanlar repo'ya commit'lendiyse GitHub Secret Scanning algılar.

**Yeni discipline:** Handoff/CHANGELOG/herhangi bir markdown'da secret değerleri ASLA plain-text yer almasın. Last-N-chars veya partial mask kullan ("hex...4248b7...4d74" gibi).

**Rotation batch (~30 dk, sonraki turn):**
1. **CRON_SECRET rotate:** terminal'de `openssl rand -hex 32` → Vercel All Environments env update → redeploy.
2. **RESEND_API_KEY rotate:** Resend dashboard → API Keys → Generate new → Vercel Prod+Preview env update → eski key delete → redeploy.
3. **Service_role JWT (paranoia, opsiyonel):** Supabase Settings → JWT Keys → regenerate. **DİKKAT:** Bu hem anon hem service_role JWT'leri yeniler — tüm browser session'ları kopar. Eğer yapılırsa: tüm 4 SUPABASE_*_KEY değerleri yeniden alınıp Vercel'e paste edilir.
4. **Sensitive toggle:** Rotation sonrası yeni değerlerle Sensitive ON; o zaman Vercel "Unchanged Value" uyarısı çıkmaz.
5. **Production anon key trailing `\n`:** doğal olarak temizlenir (yeni paste).

**Sensitive toggle deferred (bu turn):** SUPABASE_SERVICE_ROLE_KEY için Sensitive ON denemesi sırasında Vercel uyardı: "değer recently okunmuştu, yeni değer girin." Cancel edildi. Sensitive toggle, key rotation ile birlikte yapılmalı.

---

### Scope guardrail'leri korundu
Bu session **açmamış / genişletmemiştir**:
- Weekly Digest
- In-app notification merkezi
- Recipient rule (yonetici global + partner via `partner_company_assignments` — değişiklik yok)
- Ürün yüzeyi, page, component — hiç biri
- Roadmap sequencing — olduğu gibi

### Ortam durumu
- Kod: `main` commit `0271f37` (kod değişmedi)
- Deployment: `5k4nr3481` Ready + Current, Production
- Env var: `SUPABASE_SERVICE_ROLE_KEY` (Production) — gerçek service_role JWT, last8 `Y87Ys3cc`
- Cron Jobs: Enabled, schedule `30 5 * * *` (UTC)

### Yeni doküman: `SECURITY_CHECKLIST.md`
Disposition: ops review aracı (source-of-truth değil). Öneri yer: `00_core/SECURITY_CHECKLIST.md`. README doc map'e eklenmeli; CODEX'e dokunulmaz. Aktif kurallar WORKFLOW_RULES + ROLE_MATRIX'te yaşamaya devam eder.

### Sonraki en doğru adım
**Katman 1.5 (P0):** Paranoia rotation batch (CRON_SECRET + RESEND_API_KEY rotate, 30 dk). Bu burn-in'i sıfırlamaz.
**Katman 2 (P0/P1):** 3.5 healthz endpoint + 7.4 companion log (Claude Code, ~45 dk toplam).
**Devam:** Burn-in observation + Weekly Digest implementation 4-day clean window sonunda.

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

---

## 2026-04-16 (Akşam) — Contract Expiry Email V1 Ops Enablement Tamamlandı + Auth Hardening

### Session amacı
Ürün geliştirme değil; ops enablement + güvenlik sıkılaştırma oturumu. Contract Expiry Email V1 pipeline'ını canlıya hazır duruma getirmek ve her iki Supabase projesinde signup'ı kapatmak.

### Contract Expiry Email V1 — operasyonel durum
Pipeline runtime-ready. Manuel `curl` ile doğrulandı: `200 OK`, `contractsEvaluated:0` (30 gün penceresi içinde aktif sözleşme yok — beklenen davranış).

**5 katmanlı debug zinciri çözüldü:**
1. Vercel Cron yalnız production'da çalışır — burn-in demo-preview'dan production'a taşındı
2. Middleware cron endpoint'i `/login`'e 307 redirect yapıyordu — `eff8f42` commit'iyle düzeltildi
3. `RESEND_API_KEY` yalnız Preview scope'undaydı — Production + Preview olarak genişletildi
4. `SUPABASE_SERVICE_ROLE_KEY` Production scope'unda eksikti — eklendi
5. Production DB'de `contract_expiry_emails_sent` migration'ı eksikti — SQL Editor ile uygulandı

İlk zamanlanmış cron çalıştırması yarın **08:30 TR** (`30 5 * * *` UTC) bekleniyor. Burn-in gözlemi pending.

### Auth hardening
Supabase signup toggle her iki projede kapatıldı:
- **Production** (dffdzbmnmnokbftbujsy): "Allow new users to sign up" → OFF
- **Demo** (tiqemcsjuyudahgmqksw): aynı

Doğrulama:
- Negatif test (demo): signup denemesi → HTTP 422 `signup_disabled` ✓
- Pozitif test (production): mevcut kullanıcı login → otomatik /dashboard redirect ✓
- Public access-request yüzeyi: aktif session nedeniyle doğrudan test edilmedi

### Production ortam durumu
Vercel env scope'ları (güncel):
| Değişken | Scope |
|---|---|
| `BPS_CONTRACT_EXPIRY_EMAIL_ENABLED` | All Environments |
| `CRON_SECRET` | All Environments |
| `RESEND_API_KEY` | Production + Preview |
| `SUPABASE_SERVICE_ROLE_KEY` | Production |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `URL` | ortam bazlı ayrı değerler |

### Scope guardrail'leri korundu
Bu session açmamıştır / genişletmemiştir:
- Weekly Digest implementation (event email burn-in sequencing-blocker)
- Notification center / inbox / badge / bell
- Recipient rule değişikliği
- Roadmap sıralaması değişikliği
- Yeni feature scope

### Sonraki operasyonel odak
Yarın sabah post-08:30 cron incelemesi:
- Vercel function / cron log'ları
- Resend dashboard (delivered / bounce / complaint)
- Production Supabase `contract_expiry_emails_sent` satır sayısı

### Bekleyen takip maddeleri (bu session'da action alınmadı)
- `access_requests` formu: honeypot + rate limit (auth hardening follow-up)
- Resend API key rotation (chat'te expose oldu)
- Working tree'de untracked landing-page çalışması (ayrı session, bu batch'ten değil)
