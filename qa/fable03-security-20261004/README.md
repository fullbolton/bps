# Fable 03 — S-1/S-2 bağımsız güvenlik düzeltmesi

Taban: `01c46b5`. Dal: `codex/fable03-security-20261004`. Modül seçimi paketine bağımlı değildir. Yerel hazırlanmış, üretime uygulanmamış ve yayımlanmamıştır.

## Değişiklik

`20261004001000_demo_and_critical_date_boundaries.sql`:

- Demo taleplerinde authenticated yalnız SELECT alır ve is_platform_admin() ile sınırlandırılır. Restrictive fence başka geniş permissive politikanın erişim açmasını önler. Anon/browser insert/update/delete yok; service_role INSERT korunur. Platform yöneticisine yeni bir ekran veya güncelleme yetkisi eklenmez.
- Kritik tarihlerde tüm authenticated işlemler aktif doğrulanmış tenant ile sınırlandırılır. Yazmalar yöneticiye, INSERT oluşturucusu auth.uid()'ye bağlıdır. Üç restrictive yazma politikası eski/geniş permissive politikaların rol/yazar şartını aşmasını önler.
- BEFORE UPDATE trigger tenant ve created_by değişikliğini reddeder. Aynı tenant yöneticisi başkasının kaydını düzenleyebilir; yazarı kendine geçiremez. Legacy NULL yazar korunur. Trigger trusted servis güncellemelerinde de kimliği korur; ihtiyaç varsa yetkili veri onarımı ayrıca planlanmalıdır.
- Açılışta iki tablo ACCESS EXCLUSIVE kilitlenir (15s timeout); kısa süre okumalar da bekleyebilir. Helper varlığı ve kritik tenant/creator kolonları kontrol edilir. Hata transaction'ı geri alır. Veriler silinmez veya güncellenmez.

## Kanıt

- Eski gerçek migration politikalarıyla sentetik PostgreSQL 17 ortamında sıradan yöneticinin global demo kayıtlarını okuyabildiği ve diğer tenant'a kritik tarih ekleyebildiği önce yeniden üretildi.
- Gerçek current_user_active_tenant/current_user_verified_tenant/current_user_role/is_platform_admin fonksiyonları kullanıldı. İki üyelikli test kullanıcısı seçim ve üyelik sürümü claimleriyle çalışır.
- Dokuz DB testi geçti: tenant/platform ayrımı, anonim engeli, servis intake, sahte yazar/tenant, başka yöneticinin kaydını düzenleme, değişmez kimlik, NULL legacy yazar, geniş permissive politika altında filtresiz silme sınırı, yönetici A/operasyon B rol ayrımı ve bilinmeyen tenant.
- 518 uygulama testi geçti. TypeScript temiz, statik 0 FAIL / 2 WARN. CI PostgreSQL 17 işi eklendi.
- Tablolar sentetik; tenant kolonu ve grants, üretim varsayımı olarak açıkça fixture'da kuruldu. PostgreSQL RLS kanıtı gerçek PostgREST/Storage veya üretim şeması kanıtı değildir.

## Yayın öncesi

`production-preflight.sql` salt okunurdur; kişisel veri içeriklerini almaz. Gerçek tablo politikaları, aggregate adetler, rol ayarları, kolonlar/grantler ve helper gövdeleri incelenmeli. Supabase Auth kayıt ayarı ayrıca kontrol edilmeli. Bu oturumda Supabase SQL aracı yoktu; sorgular üretimde çalıştırılmadı. Üretimde tanım/ACL farklılığı varsa önce uyarlama gerekir.

Bu pakette yalnız S-1/S-2 ve critical_dates için S-3 kapandı. Diğer altı tablonun S-3 incelemesi, bildirim yenileme, kaldırılmış atama, kişi birleştirme/raporlama, vardiya/tarih/arama ve bakım bulguları açık kalıyor. Yeni build/browser veya deploy yapılmadı.
