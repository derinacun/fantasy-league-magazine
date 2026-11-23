// Haftalık kontrol ve yazı malzemesi: uyku tablosu, haftanın oyuncusu/faciası ve Yahoo toplamı karşılaştırması.
// Kullanım: node scripts/uyku.mjs NN [hafta dosyası]
//   hafta dosyası verilmezse taslak/hafta-NN.json, o da yoksa veri/haftalar/hafta-NN.json okunur.
import { t as _t } from '../src/i18n/t.js';
import fs from 'node:fs';
import { uyuyanKoclar } from '../src/lib/uyuyan.js';
import { haftaninOyunculari } from '../src/lib/oyuncu.js';

const nn = String(process.argv[2] ?? '').padStart(2, '0');
if (!/^\d\d$/.test(nn)) { console.error(_t('Kullanım: node scripts/uyku.mjs NN [hafta dosyası]')); process.exit(1); }
const oku = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const haftaYolu = process.argv[3] ?? [`taslak/hafta-${nn}.json`, `veri/haftalar/hafta-${nn}.json`].find((p) => fs.existsSync(p));
const kadro = oku(`veri/kadrolar/hafta-${nn}.json`);
const nba = oku(`veri/nba/hafta-${nn}.json`);
const ayarlar = oku('veri/ayarlar.json');
const hafta = oku(haftaYolu);
const ad = Object.fromEntries(hafta.teams.map((t) => [t.id, t.name]));
const w = hafta.weeks.find((x) => x.week === Number(nn));
const eslesmeler = w.matchups.map((m) => ({ ev: m.home.id, dep: m.away.id, kazanan: m.home.score.wins > m.away.score.wins ? m.home.id : m.away.score.wins > m.home.score.wins ? m.away.id : null }));

// 1) Yahoo karşılaştırması: aktif yerde oynanan maçların toplamı = takımın Yahoo toplamı
const PASIF = new Set(['BN', 'IL', 'IL+', 'NA']);
let farkli = 0;
for (const [tid, liste] of Object.entries(kadro.teams)) {
  const t = Object.fromEntries(nba.istatistikSirasi.map((k) => [k, 0]));
  for (const o of liste) for (const [g, yer] of Object.entries(o.lineupByDate || {})) {
    if (PASIF.has(yer)) continue;
    (nba.istatistik[o.id]?.[g] ?? []).forEach((v, i) => { t[nba.istatistikSirasi[i]] += v; });
  }
  const y = w.matchups.flatMap((m) => [m.home, m.away]).find((x) => x.id === tid).stats;
  const [fgm, fga] = y['FGM/A'].split('/').map(Number), [ftm, fta] = y['FTM/A'].split('/').map(Number), [tpm, tpa] = y['3PTM/A'].split('/').map(Number);
  const yahoo = { FGM: fgm, FGA: fga, FTM: ftm, FTA: fta, '3PTM': tpm, '3PTA': tpa, PTS: +y.PTS, REB: +y.REB, AST: +y.AST, ST: +y.ST, BLK: +y.BLK, TO: +y.TO };
  const f = Object.keys(yahoo).filter((k) => yahoo[k] !== t[k]).map((k) => _t('{0} maç kâğıdı {1}, Yahoo {2}', [k, t[k], yahoo[k]]));
  if (f.length) { farkli++; console.log(_t('FARK {0}: {1}', [ad[tid], f.join('; ')])); }
}
console.log(_t('Yahoo karşılaştırması: {0}/{1} takım birebir.{2}\n', [Object.keys(kadro.teams).length - farkli, Object.keys(kadro.teams).length, farkli ? _t(' Küçük farklar genelde NBA\'in sonradan yaptığı istatistik düzeltmesidir.') : '']));

// 2) Uyku tablosu
const U = uyuyanKoclar(kadro, nba, eslesmeler, ayarlar.aktifYerler);
console.log(_t('UYKU TABLOSU (uyku = yedekte kalan maç + ilk beşte yatan gün; 5+ uyuyan, 2–4 uyukluyor)'));
for (const s of U.satirlar) {
  const yatan = s.yatanlar.filter((y) => y.agir).map((y) => `${y.ad} ${y.gun}g${y.durum ? ' ' + y.durum : ''}`).join(', ');
  const yedek = s.kacanGunler.map((g) => `${g.gun.slice(5)}: ${g.yedekte.join('/')}`).join('; ');
  console.log(_t('{0}  {1} {2} yedekte {3}, yatan {4}, bırak-al {5}, {6}{7}{8}', [String(s.uyku).padStart(2), s.seviye.padEnd(9), ad[s.takimId].padEnd(26), s.kacan, s.yatanGun, s.islem, s.sonuc ?? '-', yatan ? ' | ' + yatan : '', yedek ? ' | ' + yedek : '']));
}

// 3) Haftanın oyuncusu / faciası
const H = haftaninOyunculari(kadro, nba);
if (H) {
  const satir = (o) => _t('{0} ({1}): {2} maç, {3} sayı, {4} ribaund, {5} asist, {6} top çalma, {7} blok, {8} top kaybı, saha içi {9}/{10}, puan {11}', [o.name, ad[o.takimId], o.games, o.stats.PTS, o.stats.REB, o.stats.AST, o.stats.ST, o.stats.BLK, o.stats.TO, o.stats.FGM, o.stats.FGA, o.puan.toFixed(1).replace('.', ',')]);
  console.log(_t('\nHAFTANIN OYUNCUSU: ') + satir(H.oyuncusu));
  if (H.faciasi) console.log(_t('HAFTANIN FACİASI: ') + satir(H.faciasi));
  console.log(_t('\nTakım takım (oyuncusu / faciası):'));
  for (const t of H.takimlar) console.log(`  ${ad[t.id].padEnd(26)} ${t.oyuncusu?.name ?? '-'} / ${t.faciasi?.name ?? '-'}`);
}
