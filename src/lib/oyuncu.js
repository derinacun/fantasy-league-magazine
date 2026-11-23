// Oyuncular sayfası: haftanın en iyi oyuncuları ve serbest oyuncu fırsatları (veri/kadrolar/hafta-NN.json).
// Puan: 9 kategorinin standart puanlarının toplamı. Yüzdelerde etki kullanılır (isabet − lig oranı × deneme);
// böylece çok deneme yapan iyi şutör, iki atışta ikisini sokandan daha değerli sayılır. Top kaybında işaret terstir.
import { KATEGORILER } from './hesap.js';
import { haftalikSerbestler, SAYIM } from './kadroGecmisi.js';

const DEGER = {
  'FG%': (s, L) => s.FGM - L.FG * s.FGA,
  'FT%': (s, L) => s.FTM - L.FT * s.FTA,
  '3PT%': (s, L) => s['3PTM'] - L.TP * s['3PTA'],
  PTS: (s) => s.PTS, REB: (s) => s.REB, AST: (s) => s.AST, ST: (s) => s.ST, BLK: (s) => s.BLK, TO: (s) => -s.TO,
};
const oran = (m, a) => (a > 0 ? m / a : null);

/** Kadrodaki oyuncular (havuz) ölçeği belirler; aynı ölçek serbest oyunculara da uygulanır. */
export function olcek(havuz) {
  const t = (k) => havuz.reduce((a, o) => a + (o.stats[k] || 0), 0);
  const L = { FG: oran(t('FGM'), t('FGA')) ?? 0, FT: oran(t('FTM'), t('FTA')) ?? 0, TP: oran(t('3PTM'), t('3PTA')) ?? 0 };
  const S = {};
  for (const k of KATEGORILER) {
    const d = havuz.map((o) => DEGER[k](o.stats, L));
    const ort = d.reduce((a, v) => a + v, 0) / (d.length || 1);
    const sd = Math.sqrt(d.reduce((a, v) => a + (v - ort) ** 2, 0) / Math.max(1, d.length - 1));
    S[k] = { ort, sd: sd || 1 };
  }
  return { L, S };
}

export function puanla(o, { L, S }) {
  const z = Object.fromEntries(KATEGORILER.map((k) => [k, (DEGER[k](o.stats, L) - S[k].ort) / S[k].sd]));
  const toplam = KATEGORILER.reduce((a, k) => a + z[k], 0);
  const enIyi = [...KATEGORILER].sort((a, b) => z[b] - z[a]).slice(0, 3).filter((k) => z[k] > 0.5);
  return {
    ...o, z, puan: toplam, enIyi,
    ist: { 'FG%': oran(o.stats.FGM, o.stats.FGA), 'FT%': oran(o.stats.FTM, o.stats.FTA), '3PT%': oran(o.stats['3PTM'], o.stats['3PTA']), PTS: o.stats.PTS, REB: o.stats.REB, AST: o.stats.AST, ST: o.stats.ST, BLK: o.stats.BLK, TO: o.stats.TO },
  };
}

/** @returns {{ enIyi: any[], serbest: any[], sayim: string } | null} */
export function oyuncuSiralamalari(kadroVeri, { enIyiAdet = 10, serbestAdet = 8 } = {}) {
  if (!kadroVeri?.teams || kadroVeri.counting === 'none') return null;
  const tam = (o) => o.stats && o.games > 0 && SAYIM.every((k) => Number.isFinite(o.stats[k]));
  const havuz = Object.entries(kadroVeri.teams).flatMap(([takimId, liste]) => liste.map((o) => ({ ...o, takimId }))).filter(tam);
  if (!havuz.length) return null;
  const O = olcek(havuz);
  const enIyi = havuz.map((o) => puanla(o, O)).sort((a, b) => b.puan - a.puan).slice(0, enIyiAdet);
  const serbest = haftalikSerbestler(kadroVeri).filter(tam).map((o) => puanla(o, O)).sort((a, b) => b.puan - a.puan).slice(0, serbestAdet);
  return { enIyi, serbest, sayim: kadroVeri.counting === 'all' ? 'tum' : 'aktif' };
}

/** Serbest oyuncular istatistiksiz geldiyse: Yahoo sahiplik oranına göre; bu hafta ligden bırakıldıysa son sahibi. */
export function serbestSahiplik(kadroVeri, adet = 12) {
  const liste = haftalikSerbestler(kadroVeri).filter((o) => o.ownedPct != null);
  if (!liste.length) return [];
  const birakan = new Map();
  for (const x of kadroVeri.transactions || []) if (x.type === 'birakma' && (!birakan.has(x.playerId) || birakan.get(x.playerId).date < x.date)) birakan.set(x.playerId, x);
  return [...liste].sort((a, b) => b.ownedPct - a.ownedPct).slice(0, adet).map((o) => ({ ...o, sonBirakma: birakan.get(o.id) ?? null }));
}

/** Haftanın bırak-al hareketleri, takım takım (en hareketli takım önce). */
export function hareketOzeti(kadroVeri) {
  const islemler = kadroVeri?.transactions || [];
  if (!islemler.length) return null;
  const takimlar = new Map();
  for (const x of islemler) {
    const t = takimlar.get(x.teamId) || { id: x.teamId, ekleme: [], birakma: [], takas: [] };
    (t[x.type] || t.takas).push(x);
    takimlar.set(x.teamId, t);
  }
  const satirlar = [...takimlar.values()].map((t) => ({ ...t, toplam: t.ekleme.length + t.birakma.length + t.takas.length }))
    .sort((a, b) => b.toplam - a.toplam || b.ekleme.length - a.ekleme.length);
  return { satirlar, toplam: islemler.length, ekleme: islemler.filter((x) => x.type === 'ekleme').length, birakma: islemler.filter((x) => x.type === 'birakma').length };
}


const PASIF_YER = new Set(['BN', 'IL', 'IL+', 'NA']);

/** Oyuncunun bu takımda aktif yerde (yedek ve sakatlar listesi dışında) oynadığı maçların toplamı — Yahoo'nun takıma saydığı. */
function aktifToplam(o, nba) {
  const sira = nba.istatistikSirasi;
  const stats = Object.fromEntries(sira.map((k) => [k, 0]));
  let games = 0;
  for (const [gun, yer] of Object.entries(o.lineupByDate || {})) {
    if (PASIF_YER.has(yer)) continue;
    const satir = nba.istatistik?.[o.id]?.[gun];
    if (!satir) continue;
    games++;
    satir.forEach((v, i) => { stats[sira[i]] += v; });
  }
  return { games, stats };
}

/**
 * Haftanın oyuncusu ve haftanın faciası (veri/nba/hafta-NN.json'daki maç kâğıtları + kadrodaki günlük diziliş).
 * Yalnızca takıma sayılan maçlar (aktif yer). Puan, "Haftanın en iyileri" ile aynı: 9 kategorinin standart puanları toplamı.
 * Facia adayı: en az 2 maç aktif yerde oynamış olmalı (tek maçlık kötü gece facia sayılmaz).
 */
export function haftaninOyunculari(kadroVeri, nba, { enIyiAdet = 5 } = {}) {
  if (!kadroVeri?.teams || !nba?.istatistik) return null;
  const havuz = Object.entries(kadroVeri.teams).flatMap(([takimId, liste]) => liste.map((o) => ({ ...o, takimId, ...aktifToplam(o, nba) }))).filter((o) => o.games > 0);
  if (havuz.length < 20) return null;
  const O = olcek(havuz);
  const puanli = havuz.map((o) => {
    const p = puanla(o, O);
    p.enKotu = [...Object.keys(p.z)].sort((a, b) => p.z[a] - p.z[b]).slice(0, 3).filter((k) => p.z[k] < -0.5);
    return p;
  }).sort((a, b) => b.puan - a.puan);
  const facialar = puanli.filter((o) => o.games >= 2).reverse();
  const takimlar = Object.keys(kadroVeri.teams).map((id) => {
    const kendi = puanli.filter((o) => o.takimId === id);
    const kotu = kendi.filter((o) => o.games >= 2);
    return { id, oyuncusu: kendi[0] ?? null, faciasi: kotu.length > 1 ? kotu.at(-1) : null };
  });
  return { oyuncusu: puanli[0], enIyiler: puanli.slice(0, enIyiAdet), faciasi: facialar[0] ?? null, facialar: facialar.slice(0, 3), takimlar, havuz: havuz.length };
}

/**
 * Haftanın kelepiri (17 Kasım 2026): o hafta serbest oyuncudan alınan (ekleme) oyuncuların verimi, takım takım toplam.
 * Alındıktan sonraki bütün maçları sayılır (yedekte oynadıkları dahil), bırakılınca biter.
 * Verim: 9 kategorinin maç başı standart puanı × maç sayısı. Sıfır noktası ligde kadroda olup aktif yerde oynayan
 * ortalama oyuncunun maç başı üretimi: altında kalan alım eksi yazar ve toplamı düşürür; çok alıp az verim alan öne geçemez.
 * Kazanan: toplamı en yüksek ve sıfırdan büyük olan takım; kimse artıda değilse ödül verilmez.
 */
export function haftaninKelepiri(kadroVeri, nba) {
  if (!kadroVeri?.teams || !nba?.istatistik) return null;
  const sira = nba.istatistikSirasi;
  const topla = (o, gunler) => {
    const stats = Object.fromEntries(sira.map((k) => [k, 0]));
    let games = 0;
    for (const g of gunler) {
      const satir = nba.istatistik?.[o.id]?.[g];
      if (!satir) continue;
      games++;
      satir.forEach((v, i) => { stats[sira[i]] += v; });
    }
    return { games, stats };
  };
  // Ölçek: kadroda aktif yerde en az 2 maç oynayanların maç başı değerleri
  const havuz = Object.values(kadroVeri.teams).flat().map((o) => ({ ...o, ...aktifToplam(o, nba) })).filter((o) => o.games >= 2);
  if (havuz.length < 20) return null;
  const t = (k) => havuz.reduce((a, o) => a + (o.stats[k] || 0), 0);
  const L = { FG: oran(t('FGM'), t('FGA')) ?? 0, FT: oran(t('FTM'), t('FTA')) ?? 0, TP: oran(t('3PTM'), t('3PTA')) ?? 0 };
  const S = {};
  for (const k of KATEGORILER) {
    const d = havuz.map((o) => DEGER[k](o.stats, L) / o.games);
    const ort = d.reduce((a, v) => a + v, 0) / d.length;
    const sd = Math.sqrt(d.reduce((a, v) => a + (v - ort) ** 2, 0) / Math.max(1, d.length - 1));
    S[k] = { ort, sd: sd || 1 };
  }
  const katki = (x) => (x.games ? KATEGORILER.reduce((a, k) => a + ((DEGER[k](x.stats, L) / x.games - S[k].ort) / S[k].sd) * x.games, 0) : 0);

  const goruldu = new Set();
  const takimlar = new Map();
  for (const x of kadroVeri.transactions || []) {
    if (x.type !== 'ekleme') continue;
    const anahtar = `${x.teamId}:${x.playerId}:${x.date}`;
    if (goruldu.has(anahtar)) continue;
    goruldu.add(anahtar);
    const o = (kadroVeri.teams[x.teamId] || []).find((p) => p.id === x.playerId);
    if (!o) continue;
    const gunler = Object.keys(o.lineupByDate || {}).filter((g) => g >= x.date && (!o.left || g <= o.left));
    const toplam = topla(o, gunler);
    const satir = { id: o.id, ad: o.name, tarih: x.date, games: toplam.games, katki: katki(toplam) };
    const tk = takimlar.get(x.teamId) || { id: x.teamId, oyuncular: [], toplam: 0 };
    tk.oyuncular.push(satir); tk.toplam += satir.katki;
    takimlar.set(x.teamId, tk);
  }
  const liste = [...takimlar.values()].map((tk) => ({ ...tk, oyuncular: tk.oyuncular.sort((a, b) => b.katki - a.katki) })).sort((a, b) => b.toplam - a.toplam);
  return { liste, kazanan: liste[0] && liste[0].toplam > 0 ? liste[0] : null };
}
