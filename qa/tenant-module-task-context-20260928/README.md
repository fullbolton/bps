# M2c — görev ekranı ve bağlı kayıtların korunması

28 Eylül 2026 · `codex/tenant-modules-foundation-20260928`

**Yerel aday; üretime uygulanmadı, push/deploy yapılmadı.** Modül kapatma ayarı hâlâ kullanıcıya açık değil.

## Ürün davranışı

- Görevler ekranı önce doğrulanmış kullanıcı, tenant, rol, üyelik/şirket seçimi sürümleri ve eksiksiz modül durumunu alıyor. Eksik/yanlış yanıt tüm modüller açık varsayımına dönüşmüyor. Yetki yanıtı kullanıcıya teknik hata kodu yerine Türkçe yeniden yükleme mesajı gösteriyor.
- Görev modülü kapalıysa boş liste/yeni görev çağrısı yerine açıkça “Görevler bu çalışma alanında kapalı” gösteriliyor. Oluşturma, devir ve hızlı işlem pencereleri erişim yokken sunulmuyor. Görevler rol kapısı yönetici/operasyon/İK ile eşitlendi; partner artık boş fakat oluşturma düğmesi olan ekran görmüyor.
- Sözleşme ve randevu bağlantıları kendi modülü ve okuyabilen rol açıkken gösteriliyor. Bu kural masaüstü ve mobilde aynı yardımcıyı kullanır; doğrulanmamış durum bağlantı üretmez. Talep üzerinden görev hazırlama staffing açıkken sunulur.
- Firma modülü kapalıysa firma bağlantısı/seçimi/filtreleri gösterilmez; firmasız görev açılabilir. Var olan firmalı görev “firma dışı” diye yeniden sınıflandırılmaz; “Firma modülü kapalı” denir. Önceki firma filtresi modül kapalıyken görünmez biçimde işleri saklamaz.
- Yeni görev formunda kapalı firma modülü, boş firma listesi gibi anlatılmaz. Eski firma seçimi varken modül kapanırsa bu seçim sessizce atılıp başka bir görev oluşturulmaz; form reddeder ve yeni görev açmayı ister.
- Firma listesi hatası ile görev listesi hatası ayrıdır. Firma seçiciyi yeniden yüklemek formu söküp yeniden kurmaz; taslak korunur. Pasif firmalar listede/ilgili görevlerde kalır, yeni görev seçiminde sunulmaz.

## Daha dar firma okuması

`task_company_choices_v1()` sadece `id, tenant_id, legacy_mock_id, name, status` döndürür. Görev ekranındaki `selectAllCompanies` ve ayrıca yapılan `getCompanyDisplayMapByIds` kaldırıldı; adlar ve seçimler aynı dar dizinden gelir. Firma finans/iletişim/diğer alanları bu endpoint'ten dönmez.

Fonksiyon **SECURITY INVOKER**: mevcut firma RLS'si korunur. Üstüne doğrulanmış tenant, tasks + customers modülü ve görev okuma rolü koşulları uygulanır. Yalnız authenticated EXECUTE alır. Sayfalama exact count + name/id sırası + 500 satırlık sayfalarla eksik/tekrarlı yanıtı reddeder; mevcut yardımcıdaki 10.000 kayıt sınırı korunur. Listeyi sunucuda aramaya dönüştürme veya canlı performans/egress ölçümü bu paketin parçası değildir.

Modül snapshot'ı, görev listesi ve şirket dizini ayrı HTTP istekleridir; tek DB transaction'ı değildir. UI sayfa yükleme/yenilemesinde doğrular. Bütün uygulamada anlık ayar değişimi yayını, cache invalidation ve ortak shell/menu eşlemesi hâlâ sonraki iştir. UI bağlantısını gizlemek kaynak modülün tüm RPC/route güvenliği yerine geçmez.

## Zincirleme silme düzeltmesi

`20260928001500_preserve_task_relations.sql` görevlerden aşağıdaki ebeveynlere beş FK'nin silme davranışını RESTRICT yapar:

| Bağlantı | Önce | Şimdi |
|---|---|---|
| Firma `(tenant_id, company_id)` | Görev ve atama geçmişine CASCADE | Görev varsa firma hard-delete reddedilir |
| Sözleşme `(contract_id, company_id, tenant_id)` | contract_id SET NULL | Görev bağlantısı korunur |
| Randevu `(appointment_id, company_id, tenant_id)` | appointment_id SET NULL | Görev bağlantısı korunur |
| Oluşturan profil `created_by` | SET NULL | Bağlı profil hard-delete reddedilir |
| Atanan profil `assigned_to_user_id` | SET NULL; atama tarihçesi değişebilir | Bağlı profil hard-delete reddedilir |

Tamamlanmış görevler de korunur. Görev modülünün kapalı olması bu korumayı kaldırmaz. Firma pasifleştirme ve üyelik/rol yönetiminin mevcut kuralları değişmez. Hiç göreve bağlı olmayan kayıtların hard-delete'i diğer mevcut FK kuralları izin verdiği ölçüde mümkündür.

**Sonuç:** Auth kullanıcısının silinmesi profile CASCADE ediyorsa bağlı görevler bu silmeyi de durdurabilir. Kişisel veriler için onaylı anonimleştirme/saklama süreci gerektiğinde ayrı tasarlanmalıdır; bu paket otomatik hesap/veri temizleme yapmaz. Veriler dışarı aktarılmadı veya silinmedi. Doğrudan yetkili task DELETE, görev geçmişinin kendi ON DELETE CASCADE'i ve diğer modüllerin FK'leri bu değişiklik kapsamında değildir.

Migration isimle yetinmez: tablo, sıralı child/parent kolonları, FK'nin geçerliliği, erteleme/match/update/delete davranışlarını kontrol eder. Ek bir farklı silme davranışlı FK varsa tüm transaction durur. Beş ilişki değiştirilirken profil/firma/sözleşme/randevu/görev tablolarında ACCESS EXCLUSIVE tutulur; okumalar ve yazmalar bekler. lock_timeout 15 saniye kilit beklemesini, statement_timeout 60 saniye her statement'ı sınırlar. Constraint'ler doğrulanarak eklenir; hiçbir kayıt onarılmaz veya atılmaz.

## Kanıt

- [database.log](./database.log): PostgreSQL 17.10'da **42/42** sentetik test: 11 temel + 31 görev/iş akışı/projeksiyon/FK. Yeni senaryolar dar kolonlar, rol/tenant/modül/firma RLS, beş ebeveyn silme reddi ve görev/geçmişin değişmemesi, bağlantısız firma silme/pasifleştirme, schema drift ve eşzamanlı görev oluşturma→firma silme yarışı.
- FK fixture'ı 20260915000600 + 20260928000600'deki task anahtarlarını ve gerçek görev/revision/makbuz fonksiyonlarını kurar. Bütün üretim/Supabase şemasının birebir kopyası değildir.
- [release.log](./release.log): **541/541** genel uygulama testi, static 0 FAIL/2 WARN, TypeScript ve build geçti. Bu koşudan sonra eklenen form render testi dahil [context-regression.log](./context-regression.log) **4/4** geçti (üçü genel koşuyla ortak). Yedi pending test dosyası genel koşuya dahil değil.
- Son Türkçe hata mesajı düzenlemesinin ardından odaklı testler ve son tip/build doğrulaması: [final-build.log](./final-build.log).
- Form testi gerçek TSX'i React ile render eder; portal/kabuk ve ilgisiz alt bileşenler stub'dır. **Kimlikli tarayıcı/PostgREST smoke değildir.** Browser smoke, uzak CI, üretim katalog ölçümü ve eski Docker suite'leri bu tur yapılmadı.

## Yayın ve kalanlar

Henüz yayın yok. Önce canlı katalog/grant/FK tanımları bu adayla karşılaştırılmalı. Kontrollü sıra: `000900 + 001000 + 001200 + 001300 + 001400` expand → yeni frontend ve kimlikli görev/bağlantı/form smoke → `001100` doğrudan yazma contract; `001500` ayrıca kilit/retention etkileri doğrulanarak uygulanır. **Bütün bekleyen dosyaları tek db push adımına koymayın.** Ayrı staging listesi ve migration ledger doğrulanmalı.

Kalanlar: diğer ortak firma/sözleşme/randevu/dashboard ekranlarının modül bağlamı; görev satırının kaynak metinleri dahil kolon/projeksiyon sözleşmesi; diğer modüllerin tablo/RPC/storage/export/cron/FK kapıları; üretim etkin yetki envanteri; açık iş/bağımlılık engelleri ve idempotent ayar mutasyonu; Modüller ekranı + genel gezinme/cache yenileme. Görev modu dahil hiçbir modülü henüz bütünüyle kapanabilir saymayın.
