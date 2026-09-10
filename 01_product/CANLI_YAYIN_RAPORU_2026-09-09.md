# BPS — Canlı yayın ve ürün durum raporu

> **041 — 2026-09-10: Blok 1 yayında, çekirdek canlı kabul tamam.** Üç bekleyen SQL uygulandı; bu teslimin 30/30 migration kaynağı ve ledger sürümü doğrulandı. `565059e` kaynakları `codex/block-01-release` dalına push edildi; main birleştirilmedi. Vercel `dpl_DZvtjhLdoishravp1YYwJnM9Uuoq` www.bpsys.net üzerinde canlı, sağlık 5/5. Kimlikli sentetik aday firma → şube → personel → talep → atama → plan → arama → bağımsız teyit → reload ve Dashboard geçti. Bu tur test verileri temizlendi; eski kayıtlar korundu. CSV gerçek HTTP kabulü yerel 9/9; canlı CSV byte/PDF sayfalama kabulü ayrıca açık. Önceki bekliyor/yayınlanmadı kayıtları tarihseldir. [Tek teslim notu](BLOK_01_TESLIM.md).

> **040 — Blok 1 yerel teslim paketi hazır.** Haftalık CSV gerçek HTTP 9/9 ve bağımsız okuyucu, tarayıcı toplam/iptal/boş hafta kabulü geçti. Kabul betiği artık kendi geçici hesap/verilerini temizler. Toplu manifest 249 uygulama + 30 SQL + 17 kabul dosyasını doğrular; uygulama 036–039 kabul snapshotlarıyla birebir. Genel 5/5 ve manifest 2 test geçti. Yeni uygulama/SQL değişikliği, production/push/deploy yok. Yayın ve canlı kabul açık; başka modül açılmayacak. [Tek teslim notu](BLOK_01_TESLIM.md).

> **039 — Blok 1: aday firma uyumluluğu yerelde tamamlandı.** Aday ve aktif firmalar yeni operasyona uygun; CRM durumu kendiliğinden değişmiyor. Yedi SQL fonksiyonu, firma seçimi ve kurulum sayacı birlikte düzeltildi. 9 native kontrol, 159 unit/genel 5/5, gerçek yerel Auth ile aday firma → şube/CSV → talep → atama → plan/arama/teyit → yeni oturumdan okuma ve build geçti. Geçici veriler temizlendi. Canlı/push/deploy yok; 02800,02900,20260910000100 production’da bekliyor. Blok kapanmadı; sıradaki haftalık CSV kullanıcı kabulü ve birlikte teslim envanteri. [Kanıt](ADAY_FIRMA_OPERASYON_UYUMU.md).

> **2026-09-10 — Claude yanıtları değerlendirildi.** Chat canlı şube → personel → talep → atama zincirini 4/4 ölçtü; işe başlama arama/teyit kabulü açık. Aday firma uyumsuzluğu kodda doğrulandı, düzeltmesi sırada. Fable bulguları 038 ile yerelde giderildi. Yayın manifestinin 246 dosyası hem fb1b218 hem HEAD ile eşleşti; 036–038 çalışma ağacı farkları henüz yayında değil. Öncelik uyumluluk düzeltmesi, bağımsız kabul ve gerçek kullanım pilotu. [Kararlar ve görevler](CLAUDE_YANITLARI_KARAR_2026-09-10.md).

> **038 — Fable bulguları yerelde düzeltildi.** Kesin retlerde tek komutun sunucudan uzlaştırılması; plan öncesi manuel görüşme/teyit, saniye hassasiyeti ve dar giriş doğrulaması tamamlandı. 02900 yalnız dedicated yerelde. 157 unit, genel 5/5, yeni 7 SQL kontrolü, Fable yarış/kapsam regresyonları 26/26, gerçek yerel Auth/RPC, tarayıcı ret mesajı ve build geçti. Canlı 035 ve 27 migration değişmedi; 02800/02900 henüz production’da değil. [Düzeltme ve kanıt](FABLE_REVIEW_01_CODEX_TRIYAJ.md). Sıradaki iş 036–038 yayın adayının birlikte kabulü; production gerçek atama kabulü açık.

> Güncel037: Dashboard takip özeti de yerelde eklendi; canlı035değişmedi.035yayın kaynakları başka çalışma tarafından `fb1b218`, devir notları `2b53d98` commitine alındı; push durumu bu tur ölçülmedi. Fable sonuç raporu geldi; Codex ikiP2yi yeniden üretti. Sonraki iş `FABLE_REVIEW_01_CODEX_TRIYAJ.md` kapsamındaki038düzeltmeler.036ve037manifestleri yerel farkların ayrı snapshotlarıdır.

> Sonraki yerel fark036: 02800 ile gün geneli takip filtreleri eklendi; henüz canlı değil. Canlı035raporu geçerli; mevcut çalışma ağacında üç uygulama dosyası035snapshotından farklı. Ayrıntı `01_product/ISE_BASLAMA_TUM_GUN_FILTRELERI.md`. İncelemede035yayını ve036yerel farkı ayırın.

2026-09-09. Kaynak: yayın manifesti, dosya SHA256 listesi, migration dosyaları ve mevcut uygulama kodu. Bu rapor yeni bir deploy değildir; aynı gün yapılan yayının kapsamını açıklar.

Geliştirilmiş paketin tamamı yayınlandı; kapsam yalnız İşe Başlama Takibi değil. Paket içindeki 27 veritabanı değişikliği canlı Supabase'e uygulandı. 246 uygulama dosyasından oluşturulan yeni Vercel sürümü bpsys.net üzerinde çalışıyor. Bu sayı 246 özellik anlamına gelmez. İş planındaki henüz kodlanmamış özellikler bu kapsama dahil değildir.

## Nerede ne çalışıyor?

| Ortam | İşlev |
| --- | --- |
| https://www.bpsys.net | Yeni uygulamanın canlı Vercel yayını |
| Canlı Supabase | Kalıcı iş kayıtları, hesaplar, çalışma alanı/rol kontrolleri ve veritabanı işlemleri |
| localhost:3000 | Ayrı yerel test ortamı; sentetik kayıtlar canlıya kopyalanmadı |
| `/talepler/ise-baslama/onizleme` | Kayıt oluşturmayan örnek önizleme; gerçek takip `/talepler/ise-baslama` adresinde |

## Yayınlanan işlevler

| Bölüm | Kullanıcının karşısına çıkacaklar |
| --- | --- |
| Dashboard | Bugünün talep, ihtiyaç, yerleştirme ve eksik kişi özeti; günlük plana ve İşe Başlama Takibi'ne geçiş; son 20 operasyon/görev atama/belge olayı. Manuel risk kartı ve günlük otel e-postası bölümü kaldırıldı. |
| Şube ve personel dizini | Firma şubeleri ve çalışma alanı personeli; arama, sayfalama, aktif/pasif filtreleri ve yönetici için aktiflik yönetimi. |
| Toplu şube girişi | UTF-8 CSV şablonu, önizleme ve tek seferde en fazla 500 şube. Aynı kod/içerik tekrarında atlama; aynı kodda değişmiş içerikte açık hata. İnternetten otomatik şube bulma yok. |
| Günlük personel planı | Firma, şube, iş günü, hizmet/pozisyon ve kişi ihtiyacı; personel atama, toplu talep, ihtiyaç değiştirme ve iptal. Aynı gün personel çakışması ve kapasite kontrolleri. |
| Gerçekleşme ve yedek personel | Geldi/gelmedi/henüz bildirilmedi ayrımı; gerekçeli geçmiş ve personel değişimi. Eski kişinin geçmişi korunur. Bu kayıtlar çalışma saati veya bordro hesabı değildir. |
| Haftalık plan ve kontrol | Firma/hafta planı, atananlar ve açıklar; CSV/yazdırma; ayrı haftalık gerçekleşme özeti. Günlük kontrol listesinde atama açığı, gelmedi ve bildirim bekleyen işler. |
| İşe Başlama Takibi | Başlangıç saati, takip sorumlusu, arama saatleri/sonuçları, not ve tahmini varış; arama sahipliği; şube/saha teyidi; düzeltme ve olay geçmişi. Personelin kendi beyanı bağımsız işe varış teyidi sayılmaz. |
| Görevler | Gerçek kullanıcıya atama, atama geçmişi, tekli/toplu devir ve eski ekranın yeni değişikliği ezmesini engelleyen kontroller. Aktif işleri olan kullanıcının ilgili üyelik/rol değişiminde koruma. |
| Randevular | Görüşme sonucunu kaydetme ve gerekiyorsa takip görevini birlikte oluşturma; kısmi başarı ve tekrar kayıt risklerine karşı koruma. |
| Sözleşmeler ve belgeler | Yenileme takip görevi; ana PDF ve ayrı ek protokoller; belge sürüm geçmişi; yarım kalan yüklemeye devam/iptal. Dosya yüklemek sözleşmeyi kendiliğinden yenilemez. |
| Çalışma alanı kurulumu | Firma, şube, ekip, personel ve ilk plan için yönlendirme; gerçek kayıtlardan kurulum sayaçları. Davet kodu oluşturma/listeleme/iptal/kabul ve davet kontrollü uygulama kayıt ekranı. |
| Finansal Özet ve Luca | Gelişmiş özet düğmesiyle mevcut mali kaynak görünümü; Luca mizanını firma açık alacağına dönüştüren aktarım; yükleme/satırlar/özetin tek işlemde kaydı ve belirsiz yanıtta aynı işlemi tekrar deneme. |
| Raporlar | Günlük operasyon ve haftalık çıktılara erişim; önceki talep/iş gücü verileriyle yeni operasyon kaynaklarının açık ayrımı. |

Firmalar, Aktif İş Gücü, Evraklar, Ayarlar ve platform yönetimi gibi mevcut ekranlar aynı yayında korunuyor. Her mevcut modül baştan yazılmış değildir. Menü ve işlemler hesap rolüne göre değişir; bütün hesaplar bütün ekranları görmez.

## Veritabanına aktarılan paket

27 migration'ın tamamı `20260909000100`–`20260909002700` aralığındadır:

- 001–012: günlük operasyon, şubeler/toplu aktarım, güvenli işlem tekrarı, haftalık plan, toplu talep, ihtiyaç değişimi, gerçekleşme, yedek atama, dizin ve aktiflik.
- 013–016: görev geçmişi, randevu sonucu/takip bütünlüğü, görev devri ve üyelik/rol koruması.
- 017–020: sözleşme yenileme görevi, belge sürümleri, yükleme işlemleri ve ek protokoller.
- 021–024: son aktiviteler, kurulum, davetler ve güvenli yeni hesap başlangıcı.
- 025–027: günlük Dashboard, atomik Luca aktarımı ve İşe Başlama Takibi.

Canlı SQL metinlerinin yerel dosyalarla SHA256 eşleşmesi önceki yayın doğrulamasında ölçüldü. Bu rapor hazırlanırken yerel SQL ve uygulama dosyalarının yayın manifestindeki hash'lerle hâlâ aynı olduğu kontrol edildi. Test verileri, yerel yedekler ve Obsidian dosyaları uygulama paketiyle üretime yüklenmedi. Paket dışındaki eski `20260722000200_role_expand_asistan.sql` taslağı uygulanmadı.

## Henüz tamamlanmayanlar

- **Proje bazlı gelir/gider/maaş/kâr:** Gelişmiş özet düğmesi var; gerçek proje kârlılık motoru yok. Proje/masraf merkezi eşlemesi ve uygun Luca/bordro kaynakları gerekiyor. Mevcut mizan aktarımı firma alacağı üretir.
- **Otomatik şube keşfi:** Banka/TBB veya başka resmi kaynaktan şubeleri kendiliğinden bulma entegrasyonu yok; bugünkü toplu giriş CSV.
- **Otomatik iletişim:** Sistem kendi kendine telefon aramaz, WhatsApp/SMS/push göndermez. Davet kodunun otomatik e-postayla gönderimi eklenmedi. Gerçek e-posta doğrulama ve yeniden giriş akışının uçtan uca kabulü açık.
- **Saha ve bordro:** GPS/NFC varış kanıtı, ayrıntılı saat/mesai/izin/bordro, müşteri self-servis portalı bu sürümde yok.
- **SaaS ticarileştirme:** Abonelik, paket hakları, lisans/ücret tahsilatı ve kapsamlı işletim hazırlığı tamamlanmış değil.
- **Diğer açık işler:** Evraktan gerçek takip görevi/sorumlu oluşturma, eski talep kayıtlarının kontrollü yeni akışa taşınması ve Luca bekleyen işlem için sunucu durum uzlaştırma ekranı.
- **Ölçek sınırı:** İşe Başlama Takibi 50 atama/sayfa; mevcut arama/sorumlu/aksiyon filtreleri bu sayfaya uygulanır. Türkiye genelindeki tüm şubelerin tek görünümde performans kabulü yapılmadı.

## Yayınlandı ile kullanım kabulü arasındaki ayrım

Yerelde 23/23 genel/SQL/TypeScript/build kontrolü, 145 operasyon birim testi; takip için 16 PostgreSQL kontrolü ve gerçek yerel Auth/RPC/tarayıcı kayıt akışı geçti. Canlı yayın sonrası sağlık kontrolleri 5/5; mevcut hesapla Dashboard ve İşe Başlama Takibi okuması doğrulandı.

Bu kanıt bütün modüllerin canlıda gerçek veriyle uçtan uca denenmiş olduğu anlamına gelmez. Bugün canlıda atama olmadığı için arama→şube/saha teyidi yazma kabulü yapılmadı. Luca gerçek çıktı dosyası, canlı belge yükleme ve davet/e-posta akışlarının ayrı kullanıcı kabulü gerekiyor.

## Uygulamayı açınca

1. Canlı adresi kullanın; localhost ayrı test ortamıdır.
2. Dashboard ve Kurulum mevcut canlı kayıtları gösterir. Yerel örnek personel/şubeler görünmez; kayıtsız bölümler boş olabilir.
3. Firma → şubeler/toplu CSV → personel → günlük talep → atama → İşe Başlama Takibi → gerçekleşme → haftalık çıktı sırası izlenir.
4. Eski Personel Talepleri ekranı ile yeni Günlük Plan birlikte duruyor. Eski bir talep kendiliğinden günlük plana dönüşmez.
5. Önce tek firma/şube/personelle gerçek kullanım kabulü, ardından toplu şube yükü ve haftalık müşteri çıktısı denenmeli. Sonrasında proje finansalı ve diğer açık modüller ilerletilmeli.

Teknik yayın kaydı: [release-20260909.md](../supabase/manual/release-20260909.md), [manifest](../supabase/manual/release-20260909.json). Vercel deployment: `dpl_7dGwr1wHZc2REPBUYuJwjNnE6RZk`. Git commit/push bu yayında yapılmadı; Vercel'e yerel çalışma ağacının uygulama snapshot'ı gönderildi. Kaynak kodun Git'e aktarılması ayrı teslim adımı olarak açık.
