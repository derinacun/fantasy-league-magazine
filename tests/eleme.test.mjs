// Eleme olasılığı (17 Kasım 2026): olasılıklar tutarlı ve tekrarlanabilir.
import test from 'node:test';
import assert from 'node:assert/strict';
import { tumSayilar } from '../src/lib/model.js';
import { elemeOlasiligi } from '../src/lib/eleme.js';
import { fiksturOku } from '../src/lib/okuma.js';

test('eleme: ilk 8 toplamı 8, birincilik ve sonunculuk toplamı 1; aynı veriyle aynı sonuç', () => {
  const s = tumSayilar().sayilar.at(-1);
  const f = fiksturOku();
  const a = elemeOlasiligi(s, f, { deneme: 2000 });
  const b = elemeOlasiligi(s, f, { deneme: 2000 });
  const top = (k) => a.satirlar.reduce((t, x) => t + x[k], 0);
  assert.ok(Math.abs(top('eleme') - 8) < 1e-9);
  assert.ok(Math.abs(top('birinci') - 1) < 1e-9);
  assert.ok(Math.abs(top('sonuncu') - 1) < 1e-9);
  assert.deepEqual(a.satirlar, b.satirlar);
});

test('fikstür: oynanmış haftaların eşleşmeleri Yahoo verisiyle aynı', () => {
  const s = tumSayilar().sayilar.at(-1);
  const f = fiksturOku();
  const anahtar = (a, b) => [a, b].sort((x, y) => x - y).join('-');
  for (const w of s.haftalarHam) {
    const veri = w.matchups.map((m) => anahtar(m.home.id, m.away.id)).sort();
    const fik = (f.normalSezon[String(w.week)] ?? []).map(([a, b]) => anahtar(a, b)).sort();
    assert.deepEqual(fik, veri, `${w.week}. hafta`);
  }
});
