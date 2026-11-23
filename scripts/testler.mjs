// Bütün testler: `npm run build` dogrula'dan sonra bunu çalıştırır; bir test düşerse site derlenmez,
// önceki sayı yayında kalır. Elle: `npm run testler`.
// 1) Sitenin hesap testleri (tests/*.test.mjs, Node) her zaman çalışır.
// 2) Excel dönüştürücü testleri (tests/test_*.py, Python + openpyxl) Python ve openpyxl varsa çalışır.
//    Cloudflare'in derleme ortamında openpyxl yoksa atlanır ve kayda yazılır: bu testler sitenin değil,
//    Claude'un haftalık Excel → JSON betiğinin (scripts/excelden.py) kontrolüdür ve Claude'un ortamında
//    her hafta yüklemeden önce çalıştırılır (docs/WEEKLY.md).
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';

const kok = new URL('..', import.meta.url).pathname;
const dosyalar = readdirSync(new URL('../tests/', import.meta.url)).filter((f) => f.endsWith('.test.mjs')).map((f) => `tests/${f}`);

console.log(`Testler: Node (${dosyalar.length} dosya)`);
const node = spawnSync(process.execPath, ['--test', ...dosyalar], { cwd: kok, stdio: 'inherit' });
if (node.status !== 0) {
  console.error('\nHATA: Node testlerinden biri düştü; site derlenmedi. Yukarıdaki "not ok" satırına bak.');
  process.exit(1);
}

const pyAdi = ['python3', 'python'].find((p) => spawnSync(p, ['-c', 'import openpyxl'], { stdio: 'ignore' }).status === 0);
if (!pyAdi) {
  console.log('Python testleri atlandı: bu ortamda Python ya da openpyxl yok (Excel kontrolleri Claude\'un ortamında çalışır).');
  process.exit(0);
}
console.log('Testler: Python (Excel kontrolleri)');
const py = spawnSync(pyAdi, ['-B', '-m', 'unittest', 'discover', '-s', 'tests', '-p', 'test_*.py'], {
  cwd: kok, stdio: 'inherit', env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1', CEVIRI_DIL: 'tr' },
});
if (py.status !== 0) {
  console.error('\nHATA: Python testlerinden biri düştü; site derlenmedi.');
  process.exit(1);
}
console.log('Bütün testler geçti.');
