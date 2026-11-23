// Geçmiş sezonlar (18 Kasım 2026): veri Yahoo kayıtlarıyla tutarlı, iki koç özeti simetrik, bilinen rekorlar.
import test from 'node:test';
import assert from 'node:assert/strict';
import { gecmisOku } from '../src/lib/okuma.js';
import { gecmisHesapla, ikiKoc } from '../src/lib/gecmis.js';
import { tumSayilar } from '../src/lib/model.js';

const G = gecmisOku();
const sayi = tumSayilar().sayilar.at(-1);

test('geçmiş: normal sezon kategori toplamları Yahoo kaydıyla aynı; her sezonda tek şampiyon', () => {
  for (const s of G.sezonlar) {
    const top = {};
    for (const [, a, b, sa, sb, tur] of s.maclar) {
      if (tur !== 'n') continue;
      for (const [id, x, y] of [[a, sa, sb], [b, sb, sa]]) { top[id] ??= [0, 0, 0]; top[id][0] += x; top[id][1] += y; top[id][2] += 9 - sa - sb; }
    }
    for (const [mid, t] of Object.entries(s.takimlar)) assert.equal(top[mid].join('-'), t.kayit, `${s.yil} ${t.ad}`);
    assert.equal(Object.values(s.takimlar).filter((t) => t.sira === 1).length, 1);
  }
});

test('geçmiş: iki koç özeti iki yönden aynı; 2024–25 en uzun seri 14 hafta (Yahoo rekor defteriyle aynı)', () => {
  const R = gecmisHesapla(G, sayi);
  const x = ikiKoc(R.liste, '5', '6'), y = ikiKoc(R.liste, '6', '5');
  assert.deepEqual([x.g, x.m, x.b, x.ka, x.kb], [y.m, y.g, y.b, y.kb, y.ka]);
  const s = R.tum.rekorlar.galibiyetSerisi[0];
  assert.deepEqual([s.koc, s.sezon, s.uzunluk, s.bas, s.son], ['1', 2024, 14, 2, 15]);
  assert.ok(R.tum.satirlar.every((t) => t.bugun === Boolean(sayi.takim[t.koc])));
});
