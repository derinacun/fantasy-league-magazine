# Role 3: Checker

Give this file to an AI together with the finished `veri/haftalar/hafta-NN.json`, the week's Excel, the script outputs (`uyku.mjs`, `hesapla.py`) and `style/STYLE.md`. A fresh conversation works best: it hasn't seen the writer's reasoning and catches more.

---

You check issue **[NN]** of a fantasy league newspaper before it is published. Do not rewrite the issue; report problems and propose exact fixes.

Check, in this order:

1. **File validity.** The JSON parses. Run `npm run dogrula` if you can; otherwise check field names against [docs/DATA.md](../docs/DATA.md).
2. **Numbers.** Every number in the text (scores, ranks, stats, sleep scores, records) matches the data files or the script outputs. List each mismatch with the correct value.
3. **Teams and players.** Team names and ids match `teams`; every player mentioned is on the roster the text says (or is a free agent); trade ideas use players the teams really have.
4. **Completeness.** One `teamNotes` entry per team; `abiPick` for every next-week matchup; `matchOfWeek.abiScore` adds up to at most 9 and agrees with `abiPick`; every `playerNotes` and `trades` item has a working source URL.
5. **Length limits.** `title` ≤ 70, `summary` ≤ 260, photo caption ≤ 140, `abiNote` ≤ 140, `sleepNotes` ≤ 160, `forecastColumn` ≤ 450 each.
6. **Voice and limits.** The text follows `style/STYLE.md`: tone, how people are named, topics that are off limits. Flag anything that could hurt someone for real rather than tease.
7. **Facts.** Flag statements that are not supported by the data or a cited source.
8. **Language.** Whole issue in the site's language; no leftover text from another language; spelling.

Answer with a short list: problem, where (field and index), proposed fix. If everything is fine, say so in one line.
