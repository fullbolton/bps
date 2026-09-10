# Blok 1 — Günlük operasyon ve işe başlama teslimi

> **043 — 2026-09-10: Haftalık PDF düzeni yayında.** Metin sütunları genişletildi; özetler tek satırda. Uzun personel listeleri yazdırmada 12 kişilik devam satırlarına ayrılıyor; şube/gün tekrarlanıyor, sayılar yalnız ilk satırda. Sentetik Chromium PDF kabulü: tek talep 1 sayfa, 40 talep 5 sayfa (önce 6), 100 personel 4 sayfa; kimlikler eksiksiz ve birer kez. Kaynak `b2c921b`; canlı `dpl_3496nCsZVRrsykaWEiCGJeKAdzyk`; build, sağlık 5/5 ve canlı haftalık ekran geçti. Yeni SQL/veri yok. Native yazdırma diyalogu ve canlı CSV byte kontrolü erişim engeli nedeniyle açık. [Kanıt](HAFTALIK_CIKTI_KABULU.md).

> **042 — 2026-09-10: Aktivite olay adları yayında.** İşe başlama planı, arama sonucu, bağımsız teyit, yeniden açma ve geçici arama üstlenme/bırakma ayrı başlıklara sahip. Yeni SQL yok. `0446684` push edildi; canlı `dpl_5wGgUBaofM2qMH3nCK9gMnpMzUwU`. İki mevcut test, TypeScript, production build, sağlık 5/5 ve kimlikli Dashboard okuma geçti. Mevcut canlı listede takip olayı olmadığından altı yeni başlık o listede ayrıca gözlenmedi; yeni test verisi oluşturulmadı. [Kanıt](AKTIVITE_ISE_BASLAMA_ADLARI.md).

2026-09-10 · **041: Yayında; çekirdek canlı kabul tamamlandı.**

[Canlı uygulama](https://www.bpsys.net/talepler/ise-baslama) · Kaynak commit: `565059e3e18b5628bc7f0edcffbdfe22ef7203eb` · Push edilen dal: `codex/block-01-release`. Main'e birleştirme yapılmadı.

## Kullanılabilir sonuç

Firma → şube → personel → günlük talep → atama → işe başlama planı → arama → bağımsız teyit → Dashboard zinciri canlı Supabase üzerinde çalışıyor. Haftalık plan ve müşteri CSV çıktısı planlama içindir; gerçekleşen mesai veya bordro onayı değildir.

035 yayını üzerine 036 tüm gün filtreleri, 037 Dashboard işe başlama özeti, 038 Fable ret/zaman/giriş düzeltmeleri ve 039 aday firma uyumluluğu birlikte yayımlandı. Aday ve aktif firma operasyona uygun; CRM durumu kendiliğinden değişmez. “Şubede olduğunu söylüyor” personelin beyanıdır; işe başlama ancak ayrı şube/saha teyidiyle kapanır.

## Yayın ve Supabase kanıtı

- Proje: `dffdzbmnmnokbftbujsy`.
- Bu teslimin 30 migration'ı canlı: önceki 27 kaynak hash'i değişmedi; bekleyen üçü sırasıyla `20260909002800` → `20260909002900` → `20260910000100` uygulandı.
- MCP'nin oluşturduğu sürümler, önce tam SQL SHA256 eşleşmesi ölçülerek dosya sürümlerine uzlaştırıldı. Son okumada üç sürüm/hash tekrar eşleşti.
- Dokuz eski fonksiyonun başlangıç gövdesi ölçüldü; uygulama sonrası 10 ilgili fonksiyonun owner/ACL/search_path kontrolü yapıldı. Anon execute yok; özel replacement yardımcısı authenticated'a açılmadı.
- 249 uygulama dosyası frozen kabul manifesti, commit ve temiz Vercel yüklemesiyle birebir eşleşti. SQL, env, doküman ve Git dizini yayına yüklenmedi; `vercel.json` dahil.
- Yeni deployment: `dpl_DZvtjhLdoishravp1YYwJnM9Uuoq`. Önce alan adından ayrı production build, ardından `www.bpsys.net` terfisi tamamlandı.
- Production sağlık 5/5; yetkisiz health 401, takip sayfası login yönlendirmesi, login 200. Doğru Supabase projesi ölçüldü. Bildirim e-postaları kapalı.

[Birleşik yayın envanteri](../supabase/manual/release-20260910-block01.json), [SQL sonrası kanıt](../supabase/manual/block-01-production-after.json), [sağlık ölçümü](../supabase/manual/block-01-live-health.json).

## Gerçek tarayıcı ve sunucu kabulü

Mevcut hesapla canlı arayüzden yalnız sentetik firma/şube/personel oluşturuldu. Aday firmada 2 kişilik talep ve 1 atama kaydedildi.

1. Tekrarlı arama aralığı reddedildi. Form alanları korundu, “kaydedilmedi” mesajı çıktı; yanlış belirsiz işlem uyarısı kalmadı.
2. Geç oluşturulmuş planda eski arama saatleri “Plan öncesi · uygulanmaz” oldu.
3. Atamadan sonra fakat plandan önce gerçekleşmiş manuel görüşme kaydedildi; sunucu zaman karşılaştırması iki sınırı doğruladı.
4. “Şubede olduğunu söylüyor” görüşmesi teyit oluşturmadı. Ayrı şube teyidi tamamlandı; tam sayfa yenilemede “İşe başladı · teyitli” kaldı.
5. Sunucu: attendance `present`, attendance revision 1, plan revision 3; tam bir plan, bir arama, bir teyit.
6. Dashboard: 1 talep / 2 ihtiyaç / 1 atama / 1 eksik; takip bekleyen 0, gün toplamı 1.

Ardından yalnız bu tur oluşturulan kesin kimlikler temizlendi: firma, şube, personel, talep, atama, plan, üç takip olayı ve yedi aktivite. FK bağımlılıkları kontrol edildi; beklenmeyen kayıt olsa transaction duracaktı. Önceki test firması/personeli korundu. Komut makbuzları ve kapalı komut izleri geç gelen tekrarların kayıt yaratmasını önlemek için kaldı. Gerçek hesaplara dokunulmadı; tam içerik yedeği alınmadı.

Temizlikten sonra Dashboard 0/0/0/0 ve takip 0/0; bu tur test aktiviteleri yok. [Canlı kabul kaydı](../supabase/manual/block-01-live-smoke.json), [sunucu ölçümü](../supabase/manual/block-01-live-smoke-server.json), [uygulanan dar temizlik](../supabase/manual/block-01-live-smoke-cleanup.sql).

## Yerel kabul ve kapsam sınırı

- 036: 60 atama üzerinden filtre/sayfalama, 8 native SQL kontrolü, gerçek Auth/API/tarayıcı.
- 038: 7 native kontrol; Fable yarış/kapsam regresyonları 26/26; ret mesajı ve zaman sınırı kabulü.
- 039: aday/aktif/pasif/null/bilinmeyen matrisi 9 native kontrol; 159 unit, genel 5/5, gerçek Auth zinciri ve build.
- 040: haftalık CSV gerçek HTTP 9/9; bağımsız CSV okuyucusuyla Türkçe, BOM, tırnak/noktalı virgül, formül güvenliği ve kapsam. Tarayıcı toplam, iptal filtresi ve boş hafta kontrolü.
- Manifest testi 2/2; yayımlanan kaynakların snapshot kontrolü geçti. Bu test sayıları farklı katmanlardır; tek toplam başarı sayısına dönüştürülmez.

CSV byte kabulü dedicated yerelde yapıldı; bu canlı turda CSV dosyasının içeriği ayrıca ölçülmedi. Native yazdırma/PDF sayfalaması açık. Sentetik canlı kabul gerçek müşteri pilotu değildir. Tarihsel `block-01-local-release.json` ve 035 yayın manifesti yeniden yazılmadı; güncel yayın envanteri yukarıdadır.

## Sıradaki çalışma

Çekirdek operasyon ve işe başlama yayın kapısı kapandı. Sonraki küçük dilim: Son Aktiviteler’de plan/arama/teyidin genel “İşlem kaydedildi” yerine anlaşılır olay adlarıyla görünmesi; ardından canlı müşteri çıktısı ve gerçek kullanım pilotu. Pilot için gerçek personel/şube verisi uydurulmayacak. Daha büyük yeni modül bu kullanım sonuçları ve mevcut ürün planıyla seçilecek.

Claude Code/Chat için bu dosya tek inceleme paketidir. Kullanıcının her tur ajanlar arasında mesaj taşımasına gerek yok; rutin ilerleme dış yanıtı beklemez.
