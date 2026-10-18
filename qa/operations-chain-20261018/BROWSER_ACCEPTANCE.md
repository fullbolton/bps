# Operasyon Faz 1 — gerçek tarayıcı kabulü

18 Ekim 2026. Ürün kaynağı 6300bee ile aynı; çalışma dalı 332002c üzerine yalnız QA değişiklikleri. Üretime veri yazılmadı.

## Ortam ve yeniden çalıştırma

`node qa/operations-chain-20261018/browser.mjs` yerel disposable Storage/Auth/PostgREST ve Next uygulamasını açar. Logdaki `bps_storage_http_<PID>` veritabanı için `node qa/operations-chain-20261018/browser-seed.mjs <DB>` yalnız sentetik şube ve iki personel oluşturur. Talep/atama/teyit/çalışma kayıtları tarayıcıdan oluşturulur. Launcher SIGINT/SIGTERM ile kendi harness temizliğini tetikler. Başlangıçta Docker kapalıydı; başlatıldı. İlk denemede operasyon feature flag'leri eksikti; test launcherına eklendi. Ürün güvenliği gevşetilmedi.

## Doğrulanan UI zinciri

1. Synthetic A / Synthetic HTTP / Faz 1 Şubesi için 18 Ekim günlük talebi, bir kişilik ihtiyaç oluşturuldu.
2. Deniz Test atandı. İşe başlama planında 21:00 ve chain-a sorumlusu kaydedildi.
3. Gelemeyecek görüşmesi kaydedildi; ekran Yedek personel gerekiyor gösterdi, ilgili talebe yönlendirdi.
4. Ece Test için Kabul etti görüşmesi kaydedildi. UI açıkça Personel ataması değiştirilmedi dedi.
5. Ayrı Değişimi kaydet işlemi Ece'yi atadı. Başlangıç ve sorumlu planı devralındı.
6. Şubede olduğunu söylüyor görüşmesi kaydedildi; teyit yok durumu korundu.
7. Şube yetkilisi + Sentetik Şube Yetkilisi tanığıyla teyit kaydedildi. İşe başladı · teyitli ve günlük Geldi oluştu.
8. Çalışma ekranı Henüz çalışma kaydı yok gösterdi: şube teyidi saat onayı üretmedi.
9. Aynı sentetik atamada bitmiş 21:00–21:30 aralığı ve 5 dakika mola girildi. Bu gerçek çalışan çalışma iddiası değildir; UI hesabı ve iş akışı senaryosudur. Net 25 dakika taslak → gönder → onaylandı, sürüm 1 → 2 → 3 ve üç işlem geçmişi kaydı.
10. Şirket değiştir ile Synthetic B'ye geçildi. A'nın aynı firma URL'si erişim uyarısı verdi; talep ve personel görünmedi.
11. A'ya dönüş ve yeni sayfa yüklemesinde Onaylandı / sürüm 3 / net 25 dakika / üç olay korundu.

Saat inputlarına otomasyon fill işlemi tek başına React değişikliğini tamamlamadı; normal klavye ok tuşlarıyla değerler tamamlandı ve DOM değerleri kontrol edildi. Bu araç davranışı ürün hatası olarak sınıflandırılmadı.

## Veritabanı son durumu

UI ile oluşturulan request: `8ef81f78-af49-433b-b976-6a0e7d3f834e`.
Salt okunur kontrol: 1 aktif atama, 1 kaldırılmış atama, 1 confirm olayı; work.status=approved, net_minutes=25, revision=3. Bu DB yalnız sentetik yerel fixture'dır.

## Mobil ve kanıtlar

- Masaüstünde tüm ana zincir yürütüldü.
- 390×844 viewport: onay dialogu görsel incelendi; document.scrollWidth=390, innerWidth=390. Mobil alt menü ve kapatma düğmesi görünür.
- `browser-confirmed.png`: şube teyidi.
- `browser-work-approved-mobile.png`: onaylı çalışma ve net süre.
- `browser-tenant-isolation.png`: diğer şirkette eski firma erişim reddi.
- Viewport sıfırlandı; test sekmesi kapatıldı. Fiziksel telefon testi değildir.

## Yetki kabulünün sınırı ve kalan

`rehearse.mjs` 10 birleşik kontrol grubu geçti. İK/muhasebe/görüntüleyici talepleri, arama ve çalışma yazmaları reddedildi; operasyon rolü talep/atama/gerçekleşme/çalışma gönderimini yapabildi, onay ve yeniden açma reddedildi. Bu rol matrisi gerçek DB fonksiyonlarında aynı sentetik aktörün rolünü sırayla değiştirir; bağımsız hesapların HTTP/tarayıcı testi değildir.

F1-A ana tarayıcı zinciri tamamlandı. F1-B mobil ve tenant geçişi tamamlandı; ayrı rol oturumlarıyla HTTP/UI olumlu/olumsuz kabulü kaldı. F1-C nihai kapanış bu kalan doğrulamadan sonra yapılacak. Bu tur açık P0/P1 bulunmadı; tüm ürünün hatasızlığı iddiası değildir. Ürün kodu veya migration değişmedi, yeni üretim yayını gerekmiyor. Sonraki geliştirme yönü güçlü bağımsız İK modülüdür; yeni operasyon özellikleri eklenerek faz uzatılmayacak.

## Operatörün kısa kullanım yolu

Günlük planda firma/gün seç → talep aç → personel ata → işe başlama takip saatini/sorumlusunu belirle → görüşmeleri kaydet. Gelemeyen personelde yedek görüşmesini kaydet ve ayrıca değişimi yap. Personelin beyanından sonra şube/saha yetkilisiyle teyit et. Çalışma bitince saat ve molayı kaydet, onaya gönder; yetkili yönetici onaylasın. Görüşme kabulü atama, Geldi kaydı çalışma/ücret onayı değildir.

## 18 Ekim — bağımsız HTTP rol kabulü ve Faz 1 kapanışı

Beş ayrı sentetik kullanıcı gerçek GoTrue parola oturumuyla giriş yaptı; JWT sub ve active_tenant_id doğrulandı. PostgREST RPC çağrılarında operasyon hesabı talep/atama/yoklama/çalışma kaydı/gönderme yaptı, onay ve yeniden açma reddedildi. Yönetici ayrı oturumla onayladı: 480 net dakika. İK, muhasebe ve görüntüleyici ayrı hesapları talep/işe başlama/çalışma yazamadı; reddedilen komutlar makbuz bırakmadı. 5/5 HTTP rol grubu geçti. Kanıt `qa/operations-chain-20261018/role-http-result.json`. Oturumlar aynı aktörün rolünü değiştirerek taklit edilmedi. Tokenlar kaydedilmedi. İlk fixture denemesi auth.users trigger'ının zaten profil oluşturması nedeniyle durdu; yalnız sentetik fixture profil upsert'i düzeltildi, ürün değişmedi.

Tekrar komutu: `BPS_LOCAL_BROWSER=1 BPS_OPS_ROLE_HTTP=1 node qa/contract-write-20261015/storage-http.mjs`. Harness yalnız izinli yerel sunucuda geçici DB/containers açar, finally temizler; bu modda Next başlatılmaz.

F1-A yönetici tarayıcı zinciri ve DB son durumları, F1-B bağımsız HTTP rol matrisi + tenant geçişi + 390×844 görünüm tamam. F1-C: bu kabul kapsamında açık P0/P1 bulunmadı, kullanım yolu BROWSER_ACCEPTANCE.md içinde; ürün/migration farkı yok, gereksiz yayın yapılmadı. **Operasyon Faz 1 kapanmıştır; sıradaki geliştirme İK-1 personel/organizasyon/istihdam çekirdeğidir.** Canlı ürün kaynağı hâlâ 6300bee; QA commit'leri yeni ürün sürümü değildir.

Açık ve fazı uzatmayanlar: rol bazlı düğmelerin her hesapta ayrı görsel incelemesi (backend yetkisi kabul edildi); fiziksel telefon/zayıf ağ; gerçek Luca/Excel mutabakatı; bulut felaket kurtarma; bildirim sağlayıcısı ve ikincil modüllerin kendi kabulü. Bunlar tamamlandı sayılmaz. İK geliştirmesi operasyon kapalı tenantta bağımsız çalışacak; müşteri şubesi ile şirket içi organizasyon karıştırılmayacak. Yeni operasyon özellikleri yeni faz iş listesidir.
