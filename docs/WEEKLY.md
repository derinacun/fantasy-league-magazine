# Weekly workflow

About 30–60 minutes a week once you're used to it, most of it waiting for the AIs.

## Before the season (once)

1. Fill `veri/ayarlar.json` (see the README).
2. Write `style/STYLE.md`: your league's voice, personas, limits.
3. Optional: past seasons in `veri/gecmis.json`, the draft in `veri/draft.json`, the schedule in `veri/fikstur.json`.
4. Optional: team images in `public/gorsel/takim/<id>.jpg` (square avatar) and `<id>-foto.jpg` (wide photo). Without them the site shows initials.

## Every week

The week is over on Yahoo (usually Sunday night). Then:

| Step | Who | Result |
|---|---|---|
| 1. Data | Data role ([roles/1-DATA.md](../roles/1-DATA.md)) | `veri-hafta-NN.xlsx` |
| 2. Convert and check | You or the Writer AI, with the scripts | `taslak/hafta-NN.json`, `veri/kadrolar/hafta-NN.json`, `veri/nba/hafta-NN.json` |
| 3. Write | Writer role ([roles/2-WRITER.md](../roles/2-WRITER.md)) | `veri/haftalar/hafta-NN.json` |
| 4. Check | Checker role ([roles/3-CHECKER.md](../roles/3-CHECKER.md)) and `npm run build` | A build without errors |
| 5. Publish | You | Commit to GitHub; Cloudflare publishes in about 2 minutes |
| 6. After picks close (optional) | You | Copy prediction entries into the issue file (see below) |

### Step 2 commands

```
python3 scripts/excelden.py veri-hafta-NN.xlsx --onceki veri/haftalar/hafta-(N-1).json
python3 scripts/gunluk_excelden.py veri-hafta-NN.xlsx <first day> <last day> > gunluk-NN.txt
python3 scripts/gunluk.py gunluk-NN.txt veri/kadrolar/hafta-NN.json <first day> <last day>
python3 scripts/nba_maclar.py veri/kadrolar/hafta-NN.json
npm run uyku -- NN
python3 scripts/hesapla.py taslak/hafta-NN.json
```

The first issue has no `--onceki`. Skip the two daily-lineup lines if the Excel has no `GunlukDizilis` sheet. The `taslak/` folder is scratch space and is not committed.

### Step 5: publishing

Any way that gets the files into the repository works:

- **GitHub website:** "Add file" → "Upload files", drag the folders (`veri/haftalar/hafta-NN.json`, `veri/kadrolar/hafta-NN.json`, `veri/nba/hafta-NN.json`, …), then "Commit changes".
- **Git:** `git add veri && git commit -m "Issue NN" && git push`.
- **An AI with GitHub access** can commit for you.

If the build fails on Cloudflare, the previous issue stays online. Open the build log; lines starting with `✖` say what to fix.

### Step 6: prediction game (optional)

The reader prediction game needs push setup (README, Quick start step 8). After picks close (23:59 on publication day, league time zone), open `https://<your site>/api/tahmin?week=NN` and copy `predictionEntries` into next week's issue file. `npm run tahmin -- NN` then gives the writer material about who called it.

## One AI or several

**One AI** (for example Claude with a league connector and file access): paste the three role files one after the other in the same conversation, or attach them and say "do the Data role, then the Writer role, then the Checker role for week NN".

**Several AIs**, for cost or speed:

- Data: the AI that has your league connector (for example ChatGPT or Claude with Flaim). Give it [roles/1-DATA.md](../roles/1-DATA.md).
- Writer: the AI you like best for writing. Give it the Excel, `taslak/hafta-NN.json`, the outputs of `uyku.mjs` and `hesapla.py`, your `style/STYLE.md`, last week's issue file and optionally the group chat export.
- Checker: any AI, or a second conversation with the Writer AI. A fresh conversation catches more mistakes.

## Tips

- Keep every published issue file; the site builds the archive, streaks and history from them.
- Team ids never change. If a team renames itself, update `teams` and `standings`; old weeks keep old names.
- If a manager changes mid-season, add an entry to `kocDegisimleri` in the settings.
- Write the issue in the same language as the site (`"dil"`).
