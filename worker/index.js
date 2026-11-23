// League Newspaper Worker (17 Kasım 2026): site statik dosyalardan sunulur (ASSETS); bunun üstüne iki iş:
// 1) /api/abone — telefondaki ana ekran uygulamasının bildirim aboneliğini saklar (Cloudflare KV, ABONELER).
// 2) Saatlik zamanlanmış iş — yeni sayı yayına girdiyse her aboneye bir kez bildirim gönderir.
//    Bildirim içeriksiz gönderilir; telefondaki hizmet çalışanı (public/sw.js) /bildirim.json'u okuyup
//    seçili takımın sonucunu ve manşeti gösterir. Böylece şifreleme gerekmez.
// 3) /api/tahmin — okur tahmin oyunu (18 Kasım 2026): koçun tahminini saklar (KV, aynı ABONELER deposu, "tahmin:" önekiyle);
//    kapanıştan (sayının yayınlandığı Pazartesi 23:59) önce yalnızca kimin girdiği, sonra herkesin tahmini görünür.
// Gizli anahtar: VAPID_PRIVATE_JWK (Cloudflare panelinde "Variables and Secrets" → Secret). Açık anahtar veri/ayarlar.json'da.
// Abonelikte yalnızca tarayıcının verdiği adres ve seçili takım kimliği saklanır; isim, telefon, e-posta yok.

import { t as _t } from '../src/i18n/t.js';
import { t } from '../src/i18n/t.js';
import { girisKontrol } from '../src/lib/tahmin.js';

const JSON_YANIT = (veri, durum = 200) => new Response(JSON.stringify(veri), { status: durum, headers: { 'Content-Type': t(_t('application/json; charset=utf-8')), 'Cache-Control': 'no-store' } });
const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const metinB64url = (s) => b64url(new TextEncoder().encode(s));
async function anahtar(metin) {
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(metin));
  return 'abone:' + b64url(h).slice(0, 32);
}

async function abone(istek, env) {
  if (!env.ABONELER) return JSON_YANIT({ hata: t(_t('Bildirim deposu kurulmamış')) }, 503);
  let veri;
  try { veri = await istek.json(); } catch { return JSON_YANIT({ hata: t(_t('Geçersiz istek')) }, 400); }
  const ab = veri?.abonelik;
  const takim = typeof veri?.takim === 'string' && /^\d{1,2}$/.test(veri.takim) ? veri.takim : '';
  if (!ab || typeof ab.endpoint !== 'string' || !/^https:\/\//.test(ab.endpoint) || ab.endpoint.length > 800) return JSON_YANIT({ hata: t(_t('Geçersiz abonelik')) }, 400);
  const k = await anahtar(ab.endpoint);
  if (istek.method === 'DELETE') { await env.ABONELER.delete(k); return JSON_YANIT({ tamam: true }); }
  await env.ABONELER.put(k, JSON.stringify({ endpoint: ab.endpoint, takim, tarih: new Date().toISOString() }));
  return JSON_YANIT({ tamam: true });
}

async function vapidJwt(endpoint, env, siteAdresi) {
  const jwk = JSON.parse(env.VAPID_PRIVATE_JWK);
  const k = await crypto.subtle.importKey('jwk', { ...jwk, key_ops: ['sign'] }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const govde = `${metinB64url(JSON.stringify({ typ: 'JWT', alg: 'ES256' }))}.${metinB64url(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: siteAdresi }))}`;
  const imza = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, k, new TextEncoder().encode(govde));
  return `${govde}.${b64url(imza)}`;
}

async function bildirimGonder(env, zorla = false) {
  if (!env.ABONELER || !env.VAPID_PRIVATE_JWK) return { atlandi: t(_t('kurulum eksik')) };
  const veri = await (await env.ASSETS.fetch(new Request('https://site/bildirim.json'))).json();
  const son = await env.ABONELER.get('son-gonderilen-sayi');
  if (son == null && !zorla) { await env.ABONELER.put('son-gonderilen-sayi', String(veri.sayi)); return { ilkKurulum: veri.sayi }; }
  if (!zorla && Number(son) >= veri.sayi) return { yeniSayiYok: veri.sayi };
  const acik = veri.anahtar;
  let gonderilen = 0, silinen = 0, imleç;
  do {
    const liste = await env.ABONELER.list({ prefix: 'abone:', cursor: imleç });
    for (const { name } of liste.keys) {
      const ab = JSON.parse((await env.ABONELER.get(name)) || 'null');
      if (!ab) continue;
      const jwt = await vapidJwt(ab.endpoint, env, veri.siteAdresi);
      const y = await fetch(ab.endpoint, { method: 'POST', headers: { Authorization: t(_t('vapid t={0}, k={1}'), [jwt, acik]), TTL: '86400', Urgency: 'normal', 'Content-Length': '0' } }).catch(() => null);
      if (y && (y.status === 404 || y.status === 410)) { await env.ABONELER.delete(name); silinen++; } else if (y && y.ok) gonderilen++;
    }
    imleç = liste.list_complete ? null : liste.cursor;
  } while (imleç);
  await env.ABONELER.put('son-gonderilen-sayi', String(veri.sayi));
  return { sayi: veri.sayi, gonderilen, silinen };
}

async function acikHafta(env) {
  return (await env.ASSETS.fetch(new Request('https://site/tahmin.json'))).json();
}

async function tahminler(env, hafta) {
  const sonuc = {};
  let imleç;
  do {
    const liste = await env.ABONELER.list({ prefix: `tahmin:${hafta}:`, cursor: imleç });
    for (const { name } of liste.keys) {
      const x = JSON.parse((await env.ABONELER.get(name)) || 'null');
      if (x) sonuc[name.split(':')[2]] = x;
    }
    imleç = liste.list_complete ? null : liste.cursor;
  } while (imleç);
  return sonuc;
}

async function tahmin(istek, env, url) {
  if (!env.ABONELER) return JSON_YANIT({ hata: t(_t('Tahmin deposu kurulmamış')) }, 503);
  const acik = await acikHafta(env);
  if (istek.method === 'POST') {
    let govde;
    try { govde = await istek.json(); } catch { return JSON_YANIT({ hata: t(_t('Geçersiz istek')) }, 400); }
    const k = girisKontrol(govde, acik);
    if (!k.tamam) return JSON_YANIT({ hata: k.hata }, 400);
    const { takim, hafta, secimler, skor } = k.kayit;
    await env.ABONELER.put(`tahmin:${hafta}:${takim}`, JSON.stringify({ picks: secimler, score: skor, time: new Date().toISOString() }));
    return JSON_YANIT({ tamam: true });
  }
  const hafta = Number((url.searchParams.get('hafta') ?? url.searchParams.get('week') ?? url.searchParams.get('semaine') ?? url.searchParams.get('semana')) || acik.hafta);
  if (!Number.isInteger(hafta) || hafta < 1 || (acik.hafta && hafta > acik.hafta)) return JSON_YANIT({ hata: t(_t('Bu hafta için tahmin yok')) }, 404);
  const hepsi = await tahminler(env, hafta);
  const kapandi = hafta !== acik.hafta || Date.now() >= Date.parse(acik.kapanis);
  const girenler = Object.keys(hepsi).sort((a, b) => a - b);
  // Kapanıştan önce kimin ne dediği gizli; yalnızca kimin girdiği.
  if (!kapandi) return JSON_YANIT({ hafta, kapandi, kapanis: acik.kapanis, girenler });
  const temiz = Object.fromEntries(Object.entries(hepsi).map(([id, x]) => [id, { picks: x.picks, score: x.score }]));
  return JSON_YANIT({ hafta, kapandi, girenler, predictionEntries: temiz });
}

export default {
  async fetch(istek, env) {
    const url = new URL(istek.url);
    if (url.pathname === '/api/abone' && (istek.method === 'POST' || istek.method === 'DELETE')) return abone(istek, env);
    if (url.pathname === '/api/tahmin' && (istek.method === 'GET' || istek.method === 'POST')) return tahmin(istek, env, url);
    if (url.pathname.startsWith('/api/')) return JSON_YANIT({ hata: t(_t('Bulunamadı')) }, 404);
    return env.ASSETS.fetch(istek);
  },
  async scheduled(_olay, env, ctx) {
    ctx.waitUntil(bildirimGonder(env));
  },
};
export { bildirimGonder, vapidJwt, abone, tahmin };
