// Klasik favicon.ico (16 ve 32 piksel): bu adresi doğrudan isteyen tarayıcılar için.
import { simgeIco } from '../lib/gorsel.js';
export async function GET() { return new Response(await simgeIco(), { headers: { 'Content-Type': 'image/x-icon' } }); }
