# Data format

Two kinds of files feed the site:

1. **The weekly Excel** (`veri-hafta-NN.xlsx`): raw league data for the week that just ended. Filled by the Data role ([roles/1-DATA.md](../roles/1-DATA.md)) or by hand.
2. **The issue file** (`veri/haftalar/hafta-NN.json`): numbers from the Excel plus everything the Writer adds. Created by `scripts/excelden.py`, completed by the Writer ([roles/2-WRITER.md](../roles/2-WRITER.md)).

Sheet and column names can be written in Turkish (as below) or in English: `Info`, `Teams`, `Matchups`, `Standings`, `Rosters`, `Transactions`, `Free_agents`, `Next_week`, `Daily_lineups`, `Notes`, with columns such as `team_id`, `team_name`, `opponent_id`, `home`, `won`, `lost`, `tied`, `rank`, `player_id`, `player`, `nba_team`, `positions`, `status`, `added_on`, `left_on`, `days_on_roster`, `injured_days`, `last_day_slot`, `traded_to_team_id`, `date`, `type`, `other_team_id`, `rostered_pct`, `home_team_id`, `away_team_id`, `slot`, and info fields `league`, `season`, `week`, `period`, `next_period`, `data_time`, `roster_cutoff_time`, `counting`, `source`. Values may be English too (`yes`, `none`, `on roster`, `dropped`, `traded`, `add`, `drop`, `trade`). `NN` is the number of the last **completed** week with two digits (`03`, `10`).

General rules for the Excel:

- First row of every sheet is the header.
- Team ids are Yahoo's team numbers (`1` to the number of teams) and never change during the season.
- Write numbers exactly as Yahoo shows them, without rounding. No percentage columns: write makes and attempts, the site computes the percentages.
- If the source doesn't give a value, leave the cell empty. Never invent values.
- No player statistics are needed (Yahoo already shows them).

## The weekly Excel

### Sheet `Bilgi` (info)

Two columns: `alan` (field), `deger` (value).

| alan | Example | Meaning |
|---|---|---|
| `lig` | Demo League | League name |
| `sezon` | 2026 | Year the season started |
| `hafta` | 3 | Last completed week |
| `donem` | Nov 2–8, 2026 | Date range of that week, in your language |
| `gelecek_donem` | Nov 9–15, 2026 | Date range of next week |
| `veri_zamani` | 2026-11-09T09:00:00Z | When the data was taken (UTC) |
| `kadro_kesim_zamani` | | Yahoo close of the completed week, ISO 8601 with time zone. Rosters and free agents describe this moment. Leave empty if unknown |
| `sayim` | yok | Always `yok` ("none": no player stats) |
| `kaynak` | Flaim | Where the data came from |

### Sheet `Takimlar` (teams)

`takim_id` · `takim_adi` — one row per team, current Yahoo names.

### Sheet `Eslesmeler` (matchups)

The completed week's matchups, **one row per team**.

`hafta` · `takim_id` · `rakip_id` · `ev` · `FGM` · `FGA` · `FTM` · `FTA` · `3PTM` · `3PTA` · `PTS` · `REB` · `AST` · `ST` · `BLK` · `TO` · `kazanilan` · `kaybedilen` · `berabere`

- Stats are the team's Yahoo totals for the week (the values on the matchup page).
- `kazanilan` / `kaybedilen` / `berabere`: categories won / lost / tied in that matchup; they add up to 9.
- `ev` (home): `evet` (yes) for the team shown on the left on Yahoo, `hayır` (no) for its opponent.

### Sheet `PuanDurumu` (standings)

`sira` · `takim_id` · `kazanilan` · `kaybedilen` · `berabere` — Yahoo standings: rank and season category record.

### Sheet `Kadrolar` (rosters)

One row for **every player who was on a roster on any day** of the completed week, including players dropped, traded away or added during the week.

`takim_id` · `oyuncu_id` · `oyuncu` · `nba_takimi` · `pozisyonlar` · `durum` · `eklendigi_gun` · `ayrildigi_gun` · `kadroda_gun` · `sakat_gun` · `son_gun_yeri` · `takas_hedef_takim_id`

| Column | Meaning |
|---|---|
| `oyuncu_id` | Permanent Yahoo player id (never use the name as id). One row per team and player per week |
| `oyuncu` | Player name |
| `nba_takimi` | Yahoo's short NBA team code (`DEN`, `LAL`…) |
| `pozisyonlar` | Eligible positions, e.g. `PG,SG` |
| `durum` | Status on the last day: `kadroda` (on roster), `bırakıldı` (dropped) or `takasla gitti` (traded away) |
| `eklendigi_gun` | Day the player joined during the week (YYYY-MM-DD); empty if on the roster since the start of the week |
| `ayrildigi_gun` | Day of the drop or trade (YYYY-MM-DD) |
| `kadroda_gun` | Days on the roster this week (empty if unknown) |
| `sakat_gun` | Days in an injured list slot this week (empty if unknown) |
| `son_gun_yeri` | Roster slot on the **last day** of the week, as Yahoo writes it: `PG`, `SG`, `G`, `SF`, `PF`, `F`, `C`, `Util`, `BN` (bench), `IL` or `IL+` (injured list). Empty for players who left |
| `takas_hedef_takim_id` | For a player traded away: id of the team that received him |

### Sheet `Islemler` (transactions)

Every add, drop and trade of the completed week.

`tarih` · `takim_id` · `islem` · `oyuncu_id` · `oyuncu` · `diger_takim_id`

- `islem`: `ekleme` (add), `bırakma` (drop) or `takas` (trade).
- For a trade, one row per player: `takim_id` is the team **sending** the player, `diger_takim_id` the team **receiving** him.

### Sheet `SerbestOyuncular` (free agents)

Up to 30 players who were on **no roster at the weekly close**, highest Yahoo roster percentage first.

`oyuncu_id` · `oyuncu` · `nba_takimi` · `pozisyonlar` · `sahiplik_yuzde`

A player marked `kadroda` in `Kadrolar` can't be here. If the source can't give the pool at the close, leave the sheet empty and say so.

### Sheet `GelecekHafta` (next week)

`ev_takim_id` · `deplasman_takim_id` — next week's matchups (home, away).

### Sheet `GunlukDizilis` (daily lineups, optional but recommended)

`tarih` · `takim_id` · `oyuncu_id` · `yer` — one row per player per day of the completed week, with the roster slot that day (`PG` … `Util`, `BN`, `IL`, `IL+`, `NA`). Needed for the sleep score and the player and flop of the week. Without it, those sections are skipped for that week.

### Sheet `Notlar` (notes, optional)

`konu` · `ayrinti` · `kaynak` · `tarih` — anything useful the source gives that has no other place (league setting changes, injury news). No comments.

## Scripts

| Command | What it does |
|---|---|
| `python3 scripts/excelden.py veri-hafta-NN.xlsx --onceki veri/haftalar/hafta-(N-1).json` | Checks the Excel, writes `taslak/hafta-NN.json` (draft issue: teams, standings, all weeks, next week) and `veri/kadrolar/hafta-NN.json` (rosters, transactions, free agents) |
| `python3 scripts/gunluk_excelden.py veri-hafta-NN.xlsx <first day> <last day> > gunluk-NN.txt` | Reads `GunlukDizilis` |
| `python3 scripts/gunluk.py gunluk-NN.txt veri/kadrolar/hafta-NN.json <first day> <last day>` | Adds daily lineups to the roster file and cross-checks days on roster |
| `python3 scripts/nba_maclar.py veri/kadrolar/hafta-NN.json` | Downloads NBA box scores for the week → `veri/nba/hafta-NN.json` |
| `npm run uyku -- NN` | Prints the sleep table, player of the week and a check against Yahoo totals |
| `python3 scripts/hesapla.py taslak/hafta-NN.json` | Prints power, all-play, strengths and changes so the text uses the same numbers as the site |
| `python3 scripts/yahoo_sira.py sira-NN.txt NN YYYY-MM-DD` | Optional: current Yahoo player ranks for the draft report card |
| `npm run tahmin -- NN` | Prediction game material for the writer (after entries are added) |
| `npm run dogrula` | Validates all data files |
| `npm run build` | Validates, runs tests, builds the site |

The scripts print their messages in the language set in `veri/ayarlar.json`. If one stops with an error, give the message to your AI.

## The issue file (`veri/haftalar/hafta-NN.json`)

Empty template: `veri/sablon-hafta.json`. Field names are English; don't rename them. Numbers come from the converter; the Writer adds the text fields. Lengths are limits the site checks (it warns when they're exceeded).

| Field | Who | Content |
|---|---|---|
| `schemaVersion`, `season`, `week`, `publishedAt`, `period` | converter | Always `2`; season year; issue number = completed week; data time (UTC); date range |
| `teams`, `standings`, `weeks` | converter | Teams (fixed ids), standings, **every** week from 1 to N with matchups and stats |
| `nextWeek.matchups` | converter + Writer | Next week's matchups; the Writer adds `abiPick` (the fan persona's pick) and `abiNote` (≤ 140 characters) |
| `nextWeek.matchOfWeek` | Writer | `{ "home", "away", "abiScore": [home, away] }` for the prediction game |
| `title` | Writer | Headline, ≤ 70 characters |
| `summary` | Writer | 1–2 sentences, ≤ 260 characters |
| `article` | Writer | `{ "byline", "photo": { "teamId", "caption" ≤ 140 }, "paragraphs": [3–6] }` |
| `stories` | Writer | 2–4 analysis pieces: `{ "label", "title", "text", "teamIds" }` |
| `teamNotes` | Writer | One note per team: `{ "teamId", "text" }` |
| `sleepNotes` | Writer, optional | `{ "teamId", "text" ≤ 160 }` for teams with a sleep score of 5 or more |
| `playerNotes` | Writer | 4–6: `{ "name", "teamId" or null, "label", "text", "source" }` |
| `trades` | Writer | 5–8 ideas: `{ "a", "b", "giveA", "giveB", "benefitA", "benefitB", "risk", "confidence", "source" }` |
| `forecastColumn` | Writer, optional | `{ "hoca", "abi" }` ≤ 450 each: the two personas review the week's predictions |
| `forecastHour` | Writer, optional | `{ "topics": [2–4], "turns": [{ "asker": "hoca" or "abi", "question" ≤ 240, "answer" ≤ 650 }] }` |
| `forecastNotes` | Writer, optional | One-line notes for `nextWeek`, `predictionGame`, `fairTable`, `luck`: `{ "from", "text" ≤ 200 }` |
| `chatCounts` | Writer, optional | Messages per team in the group chat that week: `{ "1": 120, … }` (numbers only) |
| `breaking` | Writer, optional | Breaking news banner: `{ "label", "title", "text", "teamIds" }` |
| `beltNews` | Writer, optional | Only if a main belt changed hands: `{ "title", "text" }` |
| `predictionEntries` | Writer, from the site | Prediction game entries, copied from `/api/tahmin?week=NN` after picks close |
| `sources` | Writer | Every source used: `{ "label", "url", "date" }` |

`hoca` is the analyst persona and `abi` the fan persona (their display names come from the interface language). Rules the build enforces: every team plays exactly one matchup per week; categories in a matchup add up to 9 and mirror each other; percentages match makes/attempts; all completed weeks are present.

Past seasons (`veri/gecmis.json`), the draft (`veri/draft.json`) and the schedule (`veri/fikstur.json`) are optional; the pages that use them stay hidden without them.
