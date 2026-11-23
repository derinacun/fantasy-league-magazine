// Puan durumu: Yahoo'nun kategori kaydı (kazanılan–kaybedilen–berabere), lidere ve eleme çizgisine fark.
// Fark = ((öndekinin kazandığı − bunun kazandığı) + (bunun kaybettiği − öndekinin kaybettiği)) / 2, kategori cinsinden.

import { ONDALIK, yuzdeYaz } from '../i18n/t.js';
const fark = (a, b) => ((b.wins - a.wins) + (a.losses - b.losses)) / 2;
const onbellek = new WeakMap();

export function puanDurumu(sayi) {
  if (onbellek.has(sayi)) return onbellek.get(sayi);
  const { ayarlar } = sayi;
  const N = Number(ayarlar.elemeTakimSayisi) || 0;
  const sirali = Object.values(sayi.puanDurumu).sort((a, b) => a.rank - b.rank);
  // Eşleşme kaydı (kazanılan–kaybedilen–berabere eşleşme), veri dosyasındaki haftalardan
  const mac = Object.fromEntries(sayi.takimlar.map((t) => [t.id, { G: 0, M: 0, B: 0 }]));
  for (const w of sayi.haftalarHam) for (const m of w.matchups) {
    const a = m.home, b = m.away;
    if (!mac[a.id] || !mac[b.id]) continue;
    if (a.score.wins > b.score.wins) { mac[a.id].G++; mac[b.id].M++; }
    else if (a.score.wins < b.score.wins) { mac[a.id].M++; mac[b.id].G++; }
    else { mac[a.id].B++; mac[b.id].B++; }
  }
  const lider = sirali[0];
  const sonIcerde = N ? sirali[N - 1] : null;
  const ilkDisarda = N ? sirali[N] : null;
  const satirlar = sirali.map((s) => {
    const oynanan = s.wins + s.losses + s.ties;
    return {
      id: s.id,
      sira: s.rank,
      wins: s.wins, losses: s.losses, ties: s.ties,
      oran: oynanan ? (s.wins + s.ties / 2) / oynanan : null,
      lidereFark: lider ? fark(s, lider) : 0,
      icerde: N ? s.rank <= N : null,
      // İçerdeyse ilk dışardakinin kaç önünde, dışardaysa son içerdekinin kaç gerisinde
      cizgiFarki: !N || !sonIcerde ? null : s.rank <= N ? (ilkDisarda ? fark(ilkDisarda, s) : null) : fark(s, sonIcerde),
      mac: mac[s.id],
    };
  });
  const kalanHafta = Math.max(0, (Number(ayarlar.normalSezonHaftaSayisi) || 0) - sayi.hafta);
  const sonuc = { satirlar, N, kalanHafta, kalanKategori: kalanHafta * 9, takim: Object.fromEntries(satirlar.map((s) => [s.id, s])) };
  onbellek.set(sayi, sonuc);
  return sonuc;
}

export const farkYaz = (v) => (v == null ? '—' : v === 0 ? '—' : (Number.isInteger(v) ? String(v) : v.toFixed(1).replace('.', ONDALIK)));
export const oranYaz = (v) => (v == null ? '—' : yuzdeYaz((v * 100).toFixed(1).replace('.', ONDALIK)));
