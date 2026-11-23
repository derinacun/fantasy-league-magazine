// Derlemeden sonra (yalnızca Türkçe dışındaki dillerde): sayfa içi bağlantıların hedef kimliklerini
// (#puan, #koc-karnesi …) bağlantının görünen metninden üretilen adlarla değiştirir (#standings, #managers-record …).
// Böylece adres çubuğunda görünen bölüm adları da sitenin dilinde olur. Betiklerin kullandığı kimliklere dokunulmaz.
import { t as _t } from '../src/i18n/t.js';
import fs from 'node:fs';
import path from 'node:path';

const ayarlar = JSON.parse(fs.readFileSync('veri/ayarlar.json', 'utf8'));
if ((ayarlar.dil ?? 'tr') === 'tr') process.exit(0);
const KOK = 'dist';
const sayfalar = [];
(function gez(d) { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); if (f.isDirectory()) gez(p); else if (f.name.endsWith('.html')) sayfalar.push(p); } })(KOK);
const betikler = fs.readdirSync(path.join(KOK, '_astro')).filter((f) => f.endsWith('.js')).map((f) => fs.readFileSync(path.join(KOK, '_astro', f), 'utf8')).join('\n');
const dinamik = /^(oyuncu-\d|kemer-|bilgi-|madalya-)/;
const sade = (s) => s.replace(/<[^>]+>/g, ' ').replace(/&[#\w]+;/g, ' ').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// 1) Hedef kimlik → ilk görülen bağlantı metni
const metin = new Map();
const htmller = new Map();
for (const p of sayfalar) {
  const s = fs.readFileSync(p, 'utf8');
  htmller.set(p, s);
  for (const m of s.matchAll(/<a\b([^>]*)href="[^"]*#([\w-]+)"([^>]*)>([\s\S]*?)<\/a>/g)) {
    const etiket = /aria-label="([^"]+)"/.exec(m[1] + m[3])?.[1] ?? '';
    const id = m[2], yazi = (sade(m[4]) || sade(etiket)).split('-').slice(0, 4).join('-');
    if (!yazi || dinamik.test(id)) continue;
    if (new RegExp(`#${id}(?![\\w-])|getElementById\\(["'\`]${id}["'\`]\\)`).test(betikler)) continue;
    if (!metin.has(id) || yazi.length < metin.get(id).length) metin.set(id, yazi);
  }
}
// 2) Çakışmasız eşleme
const kullanilan = new Set();
for (const p of sayfalar) for (const m of htmller.get(p).matchAll(/\bid="([\w-]+)"/g)) if (!metin.has(m[1])) kullanilan.add(m[1]);
const harita = new Map();
for (const [id, y] of metin) {
  let ad = y, i = 2;
  while (kullanilan.has(ad)) ad = `${y}-${i++}`;
  kullanilan.add(ad); harita.set(id, ad);
}
// Oyuncu ve kemer çapaları önekle çevrilir: #oyuncu-123 → #player-123, #kemer-galibiyet → #belt-wins
const DIL = ayarlar.dil;
const ONEK = { en: { oyuncu: 'player', kemer: 'belt' }, fr: { oyuncu: 'joueur', kemer: 'ceinture' }, es: { oyuncu: 'jugador', kemer: 'cinturon' } }[DIL];
const KEMER = { en: { galibiyet: 'wins', yenilgi: 'losses', uyku: 'sleep', etkilesim: 'chat', kategori: 'category', yuzde: 'pct' },
  fr: { galibiyet: 'victoires', yenilgi: 'defaites', uyku: 'sommeil', etkilesim: 'activite', kategori: 'categorie', yuzde: 'pct' },
  es: { galibiyet: 'victorias', yenilgi: 'derrotas', uyku: 'sueno', etkilesim: 'actividad', kategori: 'categoria', yuzde: 'pct' } }[DIL];
const onekli = (v) => {
  if (/^oyuncu-\d/.test(v)) return `${ONEK.oyuncu}-${v.slice(7)}`;
  if (/^kemer-[a-z]/.test(v)) return `${ONEK.kemer}-${v.slice(6).split('-').map((x) => KEMER[x] ?? x).join('-')}`;
  return null;
};
const cevir = (v) => harita.get(v) ?? onekli(v);
// 3) Uygula: id, href içindeki #…, aria-labelledby / aria-controls / aria-describedby / for
let degisen = 0;
for (const [p, s] of htmller) {
  const y = s
    .replace(/\b(id|for)="([\w-]+)"/g, (t, a, v) => (cevir(v) ? `${a}="${cevir(v)}"` : t))
    .replace(/\b(aria-labelledby|aria-controls|aria-describedby)="([^"]+)"/g, (t, a, v) => `${a}="${v.split(' ').map((x) => harita.get(x) ?? x).join(' ')}"`)
    .replace(/href="([^"#]*)#([\w-]+)"/g, (t, u, v) => (cevir(v) ? `href="${u}#${cevir(v)}"` : t));
  if (y !== s) { fs.writeFileSync(p, y); degisen++; }
}
// İstemci betiğindeki oyuncu çapası öneki
for (const f of fs.readdirSync(path.join(KOK, '_astro')).filter((f) => f.endsWith('.js'))) {
  const p = path.join(KOK, '_astro', f), s = fs.readFileSync(p, 'utf8');
  const y = s.replaceAll(`"#oyuncu-"`, `"#${ONEK.oyuncu}-"`).replaceAll(`'#oyuncu-'`, `'#${ONEK.oyuncu}-'`);
  if (y !== s) fs.writeFileSync(p, y);
}
console.log(_t('✔  Bölüm adresleri çevrildi: {0} kimlik, {1} sayfa', [harita.size, degisen]));
