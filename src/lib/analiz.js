// Analiz sayfasının hesapları. Hepsi derleme sırasında, veri dosyasındaki ham haftalık istatistiklerden üretilir.
// Formüllerin açıklaması Metodoloji sayfasında.
import { t as _t } from '../i18n/t.js';
import { KATEGORILER, KATEGORI_ADI, takimIstatistik, karsilastir, kapsamHesapla, yuzdeMi } from './hesap.js';

// Kategoriler dışında grafikte seçilebilen hacim ölçüleri (isabet/deneme alanlarından).
const HACIM = {
  FGM: ['FGM/A', 0], FGA: ['FGM/A', 1],
  FTM: ['FTM/A', 0], FTA: ['FTM/A', 1],
  '3PTM': ['3PTM/A', 0], '3PTA': ['3PTM/A', 1],
};

// Grafik ölçüleri: k = anahtar, ad = Türkçe ad, yuzde = yüzde mi, azIyi = düşük değer iyi mi
export const OLCULER = [
  ...KATEGORILER.map((k) => ({ k, ad: KATEGORI_ADI[k], yuzde: yuzdeMi(k), azIyi: k === 'TO' })),
  { k: 'FGA', ad: _t('Saha içi deneme'), yuzde: false, azIyi: false },
  { k: 'FGM', ad: _t('Saha içi isabet sayısı'), yuzde: false, azIyi: false },
  { k: '3PTA', ad: _t('Üçlük denemesi'), yuzde: false, azIyi: false },
  { k: '3PTM', ad: _t('İsabetli üçlük'), yuzde: false, azIyi: false },
  { k: 'FTA', ad: _t('Serbest atış denemesi'), yuzde: false, azIyi: false },
  { k: 'GUC', ad: _t('Güç puanı'), yuzde: false, azIyi: false },
  { k: 'HK', ad: _t('Herkese karşı galibiyet'), yuzde: false, azIyi: false },
];

const satirlar = (haftalar, id) => haftalar.flatMap((h) => h.matchups.flatMap((m) => [m.home, m.away])).filter((t) => t.id === id);

/** İsabet ve deneme toplamları (eksik veri varsa null). */
export function hacim(haftalar, id) {
  const s = satirlar(haftalar, id);
  const sonuc = {};
  for (const [k, [alan, i]] of Object.entries(HACIM)) {
    const parca = s.map((t) => String(t.stats[alan] ?? '').split('/').map(Number)[i]);
    sonuc[k] = s.length && parca.every(Number.isFinite) ? parca.reduce((a, v) => a + v, 0) : null;
  }
  return sonuc;
}

const ortalama = (d) => d.reduce((a, v) => a + v, 0) / d.length;
const sapma = (d) => { const o = ortalama(d); return Math.sqrt(ortalama(d.map((v) => (v - o) ** 2))); };
const yarim = (r) => r.wins + r.ties / 2;

/** Bir kapsam için: kategori dağılımları ve takımların standart puanları (TO'da işaret ters: yüksek = iyi). */
export function dagilimHesapla(takimlar, k) {
  const kategoriler = KATEGORILER.map((kat) => {
    const degerler = takimlar.map((t) => ({ id: t.id, v: k.ist[t.id][kat] })).filter((x) => x.v != null);
    const d = degerler.map((x) => x.v);
    const o = d.length ? ortalama(d) : null;
    const s = d.length ? sapma(d) : null;
    const sirali = [...degerler].sort((a, b) => (kat === 'TO' ? a.v - b.v : b.v - a.v));
    return { kat, ad: KATEGORI_ADI[kat], degerler, ortalama: o, sapma: s, min: Math.min(...d), max: Math.max(...d), en: sirali[0], son: sirali.at(-1) };
  });
  const standart = Object.fromEntries(takimlar.map((t) => {
    const puanlar = Object.fromEntries(kategoriler.map((c) => {
      const v = k.ist[t.id][c.kat];
      if (v == null || !c.sapma) return [c.kat, null];
      return [c.kat, ((v - c.ortalama) / c.sapma) * (c.kat === 'TO' ? -1 : 1)];
    }));
    const toplam = Object.values(puanlar).reduce((a, v) => a + (v ?? 0), 0);
    return [t.id, { puanlar, toplam }];
  }));
  return { kategoriler, standart };
}

/** Herkese karşı matrisi: satırdaki takımın sütundaki takıma karşı kategori sonucu. */
function matrisHesapla(takimlar, k) {
  const sira = k.gucSirasi;
  const hucre = {};
  for (const a of sira) {
    hucre[a] = {};
    for (const b of sira) if (a !== b) hucre[a][b] = karsilastir(k.ist[a], k.ist[b]);
  }
  return { sira, hucre };
}

/** Grafik için takım başına ölçü değerleri. */
function noktaHesapla(takimlar, k, haftalar) {
  return Object.fromEntries(takimlar.map((t) => {
    const h = hacim(haftalar, t.id);
    return [t.id, { ...Object.fromEntries(KATEGORILER.map((c) => [c, k.ist[t.id][c]])), ...h, GUC: k.guc[t.id], HK: yarim(k.herkeseKarsi[t.id]) }];
  }));
}

/** Analiz sayfasının bütün verisi (aynı sayı için bir kez hesaplanır). */
const onbellek = new WeakMap();
export function analizHesapla(sayi) {
  if (!onbellek.has(sayi)) onbellek.set(sayi, analizYap(sayi));
  return onbellek.get(sayi);
}

function analizYap(sayi) {
  const takimlar = sayi.hesapTakimlari;
  const haftalar = sayi.haftalarHam;
  const buHafta = haftalar.find((w) => w.week === sayi.hafta) || haftalar.at(-1);
  const n = takimlar.length;

  // --- Hafta hafta: güç, herkese karşı, gerçek sonuç ---
  const haftalik = haftalar.map((w) => {
    const k = kapsamHesapla(takimlar, [w]);
    const takim = {};
    for (const t of takimlar) {
      const m = w.matchups.find((x) => x.home.id === t.id || x.away.id === t.id);
      const ben = m ? (m.home.id === t.id ? m.home : m.away) : null;
      const rakip = m ? (m.home.id === t.id ? m.away : m.home) : null;
      // Beklenen kategori: 13 rakibin her birine karşı alınacak kategori sayısının ortalaması (beraberlik yarım).
      const beklenen = takimlar.filter((o) => o.id !== t.id).reduce((a, o) => a + yarim(karsilastir(k.ist[t.id], k.ist[o.id])), 0) / (n - 1);
      const gercek = ben ? yarim(ben.score) : null;
      const sonuc = ben ? (ben.score.wins > ben.score.losses ? 'G' : ben.score.wins < ben.score.losses ? 'M' : 'B') : null;
      takim[t.id] = {
        guc: k.guc[t.id],
        sira: k.gucSirasi.indexOf(t.id) + 1,
        hk: k.herkeseKarsi[t.id],
        beklenen,
        gercek,
        sonuc,
        skor: ben ? `${ben.score.wins}–${ben.score.losses}${ben.score.ties ? '–' + ben.score.ties : ''}` : null,
        rakip: rakip?.id ?? null,
      };
    }
    return { hafta: w.week, donem: w.period, takim };
  });

  // --- Şans endeksi (sezon) ---
  const sans = takimlar.map((t) => {
    const satir = haftalik.map((h) => h.takim[t.id]).filter((x) => x.gercek != null);
    const gercek = satir.reduce((a, x) => a + x.gercek, 0);
    const beklenen = satir.reduce((a, x) => a + x.beklenen, 0);
    const mac = satir.reduce((a, x) => ({ G: a.G + (x.sonuc === 'G'), M: a.M + (x.sonuc === 'M'), B: a.B + (x.sonuc === 'B') }), { G: 0, M: 0, B: 0 });
    const beklenenMac = satir.reduce((a, x) => a + yarim(x.hk) / (n - 1), 0);
    // Fikstür zorluğu: rakiplerin o haftaki herkese karşı galibiyet oranı ortalaması
    const rakipGucu = satir.length
      ? satir.reduce((a, x) => a + (x.rakip ? yarim(haftalik.find((h) => h.takim[t.id] === x).takim[x.rakip].hk) / (n - 1) : 0), 0) / satir.length
      : null;
    return { id: t.id, gercek, beklenen, fark: gercek - beklenen, mac, beklenenMac, rakipGucu };
  }).sort((a, b) => b.fark - a.fark);
  const sansSiniri = Math.max(1, ...sans.map((s) => Math.abs(s.fark)));

  // --- Kıl payı: bu haftanın gerçek eşleşmelerinde en yakın biten kategoriler ---
  const haftaDag = dagilimHesapla(takimlar, sayi.kapsam.hafta);
  const sapmaK = Object.fromEntries(haftaDag.kategoriler.map((c) => [c.kat, c.sapma]));
  const kilPayi = buHafta.matchups.flatMap((m) => KATEGORILER.map((kat) => {
    const a = takimIstatistik([{ matchups: [m] }], m.home.id)[kat];
    const b = takimIstatistik([{ matchups: [m] }], m.away.id)[kat];
    if (a == null || b == null) return null;
    const fark = (a - b) * (kat === 'TO' ? -1 : 1);
    const kazanan = fark > 1e-9 ? m.home.id : fark < -1e-9 ? m.away.id : null;
    return { kat, ev: m.home.id, dep: m.away.id, a, b, kazanan, yakinlik: sapmaK[kat] ? Math.abs(a - b) / sapmaK[kat] : 0 };
  })).filter(Boolean).sort((x, y) => x.yakinlik - y.yakinlik);
  const tekFarkla = buHafta.matchups.filter((m) => Math.abs(m.home.score.wins - m.away.score.wins) === 1).length;

  // --- Sezon rekorları (takım-hafta) ---
  const takimHafta = haftalar.flatMap((w) => takimlar.map((t) => ({ hafta: w.week, id: t.id, ist: takimIstatistik([w], t.id) })));
  const rekorlar = KATEGORILER.map((kat) => {
    const d = takimHafta.filter((x) => x.ist[kat] != null);
    const sirali = [...d].sort((a, b) => (kat === 'TO' ? a.ist[kat] - b.ist[kat] : b.ist[kat] - a.ist[kat]));
    const en = sirali[0], son = sirali.at(-1);
    return { kat, ad: KATEGORI_ADI[kat], en: en && { id: en.id, hafta: en.hafta, v: en.ist[kat] }, son: son && { id: son.id, hafta: son.hafta, v: son.ist[kat] } };
  });
  const enBuyukFark = haftalar.flatMap((w) => w.matchups.map((m) => {
    const fark = m.home.score.wins - m.away.score.wins;
    const [k, y] = fark >= 0 ? [m.home, m.away] : [m.away, m.home];
    return { hafta: w.week, kazanan: k.id, kaybeden: y.id, skor: `${k.score.wins}–${y.score.wins}${k.score.ties ? '–' + k.score.ties : ''}`, fark: Math.abs(fark) };
  })).sort((a, b) => b.fark - a.fark)[0];
  const enIyiHk = haftalik.flatMap((h) => takimlar.map((t) => ({ hafta: h.hafta, id: t.id, hk: h.takim[t.id].hk }))).sort((a, b) => yarim(b.hk) - yarim(a.hk))[0];

  const kapsamlar = Object.fromEntries(['hafta', 'sezon'].map((ad) => {
    const k = sayi.kapsam[ad];
    const kapsamHaftalari = ad === 'hafta' ? [buHafta] : haftalar;
    return [ad, { dagilim: ad === 'hafta' ? haftaDag : dagilimHesapla(takimlar, k), matris: matrisHesapla(takimlar, k), nokta: noktaHesapla(takimlar, k, kapsamHaftalari) }];
  }));

  return { haftalik, sans, sansSiniri, kilPayi, tekFarkla, rekorlar, enBuyukFark, enIyiHk, kapsamlar };
}

/** Bütün takım-haftalar (ham veri indirme için). */
export function tumSatirlar(sayi) {
  const takimlar = sayi.hesapTakimlari;
  return sayi.haftalarHam.flatMap((w) => {
    const k = kapsamHesapla(takimlar, [w]);
    return w.matchups.flatMap((m) => [[m.home, m.away], [m.away, m.home]]).map(([ben, rakip]) => {
      const ist = takimIstatistik([w], ben.id);
      const h = hacim([w], ben.id);
      return {
        hafta: w.week, takim: ben.id, rakip: rakip.id,
        sonuc: ben.score.wins > ben.score.losses ? _t('Kazandı') : ben.score.wins < ben.score.losses ? _t('Kaybetti') : _t('Berabere'),
        skor: `${ben.score.wins}-${ben.score.losses}-${ben.score.ties}`,
        ist, h, guc: k.guc[ben.id], hk: k.herkeseKarsi[ben.id],
      };
    });
  });
}
