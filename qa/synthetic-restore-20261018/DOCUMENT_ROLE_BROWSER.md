# Evraklar — rol bazlı tarayıcı kabulü

## 18 Ekim — evrak rol tarayıcı kabulü

Yalnız yerel sentetik storage-http/authenticated-browser düzeneğinde yönetici, operasyon ve görüntüleyici ekranları kontrol edildi. Yönetici yükleme/pending/temizlik eylemlerini görüyor. Operasyon yükleme ve pending görürken temizlik panelini görmedi; sözleşme geçerlilik eylemi disabled; kendi 9101 bekleyen yüklemesini gerçek server action ile tamamladı (başarı mesajı). Görüntüleyiciye rol değişiminde eski kapsam reddedildi; şirket seçiminde Synthetic A Görüntüleyici seçilip /evraklar açılınca Erişim kısıtlı görüldü.

Test düzeneğinde Next geliştirme yönlendirmesinin localhost kullanması nedeniyle yalnız 127.0.0.1'e izin veren CORS ayarı girişte başarısızlık oluşturdu. Proxy artık yalnız iki açık yerel origin'e (localhost:3060 ve 127.0.0.1:3060) cevap verir, Vary: Origin ekler. Üretim kodu/izinleri değiştirilmedi. İkinci temiz harness koşusu ve tarayıcı adımları başarılı; SIGTERM exit 0.

Kanıt: role-operations.png ve role-viewer.png. Bu üç rolün evrak ekranı kabulüdür; tüm roller/modüller, başka kullanıcının pending kaydı, fiziksel mobil veya üretimde rol değişimi değildir. Kullanıcı üretim sekmesi değiştirilmedi; geçici sekmeler/konteynerler temizlendi.
