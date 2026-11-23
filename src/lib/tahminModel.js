// Tahmin oyununun sayı dosyalarından kurulması (18 Kasım 2026). Hesap kuralları src/lib/tahmin.js'te.
import { favoriHesapla } from './gelecek.js';
import { anahtarYap, haftaninMaciSec, hocaSkoru, kapanisZamani, skorDuzelt, tahminSezonu } from './tahmin.js';

/** Bir sayının "gelecek hafta"sı için oyun kurulumu (eşleşmeler, haftanın maçı, Hoca ve Abi'nin tahmini). */
export function kurulumYap(v) {
  if (!v?.nextWeek?.matchups?.length) return null;
  const haftalar = v.weeks.filter((w) => w.week <= v.week);
  const em = v.nextWeek.matchups.map((m) => ({ ...favoriHesapla(haftalar, m.home, m.away), abi: m.abiPick ?? null }));
  const hm = haftaninMaciSec(em, v.nextWeek.matchOfWeek);
  const eslesmeler = em.map((m) => ({ anahtar: anahtarYap(m.a, m.b), ev: m.a, dep: m.b }));
  const haftaninMaci = hm ? anahtarYap(hm.a, hm.b) : null;
  const hoca = { secimler: Object.fromEntries(em.map((m) => [anahtarYap(m.a, m.b), m.hoca ?? m.a])), skor: hm ? hocaSkoru(hm) : null };
  const abiSecim = Object.fromEntries(em.filter((m) => m.abi).map((m) => [anahtarYap(m.a, m.b), m.abi]));
  const abi = Object.keys(abiSecim).length ? { secimler: abiSecim, skor: skorDuzelt(v.nextWeek.matchOfWeek?.abiScore) } : null;
  // Modelin güveni (yazı malzemesi için): favori ve favori olduğu kategori farkı
  const model = Object.fromEntries(em.map((m) => [anahtarYap(m.a, m.b), { favori: m.hoca, fark: Math.abs(m.skorA - m.skorB) }]));
  return { hafta: v.nextWeek.week, eslesmeler, haftaninMaci, hoca, abi, model, yorum: v.nextWeek.matchOfWeek?.note ?? '' };
}

/** Bitmiş haftaların sonuçları, kurulumdaki ev/deplasman yönüne göre. */
function sonuclariAl(v, kurulum) {
  const w = v.weeks.find((x) => x.week === kurulum.hafta && x.week <= v.week);
  if (!w) return null;
  const sonuc = {};
  for (const e of kurulum.eslesmeler) {
    const m = w.matchups.find((x) => (x.home.id === e.ev && x.away.id === e.dep) || (x.home.id === e.dep && x.away.id === e.ev));
    if (!m || m.status !== 'final') continue;
    const [ev, dep] = m.home.id === e.ev ? [m.home.score, m.away.score] : [m.away.score, m.home.score];
    sonuc[e.anahtar] = { kazanan: ev.wins > dep.wins ? e.ev : dep.wins > ev.wins ? e.dep : null, skor: [ev.wins, dep.wins, ev.ties ?? 0] };
  }
  return Object.keys(sonuc).length ? sonuc : null;
}

/**
 * Bir sayı için tahmin oyunu: sezon tablosu, haftalık sonuçlar ve (varsa) açık hafta.
 * hamlar: bu sayıya kadarki ham sayı dosyaları (eskiden yeniye). s: bu sayının modeli.
 */
export function tahminOyunu(hamlar, s, ayarlar) {
  const bas = Number(ayarlar.tahminOyunuBaslangic ?? Infinity);
  const sonHafta = Number(ayarlar.normalSezonHaftaSayisi) || 19;
  const v = hamlar.at(-1);
  const takimlar = s.takimlar.map((t) => t.id);
  const kurulumlar = hamlar.map(kurulumYap).filter((k) => k && k.hafta >= bas && k.hafta <= sonHafta);
  const sonuclar = {};
  for (const k of kurulumlar) { const r = sonuclariAl(v, k); if (r) sonuclar[k.hafta] = r; }
  const girisler = Object.fromEntries(hamlar.filter((h) => h.predictionEntries).map((h) => [h.week, h.predictionEntries]));
  const sezon = tahminSezonu({ kurulumlar, girisler, sonuclar, takimlar });
  const son = kurulumlar.find((k) => k.hafta === v.nextWeek?.week && v.week < k.hafta) ?? null;
  const acik = son ? { ...son, kapanis: kapanisZamani(s.yayinGunu, ayarlar.saatDilimi), takimlar } : null;
  const puanlananlar = Object.keys(sezon.haftalar).map(Number);
  const sonPuanlanan = puanlananlar.length ? sezon.haftalar[Math.max(...puanlananlar)] : null;
  const sezonBitti = s.hafta >= sonHafta;
  const ligKahini = sezonBitti && sezon.tablo.length ? sezon.tablo.filter((t) => !t.ozel && t.sira === sezon.tablo.find((x) => !x.ozel)?.sira).map((t) => t.id) : [];
  if (!kurulumlar.length && !acik) return null;
  return { baslangic: bas, acik, ...sezon, sonPuanlanan, sezonBitti, ligKahini };
}
