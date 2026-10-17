# Hesap ayarları — 18 Ekim 2026

Kullanıcı menüsü → Hesabım. Kişisel ad düzenleme şirket ayarlarından ayrıdır. Adın tek kaynağı profiles.display_name; AuthContext metadata adına dönmez. Profil okuma başarısızsa üst çubuk genel Kullanıcı etiketi kullanır. Yetki rolü hâlâ doğrulanmış workspace bağlamından gelir.

Yazma: auth.getUser kimliği formun actorId değeriyle eşleşmeli; 1–80 karakter; id + önceki display_name koşullu UPDATE; cevap kimlik/ad eşleşmesi zorunlu. İki sekmede eski değer yeni adı ezmez. Bu bir revision ledger değildir: eski ad tekrar aynı değere dönerse değer karşılaştırması bunu ayrı bir revizyon olarak ayırt etmez. Ağ belirsizliğinde otomatik tekrar yazılmaz; güncel ad tekrar okunur, taslak korunur. Gönderim kilidi çift tıklamayı, mounted kontrolü eski ekranın yeni hesaba callback göndermesini engeller. Sayfa değişimi ve çıkış kayıt korumasından geçer.

## Ölçümler

- Genel uygulama koşusu: 757/757. Son menü koruma testi ve sayfa/component ayrımından sonra hedefli dosyalar 10/10 yeniden geçti; tüm koşu 758 olarak sunulmaz.
- Gerçek yerel PostgreSQL: 5/5 (kapsayıcı dahil): kendi adını yazma, eski değerle sıfır satır, başkasına sıfır satır, rol/platform alanları 42501, anon 42501. Fixture manifestindeki tüm migration'lar uygulandı. Ayrı sentetik DB sonunda silindi.
- Gerçek GoTrue/PostgREST + tarayıcı: kayıt sonrası üst çubuk ve form aynı; iki sekmede çakışma reddi; güncel adı okuma taslağı korur; Vazgeç güncel ada döner; kaydedilmemiş form sayfa geçişi ve çıkışı engeller.
- 390px mobil viewport: son ölçümde scrollbar hariç clientWidth=scrollWidth=375, form alanı 301px; kanıt mobile.png. Çakışma kanıtı conflict.png.
- Genel evrak harness'inin mevcut 29 Storage kontrolü de geçti; geçici container/DB/route temizlendi.
- İlk DB testi pg modülü bulunamadığından başlamadı; mevcut /tmp/bps-module-release-runtime ile yeniden çalıştı. İlk Next typegen kontrolü page.tsx içindeki izin verilmeyen AccountDetails export'unu yakaladı; ayrı AccountDetails.tsx ile düzeltildi.
- Üretim salt okunur ön kontrol: 186 migration, profiles RLS açık, yalnız display_name UPDATE; başka kolon yazma ve tablo UPDATE yok. production-preflight.json. İş verisi sorgulanmadı/değiştirilmedi.

Kalıcı ses tercihi, şifre değiştirme, görev/duyuru bildirimleri bu paketin kapsamı değildir. Ad güncellemesi tüm şirketlerdeki güncel profil görünümünü etkiler; geçmişte metin olarak kaydedilen yazar adlarını yeniden yazmaz. Diğer sekmeye anlık push güncellemesi vaat edilmez. Canlı yayın sonucu ayrı release.json ile kaydedilir.

Yerel release build sentetik URL/anahtar ile exit0 geçti.
