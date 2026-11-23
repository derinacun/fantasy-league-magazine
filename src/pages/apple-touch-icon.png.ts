// Eski adres (iPhone bazen bu adresi doğrudan ister): yeni simge.
import { simgePng } from '../lib/gorsel.js';
export async function GET() { return new Response(await simgePng(180, { kose: false }), { headers: { 'Content-Type': 'image/png' } }); }
