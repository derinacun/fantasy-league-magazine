// Kadro görünümleri: takım sayfasındaki kadro, sezon geçmişi, takım kartı özeti,
// Oyuncular sayfasındaki "Oyuncu bul" listesi ve oyuncu adı bağlantıları.
// Oyuncu istatistiği gösterilmez (4 Kasım 2026 kararı): yalnızca kadro, sakatlar listesi ve hareketler.
// Kısaltma kullanılmaz: NBA takımı tam adıyla, pozisyonlar Türkçe yazılır.
import { t as _t, YEREL } from '../i18n/t.js';
import { haftalikSerbestler } from './kadroGecmisi.js';

export const NBA_TAKIMLARI = {
  ATL: _t('Atlanta Hawks'), BOS: _t('Boston Celtics'), BKN: _t('Brooklyn Nets'), BRK: _t('Brooklyn Nets'), CHA: _t('Charlotte Hornets'),
  CHI: _t('Chicago Bulls'), CLE: _t('Cleveland Cavaliers'), DAL: _t('Dallas Mavericks'), DEN: _t('Denver Nuggets'), DET: _t('Detroit Pistons'),
  GSW: _t('Golden State Warriors'), GS: _t('Golden State Warriors'), HOU: _t('Houston Rockets'), IND: _t('Indiana Pacers'),
  LAC: _t('Los Angeles Clippers'), LAL: _t('Los Angeles Lakers'), MEM: _t('Memphis Grizzlies'), MIA: _t('Miami Heat'), MIL: _t('Milwaukee Bucks'),
  MIN: _t('Minnesota Timberwolves'), NOP: _t('New Orleans Pelicans'), NO: _t('New Orleans Pelicans'), NYK: _t('New York Knicks'), NY: _t('New York Knicks'),
  OKC: _t('Oklahoma City Thunder'), ORL: _t('Orlando Magic'), PHI: _t('Philadelphia 76ers'), PHX: _t('Phoenix Suns'), PHO: _t('Phoenix Suns'),
  POR: _t('Portland Trail Blazers'), SAC: _t('Sacramento Kings'), SAS: _t('San Antonio Spurs'), SA: _t('San Antonio Spurs'), TOR: _t('Toronto Raptors'),
  UTA: _t('Utah Jazz'), UTAH: _t('Utah Jazz'), WAS: _t('Washington Wizards'), WSH: _t('Washington Wizards'),
};
export const POZISYONLAR = { PG: _t('oyun kurucu'), SG: _t('şutör guard'), G: 'guard', SF: _t('kısa forvet'), PF: _t('uzun forvet'), F: 'forvet', C: 'pivot' };
const SAKAT_YERI = new Set(['IL', 'IL+', 'INJ']);

export const nbaTakimi = (kod) => (kod ? NBA_TAKIMLARI[String(kod).toUpperCase()] ?? String(kod) : '');
export const pozisyonlar = (s) => (s ? String(s).split(',').map((p) => p.trim()).filter(Boolean).map((p) => POZISYONLAR[p.toUpperCase()] ?? p).join(', ') : '');
/** "Denver Nuggets · uzun forvet, pivot" */
export const oyuncuAlt = (o) => [nbaTakimi(o?.nbaTeam), pozisyonlar(o?.positions)].filter(Boolean).join(' · ');
/** Arama için: aksanlar ve noktasız ı sadeleşir ("Jokić" → "jokic", "Isaiah" → "isaiah"). */
export const normalAd = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ı/g, 'i').toLowerCase().replace(/\s+/g, ' ').trim();
export const kisaTarih = (g) => (g ? new Date(g + 'T12:00:00Z').toLocaleDateString(YEREL, { day: 'numeric', month: 'long', timeZone: 'UTC' }) : '');
// "28 Ekim'de", "1 Kasım'da": ayın son sesine göre bulunma eki
const AY_EKI = ['ta', 'ta', 'ta', 'da', 'ta', 'da', 'da', 'ta', 'de', 'de', 'da', 'ta'];
export const tarihte = (g) => (g ? `${kisaTarih(g)}'${AY_EKI[new Date(g + 'T12:00:00Z').getUTCMonth()]}` : '');

/** Haftanın son günündeki Yahoo kadro yeri (Excel'deki son_gun_yeri ya da günlük diziliş kaydı). */
export function sonGunYeri(o) {
  if (o?.lastSlot) return String(o.lastSlot).toUpperCase();
  const gunler = Object.keys(o?.lineupByDate ?? {}).sort();
  return gunler.length ? String(o.lineupByDate[gunler.at(-1)]).toUpperCase() : null;
}
export const sakatlarListesinde = (o) => o?.status === 'kadroda' && SAKAT_YERI.has(sonGunYeri(o) ?? '');
const sakatBilgisiVar = (veri) => Object.values(veri?.teams ?? {}).flat().some((o) => o.lastSlot || (o.lineupByDate && Object.keys(o.lineupByDate).length));

/** "1–2. hafta", "2. hafta", "1–2 ve 4. hafta" */
export function haftaAraligi(haftalar) {
  const h = [...new Set(haftalar)].sort((a, b) => a - b);
  if (!h.length) return '';
  const parcalar = [];
  for (let i = 0; i < h.length; i++) {
    let j = i;
    while (j + 1 < h.length && h[j + 1] === h[j] + 1) j++;
    parcalar.push(i === j ? String(h[i]) : `${h[i]}–${h[j]}`);
    i = j;
  }
  return (parcalar.length === 1 ? parcalar[0] : `${parcalar.slice(0, -1).join(', ')}${_t(' ve ')}${parcalar.at(-1)}`) + _t('. hafta');
}

const sirala = (a, b) => (a.date ?? '').localeCompare(b.date ?? '') || (a.timestamp ?? '').localeCompare(b.timestamp ?? '');
const adSirasi = (a, b) => a.name.localeCompare(b.name, YEREL);

/** Bir oyuncunun bir takımdaki hareketleri (tarih sırasıyla), takım sayfası diliyle. */
function takimHareketleri(o, islemler, takimId, ad) {
  const kendi = islemler.filter((x) => String(x.playerId) === String(o.id) && (x.teamId === takimId || (x.type === 'takas' && x.otherTeamId === takimId))).sort(sirala);
  const sonuc = [];
  for (const x of kendi) {
    if (x.type === 'ekleme') sonuc.push({ metin: _t('Eklendi · {0}', [kisaTarih(x.date)]), tur: 'geldi', date: x.date });
    else if (x.type === 'birakma') sonuc.push({ metin: _t('Bırakıldı · {0}', [kisaTarih(x.date)]), tur: 'gitti', date: x.date });
    else if (x.type === 'takas' && x.teamId === takimId) sonuc.push({ metin: `${x.otherTeamId ? _t('{0} takımına takaslandı', [ad(x.otherTeamId)]) : _t('Takasla gitti')} · ${kisaTarih(x.date)}`, tur: 'gitti', date: x.date });
    else if (x.type === 'takas') sonuc.push({ metin: _t('{0} takımından takasla geldi · {1}', [ad(x.teamId), kisaTarih(x.date)]), tur: 'geldi', date: x.date });
  }
  // İşlem kaydı eksikse kadro satırındaki tarihler kullanılır.
  if (o.added && !sonuc.some((x) => x.tur === 'geldi')) sonuc.unshift({ metin: _t('Eklendi · {0}', [kisaTarih(o.added)]), tur: 'geldi', date: o.added });
  if (o.status !== 'kadroda' && o.left && !sonuc.some((x) => x.tur === 'gitti')) {
    sonuc.push({ metin: o.status === 'takasla-gitti' ? `${o.tradedTo ? _t('{0} takımına takaslandı', [ad(o.tradedTo)]) : _t('Takasla gitti')} · ${kisaTarih(o.left)}` : _t('Bırakıldı · {0}', [kisaTarih(o.left)]), tur: 'gitti', date: o.left });
  }
  return sonuc;
}

/** Takım sayfası: haftanın kapanışına göre gruplu kadro. Kadro dosyası yoksa null. */
export function takimKadrosu(sayi, takimId) {
  const veri = sayi.kadro;
  const liste = veri?.teams?.[takimId];
  if (!Array.isArray(liste)) return null;
  const ad = (id) => sayi.takim[id]?.ad ?? _t('Takım {0}', [id]);
  const islemler = veri.transactions ?? [];
  const satirlar = liste.map((o) => {
    const il = sakatlarListesinde(o);
    const notlar = takimHareketleri(o, islemler, takimId, ad);
    if (!il && o.status === 'kadroda' && o.ilDays > 0) notlar.push({ metin: _t('{0} gün sakatlar listesindeydi', [o.ilDays]), tur: 'notr' });
    return { ...o, il, alt: oyuncuAlt(o), notlar };
  });
  const kadroda = satirlar.filter((o) => o.status === 'kadroda' && !o.il).sort(adSirasi);
  const sakat = satirlar.filter((o) => o.il).sort(adSirasi);
  const ayrilan = satirlar.filter((o) => o.status !== 'kadroda').sort((a, b) => (a.left ?? '').localeCompare(b.left ?? '') || adSirasi(a, b));
  const kendi = islemler.filter((x) => x.teamId === takimId);
  return {
    kadroda, sakat, ayrilan,
    oyuncu: kadroda.length + sakat.length,
    sakatBilgisi: sakatBilgisiVar(veri),
    ekleme: kendi.filter((x) => x.type === 'ekleme').length,
    birakma: kendi.filter((x) => x.type === 'birakma').length,
    takas: kendi.filter((x) => x.type === 'takas').length,
    hareket: kendi.length,
    kapanis: veri.rosterSnapshotDate ?? veri.periodEnd ?? null,
  };
}

/** Takım kartı için tek satır: "16 oyuncu · sakatlar listesinde 3 · bu hafta 10 hareket". */
export function kadroOzeti(sayi, takimId) {
  const k = takimKadrosu(sayi, takimId);
  if (!k) return null;
  return [_t('{0} oyuncu', [k.oyuncu]), k.sakatBilgisi && k.sakat.length ? _t('sakatlar listesinde {0}', [k.sakat.length]) : null, k.hareket ? _t('bu hafta {0} hareket', [k.hareket]) : _t('bu hafta hareket yok')].filter(Boolean).join(' · ');
}

/** Sezon geçmişi: bu takımdan geçen oyuncular (yalnızca bu sayıya kadarki kadro dosyaları). */
export function sezonGecmisi(sayi, takimId) {
  const beklenen = sayi.haftalarHam.map((h) => h.week).filter((h) => h <= sayi.hafta);
  const dosyalar = (sayi.kadroGecmisi ?? []).filter((v) => v.week <= sayi.hafta && Array.isArray(v.teams?.[takimId])).sort((a, b) => a.week - b.week);
  const eksikHaftalar = beklenen.filter((h) => !dosyalar.some((v) => v.week === h));
  if (!dosyalar.length) return null;
  const ad = (id) => sayi.takim[id]?.ad ?? _t('Takım {0}', [id]);
  const son = dosyalar.find((v) => v.week === sayi.hafta);
  const ilkHafta = Math.min(...beklenen);
  const oyuncular = new Map();
  for (const veri of dosyalar) {
    for (const o of veri.teams[takimId]) {
      const k = oyuncular.get(String(o.id)) ?? { kayitlar: [], hareketler: [] };
      k.kayitlar.push({ o, week: veri.week });
      k.hareketler.push(...takimHareketleri(o, veri.transactions ?? [], takimId, ad));
      oyuncular.set(String(o.id), k);
    }
  }
  const satirlar = [...oyuncular.values()].map(({ kayitlar, hareketler }) => {
    const o = kayitlar.at(-1).o;
    const kayitliOlan = [...kayitlar].reverse().find((r) => r.o.nbaTeam) ?? kayitlar.at(-1);
    const tekil = [...new Map(hareketler.map((x) => [x.metin, x])).values()].sort(sirala);
    const guncel = son?.teams[takimId].some((x) => String(x.id) === String(o.id) && x.status === 'kadroda') ?? false;
    const basindan = guncel && kayitlar[0].week === ilkHafta && !tekil.some((x) => x.tur === 'geldi') && kayitlar.every((r) => !r.o.added);
    return { id: String(o.id), name: o.name, alt: oyuncuAlt({ ...o, nbaTeam: kayitliOlan.o.nbaTeam }), haftalar: haftaAraligi(kayitlar.map((r) => r.week)), hareketler: tekil, guncel, basindan, son: tekil.at(-1)?.date ?? '' };
  });
  const gelipGidenler = satirlar.filter((o) => !o.basindan).sort((a, b) => b.son.localeCompare(a.son) || a.name.localeCompare(b.name, YEREL));
  return { gelipGidenler, basindan: satirlar.filter((o) => o.basindan).length, eksikHaftalar, ilkHafta };
}

/** Oyuncular sayfası: haftanın kapanışında kim kimde, kim serbest; o haftanın bütün hareketleriyle. */
export function oyuncuBulListesi(sayi) {
  const veri = sayi.kadro;
  if (!veri?.teams) return null;
  const ad = (id) => sayi.takim[id]?.ad ?? _t('Takım {0}', [id]);
  const harita = new Map();
  const al = (o) => {
    const k = harita.get(String(o.id)) ?? { id: String(o.id), name: o.name, nbaTeam: null, positions: null, sahip: null, il: false, hareketler: [], eklendi: false, birakildi: false, ownedPct: null };
    if (!k.nbaTeam && o.nbaTeam) k.nbaTeam = o.nbaTeam;
    if (!k.positions && o.positions) k.positions = o.positions;
    harita.set(k.id, k);
    return k;
  };
  for (const [takimId, liste] of Object.entries(veri.teams)) {
    for (const o of liste) {
      const k = al(o);
      if (o.status === 'kadroda') { k.sahip = takimId; k.il = sakatlarListesinde(o); }
    }
  }
  for (const o of haftalikSerbestler(veri)) { const k = al(o); k.ownedPct = o.ownedPct ?? null; }
  for (const x of [...(veri.transactions ?? [])].sort(sirala)) {
    const k = al({ id: x.playerId, name: x.name });
    if (x.type === 'ekleme') { k.eklendi = true; k.hareketler.push(_t('{0} ekledi · {1}', [ad(x.teamId), kisaTarih(x.date)])); }
    else if (x.type === 'birakma') { k.birakildi = true; k.hareketler.push(_t('{0} bıraktı · {1}', [ad(x.teamId), kisaTarih(x.date)])); }
    else if (x.type === 'takas') k.hareketler.push(_t('{0} → {1} takas · {2}', [ad(x.teamId), x.otherTeamId ? ad(x.otherTeamId) : _t('bilinmeyen takım'), kisaTarih(x.date)]));
  }
  const satirlar = [...harita.values()].map((k) => ({ ...k, alt: oyuncuAlt(k), ara: normalAd(k.name) })).sort(adSirasi);
  return {
    satirlar,
    kadroda: satirlar.filter((o) => o.sahip).length,
    serbest: satirlar.filter((o) => !o.sahip).length,
    sakat: satirlar.filter((o) => o.il).length,
    sakatBilgisi: sakatBilgisiVar(veri),
    eklendi: satirlar.filter((o) => o.eklendi).length,
    birakildi: satirlar.filter((o) => o.birakildi).length,
    kapanis: veri.rosterSnapshotDate ?? veri.periodEnd ?? null,
  };
}

/** Bir oyuncu adını, o takımın sayfasındaki kadro satırına bağlar (bulunamazsa null). */
export function oyuncuAdresi(sayi, takimId, isim) {
  const t = sayi.takim[takimId];
  if (!t || !isim) return null;
  const n = normalAd(isim);
  const bul = (liste) => (liste ?? []).find((o) => normalAd(o.name) === n);
  const o = bul(sayi.kadro?.teams?.[takimId]) ?? [...(sayi.kadroGecmisi ?? [])].filter((v) => v.week <= sayi.hafta).reverse().map((v) => bul(v.teams?.[takimId])).find(Boolean);
  return o ? `${sayi.adres('takimlar', t.slug + '/')}#oyuncu-${o.id}` : null;
}

/** "Mikal Bridges + Josh Hart" gibi metni parçalara ayırır; bulunan her oyuncu bağlantılı. */
export function adParcalari(sayi, takimId, metin) {
  return String(metin ?? '').split(/(\s*\+\s*|\s*,\s*|\s+ve\s+)/)
    .map((p, i) => (i % 2 ? { metin: p, href: null } : { metin: p, href: oyuncuAdresi(sayi, takimId, p.trim()) }))
    .filter((p) => p.metin !== '');
}
