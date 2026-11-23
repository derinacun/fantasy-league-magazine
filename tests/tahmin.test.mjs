// Okur tahmin oyunu (18 Kasım 2026): giriş kontrolü, puanlama, sezon tablosu ve madalya.
import test from 'node:test';
import assert from 'node:assert/strict';
import { girisKontrol, puanla, skorDuzelt, tahminSezonu, kapanisZamani } from '../src/lib/tahmin.js';
import { tahminOyunu, kurulumYap } from '../src/lib/tahminModel.js';
import { haftaDosyalariniOku } from '../src/lib/okuma.js';
import { tumSayilar } from '../src/lib/model.js';

const acik = {
  hafta: 6, kapanis: '2026-11-23T23:59:00+03:00', takimlar: ['1', '2', '3', '4'], haftaninMaci: '1-2',
  eslesmeler: [{ anahtar: '1-2', ev: '1', dep: '2' }, { anahtar: '3-4', ev: '3', dep: '4' }],
};
const once = Date.parse('2026-11-23T20:00:00Z'), sonra = Date.parse('2026-11-23T21:00:00Z');

test('kapanış: yayın günü 23:59 Türkiye saati = 20:59 UTC', () => {
  assert.equal(new Date(kapanisZamani('2026-11-23')).toISOString(), '2026-11-23T20:59:00.000Z');
  assert.equal(kapanisZamani('2026-11-23', 'Europe/Paris'), '2026-11-23T22:59:00Z');
  assert.equal(kapanisZamani('2026-07-06', 'America/New_York'), '2026-07-07T03:59:00Z');
});

test('giriş: geçerli tahmin kabul; kapanıştan sonra, eksik seçim, bozuk ya da çelişkili skor reddedilir', () => {
  const iyi = { hafta: 6, takim: '3', secimler: { '1-2': '1', '3-4': '4' }, skor: [5, 3] };
  assert.deepEqual(girisKontrol(iyi, acik, once), { tamam: true, kayit: { takim: '3', hafta: 6, secimler: { '1-2': '1', '3-4': '4' }, skor: [5, 3, 1] } });
  assert.equal(girisKontrol(iyi, acik, sonra).tamam, false);
  assert.equal(girisKontrol({ ...iyi, takim: '9' }, acik, once).tamam, false);
  assert.equal(girisKontrol({ ...iyi, secimler: { '1-2': '1' } }, acik, once).tamam, false);
  assert.equal(girisKontrol({ ...iyi, skor: [6, 4] }, acik, once).tamam, false);
  assert.equal(girisKontrol({ ...iyi, skor: [3, 5] }, acik, once).tamam, false, 'skor deplasman diyor, seçim ev sahibi');
  assert.equal(girisKontrol({ ...iyi, hafta: 5 }, acik, once).tamam, false);
  assert.deepEqual(skorDuzelt([4, 4]), [4, 4, 1]);
});

test('puan: doğru kazanan 1, tam skor +2, berabere biten eşleşme puan vermez', () => {
  const sonuc = { '1-2': { kazanan: '1', skor: [5, 3, 1] }, '3-4': { kazanan: null, skor: [4, 4, 1] } };
  assert.deepEqual(puanla({ secimler: { '1-2': '1', '3-4': '3' }, skor: [5, 3] }, sonuc, '1-2'), { dogru: 1, sayilan: 1, tam: true, puan: 3 });
  assert.deepEqual(puanla({ secimler: { '1-2': '2', '3-4': '4' }, skor: [3, 5] }, sonuc, '1-2'), { dogru: 0, sayilan: 1, tam: false, puan: 0 });
});

test('sezon: madalya yalnızca koçlara, eşitlikte ortak; Hoca ve Abi tabloda', () => {
  const kur = { hafta: 6, haftaninMaci: '1-2', eslesmeler: acik.eslesmeler, hoca: { secimler: { '1-2': '1', '3-4': '3' }, skor: [5, 3, 1] }, abi: { secimler: { '1-2': '2', '3-4': '3' }, skor: null } };
  const r = tahminSezonu({
    kurulumlar: [kur],
    girisler: { 6: { 1: { picks: { '1-2': '1', '3-4': '3' }, score: [6, 3] }, 2: { picks: { '1-2': '1', '3-4': '3' }, score: [6, 2] }, 4: { picks: { '1-2': '2', '3-4': '4' }, score: [2, 6] }, 99: { picks: {}, score: [1, 1] } } },
    sonuclar: { 6: { '1-2': { kazanan: '1', skor: [5, 3, 1] }, '3-4': { kazanan: '3', skor: [6, 3, 0] } } },
    takimlar: acik.takimlar,
  });
  const h = r.haftalar[6];
  assert.deepEqual(h.kahinler.sort(), ['1', '2']);
  assert.equal(h.katilim, 3);
  assert.equal(r.tablo[0].id, 'hoca', 'Hoca tam skorla 4 puan');
  assert.equal(r.tablo.find((t) => t.id === '1').sira, 2);
  assert.equal(r.tablo.find((t) => t.id === '2').sira, 2);
  assert.equal(r.tablo.find((t) => t.id === '1').kahin, 1);
  assert.equal(r.tablo.find((t) => t.id === 'hoca').kahin, 0);
  assert.ok(!r.tablo.some((t) => t.id === '99'));
});

test('model: 4. hafta oyunu kurgulanınca (3. sayının tahminleri, 4. sayının sonuçları) tablo ve kâhin çıkar', () => {
  const hamlar = haftaDosyalariniOku().map((d) => structuredClone(d.veri)).sort((a, b) => a.week - b.week).slice(0, 4);
  const k = kurulumYap(hamlar[2]);
  assert.equal(k.hafta, 4);
  assert.equal(k.eslesmeler.length, 7);
  const herkes = Object.fromEntries(k.eslesmeler.map((e) => [e.anahtar, e.ev]));
  hamlar[3].predictionEntries = { 5: { picks: herkes, score: [5, 4] }, 6: { picks: k.hoca.secimler, score: k.hoca.skor } };
  const s = tumSayilar().sayilar[3];
  const o = tahminOyunu(hamlar, s, { tahminOyunuBaslangic: 4, normalSezonHaftaSayisi: 19 });
  const h = o.haftalar[4];
  assert.equal(h.satirlar.length, 4);
  const hoca = h.satirlar.find((x) => x.id === 'hoca'), alti = h.satirlar.find((x) => x.id === '6');
  assert.equal(alti.puan, hoca.puan, 'Hoca ile aynı tahmini giren aynı puanı alır');
  assert.ok(h.kahinler.length >= 1 && h.kahinler.every((id) => ['5', '6'].includes(id)));
  assert.equal(o.acik?.hafta, 5);
});

test('Worker: kapanıştan önce yalnızca girenler görünür, sonra herkesin tahmini; geçersiz giriş reddedilir', async () => {
  const { tahmin } = await import('../worker/index.js');
  const m = new Map();
  const kv = { get: async (k) => m.get(k) ?? null, put: async (k, v) => void m.set(k, v), delete: async (k) => void m.delete(k),
    list: async ({ prefix }) => ({ keys: [...m.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })), list_complete: true }) };
  let kapanis = new Date(Date.now() + 3600e3).toISOString();
  const env = { ABONELER: kv, ASSETS: { fetch: async () => new Response(JSON.stringify({ ...acik, kapanis })) } };
  const url = new URL('https://site/api/tahmin?hafta=6');
  const post = (g) => tahmin(new Request(url, { method: 'POST', body: JSON.stringify(g) }), env, url);
  assert.equal((await post({ hafta: 6, takim: '2', secimler: { '1-2': '2', '3-4': '3' }, skor: [3, 6] })).status, 200);
  assert.equal((await post({ hafta: 6, takim: '2', secimler: { '1-2': '2' }, skor: [3, 6] })).status, 400);
  let g = await (await tahmin(new Request(url), env, url)).json();
  assert.deepEqual(g.girenler, ['2']);
  assert.equal(g.predictionEntries, undefined);
  kapanis = new Date(Date.now() - 1000).toISOString();
  assert.equal((await post({ hafta: 6, takim: '3', secimler: { '1-2': '2', '3-4': '3' }, skor: [3, 6] })).status, 400);
  g = await (await tahmin(new Request(url), env, url)).json();
  assert.deepEqual(g.predictionEntries, { 2: { picks: { '1-2': '2', '3-4': '3' }, score: [3, 6, 0] } });
});

test('yazı malzemesi: garanti maçta kaybedeni seçenler, tek başına bilen, kendine karşı oynayan', async () => {
  const { yaziMalzemesi } = await import('../src/lib/tahmin.js');
  const k = { eslesmeler: acik.eslesmeler, model: { '1-2': { favori: '1', fark: 6 }, '3-4': { favori: '3', fark: 1 } } };
  const sonuc = { '1-2': { kazanan: '1', skor: [6, 2, 1] }, '3-4': { kazanan: '4', skor: [4, 5, 0] } };
  const katilan = [['1', { secimler: { '1-2': '1', '3-4': '3' } }], ['2', { secimler: { '1-2': '1', '3-4': '3' } }], ['3', { secimler: { '1-2': '2', '3-4': '4' } }]];
  const m = yaziMalzemesi(k, sonuc, katilan);
  assert.deepEqual(m.garanti.map((g) => g.yanilan), [['3']]);
  assert.deepEqual(m.tekDogru.map((t) => t.kim), ['3']);
  assert.deepEqual(m.kendineKarsi, [{ kim: '2', anahtar: '1-2', hakliCikti: true }, { kim: '3', anahtar: '3-4', hakliCikti: true }]);
  assert.deepEqual(m.cogunlukYanildi.map((c) => c.anahtar), ['3-4']);
});
