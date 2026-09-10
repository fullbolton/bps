# BPS — Yeni çalışma alanı tasarımı

2026-09-10: Kullanıcı tüm UI/UX düzenini değiştirme yetkisi verdi. Görsel değişiklikler çalışan veri ve yetki akışları üzerinde uygulanır.

## Tasarım yönü

Koyu lacivert gezinme, açık gri çalışma yüzeyi, beyaz kartlar ve mavi aksiyonlar. Durum renkleri anlamını korur: yeşil tamamlandı, amber dikkat, kırmızı hata. Süs amaçlı grafik/sayı yok. Mobilde başlık ve aksiyonlar alt alta; tablolar kendi alanlarında yatay kayar.

## 055 kapsamı

- Menü: Çalışma Alanı / Müşteri ve Hizmet / Yönetim. Mevcut rol görünürlüğü korunur. Genel Bakış adı; aktif sayfa aria-current. Mobil native dialog ve Escape.
- Üst bar: bulunulan modül, bildirimler, kullanıcı ve geniş ekranda saat. Ana içeriğe klavye atlama bağlantısı.
- Ortak sayfa başlıkları, 44 px ana butonlar, 16 px kart köşeleri, KPI hiyerarşisi, okunabilir ikincil metin ve filtre etiketleri.
- Dashboard: gerçek ve role/feature flag'e bağlı hızlı erişimler; KPI; günlük operasyon; takip masası; duyurular ve son aktiviteler. Aktif olmayan Yönetici İnisiyatifleri kaldırıldı. Tarihe göre filtrelenmeyen görev kartının başlığı Bekleyen Görevler oldu.
- Klavye odak göstergeleri ve azaltılmış hareket tercihi.

Bu tur yeni SQL, veri taşıma veya yetki modeli değişikliği içermez. Ortak bileşenleri kullanan sayfalar yeni temeli alır; her modülün iç iş akışını baştan tasarladık iddiası yok.

## Sonraki tasarım blokları

1. Firma ve sözleşme detayları: ilk düzen 056 ile uygulandı; kalan form/alt sekme ayrıntıları izlenecek.
2. Günlük plan ve işe başlama: yoğun masa görünümü ile mobil saha kullanımının ayrılması.
3. Form ve paneller: alan gruplama, hata konumu, klavye/odak yönetimi.
4. Finans ve proje özeti: dönem, veri kaynağı, gelir/maliyet ayrımının aynı hiyerarşide sunulması.

## Kabul

Yerel TypeScript ve izole production build geçti. Dashboard, Firmalar, Görevler, Randevular, Sözleşmeler, Finansal Özet: 1280 px ve 390 px taşma kontrolü, mobil menü/Escape ve firma oluşturma regresyonu geçti. Ekranlar yönetici rolü yüklendikten sonra ölçüldü. Kanıt: `/private/tmp/bps-company-feedback-dBwxnN`. Dashboard ve mobil Firmalar ekranları görsel olarak incelendi. Kritik tarihler/duyurular dedicated fixture eksikliği nedeniyle hata gösteriyor; bunların başarılı veri okuması bu testin kanıtı değildir. Sentetik şirketler ve test hesabı temizlendi. Üretime yayımlanmadı.

## 056 — Firma ve sözleşme detay düzeni

Firma sayfasındaki işlevsiz Zaman Çizgisi sekmesi, Son Bahsetmeler ve Bekleyen Yönlendirmeler kutuları kaldırıldı. İletişim ürün planı korunur.

Firma başlığı: firma çalışma alanı etiketi, durum/sektör/şehir, uzun adın satıra kırılması ve mobilde alt satıra geçen işlem grubu. Günlük personel planına görünür buton. Ortak bölüm gezintisi yatay kaydırılır; seçili bölüm `aria-pressed` ile duyurulur, normal klavye Tab/Enter davranışı korunur. ARIA tab widget iddiası yok.

Sözleşme başlığı: dönem / bitişe kalan süre / sorumlu notu / tutar ayrı tanım alanları. Geçmiş bitiş tarihi eksi gün yerine “gün önce doldu” olarak gösterilir. PDF/ekler tam genişlikte; maddeler/yenileme/bağlı işler geniş ekranda iki sütuna ayrılır. Bölüm bağlantıları gerçek hash/anchor kullanır; sabit üst bara scroll payı bırakılır. Durum seçicinin erişilebilir adı ve dokunma alanı eklendi.

Sözleşme firma bağlantısında legacy id olmayan kayıt artık `#` yerine gerçek `company_id` ile açılır. Veri yazma, izinler ve SQL değişmedi. Detay sayfasındaki diğer veri okuma hataları bu tasarım bloğuyla çözülmüş sayılmaz.

Kabul: TypeScript ve diff kontrolü geçti. Sentetik firma/sözleşmeyle 1280/390 px uzun başlık, sekme seçimi, yenileme hash bağlantısı, UUID firmaya dönüş ve sayfa taşması kontrolü geçti. Firma oluşturma/inline mevcut seçimi/hata/bekleme regresyonu da geçti. Kanıt: `/private/tmp/bps-company-feedback-OtPkYj`. Test şirketleri, bağlı sözleşme ve Auth hesabı temizlendi. Test veri modeli sınırlı: not tablosu olmayan fixture içindeki hata veya henüz yüklenen alt paneller, bütün detay veri akışlarının başarılı kabulü sayılmaz. Mobil/masaüstü başlık ve düzen görsel olarak incelendi. Üretim yayını yapılmadı.

## 057 — Günlük plan ve işe başlama takibi

Günlük plan: kaydırılabilir operasyon gezinmesi, firma/gün filtre kutusu, seçili firma ve günün aktif taleplerinden türeyen dört özet (talep, istenen, atanan, açık). Yükleme sırasında özet gösterilmez. Şube/personel hazırlığı açılır alana taşındı; talep formu ve atamalar görünür kaldı. Ana butonlar 44 px, kartlar ve personel satırları ortak tasarıma uyar. Firma varken seçim yoksa “firma seçin” denir.

İşe başlama: ortak sayfa başlığı, filtre alanı, gün toplamı/filtre toplamı/bu sayfa ayrımı. Bu sayfa sayısı tüm günün aksiyon sayısı gibi sunulmaz. Personel kartında metinli durum rozeti, arama adımları, belirgin bağımsız teyit butonu ve ayrı geçmiş alanı. Kayıtlı görüşme mavi; teyitli işe başlama yeşil. Personelin “şubedeyim” beyanı teyit yerine geçmez. Yetki, revision, komut uzlaştırması, sorumlu kilidi ve zaman kuralları değişmedi.

Kabul: günlük talep, başlangıç durumu ve gönderim hatası testleri 18/18 geçti; TypeScript geçti. Yerel banka/otel tarayıcı kabulüne yeni günlük özet, 1440/390 px taşma, başlangıç planı/görüşme kaydı/reload ve aksiyon filtresi eklendi. İlk koşu yeni yedek atama teyidinde START_TIME aldı; fixture zamanları DB clock_timestamp kaynağına taşındı (ürün kontrolü gevşetilmedi). Nihai kabul: 15 grup geçti. Gerçek UI üzerinden başlangıç planı ve yolda görüşmesi kaydedildi, reload sonrası korundu; teyit sayılmadı. Teyitli kayıt aksiyon filtresinde görünmedi. Günlük özet, 1440/390 px taşma, talep açma/atama/gelmedi/yedek ve CSV regresyonları geçti. Kanıt: `/private/tmp/bps-sector-pilot-tkkQ8B`. Masaüstü günlük plan ve mobil işe başlama görselleri incelendi. Kendi sentetik kayıtları ve Auth hesabı temizlendi. Ürün SQL veya üretim yayını yok.
