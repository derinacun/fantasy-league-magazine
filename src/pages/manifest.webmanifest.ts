// Ana ekrana ekleme tanımı (uygulama adı, simgeler, renkler).
import { t as _t } from '../i18n/t.js';
import { tumSayilar } from '../lib/model.js';

export function GET() {
  const { ayarlar } = tumSayilar();
  const ad = ayarlar.gazeteAdi ?? ayarlar.ligAdi;
  const tanim = {
    name: `${ad} · ${ayarlar.ligAdi}`,
    short_name: ad,
    description: _t('{0} lig gazetesi: haftalık manşet, skorlar, puan durumu ve istatistikler.', [ayarlar.ligAdi]),
    lang: 'tr',
    start_url: '/?kaynak=ana-ekran',
    scope: '/',
    display: 'standalone',
    background_color: '#f5f5f7',
    theme_color: '#f5f5f7',
    icons: [
      { src: '/simge-192.png?s=2', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/simge-512.png?s=2', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/simge-maskeli-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
  return new Response(JSON.stringify(tanim, null, 2), { headers: { 'Content-Type': _t('application/manifest+json; charset=utf-8') } });
}
