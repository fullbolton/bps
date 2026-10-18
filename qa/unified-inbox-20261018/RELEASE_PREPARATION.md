# Ortak bildirim — yayın hazırlığı

18 Ekim 2026. **Hazırlandı; üretime uygulanmadı.**

## Güncel ölçüm

production-preflight.json salt okunur üretim sorgusudur. Ledger 186 sürüm; yeni ortak kutu fonksiyonları yok; geçici yayın bariyeri yok. Görev/atama geçmişi/duyuru RLS ve sahipleri ile altı bağımlı fonksiyon gövde hash'i kaydedildi. Gerçek içerik okunmadı veya yedeklenmedi.

## Sıra ve tek kaynak

1. 20261018000300_task_inbox_capture.sql
2. 20261018000400_task_inbox_access.sql
3. 20261018000500_announcement_inbox.sql
4. 20261018000600_workspace_inbox.sql

Önceki QA SQL kopyaları kaldırıldı; testler ve Storage tarayıcı harness'i aynı migration manifestini kullanır. Dosya SHA256 değerleri release-manifest.json içindedir. Sonuçta ledger 190 olmalı. İlk migration ölçülen altı bağımlı gövde farklıysa durur; bilinmeyen şema üzerine sessiz kurulum yapmaz. Her dosya ayrı transaction; kurulum kısmen ilerlerse ledger ölçülerek yalnız kalan dosyalar devam ettirilir. Kör yeniden çalıştırma veya ledger repair yok.

## Kabul

`NODE_PATH=/tmp/bps-module-release-runtime/node_modules npm run qa:inbox:local`

44/44 gerçek yerel PostgreSQL testi geçti. Mevcut capture/access senaryolarına ek olarak:

- Görev ve duyuru okundu komutu config kilidini beklerken modül kapatıldı: commit sonrası BM001, read_at NULL.
- Aynı komutlar profil kilidini beklerken üyelik rolü/sürümü değiştirildi: commit sonrası 42501, read_at NULL.
- İki bağlantıda bekleme pg_stat_activity ile gözlendi; yalnız ardışık çağrı testi değildir.
- Bağımlı fonksiyon gövdesi sentetik transaction içinde değiştirildi; kurulum INBOX_DEPENDENCY_DRIFT ile ilk tabloyu yaratmadan reddedildi. Rollback sonrası normal zincir uygulandı.
- 10.000 duyuru gerçek teslim trigger'ını çalıştırarak eklendi. Görev ve başlangıç duyurusuyla unread 10.002, sayfa 30. Beş yerel ölçüm yaklaşık 16–27 ms. Ölçüm tek bağlantılı sıcak yerel DB'dir; üretim gecikmesi veya binlerce alıcıya tek duyuru dağıtım testi değildir.
- Fixture bütünlük testleri 5/5, TypeScript temiz, envanter 139 application/27 database/7 eski pending. QA altındaki yerel entegrasyon testleri ayrı qa:inbox:local komutundadır.
- Statik 0 FAIL / 2 WARN: dört yeni yayınlanmamış migration için package-migration-drift ve önceden mevcut iki erişilmeyen bileşen uyarısı.

İlk test çalıştırması modül kapalı hata kodunu 42501 beklediği için başarısızdı; gerçek mevcut kapı BM001 döndürür. Test doğru sözleşmeye düzeltildi, ürün koruması değiştirilmedi. Genel DB komutu yanlışlıkla QA testinin scripts envanterine yazılması nedeniyle başlamadı; envanter kaydı kaldırılıp ayrı npm komutu eklendi. Genel 27 DB dosyasının bu tur geçtiği iddia edilmiyor.

## Yayın adımları ve kalan kapılar

- Büyük alıcı kitlesinde tek duyuru dağıtımı ölçülecek.
- Ortak UI'da üç kaynak, şirket/rol değişimi ve sekmeler arası ses tarayıcı kabulü tamamlanacak.
- Uygulama anında ledger/dependency hash ön kontrolü yeniden çalıştırılacak; bu kaydın ölçüm saati gelecekteki yayına kanıt değildir.
- SQL sırası uygulanıp tablo RLS, grants, trigger ve ledger doğrulanacak. Veri geçmişi geri doldurulmaz; kurulmadan önceki atama/duyurulara yeni bildirim üretilmez.
- Bundan sonra NEXT_PUBLIC_BPS_WORKSPACE_INBOX_ENABLED=true ile uygulama yayınlanır. Önce flag açılmaz; eksik RPC halinde UI hatayı gösterir, eski kutuyu başarılı ortak kutu diye sunmaz.
- Uygulama geri dönüşünde flag kapatılıp legacy conversation kutusu kullanılır; SQL tabloları veya teslimler silinmez. Flag yalnız UI/action kapısıdır; kurulu capture trigger'ları olay üretmeye devam eder.

Son kayıtlı canlı app 6cd6007; bu tur Vercel yayını yok. Otomatik e-posta ve push kapsam dışı.

## 18 Ekim — kalan yerel kabul kapıları

45/45 yerel DB testi geçti. 5.001 alıcıya gerçek announcement_execute_v1 komutundan tekil teslim doğrulandı; yazar dışarıda, mükerrer yok. Ayrıntılı son ölçüm fanout.json (tek bağlantı, yerel DB; üretim SLA iddiası değil).

Gerçek yerel Auth/PostgREST ile 31 duyuru + 1 görev + 1 talep etiketi aynı kutuda 33 okunmamış olarak görüldü. Talep hedefi doğru firma, gün, şube ve mesajı açtı. İlk denemede harness'in BPS_DAILY_OPERATIONS_ENABLED ayarı eksikti; üretim kodu değiştirilmeden bu ayarla yeniden başlatılıp hedef kabulü tamamlandı.

İki sekmede Hesabım: bir sekmede ses etkinleştirilince diğeri kullanıcı hareketi istemeye devam etti. İkinci sekmede sesi kapatınca iki sekme de kapalı oldu. Sesin fiziksel hoparlörden kaç kez çıktığı ölçülmedi; tür+UUID dedupe mantığı otomatik test kapsamındadır.

İkinci sekmeden Synthetic B'ye geçince ilk sekme açık A kutusunu kaldırıp “Şirketinizi yeniden doğrulayın” korumasına geçti. B kutusu 0 ve boş; A içeriği yok. Kanıt cross-tab-company-guard.png ve company-b-empty.png. Rol matrisi DB testleriyle doğrulandı; her rol için ayrı tarayıcı turu yapılmadı.

Test sekmeleri kapatıldı; yerel harness temiz kapatıldı. Gerçek veri değiştirilmedi. Üretim kurulumu ve yayın sonucu ayrıca kaydedilecek.


## Üretim SQL kurulumu

Dört migration, ledger kilidi ve başlangıç 186 sürüm kontrolüyle tek transaction içinde uygulandı. Bu kurulumda dosyalar arası kısmi commit yok; install.sql yürütülen pakettir. Son ölçüm production-install.json: 190 sürüm, 2 RLS tablo; authenticated SELECT/INSERT/UPDATE/DELETE kapalı; 11 postgres-owned SECURITY DEFINER fonksiyon, 6 public RPC authenticated için açık, 5 yardımcı kapalı; anon/service EXECUTE kapalı; 2 etkin capture trigger. Mevcut veriler geriye dönük bildirimlere çevrilmedi. Uygulama yayını ayrı kaydedilir.


## ÜRETİMDE — yayın sonucu

Kaynak a0230dd, Vercel dpl_GaMr7ESWyJuM6CjnxeczNd44Esih www.bpsys.net alanına promote edildi; bağımsız inspect READY doğruladı. Ortak kutu flag true; otomatik e-posta false. Canlı kimlikli Hesabım ekranında ortak kutu başlığı, hatasız boş liste ve ortak ses kontrolleri doğrulandı. Gerçek kayıt veya tercih değiştirilmedi. Production build geçti; release.json ve production-install.json kanıttır. Önceki hazırlık ve “uygulanmadı” paragrafları tarihsel aşamaları gösterir; bu bölüm güncel sonucu belirtir.
