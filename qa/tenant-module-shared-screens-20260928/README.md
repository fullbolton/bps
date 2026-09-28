# M2d — ortak ekranlarda modül bağlamı

28 Eylül 2026 · `codex/tenant-modules-foundation-20260928`

**Yerel geliştirme. Üretime migration uygulanmadı, push/deploy yapılmadı. Bu pakette SQL değişmedi.** Modül kapatma komutu ve ayarı henüz açılmadı.

## Tamamlanan davranış

- Ana ekran, randevular ve sözleşme detayı açılırken ortak `WorkspaceModuleBoundary`, `current_workspace_modules_v1()` yanıtını doğrular. Kullanıcı/tenant/rol, seçim ve üyelik sürümleri, katalog sürümü ve eksiksiz modül yapısı kontrol edilir. Yanıt gelmeden ilgili sayfanın iş verisi okuyucuları çalışmaz. Yanlış/eksik yanıt tüm modüller açık varsayımına dönüşmez; Türkçe hata ve yeniden deneme sunulur.
- Rol reddi, ayar okuma hatası ve kapalı modül ayrı durumlardır. Ana ekranın kendi zorunlu modülü yoktur; randevular `calendar`, sözleşme detayı `contracts` gerektirir. Bağımlılıklar ortak katalog doğrulamasından geçer.
- Randevu sonucu kaydedilirken **“Sonraki aksiyon için takip görevi oluştur”** açık bir seçimdir. Kullanılabilirse önceki davranışı korumak için başlangıçta seçilidir. Kullanıcı kaldırabilir; Görevler kapalıysa seçenek ve bağlı görev okuyucusu gösterilmez, randevu `createTask:false` ile tamamlanabilir. Sonuç ve sonraki aksiyon metinleri yine zorunludur. Hata sonrası metinler korunur. Sunucunun modül/rol denetimi devam eder.
- Randevu görev penceresi, görev oluşturma menüsü ve atama kullanıcı dizini yalnız tasks açık ve yönetici/operasyon rolündeyken çalışır. Partner için sunucunun zaten reddettiği randevu tamamlama düğmesi kaldırıldı; randevu okuma/oluşturma konusundaki mevcut kurallar değiştirilmedi.
- Sözleşmede bağlı görev sorgusu, görev bağlantıları ve yenileme görevi paneli tasks + rol uygunsa çalışır. Takvim kapalıyken bağlı randevu sorgusu ve bölümü yoktur. Bölüm içi gezinmede olmayan hedefe bağlantı üretilmez. Sözleşmenin yenileme görüşmesi beyanı görevden bağımsız kalır.
- Ana ekran modül + mevcut rol kurallarından tek bir görünürlük/sorgu planı çıkarır. Kapalı modülün şirket/sözleşme/görev/randevu sayacı, görev/sözleşme/evrak/duyuru listesi, ilgili hızlı erişim ve operasyon paneli yüklenmez. Kapalı sayı gerçek sıfır gibi gösterilmez. Görevler partner rolüne sunulmaz; yalnız yönetici, operasyon ve İK görebilir.
- Müşteriler kapalı, Görevler açık kombinasyonunda görevler çalışır; şirket adı sorgusu yapılmaz. Önceden firmaya bağlı görev “Firma modülü kapalı” diye görünür; bağımsız görevle karıştırılmaz.
- Kurumsal tarihler çekirdek özellik olarak kalır. Son aktiviteler mevcut modül filtreli `dashboard_activity` RPC'sini kullanır; bu tur ayrıca değiştirilmedi. Günlük operasyonun alt bileşenleri yalnız staffing ve mevcut yayın bayrağı açıkken bağlanır.
- Görev ekranının snapshot okuyucusu ortak servise taşındı; mevcut `loadTaskWorkspace` adı aynı davranışa delegasyon yapar. Ayrı bir ikinci doğrulama uygulaması eklenmedi.

## Yaşam döngüsü ve kapsam sınırı

Bu bir **sayfaya giriş snapshot'ıdır**; anlık konfigürasyon değişikliği yayını değildir. Kullanıcı/tenant/rol değişimi eski sayfayı ve bekleyen okumaları bırakır. Odaklanınca açık formları söküp taslak kaybettirecek otomatik yeniden yükleme eklenmedi. Ayar hatasındaki yeniden deneme yalnız henüz açılmamış sayfa içeriğini başlatır. İş yazmaları mevcut SQL kapılarından yeniden denetlenir.

UI kapıları tek başına güvenlik sınırı sayılmaz. Diğer modüllerin RLS/RPC, doğrudan yazma, storage/export/cron erişimleri tamamlanmış değildir. Menü/shell, canlı ayar değişimi ve cache invalidation, görev kaynak metinleri ve ortak kolon projeksiyonu sözleşmesi de açık. Bu nedenle modül kapatma özelliği hâlâ sunulmuyor.

Firma detayında bu sürümde ayrı bir görev bölümü bulunmadığı doğrulandı; bu ekranın evrak/sözleşme/randevu/finans/operasyon bölümleri için modül kapıları **sonraki blokta**. Bu tur firma detayına değişiklik yapılmadı.

## Doğrulama

`release.log`: uygulama testleri **550/550**, test envanteri, qa:unit, statik kontroller, TypeScript ve Next.js üretim derlemesi. Statik tarama 16 kontrol, 0 FAIL / 1 WARN; eski kullanılmayan `CapacityRiskCard` ve `TimelineList` uyarısı mevcut.

Yeni `scripts/shared-module-screens.test.mjs` sekiz senaryo içerir:

1. 1.024 modül kombinasyonundan geçerli olanların tamamında altı rolün ana ekran erişimleri.
2. Ortak okuyucuda yabancı/bozuk scope ve transport hataları.
3. Gerçek boundary bileşeninde doğrulama öncesi çocuk çalışmaması, modül kapalı/rol reddi/hata ayrımı.
4. Ayar yeniden denemesi ve unmount sonrası geç cevabın yok sayılması.
5. Gerçek randevu formundan seçili/seçimsiz/kullanılamayan görev seçeneğinin doğru payload üretmesi.
6. Randevu kayıt hatasında metinlerin korunması.
7. Gerçek dashboard effect'inde kapalı modüllere sorgu gitmemesi ve şirket okumadan bağımsız görevler.
8. Açık dashboard bölümlerinin sorgulanması, partner için görev sorgu/bağlantısı olmaması.

Testler gerçek TS/TSX fonksiyonlarını çalıştırır; hook sürücüsü, ağ, yönlendirme ve alt bileşen kabukları sentetiktir. **DOM, kimlikli tarayıcı veya PostgREST smoke değildir.** Yedi pending test dosyası genel uygulama koşusuna dahil değildir. SQL değişmediğinden önceki M2c'de geçen 42 PostgreSQL senaryosu bu tur yeniden koşturulmadı; yeni DB ölçümü iddiası yoktur.

## Sıradaki blok / yayın

Firma detayı ve diğer modüllerin ortak okuyucuları, ardından modül başına DB/storage/export/cron kapıları; üretim etkin yetki envanteri; bağımlılık/açık iş engelleri; idempotent ayar komutu ve Modüller ekranı. Genel gezinme ve çalışma alanı değişimi bu kapılarla birlikte tamamlanmalı.

M1–M2c yayın sırası değişmedi: kontrollü `000900 + 001000 + 001200 + 001300 + 001400` expand → bu frontend ve kimlikli smoke → `001100` doğrudan görev yazma contract; `001500` FK koruması kilit/retention etkileri ayrıca değerlendirilerek uygulanır. Bekleyen bütün SQL dosyalarını tek adımda göndermeyin. Bu ekranlar temel RPC olmadan üretime tek başına çıkarılmamalı.
