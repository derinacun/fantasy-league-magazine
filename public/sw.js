// League Newspaper hizmet çalışanı: önce ağ, ağ yoksa daha önce açılmış sayfa.
// Böylece site her zaman güncel gelir; internet yokken son okunan sayfalar açılır.
const ONBELLEK = 'ln-v2';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const ad of await caches.keys()) if (ad !== ONBELLEK && ad !== 'ln-ayar') await caches.delete(ad);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const istek = e.request;
  if (istek.method !== 'GET') return;
  const adres = new URL(istek.url);
  if (adres.origin !== self.location.origin) return;
  if (adres.pathname.endsWith('.csv') || adres.pathname.startsWith('/api/') || adres.pathname === '/bildirim.json' || adres.pathname === '/tahmin.json') return;
  e.respondWith((async () => {
    try {
      const yanit = await fetch(istek);
      if (yanit.ok && (istek.mode === 'navigate' || /\/(_astro|gorsel)\//.test(adres.pathname) || /\.(png|svg|webmanifest)$/.test(adres.pathname))) {
        const kopya = yanit.clone();
        caches.open(ONBELLEK).then((c) => c.put(istek, kopya)).catch(() => {});
      }
      return yanit;
    } catch (hata) {
      const eski = await caches.match(istek, { ignoreSearch: istek.mode === 'navigate' });
      if (eski) return eski;
      if (istek.mode === 'navigate') {
        const ana = await caches.match('/');
        if (ana) return ana;
      }
      throw hata;
    }
  })());
});

// ---- Yeni sayı bildirimi (17 Kasım 2026) ----
// Sayfa seçili takımı gönderir; burada küçük bir önbellekte saklanır.
const AYAR = 'ln-ayar';
self.addEventListener('message', (e) => {
  if (e.data?.tip === 'takim') e.waitUntil(caches.open(AYAR).then((c) => c.put('/__takim', new Response(String(e.data.id || '')))));
});
// Bildirim içeriksiz gelir: içerik /bildirim.json'dan; takım seçiliyse önce takımın sonucu.
self.addEventListener('push', (e) => {
  e.waitUntil((async () => {
    let veri = null;
    try { veri = await (await fetch('/bildirim.json', { cache: 'no-store' })).json(); } catch { /* ağ yok */ }
    let takim = '';
    try { takim = await (await (await caches.open(AYAR)).match('/__takim'))?.text() ?? ''; } catch { /* yok */ }
    const satir = veri && takim && veri.takim?.[takim] ? `${veri.takim[takim]} · ` : '';
    await self.registration.showNotification(veri?.baslik ?? 'New issue', {
      body: veri ? `${satir}${veri.manset}` : 'Yeni sayı yayında.',
      icon: '/simge-192.png?s=2', badge: '/simge-192.png?s=2', tag: `ln-sayi-${veri?.sayi ?? ''}`, data: { adres: veri?.adres ?? '/' },
    });
  })());
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const adres = e.notification.data?.adres ?? '/';
  e.waitUntil((async () => {
    const pencereler = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const p of pencereler) if ('focus' in p) { await p.navigate(adres).catch(() => {}); return p.focus(); }
    return self.clients.openWindow(adres);
  })());
});
