# Evraklar — rol bazlı tarayıcı kabulü

## 18 Ekim — evrak rol tarayıcı kabulü

Yalnız yerel sentetik storage-http/authenticated-browser düzeneğinde yönetici, operasyon ve görüntüleyici ekranları kontrol edildi. Yönetici yükleme/pending/temizlik eylemlerini görüyor. Operasyon yükleme ve pending görürken temizlik panelini görmedi; sözleşme geçerlilik eylemi disabled; kendi 9101 bekleyen yüklemesini gerçek server action ile tamamladı (başarı mesajı). Görüntüleyiciye rol değişiminde eski kapsam reddedildi; şirket seçiminde Synthetic A Görüntüleyici seçilip /evraklar açılınca Erişim kısıtlı görüldü.

Test düzeneğinde Next geliştirme yönlendirmesinin localhost kullanması nedeniyle yalnız 127.0.0.1'e izin veren CORS ayarı girişte başarısızlık oluşturdu. Proxy artık yalnız iki açık yerel origin'e (localhost:3060 ve 127.0.0.1:3060) cevap verir, Vary: Origin ekler. Üretim kodu/izinleri değiştirilmedi. İkinci temiz harness koşusu ve tarayıcı adımları başarılı; SIGTERM exit 0.

Kanıt: role-operations.png ve role-viewer.png. Bu üç rolün evrak ekranı kabulüdür; tüm roller/modüller, başka kullanıcının pending kaydı, fiziksel mobil veya üretimde rol değişimi değildir. Kullanıcı üretim sekmesi değiştirilmedi; geçici sekmeler/konteynerler temizlendi.

## İK ve muhasebe — kalan iki rol, 18 Ekim

Kaynak cddceb3, aynı yerel harness yeni geçici DB ile çalıştırıldı. İK: Evrak Yükle ve Yarım kalan yüklemeler görünür; Dosya temizliği yok; kendi 9101 kaydını tamamla server action'ı başarı verdi. Muhasebeye üyelik ve profil rolü değiştirilip sayfa yenilenince eski kapsam kapandı; şirket seçiminde Synthetic A Muhasebe seçildi; doğrudan /evraklar → Erişim kısıtlı. Kanıt role-hr.png ve role-accounting.png. Harness çıkış 0, test sekmesi ve geçici kaynaklar temizlendi.

## Ölçülen evrak rol matrisi

| Rol | Ekrana erişim | Yükleme/pending eylemleri | Temizlik paneli | Kanıt |
|---|---|---|---|---|
| Yönetici | Var | Var; kendi kurtarması geçti | Var; temizleme geçti | BROWSER_ACCEPTANCE.md, combined-browser-result.json |
| Operasyon | Var | Kendi kurtarması geçti | Yok | role-operations.png |
| İK | Var | Kendi kurtarması geçti | Yok | role-hr.png |
| Görüntüleyici | Erişim kısıtlı | Yok | Yok | role-viewer.png |
| Muhasebe | Erişim kısıtlı | Yok | Yok | role-accounting.png |

Bu matris yalnız Evraklar modülünün bu akışları içindir. Her rolün tüm form alanları, indirme/silme işlemleri veya uygulamanın diğer modülleri tam tarandı demek değildir. Aynı şirkette farklı yükleyen sınırı ayrıca ../contract-write-20261015/DOCUMENT_OWNER_HTTP.md içinde gerçek HTTP ile ölçülüdür. Üretimde rol/veri/şema değişikliği yapılmadı.
