// Makes an anonymised Shorts Feed test page from a local capture of
// youtube.com/shorts. See tests/pages/README.md.
//
//   bun run test-page <capture.html> <name> [--width 1440] [--height 900] [--description "..."] [--show-replaced]

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { parseArgs } from 'node:util';
import { LeakError, makeTestPage } from './test-pages/make-test-page';

const PAGES = new URL('../tests/pages/', import.meta.url);

// Test patterns of different lengths, so a test can tell the Shorts apart.
const CLIPS = [
  { name: 'clip-a.webm', source: 'testsrc2=size=180x320:rate=30:duration=2' },
  { name: 'clip-b.webm', source: 'smptebars=size=180x320:rate=30:duration=2.5' },
  { name: 'clip-c.webm', source: 'testsrc=size=180x320:rate=30:duration=3' },
];

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    width: { type: 'string', default: '1440' },
    height: { type: 'string', default: '900' },
    description: { type: 'string', default: '' },
    'show-replaced': { type: 'boolean', default: false },
  },
});
const [capturePath, name] = positionals;
if (!capturePath || !name || !/^[a-z0-9-]+$/.test(name)) {
  console.error(
    'Usage: bun run test-page <capture.html> <name> [--width 1440] [--height 900] [--description "..."] [--show-replaced]',
  );
  process.exit(1);
}

const stylesheetCache = join(dirname(capturePath), 'stylesheets');

try {
  const page = await makeTestPage(readFileSync(capturePath, 'utf8'), {
    clips: makeClips(),
    stylesheet,
  });
  const dir = new URL(`${name}/`, PAGES);
  mkdirSync(dir, { recursive: true });
  writeFileSync(new URL('page.html', dir), page.html);
  writeFileSync(
    new URL('test-page.json', dir),
    JSON.stringify(
      {
        description: values.description,
        path: page.path,
        viewport: { width: Number(values.width), height: Number(values.height) },
        shorts: page.shorts,
      },
      null,
      2,
    ) + '\n',
  );
  console.log(
    `Wrote tests/pages/${name}/ from ${basename(capturePath)}: ${page.shorts.length} Shorts, ${Math.round(page.html.length / 1024)} KB`,
  );
  showReplaced(page.replacedText);
} catch (error) {
  if (!(error instanceof LeakError)) throw error;
  console.error(`Not written. ${error.message}`);
  showReplaced(error.replacedText);
  process.exit(1);
}

/** Only on this terminal: YouTube interface text in this list belongs in youtube-text.ts. */
function showReplaced(replacedText: string[]) {
  if (!values['show-replaced']) return;
  console.log(`\nReplaced with placeholders:\n  ${replacedText.map((text) => JSON.stringify(text)).join('\n  ')}`);
}

/**
 * YouTube's stylesheets, fetched once and kept beside the capture (gitignored),
 * so the page can be made again offline. Fonts and other hosts are left out.
 */
async function stylesheet(url: string) {
  if (new URL(url).hostname !== 'www.youtube.com') return undefined;
  const cached = join(stylesheetCache, `${createHash('sha256').update(url).digest('hex').slice(0, 16)}.css`);
  if (existsSync(cached)) return readFileSync(cached, 'utf8');
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not fetch ${url}: ${response.status}`);
  const css = await response.text();
  mkdirSync(stylesheetCache, { recursive: true });
  writeFileSync(cached, css);
  return css;
}

/** Generates the clips with ffmpeg the first time; they are committed after that. */
function makeClips() {
  const dir = new URL('clips/', PAGES);
  mkdirSync(dir, { recursive: true });
  for (const clip of CLIPS) {
    const path = new URL(clip.name, dir).pathname;
    if (existsSync(path)) continue;
    const ffmpeg = spawnSync(
      'ffmpeg',
      ['-v', 'error', '-f', 'lavfi', '-i', clip.source, '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '40',
        '-an', '-map_metadata', '-1', '-fflags', '+bitexact', path],
      { stdio: 'inherit' },
    );
    if (ffmpeg.status !== 0) throw new Error(`ffmpeg could not make ${clip.name}`);
  }
  return CLIPS.map((clip) => `/tests/pages/clips/${clip.name}`);
}
