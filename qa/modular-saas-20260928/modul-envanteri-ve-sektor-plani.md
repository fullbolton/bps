# BPS modül envanteri ve sektöre göre yapılandırma

> Birleştirilmiş ana karar ve uygulama sırası: [Çalışma Alanı ve Ayarlar ana planı](../../01_product/CALISMA_ALANI_VE_AYARLAR_ANA_PLANI.md). Bu dosya ayrıntı/araştırma eki olarak korunur.


Tarih: 28 Eylül 2026. Durum: araştırma ve tasarım önerisi; ürün/DB değişikliği yapılmadı.
Kod referansı: canlıya yayımlanan `01c46b561ee20263a82331067ffda6f7b13c8cb6`, inceleme dizini `/private/tmp/bps-notification-inbox-20260928`. Kirli ana çalışma klasörü ürün gerçekliği olarak kullanılmadı. Envanter kodda bulunan ekran ve akışları gösterir; bu çalışma tüm modülleri yeniden canlı smoke testten geçirdiğimiz anlamına gelmez.

## 1. Karar önerisi

Evet: tek kod tabanı ve tenant başına seçilen modüller. Sektör seçimi sadece başlangıç önerisi olsun; yetki veya değişmez paket olmasın. Aynı sektördeki iki şirket farklı iş yapabilir. Özellikle bir otelin kendi yönetimi ile otellere personel gönderen Partner Staff aynı ürün kurulumu değildir.

Üç ayrı kavram:

1. **Sektör:** Şirketin iş alanını anlatır; önerileri etkiler.
2. **Çalışma biçimi:** Personel gönderme, sabit kadro, dışarıda yürüyen işi raporlama, müşteri/ekip işi takip etme gibi gerçek ihtiyaç.
3. **Etkin modüller:** Bu tenantta hangi iş akışlarının kullanılacağı. Kullanıcının mevcut rol ve kayıt yetkileri ayrıca uygulanır.

Mek Group ve Partner Staff farklı tenant olarak kalır. Modül seçimi verileri birleştirmez. `companies` içindeki müşteri firmanın sektörü, BPS kullanan tenantın modül seçimi değildir. VakıfBank'ın bankacılık sektöründe olması Mek'in personel operasyonunu kapatmamalıdır.

Önce şirket yönetimi + personel hizmetleri ekseninde modülerleşelim. Genel amaçlı ERP olduğumuzu söylemeyelim: stok, üretim, bordro, e-fatura, lojistik sevkiyat gibi alanları sektör seçerek var etmiş olmayız.

## 2. Mevcut özellik envanteri

Aşağıdaki gruplar önerilen ürün sınırlarıdır; bugünkü veritabanının zaten bağımsız modüllere ayrıldığı iddiası değildir.

| Alan | Kodda mevcut kapsam | Başlıca ekran/kaynak | Modüler yapıdaki yeri |
|---|---|---|---|
| Çalışma alanı ve erişim | Şirket seçimi, üyelik, davet, rol, platform başvuruları | `/sirket-sec`, `/kurulum`, `/davet`, `/ayarlar`, `/admin` | Zorunlu altyapı; platform admin ayrı |
| Genel bakış | Firma/sözleşme/görev/randevu sayıları, operasyon, iş dağılımı, evrak, duyuru, aktivite | `/dashboard` | Etkin modüllerden oluşan ortak kabuk |
| Müşteri ve firma kayıtları | Firma kartı, ilişkili kayıtlar, iletişim ve notlar | `/firmalar`, `/firmalar/[id]` | Müşteriler |
| Görevler | Firma bağlantılı veya bağımsız iş, üstlenme, atama/devir, durum, son tarih | `/gorevler`, `services/tasks.ts` | Bağımsız seçilebilir ekip işleri |
| Yönetim görünümü | Kimde ne iş var, sorumlu/tarih filtreleri, yönetim bağlantıları | `/yonetim` | Ayrı satın alınacak modül değil; yetkili görünüm |
| Randevular | Görüşme planı, takvim ve sonuç, ilişkili kayıt/görev akışları | `/randevular` | Takvim ve görüşmeler |
| Evraklar | Yükleme, gruplar/klasörler, firma ve sözleşme bağları, geçerlilik | `/evraklar`, `document-folders.ts` | Belgeler |
| Sözleşmeler | Anlaşma, dönem, belge/ek protokol ve yenileme akışları | `/sozlesmeler`, `/sozlesmeler/[id]` | Sözleşmeler |
| Personel havuzu | Liste/filtre/detay, düzenleme, uygunluk, görüşmeler, fotoğraf/ekler, birleştirme | `/personel-havuzu`, `PersonDetailPanel.tsx` | Aday ve personel havuzu |
| Havuz listeleri | Kayıtlı aramalar, paylaşılan görünümler, arama listeleri | `/personel-havuzu/listeler`, `SavedSearches.tsx`, `SharedViews.tsx` | Havuzun alt özellikleri |
| Havuz aktarımı | Excel önizleme, karşılaştırma/karar, aktarım geçmişi ve geri alma, dışa aktarım | `/personel-havuzu/aktarim`, `src/lib/talent/*` | Havuzun alt özelliği; bağımsız genel aktarım motoru değil |
| Personel talepleri | Talep ve günlük plan, şube/personel dizini, görevlendirme | `/talepler`, `/talepler/gunluk`, `/talepler/dizin` | Personel operasyonu |
| İşe başlama | Arama/teyit, işe varış ve takip | `/talepler/ise-baslama` | Personel operasyonunun alt özelliği |
| Yedek ve çalışma onayı | Yedek arama ve çalışma onayı servis/akışları | `services/replacement-outreach.ts`, `services/work-approval.ts`, `/talepler/kontrol` | Personel operasyonunun alt özellikleri |
| Sabit kadro ve planlar | Kadro, vardiya, tekrarlayan planlar | `/talepler/kadro`, `/talepler/planlar`, `services/fixed-roster.ts`, `services/recurring-schedules.ts` | İlk etapta operasyon içinde açılan çalışma biçimleri |
| İş gücü ve haftalık görünüm | Aktif iş gücü, haftalık özet, önceki kayıt raporları | `/aktif-isgucu`, `/talepler/haftalik`, `/raporlar` | İlgili operasyon modülüne bağlı görünümler |
| Proje raporlama | Müşteri projesi, dönem, dış gerçekleşme Excel/CSV aktarımı, kayıt/aylık rapor, kaynak dosya | `/projeler`, `/projeler/[id]/aktarim`, `/projeler/[id]/rapor` | Dışarıda yürüyen projelerin raporlaması |
| Finansal özet | Firma alacakları, kaydedilmiş mali özet, Luca mizan aktarımı | `/finansal-ozet`, `/luca-import` | Finansal görünürlük; tam muhasebe değil |
| Kurumsal tarihler | Tarih/hatırlatma kayıtları | `/kurumsal-tarihler` | Takvim veya müşteriler içinde alt özellik |
| İletişim | Temel duyurular, talep konuşmaları, etiket/yanıtlar, Bana gelenler ve isteğe bağlı ses | dashboard, `components/communication/*` | Ortak iletişim yüzeyi; olay kaynakları modüllere bağlı |
| Raporlar | Sözleşme bitişleri, randevu sonuçları, önceki talep/iş gücü ve haftalık özet bağlantıları | `/raporlar/ReportsClient.tsx` | Etkin modüllerin rapor kataloğu |
| Genel aktarım | Mevcut firma/veri aktarım ekranı | `/import` | İlgili verinin modülüne bağlı araç |

### Sınırları açık yazalım

- Finansal ekranda proje bazlı gelir/maaş/masraf dağılımı ve proje kârlılığı henüz kullanıma açık değil; Luca akışı firma alacağı içindir. Proje raporlamasının varlığı bu hesabı tamamlamaz.
- Raporlarda Partner Özeti kullanıma kapalı olarak tanımlı.
- Son yayınlanan bildirim kutusu yalnız talep konuşması etiket/yanıtları; görev atama ve duyuru olayları henüz bağlı değil. Görünür sekmede 30 saniye kontrol; kapalı uygulamaya push değil.
- Sektör şablonları mevcut ancak servis açıklaması V1 salt okunur katalog diyor. Modül açma/kapama motoru değil.
- `/talepler/ise-baslama/onizleme` ayrı bir iş modülü sayılmaz.
- BPS'e giriş yapan ekip üyesi ile havuzdaki aday/personel aynı kimlik ve erişim modeli değildir.

## 3. Benchmark: neyi alıyoruz, neyi almıyoruz?

28 Eylül 2026 tarihinde resmi ürün/destek dokümanları incelendi. Ücretli hesapların bütün arayüzlerinde uygulamalı test yapılmadı; aşağıdaki davranışlar dokümana dayanır. BPS önerileri bizim çıkarımımızdır.

| Ürün | Dokümanda doğrulanan yaklaşım | BPS'e çıkarım |
|---|---|---|
| Connecteam | Operations, Communication, HR olmak üzere üç hub; biri, ikisi veya üçü seçilebiliyor | Kullanıcıya anlamlı iş paketleri sun; her küçük düğmeyi modül yapma |
| ClickUp | ClickApps özellikleri çalışma alanı veya desteklenen özelliklerde Space bazında açılıyor; yönetici/sahip yönetiyor | Şirketin ihtiyacına göre ekranı sadeleştir; ilk BPS sürümünde tenant düzeyi yeterli |
| Zoho One | Uygulamalar yönetim panelinden kullanıcılara atanabiliyor | Şirketin modüle sahip olması ile kişinin erişim hakkını ayır |
| Bitrix24 | Proje, görev/dosya/görüşme/sohbeti bir iş bağlamında topluyor | Ayrı uygulamalara savurmadan ortak kayıt bağlantılarını koru; bu üründeki her aracı BPS'e taşıma |

Kaynaklar:
- [Connecteam hub seçimi](https://help.connecteam.com/en/articles/608571-what-are-the-costs-of-the-platform)
- [ClickUp ClickApps](https://help.clickup.com/hc/en-us/articles/6304327753111-Intro-to-ClickApps)
- [Zoho One uygulama atama](https://help.zoho.com/portal/en/kb/one/admin-guide/applications/managing-applications/articles/zohoone-assign-app-individually)
- [Bitrix24 proje çalışma alanı](https://helpdesk.bitrix24.com/open/25991003/)

Odoo Apps/Modules dokümanı aramada bulundu ancak doğrudan sayfa erişimleri zaman aşımına uğradı; kaldırma/veri silme davranışına ilişkin doğrulanmamış iddia bu karara dayanak yapılmadı.

## 4. Önerilen ürün paketleri

**Temel altyapı (kapatılmaz):** oturum, tenant, ekip/yetki, ayarlar, kayıt geçmişi, navigasyon, bildirim altyapısı. Bu altyapının görünür kartları yalnız etkin işlerden oluşur.

**Seçilebilir iş modülleri:** Müşteriler, Görevler, Takvim, Belgeler, Sözleşmeler, Personel Havuzu, Personel Operasyonu, Proje Raporlama, Finansal Özet, Duyurular. On modül ilk katalog için yeterli. Duyuruların bugünkü sınırlı yapısı açıkça etiketlenir.

İşe başlama, yedek bulma, vardiya, İDP ve sabit kadro ilk etapta Personel Operasyonu altındaki seçeneklerdir. Excel aktarımı, filtre ve dışa aktarım kendi modülünün aracıdır. Dashboard, yönetici görünümü ve raporlar ayrıca açılacak üç ayrı ürün değildir.

| Başlangıç şablonu | Önerilen modüller | Varsayılan kapalı/isteğe bağlı |
|---|---|---|
| Genel ekip ve müşteri yönetimi | Müşteriler, Görevler, Takvim, Belgeler, Duyurular | Havuz, personel operasyonu; sözleşme/finans ihtiyaca göre |
| Mek: İDP ve sabit personel hizmeti | Müşteriler, Havuz, Operasyon (İDP/sabit), Görevler, Belgeler, Sözleşmeler, Takvim, Proje Raporlama | Finans ve duyurular şirket tercihine göre |
| Partner Staff: otel/dönemsel personel | Müşteriler, Havuz, Operasyon (günlük/dönemsel), İşe başlama, Görevler, Belgeler, Sözleşmeler | Sabit kadro/İDP yalnız gerekiyorsa |
| Dışarıda yürütülen hizmeti raporlama | Müşteriler, Proje Raporlama, Belgeler, Sözleşmeler, Görevler | Günlük personel talebi, havuz, arama/teyit |
| Danışmanlık/ajans başlangıcı | Müşteriler, Görevler, Takvim, Belgeler, Sözleşmeler | Personel operasyonu; mevcut proje raporu ajans teslimat yönetimine eşit değildir |

Bunlar önerilen seçimlerdir; mevcut tenantlara otomatik uygulanmayacak. Yeni sektöre paket sunmadan en az bir gerçek çalışma senaryosu ile doğrulanmalı. Örneğin üretim firması BPS'i ekip işleri için kullanabilir; üretim planlama yazılımı olarak sunulamaz.

## 5. Kurulum ve günlük kullanım UX'i

Yeni şirketin kuruluşunda: “Hangi işleri burada yöneteceksiniz?” sorusu. Çoklu seçim: müşteri ilişkileri, ekip işleri, personel görevlendirme, personel havuzu, proje raporlama, belge/sözleşme, mali özet. Sektör bilgisi önerileri önden seçebilir; kullanıcı düzeltebilir.

İkinci adım yalnız ilgili ayrıntılar: personel görevlendirme seçildiyse İDP/sabit/dönemsel çalışma biçimleri. Seçilmediyse şube/personel/teyit soruları hiç çıkmaz.

Üçüncü adım: oluşacak menünün kısa önizlemesi ve “Bu düzenle başla”. İlk kurulumda onlarca teknik anahtar sunulmaz.

Mevcut şirkette **Ayarlar → Modüller**: bir satırda modül adı, hangi işe yaradığı, etkin durumu, gerekli diğer modüller. Değişiklikler topluca gözden geçirilip kaydedilir. Personel görevlendirmesi yapmayan şirkete “0 personel açığı” kartı gösterilmez; kart ve sorgusu hiç oluşmaz.

Ana ekran ortak adı “Genel Bakış” kalır. Örneğin genel ekip şablonunda Günün işleri, Kimde ne iş var, Görüşmeler, Son kayıtlar, Duyurular görünür. Mek'te operasyon/işe başlama eklenir. Kullanıcıya kişi performans puanı veya süreye bağlı yönetici bildirimi eklenmez.

Mobil alt menü aynı modül kataloğundan üretilir: genel ekip için İşler/Takvim/Müşteriler; personel operasyonunda İşler/Günlük plan/İşe başlama/Personel. Yetkisiz veya kapalı modül için boş sekme olmaz. Yetkiler daraldığında sabit dört ikon doldurmaya çalışmayız.

## 6. Bağımlılık ve veri yaşam döngüsü

- Sözleşmeler müşteri ve belge altyapısını kullanır. Gerekli modül kapalıysa hangi bağımlılığın açılacağı önceden gösterilir; sessizce açılmaz.
- Görevler bağımsız çalışabilmeli. Müşteri/sözleşme/randevu bağları isteğe bağlı ek bağlamdır. Bir bağlı modül kapandığında görev silinmez; erişim politikasına göre ilgili bağlantı kaldırılır veya geçmiş etiketi kalır.
- Havuz tek başına aday takibi için çalışabilmeli. Görevlendirme/uygunluk birleşimi gibi çapraz görünümler operasyon varsa eklenir.
- Personel operasyonunun kişi/şube dizini ve havuz eşlemesi bugün incelenip kesinleştirilmeli; havuzu gelişigüzel zorunlu ilan etmeyelim. Operasyonun temel kişi dizini altyapısı ile zengin aday yönetimi ekranı ayrı sınır olabilir.
- Proje raporlama günlük talep açılmadan kullanılabilmeli. Müşteri/proje/dönem kayıtları gerekir; aynı veriyi günlük planda tekrar yaratmaz.
- Finansal özet müşteri/mali kayda dayanır; havuz veya personel operasyonu gerektirmez.
- Raporlar ve etkinlik akışı yalnız etkin ve yetkili kaynakları sorgular. Duyuru açılması başka tenant veya başka modül verisini görünür yapmaz.

**Kapatma silme değildir.** İlk sürümde çalışan ve geçmiş verisi bulunan modülü tek tıkla kapatmak yerine etki özeti gösterelim. Açık iş/atama/plan veya etkin bağımlılık varsa kapatma engellensin ve kullanıcı çözüm ekranına gitsin. İşler çözüldükten sonra modül kapalı yapılır; tablolar ve tarihçe tutulur, normal okuma/yazma/görev üretimi durur. Yeniden açıldığında veriler korunur, kaçırılan otomasyonlar kendiliğinden topluca çalıştırılmaz.

Geçmişi okuyabilme gerekiyorsa ayrıca açıkça tanımlanmış “Arşiv erişimi” tasarlanır; bu yetki kapalı modülün normal API'sini serbest bırakmaz. İlk sürümde ayrı arşiv özelliği yoksa geçmişi görmek için yeniden etkinleştirme gerekir. Veri silme ayrı işlem ve ayrı onaydır.

## 7. Kod ve Supabase tasarımı

Mevcut bulgular:
- `src/components/shell/Sidebar.tsx`: `MENU_ITEMS` sabit ve rol filtresi var; modül kontrolü yok.
- `MobileOperationsNav.tsx`: role ve global dailyEnabled'a göre operasyon bağlantıları kuruyor.
- `Layout.tsx`: günlük operasyon için ortam değişkeni kullanıyor. Ortam değişkeni tenant seçimi değildir.
- `Topbar.tsx`: konuşma kutusu global feature flag'e bağlı.
- `WorkspaceIdentity`: şu an actorId, tenantId, name; modül ayarı taşımaz.
- `ManagementBoard.tsx`: şube/personel, sözleşme, evrak, finans bağlantıları sabit.
- `sector-templates.ts`: salt okunur referans kataloğu; şirket modül yetkisi sağlamaz.
- `project-reporting/view.ts`: proje türleri İDP/sabit/otel/diğer; sırf metin değiştirerek genel proje teslimat sistemi olmaz.

Önerilen en küçük yapı:

1. Kodda tek bir tipli **modül kataloğu**: sabit anahtar, ad, rota grubu, bağımlılık, ana ekran/mobil katkısı. Keyfi eklenti veya kullanıcı kodu çalıştırma yok.
2. Supabase'te **tenant_module_settings** benzeri tablo: tenant_id + module_key eşsiz, enabled, revision, değiştiren ve tarih. Tenantın sektör/şablon tercihi ayrıca tutulur. Kesin isimler migration tasarımında doğrulanır.
3. Modül ayarını değiştiren atomik RPC: canlı üyelik/yönetici denetimi, bilinen modül anahtarı, bağımlılık, açık işler, revision denetimi ve denetim kaydı. Eşzamanlı modül kapatma/yazma işlemleri aynı kilit düzenine uymalı; salt UI ön kontrol yeterli değildir.
4. Sunucuda aynı tenant için etkin modülleri okuyan ortak yardımcı; UI'ya yalnız gerekli kapsam ve revision verilir. Bilgi alınamıyorsa bütün modüller açık varsayılmaz; kısa hata/yeniden dene görünür.
5. **Erişim = etkin modül + mevcut tenant üyeliği + mevcut rol/kayıt izni.** Modül açmak rolü yükseltmez. Rol değişikliği ve modül ayarı ayrı işlemlerdir.
6. Route/server action kontrollerinin yanında doğrudan Supabase tablo erişimleri, RPC/SECURITY DEFINER fonksiyonları, storage link üretimi ve arka plan görevleri de sınırlandırılır. Yalnız menü veya Next middleware kontrolü güvenlik sınırı değildir.
7. Ortak tabloları körlemesine tek modüle bağlamayız: müşteri/kişi/belge altyapısının birden çok tüketicisi olabilir. Hangi işleme hangi yetkinin gerektiği erişim matrisi ile yazılır.
8. Şirket değişiminde modül ayarı, menü, veri ve taslak kapsamı birlikte sıfırlanır. Revision değişiminde eski sekme yenilenir; sunucu yazma kontrolü her çağrıda yapılır. Kullanıcı/tenant ayrımı olmayan global cache kullanılmaz.
9. Kapalı modül sorgu, otomasyon, bildirim sesi ve arama sonucuna katkı üretmez. Service-role kullanan işler RLS atlayabildiği için ayrıca modül kontrol eder. Daha önce verilmiş imzalı belge bağlantısı süresi dolana kadar yaşayabilir; “kapatınca geçmiş URL anında iptal olur” garantisi verilmez.
10. Global yayın flag'leri kademeli sürüm açmak için kalabilir, tenant ayarının yerini tutmaz. Ücretli plan/kota ayrı bir gelecekteki katmandır; bu iş için ödeme sistemi kurmayız.

Supabase değiştirmek veya her sektör için ayrı backend/repo kurmak gerekmez. Aynı şema ve SQL migration'ları üzerinde tenant kapsamlı yapı yeterli; yalnız veri ve izin sınırları tutarlı uygulanmalı.

## 8. Uygulama sırası ve kabul ölçütleri

### Paket A — sınırları kesinleştir ve davranışı koru

Her ekran/RPC/tablo/cron/storage tüketicisini katalogdaki modüle eşle; paylaşılan altyapıyı işaretle. Mevcut iki tenantın bugünkü modüllerini açık olarak açıkça backfill et. Eksik ayar satırı “her şey açık” anlamına gelmesin. Yeni tenant genel başlangıç şablonunu seçer. Önce yapılandırma okumasını gölge doğrulama ile eski davranışa karşı ölç.

### Paket B — genel şirket şablonunu uçtan uca çalıştır

Modül ayar tablosu/RPC ve güvenlik denetimleri; bağımlılıklarla Modüller ekranı; sidebar/mobil/dashboard/kurulum/raporlar/arama/aktiviteler/derin bağlantılar birlikte uyarlanır. İlk dikey kabul senaryosu: operasyonu olmayan bir danışmanlık tenantı müşteri, görev, randevu ve belge işini rahatça yapar; personel terimi veya personel sorgusu görmez.

### Paket C — mevcut operasyon şablonlarını doğrula

Mek ve Partner örnekleri; havuz bağımsız kullanımı, dış proje raporu için talep zorunluluğu olmaması, modül kapatma/yeniden açma, tenant değişimi ve eski sekmeler. İDP/sabit/dönemsel alt seçenekler ancak bağımlılıklar tamamlanınca sunulur.

### Test kapıları

- Tenant A'da operasyon kapalı, B'de açık: aynı kullanıcı menü/veri/URL/RPC üzerinden kapsam karıştıramaz.
- Yönetici ayar değiştirebilir; operasyon/İK kullanıcısı değiştiremez. Etkin modül, muhasebe gibi role yeni veri erişimi vermez.
- Kapalı modülün doğrudan API/DB yazması ve veri okuması reddedilir; ortak altyapının yetkili tüketicileri çalışır.
- Eski açık sekmeden kapatma sonrası kayıt denemesi reddedilir; UI güncel durumu anlaşılır gösterir.
- Açık iş veya bağımlılık varken kapatma atomik olarak reddedilir; kapatma ve yeni kayıt yarışında kaçak kayıt oluşmaz.
- Yeniden açmada aynı kayıtlar bulunur; hiçbir migration modül kapatma adına tablo/veri silmez.
- Kapalı operasyon için sorgu/bildirim/arka plan işi yok; dashboard boş personel kartları veya sahte sıfırlar üretmez.
- Mobil menü sığar; kaydedilmemiş form için mevcut koruma sürer.
- Mevcut Mek/Partner iş akışları ve erişim testleri geçmeden üretimde zorunlu geçiş yapılmaz.

## 9. Öncelik ve açık işler

Önceki bildirim paketi yayımlandı. Görev atama/duyuru bildirim entegrasyonu ve kapsamlı duyuru düzenlemesi hâlâ backlog'da. Bu yeni istek araştırma/plan olarak ele alındı; tamamlanmamış eski işleri bitti olarak işaretlemiyor.

Öneri: yeni duyuru/görev olaylarını bağlamadan önce modül kataloğunu netleştirelim; böylece yeni olaylar kaynak modül bilgisini baştan taşır. Modülerleştirme bir menü rötuşu değildir; güvenlik, bağımlılık ve yaşam döngüsü olan ayrı bir geliştirme paketi olarak yürütülmeli.

Şu an istenmeyen genişleme: eklenti pazaryeri, her alan için aç/kapa, şirket başına kod kopyası, sürükle-bırak workflow motoru, yeni sektörlere özgü onlarca ekran. Önce mevcut ürünü seçilebilir ve anlaşılır hale getirelim.
