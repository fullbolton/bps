# BPS — Vault, Repo ve Canlı Durumdan Devam Planı

> Sonraki kullanıcı yönlendirmesi: [Güncel yön](BPS_GUNCEL_YON.md).
> Bu belgedeki bps-dev kararı tarihsel; projenin bugün var olduğu doğrulanmadı.
> Aşağıdaki sıralama önceki uzlaştırma kaydıdır; güncel yürütme sırası yeni belgede.

Tarih: 2026-09-08. Durum: P00 başlangıç uzlaştırması yapıldı; P01 hazırlığı açık.
Bu tur planlama ve salt-okunur ölçümdür. Ürün kodu, yetki veya canlı şema değiştirilmedi.

## Nereden devam ediyoruz?

Vault'ta BPS altında 284 Markdown dosyası envanterlendi; tamamı satır satır okunmadı.
Son değişen handoff'lar, ana durum kaydı ve ilgili ürün/ortam/admin/OCC/senkron
kararları hedefli okundu. `00-DURUM.md` deprecated; güncel durum kaynağı kabul edilmedi.
İncelenen son handoff serisi 10 Ağustos tarihli. Eylül gelişmeleri için repo ve
[canlı ölçüm](../02_rules/SUPABASE_MCP_OLCUM_2026-09-08.md) esas alındı.

| Konu | Uzlaştırılmış durum | İşe etkisi |
|---|---|---|
| Tenant şemasının repo karşılığı | Vault'un ana açık borcu; bugünkü teknik plan da bunu P00/P01 önkoşulu yapıyor | Yeni tabloları test etmeden ilgili baseline kurulmalı |
| Eski trigger / profiles / admin migration işleri | Ağustos notlarında bekleyenler var; Eylül canlı ledger'da ilgili migration'lar mevcut | Eski talimatlar yeniden uygulanmaz; nesne bazında doğrulanır |
| Platform admin | Canlıda 0; eski “bayrak açıldı” kaydıyla çelişiyor | Hesap/ortam kanıtı uzlaştırılır; kullanıcıya kendiliğinden yetki verilmez |
| Gerçek hesap | İş e-postası Auth+profiles'ta var; Gmail Auth'ta yok | İlk admin hedefi Gmail varsayımıyla kurulmaz |
| Geliştirme ortamı | `tiqemcsjuyudahgmqksw`, 24 Nisan kabul edilmiş kararda bps-dev | Yeni ücretli proje açmak ilk adım değil; mevcut dev'in durumu ölçülür |
| Şube modeli | Haziran planında da yapısal önkoşul | P02'yi destekliyor; şube toplu aktarımı ilk kod paketi |
| Görev / saha / bildirim | Haziran önerileri; güncel görev ataması ve e-posta kodu kısmen karşılıyor | Yeniden motor kurmak yerine eksik davranışı tamamla |
| OCC belgesi | “Onay bekliyor” | Genel politika gibi uygulama; yeni modülde atomik sürüm kontrolü tasarla |
| Personel kapsamı | Eski notta ürün kararı bekler; yeni konuşma minimal havuzu gerektiriyor | P01'de SoT'a minimal kapsam yaz; bordro/özlük ekleme |
| Finansal text alanlar / mizan tenant sahipliği | Eski açık borçlar, bazıları roadmap'te kayıtlı | Güncel ölçümle yeniden sınıflandır; şube importuna ilişkisiz finans refactor'u ekleme |

## İlk teslimin sınırı

**Vakıfbank → lokasyon aktarımı → günlük temizlik talebi → İDP yerleştirme → haftalık çıktı.**
Ofisin gerçek bir haftayı sistemde yürütmesi kabul hedefidir. Şube kaynağı bulunamazsa
Excel/CSV akışı çalışır; otomatik kaynak tamamlandı denmez. Otel işe yerleştirme modeli,
yarım gün, çalışan portalı, kapsamlı görev motoru ve abonelik tahsilatı ilk teslim değildir.

## Sıralı çalışma

### 1. P00'ı kapat — kanıt ve ortam

- [x] Vault/repo/canlı kayıtların zamanını ve çelişkilerini ayır.
- [x] Prod MCP'yi ve temel katalog/ledger sonuçlarını doğrula.
- [x] İş hesabı ile Gmail varsayımını yalnız sayımla karşılaştır.
- [ ] Public şemanın tablo/kolon/FK/index/fonksiyon/trigger/event-trigger/policy/grant
  envanterini tamamla; platform objelerini ayrı sınıflandır, filtreleyip kaybetme.
- [ ] Mevcut bps-dev erişimini, verisini ve şema temelini doğrula; prod MCP'nin
  proje kapsamını dev'e sessizce çevirmeden ayrı bağlantı kullan.
- [ ] `/admin`, yeni firma ve tenant kapsamlı atama smoke sonuçlarını kaydet.
  Admin farkı yalnız admin smoke'u bloke eder; bağımsız lokasyon tasarımını bekletmez.

Kabul: hangi ortamda hangi temel var biliniyor; eski migration tekrar uygulanmıyor;
test ortamının eksikleri sayılı. Bütün eski ürün borçlarını çözmek P00 şartı değildir.

### 2. P01'i kapat — uygulayıcıya kesin sözleşme

- `SYSTEM_MAP`/`PRODUCT_STRUCTURE`/`SCREEN_SPEC`: firma altında lokasyon, günlük
  talep ve minimal personel havuzunun yerini dar değişiklikle tanımla.
- `WORKFLOW_RULES`/`STATUS_DICTIONARY`: gerçek günler, kısmi/atandı, iptal/bekleme,
  planlanan/gerçekleşen ayrımı; kapasite ve tam gün çakışması.
- `ROLE_MATRIX`: import/sözlük/personel/atama/çıktı aksiyonları; partner HOLD korunur.
- Teknik tasarımdaki öneri tablo/RPC adlarını ve ilgili baseline migration sırasını
  kesinleştir; concurrency/idempotency/yetki testlerini uygulama görevine bağla.

İlk banka dilimi için teyit gerektirenler: tam gün sınırı (K2), yazma/okuma rolleri
(K4), çalışma takvimi (K6), durumlar (K8). K1 otel ve K3 dış çıktı ilgili pakete kadar
bekleyebilir. Kabul: Claude Code davranış veya yetki icat etmek zorunda kalmıyor.

### 3. P02 — ilk kod: lokasyon ve import

1. Doğrulanmış dev temelinde lokasyon/kaynak/import DDL + RLS/grant/RPC.
2. Server Action → servis → veri erişimi; firma içinde liste ve önizleme.
3. CSV/XLSX tekrarlı yükleme, belirsiz eşleşme, arada değişen satır, yanlış tenant testleri.
4. Resmî kaynak erişimi keşfi; doğrulanmış adaptör varsa aynı önizleme hattına bağla.
5. Claude Code diff ve test teslimi → Codex review → kullanıcı senaryosu.

Kabul örneği: aynı şube dosyası ikinci kez yüklendiğinde kopya oluşmaz; bir şube
değiştiğinde yalnız o fark görünür; başka tenant'ın firmasına aktarım reddedilir.

### 4. P03–P06 — operasyonu çalıştır

P03 kişi+talep+tek atama → P04 toplu atama/değişiklik → P05 haftalık çıktı+pilot →
P06 eski akışın kontrollü kesimi. Ayrıntılar [iş planında](BPS_OPERASYON_SAAS_IS_PLANI.md)
ve [teknik planda](BPS_TEKNIK_UYGULAMA_PLANI.md). Eski talep tablosu pilot öncesi düşürülmez.

## Claude Code / Codex teslimi

Codex: başlangıç kanıtı, teknik tasarım, bağımsız SQL/kod review'u.
Claude Code: açılan küçük paketin uygulaması ve test kanıtı.
Furkan: açık ürün cevapları ve gerçek kullanım kabulü.
İki araç aynı dosyada eşzamanlı çalışmaz. Bu plan “bütün paketleri şimdi kodla”
talimatı değildir. Sıradaki somut iş: P00 katalog/dev envanteri, sonra P01 dar SoT diff'i.

## Okunan ana Vault kaynakları

Vault kökü: `/Users/furkanyahsi/Desktop/Vault77/01-projects/bps/`.

- `handoffs/2026-08-10-MASTER-session-handoff.md`
- `handoffs/2026-08-10-oturum-ilerleme-envanter-tamam.md`
- `handoffs/2026-08-10-bekleyen-isler-olculmus.md`
- `handoffs/2026-08-10-tenant-schema-as-code-safe-plan.md`
- `handoffs/2026-08-10-luca-rpc-gate-closed.md`
- `handoffs/2026-06-04-platform-ekleme-plani-guvenlik-temizlik-sube.md`
- `decisions/karar-bps-environment-strategy.md`
- `decisions/karar-platform-admin-minimum-spec-v1.md`
- `decisions/karar-bps-occ-policy.md`
- `decisions/karar-obsidian-repo-sync-rule.md`
- `notes/calisma-disiplini-yesil-gecen-yanlis-iddia.md`

Senkron kontrolü: ortam kararı repo CHANGELOG'da temsil ediliyor; güncel etkisi bu
plana taşındı. İlgili eski öneriler tamamlanmış veya onaylanmış gibi aktarılmadı.
284 belgenin tümünde senkron uyumu denetlendi iddiası yok. Vault bu tur salt okunur;
yeni yürütme kaydı repo'da tutuldu.
