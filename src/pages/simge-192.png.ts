import { simgePng } from '../lib/gorsel.js';
export async function GET() { return new Response(await simgePng(192, { kose: false }), { headers: { 'Content-Type': 'image/png' } }); }
