"""
League Newspaper — sitenin hesaplarının Python karşılığı.
ChatGPT yazı yazmadan önce bunu çalıştırır; böylece metindeki sayılar sitedekiyle birebir aynı olur.

Kullanım:  python hesapla.py veri/haftalar/hafta-02.json
Çıktı: güç sıralaması, herkese karşı, kategori sıraları, en güçlü/zayıf 3 kategori,
takas uyumu ve (2. haftadan itibaren) son hafta değişimleri.
"""
import os as _os, sys as _sys
_sys.path.insert(0, _os.path.dirname(_os.path.abspath(__file__)))
from ceviri import t as _c
import json
import sys

KATEGORILER = ["FG%", "FT%", "3PT%", "PTS", "REB", "AST", "ST", "BLK", "TO"]
AD = {"FG%": _c('saha içi isabet'), "FT%": _c('serbest atış isabeti'), "3PT%": _c('üçlük isabeti'), "PTS": _c('sayı'),
      "REB": _c("ribaund"), "AST": _c("asist"), "ST": _c('top çalma'), "BLK": _c("blok"), "TO": _c('top kaybı')}
YUZDE = {"FG%": "FGM/A", "FT%": "FTM/A", "3PT%": "3PTM/A"}
EPS = 1e-9


def sayi(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def takim_ist(haftalar, tid):
    satirlar = [t for h in haftalar for m in h["matchups"] for t in (m["home"], m["away"]) if t["id"] == tid]
    s = {}
    for k in KATEGORILER:
        if not satirlar:
            s[k] = None
        elif k in YUZDE:
            if len(satirlar) == 1:
                s[k] = sayi(satirlar[0]["stats"][k])
            else:
                p = [tuple(map(float, str(r["stats"][YUZDE[k]]).split("/"))) for r in satirlar]
                d = sum(x[1] for x in p)
                s[k] = sum(x[0] for x in p) / d if d else None
        else:
            v = [sayi(r["stats"][k]) for r in satirlar]
            s[k] = sum(v) if all(x is not None for x in v) else None
    return s


def karsilastir(a, b):
    w = l = t = 0
    for k in KATEGORILER:
        if a[k] is None or b[k] is None:
            continue
        f = (a[k] - b[k]) * (-1 if k == "TO" else 1)
        if f > EPS:
            w += 1
        elif f < -EPS:
            l += 1
        else:
            t += 1
    return w, l, t


def kapsam(takimlar, haftalar):
    n = len(takimlar)
    ist = {t["id"]: takim_ist(haftalar, t["id"]) for t in takimlar}
    sira = {}
    for t in takimlar:
        sira[t["id"]] = {}
        for k in KATEGORILER:
            v = ist[t["id"]][k]
            if v is None:
                sira[t["id"]][k] = None
                continue
            daha_iyi = sum(1 for o in takimlar if ist[o["id"]][k] is not None and
                           (ist[o["id"]][k] < v if k == "TO" else ist[o["id"]][k] > v))
            sira[t["id"]][k] = 1 + daha_iyi
    guc = {tid: sum(n + 1 - r for r in s.values() if r is not None) for tid, s in sira.items()}
    hk = {}
    for t in takimlar:
        r = [0, 0, 0]
        for o in takimlar:
            if o["id"] == t["id"]:
                continue
            w, l, _ = karsilastir(ist[t["id"]], ist[o["id"]])
            r[0 if w > l else 1 if w < l else 2] += 1
        hk[t["id"]] = r
    sirali = sorted(takimlar, key=lambda t: -guc[t["id"]])  # kararlı: eşitlikte dosyadaki sıra
    en_iyi = {tid: sorted(KATEGORILER, key=lambda k: sira[tid][k])[:3] for tid in sira}
    en_zayif = {tid: sorted(KATEGORILER, key=lambda k: -sira[tid][k])[:3] for tid in sira}
    return dict(ist=ist, sira=sira, guc=guc, hk=hk, sirali=sirali, en_iyi=en_iyi, en_zayif=en_zayif, max=n * 9)


def uyum(takimlar, k, tid):
    puan = [(o["id"], sum(1 for c in k["en_zayif"][tid] if k["sira"][o["id"]][c] <= 5) +
             sum(1 for c in k["en_zayif"][o["id"]] if k["sira"][tid][c] <= 5)) for o in takimlar if o["id"] != tid]
    return sorted(puan, key=lambda x: -x[1])[:3]


def bicim(v, k):
    if v is None:
        return "—"
    if "%" in k:
        return "%" + f"{v * 100:.1f}".replace(".", ",")
    return str(int(v)) if float(v).is_integer() else f"{v:.1f}".replace(".", ",")


def main(yol):
    v = json.load(open(yol, encoding="utf-8"))
    takimlar = v["teams"]
    ad = {t["id"]: t["name"] for t in takimlar}
    haftalar = sorted([w for w in v["weeks"] if w["week"] <= v["week"]], key=lambda w: w["week"])
    bu = [w for w in haftalar if w["week"] == v["week"]][0]
    kh = kapsam(takimlar, [bu])
    ks = kapsam(takimlar, haftalar)
    for baslik, k in ((_c("SON HAFTA"), kh), (_c('SEZON TOPLAMI ({0} hafta)', len(haftalar)), ks)):
        print(_c('\n=== {0} — güç sıralaması (en fazla {1}) ===', baslik, k['max']))
        for i, t in enumerate(k["sirali"], 1):
            tid = t["id"]
            w, l, b = k["hk"][tid]
            print(_c('{0}. {1} güç {2}  herkese karşı {3}-{4}', format(i, '2'), format(ad[tid], '<28'), format(k['guc'][tid], '>3'), w, l) + (f"-{b}" if b else "") +
                  _c('  | güçlü: ') + ", ".join(f"{AD[c]} #{k['sira'][tid][c]}" for c in k["en_iyi"][tid]) +
                  _c('  | zayıf: ') + ", ".join(f"{AD[c]} #{k['sira'][tid][c]}" for c in k["en_zayif"][tid]))
    print(_c('\n=== SON HAFTA — kategori değerleri ==='))
    for t in kh["sirali"]:
        print(f"{ad[t['id']]:<28} " + "  ".join(f"{c}={bicim(kh['ist'][t['id']][c], c)}(#{kh['sira'][t['id']][c]})" for c in KATEGORILER))
    print(_c('\n=== TAKAS UYUMU (son hafta; 0-6) ==='))
    for t in kh["sirali"]:
        print(f"{ad[t['id']]:<28} " + ", ".join(f"{ad[o]} {p}/6" for o, p in uyum(takimlar, kh, t["id"])))
    if len(haftalar) > 1:
        onceki = haftalar[:-1]
        print(_c('\n=== SON HAFTA DEĞİŞİMİ (önceki haftaların haftalık ortalamasına göre) ==='))
        for t in kh["sirali"]:
            tid = t["id"]
            once = takim_ist(onceki, tid)
            simdi = takim_ist([bu], tid)
            parcalar = []
            for c in KATEGORILER:
                if once[c] is None or simdi[c] is None:
                    continue
                d = simdi[c] - (once[c] if "%" in c else once[c] / len(onceki))
                parcalar.append(f"{c} {d * 100:+.1f} puan" if "%" in c else f"{c} {d:+.1f}")
            print(f"{ad[tid]:<28} " + ", ".join(parcalar))
        ok = kapsam(takimlar, [haftalar[-2]])
        once_sira = [t["id"] for t in ok["sirali"]]
        simdi_sira = [t["id"] for t in kh["sirali"]]
        hareket = sorted(((once_sira.index(x) - simdi_sira.index(x), x) for x in simdi_sira), reverse=True)
        print(_c('\nGüç sırasında en çok yükselen:'), ad[hareket[0][1]], f"(+{hareket[0][0]})",
              _c('| en çok düşen:'), ad[hareket[-1][1]], f"({hareket[-1][0]})")
    print(_c('\n=== EŞLEŞMELER (Yahoo skoru) ==='))
    for m in bu["matchups"]:
        h, a = m["home"], m["away"]
        print(f"{h['name']} {h['score']['wins']}-{a['score']['wins']} {a['name']}" + (f" ({h['score']['ties']} berabere)" if h['score']['ties'] else ""))


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "veri/haftalar/hafta-01.json")
