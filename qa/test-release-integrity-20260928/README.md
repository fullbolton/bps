# Test ve yayın bütünlüğü — 2026-09-28

## Kapsam

Baz canlı sürüm de0c067. Eksik testler karışık çalışma klasöründen yalnız dosya bazında alınarak temiz Git worktree'sinde çalıştırıldı. Uygulamada tek ek değişiklik: createAppointment artık firma/tenant/sözleşme ilişkisini yazmadan önce doğrular; veritabanındaki mevcut bileşik FK'nin yerine geçmez.

## Sonuçlar

- İlk tekrar: 457 vaka, 447 başarılı, 10 başarısız. Yedisi kaynak modülü bu sürümde bulunmayan test dosyalarının yüklenmesi; üçü randevu kontrolü.
- Son uygulama paketi: 97 dosya, 475 vaka, 475 başarılı.
- Sentetik yerel veritabanı paketi: 3 dosya, 8 test başarılı; Docker fixture gerekir, üretime yazmaz, transaction'lar rollback edilir.
- qa:unit artık kopya fonksiyon yerine gerçek isIsoDate ve safeThrown export'larını çalıştırır: 19 vaka + 4 kontrol başarılı.
- qa:static: 16 kontrol, 0 FAIL, 2 mevcut WARN.
- Envanterde toplam 107 test dosyası: 97 uygulama, 3 veritabanı, 7 bekleyen özellik.

## Bekleyen yedi test neden ayrıldı?

company-financial, company-identities, financial-overview, csv-reader, mizan-reader, mizan-numeric-cell, mizan-workbook-limits testleri; yayımlanmamış finans okuma / CSV worker / Luca worker modüllerine aittir. Testler silinmedi veya skip yapılmadı. scripts/test-inventory.json kaynak dosyalarını ve nedenini açıkça tutar. qa:pending bunları gerçekten çalıştırır ve kaynaklar olmadığı için başarısız olur. Bu testler geçen 475 vakaya dahil değildir. İlgili kaynak eklendiğinde envanter kontrolü testin aktif pakete alınmasını zorunlu tutar.

## Tekrar üretme

Node 24 ve npm ci.

- npm run qa:test-inventory: eksik, fazla veya sınıflandırılmamış test dosyası hata.
- npm run qa:operations: uygulamanın tüm aktif testleri.
- npm run qa:unit ve npm run qa:static.
- NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=ci-build-placeholder npm run qa:release
- npm run qa:database: yalnız guarded supabase_db_bps-supabase-acceptance sentetik fixture hazırsa; CI'daki uygulama sonucu DB testleri çalıştı anlamına gelmez.

GitHub Actions aynı uygulama kapısını sıfır checkout + npm ci ile çalıştırır. Üretim secret'ları CI'ya aktarılmaz. GitHub workflow eklenmesi tek başına branch protection veya Vercel'in deploy koşullarını değiştirmez.

## Migration ve Git

122 SQL dosyası son uygulanmış üretim kaynak dizisiyle byte düzeyinde aynı. Hiç uygulanmamış 20260722000200 taslağı supabase/planned/retired altına taşındı; bu tur SQL uygulanmaz.

Uzak main (237e06c) canlı zincirin atasıdır. Yerel main (2b53d98) ayrıca 9 Eylül eski yayın/belge geçmişini taşır. Birleştirmede doğrulanmış canlı ağaç esas alınır; yerel main tarihçesi ikinci ebeveyn olarak korunur, eski uygulama dosyaları yeni koda geri taşınmaz. Karışık ana çalışma klasörü topluca commit edilmez veya sıfırlanmaz.
