// Ligde yapılmış takaslar ve takas karnesi.
// Takaslar kadro dosyalarındaki işlemlerden (type "takas": teamId gönderen, otherTeamId alan) gelir; aynı gün aynı iki takım arasındaki satırlar tek takas sayılır.
// Karne: takastan sonraki günlerde, iki tarafın aldığı oyuncuların toplam üretimi 9 kategoride karşılaştırılır (maç kâğıtları: veri/nba/hafta-NN.json).
// Oyuncu hangi takımda ve hangi yerde oynarsa oynasın sayılır: ölçülen oyuncunun değeri, koçun dizilişi değil.
import { KATEGORILER } from './hesap.js';

const DOLGUN_HAFTA = 4;

function paketToplami(oyuncuIdleri, nbaListesi, sonrasi) {
  const t = { FGM: 0, FGA: 0, FTM: 0, FTA: 0, '3PTM': 0, '3PTA': 0, PTS: 0, REB: 0, AST: 0, ST: 0, BLK: 0, TO: 0 };
  let mac = 0;
  for (const nba of nbaListesi) {
    for (const id of oyuncuIdleri) {
      for (const [gun, satir] of Object.entries(nba.istatistik?.[id] ?? {})) {
        if (gun <= sonrasi) continue;
        mac++;
        satir.forEach((v, i) => { t[nba.istatistikSirasi[i]] += v; });
      }
    }
  }
  const oran = (m, a) => (a > 0 ? m / a : null);
  return { mac, ist: { 'FG%': oran(t.FGM, t.FGA), 'FT%': oran(t.FTM, t.FTA), '3PT%': oran(t['3PTM'], t['3PTA']), PTS: t.PTS, REB: t.REB, AST: t.AST, ST: t.ST, BLK: t.BLK, TO: t.TO } };
}

/**
 * @param kadroGecmisi bu sayıya kadarki kadro dosyaları
 * @param nbaListesi bu sayıya kadarki NBA dosyaları
 * @param bugun bu sayının dönem sonu (YYYY-AA-GG)
 */
export function tamamlananTakaslar(kadroGecmisi, nbaListesi, bugun) {
  const gruplar = new Map();
  for (const k of kadroGecmisi) {
    for (const x of k.transactions || []) {
      if (x.type !== 'takas' || !x.otherTeamId) continue;
      const [a, b] = [x.teamId, x.otherTeamId].sort();
      const anahtar = `${x.date}|${a}|${b}`;
      const g = gruplar.get(anahtar) ?? { tarih: x.date, a, b, aVerdi: [], bVerdi: [] };
      const liste = x.teamId === a ? g.aVerdi : g.bVerdi;
      if (!liste.some((o) => o.id === x.playerId)) liste.push({ id: x.playerId, ad: x.name });
      gruplar.set(anahtar, g);
    }
  }
  return [...gruplar.values()].sort((x, y) => y.tarih.localeCompare(x.tarih)).map((g) => {
    const gun = Math.max(0, Math.round((Date.parse(bugun) - Date.parse(g.tarih)) / 86400000));
    const aAldi = paketToplami(g.bVerdi.map((o) => o.id), nbaListesi, g.tarih);
    const bAldi = paketToplami(g.aVerdi.map((o) => o.id), nbaListesi, g.tarih);
    let karne = null;
    if (aAldi.mac + bAldi.mac > 0) {
      let a = 0, b = 0, ber = 0;
      const satirlar = KATEGORILER.map((k) => {
        const x = aAldi.ist[k], y = bAldi.ist[k];
        let kazanan = null;
        if (x != null && y != null && x !== y) kazanan = (k === 'TO' ? x < y : x > y) ? 'a' : 'b';
        else if (x != null && y == null) kazanan = 'a';
        else if (y != null && x == null) kazanan = 'b';
        if (kazanan === 'a') a++; else if (kazanan === 'b') b++; else ber++;
        return { k, a: x, b: y, kazanan };
      });
      karne = { a, b, berabere: ber, satirlar, kazanan: a > b ? g.a : b > a ? g.b : null, erken: gun < DOLGUN_HAFTA * 7 };
    }
    return { ...g, gun, hafta: Math.floor(gun / 7), aAldi, bAldi, karne };
  });
}
