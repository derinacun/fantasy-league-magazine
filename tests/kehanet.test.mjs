// Kehanet: adil sıra ile Yahoo sırası arasındaki farkın yönü (17 Kasım 2026)
import test from 'node:test';
import assert from 'node:assert/strict';
import { tumSayilar } from '../src/lib/model.js';
import { kehanetHesapla } from '../src/lib/kehanet.js';

test('adil sıra: Yahoo sırası adil sıradan kötüyse fikstür aşağı itmiştir (basamak > 0)', () => {
  const s = tumSayilar().sayilar.at(-1);
  const K = kehanetHesapla(s);
  for (const x of K.adil) if (x.yahooSira != null) assert.equal(x.basamak, x.yahooSira - x.adilSira);
  assert.deepEqual(K.adil.map((x) => x.adilSira), K.adil.map((_, i) => i + 1));
  for (let i = 1; i < K.adil.length; i++) assert.ok(K.adil[i - 1].beklenen >= K.adil[i].beklenen);
});
