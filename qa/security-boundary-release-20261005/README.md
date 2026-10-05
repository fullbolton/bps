# Bağımsız güvenlik sınırı yayını — 5 Ekim 2026

`20261004001000_demo_and_critical_date_boundaries.sql` üretime tek başına uygulandı. Önce 124, sonra 125 migration; SHA-256 `b5b6c2ddebeb56ab16973ca20520fe2d853e25225578a872a489a3809a8f34c8`.

Demo ve kritik tarih satır sayıları öncesi/sonrası 1 ve 1. Normal tenant yöneticisi bağlamında demo görünürlüğü 0; anon okuma/yazma kapalı; authenticated demo INSERT/UPDATE/DELETE kapalı; service_role INSERT korunuyor. Kritik tarih restrictive politikaları ve kimlik koruma trigger'ı doğrulandı. Gerçek platform admin bayraklı hesap bulunmadığından pozitif platform erişim testi yapılmadı; yetki ataması yapılmadı.

`before.json`, `after.json` salt okunur katalog/sayım kanıtlarıdır. İş verileri dışa aktarılmadı. Sonraki dört migration ve uygulama yayını için `../security-correctness-release-20261005/README.md` güncel kayıttır.
