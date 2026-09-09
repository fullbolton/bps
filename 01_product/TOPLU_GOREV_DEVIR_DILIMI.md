# Toplu görev devri — yerelde tamamlandı

## Ölçülen teslim — 2026-09-09

01500 dedicated sentetik yerelde. Yönetici Görevler ekranından kaynak/hedef,
önizleme ve en fazla100 işi tek komutta devreder. Kaynak güncel üyelikten ayrılmış
olabilir; hedef yönetici/operasyon/İK üyesi olmalı. Tam sayı SQL'den, liste aynı
statement snapshot'ında ilk100; sayfa listesinin PostgREST sınırı kullanılmaz.
26 native kontrol: rollback, history, canonical snapshot, eşzamanlı komut/replay,
rol/üyelik beklemesi, yabancı/kapalı/eksik görev ve göreve erişemeyen hedef ret.
1204 işte100 satır önizleme1ms (tek yerel ölçüm); indeks planı doğrulandı, prod SLA değil.
Gerçek yerel Auth/API10/10; SDK fetch sınırında başarılı cevap kaybı ve aynı komut
retry tek history. Tarayıcı eski önizleme→yenile, iki görev için doubleclick devir,
sonuç2 ve ayrı yeni sorguda kaynakta0; listede hedef kişi göründü. 673px görünüm okundu.

Gönderim sırasında kapanma/ikinci gönderim engellenir. Bilinmeyen sonuçta form aynı
komutla tekrar eder; komut yalnız form belleğindedir. Pencere/sekme kapanınca veya
scope değişince kaybolur, sonradan başka cihazdan komut kurtarma yok. Receipt orijinal
parti sonucudur; kalan iş sayısı fresh sorgu, sonradan yeni atama yapılabilir.

Son birleşik paket96 unit+11runner+legacy+static194/0FAIL/2WARN+tsc+181opsPGlite+
48opsnative+16tasknative+22appointmentnative+26transfernative+19membershipguardnative+
42opsAPI+build =14/14 exit0. Rapor: `/var/folders/fg/qm_gg6w16299dhr_lz9xr38r0000gn/T/bps-acceptance-A1VYcc/report.md`.
Ayrı local transferAPI10, membershipguardAPI7 geçti. 01600 tamamlanan ikinci aşama
KULLANICI_AYRILIS_KAPISI_DILIMI.md'de: aktif işi bırakacak rol/üyelik değişimini engeller.
Bu, hesabı silme/devre dışı bırakma veya otomatik devir değildir.16 migration yalnız
yerelde; eski000400 üretimde zaten uygulanmış dosya olarak değişmeden kaldı.
Sıradaki SOZLESME_YENILEME_SAHIPLIGI_DILIMI.md.

## Başlangıç sözleşmesi (tarihsel)

2026-09-09. Sıradaki P07 dilimi. Önce bu sözleşme, sonra migration/servis/UI ve kabul.
Bu dosya uygulamanın tamamlandığı anlamına gelmez. Üretime yazma veya deploy yok.

## Mevcut durumdan çıkan ihtiyaç

Görevler ekranı tek görevi revision ile güncelliyor; 01300 atama geçmişini tutuyor.
Firma→randevu formu ve atomik randevu→takip tamamlaması tamamlandı. Buna karşılık
`src/app/admin/actions.ts` yalnız `admin_assign_role_and_tenant` çağırıyor. Uygulanmış
20260827000400 içindeki RPC profile satırını kilitliyor, üyeliği değiştiriyor ve
oturumları iptal ediyor; tasks'a dokunmuyor. Bu eski migration değiştirilmez.
`selectAllTasks` tek PostgREST sorgusu: dönen listenin tüm tenant işleri olduğu
varsayılamaz. Toplu devir bu liste üzerinden ardışık updateTask çağrıları olamaz.

## Dar ürün sözleşmesi

Görevler ekranında yönetici için “Görevleri devret”. Kaynak kişi, hedef kişi,
önizleme, açık sayı ve onaylanan iş listesi. Hedef mevcut doğrulanmış tenant üyesi;
kaynak üyelikten ayrılmış olsa da aynı tenant'ta kalan işlerin kimliğiyle bulunabilir.
Ayrılan kişinin ismi çözümlenemiyorsa kimliği uydurma bir isimle eşleştirilmez.
Sadece acik/devam_ediyor/gecikti; tamamlandi/iptal geçmişte kalır. Pasif firmadaki
mevcut işin sorumlusunu değiştirmek yeni operasyon oluşturmak sayılmaz. İlerleme,
termin, öncelik ve kaynak ilişkileri değiştirilmez. Kendine devir reddedilir.

Bir komutta en fazla100 görev; daha fazlası açıkça ayrı partiler. “Tüm işleri
bitirdik” mesajı sadece yeniden ölçülen kalan sayıya dayanır. Önizleme salt okunur,
tam sayı ayrı SQL ölçümü; sayfalama/sınır nedeniyle eksik liste sessizce kabul edilmez.

## Teknik sıra

1. Yeni typed önizleme + scoped RPC sözleşmesi. actor/tenant/canlı yönetici kontrolü,
   target üyeliği, source/task tenant eşleşmesi. RLS'yi genişletme; service_role yok.
2. Atomik devir RPC: kullanıcı tarafından görülen task id + expected revision listesi,
   kaynak/hedef ve command UUID. Herhangi bir conflict/üyelik hatasında tüm parti
   rollback. Sabit kilit sırası ve bekleme sonrası üyelik tekrar kontrolü; mevcut
   admin profile FOR UPDATE, görev FK ve appointment profile SHARE sıralarıyla
   gerçek iki bağlantılı deadlock/rol-taşıma testi. Kilit düzeni koddan önce netleşir.
3. 01300 trigger her gerçek değişimde revision/geçmiş üretir; ayrıca ikinci bir
   geçmiş motoru kurulmaz. assigned_to_user_id ile isim aynı yazıda güncellenir.
   Özel receipt command UUID + actor/tenant + normalize payload; cevap kaybından
   sonraki aynı komut aynı sonucu döndürür, değiştirilmiş içerik reddedilir.
4. Mevcut görev listesine önizleme/onay/sonuç; ref ile çift gönderim koruması,
   hata halinde listeyi yenileme, bilinmeyen sonucu başarılı saymama. Üyelik değiştiyse
   taslak kapanır; server tekrar doğrular. Form payload'ı kalıcı tarayıcı deposuna yazılmaz.

## Kabul ve açık kalan sınır

Native PostgreSQL: başarılı100'e kadar parti, farklı tenant/role/staleclaim reddi,
1conflict tüm partiyi geri alır, kaynak değişimi, hedef üyelik kaybı, iki eşzamanlı
parti, kayıp cevap retry, taskhistory sayısı, pasif firma, tamamlanmış işlere dokunmama.
Gerçek local Auth/API + tarayıcı önizleme→devir→eski/yeni kişi sayıları.
Sıfır iş/100üstü/okuma hatası farklı gösterilir. İndeks/sorgu maliyeti sentetik hacimde ölçülür.

Bu ilk dilim manuel kontrollü toplu devirdir; kullanıcı erişimi sonlandırmayı atomik
olarak birleştirmez. Arada yeni iş atanmasını durdurmayan bir önizleme veya başarılı
parti “kullanıcı güvenle ayrıldı” garantisi değildir. P07/P10 ayrılış kapısının kapanması
ayrı admin entegrasyonu, bütün görev yazarlarının kilit/RLS yarışı ve kalan aktif
sahiplik kontrolünü gerektirir. Eski43 raw-claim policy bu teslimle çözülmüş sayılmaz.
P08 sözleşme/evrak sonraki ana modül; bu bağımlılık açık kalır.
