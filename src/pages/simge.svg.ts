// Sekme simgesi (vektör): yuvarlatılmış koyu kare, beyaz E, turuncu ünlem.
import { t as _t } from '../i18n/t.js';
import { simgeSvg } from '../lib/gorsel.js';
export function GET() { return new Response(simgeSvg(), { headers: { 'Content-Type': _t('image/svg+xml; charset=utf-8') } }); }
