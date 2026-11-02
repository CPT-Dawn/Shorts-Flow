# Shorts Feed test pages

Anonymised copies of youtube.com/shorts that the browser tests in `tests/browser/` run against, in Chromium and in Firefox. Each folder holds one test page:

- `page.html`: the page with YouTube's markup, interface text and styles as captured, but with no scripts and nothing anyone else made. Titles, descriptions, sound names and comments are lorem ipsum of the same length. Channels are `@channel1`, `@channel2`… Shorts are `vid00000001`, `vid00000002`… Avatars and thumbnails are grey squares. The Shorts video plays a clip from `clips/`.
- `test-page.json`: what the page shows, its own Shorts address (`path`), the window size it was captured in (`viewport`), and every Short slot from top to bottom with the clip it plays (`shorts`).

| Test page | What it shows |
|---|---|
| `shorts-dark` | The Shorts Feed in the dark theme, on the first Short (YouTube hides the up arrow), logged out. Base page for every engine test. |
| `shorts-light` | The same Shorts Feed in the light theme. No light capture of the page exists, so it is made from an edited copy of the dark capture: YouTube's dark flags removed (`dark` on `<html>` and the masthead, `is-dark`, `is-dark-theme`) and `light` set on `<html>`, the attribute YouTube's stylesheet keys its light colours to. For the Native Look in both themes. |
| `shorts-last` | The same capture with every Short slot after the first removed by hand (YouTube's feed never runs out live), so there is no next Short. For Stall. Tests that need a next Short skip it with `hasNextShort(page)`; the test support's `loadNextShort()` stands in for YouTube finally fetching one. |

## Using a test page

`tests/browser/support/test-pages.ts` picks up every folder here on its own:

- `testPages` lists them, so `describe.each(testPages)` runs a test against all of them.
- `openTestPage(page)` opens one in a frame the size of its capture window, at its own Shorts address.

A small Vite middleware in `vitest.config.ts` serves `tests/pages/<name>/page.html` for any address with `?test-page=<name>`, byte for byte. That is how a page opens at `/shorts/vid00000001` with no Vite client script injected. Clips are plain static files at `/tests/pages/clips/`.

The page has no scripts, so nothing on it moves by itself. A test plays the video (it keeps YouTube's `loop`, so it never fires `ended`), and any stand-in for YouTube's navigation belongs in the test support, not in the page.

## Making a test page

Raw captures show other people's videos, so they never enter the repo. They live in the gitignored `docs/reference/youtube-*/` folders on the maintainer's machine. See `docs/reference/youtube-shorts-2026-11/README.md` for how the 2026-11 capture was taken.

1. **Capture.** In a logged-out browser at 1440×900, set up the state the page is for (a panel open, a Sponsored Short, the last Short…). Save `document.documentElement.outerHTML`, with inline script bodies emptied, into a `docs/reference/youtube-*/` folder. Note `innerWidth` and `innerHeight`.
2. **Make the page:**

   ```sh
   bun run test-page docs/reference/youtube-shorts-2026-11/page-dark.html shorts-dark \
     --width 1440 --height 900 --description "What this page shows" --show-replaced
   ```

   The tool fetches the YouTube stylesheets the capture links to once, keeping them next to the capture in a gitignored `stylesheets/` folder so the next run works offline. It inlines only the rules for elements that are on the page. Fonts, scripts, icons and every other outside resource are dropped. The first run also makes the clips with `ffmpeg`.
3. **Skim.** `--show-replaced` prints every piece of the capture's text that became a placeholder, on your terminal only. If YouTube interface text is in that list (a label the engine might rely on), add it to `scripts/test-pages/youtube-text.ts` and run again. Improve the tool rather than editing a page by hand, so the next page benefits too.
4. **Commit** the new folder and run `bun run test`. Every test page has to pass the scan in `tests/browser/test-pages.test.ts`.

The tool won't write a page when something could slip through. That includes any of the capture's ids, handles or replaced text still showing up anywhere, in any HTML escaping, and anything `scripts/test-pages/leaks.ts` flags: an outside address, a script, a real photo, a `blob:` video, or an id, handle, channel or hashtag that isn't a placeholder. It also refuses when a browser would read the page into a different tree than the capture. Script can nest a button inside a button (YouTube's player does), but HTML can't say so, so the tool turns the inner one into a `span` with the same attributes. Teach `keepNestedControls()` about any new case it reports.

### Adding a variant (#8, #9, #10)

Each variant is its own capture of that state, made into a page with the same command under a new name. For example:

| Variant | Capture | Name |
|---|---|---|
| Comments panel open | Open the comments panel, then capture | `shorts-comments` |
| Description panel open | ⋮ › Description, then capture | `shorts-description` |
| Not the first Short (up arrow shown) | Press ArrowDown once, then capture | `shorts-second` |
| Sponsored Short | Advance until one shows up (see #9), then capture | `shorts-sponsored` |
| No next Short | Capture at the end of the loaded feed, or remove the later slots in the capture before making the page | `shorts-last` |

The base `shorts-dark` page is already on the first Short: YouTube sets `is-up-arrow-hidden` on `ytd-shorts` there.

If a variant can only be made by editing a capture (no live state shows it), make the edit on a copy of the capture, outside the repo, and record what you changed in the page's `description`. Then the page still comes out of the tool and its checks.

## What counts as third-party content

Anything someone other than YouTube made goes: creators' titles, names, handles, avatars, thumbnails, videos, descriptions and hashtags, sound and music names, commenters' text, and every id that points at them. YouTube's own interface stays as captured, because the engine and the Shorts Control are built against it: its markup and class names, its labels ("Next video", "Share", "View 1,985 comments"), its icons and its stylesheet rules. Counts and dates stay too. They belong to no one and keep labels the same length.

## Clips

`clips/clip-{a,b,c}.webm` are 2, 2.5 and 3 second `ffmpeg` test patterns (180×320 VP9 WebM, which both browsers play). `scripts/test-page.ts` makes them if they are missing and hands them out to the Shorts slots in turn.
