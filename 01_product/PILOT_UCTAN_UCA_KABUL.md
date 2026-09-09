# Banka şubesi ve dönemsel otel — yerel uçtan uca kabul

2026-09-09. Bu plan gerçek müşteri pilot onayı değildir. Yalnız dedicated sentetik ortam, mevcut RPC/UI akışları; üretime veri veya e-posta gönderilmez.

## Sonraki çalışma

İki isim temsili olacak: Sentetik Kent Bankası ve Sentetik Sahil Oteli. Mevcut test kayıtları temizlenmez; senaryo kendi kayıt kimliklerini tutar. Yeni senaryo sonuçları diğer senaryoların toplamı sanılmaz.

1. Banka: CSV ile İstanbul/Ankara/İzmir üç şube, tek kişilik üç gün talebi; tekrar aktarımda mükerrerlik kontrolü. Bir personel aynı gün iki şubeye atanamaz. Günlük plan, açık kişi ve haftalık kişi-gün aynı kaynakla uzlaştırılır.
2. Otel: iki güne farklı kapasite, toplu talep, iki personel; gelmedi bildirimi ve yerine personel. Eski bildirim tarihi korunur, aktif yerleştirme ve gerçekleşme karıştırılmaz.
3. İki senaryoda firma+tarih seçimi, günlük kayda geçiş ve CSV çıktı başlık/sayıları doğrulanır. CSV üretimi mali hakediş/bordro onayı değildir.
4. Yanlış tenant ve yetkisiz rol, aynı komut tekrarı mevcut testlerle birlikte doğrulanır. Tarayıcı kabulü API testinin yerine geçmez.
5. Çıktıya senaryo kimlikleri, beklenen/ölçülen rakam, hangi katmanın test edildiği ve açık kapılar yazılır. Sadece başarılı ölçümler tamamlandı işaretlenir.

## Açık kapılar

Gerçek kaynaklardan otomatik şube keşfi, müşterinin gerçek pilot kabulü, e-posta/PKCE/hook uçtan uca, üretim şema/owner/redirect ön kontrolü, ticari paket hakları. Eski talep verilerini taşıma veya silme bu senaryo içinde yapılmaz.
