"""Yahoo'nun günlük dizilişini kadro dosyasına lineupByDate olarak ekler ve Flaim'in sayılarıyla karşılaştırır.

Kullanım: python3 scripts/gunluk.py gunluk-NN.txt veri/kadrolar/hafta-NN.json 2026-11-02 2026-11-08
- gunluk-NN.txt: scripts/gunluk_excelden.py'nin Excel'deki GunlukDizilis sayfasından ürettiği (ya da Yahoo takım sayfalarından,
  …/<lig>/<takım>/team?date=YYYY-AA-GG, takım × 7 gün, elle çıkarılan) sıkıştırılmış metin: "takım=oyuncuKimliği:7harf,...|takım=..." ; harfler
  1 PG, 2 SG, 3 G, 4 SF, 5 PF, 6 F, 7 C, 8 Util, B BN, I IL, J IL+, N NA, - kadroda değil. Ayrıntı docs/DATA.md.
- Veri Excel'inde GunlukDizilis yoksa günlük diziliş yok (yalnızca son_gun_yeri); uyuyan koçlar ve haftanın oyuncusu bu alanla hesaplanır.
- Excel'deki kadroda_gun, sakat_gun ve son_gun_yeri değerleri Yahoo'yla karşılaştırılır; boşsa Yahoo'dan doldurulur.
"""
import os as _os, sys as _sys
_sys.path.insert(0, _os.path.dirname(_os.path.abspath(__file__)))
from ceviri import t as _c
import json, sys
from datetime import date, timedelta
blob, kadro_yolu, bas, son = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
KOD = {'1':'PG','2':'SG','3':'G','4':'SF','5':'PF','6':'F','7':'C','8':'Util','B':'BN','I':'IL','J':'IL+','N':'NA'}
gunler = []
g = date.fromisoformat(bas)
while g <= date.fromisoformat(son):
    gunler.append(g.isoformat()); g += timedelta(days=1)
gunluk = {}
for parca in open(blob).read().strip().split('|'):
    tid, liste = parca.split('=', 1)
    for x in liste.split(','):
        pid, kod = x.split(':')
        assert len(kod) == len(gunler), (tid, pid, kod)
        gunluk.setdefault(tid, {})[pid] = {gunler[i]: KOD[c] for i, c in enumerate(kod) if c != '-'}
k = json.load(open(kadro_yolu))
sorun = []
for tid, oyuncular in k['teams'].items():
    yahoo = gunluk.get(tid, {})
    ids = {o['id'] for o in oyuncular}
    for pid in yahoo:
        if pid not in ids: sorun.append(_c('Yahoo dizilişinde var, kadro dosyasında yok: takım {0} oyuncu {1}', tid, pid))
    for o in oyuncular:
        lbd = yahoo.get(o['id'], {})
        o['lineupByDate'] = lbd
        gun = len(lbd); il = sum(1 for v in lbd.values() if v in ('IL', 'IL+'))
        if o.get('daysOnRoster') is None: o['daysOnRoster'] = gun; o['_doldu'] = 'daysOnRoster'
        elif o['daysOnRoster'] != gun: sorun.append(_c('kadroda gün farkı: {0} {1} Excel {2} Yahoo {3}', tid, o['name'], o['daysOnRoster'], gun))
        if o.get('ilDays') is None: o['ilDays'] = il
        elif o['ilDays'] != il: sorun.append(_c('sakat gün farkı: {0} {1} Excel {2} Yahoo {3}', tid, o['name'], o['ilDays'], il))
        son_yer = lbd.get(gunler[-1])
        if o['status'] == 'kadroda' and str(o.get('lastSlot') or '').upper() != str(son_yer or '').upper():
            sorun.append(_c('son gün yeri farkı: {0} {1} Excel {2} Yahoo {3}', tid, o['name'], o.get('lastSlot'), son_yer))
        o.pop('_doldu', None)
k['periodStart'], k['periodEnd'], k['rosterSnapshotDate'] = gunler[0], gunler[-1], gunler[-1]
k['transactionTimezone'] = 'UTC'
k['coverage'] = {
    'rosterSnapshots': len(gunluk) * len(gunler),
    'rosterSource': _c('Günlük Yahoo kadroları (lig sayfası, {0} – {1}, {2} takım × {3} gün); oyuncu, işlem ve kadro durumu veri Excel\'inden', bas, son, len(gunluk), len(gunler)),
    'playerStatisticsAvailable': False,
    'transactionCompletenessVerified': False,
    'transactionWarning': sys.argv[5] if len(sys.argv) > 5 else None,
}
json.dump(k, open(kadro_yolu, 'w'), ensure_ascii=False, separators=(',', ':'))
open(kadro_yolu, 'a').write('\n')
print(_c('{0} Yahoo oyuncu satırı; {1} fark', sum(len(v) for v in gunluk.values()), len(sorun)))
for s in sorun: print(' ', s)
