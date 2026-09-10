# Fable review01 — Codex doğrulaması ve düzeltmesi (038)

> **038 — yerelde düzeltildi ve doğrulandı.**02900yalnız dedicated yerel Supabase'e uygulandı. B-1ret sonrası tek komutun sunucudan uzlaştırılması, B-2plan öncesi manuel olay/saniye hassasiyeti, B-3darcastkontrolleri tamam. Canlı035henüz değişmedi. Aşağıdaki ilk triage planı tarihsel, son kabul bu üst kayıt ve en sondaki bölümde.

2026-09-09. Fable raporu `FABLE_REVIEW_01_SONUC.md` değişmeden korunur. Bu not Codex değerlendirmesidir.

## Bağımsız tekrar

Fable'ın s3/s6testleri aynı kaynak dosyalarıyla ayrı geçici PostgreSQL ve55479portunda çalıştırıldı:

```sh
BPS_EMBEDDED_PG_MODULE=/private/tmp/bps-native-pgtest/node_modules/embedded-postgres/dist/index.js BPS_FABLE_PG_PORT=55479 node --test --test-concurrency=1 scripts/fable-review-01/s3-time-boundaries.mjs scripts/fable-review-01/s6-responsible-and-errors.mjs
```

Exit1beklenen iki kırmızı bulguyu tekrar üretti: s3/3jplan öncesi görüşmenin START_TIME reddi; s6/6eSTART_INPUT,START_ISOLATION,START_NO_PLAN,START_REPLAY,START_WITNESS için belirsiz metin. s6/6fgeçersizUUID'nin ham22P02yanıtını da ölçtü. Log `/private/tmp/bps-fable-triage-037.log`. Diğer Fable testleri bu koşumda yeniden çalıştırılmadı. Ortak yerel Supabase veya prod üzerinde test yazması yok.

## Karar

- **B-1 kabul:** kullanıcıya gösterilen hata ve bekleyen işlem UX'i düzeltilmeli. Ancak Fable'ın tüm `P0001 + START_*` yanıtlarında komut kimliğini doğrudan silme önerisi aynen uygulanmayacak. Scope/rol gibi kontroller replay okumasından önce çalışır; daha önce kaydedilmiş bir komutun sonraki çağrısı o noktada reddedilebilir. START_REPLAY de daha önceki sonuç veya kapatılmış kimliği temsil edebilir. Bir çağrının rollback olması aynı kimlikle daha önce commit olmadığına kanıt değildir.
- **B-2 kabul:** offset0ekarama ve bağımsız teyitte alt sınır planın oluşturulması değil, atamanın oluşturulması olmalı. Planlı adım sınırı START_CHECK_TIME içinde korunmalı. Formun saniye çözünürlüğü ile DB mikrosaniyesi farkı ayrıca giderilmeli; örneğin aynı saniyede oluşan atamayı saniye çözünürlüğünde kabul eden açık bir sözleşme ve sınır testi. İşgünü/gelecek/ETA korumaları genişletilmemeli; mesaj hangi sınırın kontrol edildiğini anlatmalı.
- **B-3 kabul:** UUID/tarih/integer cast hataları dar alan doğrulamasıyla anlaşılır giriş hatasına çevrilecek. BütünSQListisnalarını START_INPUT'a çeviren catchall yok; gerçeksistem/kilit/taşıma hataları belirsiz kalmalı.

## Uygulama sırası

1. İstemci hata haritasını tamamla. Kesin reddedilmiş görünen komutu güvenle temizlemek için ilgili tek komutu sunucudan uzlaştır; mevcut `ops_reconcile_commands` ve typed cevabını kullan. Confirmed/closed/unknown durumlarını ayır; uzlaştırma başarısızsa rezervasyon korunur. Bu yaklaşımın kullanıcı mesajlarını ve ek round-trip maliyetini açıkça tasarla.
2. Yeni02900migration ile ops_start_execute gövdesindeki olay zamanı/cast doğrulamalarını düzelt. Uygulanmış02700ve02800dosyalarını düzenleme. Aynıimza/owner/ACL/replay/kilit sırasını koru; yalnız dedicated yerel ortamda uygula.
3. Codex'e ait regresyon testleri ekle: plan öncesi gerçek görüşme, atama öncesi ret, aynı saniye, gelecek/işgünü/ETA, hamcast, committedkomut sonrası role/scopekaybında pendingkoruma, uzlaştırma confirmed/closed/unknown ve ağhatası.
4. Fable testlerini inceleme snapshotını bozmadan yeni migration'ı içeren ayrı harness ile yeniden çalıştır. Özellikle mevcut cast-hatasını kanıtlayan6f, düzeltme sonrası eski davranışı beklediği için yeşil beklenti olarak taşınamaz; assertion'ı kendi regresyon testinde yeni sözleşmeyle kur.
5. Yerel Auth/RPC ve tarayıcı kabulü; repo/Vault kaydı. Prod uygulanması/push/deploy otomatik çalışma kapsamı dışında.

Kritik veri bütünlüğü hatası bulunmadığı Fable'ın incelenen kapsam sonucudur; bütün ürün veya production yazma akışı için genel garanti değildir.

## 038 uygulama ve kabul

- Yeni02900, exact-signature varlığını önkoşul yapar; CREATE OR REPLACE mevcut owner/ACL'yi korur.02700ve02800değişmedi. Cast'ler yalnız ilgili ifade çevresinde ele alınır; sistem/kilit hatalarını giriş hatasına çeviren geniş catch yok. Sonsuz ETA reddi açık.
- Manuel arama/teyit alt sınırı `date_trunc('second',a.created_at)`. Bu bilinçli saniye çözünürlüğüdür: gerçek created_at'tan aynı saniye içinde en fazla999999mikrosaniye önceki değer kabul edilebilir; bir önceki saniye reddedilir. Planlı adımın `planned_at` kontrolü aynen korunur. İş günü/gelecek/ETA24saat sınırı sürer.
- `start-failure.ts` yalnız tanınmışP0001+tamkod için tekkomut reconcile(close=true) yapar. Confirmed→başarı/yenile; closed→kesinret/formu koru/pendingtemizle; unknown/hata→kimliği koru. Scope/role/replay hatası tekbaşına önceki kaydı silmez. Ağ/kilit/bilinmeyen kod otomatik kapatma başlatmaz.
- Yeni6unit, toplam157operasyonunit; genel5/5rapor `/var/folders/fg/qm_gg6w16299dhr_lz9xr38r0000gn/T/bps-acceptance-qPrkbK/report.md`. İzolebuildexit0 `/private/tmp/bps-start-validation-build.log`.
- `qa-start-validation.mjs`:7nativekontrol; owner/ACL,plan öncesiarama+teyit/tekreplay,saniyesınırı,eskiadım/gelecekret,cast/ETA,closed/confirmeduzlaştırma,önceki commit sonrasıüyelikreddi.
- Guarded `qa-local-start-tracking.mjs` artık02900kontrolünü içerir. Gerçek yerelAuth/RPC:bozukplan→START_INPUT→sunucudaclosed→pending0; planöncesigörüşme+teyit→reload/retrytekconfirm/present; tenant/anonret. Geçici API hesabı ve ilgili kayıtlar temizlendi.
- Fable s2/s4/s5orijinalleri değişmeden,02900ekli geçici harness kopyalarıyla **26/26** geçti. Log `/private/tmp/bps-038-review-rerun.log`. Tekrarlanabilir sürücü `scripts/qa-start-review-regression.mjs`; BPS_EMBEDDED_PG_MODULE gerekli. Fable s3/3j, ilkbaşarılıyazmadan sonra aynırevisionla ikinciyazmayı denediği için düzeltilmişkodda eskihaliyle tamyeşil beklentisi olamaz; Codexregresyonu revision'ıilerletir. s6/6fiseeski22P02davranışınıbekler; yenisözleşmeP0001/START_INPUTolarak kendi testimizde doğrulandı. Fable'ınbulgukanıtları değiştirilmedi.
- Yerel tarayıcı:geçici plansızatamada23:00ve`60,60`→açıkgeçersizalan/kaydedilmedimesajı; bekleyensarıuyarıyok; formkorundu. Dörtgeçicişube/personel/talep/atamakaydıtemizlendi. BuUIreddininterminalclosedkomutkaydı,geçtekrarıengelleyenyerelkorumakaydıolarak korundu; geç tekrarı engelleyen bu işaret iş verisi değildir. Mevcutkabulatamalarınınteyidine dokunulmadı.

Sınır: tamproductionkabulveyeniyayın yok. YeniSQLönce/uyumlukodsonrayayınlanmalı. Testsonuçlarıyalnızbelirtilenkapsamaait. Sonrakiteslim:036–038yereldeğişiklikleriniyayınadayına birleştir; Fable'a02900düzeltmefarkınıreviewettir; kullanıcıetkileşimli gerçekproductionatamakabulühâlâaçık.
