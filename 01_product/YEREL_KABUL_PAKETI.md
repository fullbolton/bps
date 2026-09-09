# Tek komut yerel kabul paketi — yerelde tamamlandı

Amaç: mevcut pilotu yeni özellik eklemeden güvenilir biçimde doğrulamak ve hangi
adımın gerçekten geçtiğini raporlamak. Mevcut bireysel test scriptleri kaynak kalır;
beklenen sonuçları taklit eden ikinci test uygulaması yazma.

- Hızlı mod: operations unit + eski unit + static + tsc. İsteğe bağlı build.
- SQL modu: geçici PGlite ve native PostgreSQL testlerini açık bağımlılık yollarıyla
  çalıştır. Eksik runtime PASS/skip gibi görünmesin; açık missing/failed sonuç.
- Yerel API modu: yalnız dedicated bps-supabase-acceptance, API127.0.0.1:54321 ve
  beklenen Docker container/proje doğrulanınca mevcut additive network testlerini
  çalıştır. .env.local veya prod bağlantısı kullanma, anahtarları loglama.
- Mevcut veritabanını sıfırlama. İlk kurulum one-shot qa-local-supabase dolu fixture'da
  tekrar çalıştırılmaz. Yeni kullanıcı/fixture test verileri sentetik ve eklemeli kalır.
- Build ile çalışan dev sunucusunun .next çakışmasını önle; alternatif build dizini
  veya açık durdur/yeniden başlat yaklaşımını koddan doğrula. Kullanıcının başka
  sunucularını öldürme. Kontrol edilmeden prod env ile API testi başlatma.
- Zaman aşımı/çıkış kodu ve failed/skipped/passed durumları ayrı; adım başarısızsa
  genel çıkış nonzero. JSON + okunabilir özet üret; dosyalar repo dışında veya açık
  ignore altında, secret içermeyen hata/komut bilgisiyle. Varsayılan tamamlanma
  iddiası yalnız gerçekten çalıştırılan adımları kapsasın.
- Tarayıcı görsel kabulü, native PDF sayfalaması ve üretim Auth/owner entegrasyonu bu
  otomatik testlerin yerine geçmez; raporda açık kalan kapılar ayrı dursun.

## Uygulama ve kabul — 2026-09-09

`scripts/qa-acceptance.mjs` + helper ve 11 davranış testi eklendi. Kullanım:
[supabase/manual/acceptance-runner.md](../supabase/manual/acceptance-runner.md).
Varsayılan5 hızlı adım; --all10 adım (yerel ön kontrol dahil). Gerçek --all koşusu
exit0: 11 runner testi, 68 operations testi, eski unit, static184 dosya/0FAIL2WARN,
tsc, 181 PGlite, 48 native yarış, 42 yerel API, geçici kopyada build geçti.
Eksik SQL runtime denemesi exit1:5 passed,1 failed,1 skipped,3 not_requested;
başarısızlık PASS'a veya görünmez skip'e dönmedi. API payload logları bastırılır;
private rapor/JSON ve ayrı adım logları üretilir. DB/Kong ad/port ve kök proje kimliği
sınırı, maskeleme, spawn hatası, kesinti, timeout ve stale/live lock testleri geçti.

Build için .env'siz geçici kaynak kopyası + sınırlı OS env + local placeholder;
mevcut dev sunucusu kapatılmadı. Build sonrası IAB yerel dizin yeniden yüklendi,
console boş. Yeni migration veya iş verisi reseti yok. API testleri eklemeli sentetik
fixture üretir. HTTP CSV testi, native PDF ve prod Auth/owner kabulü ayrı kalır.
