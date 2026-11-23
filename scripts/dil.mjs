// Derlemeden önce: veri/ayarlar.json → "dil" (tr, en, fr, es) sözlüğünü src/i18n/aktif.json olarak yazar.
import fs from 'node:fs';
const ayarlar = JSON.parse(fs.readFileSync('veri/ayarlar.json', 'utf8'));
// Komut satırında dil verilirse o kullanılır (testler her zaman kaynak dil Türkçeyle çalışır: node scripts/dil.mjs tr).
const dil = process.argv[2] ?? ayarlar.dil ?? 'tr';
const YEREL = { tr: 'tr-TR', en: 'en-GB', fr: 'fr-FR', es: 'es-ES' };
if (!YEREL[dil]) { console.error(`✖  veri/ayarlar.json → dil: "${dil}" desteklenmiyor (tr, en, fr, es).`); process.exit(1); }
const sozluk = dil === 'tr' ? {} : JSON.parse(fs.readFileSync(`src/i18n/${dil}.json`, 'utf8'));
// Takım sayısı son sayı dosyasından ({TAKIM}, {RAKIP}, {ESLESME} yer tutucuları için).
const haftalar = fs.existsSync('veri/haftalar') ? fs.readdirSync('veri/haftalar').filter((f) => /^hafta-\d+\.json$/.test(f)).sort() : [];
const takim = haftalar.length ? JSON.parse(fs.readFileSync(`veri/haftalar/${haftalar.at(-1)}`, 'utf8')).teams?.length : null;
fs.writeFileSync('src/i18n/aktif.json', JSON.stringify({ __dil: dil, __yerel: ayarlar.yerel ?? YEREL[dil], __takim: takim ?? 14, __ondalik: dil === 'en' ? '.' : ',', ...sozluk }));
if (!process.argv[2]) console.log(`✔  Arayüz dili: ${dil}`);
