# BUILD_PRIORITY.md

## Amaç
Bu dosya, hangi ekran ve component setinin hangi sırayla inşa edilmesi gerektiğini tanımlar.

---

## Öncelik Mantığı
Yürütme sırası ürün merkezini koruyacak şekilde tanımlanmalıdır.

### Operational Backbone First
Önce ürünün operasyonel omurgası kurulmalıdır:
- Dashboard
- Firmalar
- Firma detay
- Sözleşmeler
- Personel Talepleri
- Aktif İş Gücü
- Randevular
- Görevler
- Evraklar

### Management Visibility Layer Next
Finansal Özet ve Raporlar aynı tam iç ofis ürününün parçasıdır.
Ancak build sırası içinde yönetim görünürlüğü katmanı, operasyon çekirdeği yönünü bozmayacak şekilde bir sonraki odak olmalıdır.

### Full Internal Release Can Include Both
Tam iç ürün sürümü, operasyon omurgası ile yönetim görünürlüğü katmanını birlikte içerebilir.
Buradaki ayrım sürüm değil; uygulama ve yürütme önceliğidir.

---

## Paket 1 — İskelet
Önce ortak altyapı:
- Layout
- Sidebar
- Topbar
- PageHeader
- KPIStatCard
- DataTable
- StatusBadge
- FilterBar
- SearchInput
- EmptyState

Amaç:
Tüm sistemin ortak çerçevesini kurmak.

---

## Paket 2 — Çekirdek Yüzeyler
- Dashboard
- Firmalar listesi
- Firma detay header
- Firma detay genel bakış
- Firma detay temel zaman çizgisi tabı
- Sözleşmeler listesi

Amaç:
Ürün omurgasını ilk kez kullanılabilir hale getirmek.

Not:
- Buradaki zaman çizgisi beklentisi basit, read-only firma olay listesi derinliğidir.

---

## Paket 3 — Ticari ve Takip Derinliği
- Sözleşme detay
- Randevular
- Görevler

Amaç:
Sözleşme riski, görüşme disiplini ve aksiyon zincirini görünür kılmak.

---

## Paket 4 — Operasyon Derinliği
- Personel Talepleri
- Aktif İş Gücü
- Evraklar

Amaç:
Ofis operasyonunu tam görünür hale getirmek.

---

## Paket 5 — Yönetim ve Zeka Katmanı
- Finansal Özet
- Raporlar
- Zaman Çizgisi derinleştirme
- Ayarlar
- Firma sağlık skoru
- Yenileme merkezi

Amaç:
Yönetim görünürlüğü ve kalite katmanını artırmak.

Not:
- Finansal Özet aynı tam iç ürünün parçasıdır.
- Finansal Özet ve Raporlar, operasyon çekirdeği bozulmadan hemen sonra veya kapasite varsa kontrollü paralelde ilerleyebilir.
- Bu katman şirket geneli yönetim görünürlüğü içindir; operasyon omurgasının yerine geçmez.
- Raporlar için ilk beklenti sabit read-only tablolar, temel filtreler ve export aksiyonlarıdır.
- Zaman Çizgisi'nin ileri filtreleme ve daha zengin analiz katmanı bu pakette derinleşir.
- Ayarlar ilk aşamada sıkı sınırlandırılmış yönetici konfigürasyonudur; dinamik workflow builder, detaylı permission editor veya finans motoru değildir.

---

## Full Internal Release Kapsamı
- Dashboard
- Firmalar
- Firma detay
- Sözleşmeler
- Personel Talepleri
- Aktif İş Gücü
- Randevular
- Görevler
- Evraklar
- Finansal Özet
- Raporlar
- Ayarlar

Not:
- Tam iç ürün, operasyon omurgası ile yönetim görünürlüğü katmanını birlikte içerebilir.
- Yürütme önceliği yine de önce operasyon omurgasını korumalıdır.

---

## Red Flags
Aşağıdaki işler öncelik sırasını bozar:
- önce raporlara girip çekirdek akışları eksik bırakmak
- finansal özet katmanına erken girip operasyon çekirdeğini eksik bırakmak
- Finansal Özet'i ayrı ürün veya ayrı sürüm gibi konumlandırmak
- ortak component sistemi kurulmadan ekran çoğaltmak
- firma detay çözülmeden yan modüllere yatırım yapmak
- aktif iş gücü ekranını çalışan özlük sistemine çevirmek
- evrak modülünü yalnızca klasör ekranı gibi yapmak
