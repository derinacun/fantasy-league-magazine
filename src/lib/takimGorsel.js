// Takım görselleri: public/gorsel/takim/<id>.jpg (kare avatar) ve <id>-foto.jpg (gazete fotoğrafı).
// Sayıya özel manşet fotoğrafı (isteğe bağlı): public/gorsel/sayi/<ad>.jpg, sayı dosyasında article.photo.image.
// Dosya yoksa site baş harf simgesine (ya da takım fotoğrafına) döner; derleme durmaz.
import fs from 'node:fs';
import path from 'node:path';

const KOK = path.join(process.cwd(), 'public', 'gorsel');
const onbellek = new Map();

// JPEG başlığından genişlik ve yükseklik (SOF işaretçisi).
function jpegBoyutu(tampon) {
  if (tampon[0] !== 0xff || tampon[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < tampon.length) {
    if (tampon[i] !== 0xff) { i += 1; continue; }
    const isaret = tampon[i + 1];
    const boy = tampon.readUInt16BE(i + 2);
    if (isaret >= 0xc0 && isaret <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(isaret)) {
      return { boy: tampon.readUInt16BE(i + 5), en: tampon.readUInt16BE(i + 7) };
    }
    i += 2 + boy;
  }
  return null;
}

function dosya(ad, klasor = 'takim') {
  const anahtar = `${klasor}/${ad}`;
  if (onbellek.has(anahtar)) return onbellek.get(anahtar);
  const yol = path.join(KOK, klasor, ad);
  let sonuc = null;
  if (fs.existsSync(yol)) {
    const tampon = fs.readFileSync(yol);
    const boyut = jpegBoyutu(tampon);
    if (boyut) sonuc = { src: `/gorsel/${klasor}/${ad}`, ...boyut, yol };
  }
  onbellek.set(anahtar, sonuc);
  return sonuc;
}

export const takimAvatari = (id) => dosya(`${id}.jpg`);
export const takimFotografi = (id) => dosya(`${id}-foto.jpg`);
export const sayiFotografi = (ad) => (/^[\w.-]+\.jpe?g$/i.test(String(ad ?? '')) ? dosya(ad, 'sayi') : null);
