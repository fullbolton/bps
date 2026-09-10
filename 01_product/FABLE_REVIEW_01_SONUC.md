# Fable review 01 — İşe Başlama Takibi bağımsız kabul sonucu

Tarih: 2026-09-09 · İnceleyen: Claude Fable (bağımsız kabul) · Düzeltme sahibi: Codex
Görev: `01_product/FABLE_GOREV_01_ISE_BASLAMA_KABUL.md` · Testler: `scripts/fable-review-01/` · Kanıt logları: `scripts/fable-review-01/logs/`

İncelenen sürüm: yayındaki 035 (git `fb1b218` içeriği = `2b53d98` HEAD; 27 migration, `dpl_7dGwr1wHZc2REPBUYuJwjNnE6RZk`). Migration `20260909002700` dosyası release manifestindeki SHA256 ile birebir aynı (`4a754a06…`, ölçüldü). İnceleme sırasında Codex çalışma ağacında 036 (`20260909002800_start_board_filters.sql`, `StartBoardClient.tsx`, `start-board.ts`) değişti; hangi bulgunun hangi sürüme ait olduğu §4'te.

## 1. Karar

**İncelediğim kapsamda kritik bulgu yok.** Yanlış "teyitli", kaybolan yazma, çift olay, eski ekranla veri ezme veya yabancı tenant verisi üreten bir yol bulamadım; bunları gerçek SQL gövdeleriyle, iki bağlantı ve açık transaction bekleme kanıtıyla denedim. İki P2 (biri istemci hata gösterimi, biri zaman sınırı/mesaj), bir P3 (ham cast hatası) ve davranış notları var. Production yazma kabulü bu raporla yapılmış sayılmaz (§5).

## 2. Senaryolar

| # | Senaryo | Durum | Katman | Kanıt |
|---|---|---|---|---|
| 1 | Yanıt kaybı ve tekrar | çalıştırıldı · **geçti** (9/9) | SQL (gerçek `ops_start_execute`, `ops_reconcile_commands`), istemci birim (`pending-commands.ts`, `startError`) | `s1-response-loss.mjs` · aynı komut kimliği → aynı makbuz, 1 olay, 1 revision (1a); farklı içerik START_REPLAY (1b); gecikmiş çift çağrı ikinci bağlantıda `pg_blocking_pids` ile bekler, commit sonrası aynı makbuz (1c); uçuştaki yazma vs kapatma: kapatma bekler → confirmed (1d); rollback vs kapatma → closed, geç yazma START_REPLAY, olay yok (1e); hiç gönderilmemiş komut unknown→closed→REPLAY (1f); aktör anahtarı PK'da (1g); istemci digest aynı satır+içerikte aynı kimlik (1h); UI mesajı ≠ transaction durumu (1i → bulgu B-1) |
| 2 | İki operatör ve süre dolması | çalıştırıldı · **geçti** (8/8) | SQL, iki gerçek bağlantı (kullanıcı 10 ve 11) | `s2-two-operators.mjs` · lease canlıyken güncel revision ile call/claim/release START_CLAIMED, revision üretmez (2a); A claim açık transaction'da, B call BEKLER (`pg_blocking_pids=[A]`), commit sonrası START_STALE, güncel revision ile START_CLAIMED (2b); süre dolunca (claim_until geçmişe alındı) diğer kullanıcı arar, lease temizlenir (2c); eski sekme START_STALE (2d); aynı revision eşzamanlı claim/confirm tek kazanan (2e, 2f); geçmiş boşluksuz 1..8 (2h). Not: lease sahibi olmayan kullanıcı lease canlıyken TEYİT verebilir (2g, tasarım notu) |
| 3 | Plan ve zaman sınırları | çalıştırıldı · **geçti 9/10, 1 kırmızı bulgu testi** | SQL + JS `startRowState` paritesi | `s3-time-boundaries.mjs` · 00:30 → +03 yorumu, UTC günü geride (3a); D-1 iş günü için D 00:00:01 İstanbul START_TIME, UTC tarihi D-1 olsa da (3b); iş günü dışı teyit sonraki gün START_TIME / önceki gün START_ATTENDANCE_CONFLICT, D-1 23:59:59 kabul (3c); gelecek/atama öncesi/eta sınırları (3d); adım zamanı gelmeden START_CHECK_TIME (3e); geç atama: plan öncesi adımlar uygulanmaz, JS `not_applicable`/`unverified` (3f); **claimed_arrival hiçbir kombinasyonda teyit değil**, worker kaynağı ve boş tanık START_WITNESS (3g); plan değişince eski olay yeni planı boyamaz, `plan_version` ayrımı (3h); tarayıcı saati yalnız `now` parametresi (3i). 3j kırmızı → bulgu B-2 |
| 4 | Teyit, gerçekleşme, yedek atama | çalıştırıldı · **geçti** (10/10) | SQL (gerçek `ops_record_attendance`, `ops_replace_assignment` sarmalayıcı+iç fonksiyon, `ops_mutate` 001200 gövdesi, trigger) | `s4-confirm-attendance-replacement.mjs` · teyit+present+revision tek transaction (4a); eski yazar absent/unreported yazamaz START_CONFIRMED (4b); teyit açıkken absent yazısı bekler, sonra reddedilir (4c); teyitli yedeklenemez OPS_REPLACE_PRESENT, teyit açıkken replace bekler (4d); reopen gerekçeli, geçmiş `plan,confirm,reopen` korunur (4e); yedek planı devralır, geçmişi devralmaz, eski kayda START_CLOSED, aynı komut tekrarında tek `inherited`, farklı içerik OPS_IDEMPOTENCY_MISMATCH (4f); talep iptali → START_CLOSED (4g); aynı gün başka atamada present olan personel (kaldırılmış kayıt dahil) teyit edilemez (4h); plansız yedeğe saat uydurulmaz (4j). Not: teyitli+present atama kaldırılabilir, listede "Atama kapandı" teyidi örter (4i) |
| 5 | Kapsam değişimi ve gecikmiş cevap | çalıştırıldı · **geçti** (8/8) | SQL + gerçek `001600` üyelik guard trigger'ı (tasks/admin RPC fixture stub'ıyla), istemci birim, statik | `s5-scope-change.mjs` · üyelik kaybı START_SCOPE, olay yok (5a); rol kaybı START_FORBIDDEN (5b); claim tenant 2 + üyelik 1, çift üyelikte eski formun tenant 1 gönderimi, tenant 2'den tenant 1 kaydı → hepsi START_SCOPE, yabancı liste boş (5c); açık işlem profil FOR SHARE tutar, üyelik silme BEKLER, commit sonrası START_SCOPE (5d); ters sıra: silme açıkken işlem bekler, rollback → geçer, commit → START_SCOPE taze snapshot (5e); reconcile yabancı tenant/aktör OPS_SCOPE_CHANGED, kapatma yazılmaz (5f); bekleyen komut anahtarı aktör+tenant (5g); kesin/belirsiz metin ayrımı (5h). Gecikmiş RPC cevabının yeni ekrana ulaşması: statik — `scopeRef.current===captured` kapısı `save`/`recover`/fetch'te (`StartBoardClient.tsx` 41–46), tarayıcıda koşulmadı |
| 6 | Sorumlu ve hata durumları | çalıştırıldı · **geçti 5/6, 1 kırmızı bulgu testi** | SQL + JS `parseStartBoard`/`startError`, statik kod eşlemesi | `s6-responsible-and-errors.mjs` · sorumlu üyelik kaybı → `ownerAvailable=false`, üye listesinden düşer, JS urgent (6a); geçersiz sorumlu (üye değil/ik/yabancı tenant/yok) START_OWNER, geçerli sorumlu gerekçeyle atanır (6b); sorumlu rolü ik → false (6c); gerçek RPC çıktısı parser'dan geçer, 8 bozuk varyant throw (boş/başarılı sayılmaz) (6d); 6e kırmızı → bulgu B-1; 6f → bulgu B-3. 50 kayıt/sayfa yeniden raporlanmadı |

Ek (yayında değil, çalışma ağacı 036): `x7-002800-filter-parity.mjs` 3/3 geçti — `ops_start_board_filtered` "aksiyon" kümesi 7 farklı durumdaki satırda JS `startRowState.urgent` kümesiyle aynı; arama/`%`/`_` literal; `sorumlu olduklarım` sayfalama öncesi.

Referans (değiştirilmedi, koşuldu): `scripts/qa-start-tracking.mjs` 16/16 exit 0; `start-board.test.mjs` + `pending-commands.test.mjs` 17/17 exit 0.

## 3. Öncelikli bulgular

### B-1 · P2 · Kesin sunucu reddi istemcide "sonuç belirsiz, kaydedilmiş olabilir" olarak gösteriliyor; bekleyen-işlem sayacı da artıyor

- **Dosya:** `src/lib/operations/start-board.ts:30` (`startError`, HEAD `0b2582…`; ağaçta `:36`, gövde aynı) ve `src/app/(main)/talepler/ise-baslama/StartBoardClient.tsx:40-42` (`save`: `acknowledgeCommand` yalnız başarıda; catch yalnız `setError`). Ağaçta satırlar aynı.
- **Önkoşul:** yönetici/operasyon, planlı bir atama.
- **Tekrarlama:** (a) plan formunda offset alanına `60, 60` veya `1500` yaz, kaydet → sunucu START_INPUT (transaction geri alınır, `ops_commands` satırı kalmaz; s1 1i ölçtü). (b) teyit formunda tanık alanına yalnız boşluk → START_WITNESS. (c) daha önce reconcile ile kapatılmış kimlikle tekrar → START_REPLAY.
- **Beklenen:** "Geçersiz plan/tanık" gibi kesin bir metin; bekleyen sayacı değişmez.
- **Gerçek:** Mesaj: "İşlem doğrulanamadı. Bekleyen işlemleri kontrol edin; bağlantı hatası kaydın yapılmadığı anlamına gelmez." Ardından sarı kutu: "1 operasyon işleminin sonucu kontrol edilmeli". Eşlenmeyen kodlar (s6 6e, migration'dan çıkarıldı): `START_INPUT, START_ISOLATION, START_NO_PLAN, START_REPLAY, START_WITNESS`. Ayrıca `START_STALE` gibi eşlenen kesin retlerde de rezerve kimlik localStorage'da kalır ve sayaç artar.
- **Etki:** Operatör "kaydedilmiş olabilir" diye düşünüp kontrol koşturur; sonuç "0 kaydedilmiş, 1 kapatıldı". Kesin doğrulama hatası (boş tanık) açıklanmaz; teyit gecikir. Veri bütünlüğü etkilenmez (s1: sunucu tarafı doğru).
- **Dar düzeltme:** beş kodu `startError` haritasına ekle; `save` catch'inde hata PostgREST `P0001` + `START_` önekli kesin retse `acknowledgeCommand` ile rezerve kimliği düşür (transaction geri alındığı için güvenli; ağ/kilit hatasında mevcut davranış kalır).

### B-2 · P2 · Plan kaydından önce gerçekleşmiş ek arama/teyit `START_TIME` ile reddediliyor; istemci metni "atama öncesi" diyor; saniye kesmesiyle aynı saniyede de tetikleniyor

- **Dosya:** `supabase/migrations/20260909002700_start_tracking.sql:97` — `v_occurred<greatest(a.created_at,p.created_at)`; mesaj `start-board.ts:30` `START_TIME:'Görüşme zamanı gelecekte veya atama öncesinde olamaz.'`; istemci `occurredAt` saniye çözünürlüğünde (`StartBoardClient.tsx:50` `localTime`, `:79` form).
- **Önkoşul:** atama var; operatör personeli aradı, sonra planı girdi (saha gerçeği: önce telefon, sonra kayıt).
- **Tekrarlama:** s3 3j (kırmızı): plan oluştur; offset 0 "Ek / ilk arama" ile görüşme zamanını plan kaydından 5 dk önce, atama oluşturulmasından sonra gir → START_TIME. İkinci varyant: planla aynı saniyeye düşen (tarayıcının göndereceği, saniyeye kesilmiş) zaman → START_TIME. Bu ikinci varyant kendi testlerimde üç kez rastgele kırmızıya düştü (3e/3f/4h, `sleep(5)` ile giderildi) — ürün için de aynı yarış.
- **Beklenen:** offset 0 (ek arama) ve teyit için alt sınır atama oluşturma zamanı; plan öncesi adım fabrikasyonu zaten START_CHECK_TIME ile ayrı engelleniyor. Mesaj gerçek sebebi söylemeli.
- **Gerçek:** Görüşme geçmişe doğru yazılamıyor; operatör ya zamanı ileri yazar (yanlış tarihçe) ya da kaydı atlar. Aynı sınır 3c'de sonraki gün teyidi için de "gelecekte veya atama öncesi" metnini üretiyor.
- **Etki:** tarihçe doğruluğu; operatörün sistemi bypass etmesi. Tasarım kararı olabilir (yorum satırı 102 yalnız planlı adımlar için "retroactively fabricated" der); saniye varyantı kesin hata.
- **Dar düzeltme:** satır 97'de sınırı `a.created_at` yap (plan sınırını yalnız `START_CHECK_TIME` dalında tut) veya en azından `date_trunc('second', greatest(...))` ile karşılaştır; metni "atama ya da plan kaydından önce olamaz" yap.

### B-3 · P3 · Plan payload'ında cast, doğrulamadan önce: geçersiz `responsibleId`/`occurredAt`/`eta`/`offset` ham Postgres hatası döner

- **Dosya:** `20260909002700_start_tracking.sql:41` (`(p_payload->>'responsibleId')::uuid`, `START_INPUT` kontrolünden önce, profil kilidi için); benzer castlar `:95` (`occurredAt`), `:100` (`offset`), `:106` (`eta`).
- **Tekrarlama:** s6 6f: `responsibleId:'yok'` → `22P02 invalid input syntax for type uuid`. UI select gönderdiği için normal kullanımda görülmez; doğrudan RPC/uyumsuz istemci sürümünde görülür.
- **Beklenen/gerçek:** START_INPUT / ham hata → istemcide B-1'deki belirsiz metin.
- **Etki:** düşük (yalnız hata sınıflandırması); veri yazılmaz.
- **Dar düzeltme:** cast'ten önce `~ '^[0-9a-f-]{36}$'` benzeri doğrulama veya `BEGIN … EXCEPTION WHEN invalid_text_representation THEN RAISE 'START_INPUT'`.

### Davranış notları (hata değil; karar Codex/Furkan'a)

- Lease sahibi olmayan kullanıcı, lease canlıyken teyit verebilir; teyit lease'i temizler (2g). Teyit bağımsız kanıt olduğundan makul; belge bunu söylemiyor.
- `release` kilitsiz planda kabul edilir ve revision artırır (2d); eski sekmelerde START_STALE üretir.
- Teyitli kayda `ops_record_attendance('present')` kabul edilir, `attendance_revision` artar (4b); zararsız.
- Teyitli+present atama `remove`/`cancel` ile kapanabilir; listede `closed` önceliği teyidi örter (4i). Trigger yalnız `UPDATE OF attendance`.
- `ops_replace_assignment` sarmalayıcısında `SET lock_timeout` yok (iç fonksiyonda 3 s var).
- Tenant değişince eski `bps:pending:v1:<aktör>:<eskiTenant>` kayıtları görünmez kalır (5g); güvenli ama temizlenmez.
- Sonraki gün girilmiş teyit için hata metni "gelecekte veya atama öncesi" (3c) — B-2 ile aynı düzeltme.

## 4. Test dosyaları, komutlar, çıkış kodları, hash'ler

Ortam: macOS, Node v24.13.1, `BPS_EMBEDDED_PG_MODULE=/private/tmp/bps-native-pgtest/node_modules/embedded-postgres/dist/index.js`. Gömülü PostgreSQL kendi `mkdtemp(bps-fable01-*)` dizininde, port **55471** (`BPS_FABLE_PG_PORT`), loopback. Ortak local Supabase (54321/54322), `.env.local`, QA kilidi ve üretime dokunulmadı. Fixture: `scripts/fixtures/daily-operations.mjs` (okundu, değiştirilmedi) + `profiles.display_name` + 13 gerçek migration (000100–001200, 002700); s5 ayrıca 001600'ü `tasks`/`admin_assign_role_and_tenant` fixture stub'ıyla kurar (stub üretim RPC'si değildir). Mock yoktur; zaman sınırları `created_at` alanlarının root ile sabit anlara alınması ve sabit ISO değerlerle ölçüldü; tek duvar-saat bağımlılığı İstanbul'daki günün tarihi (DB'den okunur).

```sh
export BPS_EMBEDDED_PG_MODULE=/private/tmp/bps-native-pgtest/node_modules/embedded-postgres/dist/index.js
node --test scripts/fable-review-01/s1-response-loss.mjs                 # exit 0 · 9/9
node --test scripts/fable-review-01/s2-two-operators.mjs                 # exit 0 · 8/8
node --test scripts/fable-review-01/s3-time-boundaries.mjs               # exit 1 · 9/10 (3j = B-2 bulgu testi, düzeltmeye kadar kırmızı)
node --test scripts/fable-review-01/s4-confirm-attendance-replacement.mjs # exit 0 · 10/10
node --test scripts/fable-review-01/s5-scope-change.mjs                  # exit 0 · 8/8
node --test scripts/fable-review-01/s6-responsible-and-errors.mjs        # exit 1 · 5/6 (6e = B-1 bulgu testi)
node --test scripts/fable-review-01/x7-002800-filter-parity.mjs          # exit 0 · 3/3 (çalışma ağacı 036, yayında değil)
node scripts/fable-review-01/run-all.mjs                                 # exit 1 (s3, s6 kırmızı bulgu testleri) — özet: 0 0 1 0 0 1
```

Aynı portu kullandıkları için sırayla çalıştırın. Son tam koşu logları: `scripts/fable-review-01/logs/*.log` (run-all.log, s1..s6, x7, referans existing-*.log).

Kaynak hash'leri (SHA256 ilk 16; tam liste `scripts/fable-review-01/hashes-start.txt` ve `hashes-end.txt`):

| Dosya | Başlangıç | Bitiş | Not |
|---|---|---|---|
| `20260909002700_start_tracking.sql` | `4a754a06069655a9` | aynı | manifest ile eşit |
| `000400` / `000800` / `000900` / `001200` / `001600` | `4322f4411fff38e7` / `d1fc7d93ecfd3bdf` / `9f18872b7bbc27a8` / `8654c0fcbe5bbc3c` / `8e10cb01c915a521` | aynı | |
| `StartBoardClient.tsx` | `dc9d2d1072117388` (= HEAD/yayın) | `e60fbcd181b711d0` (Codex 036) | B-1 satırları her iki sürümde aynı (`:40-42`, `:50`) |
| `start-board.ts` | `0b2582764c2a2773` (= HEAD/yayın) | `32d385022cab3f15` (036: `parseFilteredStartBoard` eklendi) | `startError`/`startRowState`/`parseStartBoard` gövdeleri değişmedi; s1/s3/s5/s6 son koşuda ağaç sürümünü yükledi |
| `pending-commands.ts` / `command-reconciliation.ts` / `useVerifiedTenant.ts` | `c3820bb44f0e8575` / `fde4dd9971d17766` / `911b99936eb855fe` | aynı | |
| `page.tsx` | `650ea1636c90af65` | aynı | |
| Fable testleri | — | `harness 237470df…`, `s1 d9b519fb…`, `s2 6ea5a44b…`, `s3 a2efecec…`, `s4 46d8544f…`, `s5 986700af…`, `s6 535d774e…`, `x7 6ae67bc5…` | |

Bulgular B-1/B-2/B-3 yayındaki 035 sürümüne aittir ve 036 çalışma ağacında da aynen mevcuttur (ilgili gövdeler değişmemiş).

## 5. Çalıştırılamayan / yalnız çıkarım olan noktalar

- **Tarayıcı katmanı koşulmadı.** `StartBoardClient.tsx` yalnız okundu: kapsam değişince form kapanması (`useEffect([scope])`), `scopeRef` kapıları, `now` türetimi (`serverNow + geçen süre`), lease düğmelerinin `claimActive` ile kapanması, teyit düğmesinin `day>dayNow()` kilidi statik değerlendirmedir. Gerçek reload/ikinci sekme/paket kaybı tarayıcıda ölçülmedi; istemci tarafı yalnız `pending-commands.ts`/`start-board.ts` birim düzeyinde koşuldu.
- **Gerçek Auth/PostgREST yolu koşulmadı.** `qa-local-start-tracking.mjs` (guarded local Supabase, `/private/tmp/bps-supabase-acceptance`) ortak ortama sentetik veri yazdığı için bu görevde çalıştırılmadı; `auth.uid()`/claim davranışı fixture'ın `test.user`/`test.tenant` modeliyle temsil edildi. `current_user_active_tenant` gövdesi kapsam dışı.
- **`clock_timestamp()` mock'lanamadı**; lease süresi dolması `claim_until`'in root ile geçmişe alınmasıyla, geçmiş günler `created_at`/`planned_at`'in sabit anlara alınmasıyla ölçüldü. 3 dakikalık gerçek bekleme yapılmadı.
- **001600 stub:** `tasks` tablosu ve `admin_assign_role_and_tenant` fixture stub'ıdır; üretimdeki admin RPC'nin kendi kilit sırası (profil `FOR UPDATE` önce) 20260827000400/001600 gövdesinden okundu, s5'te aynı kilit doğrudan `DELETE tenant_memberships` trigger'ı üzerinden üretildi.
- **Production'da yazma kabulü açık:** gerçek atamayla plan → arama → bağımsız teyit → reload; e-posta/bildirim yok. Bu rapor deploy yetkisi değildir.
- 043 eski raw-claim policy, Luca/finansal ve genel R14/R15 turu görev tanımı gereği incelenmedi.
