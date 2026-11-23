// Gelecek hafta ve iddia defteri.
// - Favoriler: iki takımın sezon ortalamaları kategori kategori karşılaştırılır (sayım kategorileri haftalık ortalama,
//   yüzdeler toplam isabet / toplam deneme). Farkın büyüklüğü, o kategorideki haftalık takım değerlerinin standart sapmasıyla ölçülür.
// - İddia defteri: Analitik Hoca'nın tahmini bu modelin favorisidir (otomatik); Tribün Abi'nin tahmini sayı dosyasına yazılır
//   (nextWeek.matchups[].abiPick). Hafta bitince gerçek sonuçla karşılaştırılır; doğru tahmin 1 puan, berabere biten eşleşme puan vermez.
import { KATEGORILER, takimIstatistik, yuzdeMi } from './hesap.js';

const BASA_BAS = 0.25; // standart sapmanın çeyreğinden küçük fark: başa baş
const NET = 0.75;      // dörtte üçünden büyük fark: net favori

const oynadigiHafta = (haftalar, id) => haftalar.filter((h) => h.matchups.some((m) => m.home.id === id || m.away.id === id)).length;

/** Sezon ortalaması: sayım kategorileri hafta başına, yüzdeler toplam isabet / toplam deneme. */
export function sezonOrtalamasi(haftalar, takimId) {
  const ist = takimIstatistik(haftalar, takimId);
  const n = oynadigiHafta(haftalar, takimId);
  return Object.fromEntries(KATEGORILER.map((k) => [k, ist[k] == null || !n ? null : yuzdeMi(k) ? ist[k] : ist[k] / n]));
}

const onbellek = new WeakMap();
/** Her kategoride haftalık takım değerlerinin standart sapması (bütün haftalar, bütün takımlar). */
function olcekler(haftalar) {
  if (onbellek.has(haftalar)) return onbellek.get(haftalar);
  const s = {};
  for (const k of KATEGORILER) {
    const degerler = haftalar.flatMap((h) => h.matchups.flatMap((m) => [m.home.id, m.away.id]).map((id) => takimIstatistik([h], id)[k])).filter((v) => v != null);
    const ort = degerler.reduce((a, v) => a + v, 0) / (degerler.length || 1);
    const sd = Math.sqrt(degerler.reduce((a, v) => a + (v - ort) ** 2, 0) / Math.max(1, degerler.length - 1));
    s[k] = sd > 0 ? sd : null;
  }
  onbellek.set(haftalar, s);
  return s;
}

/** İki takımın kategori kategori favorisi ve modelin (Analitik Hoca'nın) tahmini. */
export function favoriHesapla(haftalar, a, b) {
  const A = sezonOrtalamasi(haftalar, a), B = sezonOrtalamasi(haftalar, b), S = olcekler(haftalar);
  let toplamZ = 0;
  const kategoriler = KATEGORILER.map((k) => {
    if (A[k] == null || B[k] == null) return { k, a: A[k], b: B[k], favori: null, guc: null, z: 0 };
    const fark = (A[k] - B[k]) * (k === 'TO' ? -1 : 1);
    const z = S[k] ? fark / S[k] : 0;
    toplamZ += z;
    const mutlak = Math.abs(z);
    return { k, a: A[k], b: B[k], favori: fark > 0 ? a : fark < 0 ? b : null, guc: mutlak < BASA_BAS ? 'basabas' : mutlak < NET ? 'hafif' : 'net', z };
  });
  const skorA = kategoriler.filter((x) => x.favori === a).length;
  const skorB = kategoriler.filter((x) => x.favori === b).length;
  const hoca = skorA > skorB ? a : skorB > skorA ? b : toplamZ > 0 ? a : toplamZ < 0 ? b : null;
  const basabas = kategoriler.filter((x) => x.guc === 'basabas').length;
  return { a, b, kategoriler, skorA, skorB, hoca, toplamZ, basabas };
}

const ayniEslesme = (m, x, y) => (m.home.id === x && m.away.id === y) || (m.home.id === y && m.away.id === x);
const kazanani = (m) => (m.home.score.wins > m.away.score.wins ? m.home.id : m.away.score.wins > m.home.score.wins ? m.away.id : null);

/**
 * Bir sayının "gelecek hafta" bölümü ve iddia defteri.
 * @param v       bu sayının ham dosyası
 * @param tumHam  bütün sayıların ham dosyaları (eski tahminler için)
 */
export function gelecekVeDefter(v, tumHam) {
  const haftalar = v.weeks.filter((w) => w.week <= v.week);
  const gelecek = v.nextWeek?.matchups?.length
    ? {
        hafta: v.nextWeek.week,
        donem: v.nextWeek.period,
        eslesmeler: v.nextWeek.matchups.map((m) => ({ ...favoriHesapla(haftalar, m.home, m.away), abi: m.abiPick ?? null, abiNot: m.abiNote ?? '', haber: m.news ?? null })),
      }
    : null;

  // Önceki sayılarda yapılan ve sonucu bu sayının verisinde olan tahminler
  const sonuclar = [];
  for (const eski of tumHam) {
    if (eski.week >= v.week || !eski.nextWeek?.matchups) continue;
    const hedef = eski.nextWeek.week;
    const gercek = v.weeks.find((w) => w.week === hedef && hedef <= v.week);
    if (!gercek) continue;
    const eskiHaftalar = eski.weeks.filter((w) => w.week <= eski.week);
    for (const t of eski.nextWeek.matchups) {
      const m = gercek.matchups.find((x) => ayniEslesme(x, t.home, t.away));
      if (!m || m.status !== 'final') continue;
      const kazanan = kazanani(m);
      const hoca = favoriHesapla(eskiHaftalar, t.home, t.away).hoca;
      const abi = t.abiPick ?? null;
      sonuclar.push({
        hafta: hedef, ev: m.home.id, dep: m.away.id, evSkor: m.home.score.wins, depSkor: m.away.score.wins, kazanan,
        hoca, abi, hocaDogru: kazanan != null && hoca === kazanan, abiDogru: kazanan != null && abi === kazanan,
      });
    }
  }
  const puan = {
    hoca: sonuclar.filter((s) => s.hocaDogru).length,
    abi: sonuclar.filter((s) => s.abiDogru).length,
    mac: sonuclar.length,
  };
  const sonHafta = sonuclar.length ? Math.max(...sonuclar.map((s) => s.hafta)) : null;
  return {
    gelecek,
    defter: { puan, sonuclar, sonHafta, sonHaftaSonuclari: sonuclar.filter((s) => s.hafta === sonHafta) },
  };
}
