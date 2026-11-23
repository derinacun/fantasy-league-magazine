// Draft karnesi (18 Kasım 2026): fark = seçim − Yahoo sırası; şu anki sahibin hanesine; az oynayan sayılmaz.
import test from 'node:test';
import assert from 'node:assert/strict';
import { draftKarnesi } from '../src/lib/draft.js';
import { tumSayilar } from '../src/lib/model.js';

test('draft: sürpriz artı, hayal kırıklığı eksi; az oynayan sıralamaya girmez; sahibin hanesine', () => {
  const sayi = { kadro: { teams: {
    1: [{ id: 'a', name: 'A', status: 'kadroda' }, { id: 'b', name: 'B', status: 'kadroda' }, { id: 'c', name: 'C', status: 'kadroda' }],
    2: [{ id: 'd', name: 'D', status: 'kadroda' }, { id: 'e', name: 'E', status: 'birakildi' }],
  } } };
  const draft = { secimler: [[1, 'a', 'A', '1'], [2, 'd', 'D', '2'], [3, 'b', 'B', '2'], [4, 'c', 'C', '1'], [5, 'e', 'E', '2']] };
  const sira = { tarih: '2026-11-18', oyuncular: { a: { sira: 40, mac: 12 }, b: { sira: 1, mac: 12 }, c: { sira: 900, mac: 1 }, d: { sira: 2, mac: 12 }, e: { sira: 3, mac: 12 } } };
  const D = draftKarnesi(sayi, draft, sira);
  assert.equal(D.takimlar[1].surpriz.id, 'b');
  assert.equal(D.takimlar[1].surpriz.draftEden, '2', 'takımı 2 draft etti, 1 kadrosunda');
  assert.equal(D.takimlar[1].hayal.id, 'a');
  assert.equal(D.takimlar[1].hayal.fark, -39);
  assert.deepEqual(D.oynamayanlar.map((x) => x.id), ['c']);
  assert.ok(!D.surprizler.concat(D.hayalKiriklari).some((x) => x.id === 'e'), 'bırakılan oyuncu sayılmaz');
});

test('draft: gerçek veri, 182 seçim ve her takımda sürpriz ya da hayal kırıklığı', () => {
  const s = tumSayilar().sayilar.at(-1);
  assert.ok(s.draft);
  assert.equal(Object.keys(s.draft.takimlar).length, 14);
  assert.ok(Object.values(s.draft.takimlar).every((t) => t.surpriz || t.hayal));
});
