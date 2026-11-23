// Uyku ligi (17 Kasım 2026): sezon toplamı, eşitlikte uyuyan hafta, koç değişiminde sıfırlama.
import test from 'node:test';
import assert from 'node:assert/strict';
import { uykuLigi } from '../src/lib/uykuLigi.js';

const takimlar = ['1', '2', '3'].map((id) => ({ id, ad: `T${id}` }));
const hafta = (n, puan) => ({ hafta: n, takimlar, uyuyan: puan ? { satirlar: Object.entries(puan).map(([takimId, uyku]) => ({ takimId, uyku, kacan: uyku, yatanGun: 0 })) } : null });

test('toplam uyku sırası; eşitlikte daha çok uyuyan hafta önde; veri olmayan hafta sayılmaz', () => {
  const L = uykuLigi([hafta(1, null), hafta(2, { 1: 6, 2: 3, 3: 0 }), hafta(3, { 1: 0, 2: 3, 3: 1 })]);
  assert.deepEqual(L.satirlar.map((s) => [s.id, s.toplam, s.uyuyanHafta]), [['1', 6, 1], ['2', 6, 0], ['3', 1, 0]]);
  assert.deepEqual(L.lider.map((s) => s.id), ['1']);
});

test('koç değişen takım yeni koçla sıfırlanır', () => {
  const L = uykuLigi([hafta(2, { 1: 11, 2: 1, 3: 0 }), hafta(3, { 1: 7, 2: 2, 3: 0 }), hafta(4, { 1: 4, 2: 3, 3: 0 })], { kocDegisimleri: [{ takim: '1', hafta: 4 }] });
  const t1 = L.satirlar.find((s) => s.id === '1');
  assert.equal(t1.toplam, 4);
  assert.equal(t1.sifirlandi, 4);
  assert.deepEqual(L.lider.map((s) => s.id), ['2']);
  assert.equal(L.bitti, false);
});
