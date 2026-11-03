import { describe, expect, it } from 'vitest';
import { aMomentLater, expectTimeline, mountShortsFeed, type ShortsFeed } from './support/shorts-feed';
import { createTestSettingsStore } from './support/stores';
import { sponsoredShort, testPages } from './support/test-pages';

const withSponsoredShort = testPages.filter((page) => sponsoredShort(page) !== undefined);

it('has a test page with a Sponsored Short', () => {
  expect(withSponsoredShort).not.toEqual([]);
});

/** The viewer presses Next video until `short` (from 1) is the Current Short. */
function pressNextVideoUntil(shortsFeed: ShortsFeed, short: number) {
  for (let n = 1; n < short; n++) shortsFeed.pressNextVideo();
}

/** The timeline as the viewer moves from Short 1 on to Short `last`, one at a time. */
function arrivals(last: number) {
  return Array.from({ length: last - 1 }, (_, i) => `Short ${i + 2} is current`);
}

describe.each(withSponsoredShort)('on $name', (page) => {
  const sponsored = sponsoredShort(page)!;

  it.each([true, false])('skips a Sponsored Short as soon as it is current, with Auto-Scroll %s', async (autoScroll) => {
    const shortsFeed = await mountShortsFeed(page, { settings: createTestSettingsStore({ autoScroll, skipSponsoredShorts: true }) });

    pressNextVideoUntil(shortsFeed, sponsored);

    await expectTimeline(shortsFeed, arrivals(sponsored + 1));
    expect(shortsFeed.timeline).not.toContain(`Short ${sponsored} started over`);
  });

  it('lets a Sponsored Short play like any other while the setting is off', async () => {
    const shortsFeed = await mountShortsFeed(page, {
      settings: createTestSettingsStore({ autoScroll: false, skipSponsoredShorts: false }),
    });

    pressNextVideoUntil(shortsFeed, sponsored);

    await expectTimeline(shortsFeed, [...arrivals(sponsored), `Short ${sponsored} started over`]);
    expect(shortsFeed.timeline).not.toContain(`Short ${sponsored + 1} is current`);
  });

  it('skips the Sponsored Short on screen once the setting is switched on, in any tab', async () => {
    const settings = createTestSettingsStore({ autoScroll: false, skipSponsoredShorts: false });
    const shortsFeed = await mountShortsFeed(page, { settings });
    pressNextVideoUntil(shortsFeed, sponsored);
    await expectTimeline(shortsFeed, arrivals(sponsored));

    await settings.set({ skipSponsoredShorts: true });

    await expectTimeline(shortsFeed, arrivals(sponsored + 1));
  });

  it('skips a Sponsored Short that keeps the address of the Short before it, with no Stall', async () => {
    // Auto-Scroll Advances onto the Sponsored Short, then the skip Advances
    // again from what is, by the address alone, the same Short.
    const shortsFeed = await mountShortsFeed(page, {
      settings: createTestSettingsStore({ autoScroll: true }),
      sponsoredKeepsAddress: true,
    });
    pressNextVideoUntil(shortsFeed, sponsored - 1);

    await expectTimeline(shortsFeed, [
      ...arrivals(sponsored - 1),
      `Short ${sponsored - 1} started over`,
      `Short ${sponsored} is current`,
      `Short ${sponsored + 1} is current`,
    ]);
    shortsFeed.clock.advance(3000);
    await aMomentLater();

    expect(shortsFeed.notice()).toBeUndefined();
  });

  it('never skips a Short that is not sponsored', async () => {
    const shortsFeed = await mountShortsFeed(page, { settings: createTestSettingsStore({ autoScroll: false, skipSponsoredShorts: true }) });

    pressNextVideoUntil(shortsFeed, sponsored - 1);

    await expectTimeline(shortsFeed, [...arrivals(sponsored - 1), `Short ${sponsored - 1} started over`]);
    await aMomentLater();
    expect(shortsFeed.timeline).not.toContain(`Short ${sponsored} is current`);
  });
});

describe.each(testPages.filter((page) => sponsoredShort(page) === undefined))('on $name', (page) => {
  it('skips nothing where no Short is sponsored', async () => {
    const shortsFeed = await mountShortsFeed(page, { settings: createTestSettingsStore({ autoScroll: false, skipSponsoredShorts: true }) });

    await expectTimeline(shortsFeed, ['Short 1 started over']);
    expect(shortsFeed.timeline).not.toContain('Short 2 is current');
  });
});
