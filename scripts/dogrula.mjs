// Kullanım: npm run dogrula
// Derlemeden önce otomatik çalışır. Hata varsa derleme durur, yayındaki eski sürüm kalır.
import { t as _t } from '../src/i18n/t.js';
import { tumunuDogrula } from '../src/lib/dogrulama.js';
import { haftaDosyalariniOku, kadroDosyalariniOku } from '../src/lib/okuma.js';
import { kadrolariDogrula } from '../src/lib/kadro.js';

const dosyalar = haftaDosyalariniOku();
const kadrolar = kadroDosyalariniOku();
const h = tumunuDogrula(dosyalar), k = kadrolariDogrula(kadrolar, dosyalar);
const hatalar = [...h.hatalar, ...k.hatalar], uyarilar = [...h.uyarilar, ...k.uyarilar];

console.log(_t('\nVeri kontrolü: {0} hafta dosyası, {1} kadro dosyası okundu.', [dosyalar.length, kadrolar.size]));
if (uyarilar.length) {
  console.log(_t('\n⚠  {0} uyarı (yayını durdurmaz):', [uyarilar.length]));
  for (const u of uyarilar) console.log('  - ' + u);
}
if (hatalar.length) {
  console.error(_t('\n✖  {0} hata. Site derlenmedi, yayındaki önceki sürüm duruyor:', [hatalar.length]));
  for (const h of hatalar) console.error('  - ' + h);
  console.error(_t('\nDüzeltip dosyayı yeniden gönder. Ayrıntılar: docs/WEEKLY.md\n'));
  process.exit(1);
}
console.log(_t('\n✔  Veri dosyaları geçerli.\n'));
