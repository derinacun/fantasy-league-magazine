// Tahmin oyununun açık haftası (18 Kasım 2026): Worker girişleri buna göre kontrol eder (src/lib/tahmin.js → girisKontrol).
import { t as _t } from '../i18n/t.js';
import { tumSayilar } from '../lib/model.js';

export function GET() {
  const { sayilar } = tumSayilar();
  const a = sayilar.at(-1).tahminOyunu?.acik ?? null;
  const veri = a ? { hafta: a.hafta, kapanis: a.kapanis, takimlar: a.takimlar, haftaninMaci: a.haftaninMaci, eslesmeler: a.eslesmeler } : { hafta: null };
  return new Response(JSON.stringify(veri), { headers: { 'Content-Type': _t('application/json; charset=utf-8') } });
}
