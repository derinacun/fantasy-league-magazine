// Push notification keys (one-time setup). Run: node scripts/anahtar-uret.mjs
// Prints: 1) the public key → put it in veri/ayarlar.json as "bildirimAnahtari"
//         2) the private key (JWK) → add it in Cloudflare as the secret VAPID_PRIVATE_JWK. Never commit it.
import { t as _t } from '../src/i18n/t.js';
const anahtar = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const ham = new Uint8Array(await crypto.subtle.exportKey('raw', anahtar.publicKey));
const b64url = (b) => Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const ozel = await crypto.subtle.exportKey('jwk', anahtar.privateKey);
console.log('\n' + _t('veri/ayarlar.json → "bildirimAnahtari":') + '\n' + b64url(ham));
console.log('\n' + _t('Gizli anahtar için Cloudflare\'da Worker → Settings → Variables and Secrets → Secret "VAPID_PRIVATE_JWK" ekle:') + '\n' + JSON.stringify(ozel));
console.log('\n' + _t('Gizli anahtarı kimseyle paylaşma; sohbete, depoya ya da bir konuya yapıştırma.') + '\n');
