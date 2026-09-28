# BPS Ayarlar — benchmark ve bilgi mimarisi

> Birleştirilmiş ana karar ve uygulama sırası: [Çalışma Alanı ve Ayarlar ana planı](../../01_product/CALISMA_ALANI_VE_AYARLAR_ANA_PLANI.md). Bu dosya ayrıntı/araştırma eki olarak korunur.


28 Eylül 2026 · Araştırma/tasarım; kod ve üretim değişmedi.
Kod referansı: canlı `01c46b5`, `/private/tmp/bps-notification-inbox-20260928`.
İlişkili: [Seçilebilir modüller planı](../modular-saas-20260928/uygulama-plani.md).

## 1. Bugünkü durum: koddan gözlemler

- `src/app/(main)/ayarlar/page.tsx`: Şirket ekibi ve Platform başvuruları sekmeleri. Yönetici ekranı; ekip listesi/rol açıklamaları var, açıklamalar yetki düzenleyici değil.
- Aynı sayfa davetler için `/kurulum`, iş dağılımı için `/yonetim` bağlantısı veriyor.
- `kurulum/WorkspaceSetup.tsx`: firma, şube, personel, günlük plan ve haftalık çıktı adımları; operasyon odaklı. Kullanıcı davetleri bu sayfanın altında.
- `kurulum/Invitations.tsx`: davet akışının mevcut bileşeni; yeni yerde kopyası değil aynı iş mantığı kullanılmalı.
- `yonetim/ManagementBoard.tsx`: kimde ne iş var ve iş filtreleri; bir ayar ekranından ziyade günlük yönetim çalışma ekranı.
- `components/shell/Topbar.tsx`: kullanıcı menüsünde şu an çıkış var. Kişisel ayarlar giriş noktası yok.
- `ConversationInbox.tsx`: ses mevcut sekmede kullanıcı tarafından açılıyor. Kalıcı hesap bildirimi tercihi veya cihaz push izniyle eşdeğer değil.
- Platform başvuruları şirket davetleriyle aynı kavram değil; mevcut kod bunları metinle açıklıyor ama aynı Ayarlar içinde olmak ayrımı zorlaştırıyor.

Bu gözlemler canlı kod snapshot'ının incelenmesine dayanır; bu tur yeniden kimlikli browser smoke yapılmadı.

## 2. Resmi benchmarklar

| Ürün | Kaynakta görülen düzen | BPS çıkarımı |
|---|---|---|
| ClickUp | Workspace ve kişisel hesap menüleri ayrılıyor; People davet/üyelik işleri için ortak yer | Şirket ayarı ve kişisel tercihi ayır; ekip ve daveti tek bölümde buluştur |
| Notion | Ayar araması konumu gösterip hedefi vurguluyor; erişilemeyen yönetici ayarları sonuçta yok | Ayarlar büyüdüğünde izin filtreli yerel arama; ilk sürümde az sayıda açık başlık |
| Atlassian/Jira | Kişisel ayarlarda kullanıcıya ait tercihler; organizasyon yönetimi ayrı yüzey | Platform yönetimini şirket ayarlarından çıkar |
| Zoho One | Organization Admin ve Application Admin gibi farklı yönetim kapsamları | Şirket yöneticiliği ile BPS platform yöneticiliğini eşitleme; V1'e yeni admin türleri ekleme |
| Connecteam | Yönetici izinleri özellik/varlık kapsamlarında kontrol edilebiliyor | Modül varlığı, görüntüleme ve değiştirme hakkını ayrı düşün; yüzlerce yetki kutusunu kopyalama |

Kaynaklar:
- [ClickUp workspace ve hesap ayarları](https://help.clickup.com/hc/en-us/articles/10853931837335-Workspace-and-account-settings)
- [Notion workspace ayarları](https://www.notion.com/help/workspace-settings)
- [Jira kişisel ayarlar](https://support.atlassian.com/jira-software-cloud/docs/manage-your-jira-personal-settings/)
- [Atlassian organizasyon yönetimi](https://support.atlassian.com/organization-administration/docs/explore-an-atlassian-organization/)
- [Zoho One yönetici kapsamları](https://help.zoho.com/portal/en/kb/one/admin-guide/admins/articles/zohoone-assign-admins)
- [Connecteam yönetici izinleri](https://help.connecteam.com/en/articles/1981698-admin-permissions)

Doküman araştırmasıdır; ürünlerin hesap içi tüm ekranları test edilmedi. Plan/lisans/sürüm farkları olabilir. Notion dokümanı bazı ayarların mobilde bulunmadığını da belirtiyor; BPS'in ihtiyaç duyduğu temel ayarları mobilde çalıştırma kararımız bundan bağımsızdır.

## 3. Önerilen üç kapsam

### Kişisel ayarlar — kullanıcı menüsü

Başlık: **Hesabım**. Yalnız kullanıcıya ait tercih ve bilgiler. Görünür ad/e-posta gösterimi; düzenleme yalnız desteklenen ve doğrulanmış backend akışı varsa açılır. Başka tenant üyeliğinin rolü buradan değişmez.

Bildirim sesi burada anlatılabilir: “Bu cihazda/sekmede sesi etkinleştir.” Mevcut per-tab davranış değiştirilmeden “Tüm cihazlarda açık” yazılmaz. Kalıcı tercih gelecekte sunucuya yazılsa bile tarayıcı ses için kullanıcı etkileşimi isteyebilir; tercih kaydı ile ses oynatma yetkisi ayrı. Push/e-posta seçenekleri ilgili teslim kanalı gerçekten hazır olmadan gösterilmez.

Şifre değiştirme, tüm oturumları kapatma, MFA gibi akışlar mevcut ürün kabiliyeti olarak iddia edilmez; ayrı auth güvenlik geliştirmesi olmadan boş kontrol konmaz. Kullanıcı menüsünde Şirket değiştir ve Çıkış kolay bulunur.

### Şirket ayarları — ana menüde Ayarlar

Üstte seçili şirket adı ve “Bu değişiklikler [Mek Group] çalışma alanını etkiler.” Kişisel ayarlar ile karışmayan kapsam işareti.

| Bölüm | İçerik | İlk sürüm kapsamı |
|---|---|---|
| Genel | Çalışma alanı adı ve sektör/çalışma biçimi bilgisi | Mevcut bilgiler; düzenleme için dar yetkili endpoint gerekiyorsa ayrıca yapılır |
| Modüller | Çalışma alanını düzenle; seçilebilir iş modülleri ve önkoşullar | Modül planının M1–M4 kapıları tamamlanınca |
| Ekip ve davetler | Aynı listede mevcut üyeler ve bekleyen davetler; durumlar ayrı | Mevcut liste/davet akışını tek yerden erişilebilir yap |
| Kurulum rehberi | Etkin modüllere göre ilk adımlar | Mevcut `/kurulum` akışını sadeleştir; davet yönetiminin tek sahibi Ekip bölümü |
| Değişiklik geçmişi | Modül ve erişim ayarlarında kim/ne zaman/ne değişti | Yalnız gerçekten audit'i bulunan işlemler; tam sistem audit'i diye sunulmaz |

Başlangıçta beşten fazla üst kategori yok. Entegrasyonlar, Güvenlik, Faturalandırma, Veri yönetimi gibi dolu görünmek için açılmış boş sayfalar yok. Luca aktarımı günlük iş aracıdır; Finansal Özet altında kalır. İleride otomatik Luca bağlantı ayarı olursa entegrasyon ayarına girer.

### Platform yönetimi — ayrı yetkili alan

`/admin` yetki sınırı içinde platform başvuruları, tenant/platform düzeyi operasyonlar. Şirket yöneticisi platform admin değilse bu bölümü görmez, aramada da bulmaz; doğrudan URL'de sunucu kontrolü sürer. Mevcut yetki akışları korunur. Şirket yönetim rolüne platform üyelik değiştirme gücü bu taşıma sırasında verilmez.

## 4. Ayar olmayan işlerin yeri

- **Kimde ne iş var?** günlük çalışma ekranında `/yonetim` veya uygun Ekip işleri görünümü; ayarlar içine taşınmaz.
- **Personel dizini:** operasyona ait iş verisi; Ekip kullanıcıları ile karışmaz.
- **Şubeler:** müşteri/hizmet noktası kayıtları; uygulamaya giriş yapan ekip değil.
- **Excel aktarımı:** ilgili modülün içinde. Ayarlar tek dev import sayfasına dönüşmez.
- **Rol açıklamaları:** Ekip bölümünde bağlamsal yardım. Düzenleme yetkisi yoksa değiştirilebilir dropdown görünümü verilmez.
- **Duyuru yayınlama:** içerik işlemi. Ayarlarda yalnız ileride desteklenen genel tercih bulunabilir.

## 5. Önerilen gezinme ve rotalar

Öneri yollar, henüz oluşturulmadı:

- `/hesabim`: avatar menüsünden kişisel bilgiler ve gerçekten desteklenen tercihler.
- `/ayarlar`: seçili şirkete ait kısa giriş; genel bilgiler veya bölüm listesi.
- `/ayarlar/moduller`: ayrı planla yürüyen modül seçimi.
- `/ayarlar/ekip`: üyeler ve davetler.
- `/ayarlar/gecmis`: kapsama uygun audit.
- `/kurulum`: etkin modül başlangıç rehberi; aynı veri/işlem mantığını yeniden kopyalamaz.
- `/admin`: platform işlemleri.

Masaüstünde dar bölüm listesi + içerik; mobilde bölüm seçimi ve sayfa başlığı, yatay kayan çok sekmeli bar yok. Her bölüm paylaşılabilir iç route; tarayıcı geri ve yenileme konumu korur. Yönlendirmeler allowlist ile iç rotalara sınırlı; returnTo güvenliği korunur.

Bölüm sayısı küçükken arama şart değil. Arama eklenirse sabit ayar tanımları ve Türkçe eş anlamlar üzerinde çalışır: “kullanıcı/personel davet/ekip”, “modül/çalışma alanı”. Hassas ayar değerleri, e-posta adresleri veya bütün tenant üyeleri arama indeksi olmaz. “Personel” araması ekip üyesi ile havuz kişisinin farkını açıklamalı; otomatik yanlış sayfaya atlamamalı.

## 6. Form ve geri bildirim standardı

- Form başına tek açık Kaydet/Vazgeç; kullanıcıya değişen alanlar gösterilir.
- Değişiklik yoksa Kaydet pasif. Kaydet sırasında mükerrer submit engeli; sunucu idempotency gerekli işlemlerde devam eder.
- Başarı yalnız sunucu doğrulamasıyla: “Mek Group modül ayarları kaydedildi.”
- Hata: alan bazlı açıklama, form içeriğini koru; genel toast tek kanıt olmasın.
- Ağ sonucu belirsizse kaydetmiş sayma; command sonucu sorgulanır.
- Yüklenemeyen mevcut değerin yerine boş/default gönderip üstüne yazma yok.
- İki yönetici çakışınca revision conflict, değişiklikleri yeniden inceleme; sessiz son yazan kazanır yok.
- Şirket değişirken eski form yeni tenantta kaydedilemez; mevcut navigation guard ve scope kontrolleri korunur.
- Rol veya modül kapatmanın etkisi önizlenir; sıradan metin düzeltmesi için gereksiz ek onay diyaloğu yok.
- Klavye odağı, hata odaklama, 44px temel kontroller, küçük ekranda kaydet çubuğunun alanları kapatmaması test edilir.

## 7. Backend sınırları

Ayarların hepsini bir `settings jsonb` içine koyan sınırsız patch endpoint yapmayalım. Kapsamları tipli ve ayrı:

| Ayar türü | Sahiplik | Güvenlik |
|---|---|---|
| Görünür ad gibi hesap verisi | Kullanıcı | auth.uid; desteklenen dar alanlar; başka kullanıcının profiline yazma yok |
| Cihaz/sekme ses aktivasyonu | Mevcut cihaz/sekme | Kullanıcı etkileşimi; sunucu rolü değiştirmez |
| İleride tenant içi kişisel tercih | user_id + tenant_id | Canlı üyelik, yalnız kendi tercihi |
| Modül ayarı | tenant_id | Modül planındaki revision/kilit/bağımlılık RPC'si |
| Üyelik ve davet | tenant + ilgili kullanıcı | Mevcut yetki sınırı; açık görev devri ve rol kuralları korunur |
| Platform başvurusu | Platform | Platform admin denetimi; şirket yöneticisi olmak yeterli değil |

Üyelik kaldırma/rol düşürmede son yönetici ve aktif işler kontrolü ölçülmeli. “Son yönetici” yalnız tenant yöneticisi mi platform kurtarma erişimi mi olduğuna göre tanımlanmalı; mevcut garantiler incelenmeden hazır olduğu söylenmez. Bu UI çalışması yetki genişletme gerekçesi değildir.

Tüm ayar sayfaları module config gibi aynı doğrulanmış scope'u kullanır. Şirket adı gösterimi ile mutasyon tenant ID'si birbirinden kopmamalı. Genel şirket bilgisi düzenleyicisi eklenirse müşteri firması (`companies`) ile çalışma alanı (`tenants`) adını karıştırmamalı.

Audit yalnız ayar anahtarı/önce-sonra izinli değer/actor/zaman/command içerir; parola, token veya dosya içeriği içermez. Secrets normal ayar API'sine veya tarayıcıya taşınmaz.

## 8. Uygulama sırası

**S0 — Araştırma ve harita (bu tur):** mevcut kod/benchmark, kapsam ve önerilen bilgi mimarisi. Tam erişim matrisi veya kullanıcı testleri yapılmış değil.

**S1 — Var olanı toparla:** Ekip ve davetlerin tek yeri; platform başvurularının doğru yönetim alanı; Kurulum/Şirket Yönetimi bağlantılarının sadeleşmesi. Yetkiler aynı. Yeni özellik eklemeden bulunabilirlik kazanımı.

**S2 — Çalışma alanını düzenle:** modül altyapısı hazır olduğunda Modüller bölümünü bağla. Config paneli güvenlik dönüşümleri tamamlanmadan açılmaz.

**S3 — Kişisel alan ve geri bildirim:** yalnız desteklenen kişisel tercihler; sesin kapsamı doğru anlatılır; tüm ayar formlarında tutarlı kaydet/hata/taslak davranışı.

**S4 — Geçmiş ve ince ayar:** doğrulanmış audit yüzeyi, gerekli ise ayar araması, rol/cihaz kullanım testi. Yeni boş kategori açılmaz.

## 9. Kabul senaryoları

1. Yönetici ekip davetini Ayarlar → Ekip ve davetler yolunda bulur; Personel Havuzu'na gitmez.
2. Operasyon kullanıcısı kişisel tercihine erişir; şirket modüllerini değiştiremez.
3. Şirket yöneticisi platform admin değilse başvurular UI/API/veri yanıtında görünmez.
4. Mek formu açıkken Partner'a geçiş eski veriyi Partner'a yazamaz.
5. Mevcut rol düzenleme yetkisi yalnız platformdaysa Ekip ekranı bunu tenant yöneticisine sessizce açmaz.
6. Yetki düşürme veya açık iş devri gereği doğru engel mesajıyla gösterilir; kayıp üyelik/iş oluşmaz.
7. Modül kapalıysa ilgili ayar/kurulum adımı ve sorgusu normal kullanıcı yüzeyinde yok; yönetici modül kataloğuna erişebilir.
8. İki yönetici aynı ayarı değiştirince biri conflict alır; form taslağı korunur.
9. Ağ hatasında başarı toast'u yok; yazılmış sonucu bilinmeyen komut yinelenip çift davet yaratmaz.
10. Mobil/klavye ile bölüm seçme, davet formu, hata düzeltme ve çıkış tamamlanır.
11. Ses tercihi kullanıcı etkileşimi olmadan autoplay garantisi vermez; kapalı teslim kanalları sahte seçenek olarak görünmez.
12. İş dağılımını görmek isteyen kişi ayar değiştirmeden `/yonetim` üzerinden çalışır.

## 10. Önerilen karar

Ayarlar bölümünü “her şeyin toplandığı yer” değil, çalışma alanının düzenlendiği yer yapalım. Günlük işler iş ekranlarında; kişisel tercihler Hesabım'da; platform işleri ayrı admin alanında kalsın. İlk fayda yeni ayar sayısı değil, mevcut davet/ekip/kurulum karmaşasının azalmasıdır.

Bu tur yalnız araştırma ve plan dokümanları oluşturuldu. Veritabanı, yetki, canlı tercih, kod veya yayın değiştirilmedi.
