// Paylaşım kapakları: /kapak/hafta-01.png (ön sayfa), /kapak/hafta-01-istatistikler.png (sayfa),
// /kapak/hafta-01-takim-ornek.png (takım). 17 Kasım 2026'dan beri her sayfanın kendi görseli var.
import { tumSayilar } from '../../lib/model.js';
import { yolParcasi, dosyaAdi } from '../../i18n/t.js';
import { kapakPng, sayfaKapakPng, sayfaKapakBilgisi, sayfaKapakleri, takimKartBilgisi, takimKartPng } from '../../lib/gorsel.js';
import { haftaOdulleri, sezonOdulleri } from '../../lib/oduller.js';

export function getStaticPaths() {
  const { sayilar } = tumSayilar();
  const son = sayilar.at(-1).hafta;
  return sayilar.flatMap((s) => [
    { params: { kapak: yolParcasi('kapak'), dosya: dosyaAdi(`hafta-${s.no}.png`) }, props: { hafta: s.hafta } },
    // Arşiv sayfası yalnızca güncel sayıyla üretilir.
    ...sayfaKapakleri().filter((b) => b !== 'arsiv' || s.hafta === son).map((b) => ({ params: { kapak: yolParcasi('kapak'), dosya: dosyaAdi(`hafta-${s.no}-${b}.png`) }, props: { hafta: s.hafta, bolum: b } })),
    ...s.takimlar.map((t: any) => ({ params: { kapak: yolParcasi('kapak'), dosya: dosyaAdi(`hafta-${s.no}-takim-${t.slug}.png`) }, props: { hafta: s.hafta, slug: t.slug } })),
  ]);
}

export async function GET({ props }: { props: { hafta: number; bolum?: string; slug?: string } }) {
  const { sayilar } = tumSayilar();
  const sayi = sayilar.find((s) => s.hafta === props.hafta);
  let png;
  if (!props.bolum && !props.slug) png = await kapakPng(sayi);
  else if (props.slug) {
    // Takım sayfası: takıma özel haftalık kart (17 Kasım 2026). Lig yöneticisi kartları gruba atabilir.
    const takim = sayi.takimlar.find((t: any) => t.slug === props.slug);
    const onceki = sayilar.find((s) => s.hafta === props.hafta - 1) ?? null;
    png = await takimKartPng(sayi, takimKartBilgisi(sayi, takim, onceki, { haftaOdulleri: haftaOdulleri(sayi), sezonOdulleri: sezonOdulleri(sayi) }));
  } else {
    png = await sayfaKapakPng(sayi, sayfaKapakBilgisi(sayi, props.bolum, null, { sayiAdedi: sayilar.length }));
  }
  return new Response(png, { headers: { 'Content-Type': 'image/png' } });
}
