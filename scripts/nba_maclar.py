#!/usr/bin/env python3
"""NBA maç günleri ve kimin oynadığı (ESPN'in herkese açık skor servisi).

Kullanım:
  python3 scripts/nba_maclar.py veri/kadrolar/hafta-NN.json
Çıktı: veri/nba/hafta-NN.json

- maclar: tarih (ABD tarihi, Yahoo'nun günlük kadrosuyla aynı) → o gün maçı olan NBA takımları (Yahoo kodlarıyla)
- istatistik: Yahoo oyuncu kimliği → tarih → istatistikSirasi düzeninde maç satırı; yalnızca süre aldığı maçlar
  (o haftanın lig kadrolarındaki oyuncular; aktif/yedek ayrımı kadro dosyasından). "Oynadı" = bu listede o tarih var.
- sakat: Yahoo oyuncu kimliği → tarih → maç kâğıdındaki sakatlık durumu (Out, Day-To-Day ...)
- eslesmeyen: takımı maç yaptığı hâlde hiçbir maç kâğıdında adı bulunamayan oyuncular (ad yazımı farkı olabilir; elle bakılır)
Uyuyan koç hesabı bu dosyayı kullanır (src/lib/uyuyan.js). Dosya yoksa bölüm görünmez.
"""
import os as _os, sys as _sys
_sys.path.insert(0, _os.path.dirname(_os.path.abspath(__file__)))
from ceviri import t as _c
import gzip, json, re, sys, time, unicodedata, urllib.request
from datetime import date, timedelta, datetime, timezone
from pathlib import Path

ESPN_YAHOO = {"GS": "GSW", "NY": "NYK", "SA": "SAS", "NO": "NOP", "UTAH": "UTA", "WSH": "WAS"}
TAKVIM = "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates={}&limit=100"
MAC = "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event={}"


def al(adres):
    for deneme in range(4):
        try:
            with urllib.request.urlopen(urllib.request.Request(adres, headers={"User-Agent": "league-newspaper"}), timeout=30) as r:
                b = r.read()
            if b[:2] == b"\x1f\x8b":
                b = gzip.decompress(b)
            return json.loads(b)
        except Exception as e:  # ağ hatasında yeniden dene
            if deneme == 3:
                raise
            time.sleep(2 + deneme * 2)


SAYIM = ["FGM", "FGA", "FTM", "FTA", "3PTM", "3PTA", "PTS", "REB", "AST", "ST", "BLK", "TO"]


def istatistik_satiri(adlar, degerler):
    """ESPN maç kâğıdı satırı → [FGM, FGA, FTM, FTA, 3PTM, 3PTA, PTS, REB, AST, ST, BLK, TO]."""
    d = dict(zip(adlar, degerler))
    try:
        fgm, fga = (int(x) for x in d["FG"].split("-"))
        ftm, fta = (int(x) for x in d["FT"].split("-"))
        tpm, tpa = (int(x) for x in d["3PT"].split("-"))
        return [fgm, fga, ftm, fta, tpm, tpa, int(d["PTS"]), int(d["REB"]), int(d["AST"]), int(d["STL"]), int(d["BLK"]), int(d["TO"])]
    except (KeyError, ValueError):
        return None


def sade(ad):
    ad = unicodedata.normalize("NFKD", ad).encode("ascii", "ignore").decode().lower()
    ad = re.sub(r"[.'’`-]", "", ad)
    ad = re.sub(r"\b(jr|sr|ii|iii|iv|v)\b", "", ad)
    return re.sub(r"\s+", " ", ad).strip()


def main():
    kadro_yolu = Path(sys.argv[1])
    k = json.loads(kadro_yolu.read_text(encoding="utf-8"))
    bas, son = date.fromisoformat(k["periodStart"]), date.fromisoformat(k["periodEnd"])
    oyuncular = {}  # id -> (ad, nbaTeam)
    for ps in k["teams"].values():
        for p in ps:
            oyuncular[p["id"]] = (p["name"], p.get("nbaTeam"))
    ada_gore = {}
    for pid, (ad, _) in oyuncular.items():
        ada_gore.setdefault(sade(ad), []).append(pid)

    maclar, oynadi, sakat, ist, gorulen, bitmeyen = {}, {}, {}, {}, set(), []
    gun = bas
    while gun <= son:
        t = gun.isoformat()
        maclar[t] = []
        tablo = al(TAKVIM.format(gun.strftime("%Y%m%d")))
        for e in tablo.get("events", []):
            c = e["competitions"][0]
            durum = c["status"]["type"]["name"]
            if durum in ("STATUS_POSTPONED", "STATUS_CANCELED"):
                continue
            kodlar = [ESPN_YAHOO.get(x["team"]["abbreviation"], x["team"]["abbreviation"]) for x in c["competitors"]]
            maclar[t].extend(kodlar)
            if durum != "STATUS_FINAL":
                bitmeyen.append(f"{t} {'-'.join(kodlar)} ({durum})")
                continue
            ozet = al(MAC.format(e["id"]))
            for taraf in ozet.get("boxscore", {}).get("players", []):
                for grup in taraf.get("statistics", []):
                    for a in grup.get("athletes", []):
                        s = sade(a["athlete"]["displayName"])
                        for pid in ada_gore.get(s, []):
                            gorulen.add((pid, t))
                            dakika = (a.get("stats") or ["0"])[0]
                            try:
                                dk = int(str(dakika).split(":")[0] or 0)
                            except ValueError:
                                dk = 0
                            if not a.get("didNotPlay") and dk > 0:
                                oynadi.setdefault(pid, []).append(t)
                                satir = istatistik_satiri(grup.get("names") or grup.get("labels") or [], a.get("stats") or [])
                                if satir:
                                    ist.setdefault(pid, {})[t] = satir
            for taraf in ozet.get("injuries", []):
                for i in taraf.get("injuries", []):
                    for pid in ada_gore.get(sade(i.get("athlete", {}).get("displayName", "")), []):
                        gorulen.add((pid, t))
                        sakat.setdefault(pid, {})[t] = i.get("status") or "?"
            time.sleep(0.2)
        maclar[t] = sorted(set(maclar[t]))
        gun += timedelta(days=1)

    eslesmeyen = []
    for pid, (ad, nba) in oyuncular.items():
        mac_gunu = [t for t, kod in maclar.items() if nba in kod]
        if mac_gunu and not any((pid, t) in gorulen for t in mac_gunu) and pid not in ist:
            eslesmeyen.append({"id": pid, "ad": ad, "nbaTakimi": nba, "macGunu": len(mac_gunu)})

    cikti = {
        "hafta": k["week"],
        "kaynak": _c('ESPN skor servisi (herkese açık)'),
        "olusturma": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "donem": [k["periodStart"], k["periodEnd"]],
        "maclar": maclar,
        "istatistikSirasi": SAYIM,
        "istatistik": {pid: dict(sorted(v.items())) for pid, v in sorted(ist.items())},
        "sakat": {pid: dict(sorted(v.items())) for pid, v in sorted(sakat.items())},
        "eslesmeyen": eslesmeyen,
        "bitmeyen": bitmeyen,
    }
    hedef = Path("veri/nba") / f"hafta-{k['week']:02d}.json"
    hedef.parent.mkdir(parents=True, exist_ok=True)
    # Tek satır, sıkı yazım: dosya küçük kalsın (yükleme sayfası tarayıcıdan hazırlanıyor)
    hedef.write_text(json.dumps(cikti, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(_c('{0}: {1} maç, {2} oyuncu oynadı', hedef, sum(len(v) for v in maclar.values()) // 2, len(cikti['istatistik'])))
    if bitmeyen:
        print(_c('UYARI bitmemiş maçlar:'), *bitmeyen, sep="\n  ")
    if eslesmeyen:
        print(_c('Bilgi: maç kâğıdında adı bulunamayanlar (sakat/kadro dışı ya da ad farkı):'))
        for x in eslesmeyen:
            print(_c('  {0} ({1}, {2} maç günü)', x['ad'], x['nbaTakimi'], x['macGunu']))


if __name__ == "__main__":
    main()
