# Store listing: Shorts Flow 3.0.0

Same text for the Chrome Web Store and Firefox Add-ons. Shorts Flow is not listed on Edge Add-ons, Opera Addons or Safari; Edge, Brave, Opera and Vivaldi users install the Chrome Web Store version (ADR 0004). Always say "for YouTube Shorts"; never say or imply that YouTube or Google made, endorses or supports Shorts Flow, and never use YouTube's logo, wordmark, red or the Shorts glyph (ADR 0002, brand rules in `docs/design/brand/README.md`). Call the ad feature Skip Sponsored Shorts, never "ad skip" or "ad block": it only moves past Sponsored Shorts in the feed. It is off by default, and it is never the lead of the listing, the art or a nomination pitch. `tests/lifecycle/release.test.ts` checks this file.

## Name

Shorts Flow: Auto-Scroll for YouTube Shorts

## Summary (≤ 132 characters)

Watch YouTube Shorts hands-free: Shorts Flow moves to the next Short when the current one finishes. Not affiliated with YouTube.

## Description

Shorts Flow makes YouTube's desktop Shorts feed lean-back. When a Short ends, the next one starts on its own, so you can cook, stretch or simply sit back without reaching for the mouse or the arrow keys.

It is built to feel like it was always there. The Auto-Scroll button sits in the Shorts action rail, styled like YouTube's own buttons, and Shorts Flow steps aside the moment you step in.

What you get:

- Auto-Scroll: moves to the next Short the moment the current one ends, at any playback speed. It stays on or off exactly as you left it.
- Waits for you: never moves on while the Short is paused, the comments or description are open, a menu is open, you're typing, or you've just scrolled yourself. The Short simply plays again.
- Quick settings in the rail: speed and more, one click from the Auto-Scroll button.
- Speed: play every Short at your favourite speed, from 0.5× to 3×, remembered across reloads.
- Shortcuts: press A for Auto-Scroll and S for Speed. Pick other keys in the toolbar popup.
- Shorts watched and Session Limit: see how many Shorts you've watched this sitting, and if you like, get a gentle nudge to take a break after a number of Shorts or minutes.
- Skip Sponsored Shorts (optional, off until you turn it on): moves straight past Sponsored Shorts in the feed. Shorts Flow does not block ads: ads shown inside a Short or elsewhere on YouTube play as usual.
- Calm when things go wrong: if the next Short can't be found, a quiet notice offers to try again. Shorts Flow never reloads the page.

Private by design: Shorts Flow collects no data. No analytics, no tracking, no account, no servers; your settings never leave your browser. It needs only the storage permission and access to youtube.com, and its source code is open on GitHub.

Accessible: every control works with the keyboard and screen readers, follows your light or dark theme, and respects reduced motion.

Works in Chrome, Edge, Brave, Opera, Vivaldi and Firefox on desktop.

Not affiliated with YouTube. Shorts Flow is an independent, open-source project and is not made, endorsed or supported by YouTube or Google. YouTube™ is a trademark of Google LLC.

Website and support: https://shortsflow.cptdawn.dev

## Category

Chrome Web Store: Entertainment. Firefox Add-ons: Photos, Music & Videos (AMO allows two; no second one fits, so leave it at one).

## Firefox Add-ons extras

- **Summary** (AMO allows 250 characters; use the same one as the manifest so both stores match).
- **Tags:** youtube, shorts, auto scroll, autoplay, video, productivity, accessibility, privacy.
- **Platforms:** Firefox for desktop only (ADR 0004); leave Firefox for Android unticked.
- **Support site:** https://shortsflow.cptdawn.dev · **Support email:** the address the Report Page uses.
- **Privacy policy:** paste the full text of https://shortsflow.cptdawn.dev/privacy into the listing's privacy policy field as well as linking it; AMO shows it on the listing.
- **License:** MIT. **Source code:** https://github.com/CPT-Dawn/Shorts-Flow

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

## Store art

All in `docs/release/store-art/`, made by `bun run store-art` from the real extension on the anonymised test pages (see `scripts/store-art/README.md`). Upload in this order; the first screenshot carries the listing.

| Slot | File | Chrome Web Store | Firefox Add-ons |
|---|---|---|---|
| Screenshot 1 | `screenshot-1-auto-scroll.png` | ✓ | ✓ caption: "Auto-Scroll moves to the next Short when one ends, from a button in the Shorts rail." |
| Screenshot 2 | `screenshot-2-quick-settings.png` | ✓ | ✓ caption: "Quick settings one click from the Auto-Scroll button: Speed and the Preferred Speed." |
| Screenshot 3 | `screenshot-3-speed.png` | ✓ | ✓ caption: "Play every Short at your speed. Press S for Speed and A for Auto-Scroll." |
| Screenshot 4 | `screenshot-4-session-limit.png` | ✓ | ✓ caption: "Set a Session Limit and get a gentle nudge to take a break." |
| Screenshot 5 | `screenshot-5-privacy.png` | ✓ | ✓ caption: "Every setting in one popup, light or dark. No data collected." |
| Small promo tile 440×280 | `promo-small-440x280.png` | ✓ | – |
| Marquee 1400×560 | `promo-marquee-1400x560.png` | ✓ | – |
| Store icon 128×128 | `public/icon/128.png` | ✓ | ✓ (AMO takes the manifest icon) |
| Promo video | `promo-video.mp4`, uploaded to YouTube as unlisted or public | ✓ paste the YouTube URL | – |

## Uploads

- Chrome package: `shorts-flow-3.0.0-chrome.zip`
- Firefox package: `shorts-flow-3.0.0-firefox.zip`, plus the source bundle `shorts-flow-3.0.0-sources.zip` (build instructions in its `SOURCE-BUILD.md`: `bun install --frozen-lockfile && bun run build:firefox`)
- All three are attached to the GitHub Release for the tag by `.github/workflows/release.yml`; `bun run zip` makes them locally in `.output/`.
- Store art: see "Store art" above.
