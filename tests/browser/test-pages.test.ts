import { describe, expect, it } from 'vitest';
import { findLeaks } from '../../scripts/test-pages/leaks';
import { openTestPage, pageSource, testPages } from './support/test-pages';

const shortsDark = testPages.find((page) => page.name === 'shorts-dark');

it('has the dark Shorts Feed base page', () => {
  expect(shortsDark).toBeDefined();
});

describe.each(testPages)('test page $name', (page) => {
  it('opens at its own Shorts address, in the window it was captured in', async () => {
    const { window } = await openTestPage(page);

    expect(window.location.pathname).toBe(page.path);
    expect(window.location.pathname).toMatch(/^\/shorts\/vid\d{8}$/);
    expect(window.innerWidth).toBe(page.viewport.width);
    expect(window.innerHeight).toBe(page.viewport.height);
  });

  it('plays a generated clip in the Short on screen', async () => {
    const { document } = await openTestPage(page);
    const onScreen = [...document.querySelectorAll('video')].filter((video) => {
      const box = video.getBoundingClientRect();
      return box.width > 0 && box.height > 0 && box.top < innerHeight;
    });

    expect(onScreen).toHaveLength(1);
    const video = onScreen[0]!;
    expect(new URL(video.src).pathname).toMatch(/^\/tests\/pages\/clips\/clip-[a-z]\.webm$/);
    video.muted = true;
    await video.play();
    await expect.poll(() => video.currentTime, { timeout: 5000 }).toBeGreaterThan(0.5);
    expect(video.paused).toBe(false);
  });

  it("is laid out by YouTube's own styles", async () => {
    const { document, window } = await openTestPage(page);
    const box = (label: string) =>
      [...document.querySelectorAll(`[aria-label="${label}"]`)]
        .map((element) => element.getBoundingClientRect())
        .find((rect) => rect.width > 0)!;
    const short = document.querySelector('video[src]')!.getBoundingClientRect();

    // The Short stands upright in the window, the rail beside it, the next arrow at the right.
    expect(short.height).toBeGreaterThan(short.width);
    expect(short.bottom).toBeLessThanOrEqual(window.innerHeight);
    expect(box('Share').left).toBeGreaterThanOrEqual(short.right);
    expect(box('Next video').left).toBeGreaterThan(box('Share').right);
    expect(box('Next video').right).toBeLessThanOrEqual(window.innerWidth);
  });

  it('holds no scripts, outside addresses, real ids, names or pictures', async () => {
    expect(findLeaks(await pageSource(page))).toEqual([]);
  });
});
