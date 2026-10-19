# İK 018–026 kurulum paketi

Durum: **Yerel kurulum ve hata sonrası geri alma provası geçti. Güncel üretim metadata karşılaştırması ve eşlenmiş kurulum geçti; yayın yapılmadı.**

## Kanıt

- Tarihsel başlangıç: f02edb0, 207 migration, son sürüm 20261019001700. Bu bilgi önceki yayın kaydından gelir; güncel canlı durumu iddiası değildir.
- check-candidate.mjs yayımlanmış 207 kaynak dosyasının değişmediğini, dokuz adayın sırasını ve otomatik dal yayınının kapalı olduğunu doğrular.
- prepare.mjs her migration için ledger kilidi, tam beklenen sürüm listesi, 5 saniye lock_timeout ve 60 saniye statement_timeout içeren transaction üretir. DDL ve ledger kaydı aynı transaction'dadır. Manifest kaynak ve kurulum SHA-256 değerlerini tutar.
- test.mjs geçici sentetik PostgreSQL'de yanlış sıra reddini; her dosya için ledger yazımından hemen önce hata, public/Storage katalog geri alımı, tekrar denemeyle başarı ve ikinci kurulum reddini doğruladı. Son ledger 216; İK aktivasyon kabulü ve scoped şirket sayısı sıfır.
- preflight.sql yalnız metadata ve toplamlar okur; çalışan satırlarını veya dosya içeriklerini almaz. Sorgu yerel baseline üzerinde çalıştırıldı.

## Yayın sırası ve durma koşulları

1. Üretimde preflight.sql ve üst klasördeki catalog.sql salt okunur çalıştırılır. Ledger tam 207 tarihsel sürümle karşılaştırılır; katalog/Storage policy/trigger farkları açıkça incelenir. Beklenmedik hr-private bucket, açık İK aktivasyonu veya yayın bariyeri varsa durulur. Yerel prova üretim yük/kilit süresini kanıtlamaz.
2. Güncel üretim kataloğuyla uyumlu baseline provası tamamlanır. Önceki kaynak commit'inin eşit olması üretim şemasının eşit olduğunu kanıtlamaz.
3. Aday uygulama HR preview=false ile oluşturulur. Mevcut canlı uygulamanın yeni SQL ile geri dönüş uyumluluğu ayrıca test edilir; test edilmeden eski deployment güvenli rollback olarak sunulmaz. Üretimde özel evrak açılacağı zaman sunucu doğrulayıcısı için gereken mevcut env erişimi ayrıca doğrulanır; anahtar rapora yazılmaz.
4. SQL dosyaları manifest sırasıyla uygulanır. Her başarıdan sonra ledger ölçülür. Hata halinde sonraki dosyaya geçilmez; mevcut state ölçülmeden yeniden başlanmaz. Tabloları, audit kayıtlarını veya dosyaları silerek rollback yapılmaz.
5. SQL zinciri tamamlandıktan sonra uygulama yayınlanır. Günlük operasyon, modül geçmişi ve kapalı İK rotası smoke test edilir. Şirket İK aktivasyonu ve preview açılması bu kurulum paketinin parçası değildir.

## Tekrar çalıştırma

```sh
node qa/hr-release-20261019/documents/check-candidate.mjs
node qa/hr-release-20261019/documents/prepare.mjs
node qa/hr-release-20261019/documents/test.mjs
```

Bu komutlar üretime bağlanmaz. Üretilen SQL dosyaları tek başına yayın yetkisi veya güncel şema uygunluğu kanıtı değildir. İzin/satın alma onay zincirleri bu evrak paketinden sonraki ayrı ürün işleridir.

## Güncel ölçüm — 19 Ekim 22:01 Türkiye

Üretim 207 migration, İK kapalı, hr-private bucket yok; ölçümde bekleyen kilit/diğer aktif transaction yok. Public ve Storage katalog karşılaştırmasında çözülmemiş fark sıfır. Bilinen fixture yetkisi yerelde eşlendi, sekiz kesin CHECK parantez farkı önceki inceleme listesiyle doğrulandı. compare-baseline.mjs eşlenen tabana dokuz migration kurdu; 216 kayda ulaşıldı. Mevcut canlı fonksiyon tanımları ve ACL'leri değişmedi. Eski uygulamanın davranışsal geri dönüş kabulü henüz yapılmadı. Üretim dosya/çalışan içeriği alınmadı; yayın yok.

API yöntemi: [Supabase salt okunur sorgu](https://supabase.com/docs/reference/api/v1-read-only-query). Canlı ölçüm bir anlık kanıttır; yayın anında tazelenmelidir.

## Geri dönüş kabulü — 19 Ekim

f02edb0 gerçek kaynaklarıyla 026 şemasında 10 PostgreSQL/istemci grubu ve yerel tarayıcı smoke geçti: giriş, dashboard, modül hakları/geçmişi, kapalı İK 404, açık günlük operasyon okuması. package-lock eşitliği doğrulandı. Kanıt rollback-contracts-result.json ve rollback-browser-result.json. Bu kapsam eski uygulamanın tüm özelliklerini veya production runtime'ını kapsamaz. Aday production build/env ve yayın anında güncel ön kontrol hâlâ zorunlu.

## Aday build ve ortam kontrolü

850 uygulama testi, statik 0 hata/uyarı, TypeScript ve production build geçti. Derlenmiş runtime'da oturumsuz upload login yönlendirmesi kusuru düzeltildi; preview kapalı iki origin için JSON 404 kabulü geçti. Vercel env isimleri mevcut, HR preview tanımsız; değerler okunmadı. Güncel kanıt release-check-result.json ve environment-metadata.json. Yayın yapılmadı; yayın anı ön kontrolü, SQL+deploy ve canlı smoke kalır.


## 19 Ekim — Vercel üretim ortamında kapalı İK adayı hazır

7363719 kaynakları sabit git archive ile yalnız uygulama ve build yapılandırmaları olarak çıkarıldı; 543 dosya/3.25 MB dry-run kontrolü geçti. Env, QA ve SQL dosyaları dağıtıma taşınmadı. Vercel üretim ortamı ayarlarıyla --prod --skip-domain kullanıldı; yalnız adaya özel build/runtime BPS_HR_PREVIEW_ENABLED=false verildi. dpl_71PNEthK8K91vYJ8baoorTMr7X6X READY oldu. Koruma kaldırılmadan Vercel CLI yetkili erişimiyle login HTML 200 ve HR upload POST no-store JSON 404/no-redirect kabulü geçti. Oturumlu iş akışı bu adayda henüz test edilmedi.

Aynı tur güncel üretim metadata karşılaştırması yenilendi: ledger 207; İK aktivasyonu kapalı, çözülmemiş katalog farkı sıfır. Eşlenen sentetik tabana 018–026 kurulumu tekrar geçti. Canlı www.bpsys.net hâlâ dpl_3pr5omHWjqsUAAVaL7sLksb7P8GU sürümüne bağlı. Üretim SQL yazımı ve alan adı geçişi yapılmadı. Aday build hazır olması yayın tamamlandı anlamına gelmez. Kanıt staged-deployment.json, staged-smoke.json ve yenilenen baseline-comparison.json. Sıradaki adım yayın anı ön kontrolü, dokuz korumalı SQL kurulumu, hazır adayı promote ve oturumlu salt okunur smoke.


## 19 Ekim — İK 018–026 altyapısı canlıya alındı

Güncel üretim salt okunur ön kontrolü ve eşlenmiş yerel kurulum geçti. Dokuz hash doğrulamalı SQL transaction sırayla uygulandı; her adım sonrası ledger tam listeyle karşılaştırıldı. Üretim 207→216 migration; son sürüm 20261019002600. PostgREST şeması yenilendi. hr-private özel bucket, İK enabled/onaylı aktivasyon/scoped şirket toplamları sıfır. Gerçek iş verisi temizlenmedi, içerik yedeği alınmadı.

7363719 kaynaklı dpl_71PNEthK8K91vYJ8baoorTMr7X6X hazır dağıtımı promote edildi. Bağımsız Vercel inspect www.bpsys.net eşleşmesini doğruladı. Oturumlu genel bakış, günlük operasyon firma/gün/özet, şirket modülleri ve değişiklik geçmişi açıldı; İK sayfası 404 ve oturumsuz upload JSON no-store 404. Üretimde çalışan/evrak yazma testi yapılmadı; İK hâlâ kullanıma kapalıdır.

İlk açılışta şirket doğrulaması uzun süre bekledi; mevcut oturum yenilendikten sonra şirket adı ve sayfalar yüklendi. Kalıcı başarısızlık görülmedi, fakat sebep/gecikme ölçümü yapılmadığı için ayrı takip maddesi bırakıldı. Bunu düzeltilmiş performans sorunu olarak sunmuyoruz. Kanıt documents/production-installation.json, production-postflight.json, live-http-smoke.json ve release.json. Önceki aday/hazırlık kayıtları tarihseldir; güncel canlı yayın kaydı release.json.

Sıradaki işler: şirket doğrulama beklemesini ölçmek ve sınırlamak; İK kontrollü aktivasyon kabul planı; ardından onaylanmış izin ve satın alma yönetici onay akışları. Otomatik dal yayını kapalı kalır.
