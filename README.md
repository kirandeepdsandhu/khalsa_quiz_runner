# Sikhism Knowledge — Quiz Runner (local)

This is a simple, local browser-based UI to:
- register teams on the spot
- run multiple quiz rounds
- show questions with team turn order
- run a per-question timer
- lock an answer to auto-reveal and auto-score (supports negative marking)
- keep score and view a scoreboard
- export/import state as JSON

## Pages

### Quiz Runner
[index.html](index.html) — Run a live quiz (teams, rounds, scoring, timer, backup).

1. Open [index.html](index.html) in a browser (Chrome / Edge recommended).
2. Load a bank via either:
	- **Load** (pick a JSON file from disk)
	- **Load default** (choose a bundled bank from the dropdown, requires a web server)
3. Add teams.
4. Configure round settings and selected sections.
5. Click **Start new round**, then go to the **Quiz** tab.

### Sikh Guru Sahibaan Bansavali (Family Tree)

[bansavali.html](bansavali.html) — An interactive step-by-step presentation of the Sikh Guru Sahibaan Bansavali:
- **Step-by-step mode**: Progressively reveal Guru Sahibs and their facts
- **All Guru Sahib mode**: View all Gurus in card format
- **Timeline mode**: Animated timeline view with year-by-year playback
- Toggle visibility of birth, gurgaddi, joti jot dates, family relationships, and more

### Quiz Bank Read
[bank_read.html](bank_read.html) — Browse the quiz bank section-by-section and track read status.

### Quiz Bank Edit
[bank_edit.html](bank_edit.html) — Edit one question at a time and export an updated JSON.

## Quiz banks (bundled)

This repo includes two ready-to-use quiz bank JSON files:

- [Question_Bank_Sikhi_quiz.bilingual.en-pa.json](Question_Bank_Sikhi_quiz.bilingual.en-pa.json) — Sikhism Knowledge quiz (bilingual EN/PA)
- [Question_Bank_Sikh_Gurus_Family_Tree.en.json](Question_Bank_Sikh_Gurus_Family_Tree.en.json) — Sikh Gurus family tree quiz (English)

Where they show up:
- **Load default** dropdown (Quiz Runner / Bank Read / Bank Edit)
- **Menu → Download** (quick download links)

Notes:
- Edit mode only edits **one question at a time**.
- When saving an edit, you must enter your name; each save appends an entry into `section_updates` in the JSON.
- You can add a new section or delete a section from the edit page.
- Use **Download updated JSON** to export the modified file.
- The full JSON bank is **not** stored in localStorage; it stays in memory (per-tab) and is carried between the read/edit pages.
- localStorage is used only for lightweight status and the section index (read/edited/added/deleted).

Server note:
- Browser security blocks `fetch()` for default banks on `file://`.
- For **Load default**, run a local server from this folder (example): `python -m http.server`

## Merging edits from multiple people

If multiple people edit different sections (each person downloads their own edited JSON), you can merge them back into one file.

From this folder:

```bash
python merge_question_bank_json.py --base Question_Bank_Sikhi_quiz.bilingual.en-pa.json \
	--out Question_Bank_Sikhi_quiz.bilingual.en-pa.merged.json \
	editor1.edited.json editor2.edited.json editor3.edited.json
```

- You can also use `--base Question_Bank_Sikh_Gurus_Family_Tree.en.json` if you are editing the family-tree bank.

- If two files changed the same section differently, the script writes a conflicts report: `*.conflicts_report.json`.

## Turn order + scoring

- Teams take turns automatically in the order you added them.
- The current team is highlighted with a unique color.
- Select an option and click **Lock answer** to reveal the correct answer and apply scoring.
- Use **Skip** to give 0 points for that question.

## Notes

- The question bank is kept **in memory** (not saved into localStorage). If you refresh, just load the bank file again.
- App state (teams, scores, rounds, asked-history) auto-saves into **localStorage**.
- For safety/portability, use **Backup → Export** at the end of your event.

## Activities (for children / group learning)

See [Activities/](Activities/) for printable / shareable activities that can be used alongside the quiz or for knowledge sharing with children.

Examples in this folder:
- [Activities/activites.txt](Activities/activites.txt) — quick activity ideas
- Card / strip documents (e.g., atomic fact strips, draw cards, activity cards) in `.docx`

## Third-party notices

See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## No-repeat behavior

- Questions are not repeated across rounds (the app keeps an internal asked-history).
