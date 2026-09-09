# Gerçekleşme ve personel değişimi — uygulama sözleşmesi

Durum: günlük gerçekleşme ve personel değişimi kodlandı; sentetik yerel ortamda doğrulandı. Canlıya uygulanmadı.

## 1. Gerçekleşme
- Her atama başlangıçta **henüz bildirilmedi**. Yönetici/operasyon, iş günü geldikten sonra **geldi / gelmedi / henüz bildirilmedi** kaydeder veya düzeltir. Gün sınırı veritabanında Europe/Istanbul ile ölçülür.
- Bu günlük beyan; giriş saati, çalışma saati, puantaj onayı veya ücret hesabı değildir.
- Planlanan kişi sayısı ile bildirilen gerçekleşme ayrı gösterilir. Bilinmeyen durum “gelmedi” sayılmaz.
- Atama kaldırma ve talep iptali gerçekleşmeyi silmez. Kaldırılmış atamalar da tarihçede görünür ve hatalı bildirim düzeltilebilir. İptal edilmiş bir talepte geçmişte fiilen çalışılmış olması mümkündür.
- Bir personel/gün için en fazla bir “geldi” kaydı. Aynı gün iki ayrı yerde kısmi çalışma bu dilimin kapsamında değil.
- Düzeltme beklenen revision ile yapılır; eski ekran son kaydı ezemez. Her başarılı komut audit kaydı üretir; aynı kimlikle tekrar özgün sonucu döndürür. Önceki durum/revision komut sonucunda korunur.
- Firma/personel sonradan pasif olsa da tarihsel gerçekleşme düzeltilebilir; tenant ve rol kontrolü her yazmada yenilenir.
- Haftalık plan CSV'si bu aşamada **plan** çıktısıdır; gerçekleşme raporu olduğu iddia edilmez.

## 2. Personel değişimi
- Eski atamayı kaldırıp yenisini tek transaction içinde oluştur; yeni personel uygun değilse eskisi yerinde kalır.
- Eski kişinin gerçekleşme kaydı korunur; yeni atama henüz bildirilmedi ile başlar.
- Aynı kişiyle değişim ve kaldırılmış atamanın tekrar değiştirilmesi reddedilir.
- “Geldi” kaydı olan kişinin değiştirilmesi yerine önce yanlış bildirim düzeltilir; vardiya içi devir ayrı kapsamdır.

## Kabul
Rol/tenant, gelecek gün, iki eşzamanlı düzeltme, aynı personel/gün, kaldırma/iptal sonrası tarihçe, kayıp yanıt/tekrar, kapatılmış komut ve mobil görünüm sınanır. Canlıya taşıma ve üretim şema entegrasyonu ayrı kapıdır.

## 3. Haftalık gerçekleşme özeti

Haftalık planın altında ayrı açılan, ayrı zaman damgası olan salt-okunur özet.
Plan filtresinden bağımsız olarak iptaller ve kaldırılan atamalar da bildirim toplamına
katılır. “Geldi” kişi-gündür (personel/gün tekil); “gelmedi” bildirim sayısıdır (bir
personel gün içinde yeniden atanıp yeniden gelmedi olarak işaretlenebilir). “Henüz
bildirilmedi” yalnız aktif atamaları sayar. Kaldırılan bilinmeyen kayıtlar geçmişte
kalır; bekleyen bildirim işi sayılmaz. Günlük ekrana bağlantılar düzeltme için kullanılır.
Plan CSV/PDF kapsamı değişmez. Bu özet çalışma saati veya bordro onayı değildir.
5000 talep / 20000 tarihsel atama üstünde kısmi toplam yerine açık hata verilir.
