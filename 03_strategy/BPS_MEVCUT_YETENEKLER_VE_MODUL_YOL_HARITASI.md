# BPS Mevcut Yetenekler ve Modül Yol Haritası

**Durum:** Ürün değerlendirmesi ve yön önerisi  
**Tarih:** 13 Temmuz 2026  
**Kapsam:** BPS'in mevcut gerçek yetenekleri, ofis içi yönetim ve operasyon yönetimi boşlukları, gerekli modüller ve önerilen uygulama sırası

## 1. Yönetici Özeti

BPS bugün güçlü bir **firma merkezli operasyon görünürlüğü ve kayıt sistemi**dir. Firma portföyü, sözleşme, personel talebi, aktif iş gücü, randevu, görev, evrak, finansal görünürlük ve raporlama aynı firma omurgasında birleşmektedir.

Ürünün eksik tarafı yeni ekran sayısı değil, mevcut operasyon kayıtlarını gerçek kullanıcı, ekip ve sorumluluk yapısına bağlayan çalışma katmanıdır. BPS'in bir "görme sistemi"nden "çalışma sistemi"ne geçebilmesi için önce kullanıcı/üyelik yönetimi ve gerçek operasyonel atama altyapısı tamamlanmalıdır.

Önerilen ilk ürün hamlesi:

> **Kullanıcı ve üyelik yönetimi + profil bağlantılı görev atama + Benim Günüm V1**

## 2. BPS Bugün Ne Yapıyor?

### 2.1 Firma ve Portföy Yönetimi

- Firma portföyünü sektör, şehir, risk ve durum bazında listeler.
- Firma detayında yetkililer, sözleşmeler, personel talepleri, aktif iş gücü, randevular, evraklar ve notları bir araya getirir.
- Firma riskini ve aktif/pasif yaşam döngüsünü takip eder.
- Firma bazlı ticari ve operasyonel özet sunar.

### 2.2 Sözleşme Yönetimi

- Sözleşme oluşturma, görüntüleme, güncelleme ve silme akışlarını sağlar.
- Başlangıç, bitiş, yenileme ve durum bilgisini takip eder.
- Yaklaşan sözleşme bitişlerini Dashboard ve raporlarda gösterir.
- Sözleşme bitişi için 30 günlük e-posta hatırlatması üretir.
- Sözleşmeyle ilişkili görev, randevu, evrak ve PDF akışlarını destekler.

### 2.3 Personel Talebi ve Aktif İş Gücü

- Firma bazlı personel taleplerini ve talep durumlarını takip eder.
- İstenen, karşılanan ve açık pozisyon sayılarını gösterir.
- Firma bazlı aktif iş gücü ve doluluk görünürlüğü sağlar.
- Mevcut kapsam kişi bazlı insan kaynakları sistemi değil, firma bazlı operasyon kapasitesi görünürlüğüdür.

### 2.4 Görev ve Randevu Yönetimi

- Firma veya operasyon bağlamında görev oluşturur ve günceller.
- Görev durumu, önceliği, kaynağı, son tarihi ve sorumlu bilgisini takip eder.
- Randevu planlama ve sonuçlandırma akışını sağlar.
- Randevu sonucundan takip görevi oluşturulmasını destekler.

### 2.5 Evrak Yönetimi

- Firma ve sözleşme bağlamında evrak yükler.
- Güvenli, süreli bağlantı ile evrak indirme sağlar.
- Evrak kategorisi, durumu ve geçerlilik tarihini takip eder.
- Eksik, süresi yaklaşan ve süresi dolan evrakları görünür kılar.
- Yönetici kontrollü kalıcı silme akışını destekler.

### 2.6 Finansal Görünürlük ve Raporlama

- Yönetim amaçlı Finansal Özet sunar.
- Luca/mizan verisini içe aktararak firma bağlamında finansal görünürlük üretir.
- Finansal Özet ekranının PDF çıktısını sağlar.
- Aktif iş gücü, sözleşme bitişleri, personel talepleri, randevular ve riskli firmalar için gerçek veri tabanlı raporlar sunar.

### 2.7 Dashboard ve Kritik Sinyaller

- Gerçek veri tabanlı üst KPI kartlarını gösterir.
- Bugünün görevlerini ve açık personel taleplerini gösterir.
- Yaklaşan sözleşme bitişlerini ve sorunlu evrakları gösterir.
- Riskli firmaları ve kurumsal kritik tarihleri görünür kılar.
- Veri bulunmayan veya henüz bağlanmamış yüzeylerde sahte sonuç yerine açık boş durum gösterir.

### 2.8 Veri Geçişi ve Sistem Yönetimi

- Firma, yetkili ve sözleşmeler için CSV içe aktarımı sağlar.
- Luca/mizan dosyalarını içe aktarır.
- Erişim taleplerini yönetici onayına sunar.
- Gerçek kullanıcı profillerini listeler.
- Rol ve sözlük değerlerini referans amaçlı gösterir.

## 3. Henüz Gerçek Modül Olmayan Yüzeyler

Aşağıdaki yüzeyler uygulamada görünse de gerçek yönetim akışına bağlı değildir veya bilinçli olarak dürüst boş durum göstermektedir:

- Yönetici İnisiyatifleri
- Duyurular
- Aktivite Akışı
- Firma zaman akışı
- Son bahsetmeler
- Birimler arası yönlendirmeler
- Operasyon partnerleri
- Bildirim kuralları
- Şehir ve Partner Operasyon Özeti raporu
- Ayarlar sözlüklerinin düzenlenmesi

Bu yüzeylerin hepsini aynı anda açmak doğru değildir. Her biri gerçek veri sahipliği, yetki ve iş akışı tanımı oluşturulduktan sonra ayrı ve sınırlı ürün dilimleri olarak ele alınmalıdır.

## 4. Ofis İçi Yönetimde Eksik Olanlar

### 4.1 Kullanıcı ve Üyelik Yaşam Döngüsü

- Kullanıcı davet etme
- Üyeliği aktifleştirme veya pasifleştirme
- Rol ve birim atama
- Tenant üyeliği yönetimi
- Hesap kurtarma ve MFA yönetimi
- Ayrılan kullanıcının açık işlerini yeniden atama

Mevcut Ayarlar ekranı kullanıcıları gösterebilmekte ve erişim taleplerini inceleyebilmektedir; ancak tam kullanıcı yönetimi sağlamamaktadır.

### 4.2 Birim ve Ekip Yönetimi

- Gerçek organizasyon birimleri
- Birim yöneticisi ve ekip üyeleri
- Birim bazlı erişim ve görünürlük
- Ekip iş yükü ve kapasite görünürlüğü
- Kullanıcı değiştiğinde sorumluluk devri

Bu modül personel özlük dosyası, bordro veya izin yönetimi içermemelidir.

### 4.3 Kişisel Çalışma Merkezi

- Kullanıcının kendisine atanmış görevleri
- Kullanıcının randevuları
- Bekleyen onaylar
- Geciken işler
- Bugün aksiyon gerektiren sözleşme, evrak ve talepler

Bu deneyim ayrı rol bazlı mini ürünler yerine tek bir rol, scope ve assignment duyarlı **Benim Günüm** katmanı olmalıdır.

### 4.4 Koordinasyon ve Kurumsal İletişim

- Birimler arası iş yönlendirme ve kabul/ret
- Sınırlı operasyonel onay kutusu
- Yönetici tarafından yayınlanan tek yönlü duyurular
- Firma zaman akışı
- Sistem ve güvenlik audit kaydı

BPS içine genel sohbet, kanal, doğrudan mesaj veya sosyal ağ özellikleri eklenmemelidir.

## 5. Operasyon Yönetiminde Eksik Olanlar

### 5.1 Gerçek İş Sahipliği

Görev, randevu, personel talebi ve sözleşme sorumluları bugün ağırlıklı olarak metin alanlarıyla tutulmaktadır. Bu kayıtların gerçek kullanıcı profiline bağlanmaması şu yetenekleri engeller:

- Güvenilir "Benim işlerim" görünümü
- Kullanıcı ve ekip iş yükü
- Otomatik yeniden atama
- Doğru bildirim yönlendirme
- Sorumluluk ve gecikme denetimi
- Kişi veya ekip bazlı operasyon raporu

Bu nedenle gerçek kullanıcıya bağlı atama modeli tüm operasyon geliştirmelerinden önce gelmelidir.

### 5.2 SLA ve Eskalasyon

- İş türüne göre hedef tamamlanma süresi
- Yaklaşıyor, gecikti ve kritik seviyeleri
- Sorumlu kullanıcıya hatırlatma
- Yönetici veya birim yöneticisine eskalasyon
- Açık personel talebi, görev, yenileme ve evrak uyumluluğu için yaşlandırma

### 5.3 Bildirim ve Geri Çağırma

- Görev gecikmesi
- Evrak süresi yaklaşması veya dolması
- Sözleşme yenileme zamanı
- Personel talebi yaşlanması
- Kurumsal kritik tarih
- Birim yönlendirmesi ve onay sonucu
- Okundu durumu olan uygulama içi bildirim merkezi
- Daha sonra haftalık yönetim özeti

### 5.4 Zaman, Kapasite ve Ekonomik Görünürlük

- Firma bazlı operasyonel zaman takibi
- Ekip kapasitesi ve utilization
- İş yükü dengesi
- Firma geliri ile operasyon maliyetinin karşılaştırılması
- Firma bazlı katkı ve kârlılık görünürlüğü

Bu kapsam bordro, puantaj, fatura kesme, vergi, e-defter veya banka mutabakatına genişlememelidir.

### 5.5 Saha ve Entegrasyon

- Mobil uyumlu PWA
- Google ve Outlook takvim senkronizasyonu
- Kontrollü API ve webhook
- Dış sistemlerle veri aktarımı
- Dar aday firma → aktif firma dönüşüm akışı

Dar firma dönüşüm akışı genel satış CRM'i veya marketing automation ürününe dönüşmemelidir.

## 6. Gerekli Modüller ve Sıra

| Sıra | Modül | Kapsam | Beklenen sonuç |
|---:|---|---|---|
| 1 | Kullanıcı ve Üyelik Yönetimi | Davet, aktivasyon/pasifleştirme, rol, birim ve tenant üyeliği | Güvenilir ofis kimliği ve erişim yönetimi |
| 2 | Operasyonel Atama Altyapısı | Görev, randevu, talep ve sözleşme sorumlularını gerçek kullanıcıya bağlama | İşlerin gerçek sahibi ve denetlenebilir sorumluluk |
| 3 | Firma Onboarding | Manuel firma oluşturma/düzenleme, mükerrer kontrolü ve toplu güncelleme | Excel'den güvenli geçiş ve kontrollü firma açılışı |
| 4 | Benim Günüm | Görevler, randevular, onaylar, geciken ve kritik işler | Günlük kullanım ve kişisel çalışma merkezi |
| 5 | Ekip ve Birim Yönetimi | Birimler, ekip üyeleri, yöneticiler, iş yükü ve kapasite | Ofis içi koordinasyon ve yönetim görünürlüğü |
| 6 | SLA ve Eskalasyon | Son tarihler, gecikme seviyeleri ve yönetici eskalasyonu | Operasyon gecikmelerinin erken kontrolü |
| 7 | Bildirim Merkezi | Görev, evrak, sözleşme, talep ve kritik tarih bildirimleri | Kullanıcıyı sisteme geri getiren güvenilir uyarılar |
| 8 | Yönlendirme ve Onay Kutusu | Birimler arası devir, kabul/ret ve sınırlı onaylar | Bölümler arası kontrollü iş akışı |
| 9 | Aktivite ve Audit | Firma zaman akışı ve kim-ne-zaman değiştirdi kaydı | Operasyonel güven ve denetlenebilirlik |
| 10 | Duyurular | Yönetici tarafından yayınlanan rol ve kapsam hedefli duyurular | Sınırlı ve güvenilir kurumsal iletişim |
| 11 | Zaman ve Kapasite | Firma bazlı çalışma süresi, doluluk, utilization ve kapasite | Kaynak planlama ve ekip dengesi |
| 12 | Kârlılık Görünürlüğü | Firma geliri, operasyon maliyeti ve katkı görünürlüğü | Yönetim karar desteği |
| 13 | Mobil/PWA ve Takvim | Saha kullanımı ve takvim senkronizasyonu | Masaüstü dışı kullanım ve randevu disiplini |
| 14 | SaaS Kontrol Düzlemi | Tenant yönetimi, paketler, entitlement, abonelik ve provider admin | Ticari ve operasyonel SaaS ölçeklenmesi |
| 15 | Entegrasyon Katmanı | API, webhook ve daha sonra SSO/SCIM | Dış sistemlerle kontrollü birlikte çalışma |

## 7. Önerilen Uygulama Fazları

### Faz A — Temel Güven

Modüller 1-3:

- Kullanıcı ve üyelik yönetimi
- Operasyonel atama altyapısı
- Firma onboarding

Bu fazın sonunda kullanıcı, firma ve iş sahipliği güvenilir hale gelmelidir.

### Faz B — Günlük Çalışma Sistemi

Modüller 4-8:

- Benim Günüm
- Ekip ve birim yönetimi
- SLA ve eskalasyon
- Bildirim merkezi
- Yönlendirme ve onay kutusu

Bu faz BPS'i kayıt gösteren sistemden günlük işi yöneten sisteme taşır.

### Faz C — Yönetim ve Denetim

Modüller 9-12:

- Aktivite ve audit
- Duyurular
- Zaman ve kapasite
- Kârlılık görünürlüğü

Bu faz yönetimin iş akışı, kapasite ve firma ekonomisini birlikte değerlendirmesini sağlar.

### Faz D — SaaS Ölçekleme

Modüller 13-15:

- Mobil/PWA ve takvim
- SaaS kontrol düzlemi
- Entegrasyon katmanı

Bu faz saha kullanımını, ticari paketlemeyi ve dış sistem bağlantılarını açar.

## 8. İlk Bounded Ürün Paketi

İlk paket tüm sorumlu alanlarını aynı anda değiştirmemelidir. En küçük doğru başlangıç şu şekilde olmalıdır:

1. Tenant içindeki aktif kullanıcıların görev sorumlusu olarak seçilebilmesi.
2. Görevin metin yerine gerçek kullanıcı profiline atanması.
3. Kullanıcının yalnızca kendisine atanmış açık ve geciken görevlerini görebildiği Benim Günüm V1.
4. Atama, yeniden atama ve tamamlanma olaylarının audit kaydı.
5. Rol ve tenant sınırlarının server tarafında doğrulanması.

Bu model doğrulandıktan sonra aynı atama altyapısı sırasıyla randevu, personel talebi ve sözleşme sorumluluğuna genişletilmelidir.

## 9. Ürün Sınırları

BPS aşağıdaki alanlara genişlememelidir:

- Bordro, izin, vardiya, puantaj, performans ve özlük dosyası gibi tam HRIS özellikleri
- Fatura kesme, vergi, KDV, e-defter, banka mutabakatı ve ledger gibi muhasebe/ERP özellikleri
- Kanal, doğrudan mesaj, tepki ve sohbet gibi kurumsal mesajlaşma özellikleri
- Sprint, backlog ve genel proje panosu gibi genel proje yönetimi özellikleri
- Genel helpdesk veya ticketing sistemi
- Erken aşamada özel workflow builder veya sınırsız özel rol editörü
- Doğrulanmış sektör ihtiyacı olmadan stok, satın alma ve demirbaş yönetimi
- Genel satış CRM'i, lead scoring veya marketing automation

## 10. Sonuç

BPS'in yeni modül ihtiyacı daha fazla bağımsız ekran üretmek değil, mevcut firma merkezli omurgayı kullanıcı merkezli günlük çalışma deneyimine dönüştürmektir. Bunun için doğru sıra; **kimlik ve üyelik → gerçek iş sahipliği → firma onboarding → Benim Günüm → ekip koordinasyonu → SLA/bildirim → kapasite ve ekonomik görünürlük → SaaS ölçekleme** şeklindedir.
