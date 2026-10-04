# M2v — Operasyondan havuza kimlik senkronizasyonu kabulü

2026-10-04. Yerel; üretime uygulanmadı. Bu tur uygulama/SQL davranışı değiştirilmedi; mevcut doğru davranış entegrasyon testleri ve ürün kararıyla sabitlendi.

## Karar

Modül kapatma, o modülün kullanıcı işlemlerini ve ekranlarını kapatır. Başka açık bir modülün paylaştığı personel kimliğinin tutarlı kalması için yapılan dahili bakım durdurulmaz.

Staffing açık/talent kapalı: operasyon personeli eklenebilir; var olan `talent_sync_worker` minimal kişi projeksiyonunu oluşturur/günceller. Havuz RPC'leri kapalı kalır. Yeniden açılınca geride eksik veya eski isimli kayıt bırakılmaması amaçlanır. Bu mekanizma modülü açmaz; görüşme, dosya veya aktarım oluşturmaz.

Talent açık/staffing kapalı: havuz düzenlemeleri çalışır; bağlı operasyon personelinin adını değiştiren kullanıcı komutu M2u tarafından durdurulur. Yeni operasyon personeli hazırlamak zaten iki modülün de açık olmasını gerektirir.

Senkronizasyon trigger'ına config kilidi eklenmedi: worker kilidinden sonra config kilidi almak mevcut sıralamayı tersine çevirebilirdi. Mevcut kapılı operasyon girişleri bariyeri en başta edinir. Bakımın rolü yeni bir kullanıcı uç noktası açmak değildir.

## Ölçülenler

PostgreSQL 17 üzerinde 63 talent DB testi geçti. Yeni dört test:

- Gerçek `ops_mutate` (tarihsel yamalar + modül kapısı) ve gerçek güncel trigger ile personel oluşturma, tekrar deneme; talent kapalıyken okuma RPC'si BM001; yeniden açmada tek kayıt korunması.
- Trigger isim güncellemesi ve değişmeyen isme tekrar yazmada tek event/revision; tenant ayrımı.
- Staffing kapalıyken gerçek writer'ın komut ve kişi oluşturmadan reddi.
- Gerçek `talent_prepare_worker` + trigger ile mevcut kişinin ikinci karta dönüşmeden bağlanması; tekrarın aynı sonucu döndürmesi.

Sentetik tablolar kullanıldı. Son iki isim güncellemesi trigger testidir, operasyonun ad değiştirme RPC'si üzerinden yapılmadı. Tüm üretim FK/trigger ağını, efektif canlı ACL'yi, browser veya PostgREST'i kanıtlamaz. Fixture trigger'ı istemci rollerine kapatır; üretimdeki grantler ayrıca preflight'ta ölçülmelidir. Havuzun yeniden açılması UI üzerinden test edilmedi.

Bu tur yalnız test ve dokümantasyon değişti; 629 uygulama testinin önceki tur sonucu yeniden çalıştırılmış gibi sayılmadı. Migration eklenmedi; build/canlı test yapılmadı.

## Kalan

Worker kodu/aktiflik projeksiyonları, reporting ve diğer modül kapıları, tam devam-eden-iş engelleri, ayar mutation/UI, gerçek şema/ACL preflight ve uçtan uca kabul.
