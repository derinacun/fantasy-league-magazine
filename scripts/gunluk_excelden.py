"""Veri Excel'inin isteğe bağlı GunlukDizilis sayfasını scripts/gunluk.py'nin okuduğu sıkıştırılmış metne çevirir.

Kullanım: python3 gunluk_excelden.py veri-hafta-NN.xlsx <ilk gün> <son gün> > gunluk-NN.txt
Sayfa adı GunlukDizilis; başlıklar: tarih · takim_id · oyuncu_id · yer (her oyuncu için her gün bir satır).
Eksik gün, bilinmeyen yer ya da aynı gün iki kez yazılmış oyuncu varsa durur ve sorunu yazar.
"""
import os as _os, sys as _sys
_sys.path.insert(0, _os.path.dirname(_os.path.abspath(__file__)))
from ceviri import t as _c
import sys
from datetime import date, datetime, timedelta
from openpyxl import load_workbook

KOD = {'PG': '1', 'SG': '2', 'G': '3', 'SF': '4', 'PF': '5', 'F': '6', 'C': '7', 'UTIL': '8',
       'BN': 'B', 'IL': 'I', 'IL+': 'J', 'NA': 'N'}

xlsx, bas, son = sys.argv[1], sys.argv[2], sys.argv[3]
gunler = []
g = date.fromisoformat(bas)
while g <= date.fromisoformat(son):
    gunler.append(g.isoformat()); g += timedelta(days=1)
sira = {g: i for i, g in enumerate(gunler)}

wb = load_workbook(xlsx, read_only=True, data_only=True)
sayfa_adi = next((x for x in wb.sheetnames if x.replace('_', '').lower() in ('gunlukdizilis', 'dailylineups')), None)
if not sayfa_adi:
    sys.exit(_c('GunlukDizilis sayfası yok; uyku hesapları bu hafta atlanır ya da diziliş elle çıkarılır (docs/DATA.md).'))
satirlar = wb[sayfa_adi].iter_rows(values_only=True)
EN = {'date': 'tarih', 'team_id': 'takim_id', 'player_id': 'oyuncu_id', 'slot': 'yer'}
baslik = [EN.get(str(x).strip().lower(), str(x).strip()) for x in next(satirlar)]
s = {ad: baslik.index(ad) for ad in ('tarih', 'takim_id', 'oyuncu_id', 'yer')}

def metin(x):
    if x is None: return ''
    if isinstance(x, float) and x.is_integer(): x = int(x)
    if isinstance(x, (datetime, date)): return x.strftime('%Y-%m-%d')
    return str(x).strip()

veri, sorun, gorulen = {}, [], set()
for n, r in enumerate(satirlar, start=2):
    if not any(r): continue
    tarih, tid, pid, yer = (metin(r[s[k]]) for k in ('tarih', 'takim_id', 'oyuncu_id', 'yer'))
    if tarih not in sira: sorun.append(_c('satır {0}: hafta dışı tarih {1}', n, tarih)); continue
    kod = KOD.get(yer.upper())
    if not kod: sorun.append(_c('satır {0}: bilinmeyen yer {1}', n, repr(yer))); continue
    if (tarih, tid, pid) in gorulen: sorun.append(_c('satır {0}: {1}/{2} {3} iki kez', n, tid, pid, tarih)); continue
    gorulen.add((tarih, tid, pid))
    veri.setdefault(tid, {}).setdefault(pid, ['-'] * len(gunler))[sira[tarih]] = kod

for tid in sorted(veri, key=int):
    for i, gun in enumerate(gunler):
        if all(k[i] == '-' for k in veri[tid].values()): sorun.append(_c('takım {0}: {1} için hiç satır yok', tid, gun))
if sorun:
    sys.exit('Sorunlar:\n  ' + '\n  '.join(sorun))
print('|'.join(f'{tid}=' + ','.join(f'{pid}:{"".join(k)}' for pid, k in sorted(veri[tid].items(), key=lambda x: int(x[0])))
               for tid in sorted(veri, key=int)))
