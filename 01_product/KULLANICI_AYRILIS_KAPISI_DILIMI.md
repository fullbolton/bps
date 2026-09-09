# Kullanıcı ayrılışı öncesi açık iş kontrolü — yerelde tamamlandı

## Ölçülen teslim — 2026-09-09

01600 yalnız dedicated yerelde. tasks aktif atanan guard + membership kaldırma guard
+ profile erişim kaybettiren rol guard. Eski admin RPC exact signature/oid/owner/ACL
korunur; hedef üyeliği artık silinip tekrar eklenmez. Oturum silme koşulu korunur.
Admin profile kilidi altında eski sıfır-üyelikli sahiplik de kontrol edilir; sadece
DELETE trigger'ına güvenilmez. Gerçek stored-function owner'ları SELECT/UPDATE ve
RLS filtrelemesi bakımından migration sonunda doğrulanır; filtreleyen admin owner
negatif testte reddedildi. Başka isolation BP004 ile reddedilir; taze READ COMMITTED
snapshot sözleşmesi kodla zorunludur. Eski43 rawclaim policy değişmedi.

19 native kontrol geçti: aktif işte rol/tenant ret, aynı tenant rol düzeltme,
çoklu üyelik onarımı, sıfır üyelikli eski iş, devir sonrası taşıma+session cascade,
INSERT/reassign/reopen/transfer ile gerçek kilit beklemeleri, RBAC, isolation, owner.
7 gerçek local Auth/API kontrolü: BP001 Türkçe servis mesajı, ret sonrası oturumlar
korundu; uygun devir sonrası gerçek yerel GoTrue sessions ve refresh_tokens0.
Görüntüleyiciye ordinary create0satır/BP003; task picker hedefleri görev erişimli
rollerle sınırlandı. BP002 üyelik, BP003 görev erişimi; transport hatası bunlara çevrilmez.

Son birleşik14/14 rapor: `/var/folders/fg/qm_gg6w16299dhr_lz9xr38r0000gn/T/bps-acceptance-A1VYcc/report.md`.96unit,26transfernative,
19guardnative ve diğer eski kabuller aynı koşuda geçti. Tam üretim Auth hook,
owner/şema ve admin tarayıcı tam ekran kabulü bu tur yapılmadı; eski admin fonksiyon
body'si native testte gerçek dosyadan, yerelAPI'de mevcut GoTrue session tablolarıyla
çalıştırıldı. Sentetik admin fixture yalnız bu teste ait, bütün admin ekranı baseline değil.
Hesap kapatma/silme yok; kapalı işin geçmişi korunur. Önceden geçersiz aktif işler
sessizce geri doldurulmaz; geçerli hedefe scoped devirle onarılabilir.
Sıradaki SOZLESME_YENILEME_SAHIPLIGI_DILIMI.md; P10 hesabın tüm yaşam döngüsü açık.

## Başlangıç planı (tarihsel)

2026-09-09. Manuel toplu devirden sonraki aşama. Önce yerel yarış kabulü; üretime uygulanmaz.

Amaç: aktif işi kalan kullanıcı eski tenant'tan çıkarılamaz veya görev erişimi olmayan
role geçirilemez. Yönetici önce mevcut toplu devir formundan işleri devreder; admin
üyelik/rol işlemi son durumu transaction içinde tekrar kontrol eder. İkisi tek kullanıcı
formunda otomatik birleştirilmez. Tamamlandı/iptal edilmiş iş geçmişi korunur.

Sadece admin ekranında count sorgusu yeterli değil: precheck ile değişiklik arasına
INSERT/UPDATE girebilir. tasks üzerinde yeni BEFORE trigger aktif atanan kişinin
profile satırını SHARE kilitler, ardından güncel üyelik/rolü kontrol eder. Admin mevcut
profile FOR UPDATE düzenini korur; membership DELETE/UPDATE guard da aynı profile
kilidi altında, kaldırılan tenant'taki aktif işi kontrol eder. profile rol UPDATE
BEFORE guard, görev erişimi olmayan yeni rolde aktif iş varsa reddeder. Salt count
okumaları task satırı kilidi almaz; adminin profile→task, normal yazıcının task→profile
kilit döngüsü kurulmaz. Trigger kurulumundan önce başlamış işlemler migration DDL
kilitleriyle tamamlanır. Yeni global görev table-lock gerekmiyor.

20260827000400 uygulanmış eski dosya değiştirilmez. Yeni migration mevcut admin RPC
imzasını/owner ve ACL'yi koruyarak yalnız üyelik güncellemesini düzeltir: korunacak
tenant üyeliğini DELETE edip tekrar INSERT etmez. Böylece aynı tenant rol düzeltmesi
ve çoklu üyelik onarımında korunacak üyelik yeni guard'a yanlışlıkla takılmaz. Diğer
üyelikler silinir; hedef yoksa eklenir. Oturum silme koşulu ve FK davranışı korunur.

Hedef aktif atanan için yönetici/operasyon/İK üyeliği; viewer/muhasebe/partner yeni
aktif işin sorumlusu yapılamaz. Tarihsel kapalı iş için yeni aktif üyelik aranmaz;
eski hatalı aktif iş kapanabilir veya geçerli üyeye devredilebilir. Önceden kalmış
geçersiz işler migration ile sessizce düzeltilmez. Kullanıcı silme ayrı ürün işidir.

Kabul: aktif işte tenant değişimi/rol düşürme ret ve tüm transaction rollback;
aynı tenant güvenli rol değişimi başarı; devir sonrası taşıma + sessions/token
cascade; işlem sürerken INSERT veya yeniden atama/yeniden açma + üyelik değişimi
yarışları iki gerçek bağlantıyla. Task trigger profil kilidini bekledikten sonra
fresh snapshot almalı. SQL session fixture üretim GoTrue şemasının tamamı değildir.
Yeni BP001 kodu admin UI'da “önce görevleri devredin” mesajına çevrilir. Ham DB
metni UI'ya taşınmaz. Eski43 policy'nin claim penceresini kapattığı iddia edilmez.

Uygulama ayrıntısı: kontroller taze statement snapshot için READ COMMITTED ister;
aktif görev yazısı, üyelik kaldırma, erişim kaybettiren rol değişikliği ve admin RPC
başka isolation düzeyini BP004 ile reddeder. Böylece REPEATABLE READ eski snapshot
kullanarak bekleme sonrası kontrolü geçemez. API varsayılan akışı değişmez.
Yeni guard kapalı tarihsel işte üyelik aramaz; eski RLS ayrıca uygulanır, bu yüzden
üyeliği zaten kaybolmuş kişinin işini uygulamadan kapatma garantisi verilmez. Geçerli
kişiye scoped devir çalışır; native testte geçmiş hatalı işi kapatma SQL bakım yoludur.
