// Sitenin tarayıcı tarafı davranışları. Sayfalar JavaScript olmadan da okunabilir;
// bu dosya sıralama, arama, kapsam seçimi, karşılaştırma, takas süzgeci ve paylaşımı ekler.

import { t as _t, ONDALIK, yuzdeYaz, YEREL, dosyaEki, yolParcasi, sorguAdi, sorguDegeri, sorguDegeriGeri } from '../i18n/t.js';
const $ = (s, kok = document) => kok.querySelector(s);
const $$ = (s, kok = document) => [...kok.querySelectorAll(s)];
// Adres çubuğundaki sorgu adları ve değerleri dile göre (?hafta=sezon → ?week=season); kod içinde Türkçe adlar kullanılır.
const params = () => { const u = new URLSearchParams(location.search); return { get: (k) => sorguDegeriGeri(u.get(sorguAdi(k))) }; };
function adresGuncelle(degisiklik) {
  const p = new URLSearchParams(location.search);
  for (const [k, v] of Object.entries(degisiklik)) (v == null || v === '' ? p.delete(sorguAdi(k)) : p.set(sorguAdi(k), sorguDegeri(v)));
  const q = p.toString();
  history.replaceState(null, '', location.pathname + (q ? '?' + q : '') + location.hash);
}

// ---- Bildirim ----
let bildirimZamani;
function bildir(metin) {
  const b = $('[data-bildirim]');
  if (!b) return;
  b.textContent = metin;
  b.classList.add('acik');
  clearTimeout(bildirimZamani);
  bildirimZamani = setTimeout(() => b.classList.remove('acik'), 3500);
}

// ---- Sayı seçici ----
$$('[data-hafta-sec]').forEach((s) => s.addEventListener('change', () => { location.href = s.value; }));

// ---- Kapsam: son hafta / sezon toplamı ----
const kapsamDinleyicileri = [];
function kapsamUygula(kapsam, adresiDegistir = true) {
  $$('[data-kapsam]').forEach((d) => d.setAttribute('aria-pressed', String(d.dataset.kapsam === kapsam)));
  $$('[data-kapsam-icerik]').forEach((el) => { el.hidden = el.dataset.kapsamIcerik !== kapsam; });
  const SE = dosyaEki('son-hafta'), SZ = dosyaEki('sezon'), EK = new RegExp(`-(${SE}|${SZ})\\.csv$`);
  $$(`a[download][href*="/${yolParcasi('tablo')}/"]`).forEach((a) => {
    a.href = a.href.replace(EK, kapsam === 'sezon' ? `-${SZ}.csv` : `-${SE}.csv`);
    a.download = a.download.replace(EK, kapsam === 'sezon' ? `-${SZ}.csv` : `-${SE}.csv`);
  });
  if (adresiDegistir) adresGuncelle({ kapsam: kapsam === 'sezon' ? 'sezon' : null });
  kapsamDinleyicileri.forEach((f) => f(kapsam));
}
if ($('[data-kapsam]')) {
  $$('[data-kapsam]').forEach((d) => d.addEventListener('click', () => kapsamUygula(d.dataset.kapsam)));
  kapsamUygula(params().get('kapsam') === 'sezon' ? 'sezon' : 'hafta', false);
}
const aktifKapsam = () => ($('[data-kapsam="sezon"][aria-pressed="true"]') ? 'sezon' : 'hafta');

// ---- Tablo sıralama ----
const ozellik = (anahtar) => 'data-' + anahtar.replace('%', 'y').toLowerCase();
$$('[data-tablo]').forEach((tablo) => {
  const govde = tablo.tBodies[0];
  $$('button[data-sirala]', tablo).forEach((d) => {
    d.addEventListener('click', () => {
      const th = d.closest('th');
      const simdiki = th.getAttribute('aria-sort');
      const varsayilan = d.dataset.yon === 'artan' ? 'ascending' : 'descending';
      const yon = simdiki ? (simdiki === 'ascending' ? 'descending' : 'ascending') : varsayilan;
      $$('th[aria-sort]', tablo).forEach((x) => x.removeAttribute('aria-sort'));
      th.setAttribute('aria-sort', yon);
      const ad = ozellik(d.dataset.sirala);
      const satirlar = [...govde.rows];
      satirlar.sort((a, b) => {
        const va = a.getAttribute(ad), vb = b.getAttribute(ad);
        if ((va === '' || va == null) && (vb === '' || vb == null)) return 0;
        if (va === '' || va == null) return 1;
        if (vb === '' || vb == null) return -1;
        return (Number(va) - Number(vb)) * (yon === 'ascending' ? 1 : -1);
      });
      satirlar.forEach((r, i) => { govde.appendChild(r); const no = $('[data-sira-no]', r); if (no) no.textContent = String(i + 1).padStart(2, '0'); });
    });
  });
});

// ---- Oyuncu bul (Oyuncular): ad araması + tek seçimli hızlı filtre; boşken liste gizli ----
// Aksan ve noktasız ı sadeleşir: "jokic" Jokić'i, "isaiah" Isaiah'ı bulur. Adres ?ara= ve ?filtre= ile paylaşılabilir.
const normalAd = (s) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ı/g, 'i').toLowerCase().replace(/\s+/g, ' ').trim();
$$('[data-oyuncu-bul]').forEach((kok) => {
  const ara = $('[data-bul-ara]', kok), dugmeler = $$('[data-bul-filtre]', kok), satirlar = $$('[data-bul-satir]', kok);
  const ipucu = $('[data-bul-ipucu]', kok), bos = $('[data-bul-bos]', kok), sayac = $('[data-bul-sayac]', kok);
  let filtre = dugmeler.some((d) => d.dataset.bulFiltre === params().get('filtre')) ? params().get('filtre') : '';
  ara.value = params().get('ara') ?? '';
  function uygula(adresiDegistir = true) {
    const q = normalAd(ara.value);
    dugmeler.forEach((d) => d.setAttribute('aria-pressed', String(d.dataset.bulFiltre === filtre)));
    const etkin = Boolean(q || filtre);
    let n = 0;
    satirlar.forEach((r) => {
      const gorunur = etkin && (!q || r.dataset.ad.includes(q)) && (!filtre || r.dataset[filtre] === '1');
      r.hidden = !gorunur;
      if (gorunur) n++;
    });
    ipucu.hidden = etkin;
    bos.hidden = !etkin || n > 0;
    sayac.textContent = etkin && n > 0 ? _t('{0} oyuncu', [n]) : '';
    if (adresiDegistir) adresGuncelle({ ara: ara.value.trim() || null, filtre: filtre || null });
  }
  dugmeler.forEach((d) => d.addEventListener('click', () => { filtre = filtre === d.dataset.bulFiltre ? '' : d.dataset.bulFiltre; uygula(); }));
  ara.addEventListener('input', () => uygula());
  uygula(false);
});

// ---- Kadro satırına bağlantı: hedef kapalı "Sezon geçmişi" içindeyse açılır ----
function hedefiAc() {
  if (!location.hash.startsWith('#oyuncu-')) return;
  const hedef = document.getElementById(decodeURIComponent(location.hash.slice(1)));
  const kutu = hedef?.closest('details');
  if (kutu && !kutu.open) { kutu.open = true; hedef.scrollIntoView({ block: 'center' }); }
}
hedefiAc();
addEventListener('hashchange', hedefiAc);

// Dar ekranda her satır, bütün değerlerini koruyan bir karta dönüşür.
// Gerçek iki boyutlu karşılaşma matrisleri ayrı kalır.
$$(_t('.guc-tablosu, .degisim-tablosu, .hareket-tablosu, .hafta-tablosu')).forEach((tablo) => {
  const basliklar = [...tablo.tHead.rows[0].cells].map((h) => h.textContent.trim());
  $$(_t('tbody tr, tfoot tr'), tablo).forEach((r) => [...r.cells].forEach((h, i) => { h.dataset.etiket = basliklar[i]; }));
  tablo.classList.add('mobil-kart-hazir');
  const dugmeler = $$('button[data-sirala]', tablo);
  if (!dugmeler.length) return;
  const arac = document.createElement('div'); arac.className = 'mobil-siralama';
  const etiket = document.createElement('label'); etiket.textContent = _t('Sırala ');
  const sec = document.createElement('select');
  sec.add(new Option(_t('Mevcut sıra'), ''));
  dugmeler.forEach((d, i) => sec.add(new Option(d.textContent.trim(), String(i))));
  const yon = document.createElement('button'); yon.type = 'button'; yon.textContent = _t('Azalan ↓'); yon.disabled = true;
  etiket.append(sec); arac.append(etiket, yon); tablo.before(arac);
  function esitle(d) {
    sec.value = String(dugmeler.indexOf(d)); yon.disabled = false;
    yon.textContent = d.closest('th').getAttribute('aria-sort') === 'ascending' ? _t('Artan ↑') : _t('Azalan ↓');
  }
  sec.addEventListener('change', () => { if (sec.value !== '') dugmeler[Number(sec.value)].click(); });
  yon.addEventListener('click', () => { if (sec.value !== '') dugmeler[Number(sec.value)].click(); });
  dugmeler.forEach((d) => { d.addEventListener('click', () => esitle(d)); if (d.closest('th').hasAttribute('aria-sort')) esitle(d); });
});

// Geniş tablolar: kaydırma yönünü göster; klavyeyle de erişilebilir tut.
$$('.tablo-kutu').forEach((kutu, i) => {
  const tablo = $('table', kutu);
  if (!tablo) return;
  const ipucu = document.createElement('p');
  ipucu.className = 'tablo-kaydirma'; ipucu.id = `tablo-kaydirma-${i}`; ipucu.hidden = true;
  kutu.before(ipucu);
  kutu.setAttribute('role', 'region');
  kutu.setAttribute('aria-label', $('caption', tablo)?.textContent.trim() || _t('Veri tablosu'));
  const guncelle = () => {
    const yatay = kutu.clientWidth > 0 && kutu.scrollWidth > kutu.clientWidth + 2;
    const dikey = kutu.clientHeight > 0 && kutu.scrollHeight > kutu.clientHeight + 2;
    kutu.tabIndex = yatay || dikey ? 0 : -1;
    ipucu.hidden = !yatay;
    if (yatay) {
      const sol = kutu.scrollLeft > 2;
      const sag = kutu.scrollLeft + kutu.clientWidth < kutu.scrollWidth - 2;
      ipucu.textContent = `${sol ? '← ' : ''}${sag ? _t('Diğer sütunlar için sağa kaydır') : _t('İlk sütunlar için sola kaydır')}${sag ? ' →' : ''}`;
      kutu.setAttribute('aria-describedby', ipucu.id);
    } else kutu.removeAttribute('aria-describedby');
  };
  const boyutIzle = new ResizeObserver(guncelle);
  boyutIzle.observe(kutu); boyutIzle.observe(tablo);
  kutu.addEventListener('scroll', guncelle, { passive: true });
  guncelle();
});

// ---- Takım arama ----
$$('[data-ara]').forEach((girdi) => {
  girdi.addEventListener('input', () => {
    const q = girdi.value.toLocaleLowerCase(YEREL).trim();
    $$('[data-tablo]').forEach((tablo) => {
      const satirlar = $$(_t('tbody tr'), tablo);
      satirlar.forEach((r) => { r.hidden = Boolean(q && !(r.dataset.ad ?? '').includes(q)); });
      let bos = $('[data-arama-bos]', tablo.parentElement);
      if (!bos) {
        bos = document.createElement('p'); bos.dataset.aramaBos = ''; bos.className = 'bilgi-notu';
        bos.setAttribute('role', 'status'); tablo.after(bos);
      }
      bos.hidden = satirlar.some((r) => !r.hidden);
      bos.textContent = bos.hidden ? '' : _t('Bu aramayla eşleşen takım yok.');
    });
  });
});

// ---- Karşılaştır: ?a=&b=&hafta= (hafta=sezon: sezon toplamı; boşsa son hafta) ----
const kiyasVeri = $('#kiyas-veri');
if (kiyasVeri) {
  const V = JSON.parse(kiyasVeri.textContent);
  const slugdanId = (s) => V.takimlar.find((t) => t.slug === s)?.id;
  const idden = (id) => V.takimlar.find((t) => t.id === id);
  const secA = $('[data-kiyas="a"]'), secB = $('[data-kiyas="b"]'), secH = $('[data-kiyas-hafta]');
  const p = params();
  const ilkA = slugdanId(p.get('a')) || V.varsayilan.a;
  let ilkB = slugdanId(p.get('b')) || V.varsayilan.b;
  if (ilkB === ilkA) ilkB = V.takimlar.find((t) => t.id !== ilkA).id;
  secA.value = idden(ilkA).slug; secB.value = idden(ilkB).slug;
  const h0 = p.get('hafta') || (p.get('kapsam') === 'sezon' ? 'sezon' : '');
  if (h0 && [...secH.options].some((o) => o.value === h0)) secH.value = h0;

  const yuzde = (k) => k.includes('%');
  const bicim = (v, k) => (v == null ? '—' : yuzde(k) ? yuzdeYaz((v * 100).toFixed(1).replace('.', ONDALIK)) : Number.isInteger(v) ? String(v) : v.toFixed(1).replace('.', ONDALIK));
  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const kim = (ist, a, b, k) => {
    const va = ist[a]?.[k], vb = ist[b]?.[k];
    if (va == null || vb == null) return null;
    const f = (va - vb) * (k === 'TO' ? -1 : 1);
    return f > 1e-9 ? 'a' : f < -1e-9 ? 'b' : '=';
  };
  const sayac = (ist, a, b) => V.kategoriler.reduce((s, { k }) => { const r = kim(ist, a, b, k); if (r === 'a') s.a++; else if (r === 'b') s.b++; else if (r === '=') s.t++; return s; }, { a: 0, b: 0, t: 0 });
  const gercekMac = (H, a, b) => H.eslesmeler.find((m) => (m.ev === a && m.dep === b) || (m.ev === b && m.dep === a));

  function ciz() {
    const a = slugdanId(secA.value), b = slugdanId(secB.value);
    const A = idden(a).ad, B = idden(b).ad;
    const sezon = secH.value === 'sezon';
    const H = sezon ? null : V.haftalar.find((h) => String(h.hafta) === secH.value) || V.haftalar.at(-1);
    const { ist, sira } = sezon ? V.sezon : H;
    const uzunluk = (id, k) => (sira[id]?.[k] == null ? 0 : ((V.n + 1 - sira[id][k]) / V.n) * 100);
    const s = sayac(ist, a, b);
    const satirlar = V.kategoriler.map(({ k, ad }) => {
      const r = kim(ist, a, b, k);
      return `<div class="kiyas-satir">
        <span class="kiyas-deger${r === 'a' ? ' kazanan' : ''}">${r === 'a' ? '<span class="gizli">kazanan: </span>' : ''}${bicim(ist[a]?.[k], k)}</span>
        <span class="kiyas-cubuk sol" aria-hidden="true"><i style="width:${uzunluk(a, k)}%"></i></span>
        <span class="kiyas-kat"><abbr title="${esc(ad)}">${k}</abbr></span>
        <span class="kiyas-cubuk" aria-hidden="true"><i style="width:${uzunluk(b, k)}%"></i></span>
        <span class="kiyas-deger sag${r === 'b' ? ' kazanan' : ''}">${r === 'b' ? '<span class="gizli">kazanan: </span>' : ''}${bicim(ist[b]?.[k], k)}</span>
      </div>`;
    });
    $('[data-kiyas-baslik]').textContent = sezon ? _t('Sezon toplamı · {0} hafta', [V.haftalar.length]) : _t('Hafta {0} · {1} · bu hafta karşılaşsalardı', [H.hafta, H.donem]);
    $('[data-kiyas-ad="a"]').innerHTML = `<span class="renk-nokta a" aria-hidden="true"></span>${esc(A)}`;
    $('[data-kiyas-ad="b"]').innerHTML = `${esc(B)}<span class="renk-nokta b" aria-hidden="true"></span>`;
    $('[data-kiyas-skor]').innerHTML = `<b class="${s.a > s.b ? 'kazanan' : ''}">${s.a}</b><span aria-hidden="true">:</span><span class="gizli"> – </span><b class="${s.b > s.a ? 'kazanan' : ''}">${s.b}</b>`;
    $('[data-kiyas-satirlar]').innerHTML = satirlar.join('');
    $('[data-kiyas-dipnot]').textContent = _t('Berabere kategori: {0}. Top kaybında (TO) düşük değer kazanır.', [s.t]);

    // Gerçek karşılaşma notu
    const resmi = $('[data-kiyas-resmi]');
    const gercekler = V.haftalar.map((h) => ({ h, m: gercekMac(h, a, b) })).filter((x) => x.m);
    const macYaz = ({ h, m }) => { const sa = m.ev === a ? m.evSkor : m.depSkor, sb = m.ev === a ? m.depSkor : m.evSkor; return _t('Hafta {0}: {1} {2}–{3} {4}{5}', [h.hafta, A, sa, sb, B, m.beraber ? _t(' ({0} beraberlik)', [m.beraber]) : '']); };
    if (!sezon && gercekMac(H, a, b)) { resmi.hidden = false; resmi.textContent = _t('Bu hafta gerçekten karşılaştılar. Yahoo sonucu: {0}.', [macYaz({ h: H, m: gercekMac(H, a, b) }).replace(/^Hafta \d+: /, '')]); }
    else if (sezon && gercekler.length) { resmi.hidden = false; resmi.textContent = _t('Sezon boyunca gerçek karşılaşmalar: {0}.', [gercekler.map(macYaz).join(' · ')]); }
    else resmi.hidden = true;

    // Son şampiyonun tarafına altın çerçeve (18 Kasım 2026)
    const alan = $('[data-kiyas-alan]');
    alan.classList.toggle('sampiyon-sol', V.sampiyon === a);
    alan.classList.toggle('sampiyon-sag', V.sampiyon === b);
    alan.dataset.sampiyonEtiket = V.sampiyon === a || V.sampiyon === b ? _t('Son şampiyon') : '';

    // Koçlar · tüm zamanlar (18 Kasım 2026): üstteki sezon karşılaştırmasıyla aynı satır düzeni
    const tarih = $('[data-kiyas-tarih]');
    if (tarih) {
      const ters = Number(a) > Number(b);
      const T = V.gecmis?.[ters ? `${b}-${a}` : `${a}-${b}`];
      const KA = V.koclar?.[a], KB = V.koclar?.[b];
      const [g, m] = T ? (ters ? [T.m, T.g] : [T.g, T.m]) : [0, 0];
      const tum = Object.values(V.koclar || {});
      const enCok = (f) => Math.max(1, ...tum.map(f));
      const satir = (ad, va, vb, yaz, uzun, ustun) => {
        const r = va == null || vb == null || va === vb ? '=' : ustun(va, vb) ? 'a' : 'b';
        return `<div class="kiyas-satir">
          <span class="kiyas-deger${r === 'a' ? ' kazanan' : ''}">${r === 'a' ? _t('<span class="gizli">önde: </span>') : ''}${yaz(va)}</span>
          <span class="kiyas-cubuk sol" aria-hidden="true"><i style="width:${uzun(va)}%"></i></span>
          <span class="kiyas-kat kiyas-kat--uzun">${ad}</span>
          <span class="kiyas-cubuk" aria-hidden="true"><i style="width:${uzun(vb)}%"></i></span>
          <span class="kiyas-deger sag${r === 'b' ? ' kazanan' : ''}">${r === 'b' ? _t('<span class="gizli">önde: </span>') : ''}${yaz(vb)}</span>
        </div>`;
      };
      const sayi_ = (v) => (v == null ? '—' : String(v));
      const oranUzun = (k) => (v) => (v == null ? 0 : (v / enCok(k)) * 100);
      const buyuk = (x, y) => x > y;
      const sira = (x) => (x?.enIyi ? x.enIyi.sira / x.enIyi.n : null);
      $('[data-kiyas-koc-ad="a"]').textContent = A;
      $('[data-kiyas-koc-ad="b"]').textContent = B;
      $('[data-kiyas-koc-skor]').innerHTML = T ? `<b class="${g > m ? 'kazanan' : ''}">${g}</b><span aria-hidden="true">:</span><span class="gizli"> – </span><b class="${m > g ? 'kazanan' : ''}">${m}</b>` : _t('<span class="soluk">ilk kez</span>');
      $('[data-kiyas-koc-satirlar]').innerHTML = [
        satir(_t('Birbirine karşı'), T ? g : 0, T ? m : 0, sayi_, (v) => (T && T.maclar.length ? (v / T.maclar.length) * 100 : 0), buyuk),
        satir(_t('Şampiyonluk'), KA?.sampiyonluk, KB?.sampiyonluk, sayi_, oranUzun((x) => x.sampiyonluk), buyuk),
        satir('Final', KA?.final, KB?.final, sayi_, oranUzun((x) => x.final), buyuk),
        satir(_t('Eleme turu'), KA?.eleme, KB?.eleme, sayi_, oranUzun((x) => x.eleme), buyuk),
        satir(_t('Kazanma oranı'), KA?.oran, KB?.oran, (v) => (v == null ? '—' : yuzdeYaz(Math.round(v * 100))), oranUzun((x) => x.oran), buyuk),
        satir(_t('En iyi sezon'), sira(KA), sira(KB), (v) => { const x = v === sira(KA) ? KA : KB; return v == null ? _t('ilk sezonu') : `${x.enIyi.sira}. <span class="soluk">${x.enIyi.etiket}</span>`; }, (v) => (v == null ? 0 : (1 - v) * 100 + 7), (x, y) => x < y),
      ].join('');
      const ozet = $('[data-kiyas-tarih-ozet]'), liste = $('[data-kiyas-tarih-liste]'), detay = $('[data-kiyas-tarih-detay]');
      if (!T) { ozet.textContent = _t('Bu iki koç daha önce hiç karşılaşmadı.'); detay.hidden = true; }
      else {
        const [ka, kb] = ters ? [T.kb, T.ka] : [T.ka, T.kb];
        ozet.innerHTML = _t('<b>{0}</b> karşılaşma{1} · kategori toplamı {2}–{3}{4}{5}.', [T.maclar.length, T.b ? _t(', {0} berabere', [T.b]) : '', ka, kb, T.kt ? _t(' ({0} berabere)', [T.kt]) : '', T.eleme ? _t(' · {0} kez eleme turunda', [T.eleme]) : '']);
        const TUR = { p: _t(' · eleme turu'), k: _t(' · teselli turu'), n: '' };
        liste.innerHTML = [...T.maclar].reverse().map(([etiket, hafta, x, y, tur, adX, adY]) => {
          const [sa, sb, nA, nB] = ters ? [y, x, adY, adX] : [x, y, adX, adY];
          return _t('<li><span class="soluk">{0} · {1}. hafta{2}</span> <span class="{3}">{4}</span> {5}–{6} <span class="{7}">{8}</span></li>', [esc(etiket), hafta, TUR[tur] || '', sa > sb ? 'kazanan' : '', esc(nA), sa, sb, sb > sa ? 'kazanan' : '', esc(nB)]);
        }).join('');
        detay.hidden = false;
      }
    }

    document.title = document.title.replace(/^[^·]*·/, `${A} – ${B} ·`);
  }
  function degisti() {
    if (secA.value === secB.value) secB.value = V.takimlar.find((t) => t.slug !== secA.value).slug;
    adresGuncelle({ a: secA.value, b: secB.value, hafta: secH.value === String(V.sonHafta) ? null : secH.value, kapsam: null });
    ciz();
  }
  secA.addEventListener('change', degisti);
  secB.addEventListener('change', degisti);
  secH.addEventListener('change', degisti);
  $('[data-kiyas-degistir]').addEventListener('click', () => { [secA.value, secB.value] = [secB.value, secA.value]; degisti(); });
  ciz();
}

// ---- Takas süzgeci ----
const takasFiltre = $('[data-takas-filtre]');
if (takasFiltre) {
  const uygula = (adresiDegistir = true) => {
    const s = takasFiltre.value;
    let gorunen = 0;
    $$('[data-taraflar]').forEach((k) => {
      const goster = !s || k.dataset.taraflar.split(' ').includes(s);
      k.hidden = !goster;
      if (goster) gorunen++;
    });
    $('[data-takas-sayac]').textContent = _t('{0} Takas Masası', [gorunen]);
    $('[data-takas-bos]').hidden = gorunen > 0;
    if (adresiDegistir) adresGuncelle({ takim: s || null });
  };
  const ilk = params().get('takim');
  if (ilk && [...takasFiltre.options].some((o) => o.value === ilk)) takasFiltre.value = ilk;
  takasFiltre.addEventListener('change', () => uygula());
  uygula(false);
}

// ---- İpucu: [data-ipucu] taşıyan işaretler ("değer|açıklama|açıklama"). Fareyle üstüne gelince, dokununca görünür. ----
const ipucuKutu = $('[data-ipucu-kutu]');
if (ipucuKutu) {
  let aktif = null;
  const gizle = () => { ipucuKutu.hidden = true; aktif = null; };
  const goster = (el, x, y) => {
    const parcalar = el.getAttribute('data-ipucu').split('|');
    ipucuKutu.replaceChildren(...parcalar.map((p, i) => { const e = document.createElement(i ? 'span' : 'b'); e.textContent = p; return e; }));
    ipucuKutu.hidden = false;
    const r = ipucuKutu.getBoundingClientRect();
    let sol = x + 14, ust = y + 16;
    if (sol + r.width > innerWidth - 8) sol = x - r.width - 14;
    if (ust + r.height > innerHeight - 8) ust = y - r.height - 14;
    ipucuKutu.style.left = Math.max(8, sol) + 'px';
    ipucuKutu.style.top = Math.max(8, ust) + 'px';
    aktif = el;
  };
  document.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    const el = e.target.closest?.('[data-ipucu]');
    if (el) goster(el, e.clientX, e.clientY); else if (aktif) gizle();
  });
  document.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse') return;
    const el = e.target.closest?.('[data-ipucu]');
    if (el && el !== aktif) { const r = el.getBoundingClientRect(); goster(el, r.left + r.width / 2, r.top + r.height / 2); }
    else gizle();
  });
  document.addEventListener('pointerleave', gizle);
  addEventListener('scroll', gizle, { passive: true });
}

// ---- Takım vurgulama (Analiz): ?takim=slug ----
let vurguId = '';
const vurguDinleyicileri = [];
const vurguSec = $('[data-vurgu]');
if (vurguSec) {
  const kok = $('main');
  const uygula = (adresiDegistir = true) => {
    vurguId = vurguSec.selectedOptions[0]?.dataset.id || '';
    $$('[data-takim]').forEach((el) => el.classList.toggle('vurgulu', !!vurguId && el.dataset.takim === vurguId));
    kok.classList.toggle('vurgu-var', !!vurguId);
    vurguDinleyicileri.forEach((f) => f(vurguId));
    if (adresiDegistir) adresGuncelle({ takim: vurguSec.value || null });
  };
  const ilk = params().get('takim');
  if (ilk && [...vurguSec.options].some((o) => o.value === ilk)) vurguSec.value = ilk;
  vurguSec.addEventListener('change', () => uygula());
  uygula(false);
}

// ---- Kendi grafiğini kur (Analiz): ?x=3PTA&y=3PT%25 ----
const grafikVeri = $('#grafik-veri');
if (grafikVeri) {
  const G = JSON.parse(grafikVeri.textContent);
  const alan = $('[data-grafik-alan]');
  const secX = $('[data-grafik="x"]'), secY = $('[data-grafik="y"]');
  const not = $('[data-grafik-not]');
  const olcu = (k) => G.olculer.find((o) => o.k === k);
  const bicim = (v, o, kesin = 1) => (v == null ? '—' : o.yuzde ? yuzdeYaz((v * 100).toFixed(kesin).replace('.', ONDALIK)) : Number.isInteger(v) ? String(v) : v.toFixed(1).replace('.', ONDALIK));
  const NS = 'http://www.w3.org/2000/svg';
  const ogeYap = (ad, ozel, ust) => { const e = document.createElementNS(NS, ad); for (const [k, v] of Object.entries(ozel || {})) e.setAttribute(k, v); if (ust) ust.appendChild(e); return e; };
  const metin = (ozel, yazi, ust) => { const e = ogeYap('text', ozel, ust); e.textContent = yazi; return e; };
  const olcek = (min, max) => {
    let a = min, b = max;
    if (a === b) { const p = Math.abs(a) * 0.05 || 1; a -= p; b += p; }
    const pay = (b - a) * 0.08; a -= pay; b += pay;
    const ham = (b - a) / 6, us = Math.pow(10, Math.floor(Math.log10(ham))), f = ham / us;
    const adim = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * us;
    const isaretler = [];
    for (let t = Math.ceil(a / adim) * adim; t <= b + 1e-12; t += adim) isaretler.push(+t.toFixed(10));
    return { a, b, adim, isaretler };
  };
  const ortala = (d) => d.reduce((s, v) => s + v, 0) / d.length;

  function ciz() {
    const ox = olcu(secX.value), oy = olcu(secY.value);
    const veri = G.kapsam[aktifKapsam()];
    const noktalar = G.takimlar.map((t) => ({ ...t, x: veri[t.id][ox.k], y: veri[t.id][oy.k] })).filter((p) => p.x != null && p.y != null);
    const en = Math.max(280, alan.clientWidth);
    const boy = Math.round(Math.min(480, Math.max(300, en * 0.6)));
    const m = { sol: en < 500 ? 50 : 60, sag: 14, ust: 14, alt: 48 };
    const sx = olcek(Math.min(...noktalar.map((p) => p.x)), Math.max(...noktalar.map((p) => p.x)));
    const sy = olcek(Math.min(...noktalar.map((p) => p.y)), Math.max(...noktalar.map((p) => p.y)));
    const X = (v) => m.sol + ((v - sx.a) / (sx.b - sx.a)) * (en - m.sol - m.sag);
    const Y = (v) => boy - m.alt - ((v - sy.a) / (sy.b - sy.a)) * (boy - m.ust - m.alt);
    const svg = ogeYap('svg', { width: en, height: boy, viewBox: `0 0 ${en} ${boy}`, role: 'img', 'aria-label': _t('{0} ile {1}: {2} takım', [ox.ad, oy.ad, noktalar.length]) });
    if (vurguId) svg.classList.add('vurgu-var-grafik');
    const kesin = (s) => (s.adim * 100 < 1 ? 1 : 0);
    for (const t of sy.isaretler) {
      ogeYap('line', { class: 'izgara', x1: m.sol, x2: en - m.sag, y1: Y(t), y2: Y(t) }, svg);
      metin({ x: m.sol - 8, y: Y(t) + 4, 'text-anchor': 'end' }, bicim(t, oy, kesin(sy)), svg);
    }
    for (const t of sx.isaretler) {
      ogeYap('line', { class: 'eksen', x1: X(t), x2: X(t), y1: boy - m.alt, y2: boy - m.alt + 5 }, svg);
      metin({ x: X(t), y: boy - m.alt + 19, 'text-anchor': 'middle' }, bicim(t, ox, kesin(sx)), svg);
    }
    ogeYap('line', { class: 'eksen', x1: m.sol, x2: en - m.sag, y1: boy - m.alt, y2: boy - m.alt }, svg);
    metin({ class: 'eksen-ad', x: (m.sol + en - m.sag) / 2, y: boy - 6, 'text-anchor': 'middle' }, `${ox.ad} →`, svg);
    metin({ class: 'eksen-ad', x: 0, y: 0, transform: `translate(14 ${(m.ust + boy - m.alt) / 2}) rotate(-90)`, 'text-anchor': 'middle' }, `${oy.ad} →`, svg);
    // Lig ortalaması çizgileri
    const ortX = ortala(noktalar.map((p) => p.x)), ortY = ortala(noktalar.map((p) => p.y));
    ogeYap('line', { class: 'ort', x1: X(ortX), x2: X(ortX), y1: m.ust, y2: boy - m.alt }, svg);
    ogeYap('line', { class: 'ort', x1: m.sol, x2: en - m.sag, y1: Y(ortY), y2: Y(ortY) }, svg);
    metin({ x: X(ortX) + 5, y: m.ust + 10 }, _t('ortalama'), svg);
    // Seçici etiketler: uç değerler ve vurgulanan takım
    const uclar = new Set();
    for (const [o, yon] of [['x', 1], ['x', -1], ['y', 1], ['y', -1]]) uclar.add([...noktalar].sort((p, q) => (q[o] - p[o]) * yon)[0].id);
    for (const p of noktalar) {
      const g = ogeYap('g', { class: 'nokta', 'data-takim': p.id, 'data-ipucu': `${p.ad}|${ox.ad}: ${bicim(p.x, ox)}|${oy.ad}: ${bicim(p.y, oy)}` }, svg);
      const vurgulu = p.id === vurguId;
      if (vurgulu) g.classList.add('vurgulu');
      ogeYap('circle', { class: 'vurur', cx: X(p.x), cy: Y(p.y), r: 14 }, g);
      ogeYap('circle', { class: 'nokta-isaret', cx: X(p.x), cy: Y(p.y), r: vurgulu ? 8 : 6 }, g);
      if (vurgulu || (!vurguId && uclar.has(p.id))) {
        const sagda = X(p.x) < en * 0.62;
        metin({ class: 'etiket', x: X(p.x) + (sagda ? 11 : -11), y: Y(p.y) + 4, 'text-anchor': sagda ? 'start' : 'end' }, p.ad, g);
      }
    }
    // Vurgulanan nokta en üstte dursun
    const v = svg.querySelector('g.vurgulu'); if (v) svg.appendChild(v);
    alan.replaceChildren(svg);
    const azIyi = [ox, oy].filter((o) => o.azIyi).map((o) => o.ad.toLocaleLowerCase(YEREL));
    not.textContent = _t('{0} takım, {1}. Etiketli noktalar uç değerler{2}; diğerleri için noktanın üstüne gel ya da dokun.{3}', [noktalar.length, aktifKapsam() === 'sezon' ? _t('sezon toplamı') : _t('son hafta'), vurguId ? _t(' ve vurgulanan takım') : '', azIyi.length ? _t(' {0} için düşük değer iyidir.', [azIyi.join(_t(' ve '))]) : '']);
  }
  const p = params();
  if (p.get('x') && olcu(p.get('x'))) secX.value = p.get('x');
  if (p.get('y') && olcu(p.get('y'))) secY.value = p.get('y');
  const degisti = () => { adresGuncelle({ x: secX.value, y: secY.value }); ciz(); };
  secX.addEventListener('change', degisti);
  secY.addEventListener('change', degisti);
  $('[data-grafik-degistir]').addEventListener('click', () => { [secX.value, secY.value] = [secY.value, secX.value]; degisti(); });
  kapsamDinleyicileri.push(ciz);
  vurguDinleyicileri.push(ciz);
  let bekle;
  new ResizeObserver(() => { clearTimeout(bekle); bekle = setTimeout(ciz, 80); }).observe(alan);
  ciz();
}

// ---- Menü paneli (sağ üstteki düğme) ----
const menuDugme = $('[data-menu-dugme]'), menuPanel = $('[data-menu-panel]'), menuPerde = $('[data-menu-perde]');
if (menuDugme && menuPanel && menuPerde) {
  const yazi = $('[data-menu-yazi]');
  const acik = () => menuDugme.getAttribute('aria-expanded') === 'true';
  const ac = () => {
    menuPanel.hidden = false; menuPerde.hidden = false;
    requestAnimationFrame(() => requestAnimationFrame(() => document.documentElement.classList.add('menu-acik')));
    menuDugme.setAttribute('aria-expanded', 'true'); yazi.textContent = _t('Menüyü kapat');
    (menuPanel.querySelector('a[aria-current="page"]') || menuPanel.querySelector('a')).focus({ preventScroll: true });
  };
  const kapat = (odak = true) => {
    document.documentElement.classList.remove('menu-acik');
    menuDugme.setAttribute('aria-expanded', 'false'); yazi.textContent = _t('Menüyü aç');
    setTimeout(() => { if (!acik()) { menuPanel.hidden = true; menuPerde.hidden = true; } }, 240);
    if (odak) menuDugme.focus({ preventScroll: true });
  };
  menuDugme.addEventListener('click', () => (acik() ? kapat() : ac()));
  menuPerde.addEventListener('click', () => kapat(false));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && acik()) kapat(); });
  menuPanel.addEventListener('click', (e) => { if (e.target.closest('a')) kapat(false); });
}

// ---- Telefonda katlama: [data-katla="2"] ilk 2 öğeyi gösterir, gerisi "Devamını oku" ile açılır ----
const darEkran = matchMedia(_t('(max-width: 734px)'));
$$('[data-katla]').forEach((kap) => {
  const sinir = Number(kap.dataset.katla);
  const ogeler = [...kap.children];
  if (!darEkran.matches || ogeler.length <= sinir + 1) return;
  const gizlenen = ogeler.slice(sinir);
  gizlenen.forEach((o) => { o.hidden = true; });
  kap.classList.add('katli');
  const d = document.createElement('button');
  d.type = 'button';
  d.className = 'katla-dugme';
  d.textContent = _t('Devamını oku ({0} {1} daha)', [gizlenen.length, kap.dataset.katlaEtiket || _t('bölüm')]);
  d.addEventListener('click', () => {
    gizlenen.forEach((o) => { o.hidden = false; });
    kap.classList.remove('katli');
    gizlenen[0].setAttribute('tabindex', '-1');
    gizlenen[0].focus({ preventScroll: true });
    d.remove();
  });
  kap.after(d);
});

// ---- Kehanet Saati (telefon): yalnızca ilk soru görünür, cevabı bulanıklaşarak kesilir; "Devamını oku" hepsini açar ----
$$('[data-ks-katla]').forEach((kap) => {
  const ogeler = [...kap.children];
  if (!darEkran.matches || ogeler.length < 2) return;
  const gizlenen = ogeler.slice(1);
  gizlenen.forEach((o) => { o.hidden = true; });
  ogeler[0].classList.add('ks-onizleme');
  const d = document.createElement('button');
  d.type = 'button';
  d.className = 'katla-dugme';
  d.textContent = _t('Devamını oku ({0} soru daha)', [gizlenen.length]);
  d.addEventListener('click', () => {
    ogeler[0].classList.remove('ks-onizleme');
    gizlenen.forEach((o) => { o.hidden = false; });
    const cevap = ogeler[0].querySelector('.ks-cevap');
    if (cevap) { cevap.setAttribute('tabindex', '-1'); cevap.focus({ preventScroll: true }); }
    d.remove();
  });
  kap.after(d);
});

// ---- Ön sayfa atlama çubuğu: okunan bölüm işaretlenir ----
const atlama = $('[data-atlama]');
if (atlama && 'IntersectionObserver' in window) {
  const baglar = $$('a[data-atla]', atlama);
  baglar.forEach((a) => { a.dataset.atla = decodeURIComponent(a.hash.slice(1)); }); // kimlikler dile göre çevrilmiş olabilir
  baglar.forEach((a) => { if (!document.getElementById(a.dataset.atla)) a.hidden = true; }); // sayfada olmayan bölüm görünmesin
  const hedefler = baglar.map((a) => document.getElementById(a.dataset.atla)).filter(Boolean);
  let son = '';
  const isaretle = (id) => {
    if (id === son) return;
    son = id;
    baglar.forEach((a) => {
      const aktif = a.dataset.atla === id;
      if (aktif) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current');
      if (aktif) atlama.scrollTo({ left: a.offsetLeft - atlama.clientWidth / 2 + a.clientWidth / 2, behavior: 'smooth' });
    });
  };
  const gorunur = new Map();
  const gozlem = new IntersectionObserver((girdiler) => {
    girdiler.forEach((g) => gorunur.set(g.target.id, g.isIntersecting ? g.boundingClientRect.top : null));
    const sirali = [...gorunur].filter(([, t]) => t != null).sort((a, b) => a[1] - b[1]);
    if (sirali.length) isaretle(sirali[0][0]);
  }, { rootMargin: '-130px 0px -55% 0px' });
  hedefler.forEach((h) => gozlem.observe(h));
  if (hedefler[0]) isaretle(hedefler[0].id);
}

// ---- Ana ekrana ekleme ve yeni sayı bildirimi (17 Kasım 2026) ----
// Telefonda, ana ekrana eklenmemişse: ilk ziyarette biraz kaydırınca "Yeni sayıyı kaçırma" penceresi (iPhone'da adımlar,
// Android'de "Ana ekrana ekle" düğmesi). "Daha sonra" diyen yeni sayıya kadar görmez. Aynı ziyarette takım penceresi açılmaz.
// Ana ekrandan açılınca (uygulama gibi): bildirim izni istenmemişse "Bildirimleri aç" penceresi. Abonelik /api/abone'ye gider;
// seçili takım hizmet çalışanına bildirilir (kişiye özel bildirim metni için).
const bagimsiz = matchMedia(_t('(display-mode: standalone)')).matches || navigator.standalone === true;
const sonSayiNo = Number(document.body.dataset.sonSayi) || 0;
const yerelOku = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const yerelYaz = (k, v) => { try { localStorage.setItem(k, v); } catch { /* gizli pencere */ } };
const kurulumDugmeleri = $$('[data-kurulum-dugme]');
let kurulumOlayi = null;
const kurulumGizle = () => { kurulumDugmeleri.forEach((d) => { d.hidden = true; }); };
const pencereAc = (dlg) => {
  if (!dlg || dlg.open || typeof dlg.showModal !== 'function') return;
  dlg.showModal();
  document.documentElement.classList.add('pencere-acik');
  requestAnimationFrame(() => requestAnimationFrame(() => dlg.classList.add('acik')));
};
const pencereKapat = (dlg) => {
  dlg.classList.remove('acik');
  document.documentElement.classList.remove('pencere-acik');
  setTimeout(() => { if (dlg.open) dlg.close(); }, 250);
};
const kaydirinca = (fn) => {
  const esik = () => Math.min(400, Math.max(160, window.innerHeight * 0.35));
  const bak = () => { if (window.scrollY > esik()) { removeEventListener('scroll', bak); fn(); } };
  addEventListener('scroll', bak, { passive: true });
  bak();
};
$$('[data-kurulum-sor], [data-bildirim-sor]').forEach((d) => d.addEventListener('cancel', (e) => e.preventDefault()));

const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
// Yalnızca dokunmatik cihaz (telefon, tablet): fareli bilgisayarda dar pencere ya da dokunmatik ekranlı dizüstü sayılmaz (18 Kasım 2026).
const telefon = matchMedia(_t('(hover: none) and (pointer: coarse)')).matches;
const kurulumSor = $('[data-kurulum-sor]');
if (!bagimsiz) {
  if (ios) { const not = $('[data-kurulum-ios]'); if (not) not.hidden = false; const adim = $('[data-kurulum-ios-adim]', kurulumSor || document); if (adim) adim.hidden = false; }
  addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    kurulumOlayi = e;
    kurulumDugmeleri.forEach((d) => { d.hidden = false; });
  });
  const reddedilen = Number(yerelOku('ln-kurulum-sorma-sayi') || 0);
  if (kurulumSor && telefon && reddedilen < sonSayiNo) {
    document.documentElement.dataset.pencere = 'kurulum'; // bu ziyarette takım penceresi açılmaz
    kaydirinca(() => pencereAc(kurulumSor));
  }
}
kurulumDugmeleri.forEach((d) => d.addEventListener('click', async () => {
  if (!kurulumOlayi) return;
  kurulumOlayi.prompt();
  await kurulumOlayi.userChoice.catch(() => null);
  kurulumOlayi = null;
  kurulumGizle();
  if (kurulumSor?.open) pencereKapat(kurulumSor);
}));
$('[data-kurulum-sor-kapat]')?.addEventListener('click', () => { yerelYaz('ln-kurulum-sorma-sayi', String(sonSayiNo)); pencereKapat(kurulumSor); });
addEventListener('appinstalled', () => { kurulumGizle(); if (kurulumSor?.open) pencereKapat(kurulumSor); });

if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});

// Seçili takımı hizmet çalışanına bildir (bildirim metni kişiye özel olsun)
const swTakim = (id) => { navigator.serviceWorker?.ready.then((r) => r.active?.postMessage({ tip: 'takim', id: id || '' })).catch(() => {}); };
// Bildirim aboneliği
const bildirimAnahtari = document.body.dataset.bildirimAnahtari || '';
const anahtarBaytlari = (b64) => { const p = '='.repeat((4 - (b64.length % 4)) % 4); const h = atob((b64 + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(h, (c) => c.charCodeAt(0)); };
async function bildirimAbone() {
  if (!('Notification' in window) || !('serviceWorker' in navigator) || !bildirimAnahtari) return false;
  const izin = await Notification.requestPermission();
  if (izin !== 'granted') return false;
  const reg = await navigator.serviceWorker.ready;
  const abonelik = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: anahtarBaytlari(bildirimAnahtari) }));
  const takim = yerelOku('ln-takim') || '';
  swTakim(takim);
  const yanit = await fetch('/api/abone', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ abonelik: abonelik.toJSON(), takim }) }).catch(() => null);
  return !!yanit?.ok;
}
const bildirimSor = $('[data-bildirim-sor]');
if (bagimsiz && bildirimSor && 'Notification' in window && 'PushManager' in window && bildirimAnahtari && Notification.permission === 'default'
  && Number(yerelOku('ln-bildirim-sorma-sayi') || 0) < sonSayiNo) {
  document.documentElement.dataset.pencere = 'bildirim';
  kaydirinca(() => pencereAc(bildirimSor));
}
$('[data-bildirim-ac]')?.addEventListener('click', async (e) => {
  e.currentTarget.disabled = true;
  const tamam = await bildirimAbone().catch(() => false);
  pencereKapat(bildirimSor);
  if (typeof bildir === 'function') bildir(tamam ? _t('Bildirimler açık: yeni sayı düşünce haber vereceğiz.') : _t('Bildirim açılamadı; telefonun ayarlarından izin verebilirsin.'));
});
$('[data-bildirim-sor-kapat]')?.addEventListener('click', () => { yerelYaz('ln-bildirim-sorma-sayi', String(sonSayiNo)); pencereKapat(bildirimSor); });

// ---- Üst çubuk (bilgisayar ve telefon): aşağı kaydırınca cam zemin sağ üstteki üç noktaya daralır, yukarı kaydırınca açılır ----
// Analiz araç çubuğu üste yapışınca zemini ekranın üstüne kadar uzar (CSS: .analiz-arac.yapisik).
{
  const arac = $('.analiz-arac');
  if (arac) {
    const yapisikKontrol = () => {
      const st = getComputedStyle(arac);
      arac.classList.toggle('yapisik', st.position === 'sticky' && arac.getBoundingClientRect().top <= parseFloat(st.top) + 1);
    };
    addEventListener('scroll', yapisikKontrol, { passive: true });
    addEventListener('resize', yapisikKontrol);
    yapisikKontrol();
  }
}
// Telefonda üst çubuktaki bölüm satırı yana kayar: açık sayfanın bağlantısı görünür yere alınır.
{
  const menu = $(_t('.ust-ic .menu')), secili = menu?.querySelector('[aria-current="page"]');
  if (menu && secili && menu.scrollWidth > menu.clientWidth) menu.scrollLeft = secili.offsetLeft - menu.clientWidth / 2 + secili.clientWidth / 2;
}
let sonKaydirma = scrollY, yukariToplam = 0;
// Atlama çubuğu daralıp genişleyince okunan bölüm yeniden ortaya alınır.
const atlamaOrtala = () => {
  const a = atlama?.querySelector('[aria-current="location"]');
  if (a) setTimeout(() => atlama.scrollTo({ left: a.offsetLeft - atlama.clientWidth / 2 + a.clientWidth / 2, behavior: 'smooth' }), 470);
};
const daraltKontrol = () => {
  const kok = document.documentElement, y = scrollY, onceki = kok.classList.contains('daralt');
  if (kok.classList.contains('menu-acik')) { sonKaydirma = y; return; }
  if (y < 80) { kok.classList.remove('daralt'); yukariToplam = 0; }
  else if (y > sonKaydirma) { if (y > 140) kok.classList.add('daralt'); yukariToplam = 0; }
  else { yukariToplam += sonKaydirma - y; if (yukariToplam > 80) kok.classList.remove('daralt'); }
  sonKaydirma = y;
  if (onceki !== kok.classList.contains('daralt')) atlamaOrtala();
};
addEventListener('scroll', daraltKontrol, { passive: true });
daraltKontrol();


// ---- Benim takımım: seçim bu tarayıcıda saklanır (ln-takim). Manşet değişmez; [data-takim] taşıyan satırlar vurgulanır,
// [data-benim-one] kapsayıcılarında seçili takımın öğesi başa alınır. Ön sayfada "Benim takımım" kartı, takım sayfasında yıldız düğmesi. ----
const BENIM_ANAHTAR = 'ln-takim';
const benimOku = () => { try { return localStorage.getItem(BENIM_ANAHTAR) || ''; } catch { return ''; } };
const benimYaz = (id) => {
  try { id ? localStorage.setItem(BENIM_ANAHTAR, id) : localStorage.removeItem(BENIM_ANAHTAR); } catch { /* gizli pencere */ }
  // Bildirime abone olunduysa takım değişikliği hizmet çalışanına ve sunucuya da gider (kişiye özel bildirim)
  navigator.serviceWorker?.ready.then(async (r) => {
    r.active?.postMessage({ tip: 'takim', id: id || '' });
    const ab = await r.pushManager?.getSubscription();
    if (ab) fetch('/api/abone', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ abonelik: ab.toJSON(), takim: id || '' }) }).catch(() => {});
  }).catch(() => {});
};
const ilkSiralar = new Map(); // kapsayıcı → ilk sıradaki çocuklar (seçim kaldırılınca geri dönmek için)
function benimUygula(id) {
  $$('.benim').forEach((el) => el.classList.remove('benim'));
  $$('[data-takim]').forEach((el) => { if (id && !el.matches('td, .serit-nokta') && el.dataset.takim.split(' ').includes(id)) el.classList.add('benim'); });
  $$('[data-benim-one]').forEach((kap) => {
    if (!ilkSiralar.has(kap)) ilkSiralar.set(kap, [...kap.children]);
    const ilk = ilkSiralar.get(kap);
    const secili = id ? ilk.filter((c) => c.dataset.takim?.split(' ').includes(id)) : [];
    [...secili, ...ilk.filter((c) => !secili.includes(c))].forEach((c) => kap.appendChild(c));
  });
  const kart = $('[data-benim-kart]');
  if (kart) {
    kart.hidden = false;
    $$('[data-benim-icerik]', kart).forEach((d) => { d.hidden = d.dataset.benimIcerik !== id; });
    const bos = $('[data-benim-bos]', kart);
    if (bos) bos.hidden = Boolean(id);
  }
  $$('[data-benim-sec]').forEach((s) => { s.value = id; });
  $$('[data-benim-dugme]').forEach((b) => {
    b.hidden = false;
    const benimMi = b.dataset.benimDugme === id;
    b.setAttribute('aria-pressed', String(benimMi));
    const y = $('[data-benim-yazi]', b);
    if (y) y.textContent = benimMi ? _t('Benim takımım (seçimi kaldır)') : _t('Benim takımım yap');
    b.title = benimMi ? _t('Benim takımım: kaldırmak için dokun') : _t('Benim takımım yap');
  });
}
$$('[data-benim-sec]').forEach((s) => s.addEventListener('change', () => { benimYaz(s.value); benimUygula(s.value); if (s.value) bildir(_t('Takımın seçildi: sitede öne çıkar.')); }));
$$('[data-benim-dugme]').forEach((b) => b.addEventListener('click', () => {
  const id = b.getAttribute('aria-pressed') === 'true' ? '' : b.dataset.benimDugme;
  benimYaz(id); benimUygula(id);
  bildir(id ? _t('Benim takımım olarak kaydedildi.') : _t('Takım seçimi kaldırıldı.'));
}));
benimUygula(benimOku());

// ---- Takım seçmeye çağrı (17 Kasım 2026): takım seçilmemişse okur sayfayı biraz kaydırınca ortada bir pencere açılır.
// Pencere zorunludur: ya takım seçilir ya "Şimdi değil"e basılır (Esc ve dışarı tıklama kapatmaz).
// Takım seçen bir daha görmez. "Şimdi değil" diyen, yeni sayı çıkana kadar görmez (ln-takim-sorma-sayi = o anki son sayı).
// Takım sayfalarında açılmaz (orada "Benim takımım yap" düğmesi var). ----
const takimSor = $('[data-takim-sor]');
if (takimSor && typeof takimSor.showModal === 'function') {
  const SAYI_ANAHTAR = 'ln-takim-sorma-sayi';
  const sonSayi = Number(document.body.dataset.sonSayi) || 0;
  const oku = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
  const yaz = (k, d) => { try { d == null ? localStorage.removeItem(k) : localStorage.setItem(k, d); } catch { /* gizli pencere */ } };
  // Eski kural (7 gün susturma): son 7 günde "Şimdi değil" diyen, bu sayıda reddetmiş sayılır.
  const eski = Number(oku('ln-takim-sorma') || 0);
  if (eski) {
    if (Date.now() - eski < 7 * 86400000 && !oku(SAYI_ANAHTAR)) yaz(SAYI_ANAHTAR, String(sonSayi));
    yaz('ln-takim-sorma', null);
  }
  const reddedilen = Number(oku(SAYI_ANAHTAR) || 0);
  const kapat = () => {
    takimSor.classList.remove('acik');
    document.documentElement.classList.remove('pencere-acik');
    setTimeout(() => { if (takimSor.open) takimSor.close(); }, 250);
    $('[data-benim-kart]')?.classList.remove('dikkat');
  };
  const ac = () => {
    if (benimOku() || takimSor.open) return;
    takimSor.showModal();
    document.documentElement.classList.add('pencere-acik');
    requestAnimationFrame(() => requestAnimationFrame(() => takimSor.classList.add('acik')));
    $('[data-benim-kart]')?.classList.add('dikkat');
  };
  takimSor.addEventListener('cancel', (e) => e.preventDefault()); // Esc kapatmaz
  if (!benimOku() && document.body.dataset.bolum !== 'takim' && reddedilen < sonSayi && !document.documentElement.dataset.pencere) {
    const esik = () => Math.min(400, Math.max(160, window.innerHeight * 0.35));
    const kaydirinca = () => { if (window.scrollY > esik()) { window.removeEventListener('scroll', kaydirinca); ac(); } };
    window.addEventListener('scroll', kaydirinca, { passive: true });
    kaydirinca();
  }
  $$('[data-benim-sec]', takimSor).forEach((s) => s.addEventListener('change', () => { if (s.value) kapat(); }));
  $('[data-takim-sor-kapat]', takimSor)?.addEventListener('click', () => { yaz(SAYI_ANAHTAR, String(sonSayi)); kapat(); });
}


// ---- Bilgi kartları (17 Kasım 2026): turuncu "i" düğmesinin yanında açılır; ekrandan taşmaz. ----
// Tarayıcı "popover" desteklemiyorsa düğme kartı kendisi açıp kapatır.
{
  const popoverVar = typeof HTMLElement !== 'undefined' && 'popover' in HTMLElement.prototype;
  const yerlestir = (dugme, kart) => {
    const d = dugme.getBoundingClientRect();
    const k = kart.getBoundingClientRect();
    const bosluk = 8, kenar = 12;
    let sol = Math.min(Math.max(kenar, d.left + d.width / 2 - k.width / 2), window.innerWidth - k.width - kenar);
    let ust = d.bottom + bosluk;
    if (ust + k.height > window.innerHeight - kenar) ust = Math.max(kenar, d.top - k.height - bosluk);
    kart.style.left = `${sol}px`; kart.style.top = `${ust}px`;
  };
  $$('[data-bilgi-dugme]').forEach((dugme) => {
    const kart = document.getElementById(dugme.getAttribute('popovertarget'));
    if (!kart) return;
    dugme.setAttribute('aria-expanded', 'false');
    if (popoverVar) {
      kart.addEventListener('toggle', (e) => {
        const acik = e.newState === 'open';
        dugme.setAttribute('aria-expanded', String(acik));
        if (acik) yerlestir(dugme, kart);
      });
    } else {
      dugme.addEventListener('click', (e) => {
        e.preventDefault();
        const acik = !kart.classList.contains('acik');
        $$('.bilgi-kart.acik').forEach((x) => x.classList.remove('acik'));
        kart.classList.toggle('acik', acik);
        dugme.setAttribute('aria-expanded', String(acik));
        if (acik) yerlestir(dugme, kart);
      });
      document.addEventListener('click', (e) => { if (!e.target.closest('[data-bilgi-dugme], [data-bilgi-kart]')) $$('.bilgi-kart.acik').forEach((x) => x.classList.remove('acik')); });
    }
  });
  window.addEventListener('scroll', () => { $$('.bilgi-kart:popover-open').forEach((k) => { try { k.hidePopover(); } catch { /* yok */ } }); }, { passive: true });
}

// ---- Tahmin oyunu (18 Kasım 2026) ----
// Kehanet'te form: koç (seçili takımdan gelir), 7 kazanan ve haftanın maçının skoru → /api/tahmin. Bu cihazda girilen tahmin
// kapanışa kadar formda geri gelir (sunucu kapanıştan önce kimseye göstermez). Kapanınca form gizlenir, herkesin tahmini açılır.
// Ön sayfadaki çağrı kapanışa kadar, bu cihazdan tahmin girilmediyse görünür.
{
  const yerelOkuT = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
  const yerelYazT = (k, v) => { try { localStorage.setItem(k, v); } catch { /* gizli pencere */ } };
  const kalanYaz = (ms) => {
    const dk = Math.max(0, Math.floor(ms / 60000)), g = Math.floor(dk / 1440), s = Math.floor((dk % 1440) / 60), d = dk % 60;
    return g ? _t('{0} gün {1} saat', [g, s]) : s ? _t('{0} saat {1} dakika', [s, d]) : _t('{0} dakika', [d]);
  };
  const geriSay = (kok, kapanis) => {
    const yer = $$('[data-tahmin-geri]', kok);
    const yaz = () => { const k = kapanis - Date.now(); yer.forEach((y) => { y.textContent = k > 0 ? _t(' · kapanışa {0}', [kalanYaz(k)]) : ''; }); };
    yaz(); setInterval(yaz, 30000);
  };

  // Ön sayfa çağrısı
  const cagri = $('[data-tahmin-cagri]');
  if (cagri) {
    const kapanis = Date.parse(cagri.dataset.kapanis);
    if (Date.now() < kapanis && !yerelOkuT(`ln-tahmin-${cagri.dataset.hafta}`)) { cagri.hidden = false; geriSay(cagri, kapanis); }
  }

  const kok = $('[data-tahmin]');
  const form = $('[data-tahmin-form]');
  if (kok && kok.dataset.hafta) {
    const hafta = kok.dataset.hafta, kapanis = Date.parse(kok.dataset.kapanis), anahtar = `ln-tahmin-${hafta}`;
    const formKutu = $('[data-tahmin-form-kutu]'), acilan = $('[data-tahmin-acilan]');
    const simge = (id) => $(`template[data-tahmin-simgeler]`)?.content.querySelector(`[data-id="${id}"]`);
    const simgeKopya = (id) => { const s = simge(id); return s ? s.firstElementChild.cloneNode(true) : document.createTextNode('—'); };
    const skorYazT = (s) => (s ? `${s[0]}–${s[1]}${s[2] ? '–' + s[2] : ''}` : '—');
    const durum = $('[data-tahmin-durum]');
    const girenlerYaz = (ids) => {
      const p = $('[data-tahmin-girenler]');
      if (!p) return;
      p.replaceChildren();
      if (!ids.length) { p.textContent = _t('Henüz kimse tahmin girmedi. İlk sen ol.'); p.hidden = false; return; }
      p.append(_t('{0} koç tahminini girdi: ', [ids.length]));
      ids.forEach((id) => { const s = simgeKopya(id); if (s.setAttribute) s.setAttribute('title', simge(id)?.dataset.ad ?? ''); p.append(s); });
      p.hidden = false;
    };

    if (Date.now() < kapanis && form) {
      geriSay(formKutu, kapanis);
      // Koç: önce bu cihazdaki tahmin, sonra seçili takım
      const kayitli = (() => { try { return JSON.parse(yerelOkuT(anahtar) || 'null'); } catch { return null; } })();
      const takimSec = $('[data-tahmin-takim]', form);
      takimSec.value = kayitli?.takim || yerelOkuT('ln-takim') || '';
      if (kayitli) {
        for (const [k, v] of Object.entries(kayitli.secimler || {})) { const r = form.querySelector(`input[name="m-${k}"][value="${v}"]`); if (r) r.checked = true; }
        if (kayitli.skor) { form.elements['skor-ev'].value = kayitli.skor[0]; form.elements['skor-dep'].value = kayitli.skor[1]; }
        durum.textContent = _t('Tahminin kayıtlı. Kapanışa kadar değiştirebilirsin.');
      }
      const berabereYaz = () => {
        const a = Number(form.elements['skor-ev'].value), b = Number(form.elements['skor-dep'].value), y = $('[data-tahmin-berabere]', form);
        if (!y) return;
        y.textContent = form.elements['skor-ev'].value !== '' && form.elements['skor-dep'].value !== '' && a + b <= 9 ? (9 - a - b ? _t('· {0} berabere', [9 - a - b]) : '') : a + b > 9 ? _t('· toplam en fazla 9') : '';
      };
      $$('[data-tahmin-skor]', form).forEach((i) => i.addEventListener('input', berabereYaz));
      berabereYaz();
      fetch(`/api/tahmin?hafta=${hafta}`, { cache: 'no-store' }).then((y) => (y.ok ? y.json() : null)).then((v) => v && girenlerYaz(v.girenler || [])).catch(() => {});

      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const takim = takimSec.value;
        const secimler = {};
        let eksik = 0;
        $$('fieldset.tahmin-ikili', form).forEach((f) => {
          const r = f.querySelector('input:checked'), ad = f.querySelector('input').name.slice(2);
          if (r) secimler[ad] = r.value; else eksik++;
        });
        const skor = [form.elements['skor-ev'].value, form.elements['skor-dep'].value];
        if (!takim) { durum.textContent = _t('Önce koç olarak takımını seç.'); takimSec.focus(); return; }
        if (eksik) { durum.textContent = _t('{0} eşleşmede kazanan seçilmedi.', [eksik]); return; }
        if (skor.some((x) => x === '')) { durum.textContent = _t('Haftanın maçının skorunu yaz.'); form.elements['skor-ev'].focus(); return; }
        const dugme = form.querySelector('button[type="submit"]');
        dugme.disabled = true; durum.textContent = _t('Gönderiliyor…');
        try {
          const y = await fetch('/api/tahmin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ hafta: Number(hafta), takim, secimler, skor: skor.map(Number) }) });
          const v = await y.json().catch(() => ({}));
          if (!y.ok) { durum.textContent = v.hata || _t('Gönderilemedi, birazdan tekrar dene.'); return; }
          yerelYazT(anahtar, JSON.stringify({ takim, secimler, skor: skor.map(Number) }));
          durum.textContent = _t('Tahminin kaydedildi. Kapanışa kadar değiştirebilirsin.');
          if (typeof bildir === 'function') bildir(_t('Tahminin kaydedildi.'));
          fetch(`/api/tahmin?hafta=${hafta}`, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then((x) => x && girenlerYaz(x.girenler || [])).catch(() => {});
        } catch { durum.textContent = _t('Bağlantı yok; birazdan tekrar dene.'); }
        finally { dugme.disabled = false; }
      });
    } else if (acilan) {
      // Kapandı: form gizli, herkesin tahmini açılır (sonuçlar bir sonraki sayıda)
      if (formKutu) formKutu.hidden = true;
      acilan.hidden = false;
      const govde = $('[data-tahmin-acilan-govde]', acilan);
      const sutunlar = $$(_t('thead th'), acilan).slice(1, -1).length;
      fetch(`/api/tahmin?hafta=${hafta}`, { cache: 'no-store' }).then((y) => (y.ok ? y.json() : null)).then((v) => {
        if (!v?.predictionEntries) return;
        const eslesmeler = [...new Set($$('input[type="radio"]', kok).map((i) => i.name.slice(2)))];
        for (const [id, t] of Object.entries(v.predictionEntries).sort((a, b) => a[0] - b[0])) {
          const tr = document.createElement('tr'); tr.dataset.takim = id; if (id === benimOku()) tr.classList.add('benim');
          const th = document.createElement('th'); th.scope = 'row';
          const a = document.createElement('a'); a.href = simge(id)?.dataset.adres ?? '#'; a.append(simgeKopya(id), simge(id)?.dataset.ad ?? id); th.append(a); tr.append(th);
          for (const k of eslesmeler.slice(0, sutunlar)) { const td = document.createElement('td'); td.append(t.picks?.[k] ? simgeKopya(t.picks[k]) : '—'); tr.append(td); }
          const td = document.createElement('td'); td.textContent = skorYazT(t.score); tr.append(td);
          govde.insertBefore(tr, govde.querySelector('tr[data-sabit]'));
        }
      }).catch(() => {});
    }
  }
}

// ---- Takım sayfası açılır bölümleri (18 Kasım 2026): bağlantı bir bölümün içine gidiyorsa önce o bölümü aç ----
{
  const ac = (hedef) => {
    if (!hedef) return;
    let d = hedef.closest('details');
    while (d) { d.open = true; d = d.parentElement?.closest('details'); }
    if (hedef.matches('details')) hedef.open = true;
    // Bölüm çubuğu bölümün kendisine gider: içindeki kapalı içeriği de aç
    hedef.querySelectorAll(':scope > details[data-bolum-ac]').forEach((x) => { x.open = true; });
  };
  const hash = () => { try { return decodeURIComponent(location.hash.slice(1)); } catch { return ''; } };
  if (hash()) { const h = document.getElementById(hash()); if (h) { ac(h); requestAnimationFrame(() => h.scrollIntoView()); } }
  addEventListener('hashchange', () => ac(document.getElementById(hash())));
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href*="#"]');
    if (!a || a.pathname !== location.pathname) return;
    ac(document.getElementById(decodeURIComponent(a.hash.slice(1))));
  });
}

// ---- Önizlemeli bölümler (18 Kasım 2026): "Tümünü göster" / "Daha az göster"; kısa içerikte düğme yok ----
{
  const ayarla = (k, acik) => {
    k.classList.toggle('kapali', !acik);
    k.querySelector(':scope > [data-onizleme-dugme]')?.setAttribute('aria-expanded', acik ? 'true' : 'false');
  };
  $$('[data-onizleme]').forEach((k) => {
    const ic = k.querySelector(':scope > .onizleme-icerik');
    const dugme = k.querySelector(':scope > [data-onizleme-dugme]');
    if (k.classList.contains('kapali') && ic && ic.scrollHeight <= ic.clientHeight + 24) { k.classList.remove('kapali'); k.classList.add('kisa'); }
    dugme?.addEventListener('click', () => {
      const acilacak = k.classList.contains('kapali');
      ayarla(k, acilacak);
      if (!acilacak) k.closest('section, [id]')?.scrollIntoView({ block: 'nearest' });
    });
  });
  const ac = (h) => {
    if (!h) return;
    h.closest('[data-onizleme]') && ayarla(h.closest('[data-onizleme]'), true);
    h.querySelectorAll(':scope > [data-onizleme], :scope > * > [data-onizleme]').forEach((k) => ayarla(k, true));
  };
  const id = () => { try { return decodeURIComponent(location.hash.slice(1)); } catch { return ''; } };
  if (id()) ac(document.getElementById(id()));
  addEventListener('hashchange', () => ac(document.getElementById(id())));
  document.addEventListener('click', (e) => { const a = e.target.closest('a[href*="#"]'); if (a && a.pathname === location.pathname) ac(document.getElementById(decodeURIComponent(a.hash.slice(1)))); });
}
