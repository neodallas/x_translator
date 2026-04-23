# X Translator — Chrome Extension

A lightweight Chrome extension that adds inline translation to every post on X (Twitter), powered by [Lingva Translate](https://github.com/thedaviddelta/lingva-translate).

---

## Features

- **One-click translation** — a "Translate" button appears under every post
- **Auto-translate** — automatically translates all posts as you scroll
- **Skips posts already in your language** — no unnecessary requests
- **Translates replies & threads** — works on all tweet types
- **Translation cache** — each post is translated only once per session
- **Auto-retry** — retries up to 2 times on network errors (1s → 2s backoff)
- **Multiple Lingva instances** — falls back to another server if one is down
- **On/Off toggle** — disable the extension without uninstalling
- **Appearance settings** — font size and border color for the translation block
- **Synced settings** — preferences sync across your Chrome devices via `chrome.storage.sync`
- **Dark popup UI** — clean dark interface

---

## Installation

> The extension is not yet published on the Chrome Web Store. Install it manually:

1. Clone or download this repository
2. Open Chrome → go to `chrome://extensions/`
3. Enable **Developer mode** (top right toggle)
4. Click **Load unpacked** → select the project folder
5. Go to [x.com](https://x.com) — a **Translate** button will appear under every post

---

## Usage

| Action | How |
|---|---|
| Translate a post | Click the **Translate** button under any post |
| Hide translation | Click **Hide** |
| Auto-translate all posts | Open popup → toggle **Auto-translate** |
| Change target language | Open popup → select from the dropdown |
| Change font size | Open popup → **Font size** selector |
| Change border color | Open popup → **Border color** picker |
| Disable extension | Open popup → toggle the **On/Off** switch in the header |

---

## How it works

Translation is handled by **Lingva Translate** — an open-source, privacy-friendly frontend for Google Translate that requires no API key.

The extension tries three public Lingva instances in order:

1. `lingva.ml`
2. `translate.plausibility.cloud`
3. `lingva.thedaviddelta.com`

If all three fail, the retry mechanism kicks in (up to 2 retries with exponential backoff).

---

## Privacy

- **No data collection** — the extension collects nothing about you
- **No analytics** — zero tracking
- Only the **text of the tweet you click** is sent to a Lingva server for translation
- Settings are stored locally in `chrome.storage.sync` (encrypted by Chrome)
- Permissions used: `storage` only

---

## Project structure

```
manifest.json     — Extension config (Manifest V3)
content.js        — Injects translate buttons, handles translation logic
popup.html        — Settings popup UI
popup.js          — Popup logic
styles.css        — Styles for the translate button and result block
icons/            — Extension icons (16×16, 48×48, 128×128)
```

---

## License

MIT
