# Sponsored Short markup (2026-11): UNCONFIRMED

**Status: no live Sponsored Short was captured.** Skip Sponsored Shorts is built on the best
evidence available, listed below. The release checklist's live check on youtube.com is the
first real test of it. Whoever meets a real Sponsored Short first: capture it (see
[How to capture one](#how-to-capture-one)), compare it with the facts below, and fix
`isSponsoredShort()` and `SPONSORED_SHORT_MARK` in `src/engine/youtube.ts` if they differ.

## What was tried (2026-11-02)

- Playwright Chromium 156, logged out, no cookies, 1440x900, dark, UA Chrome 141, the same
  setup as [`../youtube-shorts-2026-11/`](../youtube-shorts-2026-11/README.md).
- Six sessions, about 260 Advances in total (ArrowDown, about 6 s on each Short):
  - `chromium-headless-shell`, `?gl=US&hl=en` + `Accept-Language: en-US` (45 Advances)
  - the same with GB/en-GB (45), DE/de-DE (45) and IN/en-IN (45)
  - full Chromium in new headless mode, US/en-US (40) and IN/en-IN (40)
- The connection itself was always in India. `gl`, `hl` and `Accept-Language` change the
  content region and language, not where the ads are sold from. No consent page appeared.
- On each Short the script looked for ad tags in `ytd-shorts` (`*-ad-*`, `ad-*`, `*sponsor*`),
  "Sponsored"-like text in the renderer, and ad keys (`adClientParams`, `isAd`,
  `adSlotRenderer`, `adLayout*`, …) in every `youtubei/v1/reel/*` response, which it could read
  (checked: it saw each `reel_watch_sequence` and `reel_item_watch` response).
- **Result: no Sponsored Short, and no ad key in any reel response.** YouTube may not show
  Shorts ads to a logged-out headless browser, or not from this region.

## Best evidence (not seen live)

Public ad filter lists, read on 2026-11-02, are the strongest outside source. They are
maintained against the live site, but they do not say when YouTube last served this markup.

| Source | Rule | What it says |
|---|---|---|
| EasyList, `easylist_specific_hide.txt` | `youtube.com###shorts-inner-container > .ytd-shorts:has(> .ytd-reel-video-renderer > ytd-ad-slot-renderer)` | A Sponsored Short is a Shorts slot (a child of `#shorts-inner-container` with class `ytd-shorts`, which is what `.reel-video-in-sequence-new` slots have in the 2026-11 capture) whose child with class `ytd-reel-video-renderer` holds a `ytd-ad-slot-renderer` |
| uBlock Origin `filters.txt`, `quick-fixes.txt`; AdGuard Base | `json-prune … entries.[-].command.reelWatchEndpoint.adClientParams.isAd` on `reel_watch_sequence` | In the feed's data, a Sponsored Short is an entry of `reel_watch_sequence` whose `command.reelWatchEndpoint.adClientParams.isAd` is set. So it is a slot of its own in the feed, between ordinary Shorts |

Fit with the 2026-11 capture: YouTube's one `ytd-reel-video-renderer` has a
`div#experiment-overlay.overlay.style-scope.ytd-reel-video-renderer` that holds the overlay
(`ytd-reel-player-overlay-renderer-cow`). In the older layout every slot was a
`ytd-reel-video-renderer`, so EasyList's `> .ytd-reel-video-renderer > ytd-ad-slot-renderer`
most likely means an ad slot renderer in place of the overlay. In today's layout that is
either inside the one renderer once it moves into the ad's slot, or in markup the ad's slot
brings of its own. We don't know which.

## What Shorts Flow does with it

- `SPONSORED_SHORT_MARK = 'ytd-ad-slot-renderer'`.
- `isSponsoredShort()` looks in the slot holding the renderer **and** the slot in the middle
  of the Shorts Feed on screen, so either placement is caught.
- It never reads text ("Sponsored" is localised) and never reads YouTube's data (the content
  script cannot see it, and ADR 0003 rules out anything sneakier).
- `watchFeedPosition()` re-checks at most once per animation frame after anything inside
  `ytd-shorts` is added or moved, or `#shorts-container` scrolls, and when the setting changes.
  It measures the slot on screen only after a scroll or a change of slot.
- Skipping is one `feed.advance()`: YouTube's own Next video control, as Auto-Scroll does. It
  never hides or removes the ad's markup.
- Only on the way down the feed (the slot index grew). A Sponsored Short the viewer goes back
  up onto is left alone, so the Short before it stays in reach.
- Advance tells Shorts apart by `FeedPosition` (address, slot holding the renderer, slot on
  screen), not the address alone, so an ad that keeps the previous Short's address neither
  swallows the skip nor shows a false Stall.

Unknowns the live check must answer: whether the address changes to `/shorts/<id>` for an ad
(Advance's Stall check compares Short ids), whether the ad slot has its own `<video>`, and
whether `ytd-ad-slot-renderer` is still the element name.

## Test page

`tests/pages/shorts-sponsored` is the 2026-11 dark capture with this added by hand to slot
`#5` (Short 6), after its thumbnail, the shape EasyList describes:

```html
<div class="overlay style-scope ytd-reel-video-renderer"><ytd-ad-slot-renderer class="style-scope ytd-reel-video-renderer"></ytd-ad-slot-renderer></div>
```

The test-page tool marks a slot holding `SPONSORED_SHORT_MARK` with `"sponsored": true` in
`test-page.json`. The Sponsored Short is the sixth so that tests on every page, which reach
Short 3 or 4 at most, never meet it by surprise.

## How to capture one

Logged out, at 1440x900, Advance until a Short shows a "Sponsored" badge. Save
`document.documentElement.outerHTML` (inline script bodies emptied) and a screenshot here
(both gitignored), plus the `reel_watch_sequence` response that brought it. Note the address,
`innerWidth` and `innerHeight`. Then rebuild the test page from the real capture:

```sh
bun run test-page docs/reference/youtube-shorts-sponsored-2026-11/<capture>.html shorts-sponsored \
  --width 1440 --height 900 --description "..."
```

## Local only

`page-sponsored-edited.html` here is the edited capture the test page came from. It shows
other creators' videos, so it is gitignored like every capture.
