// Sayfaların kullandığı veri modeli: haftalık dosyaları okur, doğrular ve hesaplanmış alanları ekler.
import { t as _t, yol } from '../i18n/t.js';
import { haftaDosyalariniOku, ayarlariOku, kadroDosyalariniOku, nbaDosyalariniOku, fiksturOku, draftOku, yahooSiraOku } from './okuma.js';
import { elemeOlasiligi } from './eleme.js';
import { uyuyanKoclar } from './uyuyan.js';
import { haftaninOyunculari } from './oyuncu.js';
import { serilerHesapla, kemerSeridiHazir } from './seriler.js';
import { uykuLigi } from './uykuLigi.js';
import { tamamlananTakaslar } from './takasKarnesi.js';
import { kadrolariDogrula } from './kadro.js';
import { gelecekVeDefter } from './gelecek.js';
import { tahminOyunu } from './tahminModel.js';
import { draftKarnesi } from './draft.js';
import { tumunuDogrula } from './dogrulama.js';
import { kapsamHesapla, karsilastir, takimIstatistik, uyumListesi, degisim, KATEGORILER } from './hesap.js';
import { takimAvatari, takimFotografi, sayiFotografi } from './takimGorsel.js';

export const BOLUMLER = [
  // Menü sırası (17 Kasım 2026): Ön sayfa, İstatistikler, Kürsü, Kehanet, Karşılaştır, Takımlar, Oyuncular, Takas Masaları (en sağda).
  { anahtar: 'onsayfa', ad: _t('Ön sayfa'), kisa: _t('Ön sayfa'), yol: '', ikon: 'gazete' },
  { anahtar: 'istatistikler', ad: _t('İstatistikler'), kisa: _t('İstatistik'), yol: 'istatistikler', ikon: 'grafik' },
  { anahtar: 'kursu', ad: _t('Kürsü'), kisa: _t('Kürsü'), yol: 'kursu', ikon: 'kupa' }, // kemerler ve madalyalar
  { anahtar: 'kehanet', ad: _t('Kehanet'), kisa: _t('Kehanet'), yol: 'kehanet', ikon: 'parilti' }, // Hoca ile Abi: tahminler, şans, adil puan durumu
  { anahtar: 'karsilastir', ad: _t('Karşılaştır'), kisa: _t('Kıyasla'), yol: 'karsilastir', ikon: 'karsi' },
  { anahtar: 'takimlar', ad: _t('Takımlar'), kisa: _t('Takımlar'), yol: 'takimlar', ikon: 'takim' },
  { anahtar: 'oyuncular', ad: _t('Oyuncular'), kisa: _t('Oyuncular'), yol: 'oyuncular', ikon: 'oyuncu' },
  { anahtar: 'takas', ad: _t('Takas Masaları'), kisa: _t('Takas'), yol: 'takas', ikon: 'el' },
  { anahtar: 'kupa', ad: _t('Kupa Dolabı'), kisa: _t('Kupa Dolabı'), yol: 'kupa-dolabi', ikon: 'tac' }, // 18 Kasım 2026: geçmiş sezonlar, tüm zamanlar, rekorlar (en sonda)
];
export const EK_BOLUMLER = [
  { anahtar: 'analiz', ad: _t('Analiz'), yol: 'istatistikler/analiz', ust: 'istatistikler' },
  { anahtar: 'metodoloji', ad: _t('Metodoloji'), yol: 'metodoloji' },
  { anahtar: 'arsiv', ad: _t('Arşiv'), yol: 'arsiv' },
];

// "Tablo ile Tribün" köşesinin sabit karakterleri.
export const KOSE_YAZARLARI = {
  hoca: { ad: _t('Analitik Hoca'), harf: 'AH', tanim: _t('Excel ve yapay zekâ') },
  abi: { ad: _t('Tribün Abi'), harf: 'TA', tanim: _t('Pota altı ve tribün') },
};

// Takım simgesi renkleri (takım kimliğine bağlı; sıralama değişse de renk değişmez).
const SIMGE_RENKLERI = ['#d6ef87', '#b8c9fd', '#efb8a1', '#d5bbed', '#9edbc9', '#efce82'];

export function adresAdi(ad) {
  return ad
    .toLocaleLowerCase('tr')
    .replace(/ı/g, 'i')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function basHarfler(ad) {
  return ad.split(/\s+/).filter(Boolean).map((p) => p[0]).slice(0, 2).join('').toLocaleUpperCase('tr');
}

const ikiHane = (n) => String(n).padStart(2, '0');

let onbellek = null;

export function tumSayilar() {
  if (onbellek) return onbellek;
  const dosyalar = haftaDosyalariniOku();
  const kadrolar = kadroDosyalariniOku();
  const nbaDosyalari = nbaDosyalariniOku();
  const hatalar = [...tumunuDogrula(dosyalar).hatalar, ...kadrolariDogrula(kadrolar, dosyalar).hatalar];
  if (hatalar.length) throw new Error(_t('Veri dosyalarında hata var. `npm run dogrula` çıktısına bak:\n') + hatalar.join('\n'));
  const ayarlar = ayarlariOku();
  const fikstur = fiksturOku();
  const draft = draftOku();
  const sayilar = dosyalar.map((d) => d.veri).sort((a, b) => a.week - b.week);
  const sonHafta = sayilar.at(-1).week;
  const modeller = sayilar.map((v) => sayiModeli(v, sonHafta, ayarlar, kadrolar.get(v.week)?.veri ?? null, sayilar, [...kadrolar.values()].map((d) => d.veri).filter((d) => d && d.week <= v.week), nbaDosyalari.get(v.week) ?? null, [...nbaDosyalari.values()].filter((d) => d.hafta <= v.week)));
  // Seriler ve kemerler (17 Kasım 2026): her sayı kendisine kadarki haftalarla hesaplanır (src/lib/seriler.js).
  modeller.forEach((s, i) => {
    s.seriler = serilerHesapla(modeller.slice(0, i + 1));
    s.uykuLigi = uykuLigi(modeller.slice(0, i + 1), ayarlar);
    // Eleme olasılığı (17 Kasım 2026): yalnızca okura görüneceği sayılarda hesaplanır (ayarlar.elemeOlasiligiBaslangic)
    s.eleme = s.hafta >= (ayarlar.elemeOlasiligiBaslangic ?? Infinity)
      ? elemeOlasiligi(s, fikstur, { N: Number(ayarlar.elemeTakimSayisi) || 8, sonHafta: Number(ayarlar.normalSezonHaftaSayisi) || 19 })
      : null;
    // Okur tahmin oyunu (18 Kasım 2026): src/lib/tahmin.js, src/lib/tahminModel.js
    s.tahminOyunu = tahminOyunu(sayilar.slice(0, i + 1), s, ayarlar);
    // Draft karnesi (18 Kasım 2026): src/lib/draft.js
    s.draft = draftKarnesi(s, draft, yahooSiraOku(s.hafta));
    const hazir = kemerSeridiHazir(s.seriler, (id) => s.takim[id]?.ad ?? id);
    s.kemerSeridi = hazir && s.hafta >= (ayarlar.kemerSeridiBaslangic ?? 1)
      ? { etiket: _t('KEMER EL DEĞİŞTİRDİ'), baslik: s.kemerHaberi?.title || hazir.baslik, metin: s.kemerHaberi?.text || hazir.metin, takimlar: hazir.takimlar.slice(0, 4), kemerler: hazir.kemerler, hazir: !s.kemerHaberi }
      : null;
  });
  onbellek = { ayarlar, sayilar: modeller, sonHafta };
  return onbellek;
}

function sayiModeli(v, sonHafta, ayarlar, kadro = null, tumHam = [], kadroGecmisi = [], nba = null, nbaGecmisi = []) {
  const guncel = v.week === sonHafta;
  const kok = guncel ? '/' : `/hafta/${v.week}/`;
  const adres = (bolum = '', ek = '') => yol(`${kok}${bolum ? bolum + '/' : ''}${ek}`);

  const kullanilan = new Set();
  const takimlar = v.teams.map((t) => {
    let slug = adresAdi(t.name) || `takim-${t.id}`;
    if (kullanilan.has(slug)) slug = `${slug}-${t.id}`;
    kullanilan.add(slug);
    const idx = Number.isFinite(+t.id) ? +t.id : v.teams.indexOf(t);
    return { id: t.id, ad: t.name, slug, harf: basHarfler(t.name), renk: SIMGE_RENKLERI[idx % SIMGE_RENKLERI.length], avatar: takimAvatari(t.id), foto: takimFotografi(t.id) };
  });
  const takim = Object.fromEntries(takimlar.map((t) => [t.id, t]));
  const puanDurumu = Object.fromEntries(v.standings.map((s) => [s.id, s]));

  const haftalar = v.weeks.filter((w) => w.week <= v.week).sort((a, b) => a.week - b.week);
  const buHafta = haftalar.find((w) => w.week === v.week) || haftalar.at(-1);
  const hesapTakimlari = v.teams.map((t) => ({ id: t.id, name: t.name }));
  const kapsam = {
    hafta: kapsamHesapla(hesapTakimlari, [buHafta]),
    sezon: kapsamHesapla(hesapTakimlari, haftalar),
  };

  const eslesmeler = buHafta.matchups.map((m) => {
    const c = karsilastir(takimIstatistik([{ matchups: [m] }], m.home.id), takimIstatistik([{ matchups: [m] }], m.away.id));
    const ev = m.home.score, dep = m.away.score;
    return {
      ev: m.home.id,
      dep: m.away.id,
      evSkor: ev.wins,
      depSkor: dep.wins,
      beraber: ev.ties,
      kazanan: ev.wins > dep.wins ? m.home.id : dep.wins > ev.wins ? m.away.id : null,
      durum: m.status,
      detay: c.detay,
    };
  });

  const degisimler = haftalar.length > 1
    ? Object.fromEntries(takimlar.map((t) => [t.id, Object.fromEntries(KATEGORILER.map((k) => [k, degisim(haftalar, buHafta, t.id, k)]))]))
    : null;

  const k = kapsam.hafta;
  const gucLideri = k.gucSirasi[0];
  const skorLideri = [...takimlar].sort((a, b) => (k.ist[b.id].PTS ?? -1) - (k.ist[a.id].PTS ?? -1))[0].id;

  // Önceki sayıya göre güç sırası değişimi (2. haftadan itibaren)
  let sirasiDegisen = null;
  if (haftalar.length > 1) {
    const onceki = kapsamHesapla(hesapTakimlari, [haftalar.at(-2)]);
    const fark = takimlar.map((t) => ({ id: t.id, fark: onceki.gucSirasi.indexOf(t.id) - k.gucSirasi.indexOf(t.id) }));
    sirasiDegisen = fark.sort((a, b) => b.fark - a.fark)[0];
  }

  const uyum = Object.fromEntries(takimlar.map((t) => [t.id, uyumListesi(hesapTakimlari, k, t.id)]));
  const takimNotu = Object.fromEntries((v.teamNotes || []).map((n) => [n.teamId, n.text]));

  const donemSonu = kadro?.periodEnd ?? nba?.donem?.[1] ?? null;
  return {
    hafta: v.week,
    no: ikiHane(v.week),
    guncel,
    surum: v.schemaVersion,
    sezon: v.season,
    sezonEtiketi: `${v.season}–${v.season + 1}`,
    donem: v.period,
    yayin: v.publishedAt,
    // Yayın günü: dönemin son gününden (pazar) sonraki gün; dönem sonu bilinmiyorsa verinin alındığı gün (17 Kasım 2026).
    yayinGunu: donemSonu
      ? new Date(Date.parse(donemSonu + 'T12:00:00Z') + 86400000).toISOString().slice(0, 10)
      : null,
    baslik: v.title,
    spot: v.summary,
    yazi: v.article?.paragraphs || [],
    yazar: v.article?.byline || null,
    mansetFoto: (() => {
      const f = v.article?.photo;
      const t = f && takimlar.find((x) => x.id === f.teamId);
      // Sayıya özel fotoğraf (article.photo.image) varsa o; yoksa takımın kayıtlı fotoğrafı.
      const ozel = t && f.image ? sayiFotografi(f.image) : null;
      if (t && ozel) return { takim: t, altYazi: f.caption || '', ...ozel, ozel: true, alt: f.alt || f.caption || _t('{0} manşet fotoğrafı', [t.ad]), kunye: f.credit || t.ad };
      return t && t.foto ? { takim: t, altYazi: f.caption || '', ...t.foto, ozel: false, alt: _t('{0} takım fotoğrafı', [t.ad]), kunye: t.ad } : null;
    })(),
    haberler: v.stories || [],
    // Son dakika haberi (isteğe bağlı, 9 Kasım 2026): ön sayfanın en üstünde kırmızı şerit.
    sonDakika: v.breaking && v.breaking.title
      ? { etiket: v.breaking.label || _t('SON DAKİKA'), baslik: v.breaking.title, metin: v.breaking.text || '', takimlar: (v.breaking.teamIds || []).filter((id) => takim[id]) }
      : null,
    // Kemer şeridi için Claude'un metni (isteğe bağlı): { title, text }. Yoksa hazır cümle.
    kemerHaberi: v.beltNews ?? null,
    // Etkileşim kemeri: haftalık mesaj sayısı, takım (koç) başına. Mesaj içeriği depoya girmez.
    sohbet: v.chatCounts ?? null,
    // Kehanet sayfasının ve ön sayfa özetinin değerlendirmesi (17 Kasım 2026, isteğe bağlı): { hoca, abi }
    kehanetYazisi: v.forecastColumn ?? null,
    // Kehanet Saati (18 Kasım 2026): ön sayfada soru-cevap söyleşi. Soran ve cevaplayan sırayla değişebilir.
    kehanetSaati: v.forecastHour
      ? { konular: v.forecastHour.topics || [], sorular: v.forecastHour.turns.map((t) => ({ soran: t.asker, cevaplayan: t.asker === 'abi' ? 'hoca' : 'abi', soru: t.question, cevap: t.answer })) }
      : null,
    // Kehanet sayfasındaki bölüm notları: { nextWeek, predictionGame, fairTable, luck } → { from, text }
    kehanetNotlari: v.forecastNotes ?? {},
    kose: v.column
      ? { baslik: v.column.title, mesajlar: v.column.messages.map((m, i, d) => ({ kim: m.from, ad: KOSE_YAZARLARI[m.from].ad, metin: m.text, ilk: i === 0 || d[i - 1].from !== m.from })) }
      : null,
    takimNotu,
    takimlar,
    takim,
    puanDurumu,
    kapsam,
    haftaSayisi: haftalar.length,
    eslesmeler,
    degisimler,
    gucLideri,
    skorLideri,
    sirasiDegisen,
    uyum,
    haftalarHam: haftalar,
    kadro, // veri/kadrolar/hafta-NN.json (yoksa null)
    nbaGecmisi, // haftanın kelepiri için (17 Kasım 2026)
    kadroGecmisi, // Yalnızca bu sayıya kadar; arşive gelecekteki oyuncu/hareket bilgisi sızmaz.
    nba, // veri/nba/hafta-NN.json (yoksa null): maç günleri, kim oynadı, maç kâğıtları
    uyuyan: uyuyanKoclar(kadro, nba, eslesmeler, ayarlar.aktifYerler), // Uyuyan koç tablosu (src/lib/uyuyan.js)
    haftaninOyunculari: haftaninOyunculari(kadro, nba),
    ligTakaslari: donemSonu ? tamamlananTakaslar(kadroGecmisi, nbaGecmisi, donemSonu) : [],
    uyuyanNotu: Object.fromEntries((v.sleepNotes || []).map((n) => [n.teamId, n.text])),
    ...gelecekVeDefter(v, tumHam), // gelecek: gelecek haftanın favorileri; defter: iddia defteri
    hesapTakimlari,
    oyuncuNotlari: v.playerNotes,
    takaslar: v.trades.map((t, i) => ({ ...t, no: ikiHane(i + 1) })),
    kaynaklar: v.sources,
    adres,
    kapak: yol(`/kapak/hafta-${ikiHane(v.week)}.png`),
    ayarlar,
  };
}

export function sayiBul(hafta) {
  return tumSayilar().sayilar.find((s) => s.hafta === hafta);
}

