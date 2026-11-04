// Makes Shorts Flow's store art from the real extension: `bun run store-art`.
//
// 1. Draws the Tideline scenes (scenes/*.svg) into the PNGs and short WebM
//    clips the Shorts in the art play. They are original illustrations, so no
//    creator's video or face ever appears in a listing.
// 2. Loads the Chrome build (.output/chrome-mv3) into Chromium and opens the
//    anonymised Shorts Feed test pages (tests/pages) at www.youtube.com, with
//    the requests answered locally. Fictional channels and titles replace the
//    pages' lorem ipsum. It then captures each state the art needs from the
//    extension itself: the Shorts Control, its quick-settings menu, a Shortcut
//    confirmation, the Break Nudge and the Popup in both themes.
// 3. Lays those captures out in stills.html (five 1280×800 screenshots, the
//    440×280 small promo tile, the 1400×560 marquee) and film.html (a 40 s
//    1080p promo video, rendered frame by frame and encoded with ffmpeg).
//
// Needs the Playwright Chromium (`bunx playwright install chromium`),
// `rsvg-convert` and `ffmpeg`. Work files go to .store-art/ (gitignored); the
// art goes to docs/release/store-art/. `--only stills` or `--only film` skips
// the other output; `--skip-capture` reuses the last captures.

import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { copyFile, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const HERE = fileURLToPath(new URL('./', import.meta.url));
const WORK = path.join(ROOT, '.store-art');
const RAW = path.join(WORK, 'raw');
const OUT = path.join(ROOT, 'docs/release/store-art');
const EXT = path.join(ROOT, '.output/chrome-mv3');

const args = process.argv.slice(2);
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;
const skipCapture = args.includes('--skip-capture');

const run = (cmd, argv) => execFileSync(cmd, argv, { stdio: ['ignore', 'ignore', 'inherit'] });

// ── 1. Scenes ────────────────────────────────────────────────────────────────

const SCENES = ['ocean', 'aurora', 'dunes', 'ridges'];

async function drawScenes() {
  await mkdir(path.join(WORK, 'scenes'), { recursive: true });
  for (const scene of SCENES) {
    const png = path.join(WORK, 'scenes', `${scene}.png`);
    run('rsvg-convert', ['-w', '1080', '-h', '1920', path.join(HERE, 'scenes', `${scene}.svg`), '-o', png]);
    // A still clip: the Short only has to play for the engine to treat it as one.
    run('ffmpeg', ['-loglevel', 'error', '-y', '-loop', '1', '-i', png, '-t', '6', '-r', '24',
      '-vf', 'scale=888:1608:force_original_aspect_ratio=increase,crop=888:1608',
      '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '18', '-pix_fmt', 'yuv420p',
      path.join(WORK, 'scenes', `${scene}.webm`)]);
  }
}

// ── 2. Captures ──────────────────────────────────────────────────────────────

/** Which scene each test-page clip plays, unless a capture says otherwise. */
const CLIP_SCENES = { 'clip-a.webm': 'ocean', 'clip-b.webm': 'aurora', 'clip-c.webm': 'dunes' };

async function launch({ testPage = 'shorts-dark', scheme = 'dark', settings = {}, session = null, firstScene = null }) {
  const profile = path.join(WORK, 'profiles', `${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const ctx = await chromium.launchPersistentContext(profile, {
    channel: 'chromium', headless: true, viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, colorScheme: scheme,
    args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`, '--autoplay-policy=no-user-gesture-required', '--hide-scrollbars'],
  });
  let [worker] = ctx.serviceWorkers();
  worker ??= await ctx.waitForEvent('serviceworker');
  const id = new URL(worker.url()).host;
  // Settings and the Session as a viewer might have them (storage keys are the setting names).
  await worker.evaluate(async ([settings, session]) => {
    await chrome.storage.local.set(settings);
    if (session) await chrome.storage.local.set({ session: { ...session, lastSeenAt: Date.now() } });
  }, [settings, session]);
  await ctx.route('https://www.youtube.com/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.startsWith('/shorts/')) {
      return route.fulfill({ contentType: 'text/html; charset=utf-8', body: await readFile(path.join(ROOT, 'tests/pages', testPage, 'page.html')) });
    }
    if (url.pathname.startsWith('/tests/pages/clips/')) {
      const clip = path.basename(url.pathname);
      const scene = clip === 'clip-a.webm' && firstScene ? firstScene : CLIP_SCENES[clip];
      return route.fulfill({ path: path.join(WORK, 'scenes', `${scene}.webm`), contentType: 'video/webm' });
    }
    return route.fulfill({ status: 404, body: '' });
  });
  // The fresh install opens the Welcome Page; the art has no use for it.
  for (const page of ctx.pages()) await page.close().catch(() => {});
  return { ctx, id };
}

/** Replaces the test page's placeholders with fictional channels, titles and avatars matching each Short's scene. */
function dress(scenes) {
  const META = {
    ocean: { handle: '@slowtide.studio', title: 'Golden hour on the coast, no words needed', place: 'Big Sur', related: 'Tide pools at dusk', colors: ['#ffd59a', '#e07a5f'] },
    aurora: { handle: '@northlight.films', title: 'Northern lights over the lake tonight', place: 'Lofoten', related: 'Lake camp, night two', colors: ['#8fe8c8', '#2c7a8c'] },
    dunes: { handle: '@dune.diaries', title: 'Wind sculpting the dunes at sunrise', place: 'Namib', related: 'Sandboarding the big one', colors: ['#f0c9a0', '#b8704a'] },
    ridges: { handle: '@quietridge', title: 'Morning mist rolling over the ridges', place: 'Dolomites', related: 'Sunrise from the hut', colors: ['#c9d8f5', '#53628c'] },
  };
  const sounds = ['Original sound · slow tide', 'Ambient · Northern Air', 'Field recording · Wind', 'Original sound · Quiet'];
  const avatar = ([a, b]) => 'data:image/svg+xml,' + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="10" height="10" fill="url(#g)"/></svg>`);
  const dressIn = (root, meta, index) => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    let lorem = 0;
    for (const node of nodes) {
      const text = node.nodeValue;
      if (!text.trim()) continue;
      if (/@channel\d+/.test(text)) { node.nodeValue = text.replace(/@channel\d+/, meta.handle); continue; }
      if (!/lorem/i.test(text)) continue;
      // Short placeholders are place chips; longer ones come title, title, related Short, sound.
      const k = text.trim().length <= 14 ? -1 : lorem++;
      const words = k === -1 ? meta.place : k <= 1 ? meta.title : k === 2 ? meta.related : sounds[index % sounds.length];
      node.nodeValue = text.replace(/\S[\s\S]*\S|\S/, words);
    }
    for (const img of root.querySelectorAll('img')) {
      if ((img.getAttribute('src') || '').startsWith('data:image/svg')) {
        img.src = avatar(meta.colors);
        img.style.borderRadius = '50%';
      }
    }
  };
  [...document.querySelectorAll('.reel-video-in-sequence-new')].forEach((reel, i) => dressIn(reel, META[scenes[i % scenes.length]], i));
  dressIn(document.body, META[scenes[0]], 0);
}

async function openFeed(ctx, scenes, settle = 2200) {
  const page = await ctx.newPage();
  await page.goto('https://www.youtube.com/shorts/vid00000001');
  await page.waitForTimeout(600);
  await page.evaluate(dress, scenes);
  // The test page has no YouTube scripts, so start the Short as YouTube would.
  await page.evaluate(async () => {
    const video = document.querySelector('video.html5-main-video');
    if (!video) return;
    video.muted = true;
    video.currentTime = 1.2;
    await video.play().catch(() => {});
  });
  await page.waitForTimeout(settle);
  return page;
}

const RECTS = {};

/** Where the art's subjects sit on the page, in CSS pixels, so the layouts crop from real positions. */
async function measure(page, name) {
  RECTS[name] = await page.evaluate(() => {
    const box = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; };
    const all = (selector) => {
      const found = [];
      const walk = (root) => {
        root.querySelectorAll(selector).forEach((el) => found.push(el));
        root.querySelectorAll('*').forEach((el) => el.shadowRoot && walk(el.shadowRoot));
      };
      walk(document);
      return found;
    };
    const onScreen = (els) => els.find((el) => { const b = el.getBoundingClientRect(); return b.width > 0 && b.height > 0 && b.y >= 0 && b.y < innerHeight; });
    return {
      video: box(document.querySelector('video.html5-main-video')),
      control: box(onScreen(all('.shorts-flow-control, [class*="shorts-flow-control"]'))),
      menu: box(onScreen(all('[role="menu"]'))),
      toast: box(onScreen(all('.toast'))),
      dialog: box(onScreen(all('dialog[open]'))),
    };
  });
}

async function shoot(page, name) {
  await page.screenshot({ path: path.join(RAW, `${name}.png`) });
  await measure(page, name);
}

const CAPTURES = {
  async feed() {
    for (const [name, scenes] of [['feed-dark', ['ocean', 'aurora', 'dunes']], ['feed-aurora', ['aurora', 'dunes', 'ocean']], ['feed-dunes', ['dunes', 'ocean', 'aurora']]]) {
      const { ctx } = await launch({ firstScene: scenes[0] });
      await shoot(await openFeed(ctx, scenes), name);
      await ctx.close();
    }
  },
  async menu() {
    const { ctx } = await launch({ settings: { speedOn: true, preferredSpeed: 1.5 } });
    const page = await openFeed(ctx, ['ocean', 'aurora', 'dunes']);
    await page.click('.shorts-flow-quick-settings-button');
    await page.waitForTimeout(700);
    await shoot(page, 'menu');
    await ctx.close();
  },
  async toast() {
    const { ctx } = await launch({ firstScene: 'aurora' });
    const page = await openFeed(ctx, ['aurora', 'ocean', 'dunes']);
    await page.mouse.click(300, 450); // the page, away from any control
    await page.keyboard.press('s');
    await page.waitForTimeout(500);
    await shoot(page, 'toast');
    await ctx.close();
  },
  async nudge() {
    // One Short short of a 25-Short Session Limit: the Short on screen reaches it.
    const { ctx } = await launch({
      settings: { sessionLimit: { kind: 'shorts', value: 25 } },
      session: { shortsWatched: 24, playingMs: 14 * 60_000 },
      firstScene: 'dunes',
    });
    await shoot(await openFeed(ctx, ['dunes', 'aurora', 'ocean'], 4000), 'nudge');
    await ctx.close();
  },
  async popup() {
    for (const scheme of ['light', 'dark']) {
      const { ctx, id } = await launch({
        scheme,
        settings: { speedOn: true, sessionLimit: { kind: 'minutes', value: 30 } },
        session: { shortsWatched: 24, playingMs: 11 * 60_000 },
      });
      const page = await ctx.newPage();
      await page.setViewportSize({ width: 340, height: 600 });
      await page.goto(`chrome-extension://${id}/popup.html`);
      await page.waitForTimeout(900);
      const height = await page.evaluate(() => {
        const style = getComputedStyle(document.body);
        return Math.ceil(document.body.getBoundingClientRect().height + parseFloat(style.marginTop) + parseFloat(style.marginBottom));
      });
      await page.setViewportSize({ width: 340, height });
      await page.waitForTimeout(200);
      await page.screenshot({ path: path.join(RAW, `popup-${scheme}.png`) });
      // The Session Limit row, which the Session Limit art shows on its own.
      const sessionRow = await page.evaluate(() => {
        const label = document.getElementById('sf-setting-session-limit');
        const row = label?.closest('li') ?? label?.parentElement?.parentElement;
        if (!row) return null;
        const b = row.getBoundingClientRect();
        return { x: b.x, y: b.y, w: b.width, h: b.height };
      });
      RECTS[`popup-${scheme}`] = { width: 340, height, sessionRow };
      await ctx.close();
    }
  },
};

// ── 3. Layouts ───────────────────────────────────────────────────────────────

async function stageLayouts() {
  const fonts = path.join(ROOT, 'node_modules/@fontsource');
  for (const [pkg, file] of [['sora', 'sora-latin-600-normal.woff2'], ['sora', 'sora-latin-400-normal.woff2'], ['instrument-sans', 'instrument-sans-latin-400-normal.woff2'],
    ['instrument-sans', 'instrument-sans-latin-500-normal.woff2'], ['instrument-sans', 'instrument-sans-latin-600-normal.woff2']]) {
    await copyFile(path.join(fonts, pkg, 'files', file), path.join(WORK, file));
  }
  await copyFile(path.join(ROOT, 'docs/design/brand/icon.svg'), path.join(WORK, 'icon.svg'));
  await copyFile(path.join(HERE, 'stills.html'), path.join(WORK, 'stills.html'));
  await copyFile(path.join(HERE, 'film.html'), path.join(WORK, 'film.html'));
}

async function openLayout(browser, file, hash, width, height, scale = 1) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: scale });
  await page.addInitScript((rects) => { window.RECTS = rects; }, RECTS);
  await page.goto(`file://${path.join(WORK, file)}${hash ? `#${hash}` : ''}`);
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map((img) => img.decode().catch(() => {})));
  });
  return page;
}

const STILLS = {
  1: ['screenshot-1-auto-scroll', 1280, 800],
  2: ['screenshot-2-quick-settings', 1280, 800],
  3: ['screenshot-3-speed', 1280, 800],
  4: ['screenshot-4-session-limit', 1280, 800],
  5: ['screenshot-5-privacy', 1280, 800],
  tile: ['promo-small-440x280', 440, 280],
  marquee: ['promo-marquee-1400x560', 1400, 560],
};

async function renderStills(browser) {
  for (const [hash, [name, width, height]] of Object.entries(STILLS)) {
    const page = await openLayout(browser, 'stills.html', hash, width, height);
    await page.waitForTimeout(150);
    // The stores take PNG; flatten to opaque RGB so nothing renders against a stray background.
    const png = path.join(WORK, `${name}.rgba.png`);
    await page.screenshot({ path: png, clip: { x: 0, y: 0, width, height } });
    run('magick', [png, '-background', '#0B1220', '-alpha', 'remove', '-alpha', 'off', '-strip', path.join(OUT, `${name}.png`)]);
    await page.close();
  }
}

async function renderFilm(browser) {
  const FPS = 30;
  const frames = path.join(WORK, 'frames');
  await rm(frames, { recursive: true, force: true });
  await mkdir(frames, { recursive: true });
  const page = await openLayout(browser, 'film.html', '', 1920, 1080);
  const duration = await page.evaluate(() => window.DURATION);
  const count = Math.round(duration * FPS);
  for (let i = 0; i < count; i++) {
    await page.evaluate((t) => window.render(t), i / FPS);
    await page.screenshot({ path: path.join(frames, `f${String(i).padStart(5, '0')}.png`) });
    if (i % 150 === 0) console.log(`  film ${Math.round((i / count) * 100)}%`);
  }
  await page.close();
  run('ffmpeg', ['-loglevel', 'error', '-y', '-framerate', String(FPS), '-i', path.join(frames, 'f%05d.png'),
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
    path.join(OUT, 'promo-video.mp4')]);
}

// ── Run ──────────────────────────────────────────────────────────────────────

if (!(await readdir(EXT).catch(() => null))) {
  console.error('No Chrome build in .output/chrome-mv3: run `bun run build:chrome` first.');
  process.exit(1);
}
await mkdir(RAW, { recursive: true });
await mkdir(OUT, { recursive: true });

if (!skipCapture) {
  console.log('Drawing scenes');
  await drawScenes();
  for (const [name, capture] of Object.entries(CAPTURES)) {
    console.log(`Capturing ${name}`);
    await capture();
  }
  await writeFile(path.join(RAW, 'rects.json'), JSON.stringify(RECTS, null, 1));
  await rm(path.join(WORK, 'profiles'), { recursive: true, force: true });
} else {
  Object.assign(RECTS, JSON.parse(await readFile(path.join(RAW, 'rects.json'), 'utf8')));
}

await stageLayouts();
const browser = await chromium.launch({ args: ['--allow-file-access-from-files'] });
if (only !== 'film') { console.log('Rendering stills'); await renderStills(browser); }
if (only !== 'stills') { console.log('Rendering film'); await renderFilm(browser); }
await browser.close();
console.log(`Store art in ${path.relative(ROOT, OUT)}/`);
