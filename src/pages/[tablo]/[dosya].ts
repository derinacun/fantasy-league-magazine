// İstatistik tablosu .csv olarak: /tablo/hafta-01-son-hafta.csv, /tablo/hafta-01-sezon.csv
// ve bütün takım-haftalar (ham veri): /tablo/hafta-01-tum-haftalar.csv
import { t as _t, ONDALIK, yolParcasi, dosyaAdi } from '../../i18n/t.js';
import { tumSayilar } from '../../lib/model.js';
import { KATEGORILER, kayit } from '../../lib/hesap.js';
import { tumSatirlar } from '../../lib/analiz.js';

const hucreler = (satirlar: string[][]) => '\uFEFF' + satirlar.map((r) => r.map((h) => `"${String(h).replaceAll('"', '""')}"`).join(ONDALIK === ',' ? ';' : ',')).join('\r\n');
const sayiYaz = (v: number | null, yuzde = false) => (v == null ? '' : (yuzde ? (v * 100).toFixed(1) : String(v)).replace('.', ONDALIK));

export function getStaticPaths() {
  return tumSayilar().sayilar.flatMap((s) => [
    { params: { tablo: yolParcasi('tablo'), dosya: dosyaAdi(`hafta-${s.no}-son-hafta.csv`) }, props: { hafta: s.hafta, kapsam: 'hafta' } },
    { params: { tablo: yolParcasi('tablo'), dosya: dosyaAdi(`hafta-${s.no}-sezon.csv`) }, props: { hafta: s.hafta, kapsam: 'sezon' } },
    { params: { tablo: yolParcasi('tablo'), dosya: dosyaAdi(`hafta-${s.no}-tum-haftalar.csv`) }, props: { hafta: s.hafta, kapsam: 'tum' } },
  ]);
}

export function GET({ props }: { props: { hafta: number; kapsam: 'hafta' | 'sezon' | 'tum' } }) {
  const sayi: any = tumSayilar().sayilar.find((s) => s.hafta === props.hafta);
  if (props.kapsam === 'tum') {
    const ad = (id: string) => sayi.takim[id]?.ad ?? id;
    const satirlar = [[_t('Hafta'), _t('Takım'), _t('Rakip'), _t('Sonuç'), _t('Kategori skoru (kazanılan-kaybedilen-berabere)'), 'FGM', 'FGA', 'FG%', 'FTM', 'FTA', 'FT%', '3PTM', '3PTA', '3PT%', 'PTS', 'REB', 'AST', 'ST', 'BLK', 'TO', _t('Güç (hafta)'), _t('Herkese karşı (hafta)')]];
    for (const r of tumSatirlar(sayi)) {
      satirlar.push([
        String(r.hafta), ad(r.takim), ad(r.rakip), r.sonuc, r.skor,
        sayiYaz(r.h.FGM), sayiYaz(r.h.FGA), sayiYaz(r.ist['FG%'], true),
        sayiYaz(r.h.FTM), sayiYaz(r.h.FTA), sayiYaz(r.ist['FT%'], true),
        sayiYaz(r.h['3PTM']), sayiYaz(r.h['3PTA']), sayiYaz(r.ist['3PT%'], true),
        ...['PTS', 'REB', 'AST', 'ST', 'BLK', 'TO'].map((k) => sayiYaz(r.ist[k])),
        String(r.guc), kayit(r.hk).replace(/–/g, '-'),
      ]);
    }
    return new Response(hucreler(satirlar), { headers: { 'Content-Type': _t('text/csv; charset=utf-8') } });
  }
  const k = sayi.kapsam[props.kapsam];
  const satirlar = [[_t('Sıra'), _t('Takım'), _t('Güç'), _t('Herkese karşı'), _t('Yahoo sırası'), _t('Kategori kaydı (kazanılan-kaybedilen-berabere)'), ...KATEGORILER]];
  k.gucSirasi.forEach((id: string, i: number) => {
    const pd = sayi.puanDurumu[id];
    satirlar.push([
      String(i + 1), sayi.takim[id].ad, String(k.guc[id]), kayit(k.herkeseKarsi[id]).replace(/–/g, '-'),
      pd ? String(pd.rank) : '', pd ? `${pd.wins}-${pd.losses}-${pd.ties}` : '',
      ...KATEGORILER.map((c) => {
        const v = k.ist[id][c];
        if (v == null) return '';
        return (c.includes('%') ? (v * 100).toFixed(1) : String(v)).replace('.', ONDALIK);
      }),
    ]);
  });
  const csv = '﻿' + satirlar.map((r) => r.map((h) => `"${String(h).replaceAll('"', '""')}"`).join(ONDALIK === ',' ? ';' : ',')).join('\r\n');
  return new Response(csv, { headers: { 'Content-Type': _t('text/csv; charset=utf-8') } });
}
