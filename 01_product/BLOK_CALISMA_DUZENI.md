# BPS — Bloklar hâlinde geliştirme ve teslim

2026-09-10 · Kullanıcının kararı: proje liderliği Codex'te; her tur Claude Chat ve Claude Code arasında çıktı taşıma düzeni sona erer. Bu karar önceki notlardaki her dilim sonrası dış inceleme sırasını günceller.

## Sorumluluk

Codex ürün sırasını, teknik tasarımı, uygulamayı, Supabase değişikliklerini, testleri, bulgu düzeltmelerini ve yayın hazırlığını birlikte yönetir. Rutin teknik kararları mevcut kapsam içinde verir. Furkan öncelikleri ve gerçek kullanım geri bildirimini sağlar; her teknik adım için mesaj taşıması veya yeniden “devam” demesi beklenmez. Gerekli kullanıcı kararları, eldeki kanıt ve somut seçeneklerle topluca sunulur.

## Blok sözleşmesi

Bir blok, kullanıcıya anlamlı bir uçtan uca sonuç verir. Yalnız ekran tasarımı veya migration yazılması blok tamamlandı sayılmaz. İlgili veri modeli, yetkiler, istemci, hata durumları ve uygun katmandaki kabul birlikte ele alınır. Kod küçük ve incelenebilir değişikliklere ayrılabilir; kullanıcıya teslim ve dış inceleme blok düzeyinde yapılır.

Codex geliştirme → test → düzeltme döngüsünü kendi içinde tamamlar. Dış ajan cevabı olağan ilerleme kapısı değildir. Yetki, veri bütünlüğü veya geri alınamaz işlem gibi somut bir açık sorun varsa ilgili teslim durur; diğer bağımsız işler sürer. Mevcut işlem yetkileri geçerlidir; çalışma düzeni değişikliği önceki açık retleri veya otomasyonun production sınırlarını kaldırmaz.

Her blok sonunda tek teslim kaydı hazırlanır:

- Kullanıcının artık yapabildiği işler ve değişen davranışlar.
- Kod sürümü ve migration listesi; yerelde doğrulanan, yayın adayı olan ve canlıya çıkan kapsam ayrı belirtilir.
- Çalıştırılan kabul kontrolleri ve açık kalan sınırlar.
- Yayın yapıldıysa deployment ve migration kanıtı; yapılmadıysa kalan somut adım.
- Dış inceleme gerekiyorsa aynı sürüme bağlı tek inceleme paketi ve kısa görevler.

## Claude Code / Fable ve Claude Chat

Claude Code / Fable tamamlanmış blok veya birden fazla ilişkili blok üzerinde bağımsız teknik inceleme yapabilir. Claude Chat aynı teslimin canlı kullanıcı akışlarını ve ürün kullanımını değerlendirebilir. Her küçük düzeltmede yeni tur açılmaz; sonuçlar tek bulgu listesinde toplanır, Codex önceliklendirip çözer. Tekrar inceleme yalnız etkilenen kapsam ve gerekiyorsa son toplu kabul içindir.

Ortak kaynak repo teslim notu ve Obsidian güncel kaydıdır; sohbet geçmişinin tamamının taşınması gerekmez. Kullanıcıya gerektiğinde tek paylaşılabilir dosya verilir. Dış ajanlarla otomatik iletişim kurulmuş varsayılmaz; bu düzen bir entegrasyon veya gönderim işlemi değildir. Dış inceleme için paketin hazırlanması, o incelemenin yapılmış olduğu anlamına gelmez.

## İlk blok: günlük operasyon ve işe başlama kabulü

Hedef: firma → şube → personel → talep → atama → işe başlama planı → arama → bağımsız teyit → Dashboard zincirinin tutarlı çalışması.

Kapsam: aday/aktif/pasif uyumluluğu; mevcut 036–038 yerel filtre, Dashboard ve Fable düzeltmelerinin birlikte kabulü; şube CSV ve haftalık çıktı uyumluluğu; sürümü belirli Git/yayın paketi; mevcut yetki kapsamında Supabase ve Vercel teslimi ile canlı kabul. Tamamlanma raporu canlıda henüz ölçülmeyen akışı kapalı gösteremez. Gerçekliği belirsiz kayıtların silinmesi bu blokta kendiliğinden yapılmaz.

İlk blok kapanmadan yeni modüle geçilmez. Sonraki blokların sırası mevcut yol haritası ve gerçek operasyon pilotundan gelen geri bildirimle belirlenir; her blok kendi içinde kullanılabilir bir sonuç sunar.

## İletişim

Çalışırken kısa, anlamlı ilerleme bilgisi; blok sonunda tek sonuç raporu. Sürekli izin, sohbet aktarımı veya dış ajan yanıtı isteme döngüsü kurulmaz. Kullanıcı isterse kapsamı değiştirebilir veya çalışmayı durdurabilir.
