// Uyuyan koç, haftanın oyuncusu ve takas karnesi (6 Kasım 2026).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { uyuyanKoclar } from '../src/lib/uyuyan.js';
import { tamamlananTakaslar } from '../src/lib/takasKarnesi.js';
import { haftaninOyunculari } from '../src/lib/oyuncu.js';

const g = '2026-11-03';
const oyuncu = (id, positions, yer, nbaTeam = 'AAA') => ({ id, name: 'O' + id, positions, nbaTeam, lineupByDate: { [g]: yer } });

test('yedekte oynayan, boş aktif yere sığıyorsa kaçan maç sayılır', () => {
  const kadro = { teams: { 1: [oyuncu('1', 'PG', 'PG'), oyuncu('2', 'C', 'BN')] }, transactions: [] };
  const nba = { maclar: { [g]: ['AAA'] }, oynadi: { 1: [g], 2: [g] } };
  const U = uyuyanKoclar(kadro, nba, []);
  assert.equal(U.satirlar[0].kacan, 1);
});

test('yedekteki oyuncu pozisyonu tutmuyorsa ve yer doluysa kaçan maç yok', () => {
  const yerler = { PG: 1, C: 1 };
  const kadro = { teams: { 1: [oyuncu('1', 'PG', 'PG'), oyuncu('2', 'C', 'C'), oyuncu('3', 'PG', 'BN')] }, transactions: [] };
  const nba = { maclar: { [g]: ['AAA'] }, oynadi: { 1: [g], 2: [g], 3: [g] } };
  assert.equal(uyuyanKoclar(kadro, nba, [], yerler).satirlar[0].kacan, 0);
});

test('sakat oyuncu ilk beşte: yatan gün, "Out" ise tek gün de ağır sayılır; sakatlar listesindeki sayılmaz', () => {
  const kadro = { teams: { 1: [oyuncu('1', 'PG', 'PG'), oyuncu('2', 'SG', 'IL')] }, transactions: [] };
  const nba = { maclar: { [g]: ['AAA'] }, oynadi: {}, sakat: { 1: { [g]: 'Out' }, 2: { [g]: 'Out' } } };
  const s = uyuyanKoclar(kadro, nba, []).satirlar[0];
  assert.equal(s.yatanGun, 1);
  assert.equal(s.uyku, 1);
});

test('2. hafta: aktif yerdeki maç kâğıtları Yahoo takım toplamıyla birebir', () => {
  const kadro = JSON.parse(fs.readFileSync('veri/kadrolar/hafta-02.json', 'utf8'));
  const nba = JSON.parse(fs.readFileSync('veri/nba/hafta-02.json', 'utf8'));
  const hafta = JSON.parse(fs.readFileSync('veri/haftalar/hafta-02.json', 'utf8')).weeks.find((w) => w.week === 2);
  const PASIF = new Set(['BN', 'IL', 'IL+', 'NA']);
  for (const [tid, liste] of Object.entries(kadro.teams)) {
    let pts = 0;
    for (const o of liste) for (const [gun, yer] of Object.entries(o.lineupByDate)) if (!PASIF.has(yer)) pts += nba.istatistik[o.id]?.[gun]?.[6] ?? 0;
    const y = hafta.matchups.flatMap((m) => [m.home, m.away]).find((x) => x.id === tid);
    assert.equal(pts, Number(y.stats.PTS), `takım ${tid}`);
  }
  assert.ok(haftaninOyunculari(kadro, nba).oyuncusu);
});

test('takas karnesi: aynı gün aynı iki takımın satırları tek takas, takastan sonraki maçlar sayılır', () => {
  const kadro = { week: 3, transactions: [
    { date: '2026-11-03', teamId: '1', type: 'takas', playerId: 'a', name: 'A', otherTeamId: '2' },
    { date: '2026-11-03', teamId: '2', type: 'takas', playerId: 'b', name: 'B', otherTeamId: '1' },
  ] };
  const sira = ['FGM', 'FGA', 'FTM', 'FTA', '3PTM', '3PTA', 'PTS', 'REB', 'AST', 'ST', 'BLK', 'TO'];
  const nba = { istatistikSirasi: sira, istatistik: {
    a: { '2026-11-03': [9, 10, 0, 0, 0, 0, 50, 9, 9, 9, 9, 0], '2026-11-04': [5, 10, 2, 2, 1, 2, 13, 5, 5, 1, 1, 1] },
    b: { '2026-11-04': [1, 10, 0, 2, 0, 5, 2, 1, 0, 0, 0, 5] },
  } };
  const [t] = tamamlananTakaslar([kadro], [nba], '2026-11-09');
  assert.equal(t.aAldi.mac, 1); // 1. takım B'yi aldı
  assert.equal(t.bAldi.mac, 1); // takas günü maçı sayılmaz
  assert.equal(t.karne.kazanan, '2');
  assert.equal(t.karne.erken, true);
});
