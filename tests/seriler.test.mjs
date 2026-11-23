// Kemer kuralları (17 Kasım 2026): en az 3 hafta, yalnızca aktif seriler, eşitler paylaşır, değişim türleri.
import test from 'node:test';
import assert from 'node:assert/strict';
import { serilerHesapla, kemerSeridiHazir } from '../src/lib/seriler.js';
import { KATEGORILER } from '../src/lib/hesap.js';

const IDS = ['1', '2', '3', '4'];
// sonuc: id → 'G' | 'M' | 'B'; uyku: id → puan (yoksa veri yok)
function hafta(n, sonuc, uyku = null) {
  const cift = [['1', '2'], ['3', '4']];
  const eslesmeler = cift.map(([a, b]) => {
    const kazanan = sonuc[a] === 'G' ? a : sonuc[b] === 'G' ? b : null;
    return { ev: a, dep: b, kazanan, durum: 'final' };
  });
  const sira = Object.fromEntries(IDS.map((id, i) => [id, Object.fromEntries(KATEGORILER.map((k) => [k, i + 1]))]));
  return {
    hafta: n, takimlar: IDS.map((id) => ({ id, ad: `T${id}` })), eslesmeler, kapsam: { hafta: { sira } },
    uyuyan: uyku ? { satirlar: IDS.map((id) => ({ takimId: id, uyku: uyku[id] ?? 0 })) } : null,
  };
}
const kemer = (r, a) => r.kemerler.find((k) => k.anahtar === a);
const sahip = (r, a) => kemer(r, a).sahipler.map((x) => x.id).sort();

test('kemer en az 3 hafta: 2 haftalık seri kemer getirmez', () => {
  const h = [hafta(1, { 1: 'G', 2: 'M', 3: 'G', 4: 'M' }), hafta(2, { 1: 'G', 2: 'M', 3: 'M', 4: 'G' })];
  assert.deepEqual(sahip(serilerHesapla(h), 'galibiyet'), []);
});

test('eşit aktif seriler kemeri paylaşır, ilk sahiplenme "ilk" sayılır', () => {
  const s = { 1: 'G', 2: 'M', 3: 'G', 4: 'M' };
  const r = serilerHesapla([hafta(1, s), hafta(2, s), hafta(3, s)]);
  assert.deepEqual(sahip(r, 'galibiyet'), ['1', '3']);
  assert.equal(kemer(r, 'galibiyet').degisim.tur, 'ilk');
  assert.deepEqual(sahip(r, 'yenilgi'), ['2', '4']);
});

test('ortak sahiplerden biri düşer; seri bitince kemer boşa düşer; beraberlik seriyi bitirir', () => {
  const s = { 1: 'G', 2: 'M', 3: 'G', 4: 'M' };
  const h = [hafta(1, s), hafta(2, s), hafta(3, s), hafta(4, { 1: 'G', 2: 'M', 3: 'M', 4: 'G' })];
  let r = serilerHesapla(h);
  assert.deepEqual(sahip(r, 'galibiyet'), ['1']);
  assert.equal(kemer(r, 'galibiyet').degisim.tur, 'ortak-dustu');
  assert.deepEqual(kemer(r, 'galibiyet').degisim.dusen, [{ id: '3', uzunluk: 3 }]);
  r = serilerHesapla([...h, hafta(5, { 1: 'B', 2: 'B', 3: 'G', 4: 'M' })]);
  assert.deepEqual(sahip(r, 'galibiyet'), []);
  assert.equal(kemer(r, 'galibiyet').degisim.tur, 'bosa');
  const serit = kemerSeridiHazir(r, (id) => `T${id}`);
  assert.match(serit.metin, /Galibiyet kemeri boşa düştü/);
});

test('kemer yeni takıma geçer: sahibin serisi biter, en uzun aktif seri alır', () => {
  const h = [
    hafta(1, { 1: 'G', 2: 'M', 3: 'M', 4: 'G' }),
    hafta(2, { 1: 'G', 2: 'M', 3: 'G', 4: 'M' }),
    hafta(3, { 1: 'G', 2: 'M', 3: 'G', 4: 'M' }),
    hafta(4, { 1: 'G', 2: 'M', 3: 'G', 4: 'M' }),
    hafta(5, { 1: 'M', 2: 'G', 3: 'G', 4: 'M' }),
  ];
  const r = serilerHesapla(h);
  assert.deepEqual(sahip(r, 'galibiyet'), ['3']);
  assert.equal(kemer(r, 'galibiyet').degisim.tur, 'gecti');
  assert.equal(kemer(r, 'galibiyet').sahipler[0].uzunluk, 4);
});

test('uyku: verisi olmayan hafta seriyi bitirir; 5 ve üstü uyku sayılır', () => {
  const s = { 1: 'G', 2: 'M', 3: 'G', 4: 'M' };
  const r = serilerHesapla([hafta(1, s, null), hafta(2, s, { 2: 5 }), hafta(3, s, { 2: 7 }), hafta(4, s, { 2: 6, 4: 4 })]);
  assert.deepEqual(sahip(r, 'uyku'), ['2']);
  assert.equal(kemer(r, 'uyku').sahipler[0].uzunluk, 3);
});

test('etkileşim: haftanın en çok yazan ilk 3ü (eşitler dahil), verisi olmayan hafta seriyi bitirir', () => {
  const s = { 1: 'G', 2: 'M', 3: 'G', 4: 'M' };
  const h = (n, sohbet) => ({ ...hafta(n, s), sohbet });
  const r = serilerHesapla([h(1, null), h(2, { 1: 50, 2: 40, 3: 40, 4: 10 }), h(3, { 1: 5, 2: 90, 3: 80, 4: 70 }), h(4, { 1: 9, 2: 30, 3: 30, 4: 1 })]);
  assert.deepEqual(sahip(r, 'etkilesim'), ['2', '3']);
  assert.equal(kemer(r, 'etkilesim').sahipler[0].uzunluk, 3);
});
