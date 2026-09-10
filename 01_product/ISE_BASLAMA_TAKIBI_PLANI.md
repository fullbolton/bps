# İşe Başlama Takibi — benchmark, ürün sözleşmesi ve ilk kod (031)

> **038 — Fable bulguları yerelde düzeltildi.** Kesin retlerde tek komutun sunucudan uzlaştırılması; plan öncesi manuel görüşme/teyit, saniye hassasiyeti ve dar giriş doğrulaması tamamlandı. 02900 yalnız dedicated yerelde. 157 unit, genel 5/5, yeni 7 SQL kontrolü, Fable yarış/kapsam regresyonları 26/26, gerçek yerel Auth/RPC, tarayıcı ret mesajı ve build geçti. Canlı 035 ve 27 migration değişmedi; 02800/02900 henüz production’da değil. [Düzeltme ve kanıt](FABLE_REVIEW_01_CODEX_TRIYAJ.md). Sıradaki iş 036–038 yayın adayının birlikte kabulü; production gerçek atama kabulü açık.

> **037 — Dashboard İşe Başlama özeti yerelde tamam.** Takip bekleyenlerin gerçek toplamı, ilk3kayıt, kontrol zamanı ve aynıgünün aksiyon listesine bağlantı eklendi. YeniSQLyok;02800gerekiyor.151unit/genel5/5,izolebuild,yerel0→1sayaçvefiltrelibağlantı kabulü geçti; geçici kayıtlar temizlendi. Canlı035/27migration değişmedi. Fable sonuç raporu geldi; sıradaki ikiP2vebirP3bulgunun Codex doğrulaması/düzeltmesi. Git yayını `fb1b218`, devir `2b53d98` olarak başka çalışma tarafından commit edilmiş; push bu tur ölçülmedi. [Kanıt](DASHBOARD_ISE_BASLAMA_OZETI.md).

> **036 — yerel tamamlandı, canlıya yayınlanmadı.** İşe Başlama Takibi arama/sorumlu/aksiyon filtreleri artık yeni `ops_start_board_filtered` RPC ile tüm gün üzerinde, sayfalama öncesi çalışır. 02800 yalnız dedicated yerelde; canlı035ve27migration korunuyor. 8nativeSQL,gerçek yerelAuth/RPC,genel5/5veizolebuild geçti. Kaynak çalışma ağacı artık035yayın snapshotından farklıdır. [Plan/kanıt](ISE_BASLAMA_TUM_GUN_FILTRELERI.md). Gerçek production atama/teyit kabulü hâlâ açık.

> **035 — 2026-09-09: Vercel production yayını tamamlandı.** [İşe Başlama Takibi](https://www.bpsys.net/talepler/ise-baslama) canlı Supabase üzerinde açılıyor. 27/27 migration uygulanmış durumda. Yeni sürüm `dpl_7dGwr1wHZc2REPBUYuJwjNnE6RZk`; production sağlık 5/5 ve mevcut hesapla takip + Dashboard okuma geçti. Bugün atama olmadığı için production arama/teyit yazma kabulü açık; yerel SQL/Auth/RPC/tarayıcı kabulü geçerli. localhost yerel kalır; git push yapılmadı, çalışma ağacının uygulama dosyaları CLI ile yayınlandı. Önceki frontend-bekliyor notları tarihseldir. Kanıt: `supabase/manual/release-20260909.md/json`.

> **034 — Supabase aktarımı tamam:27/27.** Son001600/002300/002400 kullanıcı devam onayıyla canlıya uygulandı. 27SQL SHA256 eşleşti, ledger uzlaştırıldı. Görev/davet/kayıt izinleri ve altı canlı salt-okunur kontrol geçti. Paket migration'ı beklemiyor. **localhost yerel; frontend deploy ve production kimlikli yazma smoke'u henüz yok.** Sıradaki bu paketin canlı UI yayını ve İşe Başlama Takibi kabulü; başka modüle geçme. Kanıt: supabase/manual/release-20260909.md/json.


> **033 — canlı durum24/27:** 001300–001500,001700–002200,002500–002600 de uygulandı, SHA256 veledger doğrulandı. Yalnız001600/002300/002400 için otomatik denetimin istediği oturum/rol etkilerine özgü onay bekliyor. İşe Başlama, kurulum, günlük özet veaktivite canlı salt-okunur probe geçti. localhost yerel; frontenddeploy yok. Ayrıntı supabase/manual/release-20260909.md.


> **032 — 2026-09-09: canlı aktarım kısmi, İşe Başlama Takibi kalıcı.** Canlıya 000100–001200 ve 002700 olmak üzere 13 migration uygulandı; SQL SHA256 doğrulandı, ledger özgün sürümlerle uzlaştırıldı. 001300–002600 mevcut modül değişiklikleri otomatik onay denetimi nedeniyle ayrı kullanıcı onayı bekliyor. 145 unit/genel+SQL+build 23/23; yeni takip 16SQL ve gerçek yerel Auth/RPC, tarayıcıda kayıt+reload geçti. localhost hâlâ yerel Supabase; frontend deploy yok. Güncel ayrıntı: [Canlı aktarım defteri](../supabase/manual/release-20260909.md).


2026-09-09. Kullanıcının personel gelmeme vakası ve onayladığı ad. Bu iş artık öncelikli; Luca/proje finansalı işleri korunur, ertelenir. Görseldeki mesajlar şirket içi bağlamdır, otomatik mesaj gönderme talimatı değildir. Kişi/telefon bilgileri ürüne veya testlere aktarılmadı.

## Resmi kaynaklardan karşılaştırma

- [Connecteam — late check-in](https://help.connecteam.com/en/articles/10274727-can-i-notify-admins-if-an-employee-is-late-for-a-shift): planlanan başlangıçtan X dakika sonra clock-in/check-in yoksa yönetici bildirimi; ilgili giriş/schedule ayarlarına bağlı. BPS kararı: görevlendirme başlangıç saatine bağlı teyitsizlik, telefon kontrolünden ayrı hesaplanacak.
- [Deputy — manager notifications](https://help.deputy.com/hc/en-au/articles/4692803698063-FAQs-for-manager-notifications): geç giriş ve boş vardiya uyarıları isteğe bağlı extension; bazı vardiya bildirimleri lokasyon ayarından sorumlu yöneticiye yönlendirilir. BPS kararı: belirli takip sorumlusu ve yedeği; herkese aynı bildirimi yağdırma yok. İlk dilimde gerçek push/SMS yok.
- [RotaCloud — Who’s In](https://help.rotacloud.com/en/articles/10045123-how-do-i-see-who-s-currently-clocked-in): mevcut anda giriş yapan, geciken, giriş yapmamış ve moladaki personelin raporu. BPS kararı: varsayılan şimdi aksiyon gerekenler; tarihi plan incelemesi ayrı, geçmiş günü canlı gösterme yok.
- [When I Work — shift confirmation](https://help.wheniwork.com/articles/using-shift-confirmation-computer/): personelin vardiyayı gördüğünü/onayladığını izler. BPS kararı: kabul/beyan işe varış kanıtı sayılmaz.

Bunlar resmi belge incelemesidir; ücretli hesapta ürünleri çalıştırarak yapılmış UX testi değildir. Ardışık telefon arama çizelgesi bu belgelerde doğrulanmadı; BPS ihtiyacına özgü tasarımımız. Rakipte var/yok hakkında daha geniş iddia yok. GPS/NFC ileride seçenek olabilir; ilk sürüm için zorunlu değil.

## Yerleşim ve hızlı kullanım

Günlük Operasyon içindeki İşe Başlama Takibi görünümü; Dashboard yalnız aranacak/geciken/teyitsiz özet ve bağlantı. Telefon ekranında bir personel kartı, masaüstünde kompakt atama satırı. Tarih/firma/lokasyon/sorumlu filtreleri. Varsayılan şimdi ilgilenilecekler; sonra başlangıç saati ve sabit atama kimliğiyle sıralama. Kontrolsüz eski günler ayrı görünür.

Satır: personel+şube, başlangıç, takip sorumlusu, son görüşme+saati, kontrol düğmeleri, ayrı teyit adımı. Gri gelecek; mavi zamanı geldi; kırmızı kontrol gecikti; görüşüldü nötr tik; bağımsız teyit yeşil. Metin/simge renge eşlik eder. Kırmızı kontrol eksikliği personelin kesin gelmediği anlamına gelmez.

Kontrol düğmesi → Hazırlanıyor/Yolda/Şubede olduğunu söylüyor/Ulaşılamadı/Gelemeyecek → kayıt. Normal aramada not zorunlu değil. ETA isteğe bağlı; başlangıcı aşarsa olası gecikme uyarısı. Telefon numarası mobilde arama açabilir; numaraya tıklamak başarılı görüşme değildir. Liste scroll ve seçili filtre korunmalı.

Arama sonucu ayrı; kişi işe başladı teyidi ayrı. Şube yetkilisi/saha sorumlusu kaynağı, teyit eden, teyidi kaydeden, gerçek olay zamanı ve kayıt zamanı tutulur. İlk sürüm telefonla alınan teyidin operasyonca kaydıdır; kişinin gerçekten şube yetkilisi olduğunu cihazla kanıtlayan sistem değildir. Personel beyanı bu alanı dolduramaz. Varış teyidi kalan kontrolleri gerekli değil yapar; yapılmış gibi boyamaz.

## İlk veri dilimi

Mevcut ops_daily_requests yalnız work_date; başlangıç saati yok. Otomatik08.00 ataması yapılmayacak. Başlangıç yoksa Saat bekliyor ve planlama aksiyonu. İş gününe başlangıç saati+Europe/Istanbul eklenir; lokasyon varsayılanı önerilebilir, kayıt anında snapshot alınır. Gece yarısı kontrolleri önceki takvim gününe taşabilir. Önerilen şablon T−60/T−30/T−15; pilot önerisidir, sektörel standart değildir. Aramada5dk gecikme eşiği de öneridir; varış için T0'da hemen teyitsiz durumu oluşur.

Takip ops_assignment kimliğine bağlanır. Aynı personelin başka atamasıyla karışmaz. Plan snapshot'ı, başlangıç, sorumlu, plan revision; append-only kontrol olayları ve gerekçeli düzeltmeler. “Aramayı üstlen” süreli sahiplik, arama sayılmaz. Aktif oturum rolü yönetici/operasyon, doğrulanmış tenant, compositeFK kayıt kapsamı. RPC idempotency ve expected revision; çift sekme/üstlenme/yedek atama yarışları. RLS açık, ham tablo yazma yok.

Yedek atama eski personelin geçmişini korur; yeni kimlikte takip başlar. Yeni atamadan önceki kontrol saatleri yapılmadı diye cezalandırılmaz: uygulanamaz etiketi ve hemen bir ilk kontrol. İptal/kaldırma açık kontrolleri kapatır, kayıt geçmişi kalır. Saat değişimi eski planı sessizce yeniden yazmaz; yeni revision ve gerekçe.

Mevcut attendance=present eski manuel beyandır; geçmiş kayıtlar bağımsız teyit varmış gibi dönüştürülmez. Entegrasyonda teyit+geldi güncellemesi atomik veya çelişki açık hatası; iptal/yerine atama/önceden gelmedi yarışları test edilir. Çalışma saati ve bordro onayı üretilmez.

## Aşamalı teslim

1. Bu tur: araştırma+durum kuralları+etkileşimli önizleme. Kayıt oluşturmaz.
2. Sıradaki: başlangıç/sorumlu/plan snapshot SQL ve scoped okuyucu; gerçek atamalardan Saat bekliyor ve kontrol listesi. Tenant/rol/gece yarısı/geç atama testleri.
3. Kontrol olayları ve varış teyidi RPC/UI; düzeltme geçmişi, sahiplik, idempotent retry, yedek personel bağlantısı.
4. Dashboard, ETA, gecikme sırası ve pilot. Sonra açıkça tasarlanmış tekilleştirilmiş bildirim worker'ı; browser saatini server bildirimi sanmayız.

## Önizleme ve kabul

`/talepler/ise-baslama/onizleme`: sentetik personel/şube; senaryo saati, arama sonucu, bağımsız teyit alanı. Zaman kaydırma temiz senaryo başlatır. Hiçbir operasyon kaydı veya bildirim oluşturmaz; bellekte kalır. Yönetici/operasyon ve mevcut sunucu operasyon bayrağı. Ana gerçek operasyon listesi henüz değiştirilmedi.

6 yeni unit kontrolü: gelecek/zamanı geldi/gecikti sınırları; personel beyanı teyit değildir; T0 tüm aramalar yapılsa da uyarı; gelmeme/ulaşılamama ayrımı; gerçek teyitte kalan kontrol kapama; iptal ve geçersiz teyit; gece yarısı ve yinelenen kontrol. Bunlar ilk saf durum hesaplarıdır; gerçek RPC veya audit event motoru değildir.

140unit ve genel/type/build6/6; `/var/folders/fg/qm_gg6w16299dhr_lz9xr38r0000gn/T/bps-acceptance-MeZBc6/report.md`. Tarayıcıda önizleme, kontrol paneli ve beyan seçimi denendi. Ürün migration'ı/prod/push/deploy yok. SQL kalıcılık ve gerçek atama/arama/teyit kabulü açık.
