# Quiz Runner SFX — curated sources (review & pick)

This project currently generates sounds via WebAudio. If you want to switch to **real audio files**, here are **safe places to browse** and **search links** for “correct / win” sounds.

Guideline: prefer **CC0 / Public Domain** (no attribution required) to keep sharing/redistribution simple.

## Best sources (easy filtering)

### 1) Freesound (filter to CC0)
- Site: https://freesound.org
- CC0 search (win): https://freesound.org/search/?q=win&license=Creative+Commons+0
- CC0 search (correct): https://freesound.org/search/?q=correct+answer&license=Creative+Commons+0
- CC0 search (success): https://freesound.org/search/?q=success&license=Creative+Commons+0
- CC0 search (applause short): https://freesound.org/search/?q=applause+short&license=Creative+Commons+0
- CC0 search (cheer): https://freesound.org/search/?q=cheer&license=Creative+Commons+0

Notes:
- Freesound has multiple licenses; **double-check** the chosen sound is CC0.
- Some sounds are very quiet; you may want to normalize.

### 2) OpenGameArt (many CC0 options)
- Site: https://opengameart.org
- Search (win): https://opengameart.org/art-search-advanced?keys=win&field_art_type_tid%5B%5D=12
- Search (jingle): https://opengameart.org/art-search-advanced?keys=jingle&field_art_type_tid%5B%5D=12

Notes:
- Verify license per asset page (CC0 preferred).

### 3) Kenney (high-quality, CC0 game assets)
- Site: https://kenney.nl/assets
- Many packs include UI/game SFX; licenses are typically very permissive.

## Good “royalty-free” sources (read license carefully)

### Pixabay Sound Effects
- https://pixabay.com/sound-effects/
- Search (correct): https://pixabay.com/sound-effects/search/correct/
- Search (win): https://pixabay.com/sound-effects/search/win/

### Mixkit Sound Effects
- https://mixkit.co/free-sound-effects/
- Search (success): https://mixkit.co/free-sound-effects/success/

Notes:
- These are usually free to use, but not necessarily CC0. Confirm the license matches your use.

## What to search for (keywords)

For “Correct / Win” (short, punchy):
- `correct answer ding`
- `game win jingle`
- `success chime`
- `victory stinger`
- `level up`
- `ta-da`

For “Correct / Win” (big celebration):
- `crowd cheer`
- `applause`
- `stadium cheer`
- `fireworks pop`

## Suggested audio constraints (so it feels right in the quiz)

- Format: `mp3` or `wav`
- Duration: ~`0.6s – 1.8s`
- Start: fast attack (feels responsive)
- Loudness: should be clearly above the last-5s tick

## Next step

You selected:
- **Badge Coin Win** (Freesound): https://freesound.org/people/steaq/sounds/387232/

Download that sound and save it here as:
- `sfx/correct.mp3`

If you downloaded a WAV (or you accidentally ended up with a double extension), these also work:
- `sfx/correct.wav`
- `sfx/correct.mp3.wav`

Optional (later): add these too if you want file-based SFX for other outcomes:
- `sfx/wrong.mp3`
- `sfx/timeout.mp3`

Then tell me which filenames you chose, and I’ll wire the app to use them (with a fallback to WebAudio if the files aren’t present).
