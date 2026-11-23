# League Newspaper (Lig Gazetesi)

**Fantezi basketbol liginiz için haftalık gazete ve istatistik sitesi.**
Ligin her hafta bir ön sayfası olur: manşet yazısı, skor tahtası, puan durumu, güç sıralaması, ödüller, seri kemerleri, tahmin oyunu, oyuncu notları, takas fikirleri ve bütün sayıların arşivi. Sayıları site hesaplar; yazıları seçtiğiniz yapay zekâ yazar.

Diller: **Türkçe · English · Français · Español** (her site tek dilde; dil ayarlardan seçilir).
Diğer diller: [English](README.md) · [Français](README.fr.md) · [Español](README.es.md)

> **0.1 sürümü:** Yahoo Fantasy NBA, kafa kafaya, 9 kategori (FG%, FT%, 3PT%, PTS, REB, AST, ST, BLK, TO). Başka sporlar ve puanlama türleri yol haritasında.

## Neler var

- **Ön sayfa:** manşet, skor tahtası, puan durumu, uyuyan koçlar, ödüller ve kemerler, kehanet, oyuncu notları, takas masaları.
- **İstatistikler:** fikstürden bağımsız güç sıralaması, herkese karşı kaydı, haftalık değişim, ısı haritası, kendi grafiğini kur, ham CSV.
- **Kürsü:** kemerler, devam eden seriler, uyku ligi ("Altın Yastık"), madalya tablosu.
- **Kehanet:** gelecek haftanın favorileri, iddia defteri, eleme olasılığı, şans endeksi, adil puan durumu, okur tahmin oyunu.
- **Karşılaştır, Takımlar, Oyuncular, Takas Masaları, Kupa Dolabı.**
- Arşiv, her sayfa ve takım için paylaşım görseli, ana ekrana ekleme, isteğe bağlı bildirim, "benim takımım" vurgusu (yalnızca okurun tarayıcısında).

## Nasıl çalışır

```
Lig verisi (Excel) ──► betikler veri dosyalarına çevirir ──► yapay zekâ sayıyı yazar ──► GitHub ──► Cloudflare derler ve yayınlar
```

İş üç **role** ayrılmıştır. Her rolün dosyası tek başına anlaşılır; hangi yapay zekâya verirseniz verin çalışır:

| Rol | Dosya | Gereken |
|---|---|---|
| Veri | [roles/1-DATA.md](roles/1-DATA.md) | Lige erişim (Flaim gibi bir bağlayıcı ya da elle kopyalama) |
| Yazar | [roles/2-WRITER.md](roles/2-WRITER.md) | Veri dosyaları, üslup dosyası, isteğe bağlı grup sohbeti |
| Kontrol | [roles/3-CHECKER.md](roles/3-CHECKER.md) | Bitmiş sayı dosyası |

- **Birden fazla yapay zekâ:** maliyeti ve bekleme süresini dağıtır (örneğin veri için biri, yazı için diğeri).
- **Tek yapay zekâ:** üç dosyayı sırayla verin.

Site yapay zekâyı kendisi çağırmaz; Cloudflare'in ücretsiz planında maliyeti yoktur. Rol dosyaları İngilizcedir; yapay zekâ sayıyı sitenin dilinde yazar.

## Hızlı başlangıç

Gerekenler: GitHub ve Cloudflare hesabı (ücretsiz), bilgisayarda Node.js 22 ve `openpyxl` kurulu Python 3 (ya da kod çalıştırabilen bir yapay zekâ).

1. GitHub'da "Use this template" (ya da fork) ile kendi deponuzu açın. Lig içeriği özelse depo gizli kalsın.
2. `veri/ayarlar.json` dosyasını doldurun; `"dil": "tr"` yazın. Bütün ayarlar [İngilizce README'de](README.md#settings).
3. Örnek ligi silin: ayarlarda `"ornekLig": false` yapın (ya da satırı silin), `ornek/` klasörünü ve `veri/haftalar/`, `veri/kadrolar/`, `veri/gelecek/`, `veri/nba/`, `veri/yahoo-sira/` içindeki dosyalar; `veri/gecmis.json`, `veri/draft.json`, `veri/fikstur.json` boşaltılır.
4. Liginizin üslubunu `style/STYLE.md` dosyasına yazın.
5. İlk sayıyı [docs/WEEKLY.md](docs/WEEKLY.md) adımlarıyla hazırlayın.
6. Bilgisayarda deneyin: `npm install`, `npm run build`, `npm run preview`.
7. Cloudflare: Workers & Pages → Create → Import a repository → deponuzu seçin. Derleme komutu `npm run build`, yayın komutu `npx wrangler deploy`.
8. İsteğe bağlı bildirim: `npm run anahtar` çalıştırın (KV deposu `ABONELER` ilk yayında kendiliğinden oluşur); açık anahtar `veri/ayarlar.json` → `"bildirimAnahtari"`, gizli anahtar Cloudflare'de `VAPID_PRIVATE_JWK` gizlisi olur.

## Veri, haklar ve gizlilik

- Şablonda lig verisi toplayan bir sunucu yoktur; her lig kendi verisini kendi hesabıyla çeker. Yahoo'nun Fantasy Sports API'si ticari olmayan kullanım içindir; ticari bir şey düşünüyorsanız önce Yahoo'nun şartlarını okuyun. Bu hukuki tavsiye değildir.
- NBA maç kâğıtları ESPN'in herkese açık skor servisinden gelir; resmî değildir, değişebilir.
- Grup sohbeti yalnızca lig kabul ederse kullanılmalı. Depoda yalnızca takım başına mesaj sayısı tutulur.
- Okurun seçimleri tarayıcısında kalır.

Yahoo, NBA, ESPN ya da herhangi bir yapay zekâ şirketiyle bağlantısı yoktur.

## Diller

Arayüz metinleri kodda Türkçedir; `src/i18n/` içindeki sözlüklerle (`en.json`, `fr.json`, `es.json`) çevrilir. Sayı, yüzde ve tarih biçimi, sayfa adresleri (`/kehanet/`, `/forecast/` …), paylaşım görseli ve CSV dosya adları, bölüm bağlantıları ve yardımcı betiklerin mesajları da dile göre değişir. Örnek ligin sayısı dört dilde de hazır. Yeni dil eklemek için `en.json`'u kopyalayıp çevirin ve kodu `scripts/dil.mjs`'e ekleyin. Ayrıntı [İngilizce README'de](README.md#languages).

## Lisans

[MIT](LICENSE).
