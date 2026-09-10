# BPS — Güncel Ürün ve Geliştirme Yönü

> **044 — Yerel render yükü düzeltildi; yayında değil.** 100 personelli haftalık PDF devam satırlarında tam ekran listesinin gereksiz kopyaları kaldırıldı. HTML ad tekrarları 1.000→200; gömülü CSS dahil boyut 145.473→112.417 byte. Ekran/PDF 100 isim kabulü, TypeScript ve 043 ile toplam 10 PDF sayfasında piksel eşitliği geçti. SQL/veri/push/deploy yok; canlı 043 korunuyor. [Kanıt](HAFTALIK_CIKTI_RENDER_YUKU.md).

> **043 — 2026-09-10: Haftalık PDF düzeni yayında.** Metin sütunları genişletildi; özetler tek satırda. Uzun personel listeleri yazdırmada 12 kişilik devam satırlarına ayrılıyor; şube/gün tekrarlanıyor, sayılar yalnız ilk satırda. Sentetik Chromium PDF kabulü: tek talep 1 sayfa, 40 talep 5 sayfa (önce 6), 100 personel 4 sayfa; kimlikler eksiksiz ve birer kez. Kaynak `b2c921b`; canlı `dpl_3496nCsZVRrsykaWEiCGJeKAdzyk`; build, sağlık 5/5 ve canlı haftalık ekran geçti. Yeni SQL/veri yok. Native yazdırma diyalogu ve canlı CSV byte kontrolü erişim engeli nedeniyle açık. [Kanıt](HAFTALIK_CIKTI_KABULU.md).

> **042 — 2026-09-10: Aktivite olay adları yayında.** İşe başlama planı, arama sonucu, bağımsız teyit, yeniden açma ve geçici arama üstlenme/bırakma ayrı başlıklara sahip. Yeni SQL yok. `0446684` push edildi; canlı `dpl_5wGgUBaofM2qMH3nCK9gMnpMzUwU`. İki mevcut test, TypeScript, production build, sağlık 5/5 ve kimlikli Dashboard okuma geçti. Mevcut canlı listede takip olayı olmadığından altı yeni başlık o listede ayrıca gözlenmedi; yeni test verisi oluşturulmadı. [Kanıt](AKTIVITE_ISE_BASLAMA_ADLARI.md).

> **041 — 2026-09-10: Blok 1 yayında, çekirdek canlı kabul tamam.** Üç bekleyen SQL uygulandı; bu teslimin 30/30 migration kaynağı ve ledger sürümü doğrulandı. `565059e` kaynakları `codex/block-01-release` dalına push edildi; main birleştirilmedi. Vercel `dpl_DZvtjhLdoishravp1YYwJnM9Uuoq` www.bpsys.net üzerinde canlı, sağlık 5/5. Kimlikli sentetik aday firma → şube → personel → talep → atama → plan → arama → bağımsız teyit → reload ve Dashboard geçti. Bu tur test verileri temizlendi; eski kayıtlar korundu. CSV gerçek HTTP kabulü yerel 9/9; canlı CSV byte/PDF sayfalama kabulü ayrıca açık. Önceki bekliyor/yayınlanmadı kayıtları tarihseldir. [Tek teslim notu](BLOK_01_TESLIM.md).

> **040 — Blok 1 yerel teslim paketi hazır.** Haftalık CSV gerçek HTTP 9/9 ve bağımsız okuyucu, tarayıcı toplam/iptal/boş hafta kabulü geçti. Kabul betiği artık kendi geçici hesap/verilerini temizler. Toplu manifest 249 uygulama + 30 SQL + 17 kabul dosyasını doğrular; uygulama 036–039 kabul snapshotlarıyla birebir. Genel 5/5 ve manifest 2 test geçti. Yeni uygulama/SQL değişikliği, production/push/deploy yok. Yayın ve canlı kabul açık; başka modül açılmayacak. [Tek teslim notu](BLOK_01_TESLIM.md).

> **039 — Blok 1: aday firma uyumluluğu yerelde tamamlandı.** Aday ve aktif firmalar yeni operasyona uygun; CRM durumu kendiliğinden değişmiyor. Yedi SQL fonksiyonu, firma seçimi ve kurulum sayacı birlikte düzeltildi. 9 native kontrol, 159 unit/genel 5/5, gerçek yerel Auth ile aday firma → şube/CSV → talep → atama → plan/arama/teyit → yeni oturumdan okuma ve build geçti. Geçici veriler temizlendi. Canlı/push/deploy yok; 02800,02900,20260910000100 production’da bekliyor. Blok kapanmadı; sıradaki haftalık CSV kullanıcı kabulü ve birlikte teslim envanteri. [Kanıt](ADAY_FIRMA_OPERASYON_UYUMU.md).

> **2026-09-10 — Kullanıcı kararı: bloklar hâlinde teslim, liderlik Codex’te.** Her tur dış ajan yanıtı beklenmeyecek. Codex uygulama, test ve düzeltmeleri uçtan uca tamamlar; Claude Code/Chat için anlamlı teslim noktalarında tek inceleme paketi hazırlanır. İlk blok günlük operasyon ve işe başlama kabulüdür. [Çalışma düzeni](BLOK_CALISMA_DUZENI.md).

> **2026-09-10 — Claude yanıtları değerlendirildi.** Chat canlı şube → personel → talep → atama zincirini 4/4 ölçtü; işe başlama arama/teyit kabulü açık. Aday firma uyumsuzluğu kodda doğrulandı, düzeltmesi sırada. Fable bulguları 038 ile yerelde giderildi. Yayın manifestinin 246 dosyası hem fb1b218 hem HEAD ile eşleşti; 036–038 çalışma ağacı farkları henüz yayında değil. Öncelik uyumluluk düzeltmesi, bağımsız kabul ve gerçek kullanım pilotu. [Kararlar ve görevler](CLAUDE_YANITLARI_KARAR_2026-09-10.md).

> **038 — Fable bulguları yerelde düzeltildi.** Kesin retlerde tek komutun sunucudan uzlaştırılması; plan öncesi manuel görüşme/teyit, saniye hassasiyeti ve dar giriş doğrulaması tamamlandı. 02900 yalnız dedicated yerelde. 157 unit, genel 5/5, yeni 7 SQL kontrolü, Fable yarış/kapsam regresyonları 26/26, gerçek yerel Auth/RPC, tarayıcı ret mesajı ve build geçti. Canlı 035 ve 27 migration değişmedi; 02800/02900 henüz production’da değil. [Düzeltme ve kanıt](FABLE_REVIEW_01_CODEX_TRIYAJ.md). Sıradaki iş 036–038 yayın adayının birlikte kabulü; production gerçek atama kabulü açık.

> **037 — Dashboard İşe Başlama özeti yerelde tamam.** Takip bekleyenlerin gerçek toplamı, ilk3kayıt, kontrol zamanı ve aynıgünün aksiyon listesine bağlantı eklendi. YeniSQLyok;02800gerekiyor.151unit/genel5/5,izolebuild,yerel0→1sayaçvefiltrelibağlantı kabulü geçti; geçici kayıtlar temizlendi. Canlı035/27migration değişmedi. Fable sonuç raporu geldi; sıradaki ikiP2vebirP3bulgunun Codex doğrulaması/düzeltmesi. Git yayını `fb1b218`, devir `2b53d98` olarak başka çalışma tarafından commit edilmiş; push bu tur ölçülmedi. [Kanıt](DASHBOARD_ISE_BASLAMA_OZETI.md).

> **036 — yerel tamamlandı, canlıya yayınlanmadı.** İşe Başlama Takibi arama/sorumlu/aksiyon filtreleri artık yeni `ops_start_board_filtered` RPC ile tüm gün üzerinde, sayfalama öncesi çalışır. 02800 yalnız dedicated yerelde; canlı035ve27migration korunuyor. 8nativeSQL,gerçek yerelAuth/RPC,genel5/5veizolebuild geçti. Kaynak çalışma ağacı artık035yayın snapshotından farklıdır. [Plan/kanıt](ISE_BASLAMA_TUM_GUN_FILTRELERI.md). Gerçek production atama/teyit kabulü hâlâ açık.

> **035 — 2026-09-09: Vercel production yayını tamamlandı.** [İşe Başlama Takibi](https://www.bpsys.net/talepler/ise-baslama) canlı Supabase üzerinde açılıyor. 27/27 migration uygulanmış durumda. Yeni sürüm `dpl_7dGwr1wHZc2REPBUYuJwjNnE6RZk`; production sağlık 5/5 ve mevcut hesapla takip + Dashboard okuma geçti. Bugün atama olmadığı için production arama/teyit yazma kabulü açık; yerel SQL/Auth/RPC/tarayıcı kabulü geçerli. localhost yerel kalır; git push yapılmadı, çalışma ağacının uygulama dosyaları CLI ile yayınlandı. Önceki frontend-bekliyor notları tarihseldir. Kanıt: `supabase/manual/release-20260909.md/json`.

> **034 — Supabase aktarımı tamam:27/27.** Son001600/002300/002400 kullanıcı devam onayıyla canlıya uygulandı. 27SQL SHA256 eşleşti, ledger uzlaştırıldı. Görev/davet/kayıt izinleri ve altı canlı salt-okunur kontrol geçti. Paket migration'ı beklemiyor. **localhost yerel; frontend deploy ve production kimlikli yazma smoke'u henüz yok.** Sıradaki bu paketin canlı UI yayını ve İşe Başlama Takibi kabulü; başka modüle geçme. Kanıt: supabase/manual/release-20260909.md/json.


> **033 — canlı durum24/27:** 001300–001500,001700–002200,002500–002600 de uygulandı, SHA256 veledger doğrulandı. Yalnız001600/002300/002400 için otomatik denetimin istediği oturum/rol etkilerine özgü onay bekliyor. İşe Başlama, kurulum, günlük özet veaktivite canlı salt-okunur probe geçti. localhost yerel; frontenddeploy yok. Ayrıntı supabase/manual/release-20260909.md.


> **032 — 2026-09-09: canlı aktarım kısmi, İşe Başlama Takibi kalıcı.** Canlıya 000100–001200 ve 002700 olmak üzere 13 migration uygulandı; SQL SHA256 doğrulandı, ledger özgün sürümlerle uzlaştırıldı. 001300–002600 mevcut modül değişiklikleri otomatik onay denetimi nedeniyle ayrı kullanıcı onayı bekliyor. 145 unit/genel+SQL+build 23/23; yeni takip 16SQL ve gerçek yerel Auth/RPC, tarayıcıda kayıt+reload geçti. localhost hâlâ yerel Supabase; frontend deploy yok. Güncel ayrıntı: [Canlı aktarım defteri](../supabase/manual/release-20260909.md).


> **031 — 2026-09-09:** Yeni kullanıcı önceliği İşe Başlama Takibi. Connecteam/Deputy/RotaCloud/When I Work resmi belgeleri incelendi; kaynaklı UX+veri planı ve kayıt oluşturmayan etkileşimli önizleme hazır.140unit/genel/type/build6/6. Sıradaki başlangıç saati+sorumlu+plan snapshot ve scoped SQL okuma. Gerçek arama/teyit kaydı henüz yok. [Plan](ISE_BASLAMA_TAKIBI_PLANI.md). Luca/proje işleri korunur; önceki sıradaki notları tarihseldir.


> **030 — 2026-09-09 (SQL yok):** Luca bekleyen onay kimliği mali satır saklamadan kalıcı. Aynı dosya/eşleme reload sonrası aynı UUID; farklı dosya/eşleme bloklanır.134unit/genel/type/build6/6, gerçekAuth/RPC kimlik kurtarma geçti. Browser gerçek reload E2E açık. [Kanıt/sınırlar](LUCA_KALICI_KURTARMA_DILIMI.md). Sıradaki sunucu receipt durum uzlaştırması; proje tanımı/gerçek çıktı kolonları açık. Önceki sıradaki notları tarihseldir.


> **029 — 2026-09-09:** Luca tek transaction onayına geçti (migration02600, yalnız yerel). Upload/satır/alacak birlikte; tenant+firma sınırı, aynı komut tekrarı ve eski bypass kapısı kapalı.9nativeSQL,gerçekAuth/RPC,128unit/genel/type/build6/6. Sıradaki kalıcı yeniden deneme ve gerçek export/proje eşleme sözleşmesi. Proje tanımı kararı açık. [Kanıt/sınırlar](LUCA_ATOMIK_ONAY_DILIMI.md). Önceki sıradaki notları tarihseldir.


> **028 — 2026-09-09:** Kullanıcı önceliği proje finansalı + Luca. Gelişmiş özet düğmesi ilk kaynak görünümü olarak eklendi; proje kârlılığı henüz hesaplanmıyor. Mevcut Luca yalnız firma açık alacağı üretir.128unit/genel/type/build6/6, modal tarayıcı kabulü. Sıradaki aktarım tenant/atomiklik incelemesi; proje tanımı için kullanıcı cevabı bekleniyor. [Plan ve sınırlar](PROJE_FINANSALI_VE_LUCA_PLANI.md). Banka/otel pilotu korunur; önceki sıradaki notları tarihseldir.


> **027 — 2026-09-09 (ürün SQL yok):** Finansal ekranın boş/dolu/yalnız firma kaydı kabulü yerel tarayıcıda geçti. Eksik gecikmiş firma sayısı artık sıfır değil bilinmiyor; mali yenileme düğmesi eklendi.128unit ve genel5adım geçti; ilk build DNS nedeniyle başarısız, yalnız build tekrarı geçti. İki sentetik mali kayıt temizlendi. Sıradaki [banka/otel uçtan uca pilot](PILOT_UCTAN_UCA_KABUL.md). [Kanıt](FINANSAL_OKUMA_KABULU.md). Önceki sıradaki notları tarihseldir.


> **026 — 2026-09-09 (SQL yok):** Raporlarda günlük özet + haftalık çıktı erişimi, önceki kayıtların açık ayrımı; finansal özetten eski iş gücü/talep ve kritik firma sayaçları kaldırıldı. Mali okuma hatası ayrı, yeniden denemeli; hata/yüklemede PDF düğmesi yok. Genel/type/build6/6,128unit ve yerel tarayıcı doğrulandı. Sıradaki **pilot kabul senaryosu ve mali ekranın başarılı/boş okuma kabulü**. P06 veri geçişi ile davet email/PKCE/hook kapıları açık. [Kanıt](RAPOR_KAYNAKLARI_GECIS_DILIMI.md). Önceki sıradaki notları tarihseldir.


> **02500 — 2026-09-09:** Dashboard günlük operasyon verisine bağlandı: bugün talep/istenen/yerleştirilen/eksik sayıları ve ilk 5 açık talep. 8 native SQL, gerçek Auth/RPC, genel/type/build 6/6 ve tarayıcı geçişi doğrulandı. Sıradaki P06 raporlar/finansal özet eski talep kaynağının anlam ve geçiş incelemesi; ardından pilot. E-posta/PKCE/hook kabulü hâlâ açık. [Kanıt ve sınırlar](DASHBOARD_GUNLUK_OPERASYON_DILIMI.md). Önceki sıradaki notları tarihseldir.


> **02400 — 2026-09-09:** Davetle yeni hesap `/kayit`, PKCE callback ve güvenli profile defaults yerelde.18SQL, gerçekAuthsignup/kabul,127unit,genel/type/build6/6. E-posta doğrulama bağlantısı ve prod hook uçtan uca kabulü açık. Sıradaki **Dashboard eski/yeni operasyon kaynaklarını birleştirme**. [Kanıt/sınırlar](MUSTERI_KURULUMU_VE_DAVETLER.md). Önceki sıradaki notları tarihseldir.

> **02300 — 2026-09-09:** Mevcut hesap için davet oluştur/listele/iptal/kabul yerelde tamam. 13SQL, gerçekAuth/RPC,127unit,genel/type/build6/6. Sıradaki yeni hesap için Auth davet/ilk giriş ve yerel uçtan uca kabul; e-posta gönderimi henüz yok. [Davet teslimi ve sınırlar](MUSTERI_KURULUMU_VE_DAVETLER.md). Önceki sıradaki notları tarihseldir.

> **02200 — 2026-09-09:** Çalışma alanı kurulum ekranı yerelde tamamlandı; gerçek envanter ve yönetici/tenant sınırı. 10SQL, gerçek Auth/RPC, genel/type/build6/6 (125 operasyon unit). Sıradaki **davet oluşturma/iptal/kabul**, plan: [Müşteri kurulumu ve davetler](MUSTERI_KURULUMU_VE_DAVETLER.md). Davet gönderimi henüz yok; prod/push/deploy yok. Aşağıdaki eski sıradaki notları tarihseldir.

> **2026-09-09 yeni öncelik:** Dashboard risk/otel kartları kaldırıldı; son aktiviteler gerçek kayda bağlandı (02100, yerel). Sıradaki **yeni müşteri kurulumu + kullanıcı davetleri**, ardından eski/yeni operasyon göstergelerini birleştirme ve pilot. Evrak takip sahipliği planı korunuyor, ilk sırada değil. Güncel sıra ve sınırlar: [Dashboard ve SaaS sırası](DASHBOARD_VE_SAAS_SIRASI.md). Aşağıdaki eski “sıradaki” notları tarihseldir.

Tarih: 2026-09-08. Kaynak: Furkan'ın bu oturumdaki doğrudan yönlendirmesi.
Durum: Güncel planlama yönü; test/örnek iş verisi temizliği onaylandı. Kod, şema ve gerçek hesaplar korunacak.

## Güncel teslim — 2026-09-09

Son teslim02000: ana PDF + bağımsız çoklu ek protokol/sürüm geçmişi.121unit,
32native (01900 regresyonu dahil),15Auth/Storage/HTTP,full18/18.20migration yerelde.
İki ek,tek ek replace,eski PDF görüntüleme ve firma evrak bağlantısı browser'da geçti.
Rapor `/var/folders/fg/qm_gg6w16299dhr_lz9xr38r0000gn/T/bps-acceptance-3LQQlC/report.md`. SOZLESME_EK_PROTOKOL_DILIMI.md kanıt/sınırlar.
Sıradaki EVRAK_TAKIP_SAHIPLIGI_DILIMI.md; eski son/sıradaki notları tarihseldir.

Son teslim 01900: ilk PDF ve değiştirme için kalıcı yükleme komutu, kesintiden
aynı komutla devam, iptal kaydı ve sunucuda byte kontrolü. 115 unit, 20 yeni
native yükleme kontrolü, 10 gerçek Auth/Storage/HTTP kontrolü. Gerçek tarayıcı
file chooser, reload sonrası devam, yanlış dosya reddi, iptal ve eski/güncel PDF
ayrı ayrı açılarak doğrulandı. 19 migration yalnız sentetik yerelde.
Son full paket: 17/17 geçti — `/var/folders/fg/qm_gg6w16299dhr_lz9xr38r0000gn/T/bps-acceptance-XC4PZO/report.md`. Ölçüm ve sınırlar:
SOZLESME_PDF_YUKLEME_DEVAMLILIGI_DILIMI.md.
Sıradaki SOZLESME_EK_PROTOKOL_DILIMI.md: ana PDF + bağımsız ek protokoller.
Aşağıdaki son/sıradaki kayıtları tarihseldir; bu üst kayıt günceldir.

Son teslim01800: PDF sürüm geçmişi, CAS replace, scoped eski indirme ve retained
Storage koruması.105unit/18PDFnative/10gerçek StorageAPI, sonfull16/16.
Tarayıcıda iki sürüm ve eski sürüm linki doğrulandı; native file chooser henüz açık.
18migration yalnız sentetik yerelde. SOZLESME_BELGE_SURUMLERI_DILIMI.md ölçüm/sınırlar.
Sıradaki SOZLESME_PDF_YUKLEME_DEVAMLILIGI_DILIMI.md: kalıcı upload komutu + yeniden
deneme/finalize; ardından ek protokol. Aşağıdaki sıradaki kayıtları tarihseldir.

Son teslim01700: gerçek sözleşme yenileme görevi/sorumlusu/tarihi; manuel flags
kaldırıldı, revision+receipt+tek ilişki.101unit,18yenileme native,7yerel API;
full15/15. Browser çift tık1task→devir→yeni owner doğrulandı.17migration yalnız
sentetik yerelde; SOZLESME_YENILEME_SAHIPLIGI_DILIMI.md kanıt ve sınırlar.
Sıradaki SOZLESME_BELGE_SURUMLERI_DILIMI.md; ana PDF geçmişi, sonra ek protokol.
Aşağıdaki “en son/sıradaki” notları önceki aşamaların tarihsel kayıtlarıdır.

En son iki aşama: TOPLU_GOREV_DEVIR_DILIMI.md + KULLANICI_AYRILIS_KAPISI_DILIMI.md.
01500 önizlemeli100'lük atomik devir/receipt/history;01600 aktif işi bırakacak
üyelik/rol değişimini engeller ve eşzamanlı görev yazısını canlı üyelik/rolle sınar.
96unit,26devir native,19üyelik guard native; son paket14/14, ayrıca devirAPI10 ve
üyelikAPI7. Browser devir2/kalan0.16 migration dedicated yerelde, üretimde değişiklik yok.
Admin owner/ACL korunur, eski000400 dosyası değişmez. Tam hesap kapatma P10 açık.
Sıradaki SOZLESME_YENILEME_SAHIPLIGI_DILIMI.md: manual “sorumlu/görev var” flags
ile gerçek kullanıcı/görev arasındaki boşluğu kapatma. Aşağıdaki önceki sıradaki
dilim notları tarihsel; en üstteki teslim ve plan esas alınır.

En son ek: firma detayından randevu planlama ve form kabulü tamamlandı. Native tarih
seçiciyle UI yaratma geçti; çift tıklama1satır, pasif ret0, iptal0. Hata halinde taslak
korunur; scope değişiminde kapanır. Son hızlı kabul+build6/6, ayrı randevu API9/9.
RANDEVU_FORM_BAGLAMI_DILIMI.md kanıt ve sınırlar; SQL değişmedi. Sıradaki
TOPLU_GOREV_DEVIR_DILIMI.md; manuel toplu devir planı, ayrılış/admin entegrasyonu açık.
Aşağıdaki tarih UI kabulü açık notu bu ölçümle güncellendi.

En son ek: randevu sonucu + takip görevi yeni scoped RPC/receipt ile tek transaction.
Tekrar aynı sonucu döndürür, task hatası randevuyu da geri alır; pasif firmada açık
skip. Eski güvensiz RPC kapalı kaldı. 85 unit,12/12 paket,22 native randevu ve9
gerçek yerel randevu API kontrolü geçti. Tarayıcı tamamlaması1randevu/1task/1receipt.
12 ops+1 görev+1 randevu migration yalnız dedicated yerelde; üretim değişmedi.
RANDEVU_TAKIP_BUTUNLUGU.md kanıt/sınırlar. Sonraki RANDEVU_FORM_BAGLAMI_DILIMI.md:
firma bağlamı ve açık yeni-randevu tarih UI kabulü; IAB date fill sorununun uygulama
mı araç mı olduğu henüz ölçülmedi. API yaratma geçti, UI yaratma tamamlandı sayılmaz.

En son ek: görev atama geçmişi ve sürüm kontrollü güncelleme yerelde tamamlandı.
Her task yazısı revision ilerletir; mevcut uygulama update'leri eski revision ile
yazamaz. Atama kimliği değişimleri DB trigger'ıyla kaydedilir, hızlı panelde son20
görünür. Mevcut görev policy'leri değişmedi. 79 unit, tam paket11/11, ayrı16 native
task kontrolü ve11 yerel görev API/servis kontrolü geçti; tarayıcı conflict→yenile→
atama geçmişi ölçüldü. 12 ops migration +1 görev migration yalnız dedicated yerelde.
GOREV_DEVIR_DILIMI.md sınırlar ve kanıt; randevu tamamlama ilerlemesi üstteki ektedir.
Admin kullanıcı taşıma otomatik devir yapmaz; bunun tamamlandığı iddia edilmez.

Son ek: günlük talep kartından mevcut görev formuna doğrulanmış firma/başlık
önseçimi tamamlandı. Kaynak manuel; kalıcı talep ilişkisi ve otomatik durum eşleme
yok. Mevcut görevi atama/kaldırma/kapama akışı korundu. 75 unit, tam kabul10/10,
ayrı9 gerçek yerel görev servis testi ve tarayıcıdan tek kayıt ölçüldü.
Detay: GOREV_BAGLAMI_DILIMI.md. Devir geçmişi/eşzamanlı edit teslimi üstteki güncel
ekte tamamlandı; mevcut motor çoğaltılmadı. Test şemasına görev/profile
yardımcıları eklendi; bu üretim migration'ı veya tam tarihsel şema değildir.

Yerel pilotta firma/şube, CSV aktarımı, günlük ve toplu talep, atama, iptal,
kapasite düzenleme, haftalık plan ve müşteri CSV'si var. Gerçekleşme (geldi / gelmedi /
henüz bildirilmedi) ile atomik personel değişimi eklendi. İptal ve kaldırma tarihsel
bildirimi silmez; plan ve gerçekleşme ayrı görünür. Kayıp yanıtlar kalıcı komut
kimliğiyle sorgulanır veya aynı kimlikle tekrar denenir.

68 birim, 181 DB, 48 native yarış ve 42 yerel API kontrolü geçti. Önceki6 HTTP
CSV kontrolü geçerli; export davranışı değişmedi. On iki pilot migration yalnız
sentetik yerelde uygulandı. Üretim/push/deploy ve asıl iş verisi temizliği yapılmadı.
Mobil390px akışlar ölçüldü.

Açık kabul: native PDF sayfalaması, tam tarihsel prod şeması, migration sahibi ve
admin/Auth entegrasyonu. Haftalık gerçekleşme özeti de tamamlandı; iptal/kaldırma geçmişi dahil, ayrı zaman
damgalı ve plan filtresinden bağımsız. Plan CSV'si hâlâ planlanan atamaları gösterir.
Günlük operasyon kontrol listesi tamamlandı: açık ihtiyaç, aktif gelmedi ve günü
gelen bildirilmemiş atamalar; filtre/arama ve hedef günlük karta bağlantı. İptal ve
kaldırılmış atamalar aksiyon sayılmaz. Liste ayrı bir görev/ücret kararı oluşturmaz.
Şube/personel dizini tamamlandı: /talepler/dizin, sunucuda50 satır/sayfa, kod/ad/il
araması, aktif/pasif filtresi; şube firma kapsamında, personel çalışma alanı kapsamında.
Başındaki sıfırlar korunur; kodsuz şube için kod türetilmez. Canlı performans ölçülmedi.
Yönetici aktif/pasif işlemi tamamlandı: revision + kalıcı komut, korunan atama/geçmiş,
atama/pasife alma iki yönlü yarış kabulü. ops_mutate atama lokasyon kontrolü SHARE
kilidi alır. Operasyon rolü salt-okunur kalır; pasif firma şubesi aktifleştirilemez.
Yerel kabul paketi tamamlandı: `npm run qa:acceptance`, seçmeli SQL/API/build
modları ve private JSON/Markdown rapor. Tam10 adım exit0;11 runner davranış testi.
Build geçici .env'siz kopyada çalışır, açık dev sunucusu korunur. Eksik runtime exit1.
P07 ilk kod envanteri ve talep→görev önseçimi tamamlandı. Sıradaki dar iş
GOREV_BAGLAMI_DILIMI.md içindeki devir geçmişi/eşzamanlı edit sınırlarıdır.
Aşağıdaki tarihli ekler önceki aşamaların kayıtlarıdır.

## Başlangıç

Furkan uygulamanın gerçek operasyonda kullanılmadığını belirtti. Bu nedenle önceki
“tamamlandı” listeleri kullanım başarısı veya korunması zorunlu ürün kapsamı sayılmaz.
Eski Vault notları tarihsel bağlamdır; yeni ürünü geçmiş paket numaraları belirlemez.
Canlı şema/kod mevcut teknik varlıklardır, ihtiyaçların yerine geçmez.

Demo/dev projesi silinmiş olabilir (Furkan'ın hatırlaması). Yerel env dosyasında
eski URL bulunması projenin varlığını kanıtlamaz. Önceki bps-dev yönü tarihsel karardır;
bugünkü ortam varlığı doğrulanana kadar geliştirme ortamı **belirsiz** sayılır.

## Ürün odağı

Bir operasyon çalışanı bankadan gelen ihtiyacı kaydeder, doğru şubeyi seçer,
personeli yerleştirir ve haftalık müşteri listesini çıkarır. Yönetici eksikleri
görür. İlk başarı ölçütü bu işin gerçek bir hafta boyunca BPS'te yapılmasıdır.

İlk dilim: firma → şube → günlük ihtiyaç → personel atama → çıktı.
Sonra görev/devir, sözleşme/evrak ve bildirimler bu akışa bağlanır. Finans ve diğer
modüller mevcut diye yeniden genişletilmez; ilk kullanıcı işini etkileyen sorunlar çözülür.

## Teknik öneri

Mevcut Next.js/TypeScript/Supabase tabanını değerlendirerek kullan. Uygun olmayan
modülleri değiştirmek serbesttir; çalışan her şeyi yeniden yazma zorunluluğu yoktur.
Kodu korumak bir amaç değil, doğrulanmış parçaları yeniden kullanmak zaman kazancıdır.
Tablo/alan ve API önerileri teknik planda taslaktır; ihtiyaç ve testle kesinleşir.

Eski borçların tamamını kapatmayı yeni ürüne başlama şartı yapma. Yeni akışın
güvenli geliştirilmesi için gereken auth, tenant, şema temeli ve test ortamını önce kur.
İlgisiz borçları ayrı kaydet. Her küçük teslim uçtan uca çalışır ve kanıtıyla kapanır.

## Sıfırlama kararı — onaylandı, henüz uygulanmadı

Furkan açıkça seçti: **test/örnek iş verilerini temizle; kod, şema ve gerçek hesaplar kalsın.**
Bu karar projeyi, Auth hesaplarını veya migration geçmişini sıfırlama yetkisi değildir.

Temizlikten önce tablo ve Storage envanteri, korunacak hesap/tenant/
ayarlar, FK bağımlılıkları ve geri yüklenebilir yedek hazırlanır. Hedef satırlar ve
dosyalar sayılı manifestte gösterilir. İş verisi, Auth, Storage, migration ledger
birbirinden ayrılır; “hepsi test” ifadesinden bütün projeyi silme sonucu çıkarılmaz.

## Yürütme sırası

1. **Başlangıç haritası:** hangi ortamlar gerçekten var, ne korunacak/ne temizlenecek,
   yeni akışın ihtiyaç duyduğu temel şema ve hesaplar. Çıktı: kısa envanter ve reset manifesti.
2. **Tek dikey dilim:** bir firma ve şube için bir günlük talep oluştur, bir kişi ata,
   listede göster. Rol/tenant ve eşzamanlı atama testleri bu dilimin parçası.
3. **Ölçekli giriş:** şubelerin Excel/CSV aktarımı, kaynak kimliği, tekrar yükleme ve
   değişiklik önizlemesi. Resmî kaynak adaptörü erişim doğrulandığında aynı hatta bağlanır.
4. **Gerçek haftalık operasyon:** toplu günler, kısmi değişiklik/iptal, açıklar ve müşteri çıktısı.
5. **Pilot:** bir hafta gerçek kullanım; hata/eksik ve giriş yükü ölçümü. Sonra diğer modüller.

Bu sıra önceki P02→P03 kod sırasını revize eder: tüm import altyapısı bitmeden
tek firma/şube üzerinde talep→atama akışı denenir. Şube çekirdeği 2. adımda,
toplu aktarım 3. adımda gelir. Özel personel/rol/takvim kararları ilgili adımda kapatılır.

## Ortak çalışma

Codex teknik yönü, küçük uygulama görevlerini ve review ölçütlerini hazırlar.
Claude Code uygulama yapar; Codex bağımsız inceler. Görev sahibi açıkça değişirse
Codex de uygulayabilir; aynı dosyalarda eşzamanlı düzenleme yapılmaz.
Furkan gerçek kullanım sonucunu değerlendirir. Her tur sonunda repo ve Vault'a
güncel durum, ölçüm kaynağı, açık işler ve sıradaki adım yazılır.

## Önceki belgelerle ilişki

İlk kod ilerlemesi: [Günlük operasyon dilimi](ILK_OPERASYON_DILIMI.md). Tarih,
doluluk ve atama ön kontrolü üzerine günlük ekran, server action/service ve atomik
DB RPC kodu eklendi (2026-09-09). 13 domain/form testi ve geçici PostgreSQL testleri
geçti; migration/deploy yapılmadı. İki bağlantılı yarış ve kimlikli kabul bekliyor.

[İş planı](BPS_OPERASYON_SAAS_IS_PLANI.md), [teknik tasarım](BPS_TEKNIK_UYGULAMA_PLANI.md)
ve [uzlaştırma](BPS_BASLANGIC_UZLASTIRMA_PLANI.md) ayrıntı/backlog olarak saklanır.
Güncel yürütme yönü bu belgedir; eski bitiş oranları ve paket sıraları bağlayıcı değildir.
Ürün davranışını değiştiren dar SoT güncellemeleri ilgili uygulama diliminden önce yapılır.


2026-09-09 ek ilerleme: yöneticiye özel CSV şube önizleme/aktarım kodu eklendi.
Tekrar yükleme aynı kod/içerikte atlar; çakışmada parti geri alınır. 19 domain/form/CSV
ve 37 geçici PostgreSQL kontrolü geçti. İkinci migration da uygulanmadı. Kaynak
kurumdan alınan CSV'dir; internetten otomatik şube keşfi henüz geliştirilmedi.


2026-09-09 kabul ilerlemesi: geçici native PostgreSQL 17.10 üzerinde iki bağımsız
bağlantı/gerçek kilit beklemesiyle 12 kontrol geçti. Önceki yarış-test-bekliyor notu
lokal paket için kapandı. Kimlikli tarayıcı ve Supabase Auth/admin entegrasyonu
bekliyor; migration/deploy yapılmadı. Ayrıntı pilot runbook'un native test ekinde.


2026-09-09 son durum: Docker disk engeli çözüldü; yerel Supabase PostgreSQL 17.6
açıldı. 17 gerçek Auth/API kontrolü geçti. İki pilot migration yalnız ayrı yerel
sentetik şemaya uygulandı; prod uygulanmadı. Kimlikli browser ve tam tarihsel
şema/admin RPC kabulü sırada. Yerel ortam açık, .env.local değiştirilmedi.


2026-09-09 son kabul: yerel yönetici temel günlük akışı ve CSV aktarımı tarayıcıdan
doğrulandı; iptal dialog'u uygulama içine alındı. Tekrar import 0 ekleme/2 atlama,
iptal 0 aktif atama. Üretime migration/deploy uygulanmadı. Tam tarihsel şema ve
admin entegrasyonu ile diğer rol/mobil/ağ-hatası UI senaryoları ayrı bekliyor.


2026-09-09 rol/mobil ilerlemesi: yerel operasyon talep/ataması, açık ekranda yetki
kaldırılınca yazının reddi ve İK erişim reddi doğrulandı. Mobilde sabit sol menünün
içeriği sıkıştırması düzeltildi; 390 px pilotta yatay taşma yok, menü/Escape/masaüstü
geçişi çalışıyor. Tüm modüllerin mobil kabulü tamamlandı sayılmaz.


2026-09-09 ağ kabulü: 7 gerçek yerel SDK/servis kayıp-yanıt kontrolü geçti.
Tarayıcıda API kesintisi/geri dönüş sınandı; yanlış boş-plan/yetki mesajı ayrıldı,
pilot HTTP isteği başına 12 sn sınırlandı. Kalıcı komut kurtarma ve ilk oturumun
tüm kesinti senaryoları hâlâ kapsam dışı. Üretime yazma/deploy yok.


2026-09-09 kalıcı kurtarma: aynı tarayıcıda sayfa yenilemesi sonrası bekleyen
form/CSV işlem kimliği korunuyor; scoped RPC hesap/tenant değişimini reddediyor.
28 birim, 46 PostgreSQL, 14 yarış, 11 gerçek yerel API/servis kontrolü geçti.
Tarayıcı kesinti → yenileme → aynı form → başarı: 1 kayıt/1 olay ölçüldü.
Üçüncü migration yalnız yerel sentetik DB'ye uygulandı. Üretim değişmedi.
Sıradaki dar iş: bekleyen kimlikleri sunucu sonucuyla uzlaştırma; özellikle artık
tekrar gönderilemeyen atama/iptal ve kalıcı sunucu hataları. Ayrıntı kabul defterinde.
