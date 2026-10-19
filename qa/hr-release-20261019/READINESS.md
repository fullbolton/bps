# İK yayın hazırlığı — 19 Ekim 2026

Durum: **yerel sıralı kurulum geçti; üretim yayını yapılmadı.**

## Doğrulanan kapsam

- Vercel salt okunur incelemesinde www.bpsys.net dağıtımı `dpl_CiWugmjyyW4wtyBqj7tSR5i9t1FA`, production ve READY. Kimlik, kayıtlı `6300bee` yayın belgesiyle aynı; kaynak commit doğrudan Vercel metadata alanından alınmadı.
- Son kayıtlı üretim SQL ölçümü 18 Ekim 17:24 UTC: 190 migration. Bu sayı bugün yeniden ölçülmüş değildir.
- Bu tarihsel seviyeye sentetik template üzerinden hazırlanmış disposable PostgreSQL üzerinde aşağıdaki 17 migration sırayla geçti. SHA-256 değerleri result.json içinde sabittir.
- Kurulum sonunda onaylı HR teknik kabul kaydı ve scoped şirket modu yok. Geliştirme dalının otomatik Git yayını kapalı.
- Güncel canlı ledger erişim denemesi aktif worktree Supabase'e bağlı olmadığından başarısız oldu. CLI proje listesi erişilebilir; proje listesi şema doğrulaması değildir.

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

1. Üretimde salt okunur migration ledger, ilgili fonksiyon/ACL/policy tanımları ve modül bariyerini yeniden ölç. Eski 190 kaydını güncel kabul etme.
2. Aday hashlerini yeniden karşılaştır; canlıda farklılık varsa provayı güncel şema üzerinden tekrar yap. Uygulanan migration dosyasını değiştirme.
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
