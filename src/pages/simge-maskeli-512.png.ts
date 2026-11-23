// Android uyarlanabilir simge: çizim daire maskesinin güvenli alanında kalır.
import { simgePng } from '../lib/gorsel.js';
export async function GET() { return new Response(await simgePng(512, { kose: false, olcek: 0.78 }), { headers: { 'Content-Type': 'image/png' } }); }
