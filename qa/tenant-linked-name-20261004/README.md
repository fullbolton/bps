# M2u — Bağlı personel adının modüller arası güncellenmesi

Yerel geliştirme, 2026-10-04. Üretime uygulanmadı.

## Davranış

Havuzdaki kişinin adı bağlı ops_workers kaydına da yazılıyor. `20261004000200` ortak `talent_save_person` yolunda, kişi kilidi ve revision kontrolünden sonra, değişiklikten önce staffing durumunu kontrol eder. Bağlı kişi + farklı ad + kapalı staffing durumunda işlem BM001 ile geri alınır. Şehir, iletişim ve diğer havuz alanları ad aynı kaldığı sürece düzenlenebilir. Bağsız kişiler ve yeni kişi ekleme staffing gerektirmez.

Mevcut talent yazma bariyeri en başta tenant config FOR SHARE tutar. Yeni kontrol config kilidi edinmez; eldeki kilit altında ayarı okur. Profil/person kilidinden sonra yeni bir config kilit sırası eklenmez. Mevcut worker/person kilit sırası korunur.

Önceden tamamlanmış komutun idempotent receipt dönüşü korunur. Reddedilmiş komut receipt veya history bırakmaz; modül açıldığında aynı komut yeniden denenebilir. Excel, merge ve undo ortak save fonksiyonunu çağırdığı için aynı kontrolü devralır; bu turda bu üst akışlar uçtan uca çalıştırılmadı. Kendi exception yakalayıcıları ayrıca UX kabulünde incelenmeli.

## Kanıt

- 629 uygulama testi geçti.
- PostgreSQL 17 üzerinde 59 talent DB testi geçti. Gerçek save gövdesi, sentetik kolon/tablo düzeni ile yürütüldü; tüm üretim trigger/FK şeması kurulmadı.
- Bağlı kişi şehir güncelleme/tekrar, kapalı modülde ad reddi, rollback sonrası iki tablonun değişmemesi, receipt/history kalmaması, açılınca tekrar, bağsız kişi ve yeni kişi akışları ölçüldü.
- TypeScript ve kod üretimi kontrolü temiz. Statik 0 FAIL / 2 WARN.
- Canlı, tarayıcı, production build ve diğer DB süitleri bu turda çalıştırılmadı.

## Kalan

Ops→talent trigger senkronizasyonu ayrı karardır. Worker kodu/aktiflik projeksiyonları henüz ayrıştırılmadı. Reporting ve diğer modüller, tam iş engelleri, ayar mutation/UI ve uçtan uca kabul bekliyor. Kullanıcıya modül kapatma açılmadı.
