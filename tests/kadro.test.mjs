import test from 'node:test';
import assert from 'node:assert/strict';
import { SAYIM, takimKadroGorunumu, haftalikSerbestler } from '../src/lib/kadroGecmisi.js';
import { kadrolariDogrula, kadroTablosu } from '../src/lib/kadro.js';
import { tumSayilar } from '../src/lib/model.js';
const stats = (s = {}) => ({ ...Object.fromEntries(SAYIM.map((k) => [k, 0])), ...s });
const player = (s = {}) => ({ id: 'p', name: 'Oyuncu', status: 'kadroda', games: 1, stats: stats(), ...s });
const week = (n, teams, extra = {}) => ({ schemaVersion: 1, week: n, counting: 'active', teams, transactions: [], ...extra });
const model = (files, last = 2) => ({ hafta: last, haftalarHam: Array.from({ length: last }, (_, i) => ({ week: i + 1 })), kadroGecmisi: files, takim: { '1': { ad: 'Bir' }, '2': { ad: 'İki' } } });

test('season keeps former players, team-specific trade contributions and weighted percentages', () => {
  const w1 = week(1, { '1': [player({ stats: stats({ FGM: 1, FGA: 2, PTS: 10 }) }), player({ id: 'old', name: 'Eski', status: 'birakildi', left: '2026-10-25', stats: stats({ PTS: 5 }) })], '2': [] });
  const w2 = week(2, { '1': [player({ status: 'takasla-gitti', left: '2026-10-28', tradedTo: '2', stats: stats({ FGM: 9, FGA: 10, PTS: 20 }) })], '2': [player({ added: '2026-10-28', stats: stats({ PTS: 30 }) })] }, { transactions: [{ playerId: 'p', teamId: '1', otherTeamId: '2', type: 'takas', date: '2026-10-28' }] });
  const v = takimKadroGorunumu(model([w1, w2]), '1', 'sezon');
  assert.equal(v.satirlar.length, 2);
  const p = v.satirlar.find((p) => p.id === 'p');
  assert.equal(p.stats.PTS, 30); assert.equal(p.ist['FG%'], 10 / 12); assert.equal(p.aktif, false);
  assert.ok(p.notlar.some((x) => x.metin.includes('İki takımına takaslandı')));
  assert.equal(takimKadroGorunumu(model([w1, w2]), '2', 'sezon').toplam.stats.PTS, 30);
});

test('missing statistics, missing weeks and mixed counting never become zero totals', () => {
  const a = week(1, { '1': [player({ stats: stats({ PTS: null }) })] });
  const b = week(2, { '1': [player({ stats: stats({ PTS: 20 }) })] });
  let v = takimKadroGorunumu(model([a, b]), '1', 'sezon');
  assert.equal(v.satirlar[0].stats.PTS, null); assert.equal(v.toplam.stats.PTS, null);
  v = takimKadroGorunumu(model([b]), '1', 'sezon');
  assert.deepEqual(v.eksikHaftalar, [1]); assert.equal(v.satirlar[0].stats.PTS, null);
  b.counting = 'all'; v = takimKadroGorunumu(model([a, b]), '1', 'sezon');
  assert.equal(v.karma, true); assert.equal(v.satirlar[0].games, null);
  assert.equal(kadroTablosu(a, null, '1').toplam.stats.PTS, null);
});

test('drop and re-add in one week is one current player with full history', () => {
  const w = week(1, { '1': [player({ added: '2026-10-24' })] }, { transactions: [{ playerId: 'p', teamId: '1', type: 'birakma', date: '2026-10-23' }, { playerId: 'p', teamId: '1', type: 'ekleme', date: '2026-10-24' }] });
  const v = takimKadroGorunumu(model([w], 1), '1');
  assert.equal(v.satirlar.length, 1); assert.equal(v.aktif, 1); assert.equal(v.satirlar[0].notlar.length, 2);
});

test('only closing ownership conflicts are rejected; former membership is retained', () => {
  const w = week(1, { '1': [player({ status: 'birakildi', left: '2026-10-23' })], '2': [player()] }, { freeAgents: [player()] });
  const validate = () => kadrolariDogrula(new Map([[1, { ad: 'hafta-01.json', veri: w }]]), []);
  assert.ok(validate().hatalar.some((x) => x.includes('serbest oyuncu listesinde olamaz')));
  assert.deepEqual(haftalikSerbestler(w), []);
  w.freeAgents = []; assert.deepEqual(validate().hatalar, []);
  w.teams['1'][0].status = 'kadroda'; assert.ok(validate().hatalar.some((x) => x.includes('iki takım')));
  w.teams['1'].push(player()); assert.ok(validate().hatalar.some((x) => x.includes('iki kez')));
});

test('archive never imports future roster files', () => {
  const w1 = week(1, { '1': [player()] });
  const w2 = week(2, { '1': [player({ id: 'future' })] });
  const v = takimKadroGorunumu(model([w1, w2], 1), '1', 'sezon');
  assert.deepEqual(v.satirlar.map((o) => o.id), ['p']);
  for (const issue of tumSayilar().sayilar) assert.ok(issue.kadroGecmisi.every((k) => k.week <= issue.hafta));
});
