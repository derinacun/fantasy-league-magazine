// Kehanet (17 Kasım 2026): Analitik Hoca ile Tribün Abi'nin sayfası. Şans endeksi (src/lib/analiz.js → sans)
// ve adil puan durumu: fikstür herkes için eşit olsaydı sıralama = sezon boyunca beklenen kategori toplamına göre.
// Beklenen: her hafta takımın 13 rakibin her birine karşı alacağı kategori sayısının ortalaması.
import { t as _t, ONDALIK } from '../i18n/t.js';
import { analizHesapla } from './analiz.js';

const ondalik = (v, d = 1) => v.toFixed(d).replace('.', ONDALIK);
const isaretli = (v) => (v > 0.05 ? '+' : v < -0.05 ? '−' : '±') + ondalik(Math.abs(v));

export function kehanetHesapla(sayi) {
  const A = analizHesapla(sayi);
  const hafta = sayi.haftaSayisi || 1;
  const sans = A.sans.map((s) => ({ ...s, haftalikGercek: s.gercek / hafta, haftalikBeklenen: s.beklenen / hafta }));
  // Adil sıra: beklenen toplamı yüksek olan önde; eşitlikte veri sırası korunur.
  const adil = [...sans].sort((a, b) => b.beklenen - a.beklenen).map((s, i) => {
    const yahoo = sayi.puanDurumu?.[s.id]?.rank ?? null;
    return { ...s, adilSira: i + 1, yahooSira: yahoo, kayit: sayi.puanDurumu?.[s.id] ?? null, fark: s.fark, basamak: yahoo != null ? yahoo - (i + 1) : null }; // + : fikstür aşağı itti, − : yukarı taşıdı
  });
  const sansli = sans[0], sanssiz = sans.at(-1);
  const enCokYukarida = [...adil].filter((x) => x.basamak != null).sort((a, b) => a.basamak - b.basamak)[0];
  const enCokAsagida = [...adil].filter((x) => x.basamak != null).sort((a, b) => b.basamak - a.basamak)[0];
  return { sans, sansSiniri: A.sansSiniri, adil, sansli, sanssiz, enCokYukarida, enCokAsagida, hafta, kategoriSiniri: hafta * 9 };
}

/** Claude forecastColumn yazmazsa hazır cümleler (yalnızca sayılardan). */
export function kehanetHazirMetin(sayi, K) {
  const ad = (id) => sayi.takim[id]?.ad ?? id;
  const p = sayi.defter?.puan;
  const hoca = _t('Şans endeksinde en şanslı {0} ({1} kategori), en şanssız {2} ({3}). Fikstür eşit olsaydı lider {4} olurdu; Yahoo\'da {5}.', [ad(K.sansli.id), isaretli(K.sansli.fark), ad(K.sanssiz.id), isaretli(K.sanssiz.fark), ad(K.adil[0].id), K.adil[0].yahooSira]);
  const abi = p && p.mac
    ? _t('İddia defterinde {0}–{1}. {2}', [p.hoca, p.abi, p.abi > p.hoca ? _t('Tribün önde, Excel arkadan geliyor.') : p.abi < p.hoca ? _t('Excel önde ama sezon uzun.') : _t('Berabere; tribün de Excel de pes etmiyor.')])
    : _t('İddia defteri yeni açıldı; tribün hazır.');
  return { hoca, abi };
}
