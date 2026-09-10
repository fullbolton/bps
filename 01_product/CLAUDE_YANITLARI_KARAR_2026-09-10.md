# Claude Chat ve Fable yanıtları — değerlendirme ve sonraki kabul

> **2026-09-10 — Kullanıcı kararı: bloklar hâlinde teslim, liderlik Codex’te.** Her tur dış ajan yanıtı beklenmeyecek. Codex uygulama, test ve düzeltmeleri uçtan uca tamamlar; Claude Code/Chat için anlamlı teslim noktalarında tek inceleme paketi hazırlanır. İlk blok günlük operasyon ve işe başlama kabulüdür. [Çalışma düzeni](BLOK_CALISMA_DUZENI.md).

Tarih: 2026-09-10. Bu kayıt, kullanıcının ilettiği iki raporu güncel yerel durumla birleştirir. Bu turda yeni production sorgusu, yazması veya yayın yapılmadı.

## Ölçümler ve sürümler

- **Claude Chat'in canlı ölçümü:** Mek Group Auth oturumunda şube → personel → günlük talep → atama zinciri 4/4; 2 kişi talep / 1 yerleştirme / 1 eksik; son aktiviteler doğru. Altı operasyon rotası açılmış. Bu, başka ajanın gerçek ölçümüdür; Codex'in bu tur tekrarladığı bir test değildir. Arama → teyit ve gerçekleşme yazması bu raporda test edilmemiştir. Rapordaki “bir atama var” ifadesi ölçüm anına aittir.
- **Fable sonucu:** incelenen kapsamda kritik bulgu yok; iki P2 ve bir P3. Production yazma kabulü içermez. Asıl rapor `FABLE_REVIEW_01_SONUC.md` değiştirilmeden korunur.
- **Yerel düzeltme 038:** üç bulgu giderildi; 157 operasyon birim testi, genel kabul 5/5, yeni native SQL 7/7, korunmuş Fable s2/s4/s5 regresyonları 26/26, yerel Auth/RPC, tarayıcı ret akışı ve build geçti. Ayrıntı `FABLE_REVIEW_01_CODEX_TRIYAJ.md`.
- **Git düzeltmesi, bu tur ölçüldü:** yayın kaynak manifestindeki 246 dosyanın SHA256 değerleri hem `fb1b218` hem mevcut `HEAD=2b53d98` içeriğiyle 246/246 eşleşiyor. Dolayısıyla “yayın Git'e alınmadı” notu eskidi. Çalışma ağacı 036–038 ile ileride; bu değişiklikler henüz commit edilmiş değil. Push durumu ayrıca ölçülmedi. Bu kontrol yeni bir canlı deployment kontrolü değildir.
- **Yayın sınırı:** kayıtlı canlı baseline 035 / 27 migration. 02800 ve 02900 yerelde uygulanmış, production'da bekliyor. 038 manifestindeki 10 dosyanın hash'i bu tur tekrar eşleşti.

## Bulgular hakkında karar

### 1. Aday firma akışı — kabul, düzeltme açık

Yeni Firma akışı bilinçli olarak `aday` üretirken operasyon SQL'i `status='aktif'` istiyor. Günlük ekran bunu “pasif” diye açıklıyor. Kullanıcı firma ekledikten sonra operasyon açamıyor; aday ile pasif aynı kavram değildir.

Önerilen ürün kuralı: `aday` ve `aktif` operasyon başlatabilir; `pasif`, null ve bilinmeyen durumlar başlatamaz. Operasyon açılması firmanın CRM durumunu sessizce değiştirmemeli. Bu karar henüz koda uygulanmadı.

Tek bir guard değişikliği yeterli değil. Şube aktarımı (00200), toplu talep (00600), kişi sayısı değişikliği (00700), yedek atama (00900), dizin/ana mutasyon (01200), kurulum sayımları (02200), ilgili okuma RPC'leri ve istemci `active` yorumları birlikte taranmalı. Uygulanmış migration'lar değiştirilmeden yeni migration hazırlanmalı; yetki ve tenant sınırları korunmalı.

Kabul matrisi: aday / aktif / pasif / null veya bilinmeyen durum × elle şube / CSV şube / tek ve toplu talep / atama / yedekleme / sayaçlar. Pasife alınan firmanın mevcut geçmişinin görülebilmesi ve izin verilen kapatma işlemleri ayrıca korunmalı. Böylece geçmişteki kararlar da yerel testlerde temsil edilir; bu uyumsuzluk yalnız production'da bulunabilecek bir sorun değildir.

### 2. Fable düzeltmesi — bulgu kabul, önerilen uygulamada önemli ayrım

Her `P0001 + START_*` hatasında bekleyen kimliği doğrudan silmek güvenli değil: önceki çağrı commit olmuşken tekrar çağrısı üyelik/rol kontrolünde reddedilebilir. 038 ilgili tek komutu sunucudan uzlaştırıyor. `confirmed` başarı, `closed` kesin ret, `unknown` veya doğrulama hatası belirsiz sonuç olarak kalıyor. Kimlik yalnız doğrulanmış sonuca göre temizleniyor.

Plan öncesi gerçek manuel arama/teyit artık atama zamanına göre kabul ediliyor; saniye hassasiyeti sözleşmesi açık. Planlı adım, iş günü, gelecek ve ETA sınırları korunuyor. Dar cast hataları `START_INPUT` oluyor; sistem hataları gizlenmiyor.

### 3. Geliştirme sırası — mevcut akışı tamamla, pilotla öğren

Yeni modül açmak yerine mevcut kabulü kapatmak öncelik. Chat'in bir haftalık gerçek operasyon pilotu önerisi uygun. İletilen rapordaki heartbeat'i durdurma önerisi kullanıcı tarafından verilmiş bir durdurma talimatı değildir; bu tur otomasyon ayarı değiştirilmedi. Bu nottan yeni production yetkisi veya test verisi silme yetkisi çıkarılmaz.

## Somut görev dağılımı

1. **Codex:** aday firma uyumluluğunu yukarıdaki matrisle düzelt; 036–038 ve bu düzeltmeyi sürümü belirli yayın adayına toparla. SQL önce, uyumlu frontend sonra; yayın manifesti ve Git kaydı birlikte takip edilsin.
2. **Claude Code / Fable — sonraki bağımsız inceleme:** 02900 ve `start-failure.ts` farkını denetle. Özellikle önceki commit sonrası üyelik kaybı, reconcile başarısızlığı, plan öncesi olay, aynı saniye, cast hataları ve aday/aktif/pasif matrisi. Eski kırmızı testlerin revision ve eski hata kodu beklentilerini yeni sözleşmeye göre ayrı testlerle doğrula; orijinal raporu değiştirme. İncelenen commit/hash, komut, sonuç ve sınırları raporla. Bu görev production yazması veya deploy gerektirmez.
3. **Claude Chat — yayın sonrası canlı kabul:** açıkça belirlenmiş test atamasıyla plan → arama → şube/bağımsız kaynak teyidi → reload; tek olay ve doğru gerçekleşme; bozuk planın açık hata vermesi; yeni aday firmadan operasyon açılması; CSV şube ve haftalık çıktı. Her sonucu deployment, tarih ve kullanılan kayıt kimlikleriyle ilişkilendir. Gün değiştiyse eski “bugün bir atama var” bilgisine dayanma. Bu metin görev taslağıdır, dış ajana gönderilmedi.
4. **Pilot hazırlığı:** smoke kayıtlarını kimlik ve bağımlılıklarıyla sınırlı temizlik listesine al. Vakıf Katılım gibi gerçekliği belirsiz kaydı yalnız adına bakarak silme. Tam içerik yedeği için önceki ret geçerli; bu tur yedek veya silme yapılmadı.
5. **Pilot:** bir hafta gerçek şube/personel operasyonunda takip gecikmeleri, ulaşılamayanlar, yanlış/eksik teyitler ve operatörün zorlandığı adımlar toplansın. Yeni modüllerin sırası bu gözlemlerle belirlensin.

## Kaynaklar

- Kullanıcının ilettiği Chat raporu: `/Users/furkanyahsi/.codex/attachments/fe33010d-f1ae-4c70-ba63-1bc2726a39c2/pasted-text.txt`.
- Kullanıcının ilettiği Fable raporu: `/Users/furkanyahsi/.codex/attachments/44cde1eb-9a0b-4336-abf1-ce65fa5c8834/pasted-text.txt`.
- Repo: `FABLE_REVIEW_01_CODEX_TRIYAJ.md`, `../supabase/manual/local-20260909-038.json`, `../supabase/manual/release-20260909-source-sha256.json`.
