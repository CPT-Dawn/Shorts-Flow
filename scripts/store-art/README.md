# Store art

`bun run store-art` makes every image and the promo video for the Chrome Web Store and Firefox Add-ons listings from the real extension, into `docs/release/store-art/`. Run it on the release build (`bun run build:chrome` first) so the art shows exactly what ships. Which file goes in which store slot, and the Firefox captions, are in `docs/release/store-listing.md`.

Needs the Playwright Chromium (`bunx playwright install chromium`), `rsvg-convert`, `ffmpeg` and ImageMagick (`magick`). It takes about a minute for the stills and a few more for the film. `--only stills` or `--only film` makes one; `--skip-capture` reuses the last captures in `.store-art/` (gitignored) while you work on a layout.

## How it works

1. **Scenes.** The Shorts in the art play the Tideline illustrations in `scenes/` (ocean, aurora, dunes, ridges), never a creator's video, so no real face, name or channel can be read as an endorsement.
2. **Captures.** `make.mjs` loads `.output/chrome-mv3` into Chromium and opens the anonymised Shorts Feed test pages (`tests/pages/`) at `www.youtube.com`, answering every request locally. It swaps the lorem ipsum for fictional channels and titles, sets the extension's storage the way a viewer might have it, and captures the real Shorts Control, quick-settings menu, Shortcut confirmation, Break Nudge and Popup (light and dark) at 2×. It also records where each one sits on the page, so the layouts crop from measured positions.
3. **Layouts.** `stills.html` lays the captures out as the five 1280×800 screenshots, the 440×280 small promo tile and the 1400×560 marquee. `film.html` is a 40-second, 1080p film driven by `render(t)`, rendered frame by frame at 30 fps and encoded to H.264.

## Art direction

The brand rules are in `docs/design/brand/README.md`, under "Store art". In short:

- **One template.** The night gradient with its tideline; a Tide Light overline; a Sora headline whose second half is in Pearl; one line of Instrument Sans; the real UI floating on the right. The lockup sits bottom left and "Not affiliated with YouTube" bottom right.
- **One bright thing.** Each frame has one Pearl ring, on the thing being sold.
- **Benefits, not features.** The headlines are "Shorts that play themselves.", "Right where your thumb is.", "Every Short at your speed.", "Stop when you mean to." and "Nothing leaves your browser."
- **Readable small.** The Chrome Web Store shows screenshots at 640×400, so headlines are 66 px and UI crops are scaled up.
- **Promo images carry no copy but the wordmark.** There is never YouTube's logo, red or play triangle outside the real UI, and Skip Sponsored Shorts never leads.
