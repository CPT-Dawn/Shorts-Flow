# YouTube desktop Shorts reference capture (2026-11)

- **Date:** 2026-11-02
- **Browser:** Playwright Chromium 156.0.8078.4 (headless, UA spoofed as Chrome 141 on Linux,
  `--disable-blink-features=AutomationControlled`), viewport 1440x900, locale `en-US`.
  Cross-checked rail and `loop` in Playwright Firefox 157.0. Both matched.
- **Session:** logged out, no cookies, served region **IN** (no EU consent page appeared).
  No bot check either.
- **How:** Playwright scripts (kept outside the repo) opened `https://www.youtube.com/shorts`,
  waited about 6 s, then read computed styles, opened menus and panels, and pressed ArrowDown.
  Theme came from the `colorScheme` context option. Chromium honoured it (`html[dark]` toggles).
  Headless Firefox stayed light.

Full DOM and style detail is in [`rail.md`](rail.md).

## Files

| File | What |
|---|---|
| `shorts-feed-dark.png` | Full viewport, dark theme, mouse off the player |
| `shorts-feed-light.png` | Full viewport, light theme |
| `shorts-feed-firefox-light.png` | Firefox 157 for comparison (rendered light) |
| `rail-dark.png`, `rail-light.png` | Close-up crop of the action rail |
| `rail-dark-hover-share.png`, `rail-light-hover-share.png` | Rail with Share hovered (hover background + tooltip) |
| `overflow-menu-dark.png` | Player ⋮ "More actions" menu opened |
| `overflow-menu-playback-speed-dark.png` | Playback speed sub-panel (slider + 0.25–2.0 chips) |
| `comments-panel-dark.png` | Comments engagement panel open |
| `description-panel-dark.png` | Description panel open (from ⋮ › Description) |
| `page-dark.html` | `document.documentElement.outerHTML` after the feed settled. Inline `<script>` bodies emptied (external `src` scripts kept). 403 KB, down from 1.48 MB raw |
| `rail.md` | Rail, player, menu, speed and panel structure with computed styles |

No sponsored Short showed up in 16 advances, so there's no sponsored screenshot.

## Surprises

- **`--yt-spec-*` theme variables are gone.** All of them resolve empty. Colours now come from
  hashed per-build tokens (`--t7f4f2c6d54836ce0` …). Hard-code values or reuse YouTube's button classes.
- **`ytd-reel-video-renderer[is-active]` is gone.** The page has a single renderer that YouTube moves
  between numbered `.reel-video-in-sequence-new` slots.
- **The rail is re-rendered on every Short.** An injected node disappears after one ArrowDown.
- **The overflow ⋮ is not in the rail.** It sits in the player's top-right control bar.
- **Remix is disabled when logged out**, but it still takes a rail slot.
- A second, hidden `<video>` (`#movie_player`, the watch-page player) is in the DOM.

## Findings

**(a) What the rail holds today, top to bottom:** Like (heart, `like-button-view-model`, label is
the count or "Like") → Comments (`View N comments`, count) → Share → Remix (disabled when
logged out) → sound/creator pivot thumbnail (`See more videos using this sound`). There's no
dislike and no ⋮. Each item is a 48px round tonal button with a 24px icon and a 12px/400
Roboto label under it. Items repeat every 78px.

**(b) Lasting speed setting on desktop Shorts?** No. ⋮ › Playback speed has a slider and chips
from 0.25x to 2.0x. A chosen speed carries over to the next Shorts in the same page session,
because the same `<video>` is reused, but resets to 1x on reload. localStorage keeps
`recent-custom-speed` only as a hint, not as the active rate.

**(c) Does dislike still exist on desktop?** Not on the rail. It is retired for the video.
Thumbs-down survives only on individual comments.

**(d) Is Like a heart on desktop?** Yes: a heart outline, `aria-pressed` toggle,
`aria-label` "Like this video" or "like this video along with N thousand other people".

**(e) Best injection anchor:** `ytd-shorts reel-action-bar-view-model`. Append a clone-styled
`button-view-model.ytwReelActionBarViewModelHostDesktopActionButton` (label > button with
`ytSpecButtonShapeNextHost ytSpecButtonShapeNextTonal ytSpecButtonShapeNextMono ytSpecButtonShapeNextSizeL ytSpecButtonShapeNextIconButton`
plus `.ytSpecButtonShapeWithLabelLabel`). Insert it before `pivot-button-view-model`, or after
Share, so the thumbnail stays last. A MutationObserver on `ytd-shorts` (subtree, childList) is
required, because the rail element is replaced on every Short. Re-inject when
`reel-action-bar-view-model` lacks the button. Fallback anchor if the rail tag changes:
`.ytReelPlayerOverlayViewModelActionsContainer`.

**(f) Recommended end-of-Short detection:** don't wait for `ended`. The Shorts `<video>` has
`loop=true` and `ended` never fired. It just seeks to 0 and YouTube does not auto-advance. Two options:
1. Watch `timeupdate` on `#shorts-player video.html5-main-video` and trigger when
   `currentTime >= duration - ~0.25 s` (scaled by `playbackRate`), or when `currentTime` wraps
   from near `duration` back to under 1 s (a `seeking` event at about 0 right after near-end time
   is a clean wrap signal).
2. Or set `video.loop = false` on each new Short and listen for `ended`. That's riskier, since
   YouTube may re-assert `loop`.

Advance by clicking `#navigation-button-down button` or dispatching ArrowDown. Both worked.
Re-bind on URL change (`/shorts/<id>`). The `<video>` element itself persists, so a single
listener with a URL/`duration` guard is enough.
