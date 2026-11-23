"""Betik mesajları için çeviri: kaynak metin Türkçe; veri/ayarlar.json → "dil" en, fr ya da es ise
src/i18n/<dil>.json sözlüğünden karşılığı kullanılır (sitedeki sözlükle aynı). Yer tutucular {0}, {1} …;
çoğul {0|# game|# games}."""
import json, os, re

_KOK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
try:
    _DIL = os.environ.get('CEVIRI_DIL') or json.load(open(os.path.join(_KOK, 'veri', 'ayarlar.json'), encoding='utf-8')).get('dil', 'tr')
except Exception:
    _DIL = 'tr'
_SOZ = {}
if _DIL != 'tr':
    try:
        _SOZ = json.load(open(os.path.join(_KOK, 'src', 'i18n', f'{_DIL}.json'), encoding='utf-8'))
    except Exception:
        _SOZ = {}
_YER = re.compile(r'\{(\d+)(?:\|([^|}]*)\|([^}]*))?\}')


def t(metin, *degerler):
    sablon = _SOZ.get(metin, metin)
    def yer(m):
        v = degerler[int(m.group(1))] if int(m.group(1)) < len(degerler) else ''
        if m.group(2) is None:
            return '' if v is None else str(v)
        return (m.group(2) if str(v) == '1' else m.group(3)).replace('#', str(v))
    return _YER.sub(yer, sablon)
