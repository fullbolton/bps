# Kalan liste okuyucuları — 2026-09-28

Baz 4c458b1. Kritik tarihler ve iş gücünün üç liste okuyucusu completePages kullanır. 500 kayıt/istek, 10.000 toplam, 30 sn bütçe, unique id sırası, count/uzunluk/tekrar denetimi önceki paketle aynıdır. Şirket filtreleri ve boş şirket listesinde sorgu yapılmaması korunur. Sunucuda filtrelenen yeni UI veya tek DB snapshot değildir; dashboard'ın doğrudan sorguları değişmedi.

Üç ek 1.001 kayıt testiyle 496 uygulama testi. Şema/SQL veya üretim iş verisi değişikliği yok. Ayrı kişisel veri incelemesi docs/personal-data-hardening-plan.md içinde; bu plan korumaların uygulanmış olduğu anlamına gelmez. JSONB/audit ve ham kaynak dosyanın yalnız kişi-kodu kısıtıyla korunamayacağı açıkça kayıtlı.
