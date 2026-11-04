import { describe, expect, it } from 'vitest';
import type { Settings } from '@/settings/settings';
import { aMomentLater, mountShortsFeed, TWO_SHORTS, type ShortsFeed } from './support/shorts-feed';
import { createTestClock } from './support/clock';
import { createTestSessionStore, createTestSettingsStore } from './support/stores';
import { feedPages, hasNextShort, testPages, type TestPage } from './support/test-pages';

// A Short counts once it has been the Current Short for about a second.
const UNDER_A_SECOND = 500;
const OVER_A_SECOND = 1500;
const MINUTE = 60_000;
// How long with no Short playing ends a Session.
const SESSION_GAP = 30 * MINUTE;
// How soon Shorts Flow notices YouTube has changed pages.
const ROUTE_CHECK = 500;

// The comments and description pages hold the feed from the start: no Advance there.
describe.each(feedPages.filter(hasNextShort))('on $name', (page) => {
  it('counts a Short reached by Advance', async () => {
    const shortsFeed = await mount(page, { with: { autoScroll: true } });
    await playing(shortsFeed);
    shortsFeed.clock.advance(OVER_A_SECOND);
    await expect.poll(() => shortsWatched(shortsFeed)).toBe(1);

    await expect.poll(() => shortsFeed.timeline, TWO_SHORTS).toContain('Short 2 is current');
    shortsFeed.clock.advance(OVER_A_SECOND);

    await expect.poll(() => shortsWatched(shortsFeed)).toBe(2);
  });
});

describe.each(testPages.filter(hasNextShort))('on $name', (page) => {
  it('counts the Current Short once it has been current for about a second', async () => {
    const shortsFeed = await mount(page);
    await playing(shortsFeed);

    shortsFeed.clock.advance(UNDER_A_SECOND);
    await aMomentLater();
    expect(await shortsWatched(shortsFeed)).toBe(0);
    shortsFeed.clock.advance(OVER_A_SECOND - UNDER_A_SECOND);

    await expect.poll(() => shortsWatched(shortsFeed)).toBe(1);
  });

  it('counts a Short the viewer moved to by hand, but not one they flicked past', async () => {
    const shortsFeed = await mount(page);
    await playing(shortsFeed);

    await moveOnByHand(shortsFeed, 2);
    shortsFeed.clock.advance(UNDER_A_SECOND);
    await moveOnByHand(shortsFeed, 3);
    shortsFeed.clock.advance(OVER_A_SECOND);

    // The first Short never stayed a second, nor did the second.
    await expect.poll(() => shortsWatched(shortsFeed)).toBe(1);
    await aMomentLater();
    expect(await shortsWatched(shortsFeed)).toBe(1);
  });

  it('counts a Short again each time the viewer goes back to it', async () => {
    const shortsFeed = await mount(page);
    await playing(shortsFeed);
    shortsFeed.clock.advance(OVER_A_SECOND);
    await expect.poll(() => shortsWatched(shortsFeed)).toBe(1);

    await moveOnByHand(shortsFeed, 2);
    shortsFeed.clock.advance(OVER_A_SECOND);
    await expect.poll(() => shortsWatched(shortsFeed)).toBe(2);

    shortsFeed.pressPreviousVideo();
    await expect.poll(() => shortsFeed.timeline).toContain('Short 1 is current');
    await playing(shortsFeed);
    shortsFeed.clock.advance(OVER_A_SECOND);

    await expect.poll(() => shortsWatched(shortsFeed)).toBe(3);
  });

  it('counts the Current Short again when the viewer comes back to the Shorts Feed on it', async () => {
    const shortsFeed = await mount(page);
    await playing(shortsFeed);
    shortsFeed.clock.advance(OVER_A_SECOND);
    await expect.poll(() => shortsWatched(shortsFeed)).toBe(1);

    shortsFeed.navigate('/feed/subscriptions');
    shortsFeed.clock.advance(ROUTE_CHECK);
    shortsFeed.navigate(page.path);
    shortsFeed.clock.advance(ROUTE_CHECK);
    shortsFeed.clock.advance(OVER_A_SECOND);

    await expect.poll(() => shortsWatched(shortsFeed)).toBe(2);
  });

  it('counts the Current Short once when the viewer switches tabs and back', async () => {
    const shortsFeed = await mount(page);
    await playing(shortsFeed);
    shortsFeed.clock.advance(OVER_A_SECOND);
    await expect.poll(() => shortsWatched(shortsFeed)).toBe(1);

    shortsFeed.pause();
    shortsFeed.moveToBackground();
    shortsFeed.clock.advance(OVER_A_SECOND);
    shortsFeed.moveToForeground();
    shortsFeed.clock.advance(OVER_A_SECOND);
    await aMomentLater();

    expect(await shortsWatched(shortsFeed)).toBe(1);
  });

  it('counts a Short once, however many times it loops', async () => {
    const shortsFeed = await mount(page);
    await playing(shortsFeed);
    shortsFeed.clock.advance(OVER_A_SECOND);

    await expect.poll(() => shortsFeed.timeline, TWO_SHORTS).toContain('Short 1 started over');
    shortsFeed.clock.advance(10 * OVER_A_SECOND);
    await aMomentLater();

    expect(await shortsWatched(shortsFeed)).toBe(1);
  });

  it('counts minutes while a Short plays, and not while it is paused', async () => {
    const shortsFeed = await mount(page);
    await playing(shortsFeed);

    shortsFeed.clock.advance(10 * MINUTE);
    await expect.poll(() => playingMinutes(shortsFeed)).toBe(10);
    shortsFeed.pause();
    shortsFeed.clock.advance(10 * MINUTE);
    await aMomentLater();

    expect(await playingMinutes(shortsFeed)).toBe(10);
  });

  it('counts no minutes once the viewer leaves the Shorts Feed', async () => {
    const shortsFeed = await mount(page);
    await playing(shortsFeed);

    shortsFeed.navigate('/feed/subscriptions');
    shortsFeed.clock.advance(10 * MINUTE);
    await aMomentLater();

    expect(await playingMinutes(shortsFeed)).toBe(0);
  });

  it('keeps the Session going while the Shorts Feed sits paused for under 30 minutes', async () => {
    const shortsFeed = await watchAShortForTenMinutes(await mount(page));

    shortsFeed.pause();
    shortsFeed.clock.advance(SESSION_GAP - MINUTE);
    shortsFeed.resume();
    await playing(shortsFeed);
    await moveOnByHand(shortsFeed, 2);
    shortsFeed.clock.advance(OVER_A_SECOND);

    await expect.poll(() => session(shortsFeed)).toEqual({ shortsWatched: 2, playingMinutes: 10 });
  });

  it('starts a new Session once no Short has played for 30 minutes', async () => {
    const shortsFeed = await watchAShortForTenMinutes(await mount(page));

    shortsFeed.pause();
    shortsFeed.clock.advance(SESSION_GAP);
    shortsFeed.resume();
    await playing(shortsFeed);
    shortsFeed.clock.advance(OVER_A_SECOND);

    // The Short they play again is the new Session's first.
    await expect.poll(() => session(shortsFeed)).toEqual({ shortsWatched: 1, playingMinutes: 0 });
  });

  it('starts a new Session once the computer has slept for 30 minutes mid-Short', async () => {
    const shortsFeed = await watchAShortForTenMinutes(await mount(page));

    // No pause: the Short simply plays on once the computer wakes.
    shortsFeed.clock.sleep(SESSION_GAP);
    shortsFeed.clock.advance(OVER_A_SECOND);

    await expect.poll(() => session(shortsFeed)).toEqual({ shortsWatched: 1, playingMinutes: 0 });
  });

  it('stores when the viewer was last watching on the wall clock, which moves on during sleep', async () => {
    const shortsFeed = await watchAShortForTenMinutes(await mount(page));
    const before = (await shortsFeed.session.get()).lastSeenAt;

    shortsFeed.clock.sleep(5 * MINUTE);
    shortsFeed.clock.advance(OVER_A_SECOND);
    shortsFeed.pause();
    shortsFeed.clock.advance(OVER_A_SECOND);

    // Other tabs and the Popup compare it with their own wall clock.
    await expect.poll(async () => (await shortsFeed.session.get()).lastSeenAt).toBeGreaterThanOrEqual(before + 5 * MINUTE);
  });

  it('keeps the Session going while the viewer is elsewhere on YouTube for under 30 minutes', async () => {
    const shortsFeed = await watchAShortForTenMinutes(await mount(page));

    shortsFeed.navigate('/feed/subscriptions');
    shortsFeed.clock.advance(SESSION_GAP - MINUTE);
    shortsFeed.navigate(page.path);
    shortsFeed.clock.advance(ROUTE_CHECK);
    await moveOnByHand(shortsFeed, 2);
    shortsFeed.clock.advance(OVER_A_SECOND);

    await expect.poll(() => session(shortsFeed)).toEqual({ shortsWatched: 2, playingMinutes: 10 });
  });

  it('starts a new Session after 30 minutes elsewhere on YouTube', async () => {
    const shortsFeed = await watchAShortForTenMinutes(await mount(page));

    shortsFeed.navigate('/feed/subscriptions');
    shortsFeed.clock.advance(SESSION_GAP);
    shortsFeed.navigate(page.path);
    shortsFeed.clock.advance(ROUTE_CHECK);
    await moveOnByHand(shortsFeed, 2);
    shortsFeed.clock.advance(OVER_A_SECOND);

    await expect.poll(() => session(shortsFeed)).toEqual({ shortsWatched: 1, playingMinutes: 0 });
  });

  it('adds up Shorts Watched across tabs into one Session', async () => {
    const shared = { session: createTestSessionStore(), clock: createTestClock() };
    const tabA = await mount(page, shared);
    const tabB = await mount(page, shared);
    await playing(tabA);
    await playing(tabB);

    await moveOnByHand(tabA, 2);
    await moveOnByHand(tabB, 2);
    await moveOnByHand(tabB, 3);
    shared.clock.advance(OVER_A_SECOND);

    // Each tab's Current Short, counted once each.
    await expect.poll(() => shortsWatched(tabA)).toBe(2);
  });

  it('keeps one Session going while the viewer watches in any tab', async () => {
    const shared = { session: createTestSessionStore(), clock: createTestClock() };
    const tabA = await mount(page, shared);
    const tabB = await mount(page, shared);
    await playing(tabA);
    await playing(tabB);
    shared.clock.advance(OVER_A_SECOND);
    await expect.poll(() => shortsWatched(tabA)).toBe(2);

    tabA.pause();
    shared.clock.advance(SESSION_GAP);
    tabA.resume();
    await playing(tabA);
    await moveOnByHand(tabA, 2);
    shared.clock.advance(OVER_A_SECOND);

    // Tab B played all along, so the Session never ended.
    await expect.poll(() => shortsWatched(tabB)).toBe(3);
  });
});

/** Lets the Current Short play for ten minutes, so it counts, and minutes do. */
async function watchAShortForTenMinutes(shortsFeed: ShortsFeed) {
  await playing(shortsFeed);
  shortsFeed.clock.advance(10 * MINUTE);
  await expect.poll(() => session(shortsFeed)).toEqual({ shortsWatched: 1, playingMinutes: 10 });
  return shortsFeed;
}

/** Moves on to the `n`th Short with YouTube's Next video control, and waits for it to play. */
async function moveOnByHand(shortsFeed: ShortsFeed, n: number) {
  shortsFeed.pressNextVideo();
  await expect.poll(() => shortsFeed.timeline).toContain(`Short ${n} is current`);
  await playing(shortsFeed);
}

async function session(shortsFeed: ShortsFeed) {
  return { shortsWatched: await shortsWatched(shortsFeed), playingMinutes: await playingMinutes(shortsFeed) };
}

/** Playing minutes so far this Session, to the nearest minute. */
async function playingMinutes({ session }: ShortsFeed) {
  return Math.round((await session.get()).playingMs / MINUTE);
}

/** The Shorts Feed with each Short looping in place, unless a test wants Auto-Scroll. */
function mount(page: TestPage, options: Parameters<typeof mountShortsFeed>[1] & { with?: Partial<Settings> } = {}) {
  const { with: settings, ...rest } = options;
  return mountShortsFeed(page, { settings: createTestSettingsStore({ autoScroll: false, ...settings }), ...rest });
}

/** Waits for the Current Short to be playing. */
async function playing(shortsFeed: ShortsFeed) {
  await expect.poll(() => shortsFeed.playing(), TWO_SHORTS).toBe(true);
}

async function shortsWatched({ session }: ShortsFeed) {
  return (await session.get()).shortsWatched;
}
