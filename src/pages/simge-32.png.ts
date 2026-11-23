import { simgePng } from '../lib/gorsel.js';
export async function GET() { return new Response(await simgePng(32), { headers: { 'Content-Type': 'image/png' } }); }
