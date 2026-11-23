// Oyuncu kimliği + fantezi takımı üzerinden haftalık katkı ve sezon geçmişi.
// Eksik istatistik sıfır değildir; farklı sayım yöntemleri tek toplamda birleştirilmez.
import { t as _t, YEREL } from '../i18n/t.js';
export const SAYIM = ['FGM', 'FGA', 'FTM', 'FTA', '3PTM', '3PTA', 'PTS', 'REB', 'AST', 'ST', 'BLK', 'TO'];
const sayi = (x) => typeof x === 'number' && Number.isFinite(x);
const tarih = (s) => s ? new Date(s + 'T12:00:00Z').toLocaleDateString(YEREL, { day: 'numeric', month: 'long', timeZone: 'UTC' }) : '';
const oran = (m, a) => sayi(m) && sayi(a) && a > 0 ? m / a : null;
export const kategoriDegerleri = (s) => ({
  'FG%': oran(s.FGM, s.FGA), 'FT%': oran(s.FTM, s.FTA), '3PT%': oran(s['3PTM'], s['3PTA']),
  ...Object.fromEntries(['PTS', 'REB', 'AST', 'ST', 'BLK', 'TO'].map((k) => [k, s[k]])),
});

function toplam(kayitlar) {
  const yontemler = new Set(kayitlar.filter((r) => r.counting !== 'none' && r.o.stats).map((r) => r.counting ?? 'active'));
  const karma = yontemler.size > 1;
  const topla = (deger) => {
    const degerler = kayitlar.map((r) => r.counting === 'none' ? null : deger(r.o));
    return !karma && degerler.length && degerler.every(sayi) ? degerler.reduce((a, b) => a + b, 0) : null;
  };
  const stats = Object.fromEntries(SAYIM.map((k) => [k, topla((o) => o.stats?.[k])]));
  return { stats, ist: kategoriDegerleri(stats), games: topla((o) => o.games), karma, tumMaclar: yontemler.has('all'), eksik: karma || SAYIM.some((k) => stats[k] == null) };
}

function hareketler(kayitlar, takimId, takimlar) {
  const sonuc = new Map();
  const ekle = (metin, tur = 'gecmis') => { if (metin) sonuc.set(metin, { metin, tur }); };
  for (const { o, veri } of kayitlar) {
    // Takas satırında teamId gönderen, otherTeamId alan takımdır.
    const islemler = (veri.transactions ?? []).filter((x) => String(x.playerId) === String(o.id));
    const cikis = islemler.find((x) => x.type === 'takas' && x.teamId === takimId && (!o.left || x.date === o.left));
    const giris = islemler.find((x) => x.type === 'takas' && x.otherTeamId === takimId && (!o.added || x.date === o.added));
    const hedef = o.tradedTo ?? cikis?.otherTeamId;
    const ad = (id) => takimlar[id]?.ad ?? _t('Takım {0}', [id]);
    if (o.added) ekle(`${giris ? _t('{0} takımından takasla geldi', [ad(giris.teamId)]) : _t('Eklendi')} · ${tarih(o.added)}`, 'geldi');
    if (o.status === 'takasla-gitti') ekle(`${hedef ? _t('{0} takımına takaslandı', [ad(hedef)]) : _t('Takasla ayrıldı · hedef takım bilgisi yok')}${o.left ? ' · ' + tarih(o.left) : ''}`, 'gitti');
    else if (o.left) ekle(_t('Bırakıldı · {0}', [tarih(o.left)]), 'gitti');
    // Aynı hafta bırakılıp yeniden alınan oyuncunun bütün işlemlerini koru.
    for (const x of islemler) {
      if (x.type === 'ekleme' && x.teamId === takimId) ekle(_t('Eklendi · {0}', [tarih(x.date)]), 'geldi');
      if (x.type === 'birakma' && x.teamId === takimId) ekle(_t('Bırakıldı · {0}', [tarih(x.date)]), 'gitti');
      if (x.type === 'takas' && x.teamId === takimId && x.otherTeamId) ekle(_t('{0} takımına takaslandı · {1}', [ad(x.otherTeamId), tarih(x.date)]), 'gitti');
      if (x.type === 'takas' && x.otherTeamId === takimId) ekle(_t('{0} takımından takasla geldi · {1}', [ad(x.teamId), tarih(x.date)]), 'geldi');
    }
  }
  return [...sonuc.values()];
}

export function takimKadroGorunumu(sayi, takimId, kapsam = 'hafta') {
  const beklenen = sayi.haftalarHam.filter((h) => kapsam === 'sezon' || h.week === sayi.hafta).map((h) => h.week);
  const dosyalar = (sayi.kadroGecmisi ?? []).filter((v) => beklenen.includes(v.week)).sort((a, b) => a.week - b.week);
  const eksikHaftalar = beklenen.filter((h) => !dosyalar.some((v) => v.week === h && Array.isArray(v.teams?.[takimId])));
  const son = dosyalar.find((v) => v.week === sayi.hafta);
  const guncel = son?.teams?.[takimId];
  const oyuncular = new Map();
  for (const veri of dosyalar) for (const o of veri.teams?.[takimId] ?? []) {
    const liste = oyuncular.get(String(o.id)) ?? [];
    liste.push({ o, veri, counting: veri.counting ?? 'active' });
    oyuncular.set(String(o.id), liste);
  }
  const satirlar = [...oyuncular.values()].map((kayitlar) => {
    const o = kayitlar.at(-1).o;
    const sonKayit = guncel?.find((x) => String(x.id) === String(o.id));
    const aktif = Array.isArray(guncel) ? sonKayit?.status === 'kadroda' : null;
    const durum = aktif === true ? _t('{0}. hafta sonunda kadroda', [sayi.hafta]) : aktif === false ? _t('Önceki kadro / ayrıldı') : _t('Son haftanın kadro bilgisi yok');
    const t = toplam(kayitlar);
    // Kayıp haftada bu oyuncu takımda mıydı bilinmez: sezon toplamı tamamlanmış gibi gösterilmez.
    if (eksikHaftalar.length) {
      t.stats = Object.fromEntries(SAYIM.map((k) => [k, null]));
      t.ist = kategoriDegerleri(t.stats); t.games = null; t.eksik = true;
    }
    return { ...o, ...t, aktif, durum, notlar: hareketler(kayitlar, takimId, sayi.takim), haftalar: kayitlar.map((r) => r.veri.week) };
  }).sort((a, b) => Number(b.aktif === true) - Number(a.aktif === true) || a.name.localeCompare(b.name, YEREL));
  const toplamlar = toplam(satirlar.map((o) => ({ o, counting: o.tumMaclar ? 'all' : 'active' })));
  return { satirlar, eksikHaftalar, toplam: toplamlar, aktif: satirlar.filter((o) => o.aktif).length, eksik: satirlar.some((o) => o.eksik), karma: satirlar.some((o) => o.karma) || toplamlar.karma, tumMaclar: satirlar.some((o) => o.tumMaclar) };
}

/** Bir yayının hafta sonu kadrosunda olanlar, aynı haftanın serbest listesine giremez. */
export function kadrodakiKimlikler(veri) {
  return new Set(Object.values(veri?.teams ?? {}).flat().filter((o) => o.status === 'kadroda').map((o) => String(o.id)));
}
export function haftalikSerbestler(veri) {
  const kadroda = kadrodakiKimlikler(veri);
  return (veri?.freeAgents ?? []).filter((o) => !kadroda.has(String(o.id)));
}
