// Uyuyan koç hesabı: Yahoo'nun günlük dizilişi (kadro dosyasındaki lineupByDate) + NBA'de o gün kimin oynadığı (veri/nba/hafta-NN.json).
//
// Her takım ve her gün için:
//   oynayan    = aktif yerde (yedek ve sakatlar listesi dışında) duran ve o gün süre alan oyuncu sayısı
//   enIyi      = o gün süre alan oyuncularla (sakatlar listesindekiler hariç) pozisyon kurallarına uyarak doldurulabilecek en fazla aktif yer
//   kacan      = enIyi − oynayan  → yedekte oynayıp sayılmayan maçlar (geriye dönük: maç saatinde belli olmayan son dakika kararları da girer)
//   yatan      = aktif yerde duran, takımı o gün maç yaptığı hâlde oynamayan oyuncu (sakat, kadro dışı)
//                → maç kâğıdında "Out" yazıyorsa ya da hafta içinde en az 2 gün böyleyse "ağır" sayılır (tek günlük dinlenme sayılmaz)
//   uyku       = kacan + ağır yatan günler → sıralama ve seviye (5 ve üstü uyuyan, 2–4 uyukluyor)
// Haftalık bırak-al sayısı ayrıca gösterilir ama uyuyan sayılma ölçüsü değildir.

const AKTIF_VARSAYILAN = { PG: 1, SG: 1, G: 1, SF: 1, PF: 1, F: 1, C: 2, Util: 2 };
const KAPSAR = { PG: ['PG'], SG: ['SG'], G: ['PG', 'SG'], SF: ['SF'], PF: ['PF'], F: ['SF', 'PF'], C: ['C'], Util: null };
const PASIF = new Set(['BN', 'IL', 'IL+', 'NA']);
export const SAKAT_YERLERI = new Set(['IL', 'IL+', 'NA']);
const sinir = { uyuyan: 5, uyukluyor: 2 };

const uygunMu = (yer, poz) => KAPSAR[yer] === null || poz.some((p) => KAPSAR[yer].includes(p));

/** Pozisyon kurallarına göre en fazla kaç oyuncu aktif yere yerleşir (ikili eşleştirme, artırma yolu). */
function enFazlaYerlesim(oyuncuPozisyonlari, yerler) {
  const yuvalar = Object.entries(yerler).flatMap(([y, n]) => Array.from({ length: n }, () => y));
  const sahip = new Array(yuvalar.length).fill(-1);
  const dene = (i, gorulen) => {
    for (let j = 0; j < yuvalar.length; j++) {
      if (gorulen[j] || !uygunMu(yuvalar[j], oyuncuPozisyonlari[i])) continue;
      gorulen[j] = true;
      if (sahip[j] === -1 || dene(sahip[j], gorulen)) { sahip[j] = i; return true; }
    }
    return false;
  };
  let n = 0;
  for (let i = 0; i < oyuncuPozisyonlari.length; i++) if (dene(i, new Array(yuvalar.length).fill(false))) n++;
  return n;
}

/**
 * Bir haftanın uyuyan koç tablosu. Kadro ya da NBA dosyası yoksa null.
 * @returns {{ satirlar: Array, uyuyanlar: Array, toplamKacan: number, gunSayisi: number } | null}
 */
export function uyuyanKoclar(kadro, nba, eslesmeler, aktifYerler = AKTIF_VARSAYILAN) {
  if (!kadro?.teams || !nba?.maclar) return null;
  const gunler = Object.keys(nba.maclar).sort();
  const oynadi = (id, g) => Boolean(nba.istatistik?.[id]?.[g]) || (nba.oynadi?.[id] ?? []).includes(g);
  const satirlar = Object.entries(kadro.teams).map(([takimId, oyuncular]) => {
    let kacan = 0, oynayan = 0;
    const yatanlar = new Map(); // oyuncu → { ad, gun, durum }
    const kacanGunler = [];
    for (const g of gunler) {
      const gunun = oyuncular.filter((o) => o.lineupByDate?.[g]);
      const aktifOynayan = gunun.filter((o) => !PASIF.has(o.lineupByDate[g]) && oynadi(o.id, g)).length;
      const adaylar = gunun.filter((o) => !SAKAT_YERLERI.has(o.lineupByDate[g]) && oynadi(o.id, g)).map((o) => String(o.positions || '').split(',').map((p) => p.trim()));
      const enIyi = enFazlaYerlesim(adaylar, aktifYerler);
      const fark = Math.max(0, enIyi - aktifOynayan);
      kacan += fark; oynayan += aktifOynayan;
      if (fark > 0) kacanGunler.push({ gun: g, fark, yedekte: gunun.filter((o) => o.lineupByDate[g] === 'BN' && oynadi(o.id, g)).map((o) => o.name) });
      for (const o of gunun) {
        if (PASIF.has(o.lineupByDate[g])) continue;
        const takimOynadi = (nba.maclar[g] ?? []).includes(o.nbaTeam) || nba.sakat?.[o.id]?.[g];
        if (takimOynadi && !oynadi(o.id, g)) {
          const y = yatanlar.get(o.id) ?? { id: o.id, ad: o.name, gun: 0, durum: null };
          y.gun++; y.durum = nba.sakat?.[o.id]?.[g] ?? y.durum;
          yatanlar.set(o.id, y);
        }
      }
    }
    const islem = (kadro.transactions || []).filter((x) => x.teamId === takimId).length;
    const e = eslesmeler?.find((m) => m.ev === takimId || m.dep === takimId);
    const sonuc = !e ? null : e.kazanan === takimId ? 'kazandi' : e.kazanan == null ? 'berabere' : 'kaybetti';
    const yatanListe = [...yatanlar.values()].sort((a, b) => b.gun - a.gun);
    for (const y of yatanListe) y.agir = y.durum === 'Out' || y.gun >= 2;
    const yatanGun = yatanListe.filter((y) => y.agir).reduce((t, y) => t + y.gun, 0);
    const uyku = kacan + yatanGun;
    const seviye = uyku >= sinir.uyuyan ? 'uyuyan' : uyku >= sinir.uyukluyor ? 'uyukluyor' : 'uyanik';
    return { takimId, kacan, oynayan, yatanGun, uyku, yatanlar: yatanListe, kacanGunler, islem, sonuc, seviye };
  });
  satirlar.sort((a, b) => b.uyku - a.uyku || b.kacan - a.kacan || (a.sonuc === 'kaybetti' ? -1 : 0) - (b.sonuc === 'kaybetti' ? -1 : 0));
  return {
    satirlar,
    uyuyanlar: satirlar.filter((s) => s.seviye === 'uyuyan'),
    uyukluyanlar: satirlar.filter((s) => s.seviye === 'uyukluyor'),
    toplamKacan: satirlar.reduce((t, s) => t + s.kacan, 0),
    gunSayisi: gunler.length,
    sinir,
    kaynak: nba.kaynak,
  };
}
