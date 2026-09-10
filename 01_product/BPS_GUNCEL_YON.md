# BPS — Güncel Ürün ve Geliştirme Yönü

> **082 — Talep sorumlusu atama/güncelleme yerelde tamamlandı.** Form mevcut sorumluyla açılır; değişmemiş/boş isim gönderilemez. Native form/Enter, bağlı etiket/ilk odak ve 44 px kontroller eklendi. Taslak kapanış onayı, senkron çift gönderim kilidi ve pending kapanış engeli çalışır. Hata girilen ismi korur; başarılı atama talep/isim bildirimi verir ve sonraki liste hatası başarıyı silmez. Modal talep/bağlam anahtarıyla ayrılır; eski bağlamın callback/onClose etkisi engellenir. Gerçek Auth/dedicated sentetik kabulünde mevcut/boş sorumlu, kapanışlar, hata-retry, çift gönderim tek PATCH, liste toparlama ve 390 px geçti. 081 regresyonları ile TypeScript/lint/izole build başarılı. Kanıt `/private/tmp/bps-company-feedback-LrQSx3`; kendi kayıtları/hesabı temizlendi. Ürün SQL/push/deploy yok.

> **081 — Talep kayıt bildirimi ve firma dizini toparlaması yerelde tamamlandı.** Firma listesi loading/error/ready ayrıldı; form içi tekrar yükleme taslağı korur, doğrulanmamış firma ile gönderim engellenir. Talep kaydından sonra pozisyon/kişi sayısıyla başarı bildirimi gösterilir; takip eden liste hatası bu başarıyı silmez, Listeyi tekrar yükle yalnız okuma yapar. Liste hatası artık boş tablo/0 KPI gibi gösterilmez. Talepler ve firma adları birlikte güncellenir; okuma ve yeni talep yanıtları kullanıcı/tenant/rol bağlamıyla korunur. Gerçek Auth/dedicated sentetik kabulünde loading/error/empty, retry, mobil, kayıt başarılı/liste hatalı ayrımı ve tek kayıt; 080 form regresyonları geçti. TypeScript/lint/izole build başarılı. Son kanıt `/private/tmp/bps-company-feedback-NCyj09`; kendi verileri/hesabı temizlendi. Ürün SQL/push/deploy yok.

> **080 — Personel talebi formu koruması yerelde tamamlandı.** Native form/Enter, bağlı yedi alan etiketi, ilk odak, mobil tek sütun ve 44 px kontroller eklendi. Kişi sayısı pozitif güvenli tam sayı, firma mevcut seçeneklerden biri olmalı; yüksek/kritik sorumlu şartı korunur. Senkron gönderim kilidi çift kaydı engeller; kayıt sırasında X/Escape/dış alan kapanmaz, hata formu korur. Değişiklik varsa bırakma onayı gelir, inline firma kayıtlarının silinmediği açıklanır. Dedicated sentetik Supabase/gerçek Auth kabulünde kapanışlar, alan koruma, firma kalıcılığı, hata/retry, çift gönderim tek POST/DB satırı ve mobil/dialog regresyonları geçti. TypeScript/lint/izole build başarılı. Kanıt `/private/tmp/bps-company-feedback-IiEa1P`; kendi kayıtları/hesabı temizlendi. Ürün SQL/push/deploy yok.

> **079 — Yeni firma formu koruması yerelde tamamlandı.** Ad/sektör/şehir değiştiğinde X, Escape, dış alan ve İptal bırakma onayı ister; Vazgeç alanları korur. Boş veya tekrar boşaltılmış form doğrudan kapanır. Native form/Enter, ilk alan odağı ve 44 px kontroller eklendi; kayıt sırasında X disabled. Mükerrer uyarısından sonra Enter yeni kayıt açmaz; mevcut firmayı seçme ve açık Yine de oluştur eylemleri çalışır. Gerçek Auth/dedicated sentetik kabulünde tüm kapanış yolları, üç katmanlı odak, 390 px, Enter, mükerrer seçme/oluşturma, bekleme/tek kayıt, izin reddi ve dialog regresyonları geçti. TypeScript/lint/izole build başarılı. Kanıt `/private/tmp/bps-company-feedback-UnFAGN`; kendi kayıtları/hesabı temizlendi. Ürün SQL/push/deploy yok.

> **078 — Yeni görev/randevu taslak koruması yerelde tamamlandı.** Kullanıcı değişikliği varsa X, Escape, dış alan ve İptal bırakma onayı ister; Vazgeç formu korur. Boş veya değiştirilmemiş bağlam varsayılanı doğrudan kapanır; değerler geri alınırsa gereksiz onay çıkmaz. Kayıt sürerken X de disabled olur. Randevu içinden eklenen firma form bırakılırken silinmez ve bu açıklanır. Gerçek Auth/dedicated sentetik kabulünde kapanış yolları, odak, 390 px, temiz yeniden açılış, bağlam varsayılanları, firma kalıcılığı; Enter/pending/tek kayıt ve iç pencere regresyonları geçti. TypeScript/lint/izole build başarılı. Kanıt `/private/tmp/bps-company-feedback-RZOcTN`; kendi test kayıtları/hesabı temizlendi. Ürün SQL/push/deploy yok.

> **077 — Görevler firma/kişi dizini toparlaması yerelde tamamlandı.** Genel görev ekranının firma sorgusu loading/error/ready durumlarına ayrıldı ve kullanıcı/tenant/rol kapsamında tutuluyor. Yeni görev formunda firma/kişi tekrar yükleme çalışır; başlık, termin, öncelik ve seçim korunur. Talepten gelen doğrulanmış tek firma genel dizin hatasıyla engellenmez. Yeni görev formu/prefill kapsam değişiminde kapanır; eski create yanıtı ve onClose yeni kapsamı etkileyemez. Gerçek Auth/dedicated sentetik kabulünde pending/error/empty, iki retry, doğru firmaya/kişiye tek görev ve kişi adı regresyonu geçti. Task-prefill 7/7, TypeScript/lint/izole build başarılı. Kanıt `/private/tmp/bps-company-feedback-w2ZXaf`; kendi kayıtları/hesabı temizlendi. Ürün SQL/push/deploy yok.

> **076 — Randevu firma/kişi seçicilerinde hata ve toparlama yerelde tamamlandı.** Firma listesinde loading/error/ready ayrıldı; hata boş liste sayılmaz, randevu/görev formu içinden Firmaları tekrar yükle ve Kişileri tekrar yükle çalışır. Yenileme tarih/katılımcı/başlığı sıfırlamaz. Doğrulanmamış firma ile gönderim engellenir; seçili kimlik kaybolmaz. Atama isteğe bağlıdır, seçilmiş geçersiz kişiyle gönderim engellenir. Gerçek Auth/dedicated sentetik kabulünde pending/error/empty, retry, korunmuş taslak, tek randevu ve doğru kişiye tek görev geçti; kayıt regresyonu ve TypeScript/lint/izole build başarılı. Kanıt `/private/tmp/bps-company-feedback-oUT6QD`; kendi test kayıtları/hesabı temizlendi. Disk doluluğu/Docker kesintisi giderildi. Ürün SQL/push/deploy yok.

> **075 — Randevu listesi yenileme güvenilirliği yerelde tamamlandı.** Listeyi yenile düğmesi ve erişilebilir yükleniyor durumu eklendi. Randevu satırları/firma adları tek snapshot olarak yayımlanır; eski başarılı veya hatalı okuma yeni sonucu ezmez. Liste/firma/kişi seçimleri kullanıcı/tenant/rol kapsamıyla tutulur; kapsam değişiminde paneller/formlar kapanır ve veriler yeniden okunur. Eski kayıt yanıtı yeni kapsam formunu kapatamaz. Gerçek Auth/dedicated sentetik kabulünde ters yanıt sırası, yeni kayıt, firma adı gecikmesi/hatası/retry, filtre korunması, 320/390/1280, rol değişimi, A→B→A ve geciken kayıt yanıtı geçti; 074 regresyonu ile son TypeScript/lint/izole build başarılı. Kanıt `/private/tmp/bps-company-feedback-NP6dFt`; kendi kayıtları/hesabı temizlendi. Ürün SQL/push/deploy yok.

> **074 — Randevu sonuç formu koruması yerelde tamamlandı.** Görüşme sonucu/sonraki aksiyon yazılmışsa X, Escape, dış alan ve İptal bırakma onayı ister; Vazgeç metni korur. Alanlar görünür label/id, ilk odak, karakter sayacı ve native form aldı; textarea Enter satır ekler. Kayıt sürerken alanlar/kapatma kilitli ve bekleme açıklaması görünür. Başarı bildirimi takip görevi oluşup oluşmadığını action sonucundan ayırır; mevcut görev-atlama gerekçesi korunur. Gerçek Auth/dedicated sentetik kabulünde tüm kapatma yolları, 390 px, POST503/metni koruma/retry, çift gönderimde tek tamamlama ve tek takip görevi geçti. TypeScript/lint/izole build başarılı. Kanıt `/private/tmp/bps-company-feedback-jDwVqb`; kendi kayıtları/hesabı temizlendi. Ürün SQL/push/deploy yok.

> **073 — Görev panelinde düzenleme koruması yerelde tamamlandı.** Kaydedilmemiş durum/atama değişikliğinde kapatma, Escape, panel dışına tıklama ve normal firma bağlantısı bırakma onayı ister. Vazgeç düzenlemeyi korur. Kayıt sırasında alanlar/kapatma kilitlidir; eşzamanlı çift tıklama tek PATCH üretir. Hata formu korur ve tekrar denemeye izin verir. Gerçek Auth/dedicated sentetik kabulünde kapatma yolları, iç içe dialog odağı, 390 px, pending kilidi, tek yazma, 503/retry ve kişi dizini regresyonu geçti. TypeScript/lint/izole build başarılı. Kanıt `/private/tmp/bps-company-feedback-Oba4fS`; kendi kayıtları/hesabı temizlendi. Tarayıcı geri/yenile/tab kapatma için genel koruma eklenmedi. Ürün SQL/push/deploy yok.

> **072 — Randevudan göreve doğrudan geçiş yerelde tamamlandı.** Bağlı görev başlığı /gorevler?gorev=UUID bağlantısıdır. Görev yalnız başarıyla yüklenmiş mevcut kapsam listesinden açılır; aktif filtrede görünmese de panel açılır, liste tercihleri korunur. Parametre açılış sonrası tüketilir; geçersiz/kayıp veya erişilemeyen hedef açıklanır, liste hatası hedef-yok sayılmaz. Görev liste yükleyicisi scope + generation ile eski yanıtları reddeder. Unit 3/3; gerçek Auth/dedicated sentetik kabulünde mobil/Enter, geri dönüş, filtre korunması, invalid/missing, query koruma ve error/retry geçti. Kayıt/yenileme regresyonu ile TypeScript/lint/izole build başarılı. Kanıt `/private/tmp/bps-company-feedback-kmpy1y`; kendi verileri/hesabı temizlendi. Ürün SQL/push/deploy yok.

> **071 — Randevu bağlı görevler görünürlüğü yerelde tamamlandı.** Sessiz catch→[] ve önceki randevu görevlerinin kısa süre görünmesi kaldırıldı. Bağlı görevler bölümünde yükleme, hata/tekrar deneme, gerçekten boş ve içerik ayrıdır; görev durumları gösterilir. Okuyucu kullanıcı/tenant/rol+randevu anahtarıyla yeniden kurulur, kapanmış bileşenin geç yanıtı uygulanmaz. Gerçek Auth/dedicated sentetik kabulünde RPC değil mevcut REST okuyucusuna 503, retry, boş kayıt, Açık/Tamamlandı, 390 px ve geciken B yanıtı sırasında A ya dönüş geçti. TypeScript/lint ve izole build başarılı. Kanıt `/private/tmp/bps-company-feedback-zqnyAW`; kendi kayıtları/hesabı temizlendi. Ürün SQL/push/deploy yok.

> **070 — Görev/randevudan firmaya geçiş yerelde tamamlandı.** Firma adı bağlantısının legacy_mock_id varlığına bağlı olması kaldırıldı. İki panel gerçek company_id UUID ile firma detayına Link üzerinden gider; 44 px ve altı çizili bağlantı, ad çözümlenmemişse Firma kaydını aç metni. Görevde yalnız gezinme için tutulan legacy haritası kaldırıldı; randevu oluşturma/görev akışındaki legacy uyumu korunur. Gerçek Auth/dedicated sentetik kabulünde iki ekran × legacy var/yok, doğru firma, Enter, 390 px, panel/scroll temizliği ve geri dönüş filtreleri geçti. TypeScript/lint ve izole build başarılı. Kanıt `/private/tmp/bps-company-feedback-UlMq2Y`; kendi kayıtları/hesabı temizlendi. Ürün SQL/push/deploy yok.

> **069 — Görev atanan kişi doğruluğu yerelde tamamlandı.** UUID ataması olup eski assigned_to metni boş görevlerin Atanmadı görünmesi düzeltildi. Liste/panel/arama aktif tenant kişi dizinindeki güncel adı kullanır; yükleme/hata/listede olmayan kullanıcı ayrı etiketlenir, yalnız isimli eski kayıt açıkça işaretlenir. Kişi dizini kullanıcı/tenant/rol kapsamında tutulur ve hata için tekrar yükleme vardır. Panelde seçeneklerde bulunmayan UUID görünür kalır; dizin geç gelince kaydedilmemiş durum değişikliği sıfırlanmaz. Unit 6/6 ve gerçek Auth/dedicated sentetik tarayıcı kabulü geçti; son kaynak TypeScript/lint/izole build başarılı. Kanıt `/private/tmp/bps-company-feedback-gGj21K`; kendi test kayıtları/hesabı temizlendi. Atama yazma/izin kuralları ve SQL değişmedi; push/deploy yok.

> **068 — Boş sonuçtan tek adımda dönüş yerelde tamamlandı.** Firma/sözleşme/görev/randevu listelerinde veri varken arama/filtre sonucu boşsa Arama ve filtreleri temizle aksiyonu gösterilir. Hem arama hem filtreler ve kayıtlı tercihler temizlenir; odak aramaya döner. SearchInput clear handle bekleyen debounce işini de iptal eder; EmptyState aksiyonu 44 px ve type=button olur. Gerçek Auth/dedicated sentetik kabulünde dört liste, mobil/Enter/odak/reload, bekleyen timer iptali ve form submit olmaması geçti. TypeScript/lint ve izole build başarılı. Kanıt `/private/tmp/bps-company-feedback-XpX5iB`; kendi test verileri/hesabı temizlendi. Ürün SQL/push/deploy yok.

> **067 — Ortak filtre açıklığı ve toparlama yerelde tamamlandı.** FilterBar select/tarih alanları görünür label + benzersiz id bağları aldı. Kayıtlı seçim seçeneklerden kalkarsa değer korunur ve listede olmadığı açıklanır; seçenek geri gelince uyarı kalkar. Temizle 44 px, type=button ve ilk filtreye odak dönüşü içerir. Gerçek Auth/dedicated sentetik kabulünde 065/066 regresyonu, etiket/id, seçeneğin kaybolması/geri gelmesi, date temizleme, form submit olmaması, odak ve 320/390/1280 taşmama geçti. TypeScript/lint ve izole build başarılı. Kanıt `/private/tmp/bps-company-feedback-fDoJf7`; kendi test verileri/hesabı temizlendi. Ürün SQL/push/deploy yok.

> **066 — Kompakt görev ekranı yerelde tamamlandı.** Tekrarlanan büyük KPI kartları + durum chipleri, Tümü ve beş durum için tek tıklanabilir özette birleşti; aria-pressed seçimi gösterir. Adetlerin tüm yüklenmiş görevlere ait olduğu açık yazılır. Mobilde ayrıntılı filtreler aç/kapat alanında, kapalıyken etkin filtre sayısı görünür; masaüstünde aynı kontroller açıktır. Gerçek Auth/dedicated sentetik DB kabulünde 390×844 ilk satır görünürlüğü, global adet, durum/klavye, reload/rozet, aç-kapat/Tab/temizleme ve 320/390/1280 taşmama geçti; 065 filtre hafızası regresyonu da geçti. TypeScript/lint ve izole üretim derlemesi başarılı. Kanıt `/private/tmp/bps-company-feedback-0dFuD3`; kendi kayıtları/hesabı temizlendi. Ürün SQL/push/deploy yok.

> **065 — Görev/randevu listeye dönüş UX yerelde tamamlandı.** 064 ortak hook iki ekrana uygulandı. Görevde arama, durum, atama, öncelik, kaynak ve firma; randevuda arama, durum, tip ve firma sekme/kullanıcı/aktif tenant/rol kapsamında korunur. Gerçek Auth + dedicated sentetik Supabase tarayıcı kabulünde tüm filtrelerin doğru tek satırı göstermesi, reload, panel/Escape, başka sayfadan browser back, boş sonuç/temizleme/odak ve 390 px geçti. Bana atanan ile Atanmamış ayrımı ayrıca doğrulandı. TypeScript/lint ve izole üretim derlemesi geçti. Kanıt `/private/tmp/bps-company-feedback-rcpA4H`; kendi test kayıtları/hesabı temizlendi. Ürün SQL/push/deploy yok.

> **064 — Listeye dönüş UX yerelde tamamlandı.** Firma/sözleşme arama ve filtreleri sekme içinde, kullanıcı + aktif tenant + rol kapsamında hatırlanır. Bozuk/engelli sessionStorage güvenli varsayılana veya belleğe döner. SearchInput yalnız kullanıcı girişini debounce eder; dış değer ve kapsam değişimi eski zamanlayıcıyı iptal eder. Gerçek Auth tarayıcı kabulünde detaydan dönüş, yenileme, temizleme, bozuk kayıt, kapsam ayrımı, bekleyen arama, engelli depolama ve 390 px geçti; ortak tablo regresyonu geçti. Unit 4/4; son kaynakla TypeScript/lint ve izole üretim derlemesi geçti. Kanıt `/private/tmp/bps-company-feedback-yD0p5k`; kendi test kayıtları/hesabı temizlendi. Sayfa/sıralama/scroll korunması kapsam dışı. Ürün SQL/push/deploy yok.

> **063 — Yetkili/belge silme UX yerelde tamamlandı.** İki kalan native confirm, kayıt adı/etkisi/bekleme/hata içeren ortak pencereye taşındı. Belge aksiyonu deleted boolean ile gerçek DB silmesini no-op sonucundan ayırır; Storage hatası ayrı amber uyarıdır. Yetkili/belge okuyucuları yükleme/hata/boş ayrımı ve yeniden deneme içerir. Gerçek Auth + Storage kabulünde iptal/no-write, rol reddi, tek POST/pending, gerçek silme, no-op, Storage temizlik hatası ve iki okuyucu 503/retry geçti. Unit 7/7; TypeScript/lint ve izole üretim derlemesi geçti. Kanıt `/private/tmp/bps-company-feedback-1BBbro`; test dosyaları, kayıtlar, hesap ve hata trigger/function temizlendi. Sentetik contacts fixture eklendi; üretim migration/push/deploy yok.

> **062 — Firma durum/sözleşme silme onayı yerelde tamamlandı.** Kayıt adı/etkisi olan native uygulama penceresi, Vazgeç başlangıç odağı, bekleme/tekrar tıklama/kapatma koruması ve pencere içi hata. Firma aktif/pasif geçişinde etkilenen satır doğrulanır; sözleşmede doğrulanan silme ile sıfır satır ayrı sonuçtur, sonuç ekranda kalır ve başlık odağı alır. Gerçek Auth kabulü: vazgeçme/no-write, yetki reddi/düzeltme, geciktirilmiş tek POST, sıfır satırda sahte başarı olmaması, 390 px ve listeye dönüş geçti. Son kaynakla TypeScript/lint ve izole üretim derlemesi geçti. Kanıt `/private/tmp/bps-company-feedback-BL3bHW`; kendi test verileri temizlendi. Sentetik fixture kendi kayıtları için UPDATE politikasıyla genişletildi; üretim şeması kabulü değildir. Ürün SQL/push/deploy yok.

> **061 — Görev/randevu/sözleşme form UX yerelde tamamlandı.** Etiket-alan bağları, native form + Enter, açılışta ilk alana odak, zorunlu alan açıklaması, 44 px kontroller ve mobil tek sütun. Kayıtta fieldset kilidi/bekleme durumu; sözleşmeye senkron tekrar gönderim kilidi ve tarih aralığı hatası. Gerçek Auth tarayıcı kabulünde üç formun bekleme/kapatma/tekrar gönderim koruması, tek POST/kayıt, pasif firma sunucu reddi + form korunması + düzeltip kayıt, sözleşme düzenlemede firma kilidi/Enter/kalıcılık ve native nested dialog/odak/scroll regresyonu geçti. Son kaynak ile TypeScript/lint ve izole üretim derlemesi geçti. Kanıt `/private/tmp/bps-company-feedback-1HpKOk`; kendi test verileri temizlendi. Ürün SQL/push/deploy yok.

> **060 — Kayıt sonrası geri bildirim ve hata toparlama yerelde tamamlandı.** Görev oluşturma/güncelleme, randevu ve sözleşme oluşturma için kapatılabilir başarı bildirimi; boş liste/filtre sonucu ayrımı; okuma hatasında yanıltıcı boş durum yerine açıklama ve Tekrar dene. Görevde yazma başarılı + liste 503 senaryosu, yeniden okumada tek kaydın korunması, üç formun gerçek Auth yazması, bildirimi kapatma ve 390 px görünüm geçti. Uzun tablolarda sr-only başlıkların sayfa taşması, kaydırma alanına relative konum verilerek düzeldi. Son kaynakla TypeScript/lint ve izole üretim derlemesi geçti. Kanıt `/private/tmp/bps-company-feedback-3SQISr`; kendi sentetik kayıtları/hesabı temizlendi. Ürün SQL/push/deploy yok.

> **059 — Ortak liste UX tamamlandı (yerel).** Filtre sonrası sayfa sıfırlama, sayısal sıralama, klavyeli başlık/Detay, erişilebilir arama temizleme ve kaydırma alanında kesilmeyen native satır menüsü. 25 satırlık gerçek bileşen fixture ile 1280/390 px menü-satır yakınlığı, görünürlük/disabled/Escape, filtre/sıralama/boş arama/odak geçti; gerçek Auth firma kayıt regresyonu da temiz. Kanıt `/private/tmp/bps-company-feedback-nf84xz`. TypeScript ve izole build geçti; son inset CSS düzeltmesi ayrıca tarayıcıda doğrulandı. Geçici test rotası ürün src/app içinde değil. SQL/push/deploy yok.

> **058 — Finans ve ortak pencere/panel UX yerelde tamamlandı.** Finans kapsamı görünür, alacak/faturalama ve maliyet grupları ayrıldı. Native dialog/panel, arka plan inertliği, Tab sınırı, iç içe Escape, odak dönüşü ve scroll kilidi eklendi. Gerçek Auth ile firma yazma/bekleme/hata regresyonu; randevu/talep içinde alt pencere; yan panel ve finans/gelişmiş özet 1280/390 px geçti. Kanıt `/private/tmp/bps-company-feedback-VpXIGQ`. Mali tablo boş durumla kontrol edildi, proje kârlılığı veya dönem altyapısı eklenmedi. Test kayıtları temizlendi. SQL/push/deploy yok.

> **057 — Günlük plan/işe başlama UX bloğu tamamlandı (yerel).** Operasyon gezinmesi, firma/gün özeti, açılır hazırlık alanı, daha büyük aksiyonlar; takipte kapsam sayıları, durum rozetleri, arama/teyit ayrımı ve geçmiş düzeni. 15 banka/otel uçtan uca grup: gerçek tarayıcı plan/görüşme yazma/reload, teyit ayrımı, aksiyon filtresi, talep/gelmedi/yedek/CSV ve 1440/390 px taşma geçti. Unit 18/18, TypeScript ve diff temiz. Kanıt `/private/tmp/bps-sector-pilot-tkkQ8B`. Test zamanları DB saatinden; kendi fixture kayıtları temizlendi. Ürün SQL/push/deploy yok.

> **056 — Firma/sözleşme detay UX düzeni tamamlandı (yerel).** Mobil uyumlu bilgi başlıkları ve işlem grupları; kaydırılabilir bölüm gezintisi; sözleşmede bilgi alanları, bölüm bağlantıları ve iki sütunlu yerleşim uygulandı. İşlevsiz firma zaman çizgisi/bahsetme/yönlendirme alanları kaldırıldı. Legacy ID olmayan sözleşmeden firmaya dönüş gerçek UUID ile düzeldi. 1280/390 px sekme/anchor/geri dönüş/taşma ve firma oluşturma regresyonu, TypeScript geçti. Kanıt `/private/tmp/bps-company-feedback-OtPkYj`. Sentetik kayıtlar temizlendi; SQL/push/deploy yok.

> **055 — Yeni UI/UX çalışma alanı temeli uygulandı (yerel).** Gruplu menü, modül başlıklı üst bar, mobil başlık/aksiyon yerleşimi, ortak kart/KPI/tablo/buton düzeni ve dashboard hızlı erişimleri yenilendi. Aktif olmayan inisiyatif kutusu kaldırıldı. Altı ana ekran 1280/390 px: rol yüklemesi sonrası yatay sayfa taşması yok; mobil menü/Escape ve firma oluşturma regresyonu geçti. Kanıt `/private/tmp/bps-company-feedback-dBwxnN`. Kritik tarih/duyuru yerel fixture eksikleri hata olarak görünür; başarılı veri kabulü sayılmaz. Yeni SQL veya yayın yok. [Tasarım kapsamı](../01_product/UI_UX_YENI_DUZEN.md).

> **054 — Firma UX tarayıcı kabulü tamamlandı.** Gerçek yerel Auth ve Chromium ile liste başarı mesajı; randevu/talep içinden yeni ve mevcut firma seçimi; yavaş yanıtta bekleme/disabled/Escape; sunucu yetki reddinde formun korunması geçti. Tek POST/tek kayıt ve mükerrer seçimde kayıt sayısı doğrulandı. TypeScript ve diff kontrolü geçti. Sentetik fixture eksik firma alanlarıyla genişletildi; bu üretim şeması/RLS kabulü değildir. Kendi test verileri temizlendi. Kanıt: `/private/tmp/bps-company-feedback-uUntPI`. Ürün SQL değişmedi; push/deploy yok.

> **053 — Kullanıcı kararı: temel UX geri bildirimi şimdi iyileştiriliyor.** Firma listesindeki mevcut başarı mesajı erişilebilir status oldu; randevu/talep içinden firma ekleme veya mevcut firma seçme ayrı sonuç cümleleriyle bildiriliyor. Yeni Firma modalında senkron tekrar gönderim kilidi, kayıt sürerken kapanma/alan değişimi engeli, etiket-input bağları ve hata/bekleme rolleri eklendi. TypeScript ve diff kontrolü geçti. Tarayıcı davranış kabulü henüz yapılmadı; yerel değişiklik, SQL/üretim/push/deploy yok. İletişim planı korunuyor.

> **052 — İletişim gönderim kurtarması yerelde tamamlandı.** Gönderimi kontrol et, sunucudaki mevcut mesajı doğrular veya gönderilmemiş eski komutu kalıcı kapatıp düzenlemeye açar. Commit sonrası cevap kaybı, sunucuya ulaşmayan istek ve yetkisi değişmiş alıcı ret/düzeltme iki tarayıcıda geçti. Native SQL 12 grup; unit 9/9; gerçek Auth 4 grup. 00400 yalnız dedicated yerelde, kendi test verileri temizlendi. Üretim/push/deploy yok; dosya ve nottan görev henüz yok.

> **051 — İletişim ilk ekran dilimi yerelde çalışıyor.** Günlük talepte not/yanıt/aramalı kişi etiketleme, Topbar bildirim kutusu, okundu ve talebe dönüş bağlandı. İki gerçek yerel Auth hesabı ve iki Chromium oturumuyla gönderim→reload→bildirim→okundu→kaynağa geçiş→cevap bildirimi geçti. SQL 00300 yalnız dedicated yerelde; test verileri temizlendi. NEXT_PUBLIC_BPS_CONVERSATION_ENABLED varsayılan kapalı; canlı ve 3000 kullanıcısının ortamı değiştirilmedi. Belirsiz gönderim kurtarma hata enjeksiyonu, kalıcı ret uzlaştırması, dosya ve nottan görev sonraki işler; üretim/push/deploy yok.

> **050 — İletişim gerçek yerel Auth/RPC kabulü geçti.** Native SQL 10 grup (eşzamanlı tekrar ve kilit sonrası rol ret dahil), iki geçici gerçek Auth hesabıyla 4 grup, komut testleri 5/5. Gerçek mesaj gönderme servisi zincire bağlandı. SQL yalnız dedicated yerel şemaya uygulandı; kaynak hash marker ile doğrulanır, migration ledger değiştirilmedi. Test hesapları/kayıtları temizlendi. Ekran, alıcı seçimi ve tam inbox sayfalaması sırada; üretim/push/deploy yok.

> **049 — İletişim SQL temeli yerelde doğrulandı.** Talebe bağlı mesaj, aynı kaynakta cevap, seçilmiş etiketler, alıcıya özel bildirim/okundu ve idempotent gönderim SQL kaynağı eklendi. Dedicated Docker içindeki geçici veritabanında 8 native grup geçti; veritabanı temizlendi. Auth helperları sentetik modeldi; gerçek Auth ve UI kabulü henüz yok. Ana yerel Supabase ledger'ına ve üretime uygulanmadı; push/deploy yok.

> **048 — İletişim komut sözleşmesi yerelde kodlandı.** Talep notunun actor/tenant/kaynak/cevap/etiket sınırları, canonical tekrar kimliği ve sunucu makbuzu doğrulaması eklendi. Beş test ve TypeScript geçti. Kod henüz UI/RPC tarafından çağrılmıyor; mesaj veya bildirim kaydetmez. Sıradaki dedicated yerel SQL atomik mesaj/etiket/bildirim fonksiyonları ve iki hesaplı kabul. Üretim, migration uygulama, push/deploy yok.

> **047 — Banka/otel tarayıcı yazma kabulü tamamlandı; iletişim bloğuna geçildi.** 14 grup geçti: günlük talep oluşturma, personel atama/gelmedi/değiştirme ve reload; bağımsız oturumdan kayıt doğrulama dahil. Sentetik veriler temizlendi. Uygulama/SQL değişmedi. İletişim için mevcut notlar, duyurular, e-posta defteri ve görev önseçimi incelendi; kalıcı konuşma/bildirim/görev bağı tasarımı hazır. İletişim SQL/UI henüz uygulanmadı.

> **2026-09-10 — Yeni kullanıcı kararı: operasyon iletişimi sıradaki ürün bloğu.** Önce 046 sonrasındaki banka/otel tarayıcı yazma kabulü kapatılacak; ardından iş üzerinde not/etiketleme, nottan mevcut göreve dönüşüm ve uygulama içi bildirim kutusu geliştirilecek. Duyurular ikinci aşama. Kişisel performans ve süreye bağlı yönetici bildirimi kapsam dışı. Bu kayıt plan kararıdır; geliştirme başlamadı. [Kapsam ve sıra](OPERASYON_ILETISIMI_PLANI.md).

> **046 — Banka/otel yerel tarayıcı kabulü geçti.** 11 kontrol grubu: 045 Auth/RPC/HTTP senaryolarına günlük–haftalık firma/gün geçişi, özetlerin ekranda doğrulanması, gerçek tarayıcı CSV indirmesi, otelin 1 geldi / 1 tarihsel gelmedi / 3 bildirilmemiş toplamı ve reload sonrası yedek personel geçmişi eklendi. Masaüstü ve 390 px mobil ekran incelendi. Veriyi API oluşturdu; tarayıcı yazma kabulü veya gerçek müşteri pilotu değildir. Sentetik kayıtlar temizlendi. Uygulama canlı 044 ile aynı; SQL/deploy yok. [Kanıt](PILOT_UCTAN_UCA_KABUL.md).

> **045 — Banka/otel birleşik yerel kabulü tamamlandı.** Gerçek yerel Auth/RPC/HTTP üzerinden 8 kontrol grubu: şube CSV tekrarları, çift atama engeli, beyan/teyit ayrımı, yedek atama ve korunmuş gelmedi geçmişi, günlük/haftalık/CSV toplamları, tenant/rol retleri ve kendi test verilerinin temizliği. Banka 9/3/6, otel 5/4/1 ihtiyaç/atama/açık; bağımsız CSV okuyucusu doğruladı. Ürün kaynakları canlı 044 ile aynı; SQL/deploy yok. Bu sonuç gerçek müşteri veya tarayıcı pilotu değildir. [Kanıt](PILOT_UCTAN_UCA_KABUL.md).

> **044 yayın — 2026-09-10:** Yerel render düzeltmesi doğrudan kullanıcı devam talimatıyla canlıya alındı. Kaynak `ec0500e`, dal `codex/block-01-release`; deployment `dpl_1QvsYYMzeemMuz9ZDtxdUaSdQDhw`. 249 uygulama dosyası commit/manifest ile eşleşti; TypeScript, production build ve sağlık 5/5 geçti. 100 personelde gereksiz HTML ad tekrarları 1.000→200; ekran/PDF değişmedi. SQL veya iş verisi değişikliği yok. Önceki “yerelde/yayımlanmadı” notları yerel kabul anını anlatır.

> **044 — Yerel render yükü düzeltildi; yayında değil.** 100 personelli haftalık PDF devam satırlarında tam ekran listesinin gereksiz kopyaları kaldırıldı. HTML ad tekrarları 1.000→200; gömülü CSS dahil boyut 145.473→112.417 byte. Ekran/PDF 100 isim kabulü, TypeScript ve 043 ile toplam 10 PDF sayfasında piksel eşitliği geçti. SQL/veri/push/deploy yok; canlı 043 korunuyor. [Kanıt](HAFTALIK_CIKTI_RENDER_YUKU.md).

> **043 — 2026-09-10: Haftalık PDF düzeni yayında.** Metin sütunları genişletildi; özetler tek satırda. Uzun personel listeleri yazdırmada 12 kişilik devam satırlarına ayrılıyor; şube/gün tekrarlanıyor, sayılar yalnız ilk satırda. Sentetik Chromium PDF kabulü: tek talep 1 sayfa, 40 talep 5 sayfa (önce 6), 100 personel 4 sayfa; kimlikler eksiksiz ve birer kez. Kaynak `b2c921b`; canlı `dpl_3496nCsZVRrsykaWEiCGJeKAdzyk`; build, sağlık 5/5 ve canlı haftalık ekran geçti. Yeni SQL/veri yok. Native yazdırma diyalogu ve canlı CSV byte kontrolü erişim engeli nedeniyle açık. [Kanıt](HAFTALIK_CIKTI_KABULU.md).

> **042 — 2026-09-10: Aktivite olay adları yayında.** İşe başlama planı, arama sonucu, bağımsız teyit, yeniden açma ve geçici arama üstlenme/bırakma ayrı başlıklara sahip. Yeni SQL yok. `0446684` push edildi; canlı `dpl_5wGgUBaofM2qMH3nCK9gMnpMzUwU`. İki mevcut test, TypeScript, production build, sağlık 5/5 ve kimlikli Dashboard okuma geçti. Mevcut canlı listede takip olayı olmadığından altı yeni başlık o listede ayrıca gözlenmedi; yeni test verisi oluşturulmadı. [Kanıt](AKTIVITE_ISE_BASLAMA_ADLARI.md).

> **041 — 2026-09-10: Blok 1 yayında, çekirdek canlı kabul tamam.** Üç bekleyen SQL uygulandı; bu teslimin 30/30 migration kaynağı ve ledger sürümü doğrulandı. `565059e` kaynakları `codex/block-01-release` dalına push edildi; main birleştirilmedi. Vercel `dpl_DZvtjhLdoishravp1YYwJnM9Uuoq` www.bpsys.net üzerinde canlı, sağlık 5/5. Kimlikli sentetik aday firma → şube → personel → talep → atama → plan → arama → bağımsız teyit → reload ve Dashboard geçti. Bu tur test verileri temizlendi; eski kayıtlar korundu. CSV gerçek HTTP kabulü yerel 9/9; canlı CSV byte/PDF sayfalama kabulü ayrıca açık. Önceki bekliyor/yayınlanmadı kayıtları tarihseldir. [Tek teslim notu](BLOK_01_TESLIM.md).

> **040 — Blok 1 yerel teslim paketi hazır.** Haftalık CSV gerçek HTTP 9/9 ve bağımsız okuyucu, tarayıcı toplam/iptal/boş hafta kabulü geçti. Kabul betiği artık kendi geçici hesap/verilerini temizler. Toplu manifest 249 uygulama + 30 SQL + 17 kabul dosyasını doğrular; uygulama 036–039 kabul snapshotlarıyla birebir. Genel 5/5 ve manifest 2 test geçti. Yeni uygulama/SQL değişikliği, production/push/deploy yok. Yayın ve canlı kabul açık; başka modül açılmayacak. [Tek teslim notu](BLOK_01_TESLIM.md).

> **039 — Blok 1: aday firma uyumluluğu yerelde tamamlandı.** Aday ve aktif firmalar yeni operasyona uygun; CRM durumu kendiliğinden değişmiyor. Yedi SQL fonksiyonu, firma seçimi ve kurulum sayacı birlikte düzeltildi. 9 native kontrol, 159 unit/genel 5/5, gerçek yerel Auth ile aday firma → şube/CSV → talep → atama → plan/arama/teyit → yeni oturumdan okuma ve build geçti. Geçici veriler temizlendi. Canlı/push/deploy yok; 02800,02900,20260910000100 production’da bekliyor. Blok kapanmadı; sıradaki haftalık CSV kullanıcı kabulü ve birlikte teslim envanteri. [Kanıt](ADAY_FIRMA_OPERASYON_UYUMU.md).

> **2026-09-10 — Kullanıcı kararı: bloklar hâlinde teslim, liderlik Codex’te.** Her tur dış ajan yanıtı beklenmeyecek. Codex uygulama, test ve düzeltmeleri uçtan uca tamamlar; Claude Code/Chat için anlamlı teslim noktalarında tek inceleme paketi hazırlanır. İlk blok günlük operasyon ve işe başlama kabulüdür. [Çalışma düzeni](BLOK_CALISMA_DUZENI.md).

> **2026-09-10 — Claude yanıtları değerlendirildi.** Chat canlı şube → personel → talep → atama zincirini 4/4 ölçtü; işe başlama arama/teyit kabulü açık. Aday firma uyumsuzluğu kodda doğrulandı, düzeltmesi sırada. Fable bulguları 038 ile yerelde giderildi. Yayın manifestinin 246 dosyası hem fb1b218 hem HEAD ile eşleşti; 036–038 çalışma ağacı farkları henüz yayında değil. Öncelik uyumluluk düzeltmesi, bağımsız kabul ve gerçek kullanım pilotu. [Kararlar ve görevler](CLAUDE_YANITLARI_KARAR_2026-09-10.md).

> **038 — Fable bulguları yerelde düzeltildi.** Kesin retlerde tek komutun sunucudan uzlaştırılması; plan öncesi manuel görüşme/teyit, saniye hassasiyeti ve dar giriş doğrulaması tamamlandı. 02900 yalnız dedicated yerelde. 157 unit, genel 5/5, yeni 7 SQL kontrolü, Fable yarış/kapsam regresyonları 26/26, gerçek yerel Auth/RPC, tarayıcı ret mesajı ve build geçti. Canlı 035 ve 27 migration değişmedi; 02800/02900 henüz production’da değil. [Düzeltme ve kanıt](FABLE_REVIEW_01_CODEX_TRIYAJ.md). Sıradaki iş 036–038 yayın adayının birlikte kabulü; production gerçek atama kabulü açık.

> **037 — Dashboard İşe Başlama özeti yerelde tamam.** Takip bekleyenlerin gerçek toplamı, ilk3kayıt, kontrol zamanı ve aynıgünün aksiyon listesine bağlantı eklendi. YeniSQLyok;02800gerekiyor.151unit/genel5/5,izolebuild,yerel0→1sayaçvefiltrelibağlantı kabulü geçti; geçici kayıtlar temizlendi. Canlı035/27migration değişmedi. Fable sonuç raporu geldi; sıradaki ikiP2vebirP3bulgunun Codex doğrulaması/düzeltmesi. Git yayını `fb1b218`, devir `2b53d98` olarak başka çalışma tarafından commit edilmiş; push bu tur ölçülmedi. [Kanıt](DASHBOARD_ISE_BASLAMA_OZETI.md).

> **036 — yerel tamamlandı, canlıya yayınlanmadı.** İşe Başlama Takibi arama/sorumlu/aksiyon filtreleri artık yeni `ops_start_board_filtered` RPC ile tüm gün üzerinde, sayfalama öncesi çalışır. 02800 yalnız dedicated yerelde; canlı035ve27migration korunuyor. 8nativeSQL,gerçek yerelAuth/RPC,genel5/5veizolebuild geçti. Kaynak çalışma ağacı artık035yayın snapshotından farklıdır. [Plan/kanıt](ISE_BASLAMA_TUM_GUN_FILTRELERI.md). Gerçek production atama/teyit kabulü hâlâ açık.

> **035 — 2026-09-09: Vercel production yayını tamamlandı.** [İşe Başlama Takibi](https://www.bpsys.net/talepler/ise-baslama) canlı Supabase üzerinde açılıyor. 27/27 migration uygulanmış durumda. Yeni sürüm `dpl_7dGwr1wHZc2REPBUYuJwjNnE6RZk`; production sağlık 5/5 ve mevcut hesapla takip + Dashboard okuma geçti. Bugün atama olmadığı için production arama/teyit yazma kabulü açık; yerel SQL/Auth/RPC/tarayıcı kabulü geçerli. localhost yerel kalır; git push yapılmadı, çalışma ağacının uygulama dosyaları CLI ile yayınlandı. Önceki frontend-bekliyor notları tarihseldir. Kanıt: `supabase/manual/release-20260909.md/json`.

> **034 — Supabase aktarımı tamam:27/27.** Son001600/002300/002400 kullanıcı devam onayıyla canlıya uygulandı. 27SQL SHA256 eşleşti, ledger uzlaştırıldı. Görev/davet/kayıt izinleri ve altı canlı salt-okunur kontrol geçti. Paket migration'ı beklemiyor. **localhost yerel; frontend deploy ve production kimlikli yazma smoke'u henüz yok.** Sıradaki bu paketin canlı UI yayını ve İşe Başlama Takibi kabulü; başka modüle geçme. Kanıt: supabase/manual/release-20260909.md/json.


> **033 — canlı durum24/27:** 001300–001500,001700–002200,002500–002600 de uygulandı, SHA256 veledger doğrulandı. Yalnız001600/002300/002400 için otomatik denetimin istediği oturum/rol etkilerine özgü onay bekliyor. İşe Başlama, kurulum, günlük özet veaktivite canlı salt-okunur probe geçti. localhost yerel; frontenddeploy yok. Ayrıntı supabase/manual/release-20260909.md.


> **032 — 2026-09-09: canlı aktarım kısmi, İşe Başlama Takibi kalıcı.** Canlıya 000100–001200 ve 002700 olmak üzere 13 migration uygulandı; SQL SHA256 doğrulandı, ledger özgün sürümlerle uzlaştırıldı. 001300–002600 mevcut modül değişiklikleri otomatik onay denetimi nedeniyle ayrı kullanıcı onayı bekliyor. 145 unit/genel+SQL+build 23/23; yeni takip 16SQL ve gerçek yerel Auth/RPC, tarayıcıda kayıt+reload geçti. localhost hâlâ yerel Supabase; frontend deploy yok. Güncel ayrıntı: [Canlı aktarım defteri](../supabase/manual/release-20260909.md).


> **031 — 2026-09-09:** Yeni kullanıcı önceliği İşe Başlama Takibi. Connecteam/Deputy/RotaCloud/When I Work resmi belgeleri incelendi; kaynaklı UX+veri planı ve kayıt oluşturmayan etkileşimli önizleme hazır.140unit/genel/type/build6/6. Sıradaki başlangıç saati+sorumlu+plan snapshot ve scoped SQL okuma. Gerçek arama/teyit kaydı henüz yok. [Plan](ISE_BASLAMA_TAKIBI_PLANI.md). Luca/proje işleri korunur; önceki sıradaki notları tarihseldir.


> **030 — 2026-09-09 (SQL yok):** Luca bekleyen onay kimliği mali satır saklamadan kalıcı. Aynı dosya/eşleme reload sonrası aynı UUID; farklı dosya/eşleme bloklanır.134unit/genel/type/build6/6, gerçekAuth/RPC kimlik kurtarma geçti. Browser gerçek reload E2E açık. [Kanıt/sınırlar](LUCA_KALICI_KURTARMA_DILIMI.md). Sıradaki sunucu receipt durum uzlaştırması; proje tanımı/gerçek çıktı kolonları açık. Önceki sıradaki notları tarihseldir.


> **029 — 2026-09-09:** Luca tek transaction onayına geçti (migration02600, yalnız yerel). Upload/satır/alacak birlikte; tenant+firma sınırı, aynı komut tekrarı ve eski bypass kapısı kapalı.9nativeSQL,gerçekAuth/RPC,128unit/genel/type/build6/6. Sıradaki kalıcı yeniden deneme ve gerçek export/proje eşleme sözleşmesi. Proje tanımı kararı açık. [Kanıt/sınırlar](LUCA_ATOMIK_ONAY_DILIMI.md). Önceki sıradaki notları tarihseldir.


> **028 — 2026-09-09:** Kullanıcı önceliği proje finansalı + Luca. Gelişmiş özet düğmesi ilk kaynak görünümü olarak eklendi; proje kârlılığı henüz hesaplanmıyor. Mevcut Luca yalnız firma açık alacağı üretir.128unit/genel/type/build6/6, modal tarayıcı kabulü. Sıradaki aktarım tenant/atomiklik incelemesi; proje tanımı için kullanıcı cevabı bekleniyor. [Plan ve sınırlar](PROJE_FINANSALI_VE_LUCA_PLANI.md). Banka/otel pilotu korunur; önceki sıradaki notları tarihseldir.


> **027 — 2026-09-09 (ürün SQL yok):** Finansal ekranın boş/dolu/yalnız firma kaydı kabulü yerel tarayıcıda geçti. Eksik gecikmiş firma sayısı artık sıfır değil bilinmiyor; mali yenileme düğmesi eklendi.128unit ve genel5adım geçti; ilk build DNS nedeniyle başarısız, yalnız build tekrarı geçti. İki sentetik mali kayıt temizlendi. Sıradaki [banka/otel uçtan uca pilot](PILOT_UCTAN_UCA_KABUL.md). [Kanıt](FINANSAL_OKUMA_KABULU.md). Önceki sıradaki notları tarihseldir.


> **026 — 2026-09-09 (SQL yok):** Raporlarda günlük özet + haftalık çıktı erişimi, önceki kayıtların açık ayrımı; finansal özetten eski iş gücü/talep ve kritik firma sayaçları kaldırıldı. Mali okuma hatası ayrı, yeniden denemeli; hata/yüklemede PDF düğmesi yok. Genel/type/build6/6,128unit ve yerel tarayıcı doğrulandı. Sıradaki **pilot kabul senaryosu ve mali ekranın başarılı/boş okuma kabulü**. P06 veri geçişi ile davet email/PKCE/hook kapıları açık. [Kanıt](RAPOR_KAYNAKLARI_GECIS_DILIMI.md). Önceki sıradaki notları tarihseldir.


> **02500 — 2026-09-09:** Dashboard günlük operasyon verisine bağlandı: bugün talep/istenen/yerleştirilen/eksik sayıları ve ilk 5 açık talep. 8 native SQL, gerçek Auth/RPC, genel/type/build 6/6 ve tarayıcı geçişi doğrulandı. Sıradaki P06 raporlar/finansal özet eski talep kaynağının anlam ve geçiş incelemesi; ardından pilot. E-posta/PKCE/hook kabulü hâlâ açık. [Kanıt ve sınırlar](DASHBOARD_GUNLUK_OPERASYON_DILIMI.md). Önceki sıradaki notları tarihseldir.


> **02400 — 2026-09-09:** Davetle yeni hesap `/kayit`, PKCE callback ve güvenli profile defaults yerelde.18SQL, gerçekAuthsignup/kabul,127unit,genel/type/build6/6. E-posta doğrulama bağlantısı ve prod hook uçtan uca kabulü açık. Sıradaki **Dashboard eski/yeni operasyon kaynaklarını birleştirme**. [Kanıt/sınırlar](MUSTERI_KURULUMU_VE_DAVETLER.md). Önceki sıradaki notları tarihseldir.

> **02300 — 2026-09-09:** Mevcut hesap için davet oluştur/listele/iptal/kabul yerelde tamam. 13SQL, gerçekAuth/RPC,127unit,genel/type/build6/6. Sıradaki yeni hesap için Auth davet/ilk giriş ve yerel uçtan uca kabul; e-posta gönderimi henüz yok. [Davet teslimi ve sınırlar](MUSTERI_KURULUMU_VE_DAVETLER.md). Önceki sıradaki notları tarihseldir.

> **02200 — 2026-09-09:** Çalışma alanı kurulum ekranı yerelde tamamlandı; gerçek envanter ve yönetici/tenant sınırı. 10SQL, gerçek Auth/RPC, genel/type/build6/6 (125 operasyon unit). Sıradaki **davet oluşturma/iptal/kabul**, plan: [Müşteri kurulumu ve davetler](MUSTERI_KURULUMU_VE_DAVETLER.md). Davet gönderimi henüz yok; prod/push/deploy yok. Aşağıdaki eski sıradaki notları tarihseldir.

> **2026-09-09 yeni öncelik:** Dashboard risk/otel kartları kaldırıldı; son aktiviteler gerçek kayda bağlandı (02100, yerel). Sıradaki **yeni müşteri kurulumu + kullanıcı davetleri**, ardından eski/yeni operasyon göstergelerini birleştirme ve pilot. Evrak takip sahipliği planı korunuyor, ilk sırada değil. Güncel sıra ve sınırlar: [Dashboard ve SaaS sırası](DASHBOARD_VE_SAAS_SIRASI.md). Aşağıdaki eski “sıradaki” notları tarihseldir.

Tarih: 2026-09-08. Kaynak: Furkan'ın bu oturumdaki doğrudan yönlendirmesi.
Durum: Güncel planlama yönü; test/örnek iş verisi temizliği onaylandı. Kod, şema ve gerçek hesaplar korunacak.

## Güncel teslim — 2026-09-09

Son teslim02000: ana PDF + bağımsız çoklu ek protokol/sürüm geçmişi.121unit,
32native (01900 regresyonu dahil),15Auth/Storage/HTTP,full18/18.20migration yerelde.
İki ek,tek ek replace,eski PDF görüntüleme ve firma evrak bağlantısı browser'da geçti.
Rapor `/var/folders/fg/qm_gg6w16299dhr_lz9xr38r0000gn/T/bps-acceptance-3LQQlC/report.md`. SOZLESME_EK_PROTOKOL_DILIMI.md kanıt/sınırlar.
Sıradaki EVRAK_TAKIP_SAHIPLIGI_DILIMI.md; eski son/sıradaki notları tarihseldir.

Son teslim 01900: ilk PDF ve değiştirme için kalıcı yükleme komutu, kesintiden
aynı komutla devam, iptal kaydı ve sunucuda byte kontrolü. 115 unit, 20 yeni
native yükleme kontrolü, 10 gerçek Auth/Storage/HTTP kontrolü. Gerçek tarayıcı
file chooser, reload sonrası devam, yanlış dosya reddi, iptal ve eski/güncel PDF
ayrı ayrı açılarak doğrulandı. 19 migration yalnız sentetik yerelde.
Son full paket: 17/17 geçti — `/var/folders/fg/qm_gg6w16299dhr_lz9xr38r0000gn/T/bps-acceptance-XC4PZO/report.md`. Ölçüm ve sınırlar:
SOZLESME_PDF_YUKLEME_DEVAMLILIGI_DILIMI.md.
Sıradaki SOZLESME_EK_PROTOKOL_DILIMI.md: ana PDF + bağımsız ek protokoller.
Aşağıdaki son/sıradaki kayıtları tarihseldir; bu üst kayıt günceldir.

Son teslim01800: PDF sürüm geçmişi, CAS replace, scoped eski indirme ve retained
Storage koruması.105unit/18PDFnative/10gerçek StorageAPI, sonfull16/16.
Tarayıcıda iki sürüm ve eski sürüm linki doğrulandı; native file chooser henüz açık.
18migration yalnız sentetik yerelde. SOZLESME_BELGE_SURUMLERI_DILIMI.md ölçüm/sınırlar.
Sıradaki SOZLESME_PDF_YUKLEME_DEVAMLILIGI_DILIMI.md: kalıcı upload komutu + yeniden
deneme/finalize; ardından ek protokol. Aşağıdaki sıradaki kayıtları tarihseldir.

Son teslim01700: gerçek sözleşme yenileme görevi/sorumlusu/tarihi; manuel flags
kaldırıldı, revision+receipt+tek ilişki.101unit,18yenileme native,7yerel API;
full15/15. Browser çift tık1task→devir→yeni owner doğrulandı.17migration yalnız
sentetik yerelde; SOZLESME_YENILEME_SAHIPLIGI_DILIMI.md kanıt ve sınırlar.
Sıradaki SOZLESME_BELGE_SURUMLERI_DILIMI.md; ana PDF geçmişi, sonra ek protokol.
Aşağıdaki “en son/sıradaki” notları önceki aşamaların tarihsel kayıtlarıdır.

En son iki aşama: TOPLU_GOREV_DEVIR_DILIMI.md + KULLANICI_AYRILIS_KAPISI_DILIMI.md.
01500 önizlemeli100'lük atomik devir/receipt/history;01600 aktif işi bırakacak
üyelik/rol değişimini engeller ve eşzamanlı görev yazısını canlı üyelik/rolle sınar.
96unit,26devir native,19üyelik guard native; son paket14/14, ayrıca devirAPI10 ve
üyelikAPI7. Browser devir2/kalan0.16 migration dedicated yerelde, üretimde değişiklik yok.
Admin owner/ACL korunur, eski000400 dosyası değişmez. Tam hesap kapatma P10 açık.
Sıradaki SOZLESME_YENILEME_SAHIPLIGI_DILIMI.md: manual “sorumlu/görev var” flags
ile gerçek kullanıcı/görev arasındaki boşluğu kapatma. Aşağıdaki önceki sıradaki
dilim notları tarihsel; en üstteki teslim ve plan esas alınır.

En son ek: firma detayından randevu planlama ve form kabulü tamamlandı. Native tarih
seçiciyle UI yaratma geçti; çift tıklama1satır, pasif ret0, iptal0. Hata halinde taslak
korunur; scope değişiminde kapanır. Son hızlı kabul+build6/6, ayrı randevu API9/9.
RANDEVU_FORM_BAGLAMI_DILIMI.md kanıt ve sınırlar; SQL değişmedi. Sıradaki
TOPLU_GOREV_DEVIR_DILIMI.md; manuel toplu devir planı, ayrılış/admin entegrasyonu açık.
Aşağıdaki tarih UI kabulü açık notu bu ölçümle güncellendi.

En son ek: randevu sonucu + takip görevi yeni scoped RPC/receipt ile tek transaction.
Tekrar aynı sonucu döndürür, task hatası randevuyu da geri alır; pasif firmada açık
skip. Eski güvensiz RPC kapalı kaldı. 85 unit,12/12 paket,22 native randevu ve9
gerçek yerel randevu API kontrolü geçti. Tarayıcı tamamlaması1randevu/1task/1receipt.
12 ops+1 görev+1 randevu migration yalnız dedicated yerelde; üretim değişmedi.
RANDEVU_TAKIP_BUTUNLUGU.md kanıt/sınırlar. Sonraki RANDEVU_FORM_BAGLAMI_DILIMI.md:
firma bağlamı ve açık yeni-randevu tarih UI kabulü; IAB date fill sorununun uygulama
mı araç mı olduğu henüz ölçülmedi. API yaratma geçti, UI yaratma tamamlandı sayılmaz.

En son ek: görev atama geçmişi ve sürüm kontrollü güncelleme yerelde tamamlandı.
Her task yazısı revision ilerletir; mevcut uygulama update'leri eski revision ile
yazamaz. Atama kimliği değişimleri DB trigger'ıyla kaydedilir, hızlı panelde son20
görünür. Mevcut görev policy'leri değişmedi. 79 unit, tam paket11/11, ayrı16 native
task kontrolü ve11 yerel görev API/servis kontrolü geçti; tarayıcı conflict→yenile→
atama geçmişi ölçüldü. 12 ops migration +1 görev migration yalnız dedicated yerelde.
GOREV_DEVIR_DILIMI.md sınırlar ve kanıt; randevu tamamlama ilerlemesi üstteki ektedir.
Admin kullanıcı taşıma otomatik devir yapmaz; bunun tamamlandığı iddia edilmez.

Son ek: günlük talep kartından mevcut görev formuna doğrulanmış firma/başlık
önseçimi tamamlandı. Kaynak manuel; kalıcı talep ilişkisi ve otomatik durum eşleme
yok. Mevcut görevi atama/kaldırma/kapama akışı korundu. 75 unit, tam kabul10/10,
ayrı9 gerçek yerel görev servis testi ve tarayıcıdan tek kayıt ölçüldü.
Detay: GOREV_BAGLAMI_DILIMI.md. Devir geçmişi/eşzamanlı edit teslimi üstteki güncel
ekte tamamlandı; mevcut motor çoğaltılmadı. Test şemasına görev/profile
yardımcıları eklendi; bu üretim migration'ı veya tam tarihsel şema değildir.

Yerel pilotta firma/şube, CSV aktarımı, günlük ve toplu talep, atama, iptal,
kapasite düzenleme, haftalık plan ve müşteri CSV'si var. Gerçekleşme (geldi / gelmedi /
henüz bildirilmedi) ile atomik personel değişimi eklendi. İptal ve kaldırma tarihsel
bildirimi silmez; plan ve gerçekleşme ayrı görünür. Kayıp yanıtlar kalıcı komut
kimliğiyle sorgulanır veya aynı kimlikle tekrar denenir.

68 birim, 181 DB, 48 native yarış ve 42 yerel API kontrolü geçti. Önceki6 HTTP
CSV kontrolü geçerli; export davranışı değişmedi. On iki pilot migration yalnız
sentetik yerelde uygulandı. Üretim/push/deploy ve asıl iş verisi temizliği yapılmadı.
Mobil390px akışlar ölçüldü.

Açık kabul: native PDF sayfalaması, tam tarihsel prod şeması, migration sahibi ve
admin/Auth entegrasyonu. Haftalık gerçekleşme özeti de tamamlandı; iptal/kaldırma geçmişi dahil, ayrı zaman
damgalı ve plan filtresinden bağımsız. Plan CSV'si hâlâ planlanan atamaları gösterir.
Günlük operasyon kontrol listesi tamamlandı: açık ihtiyaç, aktif gelmedi ve günü
gelen bildirilmemiş atamalar; filtre/arama ve hedef günlük karta bağlantı. İptal ve
kaldırılmış atamalar aksiyon sayılmaz. Liste ayrı bir görev/ücret kararı oluşturmaz.
Şube/personel dizini tamamlandı: /talepler/dizin, sunucuda50 satır/sayfa, kod/ad/il
araması, aktif/pasif filtresi; şube firma kapsamında, personel çalışma alanı kapsamında.
Başındaki sıfırlar korunur; kodsuz şube için kod türetilmez. Canlı performans ölçülmedi.
Yönetici aktif/pasif işlemi tamamlandı: revision + kalıcı komut, korunan atama/geçmiş,
atama/pasife alma iki yönlü yarış kabulü. ops_mutate atama lokasyon kontrolü SHARE
kilidi alır. Operasyon rolü salt-okunur kalır; pasif firma şubesi aktifleştirilemez.
Yerel kabul paketi tamamlandı: `npm run qa:acceptance`, seçmeli SQL/API/build
modları ve private JSON/Markdown rapor. Tam10 adım exit0;11 runner davranış testi.
Build geçici .env'siz kopyada çalışır, açık dev sunucusu korunur. Eksik runtime exit1.
P07 ilk kod envanteri ve talep→görev önseçimi tamamlandı. Sıradaki dar iş
GOREV_BAGLAMI_DILIMI.md içindeki devir geçmişi/eşzamanlı edit sınırlarıdır.
Aşağıdaki tarihli ekler önceki aşamaların kayıtlarıdır.

## Başlangıç

Furkan uygulamanın gerçek operasyonda kullanılmadığını belirtti. Bu nedenle önceki
“tamamlandı” listeleri kullanım başarısı veya korunması zorunlu ürün kapsamı sayılmaz.
Eski Vault notları tarihsel bağlamdır; yeni ürünü geçmiş paket numaraları belirlemez.
Canlı şema/kod mevcut teknik varlıklardır, ihtiyaçların yerine geçmez.

Demo/dev projesi silinmiş olabilir (Furkan'ın hatırlaması). Yerel env dosyasında
eski URL bulunması projenin varlığını kanıtlamaz. Önceki bps-dev yönü tarihsel karardır;
bugünkü ortam varlığı doğrulanana kadar geliştirme ortamı **belirsiz** sayılır.

## Ürün odağı

Bir operasyon çalışanı bankadan gelen ihtiyacı kaydeder, doğru şubeyi seçer,
personeli yerleştirir ve haftalık müşteri listesini çıkarır. Yönetici eksikleri
görür. İlk başarı ölçütü bu işin gerçek bir hafta boyunca BPS'te yapılmasıdır.

İlk dilim: firma → şube → günlük ihtiyaç → personel atama → çıktı.
Sonra görev/devir, sözleşme/evrak ve bildirimler bu akışa bağlanır. Finans ve diğer
modüller mevcut diye yeniden genişletilmez; ilk kullanıcı işini etkileyen sorunlar çözülür.

## Teknik öneri

Mevcut Next.js/TypeScript/Supabase tabanını değerlendirerek kullan. Uygun olmayan
modülleri değiştirmek serbesttir; çalışan her şeyi yeniden yazma zorunluluğu yoktur.
Kodu korumak bir amaç değil, doğrulanmış parçaları yeniden kullanmak zaman kazancıdır.
Tablo/alan ve API önerileri teknik planda taslaktır; ihtiyaç ve testle kesinleşir.

Eski borçların tamamını kapatmayı yeni ürüne başlama şartı yapma. Yeni akışın
güvenli geliştirilmesi için gereken auth, tenant, şema temeli ve test ortamını önce kur.
İlgisiz borçları ayrı kaydet. Her küçük teslim uçtan uca çalışır ve kanıtıyla kapanır.

## Sıfırlama kararı — onaylandı, henüz uygulanmadı

Furkan açıkça seçti: **test/örnek iş verilerini temizle; kod, şema ve gerçek hesaplar kalsın.**
Bu karar projeyi, Auth hesaplarını veya migration geçmişini sıfırlama yetkisi değildir.

Temizlikten önce tablo ve Storage envanteri, korunacak hesap/tenant/
ayarlar, FK bağımlılıkları ve geri yüklenebilir yedek hazırlanır. Hedef satırlar ve
dosyalar sayılı manifestte gösterilir. İş verisi, Auth, Storage, migration ledger
birbirinden ayrılır; “hepsi test” ifadesinden bütün projeyi silme sonucu çıkarılmaz.

## Yürütme sırası

1. **Başlangıç haritası:** hangi ortamlar gerçekten var, ne korunacak/ne temizlenecek,
   yeni akışın ihtiyaç duyduğu temel şema ve hesaplar. Çıktı: kısa envanter ve reset manifesti.
2. **Tek dikey dilim:** bir firma ve şube için bir günlük talep oluştur, bir kişi ata,
   listede göster. Rol/tenant ve eşzamanlı atama testleri bu dilimin parçası.
3. **Ölçekli giriş:** şubelerin Excel/CSV aktarımı, kaynak kimliği, tekrar yükleme ve
   değişiklik önizlemesi. Resmî kaynak adaptörü erişim doğrulandığında aynı hatta bağlanır.
4. **Gerçek haftalık operasyon:** toplu günler, kısmi değişiklik/iptal, açıklar ve müşteri çıktısı.
5. **Pilot:** bir hafta gerçek kullanım; hata/eksik ve giriş yükü ölçümü. Sonra diğer modüller.

Bu sıra önceki P02→P03 kod sırasını revize eder: tüm import altyapısı bitmeden
tek firma/şube üzerinde talep→atama akışı denenir. Şube çekirdeği 2. adımda,
toplu aktarım 3. adımda gelir. Özel personel/rol/takvim kararları ilgili adımda kapatılır.

## Ortak çalışma

Codex teknik yönü, küçük uygulama görevlerini ve review ölçütlerini hazırlar.
Claude Code uygulama yapar; Codex bağımsız inceler. Görev sahibi açıkça değişirse
Codex de uygulayabilir; aynı dosyalarda eşzamanlı düzenleme yapılmaz.
Furkan gerçek kullanım sonucunu değerlendirir. Her tur sonunda repo ve Vault'a
güncel durum, ölçüm kaynağı, açık işler ve sıradaki adım yazılır.

## Önceki belgelerle ilişki

İlk kod ilerlemesi: [Günlük operasyon dilimi](ILK_OPERASYON_DILIMI.md). Tarih,
doluluk ve atama ön kontrolü üzerine günlük ekran, server action/service ve atomik
DB RPC kodu eklendi (2026-09-09). 13 domain/form testi ve geçici PostgreSQL testleri
geçti; migration/deploy yapılmadı. İki bağlantılı yarış ve kimlikli kabul bekliyor.

[İş planı](BPS_OPERASYON_SAAS_IS_PLANI.md), [teknik tasarım](BPS_TEKNIK_UYGULAMA_PLANI.md)
ve [uzlaştırma](BPS_BASLANGIC_UZLASTIRMA_PLANI.md) ayrıntı/backlog olarak saklanır.
Güncel yürütme yönü bu belgedir; eski bitiş oranları ve paket sıraları bağlayıcı değildir.
Ürün davranışını değiştiren dar SoT güncellemeleri ilgili uygulama diliminden önce yapılır.


2026-09-09 ek ilerleme: yöneticiye özel CSV şube önizleme/aktarım kodu eklendi.
Tekrar yükleme aynı kod/içerikte atlar; çakışmada parti geri alınır. 19 domain/form/CSV
ve 37 geçici PostgreSQL kontrolü geçti. İkinci migration da uygulanmadı. Kaynak
kurumdan alınan CSV'dir; internetten otomatik şube keşfi henüz geliştirilmedi.


2026-09-09 kabul ilerlemesi: geçici native PostgreSQL 17.10 üzerinde iki bağımsız
bağlantı/gerçek kilit beklemesiyle 12 kontrol geçti. Önceki yarış-test-bekliyor notu
lokal paket için kapandı. Kimlikli tarayıcı ve Supabase Auth/admin entegrasyonu
bekliyor; migration/deploy yapılmadı. Ayrıntı pilot runbook'un native test ekinde.


2026-09-09 son durum: Docker disk engeli çözüldü; yerel Supabase PostgreSQL 17.6
açıldı. 17 gerçek Auth/API kontrolü geçti. İki pilot migration yalnız ayrı yerel
sentetik şemaya uygulandı; prod uygulanmadı. Kimlikli browser ve tam tarihsel
şema/admin RPC kabulü sırada. Yerel ortam açık, .env.local değiştirilmedi.


2026-09-09 son kabul: yerel yönetici temel günlük akışı ve CSV aktarımı tarayıcıdan
doğrulandı; iptal dialog'u uygulama içine alındı. Tekrar import 0 ekleme/2 atlama,
iptal 0 aktif atama. Üretime migration/deploy uygulanmadı. Tam tarihsel şema ve
admin entegrasyonu ile diğer rol/mobil/ağ-hatası UI senaryoları ayrı bekliyor.


2026-09-09 rol/mobil ilerlemesi: yerel operasyon talep/ataması, açık ekranda yetki
kaldırılınca yazının reddi ve İK erişim reddi doğrulandı. Mobilde sabit sol menünün
içeriği sıkıştırması düzeltildi; 390 px pilotta yatay taşma yok, menü/Escape/masaüstü
geçişi çalışıyor. Tüm modüllerin mobil kabulü tamamlandı sayılmaz.


2026-09-09 ağ kabulü: 7 gerçek yerel SDK/servis kayıp-yanıt kontrolü geçti.
Tarayıcıda API kesintisi/geri dönüş sınandı; yanlış boş-plan/yetki mesajı ayrıldı,
pilot HTTP isteği başına 12 sn sınırlandı. Kalıcı komut kurtarma ve ilk oturumun
tüm kesinti senaryoları hâlâ kapsam dışı. Üretime yazma/deploy yok.


2026-09-09 kalıcı kurtarma: aynı tarayıcıda sayfa yenilemesi sonrası bekleyen
form/CSV işlem kimliği korunuyor; scoped RPC hesap/tenant değişimini reddediyor.
28 birim, 46 PostgreSQL, 14 yarış, 11 gerçek yerel API/servis kontrolü geçti.
Tarayıcı kesinti → yenileme → aynı form → başarı: 1 kayıt/1 olay ölçüldü.
Üçüncü migration yalnız yerel sentetik DB'ye uygulandı. Üretim değişmedi.
Sıradaki dar iş: bekleyen kimlikleri sunucu sonucuyla uzlaştırma; özellikle artık
tekrar gönderilemeyen atama/iptal ve kalıcı sunucu hataları. Ayrıntı kabul defterinde.
