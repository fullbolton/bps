# Fable 03 — B-2 personel birleştirme ve proje raporlama

Durum: yerelde tamamlandı; üretime uygulanmadı. Tarayıcı smoke, üretim preflight ve production build bu tur yapılmadı.

## Düzeltilen davranış

- Eski personel koduyla aktarım, birleştirme sonrası kalan kişiye çözülür. Çok aşamalı birleştirme zincirleri desteklenir.
- Kullanılmış kodu aynı kanonik kişiye eşlemek idempotenttir; gerçekten başka kişiye veya tenant'a taşıma engeli korunur.
- Aynı kaynak satırının dakika düzeltmesi kabul edilir; geçmiş satırdaki özgün person_id değiştirilmez.
- Farklı kaynak satırı/kodla aynı kişinin aynı şube-gün-slot çalışmasını tekrar ekleme engeli kanonik kimliği kullanır.
- Eşleme ekranı ve çalışma detayları güncel kişinin kimliğini/adını gösterir. Aylık ve şube kişi sayısı aynı kanonik kişiyi tek sayar; dakika ve kayıt toplamı korunur.
- Birleştirme öncesi hazırlanmış önizlemenin kimliği değişmişse onay REPORT_CONFLICT döner; kullanıcı yeni önizleme hazırlamalıdır. Eski onay kayıtları/resolved/previous_rows yeniden yazılmaz.

## Kilit ve migration

`20261004001400_reporting_canonical_people.sql` sekiz fonksiyonun tam imzasını ve kaynak gövde SHA-256 değerini doğrular; drift varsa transaction durur. Owner ve ACL, pg_get_functiondef üzerinden korunur. Kanonik yardımcı zaten tenant ile sınırlıdır, tarayıcıya yeni EXECUTE yetkisi verilmez.

Eşleme ve aktarım hazırlama/onaylama, proje ve kişi kilitlerinden önce tenant bazlı ortak advisory kilit alır. Merge, worker/kişi kilitlerinden önce aynı anahtarın özel kilidini beklemeden dener; raporlama çalışıyorsa mevcut TALENT_MERGE_BUSY hatasıyla geri döner. Bekleyen raporlama READ COMMITTED altında kilit sonrası güncel kimliği okur; başka isolation seviyesi REPORT_CONFLICT ile reddedilir. Bu, yalnız bu RPC yollarını koordine eder; servis hesabının doğrudan tablo yazımları bu protokole dahil değildir.

Eski deployment'tan çalışan RPC çağrıları tamamlanmadan cutover yapılmamalı. Bu migration ile tenant modülü dalının fonksiyon gövde/hash üreticileri birlikte gözden geçirilmeli; değişmiş fonksiyona eski hash bekleyen modül migration'ı otomatik uygulanmamalı.

## Test kanıtı

- Gerçek foundation/import/monthly/detail migration'ları sentetik PostgreSQL 17'de kuruldu.
- Eski doğrulayıcıda REPORT_PERSON_UNMAPPED hatası yeniden üretildi, patch sonrasında geçti.
- Yeni 10 test: aktarım/düzeltme, mükerrer, eşleme, aylık/detay, eski önizleme, iki yönlü eşzamanlı kilit senaryosu, zincirleme merge, yanlış kaynak kimliği, tenant sınırı.
- Önceki hotfixlerle birlikte ilgili beş DB dosyasında 33/33 geçti; tüm DB envanteri çalıştırılmadı.
- 523/523 uygulama testi; TypeScript temiz; statik 0 FAIL, mevcut 2 WARN; test envanteri ve migration üretici kontrolü geçti.
- Merge fonksiyonunun yeni meşgul-kilit yolu gerçek gövdesiyle çalıştırıldı. Tam personel birleştirme mutasyonu bu fixture'ın kapsamı değildir: diğer testlerde birleştirilmiş durum SQL ile hazırlanır; bekleyen aktarım yarışında aynı özel advisory kilit alınır. Merge scope fixture'ı gerçek reporting scope'a delegasyon yapar.

## Korunan sınırlar

Daha önce iki ayrı kişi altında onaylanıp sonradan aynı kişiye birleştirilen çakışan tarihsel çalışmalar otomatik silinmez veya dakikaları azaltılmaz. Varsa düzeltme öncesi kaynak dosyalarla incelenmelidir; preflight bu grupların yalnız sayısını verir. Birleştirme, geçmiş çalışma süresinin yanlış olduğunu tek başına kanıtlamaz.

Kanonik çözümleme sorgu anında yapılır; geçmiş veriyi topluca güncelleyen bir işlem yoktur. Bu turun küçük sentetik testleri üretim hacmindeki gecikme ölçümü değildir; büyük proje/ay sorguları canlıya geçmeden EXPLAIN ile kontrol edilmelidir.
