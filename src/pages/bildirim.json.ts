// Yeni sayı bildiriminin içeriği (17 Kasım 2026): Worker hangi sayının yayında olduğunu buradan okur;
// telefondaki hizmet çalışanı bildirim gelince bu dosyadan takıma özel satırı ve manşeti alır.
import { t as _t } from '../i18n/t.js';
import { tumSayilar } from '../lib/model.js';

export function GET() {
  const { sayilar, ayarlar } = tumSayilar();
  const s = sayilar.at(-1);
  const takim = Object.fromEntries(s.takimlar.map((t: any) => {
    const m = s.eslesmeler.find((e: any) => e.ev === t.id || e.dep === t.id);
    if (!m) return [t.id, null];
    const ben = m.ev === t.id ? m.evSkor : m.depSkor, o = m.ev === t.id ? m.depSkor : m.evSkor;
    const durum = m.kazanan == null ? _t('berabere') : m.kazanan === t.id ? _t('kazandı') : _t('kaybetti');
    return [t.id, `${t.ad} ${ben}–${o}${m.beraber ? `–${m.beraber}` : ''} ${durum}`];
  }));
  const veri = {
    sayi: s.hafta,
    baslik: _t('{0} · {1}. sayı çıktı', [ayarlar.gazeteAdi ?? 'League Newspaper', s.hafta]),
    manset: s.baslik.replace(/⁠/g, ''),
    takim,
    adres: '/',
    siteAdresi: ayarlar.siteAdresi,
    anahtar: ayarlar.bildirimAnahtari ?? '',
  };
  return new Response(JSON.stringify(veri), { headers: { 'Content-Type': _t('application/json; charset=utf-8') } });
}
