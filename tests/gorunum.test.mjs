import test from 'node:test';
import assert from 'node:assert/strict';
import { haftaAraligi, normalAd, oyuncuAlt, sakatlarListesinde, takimKadrosu, sezonGecmisi, oyuncuBulListesi, oyuncuAdresi, adParcalari, kadroOzeti } from '../src/lib/kadroGorunum.js';
import { tumSayilar } from '../src/lib/model.js';

const oyuncu = (s = {}) => ({ id: 'p', name: 'Oyuncu', nbaTeam: 'DEN', positions: 'PF,C', status: 'kadroda', added: null, left: null, games: null, stats: null, ...s });
const hafta = (n, teams, extra = {}) => ({ schemaVersion: 1, week: n, counting: 'none', teams, transactions: [], freeAgents: [], ...extra });
const model = (dosyalar, son = 2) => ({
  hafta: son, haftalarHam: Array.from({ length: son }, (_, i) => ({ week: i + 1 })),
  kadro: dosyalar.find((d) => d.week === son) ?? null, kadroGecmisi: dosyalar.filter((d) => d.week <= son),
  takim: { '1': { ad: 'Bir', slug: 'bir' }, '2': { ad: 'İki', slug: 'iki' } },
  adres: (bolum = '', ek = '') => `/${bolum ? bolum + '/' : ''}${ek}`,
});

test('yazım: hafta aralığı, aksansız arama, Türkçe pozisyon ve tam NBA takımı adı', () => {
  assert.equal(haftaAraligi([1, 2]), '1–2. hafta');
  assert.equal(haftaAraligi([2]), '2. hafta');
  assert.equal(haftaAraligi([1, 2, 4]), '1–2 ve 4. hafta');
  assert.equal(normalAd('Nikola Jokić'), 'nikola jokic');
  assert.equal(normalAd('Isaiah Jackson'), 'isaiah jackson');
  assert.equal(normalAd('Kristaps Porziņģis'), 'kristaps porzingis');
  assert.equal(oyuncuAlt(oyuncu()), 'Denver Nuggets · uzun forvet, pivot');
  assert.equal(oyuncuAlt(oyuncu({ nbaTeam: null, positions: 'PG' })), 'oyun kurucu');
});

test('sakatlar listesi: son günün yeri (Excel sütunu ya da günlük diziliş)', () => {
  assert.equal(sakatlarListesinde(oyuncu({ lastSlot: 'IL' })), true);
  assert.equal(sakatlarListesinde(oyuncu({ lineupByDate: { '2026-10-31': 'IL', '2026-11-01': 'BN' } })), false);
  assert.equal(sakatlarListesinde(oyuncu({ lineupByDate: { '2026-10-31': 'BN', '2026-11-01': 'IL' } })), true);
  assert.equal(sakatlarListesinde(oyuncu({ status: 'birakildi', left: '2026-10-30', lastSlot: 'IL' })), false);
});

test('takım kadrosu: gruplar, hareket etiketleri ve kart özeti', () => {
  const w2 = hafta(2, { '1': [
    oyuncu({ id: 'a', name: 'Ali', lastSlot: 'PG' }),
    oyuncu({ id: 'b', name: 'Ali', lastSlot: 'IL' }),
    oyuncu({ id: 'c', name: 'Can', status: 'birakildi', added: '2026-10-27', left: '2026-10-28' }),
  ], '2': [] }, { transactions: [
    { date: '2026-10-27', teamId: '1', type: 'ekleme', playerId: 'c', name: 'Can' },
    { date: '2026-10-28', teamId: '1', type: 'birakma', playerId: 'c', name: 'Can' },
  ] });
  const k = takimKadrosu(model([w2]), '1');
  assert.deepEqual([k.kadroda.map((o) => o.id), k.sakat.map((o) => o.id), k.ayrilan.map((o) => o.id)], [['a'], ['b'], ['c']]);
  assert.deepEqual(k.ayrilan[0].notlar.map((n) => n.metin), ['Eklendi · 27 Ekim', 'Bırakıldı · 28 Ekim']);
  assert.equal(kadroOzeti(model([w2]), '1'), '2 oyuncu · sakatlar listesinde 1 · bu hafta 2 hareket');
  assert.equal(takimKadrosu(model([w2]), '9'), null);
});

test('sezon geçmişi: sezon başından beri kadroda olanlar ayrı, gelip gidenler hafta aralığıyla', () => {
  const w1 = hafta(1, { '1': [oyuncu({ id: 'a', name: 'Ali' }), oyuncu({ id: 'd', name: 'Can' })] });
  const w2 = hafta(2, { '1': [oyuncu({ id: 'a', name: 'Ali' }), oyuncu({ id: 'd', name: 'Can', status: 'birakildi', left: '2026-10-29' }), oyuncu({ id: 'e', name: 'Ece', added: '2026-10-29' })] }, { transactions: [
    { date: '2026-10-29', teamId: '1', type: 'birakma', playerId: 'd', name: 'Can' }, { date: '2026-10-29', teamId: '1', type: 'ekleme', playerId: 'e', name: 'Ece' },
  ] });
  const G = sezonGecmisi(model([w1, w2]), '1');
  assert.equal(G.basindan, 1);
  assert.deepEqual(G.gelipGidenler.map((o) => [o.id, o.haftalar, o.guncel]).sort(), [['d', '1–2. hafta', false], ['e', '2. hafta', true]]);
  assert.deepEqual(sezonGecmisi(model([w2]), '1').eksikHaftalar, [1]);
});

test('oyuncu bul ve ad bağlantıları', () => {
  const w2 = hafta(2, { '1': [oyuncu({ id: 'a', name: 'Nikola Jokić', lastSlot: 'C' }), oyuncu({ id: 'c', name: 'Can', status: 'birakildi', left: '2026-10-28' })], '2': [oyuncu({ id: 'c', name: 'Can', added: '2026-10-30', lastSlot: 'BN' })] }, {
    freeAgents: [{ id: 'f', name: 'Fırat', nbaTeam: 'LAL', positions: 'SG', ownedPct: 20 }],
    transactions: [{ date: '2026-10-28', teamId: '1', type: 'birakma', playerId: 'c', name: 'Can' }, { date: '2026-10-30', teamId: '2', type: 'ekleme', playerId: 'c', name: 'Can' }],
  });
  const M = model([w2]);
  const B = oyuncuBulListesi(M);
  const can = B.satirlar.find((o) => o.id === 'c');
  assert.equal(can.sahip, '2');
  assert.deepEqual(can.hareketler, ['Bir bıraktı · 28 Ekim', 'İki ekledi · 30 Ekim']);
  assert.equal(B.satirlar.find((o) => o.id === 'f').sahip, null);
  assert.deepEqual([B.kadroda, B.serbest, B.eklendi, B.birakildi], [2, 1, 1, 1]);
  assert.equal(oyuncuAdresi(M, '1', 'Nikola Jokic'), '/takimlar/bir/#oyuncu-a');
  assert.equal(oyuncuAdresi(M, '1', 'Yok Böyle'), null);
  assert.deepEqual(adParcalari(M, '1', 'Nikola Jokić + Yok Böyle').map((p) => p.href), ['/takimlar/bir/#oyuncu-a', null, null]);
});

test('gerçek veri: her sayıda bağlantı hedefleri tekil, oyuncu bul kapanış kadrosuyla tutarlı', () => {
  for (const sayi of tumSayilar().sayilar) {
    const B = oyuncuBulListesi(sayi);
    if (!B) continue;
    const kadroda = new Set(Object.values(sayi.kadro.teams).flat().filter((o) => o.status === 'kadroda').map((o) => String(o.id)));
    assert.equal(B.kadroda, kadroda.size);
    assert.equal(new Set(B.satirlar.map((o) => o.id)).size, B.satirlar.length);
  }
});
