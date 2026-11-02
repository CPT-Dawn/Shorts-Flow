// Draws Shorts Flow's icons from the Tideline brand SVGs into public/icon/.
//
//   bun run icons
//
// Chrome takes only PNGs: 16, 32 and 48 from docs/design/brand/icon.svg, and
// 128 as the Chrome Web Store asks, 96px of artwork in 16px of transparent
// padding. Firefox takes the SVG tile, and a dark and a light copy of the
// monochrome mark for action.theme_icons. wxt.config.ts keeps the SVGs out of
// the Chrome build. Needs rsvg-convert (librsvg); the output is committed, so
// CI does not.
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const brand = (name: string) => join(root, 'docs', 'design', 'brand', name);
const out = join(root, 'public', 'icon');

/** Firefox's own toolbar icon colours: a dark glyph for light themes, a light one for dark. */
const TOOLBAR_COLOURS = { dark: '#5b5b66', light: '#fbfbfe' } as const;

/** Each PNG: its size, and the artwork's size within it if it is padded. */
const PNGS = [{ size: 16 }, { size: 32 }, { size: 48 }, { size: 128, artwork: 96 }];

mkdirSync(out, { recursive: true });

for (const { size, artwork = size } of PNGS) {
  const padding = (size - artwork) / 2;
  const args = ['-w', `${artwork}`, '-h', `${artwork}`, '--page-width', `${size}`, '--page-height', `${size}`];
  args.push('--left', `${padding}`, '--top', `${padding}`, '-o', join(out, `${size}.png`), brand('icon.svg'));
  const result = spawnSync('rsvg-convert', args, { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`rsvg-convert failed for ${size}.png: ${result.error ?? result.stderr}`);
  console.log(`Wrote public/icon/${size}.png`);
}

writeFileSync(join(out, 'shorts-flow.svg'), readFileSync(brand('icon.svg')));
console.log('Wrote public/icon/shorts-flow.svg');

// The mark strokes with `context-fill`; theme_icons wants one image per
// toolbar theme, so each gets a copy in a fixed colour (as Chrono does).
const mark = readFileSync(brand('mark-mono.svg'), 'utf8');
if (!mark.includes('context-fill')) throw new Error('mark-mono.svg no longer uses context-fill');
for (const [variant, colour] of Object.entries(TOOLBAR_COLOURS)) {
  writeFileSync(join(out, `toolbar-${variant}.svg`), mark.replaceAll('context-fill', colour));
  console.log(`Wrote public/icon/toolbar-${variant}.svg`);
}
