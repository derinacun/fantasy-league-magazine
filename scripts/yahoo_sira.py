# Yahoo sezon sıraları → veri/yahoo-sira/hafta-NN.json (18 Kasım 2026; draft karnesi için, her sayıda)
# Girdi: Claude'un uygulama içi tarayıcıda Yahoo oyuncu listesinden (sahipli oyuncular, "Current" sıra) çıkardığı tek satır:
#   "id:current:preseason:maç id:current:preseason:maç ..." (maç bilinmiyorsa NaN). Ayrıntı docs/WEEKLY.md.
# Kullanım: python3 scripts/yahoo_sira.py sira-NN.txt NN YYYY-AA-GG
import os as _os, sys as _sys
_sys.path.insert(0, _os.path.dirname(_os.path.abspath(__file__)))
from ceviri import t as _c
import json, sys, os
metin, hafta, tarih = open(sys.argv[1], encoding='utf-8').read().strip(), int(sys.argv[2]), sys.argv[3]
if metin.startswith('#SIRA '): metin = metin[6:]
oyuncular = {}
for p in metin.split():
    pid, cur, pre, gp = p.split(':')
    oyuncular[pid] = {'sira': int(cur), 'onceki': int(pre), 'mac': None if gp == 'NaN' else int(gp)}
kok = os.path.join(os.path.dirname(__file__), '..')
yol = os.path.join(kok, 'veri', 'yahoo-sira', f'hafta-{hafta:02d}.json')
json.dump({'tarih': tarih, 'hafta': hafta, 'kaynak': _c('Yahoo oyuncu listesi, sahipli oyuncular, \'Current\' sıra (sezon), 9 kategori'), 'oyuncular': oyuncular},
          open(yol, 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
print(_c('{0} oyuncu → {1}', len(oyuncular), yol))
