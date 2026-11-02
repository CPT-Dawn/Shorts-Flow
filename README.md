# Shorts Flow

Watch YouTube Shorts hands-free: Shorts Flow moves to the next Short when the current one finishes. A browser extension for Chrome (and every Chromium browser) and Firefox. Not affiliated with YouTube.

This is the v3 rewrite (see `docs/adr/`). Domain words are in `GLOSSARY.md`.

## Development

Needs [Bun](https://bun.sh) and Node.js (WXT, Vitest and web-ext run on Node).

```sh
bun install
bunx playwright install chromium firefox   # once, for the browser tests
```

| Script | What it does |
|---|---|
| `bun run dev` / `bun run dev:firefox` | Development build with live reload in Chrome / Firefox |
| `bun run build` | Chrome and Firefox builds in `.output/chrome-mv3` and `.output/firefox-mv3` (`build:chrome`, `build:firefox` for one) |
| `bun run zip` | Store zips for both, plus the Firefox source bundle, in `.output/` |
| `bun run typecheck` | Strict TypeScript check |
| `bun run test` | All three Vitest projects; `test:lifecycle` (Node, WXT fake browser), `test:tools` (Node, the test-page tool) or `test:browser` (Playwright, Chromium and Firefox) for one |
| `bun run test-page` | Makes an anonymised Shorts Feed test page from a local capture (see `tests/pages/README.md`; needs `ffmpeg` the first time) |
| `bun run lint:firefox` | `web-ext lint` on the Firefox build (run `build:firefox` first) |
| `bun run icons` | Redraws `public/icon/` from `docs/design/brand` (needs `rsvg-convert`) |

CI runs typecheck, all test projects, both builds and `web-ext lint` on every push and pull request.

## Releasing

Work through `docs/release/checklist.md`. Pushing a `v*` tag that matches `package.json`'s version runs the same checks, then attaches the Chrome, Firefox and source zips to a GitHub Release. Store uploads stay manual, using the copy in `docs/release/store-listing.md`.

## Layout

- `src/entrypoints/`: thin WXT entrypoints (background, content script, Popup).
- `src/popup/`: the Popup, which takes its collaborators (such as the message lookup) as arguments so browser tests can mount it.
- `public/_locales/en/messages.json`: every user-facing string, including the manifest name and description.
- `tests/lifecycle/`: Node tests with WXT's fake browser, including checks on both built manifests.
- `tests/browser/`: tests in real headless Chromium and Firefox, against the test pages.
- `tests/pages/`: anonymised Shorts Feed test pages and their clips. How to add one is in its README.
- `scripts/test-pages/` and `scripts/test-page.ts`: the tool that makes a test page from a capture, tested in `tests/tools/`.

## License

[MIT](LICENSE)
