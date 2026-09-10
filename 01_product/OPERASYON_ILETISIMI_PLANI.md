# Operasyon iletişimi — kabul edilen kapsam ve sıra

2026-09-10. Kullanıcı sade iletişim kapsamını kabul etti. Bu kayıt plan kararıdır; uygulama veya SQL tamamlandı anlamına gelmez.

## Başlama sırası

1. **047 ile tamamlandı:** Mevcut banka/otel kabulünün kalan tarayıcı yazma senaryosu: günlük kayıt, personel değişimi ve yenileme sonrası kalıcılık. 046 yalnız tarayıcı okuma/gezinme/indirme kabulünü tamamladı; API yazmaları ayrı doğrulandı.
2. Sonraki ürün geliştirme bloğu: iş içi iletişim + uygulama içi bildirim kutusu. Önce mevcut not/görev/bildirim altyapısı ve yetkileri incelenecek; veri modeli ve ekran birlikte hazırlanacak. Supabase kalıcılığı ve tenant erişim sınırı bu bloğun parçası; yalnız demo ekranla teslim edilmeyecek.
3. İletişim çekirdeğinin kabulünden sonra hedef ekipli duyurular, sabitleme ve isteğe bağlı Okudum.

Gerçek müşteri pilotu, native yazdırma diyalogu ve canlı CSV dosyası kabulü ayrı açık kayıtlar olarak korunur; iletişim geliştirmesini süresiz bekletmez. Luca/proje finansalı iptal edilmedi; gerçek çıktı kolonları ve proje eşleme kararları ayrı açık kalır. Takvim tahmini henüz verilmedi.

## İlk ürün bloğu

- İlgili talep, günlük atama, şube ve görev üzerinde not/cevap, fotoğraf veya dosya ve kişi etiketleme.
- Mevcut işlem olaylarını ilgili kaydın hareketleriyle ilişkilendirme; aynı arama veya değişikliği yeniden yazdırmama.
- Nottan mevcut Görevler modülünde görev oluşturma, kaynak kayda geri bağlantı; ayrı aksiyon modülü yok.
- Etiketleme bilgilendirir; sorumlu ataması görev üzerinden yapılır.
- Bildirim kutusu: etiketler, atanmış görevler, ilgili cevaplar; okunmuş/okunmamış ve doğrudan kayda geçiş.
- Kabul: farklı tenant erişimi reddi, etiketlenen kişinin kaynak kayda yetkisi, tekrarlanan isteklerde mükerrer görev/bildirim oluşmaması, kayıt ve reload, dosya erişimi, mobil kullanım.

## Kapsam dışı

Kişisel performans/puan/sıralama, yanıt süresi değerlendirmesi, süreye bağlı yönetici bildirimi, her mesaja gördüm/üstlendim, ayrı aksiyon veya vardiya devir modülü, genel sohbet/özel mesaj/grup kanalları. Günlük özet mevcut Dashboard ile birleştirilecek. Bu karar mevcut işe başlama kontrol saatlerini kaldırmaz.

## İncelenen örnekler

- Connecteam: iş/vardiya iletişimi ve ayrı duyurular: https://help.connecteam.com/en/articles/6712871-set-up-guide-for-a-healthcare-company-communications-hub
- MaintainX: kayda bağlı yorum ve mesajdan iş emri: https://help.getmaintainx.com/about-messaging
- SafetyCulture/Sodexo: önemli duyuruda onay: https://training.safetyculture.com/case-studies/sodexo/

Kaynaklar ürün dokümanlarıdır; rakip uygulamalarda kimlikli test yapılmadı.

## Kod incelemesi ve uygulama sırası

[İletişim teknik tasarımı](OPERASYON_ILETISIMI_TEKNIK_TASARIM.md) 047 kabulünden sonra hazırlandı. İlk uygulanacak dilim günlük talep üzerindeki konuşma ve etiket bildirimidir. Tam blok kapsamı korunur; bu dar başlangıç diğer kaynak ekranları, dosyalar ve nottan görevi tamamlandı saymaz.
