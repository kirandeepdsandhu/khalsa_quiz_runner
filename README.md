# Sikh Quiz — Quiz Runner (local)

This is a simple, local browser-based UI to:
- register teams on the spot
- run multiple quiz rounds
- show questions with team turn order
- run a per-question timer
- lock an answer to auto-reveal and auto-score (supports negative marking)
- keep score and view a scoreboard
- export/import state as JSON

## Run

1. Open [index.html](index.html) in a browser (Chrome / Edge recommended).
2. In **Setup → Load Question Bank**, pick your question bank JSON file (e.g. `Question_Bank_Sikhi_quiz.v8.corrected.json`).
3. Add teams.
4. Configure round settings and selected sections.
5. Click **Start new round**, then go to the **Quiz** tab.

## Question bank reader/editor

There are two additional pages to browse and edit the question-bank JSON **section-by-section**:

- Read mode (landing for reading): [bank_read.html](bank_read.html)
- Edit mode: [bank_edit.html](bank_edit.html)

Notes:
- Edit mode only edits **one question at a time**.
- When saving an edit, you must enter your name; each save appends an entry into `section_updates` in the JSON.
- You can add a new section or delete a section from the edit page.
- Use **Download updated JSON** to export the modified file.
- The full JSON bank is **not** stored in localStorage; it stays in memory (per-tab) and is carried between the read/edit pages.
- localStorage is used only for lightweight status and the section index (read/edited/added/deleted).

## Merging edits from multiple people

If multiple people edit different sections (each person downloads their own edited JSON), you can merge them back into one file.

From the repo root:

```bash
python merge_question_bank_json.py --base Question_Bank_Sikhi_quiz.bilingual.en-pa.json \
	--out Question_Bank_Sikhi_quiz.bilingual.en-pa.merged.json \
	editor1.edited.json editor2.edited.json editor3.edited.json
```

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

## Third-party notices

See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## No-repeat behavior

- Questions are not repeated across rounds (the app keeps an internal asked-history).
