// Paylaşım kapağı (1200×630) ve site simgeleri derleme sırasında PNG olarak üretilir.
import { t as _t, yol } from '../i18n/t.js';
import { gecmisOku } from './okuma.js';
import fs from 'node:fs';
import path from 'node:path';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { madalyaSvg, kemerSvg } from './simgeler.js';
import { ODUL_TANIMLARI } from './oduller.js';

const FS = path.join(process.cwd(), 'node_modules', '@fontsource');
// Türkçe harfler latin-ext alt kümesinde; "Inter Ext" ailesi olarak yedek kaydedilir.
const yaziTipi = (aile, dosya, ad, kalinlik) =>
  ['latin', 'latin-ext'].map((alt) => ({
    name: alt === 'latin' ? ad : `${ad} Ext`,
    weight: kalinlik,
    style: 'normal',
    data: fs.readFileSync(path.join(FS, aile, 'files', `${dosya}-${alt}-${kalinlik}-normal.woff`)),
  }));

let yaziTipleri = null;
function tipler() {
  if (!yaziTipleri) {
    yaziTipleri = [500, 600, 700, 800].flatMap((k) => yaziTipi('inter', 'inter', 'Inter', k));
  }
  return yaziTipleri;
}

const AILE = _t('Inter, Inter Ext');
const RENK = { zemin: '#f5f5f7', yuzey: '#ffffff', murekkep: '#1d1d1f', soluk: '#6e6e73', turuncu: '#e65c00', etiket: '#b64400' };
const h = (type, style, children) => ({ type, props: { style: { display: 'flex', ...style }, children } });

// "gazete adı" → gövde siyah, ünlem turuncu
function markaYazisi(ad, boyut, ek = {}) {
  const unlemli = ad.endsWith('!');
  const govde = unlemli ? ad.slice(0, -1) : ad;
  return h('div', { fontFamily: AILE, fontWeight: 800, fontSize: boyut, letterSpacing: -boyut * 0.05, lineHeight: 1, color: RENK.murekkep, ...ek }, [
    h('span', {}, govde),
    ...(unlemli ? [h('span', { color: RENK.turuncu, marginLeft: boyut * 0.02 }, '!')] : []),
  ]);
}

export async function kapakPng(sayi) {
  const { ayarlar } = sayi;
  const gazete = ayarlar.gazeteAdi ?? ayarlar.ligAdi;
  const acilim = (ayarlar.gazeteAcilimi ?? []).join(' · ');
  const k = sayi.kapsam.hafta;
  const lider = temiz(sayi.takim[sayi.gucLideri].ad);
  const skorLider = temiz(sayi.takim[sayi.skorLideri].ad);
  const foto = sayi.mansetFoto;
  const uzunluk = sayi.baslik.length;
  const baslikBoyu = foto
    ? (uzunluk > 56 ? 44 : uzunluk > 40 ? 50 : uzunluk > 24 ? 58 : 70)
    : (uzunluk > 56 ? 54 : uzunluk > 40 ? 62 : uzunluk > 28 ? 72 : 84);
  const spotSiniri = foto ? (uzunluk > 40 ? 96 : 140) : (uzunluk > 40 ? 130 : 170);
  const spot = sayi.spot.length > spotSiniri ? sayi.spot.slice(0, spotSiniri - 1).replace(/\s+\S*$/, '') + '…' : sayi.spot;

  const metinler = h('div', { flexDirection: 'column', flexGrow: 1, flexBasis: 0, justifyContent: 'center' }, [
    h('div', { fontSize: 22, fontWeight: 600, color: RENK.etiket }, _t('Haftanın raporu · {0}', [sayi.donem])),
    h('div', { marginTop: 12, fontWeight: 800, fontSize: baslikBoyu, lineHeight: 1.06, letterSpacing: -baslikBoyu * 0.035, color: RENK.murekkep }, sayi.baslik),
    h('div', { marginTop: 18, fontSize: 25, fontWeight: 500, lineHeight: 1.38, color: RENK.soluk, maxHeight: 104, overflow: 'hidden' }, spot),
  ]);
  const govde = foto
    ? h('div', { flexGrow: 1, gap: 40, alignItems: 'center' }, [
        metinler,
        h('div', { width: 360, height: 330, borderRadius: 28, background: '#1d1d1f', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', boxShadow: _t('0 20px 40px rgba(0,0,0,.18)') }, [
          { type: 'img', props: { src: `data:image/jpeg;base64,${fs.readFileSync(foto.yol).toString('base64')}`, width: 360, height: 330, style: { objectFit: 'contain', width: 360, height: 330 } } },
        ]),
      ])
    : h('div', { flexGrow: 1 }, [metinler]);

  const agac = h('div', { width: 1200, height: 630, flexDirection: 'column', background: RENK.zemin, color: RENK.murekkep, fontFamily: AILE }, [
    h('div', { flexDirection: 'column', padding: '40px 64px 34px 64px', flexGrow: 1 }, [
      h('div', { justifyContent: 'space-between', alignItems: 'flex-start' }, [
        h('div', { flexDirection: 'column' }, [
          markaYazisi(gazete, 76),
          ...(acilim ? [h('div', { marginTop: 8, fontSize: 19, fontWeight: 600, color: RENK.soluk, letterSpacing: 0.3, gap: 10, alignItems: 'baseline' },
            (ayarlar.gazeteAcilimi ?? []).map((k) => h('span', {}, [h('span', { color: RENK.turuncu, fontWeight: 800, fontSize: 23 }, k.slice(0, 1)), h('span', {}, k.slice(1))])))] : []),
        ]),
        h('div', { marginTop: 6, padding: '10px 22px', borderRadius: 999, background: RENK.yuzey, fontSize: 22, fontWeight: 700, color: RENK.murekkep }, _t('Sayı {0}', [sayi.no])),
      ]),
      h('div', { marginTop: 22, flexGrow: 1 }, [govde]),
    ]),
    h('div', { background: RENK.yuzey, padding: '24px 64px', justifyContent: 'space-between', fontSize: 23, fontWeight: 500, color: RENK.murekkep, borderTop: _t('1px solid #e8e8ed') }, [
      h('span', {}, [h('span', { color: RENK.soluk, marginRight: 10 }, _t('Güç lideri')), h('span', { fontWeight: 700 }, `${lider} · ${k.guc[sayi.gucLideri]}/${k.maxGuc}`)]),
      h('span', {}, [h('span', { color: RENK.soluk, marginRight: 10 }, _t('Skor lideri')), h('span', { fontWeight: 700 }, `${skorLider} · ${k.ist[sayi.skorLideri].PTS}`)]),
    ]),
  ]);
  const svg = await satori(agac, { width: 1200, height: 630, fonts: tipler() });
  return new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } }).render().asPng();
}

// gazete adı simgesi (sekme, ana ekran, uygulama): koyu zemin, beyaz "E", yanında turuncu ünlem.
// Yazı tipine bağlı değil: 32 piksellik ızgaraya oturan çizimler; 16 ve 32 pikselde de keskin.
//   kose: true  → yuvarlatılmış kare (tarayıcı sekmesi). false → tam kare (iPhone ve Android köşeyi kendisi keser).
//   olcek       → çizimin büyüklüğü; Android'in daire maskesi için 0.78 (içerik güvenli alanda kalır).
export const SIMGE_RENK = { zemin: '#1d1d1f', harf: '#ffffff', unlem: '#ff7a1a' };
export function simgeSvg({ kose = true, olcek = 1 } = {}) {
  const { zemin, harf, unlem } = SIMGE_RENK;
  const cizim = [
    `<path fill="${harf}" d="M7 7h11v4h-7v3h6v4h-6v3h7v4H7z"/>`,
    `<path fill="${unlem}" d="M20.7 7h4.6l-.7 11.4h-3.2z"/>`,
    `<circle fill="${unlem}" cx="23" cy="22.9" r="2.15"/>`,
  ].join('');
  const icerik = olcek === 1 ? cizim : `<g transform="translate(16 16) scale(${olcek}) translate(-16 -16)">${cizim}</g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32"${kose ? ' rx="7"' : ''} fill="${zemin}"/>${icerik}</svg>`;
}
export async function simgePng(boyut, secenek = {}) {
  return new Resvg(simgeSvg(secenek), { fitTo: { mode: 'width', value: boyut } }).render().asPng();
}
// favicon.ico: içinde 16 ve 32 piksellik PNG olan klasik simge dosyası (adresi doğrudan isteyen tarayıcılar için).
export async function simgeIco() {
  const resimler = [];
  for (const b of [16, 32]) resimler.push({ b, veri: Buffer.from(await simgePng(b)) });
  const baslik = Buffer.alloc(6);
  baslik.writeUInt16LE(0, 0); baslik.writeUInt16LE(1, 2); baslik.writeUInt16LE(resimler.length, 4);
  let konum = 6 + 16 * resimler.length;
  const girisler = resimler.map(({ b, veri }) => {
    const g = Buffer.alloc(16);
    g.writeUInt8(b, 0); g.writeUInt8(b, 1); g.writeUInt16LE(1, 4); g.writeUInt16LE(32, 6);
    g.writeUInt32LE(veri.length, 8); g.writeUInt32LE(konum, 12);
    konum += veri.length;
    return g;
  });
  return Buffer.concat([baslik, ...girisler, ...resimler.map((r) => r.veri)]);
}

// ---- Sayfa paylaşım görselleri (17 Kasım 2026): her sayfa kendi görseliyle paylaşılır.
// Ön sayfa yukarıdaki kapakPng'yi kullanır; diğer sayfalar sayfa adı + o haftanın bir rakamı, takım sayfası takımın haftası.
// Adresler: /kapak/hafta-NN-<bolum>.png, /kapak/hafta-NN-takim-<slug>.png
const SAYFA_KAPAKLARI = ['istatistikler', 'analiz', 'karsilastir', 'takimlar', 'oyuncular', 'takas', 'kursu', 'kehanet', 'kupa', 'metodoloji', 'arsiv'];
export const sayfaKapakleri = () => SAYFA_KAPAKLARI;
export const sayfaKapakAdresi = (sayi, bolum, takim = null) =>
  bolum === 'onsayfa' || (!takim && !SAYFA_KAPAKLARI.includes(bolum))
    ? sayi.kapak
    : yol(`/kapak/hafta-${sayi.no}-${takim ? `takim-${takim.slug}` : bolum}.png`);

// Yazı tipinde olmayan işaretler (emoji, ☘️ gibi) görselde kutu olarak çıkar: görselden çıkarılır.
const temiz = (m) => String(m ?? '').replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, '').replace(/[ \t]{2,}/g, ' ').trim();

const kayit = (r) => r ? `${r.wins}–${r.losses}${r.ties ? `–${r.ties}` : ''}` : '';

/** Sayfanın paylaşım görselinde yazacaklar: { etiket, baslik, alt, foto } */
export function sayfaKapakBilgisi(sayi, bolum, takim = null, { sayiAdedi = null } = {}) {
  const k = sayi.kapsam.hafta;
  const ad = (id) => sayi.takim[id]?.ad ?? id;
  if (takim) {
    const id = takim.id;
    const m = sayi.eslesmeler.find((e) => e.ev === id || e.dep === id);
    let sonuc = '';
    if (m) {
      const ben = m.ev === id ? m.evSkor : m.depSkor, o = m.ev === id ? m.depSkor : m.evSkor;
      const durum = m.kazanan == null ? (m.durum === 'final' ? _t('Berabere') : _t('Sürüyor')) : m.kazanan === id ? _t('Kazandı') : _t('Kaybetti');
      sonuc = _t('{0} {1}–{2}{3} · rakip {4}', [durum, ben, o, m.beraber ? `–${m.beraber}` : '', ad(m.ev === id ? m.dep : m.ev)]);
    }
    const pd = sayi.puanDurumu?.[id];
    return {
      etiket: _t('{0}. hafta · {1}', [sayi.hafta, sayi.donem]),
      baslik: takim.ad,
      alt: [sonuc, pd ? _t('Yahoo #{0} ({1}) · Güç {2}/{3}', [pd.rank, kayit(pd), k.guc[id], k.maxGuc]) : _t('Güç {0}/{1}', [k.guc[id], k.maxGuc])].filter(Boolean).join('\n'),
      foto: takim.foto ?? takim.avatar ?? null,
    };
  }
  const lider = sayi.gucLideri;
  const ho = sayi.haftaninOyunculari?.oyuncusu;
  const enYakin = [...sayi.eslesmeler].filter((e) => e.durum === 'final').sort((a, b) => Math.abs(a.evSkor - a.depSkor) - Math.abs(b.evSkor - b.depSkor))[0];
  const yahooLider = Object.values(sayi.puanDurumu ?? {}).sort((a, b) => a.rank - b.rank)[0];
  const masa = sayi.takaslar?.[0];
  switch (bolum) {
    case 'istatistikler':
      return { etiket: _t('İstatistikler'), baslik: _t('Güç lideri: {0}', [ad(lider)]), alt: `${k.guc[lider]}/${k.maxGuc} güç puanı · herkese karşı ${k.herkeseKarsi?.[lider] ? kayit(k.herkeseKarsi[lider]) : ''}`.replace(/ · herkese karşı $/, ''), foto: sayi.takim[lider]?.avatar };
    case 'analiz':
      return { etiket: _t('Analiz'), baslik: _t('Skor lideri: {0}', [ad(sayi.skorLideri)]), alt: _t('{0} sayı · ısı haritası, herkese karşı, haftalık seyir, rekorlar', [k.ist[sayi.skorLideri].PTS]), foto: sayi.takim[sayi.skorLideri]?.avatar };
    case 'karsilastir':
      return enYakin
        ? { etiket: _t('Karşılaştır'), baslik: _t('Haftanın en yakın maçı: {0} {1}–{2} {3}', [ad(enYakin.ev), enYakin.evSkor, enYakin.depSkor, ad(enYakin.dep)]), alt: _t('İki takımı 9 kategoride yan yana koy: son hafta veya sezon toplamı.'), foto: null }
        : { etiket: _t('Karşılaştır'), baslik: _t('İki takım, dokuz kategori'), alt: _t('Son hafta veya sezon toplamı.'), foto: null };
    case 'takimlar':
      return yahooLider
        ? { etiket: _t('Takımlar'), baslik: _t('Yahoo lideri: {0}', [ad(yahooLider.id)]), alt: _t('{0} · {1} takımın güç sırası, güçlü kategorileri ve kadroları', [kayit(yahooLider), sayi.takimlar.length]), foto: sayi.takim[yahooLider.id]?.avatar }
        : { etiket: _t('Takımlar'), baslik: _t('{0} takım', [sayi.takimlar.length]), alt: _t('Güç sırası, güçlü kategoriler ve kadrolar'), foto: null };
    case 'oyuncular':
      return ho
        ? { etiket: _t('Oyuncular · haftanın oyuncusu'), baslik: ho.name, alt: _t('{0} · {1} maç · {2} sayı, {3} ribaund, {4} blok', [ad(ho.takimId), ho.games, ho.ist?.PTS ?? '', ho.ist?.REB ?? '', ho.ist?.BLK ?? '']), foto: sayi.takim[ho.takimId]?.avatar }
        : { etiket: _t('Oyuncular'), baslik: _t('Haftanın oyuncu notları'), alt: sayi.oyuncuNotlari.map((n) => n.name).slice(0, 4).join(', '), foto: null };
    case 'takas':
      return masa
        ? { etiket: _t('Takas Masaları'), baslik: _t('{0} ile {1}', [masa.giveA, masa.giveB]), alt: _t('Masa 1: {0} – {1} · bu hafta {2} masa', [ad(masa.a), ad(masa.b), sayi.takaslar.length]), foto: null }
        : { etiket: _t('Takas Masaları'), baslik: _t('Bu hafta masa boş'), alt: '', foto: null };
    case 'kursu': {
      const g = sayi.seriler?.kemerler?.find((x) => x.anahtar === 'galibiyet');
      const sahip = g?.sahipler ?? [];
      const ozet = (sayi.seriler?.kemerler ?? []).filter((x) => x.tur === 'buyuk').map((x) => `${x.kisa}: ${x.sahipler.length ? x.sahipler.map((y) => ad(y.id)).join(', ') : _t('boşta')}`).join(' · ');
      return sahip.length
        ? { etiket: _t('Kürsü · galibiyet kemeri'), baslik: sahip.map((y) => ad(y.id)).join(_t(' ve ')), alt: _t('{0} hafta üst üste kazandı\n{1}', [sahip[0].uzunluk, ozet]), foto: sahip.length === 1 ? sayi.takim[sahip[0].id]?.avatar : null }
        : { etiket: _t('Kürsü'), baslik: _t('Kemerler ve madalyalar'), alt: ozet, foto: null };
    }
    case 'kehanet': {
      const p = sayi.defter?.puan ?? { hoca: 0, abi: 0 };
      return { etiket: _t('Kehanet · iddia defteri'), baslik: _t('Analitik Hoca {0} – {1} Tribün Abi', [p.hoca, p.abi]), alt: _t('Gelecek haftanın tahminleri, şans endeksi ve adil puan durumu'), foto: null };
    }
    case 'kupa': {
      const G = gecmisOku();
      const S = G ? [...G.sezonlar].sort((a, b) => b.yil - a.yil) : [];
      const sam = (s) => Object.values(s.takimlar).find((t) => t.sira === 1)?.ad ?? '';
      return S.length
        ? { etiket: _t('Kupa Dolabı · son şampiyon'), baslik: sam(S[0]), alt: _t('{0} şampiyonu\n{1}', [S[0].etiket, S.slice(1).map((s) => `${s.etiket}: ${sam(s)}`).join(' · ')]), foto: null }
        : { etiket: _t('Kupa Dolabı'), baslik: _t('Şampiyonlar ve rekorlar'), alt: '', foto: null };
    }
    case 'metodoloji':
      return { etiket: _t('Metodoloji'), baslik: _t('Şeffaf veri, açık yöntem'), alt: _t('{0} takım · 9 kategori · güç puanı, herkese karşı ve uyku puanı nasıl hesaplanır', [sayi.takimlar.length]), foto: null };
    case 'arsiv':
      return { etiket: _t('Arşiv'), baslik: _t('{0} sayı, hepsi burada', [sayiAdedi ?? sayi.hafta]), alt: _t('Son sayı: {0}', [sayi.baslik]), foto: null };
    default:
      return null;
  }
}

export async function sayfaKapakPng(sayi, bilgi) {
  const { ayarlar } = sayi;
  const gazete = ayarlar.gazeteAdi ?? ayarlar.ligAdi;
  const etiket = temiz(bilgi.etiket), baslik = temiz(bilgi.baslik), alt = (bilgi.alt || '').split('\n').map(temiz).join('\n');
  const { foto } = bilgi;
  const fotoVar = foto && foto.yol && fs.existsSync(foto.yol);
  const uzunluk = baslik.length;
  const boy = fotoVar ? (uzunluk > 50 ? 48 : uzunluk > 32 ? 56 : uzunluk > 20 ? 66 : 76) : (uzunluk > 60 ? 54 : uzunluk > 40 ? 64 : uzunluk > 24 ? 74 : 88);
  const satirlar = (alt || '').split('\n').filter(Boolean);
  const metin = h('div', { flexDirection: 'column', flexGrow: 1, flexBasis: 0, justifyContent: 'center' }, [
    h('div', { fontSize: 26, fontWeight: 700, color: RENK.etiket }, etiket),
    h('div', { marginTop: 14, fontWeight: 800, fontSize: boy, lineHeight: 1.06, letterSpacing: -boy * 0.035, color: RENK.murekkep }, baslik),
    ...satirlar.map((s, i) => h('div', { marginTop: i ? 6 : 20, fontSize: 28, fontWeight: 500, lineHeight: 1.35, color: RENK.soluk }, s)),
  ]);
  const tur = fotoVar ? (foto.yol.endsWith('.png') ? 'png' : 'jpeg') : null;
  const govde = fotoVar
    ? h('div', { flexGrow: 1, gap: 44, alignItems: 'center' }, [
        metin,
        h('div', { width: 330, height: 330, borderRadius: 40, background: '#1d1d1f', overflow: 'hidden', boxShadow: _t('0 20px 40px rgba(0,0,0,.18)') }, [
          { type: 'img', props: { src: `data:image/${tur};base64,${fs.readFileSync(foto.yol).toString('base64')}`, width: 330, height: 330, style: { objectFit: 'cover', width: 330, height: 330 } } },
        ]),
      ])
    : h('div', { flexGrow: 1 }, [metin]);
  const agac = h('div', { width: 1200, height: 630, background: RENK.zemin, color: RENK.murekkep, fontFamily: AILE }, [
    h('div', { flexDirection: 'column', flexGrow: 1, padding: '40px 64px 48px 64px' }, [
      h('div', { justifyContent: 'space-between', alignItems: 'center' }, [
        markaYazisi(gazete, 56),
        h('div', { padding: '10px 22px', borderRadius: 999, background: RENK.yuzey, fontSize: 22, fontWeight: 700, color: RENK.murekkep }, _t('Sayı {0}', [sayi.no])),
      ]),
      h('div', { marginTop: 24, flexGrow: 1 }, [govde]),
    ]),
  ]);
  const svg = await satori(agac, { width: 1200, height: 630, fonts: tipler() });
  return new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } }).render().asPng();
}

// ---- Takıma özel haftalık kart (17 Kasım 2026): 1200×630, kompakt. Lig yöneticisi kartları gruba atabilir;
// takım sayfasının paylaşım görseli de bu kart. Bilgiler: sonuç, Yahoo sırası (geçen haftaya göre), güç sırası,
// haftanın oyuncusu/faciası, bu haftanın madalyaları, elindeki kemerler, uyku puanı, takım notunun ilk cümlesi, gelecek hafta.
export function takimKartBilgisi(sayi, takim, onceki = null, { haftaOdulleri = [], sezonOdulleri = {} } = {}) {
  const id = takim.id;
  const ad = (x) => temiz(sayi.takim[x]?.ad ?? x);
  const k = sayi.kapsam.hafta;
  const m = sayi.eslesmeler.find((e) => e.ev === id || e.dep === id);
  let sonuc = null;
  if (m) {
    const ben = m.ev === id ? m.evSkor : m.depSkor, o = m.ev === id ? m.depSkor : m.evSkor;
    sonuc = { durum: m.kazanan == null ? _t('Berabere') : m.kazanan === id ? _t('Kazandı') : _t('Kaybetti'), skor: `${ben}–${o}${m.beraber ? `–${m.beraber}` : ''}`, rakip: ad(m.ev === id ? m.dep : m.ev), iyi: m.kazanan === id };
  }
  const pd = sayi.puanDurumu?.[id];
  const once = onceki?.puanDurumu?.[id]?.rank ?? null;
  const ho = sayi.haftaninOyunculari?.takimlar?.find((x) => x.id === id) ?? null;
  // Bu haftanın madalyaları (seviye: bu ödülü kaçıncı kez aldığı) ve elindeki kemerler
  const tumOd = sezonOdulleri;
  const kez = (o) => Object.entries(tumOd).filter(([h]) => Number(h) <= o.hafta).flatMap(([, l]) => l).filter((x) => x.anahtar === o.anahtar && x.takim === o.takim).length;
  const madalya = haftaOdulleri.filter((o) => o.takim === id).map((o) => { const n = kez(o); return { anahtar: o.anahtar, ikon: o.ikon, ad: temiz(o.ad), seviye: n >= 3 ? 'altin' : n === 2 ? 'gumus' : 'bronz' }; });
  const kemer = (sayi.seriler?.kemerler ?? []).filter((x) => x.sahipler.some((s) => s.id === id)).map((x) => ({ anahtar: x.anahtar, tur: x.tur, ikon: x.ikon, kategori: x.kategori, etiket: x.tur === 'kategori' ? x.kategori : x.kisa, hafta: x.sahipler[0].uzunluk }));
  const uyku = sayi.uyuyan?.satirlar?.find((r) => r.takimId === id)?.uyku ?? null;
  const notu = (sayi.takimNotu?.[id] || '').split(/(?<=[.!?])\s+/)[0] || '';
  const g = sayi.gelecek?.eslesmeler?.find((e) => e.a === id || e.b === id);
  const gelecek = g ? { rakip: ad(g.a === id ? g.b : g.a), favori: g.skorA === g.skorB ? null : (g.skorA > g.skorB ? g.a : g.b) === id ? 'favori' : _t('favori değil'), skor: g.a === id ? `${g.skorA}–${g.skorB}` : `${g.skorB}–${g.skorA}` } : null;
  return {
    ad: temiz(takim.ad), foto: takim.foto ?? takim.avatar ?? null, hafta: sayi.hafta, donem: sayi.donem,
    sonuc, yahoo: pd?.rank ?? null, yahooDegisim: once != null && pd ? once - pd.rank : null, kayit: pd ? `${pd.wins}–${pd.losses}${pd.ties ? `–${pd.ties}` : ''}` : '',
    guc: k.gucSirasi.indexOf(id) + 1, gucPuan: k.guc[id], oyuncusu: ho?.oyuncusu?.name ? temiz(ho.oyuncusu.name) : null, faciasi: ho?.faciasi?.name ? temiz(ho.faciasi.name) : null,
    madalya, kemer, uyku, notu: temiz(notu), gelecek,
  };
}

export async function takimKartPng(sayi, B) {
  const gazete = sayi.ayarlar.gazeteAdi ?? sayi.ayarlar.ligAdi;
  const fotoVar = B.foto && B.foto.yol && fs.existsSync(B.foto.yol);
  const tur = fotoVar ? (B.foto.yol.endsWith('.png') ? 'png' : 'jpeg') : null;
  const YESIL = '#1a7f37', KIRMIZI = '#c42b1c';
  const ok = (d) => (d == null || d === 0 ? '' : d > 0 ? ` ↑${d}` : ` ↓${-d}`);
  const kutu = (etiket, deger, alt = '') => h('div', { flexDirection: 'column', flexGrow: 1, flexBasis: 0, padding: '14px 16px', borderRadius: 18, background: RENK.yuzey, minWidth: 0 }, [
    h('div', { fontSize: 16, fontWeight: 600, color: RENK.soluk }, etiket),
    h('div', { marginTop: 4, fontSize: String(deger).length > 15 ? 22 : 30, fontWeight: 800, letterSpacing: -0.8, color: RENK.murekkep, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }, deger),
    ...(alt ? [h('div', { marginTop: 2, fontSize: 15, fontWeight: 500, color: RENK.soluk, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }, alt)] : []),
  ]);
  const hap = (yazi, renk = '#e8e8ed', yaziRenk = RENK.murekkep) => h('div', { padding: '6px 12px', borderRadius: 999, background: renk, color: yaziRenk, fontSize: 16, fontWeight: 700, whiteSpace: 'nowrap' }, yazi);
  const svgImg = (svg, w, hh) => ({ type: 'img', props: { src: `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`, width: w, height: hh, style: { width: w, height: hh } } });
  // Kürsü: kemerler (çizim + altında kısa ad ve hafta), madalyalar (çizim), uyku 2 ve üstüyse hap
  const kursu = [
    ...B.kemer.map((x, i) => h('div', { flexDirection: 'column', alignItems: 'center', gap: 2 }, [
      svgImg(kemerSvg({ ...x, id: `kk${i}`, metin: false }), 100, 50),
      h('div', { fontSize: 14, fontWeight: 700, color: '#5a4300', whiteSpace: 'nowrap' }, _t('{0} · {1} hafta', [x.etiket, x.hafta])),
    ])),
    ...B.madalya.map((m, i) => h('div', { flexDirection: 'column', alignItems: 'center' }, [svgImg(madalyaSvg({ ...m, id: `km${i}` }), 46, 58)])),
    ...(B.uyku != null && B.uyku >= 2 ? [h('div', { alignSelf: 'center' }, [hap(_t('Uyku {0}', [B.uyku]), B.uyku >= 5 ? '#ffdcd8' : '#fff0c9', B.uyku >= 5 ? '#8f1d14' : '#7a5200')])] : []),
  ];
  const sonucRenk = B.sonuc ? (B.sonuc.iyi ? YESIL : B.sonuc.durum === _t('Berabere') ? RENK.soluk : KIRMIZI) : RENK.soluk;
  const agac = h('div', { width: 1200, height: 630, background: RENK.zemin, fontFamily: AILE, color: RENK.murekkep }, [
    h('div', { flexDirection: 'column', flexGrow: 1, padding: '34px 48px 30px 48px' }, [
      h('div', { justifyContent: 'space-between', alignItems: 'center' }, [
        markaYazisi(gazete, 40),
        h('div', { fontSize: 20, fontWeight: 600, color: RENK.soluk }, _t('{0}. hafta · {1}', [B.hafta, B.donem])),
      ]),
      h('div', { marginTop: 22, gap: 32, flexGrow: 1 }, [
        // Sol: fotoğraf ve ad
        h('div', { flexDirection: 'column', width: 250, alignItems: 'flex-start' }, [
          fotoVar
            ? h('div', { width: 250, height: 250, borderRadius: 34, overflow: 'hidden', background: '#1d1d1f' }, [{ type: 'img', props: { src: `data:image/${tur};base64,${fs.readFileSync(B.foto.yol).toString('base64')}`, width: 250, height: 250, style: { objectFit: 'cover', width: 250, height: 250 } } }])
            : h('div', { width: 250, height: 250, borderRadius: 34, background: '#d2d2d7' }, []),
          h('div', { marginTop: 16, fontSize: B.ad.length > 18 ? 28 : 34, fontWeight: 800, lineHeight: 1.1, letterSpacing: -1 }, B.ad),
          h('div', { marginTop: 6, fontSize: 18, fontWeight: 600, color: RENK.soluk }, _t('Yahoo {0}.{1} · {2}', [B.yahoo ?? '—', ok(B.yahooDegisim), B.kayit])),
        ]),
        // Sağ
        h('div', { flexDirection: 'column', flexGrow: 1, flexBasis: 0, minWidth: 0 }, [
          B.sonuc
            ? h('div', { flexDirection: 'column' }, [
                h('div', { fontSize: 58, fontWeight: 800, letterSpacing: -2, lineHeight: 1, color: sonucRenk, whiteSpace: 'nowrap' }, `${B.sonuc.durum} ${B.sonuc.skor}`),
                h('div', { marginTop: 6, fontSize: 22, fontWeight: 600, color: RENK.soluk, overflow: 'hidden', whiteSpace: 'nowrap' }, _t('rakip {0}', [B.sonuc.rakip])),
              ])
            : h('div', { fontSize: 40, fontWeight: 800 }, _t('Eşleşme yok')),
          h('div', { marginTop: 16, gap: 12 }, [
            kutu(_t('Haftalık güç'), `${B.guc}.`, `${B.gucPuan}/126`),
            kutu(_t('Haftanın oyuncusu'), B.oyuncusu ?? '—'),
            kutu(_t('Haftanın faciası'), B.faciasi ?? '—'),
          ]),
          kursu.length ? h('div', { marginTop: 14, gap: 14, flexWrap: 'wrap', alignItems: 'flex-end' }, kursu) : h('div', {}, []),
          B.notu ? h('div', { marginTop: 14, fontSize: 21, fontWeight: 500, lineHeight: 1.35, color: RENK.murekkep, maxHeight: 58, overflow: 'hidden' }, B.notu) : h('div', {}, []),
        ]),
      ]),
      B.gelecek
        ? h('div', { marginTop: 10, paddingTop: 14, borderTop: _t('1px solid #d2d2d7'), fontSize: 19, fontWeight: 600, color: RENK.soluk }, _t('Gelecek hafta: {0} · sezon ortalamasıyla {1}, {2}', [B.gelecek.rakip, B.gelecek.skor, B.gelecek.favori ?? _t('başa baş')]))
        : h('div', {}, []),
    ]),
  ]);
  const svg = await satori(agac, { width: 1200, height: 630, fonts: tipler() });
  return new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } }).render().asPng();
}
