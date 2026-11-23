// Yeni sayı bildirimi (17 Kasım 2026): abonelik kaydı, imza ve gönderim mantığı (gerçek ağ kullanılmaz).
import test from 'node:test';
import assert from 'node:assert/strict';
import { abone, vapidJwt, bildirimGonder } from '../worker/index.js';

const sahteKV = () => {
  const m = new Map();
  return { m, get: async (k) => m.get(k) ?? null, put: async (k, v) => void m.set(k, v), delete: async (k) => void m.delete(k),
    list: async ({ prefix }) => ({ keys: [...m.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })), list_complete: true }) };
};
const anahtarCifti = async () => {
  const k = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  return { k, jwk: JSON.stringify(await crypto.subtle.exportKey('jwk', k.privateKey)) };
};
const istek = (govde, yontem = 'POST') => new Request('https://site/api/abone', { method: yontem, body: JSON.stringify(govde) });

test('abonelik: geçerli kayıt saklanır, takım kimliği dışında bilgi tutulmaz; geçersiz adres reddedilir', async () => {
  const env = { ABONELER: sahteKV() };
  const y = await abone(istek({ abonelik: { endpoint: 'https://push.example/abc', keys: { p256dh: 'x', auth: 'y' } }, takim: '5' }), env);
  assert.equal(y.status, 200);
  const [deger] = [...env.ABONELER.m.values()];
  assert.deepEqual(Object.keys(JSON.parse(deger)).sort(), ['endpoint', 'takim', 'tarih']);
  assert.equal((await abone(istek({ abonelik: { endpoint: 'http://kotu' } }), env)).status, 400);
  assert.equal((await abone(istek({ abonelik: { endpoint: 'https://push.example/abc' } }, 'DELETE'), env)).status, 200);
  assert.equal(env.ABONELER.m.size, 0);
});

test('imza: VAPID jetonu açık anahtarla doğrulanır ve doğru adrese yazılır', async () => {
  const { k, jwk } = await anahtarCifti();
  const jwt = await vapidJwt('https://fcm.googleapis.com/fcm/send/xyz', { VAPID_PRIVATE_JWK: jwk }, 'https://gazete.example');
  const [b, g, i] = jwt.split('.');
  const coz = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
  assert.ok(await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, k.publicKey, coz(i), new TextEncoder().encode(`${b}.${g}`)));
  assert.equal(JSON.parse(new TextDecoder().decode(coz(g))).aud, 'https://fcm.googleapis.com');
});

test('gönderim: ilk çalışmada gönderilmez; yeni sayıda bir kez gönderilir; kapanmış abonelik silinir', async () => {
  const { jwk } = await anahtarCifti();
  let sayi = 4;
  const env = { ABONELER: sahteKV(), VAPID_PRIVATE_JWK: jwk,
    ASSETS: { fetch: async () => new Response(JSON.stringify({ sayi, siteAdresi: 'https://gazete.example', anahtar: 'A' })) } };
  await env.ABONELER.put('abone:1', JSON.stringify({ endpoint: 'https://push.example/1' }));
  await env.ABONELER.put('abone:2', JSON.stringify({ endpoint: 'https://push.example/2' }));
  const gidenler = [];
  const eski = globalThis.fetch;
  globalThis.fetch = async (u) => { gidenler.push(u); return new Response(null, { status: u.endsWith('/2') ? 410 : 201 }); };
  try {
    assert.deepEqual(await bildirimGonder(env), { ilkKurulum: 4 });
    assert.equal(gidenler.length, 0);
    assert.deepEqual(await bildirimGonder(env), { yeniSayiYok: 4 });
    sayi = 5;
    assert.deepEqual(await bildirimGonder(env), { sayi: 5, gonderilen: 1, silinen: 1 });
    assert.deepEqual(await bildirimGonder(env), { yeniSayiYok: 5 });
    assert.equal(gidenler.length, 2);
  } finally { globalThis.fetch = eski; }
});
