# Shorts Flow brand: Tideline

The brand for everything **outside** YouTube: toolbar icon, Popup, shortsflow.cptdawn.dev, store listings. On youtube.com the Shorts Control copies YouTube's own design instead (ADR 0002). Visual reference: `brand-sheet.html` (live copy: https://claude.ai/artifact/MP1mFdDUWfUTdU6Pynb7dY).

## Idea

Every Short loops until you swipe. Shorts Flow breaks that loop and carries you on. The mark is one continuous stroke: a loop left open, falling into a short downward arrow.

## Mark

- 128 grid. Loop radius 22 centred at (64, 50), opened at its lower right; tail drops to y 101; arrowhead 11 units each side.
- Stroke 11, round caps and joins, same weight at every size.
- `icon.svg`: night tile (rx 30) with a linear gradient `#22386B → #131F3A → #0B1220`, a soft white sheen from top-left (12% → 0), a 1.5px white hairline at 8%, and the line in the Pearl gradient.
- `mark-mono.svg`: the stroke alone using `context-fill`, for Firefox `theme_icons` (light and dark toolbars).
- Raster sizes for the store and manifest (16, 32, 48, 128) are generated from `icon.svg`.

## Palette

| Name | Value | Use |
|---|---|---|
| Abyss | `#0B1220` | Tile base, dark ground |
| Deep Tide | `#16233F` | Gradient partner, night card |
| Tide | `#3B5BD9` | Controls on light surfaces |
| Tide Light | `#8FA8F5` | Controls on dark surfaces |
| Pearl | `#E6F4FB → #93CBE8` | The line; the Auto-Scroll switch when on |
| Dawn Sand | `#E9C9A3` | Website accents only, never in the extension |
| Foam | `#F6F7FA` | Light canvas |
| Slate | `#5D6576` | Secondary text (light) |

Popup surfaces: light canvas `#F6F7FA`, surface `#FFFFFF`, sunken `#ECEEF3`, ink `#111726`, muted `#5D6576`; dark canvas `#0D111A`, surface `#151B28`, sunken `#1D2534`, ink `#EEF1F7`, muted `#99A1B3`. Status green `#3FAE8C` / `#67CFA9`. Errors use a muted brick, never red.

Rough proportion: neutrals 70%, night 20%, tide 6%, pearl 3%, sand 1%.

## Type

- Display: **Sora 600**, tracking −3.5% at large sizes, −2% at 15–22 px.
- UI and body: **Instrument Sans** 400/500/600, tabular figures for numbers.
- Keys: system monospace in a keycap.
- Fonts are bundled (extension and site), never loaded from Google at runtime.
- On youtube.com: YouTube's own fonts, never these.

## Popup

Neutral surfaces carry almost everything. Only Auto-Scroll gets the night card, with the mark as a faint watermark and a Pearl switch. All other controls use Tide. One bright thing on screen at a time.

## Store art

No copy on promo images other than the Shorts Flow wordmark: at the 275 px the Chrome Web Store shows the small tile at, a bare mark reads as an abstract glyph, and a name never needs localising. Small tile 440×280: the Pearl mark and the wordmark on the night gradient, over the tideline. Marquee 1400×560: the mark and wordmark beside three abstract Short frames, the middle one lifted. No YouTube screenshots, logos or red in promo art (screenshots of the real extension on YouTube are fine).

Screenshots, 1280×800: the night gradient with its tideline, a Tide Light overline, a Sora 600 headline (66 px, the second half in Pearl), one line of Instrument Sans, and a crop of the real extension floating on the right with the hairline edge. One Pearl ring on the thing being sold. The lockup bottom left; "Not affiliated with YouTube" bottom right. The Shorts in them show the Tideline illustrations in `scripts/store-art/scenes/` and fictional channels.

## Rules

- Never: YouTube red, a play triangle, an S ribbon, the YouTube wordmark, brand colours on youtube.com.
- Always: one bright thing, the tile's hairline edge, "Not affiliated with YouTube" in the store listing and site footer.
