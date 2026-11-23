// Tüm sayısal hesaplar burada. Haftalık veri dosyası yalnızca ham veriyi taşır;
// güç puanı, herkese karşı (all-play) sonucu, kategori sıraları ve değişimler
// derleme sırasında buradan üretilir. Formüller Metodoloji sayfasında da anlatılır.

import { t as _t, ONDALIK, yuzdeYaz } from '../i18n/t.js';
export const KATEGORILER = ['FG%', 'FT%', '3PT%', 'PTS', 'REB', 'AST', 'ST', 'BLK', 'TO'];

export const KATEGORI_ADI = {
  'FG%': _t('Saha içi isabet'),
  'FT%': _t('Serbest atış isabeti'),
  '3PT%': _t('Üçlük isabeti'),
  PTS: _t('Sayı'),
  REB: _t('Ribaund'),
  AST: _t('Asist'),
  ST: _t('Top çalma'),
  BLK: _t('Blok'),
  TO: _t('Top kaybı'),
};

const YUZDE_KAYNAK = { 'FG%': 'FGM/A', 'FT%': 'FTM/A', '3PT%': '3PTM/A' };
export const yuzdeMi = (k) => k.includes('%');
const sayi = (v) => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
const EPS = 1e-9;

/** Bir takımın verilen haftalardaki istatistikleri (yüzdeler: toplam isabet / toplam deneme). */
export function takimIstatistik(haftalar, takimId) {
  const satirlar = haftalar
    .flatMap((h) => h.matchups.flatMap((m) => [m.home, m.away]))
    .filter((t) => t.id === takimId);
  const sonuc = {};
  for (const k of KATEGORILER) {
    if (!satirlar.length) { sonuc[k] = null; continue; }
    if (YUZDE_KAYNAK[k]) {
      if (satirlar.length === 1) { sonuc[k] = sayi(satirlar[0].stats[k]); continue; }
      const parcalar = satirlar.map((s) => String(s.stats[YUZDE_KAYNAK[k]] || '').split('/').map(Number));
      const tamam = parcalar.every((p) => p.length === 2 && p.every(Number.isFinite));
      const deneme = parcalar.reduce((a, p) => a + p[1], 0);
      sonuc[k] = tamam && deneme > 0 ? parcalar.reduce((a, p) => a + p[0], 0) / deneme : null;
    } else {
      const degerler = satirlar.map((s) => sayi(s.stats[k]));
      sonuc[k] = degerler.every((v) => v !== null) ? degerler.reduce((a, v) => a + v, 0) : null;
    }
  }
  return sonuc;
}

/** İki takımın kategori karşılaştırması: a'nın kazandığı / kaybettiği / berabere. TO'da düşük iyidir. */
export function karsilastir(a, b) {
  let kazan = 0, kayip = 0, beraber = 0;
  const detay = {};
  for (const k of KATEGORILER) {
    if (a[k] == null || b[k] == null) { detay[k] = null; continue; }
    const fark = (a[k] - b[k]) * (k === 'TO' ? -1 : 1);
    if (fark > EPS) { kazan++; detay[k] = 'a'; } else if (fark < -EPS) { kayip++; detay[k] = 'b'; } else { beraber++; detay[k] = '='; }
  }
  return { wins: kazan, losses: kayip, ties: beraber, detay };
}

/** Kategori sırası: 1 + kendisinden daha iyi takım sayısı (eşitler aynı sırayı paylaşır). */
export function siralar(takimlar, ist) {
  const s = {};
  for (const t of takimlar) {
    s[t.id] = {};
    for (const k of KATEGORILER) {
      const v = ist[t.id][k];
      s[t.id][k] = v == null ? null : 1 + takimlar.filter((o) => {
        const ov = ist[o.id][k];
        return ov != null && (k === 'TO' ? ov < v : ov > v);
      }).length;
    }
  }
  return s;
}

/** Bir kapsam (tek hafta veya sezon) için tüm tablo hesapları. */
export function kapsamHesapla(takimlar, haftalar) {
  const n = takimlar.length;
  const ist = Object.fromEntries(takimlar.map((t) => [t.id, takimIstatistik(haftalar, t.id)]));
  const sira = siralar(takimlar, ist);
  const guc = Object.fromEntries(takimlar.map((t) => [
    t.id,
    KATEGORILER.reduce((a, k) => a + (sira[t.id][k] == null ? 0 : n + 1 - sira[t.id][k]), 0),
  ]));
  const herkeseKarsi = Object.fromEntries(takimlar.map((t) => {
    const r = { wins: 0, losses: 0, ties: 0 };
    for (const o of takimlar) {
      if (o.id === t.id) continue;
      const c = karsilastir(ist[t.id], ist[o.id]);
      if (c.wins > c.losses) r.wins++; else if (c.wins < c.losses) r.losses++; else r.ties++;
    }
    return [t.id, r];
  }));
  // Sıralama kararlı: eşit puanda veri dosyasındaki takım sırası korunur.
  const gucSirasi = [...takimlar].sort((a, b) => guc[b.id] - guc[a.id]).map((t) => t.id);
  const enIyi = (id) => [...KATEGORILER].sort((x, y) => sira[id][x] - sira[id][y]).slice(0, 3);
  const enZayif = (id) => [...KATEGORILER].sort((x, y) => sira[id][y] - sira[id][x]).slice(0, 3);
  return { ist, sira, guc, herkeseKarsi, gucSirasi, enIyi, enZayif, maxGuc: n * KATEGORILER.length };
}

/** Karşılıklı kategori uyumu: iki tarafın üç zayıf kategorisinden kaçında karşı taraf ilk 5'te (0–6). */
export function uyumListesi(takimlar, k, takimId, adet = 3) {
  return takimlar
    .filter((t) => t.id !== takimId)
    .map((t) => ({
      id: t.id,
      puan:
        k.enZayif(takimId).filter((c) => k.sira[t.id][c] <= 5).length +
        k.enZayif(t.id).filter((c) => k.sira[takimId][c] <= 5).length,
    }))
    .sort((a, b) => b.puan - a.puan)
    .slice(0, adet);
}

/** Son hafta ile önceki haftaların haftalık ortalaması arasındaki fark. Yüzdelerde toplam isabet/deneme bazlı. */
export function degisim(haftalar, sonHafta, takimId, kategori) {
  const onceki = haftalar.filter((h) => h.week < sonHafta.week);
  if (!onceki.length) return null;
  const once = takimIstatistik(onceki, takimId)[kategori];
  const simdi = takimIstatistik([sonHafta], takimId)[kategori];
  if (once == null || simdi == null) return null;
  return simdi - (yuzdeMi(kategori) ? once : once / onceki.length);
}

export function bicimle(v, k) {
  if (v == null) return '—';
  if (yuzdeMi(k)) return yuzdeYaz((v * 100).toFixed(1).replace('.', ONDALIK));
  return Number.isInteger(v) ? String(v) : v.toFixed(1).replace('.', ONDALIK);
}

export function farkBicimle(v, k) {
  if (v == null) return '—';
  const x = yuzdeMi(k) ? v * 100 : v;
  const s = (x > 0 ? '+' : x < 0 ? '−' : '±') + Math.abs(x).toFixed(1).replace('.', ONDALIK);
  return yuzdeMi(k) ? _t('{0} puan', [s]) : s;
}

export const kayit = (r) => `${r.wins}–${r.losses}${r.ties ? '–' + r.ties : ''}`;
