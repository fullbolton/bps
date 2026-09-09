# Günlük operasyon kontrol listesi

Durum: kodlandı ve yerel sentetik ortamda doğrulandı. Üretime taşınmadı.

## Amaç ve kapsam

Seçili firmanın seçili günündeki şube taleplerini tek listede incele. Mevcut haftalık
gerçekleşme RPC'sinin tek snapshot'ını kullan; bu dilimde yeni tablo/migration yok.
Verinin zaman damgası ve firma/gün kapsamı görünür. Tüm firmalar tarandı iddiası yok.

- Atama açığı: aktif talep ihtiyaç sayısı − aktif atama sayısı. Gelecek günlerde de görünür.
- Gelmedi: yalnız halen aktif atamalardaki absent kayıtları. Kaldırılmış/değiştirilmiş
  atamanın eski gelmedi bildirimi yeni bir aksiyon oluşturmaz.
- Bildirim bekliyor: günü gelmiş, aktif, unreported atama. Gelecek günler bekleyen
  gerçekleşme sayılmaz. Saat/vardiya tanımı olmadığından bugün için gecikti denmez.
- İptal talepler listeye girmez; gerçekleşme geçmişleri günlük/haftalık ekranda kalır.
- Tek talep birden çok işaret taşıyabilir. Toplam talep sayısı tekildir; işaretlerdeki
  kişi/atama sayılarını toplayıp toplam personel açığı diye sunma.
- Öncelik sırası: aktif gelmedi → atama açığı → bekleyen bildirim. Aynı grupta şube,
  pozisyon ve id ile kararlı sıralama. İşaret filtresi + şube/il/pozisyon araması.
- Açık yok mesajı yalnız başarıyla alınan tam snapshot için gösterilir. Bağlantı,
  yetki, kapsam veya veri doğrulama hatası boş/temiz liste olamaz.
- Günlük kayda git bağlantısı firma + gün + talep kimliğini taşır. Açılan sayfa ilgili
  kartı vurgular; kayıt görüntüleme/atama/düzeltme mevcut korumalı akışlarda yapılır.

Bu otomatik işaret listesidir; yeni görev, personel cezası, e-posta, ücret veya
bildirim gönderimi oluşturmaz. Kullanıcı tarafından işaret kapatma yok; kaynak
kayıt düzeltildiğinde yenilenmiş listeden düşer.

## Kabul

Yerine atama sonrası eski gelmedi kaydı listeden düşmeli; yeni unreported atama
beklemeli. Future unknown, iptal, sıfır talep, çoklu işaret, geçersiz snapshot,
yıl geçişi ve İstanbul günü sınırı birim testleriyle sınanır. Yerel Auth/API
mevcut role/tenant korumasını kullanır. Tarayıcıda filtre, hedef karta gidiş, yenileme
ve mobil taşma kontrol edilir.

## Ölçüm (2026-09-09)

61 birim test ve 33 gerçek yerel Auth/API/service kontrolü geçti. tsc temiz;
qa:static180 kaynak dosya, 0 FAIL / 2 mevcut WARN. SQL değişmediği için önceki
149 DB ve 37 native yarış kontrolü bu dilimde yeniden çalıştırılmadı.
Tarayıcı: 2 bildirim bekleyen talep → filtre/arama → hedef karta gidiş (kart üstü151px,
ring vurgusu) → Gelmedi bildirimi → 1 aktif gelmedi + 1 bekleyen; gelmedi ilk sıraya
çıktı. Mobil390px/main390px/scrollWidth390; konsol error/warn boş.

Son kapı: pilot bayrağı açık npm run build exit0; git diff --check temiz. Yerel dev dedicated sentetik Supabase ile yeniden başlatıldı. Üretim env dosyası değiştirilmedi.
