# İK yayın hazırlığı — 19 Ekim 2026

Durum: **001 + uyumluluk uygulaması canlıda (191 migration). Kalan 002–017 için güncel üretim başlangıcıyla yerel kurulum ve atomik hata kabulü geçti; bu 16 migration henüz yayımlanmadı.**

## Doğrulanan kapsam

- Vercel salt okunur incelemesinde www.bpsys.net dağıtımı `dpl_CiWugmjyyW4wtyBqj7tSR5i9t1FA`, production ve READY. Kimlik, kayıtlı `6300bee` yayın belgesiyle aynı; kaynak commit doğrudan Vercel metadata alanından alınmadı.
- 19 Ekim güncel salt okunur üretim SQL ölçümü: 190 migration; tarihsel kayıtla birebir eşleşti (live-ledger.json).
- Bu tarihsel seviyeye sentetik template üzerinden hazırlanmış disposable PostgreSQL üzerinde aşağıdaki 17 migration sırayla geçti. SHA-256 değerleri result.json içinde sabittir.
- Kurulum sonunda onaylı HR teknik kabul kaydı ve scoped şirket modu yok. Geliştirme dalının otomatik Git yayını kapalı.
- CLI worktree bağlantısı yerine mevcut Supabase CLI profilinin kimliğiyle resmi read-only Management API kullanıldı. Kimlik bilgileri dosyaya veya çıktıya yazılmadı. Public fonksiyon gövdeleri hash olarak, ACL/owner, kolonlar, tablo RLS/ACL ve politikalar ölçüldü (live-catalog.json). Şirket satırları/dosya içerikleri okunmadı.
- Tek tarihsel fixture farkı change_workspace_modules_v1 authenticated EXECUTE izniydi. Güncel canlı ACL doğrulandıktan sonra yalnız disposable DB'ye aynı GRANT uygulandı; karşılaştırılan katalog eşleşti. Beklenmedik fark artık provayı durdurur. İndeks/constraint/trigger kapsamı sonraki kontrolde eklendi: ayrıntılar ROLLBACK.md. Public dışı şemalar ve gerçek veri dağılımı dahil değildir.

## Aday sırası

1. `20261019000100_module_history_catalog_versions.sql`
2. `20261019000200_module_catalog_v2_storage.sql`
3. `20261019000300_module_entitlements.sql`
4. `20261019000400_platform_module_rights_reader.sql`
5. `20261019000500_hr_organization_foundation.sql`
6. `20261019000600_hr_directory_commands.sql`
7. `20261019000700_hr_work_locations_and_accounts.sql`
8. `20261019000800_custom_access_roles.sql`
9. `20261019000900_access_editor_options.sql`
10. `20261019001000_hr_scoped_directory.sql`
11. `20261019001100_hr_scoped_employee_create.sql`
12. `20261019001200_hr_create_options.sql`
13. `20261019001300_hr_scoped_location_transfer.sql`
14. `20261019001400_hr_access_cutover_routes.sql`
15. `20261019001500_hr_screen_context.sql`
16. `20261019001600_hr_transfer_options.sql`
17. `20261019001700_hr_access_activation.sql`

## Yayın öncesi zorunlu kapılar

1. Ledger ve public fonksiyon/ACL/policy ölçümü tamamlandı. Yayın anında tazeliği tekrar denetle; modül bariyerinin güncel durumu ayrıca doğrulanmalı.
2. Adayın 17 migration hashini ve güncel ledger eşleşmesini koru; public katalog karşılaştırması beklenmedik farkta durur. Uygulanan migration dosyasını değiştirme.
3. Katalog/haklar (001–004), İK temel kayıtlar (005–007), özel roller/okuma (008–010), kapsamlı yazıcılar ve ekran bağlamı (011–016), aktivasyon (017) bağımlılık sırasını koru. SQL tamamlanmadan yeni uygulama yayımlanmaz.
4. Preview/readiness kapalı kurulum ile gerçek şirket aktivasyonunu ayrı işlemler olarak yürüt. Şirket kabul satırını bu paket kendiliğinden oluşturmaz.
5. Yayın adayı için uygulama uyumluluğu, geri dönüş yolu ve üretim kilit süresi değerlendirmesi tamamlanmalı. Bu prova bunları kanıtlamaz.
6. Yayından sonra yetkisiz/izinli okuma, kapalı modül, mevcut operasyon ve yönetici ekranları smoke testi. Gerçek şirket aktivasyonu ancak ayrıca kapsam/rol etkisi kabulünden sonra.

## Ürün kapsamı dışında kalanlar

İK-1 bütünü tamamlanmadı: çalışan düzenleme, ileri tarihli atama, yeniden işe alma, özel evrak ve Excel akışları açık. İzin ve satın alma yönetici onay zincirleri özel erişim rollerinden ayrı geliştirme bloklarıdır. Tam klavye/ekran okuyucu testi ve transferin kesin ret sonrası hedef yenileme tarayıcı senaryosu açık. Önceki 849 uygulama testi bu tur yeniden çalıştırılmış sayılmaz.

Aktivasyon PostgreSQL regresyonu ayrıca tekrar çalıştırıldı: 4 kontrol grubu geçti (access-activation-schema-result.json).

## Tekrar çalıştırma

`node qa/hr-release-20261019/rehearse.mjs`

Yalnız yerel Docker fixture'ını kullanır; geçici veritabanını finally içinde kaldırır. Üretim bağlantısı, veri yedeği veya deploy yapmaz. Tarihsel baseline değişirse betik ve kanıtlar bilinçli olarak güncellenmelidir.

API referansı: https://supabase.com/docs/reference/api/v1-read-only-query

Son genişletilmiş kontrol: indeks/tetikleyici eşleşmesi, sekiz incelenmiş AND parantez farkı ve geçici yayın bariyerinin yokluğu doğrulandı. Eski uygulamaya doğrudan dönüş kısıtı bulundu; ROLLBACK.md yayın sırasını iki aşamalı uyumluluk geçişi olarak netleştirir.
