# Third-Party Notices

This repository contains original work plus optional third-party libraries and/or references.

## Important

- The license you choose for this repository applies only to the original code/content you own and have the right to license.
- Any third-party software, media, or other content remains under its own license and copyright.
- This project is provided **"AS IS"**, without warranty; use at your own risk (see the repository LICENSE file).

## JavaScript libraries (loaded from CDN at runtime)

The question-bank editor uses optional external libraries for Punjabi (Gurmukhi) phonetic input. These are **not bundled** into this repo by default; they are fetched by the browser when you open the page (if you have internet access).

- **jQuery**
  - Used by: `bank_edit.html` (optional IME support)
  - Typical license: MIT
  - Project: https://jquery.com/

- **jquery.ime** (Wikimedia)
  - Used by: `bank_edit.html` (Punjabi phonetic IME)
  - License: dual-licensed **(GPL-2.0-or-later OR MIT)** (per the upstream package)
  - Project: https://github.com/wikimedia/jquery.ime

If you prefer **zero external network access**, you can vendor these libraries into the repo and load them locally. If you do that, you should also include the upstream license texts and update this notice accordingly.

## Audio/SFX

This project currently generates sounds using WebAudio (no bundled audio files).

If you add audio files under `sfx/`, ensure you only include assets you have rights to distribute and keep their license/attribution information alongside the files.
