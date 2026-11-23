// Kehanet Saati (18 Kasım 2026): forecastHour ve forecastNotes doğrulaması.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { haftaDosyasiniDogrula } from '../src/lib/dogrulama.js';

const temel = () => JSON.parse(readFileSync(new URL('../veri/haftalar/hafta-04.json', import.meta.url), 'utf8'));
const soru = (asker) => ({ asker, question: 'Kartal 13–0 yaptı, 11. sırada; nasıl iş?', answer: 'Fikstür.' });
const ilgili = (r) => r.hatalar.filter((h) => /forecast(Hour|Notes)/.test(h));

test('geçerli söyleşi ve notlar hata vermez', () => {
  const v = temel();
  v.forecastHour = { topics: ['Tahminler', 'Grup'], turns: [soru('abi'), soru('hoca'), soru('abi'), soru('hoca')] };
  v.forecastNotes = { nextWeek: { from: 'abi', text: 'Riskli maç belli.' }, luck: { from: 'hoca', text: 'Takvim.' } };
  assert.deepEqual(ilgili(haftaDosyasiniDogrula(v, 'x')), []);
});

test('yanlış soran, az soru ve bilinmeyen not anahtarı hata verir', () => {
  const v = temel();
  v.forecastHour = { topics: ['A'], turns: [soru('baskasi'), soru('hoca')] };
  v.forecastNotes = { kupa: { from: 'abi', text: 'x' }, luck: { from: 'x', text: 'y' } };
  const h = ilgili(haftaDosyasiniDogrula(v, 'x'));
  assert.ok(h.some((x) => x.includes('forecastHour.turns') && !x.includes('asker')), 'en az 3 soru');
  assert.ok(h.some((x) => x.includes('turns[0].asker')));
  assert.ok(h.some((x) => x.includes('forecastNotes.kupa')));
  assert.ok(h.some((x) => x.includes('forecastNotes.luck.from')));
});
