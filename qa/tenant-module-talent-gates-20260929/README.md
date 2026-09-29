# M2p — Personel havuzu RPC ve dosya erişim sınırı

Yerel geliştirme; üretim migration, push/deploy, kimlikli tarayıcı/PostgREST/Storage kabulü yapılmadı.

## Tamamlanan blok

39 açıkça listelenmiş personel havuzu RPC girişine modül kontrolü eklenir: sayfalı havuz/detail, kayıt/sonuç çözümü, Excel karşılaştırma/aktarım/dışa aktarma/geri alma, görüşmeler, müsaitlik, birleştirme, ortak filtreler, arama listeleri, ek dosya rezervasyon/sonuç/iptal ve operasyona personel hazırlama.

Okumalar gerçek workspace snapshot'ını ve talent modülünü doğrular. Yazmalar ortak config SHARE kilidini eski profil/iş kilitlerinden önce alır; bekleme sonrası üyelik/seçim/modül durumunu yeniden doğrular. Kişiyi operasyona hazırlama talent + staffing ister. Diğer havuz girişleri staffing'i zorunlu yapmaz. `talent_assert_scope` değiştirilmez: operasyon ve raporlamanın kullandığı ortak kimlik/rol yardımcısı talent modülüne bağımlı hale getirilmez.

`talent_attachment_access` mevcut Storage SELECT/INSERT politikalarının yardımcısıdır. Kapalı modülde false döner; yeni upload denetimi config yazma bariyerini alır. Dosya sahibi, ready, tenant ve operasyonun onboarding evrakı yasağı korunur. Doğrudan helper erişiminden anon/service_role çıkarılır. Bu değişiklik saklanan dosyaları silmez. Önceden üretilmiş imzalı URL'nin süresi dolmadan iptal edildiği iddia edilmez.

Ortak `talentError` modül kapalı/ayar doğrulanamadı hatalarını belirsiz bağlantı hatasından ayırır. Özel hata işleyen bazı action'ların metinleri ve tüm menü/route görünürlükleri ayrıca gözden geçirilecek.

## Migration neden üretici kullanıyor?

`scripts/talent-module-gates.mjs` açık signature/kaynak dosya/read-write manifestinden 20260929000300 dosyasını üretir. Regex genel SQL parser değildir: yalnız belirtilen kaynakların tek deklarasyon biçimi desteklenir; aynı dosyada iki kez tanımlanan merge_review için son deklarasyon açık istisnadır. Gerçek katalogdaki prosrc SHA-256 her hedefte birebir karşılaştırılır. Sapma, yanlış dil/security/volatility veya eksik signature halinde işlem durur.

Kaynak gövdesinin ilk dış BEGIN noktasına guard eklenir; kalan gövde ve mevcut return tipi/owner/ayarlar pg_get_functiondef üzerinden korunur. Üç eski implementation alias'ının anon/authenticated/service tarafından çalıştırılamadığı doğrulanır. Katalogda manifest dışında yeni bir authenticated, actor-scoped talent endpoint varsa migration durur. Bu kontrol dinamik yolların veya actor parametresi olmayan tüm helper'ların kapsam kanıtı değildir.

Her hedefin authenticated izni var olmalıdır; anon/service execute kaldırılır ve inherited erişim kalmışsa migration reddedilir. Bu nedenle repo dışı servis entegrasyonu varsa uygulama öncesi envanterle kontrol edilmelidir. Son hedefte hata oluştuğunda önceki değişiklikler ve yeni helper dahil tüm transaction geri alınır.

## Doğrulama

- 52 yeni PostgreSQL senaryosu: 39 hedefin kapalı modülde iş gövdesine ulaşmadan reddi; kimlik/tenant/rol, kaynak koruma, bekleyen writer'ın yeni ayarı görmesi, catalog drift/alias/overload reddi ve rollback; dosya sahibi/tenant/onboarding kuralları.
- Gerçek saved-view okuma ve arşiv yazması enabled durumda çalıştırılır.
- Diğer iş algoritmaları bu fixture'da uçtan uca çalıştırılmadı. Sentetik tablolar kompozit deklarasyonları derlemek ve seçili enabled akışları çalıştırmak için minimum kolon içerir. 39 eski algoritmanın regresyonunun eksiksiz kanıtı değildir; birebir source-preservation kontrolü ayrıca vardır.
- Üç yeni uygulama testi: deterministik migration üretimi, manifest guard ayrımı, kullanıcı hata mesajları.
- Toplam sonuçlar eşlik eden loglarda. 12 modül DB suite çalıştırıldı; beş eski bağımsız DB suite bu tur çalıştırılmadı. TypeScript/test envanteri/statik kontrol yapıldı. Üretim derlemesi ve tarayıcı testi bu tur yapılmadı.

## Kalan sınırlar

Bu blok tüm modül sistemini tamamlamaz. Özellikle talent detay/görüşme çıktısındaki operasyon alanlarının staffing kapalıyken ayrıştırılması, ops worker→talent senkronizasyonunun kapanma davranışı, tüm doğrudan tablo/service/trigger/FK yolları ve gerçek Storage HTTP/izin ölçümü hâlâ açık. Operasyon/reporting'in kendi RPC girişleri henüz bu dosyayla kapılanmaz. Bu yüzden genel modül kaydetme/kapatma UI'si açılmaz.

Önce foundation 000900 ve ortak yazma bariyeri 001000 gerekir. Migration exact-source preflight'ı geçmeden uygulanmaz; önceki contract/cutover sıraları değişmez. Toplu kör db push yok.
