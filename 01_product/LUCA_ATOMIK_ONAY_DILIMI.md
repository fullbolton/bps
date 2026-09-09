# Luca atomik onay — 029 / migration 02600

2026-09-09. Yeni proje finansalı öncesi aktarım temelinin dar kapsamı. Yerel sentetik ortamda uygulanır; proje gelir/gider raporu değildir.

## Değişiklik

`confirm_mizan_atomic(id,tenant,payload)` tek transaction içinde upload+satırlar+firma açık alacağını yazar. Actor auth.uid; profil kilidinden sonra tekrar doğrulanmış tenant ve yönetici rolü. Her eşleşen firma tenant kapsamında; firma adı sunucudan. Aynı UUID/actor/tenant/payload tekrarında sonuç döner, özet yeniden uygulanmaz. Farklı payload veya actor ile UUID kullanımı reddedilir. Başka yöneticilerin aynı UUID yarışını transaction advisory lock serileştirir; hash çakışması yalnız bekletir.

1–10000 satır,8MB JSON, dosya adı ve dönem uzunluğu sınırı; 120 noktalı sayısal alt hesap biçimi. Para JSON number olmak zorunda, numeric15,2 sınırı ve kuruş hassasiyeti kontrol edilir. Mükerrer hesap kodu aynı aktarımda reddedilir. Eşleşmeyen/belirsiz satırlar saklanır ama alacak üretmez. Aynı firmanın farklı hesapları toplanır; önceki alacak güncellenir, mevcut gecikme/kesilmemiş değerler korunur. Aktarımda olmayan firmanın eski özeti sıfırlanmaz; tam portföy/dönem mutabakatı değildir.

mizan_uploads tenant_id ve request_payload alır. Eski tenant'sız kayıtlar korunur; otomatik kullanıcı üyeliğinden geriye dönük tenant tahmini yapılmaz. Restrictive SELECT politikaları eski yönetici politikasına ek kapsam zorlar. Ham INSERT/UPDATE/DELETE ve eski derive RPC'nin PUBLIC/anon/authenticated yetkisi kaldırılır. Yeni UI yalnız tekRPC çağırır; hatada silme yapıp “geri alındı” iddia etmez.

## Tekrar ve sınırlar

Komut kimliği/payload tarayıcı belleğinde korunur; aynı açık sayfada transport hatasında tekrar güvenlidir. Sayfa yenileme veya dosyayı yeniden seçme yeni UUID üretebilir. Dosya hash'i üzerinden aynı dosyanın farklı UUID ile yeniden yüklenmesini engelleme ve reload sonrası devam bu dilimde yok. SQL committed receipt kalıcıdır; istemci pending state kalıcı değildir. Dönem raporlama ve upload sahipliğine göre eski kayıt uzlaştırma ayrıca yapılacak.

## Kabul

9 native PostgreSQL: atomik başarı/aynı tekrar, değiştirilmiş tekrar, yabancı firma/orphansız ret, mükerrer hesap, bozuk tutar, eski bypass kapısı, rol/tenant, tek kalıcı sonuç, mali insert hatasında header+satır rollback.

Gerçek dedicated Supabase Auth/RPC: yeni UUID ile onay+tekrar tek snapshot/satır/123.00 alacak; yanlış tenant ve eski RPC reddi. Geçici hesap/firma/upload/summary temizlendi. Yerel mizan tabloları orijinal iki migration'dan, mali tablo minimum reader fixture'dan genişletildi; bu tam prod şema testi değildir. Yerel script eksik eski derive fonksiyonu için test stub kurar ve yeni migration bu stub'ın istemci yetkisini kapatır; gerçek derive gövdesi yeni işlev tarafından çağrılmaz.

UI Excel seçme→önizleme→onay yolu bu tur tarayıcıda uçtan uca çalıştırılmadı; gerçek Auth/RPC ve TypeScript/build kontrolü ayrı ölçümlerdir. Prod/push/deploy yok. Migration02600 uygulamadan yeniUI dağıtılmamalı. Eski upload tenant uzlaştırma, mevcut prod DDL/owner/izin preflight ve gerçek export biçimi kabulü açık.

Genel/type/build6/6,128unit: `/var/folders/fg/qm_gg6w16299dhr_lz9xr38r0000gn/T/bps-acceptance-nzCJCs/report.md`. Runner24olasıadım; tam24bu tur çalıştırılmadı. Native ve gerçekAuth/RPC ayrı çalıştırıldı.
