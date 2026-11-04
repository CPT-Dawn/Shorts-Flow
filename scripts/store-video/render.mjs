// Renders the Shorts Flow launch film (film.html) frame by frame.
//
//   bun scripts/store-video/render.mjs                    4K 60 fps frames → .store-art/film/picture.mov
//   bun scripts/store-video/render.mjs --stills 1,7.5,12  review stills at those times (1080p)
//   bun scripts/store-video/render.mjs --fps 30 --scale 1 a quick 1080p30 draft
//
// Needs the captures from `bun run store-art` (in .store-art/), the Playwright
// Chromium and ffmpeg. The picture is then finished (score, mix, master,
// encode) in the SouVi Engine project `shorts-flow`.

import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { copyFile, mkdir, readFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const HERE = fileURLToPath(new URL('./', import.meta.url));
const WORK = path.join(ROOT, '.store-art');
const OUT = path.join(WORK, 'film');

const args = process.argv.slice(2);
const opt = (name, fallback) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : fallback);
const FPS = Number(opt('fps', 60));
const SCALE = Number(opt('scale', 2));
const WORKERS = Number(opt('workers', 8));
const stills = opt('stills', null)?.split(',').map(Number);
const from = Number(opt('from', 0));
const until = opt('until', null);

await copyFile(path.join(HERE, 'film.html'), path.join(WORK, 'film.html'));
const RECTS = JSON.parse(await readFile(path.join(WORK, 'raw/rects.json'), 'utf8'));

async function openFilm(browser, scale) {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: scale });
  await page.addInitScript((rects) => { window.RECTS = rects; }, RECTS);
  await page.goto(`file://${path.join(WORK, 'film.html')}`);
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map((img) => img.decode().catch(() => {})));
  });
  return page;
}

const launch = () => chromium.launch({ args: ['--allow-file-access-from-files', '--force-color-profile=srgb'] });

if (stills) {
  const dir = path.join(OUT, 'stills');
  await mkdir(dir, { recursive: true });
  const browser = await launch();
  const page = await openFilm(browser, Number(opt('scale', 1)));
  for (const t of stills) {
    await page.evaluate((t) => window.render(t), t);
    const file = path.join(dir, `t${t.toFixed(2).padStart(6, '0')}.png`);
    await page.screenshot({ path: file });
    console.log(file);
  }
  await browser.close();
  process.exit(0);
}

const frames = path.join(OUT, 'frames');
if (from === 0) await rm(frames, { recursive: true, force: true });
await mkdir(frames, { recursive: true });

const probe = await launch();
const duration = until ? Number(until) : await (await openFilm(probe, 1)).evaluate(() => window.DURATION);
await probe.close();
const count = Math.round(duration * FPS);
const start = Math.round(from * FPS);
console.log(`Rendering ${count - start} frames at ${1920 * SCALE}×${1080 * SCALE}, ${FPS} fps, ${WORKERS} workers`);

let next = start, done = 0;
const t0 = Date.now();
await Promise.all(Array.from({ length: WORKERS }, async () => {
  const browser = await launch();
  const page = await openFilm(browser, SCALE);
  while (next < count) {
    const i = next++;
    await page.evaluate((t) => window.render(t), i / FPS);
    // Playwright's screenshot honours the device scale factor (a bare CDP capture returns CSS pixels).
    await page.screenshot({ path: path.join(frames, `f${String(i).padStart(5, '0')}.png`), animations: 'allow', caret: 'initial' });
    if (++done % 120 === 0) {
      const rate = done / ((Date.now() - t0) / 1000);
      console.log(`  ${done}/${count - start} frames, ${rate.toFixed(1)} fps, ~${Math.round((count - start - done) / rate)} s left`);
    }
  }
  await browser.close();
}));

// A 10-bit, visually lossless mezzanine for SouVi: it grades, adds grain and does the delivery encode.
const mov = path.join(OUT, 'picture.mov');
execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-framerate', String(FPS), '-i', path.join(frames, 'f%05d.png'),
  '-vf', 'scale=out_color_matrix=bt709:out_range=tv:flags=lanczos+accurate_rnd+full_chroma_int,format=yuv422p10le',
  '-c:v', 'prores_ks', '-profile:v', '2', '-vendor', 'apl0',
  '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', mov], { stdio: 'inherit' });
console.log(`Picture in ${path.relative(ROOT, mov)} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
