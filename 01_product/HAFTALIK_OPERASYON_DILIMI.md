# Haftalık operasyon ve müşteri çıktısı

2026-09-09 — günlük pilotun sonraki ürün dilimi.

Firma ve haftanın içinden bir gün seçilir; görünüm pazartesi–pazar aralığıdır.
Bir talep bir satırdır: gün, şube/il, hizmet, pozisyon, ihtiyaç, atanan, açık ve
atanmış personel adları. Günlük plana bağlantı aynı firma/günü açar. Üst toplamlar
kişi-gündür; bir personelin farklı günleri ayrı sayılır. İptaller varsayılan gizli,
seçenekle görünür; aktif ihtiyaç/atama/açık toplamlarına katılmaz.

CSV ve yazdırma müşteriye verilecek mevcut firma/hafta listesini üretir. Çıktıda
firma, hafta, verinin alınma zamanı ve aktif/iptal kapsamı yer alır. CSV tüm metin
hücrelerini tırnaklar ve formül başlangıçlarını metne çevirir. İndirme öncesinde
yetki ve veri tekrar sunucudan doğrulanır; başarısız sorguda eski liste indirilmez.
Gönderme/e-posta yoktur. Bordro, puantaj veya gerçekleşen mesai iddiası yoktur.

Tek RPC aynı veritabanı snapshot'ında yalnız seçili firmanın yedi günlük talepleri
ve bu taleplere atanmış personeli getirir; tüm personel dizini getirilmez. Rol,
üyelik ve tenant kontrolü + mevcut RLS sürer. Hatalı/eksik veri boş liste sayılmaz;
firma/hafta değişince eski çıktı kapatılır. En fazla 5000 talep; aşımda eksik çıktı
vermek yerine hata. Gerçek üretim verisi/migration/deploy bu dilimin parçası değil.

Kabul: hafta/yıl/artık yıl sınırları; iptal hariç toplam; sıfır atamalı/açık talep;
rol/tenant ve firma izolasyonu; yedi gün dışı kayıt yok; CSV tırnak/satır/formül;
kimlikli yerel tarayıcı, mobil tablo ve veri hatasında çıktı engeli.

2026-09-09 kabul düzeltmesi: Blob URL yolu uygulama içi tarayıcıda indirme olayı
üretmedi. Yeni yetkili sunucu attachment endpoint'iyle gerçek download olayı ve
6 HTTP testi geçti. HTTP'den kaydedilen CSV standart okuyucuda doğrulandı. Native
PDF sayfalaması hâlâ açık; Codex native UI erişimi araç tarafından reddedildi.

2026-09-10 — 040: Yerel CSV kabulü yenilendi; gerçek HTTP 9/9, iki CSV kapsamı bağımsız okuyucuda doğrulandı. Yeni betik kendi geçici hesap/iş kayıtlarını finally ile temizliyor. Tarayıcı kişi-gün/iptal/boş hafta kabulü geçti; native PDF açık. Ayrıntı BLOK_01_TESLIM.md. Yeni uygulama/SQL değişikliği veya production yayını yok.
