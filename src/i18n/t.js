// Arayüz çevirisi. Kaynak dil Türkçe: t('Türkçe metin') sözlükte karşılığı varsa onu, yoksa metnin kendisini döndürür.
// Sözlük derlemeden önce scripts/dil.mjs ile veri/ayarlar.json → "dil" alanına göre src/i18n/aktif.json olarak yazılır
// (yalnızca seçili dil pakete girer). Yer tutucular: {0}, {1} … ; çoğul: {0|# team|# teams} (1 için ilk biçim).
import sozluk from './aktif.json' with { type: 'json' };

export const DIL = sozluk.__dil ?? 'tr';
export const YEREL = sozluk.__yerel ?? 'tr-TR';
/** Ondalık ayırıcı: tr, fr, es → ","  en → "." */
export const ONDALIK = sozluk.__ondalik ?? ',';
/** Yüzde işareti dile göre: tr "%48,2", en "48.2%", fr/es "48,2 %". */
export const yuzdeYaz = (v) => (DIL === 'tr' ? `%${v}` : DIL === 'en' ? `${v}%` : `${v}\u202f%`);

// Ligden gelen adlı yer tutucular: {TAKIM} takım sayısı, {RAKIP} rakip sayısı, {ESLESME} haftalık eşleşme sayısı.
const N = Number(sozluk.__takim) || 14;
const ORTAK = { TAKIM: N, RAKIP: N - 1, ESLESME: Math.floor(N / 2) };
const ADLI = /\{(TAKIM|RAKIP|ESLESME)\}/g;

const YER = /\{(\d+)(?:\|([^|}]*)\|([^}]*))?\}/g;

export function t(metin, degerler) {
  const sablon = (sozluk[metin] ?? metin).replace(ADLI, (_, a) => String(ORTAK[a]));
  if (!degerler || degerler.length === 0) return sablon;
  const ilkel = degerler.every((d) => d === null || d === undefined || typeof d !== 'object');
  if (ilkel) {
    return sablon.replace(YER, (_, i, tek, cok) => {
      const v = degerler[+i];
      if (tek === undefined) return v === null || v === undefined ? '' : String(v);
      return (Number(v) === 1 ? tek : cok).replace(/#/g, String(v));
    });
  }
  // Değerlerden biri öğe (Astro düğümü) ise parça dizisi döner; Astro diziyi sırayla basar.
  const parcalar = [];
  let son = 0;
  for (const m of sablon.matchAll(YER)) {
    parcalar.push(sablon.slice(son, m.index));
    const v = degerler[+m[1]];
    parcalar.push(m[2] === undefined ? v : (Number(v) === 1 ? m[2] : m[3]).replace(/#/g, String(v)));
    son = m.index + m[0].length;
  }
  parcalar.push(sablon.slice(son));
  return parcalar;
}

// ---- Adresler dile göre: /hafta/4/takimlar/x/ → /week/4/teams/x/ (en). Türkçede olduğu gibi kalır.
const YOLLAR = {
  en: { hafta: 'week', istatistikler: 'stats', analiz: 'analysis', karsilastir: 'compare', takimlar: 'teams', oyuncular: 'players', takas: 'trades', kursu: 'podium', kehanet: 'forecast', 'kupa-dolabi': 'trophies', kupa: 'trophies', metodoloji: 'methodology', arsiv: 'archive', kapak: 'cards', tablo: 'tables' },
  fr: { hafta: 'semaine', istatistikler: 'stats', analiz: 'analyse', karsilastir: 'comparer', takimlar: 'equipes', oyuncular: 'joueurs', takas: 'echanges', kursu: 'podium', kehanet: 'pronostics', 'kupa-dolabi': 'trophees', kupa: 'trophees', metodoloji: 'methodologie', arsiv: 'archives', kapak: 'cartes', tablo: 'tableaux' },
  es: { hafta: 'semana', istatistikler: 'estadisticas', analiz: 'analisis', karsilastir: 'comparar', takimlar: 'equipos', oyuncular: 'jugadores', takas: 'traspasos', kursu: 'podio', kehanet: 'pronosticos', 'kupa-dolabi': 'trofeos', kupa: 'trofeos', metodoloji: 'metodologia', arsiv: 'archivo', kapak: 'tarjetas', tablo: 'tablas' },
};
const DOSYA = {
  en: { takim: 'team', 'son-hafta': 'last-week', 'tum-haftalar': 'all-weeks', sezon: 'season' },
  fr: { takim: 'equipe', 'son-hafta': 'derniere-semaine', 'tum-haftalar': 'toutes-semaines', sezon: 'saison' },
  es: { takim: 'equipo', 'son-hafta': 'ultima-semana', 'tum-haftalar': 'todas-semanas', sezon: 'temporada' },
};
const SORGU = {
  en: { hafta: 'week', kapsam: 'scope', takim: 'team', filtre: 'filter', ara: 'search' },
  fr: { hafta: 'semaine', kapsam: 'portee', takim: 'equipe', filtre: 'filtre', ara: 'recherche' },
  es: { hafta: 'semana', kapsam: 'alcance', takim: 'equipo', filtre: 'filtro', ara: 'buscar' },
};
const DEGER = {
  en: { sezon: 'season', birakildi: 'dropped', eklendi: 'added', il: 'injured' },
  fr: { sezon: 'saison', birakildi: 'retires', eklendi: 'ajoutes', il: 'blesses' },
  es: { sezon: 'temporada', birakildi: 'bajas', eklendi: 'altas', il: 'lesionados' },
};
/** Tek bir adres parçası (klasör adı) */
export const yolParcasi = (s) => YOLLAR[DIL]?.[s] ?? s;
/** Dosya adı: hafta-04-takim-x.png → week-04-team-x.png */
export function dosyaAdi(ad) {
  const m = /^hafta-(\d+)(?:-(.+?))?\.(png|csv)$/.exec(ad);
  if (!m || DIL === 'tr') return ad;
  let ek = m[2] ?? '';
  if (ek.startsWith('takim-')) ek = `${DOSYA[DIL].takim}-${ek.slice(6)}`;
  else if (ek) ek = DOSYA[DIL][ek] ?? YOLLAR[DIL][ek] ?? ek;
  return `${YOLLAR[DIL].hafta}-${m[1]}${ek ? '-' + ek : ''}.${m[3]}`;
}
/** Sorgu adı ve değeri */
export const sorguAdi = (k) => SORGU[DIL]?.[k] ?? k;
export const sorguDegeri = (v) => (v == null ? v : DEGER[DIL]?.[v] ?? v);
export function sorguDegeriGeri(v) {
  if (v == null || DIL === 'tr') return v;
  const e = Object.entries(DEGER[DIL]).find(([, x]) => x === v);
  return e ? e[0] : v;
}
/** Sitenin içindeki bir adresi seçili dile çevirir (yol, dosya adı, sorgu). Türkçede değişmez. */
export function yol(adres) {
  if (DIL === 'tr' || typeof adres !== 'string' || !adres.startsWith('/') || adres.startsWith('/api/')) return adres;
  const m = /^([^?#]*)(\?[^#]*)?(#.*)?$/.exec(adres);
  const parca = m[1].split('/').map((s) => (YOLLAR[DIL][s] ? YOLLAR[DIL][s] : /^hafta-\d+.*\.(png|csv)$/.test(s) ? dosyaAdi(s) : s)).join('/');
  const sorgu = m[2] ? '?' + m[2].slice(1).split('&').map((kv) => { const [k, v] = kv.split('='); return v === undefined ? sorguAdi(k) : `${sorguAdi(k)}=${sorguDegeri(v)}`; }).join('&') : '';
  return parca + sorgu + (m[3] ?? '');
}
/** Dosya adı eki: 'son-hafta' → 'last-week' (en) */
export const dosyaEki = (k) => (DIL === 'tr' ? k : DOSYA[DIL][k] ?? k);
