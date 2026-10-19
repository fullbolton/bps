# İK 018–026 kurulum paketi

Durum: **Yerel kurulum ve hata sonrası geri alma provası geçti; üretim ölçümü ve yayın yapılmadı.**

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
