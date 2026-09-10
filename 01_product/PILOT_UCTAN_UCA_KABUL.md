# Banka şubesi ve dönemsel otel — yerel uçtan uca kabul

## 045 — 2026-09-10: Birleşik Auth/RPC/HTTP kabulü geçti

`scripts/qa-local-sector-pilot.mjs` dedicated sentetik Supabase kimliğini ve Docker portlarını doğrular. Mevcut uygulamadan ayrı, env dosyasız kaynak kopyası 3010 portunda kullanıldı. Test kendi hesabını ve iki şirketini oluşturur; finally bloğu yalnız bu kimliklerin kayıtlarını ve hesabını temizler. Gerçek müşteri pilotu veya tarayıcı kabulü değildir.

- Banka: CSV'den İstanbul/Ankara/İzmir üç şube. Aynı komut tekrarı eski makbuzu döndürdü; yeni komutla aynı CSV üç satırı atladı. Üç gün/üç şube = 9 ihtiyaç, 3 atama, 6 açık. Her gün 3/1/2; aynı personel aynı gün ikinci şubeye atanamadı.
- İşe başlama: personelin varış beyanı teyit sayılmadı. Bağımsız teyidin tekrarı ikinci kayıt oluşturmadı; yeni oturumda tek teyit ve present görüldü.
- Otel: iki günün ihtiyacı 2 ve 3; 4 atama, 1 açık. Gelmeyen personel yerine yedek atandı; replacement tekrarı aynı sonucu verdi. Eski absent kaydı ve bildirim zamanı korundu. Yeni atama başlangıç planını devraldı ve bağımsız teyit edildi. Gerçekleşme: 1 present, 1 tarihsel absent, 3 unreported; plan toplamlarıyla aynı kavram değildir.
- İki şirketin gerçek loopback HTTP CSV dosyaları bağımsız Python CSV okuyucusunda firma kapsamı ve ihtiyaç/atama/açık toplamlarıyla eşleşti. Günlük okumalar haftalık toplamlarla uzlaştırıldı.
- Yanlış tenant ve mevcut oturumda rol kaybı reddedildi. Geçici sentetik kayıtlar ve hesap temizlendi.

Sekiz kontrol grubu geçti. Son rapor: `supabase/manual/local-20260910-045.json`; sentetik CSV dosyaları `/private/tmp/bps-sector-pilot-XCa0Rn`. Çalıştırma: `BPS_PILOT_HTTP_ORIGIN=http://127.0.0.1:3010 node scripts/qa-local-sector-pilot.mjs`. Araç yalnız iki sabit loopback adresini kabul eder; route kontrolü hesap oluşturmadan önce yapılır.

İlk koşumda CSV adımı 20 saniyede zaman aşımına uğradı; cleanup geçti. Kısıtlı curl bağlantı hatasından “sunucu kapalı” sonucu çıkarılması düzeltildi: 3000 portunda repo süreci vardı, ağ izinli istekte de 20 saniye yanıtsız kaldı. Mevcut süreç durdurulmadı. İzole 3010 koşumu geçti; günlük uzlaştırma eklenince son koşum yeniden geçti.

Uygulama dosyaları canlı 044 manifestiyle birebir eşleşiyor. Bu dilim test/kanıt ekler; yeni SQL veya ürün deploy'u gerektirmez. Açık kapılar: gerçek müşteri pilotu, iki senaryonun tarayıcı kabulü, native yazdırma diyalogu ve canlı CSV byte kontrolü. Yerel HTTP CSV ölçümü canlı dosya ölçümü diye etiketlenmez.

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
