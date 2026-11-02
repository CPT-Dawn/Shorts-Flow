# Desktop Shorts: action rail, player and panels (2026-11-02)

Captured logged out, region IN, `en-US`, Chromium 156.0.8078.4 headless, viewport 1440x900.
Values are `getComputedStyle` results unless marked otherwise. Class names below are the
current build's. YouTube renames them often, so match on tag names and aria roles first.

## Where things live

```
ytd-app > #content > ytd-page-manager > ytd-shorts[is-dark?][is-up-arrow-hidden?][is-watch-while-mode?]
  #shorts-container > #shorts-inner-container
    div.reel-video-in-sequence-new#0 … #N        <- one slot per Short (9 at first, 26 after paging)
      div.reel-video-in-sequence-thumbnail       <- frame0.jpg background placeholder
      div#reel-overlay-container                 <- ONLY in the active slot
        ytd-reel-video-renderer#reel-video-renderer   <- exactly ONE in the document
          div#short-video-container > div.player-wrapper > div#player-container
            ytd-player#player > div#container > div#shorts-player.html5-video-player
              div.html5-video-container > video.video-stream.html5-main-video[loop]
          div#experiment-overlay.overlay
            ytd-reel-player-overlay-renderer-cow
              yt-reel-player-overlay-view-model
                div.ytReelPlayerOverlayViewModelActionsContainer
                  reel-action-bar-view-model          <- THE RAIL
  #navigation-button-up   > ytd-button-renderer > yt-button-shape > button[aria-label="Previous video"]
  #navigation-button-down > ytd-button-renderer > yt-button-shape > button[aria-label="Next video"]
  ytd-engagement-panel-section-list-renderer[target-id=…]  (comments / description / audio pivot)
```

### Active reel

- `ytd-reel-video-renderer[is-active]` **no longer exists**. The document holds a single
  `ytd-reel-video-renderer`. YouTube moves it, with its player and `<video>`, into whichever
  `.reel-video-in-sequence-new` slot is current. Slot ids are plain numbers (`#0`, `#1`, …).
- Active reel: `ytd-shorts ytd-reel-video-renderer` (or `.reel-video-in-sequence-new:has(ytd-reel-video-renderer)`).
- Current video id: `location.pathname` (`/shorts/<id>`). The URL updates on every advance.
- Across ArrowDown/ArrowUp the renderer and the `<video>` element stay the same objects.
  **`reel-action-bar-view-model` is recreated on every Short**: a child injected into it was gone
  after a single ArrowDown. An injected button has to be re-added, e.g. from a MutationObserver.

### `<video>`

- Selector: `#shorts-player video.html5-main-video` (`ytd-shorts video` also works). A second
  `<video>` exists in `#movie_player` (the hidden regular watch player: `src=""`, paused, no
  `loop`). Do not use a bare `document.querySelector("video")` without scoping it.
- `loop` is **true** on the Shorts video, in Chromium and Firefox.
- End behaviour: I seeked to `duration - 1.5 s` and watched for 5 s. Events seen:
  `seeking/seeked/playing @ t≈d-1.5`, then `seeking@0 → seeked@0 → playing@0`.
  **`ended` never fired.** The video loops natively and YouTube does **not** auto-advance
  (URL unchanged).
- `playbackRate` is a property of that persistent element (see speed below).

### Up/down navigation

- `#navigation-button-up` and `#navigation-button-down`: `div` > `ytd-button-renderer` >
  `yt-button-shape` > `button.ytSpecButtonShapeNextTonal.ytSpecButtonShapeNextMono.ytSpecButtonShapeNextSizeXl.ytSpecButtonShapeNextIconButton`,
  56x56, at x=1360 (up y=422, down y=494).
- On the first Short, `ytd-shorts[is-up-arrow-hidden]` is set and only the down arrow shows.
- Keyboard ArrowDown/ArrowUp on the page also advances. I used it for 16 Shorts and it worked
  every time.

## The rail: `reel-action-bar-view-model`

Host classes: `ytwReelActionBarViewModelHost ytwReelActionBarViewModelHostDesktop`.
`display:flex; flex-direction:column; align-items:center; gap:normal (none); padding:0; width:48px`.
At 1440x900 with the guide open: x≈1026, y=508, 48x360. The rail sits to the right of the
player, outside the video, bottom-aligned with it.

Children, in order (every one has class `ytwReelActionBarViewModelHostDesktopActionButton`):

| # | Host element | Inner control | aria-label (examples) | Label text |
|---|---|---|---|---|
| 1 | `like-button-view-model.ytLikeButtonViewModelHost` > `toggle-button-view-model` > `button-view-model` | `label.ytSpecButtonShapeWithLabelHost > button[aria-pressed]` | `Like this video`, or `like this video along with 238 thousand other people` | count (`238K`), or `Like` when the count is hidden |
| 2 | `button-view-model.ytSpecButtonViewModelHost` | `label > button` | `View 1,985 comments` | count |
| 3 | `button-view-model` | `label > button` | `Share` | `Share` |
| 4 | `button-view-model` | `label > button[disabled]` (`ytSpecButtonShapeNextDisabled`, logged out) | `Remix` | `Remix` |
| 5 | `pivot-button-view-model.ytwPivotButtonViewModelHost` | `a[role=button] > img` (sound/creator thumbnail) | `See more videos using this sound` | none |

There is **no dislike button** and **no "..." in the rail**. The overflow menu lives in the
player's top control bar (below). Like is a **heart** outline icon (`aria-pressed` toggle).

Inner structure of a labelled button (2–4; Like adds the two wrappers):

```
button-view-model.ytSpecButtonViewModelHost.ytwReelActionBarViewModelHostDesktopActionButton
  label.ytSpecButtonShapeWithLabelHost
    button.ytSpecButtonShapeNextHost.ytSpecButtonShapeNextTonal.ytSpecButtonShapeNextMono
          .ytSpecButtonShapeNextSizeL.ytSpecButtonShapeNextIconButton
          .ytSpecButtonShapeNextEnableBackdropFilterExperiment
          .ytSpecButtonShapeNextMainstageIconSize.ytSpecButtonShapeNextMainstagePadding
          [aria-label][title=""]
      div.ytSpecButtonShapeNextIcon.ytSpecButtonShapeNextElevatedContent
        span.ytIconWrapperHost > span.yt-icon-shape.ytSpecIconShapeHost > div > svg   (Like: yt-icon)
      yt-touch-feedback-shape.ytSpecTouchFeedbackShapeHost.ytSpecTouchFeedbackShapeTouchResponse
        div.ytSpecTouchFeedbackShapeStroke
        div.ytSpecTouchFeedbackShapeFill
      yt-light-shape.contribYtLightShapeHost.contribYtLightShapeStaticRimLightTonal …
        div.contribYtLightShapeStaticWashLight.contribYtLightShapeStaticWashLightTonal
    div.ytSpecButtonShapeWithLabelLabel
      span.ytAttributedStringHost.ytAttributedStringWhiteSpacePreWrap …[role=text]  "Share"
```

### Metrics

| Property | Value |
|---|---|
| Item host box | 48 x 78 (`padding: 0 0 8px`; display `flex`, Like host `block`) |
| Item pitch | 78px (48 button + 4 label margin + 18 label + 8 padding-bottom) |
| Button | 48x48, `border-radius: 24px`, `padding: 0 20px`, `border: 0` |
| Icon (svg) | 24x24, centred (12px inset) |
| Label | Roboto, Arial, sans-serif · 12px · weight 400 · line-height 18px · `margin-top: 4px` · letter-spacing normal |
| Sound pivot | `a` 40x40 image, host 40x48 |
| Rail gap | none. Spacing comes from the host's 8px bottom padding |

### Colours

| | Dark (`html[dark]`) | Light |
|---|---|---|
| Page background (`html`) | `rgb(15,15,15)` #0f0f0f | `rgb(255,255,255)` |
| Button background (idle) | `rgba(255,255,255,0.1)` | `rgba(0,0,0,0.05)` |
| Button background (hover) | `rgba(255,255,255,0.2)` | `rgba(0,0,0,0.1)` |
| Icon / text colour | `rgb(241,241,241)` #f1f1f1 | `rgb(15,15,15)` #0f0f0f |
| Disabled icon (Remix) | `rgb(113,113,113)` | `rgb(144,144,144)` |
| Label colour | #f1f1f1 | #0f0f0f |
| Touch-feedback fill | `#fff`, opacity 0 at rest/hover (flashes on press) | `#000` |

Hover also shows a tooltip under the button (see `rail-*-hover-share.png`).
`backdrop-filter` is enabled via `…EnableBackdropFilterExperiment`.

### Theme custom properties: `--yt-spec-*` are gone

On `html`, `ytd-app`, `ytd-shorts` and the rail, every legacy `--yt-spec-*` token I probed
(`base-background`, `text-primary`, `text-secondary`, `badge-chip-background`,
`10-percent-layer`, `touch-response`, `static-overlay-*`, `brand-*`, …) resolves to **empty**.
Colours now come from **hashed tokens** declared on `html`, for example:

| Token (build-specific hash) | Dark | Light | Used for |
|---|---|---|---|
| `--t7f4f2c6d54836ce0` | `rgba(255,255,255,0.1)` | `rgba(0,0,0,0.05)` | Mono+Tonal button background (≈ old 10-percent-layer / badge-chip) |
| `--t416e5931fc464589` | `rgba(255,255,255,0.2)` | `rgba(0,0,0,0.1)` | Mono+Tonal `:active` |
| `--tf3fc855af2285f5f` | `rgba(255,255,255,0.2)` | `rgba(0,0,0,0.2)` | Tonal/Outline border |
| `--tffc2fd3a644f6275` / `--t1405e70a39276293` | `#f1f1f1` | `#0f0f0f` | text primary |
| `--t4a6da19e16bf221a` | `#aaa` | `#606060` | text secondary |
| `--t3e41d7b17b187f69` | `#0f0f0f` | `#fff` | base background |
| `--t08a7c6c176cbc5c2` | `#282828` | `#fff` | raised/menu background |
| `--t2d807bb79e75606d` | `#3ea6ff` | `#065fd4` | call-to-action blue |

The remaining named families are `--yt-sys-measurement--*` (icon sizes 12–48px) and
`--yt-sys-typography-typestack--*`, plus `--yt-deprecated-*` brand reds. **Don't depend on the
hashes.** Hard-code the observed values per theme, or reuse YouTube's own classes
(`ytSpecButtonShapeNextTonal ytSpecButtonShapeNextMono …`), which pick up the right tokens
automatically. Raw dumps are in the scratchpad (`vars2.json`).

`html` attributes, dark: `lang darker-dark-theme darker-dark-theme-deprecate dark system-icons color-version=v2_0 typography typography-spacing`.
Light is the same without `dark`. `ytd-shorts[is-dark]` is also present in dark. YouTube followed
`prefers-color-scheme` in Chromium. Headless Firefox rendered light even with `colorScheme: dark`.

## Overflow menu ("More actions")

Not in the rail. It sits in the player's top control bar, which shows on hover:
`Pause (k)`, `Mute (m)` (left), then `Subtitles/CC`, **`More actions`** (⋮), `Enter Full Screen (f)` (right).
All are 48x48. The ⋮ is `button-view-model > button[aria-label="More actions"]`.

Opens as: `ytd-app > ytd-popup-container > tp-yt-iron-dropdown > #contentWrapper > yt-sheet-view-model.ytSheetViewModelContextual > yt-contextual-sheet-layout > div > yt-list-view-model`.

Items (`yt-list-item-view-model.ytListItemViewModelHost` unless noted):

1. Description
2. Save to playlist
3. Ambient mode (`switch-list-item-view-model`, toggle)
4. Captions › current track (e.g. "Off", "Hindi (auto-generated)")
5. Full screen
6. **Playback speed › Normal**
7. Report
8. Send feedback

No "Clear screen" item, and no 2x long-press affordance was visible.

### Playback speed

- The submenu is a panel showing the current value ("1x"), a slider with −/+ buttons and
  chips **0.25 · 1.0 (Normal) · 1.25 · 1.5 · 2.0** (`overflow-menu-playback-speed-dark.png`).
- Choosing 1.5 set `video.playbackRate = 1.5`.
- **Next Short (ArrowDown): still 1.5.** The same `<video>` element is reused and the rate carries over.
- **After a reload: back to 1.0**, and the menu shows "Normal".
- localStorage gets `…::yt-maw-player::recent-custom-speed = {"data":"150"}`. That only
  remembers the last custom choice. It does not restore it on load.
- Verdict: session-scoped speed, **not a lasting setting** for logged-out desktop Shorts.

## Panels (comments / description)

- Comments: click the rail's `View N comments` button. Description: ⋮ › Description.
- Both are `ytd-engagement-panel-section-list-renderer[shorts-panel][is-watch-while-panel]`
  with `target-id=engagement-panel-comments-section` / `engagement-panel-structured-description`
  (and `engagement-panel-shorts-audio-pivot` for the sound pivot).
- Open state: the panel's `visibility` attribute goes from `ENGAGEMENT_PANEL_VISIBILITY_HIDDEN`
  to `ENGAGEMENT_PANEL_VISIBILITY_EXPANDED`, **and** both `ytd-shorts` and
  `ytd-reel-video-renderer` gain `is-watch-while-mode`. Closing removes both.
- The panel opens on the right (480px, `--anchored-panel-width`). The player and rail slide left
  (the rail moved from x≈1026 to x≈766).
- Close via the panel's ✕ (`#visibility-button button`). Escape then ✕ closed comments. The description panel stayed open (`is-watch-while-mode` persisted) through the following 16 advances, so panels survive navigation.
- Comments inside the panel still show thumbs-up/thumbs-down for comment likes. Only the video rail dropped dislike.

## Sponsored Shorts

None appeared in 16 ArrowDown advances (logged out, IN). I couldn't confirm their DOM.
`ytd-shorts[move-ads-overlay-to-shorts]` is set, which suggests ads render in the same slot structure.
