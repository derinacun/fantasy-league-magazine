import { t as _t } from '../i18n/t.js';
import fs from 'node:fs';
import path from 'node:path';

const KOK = process.cwd();

// ---- Örnek lig, her dilde kendi metniyle (veri/ayarlar.json → "ornekLig": true) ----
// Sayılar veri/ altındaki dosyalardan gelir; metinler (manşet, yazı, notlar, tarih aralıkları, ayar metinleri)
// ornek/<dil>.json katmanından seçili dile göre üzerine yazılır. Kendi liginizde "ornekLig" false olur ya da silinir.
let katmanOnbellek;
function ornekKatmani() {
  if (katmanOnbellek !== undefined) return katmanOnbellek;
  const ham = JSON.parse(fs.readFileSync(path.join(KOK, 'veri', 'ayarlar.json'), 'utf8'));
  const p = path.join(KOK, 'ornek', `${ham.dil ?? 'tr'}.json`);
  katmanOnbellek = ham.ornekLig && fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null;
  return katmanOnbellek;
}
function birlestir(a, b) {
  if (Array.isArray(a) && Array.isArray(b)) return a.map((x, i) => (i < b.length ? birlestir(x, b[i]) : x));
  if (a && b && typeof a === 'object' && typeof b === 'object' && !Array.isArray(b)) {
    const c = { ...a };
    for (const [k, v] of Object.entries(b)) c[k] = k in a ? birlestir(a[k], v) : v;
    return c;
  }
  return b === undefined ? a : b;
}
/** Örnek ligde dosyanın dil katmanını uygular (göreli ad: "haftalar/hafta-01.json", "ayarlar" …). */
export function ornekUygula(goreli, veri) {
  const k = ornekKatmani()?.[goreli];
  return k && veri ? birlestir(veri, k) : veri;
}
export const HAFTA_KLASORU = path.join(KOK, 'veri', 'haftalar');

/** veri/haftalar/hafta-XX.json dosyalarını okur (bozuk JSON'u da hata olarak döndürür). */
export function haftaDosyalariniOku() {
  if (!fs.existsSync(HAFTA_KLASORU)) return [];
  return fs
    .readdirSync(HAFTA_KLASORU)
    .filter((f) => /^hafta-\d+\.json$/.test(f))
    .sort()
    .map((ad) => {
      const ham = fs.readFileSync(path.join(HAFTA_KLASORU, ad), 'utf8');
      try {
        let veri = ornekUygula(`haftalar/${ad}`, JSON.parse(ham));
        // Yayımlanmış bir sayıya sonradan eklenen "gelecek hafta" (veri/gelecek/hafta-NN.json): sayı dosyasında nextWeek yoksa kullanılır.
        const ek = path.join(KOK, 'veri', 'gelecek', ad);
        if (veri && !veri.nextWeek && fs.existsSync(ek)) veri.nextWeek = ornekUygula(`gelecek/${ad}`, JSON.parse(fs.readFileSync(ek, 'utf8'))).nextWeek;
        return { ad, veri };
      } catch (e) {
        return { ad, veri: null, ayrismaHatasi: e.message };
      }
    });
}

export function ayarlariOku() {
  return ornekUygula('ayarlar', JSON.parse(fs.readFileSync(path.join(KOK, 'veri', 'ayarlar.json'), 'utf8')));
}

export const KADRO_KLASORU = path.join(KOK, 'veri', 'kadrolar');

/** veri/kadrolar/hafta-XX.json dosyaları (isteğe bağlı): hafta numarası → kadro verisi. */
export function kadroDosyalariniOku() {
  const harita = new Map();
  if (!fs.existsSync(KADRO_KLASORU)) return harita;
  for (const ad of fs.readdirSync(KADRO_KLASORU).filter((f) => /^hafta-\d+\.json$/.test(f)).sort()) {
    const ham = fs.readFileSync(path.join(KADRO_KLASORU, ad), 'utf8');
    try {
      const veri = JSON.parse(ham);
      harita.set(veri.week, { ad, veri });
    } catch (e) {
      harita.set(Number(ad.match(/\d+/)[0]), { ad, veri: null, ayrismaHatasi: e.message });
    }
  }
  return harita;
}

export const NBA_KLASORU = path.join(KOK, 'veri', 'nba');

/** veri/nba/hafta-XX.json (isteğe bağlı, scripts/nba_maclar.py üretir): hafta numarası → NBA maç günleri ve kimin oynadığı. */
export function nbaDosyalariniOku() {
  const harita = new Map();
  if (!fs.existsSync(NBA_KLASORU)) return harita;
  for (const ad of fs.readdirSync(NBA_KLASORU).filter((f) => /^hafta-\d+\.json$/.test(f)).sort()) {
    try {
      const veri = ornekUygula(`nba/${ad}`, JSON.parse(fs.readFileSync(path.join(NBA_KLASORU, ad), 'utf8')));
      // "Oynadı" = maç kâğıdında süre aldığı tarih (istatistik satırı var)
      veri.oynadi ??= Object.fromEntries(Object.entries(veri.istatistik ?? {}).map(([id, gunler]) => [id, Object.keys(gunler)]));
      harita.set(veri.hafta, veri);
    } catch (e) {
      throw new Error(_t('veri/nba/{0}: JSON okunamadı — {1}', [ad, e.message]));
    }
  }
  return harita;
}

/** veri/fikstur.json (isteğe bağlı, 17 Kasım 2026): normal sezonun bütün eşleşmeleri { normalSezon: { "5": [["5","14"], …] } } */
export function fiksturOku() {
  const p = path.join(KOK, 'veri', 'fikstur.json');
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null;
}

/** Geçmiş sezonlar (18 Kasım 2026): Yahoo'dan bir kez okunan 2022–2025 sezonları. */
export function gecmisOku() {
  const p = path.join(KOK, 'veri', 'gecmis.json');
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null;
}

/** Draft sonuçları (18 Kasım 2026): veri/draft.json */
export function draftOku() {
  const p = path.join(KOK, 'veri', 'draft.json');
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null;
}

/** Yahoo sezon sırası (18 Kasım 2026): veri/yahoo-sira/hafta-NN.json; her sayıda Claude okur. */
export function yahooSiraOku(hafta) {
  const p = path.join(KOK, 'veri', 'yahoo-sira', `hafta-${String(hafta).padStart(2, '0')}.json`);
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null;
}
