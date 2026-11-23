// Draftın sürprizi ve hayal kırıklığı (18 Kasım 2026):
// - Ölçü: draft sırası (genel seçim numarası) ile Yahoo'nun bu sezonki "Current" sırası. Fark = seçim − Yahoo sırası:
//   artı = draft yerinden yukarıda (sürpriz), eksi = aşağıda (hayal kırıklığı).
// - Oyuncu şu an kimin kadrosundaysa onun hanesine yazılır (draft eden başka biriyse "X draft etti" diye belirtilir).
// - Yalnızca draft edilmiş ve şu an bir kadroda olan oyuncular; serbest oyuncudan alınanlar draft karnesine girmez.
// - Sıralamaya yalnızca sezonun maçlarının en az üçte birinde oynayanlar girer; sakatlıktan oynayamayanlar
//   hayal kırıklığı sayılmaz, ayrıca "sahaya çıkamayanlar" olarak gösterilir.
// - Yahoo sırası her sayıda okunur (veri/yahoo-sira/hafta-NN.json); dosya yoksa bu bölüm görünmez.

export function draftKarnesi(sayi, draft, sira) {
  if (!draft?.secimler?.length || !sira?.oyuncular || !sayi.kadro?.teams) return null;
  const secim = new Map(draft.secimler.map(([no, id, ad, takim]) => [String(id), { no, ad, draftEden: takim }]));
  const oyuncular = [];
  for (const [takimId, liste] of Object.entries(sayi.kadro.teams)) {
    for (const o of liste) {
      if (o.status !== 'kadroda') continue;
      const d = secim.get(String(o.id));
      const y = sira.oyuncular[String(o.id)];
      if (!d || !y) continue;
      oyuncular.push({ id: String(o.id), ad: o.name, nba: o.nbaTeam, takim: takimId, secim: d.no, tur: Math.ceil(d.no / Object.keys(sayi.kadro.teams).length),
        draftEden: d.draftEden, sira: y.sira, onceki: y.onceki, mac: y.mac, fark: d.no - y.sira });
    }
  }
  const enCokMac = Math.max(0, ...oyuncular.map((x) => x.mac ?? 0));
  const esik = Math.ceil(enCokMac / 3);
  for (const x of oyuncular) x.sayilir = (x.mac ?? 0) >= esik;
  const sayilan = oyuncular.filter((x) => x.sayilir);
  const takimlar = {};
  for (const id of Object.keys(sayi.kadro.teams)) {
    const l = oyuncular.filter((x) => x.takim === id);
    const ls = l.filter((x) => x.sayilir);
    const surpriz = [...ls].filter((x) => x.fark > 0).sort((a, b) => b.fark - a.fark)[0] ?? null;
    const hayal = [...ls].filter((x) => x.fark < 0).sort((a, b) => a.fark - b.fark)[0] ?? null;
    takimlar[id] = { surpriz, hayal, oynamayan: l.filter((x) => !x.sayilir), oyuncular: Object.fromEntries(l.map((x) => [x.id, x])) };
  }
  return {
    tarih: sira.tarih,
    takimlar,
    esik,
    oynamayanlar: oyuncular.filter((x) => !x.sayilir).sort((a, b) => a.secim - b.secim),
    surprizler: [...sayilan].filter((x) => x.fark > 0).sort((a, b) => b.fark - a.fark).slice(0, 5),
    hayalKiriklari: [...sayilan].filter((x) => x.fark < 0).sort((a, b) => a.fark - b.fark).slice(0, 5),
  };
}

export const farkYazDraft = (f) => (f > 0 ? `+${f}` : f < 0 ? `−${-f}` : '±0');
