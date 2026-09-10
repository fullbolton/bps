# Claude Code / Claude Chat — BPS teknik devir

> **047 — Banka/otel tarayıcı yazma kabulü tamamlandı; iletişim bloğuna geçildi.** 14 grup geçti: günlük talep oluşturma, personel atama/gelmedi/değiştirme ve reload; bağımsız oturumdan kayıt doğrulama dahil. Sentetik veriler temizlendi. Uygulama/SQL değişmedi. İletişim için mevcut notlar, duyurular, e-posta defteri ve görev önseçimi incelendi; kalıcı konuşma/bildirim/görev bağı tasarımı hazır. İletişim SQL/UI henüz uygulanmadı.

> **046 — Banka/otel yerel tarayıcı kabulü geçti.** 11 kontrol grubu: 045 Auth/RPC/HTTP senaryolarına günlük–haftalık firma/gün geçişi, özetlerin ekranda doğrulanması, gerçek tarayıcı CSV indirmesi, otelin 1 geldi / 1 tarihsel gelmedi / 3 bildirilmemiş toplamı ve reload sonrası yedek personel geçmişi eklendi. Masaüstü ve 390 px mobil ekran incelendi. Veriyi API oluşturdu; tarayıcı yazma kabulü veya gerçek müşteri pilotu değildir. Sentetik kayıtlar temizlendi. Uygulama canlı 044 ile aynı; SQL/deploy yok. [Kanıt](PILOT_UCTAN_UCA_KABUL.md).

> **045 — Banka/otel birleşik yerel kabulü tamamlandı.** Gerçek yerel Auth/RPC/HTTP üzerinden 8 kontrol grubu: şube CSV tekrarları, çift atama engeli, beyan/teyit ayrımı, yedek atama ve korunmuş gelmedi geçmişi, günlük/haftalık/CSV toplamları, tenant/rol retleri ve kendi test verilerinin temizliği. Banka 9/3/6, otel 5/4/1 ihtiyaç/atama/açık; bağımsız CSV okuyucusu doğruladı. Ürün kaynakları canlı 044 ile aynı; SQL/deploy yok. Bu sonuç gerçek müşteri veya tarayıcı pilotu değildir. [Kanıt](PILOT_UCTAN_UCA_KABUL.md).

> **044 yayın — 2026-09-10:** Yerel render düzeltmesi doğrudan kullanıcı devam talimatıyla canlıya alındı. Kaynak `ec0500e`, dal `codex/block-01-release`; deployment `dpl_1QvsYYMzeemMuz9ZDtxdUaSdQDhw`. 249 uygulama dosyası commit/manifest ile eşleşti; TypeScript, production build ve sağlık 5/5 geçti. 100 personelde gereksiz HTML ad tekrarları 1.000→200; ekran/PDF değişmedi. SQL veya iş verisi değişikliği yok. Önceki “yerelde/yayımlanmadı” notları yerel kabul anını anlatır.

> **043 — 2026-09-10: Haftalık PDF düzeni yayında.** Metin sütunları genişletildi; özetler tek satırda. Uzun personel listeleri yazdırmada 12 kişilik devam satırlarına ayrılıyor; şube/gün tekrarlanıyor, sayılar yalnız ilk satırda. Sentetik Chromium PDF kabulü: tek talep 1 sayfa, 40 talep 5 sayfa (önce 6), 100 personel 4 sayfa; kimlikler eksiksiz ve birer kez. Kaynak `b2c921b`; canlı `dpl_3496nCsZVRrsykaWEiCGJeKAdzyk`; build, sağlık 5/5 ve canlı haftalık ekran geçti. Yeni SQL/veri yok. Native yazdırma diyalogu ve canlı CSV byte kontrolü erişim engeli nedeniyle açık. [Kanıt](HAFTALIK_CIKTI_KABULU.md).

> **042 — 2026-09-10: Aktivite olay adları yayında.** İşe başlama planı, arama sonucu, bağımsız teyit, yeniden açma ve geçici arama üstlenme/bırakma ayrı başlıklara sahip. Yeni SQL yok. `0446684` push edildi; canlı `dpl_5wGgUBaofM2qMH3nCK9gMnpMzUwU`. İki mevcut test, TypeScript, production build, sağlık 5/5 ve kimlikli Dashboard okuma geçti. Mevcut canlı listede takip olayı olmadığından altı yeni başlık o listede ayrıca gözlenmedi; yeni test verisi oluşturulmadı. [Kanıt](AKTIVITE_ISE_BASLAMA_ADLARI.md).

> **041 — 2026-09-10: Blok 1 yayında, çekirdek canlı kabul tamam.** Üç bekleyen SQL uygulandı; bu teslimin 30/30 migration kaynağı ve ledger sürümü doğrulandı. `565059e` kaynakları `codex/block-01-release` dalına push edildi; main birleştirilmedi. Vercel `dpl_DZvtjhLdoishravp1YYwJnM9Uuoq` www.bpsys.net üzerinde canlı, sağlık 5/5. Kimlikli sentetik aday firma → şube → personel → talep → atama → plan → arama → bağımsız teyit → reload ve Dashboard geçti. Bu tur test verileri temizlendi; eski kayıtlar korundu. CSV gerçek HTTP kabulü yerel 9/9; canlı CSV byte/PDF sayfalama kabulü ayrıca açık. Önceki bekliyor/yayınlanmadı kayıtları tarihseldir. [Tek teslim notu](BLOK_01_TESLIM.md).

> **040 — Blok 1 yerel teslim paketi hazır.** Haftalık CSV gerçek HTTP 9/9 ve bağımsız okuyucu, tarayıcı toplam/iptal/boş hafta kabulü geçti. Kabul betiği artık kendi geçici hesap/verilerini temizler. Toplu manifest 249 uygulama + 30 SQL + 17 kabul dosyasını doğrular; uygulama 036–039 kabul snapshotlarıyla birebir. Genel 5/5 ve manifest 2 test geçti. Yeni uygulama/SQL değişikliği, production/push/deploy yok. Yayın ve canlı kabul açık; başka modül açılmayacak. [Tek teslim notu](BLOK_01_TESLIM.md).

> **039 — Blok 1: aday firma uyumluluğu yerelde tamamlandı.** Aday ve aktif firmalar yeni operasyona uygun; CRM durumu kendiliğinden değişmiyor. Yedi SQL fonksiyonu, firma seçimi ve kurulum sayacı birlikte düzeltildi. 9 native kontrol, 159 unit/genel 5/5, gerçek yerel Auth ile aday firma → şube/CSV → talep → atama → plan/arama/teyit → yeni oturumdan okuma ve build geçti. Geçici veriler temizlendi. Canlı/push/deploy yok; 02800,02900,20260910000100 production’da bekliyor. Blok kapanmadı; sıradaki haftalık CSV kullanıcı kabulü ve birlikte teslim envanteri. [Kanıt](ADAY_FIRMA_OPERASYON_UYUMU.md).

> **2026-09-10 — Kullanıcı kararı: bloklar hâlinde teslim, liderlik Codex’te.** Her tur dış ajan yanıtı beklenmeyecek. Codex uygulama, test ve düzeltmeleri uçtan uca tamamlar; Claude Code/Chat için anlamlı teslim noktalarında tek inceleme paketi hazırlanır. İlk blok günlük operasyon ve işe başlama kabulüdür. [Çalışma düzeni](BLOK_CALISMA_DUZENI.md).

> **2026-09-10 — Claude yanıtları değerlendirildi.** Chat canlı şube → personel → talep → atama zincirini 4/4 ölçtü; işe başlama arama/teyit kabulü açık. Aday firma uyumsuzluğu kodda doğrulandı, düzeltmesi sırada. Fable bulguları 038 ile yerelde giderildi. Yayın manifestinin 246 dosyası hem fb1b218 hem HEAD ile eşleşti; 036–038 çalışma ağacı farkları henüz yayında değil. Öncelik uyumluluk düzeltmesi, bağımsız kabul ve gerçek kullanım pilotu. [Kararlar ve görevler](CLAUDE_YANITLARI_KARAR_2026-09-10.md).

> **038 — Fable bulguları yerelde düzeltildi.** Kesin retlerde tek komutun sunucudan uzlaştırılması; plan öncesi manuel görüşme/teyit, saniye hassasiyeti ve dar giriş doğrulaması tamamlandı. 02900 yalnız dedicated yerelde. 157 unit, genel 5/5, yeni 7 SQL kontrolü, Fable yarış/kapsam regresyonları 26/26, gerçek yerel Auth/RPC, tarayıcı ret mesajı ve build geçti. Canlı 035 ve 27 migration değişmedi; 02800/02900 henüz production’da değil. [Düzeltme ve kanıt](FABLE_REVIEW_01_CODEX_TRIYAJ.md). Sıradaki iş 036–038 yayın adayının birlikte kabulü; production gerçek atama kabulü açık.

> Güncel037: Dashboard takip özeti de yerelde eklendi; canlı035değişmedi.035yayın kaynakları başka çalışma tarafından `fb1b218`, devir notları `2b53d98` commitine alındı; push durumu bu tur ölçülmedi. Fable sonuç raporu geldi; Codex ikiP2yi yeniden üretti. Sonraki iş `FABLE_REVIEW_01_CODEX_TRIYAJ.md` kapsamındaki038düzeltmeler.036ve037manifestleri yerel farkların ayrı snapshotlarıdır.

> Sonraki yerel fark036: 02800 ile gün geneli takip filtreleri eklendi; henüz canlı değil. Canlı035raporu geçerli; mevcut çalışma ağacında üç uygulama dosyası035snapshotından farklı. Ayrıntı `01_product/ISE_BASLAMA_TUM_GUN_FILTRELERI.md`. İncelemede035yayını ve036yerel farkı ayırın.

Tarih: 2026-09-09. Hazırlayan: Codex. Bu not önceki “yalnız yerelde / migration bekliyor / frontend yayınlanmadı” notlarının güncel durumunu düzeltir. Yeni geliştirme veya yeni migration uygulaması değildir.

## 1. Kesin yayın durumu

- Repo: `/Users/furkanyahsi/Desktop/BPS`.
- Canlı uygulama: https://www.bpsys.net (Vercel proje `bps`).
- Canlı Supabase proje ref: `dffdzbmnmnokbftbujsy`.
- **`20260909000100`–`20260909002700`: 27/27 migration canlıda uygulanmış ve SQL SHA256 ile doğrulanmış durumda.**
- Vercel production deployment: `dpl_7dGwr1wHZc2REPBUYuJwjNnE6RZk`.
- Immutable deployment: https://bps-2lv5ht9i5-furkanyahsi-1537s-projects.vercel.app.
- 246 uygulama dosyasının temiz snapshot'ı deploy edildi; Ready doğrulandıktan sonra production promote yapıldı. Tek bir sayfa değil, mevcut uygulama paketi yayınlandı.
- **Git commit/push yapılmadı.** Repo geniş bir uncommitted çalışma ağacı içerir. Canlı sürümü mevcut HEAD ile aynı varsaymayın; esas kaynak dosya bazlı yayın manifestidir. Çalışma ağacını reset/clean ile silmeyin.
- `BPS_DAILY_OPERATIONS_ENABLED` production'da etkin: dinamik takip ekranı ve Dashboard operasyon bölümü canlıda açıldı. Otomatik e-posta gönderimi açılmadı, cron değiştirilmedi.
- localhost:3000, dedicated yerel sentetik Supabase ile çalışmaya devam ediyor. Yerel kayıtlar canlıya taşınmadı.

## 2. Kanıt ve kaynak önceliği

1. `supabase/manual/release-20260909.json`: migration adları, dosya sürümleri, SHA256, özgün MCP uygulama sürümleri, deployment ve sağlık sonucu.
2. `supabase/manual/release-20260909-source-sha256.json`: Vercel'e gönderilen 246 kaynak dosyanın hash'i.
3. `supabase/manual/release-20260909.md`: canlı uygulama, izin/nesne kontrolleri, testler, geçiş geçmişi ve açık kabul sınırları.
4. `01_product/CANLI_YAYIN_RAPORU_2026-09-09.md`: kullanıcı açısından modül raporu.
5. Obsidian: `/Users/furkanyahsi/Desktop/Vault77/01-projects/bps/handoffs/2026-09-08-guncel-urun-yonu.md`, güncel yayın kaydı **035**.

Bu devir hazırlanırken 27 SQL ve 246 uygulama dosyasının yerel hash'leri yeniden manifest ile karşılaştırıldı; eşleşti. Canlı ölçümler yayın turuna aittir; bu tur ikinci bir migration uygulaması veya tüm prod testlerinin tekrarı yapılmadı.

MCP'nin uygulama zamanıyla ürettiği ledger sürümleri, canlı SQL metinleri yerel SHA256 ile eşleşip çakışma olmadığı doğrulandıktan sonra özgün dosya sürümlerine uzlaştırıldı. Eski MCP sürümleri JSON'da korunuyor. Uygulanmamış SQL uygulanmış işaretlenmedi. SQL dosyalarının tarihsel NOT APPLIED yorumları hash bozulmasın diye değiştirilmedi; yorumlara bakarak yeniden uygulamayın.

Eski `20260722000200_role_expand_asistan.sql` taslağı bu 27'lik pakete dahil değildir. Kör `supabase db push` ile onu pakete katmayın. Önceki `20260827000400` admin migration'ını da bekliyor kabul etmeyin; önceki uygulama/doğrulama/repair kaydı tarihseldir, yeni paket 01600 ile admin fonksiyonuna ek görev koruması getirildi.

## 3. Veritabanı değişiklikleri

| Sürüm sonu | Dosya/işlev |
| --- | --- |
| 000100 | `daily_operations_pilot`: ops_locations, ops_workers, ops_daily_requests, ops_assignments, ops_commands, ops_events; günlük talep/atama çekirdeği |
| 000200 | `location_import`: ops_import_locations, kodlu şubelerin CSV aktarımı |
| 000300 | `scoped_operation_command`: ops_execute_scoped, actor/tenant bağlamı |
| 000400 | `command_reconciliation`: ops_reconcile_commands, belirsiz işlem sonucunu uzlaştırma |
| 000500 | `weekly_operations`: ops_week, firma/hafta planı |
| 000600 | `request_batch`: ops_create_request_batch, atomik toplu talep |
| 000700 | `resize_request`: ops_resize_request, ihtiyaç değişimi |
| 000800 | `attendance`: ops_record_attendance, atama gerçekleşmesi/revision |
| 000900 | `replace_assignment`: geçmişi koruyan atomik yedek atama |
| 001000 | `attendance_week`: ops_attendance_week, plan dışındaki ayrı gerçekleşme özeti |
| 001100 | `operations_directory`: ops_directory, kapsamlı/sayfalı dizin okuması |
| 001200 | `directory_activation`: ops_set_directory_active, yönetici aktiflik kontrolü |
| 001300 | `task_assignment_history`: görev revision ve atama geçmişi trigger'ları |
| 001400 | `appointment_completion`: complete_appointment_scoped + receipt, randevu sonucu ve takip görevi atomik |
| 001500 | `task_transfer`: önizleme/dizin + transfer_tasks_scoped + receipt |
| 001600 | `task_membership_guard`: aktif görev atananı, membership/role guard; admin_assign_role_and_tenant entegrasyonu |
| 001700 | `contract_renewal_task`: sözleşme revision + contract_renewal_tasks ilişkisi ve gerçek takip görevi |
| 001800 | `contract_document_versions`: belge revision/geçmişi, eski Storage nesnelerini koruma/okuma |
| 001900 | `contract_pdf_upload_commands`: prepare/finish/get yükleme işlemleri ve rezervasyon guard'ları |
| 002000 | `contract_appendices`: tek ana PDF ve ayrı ek protokoller; belge bazlı sürüm/path okuması |
| 002100 | `dashboard_activity`: son gerçek operasyon/görev/belge olaylarının kapsamlı okuması |
| 002200 | `workspace_setup`: gerçek kayıtlardan kurulum sayaçları |
| 002300 | `workspace_invitations`: kod hash'i, davet yönetimi/kabulü, rol ve üyeliğin atomik atanması |
| 002400 | `invited_account_registration`: güvenli handle_new_user, davet uygunluğu ve eksik profil hazırlama |
| 002500 | `daily_dashboard`: günlük ihtiyaç/atama/açık kişi ve talep özeti |
| 002600 | `atomic_mizan`: confirm_mizan_atomic; upload, satırlar ve firma alacağı tek transaction |
| 002700 | `start_tracking`: ops_start_plans/events, ops_start_execute/board, teyit guard'ı ve yedek plan devri |

Tablodaki son ekler `20260909` önekiyle okunmalı; önceki Ağustos 000400 ile yeni Eylül 000400 farklı migration'lardır. Sonraki migration önceki fonksiyonları değiştirebilir; nihai gövdeyi sıradaki tüm migration'larla birlikte değerlendirin.

## 4. Yetki, yarış ve yeniden deneme sözleşmesi

- Yeni akışlar actor kimliğini ve canlı üyeliği sunucuda doğrular. İstemcinin gönderdiği actor/tenant tek başına yetki değildir. `useVerifiedTenant` → `current_user_verified_tenant`; rol/hesap değişiminde eski bağlamın gösterilmesi engellenir.
- Yazmalarda kapsam/rol doğrulama, ilgili satır kilitleri ve beklenen revision/önceki değer kontrolleri vardır. Tek komut kimliği ve payload üzerinden tekrar sonucu korunur; farklı içerikle aynı kimlik yeniden kullanılmaz.
- Operasyon kurtarma: `src/lib/operations/pending-commands.ts`; actor+tenant anahtarı, localStorage'da yalnız `{digest,id}`, Web Locks ile sekmeler arası rezervasyon. Sunucu ops_reconcile_commands kaydedilmiş işlemi doğrular veya uygulanmamış denemeyi kapatır. Bu bir offline form/veri deposu değildir.
- Task transfer aynı partide conflict halinde tamamen geri alınır. Üyelik/rol değişimi aktif işleri sahipsiz bırakacaksa DB guard reddeder. Admin akışı READ COMMITTED ve gerçek function owner/RLS erişim varsayımlarını kontrol eder.
- Yeni hesap metadata'sındaki role/admin/unit alanları yetki üretmez; başlangıç görüntüleyici/non-admin/üyeliksiz. Davet kabulü ilgili üyelik/rol atamasını yapar. Oturum silme tüm mevcut kullanıcıları topluca çıkarmadı; sonraki ilgili işlemlerde çalışır.
- **43 eski raw-claim policy değiştirilmedi; current_user_active_tenant gövdesi değiştirilmedi.** Oturum silme mevcut access token'ların anlık iptal edildiği anlamına gelmez. Bu paket tüm eski güvenlik borcunu kapattı diye sunulamaz.

## 5. İşe Başlama Takibi — tamamlanan MVP

Dosyalar: `src/app/(main)/talepler/ise-baslama/page.tsx`, `StartBoardClient.tsx`, `src/lib/operations/start-board.ts`, migration02700 ve `src/types/database.types.ts`.

- `ops_start_plans`: atama/tenant bağlamı, start_at, sorumlu, kontrol offset'leri, revision, plan_version, teyit ve arama sahipliği.
- `ops_start_events`: kalıcı olay geçmişi, actor, plan/revision ve payload. Ham istemci tablo erişimi kapalı; RPC kullanılır.
- `ops_start_execute(...assignment_id, expected_revision, action, payload)`: plan/call/confirm/reopen/claim/release. Saat/gün doğrulama, tekrar ve kilit kontrolleri SQL içindedir. Arama sahipliği 3 dakika; yeni plan eski olayları silmez.
- Personelin “şubedeyim” sonucu `confirm` değildir. Şube/saha kaynağı ve teyit eden kişi girilmelidir. Teyit ile attendance=present tek transaction; geri alma gerekçeli ve attendance=unreported. Eski attendance yazarı teyitli kaydı sessizce absent yapamaz.
- Yedek atama önceki planı devralır; kişinin görüşme/teyit geçmişi devredilmez. Eski kayıtlar tarihçede kalır. Eski plansız kayda varsayılan saat uydurulmaz.
- UI: 60 saniye yenileme (açık form/işlem yokken), 15 saniye saat güncelleme; serverNow referansı. 50 atama/sayfa, arama/sorumlu/aksiyon filtreleri yalnız mevcut sayfada. Portföy çapında filtre ve performans kabulü yapılmadı.
- Otomatik telefon/SMS/WhatsApp/push, GPS/NFC, çalışma saati/bordro yok. Önizleme yolu hâlâ açıkça sentetik ve kayıt oluşturmaz.

## 6. Diğer yayınlanan UI ve önemli sınırlar

- `/talepler/gunluk`, `/haftalik`, `/dizin`, `/kontrol`: gerçek Supabase operasyonları. CSV şube import en fazla500; otomatik banka/TBB keşfi yok. Haftalık çıktı planı, gerçekleşme ve bordro birbirine eşitlenmez.
- Görevler/randevular/sözleşme detaylarında yukarıdaki scoped işlemler kullanılıyor. Ana PDF ve ekler ayrı document kimlikleriyle sürümlenir; yükleme belgenin hukuki onayı veya sözleşme yenilenmesi değildir.
- Dashboard: manuel risk ve günlük otel mail bölümü kaldırıldı; günlük operasyon ve son20 aktivite eklendi. Tam audit/realtime akışı değildir.
- Kurulum/davet/kayıt ekranları yayınlandı. Davet kodu elle paylaşılır; gerçek email doğrulama→PKCE→yeniden giriş/hook kabulü açık. Uygulamadaki davet kontrolü Auth signup API'sinin bütünüyle davete kapatıldığı iddiası değildir.
- Luca: eski ham INSERT ve derive RPC istemci yetkileri kapatıldı; yeni UI confirm_mizan_atomic kullanır. `src/lib/luca/pending-import.ts` dosya/payload hash'i ve UUID ile yenileme sonrası aynı dosyanın tekrarını korur. Sunucu receipt durumunu uzlaştırma ekranı açık iştir; aynı dosyanın bütün cihazlarda kalıcı tekilleştirilmesi yok.
- Gelişmiş finansal özet mevcut firma alacağı/kaynağını gösterir. **Proje gelir/gider/maaş/kâr motoru tamamlanmadı**; proje/masraf merkezi ve gerçek Luca/bordro çıktı sözleşmesi gerekiyor.
- Eski Personel Talepleri/Aktif İş Gücü akışları tamamen kaldırılmadı veya yeni günlük kayıtlara otomatik taşınmadı.

## 7. Test kanıtı ve neyin ölçülmediği

- Birleşik yerel kabul **23/23**; **145 operasyon unit**. Rapor: `/var/folders/fg/qm_gg6w16299dhr_lz9xr38r0000gn/T/bps-acceptance-Riv0gS/report.md`.
- Takip: `scripts/qa-start-tracking.mjs` ile16 PostgreSQL kontrolü; `scripts/qa-local-start-tracking.mjs` gerçek yerel Auth/RPC; yerel tarayıcı plan→beyan→şube teyidi→reload kalıcılığı. Testler canlıya fixture yazmadı.
- Yayın turunda5 kod kontrolü geçti. İlk build Google Fonts DNS hatası aldı; yalnız build ağ erişimiyle tekrarlandı ve geçti. Vercel build de geçti.
- Canlı salt-okunur veritabanı doğrulaması: gerçek üyelikten claim bağlamında membership/start board/setup/daily/activity/invitation listesi; geçersiz davetfalse. Bu yöntem gerçek kullanıcı Auth-token/browser testi değildir.
- Canlı izin/nesne kontrolleri: görev guard'ları, auth.users trigger'ı, admin owner/ACL, ham davet INSERT=false, yeni ilgili tablolarda eksik RLS0 ve refresh_tokens→sessions cascade.
- Deployment health5/5: JWT role/ref, service-role head query, cron secret, Resend format; yanıt yeni deployment kimliğiyle eşleşti. Kimliksiz health401; takip login/returnTo yönlendirmesi.
- Mevcut production tarayıcı hesabıyla Dashboard ve takip okuması geçti. Bugün0atama. **Canlıda plan/arama/teyit yazma testi yapılmadı.** Canlı PDF/gerçek Luca dosyası/davet e-postası uçtan uca kabulünü yapılmış varsaymayın.

## 8. Ortam ve yeniden çalışma notları

- Dedicated yerel Supabase çalışma dizini `/private/tmp/bps-supabase-acceptance`; API54321, DB54322. Yerel QA için `supabase/manual/acceptance-runner.md` ve `local-supabase-acceptance.md` yönergelerini okuyun. `.env.local` dosyasını güvenli yerel hedef kabul etmeyin.
- Repo içinde `vercel env run -e production` yerel `.env.local` overlay'i nedeniyle yanıltıcı hedef gösterdi. Production env doğrulaması env dosyası olmayan temiz staging içinde yapıldı. Anahtarları veya env dosyalarını devir notuna/çıktılara koymayın.
- Deployment staging `/private/tmp/bps-vercel-release-7howj41b`; yalnız src/public/build dosyaları, env/yedek/defter yok. Geçici dizin silinebilir; kalıcı kaynak manifesti repodadır.
- Önceki deployment `dpl_7y1Y5dgjG34sNKABRFmWDZDtUaK2`. Frontend rollback SQL rollback değildir; eski Luca istemcisinin kaldırılmış ham yazma yoluna dönme riski nedeniyle birlikte uyumluluk değerlendirmesi gerekir.
- Kullanıcı tam içerik yedeği alınmasını reddetti; temizlik kodu hazırlamayı onayladı. Bu yayın yedek alma veya test/gerçek iş verilerini silme işlemi değildi.

## 9. Sonraki çalışma

1. Gerçek günlük atama üzerinden production plan→arama→bağımsız teyit→reload kabulünü tamamla; kayıt yokluğunu test başarılı diye etiketleme.
2. CSV şube yükü, haftalık müşteri çıktısı, sözleşme Storage, gerçek Luca dosyası ve davet mail/yeniden giriş için eksik kabul adımlarını dar kapsamda kapat.
3. Yayınlanan çalışma ağacını dosya manifestiyle karşılaştırıp Git teslimini ayrıca tamamla; bu not push yapıldı demiyor.
4. Sonra proje finansalı kaynak/eşleme kararı, evrak takip sahipliği, otomatik şube kaynak keşfi ve SaaS paket/portal işlerini planlarına göre ilerlet.

Claude Chat/Claude Code dahil diğer ajanın canlı ölçüm yapamayacağını varsayma. Bir sonuç geldiğinde proje/ortam, sorgu, zaman ve kanıtını iste; ölçümü sırf farklı ajandan geldi diye beyan diye etiketleme.
