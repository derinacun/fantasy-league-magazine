// Uyku ligi ve Altın Yastık (17 Kasım 2026): haftalık uyku puanlarının sezon toplamı (src/lib/uyuyan.js).
// Sıra: toplam uyku puanı; eşitlikte daha çok "uyuyan" (5+) hafta önde, sonra daha çok yedekte kalan maç.
// Koç değişen takım yeni koçla sıfırlanır: ayarlar.kocDegisimleri [{ takim, hafta }] → o haftadan itibaren sayılır.
// Altın Yastık normal sezon bitince (ayarlar.normalSezonHaftaSayisi) liderin; o zamana kadar "Altın Yastık'a en yakın".
export function uykuLigi(sayilar, ayarlar = {}) {
  const sirali = [...sayilar].sort((a, b) => a.hafta - b.hafta);
  const son = sirali.at(-1);
  const basla = Object.fromEntries((ayarlar.kocDegisimleri || []).map((d) => [String(d.takim), d.hafta]));
  const yeniKoc = Object.fromEntries((ayarlar.kocDegisimleri || []).map((d) => [String(d.takim), d.koc ?? null]));
  const satirlar = son.takimlar.map((t) => {
    const ilk = basla[t.id] ?? 0;
    const haftalar = sirali
      .filter((s) => s.uyuyan && s.hafta >= ilk)
      .map((s) => ({ hafta: s.hafta, ...(s.uyuyan.satirlar.find((r) => r.takimId === t.id) ?? { uyku: 0, kacan: 0, yatanGun: 0 }) }));
    return {
      id: t.id,
      toplam: haftalar.reduce((a, h) => a + h.uyku, 0),
      uyuyanHafta: haftalar.filter((h) => h.uyku >= 5).length,
      kacan: haftalar.reduce((a, h) => a + h.kacan, 0),
      yatan: haftalar.reduce((a, h) => a + h.yatanGun, 0),
      haftalar: haftalar.map((h) => ({ hafta: h.hafta, uyku: h.uyku })),
      sifirlandi: ilk > 0 ? ilk : null,
      yeniKoc: ilk > 0 ? yeniKoc[t.id] : null,
    };
  }).sort((a, b) => b.toplam - a.toplam || b.uyuyanHafta - a.uyuyanHafta || b.kacan - a.kacan);
  satirlar.forEach((s, i) => { s.sira = i > 0 && s.toplam === satirlar[i - 1].toplam && s.uyuyanHafta === satirlar[i - 1].uyuyanHafta ? satirlar[i - 1].sira : i + 1; });
  if (!satirlar.some((s) => s.haftalar.length)) return null;
  const bitti = son.hafta >= (ayarlar.normalSezonHaftaSayisi ?? Infinity);
  const lider = satirlar[0].toplam > 0 ? satirlar.filter((s) => s.sira === 1) : [];
  // Geçen haftanın lideri (liderlik el değiştirdi mi? haftalık yazı için)
  const once = sirali.length > 1 ? uykuLigi(sirali.slice(0, -1), ayarlar) : null;
  // El değiştirdi: yeni liderlerden biri geçen hafta lider değildi (ortak liderlikten tek başına kalmak sayılmaz)
  const liderDegisti = !!once && once.lider.length > 0 && lider.some((x) => !once.lider.some((y) => y.id === x.id));
  return { satirlar, lider, bitti, liderDegisti, oncekiLider: once?.lider ?? [] };
}
