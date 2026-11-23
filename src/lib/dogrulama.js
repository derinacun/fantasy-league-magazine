// Haftalık veri dosyalarının kontrolü. Hata varsa site derlenmez ve yayındaki eski sürüm kalır.
// Hata mesajları ChatGPT'nin ve insanın anlayacağı şekilde Türkçe yazılır.

import { t as _t } from '../i18n/t.js';
import { skorDuzelt } from './tahmin.js';
import { KATEGORILER, takimIstatistik, karsilastir } from './hesap.js';

const ISTATISTIK_ANAHTARLARI = ['FGM/A', 'FG%', 'FTM/A', 'FT%', '3PTM/A', '3PT%', 'PTS', 'REB', 'AST', 'ST', 'BLK', 'TO'];

const metinMi = (v) => typeof v === 'string' && v.trim().length > 0;
const tamSayiMi = (v) => Number.isInteger(v);
const adresMi = (v) => metinMi(v) && /^https?:\/\/\S+$/.test(v);

export function haftaDosyasiniDogrula(veri, dosyaAdi) {
  const hatalar = [];
  const uyarilar = [];
  const hata = (yol, mesaj) => hatalar.push(`${dosyaAdi} → ${yol}: ${mesaj}`);
  const uyari = (yol, mesaj) => uyarilar.push(`${dosyaAdi} → ${yol}: ${mesaj}`);
  const metin = (yol, v, enFazla) => {
    if (!metinMi(v)) return hata(yol, _t('boş olmayan bir metin olmalı'));
    if (enFazla && v.length > enFazla) uyari(yol, _t('{0} karakter; sayfa düzeni için en fazla {1} önerilir', [v.length, enFazla]));
  };
  const dizi = (yol, v, enAz = 0, enFazla = Infinity) => {
    if (!Array.isArray(v)) { hata(yol, _t('liste ([...]) olmalı')); return false; }
    if (v.length < enAz) hata(yol, _t('en az {0} öğe olmalı (şu an {1})', [enAz, v.length]));
    if (v.length > enFazla) uyari(yol, _t('{0} öğe var; en fazla {1} önerilir', [v.length, enFazla]));
    return true;
  };

  if (!veri || typeof veri !== 'object') return { hatalar: [_t('{0}: geçerli bir JSON nesnesi değil', [dosyaAdi])], uyarilar };

  const surum = veri.schemaVersion;
  if (surum !== 1 && surum !== 2) hata('schemaVersion', _t('2 olmalı (eski dosyalar için 1)'));
  if (!tamSayiMi(veri.season)) hata('season', _t('sezonun başladığı yıl olmalı, örnek: 2026'));
  if (!tamSayiMi(veri.week) || veri.week < 1) hata('week', _t('1 veya daha büyük bir tam sayı olmalı'));
  const beklenenAd = `hafta-${String(veri.week).padStart(2, '0')}.json`;
  if (tamSayiMi(veri.week) && dosyaAdi !== beklenenAd) hata('week', _t('dosya adı {0} olmalı', [beklenenAd]));
  if (!metinMi(veri.publishedAt) || Number.isNaN(Date.parse(veri.publishedAt))) hata('publishedAt', _t('ISO tarih-saat olmalı, örnek: 2026-11-03T11:00:00.000Z'));
  metin('period', veri.period, 40);
  metin('title', veri.title, 70);
  metin('summary', veri.summary, 260);

  // Takımlar
  const takimIdleri = new Set();
  if (dizi('teams', veri.teams, 2)) {
    veri.teams.forEach((t, i) => {
      if (!metinMi(t?.id)) hata(`teams[${i}].id`, _t('metin olarak takım kimliği olmalı, örnek: "1"'));
      else if (takimIdleri.has(t.id)) hata(`teams[${i}].id`, _t('"{0}" iki kez kullanılmış', [t.id]));
      else takimIdleri.add(t.id);
      metin(`teams[${i}].name`, t?.name, 40);
    });
  }
  const takimVar = (id) => takimIdleri.has(id);
  const takimAdi = (id) => veri.teams?.find((t) => t.id === id)?.name;

  // Puan durumu
  if (dizi('standings', veri.standings, veri.teams?.length || 1)) {
    const gorulen = new Set();
    veri.standings.forEach((s, i) => {
      const y = `standings[${i}]`;
      if (!takimVar(s?.id)) hata(`${y}.id`, _t('"{0}" diye bir takım yok (teams listesine bak)', [s?.id]));
      if (gorulen.has(s?.id)) hata(`${y}.id`, _t('aynı takım iki kez var'));
      gorulen.add(s?.id);
      for (const k of ['rank', 'wins', 'losses', 'ties']) if (!tamSayiMi(s?.[k])) hata(`${y}.${k}`, _t('tam sayı olmalı'));
    });
  }

  // Haftalar ve eşleşmeler
  if (dizi('weeks', veri.weeks, 1)) {
    const numaralar = veri.weeks.map((w) => w?.week);
    for (let n = 1; n <= veri.week; n++) {
      if (!numaralar.includes(n)) hata('weeks', _t('{0}. hafta eksik. Sezonun tüm tamamlanmış haftaları (1\'den {1}\'e kadar) bu listede olmalı', [n, veri.week]));
    }
    veri.weeks.forEach((w, wi) => {
      const y = `weeks[${wi}]`;
      if (!tamSayiMi(w?.week)) hata(`${y}.week`, _t('tam sayı olmalı'));
      if (w?.week > veri.week) uyari(`${y}.week`, _t('bu sayıdan ({0}) sonraki bir hafta; sitede gösterilmez', [veri.week]));
      metin(`${y}.period`, w?.period, 40);
      if (!dizi(`${y}.matchups`, w?.matchups, 1)) return;
      const haftadaGorulen = new Set();
      w.matchups.forEach((m, mi) => {
        const my = `${y}.matchups[${mi}]`;
        if (!['final', 'live'].includes(m?.status)) hata(`${my}.status`, _t('"final" (bitti) veya "live" (sürüyor) olmalı'));
        if (w.week === veri.week && m?.status !== 'final') uyari(`${my}.status`, _t('sayının haftası henüz bitmemiş görünüyor'));
        for (const taraf of ['home', 'away']) {
          const t = m?.[taraf];
          const ty = `${my}.${taraf}`;
          if (!t) { hata(ty, 'eksik'); continue; }
          if (!takimVar(t.id)) hata(`${ty}.id`, _t('"{0}" diye bir takım yok', [t.id]));
          else if (t.name !== takimAdi(t.id)) uyari(`${ty}.name`, _t('"{0}" yazılmış, teams listesinde "{1}"', [t.name, takimAdi(t.id)]));
          if (haftadaGorulen.has(t.id)) hata(`${ty}.id`, _t('bu takım aynı haftada iki eşleşmede var'));
          haftadaGorulen.add(t.id);
          const sk = t.score;
          if (!sk || !['wins', 'losses', 'ties'].every((k) => tamSayiMi(sk[k]))) hata(`${ty}.score`, _t('{ "wins", "losses", "ties" } tam sayıları olmalı'));
          else if (m.status === 'final' && sk.wins + sk.losses + sk.ties !== KATEGORILER.length) hata(`${ty}.score`, _t('toplam {0} kategori olmalı', [KATEGORILER.length]));
          if (!t.stats) { hata(`${ty}.stats`, 'eksik'); continue; }
          for (const a of ISTATISTIK_ANAHTARLARI) {
            const v = t.stats[a];
            if (v == null || v === '') { hata(`${ty}.stats["${a}"]`, 'eksik'); continue; }
            if (a.endsWith('/A')) { if (!/^\d+\/\d+$/.test(String(v))) hata(`${ty}.stats["${a}"]`, _t('isabet/deneme biçiminde olmalı, örnek: "187/403"')); }
            else if (!Number.isFinite(Number(v))) hata(`${ty}.stats["${a}"]`, _t('sayı olmalı (metin içinde de olabilir, örnek: ".464" veya "521")'));
          }
          for (const [y2, k] of [['FG%', 'FGM/A'], ['FT%', 'FTM/A'], ['3PT%', '3PTM/A']]) {
            const [isabet, deneme] = String(t.stats[k] || '').split('/').map(Number);
            const oran = Number(t.stats[y2]);
            if (deneme > 0 && Number.isFinite(oran) && Math.abs(isabet / deneme - oran) > 0.0015) {
              uyari(`${ty}.stats["${y2}"]`, _t('{0} yazılmış ama {1} = {2} → {3}', [t.stats[y2], k, t.stats[k], (isabet / deneme).toFixed(3)]));
            }
          }
        }
        if (m?.home?.score && m?.away?.score && m.status === 'final') {
          if (m.home.score.wins !== m.away.score.losses || m.home.score.losses !== m.away.score.wins || m.home.score.ties !== m.away.score.ties) {
            hata(`${my}.score`, _t('iki tarafın skoru birbirinin tersi olmalı (ev sahibinin galibiyeti = deplasmanın mağlubiyeti)'));
          }
          if (m.home.stats && m.away.stats) {
            const c = karsilastir(takimIstatistik([{ matchups: [m] }], m.home.id), takimIstatistik([{ matchups: [m] }], m.away.id));
            if (c.wins !== m.home.score.wins || c.losses !== m.home.score.losses) {
              uyari(`${my}`, _t('istatistiklerden hesaplanan sonuç {0}–{1}–{2}, Yahoo skoru {3}–{4}–{5} (istatistik düzeltmesi olabilir; sitede Yahoo skoru gösterilir)', [c.wins, c.losses, c.ties, m.home.score.wins, m.home.score.losses, m.home.score.ties]));
            }
          }
        }
      });
      if (takimIdleri.size && w.matchups.length * 2 !== takimIdleri.size) uyari(`${y}.matchups`, _t('{0} eşleşme var; {1} takım için {2} beklenir', [w.matchups.length, takimIdleri.size, takimIdleri.size / 2]));
    });
  }

  // Gazete içeriği (2. sürüm)
  if (surum === 2) {
    const yazi = veri.article;
    if (!yazi || typeof yazi !== 'object') hata('article', _t('haftanın gazete yazısı eksik: { "paragraphs": ["...", "..."] }'));
    else if (dizi('article.paragraphs', yazi.paragraphs, 3, 8)) yazi.paragraphs.forEach((p, i) => metin(`article.paragraphs[${i}]`, p, 900));
    if (yazi && typeof yazi === 'object') {
      const f = yazi.photo;
      if (f === undefined || f === null) uyari('article.photo', _t('manşet fotoğrafı yok; { "teamId": "2", "caption": "..." } ekle'));
      else if (typeof f !== 'object') hata('article.photo', _t('{ "teamId": "...", "caption": "..." } biçiminde olmalı'));
      else {
        if (!takimVar(f.teamId)) hata('article.photo.teamId', _t('"{0}" teams listesinde yok', [f.teamId]));
        metin('article.photo.caption', f.caption, 140);
        // İsteğe bağlı: sayıya özel fotoğraf public/gorsel/sayi/<image> (yalnızca .jpg); alt ve credit kısa metin.
        if (f.image !== undefined && !/^[\w.-]+\.jpe?g$/i.test(String(f.image))) hata('article.photo.image', _t('public/gorsel/sayi/ içindeki .jpg dosyasının adı olmalı (ör. "hafta-03.jpg")'));
        if (f.alt !== undefined) metin('article.photo.alt', f.alt, 160);
        if (f.credit !== undefined) metin('article.photo.credit', f.credit, 60);
      }
    }
    const kose = veri.column;
    // "Tablo ile Tribün" köşesi sitede artık gösterilmiyor; alan isteğe bağlı, varsa biçimi denetlenir.
    if (kose === undefined || kose === null) { /* yok: sorun değil */ }
    else if (typeof kose !== 'object') hata('column', _t('{ "title": "...", "messages": [...] } biçiminde olmalı'));
    else {
      metin('column.title', kose.title, 90);
      if (dizi('column.messages', kose.messages, 6, 16)) kose.messages.forEach((m, i) => {
        if (!m || (m.from !== 'hoca' && m.from !== 'abi')) hata(`column.messages[${i}].from`, _t('"hoca" (Analitik Hoca) ya da "abi" (Tribün Abi) olmalı'));
        metin(`column.messages[${i}].text`, m && m.text, 320);
      });
    }
    if (dizi('stories', veri.stories, 2, 5)) {
      veri.stories.forEach((s, i) => {
        metin(`stories[${i}].label`, s?.label, 28);
        metin(`stories[${i}].title`, s?.title, 80);
        metin(`stories[${i}].text`, s?.text, 700);
        (s?.teamIds || []).forEach((id, j) => { if (!takimVar(id)) hata(`stories[${i}].teamIds[${j}]`, _t('"{0}" diye bir takım yok', [id])); });
      });
    }
    const fc = veri.forecastColumn; // Kehanet değerlendirmesi (17 Kasım 2026, isteğe bağlı): { hoca, abi }
    if (fc !== undefined) {
      if (typeof fc !== 'object' || Array.isArray(fc) || fc === null) hata('forecastColumn', _t('{ "hoca": "...", "abi": "..." } biçiminde olmalı'));
      else { metin('forecastColumn.hoca', fc.hoca, 450); metin('forecastColumn.abi', fc.abi, 450); } // 18 Kasım 2026: tahmin oyunu yorumları için 320'den 450'ye
    }
    const fh = veri.forecastHour; // Kehanet Saati (18 Kasım 2026, isteğe bağlı): ön sayfada Hoca ile Abi'nin soru-cevap söyleşisi
    if (fh !== undefined) {
      if (typeof fh !== 'object' || Array.isArray(fh) || fh === null) hata('forecastHour', _t('{ "topics": [...], "turns": [...] } biçiminde olmalı'));
      else {
        if (dizi('forecastHour.topics', fh.topics, 1, 4)) fh.topics.forEach((t, i) => metin(`forecastHour.topics[${i}]`, t, 40));
        if (dizi('forecastHour.turns', fh.turns, 3, 5)) fh.turns.forEach((t, i) => {
          if (!t || (t.asker !== 'hoca' && t.asker !== 'abi')) hata(`forecastHour.turns[${i}].asker`, _t('"hoca" (Analitik Hoca) ya da "abi" (Tribün Abi) olmalı'));
          metin(`forecastHour.turns[${i}].question`, t && t.question, 240);
          metin(`forecastHour.turns[${i}].answer`, t && t.answer, 650);
        });
      }
    }
    const fn = veri.forecastNotes; // Kehanet sayfasındaki bölüm notları (18 Kasım 2026, isteğe bağlı)
    if (fn !== undefined) {
      if (typeof fn !== 'object' || Array.isArray(fn) || fn === null) hata('forecastNotes', _t('{ "nextWeek": { "from": "abi", "text": "..." }, … } biçiminde olmalı'));
      else for (const [k, n] of Object.entries(fn)) {
        if (!['nextWeek', 'predictionGame', 'fairTable', 'luck'].includes(k)) { hata(`forecastNotes.${k}`, _t('nextWeek, predictionGame, fairTable ya da luck olmalı')); continue; }
        if (!n || (n.from !== 'hoca' && n.from !== 'abi')) hata(`forecastNotes.${k}.from`, _t('"hoca" ya da "abi" olmalı'));
        metin(`forecastNotes.${k}.text`, n && n.text, 200);
      }
    }
    const sc = veri.chatCounts; // etkileşim kemeri (17 Kasım 2026, isteğe bağlı): { "takımId": mesaj sayısı }
    if (sc !== undefined) {
      if (typeof sc !== 'object' || Array.isArray(sc) || sc === null) hata('chatCounts', _t('{ "1": 120, "2": 45, … } biçiminde olmalı'));
      else for (const [id, n] of Object.entries(sc)) {
        if (!takimVar(id)) hata(`chatCounts.${id}`, _t('"{0}" diye bir takım yok', [id]));
        if (!Number.isInteger(n) || n < 0) hata(`chatCounts.${id}`, _t('sıfır ya da pozitif tam sayı olmalı'));
      }
    }
    const pe = veri.predictionEntries; // tahmin oyunu girişleri (18 Kasım 2026, isteğe bağlı): /api/tahmin?hafta=N çıktısından
    if (pe !== undefined) {
      if (typeof pe !== 'object' || Array.isArray(pe) || pe === null) hata('predictionEntries', _t('{ "takımId": { "picks": { "ev-dep": "takımId" }, "score": [ev, dep] } } biçiminde olmalı'));
      else for (const [id, x] of Object.entries(pe)) {
        if (!takimVar(id)) hata(`predictionEntries.${id}`, _t('"{0}" diye bir takım yok', [id]));
        if (!x || typeof x.picks !== 'object' || Array.isArray(x.picks)) hata(`predictionEntries.${id}.picks`, _t('{ "ev-dep": "takımId" } biçiminde olmalı'));
        else for (const [k, v] of Object.entries(x.picks)) if (!k.split('-').includes(String(v))) hata(`predictionEntries.${id}.picks.${k}`, _t('eşleşmedeki iki takımdan biri olmalı'));
        if (!skorDuzelt(x?.score)) hata(`predictionEntries.${id}.score`, '[ev, deplasman] ya da [ev, deplasman, berabere]; toplam 9');
      }
    }
    const kh = veri.beltNews; // kemer şeridi metni (17 Kasım 2026, isteğe bağlı)
    if (kh !== undefined) {
      if (typeof kh !== 'object' || Array.isArray(kh) || kh === null) hata('beltNews', _t('{ "title": "...", "text": "..." } biçiminde olmalı'));
      else { metin('beltNews.title', kh.title, 90); metin('beltNews.text', kh.text, 420); }
    }
    const eks = veri.breaking;
    // Son dakika haberi isteğe bağlı (9 Kasım 2026): ön sayfanın en üstünde kırmızı şerit.
    if (eks !== undefined && eks !== null) {
      if (typeof eks !== 'object' || Array.isArray(eks)) hata('breaking', _t('{ "title": "...", "text": "..." } biçiminde olmalı'));
      else {
        if (eks.label !== undefined) metin('breaking.label', eks.label, 20);
        metin('breaking.title', eks.title, 90);
        metin('breaking.text', eks.text, 420);
        if (eks.teamIds !== undefined && dizi('breaking.teamIds', eks.teamIds, 0, 3)) {
          eks.teamIds.forEach((id, j) => { if (!takimVar(id)) hata(`breaking.teamIds[${j}]`, _t('"{0}" diye bir takım yok', [id])); });
        }
      }
    }
    if (dizi('teamNotes', veri.teamNotes, takimIdleri.size || 1)) {
      const g = new Set();
      veri.teamNotes.forEach((n, i) => {
        if (!takimVar(n?.teamId)) hata(`teamNotes[${i}].teamId`, _t('"{0}" diye bir takım yok', [n?.teamId]));
        if (g.has(n?.teamId)) hata(`teamNotes[${i}].teamId`, _t('aynı takım için iki not var'));
        g.add(n?.teamId);
        metin(`teamNotes[${i}].text`, n?.text, 500);
      });
      for (const id of takimIdleri) if (!g.has(id)) hata('teamNotes', _t('{0} için takım notu eksik', [takimAdi(id)]));
    }
  }

  // Oyuncu notları
  if (dizi('playerNotes', veri.playerNotes, surum === 2 ? 3 : 1, 8)) {
    veri.playerNotes.forEach((n, i) => {
      const y = `playerNotes[${i}]`;
      metin(`${y}.name`, n?.name, 40);
      metin(`${y}.label`, n?.label, 28);
      metin(`${y}.text`, n?.text, 450);
      if (n?.teamId != null && n.teamId !== '' && !takimVar(n.teamId)) hata(`${y}.teamId`, _t('"{0}" diye bir takım yok (serbest oyuncu için null yaz)', [n.teamId]));
      if (!adresMi(n?.source)) hata(`${y}.source`, _t('http ile başlayan bir kaynak adresi olmalı'));
    });
  }

  // Takas önerileri
  if (dizi('trades', veri.trades, surum === 2 ? 3 : 1, 10)) {
    veri.trades.forEach((t, i) => {
      const y = `trades[${i}]`;
      if (!takimVar(t?.a)) hata(`${y}.a`, _t('"{0}" diye bir takım yok', [t?.a]));
      if (!takimVar(t?.b)) hata(`${y}.b`, _t('"{0}" diye bir takım yok', [t?.b]));
      if (t?.a === t?.b) hata(y, _t('iki taraf aynı takım olamaz'));
      metin(`${y}.giveA`, t?.giveA, 60);
      metin(`${y}.giveB`, t?.giveB, 60);
      metin(`${y}.benefitA`, t?.benefitA, 300);
      metin(`${y}.benefitB`, t?.benefitB, 300);
      metin(`${y}.risk`, t?.risk, 400);
      metin(`${y}.confidence`, t?.confidence, 40);
      if (!adresMi(t?.source)) hata(`${y}.source`, _t('http ile başlayan bir kaynak adresi olmalı'));
    });
  }

  // Kaynaklar
  if (dizi('sources', veri.sources, 1)) {
    veri.sources.forEach((s, i) => {
      metin(`sources[${i}].label`, s?.label, 120);
      if (!adresMi(s?.url)) hata(`sources[${i}].url`, _t('http ile başlayan bir adres olmalı'));
      metin(`sources[${i}].date`, s?.date, 30);
    });
  }

  // Gelecek hafta ve Tribün Abi'nin tahminleri (isteğe bağlı)
  if (veri.nextWeek != null) {
    const g = veri.nextWeek;
    if (typeof g !== 'object') hata('nextWeek', _t('{ "week": N+1, "period": "...", "matchups": [...] } biçiminde olmalı'));
    else {
      if (g.week !== veri.week + 1) hata('nextWeek.week', _t('bu sayıdan bir sonraki hafta ({0}) olmalı', [veri.week + 1]));
      metin('nextWeek.period', g.period, 40);
      if (dizi('nextWeek.matchups', g.matchups, 1)) {
        const gorulen = new Set();
        g.matchups.forEach((m, i) => {
          const y = `nextWeek.matchups[${i}]`;
          for (const yan of ['home', 'away']) {
            if (!takimVar(m?.[yan])) hata(`${y}.${yan}`, _t('"{0}" diye bir takım yok', [m?.[yan]]));
            else if (gorulen.has(m[yan])) hata(`${y}.${yan}`, _t('takım bu haftada iki eşleşmede görünüyor'));
            gorulen.add(m?.[yan]);
          }
          if (m?.abiPick != null && m.abiPick !== m.home && m.abiPick !== m.away) hata(`${y}.abiPick`, _t('eşleşmedeki iki takımdan birinin kimliği olmalı'));
          if (m?.abiNote != null) metin(`${y}.abiNote`, m.abiNote, 140);
        });
        if (veri.teams?.length && gorulen.size !== veri.teams.length) uyari('nextWeek.matchups', _t('{0} takım var, {1} bekleniyordu', [gorulen.size, veri.teams.length]));
        // Tahmin oyunu (18 Kasım 2026, isteğe bağlı): haftanın maçı ve Tribün Abi'nin skor tahmini
        const mw = g.matchOfWeek;
        if (mw != null) {
          if (!g.matchups.some((m) => m?.home === mw.home && m?.away === mw.away)) hata('nextWeek.matchOfWeek', _t('nextWeek.matchups içindeki bir eşleşme olmalı ({ "home": "…", "away": "…" }, aynı yönde)'));
          if (mw.abiScore != null && !skorDuzelt(mw.abiScore)) hata('nextWeek.matchOfWeek.abiScore', '[ev, deplasman] kategori sayısı; toplam en fazla 9 (ör. [5, 4])');
          if (mw.note != null) metin('nextWeek.matchOfWeek.note', mw.note, 200);
        }
      }
    }
  }

  return { hatalar, uyarilar };
}

export function tumunuDogrula(dosyalar) {
  const hatalar = [];
  const uyarilar = [];
  for (const { ad, veri, ayrismaHatasi } of dosyalar) {
    if (ayrismaHatasi) { hatalar.push(_t('{0}: JSON okunamadı — {1}', [ad, ayrismaHatasi])); continue; }
    const r = haftaDosyasiniDogrula(veri, ad);
    hatalar.push(...r.hatalar);
    uyarilar.push(...r.uyarilar);
  }
  const haftalar = dosyalar.filter((d) => d.veri).map((d) => d.veri.week).sort((a, b) => a - b);
  if (!haftalar.length) hatalar.push(_t('veri/haftalar klasöründe hiç hafta dosyası yok'));
  haftalar.forEach((w, i) => { if (i && w === haftalar[i - 1]) hatalar.push(_t('{0}. hafta için iki dosya var', [w])); });
  return { hatalar, uyarilar };
}
