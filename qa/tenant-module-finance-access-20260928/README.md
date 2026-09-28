# M2f — Finans modülü erişim kapıları

Durum: **yerel aday; push, deploy ve üretim SQL uygulaması yapılmadı.**
Temel commit: `c00859b2423c9b64163258311a11dc35c9ed7d8d`.

## Değişiklik

- Finansal Özet ve Luca aktarımı doğrulanmış çalışma alanı/modül girişini kullanır. Finans özeti yönetici/muhasebe, aktarım yönetici rolüyle açılır.
- Luca onayı önizlemenin aktör/tenant bağlamıyla güncel oturumu karşılaştırır. Kapalı/doğrulanamayan modül Türkçe hatayla durur; önceki belirsiz denemenin idempotency kaydı silinmez.
- `20260928001600_finance_module_access.sql`, mevcut atomik Luca komutuna config SHARE kilidini profil UPDATE ve iş kilitlerinden önce ekler. Makbuz tekrarları da kontrol edilir; orijinal tenant/rol/payload kontrolleri korunur.
- Üç finans tablosuna restrictive SELECT politikası eklenir. Eski rol politikaları devam eder; modül kapalıyken kayıtlar korunur ancak normal kullanıcıya görünmez.
- Doğrudan tablo yazımı anon/authenticated/service_role için kaldırılır. Repository taramasında tüketicisi bulunmayan service_role ham okumaları ve iki eski finans RPC'si de kapatılır. Geçerli atomik komut authenticated tarafından mevcut yönetici kontrolüyle kullanılır.
- Migration; etkin yetkileri, RLS'yi, beklenen fonksiyon metnini ve aynı adlı çağrılabilir overload'ları doğrular. Beklenmeyen durumda işlem geri alınır. `ACCESS EXCLUSIVE` uygulama sırasında bu üç tabloda okumaları da bekletir; lock_timeout 15s, statement_timeout 60s işlemseldir.
- Eski SheetJS sürümünü anlatan geçersiz Luca yorumu kaldırıldı; dosya boyutu sınırı aynı kaldı.

## Doğrulama

- PostgreSQL **17.10**, sentetik ve ayrı geçici veritabanlarında: **55/55** (11 temel + 31 görev + 13 finans).
- Finans senaryoları: rol/tenant okuma, kapalı modül, idempotent aktarım, eski makbuz, yabancı firma, stale claim, bozuk config, isolation reddi, service bypass yolları, iki yönde eşzamanlı kilit sırası, kolon yetkilerinin kaldırılması, kalıtılmış yetki/fonksiyon metni/overload sapmasında rollback.
- Eski iki finans fonksiyonunun test gövdeleri stub'dır: bunlar için algoritma değil etkin EXECUTE yetkisi test edildi. Atomik mizan ve ortak guard gerçek migration metninden yüklenir. Fixture tam Supabase üretim şeması değildir.
- `release.log`: 560/560 uygulama testi, saf fonksiyon testleri, TypeScript ve üretim derlemesi geçti. Statik 0 FAIL / 2 WARN: yeni migration henüz commit edilmediği için drift uyarısı ve önceden mevcut iki ulaşılmayan bileşen (CapacityRiskCard, TimelineList). Nihai ölçümler `manifest.json` içindedir.
- Yeni DB testi envantere ve PostgreSQL CI işine eklendi.

## Sınırlar ve yayın kapısı

Kimlikli tarayıcı ve PostgREST smoke bu tur yapılmadı. Diğer beş eski DB suite'i ve yedi pending test dosyası çalıştırılmadı. Üretim yetkileri/owner/overload'lar henüz ölçülmedi. service_role ham okuma/yazma ve eski RPC tüketicileri canlı entegrasyonlar açısından ayrıca kontrol edilmelidir.

Finans dışı FK CASCADE/SET NULL işlemleri ve owner/superuser yazımları için genel kapanma garantisi verilmez. Diğer modüllerin RPC/RLS/storage/export/cron/ilişki yolları, açık iş ve bağımlılık engelleri, ayar komutu, genel gezinme/cache yenileme hâlâ açık. **Modül kapatma UI'si bu nedenle açılmadı.** Sayfa giriş snapshot'ı gerçek zamanlı iptal değildir; daha önce istemciye ulaşan veriler geri çağrılamaz.

Kontrollü yayın: önce canlı şema/etkin yetki/tüketici ön kontrolü; 000900 ve 001000 ortak altyapıdan sonra 001600 uygulanabilir. Yeni frontend ve kimlikli smoke gerekir. Görevlerin 001100 doğrudan yazma cutover'ı önceki plandaki gibi yeni frontend smoke sonrasında uygulanır; bütün bekleyen migration'ları numaraya göre tek seferde çalıştırmayın.
