// Eleme olasılığı (17 Kasım 2026): normal sezonun kalan haftaları 10.000 kez oynatılır.
// Yöntem: kalan her haftada her takımın 9 kategori değeri, o takımın bu sezon oynadığı haftalardan rastgele biri
// olarak çekilir; az veri varken aşırı kesinliği önlemek için k / (k + oynanan hafta) olasılıkla ligin herhangi bir
// takım-haftasından çekilir (ortalamaya çekme, k = 4: 4 haftada yarı yarıya, 16 haftada %20). Gerçek fikstürdeki
// rakiple kategori kategori karşılaştırılır.
// Sıralama Yahoo gibi kategori kaydıyla: kazanma oranı (beraberlik yarım); eşitlikte kura.
// Çıktı: ilk N'e (eleme) kalma, birincilik ve sonunculuk olasılığı. Okura ayarlar.elemeOlasiligiBaslangic haftasından itibaren görünür.
import { takimIstatistik, karsilastir } from './hesap.js';

// Tekrarlanabilir rastgele sayı (aynı veriyle her derlemede aynı sonuç)
function rastgele(tohum) {
  let a = tohum >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export function elemeOlasiligi(sayi, fikstur, { deneme = 10000, N = 8, sonHafta = 19 } = {}) {
  if (!fikstur?.normalSezon) return null;
  const ids = sayi.takimlar.map((t) => t.id);
  const haftalar = sayi.haftalarHam.filter((w) => w.week <= sayi.hafta && w.matchups.every((m) => m.status === 'final' || m.status == null));
  if (haftalar.length < 2) return null;
  // Her takımın oynadığı haftaların kategori değerleri
  const orneklem = Object.fromEntries(ids.map((id) => [id, haftalar.map((w) => takimIstatistik([w], id)).filter((s) => s && s.PTS != null)]));
  const havuz = ids.flatMap((id) => orneklem[id].map((_, i) => [id, i])); // ligin bütün takım-haftaları
  const K = 4;
  // Kalan eşleşmeler ve her olası haftalık eşleşmenin sonucu önceden (örneklem küçük): a'nın i. haftası × b'nin j. haftası
  const kalan = [];
  for (let w = sayi.hafta + 1; w <= sonHafta; w++) for (const [a, b] of fikstur.normalSezon[String(w)] ?? []) kalan.push([a, b]);
  if (!kalan.length) return null;
  const onbellek = new Map();
  const sonuc = (a, i, b, j) => {
    const k = `${a}:${i}|${b}:${j}`;
    if (!onbellek.has(k)) onbellek.set(k, karsilastir(orneklem[a][i], orneklem[b][j]));
    return onbellek.get(k);
  };
  const baslangic = Object.fromEntries(ids.map((id) => {
    const p = sayi.puanDurumu?.[id];
    return [id, { w: p?.wins ?? 0, l: p?.losses ?? 0, t: p?.ties ?? 0 }];
  }));
  const r = rastgele(sayi.hafta * 7919 + 17);
  const say = Object.fromEntries(ids.map((id) => [id, { eleme: 0, birinci: 0, sonuncu: 0, toplamOran: 0 }]));
  for (let d = 0; d < deneme; d++) {
    const k = Object.fromEntries(ids.map((id) => [id, { ...baslangic[id] }]));
    for (const [a, b] of kalan) {
      const cek = (id) => (r() < K / (K + orneklem[id].length) ? havuz[Math.floor(r() * havuz.length)] : [id, Math.floor(r() * orneklem[id].length)]);
      const [ka, i] = cek(a), [kb, j] = cek(b);
      const c = sonuc(ka, i, kb, j);
      k[a].w += c.wins; k[a].l += c.losses; k[a].t += c.ties;
      k[b].w += c.losses; k[b].l += c.wins; k[b].t += c.ties;
    }
    const oran = (x) => (x.w + x.t / 2) / Math.max(1, x.w + x.l + x.t);
    const sira = ids.map((id) => ({ id, o: oran(k[id]), kura: r() })).sort((x, y) => y.o - x.o || x.kura - y.kura);
    sira.forEach((x, n) => {
      if (n < N) say[x.id].eleme++;
      if (n === 0) say[x.id].birinci++;
      if (n === sira.length - 1) say[x.id].sonuncu++;
      say[x.id].toplamOran += x.o;
    });
  }
  const satirlar = ids.map((id) => ({
    id, eleme: say[id].eleme / deneme, birinci: say[id].birinci / deneme, sonuncu: say[id].sonuncu / deneme,
    beklenenOran: say[id].toplamOran / deneme, yahoo: sayi.puanDurumu?.[id]?.rank ?? null,
  })).sort((a, b) => b.eleme - a.eleme || b.birinci - a.birinci || a.sonuncu - b.sonuncu);
  return { satirlar, deneme, kalanHafta: sonHafta - sayi.hafta, orneklemHafta: haftalar.length, N };
}
