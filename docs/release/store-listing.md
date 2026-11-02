# Store listing: Shorts Flow 3.0.0

Same text for the Chrome Web Store and Firefox Add-ons. Shorts Flow is not listed on Edge Add-ons, Opera Addons or Safari; Edge, Brave, Opera and Vivaldi users install the Chrome Web Store version (ADR 0004). Always say "for YouTube Shorts"; never say or imply that YouTube or Google made, endorses or supports Shorts Flow, and never use YouTube's logo, wordmark, red or the Shorts glyph (ADR 0002, brand rules in `docs/design/brand/README.md`). Call the ad feature Skip Sponsored Shorts, never "ad skip" or "ad block": it only moves past Sponsored Shorts in the feed. `tests/lifecycle/release.test.ts` checks this file.

## Name

Shorts Flow: Auto-Scroll for YouTube Shorts

## Summary (≤ 132 characters)

Watch YouTube Shorts hands-free: Shorts Flow moves to the next Short when the current one finishes. Not affiliated with YouTube.

## Description

Shorts Flow is an extension for YouTube's desktop Shorts feed. When a Short finishes, it moves on to the next one, so you can cook, work out or sit back without touching the mouse or the arrow keys.

- Auto-Scroll: goes to the next Short when the current one ends, at any playback speed. It stays on or off exactly as you left it.
- Waits for you: no moving on while the Short is paused, the comments or description are open, a menu is open, you're typing, or you've just scrolled yourself. The Short simply plays again.
- An Auto-Scroll button in the Shorts action rail, styled like YouTube's own buttons, with quick settings one click away.
- Skip Sponsored Shorts: moves straight past Sponsored Shorts in the feed. You can turn it off. Shorts Flow does not block ads: ads shown inside a Short or elsewhere on YouTube play as usual.
- Speed: play every Short at your preferred speed, from 0.5× to 3×, and keep it across reloads.
- Shortcuts: A for Auto-Scroll and S for Speed, both changeable in the toolbar popup.
- Shorts Watched: see how many Shorts you've watched this Session.
- Session Limit: optionally take a gentle break after a number of Shorts or minutes.
- Never reloads the page: if the next Short can't be found, a quiet notice offers to try again.

Privacy: Shorts Flow collects no data. No analytics, no tracking, no servers; nothing leaves your browser. It needs only the storage permission and access to youtube.com.

Works in Chrome, Edge, Brave, Opera, Vivaldi and Firefox on desktop.

Not affiliated with YouTube. Shorts Flow is an independent, open-source project and is not made, endorsed or supported by YouTube or Google.

Website and support: https://shortsflow.cptdawn.dev

## Category

Chrome Web Store: Entertainment. Firefox Add-ons: Photos, Music & Videos.

## Privacy and permissions

These must say the same as the Privacy page (https://shortsflow.cptdawn.dev/privacy) and ADR 0003. If either changes, change the other.

- **Single purpose** (Chrome Web Store, Privacy practices): "Moves YouTube's desktop Shorts feed to the next Short when the current one finishes, with controls for how and when it does."
- **Permission justifications:**
  - `storage`: keeps the viewer's settings (Auto-Scroll, Skip Sponsored Shorts, Speed, Shortcuts, Session Limit) and this Session's Shorts Watched count in the browser's local extension storage. Nothing is synced or sent anywhere.
  - Host access to `https://www.youtube.com/*`: runs Shorts Flow's content script on YouTube so it can tell when a Short ends, move to the next one and place its button in the Shorts action rail. It matches all of youtube.com because YouTube moves into and out of the Shorts feed without loading a new page; off the Shorts feed it does nothing.
- **Remote code: No.** Every script and font is bundled in the package.
- **Data usage** (Chrome Web Store): tick none of the data types; Shorts Flow collects no data. Certify all three disclosures: data is not sold to third parties, not used or transferred for purposes unrelated to the single purpose, and not used to determine creditworthiness or for lending.
- **Firefox Add-ons:** the manifest declares `data_collection_permissions.required: ["none"]`, so Firefox's install prompt says Shorts Flow collects no data. Answer "no data collected" in the listing.
- **Privacy policy URL** (both stores): https://shortsflow.cptdawn.dev/privacy
- **What the Privacy page and the listing both say:** no analytics, no error reporting, no servers of its own; settings and the Session stay in the browser; the Report and Goodbye pages only open a pre-filled GitHub issue or email (extension version and browser) and send nothing unless the viewer presses send.

## Uploads

- Chrome package: `shorts-flow-3.0.0-chrome.zip`
- Firefox package: `shorts-flow-3.0.0-firefox.zip`, plus the source bundle `shorts-flow-3.0.0-sources.zip` (build: `bun install && bun run build:firefox`)
- All three are attached to the GitHub Release for the tag by `.github/workflows/release.yml`; `bun run zip` makes them locally in `.output/`.
- Store art (see `docs/release/checklist.md`): five 1280×800 screenshots, the 440×280 small promo tile, the 1400×560 marquee, and the 128 icon (`public/icon/128.png`).
