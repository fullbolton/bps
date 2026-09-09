# Supabase MCP — ilk canlı doğrulama

Ölçüm: 2026-09-08 20:36–20:37 UTC (23:36–23:37 Türkiye). Repo HEAD: `4e3fc00`.
Kaynak: `supabase-bps` MCP `get_project_url`, `execute_sql`, `list_migrations`.
Bu belge sınırlı katalog/sayım ölçümüdür; tam güvenlik denetimi veya kimlikli UI smoke değildir.

## Bağlantı

- Proje: `dffdzbmnmnokbftbujsy`; repo defterinde BPS production olarak kayıtlı.
- API URL: `https://dffdzbmnmnokbftbujsy.supabase.co`.
- `current_user=postgres`, `session_user=postgres`, `transaction_read_only=off`.
- PostgreSQL `17.6`.
- OAuth okuma/yazma kapsamlarıyla tamamlandı. SQL okuma fiilen çalıştı.
  Her yönetim aracının yazma yetkisi ayrı bir değişiklikle denenmedi.
- Bu tur yalnız SELECT/katalog sorguları; DDL/DML, repair, kullanıcı veya bayrak değişikliği yok.

## Ölçülen sonuçlar

| Kontrol | Sonuç |
|---|---|
| Public normal tablolar | 23; tamamında RLS açık |
| Public policy sayısı | 60 |
| Policy ifadesinde `current_user_active_tenant` geçenler | 46 |
| authenticated: profiles tablo UPDATE | false |
| authenticated: profiles.role UPDATE | false |
| authenticated: profiles.display_name UPDATE | true |
| staffing_demands kayıt sayısı | 1 |
| profiles toplam | 8 |
| is_platform_admin=true | 0; bağımsız ikinci sorguyla tekrarlandı |
| Defterde ilk admin olarak belirtilen e-postayla eşleşen profiles kaydı | 0 |

46 sayısı `pg_policies` içindeki qual veya with_check metninde helper adının
bulunmasıyla ölçüldü. Bunun üçü announcements policy'si. Eski 43 sayısının hangi
tarihte/hangi envanterle alındığı ayrıca uzlaştırılmalı. Metin eşleşmesi, her policy'nin
tek korumasının raw claim olduğunu veya 46 ayrı açık bulunduğunu kanıtlamaz.

`current_user_verified_tenant()` canlı gövdesi claim tenant'ını `auth.uid()` için
`tenant_memberships` üyeliğiyle doğruluyor. `is_active_tenant_member(uuid)` bu
doğrulanmış tenant'ı kullanıyor. İkisi de STABLE SECURITY DEFINER, owner postgres,
search_path public. Bu tespit uçtan uca üyelik taşıma testi yerine geçmez.

## Migration defteri

MCP 37 uygulanmış migration döndürdü; repoda 38 SQL migration dosyası var.
`20260827000400`, `20260904000100`, `20260904000200` remote defterde mevcut.
`20260722000200_role_expand_asistan` remote listede yok; önceki kayıtlarda bilinçli
bekleyen işti. Dosya/ledger sayımı nesnelerin tam eşitliğini kanıtlamaz.

## Açık uzlaştırma: ilk admin

Önceki CHANGELOG kaydı ilk admin bayrağının açıldığını söylüyor; bugünkü prod
ölçümünde hiçbir profil platform admin değil. Belirtilen e-posta profiles'ta da yok.
Neden bilinmiyor: farklı ortam, sonradan değişiklik veya farklı hesap ihtimalleri
kanıtlanmadı. Auth kullanıcı envanteri/eşleşmesi ve işlem geçmişi ayrı incelenmeli.
Bu ölçüme dayanarak yeni kullanıcı açılmadı veya başka hesaba yetki verilmedi.

## Kod kontrolleri ve kalan kapsam

### Vault sonrası hesap doğrulaması — 20:40:55 UTC

Vault'un gerçek hesap olarak kaydettiği iş e-postası için Auth kayıt sayısı 1,
profiles kayıt sayısı 1, platform-admin olan eşleşme 0. Önceki Gmail adresi için
Auth kayıt sayısı 0. Tüm platform admin sayısı yine 0. Hesaplar değiştirilmedi;
“bayrak açıldı” kaydının hangi ortam/hesaba ait olduğu henüz açıklanmadı.

Ortam etiketi düzeltmesi: `.env.local` hedefi daha önce demo diye anılmıştı;
Vault'taki onaylı 24 Nisan kararı ve repo CHANGELOG aynı projeyi **bps-dev** olarak
yeniden konumlandırıyor. Güncel proje adı/şeması dev bağlantısıyla ayrıca ölçülecek.

Önceki bağlantı turunda aynı HEAD üzerinde: qa:static 154 TS/TSX dosyası,
16 kontrol, 0 FAIL / 1 WARN (kullanılmayan TimelineList); qa:unit PASS;
`npx tsc --noEmit --incremental false` exit 0. Build bu taramada çalıştırılmadı.

Tam kolon/FK/index/trigger/grant karşılaştırması, advisors incelemesi, auth-admin
uzlaştırması ve kimlikli davranış testleri henüz tamamlanmadı. Yeni modül tabloları
bu 23 tablo içinde yok; teknik plandaki isimler hâlâ öneri.

Obsidian'a bu tur yazılmadı; bu tur kabul edilen yeni Obsidian kararı yok.
