// Haftanın ödülleri: her hafta, yalnızca o haftanın sayılarından otomatik hesaplanır.
// Tanımlar Metodoloji sayfasında. Metinler yalnızca sayılardan üretilir.
import { t as _t, ONDALIK, yuzdeYaz } from '../i18n/t.js';
import { KATEGORILER, KATEGORI_ADI, kapsamHesapla, takimIstatistik, bicimle, kayit } from './hesap.js';
import { analizHesapla, dagilimHesapla, hacim } from './analiz.js';
import { haftaninKelepiri } from './oyuncu.js';

const ondalik = (v, d = 1) => v.toFixed(d).replace('.', ONDALIK);
const isaretli = (v) => (v > 0 ? '+' : v < 0 ? '−' : '±') + ondalik(Math.abs(v));
const yarim = (r) => r.wins + r.ties / 2;

export const ODUL_TANIMLARI = [
  { anahtar: 'patron', ad: _t('Haftanın patronu'), ikon: 'tac', tanim: _t('En iyi herkese karşı kaydı ({RAKIP} rakibin hepsiyle oynasaydı).') },
  { anahtar: 'piyango', ad: _t('Fikstür piyangosu'), ikon: 'parilti', tanim: _t('Gerçek eşleşmede beklenenden en çok kategori alan.') },
  { anahtar: 'kurban', ad: _t('Fikstür kurbanı'), ikon: 'yagmur', tanim: _t('Gerçek eşleşmede beklenenden en az kategori alan.') },
  { anahtar: 'kilpayi', ad: _t('Kıl payı'), ikon: 'kumsaati', tanim: _t('Tek kategori farkla kaybedenler içinde, kaybettiği kategorilerden biri en yakın biten.') },
  { anahtar: 'keskin', ad: _t('Keskin nişancı'), ikon: 'hedef', tanim: _t('En yüksek gerçek şut yüzdesi: sayı ÷ (2 × (saha içi deneme + 0,44 × serbest atış denemesi)).') },
  { anahtar: 'canavar', ad: _t('Kategori canavarı'), ikon: 'simsek', tanim: _t('Tek bir kategoride lig ortalamasından en çok uzaklaşan (standart sapma cinsinden).') },
  { anahtar: 'yukselen', ad: _t('Haftanın yükseleni'), ikon: 'yukselis', tanim: _t('Haftalık güç sırasında geçen haftaya göre en çok basamak çıkan.') },
  { anahtar: 'topkaybi', ad: _t('Top kaybı fabrikası'), ikon: 'fabrika', tanim: _t('Haftanın en çok top kaybı.') },
  { anahtar: 'kahin', ad: _t('Haftanın kâhini'), ikon: 'kure', tanim: _t('Tahmin oyununda haftanın en yüksek puanı ({ESLESME} eşleşmenin kazananı 1\'er puan, haftanın maçının tam skoru +2). Eşitlikte hepsi alır; Analitik Hoca ile Tribün Abi madalya almaz.') },
  { anahtar: 'kelepir', ad: _t('Haftanın kelepiri'), ikon: 'el', tanim: _t('O hafta serbest oyuncudan alınanların toplam verimi en yüksek takım (alındıktan sonraki bütün maçlar; ortalamanın altındaki alım eksi yazar).') },
];
const TANIM = Object.fromEntries(ODUL_TANIMLARI.map((t) => [t.anahtar, t]));

// Eşitlikte o haftanın güç puanı yüksek olan, o da eşitse veri dosyasındaki sıra öne geçer.
function enIyi(adaylar, deger, k) {
  return [...adaylar].sort((a, b) => deger(b) - deger(a) || k.guc[b] - k.guc[a])[0];
}

function haftaHesapla(sayi, hafta) {
  const takimlar = sayi.hesapTakimlari;
  const ad = (id) => sayi.takim[id]?.ad ?? id;
  const haftalar = sayi.haftalarHam;
  const i = haftalar.findIndex((w) => w.week === hafta);
  if (i < 0) return [];
  const w = haftalar[i];
  const A = analizHesapla(sayi);
  const h = A.haftalik[i].takim;
  const k = kapsamHesapla(takimlar, [w]);
  const dg = dagilimHesapla(takimlar, k);
  const ids = takimlar.map((t) => t.id).filter((id) => k.ist[id] && h[id]);
  const oduller = [];
  const ekle = (anahtar, takim, deger, aciklama) => oduller.push({ ...TANIM[anahtar], takim, hafta, deger, aciklama });

  // Patron
  const patron = enIyi(ids, (id) => yarim(k.herkeseKarsi[id]), k);
  const hk = k.herkeseKarsi[patron];
  ekle('patron', patron, kayit(hk), _t('Bu haftanın sayılarıyla {RAKIP} rakibin hepsiyle oynasaydı {0} galibiyet, {1} mağlubiyet{2} alırdı.', [hk.wins, hk.losses, hk.ties ? _t(', {0} beraberlik', [hk.ties]) : '']));

  // Piyango ve kurban (gerçek − beklenen kategori)
  const oynayan = ids.filter((id) => h[id].gercek != null);
  const sans = (id) => h[id].gercek - h[id].beklenen;
  const piyango = enIyi(oynayan, sans, k);
  if (piyango && sans(piyango) > 0.05) ekle('piyango', piyango, isaretli(sans(piyango)), _t('Eşleşmesinde {0} kategori aldı; herkese karşı ortalaması {1}.', [ondalik(h[piyango].gercek), ondalik(h[piyango].beklenen)]));
  const kurban = enIyi(oynayan, (id) => -sans(id), k);
  if (kurban && sans(kurban) < -0.05) ekle('kurban', kurban, isaretli(sans(kurban)), _t('Herkese karşı ortalaması {0} kategori; eşleşmesinde {1} aldı.', [ondalik(h[kurban].beklenen), ondalik(h[kurban].gercek)]));

  // Kıl payı: tek kategori farkla kaybedenler; kaybettiği en yakın kategori (fark / standart sapma)
  const sapma = Object.fromEntries(dg.kategoriler.map((c) => [c.kat, c.sapma]));
  const adaylar = [];
  for (const m of w.matchups) {
    if (Math.abs(m.home.score.wins - m.away.score.wins) !== 1) continue;
    const [kazanan, kaybeden] = m.home.score.wins > m.away.score.wins ? [m.home, m.away] : [m.away, m.home];
    const a = takimIstatistik([{ matchups: [m] }], kaybeden.id);
    const b = takimIstatistik([{ matchups: [m] }], kazanan.id);
    for (const kat of KATEGORILER) {
      if (a[kat] == null || b[kat] == null || !sapma[kat]) continue;
      const fark = (b[kat] - a[kat]) * (kat === 'TO' ? -1 : 1);
      if (fark > 1e-9) adaylar.push({ kaybeden: kaybeden.id, kazanan: kazanan.id, kat, a: a[kat], b: b[kat], yakinlik: Math.abs(a[kat] - b[kat]) / sapma[kat], skor: `${kaybeden.score.wins}–${kazanan.score.wins}${kaybeden.score.ties ? '–' + kaybeden.score.ties : ''}` });
    }
  }
  const kil = adaylar.sort((x, y) => x.yakinlik - y.yakinlik)[0];
  if (kil) {
    const farkYazi = kil.kat.includes('%') ? _t('{0} puan', [ondalik(Math.abs(kil.a - kil.b) * 100)]) : ondalik(Math.abs(kil.a - kil.b), 0);
    ekle('kilpayi', kil.kaybeden, kil.skor, _t('{0} karşısında {1} farkı yalnızca {2} ({3} – {4}).', [ad(kil.kazanan), KATEGORI_ADI[kil.kat].toLocaleLowerCase('tr'), farkYazi, bicimle(kil.a, kil.kat), bicimle(kil.b, kil.kat)]));
  }

  // Keskin nişancı: gerçek şut yüzdesi
  const gsy = Object.fromEntries(ids.map((id) => {
    const v = hacim([w], id), pts = k.ist[id].PTS;
    const payda = v.FGA != null && v.FTA != null ? 2 * (v.FGA + 0.44 * v.FTA) : 0;
    return [id, payda > 0 && pts != null ? pts / payda : null];
  }));
  const gsyIds = ids.filter((id) => gsy[id] != null);
  if (gsyIds.length) {
    const keskin = enIyi(gsyIds, (id) => gsy[id], k);
    const ort = gsyIds.reduce((s, id) => s + gsy[id], 0) / gsyIds.length;
    ekle('keskin', keskin, yuzdeYaz(ondalik(gsy[keskin] * 100)), _t('Gerçek şut yüzdesi; lig ortalaması %{0}. Saha içi isabeti {1}.', [ondalik(ort * 100), bicimle(k.ist[keskin]['FG%'], 'FG%')]));
  }

  // Kategori canavarı: en yüksek tek kategori standart puanı
  let canavar = null;
  for (const id of ids) for (const kat of KATEGORILER) {
    const z = dg.standart[id].puanlar[kat];
    if (z != null && (!canavar || z > canavar.z + 1e-9 || (Math.abs(z - canavar.z) <= 1e-9 && k.guc[id] > k.guc[canavar.id]))) canavar = { id, kat, z };
  }
  if (canavar) {
    const c = dg.kategoriler.find((x) => x.kat === canavar.kat);
    ekle('canavar', canavar.id, `${bicimle(k.ist[canavar.id][canavar.kat], canavar.kat)} ${canavar.kat}`, _t('{0}: lig ortalaması {1}; {2} standart sapma {3}.', [KATEGORI_ADI[canavar.kat], bicimle(c.ortalama, canavar.kat), ondalik(canavar.z), canavar.kat === 'TO' ? _t('daha az top kaybı') : _t('yukarıda')]));
  }

  // Yükselen: haftalık güç sırası değişimi
  if (i > 0) {
    const once = A.haftalik[i - 1].takim;
    const yukselis = (id) => (once[id] ? once[id].sira - h[id].sira : 0);
    const yuk = enIyi(ids, yukselis, k);
    if (yuk && yukselis(yuk) > 0) ekle('yukselen', yuk, _t('+{0} basamak', [yukselis(yuk)]), _t('Haftalık güç sırası: geçen hafta {0}., bu hafta {1}.', [once[yuk].sira, h[yuk].sira]));
  }

  // Top kaybı fabrikası
  const toIds = ids.filter((id) => k.ist[id].TO != null);
  if (toIds.length) {
    const fab = enIyi(toIds, (id) => k.ist[id].TO, k);
    const ort = toIds.reduce((s, id) => s + k.ist[id].TO, 0) / toIds.length;
    ekle('topkaybi', fab, _t('{0} top kaybı', [k.ist[fab].TO]), _t('Lig ortalaması {0}. Top bu takıma emanet değil.', [ondalik(ort)]));
  }

  // Haftanın kelepiri (17 Kasım 2026): serbest oyuncudan alınanların toplam verimi (src/lib/oyuncu.js)
  const kadroH = (sayi.kadroGecmisi || []).find((d) => d.week === hafta);
  const nbaH = (sayi.nbaGecmisi || []).find((d) => d.hafta === hafta);
  const kel = haftaninKelepiri(kadroH, nbaH)?.kazanan;
  if (kel) {
    const ilk = kel.oyuncular.slice(0, 3).map((o) => _t('{0} ({1} maç, {2})', [o.ad, o.games, isaretli(o.katki)])).join(', ');
    ekle('kelepir', kel.id, isaretli(kel.toplam), _t('{0} alım: {1}{2}.', [kel.oyuncular.length, ilk, kel.oyuncular.length > 3 ? '…' : '']));
  }
  // Haftanın kâhini (18 Kasım 2026): tahmin oyunu (src/lib/tahmin.js); eşitlikte hepsi
  const T = sayi.tahminOyunu?.haftalar?.[hafta];
  if (T) for (const id of T.kahinler) ekle('kahin', id, _t('{0} puan', [T.enYuksek]), _t('{0} koç arasında en yüksek puan (en fazla {1}).', [T.katilim, T.eslesmeler.length + 2]));
  return oduller;
}

const onbellek = new WeakMap();
/** Sayıdaki bütün haftaların ödülleri: { [hafta]: ödül[] } */
export function sezonOdulleri(sayi) {
  if (!onbellek.has(sayi)) {
    onbellek.set(sayi, Object.fromEntries(sayi.haftalarHam.map((w) => [w.week, haftaHesapla(sayi, w.week)])));
  }
  return onbellek.get(sayi);
}

export const haftaOdulleri = (sayi) => sezonOdulleri(sayi)[sayi.hafta] ?? [];

/** Bir takımın sezon boyunca aldığı ödüller (en yeni önce). */
export function odulDolabi(sayi, id) {
  return Object.values(sezonOdulleri(sayi)).flat().filter((o) => o.takim === id).sort((a, b) => b.hafta - a.hafta);
}
