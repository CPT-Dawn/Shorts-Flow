# Release checklist

Shorts Flow ships only when the release gate is met. Copy this checklist into the release issue and tick it there; note per-browser results as a table (browser × step, pass/fail, notes). Words follow `GLOSSARY.md`.

## Release gate

All three, no exceptions:

1. [ ] **Tests green.** CI is green on the commit being released (typecheck, both Vitest projects in Chromium and Firefox, both builds, `web-ext lint`).
2. [ ] **Seven days of daily use.** The maintainer has used the release build daily for seven consecutive days on Chrome, Firefox and at least two of Edge, Brave and Opera, with no Advance failures. Log any Stall, missed Advance or misplaced Shorts Control on the release issue; one resets the count once fixed.
3. [ ] **This checklist is fully ticked.**

## Build

4. [ ] `bun install && bun run typecheck && bun run test`: all green locally too.
5. [ ] `package.json` `version` is the version being released; `bun run zip` puts `shorts-flow-<version>-chrome.zip`, `shorts-flow-<version>-firefox.zip` and `shorts-flow-<version>-sources.zip` in `.output/`.
6. [ ] `bun run build:firefox && bun run lint:firefox`: no errors and no new warnings. **Known warning:** `KEY_FIREFOX_ANDROID_UNSUPPORTED_BY_MIN_VERSION`. `strict_min_version` is 140 (the first desktop Firefox that knows `data_collection_permissions`), but Firefox for Android only supports that key from 142. Shorts Flow is desktop only (ADR 0004), so the warning is harmless today. **Decide at release** whether to bump `strict_min_version` to 142 in `wxt.config.ts` (and its manifest test) to clear it, at the cost of Firefox 140–141 desktop users (140 is an ESR, so that cost may be real). Record the decision on the release issue.
7. [ ] Unzip the sources zip in an empty folder, run `bun install && bun run build:firefox`, and check that the output matches `.output/firefox-mv3` (Firefox Add-ons reviewers do exactly this).

## Install

Load the built package: `.output/chrome-mv3` unpacked in Chrome, Edge, Brave and Opera; the Firefox zip through `about:debugging` → Load Temporary Add-on.

8. [ ] The toolbar and the extensions page show the Tideline icon (never a YouTube glyph) and the name "Shorts Flow". Firefox's toolbar icon suits both light and dark toolbars.
9. [ ] Firefox's install prompt says Shorts Flow collects no data.
10. [ ] A fresh install opens the Welcome Page once. An upgrade from the 2.x store version opens it once at its v3 section and leaves no 2.x keys (`applicationIsOn`, `scrollOnComments`, `showOnScreenButton`) in storage. A later 3.x update opens nothing; the Popup's What's new shows a dot until opened.
11. [ ] Uninstall opens the Goodbye Page with the version.

## Re-verify against live YouTube

YouTube changes desktop Shorts often (a redesign rolled out from 2026-06-25), and the adapter was built from the 2026-11 capture in `docs/reference/youtube-shorts-2026-11`. During the seven-day gate, on real youtube.com/shorts, logged in and logged out, in light and dark themes, in Chrome and Firefox:

12. [ ] Auto-Scroll on: a Short that finishes Advances at its true end, at 1× and at the Preferred Speed, including from the very first Short of the feed. The feed, URL and history behave as with YouTube's own down arrow.
13. [ ] Holds: no Advance while the Short is paused, the comments or description panel is open, a menu or share dialog (or the Shorts Control menu) is open, the viewer is typing, or just after a manual scroll. The Short plays again, and Advancing resumes once the Hold ends.
14. [ ] A background tab's Short still Advances.
15. [ ] **Skip Sponsored Shorts against a live Sponsored Short.** The capture never saw one, so this is the first real test of its detection. Find one (logged out, a few dozen Shorts in), confirm it is skipped with the setting on and plays with it off, with Auto-Scroll on and off. Note the markup on the release issue and update the reference notes if it differs.
16. [ ] Stall: when no next Short can be found (end of feed or offline), the quiet notice appears with a retry; the page never reloads or jumps. The notice clears after a later Advance or a manual scroll.
17. [ ] The Shorts Control sits just before the sound thumbnail on every Short, survives the rail rebuild on each Advance, matches YouTube's buttons in both themes (size, tonal background, hover, tooltip) and reflects Auto-Scroll. Its menu changes Skip Sponsored Shorts, Speed and the Preferred Speed. Hiding it from the Popup removes it.
18. [ ] Speed applies to every Short and survives a reload; YouTube's own speed menu wins for the current Short only.
19. [ ] Shortcuts A and S work on the Shorts Feed, do nothing while typing in search or a comment, and show a YouTube-style confirmation. Rebinding in the Popup takes effect without a reload. YouTube's up and down keys still move one Short per press.
20. [ ] Shorts Watched counts Shorts reached by Advance and by hand. A Session Limit of 2 Shorts shows the Break Nudge after 2; dismissing it resumes playback.
21. [ ] Away from the Shorts Feed (Home, Search, a watch page, a channel's Shorts tab), Shorts Flow does nothing, and it starts again on returning to /shorts without a page load.
22. [ ] Keyboard and screen reader: the Shorts Control is focusable, labelled and announces its pressed state.
23. [ ] If anything in the adapter had to change, refresh the notes in `docs/reference/youtube-shorts-2026-11` (or add a new dated capture).

## Popup and website

24. [ ] The Popup holds every setting, follows the system theme, is fully keyboard-operable with visible focus, and makes no network requests (check the Popup's devtools Network tab).
25. [ ] What's new, Report a problem and Support open the right pages on shortsflow.cptdawn.dev; Report carries the version and browser. The extensions page offers no Options entry.
26. [ ] The Welcome, Report, Goodbye, Support and Privacy pages are live, and the footer says "Not affiliated with YouTube".

## Store listing and disclosures

27. [ ] Listing text matches `docs/release/store-listing.md` on both stores: the title "Shorts Flow: Auto-Scroll for YouTube Shorts", the description naming Skip Sponsored Shorts and saying it does not block ads, and the "Not affiliated with YouTube" line.
28. [ ] The live Privacy page (https://shortsflow.cptdawn.dev/privacy) says what the listing's "Privacy and permissions" section says, point for point. If either changed, update the other first.
29. [ ] Chrome Web Store Privacy practices: the single-purpose statement, the `storage` and youtube.com justifications, remote code "No", no data types ticked, all three certifications, privacy policy URL.
30. [ ] Firefox Add-ons: "no data collected", the privacy policy URL, the source bundle uploaded with its build instructions.

## Store art

Made to the brand's store-art rules in `docs/design/brand/README.md`: Tideline brand only, no text on promo images, no YouTube logo, wordmark, play triangle or red in promo art. Screenshots of the real extension on YouTube are fine.

31. [ ] Five 1280×800 screenshots from the finished build: the Shorts Control in the rail (dark), its quick-settings menu, the Popup (light and dark), the Break Nudge, and the Welcome Page or Firefox. No real creators' faces or names that could be read as endorsement; prefer Shorts you can show.
32. [ ] Small promo tile 440×280: the mark on the night gradient.
33. [ ] Marquee 1400×560: the mark beside three abstract Short frames, the middle one lifted.
34. [ ] Store icon 128×128: `public/icon/128.png`, the Tideline tile.

## Publish

Store uploads are manual. The tag workflow only builds and attaches the zips; it never publishes to a store.

35. [ ] Merge `v3` into `main` by PR (ADR 0001), then push a signed `v<version>` tag from `main`. `.github/workflows/release.yml` re-runs the gate and creates the GitHub Release with the three zips. Check the release has all three.
36. [ ] Upload the Chrome zip from the release to the Chrome Web Store, and the Firefox zip plus the sources zip to Firefox Add-ons, on the existing listings. Fill in the listing and disclosures from `docs/release/store-listing.md`.
37. [ ] After approval, install from each store on a clean profile and repeat steps 8–12.

## Featured nomination (Chrome Web Store)

Once v3.0 is live on the Chrome Web Store. There is no published rubric, so stack the levers we control: minimal permissions, an accurate privacy disclosure, complete store art, accessibility, and no policy strikes.

38. [ ] Confirm the listing is complete: every image slot filled, the privacy policy linked, the single purpose and justifications filled, the support site set to https://shortsflow.cptdawn.dev, and no open policy warnings in the Developer Dashboard.
39. [ ] Open the Chrome Web Store developer support form (One Stop Support, from the Developer Dashboard's help menu) and choose the Featured badge nomination option. Give the extension ID, the listing URL, and a short case: one purpose, `storage` only, no data collected, native-looking accessible controls, open source.
40. [ ] Note the date on the release issue. If declined, record the reason and what to change; renominate after the next release that addresses it.
