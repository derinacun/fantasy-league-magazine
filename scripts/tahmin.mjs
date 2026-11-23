// Tahmin oyunu yazı malzemesi (18 Kasım 2026): `node scripts/tahmin.mjs NN`
// NN. sayıdaki puanlar ve Hoca ile Abi'nin laf atacağı malzeme: garanti maçta ters köşeye yatanlar, tek başına bilenler,
// çoğunluğun yanıldığı maçlar, kendi takımına karşı oynayanlar. Önce predictionEntries yazılmış olmalı (docs/WEEKLY.md).
import { t as _t } from '../src/i18n/t.js';
import { tumSayilar } from '../src/lib/model.js';
import { skorYaz, OZEL } from '../src/lib/tahmin.js';

const n = Number(process.argv[2]);
const { sayilar } = tumSayilar();
const s = n ? sayilar.find((x) => x.hafta === n) : sayilar.at(-1);
if (!s) { console.error(_t('{0}. sayı yok', [n])); process.exit(1); }
const h = s.tahminOyunu?.haftalar?.[s.hafta];
if (!h) { console.log(_t('{0}. hafta için puanlanmış tahmin yok (predictionEntries yazıldı mı?).', [s.hafta])); process.exit(0); }
const ad = (id) => OZEL[id] ?? s.takim[id]?.ad ?? id;
const mac = (k) => k.split('-').map(ad).join(' – ');
console.log(_t('{0}. hafta tahmin oyunu · {1} koç', [s.hafta, h.katilim]));
console.log('\nPuanlar:');
for (const x of h.satirlar) console.log(`  ${String(x.puan).padStart(2)}  ${ad(x.id)}  (${x.dogru}/${x.sayilan}${x.tam ? _t(', tam skor') : ''})${h.kahinler.includes(x.id) ? _t('  ← Haftanın kâhini') : ''}`);
console.log(_t('\nHaftanın maçı: {0} {1}', [mac(h.haftaninMaci), skorYaz(h.sonuc[h.haftaninMaci]?.skor)]));
const M = h.malzeme;
console.log(_t('\nGaranti maçta ters köşe (gömülecekler):'));
if (!M.garanti.length) console.log('  yok');
for (const g of M.garanti) console.log(_t('  {0} {1} · model {2} kategori fark görmüştü · {3} diyenler: {4} (bilen {5})', [mac(g.anahtar), skorYaz(g.skor), g.modelFark ?? '?', ad(g.kaybeden), g.yanilan.map(ad).join(', '), g.bilen]));
console.log(_t('\nTek başına bilen:'));
for (const t of M.tekDogru) console.log(`  ${ad(t.kim)}: ${mac(t.anahtar)} → ${ad(t.kazanan)} ${skorYaz(t.skor)}`);
if (!M.tekDogru.length) console.log('  yok');
console.log(_t('\nÇoğunluğun yanıldığı maçlar:'));
for (const c of M.cogunlukYanildi) console.log(_t('  {0} → {1} kazandı; {2} yanıldı, {3} bildi', [mac(c.anahtar), ad(c.kazanan), c.yanilan, c.bilen]));
if (!M.cogunlukYanildi.length) console.log('  yok');
console.log(_t('\nKendi takımına karşı oynayan:'));
for (const k of M.kendineKarsi) console.log(`  ${ad(k.kim)} (${mac(k.anahtar)}) · ${k.hakliCikti ? _t('haklı çıktı') : _t('kendi takımı kazandı, tahmini yandı')}`);
if (!M.kendineKarsi.length) console.log('  yok');
console.log(_t('\nKendi maçında kendine oynayıp kaybeden:'));
console.log(M.kendiMaciniBilemeyen.length ? '  ' + M.kendiMaciniBilemeyen.map((k) => ad(k.kim)).join(', ') : '  yok');
const tablo = s.tahminOyunu.tablo;
console.log('\nSezon: ' + tablo.slice(0, 5).map((t) => `${t.sira}. ${ad(t.id)} ${t.puan}`).join(' · ') + _t(' · sonuncu {0} {1}', [ad(tablo.at(-1).id), tablo.at(-1).puan]));
