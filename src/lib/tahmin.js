// Okur tahmin oyunu (18 Kasım 2026):
// - Yalnızca ligin koçları oynar, şifre yok; koç seçtiği takımla tanınır.
// - Her hafta: 7 eşleşmenin kazananı (doğru olan 1 puan) + "Haftanın maçı"nın skoru (tam tutarsa +2). En fazla 9 puan.
//   Berabere biten eşleşme kimseye puan vermez. Skor ev sahibinin kategorisi – deplasmanınki – berabere (toplam 9).
// - Tahminler sayının yayınlandığı gün 23:59'da (ligin saat diliminde) kapanır; o saate kadar gizlidir.
// - Analitik Hoca (modelin favorisi, otomatik) ve Tribün Abi (sayı dosyasında abiPick) da oynar; madalya yalnızca koçlara.
// - Haftanın birincisi (eşitse hepsi) "Haftanın kâhini" madalyası; sezon sonunda birinci "Ligin Kâhini".
// Bu dosya hem sitede (derleme) hem Worker'da (tahmin kaydı) kullanılır; Node'a özgü bir şey içermez.

import { t as _t } from '../i18n/t.js';
export const KATEGORI_SAYISI = 9;
export const SKOR_PUANI = 2;
export const OZEL = { hoca: _t('Analitik Hoca'), abi: _t('Tribün Abi') };

export const anahtarYap = (ev, dep) => `${ev}-${dep}`;

/** Sayının yayın günü (YYYY-AA-GG) → kapanış: o gün 23:59, ligin saat diliminde (veri/ayarlar.json → saatDilimi). */
export function kapanisZamani(yayinGunu, saatDilimi = 'Europe/Istanbul') {
  if (!yayinGunu) return null;
  const utc = Date.parse(`${yayinGunu}T23:59:00Z`);
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: saatDilimi, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
    .formatToParts(new Date(utc)).map((x) => [x.type, x.value]));
  const fark = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute) - utc;
  return new Date(utc - fark).toISOString().replace('.000Z', 'Z');
}

/** Skoru normalleştir: [ev, dep] ya da [ev, dep, berabere] → [ev, dep, berabere]; geçersizse null. */
export function skorDuzelt(s) {
  if (!Array.isArray(s) || s.length < 2) return null;
  const [a, b] = s.map(Number);
  if (![a, b].every((x) => Number.isInteger(x) && x >= 0 && x <= KATEGORI_SAYISI) || a + b > KATEGORI_SAYISI) return null;
  const c = KATEGORI_SAYISI - a - b;
  if (s.length > 2 && Number(s[2]) !== c) return null;
  return [a, b, c];
}
export const skorYaz = (s) => (s ? `${s[0]}–${s[1]}${s[2] ? `–${s[2]}` : ''}` : '—');

/**
 * Bir tahmin girişini kontrol eder (Worker kullanır). acik: /tahmin.json içeriği.
 * Dönüş: { tamam: true, kayit } ya da { tamam: false, hata }.
 */
export function girisKontrol(govde, acik, simdi = Date.now()) {
  if (!acik?.hafta) return { tamam: false, hata: _t('Şu an açık tahmin haftası yok.') };
  if (Number(govde?.hafta) !== acik.hafta) return { tamam: false, hata: _t('Açık hafta {0}.', [acik.hafta]) };
  if (simdi >= Date.parse(acik.kapanis)) return { tamam: false, hata: _t('Tahminler kapandı.') };
  const takim = String(govde?.takim ?? '');
  if (!acik.takimlar.includes(takim)) return { tamam: false, hata: _t('Takım seçilmedi.') };
  const secimler = {};
  for (const m of acik.eslesmeler) {
    const v = String(govde?.secimler?.[m.anahtar] ?? '');
    if (v !== m.ev && v !== m.dep) return { tamam: false, hata: _t('Her eşleşmede bir kazanan seç.') };
    secimler[m.anahtar] = v;
  }
  const skor = skorDuzelt(govde?.skor);
  if (!skor) return { tamam: false, hata: _t('Haftanın maçının skorunu yaz (iki sayının toplamı en fazla {0}).', [KATEGORI_SAYISI]) };
  // Skor ile kazanan seçimi çelişmesin
  const hm = acik.eslesmeler.find((m) => m.anahtar === acik.haftaninMaci);
  if (hm && skor[0] !== skor[1] && secimler[hm.anahtar] !== (skor[0] > skor[1] ? hm.ev : hm.dep)) {
    return { tamam: false, hata: _t('Haftanın maçında skor ile seçtiğin kazanan uyuşmuyor.') };
  }
  return { tamam: true, kayit: { takim, hafta: acik.hafta, secimler, skor } };
}

/** Bir tahmini puanla. sonuc: { [anahtar]: { kazanan, skor:[ev,dep,berabere] } } */
export function puanla(tahmin, sonuc, haftaninMaci) {
  let dogru = 0, sayilan = 0;
  for (const [k, secim] of Object.entries(tahmin?.secimler ?? {})) {
    const r = sonuc[k];
    if (!r || r.kazanan == null) continue;
    sayilan++;
    if (secim === r.kazanan) dogru++;
  }
  const g = sonuc[haftaninMaci]?.skor;
  const t = skorDuzelt(tahmin?.skor);
  const tam = !!(g && t && g[0] === t[0] && g[1] === t[1] && g[2] === t[2]);
  return { dogru, sayilan, tam, puan: dogru + (tam ? SKOR_PUANI : 0) };
}

/** Haftanın maçı: sayı dosyasında seçilmişse o; yoksa modelin en başa baş gördüğü eşleşme. */
export function haftaninMaciSec(eslesmeler, secilen) {
  if (secilen) {
    const m = eslesmeler.find((x) => (x.a === secilen.home && x.b === secilen.away) || (x.a === secilen.away && x.b === secilen.home));
    if (m) return m;
  }
  return [...eslesmeler].sort((x, y) => Math.abs(x.toplamZ) - Math.abs(y.toplamZ))[0] ?? null;
}

/** Hoca'nın skor tahmini: favori olduğu kategori sayıları; kalan kategoriler berabere. */
export const hocaSkoru = (m) => [m.skorA, m.skorB, KATEGORI_SAYISI - m.skorA - m.skorB];

/**
 * Sezonun tahmin oyunu (bir sayı için, o sayıya kadarki veriyle).
 * kurulumlar: [{ hafta, haftaninMaci, eslesmeler:[{anahtar, ev, dep}], hoca:{secimler, skor}, abi:{secimler, skor|null} }]
 * girisler:   { [hafta]: { [takimId]: { picks, score } } }   (sayı dosyalarındaki predictionEntries)
 * sonuclar:   { [hafta]: { [anahtar]: { kazanan, skor } } }  (yalnızca bitmiş haftalar)
 */
export function tahminSezonu({ kurulumlar, girisler, sonuclar, takimlar }) {
  const haftalar = {};
  const toplam = new Map();
  const satirAl = (id) => {
    if (!toplam.has(id)) toplam.set(id, { id, ozel: !!OZEL[id], puan: 0, dogru: 0, tam: 0, hafta: 0, kahin: 0 });
    return toplam.get(id);
  };
  for (const k of kurulumlar) {
    const sonuc = sonuclar[k.hafta];
    if (!sonuc) continue;
    const g = girisler[k.hafta] ?? {};
    const katilan = Object.entries(g).filter(([id]) => takimlar.includes(id))
      .map(([id, x]) => [id, { secimler: x.picks, skor: x.score }]);
    const tum = [...katilan, ['hoca', k.hoca], ...(k.abi ? [['abi', k.abi]] : [])];
    const satirlar = tum.map(([id, t]) => ({ id, ozel: !!OZEL[id], tahmin: t, ...puanla(t, sonuc, k.haftaninMaci) }));
    const enYuksek = Math.max(-1, ...satirlar.filter((s) => !s.ozel).map((s) => s.puan));
    const kahinler = katilan.length ? satirlar.filter((s) => !s.ozel && s.puan === enYuksek).map((s) => s.id) : [];
    satirlar.sort((a, b) => b.puan - a.puan || Number(b.tam) - Number(a.tam) || Number(a.ozel) - Number(b.ozel));
    haftalar[k.hafta] = { hafta: k.hafta, haftaninMaci: k.haftaninMaci, eslesmeler: k.eslesmeler, sonuc, satirlar, kahinler, enYuksek, katilim: katilan.length,
      malzeme: yaziMalzemesi(k, sonuc, katilan) };
    for (const s of satirlar) {
      const t = satirAl(s.id);
      t.puan += s.puan; t.dogru += s.dogru; t.tam += s.tam ? 1 : 0; t.hafta++;
      if (kahinler.includes(s.id)) t.kahin++;
    }
  }
  const tablo = [...toplam.values()].sort((a, b) => b.puan - a.puan || b.tam - a.tam || b.kahin - a.kahin || Number(a.ozel) - Number(b.ozel));
  let sira = 0, onceki = null;
  for (const [i, t] of tablo.entries()) {
    const imza = `${t.puan}|${t.tam}`;
    if (imza !== onceki) { sira = i + 1; onceki = imza; }
    t.sira = sira;
  }
  return { haftalar, tablo };
}

// Hoca ile Abi'nin yazıları için malzeme (18 Kasım 2026): kim nerede çuvalladı, kim tek başına bildi.
// "Garanti maç": model en az GARANTI_FARK kategori fark ile favori gördü ve favori kazandı, ya da kazanan en az
// EZICI_FARK kategori farkla kazandı. Bu maçlarda kaybedeni seçenler "ters köşe"ye yatanlardır.
export const GARANTI_FARK = 5;
export const EZICI_FARK = 5;
export function yaziMalzemesi(k, sonuc, katilan) {
  const secen = (anahtar, takim) => katilan.filter(([, t]) => t.secimler?.[anahtar] === takim).map(([id]) => id);
  const garanti = [], tekDogru = [], cogunlukYanildi = [], kendineKarsi = [], kendiMaciniBilemeyen = [];
  for (const e of k.eslesmeler) {
    const r = sonuc[e.anahtar];
    if (!r || r.kazanan == null) continue;
    const kaybeden = r.kazanan === e.ev ? e.dep : e.ev;
    const fark = Math.abs(r.skor[0] - r.skor[1]);
    const m = k.model?.[e.anahtar];
    const modelGaranti = m && m.favori === r.kazanan && m.fark >= GARANTI_FARK;
    const yanilan = secen(e.anahtar, kaybeden);
    const bilen = secen(e.anahtar, r.kazanan);
    if ((modelGaranti || fark >= EZICI_FARK) && yanilan.length) {
      garanti.push({ anahtar: e.anahtar, kazanan: r.kazanan, kaybeden, skor: r.skor, modelFark: m?.fark ?? null, yanilan, bilen: bilen.length });
    }
    if (bilen.length === 1 && katilan.length >= 3) tekDogru.push({ anahtar: e.anahtar, kim: bilen[0], kazanan: r.kazanan, skor: r.skor });
    if (yanilan.length > bilen.length && katilan.length >= 3) cogunlukYanildi.push({ anahtar: e.anahtar, kazanan: r.kazanan, yanilan: yanilan.length, bilen: bilen.length });
    for (const [id, t] of katilan) {
      if (id !== e.ev && id !== e.dep) continue;
      const rakip = id === e.ev ? e.dep : e.ev;
      if (t.secimler?.[e.anahtar] === rakip) kendineKarsi.push({ kim: id, anahtar: e.anahtar, hakliCikti: r.kazanan === rakip });
      else if (r.kazanan !== id) kendiMaciniBilemeyen.push({ kim: id, anahtar: e.anahtar });
    }
  }
  garanti.sort((a, b) => (b.modelFark ?? 0) + Math.abs(b.skor[0] - b.skor[1]) - ((a.modelFark ?? 0) + Math.abs(a.skor[0] - a.skor[1])));
  return { garanti, tekDogru, cogunlukYanildi, kendineKarsi, kendiMaciniBilemeyen };
}
