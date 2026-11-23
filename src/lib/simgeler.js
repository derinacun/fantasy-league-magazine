// Madalya ve kemer çizimleri SVG metni olarak (17 Kasım 2026). Hem site (Madalya.astro, KemerSimge.astro)
// hem paylaşım görselleri (gorsel.js: takım kartı) aynı çizimi kullanır.
import { t as _t } from '../i18n/t.js';
import { YOLLAR } from './ikonlar.js';

export const METAL = {
  bronz: ['#f3c193', '#c27b3f', '#6f3f1b'],
  gumus: ['#ffffff', '#c3cad2', '#5f6873'],
  altin: ['#fff3b0', '#e4ad2f', '#7f5200'],
};
export const KURDELE = {
  patron: ['#1c5cab', '#f5f5f7'], piyango: ['#13895f', '#d8f3e7'], kurban: ['#59616b', '#d2d7dd'], kilpayi: ['#c53b3a', '#f5f5f7'],
  keskin: ['#1d1d1f', '#eda100'], canavar: ['#5442c6', '#e1dcff'], yukselen: ['#0b7a0b', '#f5f5f7'], topkaybi: ['#d4561f', '#1d1d1f'],
  kelepir: ['#0a7d73', '#ffe08a'], kahin: ['#3b2a8f', '#b9a8ff'],
};
export const SEKIL = {
  patron: 'tirtikli', piyango: 'yildiz', kurban: 'daire', kilpayi: 'altigen',
  keskin: 'daire', canavar: 'kalkan', yukselen: 'sekizgen', topkaybi: 'disli', kelepir: 'altigen', kahin: 'yildiz',
};

/** Madalyanın iç SVG'si (viewBox 0 0 64 80). id: sayfada tekil önek. */
export function madalyaIc({ odul, ikon, seviye, id }) {
  const [acik, orta, koyu] = METAL[seviye] ?? METAL.bronz;
  const [k1, k2] = KURDELE[odul] ?? ['#6e6e73', '#f5f5f7'];
  const cx = 32, cy = 52, r = 23;
  const cokgen = (adet, aci0, r1, r2 = r1) => {
    const n = r2 === r1 ? adet : adet * 2;
    return Array.from({ length: n }, (_, i) => {
      const a = ((aci0 + (360 / n) * i) * Math.PI) / 180;
      const rr = r2 === r1 || i % 2 === 0 ? r1 : r2;
      return `${(cx + rr * Math.cos(a)).toFixed(2)},${(cy + rr * Math.sin(a)).toFixed(2)}`;
    }).join(' ');
  };
  const sekil = SEKIL[odul] ?? 'daire';
  const dolgu = _t('fill="url(#{0}-m)" stroke="{1}" stroke-width="1.6" stroke-linejoin="round"', [id, koyu]);
  const govde = {
    altigen: `<polygon points="${cokgen(6, -90, r + 1)}" ${dolgu}/>`,
    sekizgen: `<polygon points="${cokgen(8, -112.5, r + 1)}" ${dolgu}/>`,
    yildiz: `<polygon points="${cokgen(8, -90, r + 3, r - 3)}" ${dolgu}/>`,
    tirtikli: `<polygon points="${cokgen(16, -90, r + 1.5, r - 1)}" ${dolgu}/>`,
    disli: `<polygon points="${cokgen(10, -90, r + 2, r - 2.5)}" ${dolgu}/>`,
    kalkan: `<path d="M${cx - 21} ${cy - 22} H${cx + 21} V${cy - 2} C${cx + 21} ${cy + 13} ${cx + 10} ${cy + 21} ${cx} ${cy + 25} C${cx - 10} ${cy + 21} ${cx - 21} ${cy + 13} ${cx - 21} ${cy - 2} Z" ${dolgu}/>`,
  }[sekil] ?? `<circle cx="${cx}" cy="${cy}" r="${r}" ${dolgu}/>`;
  const ic = YOLLAR[ikon] ?? '';
  return `<defs>
    <linearGradient id="${id}-k" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="${k1}"/><stop offset=".34" stop-color="${k1}"/><stop offset=".34" stop-color="${k2}"/><stop offset=".66" stop-color="${k2}"/><stop offset=".66" stop-color="${k1}"/><stop offset="1" stop-color="${k1}"/></linearGradient>
    <radialGradient id="${id}-m" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="${acik}"/><stop offset=".55" stop-color="${orta}"/><stop offset="1" stop-color="${koyu}"/></radialGradient>
    <linearGradient id="${id}-p" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/></linearGradient>
  </defs>
  <polygon points="17,0 29,0 36,33 24,33" fill="url(#${id}-k)"/><polygon points="47,0 35,0 28,33 40,33" fill="url(#${id}-k)"/>
  <polygon points="17,0 29,0 36,33 24,33" fill="#000" opacity=".12"/>
  <rect x="22" y="27" width="20" height="7" rx="2" fill="${koyu}"/><rect x="23" y="27.5" width="18" height="2.2" rx="1" fill="${acik}" opacity=".7"/>
  ${govde}
  <circle cx="${cx}" cy="${cy}" r="${r - 5.5}" fill="none" stroke="${acik}" stroke-opacity=".75" stroke-width="1.2"/>
  <ellipse cx="${cx - 7}" cy="${cy - 10}" rx="11" ry="6" fill="url(#${id}-p)" transform="rotate(-25 ${cx - 7} ${cy - 10})"/>
  <g transform="translate(${cx - 10.5} ${cy - 10.5}) scale(.875)" fill="none" stroke="${koyu}" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">${ic}</g>`;
}

export const madalyaSvg = (o) => `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="80" viewBox="0 0 64 80">${madalyaIc(o)}</svg>`;

// Kemer (şampiyonluk kemeri): deri kayış, iki yan plaka, ortada büyük plaka ve simge.
// Büyük kemerler altın plaka ve kendi kayış rengi; kategori kemerleri gümüş plaka ve plakada kategori kısaltması.
export const KAYIS = { galibiyet: '#1d1d1f', yenilgi: '#6e1f22', uyku: '#1f3566', etkilesim: '#0e5e52' };

/** Kemerin iç SVG'si (viewBox 0 0 120 60). metin: kategori kısaltması plakada yazı olarak (yalnızca tarayıcıda; görsellerde false). */
export function kemerIc({ anahtar, tur, ikon, kategori, id, bos = false, metin = true }) {
  const altin = tur === 'buyuk';
  const [acik, orta, koyu] = bos ? ['#f2f2f4', '#c7c7cc', '#8e8e93'] : altin ? METAL.altin : METAL.gumus;
  const kayis = bos ? '#aeaeb2' : (KAYIS[anahtar] ?? '#3a3a3c');
  const ic = YOLLAR[ikon] ?? '';
  const yazi = !altin && kategori && metin
    ? `<text x="60" y="35.5" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-weight="800" font-size="${kategori.length > 3 ? 12 : 14}" fill="${koyu}">${kategori.replace('%', '%')}</text>`
    : `<g transform="translate(49 19) scale(.92)" fill="none" stroke="${koyu}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${ic}</g>`;
  return `<defs>
    <radialGradient id="${id}-m" cx=".35" cy=".3" r=".85"><stop offset="0" stop-color="${acik}"/><stop offset=".55" stop-color="${orta}"/><stop offset="1" stop-color="${koyu}"/></radialGradient>
    <linearGradient id="${id}-d" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".18"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".25"/></linearGradient>
  </defs>
  <rect x="2" y="19" width="116" height="22" rx="7" fill="${kayis}"/>
  <rect x="2" y="19" width="116" height="22" rx="7" fill="url(#${id}-d)"/>
  <rect x="6" y="22.5" width="108" height="15" rx="5" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width=".9" stroke-dasharray="2.4 2"/>
  <rect x="14" y="20" width="16" height="20" rx="4" fill="url(#${id}-m)" stroke="${koyu}" stroke-width="1.2"/>
  <rect x="90" y="20" width="16" height="20" rx="4" fill="url(#${id}-m)" stroke="${koyu}" stroke-width="1.2"/>
  <path d="M60 4 L80 10 Q86 30 80 50 L60 56 L40 50 Q34 30 40 10 Z" fill="url(#${id}-m)" stroke="${koyu}" stroke-width="1.6" stroke-linejoin="round"/>
  <path d="M60 9 L76 14 Q81 30 76 46 L60 51 L44 46 Q39 30 44 14 Z" fill="none" stroke="${acik}" stroke-opacity=".8" stroke-width="1.1"/>
  <ellipse cx="53" cy="16" rx="9" ry="4" fill="#fff" opacity=".35" transform="rotate(-20 53 16)"/>
  ${yazi}`;
}
export const kemerSvg = (o) => `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="60" viewBox="0 0 120 60">${kemerIc(o)}</svg>`;
