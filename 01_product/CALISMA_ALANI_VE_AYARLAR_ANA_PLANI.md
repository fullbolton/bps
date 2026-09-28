# BPS — Çalışma Alanı ve Ayarlar ana planı

28 Eylül 2026 · Birleştirilmiş karar sürümü 1 · Durum: planlama, uygulanmadı.

Bu dosya, seçilebilir modüller ve Ayarlar çalışmasının ana giriş ve karar belgesidir. Önceki araştırmalar kanıt ve teknik ayrıntı olarak korunur. Ürün kapsamı, adlandırma ve uygulama sırası konusunda bu belge; teknik ayrıntıda atıf verilen teknik v2 geçerlidir. Plan dosyaları üretim durum raporu değildir.

Kod inceleme referansı `01c46b5`. Son kayıtlı yayın `qa/latest-release.json` içindedir; uygulama öncesi gerçek main/deployment/DB ledger tekrar ölçülecek.

## 1. Ürün kararı

**Çalışma Alanı**, şirketin BPS'te hangi işleri yürüteceğini belirleyen düzendir. Düzenleme eylemi **Çalışma alanını düzenle**, ayarlardaki bölüm **Modüller** olarak adlandırılır.

Sektör başlangıç önerisi sunar; şirketin çalışma biçimi modülleri belirler. Kullanıcıların mevcut rol ve kayıt yetkileri ayrıca uygulanır. Sektör değiştirmek veri, rol veya modül ayarını kendiliğinden değiştirmez.

Mek Group ve Partner Staff ayrı tenant kalır. Bir müşterinin (`companies`) sektörü ile BPS kullanan şirketin (`tenants`) çalışma alanı farklıdır. Bir bankaya hizmet vermek Mek'i bankacılık yazılımına dönüştürmez.

## 2. Bugünkü ürün ile yapılacak işin ayrımı

Mevcut üründe şirket seçimi/üyelikler, role göre menü, ekip listesi, davetler, operasyon odaklı kurulum rehberi ve günlük iş dağılımı var. Personel, müşteri, görev, belge ve diğer iş modülleri kodda mevcut.

Tenant bazlı modül seçimi, bütün yüzeylerde modül erişim kapısı, birleşik Ekip ve davetler sayfası ve kapsamlı kişisel ayarlar henüz bu planla uygulanmadı. Mevcut bildirim kutusu talep konuşması etiket/yanıtlarını kapsıyor; görev ve duyuru olayları henüz bağlı değil. Mevcut ses sekme bazlı kullanıcı etkinleştirmesi; push veya kalıcı cihaz tercihi değil.

Bu plan mevcut işlevleri yeniden paketler. Yeni sektörlere eksik iş özellikleri kazandırdığımız anlamına gelmez. Finansal Özet tam muhasebe/bordro değildir; Proje Raporlama da genel proje teslimat motoru değildir.

## 3. Ayarların üç etki alanı

| Alan | Kim için? | Giriş | Kapsam |
|---|---|---|---|
| Hesabım | Oturum açan kullanıcı | Sağ üst kullanıcı menüsü | Kendi bilgileri, gerçekten desteklenen tercihler, çıkış |
| Şirket ayarları | Seçili şirketin yetkili yöneticisi | Ana menü → Ayarlar | Genel bilgi, Modüller, Ekip ve davetler, kurulum, ayar geçmişi |
| Platform yönetimi | Ayrı platform admin yetkisi | Yetkili admin alanı | Platform başvuruları ve platform düzeyi işler |

Şirket ayarlarının üstünde şirket adı ve etki kapsamı görünür. Şirket seçimi değişince eski form yeni şirkete kaydedilemez. Şirket yöneticisi olmak platform yöneticiliği vermez.

### Önerilen gezinme

```text
Ana menü
  Genel Bakış                  ← etkin ve yetkili modüllerin kartları
  İş modülleri                 ← şirket seçimi × kullanıcı yetkisi
  Şirket Yönetimi               ← günlük iş dağılımı; ayar ekranı değil
  Ayarlar
    Genel
    Modüller                   ← Çalışma alanını düzenle
    Ekip ve davetler
    Kurulum rehberi             ← mevcut /kurulum akışına tek giriş
    Değişiklik geçmişi          ← yalnız audit kapsamı hazır olduğunda

Kullanıcı menüsü
  Hesabım
  Şirket değiştir
  Çıkış
  Platform yönetimi             ← yalnız ayrı yetki varsa
```

Bu ağaç bütün kullanıcıların her öğeyi göreceği anlamına gelmez. Yapılmamış işlev için boş kategori açılmaz. Masaüstünde dar bölüm listesi; mobilde taşmayan bölüm seçimi ve büyük temel kontroller. URL, geri tuşu ve yenileme doğru bölümü korur.

## 4. On seçilebilir iş modülü

| Modül | Sağladığı iş | V1 sınırı |
|---|---|---|
| Müşteriler | Firma/iletişim ve ilişkili iş kayıtları | Tenant şirket ayarıyla aynı kayıt değil |
| Görevler | Bağımsız veya ilişkili iş, üstlenme, devir, tamamlama | Firma zorunlu değil |
| Takvim ve görüşmeler | Randevu ve sonuçlar | Mevcut firma bağı sürer; genel kişisel takvim vaat edilmez |
| Belgeler | Firma evrakları ve klasörler | Aday eki/rapor kaynağı kendi modülünün verisi |
| Sözleşmeler | Anlaşma, ekler, yenileme | Müşteri/belge bağımlılığı |
| Personel havuzu | Aday/personel, filtre, görüşme, ekler, Excel | Günlük operasyon olmadan kullanılabilir olmalı |
| Personel operasyonu | Talep, atama, İDP/sabit/dönemsel, teyit ve çalışma takibi | Alt akışlar ayrı ürün yapılmaz |
| Proje raporlama | Dışarıda yürüyen işlerin dönem ve gerçekleşme raporu | Günlük personel talebi zorunlu olmamalı |
| Finansal özet | Firma mali özetleri ve Luca aktarımı | Tam muhasebe/proje kârlılığı değil |
| Duyurular | Şirket içi duyuru | Hedefleme/okundu geliştirmeleri ayrı backlog |

Ortak altyapı: kimlik, tenant, üyelik, kayıt geçmişi, kişi/şube çekirdeği, dosya mekanizması, bildirim kabuğu. Açık altyapı herkese geniş veri erişimi vermez. Dashboard ve rapor kataloğu bağımsız satılacak modül değil, açık işlerin ortak görünümüdür.

İDP/sabit/dönemsel tercihler ilk sürümde operasyon UX düzenidir; ayrı güvenlik kapısı gibi sunulmaz. Yetkiyi kısıtlayan bir alt modül haline getirilecekse ayrıca backend politikası gerekir.

## 5. Benchmarklardan alınan kararlar

Resmi dokümanlardan doğrulanan davranışlar; hesap içi uçtan uca ürün testi veya şirketlerin özel kod incelemesi değildir.

| Kaynak | Gözlenen yaklaşım | BPS kararı |
|---|---|---|
| [ClickUp ayarlar](https://help.clickup.com/hc/en-us/articles/10853931837335-Workspace-and-account-settings) | Kişisel hesap ve workspace ayarları ayrı; People üyelik işlerini topluyor | Hesabım ayrımı; ekip/davet tek bölüm |
| [Notion ayarlar](https://www.notion.com/help/workspace-settings) | Arama ayarın yerini gösteriyor; sonuçlar erişime göre sınırlı | Ayarlar büyürse izin filtreli arama; şimdi az sayıda net başlık |
| [Connecteam izinler](https://help.connecteam.com/en/articles/1981698-admin-permissions) | Yönetici izinleri özellik/varlık bazında düzenlenebiliyor | Modül seçimi yetki ataması değildir; V1'e dev yetki editörü ekleme |
| [Business Central deneyim](https://learn.microsoft.com/en-us/dynamics365/business-central/ui-experiences) | Şirket özellik kapsamı, kullanıcı izinleri ve kişiselleştirme ayrılıyor | Şirket düzeni + mevcut rol + kişisel tercih ayrımı |
| [Jira feature API](https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-project-features/) | State, prerequisites, toggleLocked gibi alanlar | Anahtarın neden değiştirilemediğini açıklayan backend sonucu |
| [Jira kapatma](https://support.atlassian.com/jira-software-cloud/docs/enable-the-development-feature/) | Development kapatma bazı diğer yüzeylerdeki bilgiyi kaldırmıyor | BPS'te görünüm gizleme ve iş modülü kapatma açıkça farklı |
| [Frappe workspace](https://docs.frappe.io/framework/user/en/desk/workspace/access) | Workspace görünürlüğü modül/rolle ilişkilendiriliyor | Kart/menu görünürlüğü rol ve modülün kesişimi |
| [Zoho yönetici kapsamları](https://help.zoho.com/portal/en/kb/one/admin-guide/admins/articles/zohoone-assign-admins) | Farklı idari kapsamlar | Şirket ile platform yönetimini ayır |
| [Connecteam paketler](https://help.connecteam.com/en/articles/608571-what-are-the-costs-of-the-platform) | Anlamlı işlev grupları seçilebiliyor | Her düğmeyi modül yapma |

Teknik dayanaklar ve detaylı kaynaklar teknik v2 belgesinde: Unleash/OpenFeature bağlam ayrımı, PostgreSQL RLS/kilit davranışı, AWS dış teslim tutarlılığı. Bu ürünlerin lisans, altyapı veya özellik listesini bütünüyle BPS'e taşımıyoruz.

## 6. Kullanıcı yolculukları

### Yeni şirket

“Hangi işleri burada takip edeceksiniz?” → sektör/çalışma biçimine uygun öneri → seçimleri düzenle → menü önizlemesi → çalışma alanını oluştur → ilk gerçek iş. Örnek iş verisi otomatik yaratılmaz.

### Mevcut şirkette düzenleme

Ayarlar → Modüller → değişiklikleri seç → fark/önkoşul/açık iş özeti → Kaydet. Kontroller kayıt anında tekrar yapılır. Şablon değişimi önce fark üretir; önceki özel seçimleri sessizce ezmez.

### Ekip üyesi ekleme

Ayarlar → Ekip ve davetler. Mevcut üyeler ve bekleyen davetler aynı bölümde ama durumları ayrı. Davet etme, rol değiştirme ve üyelik kaldırma yetkileri mevcut backend sınırına göre gösterilir. Sayfa taşımak daha geniş yetki verme gerekçesi değildir. Havuzdaki personel ile uygulama kullanıcısı ayrı anlatılır.

### Günlük yönetim

İş atama/devir/tamamlama iş ekranında; Ayarlar'da değil. Yönetici ekip dağılımını, operasyon çalışanı ilgili günlük işleri görür. Kart sırası deterministik; algoritma her girişte menüyü oynatmaz.

### Kapalı modüle eski bağlantı

“Bu modül seçili şirkette kullanılmıyor.” Yöneticiye Modüller bağlantısı, diğer kullanıcıya Genel Bakış. Kapalı kaynak adı/içeriği/finans kolonları başka karttan sızmaz. Önceden alınmış dosya geri alınamaz; signed URL süre sınırı belgelenir.

## 7. Sabit kullanıcı sözleşmeleri

- Kısayol gizlemek kişisel görünüm; modül kapatmak şirket iş erişimi; veri silmek ayrı işlem. V1 modül ekranında veri silme yok.
- Modül kapatıldığında veri korunur. Açık iş veya bağımlılık varsa kapatma engellenir; çözüm bağlantısı verilir.
- Geçmişe normal erişim için modül yeniden açılır. Ayrı arşiv okuma rolü V1'de yok.
- Yeniden açma kaçırılan bildirimleri toplu göndermeyi tetiklemez.
- Modül açık ve henüz boş olabilir. “Henüz kayıt yok” ile “erişim yok” ve “yükleme hatası” farklı.
- Veri alınamadığında boş/default değerle üzerine yazma, sahte sıfır veya sahte başarı yok.
- Basit formda Kaydet/Vazgeç; etkili modül değişiminde önizleme. Gereksiz her tıkta onay yok.
- Ayarlar ve tercih isimleri mevcut yeteneği doğru anlatır; push, MFA, otomatik entegrasyon veya kalıcı ses hazır değilse hazır gibi gösterilmez.

## 8. Teknik omurga

1. Tek kod tabanı ve Supabase/PostgreSQL korunur.
2. Tek tipli modül kataloğu; `requires` zorunlu, `enhances` isteğe bağlı katkı; ortak altyapı ayrı.
3. Config/settings/change-receipt tabloları; son tarihli migration'lar uygulama anında atanır. Geçmiş migration değiştirilmez.
4. actor/tenant/role/üyelik ve seçim generation/config revision tek doğrulanmış bootstrap. UI sonucu mutasyon yetkisi değildir.
5. schemaVersion, catalogVersion ve tenant configRevision ayrı. Eski istemciye desteklenen protokol yanıtı.
6. İş yazma ve kapatma aynı config kilidi protokolünü kullanır; READ COMMITTED altında kilit sonrası durum tekrar okunur. Dönüştürülmeyen direct DML varsa kapatma açılmaz.
7. RLS, SECURITY DEFINER, storage, export, service-role cron ve paylaşılan tablo projeksiyonları denetlenir. Sadece menü gizlenmez.
8. Şirket modülü açmak rol yükseltmez. Müşteriler açık/Finans kapalı örneğinde mali kolonlar dar view/RPC/izin tasarımıyla korunur.
9. Aynı DB'deki iş ve uygulama bildirimi atomik yazılabilir. Dış teslim outbox/lease yalnız ihtiyaç duyulduğunda M6'da; mevcut email stamp-first sınırı körlemesine kopyalanmaz.
10. Anahtar/üyelik değişiminde cache kapsamı yenilenir; eski tenant sonucu gösterilmez. Modül revision değişimi kaydedilmemiş bütün formları gereksiz unmount etmez.

Ayarlar için tek sınırsız JSON patch endpoint yok. Hesap tercihi, tenant ayarı, üyelik ve platform başvuruları ayrı yetkili komutlar. Ham secret hiçbir ayar yanıtında yer almaz.

## 9. Birleştirilmiş uygulama sırası

İki ayrı S/M backlog yerine aşağıdaki sıra kullanılır. Eski belgelerdeki S ve M kodları kaynak işlerin izlenmesi içindir.

| Paket | Teslim | Bağımlılık / yayın sınırı |
|---|---|---|
| A — Gerçek erişim haritası | Ekran/action/RPC/table/storage/cron eşlemesi; roller ve paylaşılan alanlar | M0; prod schema/ledger salt okunur ölçülmeden bitmez |
| B — Ayarları toparla | Ekip+davet tek yer, platform başvuruları ayrımı, günlük işlerin doğru bağlantıları | S1; mevcut yetkiyi değiştirmeden ayrı küçük yayın mümkün |
| C — Modül altyapısı | Katalog, config, bootstrap, audit/receipt, backfill | M1; mevcut tenant davranışı korunur, kullanıcı kapatma yok |
| D — Erişim ve bağımlılıklar | RLS/RPC/DML/storage/cron kapıları, kişi/şube/finans projeksiyonları | M2; atlatılabilir eski yol kalmayacak |
| E — Çalışma alanını düzenle | Modüller ekranı, önizleme, kurulum, dinamik menü/mobil/dashboard/rapor | M3 + S2; D tamamlanmadan kapatma açılmaz |
| F — Kişisel tercihler ve kabul | Desteklenen Hesabım, tutarlı formlar, audit yüzeyi, operasyon kombinasyonları | S3/S4 + M4; yeni auth/teslim özellikleri ayrı |
| G — Kontrollü yayın | CI, migration pre/postcheck, exact SHA, kimlikli smoke, rollback | M5; modül-aware rollback, veri silme yok |
| H — Bildirim devamı | Görev/duyuru kaynaklarını bağlama; gerekiyorsa dış teslim modeli | M6; modülerleştirme bitti diye bildirim backlog'u kapanmaz |

Araştırma artık işin yönünü seçmek için yeterli; yeni benchmark yalnız açık bir kararı çözecekse eklenir. Sonraki teknik çalışma A paketinin ölçümleridir. Süre tahmini direct DML/RPC haritası çıkınca yapılır; belirsiz kapsam için kesin gün taahhüdü yok.

## 10. Kabul ve kanıt

Mevcut belgelerde tanımlı T01–T38 teknik senaryo korunur. Ayarlar araştırmasındaki 12 kullanıcı/erişim senaryosu ve v3 ürün görevleri bu sete bağlıdır; toplamlarını test başarısı diye sunmayız, henüz çalıştırılmadılar.

Öncelikli uçtan uca senaryolar:
- Personel operasyonu olmayan genel şirket: personel terimi/kartı/sorgusu yok; ekip işleri çalışıyor.
- Mek/Partner: ayrı tenant, farklı seçenek, aynı kullanıcının eşzamanlı sekmelerinde sızıntı yok.
- Havuz-only ve reporting-only: ortak kişi/şube altyapısı çalışıyor, kapalı modülün özel verisi görünmüyor.
- Modül kapatma + eşzamanlı yazma; iki yönetici; eski form; belirsiz ağ sonucu; yeniden açma.
- Davet/üyelik/platform yetkilerinin taşınma sonrası genişlememesi.
- Mobil ve klavye ile ayar bulma, hatayı düzeltme, kaydetme; taslak korunması.

Performans: etkin olmayan modülün iş sorguları sıfır; ortak altyapı ayrı ölçülür. Config bootstrap tek scoped okuma; mutasyon denetimi DB'de. Büyük sentetik veri, lock beklemeleri, p95 ve egress baz sürümle karşılaştırılır. İnsan kullanılabilirlik testi yapılmış gibi raporlanmaz.

## 11. Kesinleştirilmesi gereken teknik ölçümler

Bunlar ürün yönünü tekrar tartışmak için değil, A paketinin uygulama girdileridir:

- Güncel production SQL tanımları/grants/policies ile repo eşleşiyor mu?
- Hangi mutasyonlar direct DML; hangi fonksiyonlar ortak kilit sırasına taşınmalı?
- Üyelik değişiminde son yönetici/açık iş kuralları tam olarak nerede uygulanıyor?
- Kişi/şube/firma üzerindeki ortak alanlar hangi modüle hangi projeksiyonla dönmeli?
- Kapatma engellerinin gerçek enum ve indeksleri; yarım import/upload kurtarma koşulları.
- Genel şirket adı/hesap adı düzenlemede mevcut backend var mı; yoksa ayrı dar komut ihtiyacı.

Mevcut prod verileri tam içerik yedeği bu araştırmanın parçası değil. Önceki yedek istememe tercihi geçerli; şema ölçümü ve sentetik testler bununla karıştırılmaz.

## 12. Sonraya bırakılanlar

Şube/ekip bazlı modül override, kişisel dashboard editörü, abonelik/lisans motoru, özel rol tasarımcısı, kapalı modül arşiv yetkisi, draining durumu, yeni auth güvenlik ekranları, otomatik entegrasyon kataloğu. Gerçek ihtiyaç ve güvenli backend olmadan boş düğme eklenmez.

## 13. Ayrıntı ve kanıt dizini

- [Mevcut modül envanteri](../qa/modular-saas-20260928/modul-envanteri-ve-sektor-plani.md)
- [Detaylı uygulama planı ve T01–T26](../qa/modular-saas-20260928/uygulama-plani.md)
- [Teknik v2 ve T27–T38](../qa/modular-saas-20260928/teknik-mimari-v2.md)
- [Yeni ürün benchmarkları v3](../qa/modular-saas-20260928/benchmark-karar-ekleri-v3.md)
- [Ayarlar benchmarkı ve kabul senaryoları](../qa/settings-benchmark-20260928/ayarlar-arastirma-ve-plan.md)

Planın ilk birleştirme turunda yalnız dokümanlar güncellendi. Ürün kodu, kullanıcı tercihleri, yetkiler, DB veya deployment değiştirilmedi.


## Uygulama kaydı — 28 Eylül 2026, ilk modül paketi

Plan uygulamaya alındı. İzole dal: `codex/tenant-modules-foundation-20260928`; çalışma klasörü `/Users/furkanyahsi/.codex/worktrees/bps-tenant-modules/BPS`.

- M0 statik erişim envanteri: 452 TS/TSX, 47 page/route, 332 veri erişim çağrı adayı; altı dinamik hedef manuel eşlendi. Üretim catalog/grant/policy karşılaştırması henüz yapılmadı; M0 tamamen kapalı değil.
- M1: on modülün kataloğu, bağımlılık doğrulaması, üç tablo, mevcut/yeni tenant başlangıcı, bootstrap audit'i ve `current_workspace_modules_v1()` okuyucusu kodlandı.
- `20260928000900_tenant_module_foundation.sql` yerel adaydır; **üretime uygulanmadı**. Modül kapatma mutasyonu, business erişim kapıları ve kullanıcı ekranı henüz açılmadı.
- Mevcut roller, shell/menu, kimlik RPC'si ve üretim davranışı değişmedi.
- Uygulama sonucu ve test kanıtları: çalışma dalındaki `qa/tenant-modules-foundation-20260928/README.md`.
- Sıradaki blok M2: ortak veri projeksiyonları, direct DML/RPC/RLS/storage/export/cron kapıları ve ayar değiştirme kilit protokolü. Bu bitmeden modül kapatma yok.
