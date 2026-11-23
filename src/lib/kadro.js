// Takım sayfasındaki kadro tablosu: veri/kadrolar/hafta-NN.json → satırlar, takım toplamı ve Yahoo ile karşılaştırma.
// Kadro dosyası scripts/excelden.py ile Flaim Excel'inden üretilir.
// counting: "active" → istatistikler yalnızca aktif dizilişte geçen günlerden (toplam = takımın Yahoo toplamı);
//           "all"    → oyuncunun bütün maçları; "none" → Flaim oyuncu istatistiği vermedi, yalnızca kadro ve hareketler.

import { t as _t, YEREL } from '../i18n/t.js';
import { kadrodakiKimlikler } from './kadroGecmisi.js';
const SAYIM = ['FGM', 'FGA', 'FTM', 'FTA', '3PTM', '3PTA', 'PTS', 'REB', 'AST', 'ST', 'BLK', 'TO'];
// Takımın haftalık istatistiğindeki karşılıkları (eşleşme verisi: "166/385" gibi)
const YAHOO = [['FGM/A', 'FGM', 'FGA'], ['FTM/A', 'FTM', 'FTA'], ['3PTM/A', '3PTM', '3PTA'], ['PTS', 'PTS'], ['REB', 'REB'], ['AST', 'AST'], ['ST', 'ST'], ['BLK', 'BLK'], ['TO', 'TO']];
export const DURUM_ADI = { kadroda: _t('Kadroda'), birakildi: _t('Bırakıldı'), 'takasla-gitti': _t('Takasla gitti') };

const oran = (m, a) => (m != null && a > 0 ? m / a : null);
const kategoriler = (s) => ({
  'FG%': oran(s.FGM, s.FGA), 'FT%': oran(s.FTM, s.FTA), '3PT%': oran(s['3PTM'], s['3PTA']),
  PTS: s.PTS, REB: s.REB, AST: s.AST, ST: s.ST, BLK: s.BLK, TO: s.TO,
});
const kisaTarih = (g) => new Date(g + 'T12:00:00Z').toLocaleDateString(YEREL, { day: 'numeric', month: 'long', timeZone: 'UTC' });

/** Takımın haftalık Yahoo toplamı (eşleşme verisinden). */
function yahooToplami(haftaVeri, hafta, takimId) {
  const w = haftaVeri?.weeks?.find((x) => x.week === hafta);
  const t = w?.matchups.flatMap((m) => [m.home, m.away]).find((x) => x.id === takimId);
  if (!t) return null;
  const sonuc = {};
  for (const [anahtar, a, b] of YAHOO) {
    const ham = String(t.stats?.[anahtar] ?? '');
    if (b) { const [m, d] = ham.split('/').map(Number); sonuc[a] = m; sonuc[b] = d; }
    else sonuc[a] = Number(ham);
  }
  return sonuc;
}

/** Bir takımın kadro tablosu. Kadro verisi yoksa null. */
export function kadroTablosu(kadroVeri, haftaVeri, takimId) {
  const oyuncular = kadroVeri?.teams?.[takimId];
  if (!oyuncular?.length) return null;
  const satirlar = oyuncular.map((o) => {
    const notlar = [];
    if (o.status !== 'kadroda') notlar.push({ tur: 'gitti', metin: `${DURUM_ADI[o.status] ?? _t('Ayrıldı')} · ${kisaTarih(o.left)}` });
    if (o.added) notlar.push({ tur: 'geldi', metin: _t('Eklendi · {0}', [kisaTarih(o.added)]) });
    if (o.ilDays > 0) notlar.push({ tur: 'sakat', metin: o.daysOnRoster && o.ilDays >= o.daysOnRoster ? _t('Bütün hafta sakatlar listesinde') : _t('{0} gün sakatlar listesinde', [o.ilDays]) });
    if (o.benchGames > 0) notlar.push({ tur: 'yedek', metin: _t('{0} maçı yedekte (sayılmadı)', [o.benchGames]) });
    return { ...o, ist: o.stats ? kategoriler(o.stats) : null, notlar, gitti: o.status !== 'kadroda' };
  });
  const istatistikVar = kadroVeri.counting !== 'none' && satirlar.some((o) => o.stats);
  // Kadrodakiler önce (istatistik varsa sayıya göre, yoksa ada göre), hafta içinde gidenler en altta (ayrılış gününe göre)
  satirlar.sort((a, b) => (a.gitti - b.gitti)
    || (istatistikVar ? (b.stats?.PTS ?? -1) - (a.stats?.PTS ?? -1) || (b.games ?? 0) - (a.games ?? 0) : 0)
    || (a.gitti ? String(a.left).localeCompare(String(b.left)) : 0)
    || a.name.localeCompare(b.name, YEREL));
  const islemler = (kadroVeri.transactions || []).filter((x) => x.teamId === takimId);
  const ozet = { kadroda: satirlar.filter((o) => !o.gitti).length, giden: satirlar.filter((o) => o.gitti).length, gelen: satirlar.filter((o) => o.added).length, ekleme: islemler.filter((x) => x.type === 'ekleme').length, birakma: islemler.filter((x) => x.type === 'birakma').length };
  if (!istatistikVar) return { istatistikVar, satirlar, toplam: null, yahooIleAyni: null, farklar: [], tumMaclar: false, ...ozet };
  const topla = (getir) => satirlar.every((o) => Number.isFinite(getir(o))) ? satirlar.reduce((t, o) => t + getir(o), 0) : null;
  const toplamHam = Object.fromEntries(SAYIM.map((k) => [k, topla((o) => o.stats?.[k])]));
  const yahoo = yahooToplami(haftaVeri, kadroVeri.week, takimId);
  const farklar = yahoo && SAYIM.every((k) => toplamHam[k] != null) ? SAYIM.filter((k) => yahoo[k] !== toplamHam[k]).map((k) => _t('{0}: kadro {1}, Yahoo {2}', [k, toplamHam[k], yahoo[k]])) : null;
  const tumMaclar = kadroVeri.counting === 'all';
  return {
    istatistikVar,
    tumMaclar, // true: istatistikler yedekte oynanan maçları da içerir (Flaim dizilişi vermediyse)
    satirlar,
    toplam: { stats: toplamHam, ist: kategoriler(toplamHam), games: topla((o) => o.games) },
    yahooIleAyni: farklar && !tumMaclar ? farklar.length === 0 : null,
    farklar: farklar ?? [],
    ...ozet,
  };
}

/** Derleme öncesi kontrol: biçim hataları (derlemeyi durdurur) ve Yahoo toplamıyla farklar (uyarı). */
export function kadrolariDogrula(kadrolar, haftaDosyalari) {
  const hatalar = [], uyarilar = [];
  const sonVeri = haftaDosyalari.map((d) => d.veri).filter(Boolean).sort((a, b) => b.week - a.week)[0];
  for (const [hafta, { ad, veri, ayrismaHatasi }] of kadrolar) {
    const yer = `veri/kadrolar/${ad}`;
    if (ayrismaHatasi) { hatalar.push(_t('{0}: JSON okunamadı — {1}', [yer, ayrismaHatasi])); continue; }
    if (veri.schemaVersion !== 1 || !Number.isInteger(veri.week) || !veri.teams) { hatalar.push(_t('{0}: schemaVersion 1, week ve teams alanları gerekli', [yer])); continue; }
    if (veri.counting != null && !['active', 'all', 'none'].includes(veri.counting)) hatalar.push(_t('{0}: counting "active" (yalnızca aktif diziliş), "all" (bütün maçlar) ya da "none" (istatistik yok) olmalı', [yer]));
    const istatistikli = veri.counting !== 'none';
    const zorunlu = [];
    const sahipler = new Map(), serbestIdler = new Set();
    const kadroda = kadrodakiKimlikler(veri);
    const istatistikKontrol = (o, konum) => {
      if (istatistikli && (o.games == null || !o.stats || SAYIM.some((k) => o.stats[k] == null))) uyarilar.push(_t('{0}: {1}, oyuncu istatistiği eksik; sıfır sayılmaz', [yer, konum]));
      for (const k of ['games', ...SAYIM]) {
        const deger = k === 'games' ? o.games : o.stats?.[k];
        if (deger != null && (!Number.isInteger(deger) || deger < 0)) hatalar.push(_t('{0}: {1}, {2} negatif olmayan tam sayı ya da null olmalı', [yer, konum, k]));
      }
      for (const [m, a] of [['FGM', 'FGA'], ['FTM', 'FTA'], ['3PTM', '3PTA']]) if (o.stats?.[m] != null && o.stats?.[a] != null && o.stats[m] > o.stats[a]) hatalar.push(_t('{0}: {1}, {2} {3} değerini aşamaz', [yer, konum, m, a]));
    };
    (veri.freeAgents || []).forEach((o, i) => {
      const eksik = ['id', 'name', ...zorunlu].filter((k) => o?.[k] == null);
      if (eksik.length) hatalar.push(_t('{0}: freeAgents[{1}] eksik alan: {2}', [yer, i, eksik.join(', ')]));
      if (kadroda.has(String(o.id))) hatalar.push(_t('{0}: {1} hafta sonunda kadroda; aynı haftanın serbest oyuncu listesinde olamaz', [yer, o.name]));
      if (serbestIdler.has(String(o.id))) hatalar.push(_t('{0}: serbest oyuncu {1} iki kez yazılmış', [yer, o.id]));
      serbestIdler.add(String(o.id));
      istatistikKontrol(o, o.name);
    });
    for (const [takimId, oyuncular] of Object.entries(veri.teams)) {
      const gorulen = new Set();
      oyuncular.forEach((o, i) => {
        const eksik = ['id', 'name', 'status', ...zorunlu].filter((k) => o[k] == null);
        if (eksik.length) hatalar.push(_t('{0}: takım {1}, {2}. oyuncuda eksik alan: {3}', [yer, takimId, i + 1, eksik.join(', ')]));
        else if (!DURUM_ADI[o.status]) hatalar.push(_t('{0}: takım {1}, {2}: bilinmeyen durum "{3}"', [yer, takimId, o.name, o.status]));
        else if (o.status !== 'kadroda' && !o.left) hatalar.push(_t('{0}: takım {1}, {2}: ayrılış günü (left) yok', [yer, takimId, o.name]));
        if (gorulen.has(String(o.id))) hatalar.push(_t('{0}: takım {1}, {2} iki kez yazılmış; haftalık katkıları tek satırda birleştir', [yer, takimId, o.name]));
        gorulen.add(String(o.id));
        if (o.status === 'kadroda') {
          if (sahipler.has(String(o.id))) hatalar.push(_t('{0}: {1} aynı hafta sonunda iki takımın kadrosunda ({2}, {3})', [yer, o.name, sahipler.get(String(o.id)), takimId]));
          sahipler.set(String(o.id), takimId);
        }
        if (o.tradedTo && (!veri.teams[o.tradedTo] || o.tradedTo === takimId)) hatalar.push(_t('{0}: {1}, takas hedef takımı geçersiz', [yer, o.name]));
        if (o.status === 'takasla-gitti' && !o.tradedTo && !(veri.transactions ?? []).some((x) => x.type === 'takas' && x.playerId === o.id && x.teamId === takimId && x.otherTeamId)) uyarilar.push(_t('{0}: {1}, takas hedef takımı bilinmiyor', [yer, o.name]));
        istatistikKontrol(o, _t('takım {0}, {1}', [takimId, o.name]));
      });
      if (sonVeri && istatistikli) {
        const tablo = kadroTablosu(veri, sonVeri, takimId);
        if (tablo?.yahooIleAyni === false) uyarilar.push(_t('{0}: takım {1} oyuncu toplamı Yahoo\'dan farklı ({2})', [yer, takimId, tablo.farklar.join('; ')]));
      }
    }
    if (!haftaDosyalari.some((d) => d.veri?.week === hafta)) uyarilar.push(_t('{0}: {1}. haftanın sayı dosyası yok; kadro gösterilmez', [yer, hafta]));
  }
  return { hatalar, uyarilar };
}

