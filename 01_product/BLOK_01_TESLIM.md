# Blok 1 — Günlük operasyon ve işe başlama teslimi

> **041 — Yayın sürüyor (doğrudan kullanıcı devam talimatı).** Supabase OAuth yenilendi; 27 eski ledger hash’i ve 9 mevcut fonksiyon gövdesi baseline ile eşleşti. Üç yeni migration uygulandı, kaynak SHA256 ve owner/ACL doğrulandı; ledger sürümleri hash korumasıyla dosya sürümlerine uzlaştırıldı. Yeni frontend henüz yayında değil. Bu üst kayıt önceki otomatik çalışma kısıtı ve üç SQL bekliyor notlarının güncel durumudur.

2026-09-10 · Durum: yerel kabul paketi hazır; production yayın ve canlı blok kabulü açık.

## Kullanılabilir sonuç

Firma → şube → personel → günlük talep → atama → işe başlama planı → arama → bağımsız teyit → Dashboard. Haftalık plan ve müşteri CSV çıktısı bu zincirin planlama görünümüdür; gerçekleşen mesai veya bordro onayı değildir.

Yayındaki 035'e göre yerel farklar: 036 tüm gün filtreleri; 037 Dashboard işe başlama özeti; 038 Fable ret/zaman/giriş düzeltmeleri; 039 aday firma uyumluluğu. Bu kayıt ve üretilecek kaynak manifesti tek inceleme paketidir; her dilim için ayrı Claude sohbeti gerekmez.

## SQL ve yayın sırası

1. `20260909002800_start_board_filters.sql`
2. `20260909002900_start_event_validation.sql`
3. `20260910000100_candidate_company_operations.sql`
4. Bu üç migration ile uyumlu frontend.

Üçü de dedicated yerelde uygulandı. Bu otomatik çalışma üretime migration/veri yazmaz, push veya deploy yapmaz. Kayıtlı canlı baseline `dpl_7dGwr1wHZc2REPBUYuJwjNnE6RZk`, Git yayın içeriği `fb1b218`; HEAD `2b53d98` aynı 246 yayın kaynağını içerir. Yeni çalışma ağacı bundan ileridedir. Üretimdeki 27 eski migration dosyası değişmeden korunur.

## Kabul kapsamı

- 036: filtreler sayfalama öncesi; 60 atama, 8 native kontrol, yerel API ve tarayıcı.
- 037: Dashboard takip sayısı ve gün/aksiyon bağlantısı; yerel sayaç ve tarayıcı kabulü.
- 038: 7 native kontrol, Fable yarış/kapsam regresyonları 26/26, gerçek yerel Auth/RPC ve tarayıcı ret UX'i.
- 039: aday/aktif/pasif/null/bilinmeyen durum matrisi 9 native kontrol; gerçek yerel Auth zinciri aday firmadan tek teyide kadar; form kullanılabilirliği; 159 unit, genel 5/5 ve build.
- 040 haftalık CSV: gerçek yerel HTTP 9/9; iki kapsam bağımsız Python CSV okuyucusunda doğrulandı. Tarayıcıda toplam, iptal filtresi ve boş haftada indirme engeli geçti.

Bu testler aynı katman değildir ve tek bir “tüm testler geçti” sayısına birleştirilmez. Sonuçların ayrıntısı ilgili dilim notlarında ve kabul günlüklerindedir.

## Kalan teslim kapıları

- Kaynak ve SQL snapshotını doğrula; manifest değişen kodu eski kabul ile karıştırmasın.
- Git teslimi/push ve gerçek Supabase/Vercel yayını mevcut otomasyon kapsamı dışında; yapılmış sayılmaz.
- Yayın sonrası canlıda seçilmiş kayıtla plan → arama → bağımsız teyit → reload, aday firma akışı ve çıktı kabulü. Chat'in 035 üzerinde ölçtüğü dört adım bu yeni yayın kabulünün yerine geçmez.
- Native yazdırma/PDF sayfalaması ölçülmedi; CSV kabulü bunu kapsamaz.
- Test verisi temizliği yalnız bilinen kayıt manifesti ve mevcut yetki kapsamında; belirsiz şirket adı üzerinden silme yok.

Dış inceleme bu pakete bağlı tek bulgu listesiyle yapılabilir. Kritik somut açıklar giderilir; rutin ilerleme dış ajan yanıtını beklemez. İlk blok canlı kabulü kapanmadan yeni modül açılmaz.

## 040 — Toplu teslim kanıtı

`supabase/manual/block-01-local-release.json`: 249 uygulama dosyası (Vercel yapılandırması dahil), 30 SQL dosyası ve 17 kabul aracı dosyasının SHA256 envanteri. 30 SQL = yayındaki 27 dosyanın değişmeyen kaynakları + production bekleyen 3 dosya. Bu sayı 30 migration'ın canlıda olduğu anlamına gelmez. `.DS_Store` yalnız metadata olarak hariç; .env ve symlink/special dosyalar kabul edilmez.

Uygulama dosyaları 035 yayın manifesti üzerine 036–039 kabul manifestleri sırayla uygulanarak oluşturulan 249 dosyalık beklentiyle birebir eşleşti. Son uygulama build'i 039'da geçti; 040 uygulama veya SQL gövdesi değiştirmedi, test/teslim araçlarını geliştirdi. Git HEAD bu paketin commit'i değildir; pakette çalışma ağacı olduğu açıkça yazılıdır.

```sh
node scripts/block-release-manifest.mjs --check
```

Kontrol ekleme/silme/içerik değişikliğinde hata verir. `--write` bu bloğun kabul edilmiş uygulama snapshotlarıyla eşleşmeyen uygulama kodunu yeni bir manifest yazarak kabul edilmiş gösteremez. Daha sonraki dilimler kendi kabul kaydıyla bu sözleşmeye eklenmelidir. İki manifest regresyon testi geçti; genel kabul runner'ına dahil edildi. Genel 5/5 raporu: `/var/folders/fg/qm_gg6w16299dhr_lz9xr38r0000gn/T/bps-acceptance-Ykz7Oa/report.md`. Son metadata/Vercel kapsam düzeltmesinden sonra manifestin iki testi ve gerçek `--write`/`--check` tekrar geçti.

### Haftalık müşteri CSV kabulü

Güncellenen `scripts/qa-local-export.mjs`, yalnız doğrulanmış dedicated yerel ortamda kendi sentetik aday firması ve hesabını kurar. 9 HTTP kontrolü: aktif/iptal dahil iki attachment, anon, yabancı tenant, geçersiz firma, boş hafta, oturum sonrası rol kaybı, üyelik kaybı ve kendi geçici kayıtlarının temizliği. Gerçek byte'lar bağımsız CSV okuyucusunda çözüldü: 2 aktif talep, 4 ihtiyaç, 2 atama, 2 açık; üçüncü iptal aktif toplamların dışında. UTF-8 BOM, Türkçe, tırnak/noktalı virgül, formül başlangıcının metin kalması ve başka haftanın dışlanması geçti.

Kanıt: `/private/tmp/bps-weekly-export-7UD7Hx/report.json`, aynı dizinde yalnız sentetik `active.csv` ve `including-cancelled.csv`; çalışma logu `/private/tmp/bps-block1-export.log`. Önceki kabul betiği hesap/iş kaydı bırakıyordu; yeni sürüm finally ile yalnız kendi kimliklerini temizler. Eski birikmiş kayıtlar bu tur silinmedi. İlk genel kabul denemesi fixture kurulumu kilidi nedeniyle başlamadı; kilit serbest kaldıktan sonraki koşum 5/5 geçti.

Tarayıcı sentetik aday firmada 2/4/2/2 toplamlarını gösterdi. İptal filtresi üçüncü satırı ekledi; aktif toplamlar değişmedi. CSV düğmesine basıldı, yenileme tamamlandı ve ekran korundu. Sonraki boş haftada CSV/PDF düğmeleri devre dışıydı. Tarayıcının kaydettiği dosya Downloads erişimi olmadığı için ayrıca açılamadı; indirilebilir gerçek dosya içeriğinin kanıtı yukarıdaki aynı endpoint HTTP testidir. Native PDF sayfalaması hâlâ açık. Tarayıcıya ait geçici iş kayıtları da temizlendi.

### Buradan sonraki iş

Mevcut yerel paket yeni bir modüle genişletilmeden teslim edilecek. Yayın yetkili bir çalışmada önce `--check`, ardından yalnız listelenen üç SQL, uyumlu frontend, deployment/SQL doğrulaması ve canlı kabul uygulanır. Bu otomasyon production/push/deploy yapamaz; bu adımlar bitmiş gösterilmez. Aynı yerel kanıtlar gerekçe olmadan her heartbeat'te tekrar koşturulmaz. Yeni bulgu veya kullanıcı yönlendirmesi yoksa mevcut yayın bekleme durumu sessiz korunur.
