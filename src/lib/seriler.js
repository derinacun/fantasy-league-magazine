// Seriler ve kemerler (17 Kasım 2026). Her kemerin sahibi, o an devam eden en uzun serinin sahibidir.
// Kurallar:
// - Kemer için seri en az 3 hafta sürmeli; yoksa kemer boştadır.
// - Kemer yalnızca devam eden (aktif) serilere verilir; seri bitince kemer o an en uzun aktif seriye geçer.
// - Eşit uzunlukta aktif seriler (aynı hafta başlayıp aynı süren) kemeri paylaşır.
// - Büyük kemerler: galibiyet, yenilgi, uyku, etkileşim. Kategori kemeri: o kategoride üst üste ilk 3'te kalmak (9 kemer).
// - Büyük kemerin sahipleri değişince ön sayfada "KEMER EL DEĞİŞTİRDİ" şeridi çıkar (beltNews ile metin yazılabilir).
// Beraberlik galibiyet ve yenilgi serisini bitirir. Uyku verisi olmayan hafta (1. hafta) uyku serisini bitirir.
import { t as _t, YEREL } from '../i18n/t.js';
import { KATEGORILER, KATEGORI_ADI } from './hesap.js';

export const KEMER_ESIGI = 3;
export const UYKU_ESIGI = 5; // uyku puanı 5 ve üstü = uyuyan

export const BUYUK_KEMERLER = [
  // simdi: kemer sürerken "4 haftadır kazanıyor"; gecmis: biten seri için "3 hafta üst üste kazandı"
  { anahtar: 'galibiyet', ad: _t('Galibiyet kemeri'), kisa: _t('Galibiyet'), simdi: _t('kazanıyor'), gecmis: _t('üst üste kazandı'), ikon: 'kupa' },
  { anahtar: 'yenilgi', ad: _t('Yenilgi kemeri'), kisa: _t('Yenilgi'), simdi: _t('kaybediyor'), gecmis: _t('üst üste kaybetti'), ikon: 'yagmur' },
  { anahtar: 'uyku', ad: _t('Uyku kemeri'), kisa: _t('Uyku'), simdi: _t('uyuyor'), gecmis: _t('üst üste uyudu'), ikon: 'ay' },
  // Etkileşim (17 Kasım 2026): WhatsApp grubunda haftanın en çok yazan ilk 3'ü (sayı dosyasında chatCounts, koç → takım)
  { anahtar: 'etkilesim', ad: _t('Etkileşim kemeri'), kisa: _t('Etkileşim'), simdi: _t('grupta en çok yazan ilk 3\'te'), gecmis: _t('üst üste grupta en çok yazan ilk 3\'teydi'), ikon: 'kalem' },
];
export const KATEGORI_KEMERLERI = KATEGORILER.map((k) => ({
  anahtar: `kategori-${k}`, kategori: k, ad: _t('{0} kemeri', [KATEGORI_ADI[k] ?? k]), kisa: k, simdi: _t('{0} ilk 3\'te', [k]), gecmis: _t('üst üste {0} ilk 3\'teydi', [k]), ikon: 'hedef',
}));
export const KEMERLER = [...BUYUK_KEMERLER.map((k) => ({ ...k, tur: 'buyuk' })), ...KATEGORI_KEMERLERI.map((k) => ({ ...k, tur: 'kategori' }))];

/** Bir haftada takımın kemer koşulunu sağlayıp sağlamadığı: true / false / null (veri yok). */
function kosul(kemer, sayi, id) {
  if (kemer.anahtar === 'galibiyet' || kemer.anahtar === 'yenilgi') {
    const m = sayi.eslesmeler.find((e) => e.ev === id || e.dep === id);
    if (!m || m.durum !== 'final') return null;
    if (m.kazanan == null) return false;
    return kemer.anahtar === 'galibiyet' ? m.kazanan === id : m.kazanan !== id;
  }
  if (kemer.anahtar === 'etkilesim') {
    const sayac = sayi.sohbet;
    if (!sayac) return null;
    const n = sayac[id];
    if (n == null) return false;
    // Sıra: kendisinden çok yazan takım sayısı + 1 (eşitler aynı sırayı paylaşır)
    return 1 + Object.values(sayac).filter((x) => x > n).length <= 3;
  }
  if (kemer.anahtar === 'uyku') {
    const r = sayi.uyuyan?.satirlar?.find((x) => x.takimId === id);
    return r ? r.uyku >= UYKU_ESIGI : null;
  }
  const s = sayi.kapsam.hafta.sira[id]?.[kemer.kategori];
  return s == null ? null : s <= 3;
}

const kume = (dizi) => [...dizi].sort().join(',');
/** "4 haftadır kazanıyor" (sürüyor) ya da "3 hafta üst üste kazandı" (bitti) */
export const sureYaz = (kemer, n, suruyor = true) => (suruyor ? _t('{0} haftadır {1}', [n, kemer.simdi]) : _t('{0} hafta {1}', [n, kemer.gecmis]));

/**
 * @param sayilar  bu sayıya kadar (dahil) bütün sayı modelleri, hafta sırasıyla
 * @returns { kemerler, takim } — kemerler: her kemerin bu haftaki durumu; takim: id → { kemerler, seriler }
 */
export function serilerHesapla(sayilar) {
  const sirali = [...sayilar].sort((a, b) => a.hafta - b.hafta);
  const son = sirali.at(-1);
  const ids = son.takimlar.map((t) => t.id);

  const kemerler = KEMERLER.map((kemer) => {
    const uzunluk = Object.fromEntries(ids.map((id) => [id, 0]));
    const baslangic = Object.fromEntries(ids.map((id) => [id, null]));
    const gecmis = [];
    let oncekiUzunluk = { ...uzunluk };
    for (const s of sirali) {
      oncekiUzunluk = { ...uzunluk };
      for (const id of ids) {
        if (kosul(kemer, s, id)) { uzunluk[id] += 1; if (uzunluk[id] === 1) baslangic[id] = s.hafta; }
        else { uzunluk[id] = 0; baslangic[id] = null; }
      }
      const enUzun = Math.max(0, ...ids.map((id) => uzunluk[id]));
      const sahipler = enUzun >= KEMER_ESIGI ? ids.filter((id) => uzunluk[id] === enUzun) : [];
      gecmis.push({ hafta: s.hafta, sahipler, uzunluk: sahipler.length ? enUzun : 0, oncekiUzunluk });
    }
    const simdi = gecmis.at(-1);
    const once = gecmis.at(-2) ?? { sahipler: [] };
    let degisim = null;
    if (kume(simdi.sahipler) !== kume(once.sahipler)) {
      const yeni = simdi.sahipler.filter((id) => !once.sahipler.includes(id));
      const dusen = once.sahipler.filter((id) => !simdi.sahipler.includes(id)).map((id) => ({ id, uzunluk: simdi.oncekiUzunluk[id] }));
      const kalan = simdi.sahipler.filter((id) => once.sahipler.includes(id));
      const tur = !once.sahipler.length ? 'ilk' : !simdi.sahipler.length ? 'bosa' : !yeni.length ? 'ortak-dustu' : 'gecti';
      degisim = { tur, yeni, dusen, kalan };
    }
    const aktif = ids.filter((id) => uzunluk[id] > 0)
      .map((id) => ({ id, uzunluk: uzunluk[id], baslangic: baslangic[id] }))
      .sort((a, b) => b.uzunluk - a.uzunluk || a.baslangic - b.baslangic);
    // Kemerin sezon boyunca kimlerden geçtiği: ardışık aynı sahipler tek dönem sayılır.
    const donemler = [];
    for (const g of gecmis) {
      const sonD = donemler.at(-1);
      if (sonD && kume(sonD.sahipler) === kume(g.sahipler)) { sonD.bitis = g.hafta; sonD.uzunluk = g.uzunluk; }
      else donemler.push({ sahipler: g.sahipler, baslangic: g.hafta, bitis: g.hafta, uzunluk: g.uzunluk });
    }
    const rekor = gecmis.reduce((r, g) => (g.uzunluk > r.uzunluk ? { uzunluk: g.uzunluk, sahipler: g.sahipler, hafta: g.hafta } : r), { uzunluk: 0, sahipler: [], hafta: null });
    // Kemer boştaysa en son sahibi (serisi bitmiş): sahip kısmı boş kalır, altında "en son sahibi" yazar.
    const sonDonem = [...donemler].reverse().find((d) => d.sahipler.length);
    const sonSahip = !simdi.sahipler.length && sonDonem
      ? { sahipler: sonDonem.sahipler, uzunluk: sonDonem.uzunluk, baslangic: sonDonem.bitis - sonDonem.uzunluk + 1, bitis: sonDonem.bitis }
      : null;
    // Takım takım kemeri taşıdığı kesintisiz haftalar (ortak sahiplik değişse de aynı takım için tek dönem)
    const takimDonemleri = {};
    for (const g of gecmis) for (const id of g.sahipler) {
      const liste = (takimDonemleri[id] ??= []);
      const sonT = liste.at(-1);
      if (sonT && sonT.bitis === g.hafta - 1) sonT.bitis = g.hafta; else liste.push({ baslangic: g.hafta, bitis: g.hafta });
    }
    return {
      ...kemer,
      takimDonemleri,
      sonSahip,
      sahipler: simdi.sahipler.map((id) => ({ id, uzunluk: uzunluk[id], baslangic: baslangic[id] })),
      aktif,
      degisim,
      donemler: donemler.filter((d) => d.sahipler.length),
      rekor,
    };
  });

  const takim = Object.fromEntries(ids.map((id) => [id, {
    kemerler: kemerler.filter((k) => k.sahipler.some((s) => s.id === id)).map((k) => k.anahtar),
    seriler: Object.fromEntries(kemerler.map((k) => [k.anahtar, k.aktif.find((a) => a.id === id)?.uzunluk ?? 0])),
  }]));
  return { kemerler, takim };
}

/** Büyük kemerlerin el değişimi için hazır şerit metni (Claude beltNews yazmazsa kullanılır). Takım adlarına ek getirilmez. */
export function kemerSeridiHazir(seri, ad) {
  const degisenler = seri.kemerler.filter((k) => k.tur === 'buyuk' && k.degisim);
  if (!degisenler.length) return null;
  const adlar = (liste) => liste.map((x) => ad(typeof x === 'string' ? x : x.id)).join(_t(' ve '));
  const cumle = (k) => {
    const d = k.degisim;
    const n = k.sahipler[0]?.uzunluk;
    const biten = d.dusen.map((x) => _t('{0} ({1} hafta)', [ad(x.id), x.uzunluk])).join(', ');
    if (d.tur === 'ilk') return _t('{0} sahibini buldu: {1}, {2}.', [k.ad, adlar(d.yeni), sureYaz(k, n)]);
    if (d.tur === 'bosa') return _t('{0} boşa düştü. Serisi biten: {1}. {2} haftalık aktif serisi olan kimse yok.', [k.ad, biten, KEMER_ESIGI]);
    if (d.tur === 'ortak-dustu') return _t('{0} artık yalnızca {1} elinde: {2}. Serisi biten: {3}.', [k.ad, adlar(d.kalan), sureYaz(k, n), biten]);
    return _t('{0} el değiştirdi. Yeni sahibi: {1}, {2}. Serisi biten: {3}.', [k.ad, adlar(d.yeni), sureYaz(k, n), biten]);
  };
  const baslik = degisenler.length === 1
    ? `${degisenler[0].ad}: ${degisenler[0].sahipler.length ? adlar(degisenler[0].sahipler) : _t('boşta')}`
    : _t('Kemerler el değiştirdi: {0}', [degisenler.map((k) => k.kisa.toLocaleLowerCase(YEREL)).join(', ')]);
  const takimlar = [...new Set(degisenler.flatMap((k) => [...k.degisim.yeni, ...k.degisim.kalan, ...k.degisim.dusen.map((x) => x.id)]))];
  return { baslik, metin: degisenler.map(cumle).join(' '), takimlar, kemerler: degisenler.map((k) => ({ anahtar: k.anahtar, ad: k.ad })) };
}

/** Kürsü'deki kemer kartının sayfa içi adresi (#kemer-galibiyet, #kemer-kategori-fg-yuzde) */
export const kemerCapa = (anahtar) => `kemer-${anahtar.toLocaleLowerCase('tr').replace(/%/g, '-yuzde').replace(/[^a-z0-9-]/g, '')}`;
