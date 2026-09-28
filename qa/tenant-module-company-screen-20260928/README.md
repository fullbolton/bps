# M2e — firma detayının modül bağlamı

28 Eylül 2026 · `codex/tenant-modules-foundation-20260928`

**Yerel aday. Üretime SQL uygulanmadı; push/deploy yok. Bu tur SQL değişmedi.** Modül kapatma seçeneği henüz kullanıcıya açılmadı.

## Ürün davranışı

Firma detayı artık `WorkspaceModuleBoundary` ile Müşteriler modülünü doğrulamadan içeriğini başlatmaz. Firma ID'si değişirse önceki detay örneği bırakılır. Genel bakış kartları, sekmeler, okuyucular ve ilgili düğmeler aynı `companyModuleAccess` kuralını kullanır. Saklanan sekme artık görünür değilse Genel Bakış açılır; gizli bir sekme boş ekran bırakmaz.

| Alan | Modül | Repo RLS'sine göre okuyabilen rol |
|---|---|---|
| Yetkililer | Müşteriler | Yönetici, operasyon |
| Notlar | Müşteriler | Yönetici, operasyon, İK |
| Sözleşmeler | Sözleşmeler | Yönetici, operasyon |
| Randevular | Takvim | Yönetici, operasyon |
| Eski personel talepleri | Personel operasyonu | Yönetici, operasyon |
| Önceki kadro özeti | Personel operasyonu | Yönetici, operasyon, İK |
| Evraklar | Belgeler | Yönetici, operasyon, İK |
| Ticari özet | Finansal özet | Yönetici, muhasebe |

Günlük plan bağlantısı staffing + yönetici/operasyon ister. Ödeme takip taslağı ve teklif hesaplayıcı finans modülüne bağlı yönetici araçlarıdır. Yeni yetki verilmedi. Özellikle İK'nın eski kadro özeti okuması korunurken personel talebi okuması açılmadı; bu iki tablonun rol politikaları farklıdır.

Rol eşlemesi `20260827000300_remove_partner_role.sql` içindeki policy'lerle karşılaştırıldı. Önceki M2d'de eski partner rolünü sözleşme/randevu sayfa girişinde ve bazı dashboard kartlarında bırakan UI koşulları da düzeltildi. Dashboard ilgili alanlarda aynı firma erişim yardımcısını kullanır. **Bu bir üretim katalog/grant ölçümü değildir.**

## Evrak ve sözleşme ayrımı

- Belgeler açık, Sözleşmeler kapalıysa firma belgesi yüklenebilir.
- Firma belge okuyucusu, bu durumda her sayfada PostgREST `contract_id IS NULL` filtresi uygular; bağlı sözleşme dosyaları bu ekrana taşınmaz. Yanıt filtreyi ihlal ederse liste hata verir. Diğer belge okuyucularının eski davranışı korunur.
- Sözleşme seçici ve bağlantıları kapalı modüle yönlendirmez. Firma evrak sekmesinde yalnız firma belgelerinin gösterildiği belirtilir.
- `EvrakUploadModal.tsx` firma sayfasından ayrıldı. Yükleme, silinmemiş taslak uyarısı, dosya/isim ve hata davranışı korundu.
- Formun sözleşme seçimi sonradan kullanılamaz hale gelirse seçim sessizce temizlenmez. Kullanıcı seçimi açıkça kaldırır; dosyası ve diğer alanları korunur. Ondan sonra firma belgesi olarak yükleyebilir.

Bu filtre istemci sorgu sözleşmesidir; direct DML/RLS/storage kapısının yerini tutmaz. Global evrak ekranı, doğrudan indirme yolları ve sözleşme dosyalarının DB/Storage erişimlerinin bütün modül kontrolleri henüz bu paketle kapanmış sayılmaz.

## Finans ve hata doğruluğu

Eski finans effect'i hata ile olmayan kaydı aynı `null` durumuna indiriyor ve şirket değişiminden sonra geç gelen cevabı eleyemiyordu. `loadCompanyFinancialSummary` dar kolonlarla şirket + tenant filtrelerini uygular; yanıtın iki kimliğini, tutarlarını, gecikme bayrağını ve kaynağını kontrol eder. Ağ/DB hatası ve bozuk cevap hata olarak kalır; yalnız başarılı `data:null` boş kayıt sayılır.

`useScopedResource` yükleme/hata/veri durumlarını ayırır, eski istek cevabını yok sayar ve bağımsız yeniden deneme sağlar. Finans kapalı veya rol uygun değilse sorgu hiç çalışmaz. Ödeme kartı yükleme hatasında “takip yok” demez. Gecikme bilgisi `null` ise `false` yapılmaz; belirtilmemiş olduğu anlatılır. Sıfır/negatif tutarlar pozitif alacak uyarısı üretmez. Taslak tutarları Türkçe para biçiminde hazırlanır.

Firma ana kaydı için de transport hatası “firma bulunamadı” ile karıştırılmaz; yeniden deneme sunulur. RLS'nin gizlediği kayıt ile bulunmayan kayıt arasında varlık bilgisi açıklanmaz.

## Doğrulama

**560/560 uygulama testi, test envanteri, qa:unit, TypeScript ve Next.js üretim derlemesi geçti. Statik tarama: 16 kontrol, 0 FAIL / 1 WARN.** Sonuçlar `release.log` ve `manifest.json` içinde. Yeni on senaryo gerçek TS/TSX'i çalıştırır:

- Katalogdaki 1.024 olası kombinasyonun geçerli olanlarında rol/sekme eşlemesi.
- Dar finans sorgusu, tenant/şirket, boş sonuç/hata/bozuk veri ayrımı.
- Sözleşme dosyası filtresinin her sayfaya uygulanması ve uygunsuz yanıtın reddi.
- Gerçek firma ekranında kapalı okuyucuların çağrılmaması ve eski sekmeden Genel Bakış'a dönüş.
- İK, muhasebe ve operasyon rollerinin farklı veri okuyucuları.
- Finans hatasında yanıltıcı boş sonuç gösterilmemesi.
- Kapalı sözleşmeyle firma belgesi yükleme seçeneği.
- Gerçek yükleme formunda sözleşmesiz FormData oluşturma.
- Unmount sonrası geç finans cevabının görünümü dolduramaması.
- Sözleşme seçimini açıkça kaldırırken dosyanın korunması.

Önceki ortak ekran testleriyle aynı hook sürücüsü `scripts/helpers/component-driver.mjs` üzerinden paylaşılır. Gerçek `useScopedResource` çalışır; ağ, alt bileşenler ve yönlendirme sentetiktir. DOM/kimlikli tarayıcı/PostgREST smoke değildir. İlk denemede yeni testin footer'ı yanlış React katmanında araması düzeltildi; ürün kodunda çalışma hatası değildi. Ardından tüm release zinciri yeniden çalıştırıldı.

SQL değişmediğinden PostgreSQL suite'leri bu tur tekrar koşturulmadı. Yedi pending dosya genel uygulama suite'ine dahil değil. Statik eski kullanılmayan `CapacityRiskCard`/`TimelineList` uyarısı sürüyor.

## Kalanlar ve yayın

Bu sayfanın UI/okuyucu koşulları tamamlandı; M2 erişim çalışmasının tamamı bitmedi. Diğer modüllerin doğrudan DB/RPC, storage, export, cron ve FK yolları; etkin üretim yetki envanteri; modül kapatmayı engelleyen açık işler/bağımlılıklar; ayar komutu ve Modüller ekranı; genel menü ve konfigürasyon değişimi sonrası cache davranışı açık.

Firma servislerinin eski `resolveCompanyByIdOrLegacy` ve tam firma satırı okuyucuları bu tur değiştirilmedi. Birden çok alanın aynı firmayı tekrar çözmesi ve ortak dar projeksiyonlara geçiş ayrı iştir. Güncel UI snapshot'ı anlık modül değişikliği yayını değildir. Kullanıcının açık formunu odak değişiminde sıfırlayan polling eklenmedi.

M2c/M2d'deki kontrollü yayın sırası korunur: temel/expand SQL'leri → frontend ve kimlikli smoke → `001100` direct-write contract; `001500` FK koruması ayrıca doğrulanır. Bütün bekleyen SQL dosyalarını tek adımda göndermeyin. Bu frontend temel RPC olmadan tek başına üretime çıkarılmaz.
