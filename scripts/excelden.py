"""Haftalık veri Excel'inden sayı taslağı ve kadro dosyası üretir (docs/DATA.md).

Kullanım:
    python3 scripts/excelden.py veri-hafta-03.xlsx --onceki veri/haftalar/hafta-02.json
    python3 scripts/excelden.py veri-hafta-02.xlsx --onceki veri/haftalar/hafta-02.json --yalniz-kadro
        (yayımlanmış bir sayı için: eşleşmeleri ve puan durumunu o sayıyla karşılaştırır, yalnızca kadro dosyasını yazar)

Çıktılar:
    taslak/hafta-NN.json         Sayı dosyasının veri kısmı (takımlar, puan durumu, bütün haftalar, gelecek hafta).
                                 Yazılar (manşet, yazı, analizler, notlar, takaslar, Tribün Abi'nin tahminleri) boş gelir;
                                 Claude doldurup veri/haftalar/hafta-NN.json olarak kaydeder.
    veri/kadrolar/hafta-NN.json  Takım sayfalarındaki kadro tablosu ve Oyuncular sayfası için oyuncu verisi.

Excel'in biçimi docs/DATA.md dosyasında. Betik her şeyi kontrol eder; sorun varsa Türkçe yazar ve durur.
"""
import os as _os, sys as _sys
_sys.path.insert(0, _os.path.dirname(_os.path.abspath(__file__)))
from ceviri import t as _c
import argparse
import datetime as dt
import json
import sys
import unicodedata
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path

import openpyxl

SAYIM = ['FGM', 'FGA', 'FTM', 'FTA', '3PTM', '3PTA', 'PTS', 'REB', 'AST', 'ST', 'BLK', 'TO']
TR = str.maketrans('çğıöşüÇĞİÖŞÜ', 'cgiosuCGIOSU')


def anahtar(metin):
    """Başlık adını sadeleştirir: 'Eklendiği gün' → 'eklendigi_gun'."""
    s = str(metin or '').strip().translate(TR)
    s = unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode()
    return '_'.join(s.lower().replace('%', ' yuzde ').replace('/', ' ').split())


# İngilizce sayfa ve sütun adları da kabul edilir (docs/DATA.md).
SAYFA_EN = {'bilgi': 'info', 'takimlar': 'teams', 'eslesmeler': 'matchups', 'puandurumu': 'standings', 'kadrolar': 'rosters',
            'islemler': 'transactions', 'serbestoyuncular': 'free_agents', 'gelecekhafta': 'next_week', 'gunlukdizilis': 'daily_lineups', 'notlar': 'notes'}
SUTUN_EN = {'field': 'alan', 'value': 'deger', 'league': 'lig', 'season': 'sezon', 'week': 'hafta', 'period': 'donem', 'next_period': 'gelecek_donem',
            'data_time': 'veri_zamani', 'roster_cutoff_time': 'kadro_kesim_zamani', 'counting': 'sayim', 'source': 'kaynak',
            'team_id': 'takim_id', 'team_name': 'takim_adi', 'opponent_id': 'rakip_id', 'home': 'ev', 'won': 'kazanilan', 'lost': 'kaybedilen', 'tied': 'berabere',
            'rank': 'sira', 'player_id': 'oyuncu_id', 'player': 'oyuncu', 'nba_team': 'nba_takimi', 'positions': 'pozisyonlar', 'status': 'durum',
            'added_on': 'eklendigi_gun', 'left_on': 'ayrildigi_gun', 'days_on_roster': 'kadroda_gun', 'injured_days': 'sakat_gun', 'last_day_slot': 'son_gun_yeri',
            'traded_to_team_id': 'takas_hedef_takim_id', 'date': 'tarih', 'type': 'islem', 'other_team_id': 'diger_takim_id', 'rostered_pct': 'sahiplik_yuzde',
            'home_team_id': 'ev_takim_id', 'away_team_id': 'deplasman_takim_id', 'slot': 'yer', 'topic': 'konu', 'details': 'ayrinti'}



def sayfa(kitap, ad, zorunlu=True):
    adlar = {anahtar(s): s for s in kitap.sheetnames}
    gercek = adlar.get(anahtar(ad)) or adlar.get(SAYFA_EN.get(anahtar(ad).replace('_', ''), '-'))
    if not gercek:
        if zorunlu:
            dur(_c('"{0}" sayfası yok. Olan sayfalar: {1}', ad, ", ".join(kitap.sheetnames)))
        return []
    satirlar = list(kitap[gercek].iter_rows(values_only=True))
    if not satirlar:
        return []
    bas = [SUTUN_EN.get(anahtar(h), anahtar(h)) for h in satirlar[0]]
    # Başlıklardaki istatistik adları büyük harfle kalsın (FGM, 3PTM ...)
    bas = [h.upper() if h.upper() in SAYIM else h for h in bas]
    return [dict(zip(bas, r)) for r in satirlar[1:] if any(v not in (None, '') for v in r)]


HATALAR = []
SON_GUN_EKSIK = []


def dur(mesaj):
    print('✖ ' + mesaj)
    sys.exit(1)


def kontrol(kosul, mesaj):
    if not kosul:
        HATALAR.append(mesaj)


def tam(v, ne):
    try:
        if v in (None, '', '-'):
            return 0
        return int(round(float(str(v).replace(',', '.'))))
    except ValueError:
        HATALAR.append(_c('{0}: "{1}" sayı değil', ne, v))
        return 0


def metin_id(v):
    if v is None:
        return ''
    if isinstance(v, float) and v.is_integer():
        v = int(v)
    return str(v).strip()


def gun(v):
    if v in (None, ''):
        return None
    if isinstance(v, (dt.date, dt.datetime)):
        return v.strftime('%Y-%m-%d')
    s = str(v).strip()
    for bicim in ('%Y-%m-%d', '%d.%m.%Y', '%d/%m/%Y', '%Y-%m-%dT%H:%M:%S'):
        try:
            return dt.datetime.strptime(s[:19], bicim).strftime('%Y-%m-%d')
        except ValueError:
            pass
    HATALAR.append(_c('Tarih anlaşılamadı: "{0}" (YYYY-AA-GG yaz)', s))
    return None


def yuzde(m, a):
    if not a:
        return '-'
    d = (Decimal(m) / Decimal(a)).quantize(Decimal('0.001'), rounding=ROUND_HALF_UP)
    return '1.000' if d >= 1 else '.' + str(d).split('.')[1]


def istatistik(r, ne):
    """Bir satırın 12 istatistiği; hepsi boşsa None (Flaim vermedi)."""
    if all(r.get(k) in (None, '', '-') for k in SAYIM):
        return None
    return {k: bos_veya_tam(r.get(k), f'{ne} {k}') for k in SAYIM}


def bos_veya_tam(v, ne):
    """Bilinmeyen sayıyı 0'a çevirme; gerçek sıfırı koru."""
    if v in (None, '', '-'):
        return None
    try:
        n = float(str(v).replace(',', '.'))
        if n < 0 or not n.is_integer():
            raise ValueError()
        return int(n)
    except (ValueError, OverflowError):
        HATALAR.append(_c('{0}: negatif olmayan tam sayı bekleniyor', ne))
        return None


def kadro_tutarliligi(kadro, serbest, islemler):
    """Aynı haftanın kapanış kadrosunu, serbest havuzunu ve takas yönünü kontrol et."""
    sahipler = {}
    for t, liste in kadro.items():
        gorulen = set()
        for o in liste:
            kontrol(o['id'], _c('Kadrolar {0}: oyuncu_id boş', o["name"]))
            kontrol(o['id'] not in gorulen, _c('Kadrolar {0}: takım {1} içinde yinelenen oyuncu; katkıları tek satırda birleştir', o["name"], t))
            gorulen.add(o['id'])
            if o['status'] == 'kadroda':
                kontrol(o['id'] not in sahipler, _c('{0}: hafta sonunda iki takımın kadrosunda', o["name"]))
                sahipler[o['id']] = t
            if o.get('tradedTo'):
                kontrol(o['tradedTo'] in kadro and o['tradedTo'] != t, _c('{0}: takas_hedef_takim_id geçersiz', o["name"]))
            if o['status'] == 'takasla-gitti':
                x = next((x for x in islemler if x['type'] == 'takas' and x['playerId'] == o['id'] and x['teamId'] == t and x['date'] == o['left']), None)
                if x:
                    kontrol(not o.get('tradedTo') or o['tradedTo'] == x['otherTeamId'], _c('{0}: kadro ve işlem takas hedefleri farklı', o["name"]))
                    o['tradedTo'] = o.get('tradedTo') or x['otherTeamId']
    serbest_idler = set()
    for o in serbest:
        kontrol(o['id'], _c('SerbestOyuncular {0}: oyuncu_id boş', o["name"]))
        kontrol(o['id'] not in sahipler, _c('{0}: hafta sonunda takım {1} kadrosunda; serbest listesinde olamaz', o["name"], sahipler.get(o["id"])))
        kontrol(o['id'] not in serbest_idler, _c('SerbestOyuncular {0}: yinelenen oyuncu', o["name"]))
        serbest_idler.add(o['id'])


def evet(v):
    return anahtar(v) in ('evet', 'e', 'yes', 'true', '1', 'ev')


DURUM = {'kadroda': 'kadroda', 'on_roster': 'kadroda', 'rostered': 'kadroda', 'birakildi': 'birakildi', 'dropped': 'birakildi', 'takasla_gitti': 'takasla-gitti', 'takas': 'takasla-gitti', 'traded': 'takasla-gitti'}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('excel')
    ap.add_argument('--onceki', help=_c('bir önceki sayının dosyası (veri/haftalar/hafta-NN.json); ilk sayıda verilmez'))
    ap.add_argument('--kok', default='.', help=_c('depo kökü'))
    ap.add_argument('--yalniz-kadro', action='store_true', help=_c('yayımlanmış sayı: yalnızca karşılaştır ve kadro dosyasını yaz'))
    a = ap.parse_args()
    kok = Path(a.kok)
    kitap = openpyxl.load_workbook(a.excel, data_only=True)
    bilgi = {SUTUN_EN.get(anahtar(r.get('alan')), anahtar(r.get('alan'))): r.get('deger') for r in sayfa(kitap, 'Bilgi')}
    if a.onceki:
        onceki = json.loads(Path(a.onceki).read_text(encoding='utf-8'))
    else:
        # İlk sayı: önceki dosya yok; takımlar Excel'den, sezon Bilgi.sezon'dan.
        kontrol(not a.yalniz_kadro, _c('--yalniz-kadro için --onceki gerekli'))
        onceki = {'week': 0, 'season': tam(bilgi.get('sezon'), 'Bilgi.sezon'), 'weeks': [], 'standings': [],
                  'teams': [{'id': metin_id(r.get('takim_id'))} for r in sayfa(kitap, 'Takimlar')]}
    hafta = tam(bilgi.get('hafta'), 'Bilgi.hafta')
    if a.yalniz_kadro:
        kontrol(hafta == onceki['week'], _c('Bilgi.hafta {0}; --yalniz-kadro ile aynı haftanın sayı dosyası verilmeli ({1})', hafta, onceki["week"]))
    else:
        kontrol(hafta == onceki['week'] + 1, _c('Bilgi.hafta {0}; önceki sayı {1}, {2} bekleniyordu', hafta, onceki["week"], onceki["week"] + 1))
    donem = str(bilgi.get('donem') or '').strip()
    kontrol(donem, _c('Bilgi.donem boş (örnek: "2–8 Kasım 2026")'))
    # Oyuncu istatistiği 4 Kasım 2026'dan beri istenmiyor: sayim boşsa "yok" sayılır.
    sayim = {'aktif': 'active', 'active': 'active', 'tum': 'all', 'all': 'all', 'yok': 'none', 'none': 'none', '': 'none'}.get(anahtar(bilgi.get('sayim') or ''), None)
    kontrol(sayim is not None, _c('Bilgi.sayim geçersiz (yok yaz ya da boş bırak)'))

    # Takımlar
    takimlar = [{'id': metin_id(r.get('takim_id')), 'name': str(r.get('takim_adi')).strip()} for r in sayfa(kitap, 'Takimlar')]
    ad = {t['id']: t['name'] for t in takimlar}
    eski_idler = {t['id'] for t in onceki['teams']}
    kontrol(set(ad) == eski_idler, _c('Takım kimlikleri önceki sayıyla aynı değil: {0}', sorted(set(ad) ^ eski_idler)))
    var = lambda i, ne: kontrol(i in ad, _c('{0}: "{1}" diye bir takım yok', ne, i))

    # Eşleşmeler (biten hafta)
    satirlar = [r for r in sayfa(kitap, 'Eslesmeler') if tam(r.get('hafta'), 'Eslesmeler.hafta') == hafta]
    kontrol(len(satirlar) == len(ad), _c('Eslesmeler: {0}. hafta için {1} satır var, {2} bekleniyordu (her takım bir satır)', hafta, len(satirlar), len(ad)))
    takim_ist, skor, rakip, ev = {}, {}, {}, {}
    for r in satirlar:
        t = metin_id(r.get('takim_id'))
        var(t, 'Eslesmeler.takim_id')
        takim_ist[t] = {k: tam(r.get(k), f'Eslesmeler {ad.get(t, t)} {k}') for k in SAYIM}
        skor[t] = (tam(r.get('kazanilan'), 'kazanilan'), tam(r.get('kaybedilen'), 'kaybedilen'), tam(r.get('berabere'), 'berabere'))
        rakip[t] = metin_id(r.get('rakip_id'))
        ev[t] = evet(r.get('ev'))
        kontrol(sum(skor[t]) == 9, _c('Eslesmeler {0}: skor toplamı {1}, 9 olmalı', ad.get(t, t), sum(skor[t])))
    eslesmeler, gorulen = [], set()
    for t in takim_ist:
        if t in gorulen:
            continue
        r = rakip[t]
        kontrol(rakip.get(r) == t, f'Eslesmeler: {ad.get(t, t)} rakibi {ad.get(r, r)}, ama tersi tutmuyor')
        if r not in takim_ist:
            continue
        kontrol(skor[t][0] == skor[r][1] and skor[t][2] == skor[r][2], _c('Eslesmeler: {0}–{1} skorları birbirinin tersi değil', ad[t], ad[r]))
        h, d = (t, r) if ev[t] or not ev[r] else (r, t)
        taraf = lambda i: {
            'id': i, 'name': ad[i],
            'score': {'wins': skor[i][0], 'losses': skor[i][1], 'ties': skor[i][2]},
            'stats': {
                'FGM/A': f"{takim_ist[i]['FGM']}/{takim_ist[i]['FGA']}", 'FG%': yuzde(takim_ist[i]['FGM'], takim_ist[i]['FGA']),
                'FTM/A': f"{takim_ist[i]['FTM']}/{takim_ist[i]['FTA']}", 'FT%': yuzde(takim_ist[i]['FTM'], takim_ist[i]['FTA']),
                '3PTM/A': f"{takim_ist[i]['3PTM']}/{takim_ist[i]['3PTA']}", '3PT%': yuzde(takim_ist[i]['3PTM'], takim_ist[i]['3PTA']),
                **{k: str(takim_ist[i][k]) for k in ('PTS', 'REB', 'AST', 'ST', 'BLK', 'TO')},
            },
        }
        eslesmeler.append({'home': taraf(h), 'away': taraf(d), 'status': 'final'})
        gorulen |= {t, r}

    # Puan durumu
    puan = []
    for r in sayfa(kitap, 'PuanDurumu'):
        t = metin_id(r.get('takim_id'))
        var(t, 'PuanDurumu.takim_id')
        puan.append({'id': t, 'name': ad.get(t, t), 'rank': tam(r.get('sira'), 'sira'), 'wins': tam(r.get('kazanilan'), 'kazanilan'),
                     'losses': tam(r.get('kaybedilen'), 'kaybedilen'), 'ties': tam(r.get('berabere'), 'berabere')})
    kontrol(len(puan) == len(ad), _c('PuanDurumu: {0} satır, {1} bekleniyordu', len(puan), len(ad)))

    # Gelecek hafta
    gelecek = []
    for r in sayfa(kitap, 'GelecekHafta', zorunlu=False):
        h, d = metin_id(r.get('ev_takim_id')), metin_id(r.get('deplasman_takim_id'))
        var(h, 'GelecekHafta.ev_takim_id')
        var(d, 'GelecekHafta.deplasman_takim_id')
        gelecek.append({'home': h, 'away': d, 'abiPick': None, 'abiNote': ''})

    # Kadrolar
    kadro = {t: [] for t in ad}
    for r in sayfa(kitap, 'Kadrolar'):
        t = metin_id(r.get('takim_id'))
        var(t, 'Kadrolar.takim_id')
        durum = DURUM.get(anahtar(r.get('durum') or 'kadroda'))
        kontrol(durum, _c('Kadrolar {0}: durum "{1}" anlaşılamadı (kadroda / bırakıldı / takasla gitti)', r.get("oyuncu"), r.get("durum")))
        o = {
            'id': metin_id(r.get('oyuncu_id')), 'name': str(r.get('oyuncu') or '').strip(),
            'nbaTeam': str(r.get('nba_takimi') or '').strip(), 'positions': str(r.get('pozisyonlar') or '').replace(' ', ''),
            'status': durum or 'kadroda', 'added': gun(r.get('eklendigi_gun')), 'left': gun(r.get('ayrildigi_gun')),
            'tradedTo': metin_id(r.get('takas_hedef_takim_id')) or None,
            'lastSlot': str(r.get('son_gun_yeri') or '').strip().upper() or None,
            'daysOnRoster': bos_veya_tam(r.get('kadroda_gun'), 'kadroda_gun'),
            'games': bos_veya_tam(r.get('mac'), 'mac'),
            'benchGames': bos_veya_tam(r.get('yedekte_mac'), 'yedekte_mac'), 'ilDays': bos_veya_tam(r.get('sakat_gun'), 'sakat_gun'),
            'stats': istatistik(r, f'Kadrolar {r.get("oyuncu")}'),
        }
        if o['status'] != 'kadroda' and not o['left']:
            HATALAR.append(_c('Kadrolar {0}: kadrodan çıkmış ama ayrildigi_gun boş', o["name"]))
        if o['status'] == 'kadroda' and not o['lastSlot']:
            SON_GUN_EKSIK.append(o['name'])
        if t in kadro:
            kadro[t].append(o)
    if SON_GUN_EKSIK:
        print(_c('⚠ Kadrolar: kadrodaki {0} oyuncunun son_gun_yeri boş; bu oyuncular sitede "Sakatlar listesinde" grubunda görünmez.', len(SON_GUN_EKSIK)))
    statli = any(o['stats'] for l in kadro.values() for o in l)
    if not statli:
        sayim = 'none'
        print(_c('✔ Kadrolar: oyuncu istatistiği yok (beklenen; sitede yalnızca kadro ve hareketler gösterilir).'))
    elif sayim is None:
        HATALAR.append(_c('Bilgi.sayim boş: oyuncu istatistikleri yalnızca aktif dizilişten mi (aktif), bütün maçlardan mı (tum)?'))
    elif sayim == 'none':
        HATALAR.append(_c('Oyuncu istatistiği dolu ama Bilgi.sayim yok. Kaynağa göre aktif ya da tum seç.'))
    if sayim == 'active':
        for t, liste in kadro.items():
            if not liste or t not in takim_ist:
                continue
            if any(o['stats'] is None or any(o['stats'].get(k) is None for k in SAYIM) for o in liste):
                print(_c('⚠ {0}: oyuncu istatistiği eksik; Yahoo toplamıyla karşılaştırılamadı.', ad[t]))
                continue
            fark = [k for k in SAYIM if sum(o['stats'][k] for o in liste) != takim_ist[t][k]]
            if fark:
                print(_c('⚠ {0}: oyuncu toplamı takım toplamından farklı ({1}). Tarih aralığını, aktif dizilişi ve istatistik düzeltmelerini doğrula; sayım yöntemini kanıt olmadan değiştirme.', ad[t], ", ".join(fark)))

    serbest = []
    for r in sayfa(kitap, 'SerbestOyuncular', zorunlu=False):
        serbest.append({
            'id': metin_id(r.get('oyuncu_id')), 'name': str(r.get('oyuncu') or '').strip(),
            'nbaTeam': str(r.get('nba_takimi') or '').strip(), 'positions': str(r.get('pozisyonlar') or '').replace(' ', ''),
            'ownedPct': float(str(r.get('sahiplik_yuzde')).replace(',', '.').replace('%', '')) if r.get('sahiplik_yuzde') not in (None, '') else None,
            'games': bos_veya_tam(r.get('mac'), 'mac'),
            'stats': istatistik(r, f'SerbestOyuncular {r.get("oyuncu")}'),
        })

    ISLEM = {'ekleme': 'ekleme', 'birakma': 'birakma', 'takas': 'takas', 'add': 'ekleme', 'drop': 'birakma', 'trade': 'takas'}
    islemler = []
    for r in sayfa(kitap, 'Islemler', zorunlu=False):
        tur = ISLEM.get(anahtar(r.get('islem')))
        kontrol(tur, _c('Islemler: "{0}" anlaşılamadı (ekleme / bırakma / takas)', r.get("islem")))
        t = metin_id(r.get('takim_id'))
        var(t, 'Islemler.takim_id')
        islemler.append({'date': gun(r.get('tarih')), 'teamId': t, 'type': tur, 'playerId': metin_id(r.get('oyuncu_id')), 'name': str(r.get('oyuncu') or '').strip(),
                         'otherTeamId': metin_id(r.get('diger_takim_id')) or None})
        if tur == 'takas':
            var(islemler[-1]['otherTeamId'], _c('Islemler.diger_takim_id (alan takım)'))
            kontrol(islemler[-1]['otherTeamId'] != t, _c('Takas gönderen ve alan takım aynı olamaz'))

    kadro_tutarliligi(kadro, serbest, islemler)

    if HATALAR:
        print(f'✖ {len(HATALAR)} sorun:')
        for h in HATALAR:
            print('  - ' + h)
        sys.exit(1)

    nn = f'{hafta:02d}'
    kadro_dosyasi = {
        'schemaVersion': 1, 'week': hafta, 'counting': sayim, 'fetchedAt': str(bilgi.get('veri_zamani') or ''),
        'rosterAsOf': str(bilgi.get('kadro_kesim_zamani') or '') or None,
        'source': 'Flaim (Yahoo Fantasy)', 'teams': kadro, 'freeAgents': serbest, 'transactions': islemler,
    }
    if isinstance(bilgi.get('veri_zamani'), dt.datetime):
        kadro_dosyasi['fetchedAt'] = bilgi['veri_zamani'].strftime('%Y-%m-%dT%H:%M:%SZ')

    def kadroyu_yaz():
        (kok / 'veri' / 'kadrolar').mkdir(parents=True, exist_ok=True)
        (kok / 'veri' / 'kadrolar' / f'hafta-{nn}.json').write_text(json.dumps(kadro_dosyasi, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

    if a.yalniz_kadro:
        w = next(x for x in onceki['weeks'] if x['week'] == hafta)
        farklar, sayilan = [], 0
        for m in eslesmeler:
            es = next((x for x in w['matchups'] if {x['home']['id'], x['away']['id']} == {m['home']['id'], m['away']['id']}), None)
            if not es:
                farklar.append(_c('{0}–{1} eşleşmesi sayı dosyasında yok', m["home"]["name"], m["away"]["name"]))
                continue
            for yan in (m['home'], m['away']):
                eski = es['home'] if es['home']['id'] == yan['id'] else es['away']
                for k, v in yan['stats'].items():
                    sayilan += 1
                    if eski['stats'].get(k) != v:
                        farklar.append(_c('{0} {1}: sayı {2}, Excel {3}', yan["name"], k, eski["stats"].get(k), v))
                sayilan += 3
                if eski['score'] != yan['score']:
                    farklar.append(_c('{0} skor: sayı {1}, Excel {2}', yan["name"], eski["score"], yan["score"]))
        for s_ in puan:
            sayilan += 4
            e = next((x for x in onceki['standings'] if x['id'] == s_['id']), None)
            if not e or any(e[k] != s_[k] for k in ('rank', 'wins', 'losses', 'ties')):
                farklar.append(_c('puan durumu {0}: sayı {1}, Excel {2}', s_["name"], e, s_))
        print(_c('Karşılaştırma: {0} değer, {1} fark.', sayilan, len(farklar)))
        for f in farklar:
            print('  - ' + f)
        kadroyu_yaz()
        print(_c('✔ veri/kadrolar/hafta-{0}.json yazıldı: {1} kadro satırı, {2} serbest oyuncu, {3} işlem, sayım: {4}.', nn, sum(len(l) for l in kadro.values()), len(serbest), len(islemler), sayim))
        return

    eski_haftalar = [w for w in onceki['weeks'] if w['week'] < hafta]
    taslak = {
        'schemaVersion': 2, 'season': onceki['season'], 'week': hafta,
        'publishedAt': kadro_dosyasi['fetchedAt'] or dt.datetime.now(dt.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
        'period': donem, 'title': '', 'summary': '',
        'article': {'byline': _c('Yayın kurulu'), 'photo': {'teamId': '', 'caption': ''}, 'paragraphs': []},
        'stories': [], 'teamNotes': [],
        'standings': sorted(puan, key=lambda s: s['rank']),
        'teams': [{'id': t['id'], 'name': t['name'], 'players': [o['name'] for o in kadro[t['id']] if o['status'] == 'kadroda']} for t in takimlar],
        'weeks': eski_haftalar + [{'week': hafta, 'period': donem, 'matchups': eslesmeler}],
        'nextWeek': {'week': hafta + 1, 'period': str(bilgi.get('gelecek_donem') or '').strip(), 'matchups': gelecek} if gelecek else None,
        'playerNotes': [], 'trades': [],
        'sources': [{'label': _c('Yahoo Fantasy · lig, kadro ve tamamlanan hafta'), 'url': 'https://basketball.fantasysports.yahoo.com/nba/', 'date': ''}],
    }
    if taslak['nextWeek'] is None:
        del taslak['nextWeek']
    (kok / 'taslak').mkdir(exist_ok=True)
    (kok / 'taslak' / f'hafta-{nn}.json').write_text(json.dumps(taslak, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    kadroyu_yaz()
    print(_c('✔ taslak/hafta-{0}.json ve veri/kadrolar/hafta-{1}.json yazıldı.', nn, nn))
    print(_c('  {0} eşleşme, {1} kadro satırı, {2} serbest oyuncu, gelecek hafta: {3} eşleşme, sayım: {4}.', len(eslesmeler), sum(len(l) for l in kadro.values()), len(serbest), len(gelecek), sayim))


if __name__ == '__main__':
    main()

