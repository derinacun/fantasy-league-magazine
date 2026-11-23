// Geçmiş sezonlar ve iki koç rekabeti (18 Kasım 2026):
// - Kaynak veri/gecmis.json (Yahoo 2022–2025; Claude bir kez okudu, normal sezon kayıtları Yahoo ile birebir).
// - Koç kimliği: aynı Yahoo yöneticisi. Bugünkü koçlar bugünkü takım kimliğiyle, ligden ayrılanlar e1–e8 ile tutulur.
//   Takım adı sezondan sezona değişse de koç aynıdır; aynı takım yerine gelen yeni koç eskinin geçmişini almaz.
// - Bu sezonun bitmiş eşleşmeleri de "tüm zamanlar"a girer.
// - Karşılaştır yalnızca bugünkü koçları gösterir; eski koçlar ve eski takım adları sezon sonuçlarında görünür.

import { t as _t } from '../i18n/t.js';
const KAT = 9;
const yuzdeSay = (k) => (k.g + k.b / 2) / Math.max(1, k.g + k.m + k.b);

/** Bütün eşleşmeler tek listede: { sezon, etiket, hafta, a, b, sa, sb, tur, adA, adB } (a, b: koç kimliği). */
export function tumEslesmeler(G, sayi) {
  const liste = [];
  for (const s of G?.sezonlar ?? []) {
    for (const [hafta, ea, eb, sa, sb, tur] of s.maclar) {
      liste.push({ sezon: s.yil, etiket: s.etiket, hafta, a: s.takimlar[ea].koc, b: s.takimlar[eb].koc, sa, sb, tur, adA: s.takimlar[ea].ad, adB: s.takimlar[eb].ad });
    }
  }
  const buYil = G ? Math.max(...G.sezonlar.map((s) => s.yil)) + 1 : null;
  for (const w of sayi.haftalarHam) {
    for (const m of w.matchups) {
      if (m.status !== 'final') continue;
      liste.push({ sezon: buYil, etiket: buYil ? `${buYil}–${String(buYil + 1).slice(2)}` : _t('bu sezon'), hafta: w.week, a: m.home.id, b: m.away.id,
        sa: m.home.score.wins, sb: m.away.score.wins, tur: 'n', adA: sayi.takim[m.home.id]?.ad ?? m.home.id, adB: sayi.takim[m.away.id]?.ad ?? m.away.id, buSezon: true });
    }
  }
  return liste;
}

/** Koçun adı: bugünkü takımı; ligden ayrıldıysa son takım adı. */
export function kocAdi(G, sayi, koc) {
  if (sayi.takim[koc]) return sayi.takim[koc].ad;
  for (const s of [...(G?.sezonlar ?? [])].reverse()) {
    const t = Object.values(s.takimlar).find((x) => x.koc === koc);
    if (t) return t.ad;
  }
  return koc;
}

const tire = (k) => String(k).replace(/-/g, '–');
const sonucYaz = (sira) => (sira === 1 ? _t('Şampiyon') : sira === 2 ? _t('Finalist') : sira === 3 ? _t('Üçüncü') : `${sira}.`);

/** Sezon özetleri (yeniden eskiye): kürsü ve sıralama. */
export function sezonOzetleri(G, sayi) {
  return [...(G?.sezonlar ?? [])].sort((a, b) => b.yil - a.yil).map((s) => {
    const elemeIlkHafta = Math.min(...s.maclar.filter((m) => m[5] === 'p').map((m) => m[0]));
    const elemede = new Set(s.maclar.filter((m) => m[5] === 'p' && m[0] === elemeIlkHafta).flatMap((m) => [m[1], m[2]]));
    const satirlar = Object.entries(s.takimlar).map(([mid, t]) => ({
      mid, ad: t.ad, koc: t.koc, bugun: !!sayi.takim[t.koc], bugunAd: sayi.takim[t.koc]?.ad ?? null, kayit: tire(t.kayit), sira: t.sira, eleme: elemede.has(mid), sonuc: sonucYaz(t.sira),
    })).sort((a, b) => a.sira - b.sira);
    const final = s.maclar.find((m) => m[5] === 'p' && m[0] === Math.max(...s.maclar.filter((x) => x[5] === 'p').map((x) => x[0])));
    return { yil: s.yil, etiket: s.etiket, takimSayisi: satirlar.length, satirlar, kursu: satirlar.slice(0, 3), final: final ? { ev: s.takimlar[final[1]], dep: s.takimlar[final[2]], sa: final[3], sb: final[4] } : null };
  });
}

/** İki koçun bütün karşılaşmaları (a'nın gözünden). */
export function ikiKoc(liste, a, b) {
  const maclar = liste.filter((m) => (m.a === a && m.b === b) || (m.a === b && m.b === a)).map((m) => {
    const ters = m.a !== a;
    return { ...m, benA: ters ? m.adB : m.adA, benB: ters ? m.adA : m.adB, ka: ters ? m.sb : m.sa, kb: ters ? m.sa : m.sb };
  }).sort((x, y) => x.sezon - y.sezon || x.hafta - y.hafta);
  const ozet = { g: 0, m: 0, b: 0, ka: 0, kb: 0, kt: 0, eleme: 0 };
  for (const m of maclar) {
    if (m.ka > m.kb) ozet.g++; else if (m.kb > m.ka) ozet.m++; else ozet.b++;
    ozet.ka += m.ka; ozet.kb += m.kb; ozet.kt += KAT - m.ka - m.kb;
    if (m.tur === 'p') ozet.eleme++;
  }
  return { maclar, ...ozet };
}

/** Karşılaştır için bugünkü koç çiftlerinin özeti (sayfaya gömülür). */
export function ciftOzetleri(liste, idler) {
  const sonuc = {};
  for (let i = 0; i < idler.length; i++) for (let j = i + 1; j < idler.length; j++) {
    const r = ikiKoc(liste, idler[i], idler[j]);
    if (!r.maclar.length) continue;
    sonuc[`${idler[i]}-${idler[j]}`] = { g: r.g, m: r.m, b: r.b, ka: r.ka, kb: r.kb, kt: r.kt, eleme: r.eleme,
      maclar: r.maclar.map((m) => [m.etiket, m.hafta, m.ka, m.kb, m.tur, m.benA, m.benB]) };
  }
  return sonuc;
}

/** Bir koçun geçmişi: sezon sezon takım adı, kayıt, sıra; toplamlar. */
export function kocGecmisi(G, liste, koc) {
  const sezonlar = (G?.sezonlar ?? []).map((s) => {
    const t = Object.values(s.takimlar).find((x) => x.koc === koc);
    return t ? { yil: s.yil, etiket: s.etiket, ad: t.ad, kayit: tire(t.kayit), sira: t.sira, sonuc: sonucYaz(t.sira), takimSayisi: Object.keys(s.takimlar).length } : null;
  }).filter(Boolean).reverse();
  const benim = liste.filter((m) => m.a === koc || m.b === koc);
  const es = { g: 0, m: 0, b: 0 };
  for (const m of benim) { const [x, y] = m.a === koc ? [m.sa, m.sb] : [m.sb, m.sa]; if (x > y) es.g++; else if (y > x) es.m++; else es.b++; }
  const enIyi = [...sezonlar].sort((a, b) => a.sira / a.takimSayisi - b.sira / b.takimSayisi || b.yil - a.yil)[0] ?? null;
  const enKotu = [...sezonlar].sort((a, b) => b.sira / b.takimSayisi - a.sira / a.takimSayisi || b.yil - a.yil)[0] ?? null;
  return { sezonlar, eslesme: es, sampiyonluk: sezonlar.filter((s) => s.sira === 1).length, final: sezonlar.filter((s) => s.sira <= 2).length, enIyi, enKotu };
}

/** Tüm zamanlar tablosu ve rekorlar. */
export function tumZamanlar(G, sayi, liste) {
  const kocalar = new Set(liste.flatMap((m) => [m.a, m.b]));
  const satirlar = [...kocalar].map((koc) => {
    const k = kocGecmisi(G, liste, koc);
    const kat = { g: 0, m: 0, b: 0 };
    for (const m of liste) if (m.tur === 'n' && (m.a === koc || m.b === koc)) { const [x, y] = m.a === koc ? [m.sa, m.sb] : [m.sb, m.sa]; kat.g += x; kat.m += y; kat.b += KAT - x - y; }
    const eleme = (G?.sezonlar ?? []).filter((s) => { const t = Object.entries(s.takimlar).find(([, x]) => x.koc === koc); if (!t) return false; const ilk = Math.min(...s.maclar.filter((m) => m[5] === 'p').map((m) => m[0])); return s.maclar.some((m) => m[5] === 'p' && m[0] === ilk && (m[1] === t[0] || m[2] === t[0])); }).length;
    return { koc, ad: kocAdi(G, sayi, koc), bugun: !!sayi.takim[koc], sezon: k.sezonlar.length + (sayi.takim[koc] ? 1 : 0), eslesme: k.eslesme, kategori: kat, sampiyonluk: k.sampiyonluk, final: k.final, eleme, oran: yuzdeSay(k.eslesme), enIyi: k.enIyi, enKotu: k.enKotu };
  }).sort((a, b) => b.sampiyonluk - a.sampiyonluk || b.oran - a.oran);
  // Bugünkü koçlar arasında kazanma oranı sırası
  satirlar.filter((x) => x.bugun).sort((a, b) => b.oran - a.oran).forEach((x, i) => { x.oranSira = i + 1; });

  // Seriler: normal sezonda, sezon içinde art arda kazanılan / kaybedilen eşleşmeler
  const seriler = [];
  const sezonlar = [...new Set(liste.map((m) => m.sezon))];
  for (const sz of sezonlar) {
    const ms = liste.filter((m) => m.sezon === sz && m.tur === 'n').sort((a, b) => a.hafta - b.hafta);
    for (const koc of new Set(ms.flatMap((m) => [m.a, m.b]))) {
      let tur = null, uzun = 0, bas = 0, ad = '';
      const kapat = (son) => { if (tur && uzun >= 2) seriler.push({ koc, ad, sezon: sz, etiket: ms[0].etiket, tur, uzunluk: uzun, bas, son, devam: son === null }); };
      let sonHafta = null;
      for (const m of ms.filter((x) => x.a === koc || x.b === koc)) {
        const [x, y] = m.a === koc ? [m.sa, m.sb] : [m.sb, m.sa];
        const t = x > y ? 'g' : y > x ? 'm' : 'b';
        ad = m.a === koc ? m.adA : m.adB;
        if (t === tur) uzun++; else { kapat(sonHafta); tur = t; uzun = 1; bas = m.hafta; }
        sonHafta = m.hafta;
      }
      kapat(sonHafta);
    }
  }
  const enUzun = (t) => seriler.filter((s) => s.tur === t).sort((a, b) => b.uzunluk - a.uzunluk || a.sezon - b.sezon).slice(0, 3);
  const sezonKayitlari = (G?.sezonlar ?? []).flatMap((s) => Object.values(s.takimlar).map((t) => {
    const [g, m, b] = t.kayit.split('-').map(Number);
    return { koc: t.koc, ad: t.ad, etiket: s.etiket, kayit: tire(t.kayit), oran: (g + b / 2) / (g + m + b) };
  }));
  const dokuzSifir = liste.filter((m) => (m.sa === 9 && m.sb === 0) || (m.sb === 9 && m.sa === 0)).map((m) => (m.sa === 9
    ? { kazanan: m.a, adK: m.adA, kaybeden: m.b, adY: m.adB, etiket: m.etiket, hafta: m.hafta, tur: m.tur }
    : { kazanan: m.b, adK: m.adB, kaybeden: m.a, adY: m.adA, etiket: m.etiket, hafta: m.hafta, tur: m.tur }));
  return {
    satirlar,
    rekorlar: {
      galibiyetSerisi: enUzun('g'),
      yenilgiSerisi: enUzun('m'),
      enIyiSezon: [...sezonKayitlari].sort((a, b) => b.oran - a.oran).slice(0, 3),
      enKotuSezon: [...sezonKayitlari].sort((a, b) => a.oran - b.oran).slice(0, 3),
      dokuzSifir,
    },
    yahoo: G?.yahooRekorlari ?? [],
  };
}

/** Son şampiyonun bugünkü takım kimliği (koç ligde değilse null). */
export function sonSampiyon(G, sayi) {
  const s = [...(G?.sezonlar ?? [])].sort((a, b) => b.yil - a.yil)[0];
  const t = s && Object.values(s.takimlar).find((x) => x.sira === 1);
  return t && sayi.takim[t.koc] ? { id: t.koc, etiket: s.etiket, ad: t.ad } : null;
}

/** Bir sayı için geçmiş: hepsi bir arada (bileşenler kullanır). */
const onbellek = new WeakMap();
export function gecmisHesapla(G, sayi) {
  if (!G) return null;
  if (onbellek.has(sayi)) return onbellek.get(sayi);
  const liste = tumEslesmeler(G, sayi);
  const r = { liste, sezonlar: sezonOzetleri(G, sayi), tum: tumZamanlar(G, sayi, liste), koc: (id) => kocGecmisi(G, liste, id), ad: (k) => kocAdi(G, sayi, k), sampiyon: sonSampiyon(G, sayi) };
  onbellek.set(sayi, r);
  return r;
}
