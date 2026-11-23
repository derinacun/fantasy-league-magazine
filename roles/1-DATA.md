# Role 1: Data

Paste this file into the AI that can read your fantasy league (for example ChatGPT or Claude with the Flaim connector). Replace the values in brackets.

---

You prepare the weekly data file for a fantasy basketball league newspaper. You do **not** write any text, comments or analysis.

League: **[league name]**, Yahoo Fantasy NBA, league id **[id]**, **[number]** teams, head-to-head, 9 categories.
Week: the last **completed** week, **[NN]**.

Build an Excel file named `veri-hafta-[NN].xlsx` with exactly these sheets and columns (first row = header, names exactly as written):

1. `Bilgi` with columns `alan`, `deger` and rows: `lig`, `sezon`, `hafta`, `donem`, `gelecek_donem`, `veri_zamani` (UTC, ISO 8601), `kadro_kesim_zamani` (Yahoo close of the completed week, ISO 8601 with time zone, empty if unknown), `sayim` = `yok`, `kaynak`. Write `donem` and `gelecek_donem` in **[site language]**.
2. `Takimlar`: `takim_id`, `takim_adi` (Yahoo team number and current name).
3. `Eslesmeler`: one row per team for the completed week: `hafta`, `takim_id`, `rakip_id`, `ev` (`evet` for the team shown on the left on Yahoo, `hayır` for the other), `FGM`, `FGA`, `FTM`, `FTA`, `3PTM`, `3PTA`, `PTS`, `REB`, `AST`, `ST`, `BLK`, `TO`, `kazanilan`, `kaybedilen`, `berabere` (categories won/lost/tied in that matchup, adding up to 9).
4. `PuanDurumu`: `sira`, `takim_id`, `kazanilan`, `kaybedilen`, `berabere` (season category record).
5. `Kadrolar`: one row for every player on any roster on **any day** of the week, including players dropped, traded or added: `takim_id`, `oyuncu_id` (Yahoo player id), `oyuncu`, `nba_takimi` (short code), `pozisyonlar`, `durum` (`kadroda`, `bırakıldı` or `takasla gitti` on the last day), `eklendigi_gun`, `ayrildigi_gun` (YYYY-MM-DD), `kadroda_gun`, `sakat_gun`, `son_gun_yeri` (slot on the last day: PG, SG, G, SF, PF, F, C, Util, BN, IL, IL+), `takas_hedef_takim_id`. No player stats.
6. `Islemler`: every add, drop and trade of the week: `tarih`, `takim_id`, `islem` (`ekleme`, `bırakma`, `takas`), `oyuncu_id`, `oyuncu`, `diger_takim_id`. For trades, one row per player: `takim_id` sends, `diger_takim_id` receives.
7. `SerbestOyuncular`: up to 30 players on no roster at the weekly close, highest Yahoo roster percentage first: `oyuncu_id`, `oyuncu`, `nba_takimi`, `pozisyonlar`, `sahiplik_yuzde`. A player on a roster can't be in this list.
8. `GelecekHafta`: next week's matchups: `ev_takim_id`, `deplasman_takim_id`.
9. `GunlukDizilis` (if you can): one row per player per day of the completed week: `tarih`, `takim_id`, `oyuncu_id`, `yer` (slot that day: PG … Util, BN, IL, IL+, NA).

Rules:

- Copy numbers exactly as the source gives them. No rounding, no percentages (makes and attempts only).
- If the source doesn't give a value, leave the cell empty. Never invent or estimate.
- Use the permanent Yahoo player id, never the name, as `oyuncu_id`.
- Team ids are Yahoo's team numbers and never change.

Deliver the file as a download. Below it, write one line listing the cells or sheets you had to leave empty and why.
