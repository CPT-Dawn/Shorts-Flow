import { describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import type { Session } from '@/settings/session';
import type { Settings } from '@/settings/settings';
import { createTestClock } from './support/clock';
import { aMomentLater, mountShortsFeed, TWO_SHORTS, type ShortsFeed } from './support/shorts-feed';
import { createTestSessionStore, createTestSettingsStore } from './support/stores';
import { hasNextShort, testPages, type TestPage } from './support/test-pages';

// A Short counts once it has been the Current Short for about a second.
const OVER_A_SECOND = 1500;
const MINUTE = 60_000;
// How soon Shorts Flow notices YouTube has changed pages.
const ROUTE_CHECK = 500;

describe.each(testPages.filter(hasNextShort))('on $name', (page) => {
  it('pauses the Current Short and shows the Break Nudge once the Session reaches its limit in Shorts', async () => {
    const shortsFeed = await mount(page, { kind: 'shorts', value: 3 }, { shortsWatched: 2 });
    await playing(shortsFeed);

    shortsFeed.clock.advance(OVER_A_SECOND);

    await expect.poll(() => shortsFeed.dialog()).toBeDefined();
    expect(shortsFeed.playing()).toBe(false);
  });

  it('shows no Break Nudge before the limit in Shorts', async () => {
    const shortsFeed = await mount(page, { kind: 'shorts', value: 3 }, { shortsWatched: 1 });
    await playing(shortsFeed);

    shortsFeed.clock.advance(OVER_A_SECOND);
    await expect.poll(async () => (await shortsFeed.session.get()).shortsWatched).toBe(2);
    await aMomentLater();

    expect(shortsFeed.dialog()).toBeUndefined();
    expect(shortsFeed.playing()).toBe(true);
  });

  it('shows the Break Nudge once Shorts have played for the limit in minutes, and not before', async () => {
    const shortsFeed = await mount(page, { kind: 'minutes', value: 20 });
    await playing(shortsFeed);

    shortsFeed.clock.advance(19 * MINUTE);
    await aMomentLater();
    expect(shortsFeed.dialog()).toBeUndefined();
    shortsFeed.clock.advance(MINUTE + OVER_A_SECOND);

    await expect.poll(() => shortsFeed.dialog()).toBeDefined();
    expect(shortsFeed.playing()).toBe(false);
  });

  it('counts minutes already played this Session, in other tabs too, towards the limit', async () => {
    const shortsFeed = await mount(page, { kind: 'minutes', value: 20 }, { playingMs: 19 * MINUTE });
    await playing(shortsFeed);

    shortsFeed.clock.advance(MINUTE + OVER_A_SECOND);

    await expect.poll(() => shortsFeed.dialog()).toBeDefined();
  });

  it('shows no Break Nudge while the Session Limit is off, as it is by default', async () => {
    const shortsFeed = await mountShortsFeed(page, {
      settings: createTestSettingsStore({ autoScroll: false }),
      session: createTestSessionStore({ shortsWatched: 500 }),
    });
    await playing(shortsFeed);

    shortsFeed.clock.advance(120 * MINUTE);
    await aMomentLater();

    expect(shortsFeed.dialog()).toBeUndefined();
    expect(shortsFeed.playing()).toBe(true);
  });

  it('is a dialog with a calm title and text, no countdown, and one way out', async () => {
    const shortsFeed = await nudged(await mount(page, { kind: 'shorts', value: 1 }));

    const dialog = shortsFeed.dialog()!;
    shortsFeed.clock.advance(5 * MINUTE);
    await aMomentLater();

    expect(dialog.title).toBe('Time for a break?');
    expect(dialog.text).toBe("You've reached the Session Limit you set. Take a moment, or keep watching.");
    expect(dialog.actions).toEqual(['Keep watching']);
    expect(dialog.element.matches(':modal')).toBe(true);
    expect(shortsFeed.dialog()!.element.textContent).toBe(dialog.element.textContent);
  });

  it('resumes the Short when the viewer clicks Keep watching', async () => {
    const shortsFeed = await nudged(await mount(page, { kind: 'shorts', value: 1 }));

    shortsFeed.pressDialogAction('Keep watching');

    expect(shortsFeed.dialog()).toBeUndefined();
    await playing(shortsFeed);
  });

  for (const key of ['Enter', 'Space', 'Escape']) {
    it(`resumes the Short when the viewer presses ${key}`, async () => {
      const shortsFeed = await nudged(await mount(page, { kind: 'shorts', value: 1 }));

      await userEvent.keyboard(`[${key}]`);

      await expect.poll(() => shortsFeed.dialog()).toBeUndefined();
      await playing(shortsFeed);
    });
  }

  it('nudges again only after another full limit in Shorts', async () => {
    const shortsFeed = await nudged(await mount(page, { kind: 'shorts', value: 2 }, { shortsWatched: 1 }));
    shortsFeed.pressDialogAction('Keep watching');
    await playing(shortsFeed);

    await moveOnByHand(shortsFeed, 2);
    shortsFeed.clock.advance(OVER_A_SECOND);
    await expect.poll(async () => (await shortsFeed.session.get()).shortsWatched).toBe(3);
    await aMomentLater();
    expect(shortsFeed.dialog()).toBeUndefined();
    await moveOnByHand(shortsFeed, 3);
    shortsFeed.clock.advance(OVER_A_SECOND);

    await expect.poll(() => shortsFeed.dialog()).toBeDefined();
  });

  it('nudges again only after another full limit in minutes', async () => {
    const shortsFeed = await mount(page, { kind: 'minutes', value: 10 });
    await playing(shortsFeed);
    shortsFeed.clock.advance(10 * MINUTE + OVER_A_SECOND);
    await expect.poll(() => shortsFeed.dialog()).toBeDefined();
    shortsFeed.pressDialogAction('Keep watching');
    await playing(shortsFeed);

    shortsFeed.clock.advance(9 * MINUTE);
    await aMomentLater();
    expect(shortsFeed.dialog()).toBeUndefined();
    shortsFeed.clock.advance(MINUTE + OVER_A_SECOND);

    await expect.poll(() => shortsFeed.dialog()).toBeDefined();
  });

  it('counts the next limit from the dismissal in every tab', async () => {
    const shared = {
      settings: createTestSettingsStore({ autoScroll: false, sessionLimit: { kind: 'shorts', value: 2 } }),
      session: createTestSessionStore({ shortsWatched: 1 }),
      clock: createTestClock(),
    };
    const tabA = await mountShortsFeed(page, shared);
    await nudged(tabA);
    tabA.pressDialogAction('Keep watching');

    // A second tab, opened after the viewer chose to keep watching.
    const tabB = await mountShortsFeed(page, shared);
    tabA.pause();
    await playing(tabB);
    shared.clock.advance(OVER_A_SECOND);
    await expect.poll(async () => (await shared.session.get()).shortsWatched).toBe(3);
    await aMomentLater();

    expect(tabB.dialog()).toBeUndefined();
  });

  it('takes the Break Nudge away when the viewer leaves the Shorts Feed', async () => {
    const shortsFeed = await nudged(await mount(page, { kind: 'shorts', value: 1 }));

    shortsFeed.navigate('/feed/subscriptions');
    shortsFeed.clock.advance(ROUTE_CHECK);

    expect(shortsFeed.dialog()).toBeUndefined();
  });

  it('goes with the engine when it is torn down', async () => {
    const shortsFeed = await nudged(await mount(page, { kind: 'shorts', value: 1 }));

    shortsFeed.unmountEngine();

    expect(shortsFeed.dialog()).toBeUndefined();
  });

  it("looks like YouTube's dialog in the dark theme", async () => {
    const shortsFeed = await nudged(await mount(page, { kind: 'shorts', value: 1 }));
    shortsFeed.setTheme('dark');

    await expect.poll(() => getComputedStyle(shortsFeed.dialog()!.element).backgroundColor).toBe('rgb(33, 33, 33)');
    expect(getComputedStyle(shortsFeed.dialog()!.element).borderRadius).toBe('12px');
  });

  it("looks like YouTube's dialog in the light theme", async () => {
    const shortsFeed = await nudged(await mount(page, { kind: 'shorts', value: 1 }));
    shortsFeed.setTheme('light');

    await expect.poll(() => getComputedStyle(shortsFeed.dialog()!.element).backgroundColor).toBe('rgb(255, 255, 255)');
  });

  it('sits over the player', async () => {
    const shortsFeed = await nudged(await mount(page, { kind: 'shorts', value: 1 }));
    const nudge = shortsFeed.dialog()!.element.getBoundingClientRect();
    const short = shortsFeed.document.querySelector('video[src]')!.getBoundingClientRect();

    const middle = { x: nudge.left + nudge.width / 2, y: nudge.top + nudge.height / 2 };
    expect(middle.x).toBeGreaterThan(short.left);
    expect(middle.x).toBeLessThan(short.right);
    expect(middle.y).toBeGreaterThan(short.top);
    expect(middle.y).toBeLessThan(short.bottom);
  });
});

/** Lets the Current Short count, and waits for the Break Nudge a limit of one Short brings. */
async function nudged(shortsFeed: ShortsFeed) {
  await playing(shortsFeed);
  shortsFeed.clock.advance(OVER_A_SECOND);
  await expect.poll(() => shortsFeed.dialog()).toBeDefined();
  return shortsFeed;
}

/** Moves on to the `n`th Short with YouTube's Next video control, and waits for it to play. */
async function moveOnByHand(shortsFeed: ShortsFeed, n: number) {
  shortsFeed.pressNextVideo();
  await expect.poll(() => shortsFeed.timeline).toContain(`Short ${n} is current`);
  await playing(shortsFeed);
}

/** The Shorts Feed with a Session Limit set and a Session under way, each Short looping in place. */
function mount(page: TestPage, sessionLimit: Settings['sessionLimit'], session: Partial<Session> = {}) {
  return mountShortsFeed(page, {
    settings: createTestSettingsStore({ autoScroll: false, sessionLimit }),
    session: createTestSessionStore(session),
  });
}

/** Waits for the Current Short to be playing. */
async function playing(shortsFeed: ShortsFeed) {
  await expect.poll(() => shortsFeed.playing(), TWO_SHORTS).toBe(true);
}
